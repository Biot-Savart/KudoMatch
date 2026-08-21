# 🚀 Phase 8: Enhancements, Usability, & Automations

This document outlines the planned improvements for **KudoMatch** (PredictorPro) focusing on usability, core interactive features, and backend automations.

---

## 🎯 Usability Enhancements

### 1. Dynamic Matchweek Selection

Instead of hardcoding `matchday = 12` (as currently configured in [`app/predict/page.tsx`](app/predict/page.tsx:26)), the application should automatically determine and set the current active matchweek based on kickoff times.

- **Implementation**:
  - Add a database query or an RPC function to fetch the earliest upcoming matchweek or the currently active matchweek.
  - Implement a matchweek switcher dropdown in `/predict` and `/leagues/[id]` to allow historical/future browsing.

### 2. Loading Skeletons

To improve perceived performance and minimize layout shifts, replace basic spinners with modern Tailwind skeleton cards matching the visual shape of `MatchCard` and leaderboards.

- **Implementation**:
  - Create a reusable `components/ui/skeleton-match-card.tsx`.
  - Use these skeleton components on `/predict` and `/leagues/[id]` while TanStack Query is fetching details.

### 3. Error Boundaries & Fallbacks

Ensure that database errors or API failures do not result in blank pages or infinite loading loops.

- **Implementation**:
  - Implement React Error Boundaries on key routes (`/predict`, `/leagues/[id]`, `/profile`).
  - Show context-specific recovery prompts (e.g., "Retry loading matches").

### 4. Accessibility (a11y) & Responsiveness

Improve accessibility for a broader user base and optimize layout flow for highly active mobile screens.

- **Implementation**:
  - Add explicit ARIA labels on forms, drawer controls, and prediction buttons.
  - Test and verify keyboard focus controls on the `PredictionDrawer`.

---

## 🚀 Feature Enhancements

### 1. Push Notifications

Keep users engaged with timely alerts before lock times and right when match scores are settled.

- **Trigger Points**:
  - **Match Starting**: Sent 15 minutes before kickoff for unpredicted matches.
  - **Score Resolved**: Notify users when predictions are scored, showing points earned.
  - **Social Activity**: Notify users when a friend joins their private pool.
- **Technology**: Integration via Web Push API or OneSignal through Supabase Edge Functions.

### 2. Real-time Banter & Pool Chat

Build a lightweight chat system directly inside the private pools detailed tab.

- **Schema**:

  ```sql
  CREATE TABLE pool_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Enable RLS and real-time subscription for this table
  ALTER TABLE pool_messages ENABLE ROW LEVEL SECURITY;
  ```

- **UI Tab**: Implement inside [`app/leagues/[id]/page.tsx`](app/leagues/[id]/page.tsx) with Supabase Realtime subscriptions to listen to new inserts.

### 3. Achievements & Badges

Game-ify the prediction experience with automated profiles milestones.

- **Examples**:
  - 🎯 **Sharpshooter**: Got an exact score.
  - 🔥 **On Fire**: 3-match winner prediction streak.
  - 👑 **Champion**: Placed #1 in a private pool.
- **Implementation**: Database triggers on score calculations that insert earned badges into a `user_badges` table.

### 4. Head-to-Head (H2H) Comparison

Allow users inside a pool to select any other member and view a side-by-side pick matrix of past, current, and future locked matches.

---

## 🤖 Automation Enhancements

### 1. Automated Match Result Ingestion

Implement a background cron job to regularly update match results and trigger the scoring engine without manual script invocation.

- **Implementation**:
  - Create a Supabase Edge Function `fetch-live-scores`.
  - Use Supabase `pg_cron` (or an external cron provider like Vercel Cron/Upstash) to invoke the function every 10 minutes during matchdays.
  - Once match status transitions to `'finished'`, call the database scoring trigger automatically.

### 2. Live Standings Materialized View & Recalculation

Automate real-time updates of pool standings and profiles leaderboards whenever a prediction is scored.

- **Trigger Integration**:
  ```sql
  CREATE OR REPLACE FUNCTION trigger_recalculate_standings()
  RETURNS TRIGGER AS $$
  BEGIN
    -- Automatically refresh leaderboards for affected pools
    PERFORM recalc_pool_standings(NEW.match_id);
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```

---

## 📅 Phased Implementation Plan

### 🚀 Phase 8.1: Core Usability & Polish

- [ ] Determine dynamic current matchweek inside `/predict`.
- [ ] Implement Skeleton Screens for match card arrays.
- [ ] Setup global React error boundaries.

### 🚀 Phase 8.2: Database & Automation

- [x] Setup `pg_cron` pipeline for automated fixture completion checks.
- [x] Integrate real-time trigger for pool standings recalculation on match score resolution.
- [x] Establish standard DB backup routines.

### 🚀 Phase 8.3: Social & Banter System

- [ ] Implement `pool_messages` table and Supabase RLS.
- [ ] Add Live Chat tab inside [`app/leagues/[id]/page.tsx`](app/leagues/[id]/page.tsx).
- [ ] Build Head-to-Head prediction comparison panel.

### 🚀 Phase 8.4: Notifications & Engagement

- [ ] Set up Web Push notifications for matchday kickoff warnings.
- [ ] Implement automated weekly summary emails using Resend/SendGrid.
