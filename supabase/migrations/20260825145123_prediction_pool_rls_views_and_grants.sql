-- ============================================================================
-- Migration 3: RLS Policies, Pre-Lock Privacy, and Security Grants
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENABLE ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table public.scoring_rulesets enable row level security;
alter table public.scoring_rule_tiers enable row level security;
alter table public.event_markets enable row level security;
alter table public.predictions enable row level security;
alter table public.market_results enable row level security;
alter table public.pools enable row level security;
alter table public.pool_members enable row level security;
alter table public.pool_messages enable row level security;

-- ----------------------------------------------------------------------------
-- 2. SCORING RULESETS & TIERS POLICIES
-- ----------------------------------------------------------------------------

create policy "scoring_rulesets_read_active"
  on public.scoring_rulesets
  for select
  to anon, authenticated
  using (
    is_active = true and
    exists (
      select 1 from public.sports s
      where s.slug = scoring_rulesets.sport_slug
        and s.is_active = true
    )
  );

create policy "scoring_rule_tiers_read"
  on public.scoring_rule_tiers
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.scoring_rulesets sr
      where sr.id = scoring_rule_tiers.ruleset_id
        and sr.is_active = true
        and exists (
          select 1 from public.sports s
          where s.slug = sr.sport_slug
            and s.is_active = true
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 3. EVENT MARKETS POLICIES
-- ----------------------------------------------------------------------------

create policy "event_markets_read_visible"
  on public.event_markets
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      join public.competition_editions ce on ce.id = e.edition_id
      join public.competitions c on c.id = ce.competition_id
      join public.sports s on s.slug = c.sport_slug
      where e.id = event_markets.event_id
        and s.is_active = true
        and c.is_active = true
    )
  );

-- ----------------------------------------------------------------------------
-- 4. PREDICTIONS POLICIES (PRE-LOCK SECRECY & OWNERSHIP)
-- ----------------------------------------------------------------------------

create policy "predictions_select_own_or_locked_cohort"
  on public.predictions
  for select
  to authenticated
  using (
    -- User can always view their own prediction
    (auth.uid() = user_id)
    or
    -- Other users can view only when market is locked/settled/void AND share an active pool
    (
      exists (
        select 1 from public.event_markets em
        where em.id = predictions.event_market_id
          and (em.status in ('locked', 'settled', 'void') or now() >= em.locks_at)
      )
      and
      exists (
        select 1
        from public.pool_members pm1
        join public.pool_members pm2 on pm1.pool_id = pm2.pool_id
        where pm1.user_id = auth.uid()
          and pm1.left_at is null
          and pm2.user_id = predictions.user_id
          and pm2.left_at is null
      )
    )
  );

create policy "predictions_insert_own"
  on public.predictions
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
  );

create policy "predictions_update_own"
  on public.predictions
  for update
  to authenticated
  using (
    auth.uid() = user_id
  )
  with check (
    auth.uid() = user_id
  );

create policy "predictions_delete_own"
  on public.predictions
  for delete
  to authenticated
  using (
    auth.uid() = user_id
  );

-- ----------------------------------------------------------------------------
-- 5. MARKET RESULTS POLICIES
-- ----------------------------------------------------------------------------

create policy "market_results_select_public"
  on public.market_results
  for select
  to anon, authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- 6. POOLS POLICIES
-- ----------------------------------------------------------------------------

create policy "pools_select_public_or_member"
  on public.pools
  for select
  to anon, authenticated
  using (
    (is_private = false)
    or
    (created_by = auth.uid())
    or
    exists (
      select 1 from public.pool_members pm
      where pm.pool_id = pools.id
        and pm.user_id = auth.uid()
        and pm.left_at is null
    )
  );

create policy "pools_update_admin"
  on public.pools
  for update
  to authenticated
  using (
    exists (
      select 1 from public.pool_members pm
      where pm.pool_id = pools.id
        and pm.user_id = auth.uid()
        and pm.role = 'admin'
        and pm.left_at is null
    )
  )
  with check (
    exists (
      select 1 from public.pool_members pm
      where pm.pool_id = pools.id
        and pm.user_id = auth.uid()
        and pm.role = 'admin'
        and pm.left_at is null
    )
  );

-- ----------------------------------------------------------------------------
-- 7. POOL MEMBERS POLICIES
-- ----------------------------------------------------------------------------

create policy "pool_members_select_visible_pools"
  on public.pool_members
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.pools p
      where p.id = pool_members.pool_id
        and (
          p.is_private = false
          or p.created_by = auth.uid()
          or exists (
            select 1 from public.pool_members my_pm
            where my_pm.pool_id = p.id
              and my_pm.user_id = auth.uid()
              and my_pm.left_at is null
          )
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 8. POOL MESSAGES POLICIES
-- ----------------------------------------------------------------------------

create policy "pool_messages_select_active_members"
  on public.pool_messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.pool_members pm
      where pm.pool_id = pool_messages.pool_id
        and pm.user_id = auth.uid()
        and pm.left_at is null
    )
  );

create policy "pool_messages_insert_active_members"
  on public.pool_messages
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.pool_members pm
      where pm.pool_id = pool_messages.pool_id
        and pm.user_id = auth.uid()
        and pm.left_at is null
    )
  );

create policy "pool_messages_delete_own"
  on public.pool_messages
  for delete
  to authenticated
  using (
    auth.uid() = user_id
  );

-- ----------------------------------------------------------------------------
-- 9. GRANTS & REVOCATIONS
-- ----------------------------------------------------------------------------

-- Revoke all default table permissions from anon/authenticated
revoke all on public.scoring_rulesets from anon, authenticated;
revoke all on public.scoring_rule_tiers from anon, authenticated;
revoke all on public.event_markets from anon, authenticated;
revoke all on public.predictions from anon, authenticated;
revoke all on public.market_results from anon, authenticated;
revoke all on public.pools from anon, authenticated;
revoke all on public.pool_members from anon, authenticated;
revoke all on public.pool_messages from anon, authenticated;

-- Grant SELECT on read-only tables to anon & authenticated
grant select on public.scoring_rulesets to anon, authenticated;
grant select on public.scoring_rule_tiers to anon, authenticated;
grant select on public.event_markets to anon, authenticated;
grant select on public.market_results to anon, authenticated;
grant select on public.pools to anon, authenticated;
grant select on public.pool_members to anon, authenticated;

-- Grant controlled permissions on predictions to authenticated
grant select, insert, update (selection, updated_at), delete on public.predictions to authenticated;

-- Grant controlled permissions on pool_messages to authenticated
grant select, insert, delete on public.pool_messages to authenticated;

-- Grant RPC function execution
grant execute on function public.get_pool_eligible_markets(uuid) to anon, authenticated;
grant execute on function public.get_pool_leaderboard(uuid) to anon, authenticated;
grant execute on function public.get_user_score_summary(uuid) to anon, authenticated;
grant execute on function public.create_pool(text, text, text, text, bigint, bigint, text, boolean) to authenticated;
grant execute on function public.join_pool_by_invite_code(text) to authenticated;
grant execute on function public.leave_pool(uuid) to authenticated;
grant execute on function public.send_pool_message(uuid, text) to authenticated;

-- Ensure private schema is not accessible to anon / authenticated
revoke all on schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
