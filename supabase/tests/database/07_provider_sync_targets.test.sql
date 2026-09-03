-- Phase 5: provider sync target contracts and checkpoint safety.
select plan(12);

select has_table('public', 'provider_sync_targets', 'Provider sync target table exists');
select has_column('public', 'provider_sync_targets', 'cursor', 'Opaque cursor is persisted');
select has_column('public', 'provider_sync_targets', 'last_provider_event_key', 'Last provider event checkpoint exists');
select has_function(
  'public',
  'advance_provider_sync_target',
  ARRAY['bigint', 'integer', 'integer', 'jsonb', 'text', 'timestamp with time zone', 'timestamp with time zone', 'timestamp with time zone', 'text', 'text'],
  'Checkpoint advance RPC exists'
);
select has_function(
  'public',
  'apply_historical_provider_result_batch',
  ARRAY['text', 'text[]'],
  'Historical result application RPC exists'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'idx_provider_sync_targets_due'
  ),
  'Due-target partial index exists'
);
select ok(
  exists (
    select 1 from public.competition_provider_settings cps
    join public.competitions c on c.id = cps.competition_id
    where c.slug = 'six-nations'
      and cps.provider_slug = 'api-sports'
      and cps.enabled = true
      and cps.observe_only = false
      and cps.history_priority = 1
      and cps.result_priority = 100
      and cps.fixture_authority = true
  ),
  'API-Sports historical authority is explicitly configured'
);

select throws_ok(
  $$ set role anon; select * from public.provider_sync_targets; $$,
  '42501',
  null,
  'Anonymous clients cannot read sync targets'
);
select throws_ok(
  $$ set role authenticated; select public.advance_provider_sync_target(1, 1, 2, '{}'::jsonb, null, null, now(), now(), 'pending', null); $$,
  '42501',
  null,
  'Authenticated clients cannot advance sync targets'
);

select lives_ok($phase$
  do $body$
  declare
    v_target_id bigint;
    v_edition_id bigint;
  begin
    select ce.id into v_edition_id
    from public.competition_editions ce
    join public.competitions c on c.id = ce.competition_id
    where c.slug = 'six-nations' and ce.season_key = '2026';

    insert into public.provider_sync_targets (provider_slug, edition_id, operation)
    values ('api-sports', v_edition_id, 'historical_backfill')
    returning id into v_target_id;

    if not public.advance_provider_sync_target(
      v_target_id, 1, 2, '{"provider_page": 2}'::jsonb, 'event-1',
      now(), now(), now(), 'pending', null
    ) then
      raise exception 'first checkpoint advance was rejected';
    end if;

    if public.advance_provider_sync_target(
      v_target_id, 1, 3, '{"provider_page": 3}'::jsonb, 'event-2',
      now(), now(), now(), 'completed', null
    ) then
      raise exception 'stale checkpoint advance was accepted';
    end if;

    if not public.advance_provider_sync_target(
      v_target_id, 2, 2, '{}'::jsonb, 'event-1',
      now(), now(), now(), 'completed', null
    ) then
      raise exception 'owned checkpoint completion was rejected';
    end if;

    delete from public.provider_sync_targets where id = v_target_id;
  end $body$;
$phase$, 'Checkpoint updates are optimistic and stale workers cannot skip pages');

select lives_ok($phase$
  do $body$
  declare
    v_event_id bigint;
    v_competition_id bigint;
    v_starts_at timestamptz;
  begin
    select e.id, e.starts_at, c.id
      into v_event_id, v_starts_at, v_competition_id
    from public.events e
    join public.competition_editions ce on ce.id = e.edition_id
    join public.competitions c on c.id = ce.competition_id
    where c.slug = 'six-nations'
    limit 1;

    insert into public.provider_catalog_sources (
      provider_slug, sport_slug, entity_kind, external_key, competition_id,
      mapping_status, display_name, normalized_name
    ) values (
      'api-sports', 'rugby-union', 'competition', 'phase5-11', v_competition_id,
      'mapped', 'Six Nations', 'six nations'
    );

    insert into public.provider_event_sources (
      provider_slug, provider_event_key, event_id, provider_competition_key,
      normalized_kickoff_at, normalized_status, home_score, away_score
    ) values (
      'api-sports', 'phase5-current-provider-event', v_event_id, 'phase5-11',
      v_starts_at + interval '18 hours', 'finished', 99, 0
    );

    insert into public.event_data_quality (
      event_id, preferred_provider_slug, quality_status, source_count
    ) values (v_event_id, 'sofascore', 'single_source', 1)
    on conflict (event_id) do update set preferred_provider_slug = 'sofascore';

    perform public.apply_historical_provider_result_batch(
      'api-sports', array['phase5-current-provider-event']
    );

    if (select starts_at from public.events where id = v_event_id) <> v_starts_at then
      raise exception 'historical replay regressed the current-provider kickoff';
    end if;

    delete from public.provider_event_sources where provider_event_key = 'phase5-current-provider-event';
    delete from public.provider_catalog_sources where external_key = 'phase5-11';
  end $body$;
$phase$, 'Historical replay cannot regress a current-provider event');

select is(
  (select count(*)::integer from public.provider_sync_targets
   where provider_slug = 'api-sports' and operation = 'historical_backfill'),
  0,
  'Checkpoint contract test leaves no target rows'
);

select * from finish();
