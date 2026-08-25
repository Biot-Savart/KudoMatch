-- Migration 1: Foundation Profiles, Private Schema, and Base Helpers
-- Phase 11: Multi-Sport Core Schema

-- 1. Create private schema for validation helpers and internal triggers
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role, postgres;

-- 2. General updated_at timestamp trigger helper
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
grant execute on function private.set_updated_at() to service_role, postgres;

-- 3. Create profiles table in public schema
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS immediately
alter table public.profiles enable row level security;

-- Drop legacy/existing policies if any to ensure clean baseline
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

-- RLS Policies
create policy "Public profiles are viewable by everyone"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Explicit table grants
revoke all on table public.profiles from public;
grant select on table public.profiles to anon;
grant select, update (email, full_name, avatar_url, updated_at) on table public.profiles to authenticated;
grant all on table public.profiles to service_role, postgres;

-- updated_at trigger for profiles
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function private.set_updated_at();

-- 4. Auth user creation trigger in private schema
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
grant execute on function private.handle_new_user() to service_role, postgres;

-- Attach trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();

-- 5. Idempotent reconciliation helper to backfill profiles for existing auth.users
do $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  select
    u.id,
    coalesce(u.email, ''),
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
    coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture', '')
  from auth.users u
  where not exists (
    select 1 from public.profiles p where p.id = u.id
  )
  on conflict (id) do nothing;
end;
$$;
