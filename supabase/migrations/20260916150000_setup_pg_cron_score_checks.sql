-- ============================================================================
-- Migration: Setup pg_cron & pg_net for Automated Score Checks
-- Enables background polling via Supabase database extensions
-- ============================================================================

-- 1. Enable required extensions safely in extensions schema
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 2. Create RPC to configure automated background score synchronization
drop function if exists public.setup_automated_score_checks(text, text, text);
drop function if exists public.setup_automated_score_checks(text, text);
drop function if exists public.setup_automated_score_checks;

create or replace function public.setup_automated_score_checks(
  p_edge_function_url text,
  p_service_role_key text,
  p_cron_expression text default '*/10 * * * *'
)
returns text
language plpgsql
security definer
set search_path = extensions, public, net
as $$
declare
  v_job_id bigint;
  v_new_job_id bigint;
begin
  -- Unschedule existing job if already registered
  select jobid into v_job_id
  from cron.job
  where jobname = 'fetch_live_scores_job'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  -- Schedule the new cron job using pg_net HTTP POST
  select cron.schedule(
    'fetch_live_scores_job',
    p_cron_expression,
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb
      );
      $cmd$,
      p_edge_function_url,
      p_service_role_key
    )
  ) into v_new_job_id;

  return format('Successfully scheduled cron job %s (ID: %s) with schedule %s', 'fetch_live_scores_job', v_new_job_id, p_cron_expression);
end;
$$;

-- 3. Create helper RPC to remove the cron job if needed
drop function if exists public.unschedule_automated_score_checks();
drop function if exists public.unschedule_automated_score_checks;

create or replace function public.unschedule_automated_score_checks()
returns text
language plpgsql
security definer
set search_path = extensions, public, net
as $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'fetch_live_scores_job'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
    return format('Unscheduled job ID %s', v_job_id);
  end if;

  return 'No scheduled job found with name fetch_live_scores_job';
end;
$$;

-- 4. Restrict execution to service_role and postgres only
revoke all on function public.setup_automated_score_checks(text, text, text) from public, anon, authenticated;
grant execute on function public.setup_automated_score_checks(text, text, text) to service_role, postgres;

revoke all on function public.unschedule_automated_score_checks() from public, anon, authenticated;
grant execute on function public.unschedule_automated_score_checks() to service_role, postgres;
