-- Phase 9 Migration: Community Prediction Stats & Match Distribution RPC

create or replace function public.get_match_prediction_stats(
  p_match_id uuid,
  p_pool_id uuid default null
)
returns json as $$
declare
  v_match record;
  v_is_locked boolean;
  v_total_count integer := 0;
  v_home_win_count integer := 0;
  v_draw_count integer := 0;
  v_away_win_count integer := 0;
  v_exact_count integer := 0;
  v_diff_count integer := 0;
  v_winner_count integer := 0;
  v_miss_count integer := 0;
  v_top_scores json;
  v_participants json;
begin
  -- Fetch the match to check kickoff and status
  select * into v_match from public.matches where id = p_match_id;
  if not found then
    return null;
  end if;

  v_is_locked := (v_match.kickoff_time <= timezone('utc'::text, now()) or v_match.status in ('live', 'finished'));

  -- Filter predictions based on pool membership if p_pool_id is provided
  with relevant_predictions as (
    select 
      p.user_id,
      p.predicted_home_score,
      p.predicted_away_score,
      p.points_earned,
      prof.username,
      prof.avatar_url,
      prof.full_name
    from public.predictions p
    join public.profiles prof on prof.id = p.user_id
    where p.match_id = p_match_id
      and (
        p_pool_id is null 
        or p.user_id in (select user_id from public.pool_members where pool_id = p_pool_id)
      )
  )
  select 
    count(*),
    count(*) filter (where predicted_home_score > predicted_away_score),
    count(*) filter (where predicted_home_score = predicted_away_score),
    count(*) filter (where predicted_home_score < predicted_away_score),
    count(*) filter (where points_earned = 3),
    count(*) filter (where points_earned = 2),
    count(*) filter (where points_earned = 1),
    count(*) filter (where points_earned = 0 and (v_match.status = 'finished'))
  into 
    v_total_count,
    v_home_win_count,
    v_draw_count,
    v_away_win_count,
    v_exact_count,
    v_diff_count,
    v_winner_count,
    v_miss_count
  from relevant_predictions;

  -- Top predicted scorelines (always safe aggregate)
  with score_counts as (
    select 
      (predicted_home_score::text || ' - ' || predicted_away_score::text) as scoreline,
      count(*) as cnt
    from public.predictions p
    where p.match_id = p_match_id
      and (
        p_pool_id is null 
        or p.user_id in (select user_id from public.pool_members where pool_id = p_pool_id)
      )
    group by scoreline
    order by cnt desc
    limit 5
  )
  select coalesce(json_agg(json_build_object(
    'scoreline', scoreline,
    'count', cnt,
    'percentage', case when v_total_count > 0 then round((cnt::numeric / v_total_count::numeric) * 100) else 0 end
  )), '[]'::json)
  into v_top_scores
  from score_counts;

  -- Individual participant predictions: only reveal if match is locked/live/finished
  if v_is_locked then
    with participant_list as (
      select 
        p.user_id,
        prof.username,
        prof.avatar_url,
        prof.full_name,
        p.predicted_home_score,
        p.predicted_away_score,
        p.points_earned
      from public.predictions p
      join public.profiles prof on prof.id = p.user_id
      where p.match_id = p_match_id
        and (
          p_pool_id is null 
          or p.user_id in (select user_id from public.pool_members where pool_id = p_pool_id)
        )
      order by p.points_earned desc, prof.username asc
    )
    select coalesce(json_agg(json_build_object(
      'user_id', user_id,
      'username', username,
      'avatar_url', avatar_url,
      'full_name', full_name,
      'predicted_home_score', predicted_home_score,
      'predicted_away_score', predicted_away_score,
      'points_earned', points_earned
    )), '[]'::json)
    into v_participants
    from participant_list;
  else
    v_participants := '[]'::json;
  end if;

  return json_build_object(
    'match_id', p_match_id,
    'is_locked', v_is_locked,
    'total_predictions', v_total_count,
    'outcome_distribution', json_build_object(
      'home_win_count', v_home_win_count,
      'draw_count', v_draw_count,
      'away_win_count', v_away_win_count,
      'home_win_pct', case when v_total_count > 0 then round((v_home_win_count::numeric / v_total_count::numeric) * 100) else 0 end,
      'draw_pct', case when v_total_count > 0 then round((v_draw_count::numeric / v_total_count::numeric) * 100) else 0 end,
      'away_win_pct', case when v_total_count > 0 then round((v_away_win_count::numeric / v_total_count::numeric) * 100) else 0 end
    ),
    'points_distribution', json_build_object(
      'exact_3pts', v_exact_count,
      'diff_2pts', v_diff_count,
      'winner_1pt', v_winner_count,
      'miss_0pts', v_miss_count
    ),
    'top_scores', v_top_scores,
    'participants', v_participants
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Grant execution to public / authenticated
grant execute on function public.get_match_prediction_stats(uuid, uuid) to authenticated, anon;
