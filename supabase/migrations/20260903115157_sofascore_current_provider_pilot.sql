-- Phase 4: SofaScore current-provider pilot registration.
-- Activation remains disabled/observe-only until the Phase 4 runtime, mapping,
-- and pilot evidence gates are explicitly completed.

insert into public.data_providers (slug, name, server_config_id, is_active)
values ('sofascore', 'SofaScore Rugby Union via internal gateway', 'sofascore_gateway', true)
on conflict (slug) do update set
  name = excluded.name,
  server_config_id = excluded.server_config_id,
  is_active = excluded.is_active;

insert into public.competition_provider_settings (
  competition_id,
  provider_slug,
  enabled,
  observe_only,
  fixture_priority,
  result_priority,
  standings_priority,
  fixture_authority,
  allow_single_source_result_finalization,
  config
)
select
  c.id,
  'sofascore',
  false,
  true,
  1,
  1,
  1,
  false,
  false,
  case c.slug
    when 'currie-cup' then '{"unique_tournament_id": 796, "current_season_id": 97057}'::jsonb
    when 'united-rugby-championship' then '{"unique_tournament_id": 419, "current_season_id": 98406}'::jsonb
    else '{}'::jsonb
  end
from public.competitions c
where c.sport_slug = 'rugby-union'
  and c.slug in ('currie-cup', 'united-rugby-championship')
on conflict (competition_id, provider_slug) do update set
  fixture_priority = excluded.fixture_priority,
  result_priority = excluded.result_priority,
  standings_priority = excluded.standings_priority,
  config = excluded.config;
