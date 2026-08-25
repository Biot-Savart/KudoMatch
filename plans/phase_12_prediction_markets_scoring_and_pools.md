# Phase 12: Prediction Markets, Scoring, and Pools

- Status: planned.
- Depends on: [Phase 11: Multi-Sport Core Schema](phase_11_multi_sport_core_schema.md).
- Unlocks: [Phase 13: Application Event-Model Refactor](phase_13_application_event_model_refactor.md).

## Outcome

Add the sport-neutral prediction-market layer, immutable versioned scoring, result correction history, audited settlement, and fair scoped pools. Football and Rugby Union receive complete `team_scoreline` rulesets with PostgreSQL/TypeScript parity contracts.

Phase 12 is database- and domain-engine focused. It does not yet complete the application UI refactor or live provider ingestion.

## Scope

### Included

- Scoring rulesets and semantic tiers.
- Event markets with open/lock/settled lifecycle.
- Strictly validated selection/result JSONB payloads.
- Predictions, results, immutable result history, settlement, and correction.
- Raw and normalized points.
- Pools, members, chat, scopes, invite codes, and leaderboard APIs.
- RLS, grants, private-pool privacy, and pre-lock secrecy tests.
- Shared PostgreSQL/TypeScript scoring contracts.

### Excluded

- Refactoring pages/components/query hooks: Phase 13.
- Provider adapters and live result ingestion: Phase 14.
- Rugby visual controls and competition launch: Phase 15.

## 1. Migration ownership

Generate these migrations with `npx supabase migration new <name>`:

1. `prediction_markets_results_and_scoring`
2. `pools_chat_and_standings`
3. `prediction_pool_rls_views_and_grants`

Keep creation, RLS, grants, and required helper functions reviewable. Never leave a newly exposed table unrestricted between migrations applied to a shared environment.

## 2. Immutable scoring rulesets

### `public.scoring_rulesets`

- identity primary key;
- sport slug;
- checked market kind, initially `team_scoreline`;
- evaluator key and positive version;
- positive `max_raw_points`;
- strictly validated evaluator config JSONB;
- strictly validated UI config JSONB containing score limits, increments, presets, units, labels, and examples;
- active flag and timestamps;
- unique `(sport_slug, market_kind, version)`.

Once an event market references a ruleset, block update/delete. Changes create a new version.

Validate that `max_raw_points` equals the highest tier point value and that every evaluator-returnable tier exists. Ruleset activation fails if config, UI config, tiers, or maximum points are incomplete.

### `public.scoring_rule_tiers`

- composite primary key `(ruleset_id, tier_code)`;
- non-negative raw points;
- rank order, label, description, and optional example;
- unique rank order within a ruleset.

All statistics, explanations, exact counts, and tie-breaks use the semantic tier code, never a point number.

## 3. Event markets

### `public.event_markets`

- identity primary key and event foreign key;
- checked market kind;
- positive payload-schema version;
- immutable ruleset foreign key;
- positive `sequence_no` and `is_current` flag;
- `opens_at` and `locks_at`;
- checked status: `draft`, `open`, `locked`, `settled`, `void`;
- timestamps;
- unique `(event_id, market_kind, sequence_no)` and one current market per `(event_id, market_kind)` through a partial unique index.

Enforce:

- `opens_at < locks_at <= event.starts_at`;
- ruleset sport equals the event edition's sport;
- ruleset market kind equals event market kind;
- a `team_scoreline` market has exactly two event competitors in slots 1/2 with roles `home`/`away`;
- ruleset and market identity cannot change after the market opens;
- status transitions cannot reopen a settled/void market in place.

Postponement rules are explicit:

- before lock, rescheduling may move `starts_at` and `locks_at` together through a validated operation;
- after lock, postponement leaves the market locked and preserves pick secrecy;
- reopening requires voiding the old market and creating a new higher `sequence_no`, so old picks and audit history remain intact.

Index `(status, locks_at)` for lock/settlement work only if confirmed by `EXPLAIN`.

## 4. Predictions and payload validation

### `public.predictions`

- identity primary key;
- user UUID referencing profiles;
- event market foreign key;
- validated `selection jsonb not null`;
- checked settlement status: `pending`, `settled`, `void`;
- nullable settlement snapshot: ruleset ID, result revision, tier code, raw points, normalized basis points, settled timestamp;
- created/updated timestamps;
- unique `(user_id, event_market_id)`.

Initial selection shape:

```json
{
  "kind": "team_scoreline",
  "version": 1,
  "home": 24,
  "away": 17
}
```

Implement immutable `private` shape-validation functions for payload-local checks and a separate trigger for market/ruleset-dependent checks. Check constraints must not query mutable tables. Together they reject:

- missing or extra keys;
- unknown kind;
- non-integer, negative, or ruleset-out-of-range scores;
- payload `kind`/`version` not matching the authoritative event market kind and payload-schema version;
- client-supplied or client-modified settlement fields.

Apply conservative payload-size limits before deeper validation so clients cannot store oversized JSON objects. Ruleset/UI config and pool-message lengths also receive explicit bounds.

Do not store redundant selection-kind/version columns. `event_markets.market_kind` and `payload_schema_version` are authoritative, and the payload validator requires both discriminators to match.

Settlement state semantics:

- `pending`: all award fields are null;
- `settled`: ruleset, result revision, tier, raw points, normalized points, and timestamp are all present—`miss` is a real settled tier with zero points;
- `void`: competitive award/tier fields are null while the selection and audit history remain.

Do not add a blanket JSONB GIN index. Add expression indexes only when a measured query filters by a payload value.

### Prediction lock behavior

- Owners insert/update/delete only while market status is `open` and current time is before `locks_at`.
- `user_id` and `event_market_id` are immutable after insert.
- Owners always read their own selection.
- Other selections become readable only after lock, subject to pool privacy.
- Community distributions and top-pick aggregates remain unavailable before lock; aggregation is not treated as safe when a small cohort could reveal an individual's selection.
- Settlement updates bypass user-edit validation only through isolated server-side columns/functions, not through a broad trigger shortcut.
- Authenticated roles receive column-level insert/update privileges only for the user-editable identity/selection fields; settlement columns have no client mutation grant.

All lock decisions use database `now()` in the same transaction as the write. Client clocks and UI state are advisory only.

## 5. Results, history, and settlement

### `public.market_results`

- event market primary key;
- strictly validated result payload whose `kind` must match the authoritative event market kind;
- positive revision;
- checked status: `provisional`, `final`, `void`;
- checked source kind (`provider`, `manual`) plus source reference where applicable;
- source priority snapshot used to prevent lower-authority regressions;
- finalized and created/updated timestamps.

Initial result shape:

```json
{
  "kind": "team_scoreline",
  "version": 1,
  "home": 27,
  "away": 22
}
```

Only server-side ingestion/administration writes results.

Manual administrative corrections outrank provider data. Provider precedence is explicit per competition/edition; a lower-priority source cannot overwrite a higher-priority final result. History records the source kind, reference, and priority used for every revision.

Validate result/event/market state together: provisional results belong to live events and do not settle; final results require a completed/officially awarded event and move the market to settled; cancelled/abandoned events use an explicit void result unless an official awarded final result is supplied. A final score cannot coexist with a scheduled market.

Do not store a redundant result-kind column. Result writes pass through one database-controlled path: a trigger or tightly scoped server operation validates revision monotonicity, appends history, updates the current snapshot, and settles/voids predictions atomically. Direct client writes and ad hoc history inserts are not granted.

### `private.market_result_history`

Append an immutable row for every revision with market, revision, payload, status, source, and recorded timestamp. `market_results` is the current snapshot; history reproduces prior settlements.

### `private.settlement_runs`

Record market, result revision, ruleset, affected rows, duration, status, and sanitized errors for every settlement attempt.

### Evaluator contract

The private evaluator receives evaluator key/version/config plus validated selection and result payloads, then returns a tier code. Tier rows supply raw points. Normalized points are:

```text
round(raw_points * 10000 / max_raw_points)
```

Requirements:

- deterministic and free of table lookups after inputs are supplied;
- unknown evaluator/version/kind fails closed;
- final results settle; provisional results only support previews;
- same revision retry is a no-op;
- correction re-settles only that market;
- void removes competitive awards but retains picks/history;
- settlement is a short set-based transaction with no network calls;
- lock the result/market row so corrections cannot interleave.

Use a transaction-scoped row/advisory lock keyed by event market for correction coordination. Lock acquisition, history append, current-result update, and settlement occur in one short transaction with a local statement timeout.

## 6. Football and Rugby Union contracts

### Football scoreline v1

| Result | Tier | Raw points |
| --- | --- | ---: |
| Exact score | `exact_score` | 3 |
| Correct outcome and exact goal difference | `exact_margin` | 2 |
| Correct outcome | `outcome` | 1 |
| Wrong outcome | `miss` | 0 |

### Rugby Union scoreline v1

| Result | Tier | Raw points |
| --- | --- | ---: |
| Exact score | `exact_score` | 6 |
| Correct outcome and exact signed margin | `exact_margin` | 4 |
| Correct outcome and signed-margin error <= 5 | `close_margin` | 3 |
| Correct home win, away win, or draw | `outcome` | 2 |
| Wrong outcome | `miss` | 0 |

Signed margin is `home - away`. A non-exact predicted draw against an actual draw receives `exact_margin`. Contract cases cover home/away/draw outcomes, zeroes, limits, and errors of exactly 5 and 6.

Create `tests/contracts/scoring-cases.json` and run identical cases against the PostgreSQL evaluator and TypeScript mirror.

## 7. Pools and scoring modes

Recreate `public.pools`, `public.pool_members`, and `public.pool_messages` with corrected constraints, indexes, RLS, invite generation, and creator membership.

`pools.scoring_starts_at timestamptz not null` defines the first eligible market lock. Creating a pool does not retroactively award results from markets that already locked.

Model membership as time-bounded episodes rather than deleting history:

- `pool_members` uses an identity primary key plus pool, user, role, `joined_at`, and nullable `left_at`;
- a partial unique index permits only one active membership per `(pool_id, user_id)`;
- leaving closes the active episode; rejoining creates a new episode;
- current rosters require `left_at is null`;
- a current member's score includes markets whose lock timestamp falls within any of that member's membership episodes and at/after the pool scoring start;
- creator/admin role transitions and creator departure have explicit guarded operations.

### Pool scopes

`pools.scope_kind` supports:

- `all_sports`: no scope foreign key;
- `sport`: exactly one sport slug;
- `competition`: exactly one competition ID;
- `edition`: exactly one edition ID.

A check constraint enforces the exact nullable-FK shape.

### Scoring modes

- `raw`: allowed for sport, competition, and edition scopes;
- `normalized`: allowed for all scopes and mandatory for `all_sports`.

One normalized market is worth at most 10,000 basis points, preventing rugby's 6-point maximum from outweighing football's 3-point maximum merely because of its scale. This weights each eligible market equally; a sport with more scheduled markets still contributes more total opportunities. The UI must disclose that rule rather than implying equal weight per sport.

### Eligible markets

Implement one reusable security-invoker relation/function that derives markets eligible for a pool. It powers:

- leaderboard totals;
- picks matrix;
- head-to-head;
- what-if simulation inputs;
- round availability;
- community insights;
- notification scoping.

`get_pool_leaderboard` returns displayed score, raw and normalized totals, exact-tier count, submitted/settled counts, and rank. Rank by displayed score, exact-tier count, then the current active membership's joined timestamp.

Eligible-market/member scoring must enforce both temporal boundaries:

- `market.locks_at >= pool.scoring_starts_at`;
- the lock falls inside the half-open interval `[joined_at, left_at)` for one membership episode, or at/after `joined_at` when `left_at` is null.

Pool/member timestamps are assigned from database time, not browser or application-host clocks.

### Required access-path indexes

Confirm with `EXPLAIN`, but plan for:

- predictions by `(event_market_id, user_id)` for settlement/statistics in addition to the user-first uniqueness constraint;
- event markets by `(event_id, is_current)` and by lock/status where the worker query uses them;
- pool membership episodes by `(pool_id, user_id, joined_at, left_at)` plus partial active user/pool lookups;
- pool scope foreign keys with partial indexes where non-null;
- pool messages by `(pool_id, created_at, id)` for keyset pagination.

Do not create redundant indexes already covered by a primary, unique, or leftmost composite prefix.

## 8. RLS and function security

- Catalog/results remain intentionally readable according to Phase 11 policy.
- Rulesets, tiers, and markets are client-readable only when their sport/event is published; inactive Rugby Union seed data remains hidden until activation.
- Prediction writes use ownership, open status, and time checks.
- Pool members see private-pool data; guessed private pool IDs reveal nothing.
- Clients cannot write membership timestamps, roles, or scoring windows directly. Join, leave, rejoin, promotion, and removal use narrowly granted RPCs that derive timestamps and authorize the transition.
- Individual selections remain hidden before lock.
- Pre-lock community aggregate RPCs return no cohort data.
- Chat reads/inserts require membership; users delete only their own messages unless a reviewed moderation policy says otherwise.
- Prefer security-invoker views/functions.
- Revoke default function execute privileges and grant RPCs explicitly.
- Internal security-definer helpers live in `private`. An exposed join-by-code or membership-transition RPC may use security definer only when necessary to inspect protected invite/scope rows; it must use `set search_path = ''`, validate `auth.uid()` and the exact transition internally, revoke `PUBLIC`/anon execute, grant only `authenticated`, and have abuse/guessed-code tests.

## 9. Points summaries

Do not restore `profiles.total_points`. Add a score-summary RPC/view that aggregates indexed settled predictions by user, sport, competition, and edition and returns raw plus normalized totals.

Only add a rebuildable projection table after production-like `EXPLAIN ANALYZE` tests demonstrate a need. Settled predictions remain authoritative.

## 10. Tests

### Database

- Ruleset and tier uniqueness, immutability, points bounds, and payload-config validation.
- Event/ruleset sport and market-kind compatibility.
- Team-scoreline participant and time constraints.
- Prediction payload exact shape, bounds, ownership, immutability, and lock behavior.
- Result history append-only behavior and revision monotonicity.
- Result/event/market state compatibility, including awarded and abandoned cases.
- Final/provisional/void settlement semantics and concurrent correction safety.
- Pending versus settled-zero versus void distinction.
- Pool scope shapes, all-sport raw-mode rejection, scoring-start boundary, and membership-episode eligibility.
- Postponement before/after lock and void-and-replace market reopening.
- Private-pool, pre-lock, RPC-execute, and chat authorization.

### Scoring parity

- All football/rugby tiers and boundaries.
- PostgreSQL and TypeScript equality for tier, raw points, and normalized points.
- Idempotent retry, correction, and void cases.
- Exact counts use `tier_code = 'exact_score'`, never raw points.

## 11. Implementation checklist

- [ ] Generate Phase 12 migrations with the CLI.
- [ ] Create rulesets, tiers, sequenced markets, predictions, results, history, settlement audit, and validators.
- [ ] Implement football/rugby PostgreSQL evaluators and TypeScript mirrors.
- [ ] Add shared scoring contracts.
- [ ] Recreate pools, membership episodes, messages, scopes, eligible-market relation, leaderboard, and score summaries.
- [ ] Add indexes, RLS, grants, and pgTAP coverage.
- [ ] Extend deterministic seeds with rulesets, markets, predictions, results, and all scope/mode pool shapes.
- [ ] Regenerate database types.

## 12. Verification

```bash
npx supabase db reset --local
npx supabase test db --local
npm run typecheck
npm test
npm run build
```

## Exit gate

- Clean reset creates and seeds the complete market/scoring/pool domain.
- PostgreSQL and TypeScript scoring contracts are identical.
- Corrections, voids, and retries are deterministic and audited.
- Pool scope, scoring-start, membership-period, and normalized scoring rules are database-enforced.
- Prediction secrecy and private-pool authorization pass role-based tests.
- Generated types, unit tests, and build pass.
