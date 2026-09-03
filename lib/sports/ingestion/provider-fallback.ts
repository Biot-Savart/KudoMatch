import { SupabaseClient } from '@supabase/supabase-js';
import { IngestionRunSummary } from './dto';
import { orchestrateProviderSourceIngestion } from './source-orchestrate';
import { ProviderOperation, ProviderSelectionService } from './provider-selection';

export interface ProviderFallbackOptions {
	supabase: SupabaseClient;
	service?: ProviderSelectionService;
	competitionId: number;
	operation: Extract<ProviderOperation, 'current_fixtures' | 'current_results'>;
	editionExternalKey: string;
	competitionExternalKey: string;
	seasonKey?: string;
	now?: string;
	dryRun?: boolean;
	correlationId?: string;
}

export interface ProviderFallbackAttempt {
	providerSlug: string;
	status: 'success' | 'partial_failure' | 'failed';
	selectedAt: string;
	latencyMs: number;
	reason?: string;
	summary?: IngestionRunSummary;
}

export interface ProviderFallbackResult {
	status: 'success' | 'partial_failure' | 'failed' | 'unavailable';
	providerSlug?: string;
	attempts: ProviderFallbackAttempt[];
	summary?: IngestionRunSummary;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Executes one provider at a time. A provider is considered usable only after
 * its source-ledger run produced data without a provider-level failure. Empty
 * responses are treated as retryable because they are not an authority signal.
 */
export async function ingestWithProviderFallback(options: ProviderFallbackOptions): Promise<ProviderFallbackResult> {
	const service = options.service ?? new ProviderSelectionService(options.supabase);
	const attempts: ProviderFallbackAttempt[] = [];
	const excludedProviders: string[] = [];

	while (true) {
		const selected = await service.select({
			competitionId: options.competitionId,
			operation: options.operation,
			now: options.now,
			excludedProviders,
		});
		if (!selected.decision) {
			return { status: attempts.length ? 'failed' : 'unavailable', attempts };
		}

		const decision = selected.decision;
		excludedProviders.push(decision.providerSlug);
		const started = Date.now();
		try {
			const run = await orchestrateProviderSourceIngestion({
				supabase: options.supabase,
				adapter: decision.adapter,
				editionExternalKey: options.editionExternalKey,
				competitionExternalKey: options.competitionExternalKey,
				seasonKey: options.seasonKey,
				operation: options.operation === 'current_results' ? 'full_reconcile' : 'sync_fixtures',
				observeOnly: options.dryRun ?? false,
				dryRun: options.dryRun,
				qualityAwareResults: true,
				correlationId: options.correlationId,
			});
			const latencyMs = Date.now() - started;
			if (run.status !== 'failed' && run.summary.fetchedCount > 0) {
				await service.reportSuccess(decision.providerSlug, latencyMs, options.now);
				attempts.push({ providerSlug: decision.providerSlug, status: run.status, selectedAt: options.now ?? new Date().toISOString(), latencyMs, summary: run.summary });
				return { status: run.status, providerSlug: decision.providerSlug, attempts, summary: run.summary };
			}
			const reason = run.summary.fetchedCount === 0 ? 'empty_provider_response' : 'source_ingestion_failed';
			await service.reportFailure(decision.providerSlug, new Error(reason), latencyMs, options.now);
			attempts.push({ providerSlug: decision.providerSlug, status: 'failed', selectedAt: options.now ?? new Date().toISOString(), latencyMs, reason, summary: run.summary });
		} catch (error) {
			const latencyMs = Date.now() - started;
			await service.reportFailure(decision.providerSlug, error, latencyMs, options.now);
			attempts.push({ providerSlug: decision.providerSlug, status: 'failed', selectedAt: options.now ?? new Date().toISOString(), latencyMs, reason: errorMessage(error) });
		}
	}
}
