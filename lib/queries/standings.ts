import { createClient } from '@/lib/supabase/client';
import { CompetitionStanding, SportEvent } from '@/types';
import { fetchEvents, EventFilterOptions } from './events';

export const standingsQueryKeys = {
	all: ['standings'] as const,
	competition: (editionId: string, stageKey = 'overall') => [...standingsQueryKeys.all, editionId, stageKey] as const,
};

export async function fetchCompetitionStandings(editionId: string, stageKey = 'overall'): Promise<CompetitionStanding[]> {
	const supabase = createClient();
	const { data, error } = await supabase
		.from('competition_standings')
		.select('*')
		.eq('edition_id', editionId)
		.eq('stage_key', stageKey)
		.order('position', { ascending: true, nullsFirst: false })
		.order('competitor_id', { ascending: true });
	if (error) throw error;
	return (data ?? []).map((row) => ({
		...row,
		edition_id: String(row.edition_id),
		competitor_id: String(row.competitor_id),
		competition_id: String(row.competition_id),
		details: (row.details as Record<string, unknown>) ?? {},
	})) as CompetitionStanding[];
}

export interface CompetitorEventFilters {
	competitorId: string;
	competitionId?: string;
	editionId?: string;
	from?: string;
	to?: string;
	status?: string;
	limit?: number;
}

export async function fetchCompetitorEvents(filters: CompetitorEventFilters): Promise<SportEvent[]> {
	const options: EventFilterOptions = {
		competitionId: filters.competitionId,
		editionId: filters.editionId,
		status: filters.status,
		limit: filters.limit,
		competitorId: filters.competitorId,
		from: filters.from,
		to: filters.to,
	};
	return fetchEvents(options);
}
