-- Create push_subscriptions table
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Indexes for push_subscriptions
create index idx_push_subscriptions_user_id on public.push_subscriptions (user_id);

-- Enable Row Level Security (RLS) on push_subscriptions
alter table public.push_subscriptions enable row level security;

-- Policies for push_subscriptions
create policy "Allow users to view their own push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Allow users to insert their own push subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Allow users to update their own push subscriptions"
  on public.push_subscriptions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Allow users to delete their own push subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using ((select auth.uid()) = user_id);


-- Create notification_preferences table
create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  kickoff_warnings boolean not null default true,
  match_results boolean not null default true,
  weekly_digest boolean not null default true,
  email_notifications boolean not null default true,
  push_notifications boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS) on notification_preferences
alter table public.notification_preferences enable row level security;

-- Policies for notification_preferences
create policy "Allow users to view their own notification preferences"
  on public.notification_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Allow users to insert their own notification preferences"
  on public.notification_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Allow users to update their own notification preferences"
  on public.notification_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Trigger to auto-create notification preferences when a profile is created
create or replace function public.handle_new_user_notification_preferences()
returns trigger as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_profile_created_notification_preferences
  after insert on public.profiles
  for each row execute function public.handle_new_user_notification_preferences();

-- Seed preferences for any existing profiles
insert into public.notification_preferences (user_id)
select id from public.profiles
on conflict (user_id) do nothing;
