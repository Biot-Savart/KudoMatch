import { describe, expect, it, vi } from 'vitest';
import { SofaScoreProvider } from '@/lib/sports/ingestion/adapters/sofascore';
import { createSportProviderAdapter } from '@/lib/sports/ingestion/provider-factory';

const finishedEvent = {
	id: 16393687,
	customId: 'eersher',
	status: { type: 'finished', name: 'Finished' },
	startTimestamp: 1784300400,
	homeTeam: { id: 42704, name: 'Airlink Pumas', shortName: 'Pumas' },
	awayTeam: { id: 42707, name: 'Hollywoodbets Sharks', shortName: 'Sharks' },
	homeScore: { current: 24, normaltime: 24 },
	awayScore: { current: 26, normaltime: 26 },
	roundInfo: { name: 'Round 7' },
	venue: { name: 'Mbombela Stadium' },
};

const scheduledEvent = {
	id: 16966295,
	status: { type: 'notstarted' },
	startTimestamp: 1788692400,
	homeTeam: { id: 42708, name: 'Suzuki Griquas' },
	awayTeam: { id: 4184, name: 'Fidelity ADT Lions' },
	roundInfo: { name: 'Semifinals' },
};

function recordedResponses(): Record<string, unknown> {
	return {
		'/v1/tournaments/796/seasons': {
			seasons: [{ id: 97057, name: 'Currie Cup 2026', year: '2026' }],
		},
		'/v1/tournaments/796/seasons/97057/teams': {
			teams: [
				{ id: 42704, name: 'Airlink Pumas', nameCode: 'PUM' },
				{ id: 42707, name: 'Hollywoodbets Sharks', nameCode: 'SHA' },
			],
		},
		'/v1/tournaments/796/seasons/97057/events/next/0': { events: [scheduledEvent], hasNextPage: false },
		'/v1/tournaments/796/seasons/97057/events/last/0': { events: [finishedEvent], hasNextPage: false },
		'/v1/events/16393687': { event: { ...finishedEvent, season: { id: 97057 }, tournament: { uniqueTournamentId: 796 } } },
	};
}

describe('SofaScoreProvider', () => {
	it('normalizes the observed Currie Cup season, teams, fixture, and result contracts', async () => {
		const provider = new SofaScoreProvider({ recordedResponses: recordedResponses() });
		const editions = await provider.fetchEditions('796');
		const teams = await provider.fetchCompetitors('796-97057');
		const events = await provider.fetchEvents({ editionExternalKey: '796-97057' });

		expect(editions[0]).toMatchObject({
			externalKey: '796-97057',
			competitionExternalKey: '796',
			seasonKey: '97057',
			status: 'active',
		});
		expect(teams.map((team) => team.externalKey)).toEqual(['42704', '42707']);
		expect(events).toHaveLength(2);
		expect(events.find((event) => event.externalKey === '16393687')).toMatchObject({
		status: 'finished',
		result: {
			status: 'final',
			resultPayload: { homeScore: 24, awayScore: 26, winnerRole: 'away' },
		},
	});
		expect(events.find((event) => event.externalKey === '16966295')).toMatchObject({
		status: 'scheduled',
		result: undefined,
	});
	});

	it('uses the internal gateway for single-event fetches and never contacts SofaScore directly', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ event: finishedEvent }), { status: 200 }));
		const provider = new SofaScoreProvider({
			gatewayUrl: 'http://gateway.internal',
			internalApiKey: 'test-key',
			fetcher,
		});

		await provider.fetchEvent('16393687');

		expect(fetcher).toHaveBeenCalledWith(
		'http://gateway.internal/v1/events/16393687',
			expect.objectContaining({
			headers: expect.objectContaining({
				'x-internal-api-key': 'test-key',
			}),
		}),
		);
	});

	it('rejects a provider error payload even when the gateway returns HTTP 200', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'blocked' } }), { status: 200 }));
		const provider = new SofaScoreProvider({
			gatewayUrl: 'http://gateway.internal',
			internalApiKey: 'test-key',
			fetcher,
		});

		await expect(provider.fetchEvent('16393687')).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
	});

	it('rejects partial scores instead of creating a final result with fabricated data', async () => {
		const provider = new SofaScoreProvider({
			recordedResponses: {
				'/v1/tournaments/796/seasons/97057/events/last/0': {
					events: [{ ...finishedEvent, awayScore: undefined }],
				},
			},
		});

		await expect(provider.fetchLiveUpdates({ editionExternalKey: '796-97057' })).rejects.toMatchObject({ code: 'SCHEMA_ERROR' });
	});

	it.each([
		['inprogress', 'live', 'provisional'],
		['postponed', 'postponed', 'provisional'],
		['canceled', 'cancelled', 'void'],
		['abandoned', 'abandoned', 'void'],
		['finished-without-score', 'finished', undefined],
	] as const)('normalizes %s state without unsafe finalization', async (label, expectedStatus, expectedResultStatus) => {
		const rawEvent = {
			...finishedEvent,
			status: { type: label === 'finished-without-score' ? 'finished' : label },
			...(label === 'finished-without-score' ? { homeScore: undefined, awayScore: undefined } : {}),
		};
		const provider = new SofaScoreProvider({
			recordedResponses: {
				'/v1/tournaments/796/seasons/97057/events/last/0': { events: [rawEvent] },
			},
		});
		const [event] = await provider.fetchLiveUpdates({ editionExternalKey: '796-97057' });
		expect(event?.status, label).toBe(expectedStatus);
		expect(event?.result?.status, label).toBe(expectedResultStatus);
		expect(event?.market?.status, label).toBe(expectedResultStatus === 'void' ? 'void' : 'open');
	});

	it('is available through the explicit provider factory', () => {
		const adapter = createSportProviderAdapter('sofascore', { sport: 'rugby-union' });
		expect(adapter.providerSlug).toBe('sofascore');
		expect(adapter.sportSlug).toBe('rugby-union');
		expect(adapter.capabilities?.currentFixtures).toBe(true);
	});
});
