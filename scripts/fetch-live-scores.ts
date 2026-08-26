/**
 * Multi-Sport Live Score and Fixture Synchronization CLI
 * Phase 14: Provider Ingestion & Rugby Data
 */

import { SportProviderAdapter } from '../lib/sports/ingestion/adapter';
import { FootballDataAdapter } from '../lib/sports/ingestion/adapters/football-data';
import { MockSportProviderAdapter } from '../lib/sports/ingestion/adapters/mock';
import { RugbyApiSportsAdapter } from '../lib/sports/ingestion/adapters/rugby-api-sports';
import { IngestionRunSummary } from '../lib/sports/ingestion/dto';
import { orchestrateIngestion } from '../lib/sports/ingestion/orchestrate';
import { createServiceRoleClient } from '../lib/supabase/server';

export interface FetchLiveScoresOptions {
	provider?: 'football-data' | 'api-sports' | 'mock-provider';
	sport?: 'football' | 'rugby-union';
	editionExternalKey?: string;
	competitionExternalKey?: string;
	seasonKey?: string;
	operation?: 'sync_fixtures' | 'sync_live' | 'full_reconcile';
	simulate?: boolean;
	dryRun?: boolean;
	recordedPayload?: unknown;
}

export interface FetchLiveScoresResult {
	success: boolean;
	status?: 'success' | 'partial_failure' | 'failed' | 'already_running';
	updated?: number;
	summary?: IngestionRunSummary;
	error?: string;
}

export async function fetchLiveScores(
	options: FetchLiveScoresOptions = {},
	client?: any,
): Promise<FetchLiveScoresResult> {
	const supabase = client || createServiceRoleClient();
	const sport = options.sport || 'football';
	const operation = options.operation || 'sync_live';
	const simulate = options.simulate || false;
	const dryRun = options.dryRun || false;

	if (simulate && process.env.NODE_ENV === 'production') {
		throw new Error('Simulation mode is not permitted in production');
	}

	let adapter: SportProviderAdapter;
	let editionExternalKey = options.editionExternalKey;
	let competitionExternalKey = options.competitionExternalKey;

	// Resolve active edition dynamically if not explicitly specified
	if (!editionExternalKey && !simulate) {
		try {
			const providerSlug =
				sport === 'rugby-union' ? 'api-sports' : 'football-data';

			const { data: activeEditionRef } = await supabase
				.from('external_entity_refs')
				.select(
					'external_key, competition_editions!inner(status, season_key, competition_id, competitions!inner(sport_slug))',
				)
				.eq('provider_slug', providerSlug)
				.eq('entity_kind', 'edition')
				.eq('competition_editions.status', 'active')
				.eq('competition_editions.competitions.sport_slug', sport)
				.order('id', { ascending: false })
				.limit(1)
				.maybeSingle();

			if (activeEditionRef?.external_key) {
				editionExternalKey = activeEditionRef.external_key;
			}
		} catch {
			// Ignore query errors and fallback to active default
		}

		if (!editionExternalKey) {
			// Default to active seeded editions (Six Nations 2026, PL 2025/2026)
			if (sport === 'rugby-union') {
				editionExternalKey = '11-2026';
				competitionExternalKey = competitionExternalKey || '11';
			} else {
				editionExternalKey = '2021-2025';
				competitionExternalKey = competitionExternalKey || '2021';
			}
		}
	}

	if (simulate) {
		adapter = new MockSportProviderAdapter(sport);
		editionExternalKey = editionExternalKey || 'mock-edition-2025';
	} else if (sport === 'rugby-union') {
		adapter = new RugbyApiSportsAdapter({
			recordedGames: options.recordedPayload,
		});
		competitionExternalKey = competitionExternalKey || '11';
	} else {
		adapter = new FootballDataAdapter({
			recordedMatches: options.recordedPayload,
		});
		competitionExternalKey = competitionExternalKey || '2021';
	}

	const res = await orchestrateIngestion({
		adapter,
		supabase,
		editionExternalKey: editionExternalKey as string,
		competitionExternalKey,
		seasonKey: options.seasonKey,
		operation,
		dryRun,
	});

	const isSuccess =
		res.status === 'success' || res.status === 'already_running';
	const updated = res.summary.updatedCount + res.summary.insertedCount;

	return {
		success: isSuccess,
		status: res.status,
		updated,
		summary: res.summary,
		error:
			res.summary.errors.length > 0
				? res.summary.errors[0]?.message
				: undefined,
	};
}

if (require.main === module) {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const simulate = args.includes('--simulate');
	const isRugby =
		args.includes('--rugby') || args.includes('--sport=rugby-union');

	fetchLiveScores({
		sport: isRugby ? 'rugby-union' : 'football',
		dryRun,
		simulate,
	})
		.then((res) => {
			console.log('Result:', JSON.stringify(res, null, 2));
			process.exit(res.success ? 0 : 1);
		})
		.catch((err) => {
			console.error('Error:', err);
			process.exit(1);
		});
}
