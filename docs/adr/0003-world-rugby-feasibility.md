# ADR 0003: World Rugby Feasibility Spike

- **Status:** Accepted — no-go for automated production integration
- **Date:** 2026-09-03
- **Scope:** International Rugby Union fixtures/results verification and future provider priority
- **Evidence:** [`World Rugby Phase 8 Evidence Report`](../rugby-provider-proof/world-rugby-phase-8-2026-09-03.md)

## Decision

Do not implement, register, enable, or prioritize a World Rugby production adapter at this time.

World Rugby is technically viable as a structured read source: limited public RIMS endpoints returned stable event, match, team, competition, timestamp, status, score, standings, and ranking fields. A Rugby World Cup 2023 final also matched ESPN and API-Sports on teams, date, status, and score.

The decision is no-go because permitted automated server-side use is not established. The official [World Rugby terms and conditions](https://www.world.rugby/terms-and-conditions) prohibit using a computer program to collect or aggregate site material, while this project has no documented provider agreement, API terms, SLA, or issued World Rugby credential. Public endpoint accessibility does not override that restriction.

## Consequences

- Production provider order remains SofaScore → ESPN → API-Sports for every operation.
- No `world-rugby` provider registration, competition setting, migration, canonical/source write, or application behavior changes are made.
- The evidence supports a future permission-led reassessment, not current automated ingestion.
- World Rugby rankings remain out of scope and are not imported.

## If permission is later obtained

A new separately approved implementation phase must first record:

1. written permission covering automated server-side access, storage, and commercial use;
2. authenticated API contract, stable identifiers, versioning, status/result semantics, coverage, rate policy, and SLA;
3. deployment-runtime proof and sanitized fixtures for scheduled, completed, postponed/cancelled, empty, malformed, timeout, and rate-limited responses;
4. complete source-ledger mappings and cross-provider comparison for international scope;
5. security, privacy, licensing, operational budget, rollback, and competition-specific release gates.

Only after those gates pass may a future phase propose international priority `World Rugby → SofaScore → ESPN → API-Sports`. Club rugby remains excluded from that proposal.

## Rollback

Remove the Phase 8 proof tool, evidence report, and this ADR. No database, deployment, provider setting, or application rollback is required because none was changed.
