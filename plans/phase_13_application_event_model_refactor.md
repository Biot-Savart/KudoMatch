# Phase 13: Application Event-Model Refactor

- Status: planned.
- Depends on: [Phase 12: Prediction Markets, Scoring, and Pools](phase_12_prediction_markets_scoring_and_pools.md).
- Unlocks: [Phase 14: Provider Ingestion and Rugby Data](phase_14_provider_ingestion_and_rugby_data.md).

## Outcome

Refactor the Next.js application, scripts, notifications, and Realtime behavior from football-shaped tables to the new event/market domain while restoring complete football feature parity.

Phase 13 deliberately uses deterministic seeded football data. Live provider migration is Phase 14, and rugby-specific experience is Phase 15.

## Scope

### Included

- Generated database types and domain/UI type separation.
- Event-, competitor-, edition-, and market-aware queries.
- TanStack Query key redesign and URL-backed filtering.
- Generic event-card and prediction-form shells with football scoreline renderers.
- Scoring explanations, statistics, simulator, pools, picks, and head-to-head.
- Profiles and score summaries.
- Chat, notifications, reminders, digests, Realtime, and cron parity.
- Removal of stale `matches`, `teams`, `tournaments`, and profile total-points code.

### Excluded

- Live football/rugby provider integration: Phase 14.
- Rugby input controls and visual rollout: Phase 15.

## Migration ownership

Generate any remaining database API/automation migrations with the CLI:

1. `notifications_automation_and_realtime`
2. `application_api_views_and_rpcs`

Tables receive RLS and privileges in the same migration that creates them. The second migration contains security-invoker read models/RPCs needed by the refactored application, not compatibility views for legacy tables.

## 1. Type architecture

Generate the database schema into `types/database.ts`. Keep application-facing models in `types/index.ts` so component contracts do not mirror raw joined Supabase rows.

Introduce:

- `SportSlug` and `Sport`;
- `Competition` and `CompetitionEdition`;
- `Competitor` and `EventCompetitor`;
- `PredictableEvent` with ordered participants and markets;
- discriminated `PredictionMarket`, `PredictionSelection`, and `MarketResult` unions;
- `TeamScorelineSelection` and `TeamScorelineResult`;
- `ScoringRuleset`, `ScoringTier`, and `SettlementAward`;
- discriminated pool scope/mode types that cannot represent invalid combinations.

Provider payload types remain inside adapters and never leak into UI/domain types.

Market payload unions discriminate on both `kind` and `version`. Scoring ruleset version is a separate field and must never be used as a proxy for payload shape.

Normalize all database bigint identities to strings in row mappers. Domain components, URL parameters, query keys, and RPC arguments use the string representation consistently and never coerce IDs for arithmetic.

Remove or rename legacy `Tournament`, `Team`, `Match`, and football-only prediction interfaces once all imports are migrated. Do not preserve ambiguous aliases indefinitely.

## 2. Query layer

Create focused query modules such as:

```text
lib/queries/
├── sports.ts
├── competitions.ts
├── events.ts
├── markets.ts
├── predictions.ts
├── scoring.ts
├── pools.ts
├── chat.ts
└── notifications.ts
```

Requirements:

- central row-to-domain mapping with explicit null/error handling;
- event queries return ordered competitors and active markets;
- ordinary prediction surfaces select only `is_current` markets while audit/history surfaces can address prior market sequences explicitly;
- predictions address `event_market_id`, not event/match IDs;
- pool surfaces use the database's eligible-market relation;
- score summaries replace reads of `profiles.total_points`;
- matchday helpers become edition-aware round/stage helpers;
- no implicit Premier League, football, matchday, or home/away defaults below the `team_scoreline` renderer.

Avoid N+1 loading. Event-feed queries return events, ordered competitors, current markets, ruleset display metadata, and the current user's prediction in one bounded RPC/query or a fixed number of batched queries—not one request per event.

Use keyset pagination ordered by `(starts_at, id)` for long event feeds. The cursor contains both values, page size is bounded, and cancelled/postponed rows cannot cause duplicates or gaps. Pool chat uses `(created_at, id)`. Pool leaderboards use deterministic keyset pagination once their expected size exceeds the agreed small-list threshold.

## 3. TanStack Query and URL state

Every query key includes the dimensions that change its result:

- sport slug;
- competition ID;
- edition ID;
- round/stage;
- event market kind;
- pool ID where relevant.

Use URL-backed filters such as:

```text
?sport=football&edition=<id>&round=<value>
```

Browser back/forward, deep links, and refresh must preserve selection. Switching dimensions must not show stale cached events, rounds, presets, rules, or pool data.

## 4. Event and prediction components

### Component shape

Refactor:

- `MatchCard` into an `EventCard` shell;
- football layout into `TeamScorelineEventCard`;
- `PredictionDrawer` into a market-aware shell;
- football input into `TeamScorelinePredictionForm`.

The generic shell owns shared event time/status/competition behavior. The market renderer owns payload fields and presentation.

### Football parity

Football retains:

- home/away names and crests;
- `-1/+1` score entry and existing presets;
- kickoff lock state;
- exact/margin/outcome/miss explanations;
- optimistic submission and cache updates;
- completed/live/scheduled states;
- accessible error and success feedback.

All score limits, presets, units, tier copy, and examples come from typed ruleset UI config, not component constants.

## 5. Scoring surfaces

Update:

- `lib/utils/scoring.ts` into market-aware evaluator dispatch;
- scoring rules and score breakdown modals;
- community prediction statistics;
- what-if simulator;
- match/pool insights;
- exact-count and distribution labels.

Every caller passes market kind and ruleset version. No caller infers tier meaning from raw points. The TypeScript implementation runs the shared Phase 12 contract file.

The simulator uses normalized points when the pool uses normalized scoring and raw points otherwise.

## 6. Pools and social features

Refactor pool creation and pages around Phase 12 scope shapes:

- all sports;
- sport;
- competition;
- edition.

Display and explain raw versus normalized scoring. All-sport pools force normalized mode in both UI and database.

Update standings, picks matrix, head-to-head, simulator, insights, available rounds, and member score breakdowns to consume only eligible markets returned by the scoped database API.

Keep pool invitations, ownership/admin/member roles, leaving/deletion behavior, and chat functionality. Private pool pages must handle unauthorized/not-found responses without leaking existence or membership.

Display the pool scoring start and non-retroactive membership rule where users join or review standings. Leaving closes a membership episode; rejoining starts another. Standings include only markets that locked while the user had an active membership episode.

## 7. Profiles and navigation

Replace `profiles.total_points` reads in:

- navbar;
- home/dashboard;
- profile page;
- weekly digest;
- any leaderboard preview.

Use one score-summary query/RPC. Clearly distinguish sport-scoped raw totals from normalized all-sport totals; never label unlike values as one universal point figure.

## 8. Notifications and automation parity

Refactor kickoff reminders and weekly digests from `matches` to `events` and active event markets.

Requirements:

- upcoming reminders use event start/market lock timestamps;
- prediction-presence checks use event market IDs;
- reminders target only the current market sequence;
- cancelled/postponed/abandoned events behave explicitly;
- digest scoring uses settled predictions and correct pool scope;
- push subscription and notification-preference ownership policies remain intact;
- notification payload URLs use the new sport/edition/event routes.

When notification-preference tables are recreated, insert missing default rows for all existing profiles idempotently in addition to installing the new-profile trigger. A linked public-schema reset must not leave surviving Auth/profile users without preferences.

Recreate/update notification migrations, cron setup helpers, and maintenance functions as needed. Do not alter the protected `realtime` schema; configure publications through supported project/database mechanisms.

Schedule and unschedule jobs only through supported `pg_cron` functions; never insert/update `cron.job` directly. Keep cron endpoint credentials out of URLs and query parameters.

## 9. Realtime subscriptions

Replace global prediction subscriptions with the narrowest supported filters for the active market/pool. Invalidation targets query keys containing the same scope dimensions.

Cover:

- event/result changes;
- prediction settlement changes;
- pool membership and details;
- chat messages;
- notification preferences/subscriptions where applicable.

Avoid one unfiltered predictions channel invalidating every pool leaderboard.

Realtime payloads are invalidation signals, not authorization or score sources. Every invalidation refetches through the RLS-protected query/RPC, and subscriptions never expose pre-lock selections in client-readable payloads.

## 10. Scripts and developer workflows

Port schema-dependent scripts that do not require a live provider:

- score simulation, result resolution/correction, and recalculation;
- deterministic fixture/demo seeding;
- historic/demo prediction generation;
- database backup/reporting where still useful;
- kickoff reminders, digest, and cron setup.

Live import and score-sync scripts are redesigned in Phase 14. Until then they must fail with a clear unsupported message rather than write legacy tables.

## 11. Testing strategy

### Query and mapper tests

- Row-to-domain mapping for ordered competitors and market unions.
- Empty, partial, cancelled, postponed, and malformed-data states.
- Query keys include all scope dimensions.
- Pool and score-summary RPC error behavior.
- Keyset cursor stability, page boundaries, and fixed query-count/N+1 regression tests.
- Bigint database IDs mapping to stable string domain IDs.

### Component tests

- Event card and football scoreline form parity.
- Keyboard/mouse/touch entry, limits, optimistic submission, rollback, and lock behavior.
- Tier-aware rules/breakdown/insights and simulator calculations.
- Community aggregates hidden before lock and revealed/refetched only after lock.
- URL filters and cache isolation.
- Pool scope/mode forms and private-pool unauthorized states.
- Pool scoring-start and leave/rejoin membership-episode behavior.
- Loading, empty, offline/error, and accessible focus/label behavior.

### Feature parity tests

Create a checklist mapping every pre-reset feature to at least one automated or explicit smoke test:

- profiles;
- predictions and locking;
- pools, joins, leaving, standings, picks, H2H, simulator, chat;
- stats and scoring explanations;
- push preferences/subscriptions;
- reminders and weekly digests;
- Realtime invalidation;
- score simulation/correction workflows.

## 12. Implementation checklist

- [ ] Generate and review database types.
- [ ] Define domain/market discriminated unions and mappers.
- [ ] Refactor query modules and scoped TanStack Query keys.
- [ ] Add URL-backed sport/edition/round selection.
- [ ] Refactor cards, prediction form, scoring modals, stats, insights, and simulator.
- [ ] Refactor pools, picks, H2H, chat, and private access handling.
- [ ] Replace profile total-points reads.
- [ ] Refactor notifications, reminders, digests, Realtime, and non-provider scripts.
- [ ] Delete legacy football-shaped types, queries, and components after import/search proof.
- [ ] Complete the feature parity matrix.

## 13. Verification

```bash
npx supabase db reset --local
npx supabase test db --local
npm run typecheck
npm test
npm run build
```

Run `rg` searches for stale table names, legacy score columns, `profiles.total_points`, and point-value tier inference. Any intentional occurrences must be documented test fixtures or migration-history references outside the active chain.

## Exit gate

- The application runs against deterministic new-schema seeds with complete football feature parity.
- No runtime query writes or reads legacy football core tables.
- Query caching and URLs are fully sport/edition/market scoped.
- All scoring surfaces use semantic tiers and ruleset versions.
- Profiles, pools, chat, notifications, reminders, digests, Realtime, and developer workflows pass parity tests.
- Typecheck, tests, and production build pass with zero warnings.
