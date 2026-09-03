-- Phase 7: canonical standings, adaptive sync operations, and diagnostics.
-- Provider HTTP remains server-only; this migration stores normalized source
-- observations and exposes only canonical standings to application clients.

create table if not exists public.edition_standing_sources (
  id bigint generated always as identity primary key,
  provider_slug text not null references public.data_providers(slug) on delete cascade,
  edition_id bigint not null references public.competition_editions(id) on delete cascade,
  stage_key text not null default 'overall' check (length(trim(stage_key)) > 0),
  provider_competitor_key text not null,
  competitor_id bigint references public.competitors(id) on delete set null,
  position integer check (position is null or position > 0),
  played integer check (played is null or played >= 0),
  won integer check (won is null or won >= 0),
  drawn integer check (drawn is null or drawn >= 0),
  lost integer check (lost is null or lost >= 0),
  points_for integer,
  points_against integer,
  points_difference integer,
  bonus_points integer check (bonus_points is null or bonus_points >= 0),
  table_points integer,
  mapping_status text not null default 'needs_mapping'
    check (mapping_status in ('needs_mapping', 'mapped', 'ignored')),
  latest_raw_payload jsonb,
  provider_updated_at timestamptz,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_edition_standing_source_key unique
    (provider_slug, edition_id, stage_key, provider_competitor_key),
  constraint chk_edition_standing_source_mapping check (
    (mapping_status = 'mapped' and competitor_id is not null)
    or (mapping_status in ('needs_mapping', 'ignored') and competitor_id is null)
  )
);

create index if not exists idx_edition_standing_sources_edition_stage
  on public.edition_standing_sources (edition_id, stage_key, mapping_status);
create index if not exists idx_edition_standing_sources_competitor
  on public.edition_standing_sources (competitor_id)
  where competitor_id is not null;
create index if not exists idx_edition_standing_sources_provider
  on public.edition_standing_sources (provider_slug, fetched_at desc);

create table if not exists public.edition_standings (
  edition_id bigint not null references public.competition_editions(id) on delete cascade,
  stage_key text not null default 'overall' check (length(trim(stage_key)) > 0),
  competitor_id bigint not null references public.competitors(id) on delete cascade,
  position integer check (position is null or position > 0),
  played integer check (played is null or played >= 0),
  won integer check (won is null or won >= 0),
  drawn integer check (drawn is null or drawn >= 0),
  lost integer check (lost is null or lost >= 0),
  points_for integer,
  points_against integer,
  points_difference integer,
  bonus_points integer check (bonus_points is null or bonus_points >= 0),
  table_points integer,
  preferred_provider_slug text references public.data_providers(slug) on delete set null,
  quality_status text not null default 'unverified'
    check (quality_status in ('unverified', 'single_source', 'verified', 'conflicted')),
  source_count integer not null default 0 check (source_count >= 0),
  last_verified_at timestamptz,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (edition_id, stage_key, competitor_id)
);

create index if not exists idx_edition_standings_order
  on public.edition_standings (edition_id, stage_key, position, competitor_id);
create index if not exists idx_edition_standings_competitor
  on public.edition_standings (competitor_id, edition_id, stage_key);
create index if not exists idx_edition_standings_quality
  on public.edition_standings (quality_status, last_verified_at desc);
create index if not exists idx_edition_standings_preferred_provider
  on public.edition_standings (preferred_provider_slug)
  where preferred_provider_slug is not null;

drop trigger if exists set_edition_standing_sources_updated_at on public.edition_standing_sources;
create trigger set_edition_standing_sources_updated_at
  before update on public.edition_standing_sources
  for each row execute function private.set_updated_at();
drop trigger if exists set_edition_standings_updated_at on public.edition_standings;
create trigger set_edition_standings_updated_at
  before update on public.edition_standings
  for each row execute function private.set_updated_at();

create or replace view public.competition_standings
with (security_invoker = true)
as
select
  es.edition_id, es.stage_key, es.competitor_id, ce.competition_id,
  c.sport_slug, c.slug as competition_slug, c.name as competition_name,
  ce.season_key, ce.name as edition_name, es.position, es.played, es.won,
  es.drawn, es.lost, es.points_for, es.points_against, es.points_difference,
  es.bonus_points, es.table_points, es.preferred_provider_slug,
  es.quality_status, es.source_count, es.last_verified_at, es.details,
  comp.name as competitor_name, comp.short_name as competitor_short_name,
  comp.media_url as competitor_media_url
from public.edition_standings es
join public.competition_editions ce on ce.id = es.edition_id
join public.competitions c on c.id = ce.competition_id
join public.competitors comp on comp.id = es.competitor_id
where c.is_active = true;

grant select on public.edition_standings to anon, authenticated;
grant select on public.competition_standings to anon, authenticated;
grant all on public.edition_standing_sources, public.edition_standings to service_role, postgres;
revoke all on public.edition_standing_sources from public, anon, authenticated;
revoke select on public.edition_standings from anon, authenticated;
revoke all on sequence public.edition_standing_sources_id_seq from public, anon, authenticated;
grant usage, select on sequence public.edition_standing_sources_id_seq to service_role, postgres;
alter table public.edition_standing_sources enable row level security;
alter table public.edition_standings enable row level security;
drop policy if exists "Canonical standings are publicly readable" on public.edition_standings;
create policy "Canonical standings are publicly readable"
  on public.edition_standings for select to anon, authenticated using (true);

alter table public.provider_sync_targets add column if not exists lease_holder text;
alter table public.provider_sync_targets add column if not exists last_started_at timestamptz;
alter table public.provider_sync_targets add column if not exists last_completed_at timestamptz;
alter table public.provider_sync_targets add column if not exists last_error_at timestamptz;
alter table public.provider_sync_targets drop constraint if exists provider_sync_targets_operation_check;
alter table public.provider_sync_targets add constraint provider_sync_targets_operation_check
  check (operation in ('historical_backfill', 'current_fixtures', 'current_results', 'standings', 'contract_check'));
create index if not exists idx_provider_sync_targets_claim
  on public.provider_sync_targets (next_run_at, id)
  where enabled = true and status in ('pending', 'failed', 'running');

create or replace function private.claim_provider_sync_targets(
  p_now timestamptz default clock_timestamp(),
  p_holder_id text default 'dispatcher',
  p_limit integer default 10
)
returns setof public.provider_sync_targets
language plpgsql security definer set search_path = ''
as $$
begin
  if nullif(trim(p_holder_id), '') is null then raise exception 'holder id is required'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then raise exception 'limit must be between 1 and 100'; end if;
  return query
    with due as (
      select id from public.provider_sync_targets
      where enabled = true
        and next_run_at <= coalesce(p_now, clock_timestamp())
        and (status in ('pending', 'failed') or (status = 'running'
          and (last_started_at is null or last_started_at < coalesce(p_now, clock_timestamp()) - interval '15 minutes')))
      order by next_run_at, id limit p_limit for update skip locked
    )
    update public.provider_sync_targets t
    set status = 'running', lease_holder = p_holder_id,
        last_started_at = coalesce(p_now, clock_timestamp()), error_summary = null,
        updated_at = coalesce(p_now, clock_timestamp())
    from due where t.id = due.id returning t.*;
end;
$$;

create or replace function public.claim_provider_sync_targets(
  p_now timestamptz default clock_timestamp(), p_holder_id text default 'dispatcher', p_limit integer default 10
)
returns setof public.provider_sync_targets
language sql security definer set search_path = ''
as $$ select * from private.claim_provider_sync_targets(p_now, p_holder_id, p_limit); $$;

create or replace function private.finish_provider_sync_target(
  p_target_id bigint, p_holder_id text, p_status text,
  p_next_run_at timestamptz, p_error_summary text default null
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_updated integer;
begin
  if p_status not in ('pending', 'completed', 'failed', 'paused') then raise exception 'invalid target status'; end if;
  update public.provider_sync_targets
  set status = p_status, next_run_at = coalesce(p_next_run_at, clock_timestamp()),
      last_completed_at = case when p_status in ('pending', 'completed') then clock_timestamp() else last_completed_at end,
      last_error_at = case when p_status = 'failed' then clock_timestamp() else last_error_at end,
      error_summary = nullif(left(p_error_summary, 500), ''), lease_holder = null,
      updated_at = clock_timestamp()
  where id = p_target_id and status = 'running' and lease_holder = p_holder_id;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.finish_provider_sync_target(
  p_target_id bigint, p_holder_id text, p_status text,
  p_next_run_at timestamptz, p_error_summary text default null
)
returns boolean language sql security definer set search_path = ''
as $$ select private.finish_provider_sync_target(p_target_id, p_holder_id, p_status, p_next_run_at, p_error_summary); $$;

create or replace function private.mark_standings_sync_due_on_completed()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    update public.provider_sync_targets
    set next_run_at = least(next_run_at, clock_timestamp()),
        status = case when status = 'running' then status else 'pending' end,
        updated_at = clock_timestamp()
    where edition_id = new.edition_id and operation = 'standings' and enabled = true;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_mark_standings_sync_due_on_completed on public.events;
create trigger trg_mark_standings_sync_due_on_completed
  after insert or update of status on public.events
  for each row execute function private.mark_standings_sync_due_on_completed();

create or replace function private.upsert_provider_standings(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_provider_slug text := nullif(trim(p_payload->>'provider_slug'), '');
  v_edition_id bigint := (p_payload->>'edition_id')::bigint;
  v_stage_key text := coalesce(nullif(trim(p_payload->>'stage_key'), ''), 'overall');
  v_fetched_at timestamptz := coalesce(nullif(p_payload->>'fetched_at', '')::timestamptz, clock_timestamp());
  v_row jsonb;
  v_competitor_id bigint;
  v_source_count integer := 0;
  v_total_source_count integer := 0;
  v_mapped_count integer := 0;
  v_unmapped_count integer := 0;
  v_canonical_count integer := 0;
  v_selected record;
  v_preferred_provider text;
  v_quality text;
  v_conflict boolean;
  v_details jsonb;
begin
  if v_provider_slug is null or v_edition_id is null then raise exception 'provider_slug and edition_id are required'; end if;
  if not exists (select 1 from public.data_providers where slug = v_provider_slug and is_active = true) then raise exception 'unknown or inactive provider'; end if;
  if not exists (select 1 from public.competition_editions where id = v_edition_id) then raise exception 'unknown edition'; end if;

  for v_row in select value from jsonb_array_elements(coalesce(p_payload->'rows', '[]'::jsonb)) loop
    v_competitor_id := null;
    if nullif(v_row->>'competitor_id', '') is not null
       and exists (select 1 from public.edition_competitors ec where ec.edition_id = v_edition_id and ec.competitor_id = (v_row->>'competitor_id')::bigint) then
      v_competitor_id := (v_row->>'competitor_id')::bigint;
    end if;
    insert into public.edition_standing_sources (
      provider_slug, edition_id, stage_key, provider_competitor_key, competitor_id,
      position, played, won, drawn, lost, points_for, points_against,
      points_difference, bonus_points, table_points, mapping_status,
      latest_raw_payload, provider_updated_at, fetched_at
    ) values (
      v_provider_slug, v_edition_id, v_stage_key, v_row->>'provider_competitor_key', v_competitor_id,
      (v_row->>'position')::integer, (v_row->>'played')::integer, (v_row->>'won')::integer,
      (v_row->>'drawn')::integer, (v_row->>'lost')::integer, (v_row->>'points_for')::integer,
      (v_row->>'points_against')::integer, (v_row->>'points_difference')::integer,
      (v_row->>'bonus_points')::integer, (v_row->>'table_points')::integer,
      case when v_competitor_id is null then 'needs_mapping' else 'mapped' end,
      v_row->'raw_payload', nullif(v_row->>'provider_updated_at', '')::timestamptz, v_fetched_at
    ) on conflict (provider_slug, edition_id, stage_key, provider_competitor_key) do update set
      competitor_id = excluded.competitor_id, position = excluded.position, played = excluded.played,
      won = excluded.won, drawn = excluded.drawn, lost = excluded.lost,
      points_for = excluded.points_for, points_against = excluded.points_against,
      points_difference = excluded.points_difference, bonus_points = excluded.bonus_points,
      table_points = excluded.table_points, mapping_status = excluded.mapping_status,
      latest_raw_payload = excluded.latest_raw_payload, provider_updated_at = excluded.provider_updated_at,
      fetched_at = excluded.fetched_at;
  end loop;

  select count(*)::integer, count(*) filter (where mapping_status = 'mapped')::integer,
         count(*) filter (where mapping_status <> 'mapped')::integer
    into v_total_source_count, v_mapped_count, v_unmapped_count
  from public.edition_standing_sources
  where edition_id = v_edition_id and stage_key = v_stage_key;

  select cps.provider_slug into v_preferred_provider
  from public.competition_provider_settings cps
  join public.competition_editions ce on ce.competition_id = cps.competition_id
  where ce.id = v_edition_id and cps.enabled = true and cps.observe_only = false
    and cps.standings_priority is not null
  order by cps.standings_priority, cps.provider_slug limit 1;

  for v_competitor_id in
    select distinct competitor_id from public.edition_standing_sources
    where edition_id = v_edition_id and stage_key = v_stage_key and mapping_status = 'mapped'
  loop
    select s.* into v_selected
    from public.edition_standing_sources s
    join public.competition_provider_settings cps on cps.provider_slug = s.provider_slug
    join public.competition_editions ce on ce.competition_id = cps.competition_id and ce.id = s.edition_id
    where s.edition_id = v_edition_id and s.stage_key = v_stage_key
      and s.competitor_id = v_competitor_id and s.mapping_status = 'mapped'
      and cps.enabled = true and cps.observe_only = false and cps.standings_priority is not null
    order by cps.standings_priority, s.provider_slug limit 1;
    if not found then continue; end if;

    select count(*)::integer into v_source_count
    from public.edition_standing_sources s
    where s.edition_id = v_edition_id and s.stage_key = v_stage_key
      and s.competitor_id = v_competitor_id and s.mapping_status = 'mapped';
    select exists (
      select 1 from public.edition_standing_sources s
      where s.edition_id = v_edition_id and s.stage_key = v_stage_key
        and s.competitor_id = v_competitor_id and s.mapping_status = 'mapped'
        and (s.position is distinct from v_selected.position or s.played is distinct from v_selected.played
          or s.won is distinct from v_selected.won or s.drawn is distinct from v_selected.drawn
          or s.lost is distinct from v_selected.lost or s.points_for is distinct from v_selected.points_for
          or s.points_against is distinct from v_selected.points_against
          or s.points_difference is distinct from v_selected.points_difference
          or s.bonus_points is distinct from v_selected.bonus_points
          or s.table_points is distinct from v_selected.table_points)
    ) into v_conflict;
    v_quality := case when v_conflict then 'conflicted' when v_source_count > 1 then 'verified' else 'single_source' end;
    select jsonb_build_object('providers', coalesce(jsonb_agg(jsonb_build_object(
      'provider_slug', s.provider_slug, 'position', s.position, 'played', s.played,
      'won', s.won, 'drawn', s.drawn, 'lost', s.lost, 'points_for', s.points_for,
      'points_against', s.points_against, 'points_difference', s.points_difference,
      'bonus_points', s.bonus_points, 'table_points', s.table_points
    ) order by s.provider_slug), '[]'::jsonb)) into v_details
    from public.edition_standing_sources s
    where s.edition_id = v_edition_id and s.stage_key = v_stage_key
      and s.competitor_id = v_competitor_id and s.mapping_status = 'mapped';

    insert into public.edition_standings (
      edition_id, stage_key, competitor_id, position, played, won, drawn, lost,
      points_for, points_against, points_difference, bonus_points, table_points,
      preferred_provider_slug, quality_status, source_count, last_verified_at, details
    ) values (
      v_edition_id, v_stage_key, v_competitor_id, v_selected.position, v_selected.played,
      v_selected.won, v_selected.drawn, v_selected.lost, v_selected.points_for,
      v_selected.points_against, v_selected.points_difference, v_selected.bonus_points,
      v_selected.table_points, coalesce(v_preferred_provider, v_selected.provider_slug),
      v_quality, v_source_count, case when v_conflict then null else clock_timestamp() end, v_details
    ) on conflict (edition_id, stage_key, competitor_id) do update set
      position = case when excluded.quality_status = 'conflicted' then edition_standings.position else excluded.position end,
      played = case when excluded.quality_status = 'conflicted' then edition_standings.played else excluded.played end,
      won = case when excluded.quality_status = 'conflicted' then edition_standings.won else excluded.won end,
      drawn = case when excluded.quality_status = 'conflicted' then edition_standings.drawn else excluded.drawn end,
      lost = case when excluded.quality_status = 'conflicted' then edition_standings.lost else excluded.lost end,
      points_for = case when excluded.quality_status = 'conflicted' then edition_standings.points_for else excluded.points_for end,
      points_against = case when excluded.quality_status = 'conflicted' then edition_standings.points_against else excluded.points_against end,
      points_difference = case when excluded.quality_status = 'conflicted' then edition_standings.points_difference else excluded.points_difference end,
      bonus_points = case when excluded.quality_status = 'conflicted' then edition_standings.bonus_points else excluded.bonus_points end,
      table_points = case when excluded.quality_status = 'conflicted' then edition_standings.table_points else excluded.table_points end,
      preferred_provider_slug = excluded.preferred_provider_slug, quality_status = excluded.quality_status,
      source_count = excluded.source_count, last_verified_at = excluded.last_verified_at, details = excluded.details;
    v_canonical_count := v_canonical_count + 1;
  end loop;
  return jsonb_build_object('success', true, 'provider_slug', v_provider_slug, 'edition_id', v_edition_id,
    'stage_key', v_stage_key, 'source_count', v_total_source_count, 'mapped_count', v_mapped_count,
    'unmapped_count', v_unmapped_count, 'canonical_count', v_canonical_count);
end;
$$;

create or replace function public.upsert_provider_standings(p_payload jsonb)
returns jsonb language sql security definer set search_path = ''
as $$ select private.upsert_provider_standings(p_payload); $$;

create or replace view private.provider_diagnostics
with (security_invoker = true)
as
select dp.slug as provider_slug, dp.name as provider_name, dp.is_active,
  prs.health_status, prs.circuit_state, prs.circuit_open_until,
  prs.last_success_at, prs.last_failure_at, prs.last_http_status,
  prs.last_error_code, prs.last_latency_ms, prs.minute_request_count,
  prs.minute_request_limit, prs.day_request_count, prs.day_request_limit,
  (select count(*)::integer from public.provider_catalog_sources pcs
    where pcs.provider_slug = dp.slug and pcs.mapping_status = 'needs_mapping') as mapping_gaps,
  (select count(*)::integer from public.ingestion_quarantine iq
    where iq.provider_slug = dp.slug and iq.status = 'unresolved') as quarantine_count,
  (select max(ir.started_at) from public.ingestion_runs ir where ir.provider_slug = dp.slug) as last_run_at,
  (select ir.summary from public.ingestion_runs ir where ir.provider_slug = dp.slug
    order by ir.started_at desc limit 1) as last_run_summary
from public.data_providers dp
left join public.provider_runtime_state prs on prs.provider_slug = dp.slug;

create or replace view private.provider_event_diagnostics
with (security_invoker = true)
as
select pes.provider_slug, pes.provider_event_key, pes.event_id, pes.mapping_state,
  pes.normalized_status as provider_status, pes.home_score as provider_home_score,
  pes.away_score as provider_away_score, pes.last_fetched_at, e.status as canonical_status,
  mr.result as canonical_result, mr.status as canonical_result_status,
  q.quality_status, q.preferred_provider_slug, q.conflict_details
from public.provider_event_sources pes
left join public.events e on e.id = pes.event_id
left join public.event_data_quality q on q.event_id = pes.event_id
left join public.event_markets em on em.event_id = pes.event_id and em.is_current = true
left join public.market_results mr on mr.event_market_id = em.id;

create or replace view private.provider_standing_diagnostics
with (security_invoker = true)
as
select ess.provider_slug, ess.edition_id, ess.stage_key, ess.provider_competitor_key,
  ess.competitor_id, ess.mapping_status, ess.position as provider_position,
  ess.table_points as provider_table_points, es.position as canonical_position,
  es.table_points as canonical_table_points, es.quality_status, ess.fetched_at
from public.edition_standing_sources ess
left join public.edition_standings es on es.edition_id = ess.edition_id
  and es.stage_key = ess.stage_key and es.competitor_id = ess.competitor_id;

revoke all on private.provider_diagnostics, private.provider_event_diagnostics,
  private.provider_standing_diagnostics from public, anon, authenticated;
grant select on private.provider_diagnostics, private.provider_event_diagnostics,
  private.provider_standing_diagnostics to service_role, postgres;
revoke execute on function private.claim_provider_sync_targets(timestamptz, text, integer),
  private.finish_provider_sync_target(bigint, text, text, timestamptz, text),
  private.upsert_provider_standings(jsonb) from public, anon, authenticated;
revoke execute on function public.claim_provider_sync_targets(timestamptz, text, integer),
  public.finish_provider_sync_target(bigint, text, text, timestamptz, text),
  public.upsert_provider_standings(jsonb) from public, anon, authenticated;
grant execute on function private.claim_provider_sync_targets(timestamptz, text, integer),
  private.finish_provider_sync_target(bigint, text, text, timestamptz, text),
  private.upsert_provider_standings(jsonb) to service_role, postgres;
grant execute on function public.claim_provider_sync_targets(timestamptz, text, integer),
  public.finish_provider_sync_target(bigint, text, text, timestamptz, text),
  public.upsert_provider_standings(jsonb) to service_role, postgres;

-- Keep targets present for staged activation and observe-only diagnostics. A
-- historical-only provider does not receive a current sync target.
insert into public.provider_sync_targets (provider_slug, edition_id, operation, next_run_at)
select cps.provider_slug, ce.id, operation.operation, clock_timestamp()
from public.competition_provider_settings cps
join public.competition_editions ce on ce.competition_id = cps.competition_id
cross join lateral (values
  ('current_fixtures', cps.fixture_priority),
  ('current_results', cps.result_priority),
  ('standings', cps.standings_priority)
) operation(operation, priority)
where operation.priority is not null
  and coalesce((cps.config->>'historical_only')::boolean, false) = false
on conflict (provider_slug, edition_id, operation) do nothing;
