-- ============================================================================
-- Migration: Application API Views and Security Invoker RPCs
-- Phase 13: Application Event-Model Refactor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SCORE SUMMARY RPC
-- ----------------------------------------------------------------------------

create or replace function public.get_user_score_summary(
  p_user_id uuid,
  p_sport_slug text default null
)
returns table (
  total_raw_points bigint,
  total_normalized_points bigint,
  total_predictions bigint,
  settled_predictions bigint,
  exact_count bigint,
  margin_count bigint,
  outcome_count bigint,
  miss_count bigint,
  win_rate numeric
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total_raw bigint := 0;
  v_total_norm bigint := 0;
  v_total_preds bigint := 0;
  v_settled_preds bigint := 0;
  v_exact bigint := 0;
  v_margin bigint := 0;
  v_outcome bigint := 0;
  v_miss bigint := 0;
  v_win_rate numeric := 0.0;
begin
  select
    coalesce(sum(p.raw_points), 0)::bigint,
    coalesce(sum(p.normalized_basis_points), 0)::bigint,
    count(*)::bigint,
    count(*) filter (where p.settlement_status = 'settled')::bigint,
    count(*) filter (where p.tier_code = 'exact_score')::bigint,
    count(*) filter (where p.tier_code in ('exact_margin', 'close_margin'))::bigint,
    count(*) filter (where p.tier_code = 'outcome')::bigint,
    count(*) filter (where p.tier_code = 'miss')::bigint
  into
    v_total_raw,
    v_total_norm,
    v_total_preds,
    v_settled_preds,
    v_exact,
    v_margin,
    v_outcome,
    v_miss
  from public.predictions p
  join public.event_markets em on em.id = p.event_market_id
  join public.events e on e.id = em.event_id
  join public.competition_editions ce on ce.id = e.edition_id
  join public.competitions c on c.id = ce.competition_id
  where p.user_id = p_user_id
    and (p_sport_slug is null or c.sport_slug = p_sport_slug);

  if v_settled_preds > 0 then
    v_win_rate := round(((v_exact + v_margin + v_outcome)::numeric / v_settled_preds::numeric) * 100, 1);
  else
    v_win_rate := 0.0;
  end if;

  return query select
    v_total_raw,
    v_total_norm,
    v_total_preds,
    v_settled_preds,
    v_exact,
    v_margin,
    v_outcome,
    v_miss,
    v_win_rate;
end;
$$;

grant execute on function public.get_user_score_summary(uuid, text) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. COMMUNITY PREDICTION STATS RPC
-- ----------------------------------------------------------------------------

create or replace function public.get_market_community_stats(
  p_market_id bigint
)
returns table (
  total_predictions bigint,
  avg_home_score numeric,
  avg_away_score numeric,
  home_win_pct numeric,
  draw_pct numeric,
  away_win_pct numeric,
  top_exact_scores jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_is_locked boolean := false;
  v_count bigint := 0;
  v_avg_home numeric := 0.0;
  v_avg_away numeric := 0.0;
  v_home_wins bigint := 0;
  v_draws bigint := 0;
  v_away_wins bigint := 0;
  v_top_scores jsonb := '[]'::jsonb;
begin
  -- Check if market is locked or settled
  select (status in ('locked', 'settled', 'void') or now() >= locks_at)
  into v_is_locked
  from public.event_markets
  where id = p_market_id;

  -- If market does not exist or user cannot view predictions, return empty summary
  if v_is_locked is null then
    return;
  end if;

  -- Community statistics are calculated across predictions for this market
  -- Under security invoker, this respects RLS policies (e.g. visible locked predictions)
  with market_preds as (
    select
      (selection->>'home')::numeric as home_val,
      (selection->>'away')::numeric as away_val,
      selection as score_json
    from public.predictions
    where event_market_id = p_market_id
  ),
  aggregated as (
    select
      count(*)::bigint as total,
      coalesce(round(avg(home_val), 1), 0.0) as mean_home,
      coalesce(round(avg(away_val), 1), 0.0) as mean_away,
      count(*) filter (where home_val > away_val)::bigint as h_wins,
      count(*) filter (where home_val = away_val)::bigint as d_draws,
      count(*) filter (where home_val < away_val)::bigint as a_wins
    from market_preds
  ),
  top_combos as (
    select
      score_json->>'home' as h,
      score_json->>'away' as a,
      count(*)::bigint as combo_count,
      round((count(*)::numeric / nullif((select total from aggregated), 0)::numeric) * 100, 1) as combo_pct
    from market_preds
    group by score_json->>'home', score_json->>'away'
    order by combo_count desc
    limit 5
  )
  select
    a.total,
    a.mean_home,
    a.mean_away,
    case when a.total > 0 then round((a.h_wins::numeric / a.total::numeric) * 100, 1) else 0.0 end,
    case when a.total > 0 then round((a.d_draws::numeric / a.total::numeric) * 100, 1) else 0.0 end,
    case when a.total > 0 then round((a.a_wins::numeric / a.total::numeric) * 100, 1) else 0.0 end,
    coalesce((select jsonb_agg(jsonb_build_object('home', (h)::int, 'away', (a)::int, 'count', combo_count, 'pct', combo_pct)) from top_combos), '[]'::jsonb)
  into
    v_count,
    v_avg_home,
    v_avg_away,
    v_home_wins,
    v_draws,
    v_away_wins,
    v_top_scores
  from aggregated a;

  return query select
    v_count,
    v_avg_home,
    v_avg_away,
    case when v_count > 0 then round((v_home_wins::numeric / v_count::numeric) * 100, 1) else 0.0 end,
    case when v_count > 0 then round((v_draws::numeric / v_count::numeric) * 100, 1) else 0.0 end,
    case when v_count > 0 then round((v_away_wins::numeric / v_count::numeric) * 100, 1) else 0.0 end,
    v_top_scores;
end;
$$;

grant execute on function public.get_market_community_stats(bigint) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. POOL LEADERBOARD RPC
-- ----------------------------------------------------------------------------

create or replace function public.get_pool_leaderboard(
  p_pool_id uuid
)
returns table (
  rank bigint,
  user_id uuid,
  full_name text,
  avatar_url text,
  total_points bigint,
  exact_count bigint,
  margin_count bigint,
  outcome_count bigint,
  predictions_count bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_scoring_mode text;
  v_pool_scope text;
  v_sport_slug text;
  v_competition_id bigint;
  v_edition_id bigint;
  v_scoring_starts_at timestamptz;
begin
  -- Get pool configuration
  select
    p.scoring_mode,
    p.scope_kind,
    p.sport_slug,
    p.competition_id,
    p.edition_id,
    p.scoring_starts_at
  into
    v_scoring_mode,
    v_pool_scope,
    v_sport_slug,
    v_competition_id,
    v_edition_id,
    v_scoring_starts_at
  from public.pools p
  where p.id = p_pool_id;

  if v_scoring_mode is null then
    return;
  end if;

  return query
  with active_members as (
    select
      pm.user_id,
      pr.full_name,
      pr.avatar_url,
      pm.joined_at,
      pm.left_at
    from public.pool_members pm
    join public.profiles pr on pr.id = pm.user_id
    where pm.pool_id = p_pool_id
      and pm.left_at is null
  ),
  member_eligible_predictions as (
    select
      am.user_id,
      pred.id as pred_id,
      pred.tier_code,
      case
        when v_scoring_mode = 'normalized' then coalesce(pred.normalized_basis_points, 0)
        else coalesce(pred.raw_points, 0)
      end as points
    from active_members am
    left join public.predictions pred on pred.user_id = am.user_id
    left join public.event_markets em on em.id = pred.event_market_id
    left join public.events e on e.id = em.event_id
    left join public.competition_editions ce on ce.id = e.edition_id
    left join public.competitions c on c.id = ce.competition_id
    where pred.id is null or (
      pred.settlement_status = 'settled'
      and em.locks_at >= v_scoring_starts_at
      and em.locks_at >= am.joined_at
      and (
        v_pool_scope = 'all_sports'
        or (v_pool_scope = 'sport' and c.sport_slug = v_sport_slug)
        or (v_pool_scope = 'competition' and c.id = v_competition_id)
        or (v_pool_scope = 'edition' and ce.id = v_edition_id)
      )
    )
  ),
  aggregated as (
    select
      am.user_id,
      am.full_name,
      am.avatar_url,
      coalesce(sum(mep.points), 0)::bigint as member_points,
      count(mep.pred_id) filter (where mep.tier_code = 'exact_score')::bigint as exact_matches,
      count(mep.pred_id) filter (where mep.tier_code in ('exact_margin', 'close_margin'))::bigint as margin_matches,
      count(mep.pred_id) filter (where mep.tier_code = 'outcome')::bigint as outcome_matches,
      count(mep.pred_id)::bigint as total_picks
    from active_members am
    left join member_eligible_predictions mep on mep.user_id = am.user_id
    group by am.user_id, am.full_name, am.avatar_url
  )
  select
    dense_rank() over (order by a.member_points desc, a.exact_matches desc, a.margin_matches desc, a.outcome_matches desc)::bigint as rank,
    a.user_id,
    a.full_name,
    a.avatar_url,
    a.member_points as total_points,
    a.exact_matches as exact_count,
    a.margin_matches as margin_count,
    a.outcome_matches as outcome_count,
    a.total_picks as predictions_count
  from aggregated a
  order by rank, a.full_name;
end;
$$;

grant execute on function public.get_pool_leaderboard(uuid) to anon, authenticated, service_role;
