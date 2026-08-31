/**
 * Multi-Sport Live Score and Fixture Synchronization CLI
 * Phase 14: Provider Ingestion & Rugby Data
 */

import { SportProviderAdapter } from '../lib/sports/ingestion/adapter';
import { FootballDataAdapter } from '../lib/sports/ingestion/adapters/football-data';
import { MockSportProviderAdapter } from '../lib/sports/ingestion/adapters/mock';
import { RugbyApiSportsAdapter } from '../lib/sports/ingestion/adapters/rugby-api-sports';
import { TheSportsDbRugbyAdapter } from '../lib/sports/ingestion/adapters/thesportsdb-rugby';
import { IngestionRunSummary } from '../lib/sports/ingestion/dto';
import { orchestrateIngestion } from '../lib/sports/ingestion/orchestrate';
import { createServiceRoleClient } from '../lib/supabase/server';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

export interface FetchLiveScoresOptions {
	provider?: 'football-data' | 'api-sports' | 'thesportsdb' | 'mock-provider';
	sport?: 'football' | 'rugby-union';
	editionExternalKey?: string;
	competitionExternalKey?: string;
	seasonKey?: string;
	operation?: 'sync_fixtures' | 'sync_live' | 'full_reconcile';
	simulate?: boolean;
	dryRun?: boolean;
	recordedPayload?: unknown;
	allEditions?: boolean;
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
	const explicitProvider = options.provider;

	if (simulate && process.env.NODE_ENV === 'production') {
		throw new Error('Simulation mode is not permitted in production');
	}

	// 1. Validate and select the requested adapter
	let adapter: SportProviderAdapter;

	if (simulate || explicitProvider === 'mock-provider') {
		adapter = new MockSportProviderAdapter(sport);
	} else if (explicitProvider === 'football-data') {
		if (sport !== 'football') {
			throw new Error(
				`Provider 'football-data' is incompatible with sport '${sport}'`,
			);
		}
		adapter = new FootballDataAdapter({
			recordedMatches: options.recordedPayload,
		});
	} else if (explicitProvider === 'api-sports') {
		if (sport !== 'rugby-union') {
			throw new Error(
				`Provider 'api-sports' is configured for sport 'rugby-union', incompatible with '${sport}'`,
			);
		}
		adapter = new RugbyApiSportsAdapter({
			recordedGames: options.recordedPayload,
		});
	} else if (explicitProvider === 'thesportsdb') {
		if (sport !== 'rugby-union') {
			throw new Error(
				`Provider 'thesportsdb' is incompatible with sport '${sport}'`,
			);
		}
		adapter = new TheSportsDbRugbyAdapter();
	} else {
		// Default provider selection based on sport
		if (sport === 'rugby-union') {
			adapter = new RugbyApiSportsAdapter({
				recordedGames: options.recordedPayload,
			});
		} else {
			adapter = new FootballDataAdapter({
				recordedMatches: options.recordedPayload,
			});
		}
	}

	let editionExternalKey = options.editionExternalKey;
	let competitionExternalKey = options.competitionExternalKey;

	// 2. Resolve active edition dynamically from selected provider and sport
	if (
		!editionExternalKey &&
		!simulate &&
		adapter.providerSlug !== 'mock-provider'
	) {
		try {
			const { data: activeEditionRef } = await supabase
				.from('external_entity_refs')
				.select(
					'external_key, competition_editions!inner(status, season_key, competition_id, competitions!inner(sport_slug))',
				)
				.eq('provider_slug', adapter.providerSlug)
				.eq('entity_kind', 'edition')
				.eq('competition_editions.status', 'active')
				.eq('competition_editions.competitions.sport_slug', adapter.sportSlug)
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
			// Direct production access must be backed by a catalog reference. The
			// legacy fixture default remains only for local recorded/test runs.
			if (sport === 'rugby-union') {
				if (process.env.API_SPORTS_KEY && !options.recordedPayload) {
					throw new Error('No active API-Sports rugby edition is configured; refusing guessed Six Nations fallback');
				}
				editionExternalKey = '11-2026';
				competitionExternalKey = competitionExternalKey || '11';
			} else {
				editionExternalKey = '2021-2025';
				competitionExternalKey = competitionExternalKey || '2021';
			}
		}
	} else if (
		!editionExternalKey &&
		(simulate || adapter.providerSlug === 'mock-provider')
	) {
		editionExternalKey = 'mock-edition-2025';
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
	dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const simulate = args.includes('--simulate');
	const isRugby =
		args.includes('--rugby') || args.includes('--sport=rugby-union');
	const providerArg = args.find((arg) => arg.startsWith('--provider='))?.split('=')[1] as FetchLiveScoresOptions['provider'] | undefined;
	const operationArg = args.find((arg) => arg.startsWith('--operation='))?.split('=')[1] as FetchLiveScoresOptions['operation'] | undefined;
	const editionArg = args.find((arg) => arg.startsWith('--edition='))?.split('=')[1];
	const competitionArg = args.find((arg) => arg.startsWith('--competition='))?.split('=')[1];

	fetchLiveScores({
		sport: isRugby ? 'rugby-union' : 'football',
		provider: providerArg,
		editionExternalKey: editionArg,
		competitionExternalKey: competitionArg,
		dryRun,
		simulate,
		operation: operationArg,
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
