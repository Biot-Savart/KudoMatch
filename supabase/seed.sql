-- Deterministic Seed Dataset for Phase 11: Multi-Sport Core Schema

-- 1. Sports
insert into public.sports (slug, name, icon_key, default_score_unit, is_active, display_order)
values
  ('football', 'Football', 'football', 'goals', true, 1),
  ('rugby-union', 'Rugby Union', 'rugby', 'points', false, 2)
on conflict (slug) do update set
  name = excluded.name,
  icon_key = excluded.icon_key,
  default_score_unit = excluded.default_score_unit,
  is_active = excluded.is_active,
  display_order = excluded.display_order;

-- 2. Data Providers
insert into public.data_providers (slug, name, server_config_id, is_active)
values
  ('api-football', 'API-Football (RapidAPI)', 'rapidapi_api_football', true),
  ('api-rugby', 'API-Rugby (RapidAPI)', 'rapidapi_api_rugby', true)
on conflict (slug) do update set
  name = excluded.name,
  server_config_id = excluded.server_config_id,
  is_active = excluded.is_active;

-- 3. Competitions
insert into public.competitions (sport_slug, slug, name, kind, country, logo_url, is_active)
values
  ('football', 'premier-league', 'Premier League', 'league', 'England', 'https://media.api-sports.io/football/leagues/39.png', true),
  ('rugby-union', 'six-nations', 'Six Nations Championship', 'cup', 'Europe', 'https://media.api-sports.io/rugby/leagues/1.png', true)
on conflict (sport_slug, slug) do update set
  name = excluded.name,
  kind = excluded.kind,
  country = excluded.country,
  logo_url = excluded.logo_url,
  is_active = excluded.is_active;

-- 4. Competition Editions
insert into public.competition_editions (competition_id, season_key, name, starts_at, ends_at, status, metadata)
values
  (
    (select id from public.competitions where sport_slug = 'football' and slug = 'premier-league'),
    '2025-2026',
    'Premier League 2025/2026',
    '2025-08-15 00:00:00Z',
    '2026-05-24 23:59:59Z',
    'active',
    '{"current_round": 1}'::jsonb
  ),
  (
    (select id from public.competitions where sport_slug = 'rugby-union' and slug = 'six-nations'),
    '2026',
    'Six Nations 2026',
    '2026-02-06 00:00:00Z',
    '2026-03-21 23:59:59Z',
    'planned',
    '{"format": "round_robin"}'::jsonb
  )
on conflict (competition_id, season_key) do update set
  name = excluded.name,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  status = excluded.status,
  metadata = excluded.metadata;

-- 5. Competitors
-- Football Competitors
insert into public.competitors (sport_slug, kind, name, short_name, media_url, country_code, is_active)
values
  ('football', 'team', 'Arsenal FC', 'Arsenal', 'https://media.api-sports.io/football/teams/42.png', 'GB-ENG', true),
  ('football', 'team', 'Chelsea FC', 'Chelsea', 'https://media.api-sports.io/football/teams/49.png', 'GB-ENG', true),
  ('football', 'team', 'Liverpool FC', 'Liverpool', 'https://media.api-sports.io/football/teams/40.png', 'GB-ENG', true),
  ('football', 'team', 'Manchester City', 'Man City', 'https://media.api-sports.io/football/teams/50.png', 'GB-ENG', true),
  ('football', 'team', 'Manchester United', 'Man United', 'https://media.api-sports.io/football/teams/33.png', 'GB-ENG', true),
  ('football', 'team', 'Tottenham Hotspur', 'Tottenham', 'https://media.api-sports.io/football/teams/47.png', 'GB-ENG', true),
  -- Rugby Competitors
  ('rugby-union', 'team', 'England Rugby', 'England', 'https://media.api-sports.io/rugby/teams/15.png', 'GB-ENG', true),
  ('rugby-union', 'team', 'France Rugby', 'France', 'https://media.api-sports.io/rugby/teams/16.png', 'FR', true),
  ('rugby-union', 'team', 'Ireland Rugby', 'Ireland', 'https://media.api-sports.io/rugby/teams/17.png', 'IE', true),
  ('rugby-union', 'team', 'Italy Rugby', 'Italy', 'https://media.api-sports.io/rugby/teams/18.png', 'IT', true),
  ('rugby-union', 'team', 'Scotland Rugby', 'Scotland', 'https://media.api-sports.io/rugby/teams/19.png', 'GB-SCT', true),
  ('rugby-union', 'team', 'Wales Rugby', 'Wales', 'https://media.api-sports.io/rugby/teams/20.png', 'GB-WLS', true)
on conflict do nothing;

-- 6. Edition Competitors Membership
-- Link Football Teams to Premier League 2025/2026
insert into public.edition_competitors (edition_id, competitor_id, display_order)
select
  ce.id,
  c.id,
  row_number() over (order by c.name)
from public.competitors c
cross join public.competition_editions ce
join public.competitions comp on comp.id = ce.competition_id
where comp.sport_slug = 'football'
  and comp.slug = 'premier-league'
  and ce.season_key = '2025-2026'
  and c.sport_slug = 'football'
on conflict (edition_id, competitor_id) do nothing;

-- Link Rugby Teams to Six Nations 2026
insert into public.edition_competitors (edition_id, competitor_id, display_order)
select
  ce.id,
  c.id,
  row_number() over (order by c.name)
from public.competitors c
cross join public.competition_editions ce
join public.competitions comp on comp.id = ce.competition_id
where comp.sport_slug = 'rugby-union'
  and comp.slug = 'six-nations'
  and ce.season_key = '2026'
  and c.sport_slug = 'rugby-union'
on conflict (edition_id, competitor_id) do nothing;

-- 7. Deterministic Events
-- Football Match 1: Arsenal vs Chelsea
insert into public.events (edition_id, kind, starts_at, status, round_label, sequence_number, venue_name, is_neutral_venue, metadata)
select
  ce.id,
  'match',
  '2026-08-30 16:30:00Z',
  'scheduled',
  'Gameweek 1',
  1,
  'Emirates Stadium',
  false,
  '{"gameweek": 1}'::jsonb
from public.competition_editions ce
join public.competitions comp on comp.id = ce.competition_id
where comp.sport_slug = 'football' and comp.slug = 'premier-league' and ce.season_key = '2025-2026'
on conflict do nothing;

-- Football Match 2: Liverpool vs Manchester City
insert into public.events (edition_id, kind, starts_at, status, round_label, sequence_number, venue_name, is_neutral_venue, metadata)
select
  ce.id,
  'match',
  '2026-08-30 19:00:00Z',
  'scheduled',
  'Gameweek 1',
  2,
  'Anfield',
  false,
  '{"gameweek": 1}'::jsonb
from public.competition_editions ce
join public.competitions comp on comp.id = ce.competition_id
where comp.sport_slug = 'football' and comp.slug = 'premier-league' and ce.season_key = '2025-2026'
on conflict do nothing;

-- Rugby Match 1: France vs Ireland
insert into public.events (edition_id, kind, starts_at, status, round_label, sequence_number, venue_name, is_neutral_venue, metadata)
select
  ce.id,
  'match',
  '2026-02-06 20:00:00Z',
  'scheduled',
  'Round 1',
  1,
  'Stade de France',
  false,
  '{"round": 1}'::jsonb
from public.competition_editions ce
join public.competitions comp on comp.id = ce.competition_id
where comp.sport_slug = 'rugby-union' and comp.slug = 'six-nations' and ce.season_key = '2026'
on conflict do nothing;

-- 8. Event Competitors (Slots & Roles)
-- Link Arsenal (Home) & Chelsea (Away) to Match 1
insert into public.event_competitors (event_id, competitor_id, slot, role)
select
  e.id,
  c.id,
  1,
  'home'
from public.events e
join public.competition_editions ce on ce.id = e.edition_id
join public.competitions comp on comp.id = ce.competition_id
cross join public.competitors c
where comp.slug = 'premier-league'
  and e.round_label = 'Gameweek 1'
  and e.sequence_number = 1
  and c.name = 'Arsenal FC'
on conflict (event_id, competitor_id) do nothing;

insert into public.event_competitors (event_id, competitor_id, slot, role)
select
  e.id,
  c.id,
  2,
  'away'
from public.events e
join public.competition_editions ce on ce.id = e.edition_id
join public.competitions comp on comp.id = ce.competition_id
cross join public.competitors c
where comp.slug = 'premier-league'
  and e.round_label = 'Gameweek 1'
  and e.sequence_number = 1
  and c.name = 'Chelsea FC'
on conflict (event_id, competitor_id) do nothing;

-- Link Liverpool (Home) & Man City (Away) to Match 2
insert into public.event_competitors (event_id, competitor_id, slot, role)
select
  e.id,
  c.id,
  1,
  'home'
from public.events e
join public.competition_editions ce on ce.id = e.edition_id
join public.competitions comp on comp.id = ce.competition_id
cross join public.competitors c
where comp.slug = 'premier-league'
  and e.round_label = 'Gameweek 1'
  and e.sequence_number = 2
  and c.name = 'Liverpool FC'
on conflict (event_id, competitor_id) do nothing;

insert into public.event_competitors (event_id, competitor_id, slot, role)
select
  e.id,
  c.id,
  2,
  'away'
from public.events e
join public.competition_editions ce on ce.id = e.edition_id
join public.competitions comp on comp.id = ce.competition_id
cross join public.competitors c
where comp.slug = 'premier-league'
  and e.round_label = 'Gameweek 1'
  and e.sequence_number = 2
  and c.name = 'Manchester City'
on conflict (event_id, competitor_id) do nothing;

-- Link France (Home) & Ireland (Away) to Rugby Match 1
insert into public.event_competitors (event_id, competitor_id, slot, role)
select
  e.id,
  c.id,
  1,
  'home'
from public.events e
join public.competition_editions ce on ce.id = e.edition_id
join public.competitions comp on comp.id = ce.competition_id
cross join public.competitors c
where comp.slug = 'six-nations'
  and e.round_label = 'Round 1'
  and e.sequence_number = 1
  and c.name = 'France Rugby'
on conflict (event_id, competitor_id) do nothing;

insert into public.event_competitors (event_id, competitor_id, slot, role)
select
  e.id,
  c.id,
  2,
  'away'
from public.events e
join public.competition_editions ce on ce.id = e.edition_id
join public.competitions comp on comp.id = ce.competition_id
cross join public.competitors c
where comp.slug = 'six-nations'
  and e.round_label = 'Round 1'
  and e.sequence_number = 1
  and c.name = 'Ireland Rugby'
on conflict (event_id, competitor_id) do nothing;

-- 9. External Entity References
-- Provider mapping for Premier League (api-football league 39)
insert into public.external_entity_refs (provider_slug, entity_kind, external_key, competition_id, is_primary)
select
  'api-football',
  'competition',
  '39',
  c.id,
  true
from public.competitions c
where c.sport_slug = 'football' and c.slug = 'premier-league'
on conflict (provider_slug, entity_kind, external_key) do nothing;

-- Provider mapping for Six Nations (api-rugby league 1)
insert into public.external_entity_refs (provider_slug, entity_kind, external_key, competition_id, is_primary)
select
  'api-rugby',
  'competition',
  '1',
  c.id,
  true
from public.competitions c
where c.sport_slug = 'rugby-union' and c.slug = 'six-nations'
on conflict (provider_slug, entity_kind, external_key) do nothing;

-- Provider mappings for Arsenal (42) and Chelsea (49)
insert into public.external_entity_refs (provider_slug, entity_kind, external_key, competitor_id, is_primary)
select
  'api-football',
  'competitor',
  '42',
  c.id,
  true
from public.competitors c
where c.sport_slug = 'football' and c.name = 'Arsenal FC'
on conflict (provider_slug, entity_kind, external_key) do nothing;

insert into public.external_entity_refs (provider_slug, entity_kind, external_key, competitor_id, is_primary)
select
  'api-football',
  'competitor',
  '49',
  c.id,
  true
from public.competitors c
where c.sport_slug = 'football' and c.name = 'Chelsea FC'
on conflict (provider_slug, entity_kind, external_key) do nothing;

-- ============================================================================
-- PHASE 12 SEEDS: Scoring Rulesets, Markets, Pools, Predictions & Settlement
-- ============================================================================

-- 10. Test Profiles (for deterministic pool and prediction seeding)
insert into public.profiles (id, username, display_name, avatar_url)
values
  ('11111111-1111-1111-1111-111111111111', 'alice_predictor', 'Alice Walker', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice'),
  ('22222222-2222-2222-2222-222222222222', 'bob_tipster', 'Bob Turner', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob'),
  ('33333333-3333-3333-3333-333333333333', 'carol_guru', 'Carol Davis', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carol')
on conflict (id) do update set
  username = excluded.username,
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url;

-- 11. Scoring Rulesets
insert into public.scoring_rulesets (
  sport_slug,
  market_kind,
  evaluator_key,
  version,
  max_raw_points,
  evaluator_config,
  ui_config,
  is_active
)
values
  (
    'football',
    'team_scoreline',
    'football_scoreline_v1',
    1,
    3,
    '{"kind": "team_scoreline", "version": 1}'::jsonb,
    '{"score_unit": "goals", "limits": {"home": [0, 20], "away": [0, 20]}}'::jsonb,
    true
  ),
  (
    'rugby-union',
    'team_scoreline',
    'rugby_union_scoreline_v1',
    1,
    6,
    '{"kind": "team_scoreline", "version": 1, "margin_close_threshold": 5}'::jsonb,
    '{"score_unit": "points", "limits": {"home": [0, 100], "away": [0, 100]}}'::jsonb,
    true
  )
on conflict (sport_slug, market_kind, version) do update set
  evaluator_key = excluded.evaluator_key,
  max_raw_points = excluded.max_raw_points,
  evaluator_config = excluded.evaluator_config,
  ui_config = excluded.ui_config,
  is_active = excluded.is_active;

-- 12. Scoring Rule Tiers
-- Football Tiers
insert into public.scoring_rule_tiers (ruleset_id, tier_code, raw_points, rank_order, label, description, example)
select
  r.id,
  t.tier_code,
  t.raw_points,
  t.rank_order,
  t.label,
  t.description,
  t.example
from public.scoring_rulesets r
cross join (
  values
    ('exact_score', 3, 1, 'Exact Score', 'Exact scoreline matched for both home and away teams', 'Predicted 2-1, actual 2-1'),
    ('exact_margin', 2, 2, 'Outcome & Margin', 'Correct outcome and exact goal difference', 'Predicted 2-0 (+2), actual 3-1 (+2)'),
    ('outcome', 1, 3, 'Outcome Only', 'Correct outcome (winner or draw) with different goal difference', 'Predicted 2-1 (+1), actual 4-0 (+4)'),
    ('miss', 0, 4, 'Miss', 'Incorrect outcome', 'Predicted 2-1, actual 1-1')
) as t(tier_code, raw_points, rank_order, label, description, example)
where r.sport_slug = 'football' and r.version = 1
on conflict (ruleset_id, tier_code) do update set
  raw_points = excluded.raw_points,
  rank_order = excluded.rank_order,
  label = excluded.label,
  description = excluded.description,
  example = excluded.example;

-- Rugby Union Tiers
insert into public.scoring_rule_tiers (ruleset_id, tier_code, raw_points, rank_order, label, description, example)
select
  r.id,
  t.tier_code,
  t.raw_points,
  t.rank_order,
  t.label,
  t.description,
  t.example
from public.scoring_rulesets r
cross join (
  values
    ('exact_score', 6, 1, 'Exact Score', 'Exact points matched for both home and away teams', 'Predicted 27-22, actual 27-22'),
    ('exact_margin', 4, 2, 'Outcome & Exact Margin', 'Correct outcome and exact signed margin', 'Predicted 30-20 (+10), actual 25-15 (+10)'),
    ('close_margin', 3, 3, 'Outcome & Close Margin', 'Correct outcome with signed margin error <= 5 points', 'Predicted 24-17 (+7), actual 27-21 (+6)'),
    ('outcome', 2, 4, 'Outcome Only', 'Correct outcome with signed margin error > 5 points', 'Predicted 40-10 (+30), actual 20-10 (+10)'),
    ('miss', 0, 5, 'Miss', 'Incorrect outcome', 'Predicted 25-20, actual 15-22')
) as t(tier_code, raw_points, rank_order, label, description, example)
where r.sport_slug = 'rugby-union' and r.version = 1
on conflict (ruleset_id, tier_code) do update set
  raw_points = excluded.raw_points,
  rank_order = excluded.rank_order,
  label = excluded.label,
  description = excluded.description,
  example = excluded.example;

-- 13. Event Markets
-- Markets for Football Events
insert into public.event_markets (
  event_id,
  market_kind,
  payload_schema_version,
  ruleset_id,
  sequence_no,
  is_current,
  opens_at,
  locks_at,
  status
)
select
  e.id,
  'team_scoreline',
  1,
  r.id,
  1,
  true,
  e.starts_at - interval '7 days',
  e.starts_at,
  'open'
from public.events e
join public.competition_editions ce on ce.id = e.edition_id
join public.competitions c on c.id = ce.competition_id
join public.scoring_rulesets r on r.sport_slug = c.sport_slug and r.market_kind = 'team_scoreline' and r.version = 1
where c.sport_slug = 'football'
on conflict (event_id, market_kind, sequence_no) do update set
  ruleset_id = excluded.ruleset_id,
  opens_at = excluded.opens_at,
  locks_at = excluded.locks_at,
  status = excluded.status;

-- Markets for Rugby Events
insert into public.event_markets (
  event_id,
  market_kind,
  payload_schema_version,
  ruleset_id,
  sequence_no,
  is_current,
  opens_at,
  locks_at,
  status
)
select
  e.id,
  'team_scoreline',
  1,
  r.id,
  1,
  true,
  e.starts_at - interval '7 days',
  e.starts_at,
  'open'
from public.events e
join public.competition_editions ce on ce.id = e.edition_id
join public.competitions c on c.id = ce.competition_id
join public.scoring_rulesets r on r.sport_slug = c.sport_slug and r.market_kind = 'team_scoreline' and r.version = 1
where c.sport_slug = 'rugby-union'
on conflict (event_id, market_kind, sequence_no) do update set
  ruleset_id = excluded.ruleset_id,
  opens_at = excluded.opens_at,
  locks_at = excluded.locks_at,
  status = excluded.status;

-- 14. Scoped Pools
insert into public.pools (
  id,
  name,
  created_by,
  invite_code,
  scope_kind,
  sport_slug,
  competition_id,
  edition_id,
  scoring_mode,
  scoring_starts_at,
  is_private
)
values
  -- 1. All sports global pool (mandatory normalized scoring)
  (
    'a0000000-0000-0000-0000-000000000001',
    'Global Multi-Sport Championship',
    '11111111-1111-1111-1111-111111111111',
    'GLOBAL2026',
    'all_sports',
    null,
    null,
    null,
    'normalized',
    '2025-01-01 00:00:00Z',
    false
  ),
  -- 2. Football Sport Scoped Pool (raw points)
  (
    'b0000000-0000-0000-0000-000000000002',
    'Football Masterminds',
    '11111111-1111-1111-1111-111111111111',
    'FOOTY2026',
    'sport',
    'football',
    null,
    null,
    'raw',
    '2025-01-01 00:00:00Z',
    false
  ),
  -- 3. Rugby Union Sport Scoped Pool (raw points)
  (
    'c0000000-0000-0000-0000-000000000003',
    'Rugby Union Arena',
    '22222222-2222-2222-2222-222222222222',
    'RUGBY2026',
    'sport',
    'rugby-union',
    null,
    null,
    'raw',
    '2025-01-01 00:00:00Z',
    false
  ),
  -- 4. Premier League Competition Scoped Pool
  (
    'd0000000-0000-0000-0000-000000000004',
    'Premier League Elite',
    '11111111-1111-1111-1111-111111111111',
    'EPL2026',
    'competition',
    null,
    (select id from public.competitions where sport_slug = 'football' and slug = 'premier-league'),
    null,
    'raw',
    '2025-01-01 00:00:00Z',
    true
  ),
  -- 5. Six Nations Edition Scoped Pool
  (
    'e0000000-0000-0000-0000-000000000005',
    'Six Nations 2026 Showdown',
    '22222222-2222-2222-2222-222222222222',
    'SIXN2026',
    'edition',
    null,
    null,
    (select ce.id from public.competition_editions ce join public.competitions c on c.id = ce.competition_id where c.slug = 'six-nations' and ce.season_key = '2026'),
    'raw',
    '2025-01-01 00:00:00Z',
    true
  )
on conflict (id) do update set
  name = excluded.name,
  invite_code = excluded.invite_code,
  scope_kind = excluded.scope_kind,
  sport_slug = excluded.sport_slug,
  competition_id = excluded.competition_id,
  edition_id = excluded.edition_id,
  scoring_mode = excluded.scoring_mode;

-- 15. Pool Memberships
insert into public.pool_members (pool_id, user_id, role, joined_at, left_at)
values
  -- Global Pool Members (Alice admin, Bob & Carol members)
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'admin', '2025-01-01 00:00:00Z', null),
  ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'member', '2025-01-02 00:00:00Z', null),
  ('a0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'member', '2025-01-03 00:00:00Z', null),

  -- Football Pool Members
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'admin', '2025-01-01 00:00:00Z', null),
  ('b0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'member', '2025-01-02 00:00:00Z', null),

  -- Rugby Pool Members
  ('c0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'admin', '2025-01-01 00:00:00Z', null),
  ('c0000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'member', '2025-01-02 00:00:00Z', null),

  -- EPL Pool Members
  ('d0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'admin', '2025-01-01 00:00:00Z', null),
  ('d0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'member', '2025-01-02 00:00:00Z', null),

  -- Six Nations Pool Members
  ('e0000000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'admin', '2025-01-01 00:00:00Z', null),
  ('e0000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'member', '2025-01-02 00:00:00Z', null)
on conflict do nothing;

-- 16. Sample Predictions
-- Match 1 (Arsenal vs Chelsea) predictions
insert into public.predictions (
  user_id,
  event_market_id,
  selection,
  settlement_status
)
select
  p.user_id,
  em.id,
  p.selection,
  'pending'
from public.event_markets em
join public.events e on e.id = em.event_id
join public.competition_editions ce on ce.id = e.edition_id
join public.competitions c on c.id = ce.competition_id
cross join (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, '{"kind": "team_scoreline", "version": 1, "home": 2, "away": 1}'::jsonb),
    ('22222222-2222-2222-2222-222222222222'::uuid, '{"kind": "team_scoreline", "version": 1, "home": 3, "away": 1}'::jsonb),
    ('33333333-3333-3333-3333-333333333333'::uuid, '{"kind": "team_scoreline", "version": 1, "home": 1, "away": 1}'::jsonb)
) as p(user_id, selection)
where c.slug = 'premier-league' and e.sequence_number = 1
on conflict (user_id, event_market_id) do nothing;
