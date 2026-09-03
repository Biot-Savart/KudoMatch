# Phase 7: Standings, Operations, Admin, and Release

- Status: in progress; implementation complete in working tree, release gates awaiting provider activation and deployment evidence.
- Depends on: [Phase 6: Fallback, Quality, and Conflicts](06_fallback_quality_and_conflicts.md) approved and merged.
- Unlocks: [Phase 8: World Rugby Feasibility Spike](08_world_rugby_feasibility_spike.md).
- Migration ownership: create one imperative `rugby_standings_and_provider_diagnostics` migration with the installed Supabase CLI.

## Outcome

Complete P0/P1 delivery with canonical standings, scheduler-neutral adaptive sync operations, daily provider contract checks, typed application queries, read-only provider diagnostics, and staged Currie Cup/URC release controls.

## Included scope

- Provider standings normalization for providers with proven capability.
- Provider-source and canonical standings persistence.
- Daily and completed-match-triggered standings refresh.
- Scheduler-neutral sync dispatcher and due-work calculation.
- Authenticated cron route integration and fail-closed production secret behavior.
- Daily provider contract checks and operational summaries.
- Typed canonical standings and competitor-event queries.
- Read-only provider diagnostics page.
- Pilot release, rollback drill, documentation, and advisor gates.

## Excluded scope

- `/api/rugby/*` public REST facade.
- Direct application-provider requests.
- New provider adapters or additional competition rollout.
- World Rugby investigation or integration.
- Player/detail statistics, rankings, and richer live scoring.
- Provider mapping/conflict mutations from the browser; the Phase 3/6 CLI remains authoritative.

## Interfaces owned

- Implement `fetchCompetitionStandings(editionId, stageKey?)` returning canonical standings only.
- Implement `fetchCompetitorEvents({ competitorId, competitionId?, editionId?, from?, to?, status?, limit? })` using canonical IDs.
- Extend existing event filters with ISO date ranges and canonical competitor filters.
- Implement server-only `runRugbySyncDispatcher({ now, maxTargets, invocationSource })`.
- Add server-only diagnostic query types; do not add raw provider fields to public event/standing types.

## Schema owned

### `edition_standing_sources`

- Unique provider observation per edition, stage/group, and provider competitor key.
- Stores nullable mapped canonical competitor, normalized position/played/won/drawn/lost/for/against/difference/bonus/table points, latest raw payload, provider/fetch times, and mapping status.
- Unmapped competitor standings remain source-only and cannot enter canonical standings.

### `edition_standings`

- Canonical key: `(edition_id, stage_key, competitor_id)`.
- Stores normalized standings fields, preferred provider, quality state, source count, last verified time, and checked extra details JSONB.
- Foreign-key and edition/stage/position indexes support application ordering and refresh.

### Views

- Public/application standings view uses `security_invoker = true` and exposes canonical fields only.
- Service-only provider diagnostic views compare canonical event/standing values with source records and runtime/sync state.
- Explicit grants/revokes accompany every view.

## Dispatcher and scheduling

The cron trigger calls one dispatcher; it contains no provider-specific logic. The dispatcher selects bounded due targets, acquires existing leases, and invokes shared orchestration.

Run the trigger every ten minutes while each target computes its next provider call:

| Event state/time | Next sync |
| --- | --- |
| More than 168 hours before kickoff | 24 hours |
| 24–168 hours before kickoff | 6 hours |
| 3–24 hours before kickoff | 1 hour |
| Kickoff minus 3 hours through kickoff | 1 hour |
| Kickoff through kickoff plus 3 hours | 20 minutes |
| Completed | +1 hour, +6 hours, then +24 hours verification |

- Contract checks run daily before normal ingestion for undocumented providers.
- Standings run at least daily and are made due after a match changes to completed.
- One dispatcher invocation processes a bounded target count and stays below hosting/runtime limits.
- Vercel Cron is the initial trigger, but CLI or another scheduler can invoke the same dispatcher.

Supabase Cron, if adopted later, must respect current platform guidance of bounded job duration/concurrency and requires a separately reviewed setup. It is not implemented by this phase.

## Application and admin flow

```text
provider workers → source/canonical database → typed queries → application
                                      └──────→ authorized diagnostics
```

Add `/admin/providers` as a server-rendered, read-only page showing:

- provider health/circuit/budget;
- last successful/failed request;
- mapping gaps and quarantine counts;
- canonical event result beside each provider source;
- quality/conflict/preferred source;
- last/next sync and recent run summary;
- canonical and provider standings comparisons.

Authorization uses a fresh server-side user fetch and `app_metadata.roles` containing `provider_admin`. User-editable user metadata is never authorization input. Unauthorized requests return not-found or forbidden without leaking diagnostics.

## Failure behavior

- Production cron route rejects a missing/invalid `CRON_SECRET`; local/test invokes the dispatcher directly or provides an explicit test secret.
- A dispatcher run failure does not affect application reads.
- Due target selection is lease-protected and bounded; overlapping invocations return/skip cleanly.
- One target/provider failure does not abort independent targets.
- Unmapped standing competitors remain source-only and visible in diagnostics.
- Contract failure degrades the provider and prevents malformed normal ingestion.
- Stale standings remain readable with verification timestamps during provider outage.

## Security requirements

- Vercel cron receives `CRON_SECRET` as a bearer header and the route fails closed in production: [Vercel cron security guidance](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
- Do not store service-role keys in cron configuration or pass secrets in query strings.
- Standings source and diagnostics are service-only; canonical standings receive deliberate read grants/RLS.
- Diagnostic views/functions revoke `PUBLIC`/client access unless specifically required.
- The admin page uses server-only clients and never serializes raw payloads/secrets to unauthorized users.

## Release sequence and gates

For Currie Cup, then URC independently:

1. provider disabled;
2. observe-only;
3. canonical fixtures;
4. canonical completed results;
5. canonical standings;
6. fallback verification enabled.

Each competition must have complete mappings, zero unexplained ambiguous/duplicate events, two idempotent reruns, successful contract checks, verified latest completed results, standing totals matching upstream, and a successful provider-disable rollback drill.

## Implementation checklist

- [x] Confirm Phase 6 PR is approved/merged. (Phase 6 is marked complete by user direction; its implementation and test evidence remain in the repository.)
- [x] Create Phase 7 migration with CLI-generated naming. (`20260903174621_phase7_standings_operations_admin_and_release.sql`.)
- [x] Implement provider and canonical standings normalization/upserts. (API-Sports recorded/live standings normalize into source rows; reviewed mappings alone promote canonical rows.)
- [x] Add standings RLS, grants, views, indexes, and database tests. (Canonical `competition_standings` is client-readable; source and diagnostics objects are service-only.)
- [x] Implement due-work calculation and bounded dispatcher. (Adaptive kickoff windows, completed verification cadence, `SKIP LOCKED` claims, and failure isolation are implemented.)
- [x] Integrate authenticated cron route and fail-closed secret validation. (`/api/cron/rugby-sync` rejects missing production secrets and invalid bearer tokens.)
- [x] Implement daily contract checks and completed-match standings trigger. (Existing contract-check command remains the provider-specific evidence path; dispatcher targets and completed-event trigger are wired.)
- [x] Add typed standings and competitor-event queries. (`fetchCompetitionStandings` and `fetchCompetitorEvents` use canonical IDs and ISO date filters.)
- [x] Add read-only authorized diagnostics page. (`/admin/providers` requires a fresh user fetch and `app_metadata.roles` `provider_admin`.)
- [ ] Exercise release gates and rollback for Currie Cup, then URC.
- [x] Regenerate database types and update operations documentation. (No generated database-types artifact exists; operations documentation is updated.)
- [x] Run full tests and relevant advisors. (Local reset, 194 pgTAP assertions, 202 Vitest tests, typecheck, build, and advisors completed.)

## Test scenarios and commands

- Standings mapping, ordering, agreement, disagreement, and unmapped competitor.
- Daily refresh and completed-match due behavior.
- Every kickoff timing boundary and completed verification sequence.
- Concurrent dispatcher invocation and bounded target count.
- Missing/invalid/valid cron bearer token.
- Contract failure degradation and later recovery.
- Public canonical standings access versus denied source/diagnostic access.
- Admin role, non-admin, anonymous, and stale client-claim cases.
- Provider outage with readable canonical events/standings.

```bash
npx supabase db reset --local
npx supabase test db --local
npm run typecheck
npm test
npm run build
npx supabase db advisors --local
```

Use the exact installed CLI flags and run deployment-runtime smoke tests after local verification.

## Rollback and disable strategy

- Disable provider settings/fallback per competition without deleting source/canonical history.
- Disable the cron entry while leaving manual dispatcher diagnostics available.
- Keep last verified canonical standings readable.
- Revert queries/UI/dispatcher code as needed; use a reviewed forward migration rather than destructive shared-environment reset.

## Exit gate

- All P0 and P1 ownership criteria through Phase 7 pass.
- Currie Cup and URC release gates and rollback drills pass independently.
- Canonical standings match evidenced upstream data.
- Scheduler/contract checks are bounded, secure, and failure-isolated.
- Diagnostics authorization and source-data secrecy pass.
- Full verification and relevant advisors pass.
- Work stops for user review, testing, and the Phase 7 PR.

Current limitation: Currie Cup and URC remain disabled/observe-only in the checked-in seed configuration, and no deployment environment is available for the two-rerun, upstream standings, and rollback-drill evidence. Phase 7 therefore remains in progress until those operational gates are exercised after explicit provider activation.
