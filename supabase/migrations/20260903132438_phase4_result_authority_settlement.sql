-- Phase 4: connect approved provider source events to canonical markets/results.
-- Result writes remain gated by competition_provider_settings.

create or replace function private.apply_provider_result_batch(
  p_provider_slug text,
  p_event_keys text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source record;
  v_market_id bigint;
  v_ruleset_id bigint;
  v_current_result record;
  v_result jsonb;
  v_result_status text;
  v_source_priority integer;
  v_provider_approved boolean;
  v_fixture_authority boolean;
  v_allow_single_source_finalization boolean;
  v_markets_upserted integer := 0;
  v_results_applied integer := 0;
  v_settled_results integer := 0;
  v_skipped_results integer := 0;
begin
  if nullif(trim(p_provider_slug), '') is null then
    raise exception 'provider slug is required';
  end if;
  if not exists (select 1 from public.data_providers where slug = p_provider_slug) then
    raise exception 'unknown provider: %', p_provider_slug;
  end if;

  select sr.id into v_ruleset_id
  from public.scoring_rulesets sr
  where sr.sport_slug = 'rugby-union'
    and sr.market_kind = 'team_scoreline'
    and sr.is_active = true
  order by sr.version desc, sr.id desc
  limit 1;

  if v_ruleset_id is null then
    raise exception 'active rugby-union team_scoreline ruleset is required';
  end if;

  for v_source in
    select
      pes.*,
      comp.competition_id,
      edition.edition_id,
      home_team.competitor_id as home_competitor_id,
      away_team.competitor_id as away_competitor_id
    from public.provider_event_sources pes
    left join public.provider_catalog_sources comp
      on comp.provider_slug = pes.provider_slug
     and comp.entity_kind = 'competition'
     and comp.external_key = pes.provider_competition_key
     and comp.mapping_status = 'mapped'
    left join public.provider_catalog_sources edition
      on edition.provider_slug = pes.provider_slug
     and edition.entity_kind = 'edition'
     and edition.external_key = pes.provider_edition_key
     and edition.mapping_status = 'mapped'
    left join public.provider_catalog_sources home_team
      on home_team.provider_slug = pes.provider_slug
     and home_team.entity_kind = 'competitor'
     and home_team.external_key = pes.provider_home_competitor_key
     and home_team.mapping_status = 'mapped'
    left join public.provider_catalog_sources away_team
      on away_team.provider_slug = pes.provider_slug
     and away_team.entity_kind = 'competitor'
     and away_team.external_key = pes.provider_away_competitor_key
     and away_team.mapping_status = 'mapped'
    where pes.provider_slug = p_provider_slug
      and pes.event_id is not null
      and (p_event_keys is null or cardinality(p_event_keys) = 0 or pes.provider_event_key = any(p_event_keys))
    order by pes.id
  loop
    select
      cps.enabled and not cps.observe_only,
      cps.fixture_authority,
      cps.allow_single_source_result_finalization,
      coalesce(cps.result_priority, 100)
    into
      v_provider_approved,
      v_fixture_authority,
      v_allow_single_source_finalization,
      v_source_priority
    from public.competition_provider_settings cps
    where cps.competition_id = v_source.competition_id
      and cps.provider_slug = p_provider_slug;

    if not found or not coalesce(v_provider_approved, false) then
      v_skipped_results := v_skipped_results + 1;
      continue;
    end if;

    update public.events e
    set status = case
          when e.status = 'completed' and v_source.normalized_status in ('scheduled', 'live') then e.status
          when v_source.normalized_status = 'finished' then 'completed'
          else v_source.normalized_status
        end,
        starts_at = coalesce(v_source.normalized_kickoff_at, e.starts_at),
        round_label = coalesce(v_source.round_name, e.round_label),
        venue_name = coalesce(v_source.venue_name, e.venue_name),
        updated_at = clock_timestamp()
    where e.id = v_source.event_id;

    select em.id into v_market_id
    from public.event_markets em
    where em.event_id = v_source.event_id
      and em.market_kind = 'team_scoreline'
      and em.is_current = true;

    if v_market_id is null then
      insert into public.event_markets (
        event_id, market_kind, payload_schema_version, ruleset_id,
        sequence_no, is_current, opens_at, locks_at, status
      )
      values (
        v_source.event_id,
        'team_scoreline',
        1,
        v_ruleset_id,
        1,
        true,
        v_source.normalized_kickoff_at - interval '14 days',
        v_source.normalized_kickoff_at,
        case
          when v_source.normalized_status in ('cancelled', 'abandoned') then 'void'
          else 'open'
        end
      )
      returning id into v_market_id;
      v_markets_upserted := v_markets_upserted + 1;
    else
      v_markets_upserted := v_markets_upserted + 1;
    end if;

    if v_source.normalized_status in ('cancelled', 'abandoned') then
      select * into v_current_result
      from public.market_results mr
      where mr.event_market_id = v_market_id;

      if v_current_result is null or v_current_result.status <> 'void' then
        perform private.settle_market_result(
          v_market_id, null, 'void', 'provider',
          p_provider_slug || ':' || v_source.provider_event_key,
          v_source_priority
        );
        v_results_applied := v_results_applied + 1;
      end if;
    elsif v_source.home_score is not null and v_source.away_score is not null then
      if v_source.normalized_status = 'finished' then
        if not coalesce(v_allow_single_source_finalization, false) then
          v_skipped_results := v_skipped_results + 1;
          continue;
        end if;
        v_result_status := 'final';
      elsif v_source.normalized_status = 'live' then
        v_result_status := 'provisional';
      else
        continue;
      end if;

      v_result := jsonb_build_object(
        'kind', 'team_scoreline',
        'version', 1,
        'home', v_source.home_score,
        'away', v_source.away_score
      );

      select * into v_current_result
      from public.market_results mr
      where mr.event_market_id = v_market_id;

      if v_current_result is null
         or v_current_result.status <> v_result_status
         or (v_current_result.result->>'home') <> (v_result->>'home')
         or (v_current_result.result->>'away') <> (v_result->>'away')
         or coalesce(v_current_result.source_ref, '') <> p_provider_slug || ':' || v_source.provider_event_key then
        perform private.settle_market_result(
          v_market_id,
          v_result,
          v_result_status,
          'provider',
          p_provider_slug || ':' || v_source.provider_event_key,
          v_source_priority
        );
        v_results_applied := v_results_applied + 1;
        if v_result_status = 'final' then
          v_settled_results := v_settled_results + 1;
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'provider_slug', p_provider_slug,
    'markets_upserted', v_markets_upserted,
    'results_applied', v_results_applied,
    'settled_results', v_settled_results,
    'skipped_results', v_skipped_results
  );
end;
$$;

create or replace function public.apply_provider_result_batch(
  p_provider_slug text,
  p_event_keys text[] default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.apply_provider_result_batch(p_provider_slug, p_event_keys);
$$;

revoke execute on function private.apply_provider_result_batch(text, text[]) from public, anon, authenticated;
revoke execute on function public.apply_provider_result_batch(text, text[]) from public, anon, authenticated;
grant execute on function private.apply_provider_result_batch(text, text[]) to service_role, postgres;
grant execute on function public.apply_provider_result_batch(text, text[]) to service_role, postgres;
