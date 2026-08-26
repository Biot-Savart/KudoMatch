/**
 * Six Nations Seed and Ingestion Script
 * Ingests Six Nations competition, editions, national teams, events, markets, and results
 * using the RugbyApiSportsAdapter and canonical ingestion pipeline.
 */

import { RugbyApiSportsAdapter } from '../lib/sports/ingestion/adapters/rugby-api-sports';
import { orchestrateIngestion } from '../lib/sports/ingestion/orchestrate';
import { createServiceRoleClient } from '../lib/supabase/server';
import sampleFinished from '../tests/fixtures/providers/api-sports/rugby-union/finished-game.json';
import sampleScheduled from '../tests/fixtures/providers/api-sports/rugby-union/scheduled-game.json';

export interface SeedSixNationsOptions {
	dryRun?: boolean;
	useRecorded?: boolean;
}

export async function seedSixNations(options: SeedSixNationsOptions = {}) {
	console.log('🏉 Initiating Six Nations Data Ingestion...');

	const supabase = createServiceRoleClient();
	const useRecorded =
		options.useRecorded ||
		(!process.env.API_SPORTS_KEY && !process.env.RAPIDAPI_KEY);

	let recordedGames: any = undefined;
	if (useRecorded) {
		console.log('ℹ️ Using recorded API-Sports Six Nations fixtures.');
		recordedGames = {
			response: [
				...(sampleFinished.response || []),
				...(sampleScheduled.response || []),
			],
		};
	}

	const adapter = new RugbyApiSportsAdapter({
		recordedGames,
	});

	const result = await orchestrateIngestion({
		adapter,
		supabase,
		editionExternalKey: '11-2025',
		competitionExternalKey: '11',
		operation: 'sync_fixtures',
		dryRun: options.dryRun,
	});

	console.log('🏉 Six Nations Ingestion Complete:');
	console.log(`- Status: ${result.status}`);
	console.log(`- Fetched: ${result.summary.fetchedCount}`);
	console.log(`- Inserted: ${result.summary.insertedCount}`);
	console.log(`- Updated: ${result.summary.updatedCount}`);
	console.log(`- Unchanged: ${result.summary.unchangedCount}`);
	console.log(`- Quarantined: ${result.summary.quarantinedCount}`);
	console.log(`- Settled: ${result.summary.settledCount}`);
	console.log(`- Duration: ${result.summary.durationMs}ms`);

	return result;
}

if (require.main === module) {
	const dryRun = process.argv.includes('--dry-run');
	seedSixNations({ dryRun })
		.then((res) => {
			process.exit(res.status === 'failed' ? 1 : 0);
		})
		.catch((err) => {
			console.error('Fatal error during Six Nations seeding:', err);
			process.exit(1);
		});
}
