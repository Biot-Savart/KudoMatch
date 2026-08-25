import { createClient } from '@/lib/supabase/client';
import { Competition, CompetitionEdition } from '@/types';

export const competitionsQueryKeys = {
	all: ['competitions'] as const,
	bySport: (sportSlug?: string) =>
		[...competitionsQueryKeys.all, 'sport', sportSlug ?? 'all'] as const,
	editions: (competitionId?: string) =>
		['competition_editions', competitionId ?? 'all'] as const,
	editionRounds: (editionId?: string) =>
		['competition_edition_rounds', editionId ?? 'all'] as const,
};

export async function fetchActiveCompetitions(
	sportSlug?: string,
): Promise<Competition[]> {
	const supabase = createClient();
	let query = supabase
		.from('competitions')
		.select('*')
		.eq('is_active', true)
		.order('name', { ascending: true });

	if (sportSlug) {
		query = query.eq('sport_slug', sportSlug);
	}

	const { data, error } = await query;

	if (error) {
		console.error('Error fetching competitions:', error);
		throw error;
	}

	return (data ?? []).map((row) => ({
		id: String(row.id),
		sport_slug: row.sport_slug,
		slug: row.slug,
		name: row.name,
		kind: row.kind as Competition['kind'],
		country: row.country,
		logo_url: row.logo_url,
		is_active: row.is_active,
		created_at: row.created_at,
		updated_at: row.updated_at,
	}));
}

export async function fetchActiveCompetitionEditions(
	competitionId?: string,
): Promise<CompetitionEdition[]> {
	const supabase = createClient();
	let query = supabase
		.from('competition_editions')
		.select('*, competition:competitions(*)')
		.eq('status', 'active')
		.order('starts_at', { ascending: false });

	if (competitionId) {
		query = query.eq('competition_id', competitionId);
	}

	const { data, error } = await query;

	if (error) {
		console.error('Error fetching competition editions:', error);
		throw error;
	}

	return (data ?? []).map((row: any) => ({
		id: String(row.id),
		competition_id: String(row.competition_id),
		season_key: row.season_key,
		name: row.name,
		starts_at: row.starts_at,
		ends_at: row.ends_at,
		status: row.status,
		metadata: (row.metadata as Record<string, any>) ?? {},
		created_at: row.created_at,
		updated_at: row.updated_at,
		competition: row.competition
			? {
					id: String(row.competition.id),
					sport_slug: row.competition.sport_slug,
					slug: row.competition.slug,
					name: row.competition.name,
					kind: row.competition.kind,
					country: row.competition.country,
					logo_url: row.competition.logo_url,
					is_active: row.competition.is_active,
					created_at: row.competition.created_at,
					updated_at: row.competition.updated_at,
				}
			: undefined,
	}));
}

export async function fetchEditionRounds(editionId: string): Promise<string[]> {
	const supabase = createClient();
	const { data, error } = await supabase
		.from('events')
		.select('round_label')
		.eq('edition_id', editionId)
		.not('round_label', 'is', null)
		.order('sequence_number', { ascending: true });

	if (error) {
		console.error('Error fetching edition rounds:', error);
		throw error;
	}

	const rounds = Array.from(
		new Set(
			(data ?? [])
				.map((d) => d.round_label)
				.filter((r): r is string => Boolean(r)),
		),
	);

	return rounds;
}
