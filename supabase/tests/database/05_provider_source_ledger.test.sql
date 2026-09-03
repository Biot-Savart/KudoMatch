-- Phase 3: source-ledger, mapping, and deterministic reconciliation contracts
begin;
select plan(25);

select has_table('public', 'competition_provider_settings', 'Provider settings table exists');
select has_table('public', 'provider_catalog_sources', 'Provider catalog source table exists');
select has_table('public', 'provider_event_sources', 'Provider event source table exists');
select has_table('public', 'event_data_quality', 'Event data quality table exists');
select has_table('public', 'provider_mapping_audit', 'Provider mapping audit table exists');
select has_column('public', 'ingestion_quarantine', 'raw_payload', 'Quarantine retains sanitized payloads');
select has_function('private', 'apply_provider_source_batch', ARRAY['jsonb'], 'Private source batch function exists');
select has_function('public', 'apply_provider_source_batch', ARRAY['jsonb'], 'Public source batch wrapper exists');
select has_function('public', 'manage_provider_catalog_mapping', ARRAY['bigint', 'text', 'bigint', 'text', 'text'], 'Mapping management wrapper exists');

select lives_ok($$
  select public.apply_provider_source_batch(jsonb_build_object(
    'provider_slug', 'api-sports',
    'sport_slug', 'rugby-union',
    'fetched_at', '2026-09-03T10:00:00Z',
    'observe_only', true,
    'catalog_sources', jsonb_build_array(
      jsonb_build_object('entity_kind', 'competition', 'external_key', '11', 'display_name', 'Six Nations', 'normalized_name', 'six nations', 'raw_payload', jsonb_build_object('id', 11)),
      jsonb_build_object('entity_kind', 'edition', 'external_key', '11-2026', 'display_name', 'Six Nations 2026', 'normalized_name', 'six nations 2026', 'raw_payload', jsonb_build_object('season', 2026)),
      jsonb_build_object('entity_kind', 'competitor', 'external_key', '16', 'display_name', 'France Rugby', 'normalized_name', 'france rugby', 'raw_payload', jsonb_build_object('team', 'France'))
    ),
    'event_sources', jsonb_build_array(
      jsonb_build_object('provider_event_key', 'phase3-observe-event', 'provider_competition_key', '11', 'provider_edition_key', '11-2026', 'provider_home_competitor_key', '16', 'provider_away_competitor_key', '17', 'normalized_kickoff_at', '2026-02-06T20:00:00Z', 'normalized_status', 'scheduled', 'raw_payload', jsonb_build_object('id', 'phase3-observe-event'))
    )
  ));
$$, 'Observe-only source batch is accepted');

select is((select count(*)::integer from public.provider_catalog_sources where provider_slug = 'api-sports'), 3, 'Catalog sources are retained');
select is((select count(*)::integer from public.provider_event_sources where provider_slug = 'api-sports' and provider_event_key = 'phase3-observe-event'), 1, 'Event source is retained');
select is((select mapping_status from public.provider_catalog_sources where provider_slug = 'api-sports' and entity_kind = 'competition' and external_key = '11'), 'needs_mapping', 'New catalog sources fail closed');
select is((select mapping_state from public.provider_event_sources where provider_slug = 'api-sports' and provider_event_key = 'phase3-observe-event'), 'unresolved', 'Observe-only events are not reconciled');

do $$
declare
  v_competition_id bigint;
  v_edition_id bigint;
  v_france_id bigint;
  v_ireland_id bigint;
  v_comp_source_id bigint;
  v_edition_source_id bigint;
  v_france_source_id bigint;
  v_ireland_source_id bigint;
begin
  select id into v_competition_id from public.competitions where slug = 'six-nations' and sport_slug = 'rugby-union';
  select id into v_edition_id from public.competition_editions where competition_id = v_competition_id and season_key = '2026';
  select id into v_france_id from public.competitors where name = 'France Rugby' and sport_slug = 'rugby-union';
  select id into v_ireland_id from public.competitors where name = 'Ireland Rugby' and sport_slug = 'rugby-union';

  insert into public.provider_catalog_sources (provider_slug, sport_slug, entity_kind, external_key, display_name, normalized_name)
  values ('api-sports', 'rugby-union', 'competition', 'phase3-comp', 'Six Nations', 'six nations') returning id into v_comp_source_id;
  insert into public.provider_catalog_sources (provider_slug, sport_slug, entity_kind, external_key, display_name, normalized_name)
  values ('api-sports', 'rugby-union', 'edition', 'phase3-edition', 'Six Nations 2026', 'six nations 2026') returning id into v_edition_source_id;
  insert into public.provider_catalog_sources (provider_slug, sport_slug, entity_kind, external_key, display_name, normalized_name)
  values ('api-sports', 'rugby-union', 'competitor', 'phase3-france', 'France Rugby', 'france rugby') returning id into v_france_source_id;
  insert into public.provider_catalog_sources (provider_slug, sport_slug, entity_kind, external_key, display_name, normalized_name)
  values ('api-sports', 'rugby-union', 'competitor', 'phase3-ireland', 'Ireland Rugby', 'ireland rugby') returning id into v_ireland_source_id;

  perform public.manage_provider_catalog_mapping(v_comp_source_id, 'map', v_competition_id, 'pgTAP', 'approved test mapping');
  perform public.manage_provider_catalog_mapping(v_edition_source_id, 'map', v_edition_id, 'pgTAP', 'approved test mapping');
  perform public.manage_provider_catalog_mapping(v_france_source_id, 'map', v_france_id, 'pgTAP', 'approved test mapping');
  perform public.manage_provider_catalog_mapping(v_ireland_source_id, 'map', v_ireland_id, 'pgTAP', 'approved test mapping');

  insert into public.competition_provider_settings (competition_id, provider_slug, enabled, observe_only, fixture_authority)
  values (v_competition_id, 'api-sports', true, false, false)
  on conflict (competition_id, provider_slug) do update set enabled = true, observe_only = false, fixture_authority = false;

  perform public.apply_provider_source_batch(jsonb_build_object(
    'provider_slug', 'api-sports', 'sport_slug', 'rugby-union', 'fetched_at', '2026-09-03T10:01:00Z', 'observe_only', false,
    'event_sources', jsonb_build_array(jsonb_build_object(
      'provider_event_key', 'phase3-reconcile-event', 'provider_competition_key', 'phase3-comp', 'provider_edition_key', 'phase3-edition',
      'provider_home_competitor_key', 'phase3-france', 'provider_away_competitor_key', 'phase3-ireland',
      'normalized_kickoff_at', '2026-02-07T08:00:00Z', 'normalized_status', 'scheduled', 'raw_payload', jsonb_build_object('id', 'phase3-reconcile-event')
    ))
  ));
end;
$$;

select is((select mapping_status from public.provider_catalog_sources where external_key = 'phase3-comp'), 'mapped', 'Reviewed mapping is stored');
select is((select count(*)::integer from public.provider_mapping_audit where external_key in ('phase3-comp', 'phase3-edition', 'phase3-france', 'phase3-ireland')), 4, 'Mapping changes are audited');
select is((select mapping_state from public.provider_event_sources where provider_event_key = 'phase3-reconcile-event'), 'mapped', 'A single inclusive-window candidate is linked');
select is((select event_id from public.provider_event_sources where provider_event_key = 'phase3-reconcile-event'), (select e.id from public.events e join public.competition_editions ce on ce.id = e.edition_id where ce.season_key = '2026' and e.round_label = 'Round 1'), 'Reconciliation links the canonical event');
select is((select count(*)::integer from public.external_entity_refs where provider_slug = 'api-sports' and entity_kind = 'event' and external_key = 'phase3-reconcile-event'), 1, 'Event external reference is idempotently created');
select is((select source_count from public.event_data_quality where event_id = (select event_id from public.provider_event_sources where provider_event_key = 'phase3-reconcile-event')), 1, 'Event provenance count is recorded');

select lives_ok($$ select public.apply_provider_source_batch(jsonb_build_object('provider_slug', 'api-sports', 'sport_slug', 'rugby-union', 'fetched_at', '2026-09-03T10:02:00Z', 'observe_only', false, 'event_sources', jsonb_build_array(jsonb_build_object('provider_event_key', 'phase3-reconcile-event', 'provider_edition_key', 'phase3-edition', 'provider_home_competitor_key', 'phase3-france', 'provider_away_competitor_key', 'phase3-ireland', 'normalized_kickoff_at', '2026-02-07T08:00:00Z', 'normalized_status', 'scheduled', 'raw_payload', jsonb_build_object('id', 'phase3-reconcile-event'))))) $$, 'Repeating the source event does not fail');
select is((select count(*)::integer from public.provider_event_sources where provider_slug = 'api-sports' and provider_event_key = 'phase3-reconcile-event'), 1, 'Repeating a source event creates no duplicate');
select is((select count(*)::integer from public.external_entity_refs where provider_slug = 'api-sports' and entity_kind = 'event' and external_key = 'phase3-reconcile-event'), 1, 'Repeating reconciliation creates no duplicate reference');

select throws_ok($$ insert into public.provider_event_sources (provider_slug, provider_event_key, normalized_kickoff_at, normalized_status, home_score, away_score) values ('api-sports', 'phase3-invalid-score', now(), 'finished', 10, null) $$, '23514', null, 'Half-populated scores are rejected');
select throws_ok($$ select public.manage_provider_catalog_mapping((select id from public.provider_catalog_sources where external_key = 'phase3-comp'), 'remap', (select id from public.competitions where slug = 'six-nations'), 'pgTAP', '') $$, null, null, 'Remap requires a reason');

select * from finish();
rollback;
