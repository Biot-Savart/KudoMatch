# 📡 How-To: Fixtures & Live Scores Sync

This guide explains how match fixtures are ingested, synced with live football data providers, and simulated during testing.

---

## 🏗️ Fixtures Architecture

Fixtures are stored in the `matches` table and linked to the `teams` and `tournaments` tables.

- `external_id`: Represents the fixture ID from API-Football / Football-Data.org for deterministic sync matching.
- `status`: Transitions from `'scheduled'` ➔ `'live'` ➔ `'finished'`.

---

## 📥 Seeding Initial Fixtures

To populate Premier League tournaments, teams, and fixture schedules:

```bash
# Ingest live fixtures via RapidAPI / Football-Data.org (with fallback data)
npm run seed

# Seed realistic historic results and dummy user predictions
npm run seed:historic
```

---

## ⚡ Synchronizing Live Scores

The live score sync engine is located in [`scripts/fetch-live-scores.ts`](scripts/fetch-live-scores.ts:1).

### Execution Modes

1. **Live Provider Mode** (When `FOOTBALL_DATA_API_KEY` or `RAPIDAPI_KEY` is present):

   ```bash
   npm run scores:sync
   ```

   Queries the provider API for updated match status and scorelines, updating any active or elapsed fixtures.

2. **Simulation Mode** (For offline testing & development):
   ```bash
   npm run scores:simulate-sync
   ```
   Randomly assigns realistic scorelines and marks fixtures as live or finished, triggering the scoring engine automatically.

---

## 🤖 Automated Background Sync

You can invoke live score sync through the cron route handler at [`/api/cron/fetch-live-scores`](app/api/cron/fetch-live-scores/route.ts:1):

```bash
curl "http://localhost:3000/api/cron/fetch-live-scores?simulate=true"
```
