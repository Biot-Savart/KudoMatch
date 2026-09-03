/**
 * Runs and records the Phase 4 SofaScore contract check.
 *
 * The check is intentionally bounded to one known Currie Cup competition and
 * one known completed event. It reaches the provider only through the
 * server-side SofaScore gateway adapter.
 */
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { createServiceRoleClient } from '../lib/supabase/server';
import { SofaScoreProvider } from '../lib/sports/ingestion/adapters/sofascore';
import { runProviderContractCheck } from '../lib/sports/ingestion/provider-contract-check';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const REQUIRE_GAP = process.argv.includes('--require-six-hour-gap');

async function main(): Promise<void> {
	const supabase = createServiceRoleClient();
	const provider = new SofaScoreProvider();
	const report = await runProviderContractCheck(provider, {
		competitionExternalKey: '796',
		editionExternalKey: '796-97057',
		expectedCompetitionSlug: 'currie-cup',
		expectedSeasonKey: '97057',
		probeEventExternalKey: '16393687',
		expectedProbeScore: { home: 24, away: 26 },
	});

	const { data: previousRuns, error: previousRunsError } = await supabase
		.from('ingestion_runs')
		.select('started_at')
		.eq('provider_slug', provider.providerSlug)
		.eq('operation', 'contract_check')
		.eq('status', 'success')
		.order('started_at', { ascending: false })
		.limit(1);
	if (previousRunsError) throw previousRunsError;

	const previousSuccessAt = previousRuns?.[0]?.started_at ? new Date(previousRuns[0].started_at) : null;
	const currentCheckedAt = new Date(report.checkedAt);
	const gapHours = previousSuccessAt
		? (currentCheckedAt.getTime() - previousSuccessAt.getTime()) / 3_600_000
		: null;
	const cadencePassed = !REQUIRE_GAP || (gapHours !== null && gapHours >= 6);
	const passed = report.passed && cadencePassed;

	const { error: insertError } = await supabase.from('ingestion_runs').insert({
		provider_slug: provider.providerSlug,
		sport_slug: provider.sportSlug,
		operation: 'contract_check',
		status: passed ? 'success' : 'failed',
		fetched_count: report.checks.length,
		failed_count: passed ? 0 : 1,
		duration_ms: report.durationMs,
		request_count: 4,
		schema_error_count: report.checks.some((check) => check.name === 'single-event route contract' && !check.passed) ? 1 : 0,
		summary: {
			contract_version: 1,
			checked_at: report.checkedAt,
			checks: report.checks,
			cadence: {
				require_six_hour_gap: REQUIRE_GAP,
				previous_success_at: previousSuccessAt?.toISOString() ?? null,
				gap_hours: gapHours,
				passed: cadencePassed,
			},
		},
		correlation_id: `phase4_contract_${Date.now()}`,
		error_message: passed ? null : report.checks.filter((check) => !check.passed).map((check) => check.name).join(', ') || 'six-hour cadence gate failed',
		started_at: report.checkedAt,
		finished_at: new Date().toISOString(),
	});
	if (insertError) throw insertError;

	console.log(JSON.stringify({
		phase: 4,
		provider: provider.providerSlug,
		competition: 'currie-cup',
		probeEvent: '16393687',
		passed,
		report,
		cadence: { previousSuccessAt: previousSuccessAt?.toISOString() ?? null, gapHours, passed: cadencePassed },
	}, null, 2));
	if (!passed) process.exitCode = 1;
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : 'Rugby provider contract check failed');
	process.exitCode = 1;
});
