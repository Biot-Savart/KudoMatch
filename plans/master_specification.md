# 📋 MASTER SPECIFICATION: "PredictorPro" (Modern Sports Predictor)

## 1. Project Vision & Core Philosophy

**Goal:** Build a blazing-fast, mobile-first, highly social sports prediction platform.
**Key Differentiators from Superbru:**

- **Zero Friction:** One-tap predictions, no page reloads.
- **Modern UI:** Dark mode by default, smooth animations, glassmorphism, clean typography.
- **Real-time:** Leaderboards update instantly as matches finish.
- **Social First:** Easy league creation, WhatsApp invite links, and in-league banter.

## 2. The Tech Stack

- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, **Shadcn UI** (for beautiful, accessible components), Framer Motion (for animations).
- **Backend & Database:** **Supabase** (PostgreSQL, Auth, Realtime, Edge Functions).
- **State Management:** Zustand (for global UI state) + TanStack Query (for server state/caching).
- **External Data:** API-Football (via RapidAPI) for fixtures, teams, and live scores.
- **Deployment:** Vercel (Frontend) + Supabase Cloud (Backend).

---

## 3. Database Schema (Supabase / PostgreSQL)

_Feed this exact structure to your AI when it builds the database._

```sql
-- 1. USERS (Handled mostly by Supabase Auth, but we need a public profile table)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  total_points INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TOURNAMENTS & TEAMS
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g., "Premier League 23/24"
  sport TEXT NOT NULL, -- e.g., "football", "rugby"
  season TEXT,
  status TEXT DEFAULT 'upcoming' -- upcoming, active, finished
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id),
  name TEXT NOT NULL,
  logo_url TEXT,
  short_name TEXT -- e.g., "MUN", "ARS"
);

-- 3. MATCHES
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id),
  matchday INT, -- e.g., Matchweek 1
  home_team_id UUID REFERENCES teams(id),
  away_team_id UUID REFERENCES teams(id),
  kickoff_time TIMESTAMPTZ NOT NULL,
  home_score INT,
  away_score INT,
  status TEXT DEFAULT 'scheduled' -- scheduled, live, finished, cancelled
);

-- 4. PREDICTIONS (User picks)
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  match_id UUID REFERENCES matches(id),
  predicted_home_score INT,
  predicted_away_score INT,
  predicted_winner TEXT, -- 'home', 'away', 'draw'
  points_earned INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- 5. POOLS (Private Leagues)
CREATE TABLE pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL, -- 6 char code for easy sharing
  creator_id UUID REFERENCES profiles(id),
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pool_members (
  pool_id UUID REFERENCES pools(id),
  user_id UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (pool_id, user_id)
);

-- 6. POOL STANDINGS (Calculated leaderboard)
CREATE TABLE pool_standings (
  pool_id UUID REFERENCES pools(id),
  user_id UUID REFERENCES profiles(id),
  total_points INT DEFAULT 0,
  wins INT DEFAULT 0, -- Grand slams
  rank INT,
  PRIMARY KEY (pool_id, user_id)
);
```

---

## 4. The Scoring Engine (Business Logic)

_This is the brain of the app. We will write this as a Supabase Edge Function or a Database Trigger._

**Standard Football Scoring Rules:**

1.  **Win Points (WP):**
    - Exact Score (e.g., predicted 2-1, actual 2-1) = **3 Points**
    - Correct Winner & Goal Difference (e.g., predicted 2-1, actual 3-2) = **2 Points**
    - Correct Winner only (e.g., predicted 2-1, actual 1-0) = **1 Point**
    - Incorrect = **0 Points**
2.  **Margin Points (MP):** (Optional for V1, but good to have). Awarded if the predicted goal difference matches the actual goal difference, but the exact score was wrong. (+1 Point).
3.  **Bonus Points (BP):** Awarded **only** to the user(s) in a specific _Private Pool_ who guessed the closest margin/score for that match. (+1 Point). _Note: If multiple users tie for closest, they all get the BP._
4.  **Grand Slam (GSP):** If a user gets the exact score (or correct winner) for **every** match in a specific Matchday/Round = **+5 Points**.

**Crucial Rule:** Predictions lock exactly at the `kickoff_time` of the _first_ match in that matchday. No changes allowed after that.

---

## 5. UI/UX Page Structure (Next.js App Router)

1.  **`/` (Dashboard / Home)**
    - Hero section: "Matchweek 12 is live! Make your picks."
    - Quick stats: Current streak, global rank.
    - List of upcoming matches with a quick "1 / X / 2" (Home/Draw/Away) toggle right on the card.
2.  **`/predict` (Detailed Predictions)**
    - Full list of matches for the current round.
    - Clicking a match opens a slide-over drawer to input exact scores.
    - Countdown timer to lock time.
3.  **`/leagues` (My Pools)**
    - Grid of private leagues the user is in.
    - "Create League" button.
    - "Join League" via invite code.
4.  **`/leagues/[id]` (League Detail)**
    - Leaderboard (Top 10, with the current user highlighted if they are lower).
    - Tabs: _Standings_, _Picks Comparison_ (see what friends picked), _Chat/Banter_.
5.  **`/profile` (User Stats)**
    - Avatar, username, total global points.
    - Badges (e.g., "5-match win streak", "First Grand Slam").

---

## 6. Step-by-Step Execution Plan (For your AI Coder)

When you open VS Code / Cursor, **do not ask the AI to build the whole thing at once.** It will fail. Feed it this spec, and then execute in these exact phases:

### Phase 1: Initialization & Auth

- Initialize Next.js with Tailwind and Shadcn UI.
- Set up Supabase project.
- Implement Supabase Auth (Email + Google).
- Create the `profiles` table and set up the trigger to auto-create a profile when a new user signs up.

### Phase 2: Data Ingestion (The API)

- Write a script to fetch the Premier League (or your chosen league) fixtures from API-Football.
- Seed the `tournaments`, `teams`, and `matches` tables in Supabase.
- _Tip for AI:_ Tell the AI to write a simple Node script to seed the DB, don't do it manually.

### Phase 3: The Prediction UI

- Build the Match Card component.
- Build the Prediction Drawer/Modal.
- Implement the logic to save predictions to the `predictions` table.
- Implement the "Lock" logic (disable inputs if `kickoff_time` has passed).

### Phase 4: The Scoring Engine

- Write a Supabase Edge Function (or cron job) that runs when a match finishes.
- It should fetch the final score, calculate WP/MP/GSP for all users who predicted that match, and update the `predictions` table.
- Update the user's `total_points` in the `profiles` table.

### Phase 5: Pools & Leaderboards

- Build the "Create Pool" and "Join Pool" flows.
- Write the SQL query to calculate the `pool_standings` (joining `pool_members`, `predictions`, and calculating pool-specific Bonus Points).
- Build the Leaderboard UI.

### Phase 6: Polish & Real-time

- Add Supabase Realtime to the Leaderboard so it updates live.
- Add Framer Motion animations to the UI.
- Mobile responsiveness check.

---
