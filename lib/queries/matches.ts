import { fetchEvents } from '@/lib/queries/events';
import { fetchMarketCommunityStats } from '@/lib/queries/markets';
import { Match } from '@/types';

export async function fetchMatches(matchdayNum?: number): Promise<Match[]> {
	const round = matchdayNum ? `Round ${matchdayNum}` : undefined;
	return (await fetchEvents({ roundLabel: round })) as unknown as Match[];
}

export async function fetchAvailableMatchdays(): Promise<number[]> {
	return [12, 13, 14];
}

export async function fetchActiveMatchday(): Promise<number> {
	return 12;
}

export async function fetchMatchCommunityInsights(
	matchId: string,
	poolId?: string,
) {
	return fetchMarketCommunityStats(matchId);
}
