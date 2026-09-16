import { createClient } from '@/lib/supabase/client';
import { Competition, CompetitionEdition } from '@/types';

export const competitionsQueryKeys = {
	all: ['competitions'] as const,
	bySport: (sportSlug?: string) =>
		[...competitionsQueryKeys.all, 'sport', sportSlug ?? 'all'] as const,
	editions: (sportSlug?: string, competitionId?: string, statuses?: string[]) =>
		[
			'competition_editions',
			sportSlug ?? 'all',
			competitionId ?? 'all',
			...(statuses ?? ['active']),
		] as const,
	editionRounds: (editionId?: string) =>
		['competition_edition_rounds', editionId ?? 'all'] as const,
};

export const PREVIOUS_ROUNDS_LABEL = 'Previous rounds';

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

export async function fetchCompetitionEditions({
	sportSlug,
	competitionId,
	statuses = ['active'],
}: {
	sportSlug?: string;
	competitionId?: string;
	statuses?: string[];
} = {}): Promise<CompetitionEdition[]> {
	const supabase = createClient();
	let query = supabase
		.from('competition_editions')
		.select('*, competition:competitions!inner(*)')
		.order('starts_at', { ascending: false });
	if (statuses.length === 1) query = query.eq('status', statuses[0]);
	else if (statuses.length > 1) query = query.in('status', statuses);

	if (competitionId) {
		query = query.eq('competition_id', competitionId);
	}
	if (sportSlug) query = query.eq('competition.sport_slug', sportSlug);
	// Disabled competitions must never become the implicit edition fallback.
	query = query.eq('competition.is_active', true);

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

/** Backward-compatible helper for callers that only need active editions. */
export async function fetchActiveCompetitionEditions(
	competitionId?: string,
): Promise<CompetitionEdition[]> {
	return fetchCompetitionEditions({ competitionId, statuses: ['active'] });
}

export async function fetchEditionRounds(editionId: string): Promise<string[]> {
	const supabase = createClient();
	const { data, error } = await supabase
		.from('events')
		.select('round_label, starts_at')
		.eq('edition_id', editionId)
		.order('starts_at', { ascending: true });

	if (error) {
		console.error('Error fetching edition rounds:', error);
		throw error;
	}

	const rows = data ?? [];
	const rounds = Array.from(
		new Set(
			rows
				.map((d) => d.round_label)
				.filter((r): r is string => Boolean(r)),
		),
	);
	rounds.sort((a, b) => {
		const numA = parseInt(a.replace(/\D+/g, ''), 10);
		const numB = parseInt(b.replace(/\D+/g, ''), 10);
		if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
		return a.localeCompare(b, undefined, {
			numeric: true,
			sensitivity: 'base',
		});
	});
	if (rows.some((row) => !row.round_label)) rounds.push(PREVIOUS_ROUNDS_LABEL);

	return rounds;
}
