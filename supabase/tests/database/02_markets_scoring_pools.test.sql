-- pgTAP Database & Security Tests for Phase 12: Prediction Markets, Scoring Engine, and Pools
begin;
select plan(44);

-- 1. Table and Schema Existence
select has_table('public', 'scoring_rulesets', 'Public scoring_rulesets table exists');
select has_table('public', 'scoring_rule_tiers', 'Public scoring_rule_tiers table exists');
select has_table('public', 'event_markets', 'Public event_markets table exists');
select has_table('public', 'predictions', 'Public predictions table exists');
select has_table('public', 'market_results', 'Public market_results table exists');
select has_table('public', 'pools', 'Public pools table exists');
select has_table('public', 'pool_members', 'Public pool_members table exists');
select has_table('public', 'pool_messages', 'Public pool_messages table exists');
select has_table('private', 'market_result_history', 'Private market_result_history table exists');
select has_table('private', 'settlement_runs', 'Private settlement_runs table exists');

-- 2. Constraints & Validation Checks
-- Ruleset max_raw_points must be > 0
select throws_ok(
  $$ insert into public.scoring_rulesets (sport_slug, market_kind, evaluator_key, version, max_raw_points)
     values ('football', 'team_scoreline', 'football_scoreline_v1', 99, 0) $$,
  '23514',
  NULL,
  'Rejects ruleset with max_raw_points <= 0'
);

-- Market opens_at must be before locks_at
select throws_ok(
  $$ insert into public.event_markets (event_id, market_kind, ruleset_id, sequence_no, opens_at, locks_at)
     values (
       (select id from public.events limit 1),
       'team_scoreline',
       (select id from public.scoring_rulesets limit 1),
       99,
       '2026-08-30 16:30:00Z',
       '2026-08-30 16:00:00Z'
     ) $$,
  '23514',
  NULL,
  'Rejects event market with opens_at >= locks_at'
);

-- Market locks_at must be on or before event starts_at
select throws_ok(
  $$ insert into public.event_markets (event_id, market_kind, ruleset_id, sequence_no, opens_at, locks_at)
     values (
       (select id from public.events limit 1),
       'team_scoreline',
       (select id from public.scoring_rulesets limit 1),
       98,
       '2026-08-30 12:00:00Z',
       '2026-09-01 00:00:00Z'
     ) $$,
  '23514',
  NULL,
  'Rejects event market with locks_at after event starts_at'
);

-- Cross-sport rejection for event market (football event with rugby ruleset)
select throws_ok(
  $$ insert into public.event_markets (event_id, market_kind, ruleset_id, sequence_no, opens_at, locks_at)
     values (
       (select e.id from public.events e join public.competition_editions ce on ce.id = e.edition_id join public.competitions c on c.id = ce.competition_id where c.sport_slug = 'football' limit 1),
       'team_scoreline',
       (select id from public.scoring_rulesets where sport_slug = 'rugby-union' limit 1),
       97,
       '2026-08-20 00:00:00Z',
       '2026-08-25 00:00:00Z'
     ) $$,
  '23514',
  NULL,
  'Rejects event market with mismatched ruleset sport'
);

-- Pool all_sports scope requires normalized scoring mode
select throws_ok(
  $$ insert into public.pools (name, created_by, invite_code, scope_kind, scoring_mode)
     values ('Invalid All Sports Raw', '11111111-1111-1111-1111-111111111111', 'BADRAW1', 'all_sports', 'raw') $$,
  '23514',
  NULL,
  'Rejects all_sports pool with raw scoring mode'
);

-- Pool sport scope requires sport_slug
select throws_ok(
  $$ insert into public.pools (name, created_by, invite_code, scope_kind, scoring_mode)
     values ('Missing Sport Slug', '11111111-1111-1111-1111-111111111111', 'BADSPORT1', 'sport', 'raw') $$,
  '23514',
  NULL,
  'Rejects sport pool missing sport_slug'
);

-- Pool competition scope cannot have sport_slug
select throws_ok(
  $$ insert into public.pools (name, created_by, invite_code, scope_kind, sport_slug, competition_id, scoring_mode)
     values ('Bad Competition Scope', '11111111-1111-1111-1111-111111111111', 'BADCOMP1', 'competition', 'football', (select id from public.competitions limit 1), 'raw') $$,
  '23514',
  NULL,
  'Rejects competition pool having extraneous sport_slug'
);

-- Prediction invalid JSON selection shape (missing keys)
select throws_ok(
  $$ insert into public.predictions (user_id, event_market_id, selection)
     values ('11111111-1111-1111-1111-111111111111', (select id from public.event_markets limit 1), '{"home": 2, "away": 1}'::jsonb) $$,
  '23514',
  NULL,
  'Rejects prediction with missing kind/version keys'
);

-- Prediction invalid score bounds (> 200)
select throws_ok(
  $$ insert into public.predictions (user_id, event_market_id, selection)
     values ('11111111-1111-1111-1111-111111111111', (select id from public.event_markets limit 1), '{"kind": "team_scoreline", "version": 1, "home": 999, "away": 0}'::jsonb) $$,
  '23514',
  NULL,
  'Rejects prediction with score > 200'
);

-- Pool member left_at before joined_at rejection
select throws_ok(
  $$ insert into public.pool_members (pool_id, user_id, joined_at, left_at)
     values (
       (select id from public.pools limit 1),
       '33333333-3333-3333-3333-333333333333',
       '2026-05-01 00:00:00Z',
       '2026-04-01 00:00:00Z'
     ) $$,
  '23514',
  NULL,
  'Rejects pool membership with left_at before joined_at'
);

-- 3. Evaluator Contract Function Tests
-- Football Evaluator: Exact Score
select is(
  private.evaluate_football_scoreline_v1(
    '{"kind": "team_scoreline", "version": 1, "home": 2, "away": 1}'::jsonb,
    '{"kind": "team_scoreline", "version": 1, "home": 2, "away": 1}'::jsonb
  ),
  'exact_score',
  'Football evaluator returns exact_score for 2-1 vs 2-1'
);

-- Football Evaluator: Exact Margin (home win)
select is(
  private.evaluate_football_scoreline_v1(
    '{"kind": "team_scoreline", "version": 1, "home": 3, "away": 1}'::jsonb,
    '{"kind": "team_scoreline", "version": 1, "home": 2, "away": 0}'::jsonb
  ),
  'exact_margin',
  'Football evaluator returns exact_margin for 3-1 vs 2-0 (+2 GD)'
);

-- Football Evaluator: Outcome Only
select is(
  private.evaluate_football_scoreline_v1(
    '{"kind": "team_scoreline", "version": 1, "home": 2, "away": 1}'::jsonb,
    '{"kind": "team_scoreline", "version": 1, "home": 4, "away": 0}'::jsonb
  ),
  'outcome',
  'Football evaluator returns outcome for 2-1 vs 4-0'
);

-- Football Evaluator: Miss
select is(
  private.evaluate_football_scoreline_v1(
    '{"kind": "team_scoreline", "version": 1, "home": 2, "away": 1}'::jsonb,
    '{"kind": "team_scoreline", "version": 1, "home": 0, "away": 1}'::jsonb
  ),
  'miss',
  'Football evaluator returns miss for home win predicted vs away win actual'
);

-- Rugby Evaluator: Exact Score
select is(
  private.evaluate_rugby_union_scoreline_v1(
    '{"kind": "team_scoreline", "version": 1, "home": 27, "away": 22}'::jsonb,
    '{"kind": "team_scoreline", "version": 1, "home": 27, "away": 22}'::jsonb
  ),
  'exact_score',
  'Rugby evaluator returns exact_score for 27-22 vs 27-22'
);

-- Rugby Evaluator: Exact Signed Margin
select is(
  private.evaluate_rugby_union_scoreline_v1(
    '{"kind": "team_scoreline", "version": 1, "home": 30, "away": 20}'::jsonb,
    '{"kind": "team_scoreline", "version": 1, "home": 25, "away": 15}'::jsonb
  ),
  'exact_margin',
  'Rugby evaluator returns exact_margin for 30-20 vs 25-15 (+10 margin)'
);

-- Rugby Evaluator: Close Margin (error <= 5)
select is(
  private.evaluate_rugby_union_scoreline_v1(
    '{"kind": "team_scoreline", "version": 1, "home": 30, "away": 20}'::jsonb,
    '{"kind": "team_scoreline", "version": 1, "home": 25, "away": 20}'::jsonb
  ),
  'close_margin',
  'Rugby evaluator returns close_margin for margin diff of 5 (10 vs 5)'
);

-- Rugby Evaluator: Outcome Only (error = 6)
select is(
  private.evaluate_rugby_union_scoreline_v1(
    '{"kind": "team_scoreline", "version": 1, "home": 30, "away": 20}'::jsonb,
    '{"kind": "team_scoreline", "version": 1, "home": 24, "away": 20}'::jsonb
  ),
  'outcome',
  'Rugby evaluator returns outcome for margin diff of 6 (10 vs 4)'
);

-- Rugby Evaluator: Miss
select is(
  private.evaluate_rugby_union_scoreline_v1(
    '{"kind": "team_scoreline", "version": 1, "home": 25, "away": 20}'::jsonb,
    '{"kind": "team_scoreline", "version": 1, "home": 15, "away": 22}'::jsonb
  ),
  'miss',
  'Rugby evaluator returns miss for home win predicted vs away win actual'
);

-- 4. Deterministic Seed Assertions
select is(
  (select count(*)::int from public.scoring_rulesets),
  2,
  'Deterministic seeds contain 2 scoring rulesets'
);

select is(
  (select count(*)::int from public.scoring_rule_tiers),
  9,
  'Deterministic seeds contain 9 scoring rule tiers (4 football + 5 rugby)'
);

select is(
  (select count(*)::int from public.pools),
  5,
  'Deterministic seeds contain 5 scoped pools'
);

select ok(
  (select count(*)::int from public.event_markets) >= 3,
  'Deterministic seeds contain at least 3 event markets'
);

-- 5. Settlement Engine Execution & Idempotence
do $$
declare
  v_market_id bigint;
  v_settle_res jsonb;
begin
  select id into v_market_id
  from public.event_markets
  where market_kind = 'team_scoreline'
  order by id
  limit 1;

  -- Perform settlement
  v_settle_res := private.settle_market_result(
    v_market_id,
    '{"kind": "team_scoreline", "version": 1, "home": 2, "away": 1}'::jsonb,
    'final',
    'provider',
    'api-football',
    100
  );
end;
$$;

select is(
  (select status from public.event_markets order by id limit 1),
  'settled',
  'Settled market status becomes settled'
);

select is(
  (select count(*)::int from public.predictions where settlement_status = 'settled'),
  3,
  'All 3 predictions on market are settled'
);

select is(
  (select tier_code from public.predictions where user_id = '11111111-1111-1111-1111-111111111111' and event_market_id = (select id from public.event_markets order by id limit 1)),
  'exact_score',
  'Alice (2-1 pred vs 2-1 actual) receives exact_score tier'
);

select is(
  (select raw_points from public.predictions where user_id = '11111111-1111-1111-1111-111111111111' and event_market_id = (select id from public.event_markets order by id limit 1)),
  3,
  'Alice receives 3 raw points'
);

select is(
  (select normalized_basis_points from public.predictions where user_id = '11111111-1111-1111-1111-111111111111' and event_market_id = (select id from public.event_markets order by id limit 1)),
  10000,
  'Alice receives 10000 normalized basis points'
);

select is(
  (select tier_code from public.predictions where user_id = '22222222-2222-2222-2222-222222222222' and event_market_id = (select id from public.event_markets order by id limit 1)),
  'outcome',
  'Bob (3-1 pred vs 2-1 actual) receives outcome tier'
);

select is(
  (select tier_code from public.predictions where user_id = '33333333-3333-3333-3333-333333333333' and event_market_id = (select id from public.event_markets order by id limit 1)),
  'miss',
  'Carol (1-1 pred vs 2-1 actual) receives miss tier'
);

select is(
  (select count(*)::int from private.market_result_history where event_market_id = (select id from public.event_markets order by id limit 1)),
  1,
  'Market result history contains 1 audit entry'
);

select is(
  (select count(*)::int from private.settlement_runs where event_market_id = (select id from public.event_markets order by id limit 1)),
  1,
  'Settlement runs contains 1 logged run'
);

-- 6. Pool Leaderboard RPC Assertion
select is(
  (select total_points from public.get_pool_leaderboard('a0000000-0000-0000-0000-000000000001') where user_id = '11111111-1111-1111-1111-111111111111'),
  10000::bigint,
  'Global pool leaderboard returns 10000 normalized points for Alice'
);

select is(
  (select rank from public.get_pool_leaderboard('a0000000-0000-0000-0000-000000000001') where user_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'Alice is rank 1 on global pool leaderboard'
);

select * from finish();
rollback;
