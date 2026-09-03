import { SupabaseClient } from '@supabase/supabase-js';
import { SportProviderAdapter } from './adapter';
import { CanonicalEventDTO, IngestionRunSummary } from './dto';
import { quarantineRecord } from './resolve-canonical';
import {
	applyProviderSourceBatch,
	buildProviderSourceLedgerBatch,
	ProviderSourceLedgerBatch,
	ProviderSourceBatchResult,
	providerSchemaValidators,
	sanitizeProviderPayload,
	withProviderSourceMetadata,
} from './source-ledger';

export interface ProviderSourceIngestionOptions {
	adapter: SportProviderAdapter;
	supabase: SupabaseClient;
	editionExternalKey: string;
	competitionExternalKey?: string;
	seasonKey?: string;
	operation?: 'sync_fixtures' | 'sync_live' | 'full_reconcile';
	observeOnly?: boolean;
	dryRun?: boolean;
	qualityAwareResults?: boolean;
	correlationId?: string;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function fetchEvents(options: ProviderSourceIngestionOptions): Promise<CanonicalEventDTO[]> {
	const { adapter, editionExternalKey, competitionExternalKey, seasonKey } = options;
	if (options.operation === 'sync_live') {
		return adapter.fetchLiveUpdates({ editionExternalKey, competitionExternalKey, seasonKey });
	}
	return adapter.fetchEvents({ editionExternalKey, competitionExternalKey, seasonKey });
}

async function applyWithIsolation(
	supabase: SupabaseClient,
	batch: ProviderSourceLedgerBatch,
): Promise<{ result: ProviderSourceBatchResult; failed: number }> {
	const result = await applyProviderSourceBatch(supabase, batch);
	if (result.success) return { result, failed: 0 };

	if (batch.event_sources.length <= 1) {
		return { result, failed: batch.event_sources.length || 1 };
	}

	const midpoint = Math.ceil(batch.event_sources.length / 2);
	const left = await applyWithIsolation(supabase, {
		...batch,
		event_sources: batch.event_sources.slice(0, midpoint),
	});
	const right = await applyWithIsolation(supabase, {
		...batch,
		event_sources: batch.event_sources.slice(midpoint),
	});
	return {
		result: {
			...left.result,
			success: left.result.success || right.result.success,
			 catalog_sources_upserted: left.result.catalog_sources_upserted + right.result.catalog_sources_upserted,
			event_sources_upserted: left.result.event_sources_upserted + right.result.event_sources_upserted,
			mapped_event_sources: left.result.mapped_event_sources + right.result.mapped_event_sources,
			ambiguous_event_sources: left.result.ambiguous_event_sources + right.result.ambiguous_event_sources,
			unresolved_event_sources: left.result.unresolved_event_sources + right.result.unresolved_event_sources,
			created_events: left.result.created_events + right.result.created_events,
			markets_upserted: left.result.markets_upserted + right.result.markets_upserted,
			results_applied: left.result.results_applied + right.result.results_applied,
			settled_results: left.result.settled_results + right.result.settled_results,
			skipped_results: left.result.skipped_results + right.result.skipped_results,
			error: [left.result.error, right.result.error].filter(Boolean).join('; ') || undefined,
		},
		failed: left.failed + right.failed,
	};
}


/**
 * Phase 3 ingestion path. It fetches and validates provider data first, then
 * writes only the source ledger unless an explicitly enabled mapping allows
 * reconciliation. observeOnly defaults to true while provider approval is pending.
 */
export async function orchestrateProviderSourceIngestion(
	options: ProviderSourceIngestionOptions,
): Promise<{ status: 'success' | 'partial_failure' | 'failed'; summary: IngestionRunSummary }> {
	const startedAt = Date.now();
	const correlationId = options.correlationId ?? `source_${Date.now()}`;
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
		requestCount: 0,
		schemaErrorCount: 0,
		rateLimitCount: 0,
		conflictCount: 0,
		errors: [],
	};

	try {
		const fetchedAt = new Date().toISOString();
		const [rawCompetitions, rawEditions, rawCompetitors, rawEvents] = await Promise.all([
			options.adapter.fetchCompetitions(),
			options.competitionExternalKey
				? options.adapter.fetchEditions(options.competitionExternalKey)
				: Promise.resolve([]),
			options.adapter.fetchCompetitors(options.editionExternalKey, options.competitionExternalKey),
			fetchEvents({ ...options, operation: options.operation ?? 'sync_fixtures' }),
		]);
		const competitions = rawCompetitions.map((item) => ({ ...item, sourceMetadata: withProviderSourceMetadata(item, options.adapter.providerSlug, fetchedAt) }));
		const editions = rawEditions.map((item) => ({ ...item, sourceMetadata: withProviderSourceMetadata(item, options.adapter.providerSlug, fetchedAt) }));
		const competitors = rawCompetitors.map((item) => ({ ...item, sourceMetadata: withProviderSourceMetadata(item, options.adapter.providerSlug, fetchedAt) }));
		const events = rawEvents.map((item) => ({ ...item, sourceMetadata: withProviderSourceMetadata(item, options.adapter.providerSlug, fetchedAt) }));
		summary.fetchedCount = events.length;

		const validCompetitions = [] as typeof competitions;
		const validEditions = [] as typeof editions;
		const validCompetitors = [] as typeof competitors;
		const validEvents: CanonicalEventDTO[] = [];
		const quarantineTasks: Promise<void>[] = [];
		const validate = <T>(kind: keyof typeof providerSchemaValidators, value: unknown, target: T[], key?: string) => {
			const parsed = providerSchemaValidators[kind].safeParse(value);
			if (parsed.success) {
				target.push(parsed.data as T);
				return;
			}
			summary.quarantinedCount += 1;
			const issue = parsed.error.issues[0]?.message ?? 'provider schema validation failed';
			summary.errors.push({ code: 'SCHEMA_VALIDATION_ERROR', message: issue, entityKey: key });
			if (!options.dryRun) {
				quarantineTasks.push(quarantineRecord(options.supabase, {
					providerSlug: options.adapter.providerSlug,
					entityKind: kind,
					externalKey: key,
					reasonCode: 'SCHEMA_VALIDATION_ERROR',
					errorSummary: issue,
					rawPayload: sanitizeProviderPayload(value),
				}));
			}
		};

		competitions.forEach((item) => validate('competition', item, validCompetitions, item?.externalKey));
		editions.forEach((item) => validate('edition', item, validEditions, item?.externalKey));
		competitors.forEach((item) => validate('competitor', item, validCompetitors, item?.externalKey));
		events.forEach((item) => validate('event', item, validEvents, item?.externalKey));
		await Promise.all(quarantineTasks);
		summary.schemaErrorCount = summary.quarantinedCount;

		const batch = buildProviderSourceLedgerBatch({
			adapter: options.adapter,
			competitionExternalKey: options.competitionExternalKey,
			competitions: validCompetitions,
			editions: validEditions,
			competitors: validCompetitors,
			events: validEvents,
			observeOnly: options.observeOnly ?? true,
			operation: options.operation,
			correlationId,
			qualityAwareResults: options.qualityAwareResults,
		});

		if (!options.dryRun) {
			const applied = await applyWithIsolation(options.supabase, batch);
			if (applied.result.success) {
				summary.insertedCount = applied.result.event_sources_upserted + applied.result.created_events;
					summary.updatedCount = applied.result.mapped_event_sources;
					summary.unchangedCount = applied.result.unresolved_event_sources;
					summary.settledCount = applied.result.settled_results;
					summary.failedCount += applied.failed;
				if (applied.failed > 0) {
					summary.errors.push({ code: 'SOURCE_BATCH_PARTIAL_FAILURE', message: applied.result.error ?? 'one or more source records failed' });
				}
			} else {
				summary.failedCount += applied.failed || validEvents.length || 1;
				summary.errors.push({ code: 'SOURCE_BATCH_FAILURE', message: applied.result.error ?? 'source batch failed' });
			}
		}
	} catch (error) {
		summary.failedCount += 1;
		summary.errors.push({ code: 'SOURCE_ORCHESTRATION_EXCEPTION', message: errorMessage(error) });
	}

	summary.durationMs = Date.now() - startedAt;
	const hasIssues = summary.failedCount > 0 || summary.quarantinedCount > 0;
	const hasSuccess = summary.insertedCount + summary.updatedCount > 0 || (!hasIssues && summary.fetchedCount === 0);
	return {
		status: hasIssues && hasSuccess ? 'partial_failure' : hasIssues ? 'failed' : 'success',
		summary,
	};
}
