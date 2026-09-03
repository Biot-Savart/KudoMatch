# Phase 2: Provider Proof and Selection

- Status: approved by user on 2026-09-03; deployment-runtime and coverage gaps remain recorded as follow-up evidence.
- Depends on: [Phase 1: Documentation Set](01_documentation_set.md) approved and merged.
- Unlocks: [Phase 3: Source Ledger and Reconciliation Foundation](03_source_ledger_and_reconciliation_foundation.md).
- Migration impact: none.

## Outcome

Select a compliant, technically viable provider for current Currie Cup and URC fixtures, results, and standings using reproducible evidence. SofaScore is investigated first, but no provider is approved by assumption.

## Included scope

- Exercise SofaScore from the intended production runtime and local tooling.
- Verify exact Currie Cup and URC competition/season identifiers.
- Verify season, fixture, event detail, completed result, and standings coverage.
- Verify ESPN Rugby competition slugs and overlapping pilot coverage as the candidate secondary provider.
- Record authentication, permitted use, access stability, response shapes, status/score/time semantics, quotas, latency, retry headers, and operational limits.
- Capture redacted recorded fixtures and a provider ADR.
- Define numerical request budgets, timeouts, retries, and provider-specific constraints consumed by later phases.

## Excluded scope

- Provider adapters or shared ingestion contracts.
- Database schema or mappings.
- Canonical writes or application integration.
- Automated fallback.
- Circumventing access controls, bot protections, authentication, or provider terms.
- World Rugby investigation, which belongs to Phase 8.

## Interfaces and schema owned

No runtime interface or schema changes.

Phase 2 owns evidence artifacts only:

- a provider selection ADR;
- a redacted proof report;
- stored response fixtures for scheduled, in-progress, completed, postponed, cancelled, missing-score, malformed, empty-success, timeout/error, rate-limit, catalog, teams, seasons, and standings cases;
- exact pilot ID/configuration evidence;
- explicit numerical budgets and timeout/retry rules.

## Proof procedure and decision flow

```text
SofaScore production-runtime probe
        ↓
access + permitted use + coverage + schema + stability
        ├── pass → approve as current provider
        └── fail → evaluate next provider candidate
                          ↓
                  ADR records pivot
```

The existing planning probe returned HTTP 403 for proposed SofaScore season endpoints and HTTP 404 for a generic ESPN Rugby scoreboard path. Phase 2 must reproduce or resolve those observations through legitimate, provider-permitted access before approval.

If SofaScore is rejected, the Phase 4 SofaScore-specific P0 criteria remain unmet until the user explicitly approves an ADR amendment that supersedes them with the selected provider. A replacement provider cannot be treated as silent compliance.

## Failure behavior

- A failed probe records HTTP status, sanitized headers, timing, and error category without a credential or full environment dump.
- Provider-level errors inside HTTP 200 responses count as failures.
- Schema evidence is not inferred from third-party libraries or stale examples.
- Partial competition coverage cannot be generalized to another competition.
- No provider proof may write canonical application data.

## Security requirements

- Load credentials only from server-side environment variables.
- Never use `NEXT_PUBLIC_*` provider credentials.
- Redact authorization headers, subscription details, account identifiers, and sensitive response fields before fixture storage.
- Do not commit terms-prohibited payloads.
- Use a descriptive server-side user agent where allowed and conservative request frequency during proof.
- Record the evidence date because undocumented providers may change without notice.

## Implementation checklist

- [x] Confirm Phase 1 PR is approved/merged.
- [x] Define reproducible proof commands that default to read-only and no fixture write.
- [x] Run the guarded local `curl_cffi` SofaScore proof for both season endpoints and event `16393687`.
- [ ] Probe SofaScore from the deployment runtime.
- [x] Verify the user-supplied Currie Cup and URC IDs, seasons, teams, events, results, and available standings shapes.
- [ ] Complete deployment-runtime verification and close the remaining coverage gaps.
- [x] Probe ESPN competition IDs and overlap.
- [x] Capture and redact the supplied catalog, season, team, event, result, and Currie Cup standings evidence.
- [x] Record the remaining exceptional-state fixture gaps explicitly in the ADR.
- [x] Record numerical request budgets, timeouts, retries, and `Retry-After` behavior.
- [x] Write the provider ADR with pass/fail evidence and fallback recommendation.
- [x] Leave the master provider matrix unchanged because no provider was approved.
- [x] Run fixture integrity and secret scans.

## Test scenarios and commands

- Recorded fixtures parse as JSON and contain no authorization values.
- Every required state has an evidence file or an explicit coverage gap in the ADR.
- Re-running read-only proof commands does not modify fixtures.
- Intentional `--write` is required to update evidence.
- Production-runtime and local response differences are documented.

Required repository verification:

```bash
npm run typecheck
npm test
npm run build
```

No database reset is required because Phase 2 owns no migration.

## Rollback

Remove only Phase 2 proof scripts/fixtures/ADR changes and restore the master provider matrix. No database or application rollback is required.

## Exit gate

- One current-data provider is explicitly approved.
- Currie Cup and URC identifiers and coverage are evidenced.
- Fixture, result, team, season, and standings shapes are recorded and redacted.
- Numerical request/timeout/retry policy is decision-complete.
- ESPN coverage is either evidenced or explicitly unavailable.
- No canonical write or implementation work occurred.
- Work stops for user review, testing, and the Phase 2 PR.
