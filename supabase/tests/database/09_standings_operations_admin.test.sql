-- Phase 7: canonical standings, safe exposure, and scheduler contracts.
select plan(17);

select has_table('public', 'edition_standing_sources', 'Standing source table exists');
select has_table('public', 'edition_standings', 'Canonical standing table exists');
select has_view('public', 'competition_standings', 'Canonical standings view exists');
select has_function('public', 'upsert_provider_standings', ARRAY['jsonb'], 'Standing upsert RPC exists');
select has_function('public', 'claim_provider_sync_targets', ARRAY['timestamp with time zone', 'text', 'integer'], 'Target claim RPC exists');
select has_function('public', 'finish_provider_sync_target', ARRAY['bigint', 'text', 'text', 'timestamp with time zone', 'text'], 'Target completion RPC exists');
select ok(exists (select 1 from pg_constraint where conname = 'provider_sync_targets_operation_check' and pg_get_constraintdef(oid) like '%standings%'), 'Sync target supports standings operations');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_edition_standings_order'), 'Standing ordering index exists');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_edition_standing_sources_edition_stage'), 'Standing source lookup index exists');
select is((select relrowsecurity::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'edition_standing_sources'), 1, 'Standing sources have RLS');
select is((select relrowsecurity::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'edition_standings'), 1, 'Canonical standings have RLS');
select throws_ok($$ set role anon; select * from public.edition_standing_sources; $$, '42501', null, 'Anonymous clients cannot read standing sources');
select throws_ok($$ set role authenticated; select public.upsert_provider_standings('{}'::jsonb); $$, '42501', null, 'Authenticated clients cannot write standings');
select throws_ok($$ set role authenticated; select public.claim_provider_sync_targets(now(), 'client', 1); $$, '42501', null, 'Authenticated clients cannot claim sync targets');
select ok(exists (select 1 from pg_trigger where tgname = 'trg_mark_standings_sync_due_on_completed'), 'Completed events trigger standings refresh');
select ok(exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'private' and c.relname = 'provider_diagnostics'), 'Private provider diagnostics view exists');

select lives_ok($phase$
  do $body$
  declare
    v_edition_id bigint;
    v_competition_id bigint;
    v_competitor_id bigint;
    v_result jsonb;
    v_position integer;
  begin
    select ce.id, ce.competition_id into v_edition_id, v_competition_id
    from public.competition_editions ce join public.competitions c on c.id = ce.competition_id
    where c.slug = 'six-nations' and ce.season_key = '2026';
    select competitor_id into v_competitor_id from public.edition_competitors where edition_id = v_edition_id order by competitor_id limit 1;
    update public.competition_provider_settings set enabled = true, observe_only = false, standings_priority = 1
      where competition_id = v_competition_id and provider_slug = 'api-sports';
    insert into public.competition_provider_settings (competition_id, provider_slug, enabled, observe_only, standings_priority)
      values (v_competition_id, 'sofascore', true, false, 2)
      on conflict (competition_id, provider_slug) do update set enabled = true, observe_only = false, standings_priority = 2;

    v_result := public.upsert_provider_standings(jsonb_build_object(
      'provider_slug', 'api-sports', 'edition_id', v_edition_id, 'stage_key', 'overall',
      'rows', jsonb_build_array(
        jsonb_build_object('provider_competitor_key', 'api-one', 'competitor_id', v_competitor_id, 'position', 1, 'played', 8, 'won', 7, 'drawn', 0, 'lost', 1, 'points_for', 240, 'points_against', 120, 'points_difference', 120, 'bonus_points', 3, 'table_points', 31),
        jsonb_build_object('provider_competitor_key', 'api-unmapped', 'position', 2, 'table_points', 20)
      )));
    if v_result->>'canonical_count' <> '1' or v_result->>'unmapped_count' <> '1' then raise exception 'standing mapping contract failed: %', v_result; end if;

    v_result := public.upsert_provider_standings(jsonb_build_object(
      'provider_slug', 'sofascore', 'edition_id', v_edition_id, 'stage_key', 'overall',
      'rows', jsonb_build_array(jsonb_build_object('provider_competitor_key', 'sofa-one', 'competitor_id', v_competitor_id, 'position', 1, 'played', 8, 'won', 7, 'drawn', 0, 'lost', 1, 'points_for', 240, 'points_against', 120, 'points_difference', 120, 'bonus_points', 3, 'table_points', 31))
    ));
    if (select quality_status from public.edition_standings where edition_id = v_edition_id and competitor_id = v_competitor_id) <> 'verified' then raise exception 'standing agreement was not verified'; end if;

    v_result := public.upsert_provider_standings(jsonb_build_object(
      'provider_slug', 'sofascore', 'edition_id', v_edition_id, 'stage_key', 'overall',
      'rows', jsonb_build_array(jsonb_build_object('provider_competitor_key', 'sofa-one', 'competitor_id', v_competitor_id, 'position', 2, 'played', 8, 'won', 6, 'drawn', 0, 'lost', 2, 'points_for', 200, 'points_against', 140, 'points_difference', 60, 'bonus_points', 1, 'table_points', 25))
    ));
    select position into v_position from public.edition_standings where edition_id = v_edition_id and competitor_id = v_competitor_id;
    if (select quality_status from public.edition_standings where edition_id = v_edition_id and competitor_id = v_competitor_id) <> 'conflicted' or v_position <> 1 then raise exception 'standing conflict did not preserve canonical values'; end if;

    delete from public.edition_standing_sources where edition_id = v_edition_id;
    delete from public.edition_standings where edition_id = v_edition_id;
    delete from public.competition_provider_settings where competition_id = v_competition_id and provider_slug = 'sofascore';
    update public.competition_provider_settings set enabled = true, observe_only = false, standings_priority = null
      where competition_id = v_competition_id and provider_slug = 'api-sports';
  end $body$;
$phase$, 'Standings map, verify agreement, preserve conflicts, and keep unmapped rows source-only');
select * from finish();
