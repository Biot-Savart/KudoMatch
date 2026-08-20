# ⚽ KudoMatch (PredictorPro)

KudoMatch is a blazing-fast, mobile-first, and highly social sports prediction platform designed to deliver zero friction, gorgeous modern visual ergonomics, and real-time social league engagement.

---

## 🚀 Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Shadcn UI, Framer Motion
- **Backend & Database**: Supabase (PostgreSQL, Realtime Auth, Edge Functions)
- **State Management**: Zustand (Global UI State) + TanStack Query v5 (Server-side Cache)
- **External API Data**: API-Football via RapidAPI (Premier League fixtures, rosters, live feeds)

---

## 🛠️ Phase-by-Phase Roadmap

### ✅ Phase 1: Initialization & Auth (COMPLETED)

- Scaffolding of Next.js 14 App Router, Tailwind, and Shadcn configuration.
- Setup of Supabase SSR Browser and Server client cookie management helpers.
- Next.js Auth Middleware implementation with active session refreshing and route protection.
- SQL Migrations for public user `profiles` table with automatic deduped username generation and Google OAuth metadata fallback triggers.
- Premium visual interfaces: login, sign-up, password recovery forms, custom responsive animated glassmorphic navigation bars, interactive profile management dashboard, and dashboard quick outcome cards.

### ⏳ Phase 2: Data Ingestion (NEXT)

- Seed tournament, team, and matchweek details.
- Integration scripts for RapidAPI API-Football data retrieval.

### ⏳ Phase 3: Detailed Prediction Interfaces

- Live slide-over match cards and prediction drawers.
- Kickoff time countdown and match lock logic.

### ⏳ Phase 4: Scoring Engine

- SQL triggers and edge functions to update WP (Win Points), MP (Margin Points), and GSP (Grand Slam Points) automatically on final scores.

### ⏳ Phase 5: Leagues, Pools & Standings

- Create, join, and share pools with custom standings math.

---

## 💻 Getting Started Locally

### 1. Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed on your system.

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Duplicate the environment template file:

```bash
cp .env.example .env.local
```

Fill in your Supabase connection parameters in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 4. Database Setup

Execute the initial schema migration located at [`supabase/migrations/20260820000000_create_profiles.sql`](supabase/migrations/20260820000000_create_profiles.sql) within your Supabase project's SQL Editor.

### 5. Launch Local Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application locally.

---

## 📂 Folder Structure

```text
├── app/                  # Next.js App Router Pages and Handlers
│   ├── auth/             # PKCE Exchange Endpoint Router Callback
│   ├── login/            # Premium Sign In Page
│   ├── signup/           # Premium Registration Page
│   ├── reset-password/   # Email Verification Reset and Change Form
│   ├── profile/          # Interactive Account Profile & Settings
│   ├── globals.css       # Tailwind Directives & Custom Variables
│   └── layout.tsx        # Provider Shell and Frame Layout wrapping
├── components/           # Reusable Application React Components
│   ├── ui/               # Modular Shadcn style core interface components
│   ├── auth-card.tsx     # Sign-up and login UI block with Google OAuth hook
│   ├── navbar.tsx        # Fully animated mobile-first header
│   └── theme-provider.tsx# Theme support wrap
├── lib/                  # Library hooks and modules
│   ├── supabase/         # Client, Server, and Middleware session definitions
│   └── utils.ts          # Styles concatenation wrapper
└── supabase/
    └── migrations/       # SQL Database Migrations and Triggers
```
