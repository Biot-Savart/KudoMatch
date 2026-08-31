-- TheSportsDB is an optional free-tier Rugby schedule/backfill provider.
-- It is never used as an implicit live-settlement fallback.
insert into public.data_providers (slug, name, server_config_id, is_active)
values ('thesportsdb', 'TheSportsDB Rugby backfill', 'thesportsdb_rugby', true)
on conflict (slug) do update
set name = excluded.name,
    server_config_id = excluded.server_config_id,
    is_active = excluded.is_active;

-- Ingestion resolves the active ruleset through the service-role client. The
-- original blanket grant predates the scoring_rulesets table, so grant the
-- required read privilege explicitly.
grant select on table public.scoring_rulesets to service_role;
