-- 1. Create pools table
create table public.pools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 3 and char_length(name) <= 60),
  description text,
  invite_code text unique not null,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  is_public boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 2. Create pool_members table
create table public.pool_members (
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('creator', 'admin', 'member')),
  joined_at timestamptz not null default timezone('utc'::text, now()),
  primary key (pool_id, user_id)
);

-- 3. Create indexes for high performance
create index idx_pools_invite_code on public.pools (invite_code);
create index idx_pools_creator_id on public.pools (creator_id);
create index idx_pools_is_public on public.pools (is_public);
create index idx_pool_members_user_id on public.pool_members (user_id);
create index idx_pool_members_pool_id on public.pool_members (pool_id);

-- 4. Enable Row Level Security (RLS)
alter table public.pools enable row level security;
alter table public.pool_members enable row level security;

-- 5. Set up RLS Policies for pools
create policy "Allow authenticated view of pools"
  on public.pools for select
  to authenticated
  using (true);

create policy "Allow creator insert pools"
  on public.pools for insert
  to authenticated
  with check (creator_id = (select auth.uid()));

create policy "Allow creator update pools"
  on public.pools for update
  to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));

create policy "Allow creator delete pools"
  on public.pools for delete
  to authenticated
  using (creator_id = (select auth.uid()));

-- 6. Set up RLS Policies for pool_members
create policy "Allow authenticated view of pool members"
  on public.pool_members for select
  to authenticated
  using (true);

create policy "Allow users to join pools"
  on public.pool_members for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Allow users to leave pools"
  on public.pool_members for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.pools
      where id = pool_id and creator_id = (select auth.uid())
    )
  );

-- 7. Unique 6-Character Invite Code Generator
create or replace function public.generate_pool_invite_code()
returns text as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_result text := '';
  v_i integer;
  v_exists boolean;
begin
  loop
    v_result := '';
    for v_i in 1..6 loop
      v_result := v_result || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    end loop;

    -- Check if code is already taken
    select exists (select 1 from public.pools where invite_code = v_result) into v_exists;
    if not v_exists then
      return v_result;
    end if;
  end loop;
end;
$$ language plpgsql volatile security definer set search_path = public, pg_temp;

-- 8. Auto-Join Creator Trigger
create or replace function public.handle_new_pool_creator()
returns trigger as $$
begin
  insert into public.pool_members (pool_id, user_id, role, joined_at)
  values (NEW.id, NEW.creator_id, 'creator', timezone('utc'::text, now()))
  on conflict (pool_id, user_id) do nothing;
  return NEW;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace trigger trigger_auto_join_pool_creator
  after insert on public.pools
  for each row
  execute function public.handle_new_pool_creator();

-- 9. Secure Join Pool RPC (join_pool_by_code)
create or replace function public.join_pool_by_code(p_invite_code text)
returns jsonb as $$
declare
  v_pool_id uuid;
  v_pool_name text;
  v_user_id uuid := auth.uid();
  v_already_member boolean;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  -- Normalize invite code to uppercase
  p_invite_code := upper(trim(p_invite_code));

  -- Lookup pool
  select id, name into v_pool_id, v_pool_name
  from public.pools
  where invite_code = p_invite_code;

  if v_pool_id is null then
    return jsonb_build_object('success', false, 'error', 'Invalid or expired invite code.');
  end if;

  -- Check if already member
  select exists (
    select 1 from public.pool_members
    where pool_id = v_pool_id and user_id = v_user_id
  ) into v_already_member;

  if v_already_member then
    return jsonb_build_object('success', true, 'pool_id', v_pool_id, 'name', v_pool_name, 'message', 'Already a member of this pool.');
  end if;

  -- Insert membership
  insert into public.pool_members (pool_id, user_id, role, joined_at)
  values (v_pool_id, v_user_id, 'member', timezone('utc'::text, now()));

  return jsonb_build_object('success', true, 'pool_id', v_pool_id, 'name', v_pool_name, 'message', 'Successfully joined pool!');
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- 10. High-Performance Pool Leaderboard RPC (get_pool_leaderboard)
create or replace function public.get_pool_leaderboard(p_pool_id uuid)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  full_name text,
  avatar_url text,
  total_points bigint,
  exact_count bigint,
  predictions_count bigint,
  joined_at timestamptz
) as $$
begin
  return query
  with member_scores as (
    select 
      pm.user_id,
      prof.username,
      prof.full_name,
      prof.avatar_url,
      pm.joined_at,
      coalesce(sum(pred.points_earned), 0)::bigint as total_points,
      coalesce(count(case when pred.points_earned = 3 then 1 end), 0)::bigint as exact_count,
      coalesce(count(pred.id), 0)::bigint as predictions_count
    from public.pool_members pm
    join public.profiles prof on prof.id = pm.user_id
    left join public.predictions pred on pred.user_id = pm.user_id
    where pm.pool_id = p_pool_id
    group by pm.user_id, prof.username, prof.full_name, prof.avatar_url, pm.joined_at
  )
  select 
    dense_rank() over (order by ms.total_points desc, ms.exact_count desc, ms.joined_at asc)::bigint as rank,
    ms.user_id,
    ms.username,
    ms.full_name,
    ms.avatar_url,
    ms.total_points,
    ms.exact_count,
    ms.predictions_count,
    ms.joined_at
  from member_scores ms
  order by rank asc, ms.total_points desc, ms.exact_count desc, ms.joined_at asc;
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;
