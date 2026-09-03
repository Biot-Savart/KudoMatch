-- Phase 6: provider health, atomic budgets, quality-aware results, and conflict audit.
-- All provider calls remain server-side. These tables and RPCs are service-role only.

create table if not exists public.provider_runtime_state (
  provider_slug text primary key references public.data_providers(slug) on delete cascade,
  health_status text not null default 'healthy'
    check (health_status in ('healthy', 'degraded', 'unavailable')),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  failure_window_started_at timestamptz,
  circuit_state text not null default 'closed'
    check (circuit_state in ('closed', 'open', 'half_open')),
  circuit_open_until timestamptz,
  half_open_probe_until timestamptz,
  open_count integer not null default 0 check (open_count >= 0),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_http_status integer check (last_http_status is null or last_http_status between 100 and 599),
  last_error_code text,
  last_latency_ms integer check (last_latency_ms is null or last_latency_ms >= 0),
  minute_window_started_at timestamptz not null default date_trunc('minute', now()),
  minute_request_count integer not null default 0 check (minute_request_count >= 0),
  minute_request_limit integer not null check (minute_request_limit > 0),
  day_window_started_at timestamptz not null default date_trunc('day', now()),
  day_request_count integer not null default 0 check (day_request_count >= 0),
  day_request_limit integer not null check (day_request_limit > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_conflict_audit (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.events(id) on delete restrict,
  event_market_id bigint references public.event_markets(id) on delete restrict,
  action text not null check (action in ('detected', 'resolved')),
  provider_slug text,
  selected_provider_slug text,
  current_result jsonb,
  selected_result jsonb,
  reason text not null,
  actor_identity text not null,
  applied boolean not null default false,
  created_at timestamptz not null default now(),
  constraint chk_provider_conflict_audit_payloads check (
    (action = 'detected' and selected_provider_slug is null and applied = false)
    or (action = 'resolved' and selected_provider_slug is not null)
  )
);

create index if not exists idx_provider_runtime_state_health
  on public.provider_runtime_state (health_status, circuit_state);
create index if not exists idx_provider_conflict_audit_event
  on public.provider_conflict_audit (event_id, created_at desc);
create index if not exists idx_provider_conflict_audit_open
  on public.provider_conflict_audit (action, created_at desc)
  where action = 'detected';

create trigger set_provider_runtime_state_updated_at
  before update on public.provider_runtime_state
  for each row execute function private.set_updated_at();

insert into public.data_providers (slug, name, server_config_id, is_active)
values ('espn', 'ESPN Rugby secondary provider', null, true)
on conflict (slug) do update set name = excluded.name, is_active = excluded.is_active;

-- ESPN is deliberately registered but disabled until its per-competition fallback
-- activation is reviewed. Phase 2 proved scoreboard fixture/result shapes only.
insert into public.competition_provider_settings (
  competition_id, provider_slug, enabled, observe_only,
  fixture_priority, result_priority, history_priority, standings_priority,
  fixture_authority, allow_single_source_result_finalization, config
)
select c.id, 'espn', false, true, 2, 2, null, null, false, false,
  jsonb_build_object('competition_external_key', case c.slug when 'currie-cup' then '270555' when 'united-rugby-championship' then '270557' end,
                     'coverage', 'scoreboard_fixture_result_only')
from public.competitions c
where c.slug in ('currie-cup', 'united-rugby-championship')
on conflict (competition_id, provider_slug) do update set
  config = excluded.config,
  fixture_priority = excluded.fixture_priority,
  result_priority = excluded.result_priority,
  standings_priority = excluded.standings_priority;

insert into public.provider_runtime_state (
  provider_slug, minute_request_limit, day_request_limit
)
select slug, 12, 120 from public.data_providers
on conflict (provider_slug) do nothing;

create or replace function private.reserve_provider_request(
  p_provider_slug text,
  p_now timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.provider_runtime_state%rowtype;
  v_now timestamptz := coalesce(p_now, clock_timestamp());
  v_minute_start timestamptz := date_trunc('minute', v_now);
  v_day_start timestamptz := date_trunc('day', v_now);
begin
  select * into v_state
  from public.provider_runtime_state
  where provider_slug = p_provider_slug
  for update;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'runtime_state_missing');
  end if;

  if v_state.minute_window_started_at < v_minute_start then
    v_state.minute_window_started_at := v_minute_start;
    v_state.minute_request_count := 0;
  end if;
  if v_state.day_window_started_at < v_day_start then
    v_state.day_window_started_at := v_day_start;
    v_state.day_request_count := 0;
  end if;

  if v_state.circuit_state = 'open' then
    if v_state.circuit_open_until is null or v_state.circuit_open_until > v_now then
      update public.provider_runtime_state set minute_window_started_at = v_state.minute_window_started_at,
        minute_request_count = v_state.minute_request_count, day_window_started_at = v_state.day_window_started_at,
        day_request_count = v_state.day_request_count, updated_at = v_now where provider_slug = p_provider_slug;
      return jsonb_build_object('allowed', false, 'reason', 'circuit_open', 'circuit_state', 'open',
        'health_status', v_state.health_status, 'circuit_open_until', v_state.circuit_open_until);
    end if;
    if v_state.half_open_probe_until is not null and v_state.half_open_probe_until > v_now then
      return jsonb_build_object('allowed', false, 'reason', 'half_open_probe_in_flight', 'circuit_state', 'half_open');
    end if;
    v_state.circuit_state := 'half_open';
    v_state.half_open_probe_until := v_now + interval '5 minutes';
  elsif v_state.circuit_state = 'half_open'
        and v_state.half_open_probe_until is not null
        and v_state.half_open_probe_until > v_now then
    return jsonb_build_object('allowed', false, 'reason', 'half_open_probe_in_flight', 'circuit_state', 'half_open');
  end if;

  if v_state.minute_request_count >= v_state.minute_request_limit then
    update public.provider_runtime_state set minute_window_started_at = v_state.minute_window_started_at,
      minute_request_count = v_state.minute_request_count, day_window_started_at = v_state.day_window_started_at,
      day_request_count = v_state.day_request_count, circuit_state = v_state.circuit_state,
      half_open_probe_until = v_state.half_open_probe_until, updated_at = v_now where provider_slug = p_provider_slug;
    return jsonb_build_object('allowed', false, 'reason', 'minute_budget_exhausted');
  end if;
  if v_state.day_request_count >= v_state.day_request_limit then
    update public.provider_runtime_state set minute_window_started_at = v_state.minute_window_started_at,
      minute_request_count = v_state.minute_request_count, day_window_started_at = v_state.day_window_started_at,
      day_request_count = v_state.day_request_count, circuit_state = v_state.circuit_state,
      half_open_probe_until = v_state.half_open_probe_until, updated_at = v_now where provider_slug = p_provider_slug;
    return jsonb_build_object('allowed', false, 'reason', 'day_budget_exhausted');
  end if;

  update public.provider_runtime_state
  set minute_window_started_at = v_state.minute_window_started_at,
      minute_request_count = v_state.minute_request_count + 1,
      day_window_started_at = v_state.day_window_started_at,
      day_request_count = v_state.day_request_count + 1,
      circuit_state = v_state.circuit_state,
      half_open_probe_until = v_state.half_open_probe_until,
      updated_at = v_now
  where provider_slug = p_provider_slug;
  return jsonb_build_object('allowed', true, 'reason', 'reserved', 'circuit_state', v_state.circuit_state,
    'health_status', v_state.health_status, 'minute_request_count', v_state.minute_request_count + 1,
    'day_request_count', v_state.day_request_count + 1);
end;
$$;

create or replace function public.reserve_provider_request(
  p_provider_slug text,
  p_now timestamptz default clock_timestamp()
)
returns jsonb language sql security definer set search_path = ''
as $$ select private.reserve_provider_request(p_provider_slug, p_now); $$;

create or replace function private.record_provider_success(
  p_provider_slug text,
  p_latency_ms integer default null,
  p_now timestamptz default clock_timestamp()
)
returns void language sql security definer set search_path = ''
as $$
  update public.provider_runtime_state
  set health_status = 'healthy', consecutive_failures = 0, failure_window_started_at = null,
      circuit_state = 'closed', circuit_open_until = null, half_open_probe_until = null,
      last_success_at = coalesce(p_now, clock_timestamp()), last_latency_ms = p_latency_ms,
      updated_at = coalesce(p_now, clock_timestamp())
  where provider_slug = p_provider_slug;
$$;

create or replace function public.record_provider_success(
  p_provider_slug text,
  p_latency_ms integer default null,
  p_now timestamptz default clock_timestamp()
)
returns void language sql security definer set search_path = ''
as $$ select private.record_provider_success(p_provider_slug, p_latency_ms, p_now); $$;

create or replace function private.record_provider_failure(
  p_provider_slug text,
  p_error_code text,
  p_http_status integer default null,
  p_latency_ms integer default null,
  p_qualifying_failure boolean default true,
  p_now timestamptz default clock_timestamp()
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_state public.provider_runtime_state%rowtype;
  v_now timestamptz := coalesce(p_now, clock_timestamp());
  v_failures integer;
  v_open boolean := false;
begin
  select * into v_state from public.provider_runtime_state where provider_slug = p_provider_slug for update;
  if not found then raise exception 'unknown provider runtime state: %', p_provider_slug; end if;
  if p_qualifying_failure then
    v_failures := case when v_state.failure_window_started_at is null or v_state.failure_window_started_at < v_now - interval '10 minutes' then 1 else v_state.consecutive_failures + 1 end;
    v_open := v_failures >= 5 or v_state.circuit_state = 'half_open';
  else
    v_failures := v_state.consecutive_failures;
  end if;
  update public.provider_runtime_state
  set health_status = case when v_open then 'unavailable' else 'degraded' end,
      consecutive_failures = v_failures,
      failure_window_started_at = case when p_qualifying_failure and v_failures = 1 then v_now else failure_window_started_at end,
      circuit_state = case when v_open then 'open' else circuit_state end,
      circuit_open_until = case when v_open then v_now + interval '30 minutes' else circuit_open_until end,
      half_open_probe_until = case when v_open then null else half_open_probe_until end,
      open_count = open_count + case when v_open then 1 else 0 end,
      last_failure_at = v_now, last_http_status = p_http_status, last_error_code = nullif(left(coalesce(p_error_code, 'PROVIDER_ERROR'), 120), ''),
      last_latency_ms = p_latency_ms, updated_at = v_now
  where provider_slug = p_provider_slug;
  return jsonb_build_object('provider_slug', p_provider_slug, 'health_status', case when v_open then 'unavailable' else 'degraded' end,
    'circuit_state', case when v_open then 'open' else v_state.circuit_state end, 'consecutive_failures', v_failures);
end;
$$;

create or replace function public.record_provider_failure(
  p_provider_slug text,
  p_error_code text,
  p_http_status integer default null,
  p_latency_ms integer default null,
  p_qualifying_failure boolean default true,
  p_now timestamptz default clock_timestamp()
)
returns jsonb language sql security definer set search_path = ''
as $$ select private.record_provider_failure(p_provider_slug, p_error_code, p_http_status, p_latency_ms, p_qualifying_failure, p_now); $$;

-- Result ingestion with provider agreement/conflict rules. This is deliberately
-- separate from the Phase 4 path so Phase 5 history semantics remain stable.
create or replace function private.apply_provider_quality_result_batch(
  p_provider_slug text,
  p_event_keys text[] default null,
  p_as_of timestamptz default clock_timestamp()
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_source record;
  v_current record;
  v_market_id bigint;
  v_result jsonb;
  v_result_status text;
  v_competition_id bigint;
  v_priority integer;
  v_preferred text;
  v_allow_single boolean;
  v_applied integer := 0;
  v_settled integer := 0;
  v_skipped integer := 0;
  v_conflicts integer := 0;
  v_source_count integer;
begin
  for v_source in
    select pes.*, comp.competition_id
    from public.provider_event_sources pes
    join public.provider_catalog_sources comp
      on comp.provider_slug = pes.provider_slug and comp.entity_kind = 'competition'
     and comp.external_key = pes.provider_competition_key and comp.mapping_status = 'mapped'
    where pes.provider_slug = p_provider_slug and pes.event_id is not null
      and (p_event_keys is null or cardinality(p_event_keys) = 0 or pes.provider_event_key = any(p_event_keys))
    order by pes.id
  loop
    v_competition_id := v_source.competition_id;
    select cps.result_priority, cps.allow_single_source_result_finalization
      into v_priority, v_allow_single
    from public.competition_provider_settings cps
    where cps.competition_id = v_competition_id and cps.provider_slug = p_provider_slug
      and cps.enabled = true and cps.observe_only = false;
    if not found then v_skipped := v_skipped + 1; continue; end if;

    select cps.provider_slug into v_preferred
    from public.competition_provider_settings cps
    where cps.competition_id = v_competition_id and cps.enabled = true and cps.observe_only = false
      and cps.result_priority is not null
    order by cps.result_priority, cps.provider_slug limit 1;
    v_priority := coalesce(v_priority, 100);

    select em.id into v_market_id from public.event_markets em
    where em.event_id = v_source.event_id and em.market_kind = 'team_scoreline' and em.is_current = true;
    if v_market_id is null then v_skipped := v_skipped + 1; continue; end if;
    select * into v_current from public.market_results mr where mr.event_market_id = v_market_id;

    if v_source.normalized_status in ('cancelled', 'abandoned') then
      if v_current is null then
        perform private.settle_market_result(v_market_id, null, 'void', 'provider', p_provider_slug || ':' || v_source.provider_event_key, v_priority);
        v_applied := v_applied + 1;
      end if;
      continue;
    end if;
    if v_source.home_score is null or v_source.away_score is null or v_source.normalized_status not in ('live', 'finished') then
      v_skipped := v_skipped + 1; continue;
    end if;
    v_result := jsonb_build_object('kind', 'team_scoreline', 'version', 1, 'home', v_source.home_score, 'away', v_source.away_score);

    if v_current is not null and v_current.result->>'home' is distinct from v_result->>'home'
       or v_current is not null and v_current.result->>'away' is distinct from v_result->>'away' then
      update public.event_data_quality
      set quality_status = 'conflicted', conflict_details = coalesce(conflict_details, '{}'::jsonb) || jsonb_build_object(
        'score_conflict', jsonb_build_object('provider_slug', p_provider_slug, 'incoming', v_result,
          'current', v_current.result, 'detected_at', coalesce(p_as_of, clock_timestamp())))
      where event_id = v_source.event_id;
      insert into public.provider_conflict_audit (event_id, event_market_id, action, provider_slug, current_result, selected_result, reason, actor_identity)
      values (v_source.event_id, v_market_id, 'detected', p_provider_slug, v_current.result, v_result, 'provider scores disagree', 'provider-runtime');
      v_conflicts := v_conflicts + 1;
      continue;
    end if;

    select count(*)::integer into v_source_count from public.provider_event_sources where event_id = v_source.event_id;
    if v_current is not null and v_current.status = 'final' then
      update public.event_data_quality set quality_status = case when v_source_count > 1 then 'verified' else quality_status end,
        source_count = v_source_count, last_verified_at = coalesce(p_as_of, clock_timestamp()) where event_id = v_source.event_id;
      v_skipped := v_skipped + 1; continue;
    end if;

    v_result_status := case when v_source.normalized_status = 'finished'
      and p_provider_slug = v_preferred and coalesce(v_allow_single, false) then 'final' else 'provisional' end;
    perform private.settle_market_result(v_market_id, v_result, v_result_status, 'provider', p_provider_slug || ':' || v_source.provider_event_key, v_priority);
    update public.event_data_quality
    set quality_status = case when v_source_count > 1 and v_result_status = 'final' then 'verified' else 'single_source' end,
      preferred_provider_slug = coalesce(preferred_provider_slug, p_provider_slug), source_count = v_source_count,
      last_verified_at = case when v_result_status = 'final' then coalesce(p_as_of, clock_timestamp()) else last_verified_at end
    where event_id = v_source.event_id;
    v_applied := v_applied + 1;
    if v_result_status = 'final' then v_settled := v_settled + 1; end if;
  end loop;
  return jsonb_build_object('success', true, 'provider_slug', p_provider_slug, 'results_applied', v_applied,
    'settled_results', v_settled, 'skipped_results', v_skipped, 'conflicts', v_conflicts);
end;
$$;

create or replace function public.apply_provider_quality_result_batch(
  p_provider_slug text, p_event_keys text[] default null, p_as_of timestamptz default clock_timestamp()
)
returns jsonb language sql security definer set search_path = ''
as $$ select private.apply_provider_quality_result_batch(p_provider_slug, p_event_keys, p_as_of); $$;

create or replace function public.finalize_provider_fallback_batch(
  p_as_of timestamptz default clock_timestamp()
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_row record; v_done integer := 0;
begin
  for v_row in
    select mr.event_market_id, mr.result, mr.source_ref, mr.source_priority, em.event_id,
           split_part(mr.source_ref, ':', 1) as provider_slug,
           split_part(mr.source_ref, ':', 2) as provider_event_key
    from public.market_results mr join public.event_markets em on em.id = mr.event_market_id
    join public.provider_event_sources pes on pes.event_id = em.event_id
      and mr.source_ref = pes.provider_slug || ':' || pes.provider_event_key
    join public.competition_provider_settings cps on cps.provider_slug = pes.provider_slug and cps.enabled and not cps.observe_only
    join public.provider_catalog_sources pcs on pcs.provider_slug = pes.provider_slug and pcs.entity_kind = 'competition'
      and pcs.external_key = pes.provider_competition_key and pcs.mapping_status = 'mapped' and pcs.competition_id = cps.competition_id
    where mr.status = 'provisional' and pes.normalized_status = 'finished'
      and cps.allow_single_source_result_finalization
      and mr.updated_at <= coalesce(p_as_of, clock_timestamp()) - interval '24 hours'
  loop
    perform private.settle_market_result(v_row.event_market_id, v_row.result, 'final', 'provider', v_row.source_ref, v_row.source_priority);
    update public.event_data_quality set quality_status = case when source_count > 1 then 'verified' else 'single_source' end,
      last_verified_at = coalesce(p_as_of, clock_timestamp()) where event_id = v_row.event_id;
    v_done := v_done + 1;
  end loop;
  return jsonb_build_object('success', true, 'finalized', v_done, 'as_of', coalesce(p_as_of, clock_timestamp()));
end;
$$;

create or replace function public.resolve_provider_result_conflict(
  p_event_id bigint,
  p_chosen_provider_slug text,
  p_reason text,
  p_actor_identity text default 'conflict-cli',
  p_apply boolean default false
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_source record; v_market_id bigint; v_result jsonb; v_source_count integer;
begin
  if not p_apply then raise exception 'conflict resolution requires p_apply = true'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'conflict resolution reason is required'; end if;
  select pes.* into v_source from public.provider_event_sources pes
  where pes.event_id = p_event_id and pes.provider_slug = p_chosen_provider_slug
    and pes.home_score is not null and pes.away_score is not null and pes.normalized_status = 'finished'
  order by pes.last_fetched_at desc, pes.id desc limit 1;
  if not found then raise exception 'chosen provider result not found for event %', p_event_id; end if;
  select em.id into v_market_id from public.event_markets em where em.event_id = p_event_id and em.market_kind = 'team_scoreline' and em.is_current;
  if v_market_id is null then raise exception 'current team_scoreline market not found for event %', p_event_id; end if;
  v_result := jsonb_build_object('kind', 'team_scoreline', 'version', 1, 'home', v_source.home_score, 'away', v_source.away_score);
  perform private.settle_market_result(v_market_id, v_result, 'final', 'manual', p_chosen_provider_slug || ':' || v_source.provider_event_key, 0);
  select count(*)::integer into v_source_count from public.provider_event_sources where event_id = p_event_id;
  update public.event_data_quality set quality_status = case when v_source_count > 1 then 'verified' else 'single_source' end,
    preferred_provider_slug = p_chosen_provider_slug, source_count = v_source_count,
    conflict_details = coalesce(conflict_details, '{}'::jsonb) || jsonb_build_object('resolution', jsonb_build_object('provider_slug', p_chosen_provider_slug, 'reason', p_reason, 'actor', p_actor_identity));
  insert into public.provider_conflict_audit (event_id, event_market_id, action, provider_slug, selected_provider_slug, current_result, selected_result, reason, actor_identity, applied)
  values (p_event_id, v_market_id, 'resolved', p_chosen_provider_slug, p_chosen_provider_slug, null, v_result, p_reason, p_actor_identity, true);
  return jsonb_build_object('success', true, 'event_id', p_event_id, 'chosen_provider_slug', p_chosen_provider_slug, 'result', v_result);
end;
$$;

alter table public.provider_runtime_state enable row level security;
alter table public.provider_conflict_audit enable row level security;
revoke all on table public.provider_runtime_state, public.provider_conflict_audit from public, anon, authenticated;
grant all on table public.provider_runtime_state, public.provider_conflict_audit to service_role, postgres;
revoke all on sequence public.provider_conflict_audit_id_seq from public, anon, authenticated;
grant all on sequence public.provider_conflict_audit_id_seq to service_role, postgres;
revoke execute on function private.reserve_provider_request(text, timestamptz), public.reserve_provider_request(text, timestamptz), private.record_provider_success(text, integer, timestamptz), public.record_provider_success(text, integer, timestamptz), private.record_provider_failure(text, text, integer, integer, boolean, timestamptz), public.record_provider_failure(text, text, integer, integer, boolean, timestamptz), private.apply_provider_quality_result_batch(text, text[], timestamptz), public.apply_provider_quality_result_batch(text, text[], timestamptz), public.finalize_provider_fallback_batch(timestamptz), public.resolve_provider_result_conflict(bigint, text, text, text, boolean) from public, anon, authenticated;
grant execute on function private.reserve_provider_request(text, timestamptz), public.reserve_provider_request(text, timestamptz), private.record_provider_success(text, integer, timestamptz), public.record_provider_success(text, integer, timestamptz), private.record_provider_failure(text, text, integer, integer, boolean, timestamptz), public.record_provider_failure(text, text, integer, integer, boolean, timestamptz), private.apply_provider_quality_result_batch(text, text[], timestamptz), public.apply_provider_quality_result_batch(text, text[], timestamptz), public.finalize_provider_fallback_batch(timestamptz), public.resolve_provider_result_conflict(bigint, text, text, text, boolean) to service_role, postgres;
