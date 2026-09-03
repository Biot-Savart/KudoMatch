import { createHash } from 'node:crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { SportProviderAdapter } from './adapter';
import {
	CanonicalCompetitionDTO,
	CanonicalCompetitorDTO,
	CanonicalEditionDTO,
	CanonicalEventDTO,
	ProviderSourceMetadata,
} from './dto';
import {
	canonicalCompetitionSchema,
	canonicalCompetitorSchema,
	canonicalEditionSchema,
	canonicalEventSchema,
} from './provider-schemas';

export type ProviderCatalogEntityKind = 'competition' | 'edition' | 'competitor';

export interface ProviderCatalogSourceInput {
	entity_kind: ProviderCatalogEntityKind;
	external_key: string;
	display_name: string;
	normalized_name: string;
	short_name?: string;
	country_code?: string;
	media_url?: string;
	is_active?: boolean;
	raw_payload: unknown;
	payload_fingerprint: string;
	provider_updated_at?: string;
}

export interface ProviderEventSourceInput {
	provider_event_key: string;
	provider_competition_key?: string;
	provider_edition_key: string;
	provider_home_competitor_key?: string;
	provider_away_competitor_key?: string;
	normalized_kickoff_at: string;
	normalized_status: CanonicalEventDTO['status'];
	round_name?: string;
	venue_name?: string;
	home_score?: number | null;
	away_score?: number | null;
	raw_payload: unknown;
	payload_fingerprint: string;
	provider_updated_at?: string;
}

export interface ProviderSourceLedgerBatch {
	provider_slug: string;
	sport_slug: string;
	fetched_at: string;
	observe_only: boolean;
	correlation_id?: string;
	catalog_sources: ProviderCatalogSourceInput[];
	event_sources: ProviderEventSourceInput[];
}

export interface ProviderSourceBatchResult {
	success: boolean;
	observe_only: boolean;
	catalog_sources_upserted: number;
	event_sources_upserted: number;
	mapped_event_sources: number;
	ambiguous_event_sources: number;
	unresolved_event_sources: number;
	created_events: number;
	error?: string;
}

const SENSITIVE_KEY = /(authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|cookie|credential)/i;
const SENSITIVE_VALUE = /^(bearer\s+|sk-[a-z0-9]|eyJ[a-z0-9_-]+\.)/i;

/** Recursively redact credentials before a payload can enter the source ledger. */
export function sanitizeProviderPayload(payload: unknown): unknown {
	if (Array.isArray(payload)) return payload.map(sanitizeProviderPayload);
	if (payload && typeof payload === 'object') {
		return Object.fromEntries(
			Object.entries(payload).map(([key, value]) => [
				key,
				SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitizeProviderPayload(value),
			]),
		);
	}
	if (typeof payload === 'string' && SENSITIVE_VALUE.test(payload)) return '[REDACTED]';
	return payload;
}

function fingerprint(payload: unknown): string {
	return createHash('sha256')
		.update(JSON.stringify(sanitizeProviderPayload(payload)))
		.digest('hex');
}

export function withProviderSourceMetadata<T extends { sourceMetadata?: ProviderSourceMetadata }>(
	dto: T,
	providerSlug: string,
	fetchedAt = new Date().toISOString(),
): ProviderSourceMetadata {
	if (dto.sourceMetadata) return {
		...dto.sourceMetadata,
		rawPayload: sanitizeProviderPayload(dto.sourceMetadata.rawPayload),
	};
	const rawPayload = { ...dto, sourceMetadata: undefined, provider: providerSlug };
	return {
		fetchedAt,
		schemaVersion: 1,
		rawPayload: sanitizeProviderPayload(rawPayload),
	};
}

function normalizedName(value: string): string {
	return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function catalogSource(
	entityKind: ProviderCatalogEntityKind,
	dto: CanonicalCompetitionDTO | CanonicalEditionDTO | CanonicalCompetitorDTO,
	providerSlug: string,
	): ProviderCatalogSourceInput {
	const metadata = withProviderSourceMetadata(dto, providerSlug);
	const isCompetition = entityKind === 'competition';
	const isCompetitor = entityKind === 'competitor';
	const shortName = isCompetitor ? (dto as CanonicalCompetitorDTO).shortName : undefined;
	const countryCode = isCompetition
		? (dto as CanonicalCompetitionDTO).country
		: isCompetitor
			? (dto as CanonicalCompetitorDTO).countryCode
			: undefined;
	const mediaUrl = isCompetition
		? (dto as CanonicalCompetitionDTO).logoUrl
		: isCompetitor
			? (dto as CanonicalCompetitorDTO).mediaUrl
			: undefined;
	return {
		entity_kind: entityKind,
		external_key: dto.externalKey,
		display_name: dto.name,
		normalized_name: normalizedName(dto.name),
		short_name: shortName,
		country_code: countryCode,
		media_url: mediaUrl,
		is_active: 'isActive' in dto ? dto.isActive : true,
		raw_payload: metadata.rawPayload,
		payload_fingerprint: fingerprint(metadata.rawPayload),
		provider_updated_at: metadata.providerUpdatedAt,
	};
}

export function buildProviderSourceLedgerBatch(options: {
	adapter: SportProviderAdapter;
	competitionExternalKey?: string;
	competitions?: CanonicalCompetitionDTO[];
	editions?: CanonicalEditionDTO[];
	competitors?: CanonicalCompetitorDTO[];
	events: CanonicalEventDTO[];
	observeOnly?: boolean;
	correlationId?: string;
}): ProviderSourceLedgerBatch {
	const { adapter } = options;
	return {
		provider_slug: adapter.providerSlug,
		sport_slug: adapter.sportSlug,
		fetched_at: new Date().toISOString(),
		observe_only: options.observeOnly ?? true,
		correlation_id: options.correlationId,
		catalog_sources: [
			...(options.competitions ?? []).map((dto) => catalogSource('competition', dto, adapter.providerSlug)),
			...(options.editions ?? []).map((dto) => catalogSource('edition', dto, adapter.providerSlug)),
			...(options.competitors ?? []).map((dto) => catalogSource('competitor', dto, adapter.providerSlug)),
		],
			event_sources: options.events.map((event) => {
			const home = event.participants.find((participant) => participant.role === 'home');
			const away = event.participants.find((participant) => participant.role === 'away');
			const metadata = withProviderSourceMetadata(event, adapter.providerSlug);
			const result = event.result?.resultPayload;
			return {
				provider_event_key: event.externalKey,
				provider_competition_key: options.competitionExternalKey,
				provider_edition_key: event.editionExternalKey,
				provider_home_competitor_key: home?.competitorExternalKey,
				provider_away_competitor_key: away?.competitorExternalKey,
				normalized_kickoff_at: new Date(event.scheduledStartTime).toISOString(),
				normalized_status: event.status,
				round_name: event.roundName,
				venue_name: event.venue,
				home_score: result?.homeScore,
				away_score: result?.awayScore,
				raw_payload: metadata.rawPayload,
				payload_fingerprint: fingerprint(metadata.rawPayload),
				provider_updated_at: metadata.providerUpdatedAt,
			};
		}),
	};
}

export async function applyProviderSourceBatch(
	supabase: SupabaseClient,
	batch: ProviderSourceLedgerBatch,
): Promise<ProviderSourceBatchResult> {
	const { data, error } = await supabase.rpc('apply_provider_source_batch', {
		p_batch: batch as unknown as Record<string, unknown>,
	});
	if (error) {
		return {
			success: false,
			observe_only: batch.observe_only,
			catalog_sources_upserted: 0,
			event_sources_upserted: 0,
			mapped_event_sources: 0,
			ambiguous_event_sources: 0,
			unresolved_event_sources: 0,
			created_events: 0,
			error: error.message,
		};
	}
	const result = (data ?? {}) as Record<string, unknown>;
	return {
		success: Boolean(result.success ?? true),
		observe_only: Boolean(result.observe_only ?? batch.observe_only),
		catalog_sources_upserted: Number(result.catalog_sources_upserted ?? 0),
		event_sources_upserted: Number(result.event_sources_upserted ?? 0),
		mapped_event_sources: Number(result.mapped_event_sources ?? 0),
		ambiguous_event_sources: Number(result.ambiguous_event_sources ?? 0),
		unresolved_event_sources: Number(result.unresolved_event_sources ?? 0),
		created_events: Number(result.created_events ?? 0),
	};
}

export interface ReconciliationCandidate {
	id: number;
	editionId: number;
	homeCompetitorId: number;
	awayCompetitorId: number;
	startsAt: string;
}

/** Deterministic inclusive ±12-hour event matching used by the SQL implementation. */
export function findReconciliationCandidates(
	candidates: ReconciliationCandidate[],
	incoming: Pick<ReconciliationCandidate, 'editionId' | 'homeCompetitorId' | 'awayCompetitorId' | 'startsAt'>,
	toleranceHours = 12,
): ReconciliationCandidate[] {
	const incomingTime = Date.parse(incoming.startsAt);
	const toleranceMs = toleranceHours * 60 * 60 * 1000;
	return candidates.filter((candidate) =>
		candidate.editionId === incoming.editionId &&
		candidate.homeCompetitorId === incoming.homeCompetitorId &&
		candidate.awayCompetitorId === incoming.awayCompetitorId &&
		Math.abs(Date.parse(candidate.startsAt) - incomingTime) <= toleranceMs,
	);
}

export const providerSchemaValidators = {
	competition: canonicalCompetitionSchema,
	edition: canonicalEditionSchema,
	competitor: canonicalCompetitorSchema,
	event: canonicalEventSchema,
};
