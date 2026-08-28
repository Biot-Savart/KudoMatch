/**
 * Live provider import script for real Premier League fixtures.
 * Ingests Premier League competitions, teams, events, and markets via the unified ingestion orchestrator.
 */

import { fetchLiveScores } from './fetch-live-scores';

export async function importRealPremierLeague(
	options: { dryRun?: boolean; simulate?: boolean } = {},
) {
	console.log('⚽ Initiating Premier League Real Provider Ingestion...');
	return fetchLiveScores({
		sport: 'football',
		operation: 'sync_fixtures',
		dryRun: options.dryRun,
		simulate: options.simulate,
	});
}

if (require.main === module) {
	const dryRun = process.argv.includes('--dry-run');
	const simulate = process.argv.includes('--simulate');

	importRealPremierLeague({ dryRun, simulate })
		.then((res) => {
			console.log('Result:', JSON.stringify(res, null, 2));
			process.exit(res.success ? 0 : 1);
		})
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
