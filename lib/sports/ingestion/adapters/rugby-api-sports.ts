import { FetchEventsOptions, SportProviderAdapter } from '../adapter';
import {
	CanonicalCompetitionDTO,
	CanonicalCompetitorDTO,
	CanonicalEditionDTO,
	CanonicalEventDTO,
} from '../dto';
import { deriveResultStatus, normalizeEventStatus } from '../normalize-status';
import { withRetry } from '../retry';

export interface RugbyApiSportsAdapterOptions {
	apiKey?: string;
	baseUrl?: string;
	recordedGames?: unknown;
}

export class RugbyApiSportsAdapter implements SportProviderAdapter {
	public readonly providerSlug = 'api-sports';
	public readonly sportSlug = 'rugby-union';

	private apiKey?: string;
	private baseUrl: string;
	private recordedGames?: any;

	constructor(options: RugbyApiSportsAdapterOptions = {}) {
		this.apiKey =
			options.apiKey || process.env.API_SPORTS_KEY || process.env.RAPIDAPI_KEY;
		this.baseUrl = options.baseUrl || 'https://v1.rugby.api-sports.io';
		this.recordedGames = options.recordedGames;
	}

	private async request<T>(endpoint: string): Promise<T> {
		if (this.recordedGames) {
			return this.recordedGames as T;
		}

		if (!this.apiKey) {
			throw new Error('API_SPORTS_KEY or RAPIDAPI_KEY is not configured');
		}

		return withRetry(
			async () => {
				const response = await fetch(`${this.baseUrl}${endpoint}`, {
					headers: {
						'x-apisports-key': this.apiKey as string,
					},
				});

				if (!response.ok) {
					const error: any = new Error(
						`API-Sports Rugby HTTP ${response.status}: ${response.statusText}`,
					);
					error.status = response.status;
					const retryAfter = response.headers.get('Retry-After');
					if (retryAfter) {
						error.retryAfterMs = parseInt(retryAfter, 10) * 1000;
					}
					throw error;
				}

				return (await response.json()) as T;
			},
			{
				maxRetries: 3,
				initialDelayMs: 1000,
			},
		);
	}

	async fetchCompetitions(): Promise<CanonicalCompetitionDTO[]> {
		return [
			{
				externalKey: '11', // Six Nations League ID
				sportSlug: 'rugby-union',
				slug: 'six-nations',
				name: 'Six Nations Championship',
				kind: 'cup',
				country: 'Europe',
				logoUrl: 'https://media.api-sports.io/rugby/leagues/11.png',
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
				name: 'Six Nations 2025',
				startsAt: '2025-01-31T00:00:00Z',
				endsAt: '2025-03-15T23:59:59Z',
				status: 'completed',
			},
			{
				externalKey: `${competitionExternalKey}-2026`,
				competitionExternalKey,
				seasonKey: '2026',
				name: 'Six Nations 2026',
				startsAt: '2026-02-06T00:00:00Z',
				endsAt: '2026-03-21T23:59:59Z',
				status: 'active',
			},
		];
	}

	async fetchCompetitors(
		editionExternalKey: string,
	): Promise<CanonicalCompetitorDTO[]> {
		const leagueId = editionExternalKey.split('-')[0] || '11';
		const season = editionExternalKey.split('-')[1] || '2025';

		const data = await this.request<{
			response?: Array<{
				id: number;
				name: string;
				logo?: string;
				country?: { code?: string };
			}>;
		}>(`/teams?league=${leagueId}&season=${season}`);

		const teams = data.response || [
			{
				id: 16,
				name: 'England',
				logo: 'https://media.api-sports.io/rugby/teams/16.png',
			},
			{
				id: 17,
				name: 'France',
				logo: 'https://media.api-sports.io/rugby/teams/17.png',
			},
			{
				id: 18,
				name: 'Ireland',
				logo: 'https://media.api-sports.io/rugby/teams/18.png',
			},
			{
				id: 19,
				name: 'Italy',
				logo: 'https://media.api-sports.io/rugby/teams/19.png',
			},
			{
				id: 20,
				name: 'Scotland',
				logo: 'https://media.api-sports.io/rugby/teams/20.png',
			},
			{
				id: 21,
				name: 'Wales',
				logo: 'https://media.api-sports.io/rugby/teams/21.png',
			},
		];

		return teams.map((team) => ({
			externalKey: String(team.id),
			name: team.name,
			shortName: team.name.replace(/ Rugby$/i, ''),
			mediaUrl: team.logo,
			kind: 'team',
			countryCode: team.country?.code || undefined,
			isActive: true,
		}));
	}

	async fetchEvents(options: FetchEventsOptions): Promise<CanonicalEventDTO[]> {
		const leagueId = options.editionExternalKey.split('-')[0] || '11';
		const season = options.editionExternalKey.split('-')[1] || '2025';

		const data = await this.request<{
			response?: Array<any>;
		}>(`/games?league=${leagueId}&season=${season}`);

		const games = data.response || [];
		return this.transformGames(games, options.editionExternalKey);
	}

	async fetchLiveUpdates(options: {
		editionExternalKey: string;
	}): Promise<CanonicalEventDTO[]> {
		const leagueId = options.editionExternalKey.split('-')[0] || '11';
		const season = options.editionExternalKey.split('-')[1] || '2025';

		const data = await this.request<{
			response?: Array<any>;
		}>(`/games?league=${leagueId}&season=${season}&live=all`);

		const games = data.response || [];
		return this.transformGames(games, options.editionExternalKey);
	}

	public transformGames(
		games: any[],
		editionExternalKey: string,
	): CanonicalEventDTO[] {
		return games.map((game) => {
			const rawStatus = game.status?.short || game.status?.long || 'NS';
			const status = normalizeEventStatus(rawStatus);

			const scores = game.scores;
			const hasScores =
				scores &&
				scores.home !== null &&
				scores.away !== null &&
				scores.home !== undefined &&
				scores.away !== undefined;

			const resultStatus = deriveResultStatus(status, Boolean(hasScores));

			const homeScore = hasScores ? Number(scores.home) : null;
			const awayScore = hasScores ? Number(scores.away) : null;

			let winnerRole: 'home' | 'away' | 'draw' | null = null;
			if (homeScore !== null && awayScore !== null) {
				if (homeScore > awayScore) winnerRole = 'home';
				else if (awayScore > homeScore) winnerRole = 'away';
				else winnerRole = 'draw';
			}

			const kickoffTime = game.date
				? new Date(game.date).toISOString()
				: new Date(game.timestamp * 1000).toISOString();

			return {
				externalKey: String(game.id),
				editionExternalKey,
				roundName: game.week || 'Round 1',
				scheduledStartTime: kickoffTime,
				status,
				venue: game.venue?.name || undefined,
				participants: [
					{
						competitorExternalKey: String(game.teams.home.id),
						role: 'home',
						slotNumber: 1,
					},
					{
						competitorExternalKey: String(game.teams.away.id),
						role: 'away',
						slotNumber: 2,
					},
				],
				market: {
					marketKey: 'team_scoreline',
					status:
						status === 'finished'
							? 'settled'
							: status === 'cancelled' || status === 'abandoned'
								? 'void'
								: 'open',
					lockAt: kickoffTime,
				},
				result: hasScores
					? {
							status: resultStatus,
							resultPayload: {
								homeScore,
								awayScore,
								periodScores: {
									home1H: game.periods?.first?.home ?? null,
									away1H: game.periods?.first?.away ?? null,
									home2H: game.periods?.second?.home ?? null,
									away2H: game.periods?.second?.away ?? null,
									homeOT: game.periods?.overtime?.home ?? null,
									awayOT: game.periods?.overtime?.away ?? null,
								},
								winnerRole,
							},
							revisionNumber: 1,
						}
					: undefined,
			};
		});
	}
}
