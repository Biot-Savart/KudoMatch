-- Keep the generic application read surface aligned with reviewed fixture
-- authority. Provider settings remain the activation control; canonical rows
-- are retained when a provider is disabled, but disabled pilots are hidden.

create or replace function private.sync_competition_application_visibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.competitions c
  set is_active = exists (
    select 1
    from public.competition_provider_settings cps
    where cps.competition_id = c.id
      and cps.enabled = true
      and cps.observe_only = false
      and cps.fixture_authority = true
  )
  where c.id = new.competition_id
    and exists (
      select 1 from public.competition_provider_settings cps
      where cps.competition_id = c.id
    );
  return new;
end;
$$;

drop trigger if exists trg_sync_competition_application_visibility on public.competition_provider_settings;
create trigger trg_sync_competition_application_visibility
  after insert or update of enabled, observe_only, fixture_authority on public.competition_provider_settings
  for each row execute function private.sync_competition_application_visibility();

-- Apply the reviewed local activation state and make fresh resets deterministic.
update public.competitions c
set is_active = exists (
  select 1
  from public.competition_provider_settings cps
  where cps.competition_id = c.id
    and cps.enabled = true
    and cps.observe_only = false
    and cps.fixture_authority = true
)
where exists (
  select 1 from public.competition_provider_settings cps
  where cps.competition_id = c.id
);
