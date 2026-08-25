import { createClient } from '@/lib/supabase/client';
import { MarketPrediction, TeamScorelineSelection } from '@/types';

export const predictionsQueryKeys = {
	all: ['predictions'] as const,
	user: (userId: string) =>
		[...predictionsQueryKeys.all, 'user', userId] as const,
	byMarket: (marketId: string, userId: string) =>
		[...predictionsQueryKeys.all, 'market', marketId, userId] as const,
};

export async function fetchUserPredictions(
	userId: string,
): Promise<MarketPrediction[]> {
	const supabase = createClient();

	const { data, error } = await supabase
		.from('predictions')
		.select(
			`
			*,
			event_markets:event_markets(
				*,
				events:events(
					*,
					competition_editions:competition_editions(
						*,
						competitions:competitions(*)
					),
					event_competitors:event_competitors(
						*,
						competitors:competitors(*)
					)
				),
				scoring_rulesets:scoring_rulesets(
					*,
					scoring_rule_tiers:scoring_rule_tiers(*)
				),
				market_results:market_results(*)
			)
		`,
		)
		.eq('user_id', userId)
		.order('created_at', { ascending: false });

	if (error) {
		console.error(`Error fetching predictions for user ${userId}:`, error);
		throw error;
	}

	return (data ?? []).map((row: any) => ({
		id: String(row.id),
		user_id: row.user_id,
		event_market_id: String(row.event_market_id),
		selection: row.selection as TeamScorelineSelection,
		settlement_status: row.settlement_status,
		ruleset_id: row.ruleset_id ? String(row.ruleset_id) : null,
		result_revision: row.result_revision,
		tier_code: row.tier_code,
		raw_points: row.raw_points !== null ? Number(row.raw_points) : null,
		normalized_basis_points:
			row.normalized_basis_points !== null
				? Number(row.normalized_basis_points)
				: null,
		settled_at: row.settled_at,
		created_at: row.created_at,
		updated_at: row.updated_at,
	}));
}

export async function submitPrediction(
	userId: string,
	marketId: string,
	selection: TeamScorelineSelection,
): Promise<MarketPrediction> {
	const supabase = createClient();

	const { data, error } = await supabase
		.from('predictions')
		.upsert(
			{
				user_id: userId,
				event_market_id: Number(marketId),
				selection: selection as any,
				settlement_status: 'pending',
				updated_at: new Date().toISOString(),
			},
			{ onConflict: 'user_id,event_market_id' },
		)
		.select()
		.single();

	if (error) {
		console.error('Error submitting prediction:', error);
		throw error;
	}

	return {
		id: String(data.id),
		user_id: data.user_id,
		event_market_id: String(data.event_market_id),
		selection: data.selection as TeamScorelineSelection,
		settlement_status: data.settlement_status,
		ruleset_id: data.ruleset_id ? String(data.ruleset_id) : null,
		result_revision: data.result_revision,
		tier_code: data.tier_code as any,
		raw_points: data.raw_points !== null ? Number(data.raw_points) : null,
		normalized_basis_points:
			data.normalized_basis_points !== null
				? Number(data.normalized_basis_points)
				: null,
		settled_at: data.settled_at,
		created_at: data.created_at,
		updated_at: data.updated_at,
	};
}

// Backward-compatible aliases for transition & legacy tests
export async function upsertPrediction(
	userId: string,
	marketOrMatchId: string,
	homeScore: number,
	awayScore: number,
) {
	return submitPrediction(userId, marketOrMatchId, {
		kind: 'team_scoreline',
		version: 1,
		home: homeScore,
		away: awayScore,
	});
}

export async function fetchUserPredictionsWithMatches(userId: string) {
	return fetchUserPredictions(userId);
}
