import { CompetitionEdition } from '@/types';

/** Human-readable edition label; never expose provider IDs in the UI. */
export function formatEditionLabel(edition?: CompetitionEdition | null): string {
	if (!edition) return 'Competition';
	const competitionName = edition.competition?.name;
	const season = edition.season_key;
	if (competitionName && season) return `${competitionName} · ${season}`;
	return competitionName || season || 'Competition';
}

/** Include the calendar date so a match cannot be mistaken for this weekend. */
export function formatMatchStart(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'Date unavailable';
	return `${date.toLocaleDateString(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
	})} · ${date.toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit',
	})}`;
}
