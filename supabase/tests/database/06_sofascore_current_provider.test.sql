-- Phase 4: SofaScore current-provider pilot registration contracts
select plan(11);

select has_table('public', 'competition_provider_settings', 'Provider settings table exists');
select has_function('public', 'apply_provider_result_batch', ARRAY['text', 'text[]'], 'Provider result batch wrapper exists');
select has_column('public', 'event_data_quality', 'result_verification_stage', 'Result verification stage is persisted');
select has_function('public', 'verify_completed_result_batch', ARRAY['text', 'bigint[]', 'timestamp with time zone'], 'Completed-result verifier wrapper exists');
select ok(
  exists (select 1 from public.data_providers where slug = 'sofascore' and is_active = true),
  'SofaScore provider is registered and active as a configured provider'
);
select is(
  (select count(*)::int from public.competition_provider_settings cps
   join public.competitions c on c.id = cps.competition_id
   where cps.provider_slug = 'sofascore'
     and c.slug in ('currie-cup', 'united-rugby-championship')),
  2,
  'Both Phase 4 pilot competitions have SofaScore settings'
);
select is(
  (select count(*)::int from public.competition_provider_settings cps
   join public.competitions c on c.id = cps.competition_id
   where cps.provider_slug = 'sofascore'
     and c.slug in ('currie-cup', 'united-rugby-championship')
     and cps.enabled = false
     and cps.observe_only = true
     and cps.fixture_authority = false
     and cps.allow_single_source_result_finalization = false),
  2,
  'Pilot settings are disabled and observe-only by default'
);
select is(
  (select config->>'unique_tournament_id' from public.competition_provider_settings cps
   join public.competitions c on c.id = cps.competition_id
   where c.slug = 'currie-cup' and cps.provider_slug = 'sofascore'),
  '796',
  'Currie Cup SofaScore tournament ID is explicit'
);
select is(
  (select config->>'current_season_id' from public.competition_provider_settings cps
   join public.competitions c on c.id = cps.competition_id
   where c.slug = 'currie-cup' and cps.provider_slug = 'sofascore'),
  '97057',
  'Currie Cup current season ID is explicit'
);
select is(
  (select config->>'unique_tournament_id' from public.competition_provider_settings cps
   join public.competitions c on c.id = cps.competition_id
   where c.slug = 'united-rugby-championship' and cps.provider_slug = 'sofascore'),
  '419',
  'URC SofaScore tournament ID is explicit'
);
select is(
  (select config->>'current_season_id' from public.competition_provider_settings cps
   join public.competitions c on c.id = cps.competition_id
   where c.slug = 'united-rugby-championship' and cps.provider_slug = 'sofascore'),
  '98406',
  'URC current season ID is explicit'
);

select * from finish();
