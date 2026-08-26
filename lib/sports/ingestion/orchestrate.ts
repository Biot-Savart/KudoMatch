import { SupabaseClient } from '@supabase/supabase-js';
import { SportProviderAdapter } from './adapter';
import {
	CanonicalEventDTO,
	IngestionBatchPayload,
	IngestionRunSummary,
} from './dto';
import {
	ensureCanonicalCompetition,
	ensureCanonicalCompetitors,
	ensureCanonicalEdition,
	quarantineRecord,
	resolveSportRulesetId,
} from './resolve-canonical';
import { applyCanonicalIngestionBatch } from './upsert';
import { validateEventDTO } from './validate';

export interface IngestionExecutionOptions {
	adapter: SportProviderAdapter;
	supabase: SupabaseClient;
	editionExternalKey: string;
	competitionExternalKey?: string;
	seasonKey?: string;
	operation?: 'sync_fixtures' | 'sync_live' | 'full_reconcile';
	dryRun?: boolean;
	correlationId?: string;
	ttlSeconds?: number;
}

export async function orchestrateIngestion(
	options: IngestionExecutionOptions,
): Promise<{
	status: 'success' | 'partial_failure' | 'failed' | 'already_running';
	summary: IngestionRunSummary;
}> {
	const startTime = Date.now();
	const {
		adapter,
		supabase,
		editionExternalKey,
		competitionExternalKey,
		seasonKey,
		operation = 'sync_live',
		dryRun = false,
		correlationId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
		ttlSeconds = 300,
	} = options;

	const leaseKey = `${adapter.providerSlug}:${adapter.sportSlug}:${editionExternalKey}:${operation}`;
	const holderId = `runner_${process.pid || 1}_${correlationId}`;

	const summary: IngestionRunSummary = {
		providerSlug: adapter.providerSlug,
		sportSlug: adapter.sportSlug,
		editionKey: editionExternalKey,
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

	if (!dryRun) {
		// 1. Acquire distributed lease via DB function
		const { data: leaseAcquired, error: leaseErr } = await supabase.rpc(
			'acquire_ingestion_lease',
			{
				p_lease_key: leaseKey,
				p_holder_id: holderId,
				p_ttl_seconds: ttlSeconds,
			},
		);

		// Distinguish DB/RPC error from an active lease
		if (leaseErr) {
			throw new Error(
				`Database error acquiring ingestion lease: ${leaseErr.message}`,
			);
		}

		if (!leaseAcquired) {
			console.warn(`⚠️ Ingestion lease '${leaseKey}' is already active.`);
			summary.durationMs = Date.now() - startTime;
			return {
				status: 'already_running',
				summary,
			};
		}
	}

	let runId: number | null = null;

	if (!dryRun) {
		// Record run initiation in ingestion_runs
		const { data: runRecord } = await supabase
			.from('ingestion_runs')
			.insert({
				provider_slug: adapter.providerSlug,
				sport_slug: adapter.sportSlug,
				operation,
				status: 'running',
				correlation_id: correlationId,
				started_at: new Date().toISOString(),
			})
			.select('id')
			.maybeSingle();

		if (runRecord?.id) {
			runId = Number(runRecord.id);
		}
	}

	try {
		let canonicalCompetitionId = 1;
		let canonicalEditionId = 1;
		let rulesetId = 1;

		if (!dryRun) {
			// 2. Resolve or ensure catalog entities in correct dependency order
			canonicalCompetitionId = await ensureCanonicalCompetition(
				supabase,
				adapter,
				competitionExternalKey,
			);

			canonicalEditionId = await ensureCanonicalEdition(
				supabase,
				adapter,
				canonicalCompetitionId,
				editionExternalKey,
				competitionExternalKey,
				seasonKey,
			);

			await ensureCanonicalCompetitors(
				supabase,
				adapter,
				canonicalEditionId,
				editionExternalKey,
				competitionExternalKey,
			);

			rulesetId = await resolveSportRulesetId(supabase, adapter.sportSlug);
		}

		// 3. Fetch canonical events from provider adapter
		let events: CanonicalEventDTO[] = [];
		if (operation === 'sync_live') {
			events = await adapter.fetchLiveUpdates({
				editionExternalKey,
				competitionExternalKey,
			});
		} else {
			events = await adapter.fetchEvents({
				editionExternalKey,
				competitionExternalKey,
				seasonKey,
			});
		}

		summary.fetchedCount = events.length;

		// 4. Validate and construct atomic batch
		const validEvents: CanonicalEventDTO[] = [];

		for (const evt of events) {
			try {
				validateEventDTO(evt);
				validEvents.push(evt);
			} catch (err: any) {
				summary.quarantinedCount++;
				summary.errors.push({
					code: err.code || 'VALIDATION_ERROR',
					message: err.message,
					entityKey: evt.externalKey,
				});

				if (!dryRun) {
					await quarantineRecord(supabase, {
						providerSlug: adapter.providerSlug,
						entityKind: 'event',
						externalKey: evt.externalKey,
						reasonCode: err.code || 'VALIDATION_ERROR',
						errorSummary: err.message,
					});
				}
			}
		}

		// 5. Apply or dry-run batch mutations
		if (dryRun) {
			summary.insertedCount = validEvents.length;
		} else if (validEvents.length > 0) {
			const batchPayload: IngestionBatchPayload = {
				provider_slug: adapter.providerSlug,
				sport_slug: adapter.sportSlug,
				events: validEvents.map((evt) => ({
					external_key: evt.externalKey,
					edition_id: canonicalEditionId,
					round_label: evt.roundName,
					round_name: evt.roundName,
					starts_at: evt.scheduledStartTime,
					scheduled_start_time: evt.scheduledStartTime,
					status: evt.status,
					venue_name: evt.venue,
					venue: evt.venue,
					metadata: evt.metadata,
					participants: evt.participants.map((p) => ({
						competitor_external_key: p.competitorExternalKey,
						role: p.role,
						slot: p.slotNumber,
						slot_number: p.slotNumber,
					})),
					market: {
						ruleset_id: rulesetId,
						market_kind: 'team_scoreline',
						status: evt.market?.status || 'open',
						locks_at: evt.market?.lockAt || evt.scheduledStartTime,
						lock_at: evt.market?.lockAt || evt.scheduledStartTime,
					},
					result: evt.result
						? {
								status: evt.result.status,
								result_payload: evt.result.resultPayload,
								revision_number: evt.result.revisionNumber || 1,
								payload_schema_version: evt.result.payloadSchemaVersion || 1,
							}
						: undefined,
				})),
			};

			const batchResult = await applyCanonicalIngestionBatch(
				supabase,
				batchPayload,
			);

			if (!batchResult.success) {
				summary.failedCount += validEvents.length;
				summary.errors.push({
					code: 'BATCH_RPC_FAILURE',
					message: batchResult.error || 'Unknown batch error',
				});
			} else {
				summary.insertedCount += batchResult.insertedEvents;
				summary.updatedCount += batchResult.updatedEvents;
				summary.unchangedCount += batchResult.unchangedEvents;
				summary.settledCount += batchResult.settledResults;
			}
		}
	} catch (err: any) {
		summary.failedCount++;
		summary.errors.push({
			code: 'ORCHESTRATION_EXCEPTION',
			message: err.message || String(err),
		});
	} finally {
		summary.durationMs = Date.now() - startTime;

		if (!dryRun) {
			// Release lease
			await supabase.rpc('release_ingestion_lease', {
				p_lease_key: leaseKey,
				p_holder_id: holderId,
			});

			// Finalize run summary in database
			if (runId) {
				const finalStatus =
					summary.failedCount > 0 &&
					summary.insertedCount + summary.updatedCount > 0
						? 'partial_failure'
						: summary.failedCount > 0
							? 'failed'
							: 'success';

				await supabase
					.from('ingestion_runs')
					.update({
						status: finalStatus,
						fetched_count: summary.fetchedCount,
						inserted_count: summary.insertedCount,
						updated_count: summary.updatedCount,
						unchanged_count: summary.unchangedCount,
						quarantined_count: summary.quarantinedCount,
						failed_count: summary.failedCount,
						duration_ms: summary.durationMs,
						summary: summary as unknown as Record<string, unknown>,
						finished_at: new Date().toISOString(),
					})
					.eq('id', runId);
			}
		}
	}

	const finalStatus =
		summary.failedCount > 0 && summary.insertedCount + summary.updatedCount > 0
			? 'partial_failure'
			: summary.failedCount > 0
				? 'failed'
				: 'success';

	return {
		status: finalStatus,
		summary,
	};
}
