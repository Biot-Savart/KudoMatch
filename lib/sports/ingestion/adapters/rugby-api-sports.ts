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
	apiSportsKey?: string;
	rapidApiKey?: string;
	rapidApiHost?: string;
	baseUrl?: string;
	recordedGames?: unknown;
}

function hasProviderErrors(errors: unknown): boolean {
	if (!errors) return false;
	if (typeof errors === 'string') return errors.trim().length > 0;
	if (Array.isArray(errors)) return errors.length > 0;
	if (typeof errors === 'object') return Object.keys(errors).length > 0;
	return true;
}

export class RugbyApiSportsAdapter implements SportProviderAdapter {
	public readonly providerSlug = 'api-sports';
	public readonly sportSlug = 'rugby-union';

	private apiSportsKey?: string;
	private rapidApiKey?: string;
	private rapidApiHost: string;
	private baseUrl: string;
	private recordedGames?: any;

	constructor(options: RugbyApiSportsAdapterOptions = {}) {
		this.apiSportsKey = options.apiSportsKey || process.env.API_SPORTS_KEY;
		this.rapidApiKey = options.rapidApiKey || process.env.RAPIDAPI_KEY;
		this.rapidApiHost =
			options.rapidApiHost ||
			process.env.RAPIDAPI_RUGBY_HOST ||
			'rugby-union.p.rapidapi.com';

		if (this.apiSportsKey) {
			// Direct API-Sports Configuration
			this.baseUrl = options.baseUrl || 'https://v1.rugby.api-sports.io';
		} else if (this.rapidApiKey) {
			// RapidAPI Configuration
			this.baseUrl =
				options.baseUrl ||
				process.env.RAPIDAPI_RUGBY_BASE_URL ||
				'https://rugby-union.p.rapidapi.com';
		} else {
			// Default URL (will require key at request time or recorded games)
			this.baseUrl = options.baseUrl || 'https://v1.rugby.api-sports.io';
		}

		this.recordedGames = options.recordedGames;
	}

	private getHeaders(): Record<string, string> {
		if (this.apiSportsKey) {
			return {
				'x-apisports-key': this.apiSportsKey,
			};
		}

		if (this.rapidApiKey) {
			return {
				'x-rapidapi-key': this.rapidApiKey,
				'x-rapidapi-host': this.rapidApiHost,
			};
		}

		throw new Error(
			'API-Sports authentication error: Neither API_SPORTS_KEY (direct) nor RAPIDAPI_KEY (RapidAPI) is configured.',
		);
	}

	private async request<T>(endpoint: string): Promise<T> {
		if (this.recordedGames) {
			const recordedPayload = this.recordedGames as T & {
				errors?: unknown;
			};
			if (hasProviderErrors(recordedPayload.errors)) {
				throw new Error(
					`API-Sports Rugby provider error: ${JSON.stringify(recordedPayload.errors)}`,
				);
			}
			return recordedPayload;
		}

		const headers = this.getHeaders();

		return withRetry(
			async () => {
				const response = await fetch(`${this.baseUrl}${endpoint}`, {
					headers,
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

				const payload = (await response.json()) as T & { errors?: unknown };
				if (hasProviderErrors(payload.errors)) {
					const error: any = new Error(
						`API-Sports Rugby provider error: ${JSON.stringify(payload.errors)}`,
					);
					error.status = 502;
					throw error;
				}

				return payload;
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
		if (competitionExternalKey && competitionExternalKey !== '11') {
			return [];
		}
		return [
			{
				externalKey: '11-2025',
				competitionExternalKey: '11',
				seasonKey: '2025',
				name: 'Six Nations 2025',
				startsAt: '2025-01-31T00:00:00Z',
				endsAt: '2025-03-15T23:59:59Z',
				status: 'completed',
			},
			{
				externalKey: '11-2026',
				competitionExternalKey: '11',
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
		const defaultSixNationsTeams = [
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

		let teams: Array<{
			id: number;
			name: string;
			logo?: string;
			country?: { code?: string };
		}> = defaultSixNationsTeams;

		if (this.apiSportsKey || this.rapidApiKey) {
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

			if (
				!data?.response ||
				!Array.isArray(data.response) ||
				data.response.length === 0
			) {
				throw new Error(
					`Failed to discover competitors for rugby league '${leagueId}' in season '${season}' from provider '${this.providerSlug}'`,
				);
			}
			teams = data.response;
		} else if (this.recordedGames?.response) {
			const extractedMap = new Map<
				number,
				{ id: number; name: string; logo?: string }
			>();
			for (const item of this.recordedGames.response) {
				if (item.teams?.home?.id && item.teams?.home?.name) {
					extractedMap.set(item.teams.home.id, {
						id: item.teams.home.id,
						name: item.teams.home.name,
						logo: item.teams.home.logo,
					});
				}
				if (item.teams?.away?.id && item.teams?.away?.name) {
					extractedMap.set(item.teams.away.id, {
						id: item.teams.away.id,
						name: item.teams.away.name,
						logo: item.teams.away.logo,
					});
				}
			}
			if (extractedMap.size > 0) {
				teams = Array.from(extractedMap.values());
			}
		}

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
		const season =
			options.seasonKey || options.editionExternalKey.split('-')[1] || '2026';

		const data = await this.request<{
			response?: Array<any>;
		}>(`/games?league=${leagueId}&season=${season}`);

		const games = data.response || [];
		return this.transformGames(games, options.editionExternalKey);
	}

	async fetchLiveUpdates(options: {
		editionExternalKey: string;
		competitionExternalKey?: string;
		seasonKey?: string;
	}): Promise<CanonicalEventDTO[]> {
		const leagueId = options.editionExternalKey.split('-')[0] || '11';
		const season =
			options.seasonKey || options.editionExternalKey.split('-')[1] || '2026';

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
						status === 'finished' && hasScores
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
