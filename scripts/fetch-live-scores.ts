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

type SupabaseError = {
	code?: string;
	message?: string;
};

type LegacyMatch = {
	id: string;
	external_id: number | null;
	status: string | null;
	home_score: number | null;
	away_score: number | null;
};

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

function isMissingCanonicalEventsError(error: SupabaseError | null): boolean {
	if (!error) return false;

	return (
		error.code === 'PGRST205' ||
		error.code === '42P01' ||
		/relationship .*events|relation .*events.*does not exist|table .*events.*(?:not found|schema cache)/i.test(
			error.message || '',
		)
	);
}

async function hasCanonicalIngestionSchema(supabase: any): Promise<boolean> {
	const { error } = await supabase.from('events').select('id').limit(1);

	if (!error) return true;
	if (isMissingCanonicalEventsError(error)) return false;

	throw new Error(
		`Database preflight failed while checking the ingestion schema: ${error.message || 'Unknown error'}`,
	);
}

function legacyStatus(status: string): string {
	switch (status) {
		case 'completed':
			return 'finished';
		case 'postponed':
			return 'scheduled';
		default:
			return status;
	}
}

function resultScores(event: {
	result?: { resultPayload?: Record<string, unknown> };
}): { home: number | null; away: number | null } {
	const payload = event.result?.resultPayload;
	const home = payload?.homeScore ?? payload?.home;
	const away = payload?.awayScore ?? payload?.away;

	return {
		home: home === null || home === undefined ? null : Number(home),
		away: away === null || away === undefined ? null : Number(away),
	};
}

/**
 * Keeps the scheduled job usable while a project is still on the pre-Phase 11
 * schema. This is intentionally read-only with respect to schema detection and
 * only writes the legacy matches table after a successful provider fetch.
 */
async function syncLegacyFootballMatches(
	supabase: any,
	adapter: SportProviderAdapter,
	operation: FetchLiveScoresOptions['operation'],
): Promise<FetchLiveScoresResult> {
	const { data: matches, error: fetchError } = await supabase
		.from('matches')
		.select('id, external_id, status, home_score, away_score, kickoff_time')
		.or('status.eq.live,status.eq.scheduled')
		.lte('kickoff_time', new Date().toISOString());

	if (fetchError) {
		return {
			success: false,
			status: 'failed',
			error: `Failed to read legacy matches: ${fetchError.message}`,
		};
	}

	const legacyMatches = (matches || []) as LegacyMatch[];
	if (legacyMatches.length === 0) {
		return { success: true, status: 'success', updated: 0 };
	}

	const editionExternalKey = '2021-2025';
	const events =
		operation === 'sync_live'
			? await adapter.fetchLiveUpdates({
					editionExternalKey,
					competitionExternalKey: '2021',
				})
			: await adapter.fetchEvents({
					editionExternalKey,
					competitionExternalKey: '2021',
				});
	const eventsByExternalId = new Map(
		events.map((event) => [event.externalKey, event]),
	);

	let updated = 0;
	for (const match of legacyMatches) {
		if (match.external_id === null || match.external_id === undefined) {
			continue;
		}

		const event = eventsByExternalId.get(String(match.external_id));
		if (!event) continue;

		const scores = resultScores(event);
		const status = legacyStatus(event.status);
		const hasScoreChange =
			scores.home !== null &&
			scores.away !== null &&
			(match.home_score !== scores.home || match.away_score !== scores.away);
		const hasStatusChange = match.status !== status;

		if (!hasScoreChange && !hasStatusChange) continue;

		const update: Record<string, unknown> = {
			status,
			updated_at: new Date().toISOString(),
		};
		if (scores.home !== null && scores.away !== null) {
			update.home_score = scores.home;
			update.away_score = scores.away;
		}

		const { error: updateError } = await supabase
			.from('matches')
			.update(update)
			.eq('id', match.id);

		if (updateError) {
			return {
				success: false,
				status: 'failed',
				error: `Failed to update legacy match ${match.id}: ${updateError.message}`,
			};
		}
		updated++;
	}

	return { success: true, status: 'success', updated };
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

	// The hosted project may still be on the legacy Phase 1-10 schema while
	// this branch uses the Phase 11 canonical ingestion model. Keep the job
	// operational during that rollout instead of failing on the first RPC call.
	if (!dryRun && sport === 'football' && !(await hasCanonicalIngestionSchema(supabase))) {
		try {
			return await syncLegacyFootballMatches(supabase, adapter, operation);
		} catch (error: any) {
			return {
				success: false,
				status: 'failed',
				error: error.message || String(error),
			};
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
