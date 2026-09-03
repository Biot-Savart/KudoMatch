import { SupabaseClient } from '@supabase/supabase-js';
import { ProviderEventPage, SportProviderAdapter } from './adapter';
import { CanonicalEventDTO, IngestionRunSummary } from './dto';
import { providerSchemaValidators } from './source-ledger';
import {
	buildProviderSourceLedgerBatch,
	applyProviderSourceBatch,
	ProviderCatalogEntityKind,
} from './source-ledger';
import { quarantineRecord } from './resolve-canonical';

export interface ProviderSyncCheckpoint {
	cursor: Record<string, unknown>;
	page: number;
	lastProviderEventKey: string | null;
}

export interface ProviderSyncTarget {
	id: number;
	providerSlug: string;
	editionId: number;
	operation: 'historical_backfill';
	enabled: boolean;
	checkpoint: ProviderSyncCheckpoint;
	lastProcessedAt: string | null;
	lastFetchedAt: string | null;
	nextRunAt: string;
	status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
	errorSummary: string | null;
}

export interface HistoricalBackfillOptions {
	supabase: SupabaseClient;
	adapter: SportProviderAdapter;
	competitionExternalKey: string;
	editionExternalKey: string;
	seasonKey: string;
	editionId: number;
	maxPages?: number;
	fromDate?: string;
	toDate?: string;
	resume?: boolean;
	restart?: boolean;
	dryRun?: boolean;
	mapCatalog?: boolean;
	correlationId?: string;
	/** Test hook: fail after source commit and before checkpoint advance. */
	failBeforeCheckpoint?: boolean;
}

export interface HistoricalBackfillResult {
	status: 'success' | 'partial_failure' | 'failed' | 'already_running';
	pagesFetched: number;
	eventsFetched: number;
	eventsApplied: number;
	quarantinedCount: number;
	checkpoint: ProviderSyncCheckpoint;
	targetStatus: ProviderSyncTarget['status'];
	error?: string;
	summary?: IngestionRunSummary;
}

const DEFAULT_MAX_PAGES = 1;
const PAGE_CURSOR_KEY = 'provider_page';

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function errorStatus(error: unknown): number | undefined {
	if (!error || typeof error !== 'object') return undefined;
	const status = (error as { status?: unknown }).status;
	return typeof status === 'number' ? status : undefined;
}

function isRateLimitError(error: unknown): boolean {
	return errorStatus(error) === 429 || /\b429\b|rate.?limit/i.test(errorMessage(error));
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function mapTarget(row: unknown): ProviderSyncTarget {
	const value = asRecord(row);
	const cursor = asRecord(value.cursor);
	return {
		id: Number(value.id),
		providerSlug: String(value.provider_slug),
		editionId: Number(value.edition_id),
		operation: 'historical_backfill',
		enabled: Boolean(value.enabled),
		checkpoint: {
			cursor,
			page: Math.max(1, Number(value.page ?? cursor[PAGE_CURSOR_KEY] ?? 1)),
			lastProviderEventKey: value.last_provider_event_key
				? String(value.last_provider_event_key)
				: null,
		},
		lastProcessedAt: value.last_processed_at ? String(value.last_processed_at) : null,
		lastFetchedAt: value.last_fetched_at ? String(value.last_fetched_at) : null,
		nextRunAt: String(value.next_run_at),
		status: String(value.status ?? 'pending') as ProviderSyncTarget['status'],
		errorSummary: value.error_summary ? String(value.error_summary) : null,
	};
}

export function initialProviderSyncCheckpoint(): ProviderSyncCheckpoint {
	return { cursor: {}, page: 1, lastProviderEventKey: null };
}

export function advanceProviderSyncCheckpoint(
	checkpoint: ProviderSyncCheckpoint,
	page: ProviderEventPage,
): ProviderSyncCheckpoint {
	const last = page.items.at(-1)?.externalKey ?? checkpoint.lastProviderEventKey;
	const nextCursor = page.hasMore
		? page.nextCursor ?? { [PAGE_CURSOR_KEY]: page.page + 1 }
		: {};
	const nextPage = page.hasMore
		? typeof nextCursor[PAGE_CURSOR_KEY] === 'number'
			? Math.max(1, nextCursor[PAGE_CURSOR_KEY] as number)
			: page.page + 1
		: page.page;
	return {
		cursor: nextCursor,
		page: nextPage,
		lastProviderEventKey: last,
	};
}

async function loadTarget(
	supabase: SupabaseClient,
	options: HistoricalBackfillOptions,
): Promise<ProviderSyncTarget> {
	const { data, error } = await supabase
		.from('provider_sync_targets')
		.upsert(
			{
				provider_slug: options.adapter.providerSlug,
				edition_id: options.editionId,
				operation: 'historical_backfill',
				enabled: true,
			},
			{ onConflict: 'provider_slug,edition_id,operation' },
		)
		.select('*')
		.single();
	if (error || !data) throw new Error(`Failed to load provider sync target: ${error?.message ?? 'missing row'}`);
	return mapTarget(data);
}

async function writeTargetStatus(
	supabase: SupabaseClient,
	target: ProviderSyncTarget,
	status: ProviderSyncTarget['status'],
	errorSummary: string | null,
): Promise<void> {
	const { error } = await supabase
		.from('provider_sync_targets')
		.update({ status, error_summary: errorSummary })
		.eq('id', target.id);
	if (error) throw new Error(`Failed to update provider sync target status: ${error.message}`);
}

async function advanceTarget(
	supabase: SupabaseClient,
	target: ProviderSyncTarget,
	checkpoint: ProviderSyncCheckpoint,
	status: ProviderSyncTarget['status'],
	lastProcessedAt: string | null,
	lastFetchedAt: string,
	errorSummary: string | null,
): Promise<void> {
	const { data, error } = await supabase.rpc('advance_provider_sync_target', {
		p_target_id: target.id,
		p_expected_page: target.checkpoint.page,
		p_next_page: checkpoint.page,
		p_cursor: checkpoint.cursor,
		p_last_provider_event_key: checkpoint.lastProviderEventKey,
		p_last_processed_at: lastProcessedAt,
		p_last_fetched_at: lastFetchedAt,
		p_next_run_at: new Date().toISOString(),
		p_status: status,
		p_error_summary: errorSummary,
	});
	if (error) throw new Error(`Failed to advance provider sync checkpoint: ${error.message}`);
	if (data !== true) throw new Error('Provider sync checkpoint changed while this worker was processing the page');
}

async function mapKnownCatalogSources(
	supabase: SupabaseClient,
	options: HistoricalBackfillOptions,
): Promise<void> {
	const { data: sources, error } = await supabase
		.from('provider_catalog_sources')
		.select('id, provider_slug, entity_kind, external_key, mapping_status')
		.eq('provider_slug', options.adapter.providerSlug)
		.in('entity_kind', ['competition', 'edition', 'competitor']);
	if (error) throw new Error(`Failed to inspect provider catalog mappings: ${error.message}`);

	for (const source of (sources ?? []) as Array<Record<string, unknown>>) {
		if (source.mapping_status === 'mapped' || source.mapping_status === 'ignored') continue;
		const kind = String(source.entity_kind) as ProviderCatalogEntityKind;
		const externalKey = String(source.external_key);
		let canonicalId: number | null = null;
		if (kind === 'edition' && externalKey === options.editionExternalKey) {
			canonicalId = options.editionId;
		} else {
			const { data: ref, error: refError } = await supabase
				.from('external_entity_refs')
				.select('competition_id, edition_id, competitor_id')
				.eq('provider_slug', options.adapter.providerSlug)
				.eq('entity_kind', kind)
				.eq('external_key', externalKey)
				.maybeSingle();
			if (refError) throw new Error(`Failed to inspect external mapping ${externalKey}: ${refError.message}`);
			const refRecord = asRecord(ref);
			const key = kind === 'competition' ? 'competition_id' : kind === 'edition' ? 'edition_id' : 'competitor_id';
			canonicalId = refRecord[key] ? Number(refRecord[key]) : null;
		}

		if (canonicalId === null && !options.mapCatalog) continue;
		const { error: mappingError } = await supabase.rpc('manage_provider_catalog_mapping', {
			p_source_id: Number(source.id),
			p_operation: canonicalId === null ? 'create-and-map' : 'map',
			p_canonical_id: canonicalId,
			p_actor_identity: 'phase5-historical-backfill',
			p_reason: canonicalId === null ? 'explicit --map-catalog backfill activation' : 'existing audited external mapping',
		});
		if (mappingError) throw new Error(`Failed to map provider catalog source ${externalKey}: ${mappingError.message}`);
	}
}

function inDateRange(event: CanonicalEventDTO, fromDate?: string, toDate?: string): boolean {
	const timestamp = Date.parse(event.scheduledStartTime);
	if (fromDate && timestamp < Date.parse(`${fromDate}T00:00:00Z`)) return false;
	if (toDate && timestamp > Date.parse(`${toDate}T23:59:59.999Z`)) return false;
	return true;
}

async function fetchPage(
	adapter: SportProviderAdapter,
	options: HistoricalBackfillOptions,
	page: number,
): Promise<ProviderEventPage> {
	const fetchOptions = {
		editionExternalKey: options.editionExternalKey,
		competitionExternalKey: options.competitionExternalKey,
		seasonKey: options.seasonKey,
		page,
	};
	if (adapter.fetchEventsPage) return adapter.fetchEventsPage(fetchOptions);
	if (page > 1) throw new Error(`Provider '${adapter.providerSlug}' does not expose resumable pagination`);
	const items = await adapter.fetchEvents(fetchOptions);
	return { items, page: 1, hasMore: false };
}

async function recordRun(
	supabase: SupabaseClient,
	options: HistoricalBackfillOptions,
	status: 'running' | 'success' | 'partial_failure' | 'failed',
	summary: IngestionRunSummary,
	runId?: number,
): Promise<number | undefined> {
	if (options.dryRun) return runId;
	if (runId) {
		await supabase.from('ingestion_runs').update({
			status,
			fetched_count: summary.fetchedCount,
			inserted_count: summary.insertedCount,
			updated_count: summary.updatedCount,
			unchanged_count: summary.unchangedCount,
			quarantined_count: summary.quarantinedCount,
			failed_count: summary.failedCount,
			duration_ms: summary.durationMs,
			summary,
			finished_at: new Date().toISOString(),
		}).eq('id', runId);
		return runId;
	}
	const { data, error } = await supabase.from('ingestion_runs').insert({
		provider_slug: options.adapter.providerSlug,
		sport_slug: options.adapter.sportSlug,
		edition_id: options.editionId,
		operation: 'historical_backfill',
		status: 'running',
		correlation_id: options.correlationId,
	}).select('id').single();
	if (error || !data) throw new Error(`Failed to create ingestion run: ${error?.message ?? 'missing id'}`);
	return Number((data as { id: number }).id);
}

export async function runHistoricalBackfill(
	options: HistoricalBackfillOptions,
): Promise<HistoricalBackfillResult> {
	const startedAt = Date.now();
	const checkpoint = initialProviderSyncCheckpoint();
	let target: ProviderSyncTarget = {
		id: 0,
		providerSlug: options.adapter.providerSlug,
		editionId: options.editionId,
		operation: 'historical_backfill',
		enabled: true,
		checkpoint,
		lastProcessedAt: null,
		lastFetchedAt: null,
		nextRunAt: new Date().toISOString(),
		status: 'pending',
		errorSummary: null,
	};
	let runId: number | undefined;
	const leaseKey = `historical-backfill:${options.adapter.providerSlug}:${options.editionId}`;
	const holderId = `phase5-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	let leaseAcquired = false;
	const releaseLease = async (): Promise<void> => {
		if (!leaseAcquired || options.dryRun) return;
		await options.supabase.rpc('release_ingestion_lease', {
			p_lease_key: leaseKey,
			p_holder_id: holderId,
		});
		leaseAcquired = false;
	};
	const summary: IngestionRunSummary = {
		providerSlug: options.adapter.providerSlug,
		sportSlug: options.adapter.sportSlug,
		editionKey: options.editionExternalKey,
		durationMs: 0,
		fetchedCount: 0,
		insertedCount: 0,
		updatedCount: 0,
		unchangedCount: 0,
		quarantinedCount: 0,
		failedCount: 0,
		settledCount: 0,
		retriesCount: 0,
		errors: [],
	};

	try {
		if (!options.dryRun) {
			target = await loadTarget(options.supabase, options);
			if (options.restart) {
				await options.supabase.from('provider_sync_targets').update({
					cursor: {}, page: 1, last_provider_event_key: null,
					last_processed_at: null, status: 'pending', error_summary: null,
				}).eq('id', target.id);
				target.checkpoint = initialProviderSyncCheckpoint();
				target.status = 'pending';
			}
			if (target.status === 'completed' && !options.restart) {
				return {
					status: 'success', pagesFetched: 0, eventsFetched: 0,
					eventsApplied: 0, quarantinedCount: 0, checkpoint: target.checkpoint,
					targetStatus: 'completed', summary,
				};
			}
			if (options.resume === false && target.checkpoint.lastProviderEventKey && !options.restart) {
				throw new Error('Provider sync target has progress; use --restart to replay from the beginning');
			}
			if (!target.enabled) throw new Error('Provider sync target is disabled');
			const lease = await options.supabase.rpc('acquire_ingestion_lease', {
				p_lease_key: leaseKey,
				p_holder_id: holderId,
				p_ttl_seconds: 600,
			});
			if (lease.error) throw new Error(`Failed to acquire historical backfill lease: ${lease.error.message}`);
			if (lease.data !== true) {
				return {
					status: 'already_running', pagesFetched: 0, eventsFetched: 0,
					eventsApplied: 0, quarantinedCount: 0, checkpoint: target.checkpoint,
					targetStatus: target.status, summary,
				};
			}
			leaseAcquired = true;
			await writeTargetStatus(options.supabase, target, 'running', null);
			target.status = 'running';
			runId = await recordRun(options.supabase, options, 'running', summary);
		}

		const competitions = await options.adapter.fetchCompetitions();
		const editions = await options.adapter.fetchEditions(options.competitionExternalKey);
		const edition = editions.find((item) => item.externalKey === options.editionExternalKey)
			?? editions.find((item) => item.seasonKey === options.seasonKey);
		if (!edition) throw new Error(`Provider did not return configured historical edition '${options.editionExternalKey}'`);
		const competitors = await options.adapter.fetchCompetitors(options.editionExternalKey, options.competitionExternalKey);
		const pageLimit = Math.max(1, options.maxPages ?? DEFAULT_MAX_PAGES);
		let current = target.checkpoint;
		let targetStatus: ProviderSyncTarget['status'] = 'running';
		let pagesFetched = 0;

		for (let index = 0; index < pageLimit; index++) {
			const page = await fetchPage(options.adapter, options, current.page);
			pagesFetched++;
			const fetchedAt = new Date().toISOString();
			if (page.validationErrors?.length) {
				for (const invalid of page.validationErrors) {
					summary.quarantinedCount++;
					summary.errors.push({
						code: 'SCHEMA_VALIDATION_ERROR',
						message: invalid.reason,
						entityKey: invalid.externalKey,
					});
					if (!options.dryRun) {
						await quarantineRecord(options.supabase, {
							providerSlug: options.adapter.providerSlug,
							entityKind: 'event',
							externalKey: invalid.externalKey,
							reasonCode: 'SCHEMA_VALIDATION_ERROR',
							errorSummary: invalid.reason,
							rawPayload: invalid.rawPayload,
						});
					}
				}
			}
			const events = page.items.filter((event) => inDateRange(event, options.fromDate, options.toDate));
			summary.fetchedCount += events.length;
			if (!options.dryRun) {
				const validEvents: CanonicalEventDTO[] = [];
				for (const event of events) {
					const parsed = providerSchemaValidators.event.safeParse(event);
					if (parsed.success) validEvents.push(parsed.data as CanonicalEventDTO);
					else {
						summary.quarantinedCount++;
						const issue = parsed.error.issues[0]?.message ?? 'provider event schema validation failed';
						summary.errors.push({ code: 'SCHEMA_VALIDATION_ERROR', message: issue, entityKey: event.externalKey });
						await quarantineRecord(options.supabase, {
							providerSlug: options.adapter.providerSlug,
							entityKind: 'event', externalKey: event.externalKey,
							reasonCode: 'SCHEMA_VALIDATION_ERROR', errorSummary: issue,
							rawPayload: event.sourceMetadata?.rawPayload,
						});
					}
				}
				const batch = buildProviderSourceLedgerBatch({
					adapter: options.adapter,
					competitionExternalKey: options.competitionExternalKey,
					competitions,
					editions: [edition],
					competitors,
					events: validEvents,
					observeOnly: false,
					operation: 'historical_backfill',
					correlationId: options.correlationId,
				});
				const applied = await applyProviderSourceBatch(options.supabase, batch);
				if (!applied.success) throw new Error(applied.error ?? 'historical source batch failed');
				// Catalog rows are created by the source batch. Mapping is an explicit
				// audited operation, so apply the same page again after known mappings
				// are available to reconcile its event sources.
				await mapKnownCatalogSources(options.supabase, options);
				const reconciled = await applyProviderSourceBatch(options.supabase, batch);
				if (!reconciled.success) throw new Error(reconciled.error ?? 'historical reconciliation batch failed');
				summary.insertedCount += applied.created_events + applied.event_sources_upserted + reconciled.created_events;
				summary.updatedCount += reconciled.mapped_event_sources;
				summary.unchangedCount += reconciled.unresolved_event_sources;
				summary.settledCount += reconciled.settled_results;
			}
			const next = advanceProviderSyncCheckpoint(current, page);
			if (options.failBeforeCheckpoint) throw new Error('test failure before checkpoint commit');
			if (!options.dryRun) {
				await advanceTarget(options.supabase, target, next, page.hasMore ? 'pending' : 'completed', page.items.at(-1) ? fetchedAt : target.lastProcessedAt, fetchedAt, null);
			}
			current = next;
			target.checkpoint = current;
			targetStatus = page.hasMore ? 'pending' : 'completed';
			if (!page.hasMore) {
				targetStatus = 'completed';
				break;
			}
		}

		const hasIssues = summary.failedCount > 0 || summary.quarantinedCount > 0;
		const finalStatus = hasIssues ? 'partial_failure' : 'success';
		summary.durationMs = Date.now() - startedAt;
		await recordRun(options.supabase, options, finalStatus, summary, runId);
		await releaseLease();
		return {
			status: finalStatus,
			pagesFetched,
			eventsFetched: summary.fetchedCount,
			eventsApplied: summary.insertedCount + summary.updatedCount,
			quarantinedCount: summary.quarantinedCount,
			checkpoint: target.checkpoint,
			targetStatus: options.dryRun ? (targetStatus === 'running' ? 'pending' : targetStatus) : targetStatus,
			summary,
		};
	} catch (error) {
		const message = errorMessage(error);
		summary.failedCount++;
		summary.errors.push({ code: isRateLimitError(error) ? 'RATE_LIMITED' : 'BACKFILL_FAILURE', message });
		summary.durationMs = Date.now() - startedAt;
		if (!options.dryRun && target.id) {
			const status = isRateLimitError(error) ? 'paused' : 'failed';
			await writeTargetStatus(options.supabase, target, status, message);
			await recordRun(options.supabase, options, status === 'paused' ? 'partial_failure' : 'failed', summary, runId);
		}
		await releaseLease();
		return {
			status: 'failed', pagesFetched: 0, eventsFetched: summary.fetchedCount,
			eventsApplied: summary.insertedCount + summary.updatedCount,
			quarantinedCount: summary.quarantinedCount, checkpoint: target.checkpoint,
			targetStatus: isRateLimitError(error) ? 'paused' : 'failed', error: message, summary,
		};
	}
}
