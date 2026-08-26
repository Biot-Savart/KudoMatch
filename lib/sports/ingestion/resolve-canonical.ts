import { SupabaseClient } from '@supabase/supabase-js';

export interface CanonicalResolutionContext {
	providerSlug: string;
	sportSlug: string;
	competitionExternalKey?: string;
	editionExternalKey?: string;
}

export interface ResolvedEntity {
	canonicalId: number;
	externalKey: string;
	entityKind: 'competition' | 'edition' | 'competitor' | 'event';
}

/**
 * Resolves an external entity key to its canonical ID using public.external_entity_refs
 */
export async function resolveExternalRef(
	supabase: SupabaseClient,
	providerSlug: string,
	entityKind: 'competition' | 'edition' | 'competitor' | 'event',
	externalKey: string,
): Promise<number | null> {
	const { data, error } = await supabase
		.from('external_entity_refs')
		.select('competition_id, edition_id, competitor_id, event_id, target_id')
		.eq('provider_slug', providerSlug)
		.eq('entity_kind', entityKind)
		.eq('external_key', String(externalKey))
		.maybeSingle();

	if (error) {
		console.error(
			`Error resolving external ref for ${entityKind} ${externalKey}:`,
			error,
		);
		return null;
	}

	if (!data) return null;

	if (data.target_id) return Number(data.target_id);

	switch (entityKind) {
		case 'competition':
			return data.competition_id ? Number(data.competition_id) : null;
		case 'edition':
			return data.edition_id ? Number(data.edition_id) : null;
		case 'competitor':
			return data.competitor_id ? Number(data.competitor_id) : null;
		case 'event':
			return data.event_id ? Number(data.event_id) : null;
		default:
			return null;
	}
}

/**
 * Quarantines an unresolvable or malformed payload record
 */
export async function quarantineRecord(
	supabase: SupabaseClient,
	options: {
		providerSlug: string;
		entityKind:
			| 'competition'
			| 'edition'
			| 'competitor'
			| 'event'
			| 'result'
			| 'unknown';
		externalKey?: string;
		reasonCode: string;
		errorSummary: string;
		payloadFingerprint?: string;
	},
): Promise<void> {
	try {
		const { error } = await supabase.from('ingestion_quarantine').insert({
			provider_slug: options.providerSlug,
			entity_kind: options.entityKind,
			external_key: options.externalKey ? String(options.externalKey) : null,
			reason_code: options.reasonCode,
			error_summary: options.errorSummary,
			payload_fingerprint: options.payloadFingerprint,
			occurrence_count: 1,
			status: 'unresolved',
		});

		if (error) {
			console.warn(
				'Failed to insert into ingestion_quarantine:',
				error.message,
			);
		}
	} catch (err) {
		console.warn('Quarantine exception:', err);
	}
}

/**
 * Resolves active ruleset for sport
 */
export async function resolveSportRulesetId(
	supabase: SupabaseClient,
	sportSlug: string,
	marketKey = 'team_scoreline',
): Promise<number | null> {
	const { data, error } = await supabase
		.from('scoring_rulesets')
		.select('id')
		.eq('sport_slug', sportSlug)
		.eq('market_key', marketKey)
		.eq('is_active', true)
		.order('version', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error || !data) {
		// Fallback to ruleset with id 1 if present
		return 1;
	}

	return Number(data.id);
}
