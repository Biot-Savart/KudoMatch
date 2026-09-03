import { SupabaseClient } from '@supabase/supabase-js';
import { ProviderStandingDTO } from './dto';
import { ProviderSelectionService } from './provider-selection';

export interface StandingSyncOptions {
	supabase: SupabaseClient;
	competitionId: number;
	editionId: number;
	editionExternalKey: string;
	competitionExternalKey?: string;
	providerSlug?: string;
	now?: string;
}

export interface StandingSyncResult {
	status: 'success' | 'unavailable' | 'failed';
	providerSlug?: string;
	rowsFetched: number;
	rowsMapped: number;
	rowsUnmapped: number;
	canonicalRows: number;
	error?: string;
}

function errorMessage(value: unknown): string {
	return value instanceof Error ? value.message : String(value);
}

function nullableInteger(value: number | null | undefined): number | null {
	return value === undefined ? null : value;
}

/** Fetches one provider page, maps known competitors, and writes canonical standings. */
export async function syncCompetitionStandings(options: StandingSyncOptions): Promise<StandingSyncResult> {
	const service = new ProviderSelectionService(options.supabase);
	try {
		let excludedProviders: string[] | undefined;
		if (options.providerSlug) {
			const { data: settings, error: settingsError } = await options.supabase
				.from('competition_provider_settings')
				.select('provider_slug')
				.eq('competition_id', options.competitionId);
			if (settingsError) throw new Error(`Failed to load standings provider settings: ${settingsError.message}`);
			excludedProviders = (settings ?? [])
				.map((row) => String(row.provider_slug))
				.filter((slug) => slug !== options.providerSlug);
		}
		const selection = await service.select({
			competitionId: options.competitionId,
			operation: 'standings',
			now: options.now,
			excludedProviders,
		});
		if (!selection.decision) return { status: 'unavailable', rowsFetched: 0, rowsMapped: 0, rowsUnmapped: 0, canonicalRows: 0 };

		const providerSlug = options.providerSlug ?? selection.decision.providerSlug;
		const adapter = selection.decision.adapter;
		if (!adapter.fetchStandings) return { status: 'unavailable', providerSlug, rowsFetched: 0, rowsMapped: 0, rowsUnmapped: 0, canonicalRows: 0 };
		const providerRows = await adapter.fetchStandings({
			editionExternalKey: options.editionExternalKey,
			competitionExternalKey: options.competitionExternalKey,
		});

		const keys = Array.from(new Set(providerRows.map((row) => row.externalCompetitorKey)));
		const { data: mappings, error: mappingError } = await options.supabase
			.from('provider_catalog_sources')
			.select('external_key, competitor_id, mapping_status')
			.eq('provider_slug', providerSlug)
			.eq('entity_kind', 'competitor')
			.in('external_key', keys.length ? keys : ['__none__']);
		if (mappingError) throw new Error(`Failed to load standings mappings: ${mappingError.message}`);
		const mappingByKey = new Map((mappings ?? []).map((row) => [String(row.external_key), row]));
		const payloadRows = providerRows.map((row: ProviderStandingDTO) => {
			const mapping = mappingByKey.get(row.externalCompetitorKey);
			return {
				provider_competitor_key: row.externalCompetitorKey,
				competitor_id: mapping?.mapping_status === 'mapped' && mapping.competitor_id ? Number(mapping.competitor_id) : null,
				stage_key: row.stageKey ?? 'overall',
				position: nullableInteger(row.position),
				played: nullableInteger(row.played),
				won: nullableInteger(row.won),
				drawn: nullableInteger(row.drawn),
				lost: nullableInteger(row.lost),
				points_for: nullableInteger(row.pointsFor),
				points_against: nullableInteger(row.pointsAgainst),
				points_difference: nullableInteger(row.pointsDifference),
				bonus_points: nullableInteger(row.bonusPoints),
				table_points: nullableInteger(row.tablePoints),
				provider_updated_at: row.providerUpdatedAt ?? null,
				raw_payload: row.rawPayload,
			};
		});
		const { data, error } = await options.supabase.rpc('upsert_provider_standings', {
			p_payload: {
				provider_slug: providerSlug,
				edition_id: options.editionId,
				stage_key: 'overall',
				fetched_at: options.now ?? new Date().toISOString(),
				rows: payloadRows,
			},
		});
		if (error) throw new Error(`Failed to upsert standings: ${error.message}`);
		await service.reportSuccess(providerSlug, 0, options.now);
		const result = (data ?? {}) as Record<string, unknown>;
		return {
			status: 'success',
			providerSlug,
			rowsFetched: providerRows.length,
			rowsMapped: Number(result.mapped_count ?? payloadRows.filter((row) => row.competitor_id !== null).length),
			rowsUnmapped: Number(result.unmapped_count ?? payloadRows.filter((row) => row.competitor_id === null).length),
			canonicalRows: Number(result.canonical_count ?? 0),
		};
	} catch (error) {
		return { status: 'failed', rowsFetched: 0, rowsMapped: 0, rowsUnmapped: 0, canonicalRows: 0, error: errorMessage(error) };
	}
}
