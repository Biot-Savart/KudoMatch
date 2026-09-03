# Phase 6: Fallback, Quality, and Conflicts

- Status: in progress.
- Depends on: [Phase 5: API-Sports History and Backfill](05_api_sports_history_and_backfill.md) approved and merged.
- Unlocks: [Phase 7: Standings, Operations, Admin, and Release](07_standings_operations_admin_and_release.md).
- Migration ownership: create one imperative `provider_runtime_state_and_conflicts` migration with the installed Supabase CLI.

## Outcome

Add a verified ESPN secondary adapter, operation-specific automatic fallback, distributed provider budgets, health/circuit state, explicit data-quality transitions, score-conflict detection, and audited conflict resolution without premature settlement.

## Included scope

- ESPN adapter only for competition slugs/coverage proven by Phase 2 or a later approved ADR.
- Provider selection by configured priority, capability, health, open circuit, and request budget.
- Atomic database-backed minute/day request reservation.
- Provider health and circuit breaker state.
- Fallback fixture/result behavior.
- Data-quality transitions.
- Cross-source score/status comparison and conflict details.
- Audited `resolve-conflict` mapping-management operation.
- Contract/schema failure degradation and recovery.

## Excluded scope

- Standings persistence or UI.
- General cron dispatcher and adaptive schedule.
- Provider diagnostics page.
- Additional competitions beyond explicitly configured/proven coverage.
- World Rugby.
- Automatic conflict choice or majority voting beyond the locked result rules.

## Interfaces owned

- Implement `EspnRugbyAdapter` against Phase 3 contracts.
- Add provider-selection service accepting competition, edition, operation, and current time.
- Add runtime request reservation and result-reporting interfaces.
- Extend mapping management CLI with `resolve-conflict`.
- Extend structured run summaries with selected/fallback provider, health decision, budget result, and conflicts without secrets/raw payloads.

## Schema owned

### `provider_runtime_state`

One row per provider stores:

- `health_status`: `healthy`, `degraded`, or `unavailable`;
- consecutive failures and failure-window start;
- circuit state: `closed`, `open`, or `half_open`;
- `circuit_open_until` and open count;
- last success/failure, HTTP status, sanitized error code, and latency;
- current minute window/start/count/limit;
- current day window/start/count/limit;
- updated timestamp.

Limits originate in the Phase 2 ADR/configuration. There is no permissive unlimited default. Request reservation uses one atomic database operation and database time so concurrent serverless workers cannot exceed the persisted budget.

Add only the event/source quality fields or constraints proven necessary by Phase 6 behavior. Do not add standings or admin tables/views.

## Provider selection flow

```text
configured providers ordered by operation priority
        ↓
capability supported?
        ↓
circuit callable?
        ↓
atomic request budget available?
        ↓
attempt provider
   ├── valid → record success and use result
   └── failure → record failure and try next eligible provider
```

An unavailable provider remains visible in run diagnostics. Fallback is allowed only when the competition/operation mapping exists; the service never invents provider IDs or tries unconfigured competitions.

## Circuit behavior

- Five qualifying failures within ten minutes open the circuit.
- Cooldown is thirty minutes.
- After cooldown, exactly one lease-protected half-open probe is allowed.
- A valid response closes/reset the circuit.
- A failed half-open probe reopens it for another cooldown.
- Authentication/permission and schema-contract failures degrade immediately and do not receive blind HTTP retries.
- Expected empty data does not count as success unless the endpoint contract explicitly permits it for the request.

## Result and quality behavior

- Preferred-provider valid final: canonical final, settle, quality `single_source`.
- Second source agrees: quality `verified`, no duplicate settlement.
- Lower-priority fallback final: store canonical/provisional result without settlement.
- Preferred or another configured source later agrees: promote to final and settle once.
- At +24 hours, a fallback may finalize alone only when `may_finalize_single_source = true` for that competition/provider.
- Sources disagree: quality `conflicted`, retain the existing canonical/result revision, prevent automatic correction.
- `resolve-conflict` requires chosen source, reason, `--apply`, and service-role authorization; it records audit and invokes existing correction/re-settlement behavior.
- `unverified` applies before a trustworthy result source exists.

## Failure behavior

- Budget exhaustion skips/defer the request without counting as provider failure.
- Timeout/429/5xx use the Phase 2 retry policy and update runtime metrics.
- Schema drift records quarantine/health failure and blocks malformed data from canonical writes.
- Preferred outage does not erase data or block the application.
- Fallback disagreement never silently overwrites settled results.
- A conflict in one event does not fail independent events.

## Security requirements

- `provider_runtime_state` is RLS-enabled and service-role only.
- Atomic reservation/update RPCs have explicit execute grants, empty search path, and no `PUBLIC` access.
- Provider credentials and request headers never enter runtime-state errors or logs.
- Conflict management is server CLI-only in this phase; no client mutation endpoint is added.
- ESPN is contacted only server-side through configured competition slugs.

## Implementation checklist

- [x] Confirm Phase 5 PR is approved/merged. (Phase 5 is marked complete by user direction; its local migration, worker, and test evidence remain in the repository.)
- [x] Confirm ESPN proof/ADR coverage for each enabled competition. (No ESPN competition is enabled; Phase 2 evidence supports the disabled Currie Cup/URC scoreboard fixture/result registrations, while standings and exceptional-state gaps remain explicit.)
- [x] Implement and fixture-test ESPN adapter. (`EspnRugbyAdapter` validates recorded scoreboard envelopes and normalizes scheduled/final events.)
- [x] Create Phase 6 migration with CLI-generated naming. (`20260903154913_phase6_provider_runtime_state_and_conflicts.sql`.)
- [x] Implement atomic runtime budget reservation and reporting. (Minute/day counters use row locking and database time; provider success/failure reporting is service-role-only.)
- [x] Implement circuit state machine and half-open coordination. (Five qualifying failures in ten minutes open the circuit for thirty minutes; one five-minute half-open probe is admitted.)
- [x] Implement provider selector and recorded fallback tests. (Selection filters capability, mapping/settings, health, circuit, priority, and budget; adapter and policy tests use recorded data.)
- [x] Implement quality transitions and conflict comparison. (Preferred/fallback results preserve source priority; agreement verifies and disagreement records `conflicted` without overwrite.)
- [x] Add provisional fallback finalization rules. (Configured fallback provisionals may finalize after 24 hours through the service RPC.)
- [x] Add audited `resolve-conflict` command. (`manage-provider-mapping.ts resolve-conflict` requires an explicit reason and `--apply`.)
- [x] Add RLS, grant, concurrency, and settlement tests. (The Phase 6 pgTAP suite covers budgets, circuit recovery, RLS, functions, indexes, and quality contracts.)
- [x] Regenerate database types. (No generated database-types artifact exists in this repository; RPC/table contracts are covered by pgTAP.)

## Test scenarios and commands

- ESPN scheduled/final/postponed/cancelled/schema-error fixtures.
- Preferred provider success without fallback.
- Preferred timeout/429/unavailable with eligible fallback.
- No configured fallback.
- Concurrent request reservations at minute/day limits.
- Five failures in/outside ten-minute window.
- Open, cooldown, half-open success, and half-open failure.
- Agreement, fallback provisional, allowed +24-hour finalization, and disagreement.
- Manual conflict selection, correction history, and one re-settlement.
- Application canonical reads during all failure states.

```bash
npx supabase db reset --local
npx supabase test db --local
npm run typecheck
npm test
npm run build
npx supabase db advisors --local
```

Use the exact installed CLI flags.

## Rollback and disable strategy

- Disable ESPN and automatic fallback in `competition_provider_settings`.
- Open/disable affected provider runtime state to prevent calls while retaining diagnostics.
- Keep existing preferred-provider/source/canonical data and conflict audit.
- Revert Phase 6 code; use a reviewed forward migration for schema removal only if necessary.

## Exit gate

- ESPN works only for proven mappings.
- Provider selection respects authority, capability, health, circuit, and budget.
- Circuit and atomic-budget concurrency tests pass.
- Fallback cannot settle prematurely.
- Conflicts are detected, preserved, visible in data, and manually resolvable with audit.
- Full verification and relevant advisors pass.
- Work stops for user review, testing, and the Phase 6 PR.
