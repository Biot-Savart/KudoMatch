-- Phase 15: enforce the same lock boundary for prediction deletion that already
-- applies to inserts and selection updates.

create or replace function private.fn_validate_prediction_delete()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_market record;
  v_auth_role text;
begin
  v_auth_role := current_setting('request.jwt.claim.role', true);

  -- Authenticated clients may only clear an editable prediction.  The
  -- service role is intentionally left available for maintenance/recovery.
  if v_auth_role = 'authenticated' then
    select status, locks_at
      into v_market
      from public.event_markets
     where id = old.event_market_id;

    if not found or v_market.status <> 'open' or now() >= v_market.locks_at then
      raise exception 'Prediction market is locked. Deletions are not permitted after %',
        coalesce(v_market.locks_at::text, 'the market lock')
        using errcode = '23514';
    end if;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_validate_prediction_delete on public.predictions;
create trigger trg_validate_prediction_delete
  before delete on public.predictions
  for each row execute function private.fn_validate_prediction_delete();

revoke execute on function private.fn_validate_prediction_delete() from public, anon, authenticated, service_role;
