import { FetchEventsOptions, ProviderCapabilities, SportProviderAdapter } from '../adapter';
import {
	CanonicalCompetitionDTO,
	CanonicalCompetitorDTO,
	CanonicalEditionDTO,
	CanonicalEventDTO,
} from '../dto';

export class MockSportProviderAdapter implements SportProviderAdapter {
	public readonly providerSlug = 'mock-provider';
	public readonly sportSlug: string;
	public readonly capabilities: ProviderCapabilities = {
		competitions: true,
		editions: true,
		teams: true,
		historicalFixtures: true,
		currentFixtures: true,
		liveUpdates: true,
		results: true,
		standings: false,
		rankings: false,
	};

	constructor(sportSlug = 'football') {
		if (process.env.NODE_ENV === 'production') {
			throw new Error(
				'MockSportProviderAdapter is forbidden in production environment',
			);
		}
		this.sportSlug = sportSlug;
	}

	async fetchCompetitions(): Promise<CanonicalCompetitionDTO[]> {
		return [
			{
				externalKey: 'mock-comp-1',
				sportSlug: this.sportSlug,
				slug: `${this.sportSlug}-mock-league`,
				name: `Mock ${this.sportSlug.toUpperCase()} League`,
				kind: 'league',
				country: 'Mockland',
				isActive: true,
			},
		];
	}

	async fetchEditions(
		competitionExternalKey: string,
	): Promise<CanonicalEditionDTO[]> {
		return [
			{
				externalKey: `${competitionExternalKey}-2025`,
				competitionExternalKey,
				seasonKey: '2025',
				name: 'Mock Season 2025',
				status: 'active',
			},
		];
	}

	async fetchCompetitors(
		editionExternalKey: string,
	): Promise<CanonicalCompetitorDTO[]> {
		return [
			{
				externalKey: `mock-team-1`,
				name: 'Mock Alpha FC',
				shortName: 'Alpha',
				kind: 'team',
				countryCode: 'MOK',
				isActive: true,
			},
			{
				externalKey: `mock-team-2`,
				name: 'Mock Beta RFC',
				shortName: 'Beta',
				kind: 'team',
				countryCode: 'MOK',
				isActive: true,
			},
		];
	}

	async fetchEvents(options: FetchEventsOptions): Promise<CanonicalEventDTO[]> {
		const now = new Date();
		return [
			{
				externalKey: `mock-evt-1`,
				editionExternalKey: options.editionExternalKey,
				roundName: 'Round 1',
				scheduledStartTime: new Date(now.getTime() + 86400000).toISOString(),
				status: 'scheduled',
				venue: 'Mock National Stadium',
				participants: [
					{
						competitorExternalKey: 'mock-team-1',
						role: 'home',
						slotNumber: 1,
					},
					{
						competitorExternalKey: 'mock-team-2',
						role: 'away',
						slotNumber: 2,
					},
				],
				market: {
					marketKey: 'team_scoreline',
					status: 'open',
				},
			},
		];
	}

	async fetchLiveUpdates(options: {
		editionExternalKey: string;
	}): Promise<CanonicalEventDTO[]> {
		return [
			{
				externalKey: `mock-evt-1`,
				editionExternalKey: options.editionExternalKey,
				roundName: 'Round 1',
				scheduledStartTime: new Date().toISOString(),
				status: 'finished',
				venue: 'Mock National Stadium',
				participants: [
					{
						competitorExternalKey: 'mock-team-1',
						role: 'home',
						slotNumber: 1,
					},
					{
						competitorExternalKey: 'mock-team-2',
						role: 'away',
						slotNumber: 2,
					},
				],
				market: {
					marketKey: 'team_scoreline',
					status: 'settled',
				},
				result: {
					status: 'final',
					resultPayload: {
						homeScore: 2,
						awayScore: 1,
						winnerRole: 'home',
					},
					revisionNumber: 1,
				},
			},
		];
	}
}
