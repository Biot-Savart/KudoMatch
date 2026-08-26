# ADR 0001: Rugby Union Data Provider Selection & Ingestion Architecture

- **Status**: Approved
- **Date**: 2026-08-25
- **Context**: KudoMatch is expanding from Football (Premier League) to Multi-Sport support starting with Rugby Union (Six Nations).

## 1. Provider Evaluation & Decision

### Evaluated Options:

1. **API-Sports (API-Rugby / v1.rugby.api-sports.io via Direct or RapidAPI)** - **SELECTED LAUNCH PROVIDER**
   - **Coverage**: Comprehensive coverage of major international and club competitions: Six Nations (League ID 11), The Rugby Championship, United Rugby Championship (URC), European Rugby Champions Cup, Gallagher Premiership, Top 14.
   - **Identity Stability**: Distinct and immutable integer IDs for leagues (`11`), seasons (`2025`, `2026`), teams (`England: 16`, `France: 17`, `Ireland: 18`, `Italy: 19`, `Scotland: 20`, `Wales: 21`), and games (`game.id`).
   - **Timestamps**: Explicit ISO-8601 UTC strings (`date`) and Unix timestamps (`timestamp`).
   - **Status Mapping**:
     - `NS` -> `scheduled`
     - `1H`, `2H`, `HT`, `ET`, `BT` -> `live`
     - `FT`, `AET`, `AWD` -> `finished` (with revision tracking)
     - `POST` -> `postponed`
     - `CANC` -> `cancelled`
     - `ABD`, `INTR` -> `abandoned`
   - **Rate Limits & Headers**: Standard `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` response headers.
   - **Licensing/Media**: Team and competition crest/logo URLs included with HTTPS endpoints.

2. **RugbyPass / Unofficial Scraping** - **REJECTED**
   - Lacks SLA, structured schemas, change control, and rate limit guarantees.

3. **Manual Operator Direct Entry** - **DOCUMENTED FALLBACK**
   - For emergency corrections or provider outages, manual operator overrides take highest precedence in canonical resolution.

## 2. Ingestion Rules & Data Authority

- Every external entity reference is recorded in `public.external_entity_refs` keyed by `(provider, entity_kind, external_key)`.
- No fuzzy name matching is permitted in production.
- Manual corrections outrank all external provider data.
- Provisional live updates never settle markets; only verified final states (`FT`, `AET`, `AWD`) trigger scoring settlement.
- Distributed leases (`public.ingestion_run_leases`) guarantee single-flight execution.
