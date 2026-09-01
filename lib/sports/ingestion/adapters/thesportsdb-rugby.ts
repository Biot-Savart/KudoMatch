import { FetchEventsOptions, SportProviderAdapter } from '../adapter';
import {
	CanonicalCompetitionDTO,
	CanonicalCompetitorDTO,
	CanonicalEditionDTO,
	CanonicalEventDTO,
} from '../dto';
import { deriveResultStatus, normalizeEventStatus } from '../normalize-status';
import { withRetry } from '../retry';

type TheSportsDbEvent = {
	idEvent?: string;
	strEvent?: string;
	strSeason?: string;
	idLeague?: string;
	strLeague?: string;
	strHomeTeam?: string;
	strAwayTeam?: string;
	idHomeTeam?: string;
	idAwayTeam?: string;
	intRound?: string;
	intHomeScore?: string | number | null;
	intAwayScore?: string | number | null;
	strTimestamp?: string;
	dateEvent?: string;
	strTime?: string;
	strHomeTeamBadge?: string;
	strAwayTeamBadge?: string;
	strVenue?: string;
	strCountry?: string;
	strStatus?: string;
	strPostponed?: string;
};

export interface TheSportsDbRugbyAdapterOptions {
	apiKey?: string;
	baseUrl?: string;
	leagues?: Record<string, string>;
	seasons?: Record<string, string>;
}

const DEFAULT_LEAGUES: Record<string, string> = {
	'six-nations': '4714',
	'united-rugby-championship': '4446',
	'rugby-championship': '4986',
	'premiership-rugby': '4414',
	'champions-cup': '4550',
	'top-14': '4447',
	'super-rugby-pacific': '4448',
	'rugby-world-cup': '4715',
	'currie-cup': '4551',
};

const DEFAULT_SEASONS: Record<string, string> = {
	'4714': '2026',
	'4446': '2025-2026',
	'4986': '2025',
	'4414': '2025-2026',
	'4550': '2025-2026',
	'4447': '2025-2026',
	'4448': '2026',
	'4715': '2027',
	'4551': '2026',
};

const COMPETITION_META: Record<
	string,
	Pick<CanonicalCompetitionDTO, 'name' | 'kind' | 'country'>
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
	'rugby-world-cup': { name: 'Rugby World Cup', kind: 'cup', country: 'World' },
	'currie-cup': { name: 'Currie Cup', kind: 'league', country: 'South Africa' },
};

function readJsonEnv(
	name: string,
	fallback: Record<string, string>,
): Record<string, string> {
	const raw = process.env[name];
	if (!raw) return fallback;
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
			throw new Error('object required');
		return Object.fromEntries(
			Object.entries(parsed).map(([key, value]) => [key, String(value)]),
		);
	} catch {
		throw new Error(`${name} must be a JSON object`);
	}
}

function score(value: string | number | null | undefined): number | null {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function editionParts(editionExternalKey: string): {
	leagueId: string;
	season: string;
} {
	const separator = editionExternalKey.indexOf('-');
	if (separator < 1)
		throw new Error(`Invalid TheSportsDB edition key '${editionExternalKey}'`);
	return {
		leagueId: editionExternalKey.slice(0, separator),
		season: editionExternalKey.slice(separator + 1),
	};
}

export class TheSportsDbRugbyAdapter implements SportProviderAdapter {
	public readonly providerSlug = 'thesportsdb';
	public readonly sportSlug = 'rugby-union';

	private readonly apiKey: string;
	private readonly baseUrl: string;
	private readonly leagues: Record<string, string>;
	private readonly seasons: Record<string, string>;
	private readonly eventsCache = new Map<string, TheSportsDbEvent[]>();

	constructor(options: TheSportsDbRugbyAdapterOptions = {}) {
		this.apiKey = options.apiKey || process.env.THESPORTSDB_API_KEY || '123';
		this.baseUrl = (
			options.baseUrl ||
			process.env.THESPORTSDB_BASE_URL ||
			'https://www.thesportsdb.com/api/v1/json'
		).replace(/\/$/, '');
		this.leagues =
			options.leagues ||
			readJsonEnv('THESPORTSDB_RUGBY_LEAGUES', DEFAULT_LEAGUES);
		this.seasons =
			options.seasons ||
			readJsonEnv('THESPORTSDB_RUGBY_SEASONS', DEFAULT_SEASONS);
	}

	private async requestEvents(
		leagueId: string,
		season: string,
	): Promise<TheSportsDbEvent[]> {
		const cacheKey = `${leagueId}:${season}`;
		const cached = this.eventsCache.get(cacheKey);
		if (cached) return cached;
		const url = `${this.baseUrl}/${encodeURIComponent(this.apiKey)}/eventsseason.php?id=${encodeURIComponent(leagueId)}&s=${encodeURIComponent(season)}`;
		const payload = await withRetry(
			async () => {
				const response = await fetch(url);
				if (!response.ok)
					throw new Error(
						`TheSportsDB HTTP ${response.status}: ${response.statusText}`,
					);
				return (await response.json()) as {
					events?: TheSportsDbEvent[] | null;
				};
			},
			{ maxRetries: 2, initialDelayMs: 500 },
		);
		const events = Array.isArray(payload.events) ? payload.events : [];
		this.eventsCache.set(cacheKey, events);
		return events;
	}

	async fetchCompetitions(): Promise<CanonicalCompetitionDTO[]> {
		return Object.entries(this.leagues)
			.filter(([slug, id]) => Boolean(id && COMPETITION_META[slug]))
			.map(([slug, externalKey]) => ({
				externalKey,
				sportSlug: this.sportSlug,
				slug,
				...COMPETITION_META[slug],
				isActive: true,
			}));
	}

	async fetchEditions(
		competitionExternalKey: string,
	): Promise<CanonicalEditionDTO[]> {
		const season = this.seasons[competitionExternalKey];
		if (!season) return [];
		const events = await this.requestEvents(competitionExternalKey, season);
		const dates = events
			.map((event) => event.strTimestamp || event.dateEvent)
			.filter(Boolean)
			.sort();
		const startsAt = dates[0] ? new Date(dates[0]).toISOString() : undefined;
		const allFinished =
			events.length > 0 &&
			events.every(
				(event) => String(event.strStatus || '').toUpperCase() === 'FT',
			);
		const status = allFinished
			? 'completed'
			: startsAt && new Date(startsAt).getTime() > Date.now()
				? 'planned'
				: 'active';
		const competitionSlug = Object.entries(this.leagues).find(
			([, id]) => id === competitionExternalKey,
		)?.[0];
		const competitionName = competitionSlug
			? COMPETITION_META[competitionSlug]?.name
			: undefined;
		return [
			{
				externalKey: `${competitionExternalKey}-${season}`,
				competitionExternalKey,
				seasonKey: season,
				name: `${competitionName ?? 'Rugby'} · ${season}`,
				startsAt,
				endsAt: dates.at(-1)
					? new Date(dates.at(-1) as string).toISOString()
					: undefined,
				status,
				metadata: { source: 'TheSportsDB', freeTierEventLimit: 15 },
			},
		];
	}

	async fetchCompetitors(
		editionExternalKey: string,
	): Promise<CanonicalCompetitorDTO[]> {
		const { leagueId, season } = editionParts(editionExternalKey);
		const events = await this.requestEvents(leagueId, season);
		const teams = new Map<string, CanonicalCompetitorDTO>();
		for (const event of events) {
			if (event.idHomeTeam && event.strHomeTeam)
				teams.set(event.idHomeTeam, {
					externalKey: event.idHomeTeam,
					name: event.strHomeTeam,
					shortName: event.strHomeTeam.replace(/ Rugby$/i, ''),
					mediaUrl: event.strHomeTeamBadge,
					kind: 'team',
					isActive: true,
				});
			if (event.idAwayTeam && event.strAwayTeam)
				teams.set(event.idAwayTeam, {
					externalKey: event.idAwayTeam,
					name: event.strAwayTeam,
					shortName: event.strAwayTeam.replace(/ Rugby$/i, ''),
					mediaUrl: event.strAwayTeamBadge,
					kind: 'team',
					isActive: true,
				});
		}
		if (teams.size === 0)
			throw new Error(
				`TheSportsDB returned no Rugby competitors for '${editionExternalKey}'`,
			);
		return Array.from(teams.values());
	}

	async fetchEvents(options: FetchEventsOptions): Promise<CanonicalEventDTO[]> {
		const { leagueId, season } = editionParts(options.editionExternalKey);
		return this.transformEvents(
			await this.requestEvents(leagueId, options.seasonKey || season),
			options.editionExternalKey,
		);
	}

	async fetchLiveUpdates(options: {
		editionExternalKey: string;
		competitionExternalKey?: string;
		seasonKey?: string;
	}): Promise<CanonicalEventDTO[]> {
		// The free TheSportsDB tier has no live-score endpoint. Re-read the season
		// schedule so recently completed scores can still be reconciled safely.
		return this.fetchEvents(options);
	}

	public transformEvents(
		events: TheSportsDbEvent[],
		editionExternalKey: string,
	): CanonicalEventDTO[] {
		return events
			.filter(
				(event) =>
					event.idEvent &&
					event.idHomeTeam &&
					event.idAwayTeam &&
					event.strTimestamp,
			)
			.map((event) => {
				const rawStatus = String(event.strStatus || '').toUpperCase();
				const status =
					event.strPostponed === 'yes'
						? 'postponed'
						: normalizeEventStatus(
								rawStatus === 'FT' ? 'FT' : rawStatus || 'NS',
							);
				const kickoffTime = new Date(
					event.strTimestamp as string,
				).toISOString();
				const homeScore = score(event.intHomeScore);
				const awayScore = score(event.intAwayScore);
				const hasScores = homeScore !== null && awayScore !== null;
				let winnerRole: 'home' | 'away' | 'draw' | null = null;
				if (hasScores)
					winnerRole =
						homeScore! > awayScore!
							? 'home'
							: awayScore! > homeScore!
								? 'away'
								: 'draw';
				const resultStatus = deriveResultStatus(status, hasScores);
				return {
					externalKey: String(event.idEvent),
					editionExternalKey,
					roundName: event.intRound ? `Round ${event.intRound}` : 'Round 1',
					scheduledStartTime: kickoffTime,
					status,
					venue: event.strVenue || undefined,
					participants: [
						{
							competitorExternalKey: String(event.idHomeTeam),
							role: 'home',
							slotNumber: 1,
						},
						{
							competitorExternalKey: String(event.idAwayTeam),
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
								resultPayload: { homeScore, awayScore, winnerRole },
								revisionNumber: 1,
							}
						: undefined,
					metadata: {
						provider: 'thesportsdb',
						league: event.strLeague,
						country: event.strCountry,
						sourceStatus: event.strStatus,
					},
				};
			});
	}
}
