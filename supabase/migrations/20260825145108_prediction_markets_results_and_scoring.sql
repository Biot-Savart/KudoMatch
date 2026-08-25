-- ============================================================================
-- Migration 1: Prediction Markets, Results, and Multi-Sport Scoring Engine
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SCORING RULESETS & TIERS
-- ----------------------------------------------------------------------------

create table if not exists public.scoring_rulesets (
  id bigint generated always as identity primary key,
  sport_slug text not null references public.sports(slug) on delete restrict,
  market_kind text not null check (market_kind in ('team_scoreline')),
  evaluator_key text not null check (evaluator_key in ('football_scoreline_v1', 'rugby_union_scoreline_v1')),
  version integer not null check (version > 0),
  max_raw_points integer not null check (max_raw_points > 0),
  evaluator_config jsonb not null default '{}'::jsonb,
  ui_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_scoring_rulesets unique (sport_slug, market_kind, version),
  constraint chk_ruleset_evaluator_config_size check (octet_length(evaluator_config::text) <= 4096),
  constraint chk_ruleset_ui_config_size check (octet_length(ui_config::text) <= 4096)
);

create table if not exists public.scoring_rule_tiers (
  ruleset_id bigint not null references public.scoring_rulesets(id) on delete restrict,
  tier_code text not null check (tier_code in ('exact_score', 'exact_margin', 'close_margin', 'outcome', 'miss')),
  raw_points integer not null check (raw_points >= 0),
  rank_order integer not null check (rank_order > 0),
  label text not null check (length(trim(label)) > 0),
  description text not null,
  example text,
  primary key (ruleset_id, tier_code),
  constraint uq_scoring_rule_tiers_rank unique (ruleset_id, rank_order)
);

create index ifs_scoring_rulesets_sport on public.scoring_rulesets(sport_slug, is_active);

-- Prevent mutation / deletion of rulesets once referenced by an event market
create or replace function private.fn_enforce_ruleset_immutability()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.event_markets where ruleset_id = old.id) then
    if tg_op = 'DELETE' then
      raise exception 'Cannot delete scoring ruleset % because it is referenced by event markets', old.id
        using errcode = '23503';
    end if;
    if tg_op = 'UPDATE' then
      if (new.sport_slug <> old.sport_slug or
          new.market_kind <> old.market_kind or
          new.evaluator_key <> old.evaluator_key or
          new.version <> old.version or
          new.max_raw_points <> old.max_raw_points or
          new.evaluator_config <> old.evaluator_config) then
        raise exception 'Cannot modify scoring parameters of referenced ruleset %. Create a new version instead.', old.id
          using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger trg_enforce_ruleset_immutability
  before update or delete on public.scoring_rulesets
  for each row execute function private.fn_enforce_ruleset_immutability();

-- ----------------------------------------------------------------------------
-- 2. EVENT MARKETS
-- ----------------------------------------------------------------------------

create table if not exists public.event_markets (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.events(id) on delete restrict,
  market_kind text not null check (market_kind in ('team_scoreline')),
  payload_schema_version integer not null default 1 check (payload_schema_version > 0),
  ruleset_id bigint not null references public.scoring_rulesets(id) on delete restrict,
  sequence_no integer not null default 1 check (sequence_no > 0),
  is_current boolean not null default true,
  opens_at timestamptz not null,
  locks_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'locked', 'settled', 'void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_event_market_sequence unique (event_id, market_kind, sequence_no),
  constraint chk_market_opens_before_locks check (opens_at < locks_at)
);

create unique index if not exists uq_event_markets_current
  on public.event_markets (event_id, market_kind)
  where (is_current = true);

create index if not exists idx_event_markets_event on public.event_markets (event_id, is_current);
create index if not exists idx_event_markets_status_locks on public.event_markets (status, locks_at);

-- Event Market Validation Trigger
create or replace function private.fn_validate_event_market()
returns trigger
language plpgsql
as $$
declare
  v_event_starts_at timestamptz;
  v_event_sport text;
  v_ruleset_sport text;
  v_ruleset_market_kind text;
  v_home_count int;
  v_away_count int;
begin
  -- Retrieve event details
  select e.starts_at, c.sport_slug
  into v_event_starts_at, v_event_sport
  from public.events e
  join public.competition_editions ce on ce.id = e.edition_id
  join public.competitions c on c.id = ce.competition_id
  where e.id = new.event_id;

  if not found then
    raise exception 'Event % not found for market', new.event_id using errcode = '23503';
  end if;

  -- 1. locks_at <= event.starts_at
  if new.locks_at > v_event_starts_at then
    raise exception 'Market locks_at (%) must be on or before event starts_at (%)', new.locks_at, v_event_starts_at
      using errcode = '23514';
  end if;

  -- 2. Ruleset validation
  select sport_slug, market_kind
  into v_ruleset_sport, v_ruleset_market_kind
  from public.scoring_rulesets
  where id = new.ruleset_id;

  if not found then
    raise exception 'Ruleset % not found for market', new.ruleset_id using errcode = '23503';
  end if;

  if v_ruleset_sport <> v_event_sport then
    raise exception 'Ruleset sport (%) does not match event sport (%)', v_ruleset_sport, v_event_sport
      using errcode = '23514';
  end if;

  if v_ruleset_market_kind <> new.market_kind then
    raise exception 'Ruleset market kind (%) does not match market kind (%)', v_ruleset_market_kind, new.market_kind
      using errcode = '23514';
  end if;

  -- 3. If market_kind is team_scoreline, check competitor roles
  if new.market_kind = 'team_scoreline' and (new.status in ('open', 'locked', 'settled')) then
    select
      count(*) filter (where slot = 1 and role = 'home'),
      count(*) filter (where slot = 2 and role = 'away')
    into v_home_count, v_away_count
    from public.event_competitors
    where event_id = new.event_id;

    if v_home_count <> 1 or v_away_count <> 1 then
      raise exception 'team_scoreline market requires exactly 2 competitors with slot 1 (home) and slot 2 (away)'
        using errcode = '23514';
    end if;
  end if;

  -- 4. Status Transition Constraints on Update
  if tg_op = 'UPDATE' then
    if old.status in ('settled', 'void') and new.status <> old.status then
      raise exception 'Cannot change status of already % market %', old.status, old.id
        using errcode = '23514';
    end if;

    if old.status <> 'draft' and (new.ruleset_id <> old.ruleset_id or new.market_kind <> old.market_kind or new.event_id <> old.event_id) then
      raise exception 'Cannot modify identity/ruleset of non-draft market %', old.id
        using errcode = '23514';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_validate_event_market
  before insert or update on public.event_markets
  for each row execute function private.fn_validate_event_market();

-- ----------------------------------------------------------------------------
-- 3. PREDICTIONS & SELECTION VALIDATORS
-- ----------------------------------------------------------------------------

create table if not exists public.predictions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_market_id bigint not null references public.event_markets(id) on delete restrict,
  selection jsonb not null,
  settlement_status text not null default 'pending' check (settlement_status in ('pending', 'settled', 'void')),
  ruleset_id bigint references public.scoring_rulesets(id) on delete restrict,
  result_revision integer check (result_revision is null or result_revision > 0),
  tier_code text check (tier_code is null or tier_code in ('exact_score', 'exact_margin', 'close_margin', 'outcome', 'miss')),
  raw_points integer check (raw_points is null or raw_points >= 0),
  normalized_basis_points integer check (normalized_basis_points is null or (normalized_basis_points >= 0 and normalized_basis_points <= 10000)),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_predictions_user_market unique (user_id, event_market_id),
  constraint chk_prediction_selection_size check (octet_length(selection::text) <= 512),
  constraint chk_prediction_settlement_fields check (
    (settlement_status = 'pending' and ruleset_id is null and result_revision is null and tier_code is null and raw_points is null and normalized_basis_points is null and settled_at is null)
    or
    (settlement_status = 'settled' and ruleset_id is not null and result_revision is not null and tier_code is not null and raw_points is not null and normalized_basis_points is not null and settled_at is not null)
    or
    (settlement_status = 'void' and ruleset_id is not null and result_revision is not null and settled_at is not null and tier_code is null and raw_points is null and normalized_basis_points is null)
  )
);

create index if not exists idx_predictions_market_user on public.predictions (event_market_id, user_id);
create index if not exists idx_predictions_user_settled on public.predictions (user_id, settlement_status);

-- Pure shape validator for team_scoreline selection
create or replace function private.validate_scoreline_selection_shape(p_selection jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_keys text[];
  v_home text;
  v_away text;
  v_home_int int;
  v_away_int int;
begin
  if jsonb_typeof(p_selection) <> 'object' then
    return false;
  end if;

  select array_agg(k order by k) into v_keys from jsonb_object_keys(p_selection) k;
  -- Must have exactly 'away', 'home', 'kind', 'version'
  if v_keys <> array['away', 'home', 'kind', 'version'] then
    return false;
  end if;

  if (p_selection->>'kind') <> 'team_scoreline' then
    return false;
  end if;

  if (p_selection->>'version')::int <= 0 then
    return false;
  end if;

  v_home := p_selection->>'home';
  v_away := p_selection->>'away';

  if v_home is null or v_away is null or v_home !~ '^[0-9]+$' or v_away !~ '^[0-9]+$' then
    return false;
  end if;

  v_home_int := (v_home)::int;
  v_away_int := (v_away)::int;

  if v_home_int < 0 or v_home_int > 200 or v_away_int < 0 or v_away_int > 200 then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

-- Prediction trigger for lock & market validation
create or replace function private.fn_validate_prediction()
returns trigger
language plpgsql
as $$
declare
  v_market record;
  v_auth_role text;
begin
  -- Validate shape
  if not private.validate_scoreline_selection_shape(new.selection) then
    raise exception 'Invalid prediction selection JSON shape or score bounds' using errcode = '23514';
  end if;

  select * into v_market from public.event_markets where id = new.event_market_id;
  if not found then
    raise exception 'Event market % does not exist', new.event_market_id using errcode = '23503';
  end if;

  -- Ensure selection kind & version match market
  if (new.selection->>'kind') <> v_market.market_kind then
    raise exception 'Selection kind (%) does not match market kind (%)', new.selection->>'kind', v_market.market_kind
      using errcode = '23514';
  end if;

  if (new.selection->>'version')::int <> v_market.payload_schema_version then
    raise exception 'Selection schema version (%) does not match market version (%)', new.selection->>'version', v_market.payload_schema_version
      using errcode = '23514';
  end if;

  v_auth_role := current_setting('request.jwt.claim.role', true);

  -- For client/authenticated mutations (not system settlement)
  if tg_op = 'INSERT' then
    if v_auth_role = 'authenticated' then
      if v_market.status <> 'open' or now() >= v_market.locks_at then
        raise exception 'Market is not open for predictions (status: %, locks_at: %, now: %)', v_market.status, v_market.locks_at, now()
          using errcode = '23514';
      end if;
      -- Force default settlement fields
      new.settlement_status := 'pending';
      new.ruleset_id := null;
      new.result_revision := null;
      new.tier_code := null;
      new.raw_points := null;
      new.normalized_basis_points := null;
      new.settled_at := null;
    end if;
  elsif tg_op = 'UPDATE' then
    -- Immutability of identity
    if new.user_id <> old.user_id or new.event_market_id <> old.event_market_id then
      raise exception 'Cannot alter prediction user_id or event_market_id' using errcode = '23514';
    end if;

    if v_auth_role = 'authenticated' then
      -- If client is updating selection
      if new.selection is distinct from old.selection then
        if v_market.status <> 'open' or now() >= v_market.locks_at then
          raise exception 'Prediction market is locked. Modifications not permitted after %', v_market.locks_at
            using errcode = '23514';
        end if;
      end if;

      -- Block authenticated clients from tampering with settlement fields
      if (new.settlement_status is distinct from old.settlement_status or
          new.ruleset_id is distinct from old.ruleset_id or
          new.result_revision is distinct from old.result_revision or
          new.tier_code is distinct from old.tier_code or
          new.raw_points is distinct from old.raw_points or
          new.normalized_basis_points is distinct from old.normalized_basis_points or
          new.settled_at is distinct from old.settled_at) then
        raise exception 'Client cannot modify settlement columns' using errcode = '42501';
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger trg_validate_prediction
  before insert or update on public.predictions
  for each row execute function private.fn_validate_prediction();

-- ----------------------------------------------------------------------------
-- 4. MARKET RESULTS, AUDIT HISTORY & SETTLEMENT RUNS
-- ----------------------------------------------------------------------------

create table if not exists public.market_results (
  event_market_id bigint primary key references public.event_markets(id) on delete restrict,
  result jsonb not null,
  revision integer not null default 1 check (revision > 0),
  status text not null default 'provisional' check (status in ('provisional', 'final', 'void')),
  source_kind text not null check (source_kind in ('provider', 'manual')),
  source_ref text,
  source_priority integer not null default 100 check (source_priority >= 0),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_market_result_size check (octet_length(result::text) <= 512)
);

create table if not exists private.market_result_history (
  id bigint generated always as identity primary key,
  event_market_id bigint not null references public.event_markets(id) on delete restrict,
  revision integer not null check (revision > 0),
  result jsonb not null,
  status text not null check (status in ('provisional', 'final', 'void')),
  source_kind text not null check (source_kind in ('provider', 'manual')),
  source_ref text,
  source_priority integer not null check (source_priority >= 0),
  recorded_at timestamptz not null default now(),
  constraint uq_market_result_history unique (event_market_id, revision)
);

create index if not exists idx_market_result_hist_market on private.market_result_history (event_market_id, revision desc);

create table if not exists private.settlement_runs (
  id bigint generated always as identity primary key,
  event_market_id bigint not null references public.event_markets(id) on delete restrict,
  result_revision integer not null check (result_revision > 0),
  ruleset_id bigint not null references public.scoring_rulesets(id) on delete restrict,
  affected_rows integer not null default 0,
  duration_ms integer not null default 0,
  status text not null check (status in ('success', 'failed', 'no_op', 'voided')),
  error_message text,
  executed_at timestamptz not null default now()
);

create index if not exists idx_settlement_runs_market on private.settlement_runs (event_market_id, executed_at desc);

-- ----------------------------------------------------------------------------
-- 5. SCORING EVALUATORS & SETTLEMENT ENGINE
-- ----------------------------------------------------------------------------

-- Pure shape validator for team_scoreline results
create or replace function private.validate_scoreline_result_shape(p_result jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_keys text[];
  v_home text;
  v_away text;
  v_home_int int;
  v_away_int int;
begin
  if jsonb_typeof(p_result) <> 'object' then
    return false;
  end if;

  select array_agg(k order by k) into v_keys from jsonb_object_keys(p_result) k;
  if v_keys <> array['away', 'home', 'kind', 'version'] then
    return false;
  end if;

  if (p_result->>'kind') <> 'team_scoreline' then
    return false;
  end if;

  if (p_result->>'version')::int <= 0 then
    return false;
  end if;

  v_home := p_result->>'home';
  v_away := p_result->>'away';

  if v_home is null or v_away is null or v_home !~ '^[0-9]+$' or v_away !~ '^[0-9]+$' then
    return false;
  end if;

  v_home_int := (v_home)::int;
  v_away_int := (v_away)::int;

  if v_home_int < 0 or v_home_int > 200 or v_away_int < 0 or v_away_int > 200 then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

-- Football Scoreline v1 Evaluator
create or replace function private.evaluate_football_scoreline_v1(
  p_selection jsonb,
  p_result jsonb,
  p_config jsonb default '{}'::jsonb
)
returns text
language plpgsql
immutable
as $$
declare
  p_home int := (p_selection->>'home')::int;
  p_away int := (p_selection->>'away')::int;
  a_home int := (p_result->>'home')::int;
  a_away int := (p_result->>'away')::int;
  pred_margin int;
  act_margin int;
  pred_outcome int;
  act_outcome int;
begin
  -- Exact score check
  if p_home = a_home and p_away = a_away then
    return 'exact_score';
  end if;

  pred_margin := p_home - p_away;
  act_margin := a_home - a_away;

  pred_outcome := sign(pred_margin);
  act_outcome := sign(act_margin);

  -- Correct outcome
  if pred_outcome = act_outcome then
    -- Exact goal difference / margin
    if pred_margin = act_margin then
      return 'exact_margin';
    else
      return 'outcome';
    end if;
  end if;

  return 'miss';
end;
$$;

-- Rugby Union Scoreline v1 Evaluator
create or replace function private.evaluate_rugby_union_scoreline_v1(
  p_selection jsonb,
  p_result jsonb,
  p_config jsonb default '{}'::jsonb
)
returns text
language plpgsql
immutable
as $$
declare
  p_home int := (p_selection->>'home')::int;
  p_away int := (p_selection->>'away')::int;
  a_home int := (p_result->>'home')::int;
  a_away int := (p_result->>'away')::int;
  pred_margin int;
  act_margin int;
  pred_outcome int;
  act_outcome int;
  margin_error int;
begin
  -- Exact score check (6 pts)
  if p_home = a_home and p_away = a_away then
    return 'exact_score';
  end if;

  pred_margin := p_home - p_away;
  act_margin := a_home - a_away;

  pred_outcome := sign(pred_margin);
  act_outcome := sign(act_margin);

  -- Check outcome match
  if pred_outcome = act_outcome then
    -- Exact signed margin (4 pts)
    if pred_margin = act_margin then
      return 'exact_margin';
    end if;

    margin_error := abs(pred_margin - act_margin);
    -- Signed-margin error <= 5 (3 pts)
    if margin_error <= 5 then
      return 'close_margin';
    end if;

    -- Correct outcome only (2 pts)
    return 'outcome';
  end if;

  return 'miss';
end;
$$;

-- Evaluator Dispatcher
create or replace function private.evaluate_prediction(
  p_evaluator_key text,
  p_evaluator_config jsonb,
  p_selection jsonb,
  p_result jsonb
)
returns text
language plpgsql
immutable
as $$
begin
  case p_evaluator_key
    when 'football_scoreline_v1' then
      return private.evaluate_football_scoreline_v1(p_selection, p_result, p_evaluator_config);
    when 'rugby_union_scoreline_v1' then
      return private.evaluate_rugby_union_scoreline_v1(p_selection, p_result, p_evaluator_config);
    else
      raise exception 'Unknown evaluator key: %', p_evaluator_key using errcode = '22023';
  end case;
end;
$$;

-- Atomic Market Settlement & Result Ingestion Function
create or replace function private.settle_market_result(
  p_market_id bigint,
  p_result jsonb,
  p_status text, -- 'provisional', 'final', 'void'
  p_source_kind text, -- 'provider', 'manual'
  p_source_ref text default null,
  p_source_priority integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market record;
  v_ruleset record;
  v_curr_result record;
  v_next_revision int := 1;
  v_start_time timestamptz := clock_timestamp();
  v_affected_rows int := 0;
  v_duration_ms int := 0;
  v_event record;
begin
  -- 1. Acquire transaction-scoped row lock on event market
  select * into v_market
  from public.event_markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'Market % not found', p_market_id using errcode = '23503';
  end if;

  -- Verify event and ruleset
  select * into v_event from public.events where id = v_market.event_id;
  select * into v_ruleset from public.scoring_rulesets where id = v_market.ruleset_id;

  -- 2. Validate result shape (if not void)
  if p_status <> 'void' then
    if not private.validate_scoreline_result_shape(p_result) then
      raise exception 'Invalid scoreline result payload shape' using errcode = '23514';
    end if;

    if (p_result->>'kind') <> v_market.market_kind then
      raise exception 'Result kind (%) does not match market kind (%)', p_result->>'kind', v_market.market_kind
        using errcode = '23514';
    end if;
  end if;

  -- 3. Check existing current result & revision monotonicity / source precedence
  select * into v_curr_result
  from public.market_results
  where event_market_id = p_market_id
  for update;

  if found then
    -- Precedence check: manual outranks provider; higher source_priority outranks lower
    if v_curr_result.status = 'final' and p_status = 'provisional' then
      raise exception 'Cannot downgrade final result to provisional' using errcode = '23514';
    end if;

    if p_source_priority < v_curr_result.source_priority and p_source_kind <> 'manual' then
      raise exception 'Result source priority (%) is lower than current priority (%)', p_source_priority, v_curr_result.source_priority
        using errcode = '23514';
    end if;

    v_next_revision := v_curr_result.revision + 1;
  else
    v_next_revision := 1;
  end if;

  -- 4. Upsert current result snapshot
  insert into public.market_results (
    event_market_id,
    result,
    revision,
    status,
    source_kind,
    source_ref,
    source_priority,
    finalized_at,
    created_at,
    updated_at
  )
  values (
    p_market_id,
    coalesce(p_result, '{"kind": "team_scoreline", "version": 1, "home": 0, "away": 0}'::jsonb),
    v_next_revision,
    p_status,
    p_source_kind,
    p_source_ref,
    p_source_priority,
    case when p_status = 'final' then now() else null end,
    now(),
    now()
  )
  on conflict (event_market_id) do update set
    result = excluded.result,
    revision = excluded.revision,
    status = excluded.status,
    source_kind = excluded.source_kind,
    source_ref = excluded.source_ref,
    source_priority = excluded.source_priority,
    finalized_at = excluded.finalized_at,
    updated_at = excluded.updated_at;

  -- 5. Append to immutable history
  insert into private.market_result_history (
    event_market_id,
    revision,
    result,
    status,
    source_kind,
    source_ref,
    source_priority,
    recorded_at
  )
  values (
    p_market_id,
    v_next_revision,
    coalesce(p_result, '{"kind": "team_scoreline", "version": 1, "home": 0, "away": 0}'::jsonb),
    p_status,
    p_source_kind,
    p_source_ref,
    p_source_priority,
    now()
  );

  -- 6. Settlement Action
  if p_status = 'final' then
    -- Settle predictions atomically
    with evaluated as (
      select
        p.id as prediction_id,
        private.evaluate_prediction(v_ruleset.evaluator_key, v_ruleset.evaluator_config, p.selection, p_result) as tier_code
      from public.predictions p
      where p.event_market_id = p_market_id
    ),
    scored as (
      select
        e.prediction_id,
        e.tier_code,
        t.raw_points,
        round((t.raw_points::numeric * 10000.0) / v_ruleset.max_raw_points::numeric)::int as norm_pts
      from evaluated e
      join public.scoring_rule_tiers t
        on t.ruleset_id = v_market.ruleset_id
       and t.tier_code = e.tier_code
    )
    update public.predictions p
    set
      settlement_status = 'settled',
      ruleset_id = v_market.ruleset_id,
      result_revision = v_next_revision,
      tier_code = s.tier_code,
      raw_points = s.raw_points,
      normalized_basis_points = s.norm_pts,
      settled_at = now(),
      updated_at = now()
    from scored s
    where p.id = s.prediction_id;

    get diagnostics v_affected_rows = row_count;

    -- Update market status to settled
    update public.event_markets
    set status = 'settled', updated_at = now()
    where id = p_market_id;

  elsif p_status = 'void' then
    -- Void predictions
    update public.predictions
    set
      settlement_status = 'void',
      ruleset_id = v_market.ruleset_id,
      result_revision = v_next_revision,
      tier_code = null,
      raw_points = null,
      normalized_basis_points = null,
      settled_at = now(),
      updated_at = now()
    where event_market_id = p_market_id;

    get diagnostics v_affected_rows = row_count;

    -- Update market status to void
    update public.event_markets
    set status = 'void', updated_at = now()
    where id = p_market_id;
  end if;

  v_duration_ms := floor(extract(epoch from (clock_timestamp() - v_start_time)) * 1000)::int;

  -- 7. Record Settlement Run
  insert into private.settlement_runs (
    event_market_id,
    result_revision,
    ruleset_id,
    affected_rows,
    duration_ms,
    status,
    error_message,
    executed_at
  )
  values (
    p_market_id,
    v_next_revision,
    v_market.ruleset_id,
    v_affected_rows,
    v_duration_ms,
    case when p_status = 'final' then 'success' when p_status = 'void' then 'voided' else 'no_op' end,
    null,
    now()
  );

  return jsonb_build_object(
    'market_id', p_market_id,
    'revision', v_next_revision,
    'status', p_status,
    'affected_rows', v_affected_rows,
    'duration_ms', v_duration_ms
  );
end;
$$;
