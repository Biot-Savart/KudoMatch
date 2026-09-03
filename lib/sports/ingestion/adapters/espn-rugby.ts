import { z } from 'zod';
import { FetchEventsOptions, ProviderCapabilities, SportProviderAdapter } from '../adapter';
import {
	CanonicalCompetitionDTO,
	CanonicalCompetitorDTO,
	CanonicalEditionDTO,
	CanonicalEventDTO,
	ProviderSourceMetadata,
} from '../dto';
import { deriveResultStatus, normalizeEventStatus } from '../normalize-status';

const idSchema = z.union([z.string().min(1), z.number().int().positive()]);
const competitorSchema = z.object({
	id: idSchema,
	homeAway: z.string().optional(),
	team: z.object({ id: idSchema, displayName: z.string().min(1) }).passthrough(),
}).passthrough();
const competitionSchema = z.object({
	id: idSchema,
	date: z.string().datetime({ offset: true }).optional(),
	competitors: z.array(competitorSchema).min(2),
	status: z.object({
		type: z.object({ id: z.string().optional(), name: z.string().optional(), state: z.string().optional(), completed: z.boolean().optional(), description: z.string().optional(), shortDetail: z.string().optional() }).passthrough(),
	}).passthrough(),
	venue: z.object({ fullName: z.string().optional() }).passthrough().optional(),
}).passthrough();
const eventSchema = z.object({
	id: idSchema,
	uid: z.string().optional(),
	date: z.string().datetime({ offset: true }),
	name: z.string().optional(),
	shortName: z.string().optional(),
	season: z.object({ year: z.number().int().optional() }).passthrough().optional(),
	competitions: z.array(competitionSchema).min(1),
}).passthrough();
const scoreboardSchema = z.object({
	events: z.array(eventSchema),
	leagues: z.array(z.record(z.unknown())).optional(),
	season: z.record(z.unknown()).optional(),
}).passthrough();

type JsonObject = Record<string, unknown>;

export interface EspnRugbyAdapterOptions {
	baseUrl?: string;
	recordedResponses?: Record<string, unknown>;
	fetcher?: typeof fetch;
	timeoutMs?: number;
}

export class EspnRugbyProviderError extends Error {
	readonly code: string;
	readonly status?: number;

	constructor(message: string, code = 'ESPN_PROVIDER_ERROR', status?: number) {
		super(message);
		this.name = 'EspnRugbyProviderError';
		this.code = code;
		this.status = status;
	}
}

const COMPETITIONS = {
	'currie-cup': { externalKey: '270555', name: 'Currie Cup', country: 'South Africa' },
	'urc': { externalKey: '270557', name: 'United Rugby Championship', country: 'Europe' },
} as const;

function object(value: unknown): JsonObject {
	return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function text(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringId(value: unknown): string | undefined {
	return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function metadata(rawPayload: unknown, fetchedAt = new Date().toISOString()): ProviderSourceMetadata {
	return { fetchedAt, schemaVersion: 1, rawPayload };
}

function competitionByKey(externalKey: string): (typeof COMPETITIONS)[keyof typeof COMPETITIONS] | undefined {
	return Object.values(COMPETITIONS).find((item) => item.externalKey === externalKey);
}

function eventStatus(raw: z.infer<typeof eventSchema>): CanonicalEventDTO['status'] {
	const type = raw.competitions[0]?.status.type ?? {};
	const value = (text(type.state) ?? text(type.name) ?? text(type.id) ?? '').toLowerCase();
	if (type.completed === true || value.includes('final') || value.includes('finished')) return 'finished';
	const aliases: Record<string, string> = {
		pre: 'NS', scheduled: 'NS', not_started: 'NS',
		in: 'LIVE', live: 'LIVE', in_progress: 'LIVE',
		post: 'POST', postponed: 'POST',
		canceled: 'CANC', cancelled: 'CANC',
		abandoned: 'ABD', suspended: 'ABD',
		final: 'FINAL', finished: 'FINAL', completed: 'FINAL',
	};
	return normalizeEventStatus(aliases[value] ?? value);
}

function score(competitor: z.infer<typeof competitorSchema>): number | null {
	const rawScore = (competitor as unknown as JsonObject).score;
	const value = typeof rawScore === 'number' || typeof rawScore === 'string' ? rawScore : object(rawScore).value;
	if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
	if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
	return null;
}

function teamName(competitor: z.infer<typeof competitorSchema>): string {
	return competitor.team.displayName;
}

export class EspnRugbyAdapter implements SportProviderAdapter {
	readonly providerSlug = 'espn';
	readonly sportSlug = 'rugby-union';
	readonly capabilities: ProviderCapabilities = {
		competitions: true,
		editions: true,
		teams: true,
		historicalFixtures: false,
		currentFixtures: true,
		liveUpdates: true,
		results: true,
		standings: false,
		rankings: false,
	};

	private readonly baseUrl: string;
	private readonly recordedResponses: Record<string, unknown>;
	private readonly fetcher: typeof fetch;
	private readonly timeoutMs: number;

	constructor(options: EspnRugbyAdapterOptions = {}) {
		this.baseUrl = (options.baseUrl ?? 'https://site.api.espn.com/apis/site/v2/sports/rugby').replace(/\/$/, '');
		this.recordedResponses = options.recordedResponses ?? {};
		this.fetcher = options.fetcher ?? globalThis.fetch;
		this.timeoutMs = Math.min(Math.max(options.timeoutMs ?? 20_000, 1_000), 20_000);
	}

	private async request(path: string): Promise<z.infer<typeof scoreboardSchema>> {
		const recorded = this.recordedResponses[path];
		if (recorded !== undefined) {
			const parsed = scoreboardSchema.safeParse(recorded);
			if (!parsed.success) throw new EspnRugbyProviderError(`Recorded ESPN response failed schema validation for ${path}`, 'SCHEMA_ERROR');
			return parsed.data;
		}

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			const response = await this.fetcher(`${this.baseUrl}${path}`, {
				headers: { accept: 'application/json', 'user-agent': 'KudoMatch/1.0 provider-health-check' },
				signal: controller.signal,
			});
			if (!response.ok) throw new EspnRugbyProviderError(`ESPN request failed (${response.status})`, 'HTTP_ERROR', response.status);
			let payload: unknown;
			try { payload = await response.json(); } catch { throw new EspnRugbyProviderError('ESPN returned malformed JSON', 'SCHEMA_ERROR', response.status); }
			const parsed = scoreboardSchema.safeParse(payload);
			if (!parsed.success) throw new EspnRugbyProviderError(`ESPN scoreboard failed schema validation for ${path}`, 'SCHEMA_ERROR', response.status);
			return parsed.data;
		} catch (error) {
			if (error instanceof EspnRugbyProviderError) throw error;
			if (error instanceof Error && error.name === 'AbortError') throw new EspnRugbyProviderError('ESPN request timed out', 'TIMEOUT');
			throw new EspnRugbyProviderError('ESPN request failed', 'NETWORK_ERROR');
		} finally {
			clearTimeout(timeout);
		}
	}

	async fetchCompetitions(): Promise<CanonicalCompetitionDTO[]> {
		const fetchedAt = new Date().toISOString();
		return Object.entries(COMPETITIONS).map(([slug, item]) => ({
			externalKey: item.externalKey,
			sportSlug: this.sportSlug,
			slug,
			name: item.name,
			kind: 'league' as const,
			country: item.country,
			isActive: true,
			sourceMetadata: metadata({ provider: this.providerSlug, competition: item.externalKey }, fetchedAt),
		}));
	}

	async fetchEditions(competitionExternalKey: string): Promise<CanonicalEditionDTO[]> {
		const competition = competitionByKey(competitionExternalKey);
		if (!competition) return [];
		const payload = await this.request(`/${competition.externalKey}/scoreboard`);
		const season = object(payload.season);
		const eventSeason = object(payload.events[0]?.season);
		const yearValue = season.year ?? eventSeason.year;
		const year = typeof yearValue === 'number' ? yearValue : Number(yearValue);
		if (!Number.isInteger(year) || year <= 0) return [];
		return [{
			externalKey: `${competition.externalKey}-${year}`,
			competitionExternalKey: competition.externalKey,
			seasonKey: String(year),
			name: `${competition.name} ${year}`,
			status: year >= new Date().getUTCFullYear() ? 'active' : 'completed',
			sourceMetadata: metadata(payload),
		}];
	}

	async fetchCompetitors(editionExternalKey: string, competitionExternalKey?: string): Promise<CanonicalCompetitorDTO[]> {
		const competitionKey = competitionExternalKey ?? editionExternalKey.split('-')[0];
		const payload = await this.request(`/${competitionKey}/scoreboard`);
		const seen = new Map<string, CanonicalCompetitorDTO>();
		for (const event of payload.events) {
			for (const competitor of event.competitions[0]?.competitors ?? []) {
				const id = stringId(competitor.team.id);
				if (!id || seen.has(id)) continue;
				seen.set(id, {
					externalKey: id,
					name: teamName(competitor),
					shortName: text(competitor.team.abbreviation ?? competitor.team.shortDisplayName),
					mediaUrl: text(competitor.team.logo),
					kind: 'team',
					isActive: true,
					sourceMetadata: metadata(competitor),
				});
			}
		}
		return Array.from(seen.values());
	}

	private transformEvent(raw: z.infer<typeof eventSchema>, editionExternalKey: string): CanonicalEventDTO {
		const competition = raw.competitions[0];
		const home = competition.competitors.find((item) => item.homeAway === 'home') ?? competition.competitors[0];
		const away = competition.competitors.find((item) => item.homeAway === 'away') ?? competition.competitors[1];
		if (!home || !away) throw new EspnRugbyProviderError(`ESPN event ${raw.id} is missing team identity`, 'SCHEMA_ERROR');
		const homeId = stringId(home.team.id);
		const awayId = stringId(away.team.id);
		if (!homeId || !awayId) throw new EspnRugbyProviderError(`ESPN event ${raw.id} is missing team identity`, 'SCHEMA_ERROR');
		const status = eventStatus(raw);
		const homeScore = score(home);
		const awayScore = score(away);
		const hasScores = homeScore !== null && awayScore !== null;
		const kickoff = new Date(raw.date).toISOString();
		return {
			externalKey: String(raw.id),
			editionExternalKey,
			roundName: text(object(raw.competitions[0]).notes) ?? text(object(raw.competitions[0]).type),
			scheduledStartTime: kickoff,
			status,
			venue: text(raw.competitions[0]?.venue?.fullName),
			participants: [
				{ competitorExternalKey: homeId, role: 'home', slotNumber: 1 },
				{ competitorExternalKey: awayId, role: 'away', slotNumber: 2 },
			],
			market: {
				marketKey: 'team_scoreline',
				status: status === 'cancelled' || status === 'abandoned' ? 'void' : status === 'finished' && hasScores ? 'settled' : 'open',
				lockAt: kickoff,
			},
			result: hasScores || status === 'cancelled' || status === 'abandoned' ? {
				status: deriveResultStatus(status, hasScores),
				resultPayload: {
					homeScore,
					awayScore,
					winnerRole: hasScores ? homeScore! > awayScore! ? 'home' : awayScore! > homeScore! ? 'away' : 'draw' : null,
				},
				revisionNumber: 1,
			} : undefined,
			sourceMetadata: metadata(raw),
		};
	}

	async fetchEvents(options: FetchEventsOptions): Promise<CanonicalEventDTO[]> {
		const competitionKey = options.competitionExternalKey ?? options.editionExternalKey.split('-')[0];
		const seasonKey = options.seasonKey ?? options.editionExternalKey.split('-')[1];
		const query = seasonKey ? `?dates=${encodeURIComponent(seasonKey)}` : '';
		const payload = await this.request(`/${competitionKey}/scoreboard${query}`);
		return payload.events.map((event) => this.transformEvent(event, options.editionExternalKey));
	}

	async fetchLiveUpdates(options: { editionExternalKey: string; competitionExternalKey?: string; seasonKey?: string }): Promise<CanonicalEventDTO[]> {
		return this.fetchEvents(options);
	}
}
