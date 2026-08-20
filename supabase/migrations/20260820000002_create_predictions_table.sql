-- Create predictions table
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  match_id uuid references public.matches(id) on delete cascade not null,
  predicted_home_score integer not null check (predicted_home_score >= 0),
  predicted_away_score integer not null check (predicted_away_score >= 0),
  predicted_winner text check (predicted_winner in ('home', 'away', 'draw')),
  points_earned integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  constraint unique_user_match unique (user_id, match_id)
);

-- Create optimized indices for performance
create index idx_predictions_user_id on public.predictions(user_id);
create index idx_predictions_match_id on public.predictions(match_id);
create index idx_predictions_user_match on public.predictions(user_id, match_id);

-- Create a trigger function to verify kickoff time and auto-derive predicted_winner
create or replace function public.verify_prediction_lock()
returns trigger as $$
declare
  v_kickoff_time timestamp with time zone;
  v_match_status text;
begin
  -- If this is an UPDATE and the predicted scores have NOT changed, it means the scoring engine
  -- is updating points_earned or updated_at. We bypass all lock/kickoff validation checks.
  if TG_OP = 'UPDATE'
     and OLD.predicted_home_score is not distinct from NEW.predicted_home_score
     and OLD.predicted_away_score is not distinct from NEW.predicted_away_score then
    -- Derive predicted_winner just to ensure complete database consistency
    if NEW.predicted_home_score > NEW.predicted_away_score then
      NEW.predicted_winner := 'home';
    elsif NEW.predicted_home_score < NEW.predicted_away_score then
      NEW.predicted_winner := 'away';
    else
      NEW.predicted_winner := 'draw';
    end if;
    NEW.updated_at := timezone('utc'::text, now());
    return NEW;
  end if;

  -- 1. Fetch kickoff time and status for the target match
  select kickoff_time, status into v_kickoff_time, v_match_status
  from public.matches
  where id = NEW.match_id;

  if v_kickoff_time is null then
    raise exception 'Match not found for prediction.';
  end if;

  -- 2. Verify match status is still scheduled
  if v_match_status in ('live', 'finished', 'cancelled') then
    raise exception 'Cannot modify predictions for a match that is live, finished, or cancelled.';
  end if;

  -- 3. Verify current UTC time against kickoff timestamp
  if timezone('utc'::text, now()) >= v_kickoff_time then
    raise exception 'Predictions are locked. Kickoff time has already passed.';
  end if;

  -- 4. Auto-derive predicted_winner to ensure 100% data integrity
  if NEW.predicted_home_score > NEW.predicted_away_score then
    NEW.predicted_winner := 'home';
  elsif NEW.predicted_home_score < NEW.predicted_away_score then
    NEW.predicted_winner := 'away';
  else
    NEW.predicted_winner := 'draw';
  end if;

  NEW.updated_at := timezone('utc'::text, now());
  return NEW;
end;
$$ language plpgsql security definer;

-- Bind the trigger
create trigger before_prediction_save
  before insert or update on public.predictions
  for each row execute procedure public.verify_prediction_lock();

-- Enable Row Level Security (RLS)
alter table public.predictions enable row level security;

-- Set up RLS Policies

-- Select Policy: Users can always view their own predictions.
-- Authenticated users can view others' predictions ONLY after kickoff time.
create policy "Predictions are viewable by owner, or everyone after kickoff." on public.predictions
  for select using (
    auth.uid() = user_id OR 
    timezone('utc'::text, now()) >= (select kickoff_time from public.matches where id = match_id)
  );

-- Insert/Update/Delete Policies: Restricted to owner of the prediction
create policy "Users can insert their own predictions." on public.predictions
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own predictions." on public.predictions
  for update using (auth.uid() = user_id);

create policy "Users can delete their own predictions." on public.predictions
  for delete using (auth.uid() = user_id);
