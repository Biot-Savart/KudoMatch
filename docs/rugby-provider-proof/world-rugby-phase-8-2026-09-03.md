# World Rugby Phase 8 Evidence Report

- **Captured:** 2026-09-03
- **Runtime:** local PowerShell read-only probes
- **Decision scope:** future international fixtures/results verification; no production activation
- **Probe tool:** [`scripts/probe-world-rugby.ts`](../../scripts/probe-world-rugby.ts)
- **Permission state:** no provider agreement or issued World Rugby API credential was available; the gated proof tool was not run against the provider

## Executive finding

World Rugby has a technically useful public RIMS read surface. The official fixtures page exposes a calendar and the page’s production JavaScript identifies the public API base as `api.wr-rims-prod.pulselive.com`; limited fixed GET probes returned structured JSON without credentials. The observed contract includes stable event, match, team, competition, timestamp, score, status, standings, and ranking identifiers.

The provider is **not approved for automated KudoMatch use**. World Rugby’s published terms allow personal, non-commercial viewing/download/printing but prohibit using a computer program to collect or aggregate site material (“spidering”). No provider-permitted server-side access agreement, API terms, SLA, or issued credential was found in this investigation. Successful public endpoint discovery is therefore technical evidence only, not permission to automate.

## Fixed read-only observations

| Probe | Result | Evidence |
| --- | --- | --- |
| International event catalog, 2026-07-01 through 2026-11-30 | HTTP 200; 9 event entries, including Nations Championship 2026, Rugby’s Greatest Rivalry 2026, Pacific Nations Cup 2026, and Bledisloe Cup 2026 | [World Rugby RIMS event endpoint](https://api.wr-rims-prod.pulselive.com/rugby/v3/event?page=0&pageSize=10&sort=asc&sport=mru&startDate=2026-07-01&endDate=2026-11-30) |
| Rugby Championship/RWC catalog, 2023-07-01 through 2023-10-31 | HTTP 200; 7 event entries, including 2023 Rugby Championship and Rugby World Cup 2023 (`1893`) | [World Rugby RIMS event endpoint](https://api.wr-rims-prod.pulselive.com/rugby/v3/event?page=0&pageSize=10&sort=asc&sport=mru&startDate=2023-07-01&endDate=2023-10-31) |
| Rugby World Cup 2023 schedule | HTTP 200; 48 matches; match IDs and team IDs were present | [RWC 2023 schedule](https://api.wr-rims-prod.pulselive.com/rugby/v3/event/1893/schedule?pageSize=100) |
| Rugby World Cup 2023 standings | HTTP 200; 4 tables; generated timestamp and team identifiers were present | [RWC 2023 standings](https://api.wr-rims-prod.pulselive.com/rugby/v3/event/1893/standings?pageSize=100) |
| Rugby World Cup 2023 final | HTTP 200; match `28813`; New Zealand 11–12 South Africa; status `C` | [World Rugby match page](https://www.world.rugby/beta/en/match/28813), [RIMS match endpoint](https://api.wr-rims-prod.pulselive.com/rugby/v3/match/28813) |
| Nations Championship 2026 schedule/standings | HTTP 200; 42 matches and 2 tables | [Nations Championship schedule](https://api.wr-rims-prod.pulselive.com/rugby/v3/event/46294cf5-dee3-4234-957a-dbe1f08049f2/schedule?pageSize=100), [standings](https://api.wr-rims-prod.pulselive.com/rugby/v3/event/46294cf5-dee3-4234-957a-dbe1f08049f2/standings?pageSize=100) |
| British & Irish Lions coverage | HTTP 200 event-catalog observation; `2025 British & Irish Lions Tour (AUS)` was returned for the 2025-06-01 through 2025-08-31 window | [World Rugby RIMS event endpoint](https://api.wr-rims-prod.pulselive.com/rugby/v3/event?page=0&pageSize=10&sort=asc&sport=mru&startDate=2025-06-01&endDate=2025-08-31) |
| Men’s rankings | HTTP 200; label, effective date, and 25 ranking entries | [World Rugby rankings endpoint](https://api.wr-rims-prod.pulselive.com/rugby/v3/rankings/mru?page=0&pageSize=25&sort=asc), [official rankings page](https://www.world.rugby/rankings) |

The 2026-09-03 response headers on the rankings endpoint exposed `x-ratelimit-limit: 50;w=60`, `x-ratelimit-remaining: 49`, and `x-ratelimit-reset: 11`. This is an observed header, not an SLA or a production request policy.

## Cross-provider overlap

The RWC 2023 final is a useful three-source identity/result comparison:

| Source | Identity | Result |
| --- | --- | --- |
| World Rugby | match `28813`; New Zealand v South Africa | 11–12; completed |
| ESPN | game `596201`, league `164205` | 11–12; FT |
| API-Sports | game `43599`, league `69`, season `2023` | 11–12; FT |

Supporting pages: [World Rugby final](https://www.world.rugby/beta/en/match/28813), [ESPN final](https://www.espn.com/rugby/match/_/gameId/596201/league/164205), and [World Rugby’s final report](https://www.world.rugby/news/888593/nzl-11-12-rsa-south-africa-win-tense-final-to-claim-fourth-rugby-world-cup). The provider IDs remain distinct and require an explicit source ledger mapping.

The approved current provider, SofaScore, has no international/RWC fixture captured in the repository evidence set, so SofaScore international overlap remains a gap. Direct ESPN API requests for this international probe returned HTTP 403 from the local runtime; the ESPN match page was used only as a dated comparison source. API-Sports returned the historical RWC 2023 match, but its available plan rejected current Nations Championship 2026 game and standings queries.

## Access and permitted-use assessment

- No authentication was required by the limited public GET observations.
- No credentials, cookies, bypasses, alternate hosts, or prohibited scraping paths were used.
- World Rugby’s [official terms and conditions](https://www.world.rugby/terms-and-conditions) state that site content may be viewed/downloaded/printed for personal non-commercial use, and prohibit copying, storing, or using a computer program to collect or aggregate material from the site.
- The proof procedure is therefore gated behind `--confirm-permitted-access`, uses six fixed GETs, never paginates or crawls, stores metadata only, and never writes Supabase or canonical data. The flag is an operator assertion and must only be used after written provider permission is obtained.

## Evidence gaps

- No written permission, API agreement, commercial-use grant, authentication contract, SLA, or rate-limit guarantee.
- No deployment-runtime access proof.
- No complete historical coverage proof for all requested competitions, including all Lions tours and all relevant Springbok tests.
- No SofaScore international overlap fixture.
- No malformed, empty-success, timeout, or rate-limit response fixtures; inducing those states would not be appropriate without provider permission.
- Rankings are technically available but are out of scope for production ingestion in this phase.

## Reproduction policy

Do not run the network probe unless World Rugby has granted permission for the exact automated access method:

```bash
npm run provider:proof:world-rugby -- --confirm-permitted-access
```

Add `--write` only after permission is documented; it writes sanitized metadata to `tests/fixtures/providers/world-rugby/phase-8-probe.json`. The default command without confirmation must refuse before making a request.
