import { describe, expect, it, vi } from 'vitest';

const selection = vi.hoisted(() => ({
	select: vi.fn(),
	reportSuccess: vi.fn(),
}));

vi.mock('@/lib/sports/ingestion/provider-selection', () => ({
	ProviderSelectionService: class MockProviderSelectionService {
		select(...args: unknown[]) {
			return selection.select(...args);
		}
		reportSuccess(...args: unknown[]) {
			return selection.reportSuccess(...args);
		}
	},
}));

import { syncCompetitionStandings } from '@/lib/sports/ingestion/standings';

function builder(data: unknown, error: { message: string } | null = null) {
	const query: Record<string, unknown> = {};
	query.select = () => query;
	query.eq = () => query;
	query.in = () => query;
	query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve);
	return query;
}

function supabase(options: {
	settings?: unknown;
	settingsError?: { message: string } | null;
	mappings?: unknown;
	mappingsError?: { message: string } | null;
	rpcData?: unknown;
	rpcError?: { message: string } | null;
}) {
	return {
		from: vi.fn((table: string) => table === 'competition_provider_settings'
			? builder(options.settings ?? [{ provider_slug: 'espn' }], options.settingsError ?? null)
			: builder(options.mappings ?? [], options.mappingsError ?? null)),
		rpc: vi.fn().mockResolvedValue({ data: options.rpcData ?? {}, error: options.rpcError ?? null }),
	};
}

function resetSelection() {
	selection.select.mockReset();
	selection.reportSuccess.mockReset();
	selection.reportSuccess.mockResolvedValue(undefined);
}

describe('syncCompetitionStandings', () => {
	it('maps canonical and unmapped provider rows and records success', async () => {
		resetSelection();
		const fetchStandings = vi.fn().mockResolvedValue([
			{
				externalCompetitorKey: '101', stageKey: null, position: 1, played: 8, won: 7, drawn: 0, lost: 1,
				pointsFor: 240, pointsAgainst: 120, pointsDifference: 120, bonusPoints: 3, tablePoints: 31,
				rawPayload: { id: 101 },
			},
			{
				externalCompetitorKey: '102', stageKey: 'conference-a', position: undefined, played: null, won: undefined,
				drawn: null, lost: null, pointsFor: undefined, pointsAgainst: null, pointsDifference: null,
				bonusPoints: undefined, tablePoints: null, providerUpdatedAt: undefined, rawPayload: { id: 102 },
			},
		]);
		selection.select.mockResolvedValue({
			decision: { providerSlug: 'api-sports', adapter: { fetchStandings }, priority: 1 },
			skipped: [],
		});
		const db = supabase({
			mappings: [
				{ external_key: '101', competitor_id: 501, mapping_status: 'mapped' },
				{ external_key: '102', competitor_id: null, mapping_status: 'unmapped' },
			],
			rpcData: { mapped_count: 1, unmapped_count: 1, canonical_count: 1 },
		});

		const result = await syncCompetitionStandings({
			supabase: db as never,
			competitionId: 20,
			editionId: 10,
			editionExternalKey: '796-2026',
			competitionExternalKey: '796',
			providerSlug: 'api-sports',
			now: '2026-09-03T12:00:00Z',
		});

		expect(result).toEqual({ status: 'success', providerSlug: 'api-sports', rowsFetched: 2, rowsMapped: 1, rowsUnmapped: 1, canonicalRows: 1 });
		expect(selection.select).toHaveBeenCalledWith(expect.objectContaining({ excludedProviders: ['espn'] }));
		expect(db.rpc).toHaveBeenCalledWith('upsert_provider_standings', expect.objectContaining({
		p_payload: expect.objectContaining({ provider_slug: 'api-sports', edition_id: 10, stage_key: 'overall', rows: expect.any(Array) }),
	}));
		expect(selection.reportSuccess).toHaveBeenCalledWith('api-sports', 0, '2026-09-03T12:00:00Z');
	});

	it('selects the configured provider when no provider is pinned and uses fallback counts', async () => {
		resetSelection();
		const fetchStandings = vi.fn().mockResolvedValue([]);
		selection.select.mockResolvedValue({ decision: { providerSlug: 'espn', adapter: { fetchStandings }, priority: 2 }, skipped: [] });
		const db = supabase({ rpcData: {} });
		const result = await syncCompetitionStandings({ supabase: db as never, competitionId: 20, editionId: 10, editionExternalKey: 'e' });
		expect(result).toMatchObject({ status: 'success', providerSlug: 'espn', rowsFetched: 0, rowsMapped: 0, rowsUnmapped: 0, canonicalRows: 0 });
		expect(selection.select).toHaveBeenCalledWith(expect.not.objectContaining({ excludedProviders: expect.anything() }));
	});

	it('returns unavailable when no provider is selected or standings are unsupported', async () => {
		resetSelection();
		selection.select.mockResolvedValueOnce({ decision: null, skipped: [] });
		const db = supabase({});
		expect(await syncCompetitionStandings({ supabase: db as never, competitionId: 1, editionId: 2, editionExternalKey: 'e' }))
			.toEqual({ status: 'unavailable', rowsFetched: 0, rowsMapped: 0, rowsUnmapped: 0, canonicalRows: 0 });

		selection.select.mockResolvedValueOnce({ decision: { providerSlug: 'espn', adapter: {}, priority: 1 }, skipped: [] });
		expect(await syncCompetitionStandings({ supabase: db as never, competitionId: 1, editionId: 2, editionExternalKey: 'e' }))
			.toEqual({ status: 'unavailable', providerSlug: 'espn', rowsFetched: 0, rowsMapped: 0, rowsUnmapped: 0, canonicalRows: 0 });
	});

	it('converts settings, mapping, upsert, provider, and success errors into failed results', async () => {
		resetSelection();
		selection.select.mockResolvedValue({ decision: { providerSlug: 'api-sports', adapter: { fetchStandings: vi.fn() }, priority: 1 }, skipped: [] });
		const settingsError = supabase({ settingsError: { message: 'settings failed' } });
		expect((await syncCompetitionStandings({ supabase: settingsError as never, competitionId: 1, editionId: 2, editionExternalKey: 'e', providerSlug: 'api-sports' })).error)
			.toBe('Failed to load standings provider settings: settings failed');

		const fetchStandings = vi.fn().mockResolvedValue([{ externalCompetitorKey: '1', rawPayload: {} }]);
		selection.select.mockResolvedValue({ decision: { providerSlug: 'api-sports', adapter: { fetchStandings }, priority: 1 }, skipped: [] });
		const mappingError = supabase({ mappingsError: { message: 'mapping failed' } });
		expect((await syncCompetitionStandings({ supabase: mappingError as never, competitionId: 1, editionId: 2, editionExternalKey: 'e' })).error)
			.toBe('Failed to load standings mappings: mapping failed');

		const rpcError = supabase({ rpcError: { message: 'upsert failed' } });
		expect((await syncCompetitionStandings({ supabase: rpcError as never, competitionId: 1, editionId: 2, editionExternalKey: 'e' })).error)
			.toBe('Failed to upsert standings: upsert failed');

		selection.select.mockRejectedValueOnce(new Error('selection failed'));
		expect((await syncCompetitionStandings({ supabase: supabase({}) as never, competitionId: 1, editionId: 2, editionExternalKey: 'e' })).error)
			.toBe('selection failed');

		selection.select.mockResolvedValueOnce({ decision: { providerSlug: 'api-sports', adapter: { fetchStandings: vi.fn().mockRejectedValue('provider failed') }, priority: 1 }, skipped: [] });
		expect((await syncCompetitionStandings({ supabase: supabase({}) as never, competitionId: 1, editionId: 2, editionExternalKey: 'e' })).error)
			.toBe('provider failed');
	});

	it('reports a success failure as a failed sync', async () => {
		resetSelection();
		selection.select.mockResolvedValue({ decision: { providerSlug: 'api-sports', adapter: { fetchStandings: vi.fn().mockResolvedValue([]) }, priority: 1 }, skipped: [] });
		selection.reportSuccess.mockRejectedValueOnce(new Error('runtime update failed'));
		const result = await syncCompetitionStandings({ supabase: supabase({}) as never, competitionId: 1, editionId: 2, editionExternalKey: 'e' });
		expect(result).toMatchObject({ status: 'failed', error: 'runtime update failed' });
	});
});
