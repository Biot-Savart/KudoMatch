# ADR 0002: Rugby Current-Data Provider Proof

- **Status:** Approved by user on 2026-09-03; deployment-runtime and coverage gaps remain tracked as follow-up evidence
- **Date:** 2026-09-01
- **Evidence:** `docs/rugby-provider-proof/phase-2-proof-2026-09-01.md`
- **Scope:** Current Currie Cup and United Rugby Championship fixtures, results, and standings

## Context

Phase 2 requires a reproducible proof of a technically viable current-data provider before Phase 3 adds source-ledger and reconciliation behavior. The proof must be performed with legitimate, provider-permitted access and cannot infer API contracts from stale libraries or search snippets.

The proof CLI is [`scripts/prove-rugby-multi-provider.ts`](../../scripts/prove-rugby-multi-provider.ts). It is server-side, uses a descriptive user agent, performs read-only GET requests by default, caps requests and retries, and never writes canonical application data. Fixture writes require the explicit `--write` flag.

## Candidates and evidence

### SofaScore

The public competition pages identify Currie Cup as tournament `796` and URC as tournament `419`, and show current rugby competition content. The intended API season probes were:

```text
GET https://www.sofascore.com/api/v1/unique-tournament/796/seasons
GET https://www.sofascore.com/api/v1/unique-tournament/419/seasons
```

Both returned HTTP 403 from the local runtime on 2026-09-01. No authentication, bot-protection bypass, alternate endpoint, or unapproved scraping path was attempted. Season IDs, teams, events, event details, completed results, and standings therefore remain unproven for application use.

The user subsequently supplied browser-captured responses covering Currie Cup and URC seasons, Currie Cup teams and standings, scheduled Currie Cup playoff events, completed Currie Cup events, and scheduled/completed URC event lists. Sanitized evidence snapshots are stored under `tests/fixtures/providers/sofascore/rugby-union/`. These responses establish the observed IDs and shapes, including Currie Cup `796`/season `97057`, URC `419`/season `98406`, event `16393687`, nested `homeScore.current`/`awayScore.current`, and pagination behavior. They do not establish that the intended deployment runtime can access SofaScore.

The guarded local `curl_cffi` proof runner was also executed on 2026-09-03 with explicit permitted-access confirmation. It successfully fetched both season endpoints and event `16393687` using a Chrome-impersonated session, with no credentials or arbitrary URL proxy. The result is recorded as sanitized metadata in `tests/fixtures/providers/sofascore/rugby-union/curl-cffi-proof.json`; it proves local transport viability only, not deployment-runtime viability.

The following evidence gaps are explicitly retained for later contract checks rather than being inferred or fabricated: URC teams and standings; in-progress, postponed, cancelled, and missing-score event payloads; malformed and empty-success responses; induced timeout and rate-limit responses; and deployed-runtime access. These gaps do not permit Phase 2 approval until the required provider decision and deployment-runtime proof are complete.

**Result:** technically viable locally, but not approved yet because intended deployment-runtime access and provider-permitted use are not established.

### ESPN

The public ESPN index identifies Currie Cup league `270555` and URC league `270557`. The proof tested:

```text
GET https://site.api.espn.com/apis/site/v2/sports/rugby/270555/scoreboard
GET https://site.api.espn.com/apis/site/v2/sports/rugby/270555/standings
GET https://site.api.espn.com/apis/site/v2/sports/rugby/270557/scoreboard
GET https://site.api.espn.com/apis/site/v2/sports/rugby/270557/standings
```

Scoreboard responses returned HTTP 200 with `events`, `leagues`, `provider`, and `season` top-level fields. The run observed a completed Currie Cup event with score fields and scheduled URC events. Both standings responses returned HTTP 200 but only exposed `fullViewLink`; a standings JSON contract was not proven. Dedicated season/catalog, team, event-detail, and exceptional-state fixtures were also not proven.

**Result:** not approved. ESPN is a viable candidate for a later fixture/result probe, but it does not satisfy the Phase 2 requirement for current fixtures, results, and standings through the tested server-side contract.

## Decision

The Phase 2 provider decision is approved by the user on 2026-09-03, which unblocks Phase 3. The user-approved priority order for every configured operation is:

1. SofaScore
2. ESPN
3. API-Sports

This order applies to historical fixtures/results, current fixtures/results, standings, current internationals, and international verification. It is a priority and fallback decision, not permission to activate a provider before its phase-specific access, coverage, adapter, mapping, and operational checks are complete.

API-Sports remains the existing historical integration under ADR 0001; this ADR does not promote it to current Currie Cup or URC authority because no current-data credential or coverage proof was available in this run.

Phase 3 may proceed under the approved provider decision. The deployment-runtime and coverage gaps remain follow-up evidence. The exact priority assignment is now recorded; activation remains subject to the owning phase gates. A replacement for the SofaScore-specific P0 criteria still requires an explicit ADR amendment.

## Operational policy for any follow-up proof

| Setting | Decision |
| --- | --- |
| Requests per provider per run | 12 maximum |
| Timeout | 20 seconds per request |
| Retries | 2 retries for 429, 5xx, timeout, or network failure; no retry for other 4xx responses |
| `Retry-After` | Honored and capped at 10 seconds |
| Default mode | Read-only; no fixture or database writes |
| Fixture write | Explicit `--write`; payloads are recursively redacted before storage |
| Credentials | None accepted for SofaScore/ESPN; any future credential must remain server-only |
| Runtime | Production-runtime probe is still required; this evidence is local-runtime only |

## Rollback

Remove this ADR, the Phase 2 proof report, and the proof CLI/package script. No database or application rollback is required.
