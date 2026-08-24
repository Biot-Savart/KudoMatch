# 🚀 Getting Started with KudoMatch

This guide walks you through setting up **KudoMatch** (PredictorPro) locally, configuring environment variables, running migrations against Supabase, and seeding initial football fixtures.

---

## 📋 Prerequisites

- **Node.js**: v18.17.0+ or v20+
- **npm** or **pnpm**
- A **Supabase** project (free tier is sufficient)
- (Optional) **RapidAPI Key** for API-Football or **Football-Data.org Key** for real match ingestion

---

## ⚙️ Environment Configuration

1. Copy the example environment file:

   ```bash
   cp .env.example .env.local
   ```

2. Fill in your keys in [`.env.local`](.env.example:1):

   ```env
   # Supabase Public Keys
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

   # Supabase Service Key (for backend scripts / cron)
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # Football Ingestion API (Optional: seeder has fallback datasets)
   RAPIDAPI_KEY=your-rapidapi-key
   FOOTBALL_DATA_API_KEY=your-football-data-key

   # App URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Cron Secret Key
   CRON_SECRET=super-secret-cron-token

   # Notifications & Email (Optional for testing)
   RESEND_API_KEY=re_your_resend_key
   EMAIL_FROM=onboarding@resend.dev
   ```

---

## 🗄️ Database Setup & Migrations

KudoMatch manages all database tables, triggers, and Row Level Security (RLS) policies through SQL migrations in [`supabase/migrations/`](supabase/migrations/).

### Apply Migrations

You can push migrations to your remote Supabase project using the Supabase CLI:

```bash
# Link to your remote project
npm run db:link

# Push all SQL migrations
npm run db:push
```

### Seed Initial Fixtures

Seed the Premier League tournament, participating teams, and upcoming gameweek match fixtures:

```bash
# Seed teams and upcoming matchday fixtures
npm run seed

# (Optional) Seed realistic historic match data and sample user predictions
npm run seed:historic
```

---

## 💻 Running the Application

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- `/predict`: Matchday prediction center with lock countdowns and slide-over prediction drawer.
- `/leagues`: Pool browser, private league creation, invite codes, and pool banter chat rooms.
- `/profile`: User statistics, earned milestone badges, and notification preference controls.

---

## 🧪 Validating Your Installation

Run the complete Vitest test suite to verify frontend components, database queries, and scripts:

```bash
npm test
```
