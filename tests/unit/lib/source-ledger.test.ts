import { describe, expect, it, vi } from 'vitest';
import { MockSportProviderAdapter } from '@/lib/sports/ingestion/adapters/mock';
import { orchestrateProviderSourceIngestion } from '@/lib/sports/ingestion/source-orchestrate';
import {
	buildProviderSourceLedgerBatch,
	findReconciliationCandidates,
	sanitizeProviderPayload,
} from '@/lib/sports/ingestion/source-ledger';

describe('provider source ledger foundation', () => {
	it('redacts credential keys and bearer-like values recursively', () => {
		expect(sanitizeProviderPayload({
			apiKey: 'secret',
			nested: { authorization: 'Bearer token' },
			message: 'ordinary evidence',
		})).toEqual({
			apiKey: '[REDACTED]',
			nested: { authorization: '[REDACTED]' },
			message: 'ordinary evidence',
		});
	});

	it('builds separate catalog and event source identities', async () => {
		const adapter = new MockSportProviderAdapter('rugby-union');
		const events = await adapter.fetchEvents({ editionExternalKey: 'mock-comp-1-2025' });
		const batch = buildProviderSourceLedgerBatch({
			adapter,
			competitionExternalKey: 'mock-comp-1',
			competitions: await adapter.fetchCompetitions(),
			editions: await adapter.fetchEditions('mock-comp-1'),
			competitors: await adapter.fetchCompetitors('mock-comp-1-2025'),
			events,
		});

		expect(batch.catalog_sources.map((source) => source.entity_kind)).toEqual([
			'competition', 'edition', 'competitor', 'competitor',
		]);
		expect(batch.event_sources[0]).toMatchObject({
			provider_event_key: 'mock-evt-1',
			provider_competition_key: 'mock-comp-1',
			provider_home_competitor_key: 'mock-team-1',
			provider_away_competitor_key: 'mock-team-2',
		});
		expect(batch.event_sources[0].raw_payload).toBeTruthy();
	});

	it('uses an inclusive deterministic ±12-hour reconciliation window', () => {
		const incoming = {
			editionId: 7,
			homeCompetitorId: 10,
			awayCompetitorId: 11,
			startsAt: '2026-09-03T12:00:00Z',
		};
		const candidates = [
			{ id: 1, ...incoming, startsAt: '2026-09-03T00:00:00Z' },
			{ id: 2, ...incoming, startsAt: '2026-09-03T00:00:01Z' },
			{ id: 3, ...incoming, startsAt: '2026-09-04T01:00:00Z' },
			{ id: 4, ...incoming, homeCompetitorId: 99 },
		];

		expect(findReconciliationCandidates(candidates, incoming).map((candidate) => candidate.id)).toEqual([1, 2]);
	});

	it('defaults to observe-only and preserves canonical availability on source RPC failure', async () => {
		const adapter = new MockSportProviderAdapter('rugby-union');
		const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'provider ledger unavailable' } }) } as any;
		const result = await orchestrateProviderSourceIngestion({
			adapter,
			supabase,
			editionExternalKey: 'mock-comp-1-2025',
			competitionExternalKey: 'mock-comp-1',
		});

		expect(supabase.rpc).toHaveBeenCalledWith('apply_provider_source_batch', expect.objectContaining({ p_batch: expect.objectContaining({ observe_only: true }) }));
		expect(result.status).toBe('failed');
		expect(result.summary.errors[0]?.code).toBe('SOURCE_BATCH_FAILURE');
	});

	it('does not call the database in dry-run mode', async () => {
		const adapter = new MockSportProviderAdapter('rugby-union');
		const supabase = { rpc: vi.fn() } as any;
		const result = await orchestrateProviderSourceIngestion({
			adapter,
			supabase,
			editionExternalKey: 'mock-comp-1-2025',
			competitionExternalKey: 'mock-comp-1',
			dryRun: true,
		});

		expect(result.status).toBe('success');
		expect(supabase.rpc).not.toHaveBeenCalled();
	});

	it('isolates a failing event while retaining healthy siblings', async () => {
		const adapter = new MockSportProviderAdapter('rugby-union');
		const events = await adapter.fetchEvents({ editionExternalKey: 'mock-comp-1-2025' });
		adapter.fetchEvents = vi.fn().mockResolvedValue([
			events[0],
			{ ...events[0], externalKey: 'bad-event' },
		]);
		const supabase = {
			rpc: vi.fn().mockImplementation((_name: string, params: any) => {
				const keys = params.p_batch.event_sources.map((source: any) => source.provider_event_key);
				if (keys.includes('bad-event')) return Promise.resolve({ data: null, error: { message: 'bad source row' } });
				return Promise.resolve({
					data: { success: true, observe_only: true, catalog_sources_upserted: 4, event_sources_upserted: 1 },
					error: null,
				});
			}),
		} as any;

		const result = await orchestrateProviderSourceIngestion({
			adapter,
			supabase,
			editionExternalKey: 'mock-comp-1-2025',
			competitionExternalKey: 'mock-comp-1',
		});

		expect(supabase.rpc.mock.calls.length).toBeGreaterThan(1);
		expect(result.status).toBe('partial_failure');
		expect(result.summary.failedCount).toBe(1);
		expect(result.summary.insertedCount).toBe(1);
	});
});
