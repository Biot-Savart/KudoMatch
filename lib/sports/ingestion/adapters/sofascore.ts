import { FetchEventsOptions, ProviderCapabilities, SportProviderAdapter } from '../adapter';
import {
	CanonicalCompetitionDTO,
	CanonicalCompetitorDTO,
	CanonicalEditionDTO,
	CanonicalEventDTO,
	ProviderSourceMetadata,
} from '../dto';
import { deriveResultStatus, normalizeEventStatus } from '../normalize-status';
import { z } from 'zod';

const providerId = z.union([z.string().min(1), z.number().int().positive()]);
const providerObject = z.record(z.unknown());
const scoreValue = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]);
const scoreSchema = z.union([
	scoreValue,
	z.object({ current: scoreValue.optional(), normaltime: scoreValue.optional() }).passthrough(),
]);
const sofaScoreSeasonSchema = z.object({ id: providerId }).passthrough();
const sofaScoreTeamSchema = z.object({ id: providerId, name: z.string().min(1) }).passthrough();
const sofaScoreEventSchema = z.object({ id: providerId }).passthrough();
const seasonsEnvelope = z.object({
	seasons: z.array(sofaScoreSeasonSchema),
}).passthrough();
const eventsEnvelope = z.object({
	events: z.array(sofaScoreEventSchema),
}).passthrough();
const teamsEnvelope = z.object({
	teams: z.array(sofaScoreTeamSchema),
}).passthrough();
const eventEnvelope = z.object({
	event: sofaScoreEventSchema,
}).passthrough();

type JsonObject = Record<string, unknown>;

export interface SofaScoreProviderOptions {
	/** Internal gateway URL; never exposed to browser code. */
	gatewayUrl?: string;
	/** Internal gateway key; never placed in DTOs or logs. */
	internalApiKey?: string;
	/** Injected only for deterministic tests/recorded pilot runs. */
	recordedResponses?: Record<string, unknown>;
	fetcher?: typeof fetch;
	timeoutMs?: number;
}

export class SofaScoreProviderError extends Error {
	public readonly code: string;
	public readonly status?: number;

	constructor(message: string, code = 'SOFASCORE_PROVIDER_ERROR', status?: number) {
		super(message);
		this.name = 'SofaScoreProviderError';
		this.code = code;
		this.status = status;
	}
}

const PILOTS = {
	'currie-cup': {
		externalKey: '796',
		name: 'Currie Cup',
		kind: 'league' as const,
		country: 'South Africa',
		currentSeasonId: '97057',
	},
	'urc': {
		externalKey: '419',
		name: 'United Rugby Championship',
		kind: 'league' as const,
		country: 'Europe',
		currentSeasonId: '98406',
	},
} as const;

const SOFASCORE_IMAGE_BASE_URL = 'https://img.sofascore.com/api/v1';

function imageUrl(resource: 'team' | 'unique-tournament', externalKey: string): string {
	return `${SOFASCORE_IMAGE_BASE_URL}/${resource}/${encodeURIComponent(externalKey)}/image`;
}

function object(value: unknown): JsonObject {
	return value && typeof value === 'object' && !Array.isArray(value)
		? value as JsonObject
		: {};
}

function text(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function id(value: unknown): string | undefined {
	return typeof value === 'string' || typeof value === 'number'
		? String(value)
		: undefined;
}

function number(value: unknown): number | null {
	if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
	if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
	return null;
}

function metadata(rawPayload: unknown, fetchedAt = new Date().toISOString()): ProviderSourceMetadata {
	return { fetchedAt, schemaVersion: 1, rawPayload };
}

function competitionForKey(externalKey: string): (typeof PILOTS)[keyof typeof PILOTS] | undefined {
	return Object.values(PILOTS).find((pilot) => pilot.externalKey === externalKey);
}

function statusForEvent(rawEvent: JsonObject): CanonicalEventDTO['status'] {
	const rawStatus = object(rawEvent.status);
	const raw = String(
		rawStatus.type ?? rawStatus.code ?? rawStatus.name ?? rawEvent.statusType ?? '',
	).trim().toLowerCase();
	const aliases: Record<string, string> = {
		notstarted: 'NS',
		timed: 'NS',
		scheduled: 'NS',
		inprogress: 'LIVE',
		'in_progress': 'LIVE',
		live: 'LIVE',
		paused: 'PAUSED',
		finished: 'FT',
		ended: 'FT',
		final: 'FINAL',
		postponed: 'POSTPONED',
		canceled: 'CANCELLED',
		cancelled: 'CANCELLED',
		abandoned: 'ABANDONED',
	};
	return normalizeEventStatus(aliases[raw] ?? raw);
}

function teamFromEvent(rawEvent: JsonObject, side: 'home' | 'away'): JsonObject {
	const nested = object(rawEvent[`${side}Team`]);
	const teamId = id(nested.id ?? rawEvent[`${side}TeamId`]);
	const teamName = text(nested.name ?? rawEvent[`${side}TeamName`]);
	if (!teamId || !teamName) {
		throw new SofaScoreProviderError(
			`SofaScore event is missing its ${side} team identity`,
			'SCHEMA_ERROR',
		);
	}
	return {
		externalKey: teamId,
		name: teamName,
		shortName: text(nested.shortName ?? nested.nameCode),
		mediaUrl: text(nested.logo) ?? imageUrl('team', teamId),
	};
}

function eventTimestamp(rawEvent: JsonObject): string {
	const timestamp = number(rawEvent.startTimestamp);
	if (timestamp !== null) return new Date(timestamp * 1000).toISOString();
	const startTime = text(rawEvent.startTime ?? rawEvent.scheduledStartTime);
	if (startTime && !Number.isNaN(Date.parse(startTime))) return new Date(startTime).toISOString();
	throw new SofaScoreProviderError('SofaScore event is missing a valid start time', 'SCHEMA_ERROR');
}

function scoreForEvent(rawEvent: JsonObject, side: 'home' | 'away'): number | null {
	const nested = rawEvent[`${side}Score`];
	if (typeof nested === 'number' || typeof nested === 'string') return number(nested);
	const scoreObject = object(nested);
	return number(
		scoreObject.current ?? scoreObject.normaltime ?? rawEvent[`${side}ScoreCurrent`] ?? rawEvent[`${side}ScoreNormaltime`],
	);
}

function roundName(rawEvent: JsonObject): string | undefined {
	const roundInfo = object(rawEvent.roundInfo);
	return text(roundInfo.name ?? roundInfo.round ?? rawEvent.round);
}

function venueName(rawEvent: JsonObject): string | undefined {
	return text(object(rawEvent.venue).name ?? rawEvent.venueName ?? rawEvent.venue);
}

export class SofaScoreProvider implements SportProviderAdapter {
	public readonly providerSlug = 'sofascore';
	public readonly sportSlug = 'rugby-union';
	public readonly capabilities: ProviderCapabilities = {
		competitions: true,
		editions: true,
		teams: true,
		historicalFixtures: false,
		currentFixtures: true,
		liveUpdates: true,
		results: true,
		// Canonical standings integration is owned by Phase 7.
		standings: false,
		rankings: false,
	};

	private readonly gatewayUrl: string;
	private readonly internalApiKey?: string;
	private readonly recordedResponses: Record<string, unknown>;
	private readonly fetcher: typeof fetch;
	private readonly timeoutMs: number;

	constructor(options: SofaScoreProviderOptions = {}) {
		this.gatewayUrl = (options.gatewayUrl ?? process.env.SOFASCORE_GATEWAY_URL ?? '').replace(/\/$/, '');
		this.internalApiKey = options.internalApiKey ?? process.env.SOFASCORE_GATEWAY_API_KEY;
		this.recordedResponses = options.recordedResponses ?? {};
		this.fetcher = options.fetcher ?? globalThis.fetch;
		this.timeoutMs = Math.min(Math.max(options.timeoutMs ?? 20_000, 1_000), 20_000);
	}

	private async request<T>(
		path: string,
		schema: z.ZodType<T>,
	): Promise<T> {
		const recorded = this.recordedResponses[path];
		if (recorded !== undefined) {
			const parsed = schema.safeParse(recorded);
			if (!parsed.success) throw new SofaScoreProviderError(`Recorded SofaScore response failed schema validation for ${path}`, 'SCHEMA_ERROR');
			return parsed.data;
		}
		if (!this.gatewayUrl) throw new SofaScoreProviderError('SOFASCORE_GATEWAY_URL is not configured', 'GATEWAY_NOT_CONFIGURED');
		if (!this.internalApiKey) throw new SofaScoreProviderError('SOFASCORE_GATEWAY_API_KEY is not configured', 'GATEWAY_NOT_CONFIGURED');

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			const response = await this.fetcher(`${this.gatewayUrl}${path}`, {
				headers: {
					accept: 'application/json',
					'x-internal-api-key': this.internalApiKey,
				},
				signal: controller.signal,
			});
			if (!response.ok) {
				throw new SofaScoreProviderError(`SofaScore gateway request failed (${response.status})`, 'GATEWAY_REQUEST_FAILED', response.status);
			}
			let payload: unknown;
			try {
				payload = await response.json();
			} catch {
				throw new SofaScoreProviderError('SofaScore gateway returned malformed JSON', 'SCHEMA_ERROR', response.status);
			}
			if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
				const errorPayload = payload as JsonObject;
				if (errorPayload.error !== undefined || errorPayload.errors !== undefined) {
					throw new SofaScoreProviderError('SofaScore gateway returned a provider error payload', 'PROVIDER_ERROR', response.status);
				}
			}
			const parsed = schema.safeParse(payload);
			if (!parsed.success) throw new SofaScoreProviderError(`SofaScore gateway response failed schema validation for ${path}`, 'SCHEMA_ERROR', response.status);
			return parsed.data;
		} catch (error) {
			if (error instanceof SofaScoreProviderError) throw error;
			if (error instanceof Error && error.name === 'AbortError') throw new SofaScoreProviderError('SofaScore gateway request timed out', 'TIMEOUT');
			throw new SofaScoreProviderError('SofaScore gateway request failed', 'NETWORK_ERROR');
		} finally {
			clearTimeout(timeout);
		}
	}

	async fetchCompetitions(): Promise<CanonicalCompetitionDTO[]> {
		const fetchedAt = new Date().toISOString();
		return Object.entries(PILOTS).map(([slug, pilot]) => ({
			externalKey: pilot.externalKey,
			sportSlug: this.sportSlug,
			slug: slug === 'urc' ? 'united-rugby-championship' : slug,
			name: pilot.name,
			kind: pilot.kind,
			country: pilot.country,
			logoUrl: imageUrl('unique-tournament', pilot.externalKey),
			isActive: true,
			sourceMetadata: metadata({ provider: this.providerSlug, uniqueTournamentId: pilot.externalKey }, fetchedAt),
		}));
	}

	async fetchEditions(competitionExternalKey: string): Promise<CanonicalEditionDTO[]> {
		const pilot = competitionForKey(competitionExternalKey);
		if (!pilot) return [];
		const payload = await this.request(`/v1/tournaments/${competitionExternalKey}/seasons`, seasonsEnvelope);
		const fetchedAt = new Date().toISOString();
		return payload.seasons.flatMap((rawSeason) => {
			const seasonId = id(rawSeason.id);
			if (!seasonId) return [];
			const seasonName = text(rawSeason.name) ?? `${pilot.name} ${text(rawSeason.year) ?? seasonId}`;
			const year = Number(text(rawSeason.year));
			const status: CanonicalEditionDTO['status'] = seasonId === pilot.currentSeasonId || rawSeason.isCurrent === true
				? 'active'
				: Number.isFinite(year) && year > new Date().getUTCFullYear() ? 'planned' : 'completed';
			return [{
				externalKey: `${competitionExternalKey}-${seasonId}`,
				competitionExternalKey,
				seasonKey: seasonId,
				name: seasonName,
				status,
				sourceMetadata: metadata(rawSeason, fetchedAt),
			}];
		});
	}

	async fetchCompetitors(
		editionExternalKey: string,
		competitionExternalKey?: string,
	): Promise<CanonicalCompetitorDTO[]> {
		const [competitionKey, seasonKey] = editionExternalKey.split('-');
		const tournamentKey = competitionExternalKey ?? competitionKey;
		if (!tournamentKey || !seasonKey) throw new SofaScoreProviderError(`Invalid SofaScore edition key '${editionExternalKey}'`, 'INVALID_EDITION_KEY');
		const payload = await this.request(`/v1/tournaments/${tournamentKey}/seasons/${seasonKey}/teams`, teamsEnvelope);
		const fetchedAt = new Date().toISOString();
		return payload.teams.flatMap((rawTeam) => {
			const teamId = id(rawTeam.id);
			const teamName = text(rawTeam.name);
			if (!teamId || !teamName) return [];
			const country = object(rawTeam.country);
			return [{
				externalKey: teamId,
				name: teamName,
				shortName: text(rawTeam.shortName ?? rawTeam.nameCode),
				countryCode: text(country.alpha2 ?? country.code),
				mediaUrl: text(rawTeam.logo) ?? imageUrl('team', teamId),
				kind: 'team' as const,
				isActive: true,
				sourceMetadata: metadata(rawTeam, fetchedAt),
			}];
		});
	}

	private transformEvent(rawEvent: JsonObject, editionExternalKey: string): CanonicalEventDTO {
		const eventId = id(rawEvent.id ?? rawEvent.eventId);
		if (!eventId) throw new SofaScoreProviderError('SofaScore event is missing its provider ID', 'SCHEMA_ERROR');
		const status = statusForEvent(rawEvent);
		const home = teamFromEvent(rawEvent, 'home');
		const away = teamFromEvent(rawEvent, 'away');
		const homeScore = scoreForEvent(rawEvent, 'home');
		const awayScore = scoreForEvent(rawEvent, 'away');
		const hasHomeScore = homeScore !== null;
		const hasAwayScore = awayScore !== null;
		if (hasHomeScore !== hasAwayScore) throw new SofaScoreProviderError(`SofaScore event ${eventId} contains only one score`, 'SCHEMA_ERROR');
		const hasScores = hasHomeScore && hasAwayScore;
		const winnerRole = hasScores
			? homeScore! > awayScore! ? 'home' : awayScore! > homeScore! ? 'away' : 'draw'
			: null;
		const kickoff = eventTimestamp(rawEvent);
		return {
			externalKey: eventId,
			editionExternalKey,
			roundName: roundName(rawEvent),
			scheduledStartTime: kickoff,
			status,
			venue: venueName(rawEvent),
			participants: [
				{ competitorExternalKey: home.externalKey as string, role: 'home', slotNumber: 1 },
				{ competitorExternalKey: away.externalKey as string, role: 'away', slotNumber: 2 },
			],
			market: {
				marketKey: 'team_scoreline',
				status: status === 'finished' && hasScores ? 'settled' : status === 'cancelled' || status === 'abandoned' ? 'void' : 'open',
				lockAt: kickoff,
			},
			result: hasScores ? {
				status: deriveResultStatus(status, true),
				resultPayload: { homeScore, awayScore, winnerRole },
				revisionNumber: 1,
			} : undefined,
			sourceMetadata: metadata(rawEvent),
		};
	}

	private async fetchEventPage(
		tournamentKey: string,
		seasonKey: string,
		direction: 'next' | 'last',
	): Promise<CanonicalEventDTO[]> {
		const payload = await this.request(`/v1/tournaments/${tournamentKey}/seasons/${seasonKey}/events/${direction}/0`, eventsEnvelope);
		const editionExternalKey = `${tournamentKey}-${seasonKey}`;
		return payload.events.map((rawEvent) => this.transformEvent(rawEvent, editionExternalKey));
	}

	async fetchEvents(options: FetchEventsOptions): Promise<CanonicalEventDTO[]> {
		const [tournamentKey, seasonFromEdition] = options.editionExternalKey.split('-');
		const seasonKey = options.seasonKey ?? seasonFromEdition;
		if (!tournamentKey || !seasonKey) throw new SofaScoreProviderError(`Invalid SofaScore edition key '${options.editionExternalKey}'`, 'INVALID_EDITION_KEY');
		const pages = await Promise.all([
			this.fetchEventPage(tournamentKey, seasonKey, 'next'),
			this.fetchEventPage(tournamentKey, seasonKey, 'last'),
		]);
		const unique = new Map<string, CanonicalEventDTO>();
		for (const event of pages.flat()) unique.set(event.externalKey, { ...event, editionExternalKey: options.editionExternalKey });
		return Array.from(unique.values());
	}

	async fetchLiveUpdates(options: {
		editionExternalKey: string;
		competitionExternalKey?: string;
		seasonKey?: string;
	}): Promise<CanonicalEventDTO[]> {
		const [tournamentKey, seasonFromEdition] = options.editionExternalKey.split('-');
		const seasonKey = options.seasonKey ?? seasonFromEdition;
		if (!tournamentKey || !seasonKey) throw new SofaScoreProviderError(`Invalid SofaScore edition key '${options.editionExternalKey}'`, 'INVALID_EDITION_KEY');
		const events = await this.fetchEventPage(tournamentKey, seasonKey, 'last');
		return events.map((event) => ({ ...event, editionExternalKey: options.editionExternalKey }));
	}

	async fetchEvent(externalKey: string): Promise<CanonicalEventDTO | null> {
		const payload = await this.request(`/v1/events/${encodeURIComponent(externalKey)}`, eventEnvelope);
		const rawEvent = payload.event;
		const tournament = object(rawEvent.tournament);
		const tournamentKey = id(tournament.uniqueTournamentId ?? rawEvent.uniqueTournamentId ?? rawEvent.tournamentId) ?? 'unknown';
		const seasonKey = id(object(rawEvent.season).id ?? rawEvent.seasonId) ?? 'unknown';
		return this.transformEvent(rawEvent, `${tournamentKey}-${seasonKey}`);
	}
}

// Exported for contract tests without exposing raw provider types to clients.
export const sofascoreGatewaySchemas = {
	sofaScoreSeasonSchema,
	sofaScoreTeamSchema,
	sofaScoreEventSchema,
	scoreSchema,
	seasonsEnvelope,
	eventsEnvelope,
	teamsEnvelope,
	eventEnvelope,
};
