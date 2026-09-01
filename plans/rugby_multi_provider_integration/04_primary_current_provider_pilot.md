# Phase 4: Primary Current-Provider Pilot

- Status: not started.
- Depends on: [Phase 3: Source Ledger and Reconciliation Foundation](03_source_ledger_and_reconciliation_foundation.md) approved and merged.
- Unlocks: [Phase 5: API-Sports History and Backfill](05_api_sports_history_and_backfill.md).
- Migration impact: no new table; provider registration/settings data may use a narrowly scoped migration.

## Outcome

Implement the current provider approved by Phase 2 and prove current Currie Cup and United Rugby Championship fixtures and completed results through observe-only, mapping, canonical-write, and application-read gates.

SofaScore is the expected adapter only when the approved ADR confirms compliant access and coverage. A pivot requires explicit ADR and user approval; it cannot silently satisfy SofaScore-specific P0 criteria.

## Included scope

- One approved current-provider adapter.
- Provider-specific schemas for competitions, seasons, teams, events, results, and optional standings response capture.
- Provider registration and reviewed pilot settings.
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

## Interfaces and schema owned

- Implement one adapter using the Phase 3 contract and the exact Phase 2 schemas.
- Implement adapter factory/CLI selection for the approved provider.
- Add the provider row and Currie Cup/URC authority settings through reviewed configuration/migration data.
- Do not add new domain tables.
- Do not expose raw provider types through application query interfaces.

## Data flow and staged activation

```text
provider fetch
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

## Failure behavior

- Provider HTTP/schema errors persist source/run diagnostics and leave canonical data untouched.
- Unknown teams or editions remain `needs_mapping`; the adapter does not guess.
- An ambiguous event remains quarantined.
- A missing score cannot finalize a result.
- A provider outage cannot affect event/application reads already served from Supabase.

## Security requirements

- Provider calls are server-only and use Phase 2-approved credentials/access method.
- No credential enters `NEXT_PUBLIC_*`, logs, source payloads, or recorded fixtures.
- Contract checks and pilot runs use bounded timeouts and approved request budgets.
- Pilot settings/source rows remain service-role operated.
- Application reads receive canonical event/result fields only.

## Activation requirements

- Two successful contract checks at least six hours apart.
- Every provider competition, edition, and team returned for both pilots is mapped or deliberately ignored with evidence.
- No ambiguous event remains unexplained.
- No duplicate canonical event exists for a provider or cross-provider fixture.
- Two consecutive imports create zero additional rows.
- Scores and statuses match the latest completed round or previous 30 days; if off-season, validate the most recent complete round available.
- Application queries return pilot fixtures/results with provider network access disabled.

## Implementation checklist

- [ ] Confirm Phase 3 PR is approved/merged.
- [ ] Confirm Phase 2 provider ADR remains valid.
- [ ] Implement the approved adapter and provider schemas.
- [ ] Add recorded adapter tests for every evidenced state.
- [ ] Register provider and pilot settings disabled by default.
- [ ] Run Currie Cup and URC observe-only imports.
- [ ] Review and apply all required mappings.
- [ ] Prove idempotency and reconciliation.
- [ ] Enable fixture authority and verify canonical fixtures.
- [ ] Enable result authority and verify final/revision/settlement behavior.
- [ ] Implement contract check and completed-result verification timing.
- [ ] Prove application database reads during simulated outage.
- [ ] Record activation evidence in the phase document/PR.

## Test scenarios and commands

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

Real-provider checks are explicit and bounded; CI remains fixture-based.

## Rollback and disable strategy

- Set both pilot competition/provider settings to disabled.
- Retain source, canonical, result-history, and mapping audit data for diagnosis.
- Revert adapter/config code if necessary; do not delete canonical events or rewrite result history during emergency disablement.

## Exit gate

- All activation requirements pass for Currie Cup and URC.
- Current fixtures and completed results are stored canonically.
- Existing application queries work without provider access.
- Provider failure cannot take down the application or erase results.
- Full verification passes.
- Work stops for user review, testing, and the Phase 4 PR.
