-- 1. Add tracking columns to public.pools for Realtime invalidation
alter table public.pools 
add column if not exists last_scored_at timestamptz default timezone('utc'::text, now()),
add column if not exists last_activity_at timestamptz default timezone('utc'::text, now());

-- 2. Create index to optimize pool updates and lookups
create index if not exists idx_pools_last_scored_at on public.pools (last_scored_at);

-- 3. Create standings invalidation trigger function
create or replace function public.handle_pool_standings_invalidation()
returns trigger as $$
declare
  v_pool_ids uuid[];
begin
  -- Find all pool IDs where the users who predicted this match are members
  select array_agg(distinct pm.pool_id) into v_pool_ids
  from public.predictions p
  join public.pool_members pm on pm.user_id = p.user_id
  where p.match_id = NEW.id;

  -- Update pools to trigger realtime broadcast and client cache invalidation
  if v_pool_ids is not null and array_length(v_pool_ids, 1) > 0 then
    update public.pools
    set 
      last_scored_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
    where id = any(v_pool_ids);
  end if;

  return NEW;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- 4. Bind trigger to public.matches table
-- Fires when a match is updated with scores/finishes, which matches the scoring engine lifecycle
create or replace trigger trigger_invalidate_pool_standings
  after update of status, home_score, away_score on public.matches
  for each row
  when (
    OLD.status is distinct from NEW.status or
    OLD.home_score is distinct from NEW.home_score or
    OLD.away_score is distinct from NEW.away_score
  )
  execute function public.handle_pool_standings_invalidation();

-- 5. Enable pg_cron and pg_net extensions safely in Supabase environments
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema public;

-- 6. Helper function to schedule / configure automated score checks
create or replace function public.setup_automated_score_checks(
  p_edge_function_url text,
  p_service_role_key text,
  p_cron_expression text default '*/10 * * * *'
)
returns void as $$
begin
  -- Unschedule existing job if it exists to prevent duplication
  perform cron.unschedule('fetch-live-scores-job');
  
  -- Schedule HTTP POST job calling the edge function / endpoint
  perform cron.schedule(
    'fetch-live-scores-job',
    p_cron_expression,
    format(
      'select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
      p_edge_function_url,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || p_service_role_key
      )::text,
      '{}'::text
    )
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- 7. Add Database Diagnostics & Maintenance Helpers

-- A. Retrieve Table & Index Size Report
create or replace function public.get_db_size_report()
returns table (
  relation_name text,
  relation_type text,
  table_size text,
  index_size text,
  total_size text
) as $$
begin
  return query
  select
    c.relname::text as relation_name,
    case c.relkind
      when 'r' then 'Table'
      when 'v' then 'View'
      when 'm' then 'Materialized View'
      when 'i' then 'Index'
      else 'Other'
    end::text as relation_type,
    pg_size_pretty(pg_table_size(c.oid))::text as table_size,
    pg_size_pretty(pg_indexes_size(c.oid))::text as index_size,
    pg_size_pretty(pg_total_relation_size(c.oid))::text as total_size
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'm', 'i')
  order by pg_total_relation_size(c.oid) desc;
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

-- B. Perform VACUUM ANALYZE on core transactional tables to clean dead tuples & update planner stats
create or replace function public.maintain_database_stats()
returns void as $$
begin
  -- Note: VACUUM cannot be run inside a transaction block in standard PL/pgSQL,
  -- but we can use ANALYZE to update statistics safely within functions.
  analyze public.profiles;
  analyze public.predictions;
  analyze public.matches;
  analyze public.pools;
  analyze public.pool_members;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
