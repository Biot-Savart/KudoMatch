import { FetchEventsOptions, SportProviderAdapter } from '../adapter';
import {
	CanonicalCompetitionDTO,
	CanonicalCompetitorDTO,
	CanonicalEditionDTO,
	CanonicalEventDTO,
} from '../dto';
import { deriveResultStatus, normalizeEventStatus } from '../normalize-status';
import { withRetry } from '../retry';

export interface FootballDataAdapterOptions {
	apiKey?: string;
	baseUrl?: string;
	recordedMatches?: unknown;
}

export class FootballDataAdapter implements SportProviderAdapter {
	public readonly providerSlug = 'football-data';
	public readonly sportSlug = 'football';

	private apiKey?: string;
	private baseUrl: string;
	private recordedMatches?: any;

	constructor(options: FootballDataAdapterOptions = {}) {
		this.apiKey =
			options.apiKey ||
			process.env.FOOTBALL_DATA_API_KEY ||
			process.env.RAPIDAPI_KEY;
		this.baseUrl = options.baseUrl || 'https://api.football-data.org/v4';
		this.recordedMatches = options.recordedMatches;
	}

	private async request<T>(endpoint: string): Promise<T> {
		if (this.recordedMatches) {
			return this.recordedMatches as T;
		}

		if (!this.apiKey) {
			throw new Error('FOOTBALL_DATA_API_KEY is not configured');
		}

		return withRetry(
			async () => {
				const response = await fetch(`${this.baseUrl}${endpoint}`, {
					headers: {
						'X-Auth-Token': this.apiKey as string,
					},
				});

				if (!response.ok) {
					const error: any = new Error(
						`Football-Data HTTP ${response.status}: ${response.statusText}`,
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
				externalKey: '2021', // Premier League
				sportSlug: 'football',
				slug: 'premier-league',
				name: 'Premier League',
				kind: 'league',
				country: 'England',
				logoUrl: 'https://crests.football-data.org/PL.png',
				isActive: true,
			},
		];
	}

	async fetchEditions(
		competitionExternalKey: string,
	): Promise<CanonicalEditionDTO[]> {
		return [
			{
				externalKey: `${competitionExternalKey}-2024`,
				competitionExternalKey,
				seasonKey: '2024-2025',
				name: 'Premier League 2024/2025',
				status: 'active',
			},
			{
				externalKey: `${competitionExternalKey}-2025`,
				competitionExternalKey,
				seasonKey: '2025-2026',
				name: 'Premier League 2025/2026',
				status: 'active',
			},
		];
	}

	async fetchCompetitors(
		editionExternalKey: string,
	): Promise<CanonicalCompetitorDTO[]> {
		let teams: Array<{
			id: number;
			name: string;
			shortName?: string;
			tla?: string;
			crest?: string;
		}> = [];

		if (this.apiKey) {
			try {
				const compId = editionExternalKey.split('-')[0] || '2021';
				const data = await this.request<{
					teams?: Array<{
						id: number;
						name: string;
						shortName?: string;
						tla?: string;
						crest?: string;
					}>;
				}>(`/competitions/${compId}/teams`);

				if (data?.teams && Array.isArray(data.teams)) {
					teams = data.teams;
				}
			} catch {
				teams = [];
			}
		} else if (this.recordedMatches?.matches) {
			const extractedMap = new Map<
				number,
				{
					id: number;
					name: string;
					shortName?: string;
					tla?: string;
					crest?: string;
				}
			>();
			for (const match of this.recordedMatches.matches) {
				if (match.homeTeam?.id && match.homeTeam?.name) {
					extractedMap.set(match.homeTeam.id, {
						id: match.homeTeam.id,
						name: match.homeTeam.name,
						shortName:
							match.homeTeam.shortName ||
							match.homeTeam.tla ||
							match.homeTeam.name,
						crest: match.homeTeam.crest,
					});
				}
				if (match.awayTeam?.id && match.awayTeam?.name) {
					extractedMap.set(match.awayTeam.id, {
						id: match.awayTeam.id,
						name: match.awayTeam.name,
						shortName:
							match.awayTeam.shortName ||
							match.awayTeam.tla ||
							match.awayTeam.name,
						crest: match.awayTeam.crest,
					});
				}
			}
			teams = Array.from(extractedMap.values());
		}

		return teams.map((team) => ({
			externalKey: String(team.id),
			name: team.name,
			shortName: team.shortName || team.tla || team.name,
			mediaUrl: team.crest,
			kind: 'team',
			countryCode: 'GB-ENG',
			isActive: true,
		}));
	}

	async fetchEvents(options: FetchEventsOptions): Promise<CanonicalEventDTO[]> {
		const compId = options.editionExternalKey.split('-')[0] || '2021';
		const data = await this.request<{
			matches?: Array<any>;
		}>(`/competitions/${compId}/matches`);

		const matches = data.matches || [];
		return this.transformMatches(matches, options.editionExternalKey);
	}

	async fetchLiveUpdates(options: {
		editionExternalKey: string;
	}): Promise<CanonicalEventDTO[]> {
		const compId = options.editionExternalKey.split('-')[0] || '2021';
		const data = await this.request<{
			matches?: Array<any>;
		}>(`/competitions/${compId}/matches?status=IN_PLAY,PAUSED,FINISHED`);

		const matches = data.matches || [];
		return this.transformMatches(matches, options.editionExternalKey);
	}

	public transformMatches(
		matches: any[],
		editionExternalKey: string,
	): CanonicalEventDTO[] {
		return matches.map((match) => {
			const status = normalizeEventStatus(match.status);
			const fullTime = match.score?.fullTime;
			const hasScores =
				fullTime &&
				fullTime.home !== null &&
				fullTime.away !== null &&
				fullTime.home !== undefined &&
				fullTime.away !== undefined;

			const resultStatus = deriveResultStatus(status, Boolean(hasScores));

			const homeScore = hasScores ? Number(fullTime.home) : null;
			const awayScore = hasScores ? Number(fullTime.away) : null;

			let winnerRole: 'home' | 'away' | 'draw' | null = null;
			if (homeScore !== null && awayScore !== null) {
				if (homeScore > awayScore) winnerRole = 'home';
				else if (awayScore > homeScore) winnerRole = 'away';
				else winnerRole = 'draw';
			}

			return {
				externalKey: String(match.id),
				editionExternalKey,
				roundName: match.matchday
					? `Gameweek ${match.matchday}`
					: match.stage || 'Regular Season',
				scheduledStartTime: new Date(match.utcDate).toISOString(),
				status,
				venue: match.venue || undefined,
				participants: [
					{
						competitorExternalKey: String(match.homeTeam.id),
						role: 'home',
						slotNumber: 1,
					},
					{
						competitorExternalKey: String(match.awayTeam.id),
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
					lockAt: new Date(match.utcDate).toISOString(),
				},
				result: hasScores
					? {
							status: resultStatus,
							resultPayload: {
								homeScore,
								awayScore,
								periodScores: {
									home1H: match.score?.halfTime?.home ?? null,
									away1H: match.score?.halfTime?.away ?? null,
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
