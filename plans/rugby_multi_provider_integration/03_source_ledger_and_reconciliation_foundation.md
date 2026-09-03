# Phase 3: Source Ledger and Reconciliation Foundation

- Status: implemented; Phase 3 local DB verification passes; awaiting review. Phase 2 approval is recorded; this phase remains provider-neutral and does not activate a provider.
- Depends on: [Phase 2: Provider Proof and Selection](02_provider_proof_and_selection.md) approved and merged.
- Unlocks: [Phase 4: Primary Current-Provider Pilot](04_primary_current_provider_pilot.md).
- Migration ownership: create one imperative `rugby_provider_source_ledger` migration with the installed Supabase CLI.

## Outcome

Extend the existing generic ingestion layer with validated provider capabilities, provider-source storage, reviewed catalog mappings, deterministic event reconciliation, provenance, and observe-only execution. No new external provider adapter is implemented in this phase.

## Included scope

- Shared provider capability and source-envelope contracts.
- Provider payload validation from `unknown` using a pinned schema-validation dependency.
- Item-level validation/quarantine and bounded batch failure isolation.
- Source ledger for catalog entities and events.
- Competition/provider authority settings.
- Data-quality and mapping-audit storage.
- Observe-only ingestion.
- Approved bootstrap versus fail-closed normal sync.
- Dry-run mapping management CLI.
- Deterministic event reconciliation and idempotent source upserts.
- RLS, explicit grants, indexes, generated database types, and database tests.

## Excluded scope

- SofaScore/current-provider adapter implementation.
- API-Sports historical backfill changes.
- ESPN, fallback selection, request budgets, health, or circuit breaking.
- Sync scheduling and checkpoints.
- Standings tables or queries.
- Application diagnostics UI.

## Interfaces owned

Extend `SportProviderAdapter` with:

```typescript
interface ProviderCapabilities {
  competitions: boolean;
  editions: boolean;
  teams: boolean;
  historicalFixtures: boolean;
  currentFixtures: boolean;
  liveUpdates: boolean;
  results: boolean;
  standings: boolean;
  rankings: boolean;
}

interface ProviderSourceMetadata {
  fetchedAt: string;
  providerUpdatedAt?: string;
  schemaVersion: number;
  rawPayload: unknown;
}
```

- Add required `capabilities` to every existing adapter.
- Add optional `fetchEvent()` and `fetchStandings()` signatures without implementing new providers.
- Add source metadata to provider-normalized competition, edition, competitor, and event DTOs.
- Preserve string external keys and ISO-8601 UTC timestamps.
- Raw/source DTOs remain server-only and are not exported through client-safe barrels.

## Schema owned

### `competition_provider_settings`

- Key: `(competition_id, provider_slug)`.
- Stores enabled/observe-only state, nullable priorities for fixtures/results/history/standings, fixture authority, and single-source result-finalization permission.
- Provider-specific non-secret configuration uses checked JSONB; credentials never enter this table.

### `provider_catalog_sources`

- Unique key: `(provider_slug, entity_kind, external_key)`.
- Supports `competition`, `edition`, and `competitor` kinds.
- Stores exactly one nullable canonical target appropriate to the kind, mapping status, normalized display fields, latest valid raw payload, fingerprint, provider update time, first/last fetched time, and mapping timestamps.
- Status check: `needs_mapping`, `mapped`, or `ignored`.

### `provider_event_sources`

- Unique key: `(provider_slug, provider_event_key)`.
- Stores nullable canonical `event_id`, provider competition/edition/team keys, normalized kickoff/status/scores, latest raw payload, fingerprint, provider update time, and first/last fetched time.
- Home and away scores must be both null or both non-null and non-negative.
- Mapping state distinguishes `unresolved`, `mapped`, `ambiguous`, and `ignored`.

### `event_data_quality`

- One row per canonical event.
- Stores preferred provider, `unverified`/`single_source`/`verified`/`conflicted`, source count, sanitized conflict details, last verification, and next verification time.
- Only ingestion/conflict-management code mutates this table.

### `provider_mapping_audit`

- Append-only identity-keyed history of map, create-and-map, remap, ignore, and restore operations.
- Stores provider source identity, previous/new canonical target, actor/correlation identity, reason, and timestamp.
- Client roles have no access.

### Existing table changes

- Add sanitized `raw_payload jsonb` to `ingestion_quarantine`.
- Add request, schema-error, rate-limit, and conflict counters to `ingestion_runs` only when required by the shared run summary.
- Do not add Phase 5–7 tables.

Use `bigint generated always as identity`, `timestamptz`, named checks, atomic upserts, and supporting foreign-key/composite/partial indexes. Do not add a blanket GIN index to raw JSONB.

## Data flow

```text
adapter payload as unknown
        ↓
provider schema validation per item
        ├── invalid → quarantine
        └── valid → normalized DTO + source metadata
                            ↓
                   source-ledger upsert
                            ↓
               observe-only? ── yes → stop
                            │
                            no
                            ↓
               approved catalog mappings
                            ↓
               deterministic event resolution
                            ↓
                  bounded canonical batch
```

Network calls finish before database transactions. A canonical batch failure is split until a failing record is isolated; the record quarantines and healthy sibling batches continue. Every source/canonical upsert uses unique constraints and `ON CONFLICT`, never select-then-insert races.

## Reconciliation behavior

1. Use an existing provider event external reference when present.
2. Otherwise require mapped competition, edition, home, and away sources.
3. Query candidates in the same edition with the same home/away competitors and kickoff from incoming minus 12 hours through incoming plus 12 hours, inclusive.
4. One candidate links and creates the external reference.
5. Multiple candidates mark the source ambiguous and quarantine it.
6. No candidate creates a canonical event only when `fixture_authority = true` for that competition/provider.
7. Never use team names as production identity.

## Failure behavior

- A malformed collection item does not discard valid siblings.
- Unknown teams/competitions are stored as source records and do not create canonical entities during normal sync.
- Missing mappings prevent dependent event writes.
- Null provider values do not erase known canonical values.
- Empty/provider-failure responses leave canonical rows and results unchanged.
- Dry run and observe-only never mutate canonical entities, markets, or results.

## Security requirements

- Enable RLS on every new `public` table.
- Revoke all access from `PUBLIC`, `anon`, and `authenticated` for operational/source/audit tables; grant only the minimum service roles.
- Add explicit Data API grants rather than relying on defaults.
- Keep privileged helpers in `private` where practical, use empty search paths, and revoke default function execution.
- Do not use deprecated `auth.role()` checks.
- Keep raw payloads sanitized and provider/service credentials server-only.
- Run security and performance advisors after local database tests.

## Mapping management CLI

Add `scripts/manage-provider-mapping.ts` with `list`, `map`, `create-and-map`, `ignore`, and `remap` operations.

- Default behavior is dry run.
- Mutation requires `--apply`.
- Remapping requires both `--force` and a non-empty reason.
- Every mutation writes `provider_mapping_audit` in the same bounded transaction.
- The CLI uses the service-role client and refuses browser-exposed credentials.

## Implementation checklist

- [x] Confirm Phase 2 PR and provider ADR approval. (User approval recorded; no provider is activated by this foundation phase.)
- [x] Add and pin the schema-validation dependency; commit the lockfile.
- [x] Define capabilities and source metadata contracts.
- [x] Update existing adapters to declare capabilities/source envelopes without behavioral expansion.
- [x] Create the Phase 3 migration with CLI-generated naming.
- [x] Implement source-ledger upserts and observe-only mode.
- [x] Split approved bootstrap from normal fail-closed sync.
- [x] Implement deterministic reconciliation.
- [x] Add mapping management CLI and immutable audit.
- [x] Add item/batch isolation and quarantine behavior.
- [x] Regenerate database types to include the Phase 3 schema and RPCs.
- [x] Add database, unit, integration, and security test coverage. (The Phase 3 DB test and full database suite pass.)

## Test scenarios and commands

- Valid and invalid provider items in the same response.
- Unknown, mapped, remapped, and ignored catalog sources.
- Reconciliation at −12 hours, +12 hours, outside tolerance, and with two candidates.
- Direct external-reference resolution bypasses time matching.
- Repeat source and canonical imports create no duplicates or unnecessary updates.
- Observe-only and dry-run do not alter canonical/result tables.
- One failing record does not roll back healthy siblings.
- Client roles cannot read/write source, audit, quarantine, or run tables.

```bash
npx supabase db reset --local
npx supabase test db --local
npm run typecheck
npm test
npm run build
npx supabase db advisors --local
```

Use the exact advisor flags exposed by the installed CLI help.

## Rollback and disable strategy

- Disable all new `competition_provider_settings` rows and keep existing adapters on the pre-Phase 3 path during rollback validation.
- Revert the Phase 3 application commit and apply a reviewed forward migration to remove new schema only if data retention is unnecessary.
- Never roll back a shared environment with destructive reset.

## Exit gate

- All new contracts and tables exist with explicit security.
- Unknown catalog entities fail closed and mappings are auditable.
- Deterministic reconciliation and idempotency tests pass.
- Observe-only and batch isolation pass.
- Existing football/API-Sports/TheSportsDB ingestion regressions pass.
- Full verification and relevant advisors pass.
- Work stops for user review, testing, and the Phase 3 PR.
