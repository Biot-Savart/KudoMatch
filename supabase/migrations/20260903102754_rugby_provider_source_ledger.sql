-- Phase 3: Rugby multi-provider source ledger and reconciliation foundation.
-- Provider rows are deliberately separate from canonical catalog/event rows.

create table if not exists public.competition_provider_settings (
  competition_id bigint not null references public.competitions(id) on delete cascade,
  provider_slug text not null references public.data_providers(slug) on delete cascade,
  enabled boolean not null default false,
  observe_only boolean not null default true,
  fixture_priority integer check (fixture_priority is null or fixture_priority > 0),
  result_priority integer check (result_priority is null or result_priority > 0),
  history_priority integer check (history_priority is null or history_priority > 0),
  standings_priority integer check (standings_priority is null or standings_priority > 0),
  fixture_authority boolean not null default false,
  allow_single_source_result_finalization boolean not null default false,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (competition_id, provider_slug)
);

create index if not exists idx_competition_provider_settings_provider
  on public.competition_provider_settings (provider_slug, enabled);

create table if not exists public.provider_catalog_sources (
  id bigint generated always as identity primary key,
  provider_slug text not null references public.data_providers(slug) on delete cascade,
  sport_slug text not null references public.sports(slug) on delete restrict,
  entity_kind text not null check (entity_kind in ('competition', 'edition', 'competitor')),
  external_key text not null,
  competition_id bigint references public.competitions(id) on delete restrict,
  edition_id bigint references public.competition_editions(id) on delete restrict,
  competitor_id bigint references public.competitors(id) on delete restrict,
  mapping_status text not null default 'needs_mapping'
    check (mapping_status in ('needs_mapping', 'mapped', 'ignored')),
  display_name text not null,
  normalized_name text not null,
  short_name text,
  country_code text,
  media_url text,
  is_active boolean not null default true,
  latest_valid_raw_payload jsonb,
  payload_fingerprint text,
  provider_updated_at timestamptz,
  first_fetched_at timestamptz not null default now(),
  last_fetched_at timestamptz not null default now(),
  mapped_at timestamptz,
  mapped_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_provider_catalog_sources_key unique (provider_slug, entity_kind, external_key),
  constraint check_provider_catalog_source_target check (
    (mapping_status in ('needs_mapping', 'ignored') and competition_id is null and edition_id is null and competitor_id is null)
    or
    (mapping_status = 'mapped' and (
      (entity_kind = 'competition' and competition_id is not null and edition_id is null and competitor_id is null)
      or (entity_kind = 'edition' and competition_id is null and edition_id is not null and competitor_id is null)
      or (entity_kind = 'competitor' and competition_id is null and edition_id is null and competitor_id is not null)
    ))
  )
);

create index if not exists idx_provider_catalog_sources_mapping
  on public.provider_catalog_sources (provider_slug, entity_kind, mapping_status);
create index if not exists idx_provider_catalog_sources_competition
  on public.provider_catalog_sources (competition_id) where competition_id is not null;
create index if not exists idx_provider_catalog_sources_edition
  on public.provider_catalog_sources (edition_id) where edition_id is not null;
create index if not exists idx_provider_catalog_sources_competitor
  on public.provider_catalog_sources (competitor_id) where competitor_id is not null;

create table if not exists public.provider_event_sources (
  id bigint generated always as identity primary key,
  provider_slug text not null references public.data_providers(slug) on delete cascade,
  provider_event_key text not null,
  event_id bigint references public.events(id) on delete set null,
  provider_competition_key text,
  provider_edition_key text,
  provider_home_competitor_key text,
  provider_away_competitor_key text,
  normalized_kickoff_at timestamptz not null,
  normalized_status text not null check (normalized_status in ('scheduled', 'live', 'finished', 'postponed', 'cancelled', 'abandoned')),
  round_name text,
  venue_name text,
  home_score integer,
  away_score integer,
  latest_valid_raw_payload jsonb,
  payload_fingerprint text,
  provider_updated_at timestamptz,
  first_fetched_at timestamptz not null default now(),
  last_fetched_at timestamptz not null default now(),
  mapping_state text not null default 'unresolved'
    check (mapping_state in ('unresolved', 'mapped', 'ambiguous', 'ignored')),
  mapping_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_provider_event_sources_key unique (provider_slug, provider_event_key),
  constraint check_provider_event_source_scores check (
    (home_score is null and away_score is null)
    or (home_score is not null and away_score is not null and home_score >= 0 and away_score >= 0)
  )
);

create index if not exists idx_provider_event_sources_mapping
  on public.provider_event_sources (provider_slug, mapping_state, normalized_kickoff_at);
create index if not exists idx_provider_event_sources_event
  on public.provider_event_sources (event_id) where event_id is not null;
create index if not exists idx_provider_event_sources_edition_time
  on public.provider_event_sources (provider_edition_key, normalized_kickoff_at);

create table if not exists public.event_data_quality (
  event_id bigint primary key references public.events(id) on delete cascade,
  preferred_provider_slug text references public.data_providers(slug) on delete set null,
  quality_status text not null default 'unverified'
    check (quality_status in ('unverified', 'single_source', 'verified', 'conflicted')),
  source_count integer not null default 0 check (source_count >= 0),
  conflict_details jsonb not null default '{}'::jsonb check (jsonb_typeof(conflict_details) = 'object'),
  last_verified_at timestamptz,
  next_verification_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_data_quality_verification
  on public.event_data_quality (quality_status, next_verification_at);

create table if not exists public.provider_mapping_audit (
  id bigint generated always as identity primary key,
  provider_slug text not null references public.data_providers(slug) on delete restrict,
  entity_kind text not null check (entity_kind in ('competition', 'edition', 'competitor')),
  external_key text not null,
  provider_catalog_source_id bigint not null references public.provider_catalog_sources(id) on delete restrict,
  operation text not null check (operation in ('map', 'create-and-map', 'remap', 'ignore', 'restore')),
  previous_canonical_id bigint,
  new_canonical_id bigint,
  actor_identity text not null,
  correlation_id text,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_provider_mapping_audit_source
  on public.provider_mapping_audit (provider_catalog_source_id, created_at desc);
create index if not exists idx_provider_mapping_audit_identity
  on public.provider_mapping_audit (provider_slug, entity_kind, external_key, created_at desc);

alter table public.ingestion_quarantine add column if not exists raw_payload jsonb;
alter table public.ingestion_runs add column if not exists request_count integer not null default 0 check (request_count >= 0);
alter table public.ingestion_runs add column if not exists schema_error_count integer not null default 0 check (schema_error_count >= 0);
alter table public.ingestion_runs add column if not exists rate_limit_count integer not null default 0 check (rate_limit_count >= 0);
alter table public.ingestion_runs add column if not exists conflict_count integer not null default 0 check (conflict_count >= 0);
alter table public.ingestion_runs add column if not exists retries_count integer not null default 0 check (retries_count >= 0);

create trigger set_competition_provider_settings_updated_at
  before update on public.competition_provider_settings
  for each row execute function private.set_updated_at();
create trigger set_provider_catalog_sources_updated_at
  before update on public.provider_catalog_sources
  for each row execute function private.set_updated_at();
create trigger set_provider_event_sources_updated_at
  before update on public.provider_event_sources
  for each row execute function private.set_updated_at();
create trigger set_event_data_quality_updated_at
  before update on public.event_data_quality
  for each row execute function private.set_updated_at();

-- Source-ledger writes and reconciliation are service-role operations. The
-- function keeps the database transaction bounded and never performs network IO.
create or replace function private.apply_provider_source_batch(p_batch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider_slug text := nullif(trim(p_batch->>'provider_slug'), '');
  v_sport_slug text := nullif(trim(p_batch->>'sport_slug'), '');
  v_observe_only boolean := coalesce((p_batch->>'observe_only')::boolean, true);
  v_fetched_at timestamptz := coalesce(nullif(p_batch->>'fetched_at', '')::timestamptz, clock_timestamp());
  v_catalog jsonb;
  v_event jsonb;
  v_catalog_count integer := 0;
  v_event_count integer := 0;
  v_mapped_count integer := 0;
  v_ambiguous_count integer := 0;
  v_unresolved_count integer := 0;
  v_created_event_count integer := 0;
  v_source_id bigint;
  v_event_id bigint;
  v_edition_id bigint;
  v_competition_id bigint;
  v_home_competitor_id bigint;
  v_away_competitor_id bigint;
  v_candidate_count integer;
  v_candidate_id bigint;
  v_fixture_authority boolean;
  v_provider_approved boolean;
  v_mapping_reason text;
  v_source_count integer;
  v_normalized_status text;
begin
  if v_provider_slug is null or v_sport_slug is null then
    raise exception 'provider_slug and sport_slug are required';
  end if;
  if not exists (select 1 from public.data_providers where slug = v_provider_slug) then
    raise exception 'unknown provider: %', v_provider_slug;
  end if;
  if not exists (select 1 from public.sports where slug = v_sport_slug) then
    raise exception 'unknown sport: %', v_sport_slug;
  end if;

  for v_catalog in select value from jsonb_array_elements(coalesce(p_batch->'catalog_sources', '[]'::jsonb)) loop
    if (v_catalog->>'entity_kind') not in ('competition', 'edition', 'competitor') then
      raise exception 'invalid catalog entity kind';
    end if;
    insert into public.provider_catalog_sources (
      provider_slug, sport_slug, entity_kind, external_key, display_name,
      normalized_name, short_name, country_code, media_url, is_active,
      latest_valid_raw_payload, payload_fingerprint, provider_updated_at,
      first_fetched_at, last_fetched_at
    ) values (
      v_provider_slug, v_sport_slug, v_catalog->>'entity_kind', v_catalog->>'external_key',
      coalesce(nullif(v_catalog->>'display_name', ''), v_catalog->>'external_key'),
      coalesce(nullif(v_catalog->>'normalized_name', ''), lower(v_catalog->>'external_key')),
      nullif(v_catalog->>'short_name', ''), nullif(v_catalog->>'country_code', ''),
      nullif(v_catalog->>'media_url', ''), coalesce((v_catalog->>'is_active')::boolean, true),
      v_catalog->'raw_payload', nullif(v_catalog->>'payload_fingerprint', ''),
      nullif(v_catalog->>'provider_updated_at', '')::timestamptz, v_fetched_at, v_fetched_at
    ) on conflict (provider_slug, entity_kind, external_key) do update set
      sport_slug = excluded.sport_slug,
      display_name = excluded.display_name,
      normalized_name = excluded.normalized_name,
      short_name = coalesce(excluded.short_name, provider_catalog_sources.short_name),
      country_code = coalesce(excluded.country_code, provider_catalog_sources.country_code),
      media_url = coalesce(excluded.media_url, provider_catalog_sources.media_url),
      is_active = excluded.is_active,
      latest_valid_raw_payload = coalesce(excluded.latest_valid_raw_payload, provider_catalog_sources.latest_valid_raw_payload),
      payload_fingerprint = coalesce(excluded.payload_fingerprint, provider_catalog_sources.payload_fingerprint),
      provider_updated_at = coalesce(excluded.provider_updated_at, provider_catalog_sources.provider_updated_at),
      last_fetched_at = excluded.last_fetched_at;
    v_catalog_count := v_catalog_count + 1;
  end loop;

  for v_event in select value from jsonb_array_elements(coalesce(p_batch->'event_sources', '[]'::jsonb)) loop
    insert into public.provider_event_sources (
      provider_slug, provider_event_key, provider_competition_key, provider_edition_key,
      provider_home_competitor_key, provider_away_competitor_key, normalized_kickoff_at,
      normalized_status, round_name, venue_name, home_score, away_score,
      latest_valid_raw_payload, payload_fingerprint, provider_updated_at,
      first_fetched_at, last_fetched_at
    ) values (
      v_provider_slug, v_event->>'provider_event_key', nullif(v_event->>'provider_competition_key', ''),
      nullif(v_event->>'provider_edition_key', ''), nullif(v_event->>'provider_home_competitor_key', ''),
      nullif(v_event->>'provider_away_competitor_key', ''), (v_event->>'normalized_kickoff_at')::timestamptz,
      v_event->>'normalized_status', nullif(v_event->>'round_name', ''), nullif(v_event->>'venue_name', ''),
      (v_event->>'home_score')::integer, (v_event->>'away_score')::integer,
      v_event->'raw_payload', nullif(v_event->>'payload_fingerprint', ''),
      nullif(v_event->>'provider_updated_at', '')::timestamptz, v_fetched_at, v_fetched_at
    ) on conflict (provider_slug, provider_event_key) do update set
      provider_competition_key = coalesce(excluded.provider_competition_key, provider_event_sources.provider_competition_key),
      provider_edition_key = coalesce(excluded.provider_edition_key, provider_event_sources.provider_edition_key),
      provider_home_competitor_key = coalesce(excluded.provider_home_competitor_key, provider_event_sources.provider_home_competitor_key),
      provider_away_competitor_key = coalesce(excluded.provider_away_competitor_key, provider_event_sources.provider_away_competitor_key),
      normalized_kickoff_at = excluded.normalized_kickoff_at,
      normalized_status = excluded.normalized_status,
      round_name = coalesce(excluded.round_name, provider_event_sources.round_name),
      venue_name = coalesce(excluded.venue_name, provider_event_sources.venue_name),
      home_score = coalesce(excluded.home_score, provider_event_sources.home_score),
      away_score = coalesce(excluded.away_score, provider_event_sources.away_score),
      latest_valid_raw_payload = coalesce(excluded.latest_valid_raw_payload, provider_event_sources.latest_valid_raw_payload),
      payload_fingerprint = coalesce(excluded.payload_fingerprint, provider_event_sources.payload_fingerprint),
      provider_updated_at = coalesce(excluded.provider_updated_at, provider_event_sources.provider_updated_at),
      last_fetched_at = excluded.last_fetched_at,
      mapping_state = case when provider_event_sources.mapping_state = 'mapped' then 'mapped' else provider_event_sources.mapping_state end;
    v_event_count := v_event_count + 1;
  end loop;

  if v_observe_only then
    return jsonb_build_object(
      'success', true, 'observe_only', true, 'catalog_sources_upserted', v_catalog_count,
      'event_sources_upserted', v_event_count, 'mapped_event_sources', 0,
      'ambiguous_event_sources', 0, 'unresolved_event_sources', v_event_count,
      'created_events', 0
    );
  end if;

  for v_event in
    select to_jsonb(pes) from public.provider_event_sources pes
    where pes.provider_slug = v_provider_slug
      and pes.last_fetched_at >= v_fetched_at
      and pes.mapping_state in ('unresolved', 'ambiguous', 'mapped')
  loop
    v_event_id := null;
    v_edition_id := null;
    v_competition_id := null;
    v_home_competitor_id := null;
    v_away_competitor_id := null;
    v_candidate_count := 0;
    v_candidate_id := null;
    v_mapping_reason := null;
    v_fixture_authority := false;
    v_provider_approved := false;

    select event_id into v_event_id from public.external_entity_refs
    where provider_slug = v_provider_slug and entity_kind = 'event'
      and external_key = v_event->>'provider_event_key';

    if v_event_id is null then
      select pcs.edition_id into v_edition_id from public.provider_catalog_sources pcs
      where pcs.provider_slug = v_provider_slug and pcs.entity_kind = 'edition'
        and pcs.external_key = v_event->>'provider_edition_key' and pcs.mapping_status = 'mapped';
      select pcs.competition_id into v_competition_id from public.provider_catalog_sources pcs
      where pcs.provider_slug = v_provider_slug and pcs.entity_kind = 'competition'
        and pcs.external_key = v_event->>'provider_competition_key' and pcs.mapping_status = 'mapped';
      select pcs.competitor_id into v_home_competitor_id from public.provider_catalog_sources pcs
      where pcs.provider_slug = v_provider_slug and pcs.entity_kind = 'competitor'
        and pcs.external_key = v_event->>'provider_home_competitor_key' and pcs.mapping_status = 'mapped';
      select pcs.competitor_id into v_away_competitor_id from public.provider_catalog_sources pcs
      where pcs.provider_slug = v_provider_slug and pcs.entity_kind = 'competitor'
        and pcs.external_key = v_event->>'provider_away_competitor_key' and pcs.mapping_status = 'mapped';

      if v_edition_id is null or v_competition_id is null or v_home_competitor_id is null or v_away_competitor_id is null then
        v_mapping_reason := 'missing_approved_catalog_mapping';
      elsif not exists (
        select 1 from public.competition_editions ce
        where ce.id = v_edition_id and ce.competition_id = v_competition_id
      ) then
        v_mapping_reason := 'edition_competition_mismatch';
      else
        select cps.enabled and not cps.observe_only, cps.fixture_authority
          into v_provider_approved, v_fixture_authority
        from public.competition_provider_settings cps
        where cps.competition_id = v_competition_id and cps.provider_slug = v_provider_slug;
        if not found or not coalesce(v_provider_approved, false) then
          v_mapping_reason := 'provider_not_approved';
        else
        select count(*)::integer, min(e.id) into v_candidate_count, v_candidate_id
        from public.events e
        join public.event_competitors home_ec on home_ec.event_id = e.id and home_ec.competitor_id = v_home_competitor_id and home_ec.role = 'home'
        join public.event_competitors away_ec on away_ec.event_id = e.id and away_ec.competitor_id = v_away_competitor_id and away_ec.role = 'away'
        where e.edition_id = v_edition_id
          and e.starts_at between ((v_event->>'normalized_kickoff_at')::timestamptz - interval '12 hours')
                              and ((v_event->>'normalized_kickoff_at')::timestamptz + interval '12 hours');
        if v_candidate_count = 1 then
          v_event_id := v_candidate_id;
        elsif v_candidate_count > 1 then
          v_mapping_reason := 'multiple_reconciliation_candidates';
        else
          if coalesce(v_fixture_authority, false) then
            v_normalized_status := case v_event->>'normalized_status'
              when 'finished' then 'completed' else v_event->>'normalized_status' end;
            insert into public.events (edition_id, kind, starts_at, status, round_label, venue_name)
            values (v_edition_id, 'match', (v_event->>'normalized_kickoff_at')::timestamptz,
              v_normalized_status, nullif(v_event->>'round_name', ''), nullif(v_event->>'venue_name', ''))
            returning id into v_event_id;
            insert into public.event_competitors (event_id, competitor_id, slot, role)
            values (v_event_id, v_home_competitor_id, 1, 'home'), (v_event_id, v_away_competitor_id, 2, 'away');
            v_created_event_count := v_created_event_count + 1;
          else
            v_mapping_reason := 'no_reconciliation_candidate';
          end if;
        end if;
        end if;
      end if;
    end if;

    if v_event_id is not null then
      insert into public.external_entity_refs (provider_slug, entity_kind, external_key, event_id, is_primary)
      values (v_provider_slug, 'event', v_event->>'provider_event_key', v_event_id, true)
      on conflict (provider_slug, entity_kind, external_key) do update set event_id = excluded.event_id;
      update public.provider_event_sources set event_id = v_event_id, mapping_state = 'mapped', mapping_reason = null
      where provider_slug = v_provider_slug and provider_event_key = v_event->>'provider_event_key';
      select count(*)::integer into v_source_count from public.provider_event_sources where event_id = v_event_id;
      insert into public.event_data_quality (event_id, preferred_provider_slug, quality_status, source_count, last_verified_at)
      values (v_event_id, v_provider_slug, case when v_source_count > 1 then 'verified' else 'single_source' end, v_source_count, clock_timestamp())
      on conflict (event_id) do update set
        preferred_provider_slug = coalesce(event_data_quality.preferred_provider_slug, excluded.preferred_provider_slug),
        source_count = excluded.source_count,
      quality_status = case when event_data_quality.quality_status = 'conflicted' then 'conflicted' when excluded.source_count > 1 then 'verified' else 'single_source' end,
        last_verified_at = excluded.last_verified_at;
      v_mapped_count := v_mapped_count + 1;
    else
      if v_mapping_reason = 'multiple_reconciliation_candidates' then
        update public.provider_event_sources set mapping_state = 'ambiguous', mapping_reason = v_mapping_reason
        where provider_slug = v_provider_slug and provider_event_key = v_event->>'provider_event_key';
        v_ambiguous_count := v_ambiguous_count + 1;
      else
        update public.provider_event_sources set mapping_state = 'unresolved', mapping_reason = coalesce(v_mapping_reason, 'unresolved')
        where provider_slug = v_provider_slug and provider_event_key = v_event->>'provider_event_key';
        v_unresolved_count := v_unresolved_count + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true, 'observe_only', false, 'catalog_sources_upserted', v_catalog_count,
    'event_sources_upserted', v_event_count, 'mapped_event_sources', v_mapped_count,
    'ambiguous_event_sources', v_ambiguous_count, 'unresolved_event_sources', v_unresolved_count,
    'created_events', v_created_event_count
  );
end;
$$;

create or replace function public.apply_provider_source_batch(p_batch jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$ select private.apply_provider_source_batch(p_batch); $$;

create or replace function private.manage_provider_catalog_mapping(
  p_source_id bigint,
  p_operation text,
  p_canonical_id bigint default null,
  p_actor_identity text default 'unknown',
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.provider_catalog_sources%rowtype;
  v_previous_id bigint;
  v_new_id bigint := p_canonical_id;
  v_slug text;
begin
  if p_operation not in ('map', 'create-and-map', 'remap', 'ignore', 'restore') then
    raise exception 'invalid mapping operation';
  end if;
  if p_operation in ('remap', 'ignore') and nullif(trim(p_reason), '') is null then
    raise exception 'a non-empty reason is required for %', p_operation;
  end if;
  select * into v_source from public.provider_catalog_sources where id = p_source_id for update;
  if not found then raise exception 'provider catalog source % not found', p_source_id; end if;

  v_previous_id := case v_source.entity_kind
    when 'competition' then v_source.competition_id
    when 'edition' then v_source.edition_id
    else v_source.competitor_id end;

  if p_operation = 'ignore' then
    update public.provider_catalog_sources set mapping_status = 'ignored', competition_id = null, edition_id = null, competitor_id = null, mapped_at = null, mapped_by = p_actor_identity where id = p_source_id;
    v_new_id := null;
  else
    if p_operation = 'create-and-map' and v_new_id is null then
      v_slug := regexp_replace(lower(v_source.normalized_name), '[^a-z0-9]+', '-', 'g');
      v_slug := trim(both '-' from coalesce(nullif(v_slug, ''), v_source.external_key));
      if v_source.entity_kind = 'competition' then
        insert into public.competitions (sport_slug, slug, name, kind, country, logo_url)
        values (v_source.sport_slug, v_slug, v_source.display_name, 'league', v_source.country_code, v_source.media_url)
        on conflict (sport_slug, slug) do update set name = excluded.name
        returning id into v_new_id;
      elsif v_source.entity_kind = 'competitor' then
        insert into public.competitors (sport_slug, kind, name, short_name, media_url, country_code)
        values (v_source.sport_slug, 'team', v_source.display_name, v_source.short_name, v_source.media_url, v_source.country_code)
        returning id into v_new_id;
      else
        raise exception 'create-and-map for editions requires p_canonical_id';
      end if;
    end if;
    if v_new_id is null then raise exception 'canonical id is required for %', p_operation; end if;
    if v_source.entity_kind = 'competition' and not exists (select 1 from public.competitions where id = v_new_id and sport_slug = v_source.sport_slug) then raise exception 'invalid competition target'; end if;
    if v_source.entity_kind = 'edition' and not exists (select 1 from public.competition_editions where id = v_new_id) then raise exception 'invalid edition target'; end if;
    if v_source.entity_kind = 'competitor' and not exists (select 1 from public.competitors where id = v_new_id and sport_slug = v_source.sport_slug) then raise exception 'invalid competitor target'; end if;
    update public.provider_catalog_sources set mapping_status = 'mapped', competition_id = case when entity_kind = 'competition' then v_new_id else null end, edition_id = case when entity_kind = 'edition' then v_new_id else null end, competitor_id = case when entity_kind = 'competitor' then v_new_id else null end, mapped_at = clock_timestamp(), mapped_by = p_actor_identity where id = p_source_id;
  end if;

  insert into public.provider_mapping_audit (provider_slug, entity_kind, external_key, provider_catalog_source_id, operation, previous_canonical_id, new_canonical_id, actor_identity, reason)
  values (v_source.provider_slug, v_source.entity_kind, v_source.external_key, p_source_id, p_operation, v_previous_id, v_new_id, p_actor_identity, coalesce(nullif(trim(p_reason), ''), p_operation));
  return jsonb_build_object('source_id', p_source_id, 'operation', p_operation, 'previous_canonical_id', v_previous_id, 'new_canonical_id', v_new_id);
end;
$$;

create or replace function public.manage_provider_catalog_mapping(
  p_source_id bigint,
  p_operation text,
  p_canonical_id bigint default null,
  p_actor_identity text default 'unknown',
  p_reason text default ''
)
returns jsonb
language sql
security definer
set search_path = ''
as $$ select private.manage_provider_catalog_mapping(p_source_id, p_operation, p_canonical_id, p_actor_identity, p_reason); $$;

alter table public.competition_provider_settings enable row level security;
alter table public.provider_catalog_sources enable row level security;
alter table public.provider_event_sources enable row level security;
alter table public.event_data_quality enable row level security;
alter table public.provider_mapping_audit enable row level security;

revoke all on table public.competition_provider_settings, public.provider_catalog_sources, public.provider_event_sources, public.event_data_quality, public.provider_mapping_audit from public, anon, authenticated;
grant all on table public.competition_provider_settings, public.provider_catalog_sources, public.provider_event_sources, public.event_data_quality, public.provider_mapping_audit to service_role, postgres;
revoke execute on function private.apply_provider_source_batch(jsonb), private.manage_provider_catalog_mapping(bigint, text, bigint, text, text) from public, anon, authenticated;
revoke execute on function public.apply_provider_source_batch(jsonb), public.manage_provider_catalog_mapping(bigint, text, bigint, text, text) from public, anon, authenticated;
grant execute on function private.apply_provider_source_batch(jsonb), private.manage_provider_catalog_mapping(bigint, text, bigint, text, text) to service_role, postgres;
grant execute on function public.apply_provider_source_batch(jsonb), public.manage_provider_catalog_mapping(bigint, text, bigint, text, text) to service_role, postgres;
