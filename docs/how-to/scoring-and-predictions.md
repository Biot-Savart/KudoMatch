# 🧮 How-To: Scoring Engine & Predictions

This guide explains prediction submission, lock mechanics, the scoring engine algorithm, and how to recalculate scores.

---

## ⚽ Prediction Mechanics

Users predict exact home and away goal scores for scheduled match fixtures in [`/predict`](app/predict/page.tsx:1).

- Scores are persisted in the `predictions` table via [`upsertPrediction()`](lib/queries/predictions.ts:60).
- Users can update their scoreline anytime prior to kickoff.

---

## 🔒 Kickoff Lock Protection

1. **Client Lock**:
   - [`MatchCard`](components/match-card.tsx:1) displays a countdown timer until kickoff.
   - Once `new Date() >= new Date(match.kickoff_time)`, the card switches to a locked state and disables user editing.
2. **Server & Database Trigger Lock**:
   - In [`supabase/migrations/20260820000002_create_predictions_table.sql`](supabase/migrations/20260820000002_create_predictions_table.sql), a PostgreSQL BEFORE INSERT/UPDATE trigger enforces that `matches.kickoff_time > timezone('utc'::text, now())`. Any late write is rejected at the database engine level.

---

## 🏆 Scoring Rules & Business Logic

When a match concludes (`status = 'finished'`), the scoring function in [`supabase/migrations/20260820000003_scoring_engine.sql`](supabase/migrations/20260820000003_scoring_engine.sql) evaluates each prediction:

| Tier                   | Points Awarded | Condition                                                         | Example                                      |
| ---------------------- | -------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| 🎯 **Exact Score**     | **3 Points**   | Predicted home and away score exactly matches final score         | Predicted: `2 - 1`, Final: `2 - 1`           |
| ⚡ **Goal Difference** | **2 Points**   | Correct match outcome (home/away win) AND correct goal difference | Predicted: `2 - 1` (+1), Final: `3 - 2` (+1) |
| 🛡️ **Outcome Only**    | **1 Point**    | Correct match winner or correct draw, but incorrect score/margin  | Predicted: `2 - 1`, Final: `1 - 0`           |
| ❌ **Incorrect**       | **0 Points**   | Wrong match outcome                                               | Predicted: `2 - 1`, Final: `0 - 2`           |

---

## 🔄 Recalculating Scores

If match scores are corrected or historic data is re-seeded, you can trigger a full point recalculation:

### Via Node CLI Script

```bash
npm run score:recalc
```

### Via SQL Function

```sql
SELECT public.recalculate_all_scores();
```

This updates:

1. `predictions.points_earned` for all scored predictions.
2. `profiles.total_points` for all users.
3. `pool_standings` for all private pools.
