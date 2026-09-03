import { SupabaseClient } from '@supabase/supabase-js';
import { ingestWithProviderFallback } from './provider-fallback';
import { syncCompetitionStandings } from './standings';

export type SyncInvocationSource = 'cron' | 'cli' | 'test';
export type AdaptiveEventStatus = 'scheduled' | 'live' | 'completed' | 'postponed' | 'cancelled' | 'abandoned';
export type VerificationStage = 'initial' | 'after_1h' | 'after_6h' | 'after_24h';

export interface AdaptiveSyncInput {
	now: Date;
	kickoff: Date;
	status: AdaptiveEventStatus;
	completedAt?: Date;
	verificationStage?: VerificationStage;
}

export function computeAdaptiveNextSyncAt(input: AdaptiveSyncInput): Date {
	const { now, kickoff, status } = input;
	if (status === 'completed') {
		const completedAt = input.completedAt ?? now;
		const offsets: Record<VerificationStage, number> = {
			initial: 60 * 60 * 1000,
			after_1h: 6 * 60 * 60 * 1000,
			after_6h: 24 * 60 * 60 * 1000,
			after_24h: 24 * 60 * 60 * 1000,
		};
		return new Date(completedAt.getTime() + offsets[input.verificationStage ?? 'initial']);
	}
	if (status === 'live') return new Date(now.getTime() + 20 * 60 * 1000);
	const hoursToKickoff = (kickoff.getTime() - now.getTime()) / (60 * 60 * 1000);
	const intervalHours = hoursToKickoff > 168 ? 24 : hoursToKickoff >= 24 ? 6 : hoursToKickoff >= 0 ? 1 : 1;
	if (hoursToKickoff < 0 && hoursToKickoff >= -3) return new Date(now.getTime() + 20 * 60 * 1000);
	return new Date(now.getTime() + intervalHours * 60 * 60 * 1000);
}

export interface RugbySyncDispatcherOptions {
	supabase: SupabaseClient;
	now?: Date;
	maxTargets?: number;
	invocationSource: SyncInvocationSource;
	holderId?: string;
}

export interface RugbySyncDispatcherResult {
	status: 'success' | 'partial_failure';
	claimed: number;
	completed: number;
	failed: number;
	results: Array<Record<string, unknown>>;
}

function text(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value : undefined;
}

async function targetContext(supabase: SupabaseClient, target: Record<string, unknown>) {
	const { data, error } = await supabase
		.from('competition_editions')
		.select('id, competition_id, season_key, competitions!inner(id, slug)')
		.eq('id', target.edition_id)
		.single();
	if (error || !data) throw new Error(`Edition ${target.edition_id} is unavailable: ${error?.message ?? 'not found'}`);
	const competition = Array.isArray(data.competitions) ? data.competitions[0] : data.competitions;
	const { data: refs } = await supabase
		.from('provider_catalog_sources')
		.select('provider_slug, entity_kind, external_key')
		.eq('provider_slug', target.provider_slug)
		.eq('mapping_status', 'mapped')
		.or(`edition_id.eq.${target.edition_id},competition_id.eq.${data.competition_id}`);
	const editionRef = (refs ?? []).find((row) => row.entity_kind === 'edition');
	const competitionRef = (refs ?? []).find((row) => row.entity_kind === 'competition');
	return {
		editionId: Number(data.id),
		competitionId: Number(data.competition_id),
		seasonKey: String(data.season_key),
		competitionSlug: String(competition?.slug ?? ''),
		editionExternalKey: text(editionRef?.external_key),
		competitionExternalKey: text(competitionRef?.external_key),
	};
}

async function nextRunForTarget(
	supabase: SupabaseClient,
	editionId: number,
	operation: string,
	now: Date,
): Promise<Date> {
	if (operation === 'standings') return new Date(now.getTime() + 24 * 60 * 60 * 1000);
	const { data: events, error } = await supabase
		.from('events')
		.select('id, starts_at, status')
		.eq('edition_id', editionId)
		.order('starts_at', { ascending: true })
		.limit(1000);
	if (error || !events?.length) return new Date(now.getTime() + 24 * 60 * 60 * 1000);
	const eventIds = events.map((event) => event.id);
	const qualityResult = operation === 'current_results'
		? await supabase.from('event_data_quality').select('event_id, next_verification_at, result_verification_stage').in('event_id', eventIds)
		: { data: [], error: null };
	if (qualityResult.error) throw new Error(`Failed to load event verification schedule: ${qualityResult.error.message}`);
	const qualityByEvent = new Map((qualityResult.data ?? []).map((row) => [String(row.event_id), row]));
	const candidates = events.map((event) => {
		const kickoff = new Date(event.starts_at);
		const quality = qualityByEvent.get(String(event.id));
		if (operation === 'current_results' && quality?.next_verification_at) {
			const verification = new Date(quality.next_verification_at);
			if (verification > now) return verification;
		}
		return computeAdaptiveNextSyncAt({
			now,
			kickoff,
			status: event.status as AdaptiveEventStatus,
			completedAt: event.status === 'completed' ? kickoff : undefined,
			verificationStage: quality?.result_verification_stage === 'due_1h' ? 'after_1h' : quality?.result_verification_stage === 'due_6h' ? 'after_6h' : quality?.result_verification_stage === 'due_24h' ? 'after_24h' : 'initial',
		});
	});
	return candidates.filter((candidate) => candidate > now).sort((a, b) => a.getTime() - b.getTime())[0]
		?? new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

export async function runRugbySyncDispatcher(options: RugbySyncDispatcherOptions): Promise<RugbySyncDispatcherResult> {
	const now = options.now ?? new Date();
	const holderId = options.holderId ?? `dispatcher:${options.invocationSource}:${Date.now()}`;
	const { data: targets, error } = await options.supabase.rpc('claim_provider_sync_targets', {
		p_now: now.toISOString(), p_holder_id: holderId, p_limit: options.maxTargets ?? 10,
	});
	if (error) throw new Error(`Failed to claim rugby sync targets: ${error.message}`);
	const claimedTargets = (targets ?? []) as Array<Record<string, unknown>>;
	const results: Array<Record<string, unknown>> = [];
	let completed = 0;
	let failed = 0;
	for (const target of claimedTargets) {
		let targetStatus: 'completed' | 'failed' = 'completed';
		let nextRunAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
		let errorSummary: string | null = null;
		try {
			const context = await targetContext(options.supabase, target);
			if (!context.editionExternalKey || !context.competitionExternalKey) throw new Error('Provider edition and competition mappings are required');
			const operation = String(target.operation);
			if (operation === 'standings') {
				const standing = await syncCompetitionStandings({
					supabase: options.supabase, competitionId: context.competitionId, editionId: context.editionId,
					editionExternalKey: context.editionExternalKey, competitionExternalKey: context.competitionExternalKey,
					providerSlug: String(target.provider_slug), now: now.toISOString(),
				});
				results.push({ targetId: target.id, operation, ...standing });
				if (standing.status === 'failed') throw new Error(standing.error ?? 'standings sync failed');
			} else if (operation === 'current_fixtures' || operation === 'current_results') {
				const sync = await ingestWithProviderFallback({
					supabase: options.supabase,
					competitionId: context.competitionId,
					operation: operation === 'current_results' ? 'current_results' : 'current_fixtures',
					editionExternalKey: context.editionExternalKey,
					competitionExternalKey: context.competitionExternalKey,
					seasonKey: context.seasonKey,
					now: now.toISOString(),
					correlationId: `dispatcher:${holderId}:${target.id}`,
				});
				results.push({ targetId: target.id, operation, ...sync });
				if (sync.status === 'failed' || sync.status === 'unavailable') throw new Error(`provider sync ${sync.status}`);
			} else if (operation === 'contract_check') {
				results.push({ targetId: target.id, operation, status: 'deferred', reason: 'provider-specific contract checks are invoked by their existing server command' });
			}
			nextRunAt = await nextRunForTarget(options.supabase, Number(target.edition_id), String(target.operation), now);
			completed += 1;
		} catch (cause) {
			targetStatus = 'failed';
			failed += 1;
			errorSummary = cause instanceof Error ? cause.message : String(cause);
			nextRunAt = new Date(now.getTime() + 15 * 60 * 1000);
			results.push({ targetId: target.id, status: 'failed', error: errorSummary });
		}
		await options.supabase.rpc('finish_provider_sync_target', {
			p_target_id: target.id, p_holder_id: holderId, p_status: targetStatus,
			p_next_run_at: nextRunAt.toISOString(), p_error_summary: errorSummary,
		});
	}
	return { status: failed ? 'partial_failure' : 'success', claimed: claimedTargets.length, completed, failed, results };
}
