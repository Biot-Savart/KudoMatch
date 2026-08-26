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

create index idx_ingestion_runs_provider on public.ingestion_runs (provider_slug, started_at desc);
create index idx_ingestion_runs_sport_edition on public.ingestion_runs (sport_slug, edition_id);
create index idx_ingestion_runs_status on public.ingestion_runs (status);
create index idx_ingestion_runs_correlation on public.ingestion_runs (correlation_id) where correlation_id is not null;

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

create index idx_ingestion_run_leases_expiry on public.ingestion_run_leases (expires_at);

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
  v_existing_lease record;
begin
  if p_lease_key is null or trim(p_lease_key) = '' then
    raise exception 'lease_key cannot be null or empty';
  end if;

  if p_holder_id is null or trim(p_holder_id) = '' then
    raise exception 'holder_id cannot be null or empty';
  end if;

  v_new_expiry := v_now + (greatest(coalesce(p_ttl_seconds, 300), 5) || ' seconds')::interval;

  -- Lock and read existing lease
  select * into v_existing_lease
  from public.ingestion_run_leases
  where lease_key = p_lease_key
  for update;

  if v_existing_lease is not null then
    -- Check if lease is active and held by a different runner
    if v_existing_lease.expires_at > v_now and v_existing_lease.holder_id != p_holder_id then
      return false; -- Lock held by active runner
    end if;

    -- Lease is expired or held by same runner: take/renew lease
    update public.ingestion_run_leases
    set holder_id = p_holder_id,
        acquired_at = v_now,
        expires_at = v_new_expiry,
        updated_at = v_now
    where lease_key = p_lease_key;

    return true;
  else
    -- Insert new lease
    insert into public.ingestion_run_leases (lease_key, holder_id, acquired_at, expires_at)
    values (p_lease_key, p_holder_id, v_now, v_new_expiry);

    return true;
  end if;
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
-- 4. Transactional Batch RPC: private.apply_canonical_ingestion_batch
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
  v_competitors jsonb;
  v_events jsonb;
  v_comp_elem jsonb;
  v_event_elem jsonb;
  v_part_elem jsonb;
  v_market_elem jsonb;
  v_res_elem jsonb;
  
  v_competitor_id bigint;
  v_event_id bigint;
  v_market_id bigint;
  v_inserted_competitors integer := 0;
  v_updated_competitors integer := 0;
  v_inserted_events integer := 0;
  v_updated_events integer := 0;
  v_unchanged_events integer := 0;
  v_settled_results integer := 0;
  
  v_existing_event record;
  v_existing_ref record;
  v_target_edition_id bigint;
  v_new_home_score integer;
  v_new_away_score integer;
  v_curr_home_score integer;
  v_curr_away_score integer;
begin
  if p_batch is null then
    raise exception 'Batch payload cannot be null';
  end if;

  v_provider_slug := p_batch->>'provider_slug';
  v_sport_slug := p_batch->>'sport_slug';
  v_competitors := coalesce(p_batch->'competitors', '[]'::jsonb);
  v_events := coalesce(p_batch->'events', '[]'::jsonb);

  if v_provider_slug is null or v_sport_slug is null then
    raise exception 'provider_slug and sport_slug are required in batch payload';
  end if;

  -- 1. Upsert Competitors & External Entity Refs
  for v_comp_elem in select * from jsonb_array_elements(v_competitors)
  loop
    -- Check if external reference exists
    select target_id into v_competitor_id
    from public.external_entity_refs
    where provider_slug = v_provider_slug
      and entity_kind = 'competitor'
      and external_key = (v_comp_elem->>'external_key');

    if v_competitor_id is null then
      -- Insert competitor
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
        coalesce(v_comp_elem->>'kind', 'team'),
        v_comp_elem->>'name',
        v_comp_elem->>'short_name',
        v_comp_elem->>'media_url',
        v_comp_elem->>'country_code',
        coalesce((v_comp_elem->>'is_active')::boolean, true)
      )
      returning id into v_competitor_id;

      -- Insert external reference
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
        v_comp_elem->>'external_key',
        v_competitor_id,
        true
      )
      on conflict (provider_slug, entity_kind, external_key) do update
      set competitor_id = excluded.competitor_id;

      v_inserted_competitors := v_inserted_competitors + 1;
    else
      -- Update competitor details if provided
      update public.competitors
      set name = coalesce(v_comp_elem->>'name', name),
          short_name = coalesce(v_comp_elem->>'short_name', short_name),
          media_url = coalesce(v_comp_elem->>'media_url', media_url),
          country_code = coalesce(v_comp_elem->>'country_code', country_code),
          updated_at = clock_timestamp()
      where id = v_competitor_id;

      v_updated_competitors := v_updated_competitors + 1;
    end if;

    -- Link to edition if edition_id is passed
    if v_comp_elem ? 'edition_id' and (v_comp_elem->>'edition_id') is not null then
      v_target_edition_id := (v_comp_elem->>'edition_id')::bigint;
      insert into public.edition_competitors (edition_id, competitor_id)
      values (v_target_edition_id, v_competitor_id)
      on conflict (edition_id, competitor_id) do nothing;
    end if;
  end loop;

  -- 2. Upsert Events, Participants, Markets, and Results
  for v_event_elem in select * from jsonb_array_elements(v_events)
  loop
    v_event_id := null;
    v_target_edition_id := (v_event_elem->>'edition_id')::bigint;

    -- Resolve canonical event by external key
    select target_id into v_event_id
    from public.external_entity_refs
    where provider_slug = v_provider_slug
      and entity_kind = 'event'
      and external_key = (v_event_elem->>'external_key');

    if v_event_id is null then
      -- Insert event
      insert into public.events (
        edition_id,
        round_name,
        scheduled_start_time,
        status,
        venue,
        metadata
      )
      values (
        v_target_edition_id,
        v_event_elem->>'round_name',
        (v_event_elem->>'scheduled_start_time')::timestamptz,
        coalesce(v_event_elem->>'status', 'scheduled'),
        v_event_elem->>'venue',
        coalesce(v_event_elem->'metadata', '{}'::jsonb)
      )
      returning id into v_event_id;

      -- Insert external ref
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
      -- Read existing event to detect real mutations
      select * into v_existing_event
      from public.events
      where id = v_event_id;

      -- Check status transition validity: never regress finished/completed to live/scheduled from lower authority
      if v_existing_event.status = 'finished' and (v_event_elem->>'status') in ('scheduled', 'live') then
        -- Skip status regression
        null;
      else
        update public.events
        set scheduled_start_time = coalesce((v_event_elem->>'scheduled_start_time')::timestamptz, scheduled_start_time),
            status = coalesce(v_event_elem->>'status', status),
            round_name = coalesce(v_event_elem->>'round_name', round_name),
            venue = coalesce(v_event_elem->>'venue', venue),
            metadata = coalesce(v_event_elem->'metadata', metadata),
            updated_at = clock_timestamp()
        where id = v_event_id;

        if v_existing_event.status != coalesce(v_event_elem->>'status', v_existing_event.status) or
           v_existing_event.scheduled_start_time != coalesce((v_event_elem->>'scheduled_start_time')::timestamptz, v_existing_event.scheduled_start_time) then
          v_updated_events := v_updated_events + 1;
        else
          v_unchanged_events := v_unchanged_events + 1;
        end if;
      end if;
    end if;

    -- Upsert Event Participants / Competitors (Home / Away)
    if v_event_elem ? 'participants' then
      for v_part_elem in select * from jsonb_array_elements(v_event_elem->'participants')
      loop
        -- Resolve competitor id from external key if provided
        v_competitor_id := (v_part_elem->>'competitor_id')::bigint;
        if v_competitor_id is null and v_part_elem ? 'competitor_external_key' then
          select target_id into v_competitor_id
          from public.external_entity_refs
          where provider_slug = v_provider_slug
            and entity_kind = 'competitor'
            and external_key = (v_part_elem->>'competitor_external_key');
        end if;

        if v_competitor_id is not null then
          insert into public.event_competitors (
            event_id,
            competitor_id,
            role,
            slot_number
          )
          values (
            v_event_id,
            v_competitor_id,
            coalesce(v_part_elem->>'role', 'home'),
            coalesce((v_part_elem->>'slot_number')::integer, 1)
          )
          on conflict (event_id, competitor_id) do update
          set role = excluded.role,
              slot_number = excluded.slot_number;
        end if;
      end loop;
    end if;

    -- Upsert Market and Result if provided
    if v_event_elem ? 'market' then
      v_market_elem := v_event_elem->'market';
      
      insert into public.event_prediction_markets (
        event_id,
        ruleset_id,
        market_key,
        status,
        lock_at,
        market_schema_version
      )
      values (
        v_event_id,
        (v_market_elem->>'ruleset_id')::bigint,
        coalesce(v_market_elem->>'market_key', 'team_scoreline'),
        coalesce(v_market_elem->>'status', 'open'),
        coalesce((v_market_elem->>'lock_at')::timestamptz, (v_event_elem->>'scheduled_start_time')::timestamptz),
        coalesce((v_market_elem->>'market_schema_version')::integer, 1)
      )
      on conflict (event_id, market_key) do update
      set status = case
            when public.event_prediction_markets.status in ('settled', 'void') and excluded.status in ('open', 'locked') then public.event_prediction_markets.status
            else excluded.status
          end,
          lock_at = excluded.lock_at
      returning id into v_market_id;

      -- Handle Market Result if result payload is present
      if v_event_elem ? 'result' and v_market_id is not null then
        v_res_elem := v_event_elem->'result';
        
        insert into public.market_results (
          market_id,
          status,
          result_payload,
          verified_at,
          revision_number,
          payload_schema_version
        )
        values (
          v_market_id,
          coalesce(v_res_elem->>'status', 'final'),
          coalesce(v_res_elem->'result_payload', '{}'::jsonb),
          case when coalesce(v_res_elem->>'status', 'final') = 'final' then clock_timestamp() else null end,
          coalesce((v_res_elem->>'revision_number')::integer, 1),
          coalesce((v_res_elem->>'payload_schema_version')::integer, 1)
        )
        on conflict (market_id) do update
        set status = excluded.status,
            result_payload = excluded.result_payload,
            verified_at = excluded.verified_at,
            revision_number = public.market_results.revision_number + 1,
            payload_schema_version = excluded.payload_schema_version,
            updated_at = clock_timestamp();

        if (v_res_elem->>'status') = 'final' then
          v_settled_results := v_settled_results + 1;
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
-- 5. Row Level Security & Explicit Security Grants
-- ============================================================================

-- RLS
alter table public.ingestion_runs enable row level security;
alter table public.ingestion_run_leases enable row level security;

-- Revoke all public / client access
revoke all on table public.ingestion_runs from public, anon, authenticated;
revoke all on table public.ingestion_run_leases from public, anon, authenticated;

-- Revoke RPC execution from public, anon, authenticated
revoke execute on function private.acquire_ingestion_lease from public, anon, authenticated;
revoke execute on function private.release_ingestion_lease from public, anon, authenticated;
revoke execute on function private.apply_canonical_ingestion_batch from public, anon, authenticated;

-- Grant service_role and postgres full access to ingestion tables & RPCs
grant all on table public.ingestion_runs to service_role, postgres;
grant all on table public.ingestion_run_leases to service_role, postgres;

grant execute on function private.acquire_ingestion_lease to service_role, postgres;
grant execute on function private.release_ingestion_lease to service_role, postgres;
grant execute on function private.apply_canonical_ingestion_batch to service_role, postgres;
