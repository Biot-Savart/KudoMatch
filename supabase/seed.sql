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
