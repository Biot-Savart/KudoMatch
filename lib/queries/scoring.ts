import { createClient } from '@/lib/supabase/client';
import { ScoringRuleset, ScoringRuleTier, UserScoreSummary } from '@/types';

export const scoringQueryKeys = {
	all: ['scoring'] as const,
	userSummary: (userId: string, sportSlug?: string) =>
		[...scoringQueryKeys.all, 'summary', userId, sportSlug ?? 'all'] as const,
	ruleset: (sportSlug: string, marketKind: string, version?: number) =>
		[
			...scoringQueryKeys.all,
			'ruleset',
			sportSlug,
			marketKind,
			version ?? 'active',
		] as const,
};

export async function fetchUserScoreSummary(
	userId: string,
	sportSlug?: string,
): Promise<UserScoreSummary> {
	const supabase = createClient();

	const { data, error } = await (supabase.rpc as any)(
		'get_user_score_summary',
		{
			p_user_id: userId,
			p_sport_slug: sportSlug || null,
		},
	);

	if (error) {
		console.error(`Error fetching score summary for user ${userId}:`, error);
		return {
			total_raw_points: 0,
			total_normalized_points: 0,
			total_predictions: 0,
			settled_predictions: 0,
			exact_count: 0,
			margin_count: 0,
			outcome_count: 0,
			miss_count: 0,
			win_rate: 0,
		};
	}

	const row = Array.isArray(data) && data.length > 0 ? data[0] : null;

	if (!row) {
		return {
			total_raw_points: 0,
			total_normalized_points: 0,
			total_predictions: 0,
			settled_predictions: 0,
			exact_count: 0,
			margin_count: 0,
			outcome_count: 0,
			miss_count: 0,
			win_rate: 0,
		};
	}

	return {
		total_raw_points: Number(row.total_raw_points ?? 0),
		total_normalized_points: Number(row.total_normalized_points ?? 0),
		total_predictions: Number(row.total_predictions ?? 0),
		settled_predictions: Number(row.settled_predictions ?? 0),
		exact_count: Number(row.exact_count ?? 0),
		margin_count: Number(row.margin_count ?? 0),
		outcome_count: Number(row.outcome_count ?? 0),
		miss_count: Number(row.miss_count ?? 0),
		win_rate: Number(row.win_rate ?? 0),
	};
}

export async function fetchScoringRuleset(
	sportSlug: string,
	marketKind: string = 'team_scoreline',
	version?: number,
): Promise<ScoringRuleset | null> {
	const supabase = createClient();

	let query = supabase
		.from('scoring_rulesets')
		.select(
			`
			*,
			scoring_rule_tiers:scoring_rule_tiers(*)
		`,
		)
		.eq('sport_slug', sportSlug)
		.eq('market_kind', marketKind);

	if (version !== undefined) {
		query = query.eq('version', version);
	} else {
		query = query.eq('is_active', true);
	}

	const { data, error } = await query.single();

	if (error || !data) {
		return null;
	}

	const tiers: ScoringRuleTier[] = ((data as any).scoring_rule_tiers ?? []).map(
		(t: any) => ({
			ruleset_id: String(t.ruleset_id),
			tier_code: t.tier_code,
			raw_points: Number(t.raw_points),
			rank_order: Number(t.rank_order),
			label: t.label,
			description: t.description,
			example: t.example,
		}),
	);

	return {
		id: String(data.id),
		sport_slug: data.sport_slug,
		market_kind: data.market_kind,
		evaluator_key: data.evaluator_key,
		version: Number(data.version),
		max_raw_points: Number(data.max_raw_points),
		evaluator_config: (data.evaluator_config as Record<string, any>) ?? {},
		ui_config: (data.ui_config as Record<string, any>) ?? {},
		is_active: data.is_active,
		created_at: data.created_at,
		updated_at: data.updated_at,
		tiers,
	};
}
