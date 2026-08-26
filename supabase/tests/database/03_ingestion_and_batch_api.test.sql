-- pgTAP Database & Security Tests for Phase 14: Ingestion Operations, Leases, and Batch API
begin;
select plan(28);

-- 1. Table and Schema Existence
select has_table('public', 'data_providers', 'Public data_providers table exists');
select has_table('public', 'ingestion_runs', 'Public ingestion_runs table exists');
select has_table('public', 'ingestion_run_leases', 'Public ingestion_run_leases table exists');
select has_table('public', 'ingestion_quarantine', 'Public ingestion_quarantine table exists');
select has_table('public', 'external_entity_refs', 'Public external_entity_refs table exists');

-- 2. Function Existence
select has_function('private', 'acquire_ingestion_lease', ARRAY['text', 'text', 'integer'], 'private.acquire_ingestion_lease exists');
select has_function('private', 'release_ingestion_lease', ARRAY['text', 'text'], 'private.release_ingestion_lease exists');
select has_function('private', 'apply_canonical_ingestion_batch', ARRAY['jsonb'], 'private.apply_canonical_ingestion_batch exists');

select has_function('public', 'acquire_ingestion_lease', ARRAY['text', 'text', 'integer'], 'public.acquire_ingestion_lease wrapper exists');
select has_function('public', 'release_ingestion_lease', ARRAY['text', 'text'], 'public.release_ingestion_lease wrapper exists');
select has_function('public', 'apply_canonical_ingestion_batch', ARRAY['jsonb'], 'public.apply_canonical_ingestion_batch wrapper exists');

-- 3. Ingestion Lease Mutual Exclusion
select is(
  private.acquire_ingestion_lease('test:lease:key:1', 'worker-A', 60),
  true,
  'worker-A successfully acquires new lease'
);

select is(
  private.acquire_ingestion_lease('test:lease:key:1', 'worker-B', 60),
  false,
  'worker-B is rejected because lease is held by worker-A'
);

select is(
  private.acquire_ingestion_lease('test:lease:key:1', 'worker-A', 120),
  true,
  'worker-A can renew/extend its own lease'
);

select is(
  private.release_ingestion_lease('test:lease:key:1', 'worker-B'),
  false,
  'worker-B cannot release worker-A lease'
);

select is(
  private.release_ingestion_lease('test:lease:key:1', 'worker-A'),
  true,
  'worker-A successfully releases lease'
);

select is(
  private.acquire_ingestion_lease('test:lease:key:1', 'worker-B', 60),
  true,
  'worker-B can now acquire released lease'
);

-- Clean up test lease
select private.release_ingestion_lease('test:lease:key:1', 'worker-B');

-- 4. Batch RPC Execution with Canonical Entities
select lives_ok(
  $$
  select private.apply_canonical_ingestion_batch(
    jsonb_build_object(
      'provider_slug', 'mock-provider',
      'sport_slug', 'rugby-union',
      'competitions', jsonb_build_array(
        jsonb_build_object(
          'external_key', 'mock-rugby-comp',
          'slug', 'test-six-nations',
          'name', 'Test Six Nations',
          'kind', 'cup'
        )
      ),
      'editions', jsonb_build_array(
        jsonb_build_object(
          'external_key', 'mock-rugby-ed-2025',
          'competition_external_key', 'mock-rugby-comp',
          'season_key', '2025-test',
          'name', 'Test Six Nations 2025'
        )
      ),
      'competitors', jsonb_build_array(
        jsonb_build_object(
          'external_key', 'mock-team-ireland',
          'name', 'Test Ireland',
          'short_name', 'IRE'
        ),
        jsonb_build_object(
          'external_key', 'mock-team-england',
          'name', 'Test England',
          'short_name', 'ENG'
        )
      ),
      'events', jsonb_build_array(
        jsonb_build_object(
          'external_key', 'mock-rugby-game-1',
          'edition_external_key', 'mock-rugby-ed-2025',
          'round_label', 'Round 1',
          'starts_at', (now() + interval '1 day')::text,
          'status', 'scheduled',
          'venue_name', 'Aviva Stadium',
          'participants', jsonb_build_array(
            jsonb_build_object('competitor_external_key', 'mock-team-ireland', 'role', 'home', 'slot', 1),
            jsonb_build_object('competitor_external_key', 'mock-team-england', 'role', 'away', 'slot', 2)
          ),
          'market', jsonb_build_object(
            'ruleset_id', (select id from public.scoring_rulesets where sport_slug = 'rugby-union' limit 1),
            'market_kind', 'team_scoreline',
            'status', 'open'
          )
        )
      )
    )
  );
  $$,
  'Batch RPC executes without error on fresh rugby ingestion'
);

-- Check competitor external ref exists
select is(
  (select count(*)::int from public.external_entity_refs where provider_slug = 'mock-provider' and entity_kind = 'competitor' and external_key = 'mock-team-ireland'),
  1,
  'Competitor external reference is recorded'
);

-- Check event exists and has round_label and venue_name
select is(
  (select round_label from public.events where id = (select event_id from public.external_entity_refs where provider_slug = 'mock-provider' and external_key = 'mock-rugby-game-1')),
  'Round 1',
  'Event round_label is correctly persisted'
);

-- Check event competitor slots
select is(
  (select count(*)::int from public.event_competitors where event_id = (select event_id from public.external_entity_refs where provider_slug = 'mock-provider' and external_key = 'mock-rugby-game-1') and slot in (1, 2)),
  2,
  'Event competitor slots 1 and 2 are correctly inserted'
);

-- 5. Idempotent Settlement Test (Finding 4)
-- Apply final score (27-22)
select private.apply_canonical_ingestion_batch(
  jsonb_build_object(
    'provider_slug', 'mock-provider',
    'sport_slug', 'rugby-union',
    'events', jsonb_build_array(
      jsonb_build_object(
        'external_key', 'mock-rugby-game-1',
        'edition_external_key', 'mock-rugby-ed-2025',
        'round_label', 'Round 1',
        'starts_at', (now() + interval '1 day')::text,
        'status', 'finished',
        'participants', jsonb_build_array(
          jsonb_build_object('competitor_external_key', 'mock-team-ireland', 'role', 'home', 'slot', 1),
          jsonb_build_object('competitor_external_key', 'mock-team-england', 'role', 'away', 'slot', 2)
        ),
        'market', jsonb_build_object(
          'ruleset_id', (select id from public.scoring_rulesets where sport_slug = 'rugby-union' limit 1),
          'market_kind', 'team_scoreline',
          'status', 'settled'
        ),
        'result', jsonb_build_object(
          'status', 'final',
          'result_payload', jsonb_build_object('homeScore', 27, 'awayScore', 22)
        )
      )
    )
  )
);

-- Ingest exact same final result a SECOND time
select private.apply_canonical_ingestion_batch(
  jsonb_build_object(
    'provider_slug', 'mock-provider',
    'sport_slug', 'rugby-union',
    'events', jsonb_build_array(
      jsonb_build_object(
        'external_key', 'mock-rugby-game-1',
        'edition_external_key', 'mock-rugby-ed-2025',
        'round_label', 'Round 1',
        'starts_at', (now() + interval '1 day')::text,
        'status', 'finished',
        'participants', jsonb_build_array(
          jsonb_build_object('competitor_external_key', 'mock-team-ireland', 'role', 'home', 'slot', 1),
          jsonb_build_object('competitor_external_key', 'mock-team-england', 'role', 'away', 'slot', 2)
        ),
        'market', jsonb_build_object(
          'ruleset_id', (select id from public.scoring_rulesets where sport_slug = 'rugby-union' limit 1),
          'market_kind', 'team_scoreline',
          'status', 'settled'
        ),
        'result', jsonb_build_object(
          'status', 'final',
          'result_payload', jsonb_build_object('homeScore', 27, 'awayScore', 22)
        )
      )
    )
  )
);

-- Assert revision is 1 and settlement runs count is exactly 1 (Idempotency)
select is(
  (select revision from public.market_results where event_market_id = (select em.id from public.event_markets em join public.events e on e.id = em.event_id join public.external_entity_refs r on r.event_id = e.id where r.external_key = 'mock-rugby-game-1')),
  1,
  'Idempotent ingestion preserves revision 1 without incrementing'
);

select is(
  (select count(*)::int from private.settlement_runs where event_market_id = (select em.id from public.event_markets em join public.events e on e.id = em.event_id join public.external_entity_refs r on r.event_id = e.id where r.external_key = 'mock-rugby-game-1')),
  1,
  'Idempotent ingestion creates exactly one settlement run'
);

-- 6. Cancelled Event Voiding Test (Finding 3)
-- Insert a scheduled game
select private.apply_canonical_ingestion_batch(
  jsonb_build_object(
    'provider_slug', 'mock-provider',
    'sport_slug', 'rugby-union',
    'events', jsonb_build_array(
      jsonb_build_object(
        'external_key', 'mock-rugby-game-cancelled',
        'edition_external_key', 'mock-rugby-ed-2025',
        'round_label', 'Round 2',
        'starts_at', (now() + interval '5 days')::text,
        'status', 'scheduled',
        'participants', jsonb_build_array(
          jsonb_build_object('competitor_external_key', 'mock-team-ireland', 'role', 'home', 'slot', 1),
          jsonb_build_object('competitor_external_key', 'mock-team-england', 'role', 'away', 'slot', 2)
        ),
        'market', jsonb_build_object(
          'ruleset_id', (select id from public.scoring_rulesets where sport_slug = 'rugby-union' limit 1),
          'market_kind', 'team_scoreline',
          'status', 'open'
        )
      )
    )
  )
);

-- Insert a prediction on this market
insert into public.predictions (
  user_id,
  event_market_id,
  selection,
  settlement_status
)
values (
  (select id from public.profiles limit 1),
  (select em.id from public.event_markets em join public.events e on e.id = em.event_id join public.external_entity_refs r on r.event_id = e.id where r.external_key = 'mock-rugby-game-cancelled'),
  '{"kind": "team_scoreline", "version": 1, "home": "20", "away": "15"}'::jsonb,
  'pending'
);

-- Ingest update marking game as cancelled
select private.apply_canonical_ingestion_batch(
  jsonb_build_object(
    'provider_slug', 'mock-provider',
    'sport_slug', 'rugby-union',
    'events', jsonb_build_array(
      jsonb_build_object(
        'external_key', 'mock-rugby-game-cancelled',
        'edition_external_key', 'mock-rugby-ed-2025',
        'round_label', 'Round 2',
        'starts_at', (now() + interval '5 days')::text,
        'status', 'cancelled',
        'participants', jsonb_build_array(
          jsonb_build_object('competitor_external_key', 'mock-team-ireland', 'role', 'home', 'slot', 1),
          jsonb_build_object('competitor_external_key', 'mock-team-england', 'role', 'away', 'slot', 2)
        ),
        'market', jsonb_build_object(
          'ruleset_id', (select id from public.scoring_rulesets where sport_slug = 'rugby-union' limit 1),
          'market_kind', 'team_scoreline',
          'status', 'void'
        )
      )
    )
  )
);

-- Assert prediction and market are voided
select is(
  (select settlement_status from public.predictions where event_market_id = (select em.id from public.event_markets em join public.events e on e.id = em.event_id join public.external_entity_refs r on r.event_id = e.id where r.external_key = 'mock-rugby-game-cancelled')),
  'void',
  'Prediction is voided when event is cancelled'
);

select is(
  (select status from public.event_markets where id = (select em.id from public.event_markets em join public.events e on e.id = em.event_id join public.external_entity_refs r on r.event_id = e.id where r.external_key = 'mock-rugby-game-cancelled')),
  'void',
  'Market status is set to void when event is cancelled'
);

-- 7. Security & Permission Tests
-- Anonymous users cannot call private lease functions
select throws_ok(
  $$ set role anon; select private.acquire_ingestion_lease('k', 'h', 60); $$,
  '42501',
  NULL,
  'anon role cannot call private.acquire_ingestion_lease'
);

-- Reset role
reset role;

-- Authenticated non-service-role cannot call public wrapper functions
select throws_ok(
  $$ set role authenticated; select public.acquire_ingestion_lease('k', 'h', 60); $$,
  '42501',
  NULL,
  'authenticated role cannot call public.acquire_ingestion_lease'
);

reset role;

select * from finish();
rollback;
