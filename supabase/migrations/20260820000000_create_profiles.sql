-- Create a table for public profiles
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  full_name text,
  avatar_url text,
  total_points integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  constraint username_length check (char_length(username) >= 3)
);

-- Set up Row Level Security (RLS)
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

create policy "Users can update their own profile." on public.profiles
  for update using (auth.uid() = id);

-- This trigger automatically creates a profile entry when a new user signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  default_username text;
  username_exists boolean;
  suffix_counter integer := 1;
begin
  -- Generate a clean default username based on raw user metadata or email
  default_username := coalesce(
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  
  -- Replace spaces and make lowercase
  default_username := lower(regexp_replace(default_username, '[^a-zA-Z0-9]', '', 'g'));
  
  -- Fallback if username is too short
  if char_length(default_username) < 3 then
    default_username := 'user_' || substring(new.id::text from 1 for 6);
  end if;

  -- Ensure username uniqueness by appending a number if it already exists
  loop
    select exists(select 1 from public.profiles where username = default_username) into username_exists;
    if not username_exists then
      exit;
    else
      default_username := substring(default_username from 1 for 15) || suffix_counter::text;
      suffix_counter := suffix_counter + 1;
    end if;
  end loop;

  insert into public.profiles (id, username, full_name, avatar_url, total_points)
  values (
    new.id,
    default_username,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Kudo Predictor'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    0
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
