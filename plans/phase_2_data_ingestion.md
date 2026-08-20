# Phase 2: Data Ingestion (The API) Architecture Plan

## Overview

Phase 2 builds the core data foundation for **KudoMatch** (PredictorPro): provisioning the PostgreSQL database schema for `tournaments`, `teams`, and `matches`, writing a high-reliability data ingestion & seed pipeline connected to API-Football (via RapidAPI) with a comprehensive fallback dataset, and wiring up server/client queries for real-time match retrieval.

---

## Architecture & Ingestion Flow

```mermaid
flowchart TD
    RapidAPI[API-Football / RapidAPI Fixtures API] --> IngestScript[Node Ingestion Script: scripts/seed-fixtures.ts]
    MockData[Built-in 20-Team Premier League Dataset] -.->|Fallback if no API key| IngestScript
    IngestScript -->|Supabase Service Role Client| DB[(PostgreSQL Database)]
    DB --> Tournaments[(tournaments)]
    DB --> Teams[(teams)]
    DB --> Matches[(matches)]
    Matches --> NextQueries[Data Access Layer: lib/queries/matches.ts]
    Teams --> NextQueries
    NextQueries --> DashboardPage[Dashboard / Home UI: app/page.tsx]
    NextQueries --> PredictPage[Detailed Predictions UI: app/predict/page.tsx]
```

---

## Detailed Implementation Steps

### 1. Database Schema & Migrations

- Create [`supabase/migrations/20260820000001_create_tournaments_teams_matches.sql`](supabase/migrations/20260820000001_create_tournaments_teams_matches.sql):
  - Table `tournaments`:
    - `id` (UUID PK default `gen_random_uuid()`)
    - `name` (TEXT NOT NULL)
    - `sport` (TEXT NOT NULL DEFAULT 'football')
    - `season` (TEXT)
    - `status` (TEXT DEFAULT 'upcoming')
    - `logo_url` (TEXT)
    - `external_id` (INT UNIQUE)
    - `created_at` (TIMESTAMPTZ DEFAULT now())
  - Table `teams`:
    - `id` (UUID PK default `gen_random_uuid()`)
    - `tournament_id` (UUID REFERENCES tournaments(id) ON DELETE SET NULL)
    - `name` (TEXT NOT NULL)
    - `short_name` (TEXT)
    - `logo_url` (TEXT)
    - `external_id` (INT UNIQUE)
    - `created_at` (TIMESTAMPTZ DEFAULT now())
  - Table `matches`:
    - `id` (UUID PK default `gen_random_uuid()`)
    - `tournament_id` (UUID REFERENCES tournaments(id) ON DELETE CASCADE)
    - `matchday` (INT)
    - `round` (TEXT)
    - `home_team_id` (UUID REFERENCES teams(id) ON DELETE CASCADE)
    - `away_team_id` (UUID REFERENCES teams(id) ON DELETE CASCADE)
    - `kickoff_time` (TIMESTAMPTZ NOT NULL)
    - `home_score` (INT)
    - `away_score` (INT)
    - `status` (TEXT DEFAULT 'scheduled')
    - `external_id` (INT UNIQUE)
    - `created_at` (TIMESTAMPTZ DEFAULT now())
    - `updated_at` (TIMESTAMPTZ DEFAULT now())
  - Enable Row Level Security (RLS) with public read policies on `tournaments`, `teams`, `matches`.

### 2. TypeScript Types Synchronization

- Update [`types/index.ts`](types/index.ts:1) to align `Tournament`, `Team`, and `Match` models with UUID primary keys and optional populated relationships.

### 3. API-Football Integration & Seed CLI

- Install `tsx` and `dotenv` dev dependencies for direct TypeScript script execution.
- Create [`scripts/seed-fixtures.ts`](scripts/seed-fixtures.ts:1):
  - Connects to Supabase using `SUPABASE_SERVICE_ROLE_KEY`.
  - Supports live API fetching via RapidAPI (`x-rapidapi-key` / `x-rapidapi-host: api-football-v1.p.rapidapi.com`).
  - Seamlessly falls back to a complete, realistic Premier League dataset (20 clubs with official logos and upcoming matchday fixtures) when offline or without API keys.
  - Implements idempotent upserts (no duplicate fixtures or teams on multiple runs).
- Add `"seed"` command in [`package.json`](package.json:1) (`npm run seed`).
- Update [`.env.example`](.env.example:1) with `RAPIDAPI_KEY` and `RAPIDAPI_HOST`.

### 4. Data Access Layer & Live Dashboard Integration

- Create [`lib/queries/matches.ts`](lib/queries/matches.ts:1) and [`lib/queries/tournaments.ts`](lib/queries/tournaments.ts:1) with caching and Supabase queries.
- Update [`app/page.tsx`](app/page.tsx:1) to query live matches from Supabase using React Query / RSC.

---

## ⭐️ Seeding Historical Data for End-to-End Testing

To test the application's prediction interfaces, scoring engine, real-time sync, and social pools/standings, a dedicated historical seeder is provided.

### 1. Seeding Command

You can seed a fully-populated, realistic testing state using a single command:

```bash
npm run seed:historic
```

### 2. Seeding Content

Running this command provisions:

- **Premier League 24/25 Tournament & 20 EPL Teams** with official API-Football logos and short names.
- **7 Mock Users** with distinct profiles, realistic avatars, and emails (`@kudomatch.test`):
  - `@marcus_striker`, `@sarah_tactician`, `@alex_gk`, `@sam_analytics`, `@elena_scout`, `@dave_pundit`, `@kudo_champ`.
- **Matchweek 10 (10 Finished Matches)** with authentic past scores.
- **Matchweek 11 (10 Finished Matches)** with authentic past scores.
- **Matchweek 12 (10 Upcoming/Scheduled Matches)** with future kickoff times, ready for predictions.
- **155 Scored Predictions** mapped to Matchweeks 10 & 11 with varied point outcomes (3pts exact, 2pts goal-diff, 1pt winner-only, 0pts incorrect), populated via a transaction workflow to bypass locking triggers.
- **4 Custom Leagues / Pools** with invite codes:
  - `PREM25` - _Premier League Official Hub_ (Public, 8 members)
  - `WARRIOR` - _Weekend Warriors_ (Private, 7 members)
  - `CHAMP9` - _The Champions Circle_ (Private, 4 members)
  - `BANTER` - _Office Banter League_ (Private, 8 members)
- **Automatic Points Sync** via Postgres triggers and `recalculate_all_scores()` to populate user total points, streaks, badges, and league stand-alone leaderboards!
