-- Migration 9: Ingestion Operations, Distributed Leases, and Transactional Batch API
-- Phase 14: Provider Ingestion and Rugby Data

-- ============================================================================
-- 1. Ensure Supported Data Providers
-- ============================================================================
insert into public.data_providers (slug, name, server_config_id, is_active)
values
  ('api-sports', 'API-Sports Multi-Sport Provider', 'api_sports_key', true),
  ('football-data', 'Football-Data.org Provider', 'football_data_key', true),
  ('mock-provider', 'Mock Ingestion Provider (Testing & Non-Prod)', 'mock_provider', true)
on conflict (slug) do update set
  name = excluded.name,
  server_config_id = excluded.server_config_id,
  is_active = excluded.is_active;

-- ============================================================================
-- 2. Operational Tables: Ingestion Runs & Distributed Leases
-- ============================================================================

-- Ingestion Runs (History & Audit Log)
create table if not exists public.ingestion_runs (
  id bigint generated always as identity primary key,
  provider_slug text not null references public.data_providers(slug) on delete cascade,
  sport_slug text not null references public.sports(slug) on delete cascade,
  edition_id bigint references public.competition_editions(id) on delete set null,
  operation text not null default 'sync',
  status text not null check (status in ('running', 'success', 'partial_failure', 'failed')),
  fetched_count integer not null default 0 check (fetched_count >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  unchanged_count integer not null default 0 check (unchanged_count >= 0),
  quarantined_count integer not null default 0 check (quarantined_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  summary jsonb not null default '{}'::jsonb,
  correlation_id text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ingestion_runs_provider on public.ingestion_runs (provider_slug, started_at desc);
create index if not exists idx_ingestion_runs_sport_edition on public.ingestion_runs (sport_slug, edition_id);
create index if not exists idx_ingestion_runs_status on public.ingestion_runs (status);
create index if not exists idx_ingestion_runs_correlation on public.ingestion_runs (correlation_id) where correlation_id is not null;

create trigger set_ingestion_runs_updated_at
  before update on public.ingestion_runs
  for each row
  execute function private.set_updated_at();

-- Ingestion Run Leases (Distributed Mutex Locking)
create table if not exists public.ingestion_run_leases (
  lease_key text primary key,
  holder_id text not null,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ingestion_run_leases_expiry on public.ingestion_run_leases (expires_at);

create trigger set_ingestion_run_leases_updated_at
  before update on public.ingestion_run_leases
  for each row
  execute function private.set_updated_at();


-- ============================================================================
-- 3. Lease Helper Functions in private schema
-- ============================================================================

-- Acquire an atomic lease (using DB server time, automatic recovery of expired leases)
create or replace function private.acquire_ingestion_lease(
  p_lease_key text,
  p_holder_id text,
  p_ttl_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_new_expiry timestamptz;
  v_acquired boolean := false;
begin
  if p_lease_key is null or trim(p_lease_key) = '' then
    raise exception 'lease_key cannot be null or empty';
  end if;

  if p_holder_id is null or trim(p_holder_id) = '' then
    raise exception 'holder_id cannot be null or empty';
  end if;

  v_new_expiry := v_now + (greatest(coalesce(p_ttl_seconds, 300), 5) || ' seconds')::interval;

  -- Atomic insert on conflict: only take or renew if expired or held by same runner
  insert into public.ingestion_run_leases (lease_key, holder_id, acquired_at, expires_at, created_at, updated_at)
  values (p_lease_key, p_holder_id, v_now, v_new_expiry, v_now, v_now)
  on conflict (lease_key) do update
  set holder_id = excluded.holder_id,
      acquired_at = v_now,
      expires_at = v_new_expiry,
      updated_at = v_now
  where public.ingestion_run_leases.expires_at <= v_now
     or public.ingestion_run_leases.holder_id = p_holder_id;

  get diagnostics v_acquired = row_count;
  return v_acquired;
end;
$$;

-- Release lease
create or replace function private.release_ingestion_lease(
  p_lease_key text,
  p_holder_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count integer;
begin
  delete from public.ingestion_run_leases
  where lease_key = p_lease_key
    and holder_id = p_holder_id;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count > 0;
end;
$$;


-- ============================================================================
-- 4. Transactional Batch Execution in private schema
-- ============================================================================

create or replace function private.apply_canonical_ingestion_batch(
  p_batch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider_slug text;
  v_sport_slug text;
  v_competitions jsonb;
  v_editions jsonb;
  v_competitors jsonb;
  v_events jsonb;

  v_comp_elem jsonb;
  v_ed_elem jsonb;
  v_comp_entity_elem jsonb;
  v_event_elem jsonb;
  v_part_elem jsonb;
  v_market_elem jsonb;
  v_res_elem jsonb;
  v_res_payload jsonb;

  v_competition_id bigint;
  v_edition_id bigint;
  v_competitor_id bigint;
  v_event_id bigint;
  v_market_id bigint;
  v_ruleset_id bigint;

  v_inserted_competitors integer := 0;
  v_updated_competitors integer := 0;
  v_inserted_events integer := 0;
  v_updated_events integer := 0;
  v_unchanged_events integer := 0;
  v_settled_results integer := 0;

  v_existing_event record;
  v_target_edition_id bigint;

  v_raw_status text;
  v_event_status text;
  v_starts_at timestamptz;
  v_round_label text;
  v_venue_name text;

  v_market_locks_at timestamptz;
  v_market_opens_at timestamptz;

  v_result_status text;
  v_score_home text;
  v_score_away text;
  v_clean_result jsonb;
  v_source_ref text;
  v_curr_result record;
  v_should_settle boolean;
begin
  if p_batch is null then
    raise exception 'Batch payload cannot be null';
  end if;

  v_provider_slug := p_batch->>'provider_slug';
  v_sport_slug := p_batch->>'sport_slug';
  v_competitions := coalesce(p_batch->'competitions', '[]'::jsonb);
  v_editions := coalesce(p_batch->'editions', '[]'::jsonb);
  v_competitors := coalesce(p_batch->'competitors', '[]'::jsonb);
  v_events := coalesce(p_batch->'events', '[]'::jsonb);

  if v_provider_slug is null or v_sport_slug is null then
    raise exception 'provider_slug and sport_slug are required in batch payload';
  end if;

  -- 1. Ensure Competitions (if provided)
  for v_comp_elem in select * from jsonb_array_elements(v_competitions)
  loop
    v_competition_id := null;
    select competition_id into v_competition_id
    from public.external_entity_refs
    where provider_slug = v_provider_slug
      and entity_kind = 'competition'
      and external_key = (v_comp_elem->>'external_key');

    if v_competition_id is null then
      insert into public.competitions (
        sport_slug,
        slug,
        name,
        kind,
        country,
        logo_url,
        is_active
      )
      values (
        v_sport_slug,
        v_comp_elem->>'slug',
        v_comp_elem->>'name',
        coalesce(v_comp_elem->>'kind', 'league'),
        v_comp_elem->>'country',
        v_comp_elem->>'logo_url',
        coalesce((v_comp_elem->>'is_active')::boolean, true)
      )
      on conflict (sport_slug, slug) do update set
        name = excluded.name,
        country = coalesce(excluded.country, public.competitions.country),
        logo_url = coalesce(excluded.logo_url, public.competitions.logo_url),
        updated_at = clock_timestamp()
      returning id into v_competition_id;

      insert into public.external_entity_refs (
        provider_slug,
        entity_kind,
        external_key,
        competition_id,
        is_primary
      )
      values (
        v_provider_slug,
        'competition',
        v_comp_elem->>'external_key',
        v_competition_id,
        true
      )
      on conflict (provider_slug, entity_kind, external_key) do update
      set competition_id = excluded.competition_id;
    end if;
  end loop;

  -- 2. Ensure Editions (if provided)
  for v_ed_elem in select * from jsonb_array_elements(v_editions)
  loop
    v_edition_id := null;
    select edition_id into v_edition_id
    from public.external_entity_refs
    where provider_slug = v_provider_slug
      and entity_kind = 'edition'
      and external_key = (v_ed_elem->>'external_key');

    if v_edition_id is null then
      v_competition_id := (v_ed_elem->>'competition_id')::bigint;
      if v_competition_id is null and v_ed_elem ? 'competition_external_key' then
        select competition_id into v_competition_id
        from public.external_entity_refs
        where provider_slug = v_provider_slug
          and entity_kind = 'competition'
          and external_key = (v_ed_elem->>'competition_external_key');
      end if;

      if v_competition_id is not null then
        insert into public.competition_editions (
          competition_id,
          season_key,
          name,
          starts_at,
          ends_at,
          status,
          metadata
        )
        values (
          v_competition_id,
          v_ed_elem->>'season_key',
          v_ed_elem->>'name',
          coalesce((v_ed_elem->>'starts_at')::timestamptz, now()),
          coalesce((v_ed_elem->>'ends_at')::timestamptz, now() + interval '1 year'),
          coalesce(v_ed_elem->>'status', 'active'),
          coalesce(v_ed_elem->'metadata', '{}'::jsonb)
        )
        on conflict (competition_id, season_key) do update set
          name = excluded.name,
          status = excluded.status,
          updated_at = clock_timestamp()
        returning id into v_edition_id;

        insert into public.external_entity_refs (
          provider_slug,
          entity_kind,
          external_key,
          edition_id,
          is_primary
        )
        values (
          v_provider_slug,
          'edition',
          v_ed_elem->>'external_key',
          v_edition_id,
          true
        )
        on conflict (provider_slug, entity_kind, external_key) do update
        set edition_id = excluded.edition_id;
      end if;
    end if;
  end loop;

  -- 3. Upsert Competitors & External Entity Refs
  for v_comp_entity_elem in select * from jsonb_array_elements(v_competitors)
  loop
    v_competitor_id := null;
    select competitor_id into v_competitor_id
    from public.external_entity_refs
    where provider_slug = v_provider_slug
      and entity_kind = 'competitor'
      and external_key = (v_comp_entity_elem->>'external_key');

    if v_competitor_id is null then
      insert into public.competitors (
        sport_slug,
        kind,
        name,
        short_name,
        media_url,
        country_code,
        is_active
      )
      values (
        v_sport_slug,
        coalesce(v_comp_entity_elem->>'kind', 'team'),
        v_comp_entity_elem->>'name',
        v_comp_entity_elem->>'short_name',
        v_comp_entity_elem->>'media_url',
        v_comp_entity_elem->>'country_code',
        coalesce((v_comp_entity_elem->>'is_active')::boolean, true)
      )
      returning id into v_competitor_id;

      insert into public.external_entity_refs (
        provider_slug,
        entity_kind,
        external_key,
        competitor_id,
        is_primary
      )
      values (
        v_provider_slug,
        'competitor',
        v_comp_entity_elem->>'external_key',
        v_competitor_id,
        true
      )
      on conflict (provider_slug, entity_kind, external_key) do update
      set competitor_id = excluded.competitor_id;

      v_inserted_competitors := v_inserted_competitors + 1;
    else
      update public.competitors
      set name = coalesce(v_comp_entity_elem->>'name', name),
          short_name = coalesce(v_comp_entity_elem->>'short_name', short_name),
          media_url = coalesce(v_comp_entity_elem->>'media_url', media_url),
          country_code = coalesce(v_comp_entity_elem->>'country_code', country_code),
          updated_at = clock_timestamp()
      where id = v_competitor_id;

      v_updated_competitors := v_updated_competitors + 1;
    end if;

    -- Link to edition if edition_id is passed
    if v_comp_entity_elem ? 'edition_id' and (v_comp_entity_elem->>'edition_id') is not null then
      v_target_edition_id := (v_comp_entity_elem->>'edition_id')::bigint;
      insert into public.edition_competitors (edition_id, competitor_id)
      values (v_target_edition_id, v_competitor_id)
      on conflict (edition_id, competitor_id) do nothing;
    end if;
  end loop;

  -- 4. Upsert Events, Participants, Markets, and Settle Results
  for v_event_elem in select * from jsonb_array_elements(v_events)
  loop
    v_event_id := null;
    v_target_edition_id := (v_event_elem->>'edition_id')::bigint;

    if v_target_edition_id is null and v_event_elem ? 'edition_external_key' then
      select edition_id into v_target_edition_id
      from public.external_entity_refs
      where provider_slug = v_provider_slug
        and entity_kind = 'edition'
        and external_key = (v_event_elem->>'edition_external_key');
    end if;

    if v_target_edition_id is null then
      raise exception 'Cannot ingest event %: edition_id cannot be resolved', v_event_elem->>'external_key';
    end if;

    -- Resolve canonical event by external key
    select event_id into v_event_id
    from public.external_entity_refs
    where provider_slug = v_provider_slug
      and entity_kind = 'event'
      and external_key = (v_event_elem->>'external_key');

    -- Map canonical provider status to database events status
    v_raw_status := coalesce(v_event_elem->>'status', 'scheduled');
    case v_raw_status
      when 'finished' then v_event_status := 'completed';
      when 'in_progress' then v_event_status := 'live';
      when 'completed' then v_event_status := 'completed';
      when 'live' then v_event_status := 'live';
      when 'postponed' then v_event_status := 'postponed';
      when 'cancelled' then v_event_status := 'cancelled';
      when 'abandoned' then v_event_status := 'abandoned';
      else v_event_status := 'scheduled';
    end case;

    v_starts_at := coalesce(
      (v_event_elem->>'starts_at')::timestamptz,
      (v_event_elem->>'scheduled_start_time')::timestamptz
    );

    v_round_label := coalesce(v_event_elem->>'round_label', v_event_elem->>'round_name');
    v_venue_name := coalesce(v_event_elem->>'venue_name', v_event_elem->>'venue');

    if v_event_id is null then
      insert into public.events (
        edition_id,
        kind,
        starts_at,
        status,
        round_label,
        venue_name,
        metadata
      )
      values (
        v_target_edition_id,
        coalesce(v_event_elem->>'kind', 'match'),
        v_starts_at,
        v_event_status,
        v_round_label,
        v_venue_name,
        coalesce(v_event_elem->'metadata', '{}'::jsonb)
      )
      returning id into v_event_id;

      insert into public.external_entity_refs (
        provider_slug,
        entity_kind,
        external_key,
        event_id,
        is_primary
      )
      values (
        v_provider_slug,
        'event',
        v_event_elem->>'external_key',
        v_event_id,
        true
      )
      on conflict (provider_slug, entity_kind, external_key) do update
      set event_id = excluded.event_id;

      v_inserted_events := v_inserted_events + 1;
    else
      select * into v_existing_event
      from public.events
      where id = v_event_id;

      -- Check status transition validity: never regress completed to live/scheduled
      if v_existing_event.status = 'completed' and v_event_status in ('scheduled', 'live') then
        v_event_status := v_existing_event.status;
      end if;

      update public.events
      set starts_at = coalesce(v_starts_at, starts_at),
          status = v_event_status,
          round_label = coalesce(v_round_label, round_label),
          venue_name = coalesce(v_venue_name, venue_name),
          metadata = coalesce(v_event_elem->'metadata', metadata),
          updated_at = clock_timestamp()
      where id = v_event_id;

      if v_existing_event.status != v_event_status or v_existing_event.starts_at != coalesce(v_starts_at, v_existing_event.starts_at) then
        v_updated_events := v_updated_events + 1;
      else
        v_unchanged_events := v_unchanged_events + 1;
      end if;
    end if;

    -- Upsert Event Participants / Competitors
    if v_event_elem ? 'participants' then
      for v_part_elem in select * from jsonb_array_elements(v_event_elem->'participants')
      loop
        v_competitor_id := (v_part_elem->>'competitor_id')::bigint;
        if v_competitor_id is null and v_part_elem ? 'competitor_external_key' then
          select competitor_id into v_competitor_id
          from public.external_entity_refs
          where provider_slug = v_provider_slug
            and entity_kind = 'competitor'
            and external_key = (v_part_elem->>'competitor_external_key');
        end if;

        if v_competitor_id is null then
          raise exception 'Unresolved competitor participant key % for event % in provider %',
            coalesce(v_part_elem->>'competitor_external_key', v_part_elem->>'competitor_id', 'unknown'),
            v_event_elem->>'external_key',
            v_provider_slug
            using errcode = '23503';
        end if;

        -- Link competitor to the edition if not linked
        insert into public.edition_competitors (edition_id, competitor_id)
        values (v_target_edition_id, v_competitor_id)
        on conflict (edition_id, competitor_id) do nothing;

        insert into public.event_competitors (
          event_id,
          competitor_id,
          slot,
          role
        )
        values (
          v_event_id,
          v_competitor_id,
          coalesce((v_part_elem->>'slot')::smallint, (v_part_elem->>'slot_number')::smallint, 1::smallint),
          coalesce(v_part_elem->>'role', 'home')
        )
        on conflict (event_id, competitor_id) do update
        set slot = excluded.slot,
            role = excluded.role;
      end loop;
    end if;

    -- Upsert Market and Route Results through settlement engine
    if v_event_elem ? 'market' then
      v_market_elem := v_event_elem->'market';
      v_ruleset_id := (v_market_elem->>'ruleset_id')::bigint;

      v_market_locks_at := coalesce(
        (v_market_elem->>'locks_at')::timestamptz,
        (v_market_elem->>'lock_at')::timestamptz,
        v_starts_at
      );

      if v_market_locks_at > v_starts_at then
        v_market_locks_at := v_starts_at;
      end if;

      v_market_opens_at := coalesce((v_market_elem->>'opens_at')::timestamptz, v_market_locks_at - interval '14 days');
      if v_market_opens_at >= v_market_locks_at then
        v_market_opens_at := v_market_locks_at - interval '1 hour';
      end if;

      select id into v_market_id
      from public.event_markets
      where event_id = v_event_id
        and market_kind = coalesce(v_market_elem->>'market_kind', v_market_elem->>'market_key', 'team_scoreline')
        and is_current = true;

      if v_market_id is null then
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
        values (
          v_event_id,
          coalesce(v_market_elem->>'market_kind', v_market_elem->>'market_key', 'team_scoreline'),
          coalesce((v_market_elem->>'market_schema_version')::integer, (v_market_elem->>'payload_schema_version')::integer, 1),
          v_ruleset_id,
          1,
          true,
          v_market_opens_at,
          v_market_locks_at,
          coalesce(v_market_elem->>'status', 'open')
        )
        returning id into v_market_id;
      else
        update public.event_markets
        set locks_at = v_market_locks_at,
            status = case
              when public.event_markets.status in ('settled', 'void') then public.event_markets.status
              else coalesce(v_market_elem->>'status', public.event_markets.status)
            end,
            updated_at = clock_timestamp()
        where id = v_market_id;
      end if;

      v_source_ref := v_provider_slug || ':' || (v_event_elem->>'external_key');

      -- If event is cancelled or abandoned, void market and predictions via settlement engine
      if v_event_status in ('cancelled', 'abandoned') or (v_market_elem->>'status') = 'void' then
        select * into v_curr_result
        from public.market_results
        where event_market_id = v_market_id;

        if v_curr_result is null or v_curr_result.status <> 'void' then
          perform private.settle_market_result(
            v_market_id,
            null,
            'void',
            'provider',
            v_source_ref,
            100
          );
        end if;
      -- Handle Result settlement via private.settle_market_result with idempotency check
      elsif v_event_elem ? 'result' and v_market_id is not null then
        v_res_elem := v_event_elem->'result';
        v_result_status := coalesce(v_res_elem->>'status', 'provisional');

        if v_res_elem ? 'result_payload' then
          v_res_payload := v_res_elem->'result_payload';
          v_score_home := coalesce(v_res_payload->>'homeScore', v_res_payload->>'home');
          v_score_away := coalesce(v_res_payload->>'awayScore', v_res_payload->>'away');
        else
          v_score_home := coalesce(v_res_elem->>'home', v_res_elem->>'homeScore');
          v_score_away := coalesce(v_res_elem->>'away', v_res_elem->>'awayScore');
        end if;

        if v_score_home is not null and v_score_away is not null then
          v_clean_result := jsonb_build_object(
            'away', v_score_away::text,
            'home', v_score_home::text,
            'kind', 'team_scoreline',
            'version', 1
          );

          -- Idempotency check: compare with existing result snapshot
          select * into v_curr_result
          from public.market_results
          where event_market_id = v_market_id;

          v_should_settle := true;
          if v_curr_result is not null then
            if v_curr_result.status = v_result_status
               and (v_curr_result.result->>'home') = (v_clean_result->>'home')
               and (v_curr_result.result->>'away') = (v_clean_result->>'away')
               and coalesce(v_curr_result.source_ref, '') = v_source_ref then
              v_should_settle := false;
            end if;
          end if;

          if v_should_settle then
            perform private.settle_market_result(
              v_market_id,
              v_clean_result,
              v_result_status,
              'provider',
              v_source_ref,
              100
            );

            if v_result_status = 'final' then
              v_settled_results := v_settled_results + 1;
            end if;
          end if;
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'provider_slug', v_provider_slug,
    'sport_slug', v_sport_slug,
    'inserted_competitors', v_inserted_competitors,
    'updated_competitors', v_updated_competitors,
    'inserted_events', v_inserted_events,
    'updated_events', v_updated_events,
    'unchanged_events', v_unchanged_events,
    'settled_results', v_settled_results
  );
end;
$$;


-- ============================================================================
-- 5. Public Schema RPC Wrappers (Exposed to REST for service_role)
-- ============================================================================

create or replace function public.acquire_ingestion_lease(
  p_lease_key text,
  p_holder_id text,
  p_ttl_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Access denied: service_role required' using errcode = '42501';
  end if;
  return private.acquire_ingestion_lease(p_lease_key, p_holder_id, p_ttl_seconds);
end;
$$;

create or replace function public.release_ingestion_lease(
  p_lease_key text,
  p_holder_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Access denied: service_role required' using errcode = '42501';
  end if;
  return private.release_ingestion_lease(p_lease_key, p_holder_id);
end;
$$;

create or replace function public.apply_canonical_ingestion_batch(
  p_batch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Access denied: service_role required' using errcode = '42501';
  end if;
  return private.apply_canonical_ingestion_batch(p_batch);
end;
$$;


-- ============================================================================
-- 6. Row Level Security & Explicit Security Grants
-- ============================================================================

-- RLS
alter table public.ingestion_runs enable row level security;
alter table public.ingestion_run_leases enable row level security;

-- Revoke all public / client access on tables
revoke all on table public.ingestion_runs from public, anon, authenticated;
revoke all on table public.ingestion_run_leases from public, anon, authenticated;

-- Revoke function execution from public, anon, authenticated
revoke execute on function private.acquire_ingestion_lease from public, anon, authenticated;
revoke execute on function private.release_ingestion_lease from public, anon, authenticated;
revoke execute on function private.apply_canonical_ingestion_batch from public, anon, authenticated;

revoke execute on function public.acquire_ingestion_lease(text, text, integer) from public, anon, authenticated;
revoke execute on function public.release_ingestion_lease(text, text) from public, anon, authenticated;
revoke execute on function public.apply_canonical_ingestion_batch(jsonb) from public, anon, authenticated;

-- Grant service_role and postgres full access to ingestion tables & RPCs
grant all on table public.ingestion_runs to service_role, postgres;
grant all on table public.ingestion_run_leases to service_role, postgres;

grant execute on function private.acquire_ingestion_lease to service_role, postgres;
grant execute on function private.release_ingestion_lease to service_role, postgres;
grant execute on function private.apply_canonical_ingestion_batch to service_role, postgres;

grant execute on function public.acquire_ingestion_lease(text, text, integer) to service_role, postgres;
grant execute on function public.release_ingestion_lease(text, text) to service_role, postgres;
grant execute on function public.apply_canonical_ingestion_batch(jsonb) to service_role, postgres;
