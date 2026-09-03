/**
 * Refreshes the approved rugby pilot source and advances due completed-result
 * verification checkpoints at +1h, +6h, and +24h.
 *
 * Use --verify-only with --as-of in deterministic acceptance tests. A normal
 * operational run requires --canonical so source refresh and verification are
 * both explicit service-role actions.
 */
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { createServiceRoleClient } from '../lib/supabase/server';
import { SofaScoreProvider } from '../lib/sports/ingestion/adapters/sofascore';
import { orchestrateProviderSourceIngestion } from '../lib/sports/ingestion/source-orchestrate';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const PILOT_COMPETITIONS = {
	'currie-cup': { providerKey: '796', season: '97057' },
	urc: { providerKey: '419', season: '98406' },
} as const;

function argument(name: string): string | undefined {
	return process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function main(): Promise<void> {
	const competitionArgument = argument('competition');
	const competitions = competitionArgument
		? [competitionArgument]
		: Object.keys(PILOT_COMPETITIONS);
	const invalidCompetition = competitions.find((value) => !(value in PILOT_COMPETITIONS));
	if (invalidCompetition) throw new Error(`Use --competition=currie-cup or --competition=urc; received ${invalidCompetition}`);

	const verifyOnly = process.argv.includes('--verify-only');
	if (!verifyOnly && !process.argv.includes('--canonical')) {
		throw new Error('Result verification refresh requires --canonical, or use --verify-only for a database-only checkpoint run');
	}

	const asOfValue = argument('as-of');
	const asOf = asOfValue ? new Date(asOfValue) : new Date();
	if (Number.isNaN(asOf.getTime())) throw new Error(`Invalid --as-of timestamp: ${asOfValue}`);

	const supabase = createServiceRoleClient();
	const provider = new SofaScoreProvider();
	const refreshResults: Record<string, unknown>[] = [];

	if (!verifyOnly) {
		for (const competition of competitions) {
			const configured = PILOT_COMPETITIONS[competition as keyof typeof PILOT_COMPETITIONS];
			const refreshed = await orchestrateProviderSourceIngestion({
				adapter: provider,
				supabase,
				competitionExternalKey: configured.providerKey,
				editionExternalKey: `${configured.providerKey}-${configured.season}`,
				seasonKey: configured.season,
				operation: 'sync_live',
				observeOnly: false,
				correlationId: `phase4_result_verification_refresh_${Date.now()}`,
			});
			refreshResults.push({ competition, ...refreshed });
			if (refreshed.status === 'failed') throw new Error(`Source refresh failed for ${competition}`);
		}
	}

	const { data: verificationData, error: verificationError } = await supabase.rpc('verify_completed_result_batch', {
		p_provider_slug: provider.providerSlug,
		p_event_ids: null,
		p_as_of: asOf.toISOString(),
	});
	if (verificationError) throw verificationError;

	const verification = asRecord(verificationData);
	const failed = Number(verification.failed ?? 0);
	const status = failed > 0 ? 'partial_failure' : 'success';
	const { error: runError } = await supabase.from('ingestion_runs').insert({
		provider_slug: provider.providerSlug,
		sport_slug: provider.sportSlug,
		operation: 'result_verification',
		status,
		fetched_count: Number(verification.verified ?? 0) + failed + Number(verification.pending ?? 0),
		updated_count: Number(verification.verified ?? 0),
		failed_count: failed,
		summary: {
			verification,
			as_of: asOf.toISOString(),
			verify_only: verifyOnly,
			refresh_results: refreshResults,
		},
		correlation_id: `phase4_result_verification_${Date.now()}`,
		finished_at: new Date().toISOString(),
	});
	if (runError) throw runError;

	console.log(JSON.stringify({
		phase: 4,
		provider: provider.providerSlug,
		asOf: asOf.toISOString(),
		verifyOnly,
		refreshResults,
		verification,
	}, null, 2));
	if (failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : 'Rugby completed-result verification failed');
	process.exitCode = 1;
});
