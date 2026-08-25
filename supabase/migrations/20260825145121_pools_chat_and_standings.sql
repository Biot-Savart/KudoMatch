-- ============================================================================
-- Migration 2: Pools, Scopes, Membership Episodes, Chat & Standings
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. POOLS
-- ----------------------------------------------------------------------------

create table if not exists public.pools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 60),
  created_by uuid not null references public.profiles(id) on delete restrict,
  invite_code text not null unique check (length(trim(invite_code)) between 6 and 16 and invite_code ~ '^[A-Za-z0-9_-]+$'),
  scope_kind text not null check (scope_kind in ('all_sports', 'sport', 'competition', 'edition')),
  sport_slug text references public.sports(slug) on delete restrict,
  competition_id bigint references public.competitions(id) on delete restrict,
  edition_id bigint references public.competition_editions(id) on delete restrict,
  scoring_mode text not null check (scoring_mode in ('raw', 'normalized')),
  scoring_starts_at timestamptz not null default now(),
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_pool_scope_and_scoring check (
    (scope_kind = 'all_sports' and sport_slug is null and competition_id is null and edition_id is null and scoring_mode = 'normalized')
    or
    (scope_kind = 'sport' and sport_slug is not null and competition_id is null and edition_id is null)
    or
    (scope_kind = 'competition' and sport_slug is null and competition_id is not null and edition_id is null)
    or
    (scope_kind = 'edition' and sport_slug is null and competition_id is null and edition_id is not null)
  )
);

create index if not exists idx_pools_created_by on public.pools (created_by);
create index if not exists idx_pools_sport_slug on public.pools (sport_slug) where (sport_slug is not null);
create index if not exists idx_pools_competition_id on public.pools (competition_id) where (competition_id is not null);
create index if not exists idx_pools_edition_id on public.pools (edition_id) where (edition_id is not null);

-- ----------------------------------------------------------------------------
-- 2. POOL MEMBERSHIP EPISODES
-- ----------------------------------------------------------------------------

create table if not exists public.pool_members (
  id bigint generated always as identity primary key,
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chk_pool_member_dates check (left_at is null or left_at > joined_at)
);

create unique index if not exists uq_pool_members_active
  on public.pool_members (pool_id, user_id)
  where (left_at is null);

create index if not exists idx_pool_members_episodes
  on public.pool_members (pool_id, user_id, joined_at, left_at);

create index if not exists idx_pool_members_user_active
  on public.pool_members (user_id)
  where (left_at is null);

-- ----------------------------------------------------------------------------
-- 3. POOL MESSAGES (CHAT)
-- ----------------------------------------------------------------------------

create table if not exists public.pool_messages (
  id bigint generated always as identity primary key,
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (length(trim(message)) > 0 and length(message) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists idx_pool_messages_keystream
  on public.pool_messages (pool_id, created_at, id);

-- ----------------------------------------------------------------------------
-- 4. ELIGIBLE MARKETS FUNCTION
-- ----------------------------------------------------------------------------

create or replace function public.get_pool_eligible_markets(p_pool_id uuid)
returns table (
  event_market_id bigint,
  event_id bigint,
  market_kind text,
  ruleset_id bigint,
  opens_at timestamptz,
  locks_at timestamptz,
  status text,
  sport_slug text,
  competition_id bigint,
  edition_id bigint
)
language sql
security invoker
stable
as $$
  select
    em.id as event_market_id,
    e.id as event_id,
    em.market_kind,
    em.ruleset_id,
    em.opens_at,
    em.locks_at,
    em.status,
    c.sport_slug,
    c.id as competition_id,
    ce.id as edition_id
  from public.pools p
  cross join public.event_markets em
  join public.events e on e.id = em.event_id
  join public.competition_editions ce on ce.id = e.edition_id
  join public.competitions c on c.id = ce.competition_id
  where p.id = p_pool_id
    and em.is_current = true
    and em.locks_at >= p.scoring_starts_at
    and (
      (p.scope_kind = 'all_sports')
      or (p.scope_kind = 'sport' and c.sport_slug = p.sport_slug)
      or (p.scope_kind = 'competition' and c.id = p.competition_id)
      or (p.scope_kind = 'edition' and ce.id = p.edition_id)
    );
$$;

-- ----------------------------------------------------------------------------
-- 5. POOL LEADERBOARD FUNCTION
-- ----------------------------------------------------------------------------

create or replace function public.get_pool_leaderboard(p_pool_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  role text,
  rank integer,
  displayed_score bigint,
  raw_total bigint,
  normalized_total bigint,
  exact_count bigint,
  submitted_count bigint,
  settled_count bigint,
  joined_at timestamptz
)
language plpgsql
security invoker
stable
as $$
declare
  v_pool record;
begin
  select * into v_pool from public.pools where id = p_pool_id;
  if not found then
    return;
  end if;

  return query
  with active_members as (
    select
      pm.user_id as mem_user_id,
      pm.role as mem_role,
      pm.joined_at as mem_joined_at,
      p.display_name,
      p.avatar_url
    from public.pool_members pm
    join public.profiles p on p.id = pm.user_id
    where pm.pool_id = p_pool_id
      and pm.left_at is null
  ),
  eligible_markets as (
    select * from public.get_pool_eligible_markets(p_pool_id)
  ),
  member_predictions as (
    select
      am.mem_user_id,
      pr.id as prediction_id,
      pr.settlement_status,
      pr.tier_code,
      coalesce(pr.raw_points, 0) as raw_points,
      coalesce(pr.normalized_basis_points, 0) as normalized_basis_points
    from active_members am
    join public.pool_members ep
      on ep.pool_id = p_pool_id
     and ep.user_id = am.mem_user_id
    join eligible_markets em
      on em.locks_at >= ep.joined_at
     and (ep.left_at is null or em.locks_at < ep.left_at)
    left join public.predictions pr
      on pr.user_id = am.mem_user_id
     and pr.event_market_id = em.event_market_id
  ),
  aggregated as (
    select
      am.mem_user_id as user_id,
      am.display_name,
      am.avatar_url,
      am.mem_role as role,
      am.mem_joined_at as joined_at,
      coalesce(sum(mp.raw_points), 0)::bigint as raw_total,
      coalesce(sum(mp.normalized_basis_points), 0)::bigint as normalized_total,
      count(case when mp.tier_code = 'exact_score' then 1 end)::bigint as exact_count,
      count(mp.prediction_id)::bigint as submitted_count,
      count(case when mp.settlement_status = 'settled' then 1 end)::bigint as settled_count,
      case
        when v_pool.scoring_mode = 'raw' then coalesce(sum(mp.raw_points), 0)::bigint
        else coalesce(sum(mp.normalized_basis_points), 0)::bigint
      end as displayed_score
    from active_members am
    left join member_predictions mp on mp.mem_user_id = am.mem_user_id
    group by am.mem_user_id, am.display_name, am.avatar_url, am.mem_role, am.mem_joined_at
  )
  select
    a.user_id,
    a.display_name,
    a.avatar_url,
    a.role,
    dense_rank() over (
      order by a.displayed_score desc, a.exact_count desc, a.joined_at asc
    )::int as rank,
    a.displayed_score,
    a.raw_total,
    a.normalized_total,
    a.exact_count,
    a.submitted_count,
    a.settled_count,
    a.joined_at
  from aggregated a
  order by rank, a.joined_at asc;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. USER SCORE SUMMARY FUNCTION
-- ----------------------------------------------------------------------------

create or replace function public.get_user_score_summary(p_user_id uuid default null)
returns table (
  sport_slug text,
  competition_id bigint,
  edition_id bigint,
  total_predictions bigint,
  settled_predictions bigint,
  exact_count bigint,
  raw_total bigint,
  normalized_total bigint
)
language plpgsql
security invoker
stable
as $$
declare
  v_target_user uuid := coalesce(p_user_id, auth.uid());
begin
  return query
  select
    c.sport_slug,
    c.id as competition_id,
    ce.id as edition_id,
    count(pr.id)::bigint as total_predictions,
    count(case when pr.settlement_status = 'settled' then 1 end)::bigint as settled_predictions,
    count(case when pr.tier_code = 'exact_score' then 1 end)::bigint as exact_count,
    coalesce(sum(pr.raw_points), 0)::bigint as raw_total,
    coalesce(sum(pr.normalized_basis_points), 0)::bigint as normalized_total
  from public.predictions pr
  join public.event_markets em on em.id = pr.event_market_id
  join public.events e on e.id = em.event_id
  join public.competition_editions ce on ce.id = e.edition_id
  join public.competitions c on c.id = ce.competition_id
  where pr.user_id = v_target_user
  group by grouping sets (
    (),
    (c.sport_slug),
    (c.sport_slug, c.id),
    (c.sport_slug, c.id, ce.id)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. POOL ACTION RPCS
-- ----------------------------------------------------------------------------

-- Create Pool RPC
create or replace function public.create_pool(
  p_name text,
  p_invite_code text,
  p_scope_kind text,
  p_sport_slug text default null,
  p_competition_id bigint default null,
  p_edition_id bigint default null,
  p_scoring_mode text default 'normalized',
  p_is_private boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_pool_id uuid;
begin
  if v_caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.pools (
    name,
    created_by,
    invite_code,
    scope_kind,
    sport_slug,
    competition_id,
    edition_id,
    scoring_mode,
    scoring_starts_at,
    is_private,
    created_at,
    updated_at
  )
  values (
    p_name,
    v_caller,
    p_invite_code,
    p_scope_kind,
    p_sport_slug,
    p_competition_id,
    p_edition_id,
    p_scoring_mode,
    now(),
    p_is_private,
    now(),
    now()
  )
  returning id into v_pool_id;

  -- Add creator as initial active admin member
  insert into public.pool_members (
    pool_id,
    user_id,
    role,
    joined_at,
    left_at,
    created_at
  )
  values (
    v_pool_id,
    v_caller,
    'admin',
    now(),
    null,
    now()
  );

  return v_pool_id;
end;
$$;

-- Join Pool By Invite Code RPC
create or replace function public.join_pool_by_invite_code(
  p_invite_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_pool record;
  v_existing_active record;
begin
  if v_caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_pool
  from public.pools
  where invite_code = p_invite_code;

  if not found then
    raise exception 'Invalid pool invite code' using errcode = 'P0002';
  end if;

  -- Check if already active member
  select * into v_existing_active
  from public.pool_members
  where pool_id = v_pool.id
    and user_id = v_caller
    and left_at is null;

  if found then
    return v_pool.id; -- Already an active member
  end if;

  -- Insert new active membership episode
  insert into public.pool_members (
    pool_id,
    user_id,
    role,
    joined_at,
    left_at,
    created_at
  )
  values (
    v_pool.id,
    v_caller,
    'member',
    now(),
    null,
    now()
  );

  return v_pool.id;
end;
$$;

-- Leave Pool RPC
create or replace function public.leave_pool(
  p_pool_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_membership record;
  v_active_admins int;
  v_total_active int;
begin
  if v_caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_membership
  from public.pool_members
  where pool_id = p_pool_id
    and user_id = v_caller
    and left_at is null;

  if not found then
    raise exception 'Active pool membership not found' using errcode = 'P0002';
  end if;

  -- Check if member is sole admin when other members exist
  if v_membership.role = 'admin' then
    select count(*) filter (where role = 'admin'), count(*)
    into v_active_admins, v_total_active
    from public.pool_members
    where pool_id = p_pool_id and left_at is null;

    if v_active_admins <= 1 and v_total_active > 1 then
      raise exception 'Cannot leave pool as sole admin when other active members remain. Transfer admin role first.'
        using errcode = '23514';
    end if;
  end if;

  -- Close membership episode
  update public.pool_members
  set left_at = now()
  where id = v_membership.id;

  return true;
end;
$$;

-- Send Pool Message RPC
create or replace function public.send_pool_message(
  p_pool_id uuid,
  p_message text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_msg_id bigint;
begin
  if v_caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Verify active membership
  if not exists (
    select 1 from public.pool_members
    where pool_id = p_pool_id
      and user_id = v_caller
      and left_at is null
  ) then
    raise exception 'Must be an active pool member to send messages' using errcode = '42501';
  end if;

  insert into public.pool_messages (
    pool_id,
    user_id,
    message,
    created_at
  )
  values (
    p_pool_id,
    v_caller,
    p_message,
    now()
  )
  returning id into v_msg_id;

  return v_msg_id;
end;
$$;
