/** Provider provenance carried by server-side normalized DTOs. */
export interface ProviderSourceMetadata {
	fetchedAt: string;
	providerUpdatedAt?: string;
	schemaVersion: number;
	rawPayload: unknown;
}

/**
 * Canonical Sports Ingestion Data Transfer Objects (DTOs)
 * All external keys are strings, timestamps are ISO-8601 UTC strings,
 * and result statuses distinguish provisional vs final vs void.
 */

export type CanonicalEventStatus =
	| 'scheduled'
	| 'live'
	| 'finished'
	| 'postponed'
	| 'cancelled'
	| 'abandoned';

export type CanonicalResultStatus = 'provisional' | 'final' | 'void';

export interface CanonicalCompetitorDTO {
	externalKey: string;
	name: string;
	shortName?: string;
	countryCode?: string;
	mediaUrl?: string;
	kind?: 'team' | 'individual' | 'pair';
	isActive?: boolean;
	sourceMetadata?: ProviderSourceMetadata;
}

export interface CanonicalParticipantDTO {
	competitorExternalKey: string;
	role: 'home' | 'away' | 'competitor';
	slotNumber: number;
}

export interface CanonicalScorelinePayload {
	homeScore: number | null;
	awayScore: number | null;
	periodScores?: {
		home1H?: number | null;
		away1H?: number | null;
		home2H?: number | null;
		away2H?: number | null;
		homeOT?: number | null;
		awayOT?: number | null;
	};
	winnerRole?: 'home' | 'away' | 'draw' | null;
	[key: string]: unknown;
}

export interface CanonicalResultDTO {
	status: CanonicalResultStatus;
	resultPayload: CanonicalScorelinePayload;
	verifiedAt?: string | null;
	revisionNumber?: number;
	payloadSchemaVersion?: number;
}

/** Provider-neutral standings row produced after provider schema validation. */
export interface ProviderStandingDTO {
	externalCompetitorKey: string;
	stageKey?: string;
	position?: number | null;
	played?: number | null;
	won?: number | null;
	drawn?: number | null;
	lost?: number | null;
	pointsFor?: number | null;
	pointsAgainst?: number | null;
	pointsDifference?: number | null;
	bonusPoints?: number | null;
	tablePoints?: number | null;
	providerUpdatedAt?: string | null;
	rawPayload: unknown;
}

export interface CanonicalMarketDTO {
	marketKey: string;
	rulesetVersion?: number;
	marketSchemaVersion?: number;
	lockAt?: string;
	status: 'open' | 'locked' | 'settled' | 'void';
}

export interface CanonicalEventDTO {
	externalKey: string;
	editionExternalKey: string;
	roundName?: string;
	scheduledStartTime: string; // ISO 8601 UTC
	status: CanonicalEventStatus;
	venue?: string;
	participants: CanonicalParticipantDTO[];
	market?: CanonicalMarketDTO;
	result?: CanonicalResultDTO;
	metadata?: Record<string, unknown>;
	sourceMetadata?: ProviderSourceMetadata;
}

export interface CanonicalEditionDTO {
	externalKey: string;
	competitionExternalKey: string;
	seasonKey: string;
	name: string;
	startsAt?: string;
	endsAt?: string;
	status: 'planned' | 'active' | 'completed' | 'archived';
	metadata?: Record<string, unknown>;
	sourceMetadata?: ProviderSourceMetadata;
}

export interface CanonicalCompetitionDTO {
	externalKey: string;
	sportSlug: string;
	slug: string;
	name: string;
	kind: 'league' | 'cup' | 'tournament' | 'friendly';
	country?: string;
	logoUrl?: string;
	isActive?: boolean;
	sourceMetadata?: ProviderSourceMetadata;
}

export interface IngestionRunSummary {
	providerSlug: string;
	sportSlug: string;
	editionKey?: string;
	durationMs: number;
	fetchedCount: number;
	insertedCount: number;
	updatedCount: number;
	unchangedCount: number;
	quarantinedCount: number;
	failedCount: number;
	settledCount: number;
	retriesCount: number;
	requestCount?: number;
	schemaErrorCount?: number;
	rateLimitCount?: number;
	conflictCount?: number;
	errors: Array<{
		code: string;
		message: string;
		entityKey?: string;
	}>;
}

export interface IngestionBatchPayload {
	provider_slug: string;
	sport_slug: string;
	competitions?: Array<{
		external_key: string;
		slug: string;
		name: string;
		kind?: string;
		country?: string;
		logo_url?: string;
		is_active?: boolean;
	}>;
	editions?: Array<{
		external_key: string;
		competition_id?: number;
		competition_external_key?: string;
		season_key: string;
		name: string;
		starts_at?: string;
		ends_at?: string;
		status?: string;
		metadata?: Record<string, unknown>;
	}>;
	competitors?: Array<{
		external_key: string;
		name: string;
		short_name?: string;
		country_code?: string;
		media_url?: string;
		kind?: string;
		is_active?: boolean;
		edition_id?: number;
	}>;
	events?: Array<{
		external_key: string;
		edition_id?: number;
		edition_external_key?: string;
		round_name?: string;
		round_label?: string;
		scheduled_start_time?: string;
		starts_at?: string;
		status: CanonicalEventStatus;
		venue?: string;
		venue_name?: string;
		metadata?: Record<string, unknown>;
		participants?: Array<{
			competitor_id?: number;
			competitor_external_key?: string;
			role: string;
			slot_number?: number;
			slot?: number;
		}>;
		market?: {
			ruleset_id: number;
			market_key?: string;
			market_kind?: string;
			status?: string;
			lock_at?: string;
			locks_at?: string;
			opens_at?: string;
			market_schema_version?: number;
			payload_schema_version?: number;
		};
		result?: {
			status: CanonicalResultStatus;
			result_payload?: Record<string, unknown>;
			homeScore?: number | null;
			awayScore?: number | null;
			revision_number?: number;
			payload_schema_version?: number;
		};
	}>;
}
