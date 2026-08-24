# 🏆 How-To: Pools, Banter Chat & H2H

This guide covers private league pools, invite codes, head-to-head matchup comparisons, and realtime pool chat.

---

## 👥 Creating & Joining Pools

Private pools allow friends and colleagues to compete against each other in custom leaderboards.

1. **Creating a Pool**:
   - Modal trigger in [`/leagues`](app/leagues/page.tsx:1) via [`CreatePoolModal`](components/create-pool-modal.tsx:1).
   - Generates a unique 6-character alphanumeric invite code using the PostgreSQL function `generate_unique_pool_invite_code()`.
2. **Joining a Pool**:
   - Modal trigger via [`JoinPoolModal`](components/join-pool-modal.tsx:1).
   - Verifies the invite code and inserts the user into `pool_members` with default `'member'` role.

---

## 💬 Real-Time Pool Banter Chat

Each private pool features an integrated live banter chat tab in [`/leagues/[id]`](app/leagues/[id]/page.tsx:1).

- **Component**: [`PoolChat`](components/pool-chat.tsx:1)
- **Realtime Channel**: Subscribes to Postgres `INSERT` events on the `pool_messages` table via Supabase Realtime broadcast channels (`pool:${poolId}:messages`).
- **Security**: Strict RLS policies ensure only active members of that specific pool can view or post messages. Pool creators have administrative rights to moderate/delete messages.

---

## ⚔️ Head-to-Head (H2H) Comparisons

The **Head-to-Head Matrix** panel in [`HeadToHead`](components/head-to-head.tsx:1) allows users to select any member in their pool and compare:

1. **Overall Stats**: Total points, exact score count, win/loss/draw comparison.
2. **Side-by-Side Picks Matrix**: Displays both users' predictions on locked/completed fixtures, highlighting exact scores and point differences.
3. **Lock Protection**: Unlocked future matches hide the opponent's prediction until the fixture kicks off.
