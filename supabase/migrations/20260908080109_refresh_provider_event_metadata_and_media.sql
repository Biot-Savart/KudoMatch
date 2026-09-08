-- Keep canonical event metadata current when an already-linked provider source
-- receives a refreshed status, kickoff, round, or venue.
create or replace function private.refresh_canonical_event_from_provider_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_id is not null then
    update public.events
    set status = case
          when status = 'completed' and new.normalized_status in ('scheduled', 'live') then status
          when new.normalized_status = 'finished' then 'completed'
          else new.normalized_status
        end,
        starts_at = coalesce(new.normalized_kickoff_at, starts_at),
        round_label = coalesce(new.round_name, round_label),
        venue_name = coalesce(new.venue_name, venue_name),
        updated_at = clock_timestamp()
    where id = new.event_id;
  end if;
  return new;
end;
$$;

drop trigger if exists refresh_canonical_event_from_provider_source on public.provider_event_sources;
create trigger refresh_canonical_event_from_provider_source
  after insert or update of event_id, normalized_status, normalized_kickoff_at, round_name, venue_name
  on public.provider_event_sources
  for each row execute function private.refresh_canonical_event_from_provider_source();

-- Propagate provider image URLs to mapped canonical competitions and teams.
create or replace function private.refresh_canonical_catalog_media_from_provider_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.mapping_status = 'mapped' and nullif(trim(new.media_url), '') is not null then
    if new.entity_kind = 'competition' and new.competition_id is not null then
      update public.competitions
      set logo_url = new.media_url, updated_at = clock_timestamp()
      where id = new.competition_id and logo_url is distinct from new.media_url;
    elsif new.entity_kind = 'competitor' and new.competitor_id is not null then
      update public.competitors
      set media_url = new.media_url, updated_at = clock_timestamp()
      where id = new.competitor_id and media_url is distinct from new.media_url;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists refresh_canonical_catalog_media_from_provider_source on public.provider_catalog_sources;
create trigger refresh_canonical_catalog_media_from_provider_source
  after insert or update of mapping_status, media_url, competition_id, competitor_id
  on public.provider_catalog_sources
  for each row execute function private.refresh_canonical_catalog_media_from_provider_source();

-- Backfill media for any already-mapped source rows when this migration is
-- applied after the provider catalog has already been reviewed.
update public.competitions c
set logo_url = pcs.media_url, updated_at = clock_timestamp()
from public.provider_catalog_sources pcs
where pcs.provider_slug = 'sofascore'
  and pcs.entity_kind = 'competition'
  and pcs.mapping_status = 'mapped'
  and pcs.competition_id = c.id
  and nullif(trim(pcs.media_url), '') is not null
  and c.logo_url is distinct from pcs.media_url;

update public.competitors c
set media_url = pcs.media_url, updated_at = clock_timestamp()
from public.provider_catalog_sources pcs
where pcs.provider_slug = 'sofascore'
  and pcs.entity_kind = 'competitor'
  and pcs.mapping_status = 'mapped'
  and pcs.competitor_id = c.id
  and nullif(trim(pcs.media_url), '') is not null
  and c.media_url is distinct from pcs.media_url;
