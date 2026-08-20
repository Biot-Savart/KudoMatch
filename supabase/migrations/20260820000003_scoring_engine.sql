-- 1. Create prediction scoring calculation function
create or replace function public.calculate_prediction_points(
  p_pred_home integer,
  p_pred_away integer,
  p_actual_home integer,
  p_actual_away integer
)
returns integer as $$
declare
  v_pred_diff integer;
  v_actual_diff integer;
  v_pred_outcome text;
  v_actual_outcome text;
begin
  -- If any score is missing, no points can be calculated
  if p_pred_home is null or p_pred_away is null or p_actual_home is null or p_actual_away is null then
    return 0;
  end if;

  -- 1. Exact score matched: 3 points
  if p_pred_home = p_actual_home and p_pred_away = p_actual_away then
    return 3;
  end if;

  v_pred_diff := p_pred_home - p_pred_away;
  v_actual_diff := p_actual_home - p_actual_away;

  -- Determine predicted outcome
  if v_pred_diff > 0 then
    v_pred_outcome := 'home';
  elsif v_pred_diff < 0 then
    v_pred_outcome := 'away';
  else
    v_pred_outcome := 'draw';
  end if;

  -- Determine actual outcome
  if v_actual_diff > 0 then
    v_actual_outcome := 'home';
  elsif v_actual_diff < 0 then
    v_actual_outcome := 'away';
  else
    v_actual_outcome := 'draw';
  end if;

  -- If predicted outcome does not match actual outcome, 0 points
  if v_pred_outcome != v_actual_outcome then
    return 0;
  end if;

  -- 2. Correct outcome + correct goal difference: 2 points
  if v_pred_diff = v_actual_diff then
    return 2;
  end if;

  -- 3. Correct outcome only: 1 point
  return 1;
end;
$$ language plpgsql immutable;

-- 2. Create the process_match_scoring trigger function
create or replace function public.process_match_scoring()
returns trigger as $$
declare
  v_user_ids uuid[];
begin
  -- Fetch all user IDs that predicted this match
  select array_agg(user_id) into v_user_ids
  from public.predictions
  where match_id = NEW.id;

  -- If there are no predictions for this match, we can skip updating user totals
  if v_user_ids is null or array_length(v_user_ids, 1) is null then
    -- However, we still need to make sure NEW is returned
    return NEW;
  end if;

  -- If match is marked as finished, calculate scores
  if NEW.status = 'finished' and NEW.home_score is not null and NEW.away_score is not null then
    update public.predictions
    set 
      points_earned = public.calculate_prediction_points(
        predicted_home_score,
        predicted_away_score,
        NEW.home_score,
        NEW.away_score
      ),
      updated_at = timezone('utc'::text, now())
    where match_id = NEW.id;
  else
    -- Reset predictions points if the match is moved away from finished status
    update public.predictions
    set 
      points_earned = 0,
      updated_at = timezone('utc'::text, now())
    where match_id = NEW.id;
  end if;

  -- Recalculate total points for all users who had predictions for this match
  update public.profiles p
  set 
    total_points = coalesce((
      select sum(points_earned)
      from public.predictions
      where user_id = p.id
    ), 0),
    updated_at = timezone('utc'::text, now())
  where p.id = any(v_user_ids);

  return NEW;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- 3. Bind the triggers to matches table
-- Split into separate triggers for UPDATE and INSERT to prevent SQLSTATE 42P17:
-- "INSERT trigger's WHEN condition cannot reference OLD values"

-- A. Update Trigger: fires when status, home_score, or away_score changes
create or replace trigger trigger_process_match_scoring_update
  after update of status, home_score, away_score on public.matches
  for each row
  when (
    OLD.status is distinct from NEW.status or
    OLD.home_score is distinct from NEW.home_score or
    OLD.away_score is distinct from NEW.away_score
  )
  execute function public.process_match_scoring();

-- B. Insert Trigger: fires on new match creation
create or replace trigger trigger_process_match_scoring_insert
  after insert on public.matches
  for each row
  execute function public.process_match_scoring();

-- 4. Create an administrative helper to recalculate all scores globally
create or replace function public.recalculate_all_scores()
returns void as $$
begin
  -- 1. Update points_earned for all predictions based on current match scores
  update public.predictions p
  set 
    points_earned = case
      when m.status = 'finished' and m.home_score is not null and m.away_score is not null then
        public.calculate_prediction_points(
          p.predicted_home_score,
          p.predicted_away_score,
          m.home_score,
          m.away_score
        )
      else 0
    end,
    updated_at = timezone('utc'::text, now())
  from public.matches m
  where p.match_id = m.id;

  -- 2. Recalculate total_points for all profiles
  update public.profiles prof
  set 
    total_points = coalesce((
      select sum(points_earned)
      from public.predictions
      where user_id = prof.id
    ), 0),
    updated_at = timezone('utc'::text, now());
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
