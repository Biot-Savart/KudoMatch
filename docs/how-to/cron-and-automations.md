# 🤖 How-To: Cron Jobs & Background Automations

This guide details the automated background pipelines running in KudoMatch, including automated score checks, kickoff warnings, and digest emails.

---

## 🛠️ Automated Routes Overview

| Route                                                                                | Schedule / Interval           | Purpose                                                                                                  | Handler Script                                                             |
| ------------------------------------------------------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`/api/cron/fetch-live-scores`](app/api/cron/fetch-live-scores/route.ts:1)           | Every 10 min during matchdays | Synchronizes live score updates from API-Football / Football-Data.org and triggers scoring calculations. | [`scripts/fetch-live-scores.ts`](scripts/fetch-live-scores.ts:1)           |
| [`/api/cron/send-kickoff-reminders`](app/api/cron/send-kickoff-reminders/route.ts:1) | Every 15 min                  | Checks for unpredicted fixtures starting in <60 mins and delivers push/email reminders.                  | [`scripts/send-kickoff-reminders.ts`](scripts/send-kickoff-reminders.ts:1) |
| [`/api/cron/send-weekly-digest`](app/api/cron/send-weekly-digest/route.ts:1)         | Every Monday at 09:00 UTC     | Sends weekly performance summaries and upcoming gameweek previews.                                       | [`scripts/send-weekly-digest.ts`](scripts/send-weekly-digest.ts:1)         |

---

## 🔐 Securing Cron Endpoints with `CRON_SECRET`

To prevent unauthorized invocations, all cron endpoints validate the authorization token:

- **Via Bearer Header**:
  ```http
  Authorization: Bearer YOUR_CRON_SECRET_KEY
  ```
- **Via Query Parameter**:
  ```http
  GET /api/cron/send-kickoff-reminders?secret=YOUR_CRON_SECRET_KEY
  ```

If `CRON_SECRET` is configured on the server, requests without matching credentials are automatically rejected with HTTP 401.

---

## ⏰ Deployment Options

### Option 1: Vercel Cron

Configured via [`vercel.json`](vercel.json:1):

```json
{
	"crons": [
		{
			"path": "/api/cron/fetch-live-scores",
			"schedule": "*/10 * * * *"
		},
		{
			"path": "/api/cron/send-kickoff-reminders",
			"schedule": "*/15 * * * *"
		},
		{
			"path": "/api/cron/send-weekly-digest",
			"schedule": "0 9 * * 1"
		}
	]
}
```

### Option 2: Supabase `pg_cron` & `pg_net`

Defined in [`supabase/migrations/20260820000005_pg_cron_and_automation.sql`](supabase/migrations/20260820000005_pg_cron_and_automation.sql) and initialized via:

```bash
npm run cron:setup
```

`pg_cron` invokes Edge Functions or HTTP API routes via the `net.http_post()` extension.
