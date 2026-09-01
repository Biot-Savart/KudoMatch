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
	recordedCompetitions?: unknown;
	recordedEditions?: unknown;
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
	private recordedCompetitions?: any;
	private recordedEditions?: any;

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
		this.recordedCompetitions = options.recordedCompetitions;
		this.recordedEditions = options.recordedEditions;
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
		if (this.recordedCompetitions) {
			const payload = Array.isArray(this.recordedCompetitions)
				? this.recordedCompetitions
				: this.recordedCompetitions.response;
			if (!Array.isArray(payload))
				throw new Error('Recorded rugby competition payload is malformed');
			return payload.map((item: any) => {
				const league = item.league ?? item;
				return {
					externalKey: String(league.id ?? league.externalKey),
					sportSlug: 'rugby-union',
					slug: String(league.slug ?? league.name)
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, '-')
						.replace(/(^-|-$)/g, ''),
					name: String(league.name),
					kind: league.kind === 'league' ? 'league' : 'cup',
					country: item.country?.name ?? item.country ?? undefined,
					logoUrl: league.logo ?? league.logoUrl ?? undefined,
					isActive: league.isActive !== false,
				};
			});
		}

		// In production IDs are supplied by the verified launch manifest. There is
		// intentionally no guessed fallback for the four non-Six-Nations leagues.
		const names: Record<
			string,
			{ name: string; kind: 'league' | 'cup'; country: string }
		> = {
			'six-nations': {
				name: 'Six Nations Championship',
				kind: 'cup',
				country: 'Europe',
			},
			'united-rugby-championship': {
				name: 'United Rugby Championship',
				kind: 'league',
				country: 'Europe',
			},
			'rugby-championship': {
				name: 'Rugby Championship',
				kind: 'cup',
				country: 'Southern Hemisphere',
			},
			'premiership-rugby': {
				name: 'Premiership Rugby',
				kind: 'league',
				country: 'England',
			},
			'champions-cup': {
				name: 'European Rugby Champions Cup',
				kind: 'cup',
				country: 'Europe',
			},
			'top-14': { name: 'French Top 14', kind: 'league', country: 'France' },
			'super-rugby-pacific': {
				name: 'Super Rugby Pacific',
				kind: 'league',
				country: 'Southern Hemisphere',
			},
			'rugby-world-cup': {
				name: 'Rugby World Cup',
				kind: 'cup',
				country: 'World',
			},
			'currie-cup': {
				name: 'Currie Cup',
				kind: 'league',
				country: 'South Africa',
			},
		};
		const configured = process.env.RUGBY_COMPETITION_IDS;
		if (configured) {
			let ids: Record<string, string>;
			try {
				ids = JSON.parse(configured) as Record<string, string>;
			} catch {
				throw new Error('RUGBY_COMPETITION_IDS must be valid JSON');
			}
			return Object.entries(names)
				.filter(([slug]) => ids[slug])
				.map(([slug, meta]) => ({
					externalKey: String(ids[slug]),
					sportSlug: 'rugby-union',
					slug,
					...meta,
					logoUrl: undefined,
					isActive: true,
				}));
		}
		if (this.apiSportsKey) {
			const payload = await this.request<{ response?: any[] }>('/leagues');
			const aliases: Record<string, string[]> = {
				'six-nations': ['six nations'],
				'united-rugby-championship': ['united rugby championship', 'urc'],
				'rugby-championship': ['rugby championship'],
				'premiership-rugby': ['premiership rugby'],
				'champions-cup': ['champions cup', 'european rugby champions cup'],
				'top-14': ['top 14', 'french top 14'],
				'super-rugby-pacific': ['super rugby pacific', 'super rugby'],
				'rugby-world-cup': ['rugby world cup', 'world cup'],
				'currie-cup': ['currie cup', 'premier division currie cup'],
			};
			const discovered = (payload.response ?? []).map(
				(item: any) => item.league ?? item,
			);
			const matches = Object.entries(aliases).flatMap(([slug, accepted]) => {
				const league = discovered.find((item) =>
					accepted.includes(String(item.name).toLowerCase()),
				);
				if (!league?.id) return [];
				const meta = names[slug];
				return [
					{
						externalKey: String(league.id),
						sportSlug: 'rugby-union',
						slug,
						...meta,
						logoUrl: league.logo,
						isActive: true,
					},
				];
			});
			if (matches.length === 0)
				throw new Error('API-Sports returned no verified launch competitions');
			return matches;
		}

		if (process.env.NODE_ENV === 'production') {
			throw new Error(
				'Rugby competition discovery requires API_SPORTS_KEY/RAPIDAPI_KEY or a recorded competition payload; refusing a guessed Six Nations fallback',
			);
		}
		return [
			{
				externalKey: '11',
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
		if (this.recordedEditions) {
			const payload = Array.isArray(this.recordedEditions)
				? this.recordedEditions
				: this.recordedEditions.response;
			if (!Array.isArray(payload))
				throw new Error('Recorded rugby edition payload is malformed');
			return payload
				.filter(
					(item: any) =>
						String(
							item.competitionExternalKey ??
								item.leagueId ??
								competitionExternalKey,
						) === competitionExternalKey,
				)
				.map((item: any) => ({
					externalKey: String(
						item.externalKey ??
							`${competitionExternalKey}-${item.seasonKey ?? item.season}`,
					),
					competitionExternalKey,
					seasonKey: String(item.seasonKey ?? item.season),
					name: String(
						item.name ??
							`${competitionExternalKey} ${item.seasonKey ?? item.season}`,
					),
					startsAt: item.startsAt ?? undefined,
					endsAt: item.endsAt ?? undefined,
					status: item.status === 'completed' ? 'completed' : 'active',
				}));
		}
		// Direct API-Sports editions are keyed by the verified league ID and the
		// configured provider season. This keeps ingestion generic across all
		// launch competitions instead of silently assuming Six Nations (11).
		if (this.apiSportsKey || this.rapidApiKey) {
			const seasonKey =
				process.env.RUGBY_PROVIDER_SEASON ||
				new Date().getUTCFullYear().toString();
			const seasonNumber = Number.parseInt(seasonKey, 10);
			const isCompleted =
				Number.isFinite(seasonNumber) &&
				seasonNumber < new Date().getUTCFullYear();
			return [
				{
					externalKey: `${competitionExternalKey}-${seasonKey}`,
					competitionExternalKey,
					seasonKey,
					name: `${competitionExternalKey} ${seasonKey}`,
					status: isCompleted ? 'completed' : 'active',
				},
			];
		}

		if (competitionExternalKey && competitionExternalKey !== '11') {
			return [];
		}
		if (
			!this.recordedGames &&
			!this.apiSportsKey &&
			!this.rapidApiKey &&
			process.env.NODE_ENV === 'production'
		) {
			throw new Error(
				'Rugby edition discovery requires provider access or recorded catalog data',
			);
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
		let teams: Array<{
			id: number;
			name: string;
			logo?: string;
			country?: { code?: string };
		}> = [];

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
		if (teams.length === 0 && process.env.NODE_ENV !== 'production') {
			teams = [16, 17, 18, 19, 20, 21].map((id) => ({
				id,
				name: `Rugby Team ${id}`,
			}));
		}
		if (teams.length === 0) {
			throw new Error(
				`Cannot discover rugby competitors for '${editionExternalKey}': direct provider access or a recorded fixture payload is required`,
			);
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
