# Phase 14: Provider Ingestion and Rugby Data

- Status: planned.
- Depends on: [Phase 13: Application Event-Model Refactor](phase_13_application_event_model_refactor.md).
- Unlocks: [Phase 15: Rugby Experience and Release](phase_15_rugby_experience_and_release.md).

## Outcome

Build one provider-neutral, idempotent ingestion pipeline; migrate football ingestion to it; select and implement a Rugby Union provider; and reconcile real Premier League and Six Nations catalog/event/result data without fuzzy production matching or fabricated fallback scores.

## Scope

### Included

- Rugby provider ADR using real redacted responses.
- Canonical provider DTOs and adapter contract.
- Validation, status normalization, canonical resolution, quarantine, and batched upserts.
- Safe server-only credentials, retries, timeouts, concurrency limits, and summaries.
- Football adapter migration.
- Rugby Union adapter and Six Nations ingestion.
- Shared CLI/cron orchestration, dry run, recorded fixtures, and observability.

### Excluded

- Rugby-specific UI controls and visual launch: Phase 15.
- URC and other competition activation beyond optional recorded-fixture validation.
- Silent automatic failover between providers.

## Migration ownership

Generate `ingestion_operations_and_batch_api` with the CLI. It owns service-role-only ingestion runs/leases, any Phase 14 quarantine extensions, transactional batch RPCs, RLS, explicit grants, and supporting indexes. It must not expose provider operations to anon or authenticated clients.

## 1. Rugby provider ADR

Select the launch provider only after exercising real endpoints. Record:

- Six Nations, URC, Rugby Championship, Premiership, and Champions Cup coverage;
- current/upcoming season identifiers;
- stable competition, edition, competitor, and event identities;
- timezone and kickoff representation;
- scheduled/live/final/postponed/cancelled/abandoned status mapping;
- extra time and awarded-result semantics;
- quotas, burst limits, retry headers, expected latency, and pricing tier assumptions;
- licensing and logo/media usage rights;
- historical depth;
- webhook versus polling support.

Save redacted samples under:

```text
tests/fixtures/providers/<provider>/rugby-union/
```

Include at least competition, edition, teams, scheduled fixture, live fixture, final result, postponement, cancellation/abandonment, malformed response, rate-limit response, and empty-success response.

Select one launch provider and one documented manual fallback. Do not silently merge or switch providers.

## 2. Ingestion structure

```text
lib/sports/ingestion/
├── adapter.ts
├── dto.ts
├── validate.ts
├── normalize-status.ts
├── resolve-canonical.ts
├── upsert.ts
├── retry.ts
├── orchestrate.ts
└── adapters/
    ├── football-data.ts
    ├── rugby-<provider>.ts
    └── mock.ts
```

Adapters accept provider payloads as `unknown`, validate them, and return canonical DTOs. They never create Supabase clients or write database rows.

All orchestrator/database modules are explicitly server-only and are not re-exported from any client-safe barrel. Add a build/test guard that fails if provider SDKs, service-role helpers, or secret-reading modules enter a client dependency graph.

The orchestration layer owns:

- adapter selection;
- request windows and rate budgets;
- canonical resolution through the service-role-only `public.external_entity_refs` table;
- competition/edition/competitor/event/participant/market/result upserts;
- batching and transaction boundaries;
- dry-run diffing;
- quarantine and structured summaries;
- partial failure isolation.

Use one service-role-only, security-invoker batch RPC for each bounded canonical write batch so related catalog/event/reference/result changes commit atomically. Revoke execute from `PUBLIC`, `anon`, and `authenticated`; grant it only to `service_role`. Do not rely on a sequence of independent PostgREST writes to emulate a transaction.

## 3. Adapter contract

The interface exposes provider and sport identity plus operations equivalent to:

- discover competitions;
- fetch editions/seasons;
- fetch competitors for an edition;
- fetch events for edition/date range;
- fetch updates for active events;
- normalize provider status and result payload.

DTO requirements:

- external keys are `string` even if the provider returns numbers;
- timestamps are normalized to ISO UTC strings before persistence;
- nullable/missing fields remain distinguishable from zero;
- canonical event competitors include slot and role;
- result status distinguishes provisional, final, and void;
- canonical market/result DTOs carry payload-schema version separately from scoring-ruleset version;
- provider-specific fields remain in the adapter layer.

Use discriminated unions and `unknown`; do not introduce new `any` types.

## 4. Canonical resolution

Resolve entities in dependency order:

1. sport and provider;
2. competition;
3. edition;
4. competitors and edition membership;
5. event and event competitors;
6. event market and ruleset;
7. result/revision.

Rules:

- external references, not names, drive production identity;
- multiple provider references may map to one canonical entity;
- one `(provider, entity_kind, external_key)` cannot map to multiple entities;
- missing mapping creates a canonical entity only when adapter context is unambiguous;
- ambiguous or conflicting records enter quarantine and do not partially mutate dependents;
- name normalization is for display/deduplication review, never authoritative fuzzy matching;
- provider edition identity accounts for reused competition IDs across seasons.

## 5. Upsert and authority rules

- Replaying the same payload produces no duplicate rows and no unnecessary updates.
- Compare normalized values before writing to reduce Realtime noise and trigger work.
- Do not replace a known value with null/missing provider data.
- Do not regress a completed/final event to live or scheduled through a lower-authority response.
- Manual corrections outrank every provider. Primary/secondary provider precedence is explicit per edition, snapshotted into result history, and never inferred from request order.
- Final-score corrections create a new result revision and invoke Phase 12 settlement.
- Provisional scores never settle predictions.
- A provider postponement before lock may move event/lock timestamps through the validated reschedule path; after lock it cannot reopen the market. A true reopen voids the old market and creates a new sequence.
- Network calls happen before database transactions; transactions contain only short validation/upsert work.
- Independent editions/competitions are isolated so one failure does not roll back healthy work.

Create service-role-only `public.ingestion_runs` and `public.ingestion_run_leases` tables. Acquire an atomic lease keyed by provider, edition, and operation before a run; return a clean `already_running` result instead of overlapping. Leases have bounded expiry/recovery semantics so a crashed serverless invocation cannot block future runs indefinitely.

Enable RLS on both operational tables, revoke anon/authenticated privileges, and create no client policies. Lease acquisition/recovery must use database time rather than application-host clocks.

## 6. Retry, rate limiting, and failure behavior

- Set explicit request and overall operation timeouts.
- Use bounded exponential backoff with jitter for transient failures.
- Honor provider retry headers for 429 responses.
- Do not retry validation, authorization, or permanent 4xx failures blindly.
- Limit concurrency by provider and endpoint class.
- Return a partial-failure summary when independent work succeeds and some work fails.
- Failed/no-change provider responses leave canonical event/result state untouched.
- Never convert provider failure into random, mock, or guessed scores.

## 7. Secrets and environment safety

- Require `SUPABASE_SERVICE_ROLE_KEY` for ingestion writes; never fall back to anon/publishable keys.
- Remove `NEXT_PUBLIC_RAPIDAPI_KEY`, `NEXT_PUBLIC_FOOTBALL_DATA_API_KEY`, and any equivalent provider secret fallback.
- Avoid logging authorization headers, service keys, full environment objects, or unredacted provider payloads.
- `--dry-run` performs no writes.
- `--simulate` uses only the mock adapter and refuses to run when `NODE_ENV=production`.
- The cron endpoint accepts the secret only through the `Authorization` header, compares it safely, and rejects query-string secrets so credentials do not enter URLs or access logs.

## 8. Football adapter migration

Port existing football ingestion before adding rugby:

- replace direct table upserts with the shared orchestrator;
- replace global numeric IDs with external references;
- remove fuzzy club-name production matching;
- remove implicit simulation when the provider reports zero updates;
- preserve Premier League competition/edition/event/result coverage;
- add recorded fixtures for both current football providers if both remain supported;
- choose explicit provider precedence rather than first-success ambiguity.

Exit gate for football adapter: two identical recorded/live imports produce identical canonical state, no duplicate events, and no fabricated results.

## 9. Rugby Union adapter and Six Nations

Implement the selected provider adapter and import in this order:

1. Rugby Union sport/provider mapping.
2. Six Nations stable competition.
3. One target edition.
4. Six national teams and edition memberships.
5. Scheduled events and home/away event competitors.
6. `team_scoreline` markets referencing rugby ruleset v1.
7. Provisional/final results and correction handling.

Reconcile:

- expected team count;
- fixture count and unique external references;
- kickoff timezone conversion;
- home/away mapping;
- round labels;
- status distribution;
- final scores and result revisions;
- no quarantined record left unexplained.

URC may be validated with recorded data but is not activated until Phase 15 after Six Nations proves the pipeline.

## 10. CLI and cron consolidation

`scripts/fetch-live-scores.ts` and `app/api/cron/fetch-live-scores/route.ts` call the same orchestration service. Neither contains provider mapping or database-write logic.

Support explicit options:

- provider;
- sport;
- competition/edition;
- date window;
- dry run;
- recorded fixture mode;
- mock simulation mode limited to non-production.

Return/log one structured run summary:

- provider, sport, edition, duration;
- fetched, inserted, updated, unchanged, skipped, quarantined, failed;
- retries and rate-limit waits;
- settlement count and corrections;
- sanitized error codes/messages.

Persist the same summary in `ingestion_runs`, including lease key, invocation source, start/end time, status, and a correlation ID. Do not persist secrets or full raw payloads.

## 11. Tests

### Adapter contract

- Every recorded payload parses or fails with a stable validation error.
- Unknown statuses fail/quarantine instead of mapping to scheduled.
- Null and zero scores remain distinct.
- External numeric/string keys normalize consistently.

### Resolution and upsert

- Multiple provider references can resolve to one canonical entity.
- Conflicting references quarantine safely.
- Repeated imports are idempotent.
- Edition keys do not collide across seasons.
- Partial provider failure preserves independent successful work.
- Concurrent duplicate runs return `already_running`; expired leases recover safely.
- Each canonical batch is atomic through the service-role-only RPC.

### Result safety

- Empty success and provider failure do not change results.
- Provisional updates do not settle.
- Final update settles once.
- Correction creates revision/history and re-settles only affected predictions.
- Final status cannot regress accidentally.

### Security

- Missing service key fails before writes.
- Browser-exposed secret environment variables are ignored/rejected.
- Dry run writes nothing.
- Simulation refuses production mode.
- Logs/summaries contain no configured secret values.
- Query-string cron secrets are rejected and server-only modules cannot enter client bundles.

## 12. Implementation checklist

- [ ] Complete and approve rugby provider ADR.
- [ ] Add redacted football/rugby provider fixtures.
- [ ] Define canonical adapter DTOs and contract tests.
- [ ] Implement validation, normalization, retry, resolution, transactional batch RPC, run leases, quarantine, and orchestration modules.
- [ ] Migrate football ingestion and remove fuzzy/simulated production behavior.
- [ ] Implement rugby adapter and Six Nations import.
- [ ] Consolidate CLI and cron entry points.
- [ ] Add structured summaries and failure/retry tests.
- [ ] Run recorded, dry-run, and real API reconciliation.

## 13. Verification

```bash
npx supabase db reset --local
npx supabase test db --local
npm run typecheck
npm test
npm run build
```

Also run two consecutive recorded imports and two allowed real-provider imports, then compare canonical row counts and update summaries.

## Exit gate

- Football and Six Nations imports are provider-keyed, idempotent, and reconciled.
- No production path uses fuzzy identity, browser secrets, anon-key fallback, or implicit simulation.
- Provider failure cannot fabricate or regress results.
- Final corrections create audited revisions and deterministic settlement.
- CLI and cron share one tested orchestration implementation.
- Overlapping invocations are single-flight and every run has a persisted sanitized summary.
- All database, unit/integration, and build checks pass.
