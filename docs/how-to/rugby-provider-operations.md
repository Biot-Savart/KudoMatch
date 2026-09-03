# Rugby provider operations

Phase 7 adds one scheduler-neutral dispatcher for current fixtures, current results, and standings. The initial trigger is `GET`/`POST /api/cron/rugby-sync` with `Authorization: Bearer <CRON_SECRET>`.

## Local verification

Run the dispatcher directly from a server-side script or test with a service-role client. Do not put provider keys or the service-role key in browser code or cron query strings.

```bash
npx supabase db reset --local
npx supabase test db --local
npm run typecheck
npm test
npm run build
```

The dispatcher claims a bounded number of due targets, releases each target after the provider call, and isolates failures. Target timing is adaptive: 24 hours when a fixture is more than seven days away, six hours between one and seven days, one hour in the final 24 hours, and 20 minutes during the live/recently-kicked-off window. Completed matches use the 1-hour, 6-hour, and 24-hour verification cadence.

## Standings and mappings

Provider standings are retained in `edition_standing_sources`. Only a reviewed competitor mapping can populate `edition_standings`; unmapped rows remain source-only and appear in authorized diagnostics. Application code reads `competition_standings`, which exposes canonical fields and quality timestamps but no provider raw payload.

## Diagnostics and release sequence

`/admin/providers` is read-only and requires a fresh authenticated user whose `app_metadata.roles` contains `provider_admin`. Roll out Currie Cup and URC independently through disabled, observe-only, fixtures, completed results, standings, and fallback verification stages. To roll back, disable the competition-provider setting or the cron entry; retain the last verified canonical standings.
