-- Fix: Safely unschedule pg_cron job only if it already exists
create or replace function public.setup_automated_score_checks(
  p_edge_function_url text,
  p_service_role_key text,
  p_cron_expression text default '*/10 * * * *'
)
returns void as $$
begin
  -- Unschedule existing job if it exists to prevent duplication
  if exists (select 1 from cron.job where jobname = 'fetch-live-scores-job') then
    perform cron.unschedule('fetch-live-scores-job');
  end if;
  
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
