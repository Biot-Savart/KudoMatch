-- Phase 6: provider runtime state, budget reservation, circuit coordination,
-- quality-aware result path, and conflict-management contracts.
select plan(20);

select has_table('public', 'provider_runtime_state', 'Provider runtime state table exists');
select has_table('public', 'provider_conflict_audit', 'Provider conflict audit table exists');
select has_function('public', 'reserve_provider_request', ARRAY['text', 'timestamp with time zone'], 'Atomic provider reservation RPC exists');
select has_function('public', 'record_provider_failure', ARRAY['text', 'text', 'integer', 'integer', 'boolean', 'timestamp with time zone'], 'Provider failure RPC exists');
select has_function('public', 'apply_provider_quality_result_batch', ARRAY['text', 'text[]', 'timestamp with time zone'], 'Quality-aware result RPC exists');
select has_function('public', 'finalize_provider_fallback_batch', ARRAY['timestamp with time zone'], 'Fallback finalization RPC exists');
select has_function('public', 'resolve_provider_result_conflict', ARRAY['bigint', 'text', 'text', 'text', 'boolean'], 'Conflict resolution RPC exists');
select ok(exists (select 1 from public.data_providers where slug = 'espn' and is_active), 'ESPN provider is registered');
select ok(exists (select 1 from public.provider_runtime_state where provider_slug = 'espn' and minute_request_limit > 0 and day_request_limit > 0), 'ESPN has finite request budgets');
select is((select count(*)::integer from public.competition_provider_settings where provider_slug = 'espn' and enabled = false and observe_only = true), 2, 'ESPN fallback is disabled until explicit activation');

select lives_ok($phase$
  do $body$
  declare v_first jsonb; v_second jsonb; v_now timestamptz := '2026-09-03T10:00:00Z';
  begin
    update public.provider_runtime_state set minute_request_count = 0, day_request_count = 0,
      minute_request_limit = 1, day_request_limit = 10, circuit_state = 'closed', health_status = 'healthy',
      consecutive_failures = 0, failure_window_started_at = null where provider_slug = 'espn';
    v_first := public.reserve_provider_request('espn', v_now);
    v_second := public.reserve_provider_request('espn', v_now);
    if v_first->>'allowed' <> 'true' or v_second->>'reason' <> 'minute_budget_exhausted' then
      raise exception 'budget reservation did not remain atomic';
    end if;
    update public.provider_runtime_state set minute_request_count = 0 where provider_slug = 'espn';
  end $body$;
$phase$, 'Concurrent-safe minute budget reservation has a hard limit');

select lives_ok($phase$
  do $body$
  declare v_result jsonb; v_now timestamptz := '2026-09-03T11:00:00Z';
  begin
    update public.provider_runtime_state set minute_request_count = 0, day_request_count = 0,
      minute_request_limit = 20, day_request_limit = 100, circuit_state = 'closed', health_status = 'healthy',
      consecutive_failures = 0, failure_window_started_at = null, half_open_probe_until = null where provider_slug = 'espn';
    for i in 1..5 loop
      v_result := public.record_provider_failure('espn', 'TIMEOUT', null, 100, true, v_now + (i - 1) * interval '1 minute');
    end loop;
    if (select circuit_state from public.provider_runtime_state where provider_slug = 'espn') <> 'open' then
      raise exception 'circuit did not open after five failures';
    end if;
    if (public.reserve_provider_request('espn', v_now + interval '1 minute')->>'reason') <> 'circuit_open' then
      raise exception 'open circuit allowed a request';
    end if;
    if (public.reserve_provider_request('espn', v_now + interval '35 minutes')->>'allowed') <> 'true' then
      raise exception 'cooldown did not allow a half-open probe';
    end if;
    update public.provider_runtime_state set circuit_state = 'closed', health_status = 'healthy', consecutive_failures = 0,
      failure_window_started_at = null, half_open_probe_until = null where provider_slug = 'espn';
  end $body$;
$phase$, 'Circuit opens, cools down, and admits one half-open probe');

select throws_ok($$ set role anon; select * from public.provider_runtime_state; $$, '42501', null, 'Anonymous clients cannot read provider runtime state');
select throws_ok($$ set role authenticated; select * from public.provider_conflict_audit; $$, '42501', null, 'Authenticated clients cannot read conflict audit');
select throws_ok($$ set role authenticated; select public.reserve_provider_request('espn', now()); $$, '42501', null, 'Authenticated clients cannot reserve provider requests');

select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'resolve_provider_result_conflict'), 1, 'Conflict resolver has one public entry point');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'provider_runtime_state' and c.relrowsecurity), 1, 'Runtime state has RLS enabled');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'provider_conflict_audit' and c.relrowsecurity), 1, 'Conflict audit has RLS enabled');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_provider_runtime_state_health'), 'Runtime health index exists');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_provider_conflict_audit_event'), 'Conflict event index exists');
select * from finish();
