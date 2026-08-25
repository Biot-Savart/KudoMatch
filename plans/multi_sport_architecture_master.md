# Multi-Sport Architecture Master Specification

- Status: approved direction; implementation is split across Phases 11–15.
- Environment: KudoMatch is pre-production. Application data and the current public schema may be discarded and recreated. Supabase Auth configuration is preserved unless separately approved for reset.

## Purpose

This document is the architectural source of truth for moving KudoMatch from a football-shaped predictor to a multi-sport event and prediction-market platform. It records cross-phase decisions and invariants. Implementation details and acceptance criteria live in the linked phase documents.

## Implementation documents

| Phase | Outcome | Document |
| --- | --- | --- |
| 11 | Clean sports catalog, competition editions, competitors, events, provider references, and database baseline | [Phase 11: Multi-Sport Core Schema](phase_11_multi_sport_core_schema.md) |
| 12 | Prediction markets, immutable scoring rules, result settlement, and fair pool scoring | [Phase 12: Prediction Markets, Scoring, and Pools](phase_12_prediction_markets_scoring_and_pools.md) |
| 13 | Full application refactor from matches to events/markets with football feature parity | [Phase 13: Application Event-Model Refactor](phase_13_application_event_model_refactor.md) |
| 14 | Provider ADR, canonical ingestion, football adapter migration, and Rugby Union data integration | [Phase 14: Provider Ingestion and Rugby Data](phase_14_provider_ingestion_and_rugby_data.md) |
| 15 | Rugby-specific UX, competition rollout, disposable test reset, and release candidate | [Phase 15: Rugby Experience and Release](phase_15_rugby_experience_and_release.md) |

Phases are dependency ordered. A phase may begin only when the preceding phase's exit gate passes, unless work is isolated on a branch and does not assume unfinished interfaces.

```mermaid
flowchart LR
    P11[Phase 11<br/>Core schema] --> P12[Phase 12<br/>Markets, scoring, pools]
    P12 --> P13[Phase 13<br/>Application refactor]
    P13 --> P14[Phase 14<br/>Provider ingestion]
    P14 --> P15[Phase 15<br/>Rugby UX and release]
```

## Core domain model

```text
sport
└── competition
    └── competition edition / season
        ├── competitors
        └── events
            ├── event competitors
            ├── prediction markets
            │   ├── user predictions
            │   └── market results
            └── immutable scoring rulesets
```

Football and Rugby Union launch with a `team_scoreline` market. Future sports may add `set_scoreline`, `winner_margin`, `ranked_finish`, or other reviewed market kinds without replacing the catalog, event, pool, provider, ownership, or settlement layers.

## Locked decisions

| Area | Decision |
| --- | --- |
| Migration strategy | Replace the current application migrations with a clean, replayable baseline. Git history retains the old implementation. |
| Database schemas | `public` contains Data API entities plus server-operated tables that must be reachable through Supabase JS; operational tables receive RLS and no client grants. `private` contains trigger-only helpers and audit data that PostgREST does not need to access directly. |
| Primary keys | New domain tables use `bigint generated always as identity`; Supabase user references remain UUIDs. Application/domain types serialize bigint IDs as strings at the JavaScript boundary. |
| Sport identity | Stable text slugs such as `football` and `rugby-union`. |
| Competition lifecycle | Stable competition and yearly/seasonal edition are separate entities. |
| Participants | One competitor model supports `team`, `person`, and `constructor`; events attach competitors by ordered slots and optional roles. |
| Predictions/results | Common rows use strictly validated JSONB payloads represented as TypeScript discriminated unions. Each event market snapshots a payload-schema version independently of its scoring-ruleset version; redundant selection/result-kind columns are not stored. |
| Scoring | Event markets reference immutable rulesets. Persisted awards are settled by PostgreSQL; TypeScript mirrors evaluation for previews. |
| Cross-sport fairness | Every settlement stores raw points and normalized basis points from 0 to 10,000. All-sport pools require normalized scoring and weight each eligible market equally; they do not equalize sports that schedule different numbers of markets. |
| Provider identity | Canonical entities are separate from one-or-many provider external references. |
| Mock data | Simulation is explicit and limited to local/test workflows. Provider failure never fabricates results. |
| Profile scores | Settled predictions are authoritative. `profiles` does not store an independently maintained global total. |

## Cross-phase invariants

### Data integrity

- All status, kind, and scope text fields have explicit check constraints.
- All timestamps use `timestamptz`; scoreline values are non-negative integers.
- Every foreign key used for joins, cascades, or RLS has a supporting index.
- Cross-table validation rejects a competitor from a different sport, an incompatible ruleset, invalid event participants, or a market/result payload mismatch.
- Unknown market kinds, payload shapes, evaluator keys, and versions fail closed.
- Payload-schema versions and scoring-ruleset versions evolve independently and remain readable for historical rows.
- No arbitrary JSON is trusted without immutable database validation and a matching TypeScript type guard.
- Cross-row invariants use named deferred constraint triggers where rows must be inserted in more than one step; ordinary column invariants use check/foreign-key constraints.
- Postponement never silently reopens a locked market. Reopening requires an explicit audited market replacement or administration operation.

### Security

- Every table in an exposed schema has RLS and explicit privileges.
- Catalog reads are intentionally public; mutations are not.
- Users can mutate only their own predictions before market lock.
- Client roles receive column-level mutation privileges only for user-editable prediction fields; settlement columns remain server-only even when RLS permits the row.
- Other users' selections remain hidden until lock; private-pool access adds membership/visibility checks.
- Community aggregates are also withheld before lock because small counts can reveal individual selections.
- Views use `security_invoker = true` where supported.
- Default `PUBLIC` function execution is revoked.
- Security-definer helpers are exceptional. Internal helpers live in `private`; a client-callable exposed RPC is allowed only when the Data API operation genuinely requires privilege elevation, and must use an empty search path, validate `auth.uid()` and authorization internally, revoke default `PUBLIC`/anon execute, and grant only the intended role/signature.
- Service-role and provider secrets never appear in `NEXT_PUBLIC_*` variables or browser bundles.

### Scoring and auditability

- Rulesets become immutable when referenced; a change creates a new version.
- Semantic tier codes—not point values—drive explanations, statistics, and tie-breaks.
- Provisional results may power previews but never settle predictions.
- Each final result revision is immutable in history and can reproduce its settlement.
- Replaying the same result revision is a no-op; corrections affect only the relevant market.
- Voiding retains predictions and audit rows while removing competitive awards.
- Pending, settled-zero, and void predictions remain distinguishable; a genuine miss is not represented as unscored.

### Ingestion

- Adapters parse provider payloads as `unknown` and return canonical DTOs; they do not write to Supabase.
- The orchestration layer owns external-reference resolution, validation, batching, idempotency, quarantine, and summaries.
- Production resolution never uses fuzzy team-name matching.
- A provider outage or zero-update response leaves canonical results untouched.
- Dry run is read-only; simulation refuses to run under production settings.
- Ingestion modules are server-only and overlapping provider/edition runs use a non-blocking coordination lock or equivalent single-flight guard.

### Pool eligibility

- A pool never receives points for markets that locked before the pool's scoring start.
- A member never receives pool points for a market that locked before that member joined.
- Leaving, rejoining, and administrative membership changes have explicit, tested score-history semantics.

## Product capabilities that must survive the reset

Data preservation is unnecessary, but functional parity is mandatory:

- authentication-linked profiles and profile editing;
- event browsing, rounds, prediction submission, and lock enforcement;
- scoring, explanations, statistics, correction, and recalculation;
- pools, invitations, membership, standings, picks, head-to-head, simulation, and chat;
- notifications, push subscriptions, kickoff reminders, and weekly digests;
- Realtime invalidation, cron setup, database maintenance, seeds, imports, and score synchronization.

The application must not hide stale football assumptions behind compatibility views named `matches`, `teams`, or `tournaments`. Old queries are rewritten and allowed to fail loudly until they are migrated.

## Global verification gates

Every phase defines narrower tests. Before Phase 15 is complete, the full pipeline is:

```bash
npx supabase db reset --local
npx supabase test db --local
npm run typecheck
npm test
npm run build
```

Database types are regenerated and reviewed after the final schema change. Supabase security and performance advisors run before resetting the linked disposable test project.

## Operational guardrail

Even though application data is disposable, a linked reset requires an immediate, explicit verification of the exact Supabase project reference and its non-production classification. Never infer the target from a cached CLI link.

## Future-sport extension contract

Adding a future sport should require only genuinely sport-specific work:

1. sport, competition, edition, and competitor seed/import data;
2. provider adapter and external-reference mapping;
3. a new payload/result validator only if existing market kinds do not fit;
4. a versioned PostgreSQL evaluator and TypeScript mirror;
5. immutable ruleset/tier data and shared scoring contracts;
6. a market-specific prediction form and event renderer;
7. ingestion, RLS, scoring, pool, simulator, and accessibility tests.

It must not require another rewrite of profiles, pools, competitions, editions, events, provider identities, prediction ownership, settlement metadata, or leaderboard scoping.
