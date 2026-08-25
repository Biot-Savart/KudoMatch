-- Migration 2: Sports Catalog, Competitions, Editions, Competitors, Events, and External References
-- Phase 11: Multi-Sport Core Schema

-- ============================================================================
-- 1. Helper Triggers in private schema
-- ============================================================================

-- Cross-sport check for edition_competitors
create or replace function private.check_edition_competitor_sport()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edition_sport text;
  v_competitor_sport text;
begin
  select c.sport_slug into v_edition_sport
  from public.competition_editions ce
  join public.competitions c on c.id = ce.competition_id
  where ce.id = new.edition_id;

  select sport_slug into v_competitor_sport
  from public.competitors
  where id = new.competitor_id;

  if v_edition_sport is distinct from v_competitor_sport then
    raise exception 'Edition sport (%) does not match Competitor sport (%)',
      v_edition_sport, v_competitor_sport
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function private.check_edition_competitor_sport() from public, anon, authenticated;
grant execute on function private.check_edition_competitor_sport() to service_role, postgres;

-- Cross-sport check for event_competitors
create or replace function private.check_event_competitor_sport()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_sport text;
  v_competitor_sport text;
begin
  select c.sport_slug into v_event_sport
  from public.events e
  join public.competition_editions ce on ce.id = e.edition_id
  join public.competitions c on c.id = ce.competition_id
  where e.id = new.event_id;

  select sport_slug into v_competitor_sport
  from public.competitors
  where id = new.competitor_id;

  if v_event_sport is distinct from v_competitor_sport then
    raise exception 'Event sport (%) does not match Competitor sport (%)',
      v_event_sport, v_competitor_sport
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function private.check_event_competitor_sport() from public, anon, authenticated;
grant execute on function private.check_event_competitor_sport() to service_role, postgres;


-- ============================================================================
-- 2. Domain & Catalog Tables
-- ============================================================================

-- Sports
create table if not exists public.sports (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  icon_key text,
  default_score_unit text not null default 'points',
  is_active boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_sports_updated_at
  before update on public.sports
  for each row
  execute function private.set_updated_at();

-- Competitions
create table if not exists public.competitions (
  id bigint generated always as identity primary key,
  sport_slug text not null references public.sports(slug) on update cascade on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  kind text not null default 'league' check (kind in ('league', 'cup', 'tour', 'race_series')),
  country text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_competitions_sport_slug unique (sport_slug, slug)
);

create index ifs_competitions_sport_slug on public.competitions (sport_slug);

create trigger set_competitions_updated_at
  before update on public.competitions
  for each row
  execute function private.set_updated_at();

-- Competition Editions (Seasons)
create table if not exists public.competition_editions (
  id bigint generated always as identity primary key,
  competition_id bigint not null references public.competitions(id) on delete cascade,
  season_key text not null,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_edition_dates check (ends_at >= starts_at),
  constraint uq_competition_editions_season unique (competition_id, season_key)
);

create index idx_competition_editions_competition_id on public.competition_editions (competition_id);

create trigger set_competition_editions_updated_at
  before update on public.competition_editions
  for each row
  execute function private.set_updated_at();

-- Competitors
create table if not exists public.competitors (
  id bigint generated always as identity primary key,
  sport_slug text not null references public.sports(slug) on update cascade on delete restrict,
  kind text not null default 'team' check (kind in ('team', 'person', 'constructor')),
  name text not null,
  short_name text,
  media_url text,
  country_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_competitors_sport_slug on public.competitors (sport_slug);

create trigger set_competitors_updated_at
  before update on public.competitors
  for each row
  execute function private.set_updated_at();

-- Edition Competitors (Membership)
create table if not exists public.edition_competitors (
  edition_id bigint not null references public.competition_editions(id) on delete cascade,
  competitor_id bigint not null references public.competitors(id) on delete cascade,
  seed integer,
  group_conference text,
  display_order integer default 0,
  created_at timestamptz not null default now(),
  primary key (edition_id, competitor_id)
);

create index idx_edition_competitors_competitor_id on public.edition_competitors (competitor_id);

create constraint trigger check_edition_competitor_sport_trigger
  after insert or update on public.edition_competitors
  deferrable initially immediate
  for each row
  execute function private.check_edition_competitor_sport();

-- Events
create table if not exists public.events (
  id bigint generated always as identity primary key,
  edition_id bigint not null references public.competition_editions(id) on delete cascade,
  kind text not null default 'match' check (kind in ('match', 'race', 'session', 'bout')),
  starts_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'postponed', 'cancelled', 'abandoned')),
  round_label text,
  sequence_number integer,
  venue_name text,
  is_neutral_venue boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_events_edition_starts_at on public.events (edition_id, starts_at);
create index idx_events_edition_status_starts_at on public.events (edition_id, status, starts_at);
create index idx_events_scheduled_live on public.events (starts_at) where status in ('scheduled', 'live');

create trigger set_events_updated_at
  before update on public.events
  for each row
  execute function private.set_updated_at();

-- Event Competitors
create table if not exists public.event_competitors (
  event_id bigint not null references public.events(id) on delete cascade,
  competitor_id bigint not null references public.competitors(id) on delete cascade,
  slot smallint not null check (slot > 0),
  role text check (role in ('home', 'away', 'participant')),
  created_at timestamptz not null default now(),
  primary key (event_id, competitor_id),
  constraint uq_event_competitors_slot unique (event_id, slot)
);

create unique index uq_event_competitors_role on public.event_competitors (event_id, role) where role is not null;
create index idx_event_competitors_competitor_id on public.event_competitors (competitor_id);

create constraint trigger check_event_competitor_sport_trigger
  after insert or update on public.event_competitors
  deferrable initially immediate
  for each row
  execute function private.check_event_competitor_sport();


-- ============================================================================
-- 3. Providers & Canonical External Identity
-- ============================================================================

-- Data Providers
create table if not exists public.data_providers (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  server_config_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_data_providers_updated_at
  before update on public.data_providers
  for each row
  execute function private.set_updated_at();

-- External Entity References
create table if not exists public.external_entity_refs (
  id bigint generated always as identity primary key,
  provider_slug text not null references public.data_providers(slug) on delete cascade,
  entity_kind text not null check (entity_kind in ('competition', 'edition', 'competitor', 'event')),
  external_key text not null,
  competition_id bigint references public.competitions(id) on delete cascade,
  edition_id bigint references public.competition_editions(id) on delete cascade,
  competitor_id bigint references public.competitors(id) on delete cascade,
  event_id bigint references public.events(id) on delete cascade,
  is_primary boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_external_entity_refs_key unique (provider_slug, entity_kind, external_key),
  constraint check_external_entity_ref_target check (
    (entity_kind = 'competition' and competition_id is not null and edition_id is null and competitor_id is null and event_id is null) or
    (entity_kind = 'edition' and edition_id is not null and competition_id is null and competitor_id is null and event_id is null) or
    (entity_kind = 'competitor' and competitor_id is not null and competition_id is null and edition_id is null and event_id is null) or
    (entity_kind = 'event' and event_id is not null and competition_id is null and edition_id is null and competitor_id is null)
  )
);

create unique index uq_provider_primary_competition on public.external_entity_refs (provider_slug, competition_id) where is_primary = true and competition_id is not null;
create unique index uq_provider_primary_edition on public.external_entity_refs (provider_slug, edition_id) where is_primary = true and edition_id is not null;
create unique index uq_provider_primary_competitor on public.external_entity_refs (provider_slug, competitor_id) where is_primary = true and competitor_id is not null;
create unique index uq_provider_primary_event on public.external_entity_refs (provider_slug, event_id) where is_primary = true and event_id is not null;

create index idx_external_entity_refs_competition on public.external_entity_refs (competition_id) where competition_id is not null;
create index idx_external_entity_refs_edition on public.external_entity_refs (edition_id) where edition_id is not null;
create index idx_external_entity_refs_competitor on public.external_entity_refs (competitor_id) where competitor_id is not null;
create index idx_external_entity_refs_event on public.external_entity_refs (event_id) where event_id is not null;

create trigger set_external_entity_refs_updated_at
  before update on public.external_entity_refs
  for each row
  execute function private.set_updated_at();

-- Ingestion Quarantine
create table if not exists public.ingestion_quarantine (
  id bigint generated always as identity primary key,
  provider_slug text not null references public.data_providers(slug) on delete cascade,
  entity_kind text not null check (entity_kind in ('competition', 'edition', 'competitor', 'event', 'result', 'unknown')),
  external_key text,
  reason_code text not null,
  error_summary text not null,
  payload_fingerprint text,
  occurrence_count integer not null default 1 check (occurrence_count >= 1),
  status text not null default 'unresolved' check (status in ('unresolved', 'resolved', 'ignored')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ingestion_quarantine_provider_status on public.ingestion_quarantine (provider_slug, status);
create index idx_ingestion_quarantine_entity on public.ingestion_quarantine (entity_kind, external_key);

create trigger set_ingestion_quarantine_updated_at
  before update on public.ingestion_quarantine
  for each row
  execute function private.set_updated_at();


-- ============================================================================
-- 4. Row Level Security & Explicit Grants
-- ============================================================================

-- Enable RLS on all public tables
alter table public.sports enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_editions enable row level security;
alter table public.competitors enable row level security;
alter table public.edition_competitors enable row level security;
alter table public.events enable row level security;
alter table public.event_competitors enable row level security;
alter table public.data_providers enable row level security;
alter table public.external_entity_refs enable row level security;
alter table public.ingestion_quarantine enable row level security;

-- Revoke default public access
revoke all on table public.sports from public;
revoke all on table public.competitions from public;
revoke all on table public.competition_editions from public;
revoke all on table public.competitors from public;
revoke all on table public.edition_competitors from public;
revoke all on table public.events from public;
revoke all on table public.event_competitors from public;
revoke all on table public.data_providers from public;
revoke all on table public.external_entity_refs from public;
revoke all on table public.ingestion_quarantine from public;

-- Public Catalog read policies (hierarchical visibility)
-- 1. Sports: readable if active
create policy "Active sports are viewable by public"
  on public.sports for select
  to anon, authenticated
  using (is_active = true);

-- 2. Competitions: readable if active and sport is active
create policy "Active competitions are viewable by public"
  on public.competitions for select
  to anon, authenticated
  using (
    is_active = true and
    exists (
      select 1 from public.sports s
      where s.slug = competitions.sport_slug
        and s.is_active = true
    )
  );

-- 3. Competition Editions: readable if not cancelled and parent competition/sport are active
create policy "Active competition editions are viewable by public"
  on public.competition_editions for select
  to anon, authenticated
  using (
    status != 'cancelled' and
    exists (
      select 1 from public.competitions c
      join public.sports s on s.slug = c.sport_slug
      where c.id = competition_editions.competition_id
        and c.is_active = true
        and s.is_active = true
    )
  );

-- 4. Competitors: readable if active and sport is active
create policy "Active competitors are viewable by public"
  on public.competitors for select
  to anon, authenticated
  using (
    is_active = true and
    exists (
      select 1 from public.sports s
      where s.slug = competitors.sport_slug
        and s.is_active = true
    )
  );

-- 5. Edition Competitors: readable if both edition and competitor are visible
create policy "Visible edition competitors are viewable by public"
  on public.edition_competitors for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.competition_editions ce
      join public.competitions c on c.id = ce.competition_id
      join public.sports s on s.slug = c.sport_slug
      where ce.id = edition_competitors.edition_id
        and ce.status != 'cancelled'
        and c.is_active = true
        and s.is_active = true
    ) and
    exists (
      select 1 from public.competitors comp
      join public.sports s on s.slug = comp.sport_slug
      where comp.id = edition_competitors.competitor_id
        and comp.is_active = true
        and s.is_active = true
    )
  );

-- 6. Events: readable if not cancelled and edition/competition/sport are active
create policy "Visible events are viewable by public"
  on public.events for select
  to anon, authenticated
  using (
    status != 'cancelled' and
    exists (
      select 1 from public.competition_editions ce
      join public.competitions c on c.id = ce.competition_id
      join public.sports s on s.slug = c.sport_slug
      where ce.id = events.edition_id
        and ce.status != 'cancelled'
        and c.is_active = true
        and s.is_active = true
    )
  );

-- 7. Event Competitors: readable if parent event and competitor are visible
create policy "Visible event competitors are viewable by public"
  on public.event_competitors for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      join public.competition_editions ce on ce.id = e.edition_id
      join public.competitions c on c.id = ce.competition_id
      join public.sports s on s.slug = c.sport_slug
      where e.id = event_competitors.event_id
        and e.status != 'cancelled'
        and ce.status != 'cancelled'
        and c.is_active = true
        and s.is_active = true
    ) and
    exists (
      select 1 from public.competitors comp
      join public.sports s on s.slug = comp.sport_slug
      where comp.id = event_competitors.competitor_id
        and comp.is_active = true
        and s.is_active = true
    )
  );

-- Explicit Grants
-- Catalog tables: read-only for client roles
grant select on table public.sports to anon, authenticated;
grant select on table public.competitions to anon, authenticated;
grant select on table public.competition_editions to anon, authenticated;
grant select on table public.competitors to anon, authenticated;
grant select on table public.edition_competitors to anon, authenticated;
grant select on table public.events to anon, authenticated;
grant select on table public.event_competitors to anon, authenticated;

-- Full grants for service_role and postgres
grant all on all tables in schema public to service_role, postgres;
