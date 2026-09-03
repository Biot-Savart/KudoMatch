-- Phase 4: provider contract evidence and staged completed-result verification.
-- Verification is scheduler-neutral: callers provide the current observation time.

alter table public.event_data_quality
  add column if not exists result_verification_stage text not null default 'not_scheduled',
  add column if not exists result_finalized_at timestamptz,
  add column if not exists result_verified_1h_at timestamptz,
  add column if not exists result_verified_6h_at timestamptz,
  add column if not exists result_verified_24h_at timestamptz,
  add column if not exists result_verification_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_data_quality'::regclass
      and conname = 'check_result_verification_stage'
  ) then
    alter table public.event_data_quality
      add constraint check_result_verification_stage
      check (result_verification_stage in ('not_scheduled', 'due_1h', 'due_6h', 'due_24h', 'complete'));
  end if;
end;
$$;

create index if not exists idx_event_data_quality_result_verification
  on public.event_data_quality (result_verification_stage, next_verification_at)
  where result_verification_stage <> 'complete';

create or replace function private.schedule_completed_result_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id bigint;
  v_provider_slug text;
  v_source_count integer;
  v_finalized_at timestamptz := coalesce(new.finalized_at, clock_timestamp());
begin
  if new.status <> 'final' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.revision = new.revision
     and old.result is not distinct from new.result
     and old.status = new.status
     and old.finalized_at is not distinct from new.finalized_at then
    return new;
  end if;

  select em.event_id
  into v_event_id
  from public.event_markets em
  where em.id = new.event_market_id;

  v_provider_slug := nullif(split_part(coalesce(new.source_ref, ''), ':', 1), '');
  select count(*)::integer
  into v_source_count
  from public.provider_event_sources pes
  where pes.event_id = v_event_id;

  insert into public.event_data_quality (
    event_id, preferred_provider_slug, quality_status, source_count,
    result_verification_stage, result_finalized_at, next_verification_at,
    result_verified_1h_at, result_verified_6h_at, result_verified_24h_at,
    result_verification_error
  ) values (
    v_event_id, v_provider_slug,
    case when v_source_count > 1 then 'verified' else 'single_source' end,
    v_source_count, 'due_1h', v_finalized_at, v_finalized_at + interval '1 hour',
    null, null, null, null
  )
  on conflict (event_id) do update set
    preferred_provider_slug = coalesce(excluded.preferred_provider_slug, event_data_quality.preferred_provider_slug),
    source_count = excluded.source_count,
    result_verification_stage = excluded.result_verification_stage,
    result_finalized_at = excluded.result_finalized_at,
    next_verification_at = excluded.next_verification_at,
    result_verified_1h_at = null,
    result_verified_6h_at = null,
    result_verified_24h_at = null,
    result_verification_error = null;

  return new;
end;
$$;

drop trigger if exists trg_schedule_completed_result_verification on public.market_results;
create trigger trg_schedule_completed_result_verification
  after insert or update of result, revision, status, finalized_at on public.market_results
  for each row execute function private.schedule_completed_result_verification();

-- Schedule results already finalized before this migration.
insert into public.event_data_quality (
  event_id, preferred_provider_slug, quality_status, source_count,
  result_verification_stage, result_finalized_at, next_verification_at
)
select
  em.event_id,
  nullif(split_part(coalesce(mr.source_ref, ''), ':', 1), ''),
  case when count(pes.id) > 1 then 'verified' else 'single_source' end,
  count(pes.id)::integer,
  'due_1h',
  coalesce(mr.finalized_at, mr.updated_at, clock_timestamp()),
  coalesce(mr.finalized_at, mr.updated_at, clock_timestamp()) + interval '1 hour'
from public.market_results mr
join public.event_markets em on em.id = mr.event_market_id
left join public.provider_event_sources pes on pes.event_id = em.event_id
where mr.status = 'final'
group by em.event_id, mr.source_ref, mr.finalized_at, mr.updated_at
on conflict (event_id) do update set
  preferred_provider_slug = coalesce(excluded.preferred_provider_slug, event_data_quality.preferred_provider_slug),
  source_count = excluded.source_count,
  result_verification_stage = case
    when event_data_quality.result_verification_stage = 'complete' then event_data_quality.result_verification_stage
    else excluded.result_verification_stage
  end,
  result_finalized_at = case
    when event_data_quality.result_verification_stage = 'complete' then event_data_quality.result_finalized_at
    else excluded.result_finalized_at
  end,
  next_verification_at = case
    when event_data_quality.result_verification_stage = 'complete' then event_data_quality.next_verification_at
    else excluded.next_verification_at
  end;

create or replace function private.verify_completed_result_batch(
  p_provider_slug text,
  p_event_ids bigint[] default null,
  p_as_of timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quality record;
  v_source record;
  v_error text;
  v_verified integer := 0;
  v_failed integer := 0;
  v_pending integer := 0;
  v_as_of timestamptz := coalesce(p_as_of, clock_timestamp());
begin
  if nullif(trim(p_provider_slug), '') is null then
    raise exception 'provider slug is required';
  end if;
  if not exists (select 1 from public.data_providers where slug = p_provider_slug) then
    raise exception 'unknown provider: %', p_provider_slug;
  end if;

  for v_quality in
    select q.*, em.event_id, mr.result, mr.revision, mr.source_ref, mr.finalized_at,
      e.status as event_status
    from public.event_data_quality q
    join public.event_markets em on em.event_id = q.event_id
      and em.market_kind = 'team_scoreline' and em.is_current = true
    join public.market_results mr on mr.event_market_id = em.id and mr.status = 'final'
    join public.events e on e.id = q.event_id
    where q.result_verification_stage in ('due_1h', 'due_6h', 'due_24h')
      and (p_event_ids is null or cardinality(p_event_ids) = 0 or q.event_id = any(p_event_ids))
      and q.next_verification_at is not null
      and q.next_verification_at <= v_as_of
    order by q.next_verification_at, q.event_id
  loop
    v_error := null;
    select pes.*
    into v_source
    from public.provider_event_sources pes
    where pes.provider_slug = p_provider_slug
      and pes.event_id = v_quality.event_id
      and v_quality.source_ref = p_provider_slug || ':' || pes.provider_event_key
    order by pes.last_fetched_at desc, pes.id desc
    limit 1;

    if not found then
      v_error := 'provider source snapshot not found';
    elsif v_quality.event_status <> 'completed' then
      v_error := 'canonical event is not completed';
    elsif v_source.normalized_status <> 'finished' then
      v_error := 'provider source is not finished';
    elsif v_source.home_score is distinct from nullif(v_quality.result->>'home', '')::integer
       or v_source.away_score is distinct from nullif(v_quality.result->>'away', '')::integer then
      v_error := 'provider score differs from canonical final result';
    end if;

    if v_error is not null then
      update public.event_data_quality
      set quality_status = 'conflicted',
          conflict_details = coalesce(conflict_details, '{}'::jsonb) || jsonb_build_object(
            'result_verification', jsonb_build_object('provider_slug', p_provider_slug, 'error', v_error, 'checked_at', v_as_of)
          ),
          result_verification_error = v_error,
          next_verification_at = v_as_of + interval '1 hour'
      where event_id = v_quality.event_id;
      v_failed := v_failed + 1;
      continue;
    end if;

    update public.event_data_quality
    set quality_status = case when source_count > 1 then 'verified' else 'single_source' end,
        conflict_details = coalesce(conflict_details, '{}'::jsonb) - 'result_verification',
        last_verified_at = v_as_of,
        result_verification_error = null,
        result_verification_stage = case result_verification_stage
          when 'due_1h' then 'due_6h'
          when 'due_6h' then 'due_24h'
          when 'due_24h' then 'complete'
        end,
        result_verified_1h_at = case when result_verification_stage = 'due_1h' then v_as_of else result_verified_1h_at end,
        result_verified_6h_at = case when result_verification_stage = 'due_6h' then v_as_of else result_verified_6h_at end,
        result_verified_24h_at = case when result_verification_stage = 'due_24h' then v_as_of else result_verified_24h_at end,
        next_verification_at = case result_verification_stage
          when 'due_1h' then result_finalized_at + interval '6 hours'
          when 'due_6h' then result_finalized_at + interval '24 hours'
          when 'due_24h' then null
        end
    where event_id = v_quality.event_id;
    v_verified := v_verified + 1;
  end loop;

  select count(*)::integer
  into v_pending
  from public.event_data_quality q
  join public.market_results mr on mr.event_market_id = (
    select em.id from public.event_markets em
    where em.event_id = q.event_id and em.market_kind = 'team_scoreline' and em.is_current = true
  )
  where q.result_verification_stage in ('due_1h', 'due_6h', 'due_24h')
    and (p_event_ids is null or cardinality(p_event_ids) = 0 or q.event_id = any(p_event_ids))
    and mr.status = 'final';

  return jsonb_build_object(
    'success', true,
    'provider_slug', p_provider_slug,
    'as_of', v_as_of,
    'verified', v_verified,
    'failed', v_failed,
    'pending', v_pending
  );
end;
$$;

create or replace function public.verify_completed_result_batch(
  p_provider_slug text,
  p_event_ids bigint[] default null,
  p_as_of timestamptz default clock_timestamp()
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.verify_completed_result_batch(p_provider_slug, p_event_ids, p_as_of);
$$;

revoke execute on function private.verify_completed_result_batch(text, bigint[], timestamptz) from public, anon, authenticated;
revoke execute on function public.verify_completed_result_batch(text, bigint[], timestamptz) from public, anon, authenticated;
grant execute on function private.verify_completed_result_batch(text, bigint[], timestamptz) to service_role, postgres;
grant execute on function public.verify_completed_result_batch(text, bigint[], timestamptz) to service_role, postgres;
