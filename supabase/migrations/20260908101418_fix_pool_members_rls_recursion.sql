-- Avoid mutual RLS evaluation between pools and pool_members.
-- These helpers run as the function owner and only expose boolean membership
-- checks, so policy evaluation does not recursively re-enter pool_members RLS.
create or replace function private.is_active_pool_member(
  p_pool_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select p_user_id is not null
     and exists (
       select 1
       from public.pool_members pm
       where pm.pool_id = p_pool_id
         and pm.user_id = p_user_id
         and pm.left_at is null
     );
$$;

create or replace function private.is_pool_admin(
  p_pool_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select p_user_id is not null
     and exists (
       select 1
       from public.pool_members pm
       where pm.pool_id = p_pool_id
         and pm.user_id = p_user_id
         and pm.role = 'admin'
         and pm.left_at is null
     );
$$;

create or replace function private.users_share_active_pool(
  p_first_user_id uuid,
  p_second_user_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select p_first_user_id is not null
     and p_second_user_id is not null
     and exists (
       select 1
       from public.pool_members first_member
       join public.pool_members second_member
         on second_member.pool_id = first_member.pool_id
       where first_member.user_id = p_first_user_id
         and first_member.left_at is null
         and second_member.user_id = p_second_user_id
         and second_member.left_at is null
     );
$$;

revoke all on function private.is_active_pool_member(uuid, uuid),
  private.is_pool_admin(uuid, uuid),
  private.users_share_active_pool(uuid, uuid)
  from public, anon, authenticated;

grant execute on function private.is_active_pool_member(uuid, uuid),
  private.is_pool_admin(uuid, uuid),
  private.users_share_active_pool(uuid, uuid)
  to anon, authenticated, service_role;

-- The prediction trigger calls a private validator while client writes run as
-- authenticated. Keep the validator inaccessible to clients while allowing
-- the trigger to execute it with the table-owner privileges.
alter function private.fn_validate_prediction() security definer;
alter function private.fn_validate_prediction() set search_path = '';

drop policy if exists "pools_select_public_or_member" on public.pools;
create policy "pools_select_public_or_member"
on public.pools
for select
to anon, authenticated
using (
  (is_private = false)
  or (created_by = auth.uid())
  or private.is_active_pool_member(id, auth.uid())
);

drop policy if exists "pools_update_admin" on public.pools;
create policy "pools_update_admin"
on public.pools
for update
to authenticated
using (private.is_pool_admin(id, auth.uid()))
with check (private.is_pool_admin(id, auth.uid()));

drop policy if exists "pool_members_select_visible_pools" on public.pool_members;
create policy "pool_members_select_visible_pools"
on public.pool_members
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.pools p
    where p.id = pool_members.pool_id
      and (
        p.is_private = false
        or p.created_by = auth.uid()
        or private.is_active_pool_member(p.id, auth.uid())
      )
  )
);

drop policy if exists "pool_messages_select_active_members" on public.pool_messages;
create policy "pool_messages_select_active_members"
on public.pool_messages
for select
to authenticated
using (private.is_active_pool_member(pool_id, auth.uid()));

drop policy if exists "pool_messages_insert_active_members" on public.pool_messages;
create policy "pool_messages_insert_active_members"
on public.pool_messages
for insert
to authenticated
with check (
  auth.uid() = user_id
  and private.is_active_pool_member(pool_id, auth.uid())
);

drop policy if exists "predictions_select_own_or_locked_cohort" on public.predictions;
create policy "predictions_select_own_or_locked_cohort"
on public.predictions
for select
to authenticated
using (
  auth.uid() = user_id
  or (
    exists (
      select 1
      from public.event_markets em
      where em.id = predictions.event_market_id
        and (
          em.status in ('locked', 'settled', 'void')
          or now() >= em.locks_at
        )
    )
    and private.users_share_active_pool(auth.uid(), user_id)
  )
);
