import { describe, expect, it } from 'vitest';
import { runProviderContractCheck } from '@/lib/sports/ingestion/provider-contract-check';

const options = {
	competitionExternalKey: '796',
	editionExternalKey: '796-97057',
	expectedCompetitionSlug: 'currie-cup',
	expectedSeasonKey: '97057',
	probeEventExternalKey: '16393687',
	expectedProbeScore: { home: 24, away: 26 },
} as const;

function adapter(overrides: Record<string, unknown> = {}) {
	return {
		providerSlug: 'sofascore',
		sportSlug: 'rugby-union',
		capabilities: {
			competitions: true,
			editions: true,
			teams: true,
			historicalFixtures: false,
			currentFixtures: true,
			liveUpdates: true,
			results: true,
			standings: false,
			rankings: false,
		},
		fetchCompetitions: async () => [{ externalKey: '796', sportSlug: 'rugby-union', slug: 'currie-cup', name: 'Currie Cup', kind: 'league' as const }],
		fetchEditions: async () => [{ externalKey: '796-97057', competitionExternalKey: '796', seasonKey: '97057', name: 'Currie Cup 2026', status: 'active' as const }],
		fetchCompetitors: async () => [
			{ externalKey: '42704', name: 'Airlink Pumas' },
			{ externalKey: '42707', name: 'Hollywoodbets Sharks' },
		],
		fetchEvents: async () => [],
		fetchLiveUpdates: async () => [],
		fetchEvent: async () => ({
			externalKey: '16393687',
			editionExternalKey: 'unknown-97057',
			scheduledStartTime: '2026-07-17T15:00:00.000Z',
			status: 'finished' as const,
			participants: [
				{ competitorExternalKey: '42704', role: 'home' as const, slotNumber: 1 },
				{ competitorExternalKey: '42707', role: 'away' as const, slotNumber: 2 },
			],
			market: { marketKey: 'team_scoreline', status: 'settled' as const, lockAt: '2026-07-17T15:00:00.000Z' },
			result: { status: 'final' as const, resultPayload: { homeScore: 24, awayScore: 26 } },
		}),
		...overrides,
	};
}

describe('provider contract check', () => {
	it('accepts the known Currie Cup contract and probe event', async () => {
		const report = await runProviderContractCheck(adapter(), options);
		expect(report.passed).toBe(true);
		expect(report.checks.every((check) => check.passed)).toBe(true);
	});

	it('fails closed when the probe result is not final', async () => {
		const report = await runProviderContractCheck(adapter({
			fetchEvent: async () => ({
				externalKey: '16393687',
				editionExternalKey: 'unknown-97057',
				scheduledStartTime: '2026-07-17T15:00:00.000Z',
				status: 'live' as const,
				participants: [],
				market: { marketKey: 'team_scoreline', status: 'open' as const, lockAt: '2026-07-17T15:00:00.000Z' },
			}),
		}), options);
		expect(report.passed).toBe(false);
	});
});
