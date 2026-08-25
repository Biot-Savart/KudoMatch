# Phase 11: Multi-Sport Core Schema

- Status: ready for implementation.
- Depends on: [Multi-Sport Architecture Master](multi_sport_architecture_master.md).
- Unlocks: [Phase 12: Prediction Markets, Scoring, and Pools](phase_12_prediction_markets_scoring_and_pools.md).

## Outcome

Replace the active football-shaped migration history with a clean Supabase baseline containing profiles, the `public`/`private` boundary, sports, competitions, editions, competitors, events, event competitors, providers, and canonical external references.

Phase 11 is complete when the new foundational schema resets cleanly from zero, its RLS/constraints pass pgTAP tests, and deterministic catalog/event seeds load without relying on any legacy `teams`, `tournaments`, or `matches` table.

## Scope

### Included

- Pre-reset guardrails and migration-history replacement.
- `supabase/config.toml` and deterministic seed configuration.
- Profile/auth trigger recreation without `profiles.total_points`.
- `private` helper/audit schema and default privilege lockdown.
- Sports, competitions, editions, competitors, events, and event competitors.
- Provider registry and external entity mappings.
- Catalog RLS, grants, indexes, timestamps, and validation helpers.
- Generated database types for the new foundation.

### Excluded

- Prediction markets, results, predictions, scoring, and pools: Phase 12.
- Application query/component refactor: Phase 13.
- Live provider adapters and rugby fixture ingestion: Phase 14.
- Rugby-specific UX and linked test reset: Phase 15.

## 1. Reset and migration workflow

The project uses imperative migrations. Generate files with `npx supabase migration new <name>`; do not invent timestamps.

Before changing active migrations:

1. Verify the current Supabase link and record that it targets a disposable test project.
2. Commit or tag the current state so Git can recover the old schema.
3. Inventory all existing tables, policies, triggers, functions, grants, cron jobs, and Realtime publication entries.
4. Preserve only fixture/provider samples worth retaining; no application rows require migration.
5. Add and review `supabase/config.toml` before using local reset or database tests.
6. Work locally first. Do not reset the linked project in this phase.

Remove the existing ten application migrations from the active chain and begin the new sequence with:

1. `foundation_profiles_and_private_schema`
2. `sports_catalog_events_and_external_refs`

Git retains the previous files; do not add compatibility migrations or backfills.

## 2. Schema boundary and identifiers

### Schemas

- `public`: catalog/event entities plus server-operated external-reference and quarantine tables that must be reachable through the existing Supabase JS/Data API path. Operational tables have RLS enabled and no anon/authenticated grants or policies.
- `private`: validation/constraint helpers, trigger-only audit structures, and privileged functions that PostgREST does not need to call directly.

Revoke unnecessary defaults from `PUBLIC`. Enable RLS on every public table immediately in the migration that creates it. Use RLS in `private` as defense in depth where user-linked data could appear later.

### Primary keys and timestamps

- New domain tables use `bigint generated always as identity` primary keys.
- `profiles.id` remains `uuid` referencing `auth.users(id)`.
- Generated database types may expose PostgreSQL bigint values as numbers or strings depending on the client path; row mappers normalize every domain ID to a string and never perform arithmetic on identifiers.
- Use `timestamptz` for timestamps and a single reviewed updated-at trigger helper.
- Use lowercase identifiers and `text` plus check constraints for controlled vocabularies.

## 3. Foundation tables

### `public.profiles`

Recreate current profile identity fields and the auth-user creation trigger. Do not include `total_points`; Phase 12 creates score-summary APIs from settled predictions.

Requirements:

- public profile reads expose only intended fields;
- authenticated users update only their own row;
- update policy has both `using` and `with check`;
- authorization never relies on user-editable user metadata;
- the auth trigger helper lives in `private`, uses a fixed empty search path, and has explicit privileges.
- an idempotent reconciliation step inserts missing profile rows for existing `auth.users` after a linked public-schema reset; do not assume the new-user trigger will rerun for managed Auth users that survived the reset.

### `public.sports`

- `slug text primary key` with lowercase slug-format check;
- display name, icon key, default score unit;
- active flag, display order, timestamps.

Seed `football` active and `rugby-union` inactive.

### `public.competitions`

Represents a stable competition across editions:

- identity primary key;
- sport slug foreign key;
- name and slug unique within sport;
- optional country/region and logo URL;
- checked kind: `league`, `cup`, `tour`, or `race_series`;
- active flag and timestamps.

Examples are Premier League, Six Nations, and United Rugby Championship—not season-specific names.

### `public.competition_editions`

Represents one season/edition:

- identity primary key and competition foreign key;
- required `season_key`, display name, start/end dates;
- checked status: `planned`, `active`, `completed`, `cancelled`;
- JSONB metadata constrained to an object and limited to presentation/format metadata;
- unique `(competition_id, season_key)`;
- date constraint requiring end date not precede start date.

### `public.competitors`

- identity primary key and sport foreign key;
- checked kind: `team`, `person`, `constructor`;
- name, short name, media URL, country code;
- active flag and timestamps.

### `public.edition_competitors`

- composite primary key `(edition_id, competitor_id)`;
- optional seed, group/conference, and display order;
- index beginning with `competitor_id` for reverse lookup;
- a named, deferrable constraint trigger validating that edition and competitor share a sport.

Use deferred constraint triggers only for invariants that require related rows to be inserted in the same transaction. Keep simple field/status/date validation in ordinary check and foreign-key constraints.

## 4. Events and event competitors

### `public.events`

- identity primary key and edition foreign key;
- checked kind, initially `match`, with reviewed future values such as `race`, `session`, and `bout`;
- `starts_at timestamptz not null`;
- checked status: `scheduled`, `live`, `completed`, `postponed`, `cancelled`, `abandoned`;
- round/stage label, optional sequence, venue and neutral-venue flag;
- validated metadata object and timestamps.

The generic event has no home/away score columns.

Create access-path indexes based on expected queries:

- `(edition_id, starts_at)`;
- `(edition_id, status, starts_at)` where justified by query shape;
- partial `(starts_at)` for scheduled/live events if `EXPLAIN` confirms the work-queue query uses it.

Avoid redundant standalone indexes covered by a composite index.

### `public.event_competitors`

- composite primary key `(event_id, competitor_id)`;
- positive `slot smallint` and unique `(event_id, slot)`;
- nullable checked role such as `home`, `away`, `participant`;
- unique partial `(event_id, role)` where role is non-null;
- a named, deferrable constraint trigger validating that event edition and competitor share a sport.

Phase 12 will require exactly two competitors in slots 1/2 with roles home/away before creating a `team_scoreline` market. Do not enforce a two-participant rule on all generic events.

## 5. Providers and canonical identity

### `public.data_providers`

- provider slug primary key;
- display name and non-secret server configuration identifier;
- active flag and timestamps;
- no credentials, quotas, or secrets exposed through this row.

### `public.external_entity_refs`

Store provider identities separately from canonical entities:

- identity primary key;
- provider foreign key;
- checked entity kind: `competition`, `edition`, `competitor`, `event`;
- provider-supplied stable `external_key text`;
- exactly one nullable foreign key to the matching canonical entity;
- optional primary flag and small validated metadata object;
- unique `(provider_slug, entity_kind, external_key)`.

Use a check constraint to enforce that exactly one canonical foreign key is populated and agrees with `entity_kind`. Create partial unique indexes so a provider has at most one primary mapping to each canonical entity. Index every nullable canonical foreign key.

This table is intentionally in `public` because the Phase 14 orchestrator uses server-side Supabase JS/PostgREST. Enable RLS, revoke anon/authenticated table privileges, and create no client policies. The service role remains the only application writer/reader.

Adapters may construct an edition key from multiple raw provider fields when a vendor reuses a competition ID across seasons. The adapter fixture documents that mapping; the domain tables do not adopt provider-specific columns.

### `public.ingestion_quarantine`

Create the minimal durable quarantine shape needed by Phase 14:

- provider, entity kind, external key;
- reason code and sanitized summary;
- payload fingerprint, first/last seen timestamps, occurrence count, resolution status;
- no secret headers or unredacted licensed payloads.

Like external references, quarantine is server-operated through Supabase JS. Enable RLS and give anon/authenticated roles no privileges or policies.

Do not build the ingestion worker in this phase.

## 6. RLS and grants

Anonymous/authenticated roles may read only published catalog/event rows. Visibility is hierarchical: a competition and competitor require an active sport; an edition and edition membership require a visible competition/edition; events and event participants require a visible parent edition/event. Seeding Rugby Union as inactive must keep its dependent catalog and events out of public reads until activation.

`data_providers`, `external_entity_refs`, and `ingestion_quarantine` are operational tables and are not client-readable. Client roles cannot insert, update, or delete any catalog, provider, competitor, or event row.

Requirements:

- use explicit role targets on every policy;
- distinguish table privileges from row policies;
- verify the project's Data API exposure settings and explicit grants;
- wrap stable auth calls as `(select auth.uid())` in user policies;
- index columns referenced by policies;
- private tables are unavailable to anon/authenticated roles;
- server-operated public tables (`external_entity_refs`, `ingestion_quarantine`) are reachable by the service role but have no client grants/policies;
- revoke default function execute privileges before adding narrow grants.

## 7. Deterministic seeds

Seed only stable, deterministic development data:

- football and Rugby Union sports;
- provider registry rows without secrets;
- Premier League and Six Nations competitions;
- one test edition per competition;
- enough teams and events to validate home/away and cross-sport constraints.

Rulesets, markets, predictions, results, and pools belong to Phase 12 seeds. Random historic/demo data remains a separate explicit script.

## 8. Tests

Add pgTAP tests for:

- clean object creation and expected schemas;
- primary/foreign/unique/check constraints;
- FK index coverage;
- slug, status, date, metadata-object, slot, role, and cross-sport rejection;
- multiple provider references resolving to one canonical entity;
- one provider external key refusing two canonical entities of the same kind;
- catalog read and mutation privileges for anon/authenticated roles;
- inactive-parent visibility tests proving an inactive sport hides dependent competitions, editions, competitors, events, and participants;
- profile ownership and private-schema isolation;
- auth-user profile creation.
- existing Auth-user reconciliation with no duplicate profile rows.
- generated/client bigint values mapping consistently to string domain IDs.

Add seed assertions for deterministic row counts and natural keys.

## 9. Implementation checklist

- [ ] Confirm and record the disposable linked project reference without resetting it.
- [ ] Add local Supabase configuration.
- [ ] Archive the old migration chain through Git and generate the two new migrations with the CLI.
- [ ] Create `private`, profiles, catalog, events, provider mappings, helpers, indexes, RLS, and grants.
- [ ] Add deterministic Phase 11 seeds.
- [ ] Add pgTAP database/security tests.
- [ ] Generate `types/database.ts` from the local schema.
- [ ] Document the intentional temporary application incompatibility for Phase 13.

## 10. Verification

```bash
npx supabase db reset --local
npx supabase test db --local
npm run typecheck
npm test
npm run build
```

The application may remain functionally incomplete against the new schema until Phase 13, but TypeScript and build checks must still pass. No linked database reset occurs in Phase 11.

## Exit gate

- The active migration chain contains no legacy football core tables or compatibility views.
- A clean local reset succeeds repeatedly with deterministic seeds.
- All new public tables have RLS and explicit grants.
- Cross-sport, participant, provider-reference, and profile authorization tests pass.
- Generated database types reflect only the new foundation.
- Domain row mappers represent every bigint identity as a string.
- The codebase still type-checks, tests, and builds, with runtime application parity explicitly deferred to Phase 13.
