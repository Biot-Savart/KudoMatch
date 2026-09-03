import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RugbyApiSportsAdapter } from '@/lib/sports/ingestion/adapters/rugby-api-sports';

const mockedFallback = vi.hoisted(() => ({ ingestWithProviderFallback: vi.fn() }));
const mockedStandings = vi.hoisted(() => ({ syncCompetitionStandings: vi.fn() }));

vi.mock('@/lib/sports/ingestion/provider-fallback', () => mockedFallback);
vi.mock('@/lib/sports/ingestion/standings', () => mockedStandings);

import { computeAdaptiveNextSyncAt, runRugbySyncDispatcher } from '@/lib/sports/ingestion/dispatcher';

function queryResult(data: unknown, error: { message: string } | null = null) {
	const builder: Record<string, unknown> = {};
	builder.select = () => builder;
	builder.eq = () => builder;
	builder.or = () => builder;
	builder.order = () => builder;
	builder.limit = () => builder;
	builder.in = () => builder;
	builder.single = () => Promise.resolve({ data, error });
	builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve);
	return builder;
}

function dispatcherSupabase(overrides: Record<string, unknown> = {}) {
	const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
	const target = {
		id: 1,
		edition_id: 10,
		provider_slug: 'api-sports',
		operation: 'standings',
	};
	const supabase = {
		from: vi.fn((table: string) => {
			calls.push({ table, method: 'from', args: [] });
			if (table === 'competition_editions') {
				return queryResult(overrides.edition ?? {
					id: 10,
					competition_id: 20,
					season_key: '2026',
					competitions: { id: 20, slug: 'currie-cup' },
				});
			}
			if (table === 'provider_catalog_sources') {
				return queryResult(overrides.refs ?? [
					{ entity_kind: 'edition', external_key: '796-2026' },
					{ entity_kind: 'competition', external_key: '796' },
				]);
			}
			if (table === 'events') return queryResult(overrides.events ?? []);
			if (table === 'event_data_quality') return queryResult(overrides.quality ?? []);
			return queryResult([]);
		}),
		rpc: vi.fn((name: string) => {
			if (name === 'claim_provider_sync_targets') return Promise.resolve({ data: overrides.targets ?? [target], error: overrides.claimError ?? null });
			if (name === 'finish_provider_sync_target') return Promise.resolve({ data: null, error: null });
			return Promise.resolve({ data: null, error: null });
		}),
	};
	return { supabase, calls };
}

describe('Phase 7 standings and adaptive scheduling', () => {
	beforeEach(() => {
		mockedFallback.ingestWithProviderFallback.mockReset();
		mockedStandings.syncCompetitionStandings.mockReset();
	});

	it('normalizes recorded API-Sports standings rows', async () => {
		const adapter = new RugbyApiSportsAdapter({
			recordedStandings: {
				response: [{
					league: {
						name: 'Currie Cup',
						standings: [[{
							rank: 1,
							team: { id: 101, name: 'Kudo RFC' },
							points: 31,
							games: { played: 8, win: 7, draw: 0, lose: 1 },
							goals: { for: 240, against: 120, diff: 120 },
							bonus: 3,
						}], [
							{ rank: 2, team: { id: 102, name: 'Another RFC' }, points: 24, games: { played: 8 } },
						]],
					},
				}],
			},
		});
		const rows = await adapter.fetchStandings({ editionExternalKey: '796-2026', competitionExternalKey: '796' });
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({ externalCompetitorKey: '101', position: 1, tablePoints: 31, pointsDifference: 120, stageKey: 'Currie Cup' });
	});

	it('uses every adaptive kickoff boundary and completed verification cadence', () => {
		const now = new Date('2026-09-03T12:00:00Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: new Date('2026-09-15T12:01:00Z'), status: 'scheduled' }).toISOString()).toBe('2026-09-04T12:00:00.000Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: new Date('2026-09-10T12:00:00Z'), status: 'scheduled' }).toISOString()).toBe('2026-09-03T18:00:00.000Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: new Date('2026-09-03T15:00:00Z'), status: 'scheduled' }).toISOString()).toBe('2026-09-03T13:00:00.000Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: new Date('2026-09-03T11:00:00Z'), status: 'scheduled' }).toISOString()).toBe('2026-09-03T12:20:00.000Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: new Date('2026-09-03T10:00:00Z'), status: 'completed', completedAt: new Date('2026-09-03T10:00:00Z'), verificationStage: 'after_1h' }).toISOString()).toBe('2026-09-03T16:00:00.000Z');
	});

	it('handles live, postponed, cancelled, abandoned, and all completed verification stages', () => {
		const now = new Date('2026-09-03T12:00:00Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: now, status: 'live' }).toISOString()).toBe('2026-09-03T12:20:00.000Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: now, status: 'postponed' }).toISOString()).toBe('2026-09-03T13:00:00.000Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: now, status: 'cancelled' }).toISOString()).toBe('2026-09-03T13:00:00.000Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: now, status: 'abandoned' }).toISOString()).toBe('2026-09-03T13:00:00.000Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: now, status: 'completed', completedAt: now, verificationStage: 'initial' }).toISOString()).toBe('2026-09-03T13:00:00.000Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: now, status: 'completed', completedAt: now, verificationStage: 'after_6h' }).toISOString()).toBe('2026-09-04T12:00:00.000Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: now, status: 'completed', completedAt: now, verificationStage: 'after_24h' }).toISOString()).toBe('2026-09-04T12:00:00.000Z');
		expect(computeAdaptiveNextSyncAt({ now, kickoff: now, status: 'completed' }).toISOString()).toBe('2026-09-03T13:00:00.000Z');
	});

	it('returns an empty successful dispatch when no targets are due', async () => {
		const { supabase } = dispatcherSupabase({ targets: [] });
		const result = await runRugbySyncDispatcher({ supabase: supabase as never, invocationSource: 'test' });
		expect(result).toEqual({ status: 'success', claimed: 0, completed: 0, failed: 0, results: [] });
	});

	it('fails clearly when target claiming fails', async () => {
		const { supabase } = dispatcherSupabase({ claimError: { message: 'database unavailable' } });
		await expect(runRugbySyncDispatcher({ supabase: supabase as never, invocationSource: 'test', maxTargets: 1, holderId: 'holder' }))
			.rejects.toThrow('Failed to claim rugby sync targets: database unavailable');
	});

	it('dispatches standings, current fixtures, current results, contract checks, and unknown operations', async () => {
		mockedStandings.syncCompetitionStandings.mockResolvedValueOnce({ status: 'success', rowsFetched: 2 });
		mockedFallback.ingestWithProviderFallback.mockResolvedValue({ status: 'success', providerSlug: 'api-sports' });
		const targets = [
			{ id: 1, edition_id: 10, provider_slug: 'api-sports', operation: 'standings' },
			{ id: 2, edition_id: 10, provider_slug: 'api-sports', operation: 'current_fixtures' },
			{ id: 3, edition_id: 10, provider_slug: 'api-sports', operation: 'current_results' },
			{ id: 4, edition_id: 10, provider_slug: 'api-sports', operation: 'contract_check' },
			{ id: 5, edition_id: 10, provider_slug: 'api-sports', operation: 'future_operation' },
		];
		const { supabase } = dispatcherSupabase({ targets });
		const result = await runRugbySyncDispatcher({ supabase: supabase as never, invocationSource: 'test', now: new Date('2026-09-03T12:00:00Z'), holderId: 'holder' });
		expect(result.status).toBe('success');
		expect(result.claimed).toBe(5);
		expect(result.completed).toBe(5);
		expect(result.results).toHaveLength(4);
		expect(result.results[3]).toMatchObject({ operation: 'contract_check', status: 'deferred' });
	});

	it('isolates missing mappings, standings failures, and failed provider syncs', async () => {
		mockedStandings.syncCompetitionStandings.mockResolvedValueOnce({ status: 'failed', error: 'bad standings' });
		mockedFallback.ingestWithProviderFallback
			.mockResolvedValueOnce({ status: 'failed' })
			.mockResolvedValueOnce({ status: 'unavailable' });
		const targets = [
			{ id: 6, edition_id: 10, provider_slug: 'api-sports', operation: 'standings' },
			{ id: 7, edition_id: 10, provider_slug: 'api-sports', operation: 'current_fixtures' },
			{ id: 8, edition_id: 10, provider_slug: 'api-sports', operation: 'current_results' },
		];
		const { supabase } = dispatcherSupabase({ targets, refs: [] });
		const result = await runRugbySyncDispatcher({ supabase: supabase as never, invocationSource: 'cli', now: new Date('2026-09-03T12:00:00Z') });
		expect(result).toMatchObject({ status: 'partial_failure', claimed: 3, completed: 0, failed: 3 });
		expect(result.results.every((item) => item.status === 'failed')).toBe(true);
	});

	it('uses verification timestamps and event scheduling when calculating the next run', async () => {
		mockedFallback.ingestWithProviderFallback.mockResolvedValueOnce({ status: 'success' });
		const { supabase } = dispatcherSupabase({
			targets: [{ id: 9, edition_id: 10, provider_slug: 'api-sports', operation: 'current_results' }],
			events: [
				{ id: 100, starts_at: '2026-09-04T12:00:00Z', status: 'scheduled' },
				{ id: 101, starts_at: '2026-09-03T13:00:00Z', status: 'scheduled' },
			],
			quality: [{ event_id: 100, next_verification_at: '2026-09-03T13:30:00Z', result_verification_stage: 'due_1h' }],
		});
		const result = await runRugbySyncDispatcher({ supabase: supabase as never, invocationSource: 'test', now: new Date('2026-09-03T12:00:00Z') });
		expect(result.status).toBe('success');
	});

	it('records target failures when edition lookup or verification lookup fails', async () => {
		const editionFailure = dispatcherSupabase({
			targets: [{ id: 10, edition_id: 999, provider_slug: 'api-sports', operation: 'standings' }],
			edition: null,
		});
		const first = await runRugbySyncDispatcher({ supabase: editionFailure.supabase as never, invocationSource: 'test' });
		expect(first.failed).toBe(1);

		mockedFallback.ingestWithProviderFallback.mockResolvedValueOnce({ status: 'success' });
		const verificationFailure = dispatcherSupabase({
			targets: [{ id: 11, edition_id: 10, provider_slug: 'api-sports', operation: 'current_results' }],
			events: [{ id: 100, starts_at: '2026-09-04T12:00:00Z', status: 'scheduled' }],
			quality: { message: 'quality unavailable' },
		});
		const second = await runRugbySyncDispatcher({ supabase: verificationFailure.supabase as never, invocationSource: 'test' });
		expect(second.failed).toBe(1);
	});
});
