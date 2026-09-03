# Phase 2 provider proof — 2026-09-01

## Command

```bash
npm run provider:proof:rugby:multi
```

The command was run in read-only mode from the local Windows runtime. It did not write fixtures or canonical data.

## Results

| Provider | Probe | HTTP | Category | Observed evidence |
| --- | --- | ---: | --- | --- |
| SofaScore | Currie Cup seasons `796` | 403 | HTTP error | API access denied; response shape `error` |
| SofaScore | URC seasons `419` | 403 | HTTP error | API access denied; response shape `error` |
| ESPN | Currie Cup scoreboard `270555` | 200 | Success | 1 event; completed state and score field observed |
| ESPN | Currie Cup standings `270555` | 200 | Schema error | Only `fullViewLink`; no standings data |
| ESPN | URC scoreboard `270557` | 200 | Success | 3 events; scheduled state and score field observed |
| ESPN | URC standings `270557` | 200 | Schema error | Only `fullViewLink`; no standings data |

The proof harness also recorded response timing, byte count, content type, retry headers, top-level shape, and the configured timeout/retry policy without persisting provider payloads.

On 2026-09-03, the guarded [`curl_cffi` proof runner](../../scripts/prove-sofascore-curl-cffi.py) was run locally with explicit permitted-access confirmation. All three fixed requests returned HTTP 200: Currie Cup seasons (`/unique-tournament/796/seasons`), URC seasons (`/unique-tournament/419/seasons`), and event `16393687` (`/event/16393687`). The event response had shape `event`, status `finished`, and score fields. The runner wrote only the sanitized summary fixture [`curl-cffi-proof.json`](../../tests/fixtures/providers/sofascore/rugby-union/curl-cffi-proof.json); no raw payload or credential was stored.

## Supplemental SofaScore evidence supplied by the user

On 2026-09-03, the user supplied browser-captured SofaScore responses for the following Rugby Union records. These artifacts were parsed as JSON, reduced to the fields needed for Phase 2 contract review, and stored as sanitized fixtures under [`tests/fixtures/providers/sofascore/rugby-union/`](../../tests/fixtures/providers/sofascore/rugby-union/). They are evidence of endpoint shape and coverage, not proof of access from the intended deployment runtime.

The deterministic fixture-integrity test is [`tests/unit/scripts/sofascore-fixtures.test.ts`](../../tests/unit/scripts/sofascore-fixtures.test.ts). It verifies the expected corpus, JSON parsing, absence of sensitive-key fields, and the key Currie Cup/URC/event identities.

| Evidence | Observed details | Fixture |
| --- | --- | --- |
| Currie Cup seasons | Unique tournament `796`; current season `97057`; historical seasons through 2010 | `currie-cup-seasons.json` |
| URC seasons | Unique tournament `419`; current season `98406`; prior season `79019` and historical Pro 12/14 seasons | `urc-seasons.json` |
| Currie Cup teams | Eight teams, including provider team IDs and category metadata | `currie-cup-teams.json` |
| Currie Cup standings | Season `97057`; eight rows; positions, results, scores, points, and score differences | `currie-cup-standings.json` |
| Currie Cup scheduled events | Two playoff events; season `97057`; `notstarted`; `hasNextPage=false` | `currie-cup-events-next.json`, `currie-cup-scheduled-event.json` |
| Currie Cup completed events | Twenty-eight events; season `97057`; `finished`; nested current scores; `hasNextPage=false` | `currie-cup-events-last.json`, `currie-cup-completed-event.json` |
| URC scheduled events | Thirty events; season `98406`; `notstarted`; `hasNextPage=true` | `urc-events-next.json` |
| URC completed events | Thirty events; season `79019`; `finished`; regular and playoff tournament names; `hasNextPage=true` | `urc-events-last.json` |

The event detail evidence confirms that `uniqueTournament.id` is the stable competition identity across regular and playoff stages, while the stage `tournament.id` varies. The observed result fields are `status.type`, `startTimestamp`, `homeScore.current`, and `awayScore.current`; scheduled events have no current score fields. One observed team, `Vodacom Bulls XV` (`245501`), is categorized as Rugby Union Tens and requires an explicit mapping/data-quality decision before activation.

## Coverage matrix

| Case | Result | Reason |
| --- | --- | --- |
| Competition/catalog | Partial evidence | User-supplied SofaScore season responses identify Currie Cup `796` and URC `419`; deployment access remains unproven |
| Seasons | Partial evidence | User-supplied responses and local `curl_cffi` proof establish Currie Cup/URC season shapes and IDs; deployment access remains unproven |
| Teams | Partial evidence | User-supplied Currie Cup team response establishes eight team records and IDs; URC team response remains unrecorded |
| Scheduled fixture | Evidence supplied | User-supplied Currie Cup and URC event lists expose scheduled events, season IDs, pagination, and team IDs |
| In-progress fixture | Gap | No in-progress event observed or supplied |
| Completed result | Evidence supplied | User-supplied Currie Cup event detail/list and URC event list expose finished states and scores |
| Postponed/cancelled | Gap | No event payload for either state |
| Missing score | Gap | No event payload for this case |
| Malformed response | Gap | No malformed provider payload was captured |
| Empty success | Gap | No empty-success response observed |
| Timeout/error | Gap | No timeout was induced against a provider |
| Rate-limit response | Gap | No rate-limit request was induced |
| Standings | Partial evidence | User-supplied Currie Cup standings establish the response shape; URC standings remain unrecorded and local probes remain denied |
| Event detail | Partial evidence | User-supplied scheduled event `16966295` and completed event `16393687`, plus local `curl_cffi` access to `16393687`; deployment access remains unproven |

## Conclusion

The evidence is still insufficient to approve a current provider. The user-supplied SofaScore artifacts and local `curl_cffi` proof establish useful IDs, shapes, and Currie Cup/URC fixture/result coverage, but SofaScore remains unproven from the intended deployment runtime and exceptional-state coverage is incomplete. ESPN has partial fixture/result coverage but fails the standings requirement in the tested API contract. No Phase 3 schema, mapping, adapter, or canonical-write work is authorized by this result.
