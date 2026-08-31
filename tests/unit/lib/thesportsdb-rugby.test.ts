import { describe, expect, it, vi } from 'vitest';
import { TheSportsDbRugbyAdapter } from '@/lib/sports/ingestion/adapters/thesportsdb-rugby';

describe('TheSportsDbRugbyAdapter', () => {
	it('maps configured competitions and completed scores', async () => {
		const fetchSpy = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ events: [{
				idEvent: 'event-1',
				strSeason: '2025',
				strLeague: 'Rugby Championship',
				strHomeTeam: 'South Africa Rugby',
				strAwayTeam: 'Australia Rugby',
				idHomeTeam: 'home-1',
				idAwayTeam: 'away-1',
				intRound: '1',
				intHomeScore: '22',
				intAwayScore: '38',
				strTimestamp: '2025-08-16T15:10:00Z',
				strStatus: 'FT',
			}] }),
		});
		vi.stubGlobal('fetch', fetchSpy);

		const adapter = new TheSportsDbRugbyAdapter({
			leagues: { 'rugby-championship': '4986' },
			seasons: { '4986': '2025' },
		});
		const events = await adapter.fetchEvents({ editionExternalKey: '4986-2025' });

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			externalKey: 'event-1',
			status: 'finished',
			participants: [
				{ competitorExternalKey: 'home-1', role: 'home' },
				{ competitorExternalKey: 'away-1', role: 'away' },
			],
			result: {
				status: 'final',
				resultPayload: { homeScore: 22, awayScore: 38, winnerRole: 'away' },
			},
		});
		expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('eventsseason.php?id=4986&s=2025'));
		vi.unstubAllGlobals();
	});

	it('derives competitors from the schedule without fuzzy matching', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ events: [{
				idEvent: 'event-1',
				idHomeTeam: 'home-1',
				strHomeTeam: 'Home Rugby',
				strHomeTeamBadge: 'https://example.com/home.png',
				idAwayTeam: 'away-1',
				strAwayTeam: 'Away Rugby',
				strAwayTeamBadge: 'https://example.com/away.png',
				strTimestamp: '2025-08-16T15:10:00Z',
			}] }),
		}));
		const adapter = new TheSportsDbRugbyAdapter({ leagues: { 'rugby-championship': '4986' }, seasons: { '4986': '2025' } });
		await expect(adapter.fetchCompetitors('4986-2025')).resolves.toEqual([
			expect.objectContaining({ externalKey: 'home-1', name: 'Home Rugby' }),
			expect.objectContaining({ externalKey: 'away-1', name: 'Away Rugby' }),
		]);
		vi.unstubAllGlobals();
	});

	it('labels editions canonically and marks future seasons as planned', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ events: [{
				idEvent: 'future-1',
				strTimestamp: '2099-09-01T15:00:00Z',
				strStatus: 'NS',
			}] }),
		}));
		const adapter = new TheSportsDbRugbyAdapter({ leagues: { 'champions-cup': '4550' }, seasons: { '4550': '2099-2100' } });
		await expect(adapter.fetchEditions('4550')).resolves.toMatchObject([
			{ name: 'European Rugby Champions Cup · 2099-2100', status: 'planned' },
		]);
		vi.unstubAllGlobals();
	});

	it('handles configuration, empty schedules, caching, and malformed events', async () => {
		vi.stubEnv('THESPORTSDB_RUGBY_LEAGUES', '[]');
		expect(() => new TheSportsDbRugbyAdapter()).toThrow('THESPORTSDB_RUGBY_LEAGUES must be a JSON object');
		vi.stubEnv('THESPORTSDB_RUGBY_LEAGUES', '{"unknown":""}');
		vi.stubEnv('THESPORTSDB_RUGBY_SEASONS', '{}');
		const configured = new TheSportsDbRugbyAdapter({ leagues: { unknown: '' }, seasons: {} });
		await expect(configured.fetchCompetitions()).resolves.toEqual([]);
		await expect(configured.fetchEditions('unknown')).resolves.toEqual([]);

		const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: null }) });
		vi.stubGlobal('fetch', fetchSpy);
		const empty = new TheSportsDbRugbyAdapter({ leagues: { 'rugby-championship': '4986' }, seasons: { '4986': '2026' } });
		await expect(empty.fetchEvents({ editionExternalKey: '4986-2026' })).resolves.toEqual([]);
		await expect(empty.fetchEvents({ editionExternalKey: '4986-2026' })).resolves.toEqual([]);
		await expect(empty.fetchCompetitors('4986-2026')).rejects.toThrow('no Rugby competitors');
		expect(fetchSpy).toHaveBeenCalledTimes(1);

		const transformed = empty.transformEvents([
			{},
			{ idEvent: 'postponed', idHomeTeam: 'h', idAwayTeam: 'a', strTimestamp: '2026-09-01T12:00:00Z', strPostponed: 'yes', intHomeScore: '', intAwayScore: 'x' },
		], '4986-2026');
		expect(transformed).toMatchObject([{ externalKey: 'postponed', status: 'postponed', result: undefined }]);
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});
});
