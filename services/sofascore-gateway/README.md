# SofaScore Gateway

This is the internal, server-side transport boundary for the Phase 4
SofaScore provider. It exposes only fixed Rugby Union routes and never accepts
an arbitrary upstream URL or caller-supplied upstream headers.

`/health` is unauthenticated. Every `/v1/*` route requires the
`x-internal-api-key` header matching the server-only `INTERNAL_API_KEY`
environment variable. `SOFASCORE_BASE_URL` is deployment configuration only;
it is not controllable through requests.

Run locally:

```bash
docker build -t kudomatch-sofascore-gateway services/sofascore-gateway
docker run --rm -p 8080:8080 -e INTERNAL_API_KEY=local-dev-key kudomatch-sofascore-gateway
```

The gateway uses `curl_cffi` with Chrome impersonation for SofaScore transport,
bounded 20-second requests, and at most two retries for rate-limit/server,
timeout, or network failures.
