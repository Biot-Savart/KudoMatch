import { createClient } from '@/lib/supabase/client';
import { MarketCommunityStats, ParticipantPick, TierCode } from '@/types';

export const marketsQueryKeys = {
	all: ['markets'] as const,
	detail: (marketId: string) =>
		[...marketsQueryKeys.all, 'detail', marketId] as const,
	stats: (marketId: string) =>
		[...marketsQueryKeys.all, 'stats', marketId] as const,
	participants: (marketId: string, poolId?: string) =>
		[
			...marketsQueryKeys.all,
			'participants',
			marketId,
			poolId ?? 'all',
		] as const,
};

export async function fetchMarketCommunityStats(
	marketId: string,
): Promise<MarketCommunityStats> {
	const supabase = createClient();

	const { data, error } = await (supabase.rpc as any)(
		'get_market_community_stats',
		{
			p_market_id: Number(marketId),
		},
	);

	if (error) {
		console.error(
			`Error fetching community stats for market ${marketId}:`,
			error,
		);
		return {
			total_predictions: 0,
			avg_home_score: 0,
			avg_away_score: 0,
			home_win_pct: 0,
			draw_pct: 0,
			away_win_pct: 0,
			top_exact_scores: [],
		};
	}

	const row = Array.isArray(data) && data.length > 0 ? data[0] : null;

	if (!row) {
		return {
			total_predictions: 0,
			avg_home_score: 0,
			avg_away_score: 0,
			home_win_pct: 0,
			draw_pct: 0,
			away_win_pct: 0,
			top_exact_scores: [],
		};
	}

	return {
		total_predictions: Number(row.total_predictions ?? 0),
		avg_home_score: Number(row.avg_home_score ?? 0),
		avg_away_score: Number(row.avg_away_score ?? 0),
		home_win_pct: Number(row.home_win_pct ?? 0),
		draw_pct: Number(row.draw_pct ?? 0),
		away_win_pct: Number(row.away_win_pct ?? 0),
		top_exact_scores: (row.top_exact_scores ?? []).map((s: any) => ({
			home: Number(s.home),
			away: Number(s.away),
			count: Number(s.count),
			pct: Number(s.pct),
		})),
	};
}

export async function fetchMarketParticipantPicks(
	marketId: string,
	poolId?: string,
): Promise<ParticipantPick[]> {
	const supabase = createClient();

	let query = supabase
		.from('predictions')
		.select(
			`
			user_id,
			selection,
			tier_code,
			raw_points,
			profiles:profiles(
				id,
				full_name,
				avatar_url
			)
		`,
		)
		.eq('event_market_id', marketId);

	const { data, error } = await query;

	if (error) {
		console.error(
			`Error fetching participant picks for market ${marketId}:`,
			error,
		);
		return [];
	}

	return (data ?? []).map((row: any) => {
		const sel = row.selection as any;
		return {
			user_id: row.user_id,
			full_name: row.profiles?.full_name ?? 'Anonymous User',
			avatar_url: row.profiles?.avatar_url ?? null,
			home: Number(sel?.home ?? 0),
			away: Number(sel?.away ?? 0),
			tier_code: (row.tier_code as TierCode) ?? null,
			points: row.raw_points !== null ? Number(row.raw_points) : null,
		};
	});
}
