-- ============================================================================
-- Migration: Notifications, Automation, and Realtime Subscriptions
-- Phase 13: Application Event-Model Refactor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. NOTIFICATION PREFERENCES TABLE
-- ----------------------------------------------------------------------------

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  kickoff_warnings boolean not null default true,
  match_results boolean not null default true,
  weekly_digest boolean not null default true,
  email_notifications boolean not null default true,
  push_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.notification_preferences enable row level security;

-- Policies
drop policy if exists "Users can read own notification preferences" on public.notification_preferences;
create policy "Users can read own notification preferences"
  on public.notification_preferences
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
create policy "Users can insert own notification preferences"
  on public.notification_preferences
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
create policy "Users can update own notification preferences"
  on public.notification_preferences
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Grants
revoke all on table public.notification_preferences from public;
grant select, insert, update on table public.notification_preferences to authenticated;
grant all on table public.notification_preferences to service_role, postgres;

-- updated_at trigger
drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row
  execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. PUSH SUBSCRIPTIONS TABLE
-- ----------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.push_subscriptions enable row level security;

-- Index
create index if not exists idx_push_subscriptions_user on public.push_subscriptions (user_id);

-- Policies
drop policy if exists "Users can read own push subscriptions" on public.push_subscriptions;
create policy "Users can read own push subscriptions"
  on public.push_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
create policy "Users can insert own push subscriptions"
  on public.push_subscriptions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
create policy "Users can update own push subscriptions"
  on public.push_subscriptions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;
create policy "Users can delete own push subscriptions"
  on public.push_subscriptions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Grants
revoke all on table public.push_subscriptions from public;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant all on table public.push_subscriptions to service_role, postgres;

-- updated_at trigger
drop trigger if exists set_push_subscriptions_updated_at on public.push_subscriptions;
create trigger set_push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row
  execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. PROFILE CREATION TRIGGER FOR NOTIFICATION PREFERENCES
-- ----------------------------------------------------------------------------

create or replace function private.handle_new_profile_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_profile_preferences() from public, anon, authenticated;
grant execute on function private.handle_new_profile_preferences() to service_role, postgres;

drop trigger if exists on_profile_created_preferences on public.profiles;
create trigger on_profile_created_preferences
  after insert on public.profiles
  for each row
  execute function private.handle_new_profile_preferences();

-- Idempotently backfill existing profiles
insert into public.notification_preferences (user_id)
select p.id from public.profiles p
where not exists (
  select 1 from public.notification_preferences np where np.user_id = p.id
)
on conflict (user_id) do nothing;

-- ----------------------------------------------------------------------------
-- 4. REALTIME PUBLICATION CONFIGURATION
-- ----------------------------------------------------------------------------

-- Add new tables to supabase_realtime publication safely if publication exists
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.event_markets;
    exception when duplicate_object then null; end;

    begin
      alter publication supabase_realtime add table public.market_results;
    exception when duplicate_object then null; end;

    begin
      alter publication supabase_realtime add table public.predictions;
    exception when duplicate_object then null; end;

    begin
      alter publication supabase_realtime add table public.pools;
    exception when duplicate_object then null; end;

    begin
      alter publication supabase_realtime add table public.pool_members;
    exception when duplicate_object then null; end;

    begin
      alter publication supabase_realtime add table public.pool_messages;
    exception when duplicate_object then null; end;
  end if;
end;
$$;
