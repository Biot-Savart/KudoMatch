# Phase 15: Rugby Experience and Release

- Status: planned.
- Depends on: [Phase 14: Provider Ingestion and Rugby Data](phase_14_provider_ingestion_and_rugby_data.md).
- Completes: [Multi-Sport Architecture Master](multi_sport_architecture_master.md).

## Outcome

Deliver the Rugby Union prediction experience, verify scoped and normalized multi-sport pools, reset the disposable linked test environment from the clean migration chain, and produce a release candidate beginning with Six Nations.

## Scope

### Included

- Dynamic sport/competition/edition navigation.
- Rugby scoreline controls, presets, margin display, cards, rules, breakdowns, stats, and simulation.
- Pool creation/explanation for raw and normalized scoring.
- Six Nations end-to-end launch and incremental competition activation.
- Accessibility, responsive UX, observability, smoke tests, advisors, and test-environment reset.
- Documentation proving how to add another scoreline sport.

### Excluded

- Cricket, tennis, Formula 1, player props, try scorers, or play-by-play.
- Automatic provider failover.
- Production launch/data migration; this phase targets the current disposable test system.

## 1. Sport and edition navigation

Build a reusable sport switcher from active `sports` rows. Competition and edition choices come from catalog queries, never hard-coded labels.

Requirements:

- active sport, competition, edition, and round live in URL state;
- filters restore on refresh and browser navigation;
- changing sport clears incompatible competition/edition/round state;
- TanStack Query keys prevent cross-sport cache leakage;
- empty/inactive/upcoming competition states have deliberate UI;
- pool pages derive and lock their filters from pool scope where required.

Initial choices include Football/Premier League and Rugby Union/Six Nations. `All Sports` is available only where the page meaningfully supports mixed events.

## 2. Rugby scoreline form

Use the Phase 13 market-aware prediction shell with a Rugby Union `team_scoreline` renderer.

Controls:

- `+1` fine tune;
- `+3` penalty/drop-goal convenience;
- `+5` try convenience;
- `+7` converted-try convenience;
- decrement/fine-tune and reset;
- ruleset-driven presets such as `24-17`, `31-20`, and `19-15`.

These controls only change predicted totals. They do not claim to record the actual scoring-event composition.

Display:

- signed margin such as `Springboks by 7 points`;
- `Draw` when equal;
- score unit and maximum from immutable ruleset UI config;
- current lock/open state and clear submission feedback.

Clamp values in the UI while retaining database validation as authority. Support direct keyboard entry, visible focus, accessible names, screen-reader announcements, and minimum 44px touch targets.

## 3. Rugby event and scoring surfaces

Update all relevant surfaces to render Rugby Union correctly:

- event cards with sport and competition identity;
- home/away participant branding;
- scheduled, live, completed, postponed, cancelled, and abandoned states;
- rules modal for exact, exact margin, close margin, outcome, and miss;
- breakdown modal with predicted/actual signed margin and error;
- community distributions keyed by semantic tiers;
- participant picks after lock;
- what-if simulator using rugby evaluator and selected pool scoring mode.

No component may infer meaning from raw point values. Rugby's 3-point close margin must never appear as football's exact score.

## 4. Pools and cross-sport transparency

Pool creation supports:

- all sports;
- one sport;
- one competition;
- one edition.

Scoring selection:

- raw points for sport/competition/edition scopes;
- normalized points for any scope;
- normalized points forced for all-sport pools.

Explain normalized scoring in plain language: each market contributes up to 10,000 basis points regardless of whether its sport's raw maximum is 3 or 6. This is equal weighting per market, not equal weighting per sport; sports with more eligible markets provide more scoring opportunities.

Show the pool scoring-start rule and membership timing: events that locked before pool creation do not count, and a user scores only for markets that locked during one of their membership periods.

Verify every pool surface uses eligible markets:

- leaderboard;
- exact counts and prediction counts;
- picks matrix;
- head-to-head;
- simulator;
- insights and round filters;
- reminders and digests.

## 5. Six Nations launch gate

Before enabling Rugby Union globally in the test UI, reconcile:

- sport, competition, edition, and ruleset active flags;
- six expected national teams;
- complete edition fixture count;
- unique provider references;
- kickoff times and round labels;
- home/away slots and roles;
- status/result distributions;
- all final scores and result revisions;
- zero unexplained quarantine rows;
- correct predictions and pool scores for sampled events.

Enablement order:

1. Rugby Union registry visible to internal/test accounts.
2. Six Nations event list read-only smoke test.
3. Prediction submission and lock test.
4. Provisional preview and final settlement test.
5. Sport- and edition-scoped pool test.
6. Normalized all-sport pool test.
7. General test-user activation.

## 6. Additional competition rollout

Do not activate all rugby competitions in one batch.

Order:

1. Six Nations.
2. United Rugby Championship.
3. Rugby Championship.
4. Premiership Rugby.
5. Champions Cup.

Each competition repeats the catalog/fixture/result reconciliation, quarantine review, pool-scope test, and UI smoke test. A later competition failure must not disable already healthy competitions.

## 7. Linked disposable test reset

Immediately before any destructive linked action:

1. Resolve and display the exact project reference.
2. Confirm it is the intended disposable test project and not production.
3. Confirm the active migration chain and seed configuration.
4. Confirm Auth-reset expectations separately; preserving Auth configuration is the default.
5. Run the clean reset locally one final time.

Then rebuild the test environment from the new migrations and deterministic seeds using only documented Supabase CLI commands verified with `--help`. Do not rely on a cached link or manually reconstructed migration history.

Because the active migration history was replaced, do not use `db push` to reconcile the old remote history. For this confirmed disposable project, use the supported linked reset path, which drops user-created remote entities and replays the local migration chain:

```bash
npx supabase projects list
npx supabase db reset --linked
```

Re-check the installed CLI help immediately before execution and do not add remembered flags that the installed version does not expose.

After reset:

- regenerate/review database types;
- reconcile surviving managed Auth users to profiles and default notification preferences, then assert zero missing rows;
- verify RLS and grants in the linked environment;
- configure server-only secrets and cron;
- run recorded-provider ingestion before live-provider ingestion;
- seed optional demo data explicitly, never through live-sync fallback.

## 8. Observability and operational tests

Inspect structured ingestion and settlement summaries for:

- provider/sport/edition and duration;
- fetched, inserted, updated, unchanged, quarantined, and failed counts;
- retries/rate-limit waits;
- result revisions and settlement counts;
- unknown statuses or payload validation failures.

Create visible failures/alerts for:

- repeated provider failures;
- unexplained quarantine growth;
- settlement parity errors;
- cron runs approaching time limit;
- failed result corrections;
- attempted browser-secret usage;
- active Rugby Union catalog with missing ruleset/UI config.

## 9. Accessibility and responsive QA

Test at mobile-first widths and desktop:

- switcher overflow and scroll behavior;
- event cards with long rugby team/competition names;
- drawer/modal focus trapping and restoration;
- keyboard-only score entry;
- screen-reader control labels and result announcements;
- touch target sizing;
- color contrast for tiers/statuses;
- reduced-motion preferences;
- loading, empty, partial-failure, offline, and retry states.

## 10. End-to-end scenarios

Automate or explicitly smoke-test:

1. Select Rugby Union and Six Nations; navigate round via URL.
2. Submit/update/delete a rugby prediction before lock.
3. Reject the same operations at/after lock.
4. Hide another user's pick before lock and reveal it after lock.
5. Apply a provisional score without settlement.
6. Apply final score and verify tier/raw/normalized award.
7. Correct the result and verify revision/history/re-settlement.
8. Void a market and verify awards clear while audit remains.
9. Compare raw Six Nations and normalized all-sport pool standings.
10. Leave and rejoin a pool; verify markets locked outside membership periods do not count.
11. Postpone before lock and after lock; verify only the permitted path changes lock behavior.
12. Exercise picks, H2H, simulator, insights, chat, reminder, digest, and Realtime refresh.
13. Simulate provider failure and verify no fabricated result.
14. Disable Rugby Union through registry/feature controls without schema change.

## 11. Documentation

Create `docs/how-to/adding-a-scoreline-sport.md` using a third mock scoreline sport as proof. Document:

- catalog and ruleset seed;
- provider mapping/adapter;
- shared scoring evaluator contract;
- payload-schema version and validator contract, separate from scoring-ruleset version;
- market-specific UI config and renderer;
- pool and normalization behavior;
- database/RLS/ingestion/component tests;
- activation and rollback controls.

Link back to the architecture master and applicable phase documents.

## 12. Implementation checklist

- [ ] Add dynamic sport/competition/edition switcher and URL state.
- [ ] Implement Rugby Union scoreline controls and accessibility behavior.
- [ ] Update cards, rules, breakdowns, stats, picks, insights, and simulator.
- [ ] Verify raw and normalized pool UX across all scopes.
- [ ] Reconcile and activate Six Nations through staged gates.
- [ ] Reset and configure the disposable linked test environment after exact-target verification.
- [ ] Run complete feature parity and operational smoke tests.
- [ ] Run advisors and resolve relevant findings.
- [ ] Add URC only after Six Nations exit gate.
- [ ] Write the scoreline-sport extension guide.

## 13. Verification

```bash
npx supabase db reset --local
npx supabase test db --local
npm run typecheck
npm test
npm run build
```

Also run the linked test smoke matrix, recorded/live ingestion reconciliation, provider-failure test, and Supabase security/performance advisors.

## Exit gate

- The clean baseline is running in the confirmed disposable test project.
- Football retains full feature parity.
- Six Nations imports idempotently and passes catalog/result reconciliation.
- Rugby scoring and all UI surfaces agree with PostgreSQL/TypeScript contracts.
- Sport-, competition-, edition-, and all-sport pools enforce correct scope and scoring mode.
- Prediction secrecy, private-pool authorization, correction, void, Realtime, notification, and provider-failure scenarios pass.
- No production path can fabricate scores or expose provider/service secrets.
- Database tests, generated types, TypeScript, unit/integration tests, accessibility checks, and production build pass.
- Rugby Union can be disabled without a schema rollback.
