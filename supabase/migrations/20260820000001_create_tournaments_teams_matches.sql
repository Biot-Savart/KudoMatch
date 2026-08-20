-- Create tournaments table
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text not null default 'football',
  season text,
  status text default 'upcoming', -- 'upcoming', 'active', 'finished'
  logo_url text,
  external_id integer unique, -- API-Football League ID (e.g. 39 for Premier League)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create teams table
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete set null,
  name text not null,
  short_name text, -- e.g. "MUN", "ARS"
  logo_url text,
  external_id integer unique, -- API-Football Team ID
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create matches table
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  matchday integer, -- e.g. 12
  round text, -- e.g. "Regular Season - 12"
  home_team_id uuid references public.teams(id) on delete cascade not null,
  away_team_id uuid references public.teams(id) on delete cascade not null,
  kickoff_time timestamp with time zone not null,
  home_score integer,
  away_score integer,
  status text default 'scheduled' not null, -- 'scheduled', 'live', 'finished', 'cancelled'
  external_id integer unique, -- API-Football Fixture ID
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;

-- Set up RLS Read policies
create policy "Tournaments are viewable by everyone." on public.tournaments
  for select using (true);

create policy "Teams are viewable by everyone." on public.teams
  for select using (true);

create policy "Matches are viewable by everyone." on public.matches
  for select using (true);

-- Set up RLS Write policies for service_role only (automatic behavior, since no other policies exist)
