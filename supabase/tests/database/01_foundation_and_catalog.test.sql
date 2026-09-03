-- pgTAP Database & Security Tests for Phase 11: Multi-Sport Core Schema
begin;
select plan(29);

-- 1. Schema & Table existence
select has_schema('private', 'Private schema exists');
select has_table('public', 'profiles', 'Public profiles table exists');
select has_table('public', 'sports', 'Public sports table exists');
select has_table('public', 'competitions', 'Public competitions table exists');
select has_table('public', 'competition_editions', 'Public competition_editions table exists');
select has_table('public', 'competitors', 'Public competitors table exists');
select has_table('public', 'edition_competitors', 'Public edition_competitors table exists');
select has_table('public', 'events', 'Public events table exists');
select has_table('public', 'event_competitors', 'Public event_competitors table exists');
select has_table('public', 'data_providers', 'Public data_providers table exists');
select has_table('public', 'external_entity_refs', 'Public external_entity_refs table exists');
select has_table('public', 'ingestion_quarantine', 'Public ingestion_quarantine table exists');

-- 2. Constraints & Validation Rejections
-- Invalid sport slug
select throws_ok(
  $$ insert into public.sports (slug, name) values ('Invalid_Slug!', 'Test') $$,
  '23514',
  NULL,
  'Rejects invalid sport slug format'
);

-- Invalid competition edition dates (ends_at < starts_at)
select throws_ok(
  $$ insert into public.competition_editions (competition_id, season_key, name, starts_at, ends_at)
     values ((select id from public.competitions limit 1), 'test', 'Test', '2026-05-01Z', '2026-04-01Z') $$,
  '23514',
  NULL,
  'Rejects edition with ends_at before starts_at'
);

-- Invalid event competitor slot <= 0
select throws_ok(
  $$ insert into public.event_competitors (event_id, competitor_id, slot, role)
     values ((select id from public.events limit 1), (select id from public.competitors limit 1), 0, 'home') $$,
  '23514',
  NULL,
  'Rejects event competitor slot 0'
);

-- Cross-sport rejection for edition_competitors
select throws_ok(
  $$ insert into public.edition_competitors (edition_id, competitor_id)
     values (
       (select ce.id from public.competition_editions ce join public.competitions c on c.id = ce.competition_id where c.sport_slug = 'football' limit 1),
       (select id from public.competitors where sport_slug = 'rugby-union' limit 1)
     ) $$,
  '23514',
  NULL,
  'Rejects edition_competitor with mismatched sport'
);

-- Cross-sport rejection for event_competitors
select throws_ok(
  $$ insert into public.event_competitors (event_id, competitor_id, slot, role)
     values (
       (select e.id from public.events e join public.competition_editions ce on ce.id = e.edition_id join public.competitions c on c.id = ce.competition_id where c.sport_slug = 'football' limit 1),
       (select id from public.competitors where sport_slug = 'rugby-union' limit 1),
       3,
       'participant'
     ) $$,
  '23514',
  NULL,
  'Rejects event_competitor with mismatched sport'
);

-- External entity ref target constraint (must have exactly one matching foreign key)
select throws_ok(
  $$ insert into public.external_entity_refs (provider_slug, entity_kind, external_key, competition_id, competitor_id)
     values ('api-football', 'competition', '999', (select id from public.competitions limit 1), (select id from public.competitors limit 1)) $$,
  '23514',
  NULL,
  'Rejects external entity ref with multiple target foreign keys'
);

-- Duplicate external key rejection for same provider and entity_kind
select throws_ok(
  $$ insert into public.external_entity_refs (provider_slug, entity_kind, external_key, competition_id)
     values ('api-football', 'competition', '39', (select id from public.competitions limit 1)) $$,
  '23505',
  NULL,
  'Rejects duplicate external key for same provider and entity_kind'
);

-- 3. Deterministic Seed Assertions
select is(
  (select count(*)::int from public.sports),
  2,
  'Deterministic seeds contain 2 sports'
);

select is(
  (select count(*)::int from public.competitions),
  10,
  'Deterministic seeds contain the football competition and nine Rugby launch competitions'
);

select is(
  (select count(*)::int from public.data_providers),
  7,
  'Deterministic seeds contain configured provider catalog entries'
);

-- 4. RLS & Visibility Tests
-- Test as anon role
set local role anon;

-- Anon can see both active sports from the current deterministic seed
select is(
  (select count(*)::int from public.sports),
  2,
  'Anon sees both active sports'
);

-- Anon can see active competitions belonging to active sports
select is(
  (select count(*)::int from public.competitions),
  2,
  'Anon sees the two active competitions'
);

-- Anon can see the seeded competitors plus approved runtime catalog additions.
select cmp_ok(
  (select count(*)::int from public.competitors),
  '>=',
  12,
  'Anon sees the seeded active competitors'
);

-- Anon cannot read operational data_providers or external_entity_refs directly
select throws_ok(
  $$ select count(*) from public.data_providers $$,
  '42501',
  NULL,
  'Anon is denied select on operational data_providers'
);

select throws_ok(
  $$ select count(*) from public.external_entity_refs $$,
  '42501',
  NULL,
  'Anon is denied select on operational external_entity_refs'
);

-- Anon cannot mutate catalog tables
select throws_ok(
  $$ insert into public.sports (slug, name) values ('tennis', 'Tennis') $$,
  '42501',
  NULL,
  'Anon cannot insert into sports'
);

-- Reset role to postgres for clean transaction finish
reset role;

-- 5. Profile Update & Ownership Test
-- Verify profiles table has no total_points column
select columns_are(
  'public',
  'profiles',
  ARRAY['id', 'email', 'full_name', 'avatar_url', 'created_at', 'updated_at'],
  'Profiles table contains exact expected columns and no total_points'
);

select * from finish();
rollback;
