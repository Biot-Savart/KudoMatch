# Phase 1: Documentation Set

- Status: complete in working tree; awaiting user review and PR.
- Depends on: existing source specification and multi-sport architecture.
- Unlocks: [Phase 2: Provider Proof and Selection](02_provider_proof_and_selection.md).
- Migration impact: none.

## Outcome

Create the complete, decision-ready master and Phase 1–8 document set before any implementation work begins.

## Included scope

- Create [the master plan](00_master_plan.md).
- Create one document for every sequential phase.
- Map every source P0 and P1 criterion to exactly one phase.
- Record all P2 criteria as deferred.
- Lock the generic canonical model, provider matrix, reconciliation rules, result authority, security, and per-phase PR protocol.
- Use relative links so the plan remains portable inside the repository.

## Excluded scope

- Package installation or lockfile changes.
- Provider HTTP calls or fixture capture.
- Provider adapter, DTO, query, script, application, or test changes.
- Supabase migrations, seeds, generated types, or linked-project operations.
- Cron, environment, deployment, or runtime configuration changes.
- Starting any Phase 2 investigation.

## Interfaces and schema owned

None. Phase 1 defines future contracts but does not create or modify runtime interfaces or database objects.

## Documentation structure

Every phase document contains:

- status and dependency;
- outcome;
- included and excluded scope;
- interfaces and schema owned by that phase;
- data and failure flow;
- security requirements;
- implementation checklist;
- tests and commands;
- rollback or disable strategy;
- objective exit gate.

The master is the only cross-phase status tracker. A phase PR updates its own checklist and master status, but must not mark future work complete.

## Data and failure flow

No runtime data flow changes in this phase. Documentation inconsistencies are treated as Phase 1 failures:

```text
source specification
        ↓
P0/P1/P2 extraction
        ↓
single phase owner per P0/P1
        ↓
relative-link validation
        ↓
reviewable documentation set
```

If a source requirement conflicts with the existing architecture, the master records the adaptation explicitly. The original source specification is not edited silently.

## Failure behavior

- A missing or broken relative link fails Phase 1 validation.
- A duplicated or unowned P0/P1 criterion blocks the documentation PR.
- A runtime, migration, dependency, fixture, or configuration change is removed from Phase 1 rather than justified as preparatory work.
- An unresolved architecture conflict is recorded explicitly in the master or owning future phase; it is not silently decided during implementation.
- A failed repository build is reported and resolved only when the cause is within the documentation scope. An unrelated pre-existing failure is documented without expanding Phase 1 into application work.

## Security requirements

- Do not include secrets, real credentials, unredacted provider responses, or linked-project identifiers.
- Preserve the existing untracked source specification unchanged.
- Link to current official security/platform guidance rather than copying secret-bearing examples.

## Implementation checklist

- [x] Create `00_master_plan.md`.
- [x] Create Phase 1–8 documents.
- [x] Add linear dependency and one-phase-per-PR protocol.
- [x] Add provider priority matrix.
- [x] Map every P0 criterion to one owner.
- [x] Map every P1 criterion to one owner.
- [x] Record all P2 criteria as deferred.
- [x] Link the source specification and multi-sport master.
- [x] Record Phase 1 implementation boundaries.
- [x] Validate all relative links.
- [x] Confirm the diff is documentation-only.
- [x] Run `git diff --check`.
- [x] Run `npm run build`.

## Test scenarios and commands

1. Extract links from the new Markdown files and confirm every relative target exists.
2. Parse the P0/P1 ownership tables and confirm each source criterion appears once.
3. Compare the worktree before/after set and confirm only `plans/rugby_multi_provider_integration/*.md` was added by Phase 1.
4. Run:

```bash
git diff --check
npm run build
```

The user's pre-existing untracked `docs/specs/` content is not a Phase 1 change.

## Rollback

Delete only `plans/rugby_multi_provider_integration/`. No runtime or database rollback is needed because Phase 1 changes documentation only.

## Exit gate

- All nine planned Markdown files exist.
- Every relative link resolves.
- Every P0/P1 criterion has exactly one phase owner.
- All P2 items are explicitly deferred.
- No implementation file, migration, fixture, dependency, or configuration changed.
- `git diff --check` and `npm run build` pass.
- Work stops for user review and the documentation-only PR.
