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
	footballDataApiKey?: string;
	rapidApiKey?: string;
	rapidApiHost?: string;
	baseUrl?: string;
	recordedMatches?: unknown;
}

export class FootballDataAdapter implements SportProviderAdapter {
	public readonly providerSlug = 'football-data';
	public readonly sportSlug = 'football';

	private directApiKey?: string;
	private rapidApiKey?: string;
	private rapidApiHost: string;
	private baseUrl: string;
	private recordedMatches?: any;

	constructor(options: FootballDataAdapterOptions = {}) {
		this.directApiKey =
			options.footballDataApiKey ||
			options.apiKey ||
			process.env.FOOTBALL_DATA_API_KEY;
		this.rapidApiKey = options.rapidApiKey || process.env.RAPIDAPI_KEY;
		this.rapidApiHost =
			options.rapidApiHost ||
			process.env.RAPIDAPI_FOOTBALL_DATA_HOST ||
			'football-data.p.rapidapi.com';

		if (this.directApiKey) {
			// Direct Football-Data.org Client
			this.baseUrl = options.baseUrl || 'https://api.football-data.org/v4';
		} else if (this.rapidApiKey) {
			// RapidAPI Gateway Configuration
			this.baseUrl =
				options.baseUrl ||
				process.env.RAPIDAPI_FOOTBALL_DATA_BASE_URL ||
				'https://football-data.p.rapidapi.com/v4';
		} else {
			this.baseUrl = options.baseUrl || 'https://api.football-data.org/v4';
		}

		this.recordedMatches = options.recordedMatches;
	}

	private getHeaders(): Record<string, string> {
		if (this.directApiKey) {
			return {
				'X-Auth-Token': this.directApiKey,
			};
		}

		if (this.rapidApiKey) {
			return {
				'x-rapidapi-key': this.rapidApiKey,
				'x-rapidapi-host': this.rapidApiHost,
			};
		}

		throw new Error(
			'Football-Data authentication error: Neither FOOTBALL_DATA_API_KEY (direct) nor RAPIDAPI_KEY (RapidAPI) is configured.',
		);
	}

	private async request<T>(endpoint: string): Promise<T> {
		if (this.recordedMatches) {
			return this.recordedMatches as T;
		}

		const headers = this.getHeaders();

		return withRetry(
			async () => {
				const response = await fetch(`${this.baseUrl}${endpoint}`, {
					headers,
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
		if (competitionExternalKey && competitionExternalKey !== '2021') {
			return [];
		}
		return [
			{
				externalKey: '2021-2024',
				competitionExternalKey: '2021',
				seasonKey: '2024-2025',
				name: 'Premier League 2024/2025',
				status: 'completed',
			},
			{
				externalKey: '2021-2025',
				competitionExternalKey: '2021',
				seasonKey: '2025-2026',
				name: 'Premier League 2025/2026',
				status: 'active',
			},
		];
	}

	private extractSeasonYear(seasonOrEditionKey?: string): string {
		if (!seasonOrEditionKey) return '2025';
		const parts = seasonOrEditionKey.split('-');
		if (
			parts.length === 2 &&
			/^\d{4}$/.test(parts[0]) &&
			/^\d{4}$/.test(parts[1])
		) {
			// If it's a span like 2025-2026 (consecutive years), use starting year
			if (Number(parts[1]) === Number(parts[0]) + 1) {
				return parts[0];
			}
			// Otherwise it's competition-season like 2021-2025 -> return season year 2025
			return parts[1];
		}
		if (parts.length >= 2 && /^\d{4}$/.test(parts[1])) {
			return parts[1];
		}
		const match = seasonOrEditionKey.match(/\b(20\d\d)\b/);
		return match ? match[1] : '2025';
	}

	async fetchCompetitors(
		editionExternalKey: string,
	): Promise<CanonicalCompetitorDTO[]> {
		const compId = editionExternalKey.split('-')[0] || '2021';
		const seasonYear = this.extractSeasonYear(editionExternalKey);

		let teams: Array<{
			id: number;
			name: string;
			shortName?: string;
			tla?: string;
			crest?: string;
		}> = [];

		if (this.directApiKey || this.rapidApiKey) {
			const data = await this.request<{
				teams?: Array<{
					id: number;
					name: string;
					shortName?: string;
					tla?: string;
					crest?: string;
				}>;
			}>(`/competitions/${compId}/teams?season=${seasonYear}`);

			if (
				!data?.teams ||
				!Array.isArray(data.teams) ||
				data.teams.length === 0
			) {
				throw new Error(
					`Failed to discover competitors for competition '${compId}' in season '${seasonYear}' from provider '${this.providerSlug}'`,
				);
			}
			teams = data.teams;
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
		const seasonYear = this.extractSeasonYear(
			options.seasonKey || options.editionExternalKey,
		);
		const data = await this.request<{
			matches?: Array<any>;
		}>(`/competitions/${compId}/matches?season=${seasonYear}`);

		const matches = data.matches || [];
		return this.transformMatches(matches, options.editionExternalKey);
	}

	async fetchLiveUpdates(options: {
		editionExternalKey: string;
		competitionExternalKey?: string;
		seasonKey?: string;
	}): Promise<CanonicalEventDTO[]> {
		const compId = options.editionExternalKey.split('-')[0] || '2021';
		const seasonYear = this.extractSeasonYear(
			options.seasonKey || options.editionExternalKey,
		);
		const data = await this.request<{
			matches?: Array<any>;
		}>(
			`/competitions/${compId}/matches?season=${seasonYear}&status=IN_PLAY,PAUSED,FINISHED`,
		);

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
						status === 'finished' && hasScores
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
