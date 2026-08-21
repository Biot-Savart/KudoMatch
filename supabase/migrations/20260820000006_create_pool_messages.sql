-- Create pool_messages table
create table public.pool_messages (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(trim(message)) > 0 and char_length(message) <= 1000),
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Create performance indexes
create index idx_pool_messages_pool_id_created_at on public.pool_messages (pool_id, created_at asc);
create index idx_pool_messages_user_id on public.pool_messages (user_id);

-- Enable Row Level Security (RLS)
alter table public.pool_messages enable row level security;

-- RLS Policies

-- 1. SELECT policy: Authenticated pool members can view pool messages
create policy "Allow pool members to view pool messages"
  on public.pool_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.pool_members
      where pool_members.pool_id = pool_messages.pool_id
      and pool_members.user_id = (select auth.uid())
    )
  );

-- 2. INSERT policy: Authenticated pool members can post messages in their pools
create policy "Allow pool members to insert pool messages"
  on public.pool_messages for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.pool_members
      where pool_members.pool_id = pool_messages.pool_id
      and pool_members.user_id = (select auth.uid())
    )
  );

-- 3. DELETE policy: Authenticated users can delete their own messages, or pool creators can delete any message
create policy "Allow users to delete their own messages"
  on public.pool_messages for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.pools
      where pools.id = pool_messages.pool_id
      and pools.creator_id = (select auth.uid())
    )
  );

-- Enable Realtime for pool_messages
alter publication supabase_realtime add table public.pool_messages;
