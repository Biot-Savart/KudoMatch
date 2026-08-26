import {
	CanonicalCompetitionDTO,
	CanonicalCompetitorDTO,
	CanonicalEditionDTO,
	CanonicalEventDTO,
} from './dto';

export interface FetchEventsOptions {
	editionExternalKey: string;
	competitionExternalKey?: string;
	seasonKey?: string;
	fromDate?: string;
	toDate?: string;
	round?: string;
}

export interface SportProviderAdapter {
	readonly providerSlug: string;
	readonly sportSlug: string;

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

	/**
	 * Fetch active / live updates for in-progress or recently finished events
	 */
	fetchLiveUpdates(options: {
		editionExternalKey: string;
		competitionExternalKey?: string;
	}): Promise<CanonicalEventDTO[]>;
}
