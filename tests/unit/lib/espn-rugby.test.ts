import { EspnRugbyAdapter } from '@/lib/sports/ingestion/adapters/espn-rugby';
import { createSportProviderAdapter } from '@/lib/sports/ingestion/provider-factory';
import scoreboard from '@/tests/fixtures/providers/espn/rugby-union/currie-cup-scoreboard.json';

describe('ESPN Rugby adapter (Phase 6)', () => {
	it('normalizes recorded scheduled and completed scoreboard events', async () => {
		const adapter = new EspnRugbyAdapter({
			recordedResponses: { '/270555/scoreboard?dates=2026': scoreboard },
		});
		const events = await adapter.fetchEvents({
			editionExternalKey: '270555-2026',
			competitionExternalKey: '270555',
			seasonKey: '2026',
		});
		expect(events).toHaveLength(2);
		expect(events[0]).toMatchObject({ externalKey: '599267', status: 'finished', venue: 'Kings Park' });
		expect(events[0].result?.resultPayload).toMatchObject({ homeScore: 27, awayScore: 22, winnerRole: 'home' });
		expect(events[1].status).toBe('scheduled');
		expect(events[1].result).toBeUndefined();
	});

	it('rejects malformed recorded responses before normalization', async () => {
		const adapter = new EspnRugbyAdapter({ recordedResponses: { '/270555/scoreboard?dates=2026': { events: [{}] } } });
		await expect(adapter.fetchEvents({ editionExternalKey: '270555-2026', competitionExternalKey: '270555', seasonKey: '2026' })).rejects.toMatchObject({ code: 'SCHEMA_ERROR' });
	});

	it('is available only for rugby through the shared factory', () => {
		expect(createSportProviderAdapter('espn', { sport: 'rugby-union' }).providerSlug).toBe('espn');
		expect(() => createSportProviderAdapter('espn', { sport: 'football' })).toThrow(/incompatible/);
	});
});
