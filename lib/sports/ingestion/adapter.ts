import {
	CanonicalCompetitionDTO,
	CanonicalCompetitorDTO,
	CanonicalEditionDTO,
	CanonicalEventDTO,
	ProviderStandingDTO,
	ProviderSourceMetadata,
} from './dto';

export interface ProviderCapabilities {
	competitions: boolean;
	editions: boolean;
	teams: boolean;
	historicalFixtures: boolean;
	currentFixtures: boolean;
	liveUpdates: boolean;
	results: boolean;
	standings: boolean;
	rankings: boolean;
}

export interface FetchEventsOptions {
	editionExternalKey: string;
	competitionExternalKey?: string;
	seasonKey?: string;
	fromDate?: string;
	toDate?: string;
	round?: string;
	/** Provider-native page when the adapter exposes resumable pagination. */
	page?: number;
}

/** Provider-neutral page metadata used by bounded historical backfills. */
export interface ProviderEventPage {
	items: CanonicalEventDTO[];
	page: number;
	totalPages?: number;
	nextCursor?: Record<string, unknown>;
	hasMore: boolean;
	validationErrors?: Array<{
		externalKey?: string;
		rawPayload: unknown;
		reason: string;
	}>;
}

export interface SportProviderAdapter {
	readonly providerSlug: string;
	readonly sportSlug: string;
	/** Declared capabilities are required on production adapters. Optional here keeps legacy test doubles source-compatible. */
	readonly capabilities?: ProviderCapabilities;

	/**
	 * Discover competitions provided by this source
	 */
	fetchCompetitions(): Promise<CanonicalCompetitionDTO[]>;

	/**
	 * Fetch seasons/editions for a competition
	 */
	fetchEditions(competitionExternalKey: string): Promise<CanonicalEditionDTO[]>;

	/**
	 * Fetch competitors/teams participating in an edition
	 */
	fetchCompetitors(
		editionExternalKey: string,
		competitionExternalKey?: string,
	): Promise<CanonicalCompetitorDTO[]>;

	/**
	 * Fetch scheduled, live, or past events
	 */
	fetchEvents(options: FetchEventsOptions): Promise<CanonicalEventDTO[]>;

	/** Optional provider-native page fetch. Backfills must not invent cursors. */
	fetchEventsPage?(options: FetchEventsOptions): Promise<ProviderEventPage>;

	/**
	 * Fetch active / live updates for in-progress or recently finished events
	 */
	fetchLiveUpdates(options: {
		editionExternalKey: string;
		competitionExternalKey?: string;
		seasonKey?: string;
	}): Promise<CanonicalEventDTO[]>;

	/** Optional single-event fetch for providers that support it. */
	fetchEvent?(externalKey: string): Promise<CanonicalEventDTO | null>;

	/** Optional standings fetch; Phase 3 only defines the contract. */
	fetchStandings?(options: {
		editionExternalKey: string;
		competitionExternalKey?: string;
	}): Promise<ProviderStandingDTO[]>;
}

export type ProviderSourceEnvelope<T> = T & {
	sourceMetadata?: ProviderSourceMetadata;
};
