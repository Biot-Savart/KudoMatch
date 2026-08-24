# 📚 KudoMatch Documentation Hub

Welcome to the comprehensive technical documentation for **KudoMatch** (PredictorPro).

---

## 🗺️ Documentation Map

| Category          | Document                                                             | Description                                                                                    |
| ----------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Quickstart**    | [Getting Started](getting-started.md)                                | Setup instructions, environment configuration, database seeding, and running locally.          |
| **Architecture**  | [Architecture & Security](architecture-overview.md)                  | Tech stack breakdown, state management, entity relations, and Row Level Security (RLS) models. |
| **Playbook**      | [Database Backup & Maintenance](database-backup-and-maintenance.md)  | Backup procedures, disaster recovery (PITR), index bloat diagnostics, and vacuum routines.     |
| **How-To Guides** | [Notifications & Web Push](how-to/notifications-and-push.md)         | Web push setup, VAPID key generation, Resend email digest integration, and simulated testing.  |
| **How-To Guides** | [Scoring Engine & Rules](how-to/scoring-and-predictions.md)          | Prediction locking rules, point calculation logic, and batch recalculation scripts.            |
| **How-To Guides** | [Fixtures & Live Score Sync](how-to/fixtures-and-live-scores.md)     | Live score ingestion from Football APIs, fallback simulations, and fixture management.         |
| **How-To Guides** | [Pools, Banter Chat & H2H](how-to/pools-and-chat.md)                 | Creating private leagues, invite codes, realtime banter rooms, and Head-to-Head matrices.      |
| **How-To Guides** | [Cron Jobs & Background Automations](how-to/cron-and-automations.md) | `pg_cron` setup, Vercel Cron routes, and `CRON_SECRET` authorization tokens.                   |
| **How-To Guides** | [Testing & CI Pipeline](how-to/testing-and-ci.md)                    | Running Vitest test suites, test coverage, and GitHub Actions continuous integration.          |

---

## 💡 Quick Command Reference

```bash
# Start local development server
npm run dev

# Run Vitest test suite
npm test

# Verify TypeScript type correctness
npm run typecheck

# Simulate kickoff reminder notifications
npm run notifications:kickoff:simulate

# Simulate weekly performance digest emails
npm run notifications:digest:simulate

# Synchronize match results with fallback simulation
npm run scores:simulate-sync

# Create a full database JSON backup
npm run db:backup
```
