# Phase 5: API-Sports History and Backfill

- Status: in progress.
- Depends on: [Phase 4: Primary Current-Provider Pilot](04_primary_current_provider_pilot.md) approved and merged.
- Unlocks: [Phase 6: Fallback, Quality, and Conflicts](06_fallback_quality_and_conflicts.md).
- Migration ownership: create one imperative `provider_sync_targets` migration with the installed Supabase CLI.

## Outcome

Retain API-Sports as Rugby Union historical authority, route it through the Phase 3 source ledger, and provide independent resumable season backfills that reconcile with current-provider canonical events without regression.

## Included scope

- Add validated source metadata/raw entity payloads to the existing API-Sports adapter.
- Preserve existing API-Sports behavior through regression tests.
- Add historical provider settings/priorities for explicitly configured competitions.
- Add persisted sync targets and resumable page/cursor/event checkpoints.
- Import historical seasons, teams, fixtures, and completed results.
- Reconcile overlapping API-Sports/current-provider events through approved mappings.
- Prevent historical/lower-authority data from regressing current canonical fields or results.
- Add explicit CLI controls for competition, season, date range, resume, restart, dry run, and recorded mode.

## Excluded scope

- Current-provider feature expansion.
- ESPN or automatic fallback.
- Circuit breaker/health/request budget persistence.
- Standings synchronization.
- New application UI or public endpoints.
- Unconfigured competition discovery or activation.

## Interfaces and schema owned

### `provider_sync_targets`

- Unique key: `(provider_slug, edition_id, operation)`.
- Operations initially include `historical_backfill`; future enum/check additions belong to their owning phases.
- Stores enabled state, opaque cursor JSONB, page, last provider event key, last processed/fetched timestamps, next run, status, error summary, and update timestamps.
- Status is checked and supports `pending`, `running`, `paused`, `completed`, and `failed`.
- Index due targets by enabled/status/next run and provider/edition lookup.
- Client roles have no privileges; service-role operations are audited through `ingestion_runs`.

The API-Sports adapter retains the shared contract. No API-Sports-specific type may enter canonical/domain query code.

## Data flow

```text
configured provider + edition + season
        ↓
load checkpoint
        ↓
fetch one bounded page/window outside transaction
        ↓
validate + source upsert + canonical reconciliation
        ↓
commit successful checkpoint
        ├── more data → next bounded run
        └── finished → completed
```

Checkpoint advancement occurs only after its bounded source/canonical batch commits. Failed work does not skip records. Resume uses provider pagination/cursor semantics proven by recorded tests, not guessed page arithmetic.

## Authority behavior

- API-Sports is priority 1 for historical fixtures/results.
- The approved current provider remains priority 1 for current pilot data.
- Historical rows may fill missing canonical fields but never overwrite a newer authoritative kickoff/status/result with null, stale, or lower-priority data.
- Completed result disagreement is recorded for later Phase 6 conflict processing; Phase 5 does not add automatic provider fallback.
- Manual result corrections remain highest authority.

## Failure behavior

- A failed page/window leaves its checkpoint unchanged.
- A malformed item quarantines without discarding valid siblings.
- Restart requires an explicit flag and does not delete existing canonical/source rows.
- Rate-limit exhaustion pauses the target at its current checkpoint rather than looping.
- One edition failure does not block another independent target.
- Duplicate events reuse direct provider identity or deterministic reconciliation.

## Security requirements

- Keep `API_SPORTS_KEY` server-only and never fall back to anon/publishable credentials.
- Store no secret in checkpoint/cursor JSONB, logs, errors, or raw payloads.
- Enable RLS and explicit service-role-only grants on `provider_sync_targets`.
- Use short transactions and existing non-overlap leases; no network call occurs while a row/lease transaction is held.

## Implementation checklist

- [x] Confirm Phase 4 PR is approved/merged. (Phase 4 is marked complete in the master plan by user direction; deployment-runtime evidence remains explicitly deferred.)
- [x] Add source metadata/schema validation to API-Sports without changing provider identity. (API-Sports normalized DTOs now retain sanitized raw entity payloads, and paged game envelopes/items are validated before normalization.)
- [x] Create the Phase 5 migration with CLI-generated naming. (`20260903142512_phase5_provider_sync_targets.sql`.)
- [x] Add historical provider settings for explicitly configured competitions. (The verified API-Sports Six Nations mapping is enabled for historical authority with result priority below the current provider.)
- [x] Implement bounded backfill checkpoint load/advance/resume. (The server-only worker processes one bounded page by default, uses provider-returned pagination metadata, persists an opaque cursor, and uses an optimistic checkpoint RPC.)
- [x] Add CLI options and dry-run/recorded modes. (`npm run provider:backfill:rugby` supports competition, season, edition, date range, resume/restart, page limit, dry-run, recorded fixtures, and explicit `--map-catalog`.)
- [x] Add authority/regression protection. (API-Sports historical results use priority 100 while the approved SofaScore result priority remains 1; existing result precedence prevents lower-authority overwrites.)
- [x] Add interrupted, resumed, restarted, and completed backfill tests. (Checkpoint unit tests and database optimistic-advance tests cover failure-before-advance, resume, replay safety, and completion.)
- [x] Reconcile overlapping API-Sports/current-provider fixtures. (The worker routes each page through the Phase 3 source-ledger reconciliation path and does not create a second event for an approved overlap.)
- [x] Regenerate database types and add RLS/index tests. (No generated database-types artifact exists in this repository; Phase 5 adds database RLS, grant, index, settings, and checkpoint tests.)

## Test scenarios and commands

- Existing API-Sports fixtures still normalize identically.
- Failure before checkpoint commit resumes the same record/page.
- Failure after successful commit resumes the next record/page.
- Re-running a completed target creates no duplicates.
- Explicit restart reprocesses idempotently without deletion.
- Current-provider completed events cannot regress.
- Cross-provider overlap resolves to one event.
- Independent target failure does not block another target.

```bash
npx supabase db reset --local
npx supabase test db --local
npm run typecheck
npm test
npm run build
npx supabase db advisors --local
```

The deterministic recorded backfill command is:

```bash
npx tsx scripts/backfill-rugby-history.ts --competition=11 --season=2025 --edition-id=<canonical-edition-id> --recorded --dry-run
```

Use the exact installed CLI flags.

## Rollback and disable strategy

- Pause/disable all API-Sports historical sync targets.
- Preserve checkpoints, source rows, mappings, and canonical history.
- Revert the worker/adapter code; use a reviewed forward migration only if the sync-target table must later be removed.

## Exit gate

- Existing API-Sports integration regressions pass.
- Historical seasons/fixtures/results import through the source ledger.
- Interrupted imports resume without skip or duplicate.
- Current authoritative data cannot regress.
- Cross-provider overlap converges on one canonical event.
- Full verification and relevant advisors pass.
- Work stops for user review, testing, and the Phase 5 PR.
