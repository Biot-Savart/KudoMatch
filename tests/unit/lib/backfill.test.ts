import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	advanceProviderSyncCheckpoint,
	initialProviderSyncCheckpoint,
} from '@/lib/sports/ingestion/backfill';
import { RugbyApiSportsAdapter } from '@/lib/sports/ingestion/adapters/rugby-api-sports';
import { runHistoricalBackfill } from '@/lib/sports/ingestion/backfill';

describe('historical provider backfill checkpoints', () => {
	it('starts at page one with no provider cursor', () => {
		expect(initialProviderSyncCheckpoint()).toEqual({
			cursor: {},
			page: 1,
			lastProviderEventKey: null,
		});
	});

	it('advances from provider-returned page metadata and retains the last event key', () => {
		const next = advanceProviderSyncCheckpoint(initialProviderSyncCheckpoint(), {
			items: [
				{ externalKey: 'event-1' } as never,
				{ externalKey: 'event-2' } as never,
			],
			page: 1,
			totalPages: 2,
			nextCursor: { provider_page: 2 },
			hasMore: true,
		});
		expect(next).toEqual({
			cursor: { provider_page: 2 },
			page: 2,
			lastProviderEventKey: 'event-2',
		});
	});

	it('clears the opaque cursor when the provider reports completion', () => {
		const next = advanceProviderSyncCheckpoint({
			cursor: { provider_page: 2 },
			page: 2,
			lastProviderEventKey: 'event-2',
		}, {
			items: [],
			page: 2,
			totalPages: 2,
			hasMore: false,
		});
		expect(next).toEqual({ cursor: {}, page: 2, lastProviderEventKey: 'event-2' });
	});
});

describe('API-Sports historical page contract', () => {
	it('preserves the existing normalized event shape while exposing provider page metadata', async () => {
		const adapter = new RugbyApiSportsAdapter({
			recordedGames: {
				pages: [
					{
						paging: { current: 1, total: 2 },
						response: [{
							id: 101,
							date: '2025-02-01T15:00:00Z',
							status: { short: 'FT' },
							teams: {
								home: { id: 16, name: 'England' },
								away: { id: 17, name: 'France' },
							},
							scores: { home: 27, away: 22 },
						}],
					},
					{ paging: { current: 2, total: 2 }, response: [] },
				],
			},
		});
		const page = await adapter.fetchEventsPage({ editionExternalKey: '11-2025', page: 1 });
		expect(page.page).toBe(1);
		expect(page.hasMore).toBe(true);
		expect(page.nextCursor).toEqual({ provider_page: 2 });
		expect(page.items[0]?.status).toBe('finished');
		expect(page.items[0]?.sourceMetadata?.rawPayload).toMatchObject({ id: 101 });
	});
});

function createBackfillSupabase() {
	const target: Record<string, unknown> = {
		id: 41,
		provider_slug: 'api-sports',
		edition_id: 7,
		operation: 'historical_backfill',
		enabled: true,
		cursor: {},
		page: 1,
		last_provider_event_key: null,
		last_processed_at: null,
		last_fetched_at: null,
		next_run_at: new Date().toISOString(),
		status: 'pending',
		error_summary: null,
	};
	let runId = 100;
	const builder = (table: string) => {
		let result: unknown = { data: null, error: null };
		const query: Record<string, (...args: unknown[]) => unknown> = {
			upsert: () => query,
			select: () => query,
			single: () => {
				result = table === 'provider_sync_targets'
					? { data: target, error: null }
					: { data: { id: runId++ }, error: null };
				return Promise.resolve(result);
			},
			insert: () => query,
			update: (payload: unknown) => {
				if (table === 'provider_sync_targets') Object.assign(target, payload);
				return query;
			},
			eq: () => query,
			in: () => query,
		};
		Object.defineProperty(query, 'then', {
			value: (resolve: (value: unknown) => unknown) => resolve(result),
		});
		return query;
	};
	const rpc = vi.fn().mockImplementation((name: string, params: Record<string, unknown>) => {
		if (name === 'acquire_ingestion_lease') return Promise.resolve({ data: true, error: null });
		if (name === 'release_ingestion_lease') return Promise.resolve({ data: true, error: null });
		if (name === 'apply_provider_source_batch') {
			return Promise.resolve({ data: {
				success: true,
				observe_only: false,
				event_sources_upserted: 1,
				created_events: params.p_batch ? 1 : 0,
			}, error: null });
		}
		if (name === 'advance_provider_sync_target') {
			target.cursor = params.p_cursor;
			target.page = params.p_next_page;
			target.last_provider_event_key = params.p_last_provider_event_key;
			target.status = params.p_status;
			return Promise.resolve({ data: true, error: null });
		}
		return Promise.resolve({ data: {}, error: null });
	});
	return {
		from: vi.fn((table: string) => builder(table)),
		rpc,
		target,
	} as unknown as SupabaseClient;
}

function backfillAdapter() {
	return {
		providerSlug: 'api-sports',
		sportSlug: 'rugby-union',
		fetchCompetitions: async () => [{
			externalKey: '11', sportSlug: 'rugby-union', slug: 'six-nations',
			name: 'Six Nations', kind: 'cup' as const,
		}],
		fetchEditions: async () => [{
			externalKey: '11-2025', competitionExternalKey: '11', seasonKey: '2025',
			name: 'Six Nations 2025', status: 'completed' as const,
		}],
		fetchCompetitors: async () => [
			{ externalKey: '1', name: 'Home' },
			{ externalKey: '2', name: 'Away' },
		],
		fetchEvents: async () => [],
		fetchLiveUpdates: async () => [],
		fetchEventsPage: async (options: { page?: number }) => {
			const page = options.page ?? 1;
			const event = {
				externalKey: `event-${page}`,
				editionExternalKey: '11-2025',
				scheduledStartTime: `2025-02-0${page}T15:00:00Z`,
				status: 'finished' as const,
				participants: [
					{ competitorExternalKey: '1', role: 'home' as const, slotNumber: 1 },
					{ competitorExternalKey: '2', role: 'away' as const, slotNumber: 2 },
				],
			};
			return {
				items: [event], page, totalPages: 2,
				hasMore: page === 1,
				nextCursor: page === 1 ? { provider_page: 2 } : undefined,
			};
		},
	};
}

describe('bounded historical backfill execution', () => {
	it('leaves page one unchanged when failure occurs before checkpoint commit', async () => {
		const supabase = createBackfillSupabase();
		const result = await runHistoricalBackfill({
			supabase,
			adapter: backfillAdapter(),
			competitionExternalKey: '11', editionExternalKey: '11-2025', seasonKey: '2025', editionId: 7,
			failBeforeCheckpoint: true,
		});
		expect(result.status).toBe('failed');
		expect(result.checkpoint.page).toBe(1);
		expect((supabase as unknown as { target: Record<string, unknown> }).target.page).toBe(1);
	});

	it('resumes the next provider page and completes without deleting source progress', async () => {
		const supabase = createBackfillSupabase();
		const options = {
			supabase,
			adapter: backfillAdapter(),
			competitionExternalKey: '11', editionExternalKey: '11-2025', seasonKey: '2025', editionId: 7,
			maxPages: 1,
		};
		const first = await runHistoricalBackfill(options);
		const second = await runHistoricalBackfill(options);
		expect(first.targetStatus).toBe('pending');
		expect(first.checkpoint.page).toBe(2);
		expect(second.targetStatus).toBe('completed');
		expect(second.checkpoint.lastProviderEventKey).toBe('event-2');
	});

	it('restarts explicitly and reprocesses pages idempotently', async () => {
		const supabase = createBackfillSupabase();
		const result = await runHistoricalBackfill({
			supabase,
			adapter: backfillAdapter(),
			competitionExternalKey: '11', editionExternalKey: '11-2025', seasonKey: '2025', editionId: 7,
			maxPages: 2,
			restart: true,
		});
		expect(result.targetStatus).toBe('completed');
		expect(result.pagesFetched).toBe(2);
		expect(result.checkpoint.lastProviderEventKey).toBe('event-2');
	});
});
