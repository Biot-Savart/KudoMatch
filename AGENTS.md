# 🤖 AI Agent System Manual: KudoMatch

Welcome, fellow agent! This document is designed to guide future AI system developers and software agents in building, maintaining, and scaling the **KudoMatch** (PredictorPro) application. It enforces structural integrity, prevents configuration drift, and ensures code consistency.

---

## 🏛️ System Architecture

KudoMatch is a mobile-first sports predictor platform built using the following core paradigms:

- **Frontend**: Next.js 14+ (App Router) with React Server Components (RSC) by default for pages, and `"use client"` selectively for high-fidelity interactive elements (forms, quick selectors, slide-over panels).
- **Styling**: Tailwind CSS + Shadcn UI framework elements + custom glassmorphism layers (`glass-card`, `glass-nav`, `glass-drawer` declared in [`app/globals.css`](app/globals.css:57)).
- **Authentication**: Cookie-based server and browser clients managed via `@supabase/ssr` (helpers reside in [`lib/supabase/`](lib/supabase/)).
- **Database**: Supabase PostgreSQL. High-performance constraints, automatic trigger integrations, and Row-Level Security (RLS) are handled directly in migration SQL scripts.
- **Client State**:
  - `Zustand` for lightweight global UI states (helpers reside in [`store/use-ui-store.ts`](store/use-ui-store.ts)).
  - `TanStack Query` (React Query) for server-state caching, optimistic updates, and background refreshing.

---

## 📂 Codebase Navigation & Key Files

Here is where critical modules reside:

- **Database Migrations**: [`supabase/migrations/`](supabase/migrations/) (SQL file sequences).
- **Supabase Clients**:
  - Browser Client: [`lib/supabase/client.ts`](lib/supabase/client.ts) (for client components).
  - Server Client: [`lib/supabase/server.ts`](lib/supabase/server.ts) (for Server Components, server actions, and route handlers).
  - Middleware Session: [`lib/supabase/middleware.ts`](lib/supabase/middleware.ts) (for session token refreshes and page router redirects).
- **Unified Types**: [`types/index.ts`](types/index.ts) (Declarations for `Profile`, `Tournament`, `Team`, `Match`, `Prediction`, and `Pool` types).
- **Zustand State Store**: [`store/use-ui-store.ts`](store/use-ui-store.ts) (Synchronous states for prediction drawers, menus, and notification popups).
- **Cursor System Rules**: [`.cursorrules`](.cursorrules) (Instructs other AI models and agents on coding guidelines).
- **Authentication Forms**: [`components/auth-card.tsx`](components/auth-card.tsx) (Email/Password registration, Login, and Google OAuth).
- **Core Frame**: [`components/navbar.tsx`](components/navbar.tsx) (Fully responsive header with points tally and account management drawer).
- **Shared UI Elements**: [`components/ui/`](components/ui/) (Buttons, Cards, Forms, Inputs, Labels, Tabs).

---

## 🧭 Instructions for Phase-by-Phase Development

When tasked to implement subsequent phases, adhere strictly to these rules:

### 📡 Phase 2: Data Ingestion (Next Step)

- **Objective**: Seed tournament data and fetch live Premier League fixtures from API-Football via RapidAPI.
- **Guidelines**:
  1. Write a Node.js seed script (e.g. `scripts/seed-fixtures.ts` or `.js`) that calls the API, maps JSON properties to PostgreSQL schemas, and inserts into tournament, team, and match tables using the `service_role` client helper.
  2. Create SQL tables for:
     - `tournaments` (id, name, country, season, logo_url)
     - `teams` (id, name, short_name, logo_url)
     - `matches` (id, tournament_id, home_team_id, away_team_id, kickoff_time, gameweek/round, status, home_goals, away_goals)
  3. Ensure all foreign key constraints are established cleanly.

### ⚽ Phase 3: Detailed Prediction Interfaces

- **Objective**: Enable full scoreline input (Home goals and Away goals).
- **Guidelines**:
  1. Build a custom `MatchCard` with a trigger opening a slide-over `PredictionDrawer` or Modal.
  2. Implement kickoff lock verification: if the `kickoff_time` has elapsed, write-access must be completely blocked on the frontend, and validated/rejected on the database using check constraints or insert triggers.
  3. Save predictions to the `predictions` table (id, user_id, match_id, predicted_home_goals, predicted_away_goals, points_awarded, created_at, updated_at) with RLS ensuring users can only write/update their own rows.

### 🧮 Phase 4: Scoring Engine

- **Objective**: Match scoreline calculations and point tallies.
- **Guidelines**:
  1. Create database functions/triggers (or cron-based Node workers) executing when a match score finishes updates (`status = 'finished'`).
  2. Apply the **Business Logic Scoring Rules**:
     - **Exact Score** = 3 Points (e.g., predicted 2-1, actual 2-1)
     - **Winner & Goal Difference** = 2 Points (e.g., predicted 2-1, actual 3-2)
     - **Winner Only** = 1 Point (e.g., predicted 2-1, actual 1-0)
     - **Incorrect** = 0 Points
     - **Margin Match (+1 optional)**: Goal difference matches but outcome score was wrong (e.g., predicted 1-0, actual 2-1).
  3. Trigger total global points tally updates on public `profiles` table.

### 🏆 Phase 5: Leagues, Pools & Standings

- **Objective**: Create and join private pools.
- **Guidelines**:
  1. Setup tables for `pools` (id, name, created_by, invite_code) and `pool_members` (pool_id, user_id).
  2. Write high-performance views or materialized joins calculating pool standings (summing participant points specifically for matches in that pool and determining closest margin bonus points).

---

## 💅 Coding Standards & Style Conventions

1. **Tailwind Styling**: Prefer class clustering on elements. Do not split layout rules across multiple inline structures. Leverage the `glass-card` classes for consistent glassmorphism.
2. **TypeScript Integrity**: Avoid typing with `any` unless absolutely necessary (such as legacy browser context states). Use robust type interfaces.
3. **Data Fetching**: Prefer TanStack Query `useQuery` and `useMutation` hooks on the client for responsive optimistic caching, preventing page reloads.
4. **Git Commits**: Write reviewer-friendly, semantic, atomic commits:
   - `feat(...)`: for code modifications or feature structures.
   - `fix(...)`: for target fixes.
   - `docs(...)`: for documentation.
   - `refactor(...)`: for code cleans without feature alterations.

---

## 🛠️ Testing & Validating Build

Before declaring a phase complete, run the following verification pipeline in the terminal:

```bash
# Verify TypeScript validity and build compatibility
npm run build
```

Ensure all files compile with zero warnings before submitting tasks.
