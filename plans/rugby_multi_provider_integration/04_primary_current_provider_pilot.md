# Phase 4: Primary Current-Provider Pilot

- Status: local pilot activation and evidence gates verified; implementation remains in progress pending the remaining operational/release gate. Deployment-runtime verification is deferred because no deployment environment exists.
- Depends on: [Phase 3: Source Ledger and Reconciliation Foundation](03_source_ledger_and_reconciliation_foundation.md) approved and merged.
- Unlocks: [Phase 5: API-Sports History and Backfill](05_api_sports_history_and_backfill.md).
- Migration impact: no new table; provider registration/settings data may use a narrowly scoped migration.

## Outcome

Implement the current provider approved by Phase 2 and prove current Currie Cup and United Rugby Championship fixtures and completed results through observe-only, mapping, canonical-write, and application-read gates.

When SofaScore is approved, this phase also delivers the internal SofaScore Provider Gateway. The gateway owns SofaScore transport and access handling; the server-only TypeScript `SofaScoreProvider` owns validation, normalization, mapping metadata, and ingestion into the Phase 3 contracts. The gateway is an internal implementation component, not an application-facing sports-data API.

SofaScore is the expected adapter only when the approved ADR confirms compliant access and coverage. A pivot requires explicit ADR and user approval; it cannot silently satisfy SofaScore-specific P0 criteria.

## Included scope

- One approved current-provider adapter.
- Provider-specific schemas for competitions, seasons, teams, events, results, and optional standings response capture.
- Provider registration and reviewed pilot settings.
- A standalone Dockerised Python 3.12+ SofaScore gateway using FastAPI, Uvicorn, and `curl_cffi` with Chrome impersonation for all SofaScore requests.
- An allowlisted gateway surface for health, seasons, single-event detail, and the explicitly required Currie Cup/URC fixture and team lookups; no generic URL proxy.
- Internal API-key protection for every gateway route except `/health`, with server-only configuration.
- Deployment-runtime smoke verification that event `16393687` is returned through the gateway.
- A server-only `SofaScoreProvider` adapter that calls the gateway rather than SofaScore directly and preserves normalization into common fixture/result models.
- Currie Cup and URC source observation and mapping.
- Canonical fixture and completed-result writes after activation gates.
- Completed-result verification at +1 hour, +6 hours, and +24 hours.
- Application read verification using existing generic event queries.
- Contract-check implementation for one known pilot competition.

## Excluded scope

- API-Sports backfill changes.
- ESPN or automatic fallback.
- Runtime health/circuit/request-budget persistence.
- Canonical standings writes or standings UI.
- General production scheduling; pilot runs are explicit/manual or isolated test triggers.
- Additional competitions or international rollout.
- Browser access to SofaScore or the gateway, and any generic upstream proxy behavior.

## Interfaces and schema owned

- Implement one adapter using the Phase 3 contract and the exact Phase 2 schemas.
- Implement the SofaScore gateway as a separate service when SofaScore is the approved provider. Keep SofaScore base URLs, headers, `curl_cffi` impersonation, upstream status handling, and transport timeouts inside the Python service.
- Keep the gateway API fixed and allowlisted. The initial contract includes `GET /health`, `GET /v1/events/{eventId}`, and `GET /v1/tournaments/{tournamentId}/seasons`; add only narrowly scoped fixture-list and team routes required by the Currie Cup/URC pilot.
- Require `INTERNAL_API_KEY` for non-health gateway calls and never expose it through `NEXT_PUBLIC_*`, browser code, logs, or raw payloads.
- Configure the TypeScript `SofaScoreProvider` with the gateway URL and internal key; it must not make direct SofaScore requests.
- Implement adapter factory/CLI selection for the approved provider.
- Add the provider row and Currie Cup/URC authority settings through reviewed configuration/migration data.
- Do not add new domain tables.
- Do not expose raw provider types through application query interfaces.

## Data flow and staged activation

```text
 KudoMatch ingestion
      ↓
 SofaScoreProvider
      ↓
 Python SofaScore Gateway
      ↓
 curl_cffi with Chrome impersonation
      ↓
 SofaScore
     ↓
validated source records
     ↓
observe-only pilot
     ↓
reviewed competition/edition/team mappings
     ↓
fixture authority enabled
     ↓
canonical fixtures
     ↓
result authority enabled
     ↓
canonical completed results + verification schedule
     ↓
existing application database queries
```

Activation order is fixed: disabled → observe-only → mapped fixtures → completed results. Each transition is a separate explicit configuration change with evidence; adapter deployment alone must not enable writes.

## Result behavior

- The approved highest-priority result provider may produce a final single-source result and invoke existing settlement.
- In-progress scores remain provisional and never settle.
- The same final payload is a no-op on replay.
- A provider correction creates normal result revision/history and re-settles only affected predictions.
- Completed status cannot regress to live or scheduled.
- Verification checks run at +1 hour, +6 hours, and +24 hours without treating the system as a second-by-second live service.

## Activation evidence

Evidence was recorded against the local Supabase project and Dockerized SofaScore gateway on 2026-09-03. The local pilot settings are currently `enabled=true`, `observe_only=false`, `fixture_authority=true`, and `allow_single_source_result_finalization=true` for both Currie Cup and United Rugby Championship. Both pilot competitions are application-visible through the canonical read policy; disabling or returning a setting to observe-only hides the pilot from the application surface without deleting canonical data.

| Gate | Evidence | Result |
| --- | --- | --- |
| Provider and mappings | SofaScore competitions `796`/`419`, editions `97057`/`98406`, and 22 current-provider teams mapped; 35 historical editions explicitly ignored | Pass; all 61 catalog sources resolved |
| Fixture authority | Canonical reconcile created 30 Currie Cup and 30 URC events with 120 participant links | Pass; 60 source events map to 60 canonical events, 0 duplicate groups |
| Result authority | Canonical replay stored 28 Currie Cup finals and 0 URC finals because all URC pilot events are scheduled | Pass; 28 settled markets, 28 history rows, 28 settlement runs |
| Final/revision/settlement | Controlled acceptance proved revision 1 exact score = 6 points, identical replay = no-op, correction = revision 2 and close-margin = 3 points | Pass; completed status did not regress |
| Verification timing | Controlled +1h, +6h, and +24h checkpoints verified all 28 completed Currie Cup results | Pass; 28 complete schedules, 0 errors |
| Application reads during outage | Gateway stopped at `127.0.0.1:18080`; canonical application queries returned both pilots and six Supabase requests with no provider request | Pass; Currie Cup 30/30/28 and URC 30/30/0 events/markets/finals |

Repository evidence includes migrations `20260903132438_phase4_result_authority_settlement.sql`, `20260903134323_phase4_contract_checks_result_verification.sql`, and `20260903135650_phase4_pilot_application_visibility.sql`; contract, result-verification, and outage-proof commands are recorded in the implementation checklist below. Deterministic verification passed with 187 application tests, 145 database tests, TypeScript typecheck, and production build.

Deployment-runtime gateway verification is explicitly deferred because no deployment environment exists. Remaining release gates are two successful contract checks at least six hours apart and the final Phase 4 review/PR. No production activation is claimed by this local evidence.

## Failure behavior

- Provider HTTP/schema errors persist source/run diagnostics and leave canonical data untouched.
- The gateway translates upstream 403, 404, 429, timeout, and network failures into bounded, structured provider failures; 403 and 429 are not aggressively retried.
- A gateway outage or unavailable deployment marks the SofaScore attempt failed and allows the pilot run to preserve canonical data; automatic sibling-provider fallback remains Phase 6 work.
- Unknown teams or editions remain `needs_mapping`; the adapter does not guess.
- An ambiguous event remains quarantined.
- A missing score cannot finalize a result.
- A provider outage cannot affect event/application reads already served from Supabase.

## Security requirements

- Provider calls are server-only and use Phase 2-approved credentials/access method.
- The Python gateway uses `curl_cffi` with Chrome impersonation for SofaScore transport; this is an approved access mechanism only after Phase 2 confirms permitted use and deployment-runtime viability.
- `INTERNAL_API_KEY` protects every non-health gateway route and is supplied only from server-side environment configuration.
- The gateway exposes fixed, narrowly scoped routes and never accepts arbitrary upstream URLs or forwards arbitrary request headers.
- No credential enters `NEXT_PUBLIC_*`, logs, source payloads, or recorded fixtures.
- Contract checks and pilot runs use bounded timeouts and approved request budgets.
- Pilot settings/source rows remain service-role operated.
- Application reads receive canonical event/result fields only.

## Activation requirements

- The deployed gateway health check succeeds, and `GET /v1/events/16393687` returns a valid SofaScore event from the deployment environment.
- Gateway authentication rejects missing or invalid internal keys while `/health` remains usable for platform health checks.
- Gateway container builds and starts successfully with `INTERNAL_API_KEY` supplied through deployment configuration.
- Two successful contract checks at least six hours apart.
- Every provider competition, edition, and team returned for both pilots is mapped or deliberately ignored with evidence.
- No ambiguous event remains unexplained.
- No duplicate canonical event exists for a provider or cross-provider fixture.
- Two consecutive imports create zero additional rows.
- Scores and statuses match the latest completed round or previous 30 days; if off-season, validate the most recent complete round available.
- Application queries return pilot fixtures/results with provider network access disabled.

## Implementation checklist

- [x] Confirm Phase 3 PR is approved/merged. (Phase 3 is marked complete in the master plan; repository-local verification passes.)
- [x] Confirm Phase 2 provider ADR remains valid. (SofaScore remains the approved priority-1 current provider; runtime and coverage gaps remain explicit gates.)
- [x] Build the standalone FastAPI gateway with Python 3.12+, Uvicorn, and `curl_cffi`. (Docker build passes.)
- [x] Implement `/health`, `/v1/events/{eventId}`, and `/v1/tournaments/{tournamentId}/seasons` with schema validation and sanitized error responses.
- [x] Add only the allowlisted fixture-list and team routes required to ingest Currie Cup and URC; defer canonical standings integration to Phase 7.
- [x] Add `INTERNAL_API_KEY` authentication, bounded timeouts, status-aware retry behavior, structured logging, and Docker packaging.
- [ ] Deploy the gateway and verify event `16393687` from the deployed environment. (Deferred: no deployment environment exists.)
- [x] Implement the approved adapter and provider schemas.
- [x] Configure `SofaScoreProvider` to call the gateway and prove that no direct SofaScore request is made by TypeScript or browser code. (Injected-gateway contract test passes.)
- [x] Add recorded adapter tests for every evidenced state. (Season/team/event/result plus scheduled, live, postponed, cancelled, abandoned, and missing-score cases are covered.)
- [x] Register provider and pilot settings disabled by default.
- [x] Run Currie Cup and URC observe-only imports. (Local Supabase + Dockerized gateway evidence on 2026-09-03: Currie Cup `796-97057` and URC `419-98406` each fetched 30 events successfully; the source ledger contains 61 SofaScore catalog sources and 60 event sources, all 60 event sources remain unresolved, and 0 are mapped to canonical events.)
- [x] Review and apply all required mappings. (Local Phase 4 mapping review on 2026-09-03: both competitions mapped; current Currie Cup 2026 and URC 2026/2027 editions mapped; all 22 current-provider teams created and mapped; 35 historical SofaScore editions explicitly ignored with audited reasons. All 61 catalog sources are resolved, and event sources remain unresolved until fixture reconciliation.)
- [x] Prove idempotency and reconciliation. (2026-09-03 local evidence: four successful Currie Cup/URC replay imports left the database at 61 catalog rows and 60 event-source rows with no duplicates; `full_reconcile` succeeded for both pilots, retained all 60 event sources as `unresolved / provider_not_approved`, linked 0 events, and created 0 canonical pilot fixtures while provider and fixture authority remained disabled.)
- [x] Enable fixture authority and verify canonical fixtures. (Local evidence on 2026-09-03: SofaScore fixture authority enabled for both pilots while result finalization remained disabled; canonical reconciliation created 30 Currie Cup and 30 URC fixtures, each with home/away participant links. All 60 provider event sources are mapped to 60 canonical events, replay reconciliation kept the total at 60, and the edition/kickoff/home/away duplicate check returned 0 groups.)
- [x] Enable result authority and verify final/revision/settlement behavior. (Local evidence on 2026-09-03: result authority is enabled for both Currie Cup and URC with fixture authority enabled and observe-only disabled. Canonical replay produced 28 final Currie Cup results and 0 URC finals because all URC pilot events are scheduled; 28 markets are settled with 28 immutable history rows and 28 settlement runs, and no completed event regressed. A rollback-protected acceptance check proved final revision 1 settles an exact prediction at 6 raw points, identical final replay is a no-op, and a corrected final creates revision 2 and re-settles the prediction at 3 close-margin points.)
- [x] Implement contract check and completed-result verification timing. (Implemented server-only Currie Cup contract command `npx tsx scripts/check-rugby-provider-contract.ts`, which records bounded contract evidence in `ingestion_runs`; a live Docker gateway-backed check passed for competition `796`, season `97057`, and probe event `16393687`. Added scheduler-neutral +1h/+6h/+24h result verification with persisted stage/timestamps in `event_data_quality`; local controlled timing runs verified all 28 final Currie Cup results at each checkpoint with 0 errors and 28 complete schedules. The activation requirement for two real contract checks at least six hours apart remains a deployment-operational gate; `--require-six-hour-gap` enforces it.)
- [x] Prove application database reads during simulated outage. (Local evidence on 2026-09-03: with the Dockerized SofaScore gateway stopped at `127.0.0.1:18080`, `npx tsx scripts/prove-rugby-application-reads.ts --gateway-url=http://127.0.0.1:18080` read both pilots through the existing Supabase application query path: Currie Cup 30 events/30 markets/28 final results and URC 30 events/30 markets/0 final results. The canonical completed-event detail read succeeded; six Supabase requests were observed and no provider/gateway request was made. Approved fixture authority now synchronizes pilot competition visibility while disabled/observe-only settings remain hidden.)
- [x] Record activation evidence in the phase document/PR. (This phase document now contains the local activation state, gate-by-gate evidence, migrations, verification commands, test totals, and the explicitly deferred deployment-runtime gate. The PR link will be added after creation.)

## Test scenarios and commands

- Gateway health, authentication, successful event/season responses, 403/404/429 responses, timeout, network failure, malformed upstream JSON, and provider-error payloads inside HTTP 200.
- Docker build/start verification and deployed-runtime smoke test for event `16393687`.
- Scheduled, in-progress, completed, postponed, cancelled, and missing-score normalization.
- Schema drift and provider-level error in HTTP 200.
- Unknown team/edition and ambiguous fixture.
- Idempotent repeated source/canonical import.
- Final replay, final correction, and completed-status regression.
- Provider outage with successful internal application reads.

```bash
npx supabase db reset --local
npx supabase test db --local
npm run typecheck
npm test
npm run build
```

Gateway/container checks and real-provider checks are explicit and bounded; CI remains fixture-based. The gateway must be tested independently from the Next.js application and then through the server-only `SofaScoreProvider`.

## Rollback and disable strategy

- Set both pilot competition/provider settings to disabled.
- Disable or roll back the gateway deployment, then disable the SofaScore provider setting if the gateway is unavailable or access behavior changes.
- Retain source, canonical, result-history, and mapping audit data for diagnosis.
- Revert adapter/config code if necessary; do not delete canonical events or rewrite result history during emergency disablement.

## Exit gate

- All activation requirements pass for Currie Cup and URC.
- Current fixtures and completed results are stored canonically.
- The deployed gateway successfully serves the approved SofaScore event probe and its internal authentication/health behavior is verified.
- `SofaScoreProvider` reaches SofaScore only through the gateway; the browser has no provider or gateway dependency.
- Existing application queries work without provider access.
- Provider failure cannot take down the application or erase results.
- Full verification passes.
- Work stops for user review, testing, and the Phase 4 PR.
