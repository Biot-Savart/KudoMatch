-- Phase 5: resumable API-Sports historical backfill checkpoints.
-- Network requests are owned by the server-only worker. This table stores
-- only bounded progress and operational state; provider secrets never enter it.

create table if not exists public.provider_sync_targets (
  id bigint generated always as identity primary key,
  provider_slug text not null references public.data_providers(slug) on delete cascade,
  edition_id bigint not null references public.competition_editions(id) on delete cascade,
  operation text not null default 'historical_backfill'
    check (operation in ('historical_backfill')),
  enabled boolean not null default true,
  cursor jsonb not null default '{}'::jsonb
    check (jsonb_typeof(cursor) = 'object'),
  page integer not null default 1 check (page > 0),
  last_provider_event_key text,
  last_processed_at timestamptz,
  last_fetched_at timestamptz,
  next_run_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'paused', 'completed', 'failed')),
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_provider_sync_targets_key unique (provider_slug, edition_id, operation)
);

create index if not exists idx_provider_sync_targets_due
  on public.provider_sync_targets (enabled, status, next_run_at)
  where enabled = true and status in ('pending', 'running', 'failed');

create index if not exists idx_provider_sync_targets_provider_edition
  on public.provider_sync_targets (provider_slug, edition_id);

create trigger set_provider_sync_targets_updated_at
  before update on public.provider_sync_targets
  for each row execute function private.set_updated_at();

-- API-Sports is enabled for historical ingestion only. The generic
-- fixture_authority flag is used by the Phase 3 reconciliation RPC when a
-- historical worker supplies operation='historical_backfill'; it does not
-- promote API-Sports to current Currie Cup/URC authority.
insert into public.data_providers (slug, name, server_config_id, is_active)
values ('api-sports', 'API-Sports Rugby historical provider', 'api_sports_key', true)
on conflict (slug) do update set
  name = excluded.name,
  server_config_id = excluded.server_config_id,
  is_active = excluded.is_active;

insert into public.competition_provider_settings (
  competition_id,
  provider_slug,
  enabled,
  observe_only,
  history_priority,
  result_priority,
  fixture_authority,
  allow_single_source_result_finalization,
  config
)
select
  c.id,
  'api-sports',
  true,
  false,
  1,
  100,
  true,
  true,
  '{"history_authority": true, "historical_only": true, "competition_external_key": "11"}'::jsonb
from public.competitions c
where c.sport_slug = 'rugby-union'
  and c.slug = 'six-nations'
on conflict (competition_id, provider_slug) do update set
  enabled = excluded.enabled,
  observe_only = excluded.observe_only,
  history_priority = excluded.history_priority,
  result_priority = excluded.result_priority,
  fixture_authority = excluded.fixture_authority,
  allow_single_source_result_finalization = excluded.allow_single_source_result_finalization,
  config = excluded.config;

-- Advance a checkpoint only when the worker still owns the expected page.
-- This makes a lost lease safe: a stale worker cannot skip a page after a
-- replacement worker has progressed the target.
create or replace function private.advance_provider_sync_target(
  p_target_id bigint,
  p_expected_page integer,
  p_next_page integer,
  p_cursor jsonb,
  p_last_provider_event_key text,
  p_last_processed_at timestamptz,
  p_last_fetched_at timestamptz,
  p_next_run_at timestamptz,
  p_status text,
  p_error_summary text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_next_page is null or p_next_page < 1 then
    raise exception 'next page must be positive';
  end if;
  if p_status not in ('pending', 'running', 'paused', 'completed', 'failed') then
    raise exception 'invalid provider sync target status';
  end if;
  if p_cursor is null or jsonb_typeof(p_cursor) <> 'object' then
    raise exception 'cursor must be a JSON object';
  end if;

  update public.provider_sync_targets
  set cursor = p_cursor,
      page = p_next_page,
      last_provider_event_key = p_last_provider_event_key,
      last_processed_at = p_last_processed_at,
      last_fetched_at = p_last_fetched_at,
      next_run_at = coalesce(p_next_run_at, clock_timestamp()),
      status = p_status,
      error_summary = p_error_summary,
      updated_at = clock_timestamp()
  where id = p_target_id
    and page = p_expected_page;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.advance_provider_sync_target(
  p_target_id bigint,
  p_expected_page integer,
  p_next_page integer,
  p_cursor jsonb,
  p_last_provider_event_key text,
  p_last_processed_at timestamptz,
  p_last_fetched_at timestamptz,
  p_next_run_at timestamptz,
  p_status text,
  p_error_summary text default null
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.advance_provider_sync_target(
    p_target_id, p_expected_page, p_next_page, p_cursor,
    p_last_provider_event_key, p_last_processed_at, p_last_fetched_at,
    p_next_run_at, p_status, p_error_summary
  );
$$;

alter table public.provider_sync_targets enable row level security;
revoke all on table public.provider_sync_targets from public, anon, authenticated;
grant all on table public.provider_sync_targets to service_role, postgres;
revoke all on sequence public.provider_sync_targets_id_seq from public, anon, authenticated;
grant all on sequence public.provider_sync_targets_id_seq to service_role, postgres;
revoke execute on function private.advance_provider_sync_target(bigint, integer, integer, jsonb, text, timestamptz, timestamptz, timestamptz, text, text) from public, anon, authenticated;
revoke execute on function public.advance_provider_sync_target(bigint, integer, integer, jsonb, text, timestamptz, timestamptz, timestamptz, text, text) from public, anon, authenticated;
grant execute on function private.advance_provider_sync_target(bigint, integer, integer, jsonb, text, timestamptz, timestamptz, timestamptz, text, text) to service_role, postgres;
grant execute on function public.advance_provider_sync_target(bigint, integer, integer, jsonb, text, timestamptz, timestamptz, timestamptz, text, text) to service_role, postgres;

-- Historical result application is deliberately separate from the current
-- provider path. A mapped current-provider event is never rewritten by an
-- API-Sports history replay; standalone historical events can still receive a
-- final result through the existing settlement engine.
create or replace function private.apply_historical_provider_result_batch(
  p_provider_slug text,
  p_event_keys text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source record;
  v_market_id bigint;
  v_ruleset_id bigint;
  v_current_result record;
  v_result jsonb;
  v_result_status text;
  v_source_priority integer;
  v_provider_approved boolean;
  v_allow_single_source_finalization boolean;
  v_markets_upserted integer := 0;
  v_results_applied integer := 0;
  v_settled_results integer := 0;
  v_skipped_results integer := 0;
begin
  if nullif(trim(p_provider_slug), '') is null then
    raise exception 'provider slug is required';
  end if;

  select sr.id into v_ruleset_id
  from public.scoring_rulesets sr
  where sr.sport_slug = 'rugby-union'
    and sr.market_kind = 'team_scoreline'
    and sr.is_active = true
  order by sr.version desc, sr.id desc
  limit 1;
  if v_ruleset_id is null then
    raise exception 'active rugby-union team_scoreline ruleset is required';
  end if;

  for v_source in
    select pes.*, comp.competition_id,
           quality.preferred_provider_slug
    from public.provider_event_sources pes
    left join public.provider_catalog_sources comp
      on comp.provider_slug = pes.provider_slug
     and comp.entity_kind = 'competition'
     and comp.external_key = pes.provider_competition_key
     and comp.mapping_status = 'mapped'
    left join public.event_data_quality quality on quality.event_id = pes.event_id
    where pes.provider_slug = p_provider_slug
      and pes.event_id is not null
      and (p_event_keys is null or cardinality(p_event_keys) = 0 or pes.provider_event_key = any(p_event_keys))
    order by pes.id
  loop
    select cps.enabled and not cps.observe_only,
           cps.allow_single_source_result_finalization,
           coalesce(cps.result_priority, 100)
      into v_provider_approved, v_allow_single_source_finalization, v_source_priority
    from public.competition_provider_settings cps
    where cps.competition_id = v_source.competition_id
      and cps.provider_slug = p_provider_slug;

    if not found or not coalesce(v_provider_approved, false) then
      v_skipped_results := v_skipped_results + 1;
      continue;
    end if;

    -- The current provider owns overlapping events. Phase 6 will add explicit
    -- fallback/conflict transitions for cases where its result is missing.
    if v_source.preferred_provider_slug is not null
       and v_source.preferred_provider_slug <> p_provider_slug then
      v_skipped_results := v_skipped_results + 1;
      continue;
    end if;

    select em.id into v_market_id
    from public.event_markets em
    where em.event_id = v_source.event_id
      and em.market_kind = 'team_scoreline'
      and em.is_current = true;

    if v_market_id is null then
      insert into public.event_markets (
        event_id, market_kind, payload_schema_version, ruleset_id,
        sequence_no, is_current, opens_at, locks_at, status
      ) values (
        v_source.event_id, 'team_scoreline', 1, v_ruleset_id,
        1, true, v_source.normalized_kickoff_at - interval '14 days',
        v_source.normalized_kickoff_at,
        case when v_source.normalized_status in ('cancelled', 'abandoned') then 'void' else 'open' end
      ) returning id into v_market_id;
      v_markets_upserted := v_markets_upserted + 1;
    else
      v_markets_upserted := v_markets_upserted + 1;
    end if;

    select * into v_current_result
    from public.market_results mr
    where mr.event_market_id = v_market_id;

    if v_current_result is not null and v_current_result.source_priority < v_source_priority then
      v_skipped_results := v_skipped_results + 1;
      continue;
    end if;

    update public.events e
    set status = case
          when e.status = 'completed' and v_source.normalized_status in ('scheduled', 'live') then e.status
          when v_source.normalized_status = 'finished' then 'completed'
          else v_source.normalized_status
        end,
        starts_at = case when v_source.preferred_provider_slug is null or v_source.preferred_provider_slug = p_provider_slug
                         then coalesce(v_source.normalized_kickoff_at, e.starts_at) else e.starts_at end,
        round_label = case when v_source.preferred_provider_slug is null or v_source.preferred_provider_slug = p_provider_slug
                           then coalesce(v_source.round_name, e.round_label) else e.round_label end,
        venue_name = case when v_source.preferred_provider_slug is null or v_source.preferred_provider_slug = p_provider_slug
                          then coalesce(v_source.venue_name, e.venue_name) else e.venue_name end,
        updated_at = clock_timestamp()
    where e.id = v_source.event_id;

    if v_source.normalized_status in ('cancelled', 'abandoned') then
      if v_current_result is null or v_current_result.status <> 'void' then
        perform private.settle_market_result(
          v_market_id, null, 'void', 'provider',
          p_provider_slug || ':' || v_source.provider_event_key, v_source_priority
        );
        v_results_applied := v_results_applied + 1;
      end if;
    elsif v_source.home_score is not null and v_source.away_score is not null then
      if v_source.normalized_status = 'finished' then
        if not coalesce(v_allow_single_source_finalization, false) then
          v_skipped_results := v_skipped_results + 1;
          continue;
        end if;
        v_result_status := 'final';
      elsif v_source.normalized_status = 'live' then
        v_result_status := 'provisional';
      else
        continue;
      end if;

      v_result := jsonb_build_object(
        'kind', 'team_scoreline', 'version', 1,
        'home', v_source.home_score, 'away', v_source.away_score
      );

      if v_current_result is null
         or v_current_result.status <> v_result_status
         or (v_current_result.result->>'home') <> (v_result->>'home')
         or (v_current_result.result->>'away') <> (v_result->>'away')
         or coalesce(v_current_result.source_ref, '') <> p_provider_slug || ':' || v_source.provider_event_key then
        perform private.settle_market_result(
          v_market_id, v_result, v_result_status, 'provider',
          p_provider_slug || ':' || v_source.provider_event_key, v_source_priority
        );
        v_results_applied := v_results_applied + 1;
        if v_result_status = 'final' then v_settled_results := v_settled_results + 1; end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'provider_slug', p_provider_slug,
    'markets_upserted', v_markets_upserted,
    'results_applied', v_results_applied,
    'settled_results', v_settled_results,
    'skipped_results', v_skipped_results
  );
end;
$$;

create or replace function public.apply_historical_provider_result_batch(
  p_provider_slug text,
  p_event_keys text[] default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.apply_historical_provider_result_batch(p_provider_slug, p_event_keys);
$$;

revoke execute on function private.apply_historical_provider_result_batch(text, text[]) from public, anon, authenticated;
revoke execute on function public.apply_historical_provider_result_batch(text, text[]) from public, anon, authenticated;
grant execute on function private.apply_historical_provider_result_batch(text, text[]) to service_role, postgres;
grant execute on function public.apply_historical_provider_result_batch(text, text[]) to service_role, postgres;
