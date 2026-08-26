import { SupabaseClient } from '@supabase/supabase-js';
import { SportProviderAdapter } from './adapter';
import { CanonicalCompetitionDTO, CanonicalEditionDTO } from './dto';

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
		.select('competition_id, edition_id, competitor_id, event_id')
		.eq('provider_slug', providerSlug)
		.eq('entity_kind', entityKind)
		.eq('external_key', String(externalKey))
		.maybeSingle();

	if (error) {
		console.error(
			`Error resolving external ref for ${entityKind} ${externalKey}:`,
			error,
		);
		throw new Error(
			`Failed to resolve external ref for ${entityKind} '${externalKey}' from provider '${providerSlug}': ${error.message}`,
		);
	}

	if (!data) return null;

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
 * Ensures the competition exists in public.competitions and has an external entity reference
 */
export async function ensureCanonicalCompetition(
	supabase: SupabaseClient,
	adapter: SportProviderAdapter,
	competitionExternalKey?: string,
): Promise<number> {
	// 1. Try resolving existing external ref
	if (competitionExternalKey) {
		const existingId = await resolveExternalRef(
			supabase,
			adapter.providerSlug,
			'competition',
			competitionExternalKey,
		);
		if (existingId) return existingId;
	}

	// 2. Fetch competition definition from adapter
	const competitions = await adapter.fetchCompetitions();
	let compDto: CanonicalCompetitionDTO | undefined;

	if (competitionExternalKey) {
		compDto = competitions.find(
			(c) => c.externalKey === competitionExternalKey,
		);
		if (!compDto) {
			throw new Error(
				`Invalid competition external key '${competitionExternalKey}': not returned by provider '${adapter.providerSlug}'`,
			);
		}
	} else {
		compDto = competitions[0];
		if (!compDto) {
			throw new Error(
				`No competitions returned by provider '${adapter.providerSlug}'`,
			);
		}
	}

	// 3. Check if competition already exists by (sport_slug, slug)
	let canonicalCompId: number | null = null;
	const { data: existingComp } = await supabase
		.from('competitions')
		.select('id')
		.eq('sport_slug', compDto.sportSlug)
		.eq('slug', compDto.slug)
		.maybeSingle();

	if (existingComp?.id) {
		canonicalCompId = Number(existingComp.id);
	} else {
		// Insert competition
		const { data: insertedComp, error: compErr } = await supabase
			.from('competitions')
			.insert({
				sport_slug: compDto.sportSlug,
				slug: compDto.slug,
				name: compDto.name,
				kind: compDto.kind || 'league',
				country: compDto.country,
				logo_url: compDto.logoUrl,
				is_active: compDto.isActive ?? true,
			})
			.select('id')
			.single();

		if (compErr || !insertedComp) {
			throw new Error(
				`Failed to insert competition '${compDto.name}': ${compErr?.message}`,
			);
		}
		canonicalCompId = Number(insertedComp.id);
	}

	// 4. Upsert external entity reference
	const { error: compRefErr } = await supabase
		.from('external_entity_refs')
		.upsert(
			{
				provider_slug: adapter.providerSlug,
				entity_kind: 'competition',
				external_key: compDto.externalKey,
				competition_id: canonicalCompId,
				is_primary: true,
			},
			{ onConflict: 'provider_slug,entity_kind,external_key' },
		);

	if (compRefErr) {
		throw new Error(
			`Failed to persist external reference for competition '${compDto.name}' in provider '${adapter.providerSlug}': ${compRefErr.message}`,
		);
	}

	return canonicalCompId;
}

/**
 * Ensures the edition exists in public.competition_editions and has an external entity reference
 */
export async function ensureCanonicalEdition(
	supabase: SupabaseClient,
	adapter: SportProviderAdapter,
	competitionId: number,
	editionExternalKey?: string,
	competitionExternalKey?: string,
	seasonKey?: string,
): Promise<number> {
	// 1. Try resolving existing external ref
	if (editionExternalKey) {
		const existingId = await resolveExternalRef(
			supabase,
			adapter.providerSlug,
			'edition',
			editionExternalKey,
		);
		if (existingId) return existingId;
	}

	// 2. Fetch edition definition from adapter
	const compKey =
		competitionExternalKey ||
		(editionExternalKey ? editionExternalKey.split('-')[0] : null) ||
		String(competitionId);

	const editions = await adapter.fetchEditions(compKey);
	let edDto: CanonicalEditionDTO | undefined;

	if (editionExternalKey) {
		edDto = editions.find((e) => e.externalKey === editionExternalKey);
		if (!edDto) {
			throw new Error(
				`Invalid edition external key '${editionExternalKey}': not returned by provider '${adapter.providerSlug}'`,
			);
		}
	} else if (seasonKey) {
		edDto = editions.find((e) => e.seasonKey === seasonKey);
		if (!edDto) {
			throw new Error(
				`Invalid season key '${seasonKey}': not returned by provider '${adapter.providerSlug}'`,
			);
		}
	} else {
		edDto = editions[0];
		if (!edDto) {
			throw new Error(
				`No editions returned by provider '${adapter.providerSlug}'`,
			);
		}
	}

	// 3. Check if edition already exists by (competition_id, season_key) or normalized variant
	let canonicalEditionId: number | null = null;
	const { data: directMatch } = await supabase
		.from('competition_editions')
		.select('id, season_key')
		.eq('competition_id', competitionId)
		.eq('season_key', edDto.seasonKey)
		.maybeSingle();

	if (directMatch?.id) {
		canonicalEditionId = Number(directMatch.id);
	} else {
		// Check alternate format (e.g. 2025-2026 vs 2025)
		const altSeasonKey = edDto.seasonKey.includes('-')
			? edDto.seasonKey.split('-')[0]
			: `${edDto.seasonKey}-${Number(edDto.seasonKey) + 1}`;

		const { data: altMatch } = await supabase
			.from('competition_editions')
			.select('id, season_key')
			.eq('competition_id', competitionId)
			.eq('season_key', altSeasonKey)
			.maybeSingle();

		if (altMatch?.id) {
			canonicalEditionId = Number(altMatch.id);
		} else {
			// Insert edition if not found in database seed
			const { data: insertedEd, error: edErr } = await supabase
				.from('competition_editions')
				.insert({
					competition_id: competitionId,
					season_key: edDto.seasonKey,
					name: edDto.name,
					starts_at: edDto.startsAt || new Date().toISOString(),
					ends_at:
						edDto.endsAt ||
						new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
					status:
						edDto.status === 'archived'
							? 'completed'
							: edDto.status || 'active',
					metadata: edDto.metadata || {},
				})
				.select('id')
				.single();

			if (edErr || !insertedEd) {
				throw new Error(
					`Failed to insert competition edition '${edDto.name}': ${edErr?.message}`,
				);
			}
			canonicalEditionId = Number(insertedEd.id);
		}
	}

	// 4. Upsert external entity reference to ensure the edition is mapped
	const externalKeyToRecord = editionExternalKey || edDto.externalKey;
	const { error: edRefErr } = await supabase
		.from('external_entity_refs')
		.upsert(
			{
				provider_slug: adapter.providerSlug,
				entity_kind: 'edition',
				external_key: externalKeyToRecord,
				edition_id: canonicalEditionId,
				is_primary: true,
			},
			{ onConflict: 'provider_slug,entity_kind,external_key' },
		);

	if (edRefErr) {
		throw new Error(
			`Failed to persist external reference for edition '${externalKeyToRecord}' in provider '${adapter.providerSlug}': ${edRefErr.message}`,
		);
	}

	return canonicalEditionId;
}

/**
 * Ensures competitors for an edition exist in public.competitors and are linked to edition_competitors
 */
export async function ensureCanonicalCompetitors(
	supabase: SupabaseClient,
	adapter: SportProviderAdapter,
	editionId: number,
	editionExternalKey: string,
	competitionExternalKey?: string,
): Promise<Map<string, number>> {
	const competitorMap = new Map<string, number>();

	const competitors = await adapter.fetchCompetitors(
		editionExternalKey,
		competitionExternalKey,
	);

	for (const comp of competitors) {
		let competitorId = await resolveExternalRef(
			supabase,
			adapter.providerSlug,
			'competitor',
			comp.externalKey,
		);

		if (!competitorId) {
			const { data: insertedComp, error: compErr } = await supabase
				.from('competitors')
				.insert({
					sport_slug: adapter.sportSlug,
					kind: comp.kind || 'team',
					name: comp.name,
					short_name: comp.shortName,
					media_url: comp.mediaUrl,
					country_code: comp.countryCode,
					is_active: comp.isActive ?? true,
				})
				.select('id')
				.single();

			if (insertedComp?.id) {
				competitorId = Number(insertedComp.id);
				const { error: compRefErr } = await supabase
					.from('external_entity_refs')
					.upsert(
						{
							provider_slug: adapter.providerSlug,
							entity_kind: 'competitor',
							external_key: comp.externalKey,
							competitor_id: competitorId,
							is_primary: true,
						},
						{ onConflict: 'provider_slug,entity_kind,external_key' },
					);

				if (compRefErr) {
					throw new Error(
						`Failed to persist external reference for competitor '${comp.name}' (key: ${comp.externalKey}) in provider '${adapter.providerSlug}': ${compRefErr.message}`,
					);
				}
			} else {
				const errorMsg = compErr
					? compErr.message
					: 'Unknown competitor insertion failure';
				throw new Error(
					`Failed to resolve or insert competitor '${comp.name}' (key: ${comp.externalKey}) for provider '${adapter.providerSlug}': ${errorMsg}`,
				);
			}
		}

		if (!competitorId) {
			throw new Error(
				`Competitor '${comp.name}' (key: ${comp.externalKey}) could not be resolved for provider '${adapter.providerSlug}'`,
			);
		}

		competitorMap.set(comp.externalKey, competitorId);
		// Link to edition
		const { error: linkErr } = await supabase
			.from('edition_competitors')
			.upsert(
				{
					edition_id: editionId,
					competitor_id: competitorId,
				},
				{ onConflict: 'edition_id,competitor_id' },
			);

		if (linkErr) {
			throw new Error(
				`Failed to link competitor '${comp.name}' to edition ${editionId}: ${linkErr.message}`,
			);
		}
	}

	return competitorMap;
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
	marketKind = 'team_scoreline',
): Promise<number> {
	const { data, error } = await supabase
		.from('scoring_rulesets')
		.select('id')
		.eq('sport_slug', sportSlug)
		.eq('market_kind', marketKind)
		.eq('is_active', true)
		.order('version', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error || !data?.id) {
		throw new Error(
			`Active scoring ruleset not found for sport '${sportSlug}' and market kind '${marketKind}'`,
		);
	}

	return Number(data.id);
}
