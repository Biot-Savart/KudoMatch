# Phase 8: World Rugby Feasibility Spike

- Status: complete; no-go for automated production integration.
- Depends on: [Phase 7: Standings, Operations, Admin, and Release](07_standings_operations_admin_and_release.md) approved and merged.
- Unlocks: no implementation automatically; an approved result requires a new separately planned phase.
- Migration impact: none.

## Outcome

Produce an evidence-backed go/no-go decision on World Rugby as a future international fixtures/results/rankings source. Phase 8 does not implement or enable a production adapter.

## Included scope

- Investigate World Rugby fixture, result, competition, team, and ranking feeds.
- Verify authentication, permitted use, access stability, identifiers, timestamps, status/result semantics, rate behavior, and historical/current international coverage.
- Focus evidence on Springboks, major test matches, Rugby Championship, Nations Championship where applicable, Rugby World Cup, and British & Irish Lions fixtures where applicable.
- Compare overlapping events/results with the approved current provider, ESPN, and API-Sports.
- Capture permitted, redacted recorded evidence.
- Produce a go/no-go ADR and proposed future provider-priority changes.

## Excluded scope

- `WorldRugbyAdapter` implementation.
- Provider registration or competition settings.
- Database migrations or canonical/source writes.
- Production provider priority changes.
- Rankings ingestion.
- Additional international UI or application behavior.
- Automatic promotion based only on successful endpoint discovery.

## Interfaces and schema owned

None. This phase may define a proposed adapter/capability mapping in the ADR, but no runtime interface or schema changes are implemented.

Evidence artifacts may include:

- read-only proof script;
- sanitized endpoint/coverage report;
- redacted fixtures when permitted;
- cross-provider comparison report;
- ADR with go/no-go and implementation prerequisites.

## Investigation and decision flow

```text
endpoint/feed discovery
        ↓
authentication + permitted use
        ↓
stable IDs + coverage + schema + rate behavior
        ↓
cross-provider comparison
        ↓
go/no-go ADR
        ├── no-go → retain existing provider order
        └── go → propose a new implementation phase
```

A go decision requires stable provider/team/competition/event identities, reliable relevant coverage, permitted automated server-side access, testable responses, and an operational request policy. Rankings-only suitability is not enough to approve match ingestion.

## Failure behavior

- Failed/blocked/undocumented endpoints are recorded as evidence, not bypassed.
- Partial coverage is scoped precisely and never generalized.
- Provider disagreement remains a comparison result; Phase 8 cannot alter canonical events/results.
- No evidence probe writes to Supabase or modifies provider priority.

## Security requirements

- Use server-side credentials only when legitimately issued and permitted.
- Never bypass access controls or scrape prohibited surfaces.
- Redact authorization, account, and sensitive response data.
- Default proof commands to read-only; fixture writes require explicit opt-in.
- Do not store real user/provider secrets in fixtures, ADRs, logs, or command output.

## Implementation checklist

- [x] Confirm Phase 7 is complete by user direction; deployment evidence remains deferred.
- [x] Define permitted read-only proof procedure. (Fixed six-request proof tool is permission-gated and metadata-only.)
- [x] Verify relevant endpoint/feed availability and authentication. (Limited public GET probes returned structured HTTP 200 responses without credentials; this does not establish permission.)
- [x] Record stable identities, coverage, schemas, and rate behavior. (RWC 2023, Nations Championship 2026, Rugby Championship 2023, Lions 2025 catalog coverage, rankings, IDs, timestamps, and observed rate headers are recorded.)
- [x] Compare overlapping Springbok/international events/results. (RWC 2023 final agrees across World Rugby, ESPN, and API-Sports; SofaScore international overlap remains an explicit gap.)
- [x] Capture and redact evidence only where permitted. (Only sanitized metadata is checked in; no raw provider payloads or credentials are stored.)
- [x] Write go/no-go ADR with explicit limitations. ([ADR 0003](../../docs/adr/0003-world-rugby-feasibility.md) records no-go.)
- [x] Propose future capability/priority changes without applying them. (Future international-only priority is proposed in the ADR and remains inactive.)
- [x] Run evidence integrity and secret scans. (Probe refuses without explicit confirmation; repository secret scan and verification commands are recorded below.)

## Test scenarios and commands

- Proof is read-only by default.
- Recorded evidence parses and contains no secrets.
- Coverage claims link to dated evidence.
- Overlap comparison distinguishes agreement, disagreement, and missing coverage.
- Re-running the default proof does not modify repository artifacts.

Required repository verification:

```bash
npm run typecheck
npm test
npm run build
```

No database reset is required because Phase 8 owns no migration.

Evidence integrity checks completed:

```bash
npm run provider:proof:world-rugby
git diff --check
```

The proof command exits with code 2 without `--confirm-permitted-access` and makes no network request. A targeted secret scan found no suspicious credential literals in the Phase 8 artifacts.

## Rollback

Remove only the Phase 8 proof/evidence/ADR changes. Production configuration, database state, and provider priority remain unchanged.

## Exit gate

- World Rugby receives a reviewed go/no-go ADR with dated evidence.
- Coverage, identifiers, access, permitted use, schemas, and rate behavior are explicit.
- Cross-provider comparison is complete for the investigated scope.
- No production adapter, schema, or provider priority changed.
- A go decision points to a new separately approved implementation phase.
- Work stops for user review, testing, and the Phase 8 PR.

Phase 8 outcome: the feasibility spike is complete with a no-go decision. World Rugby is not added to production provider behavior. The remaining permission, deployment, SofaScore-overlap, and broader historical-coverage items are prerequisites for any future reconsideration.
