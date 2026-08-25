import { fetchEvents } from '@/lib/queries/events';
import { fetchMarketCommunityStats } from '@/lib/queries/markets';

export async function fetchMatches(matchdayNum?: number) {
	const round = matchdayNum ? `Round ${matchdayNum}` : undefined;
	return fetchEvents({ roundLabel: round });
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
