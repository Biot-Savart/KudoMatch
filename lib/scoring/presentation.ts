import { evaluatePrediction, EvaluatedScoreResult, ScorelinePayload } from '@/lib/scoring/evaluator';
import { ScoringRuleset, TeamScorelineSelection, TeamScorelineResult } from '@/types';

export interface ScoringPresentation {
	tierCode: EvaluatedScoreResult['tierCode'];
	label: string;
	rawPoints: number;
	normalizedBasisPoints: number;
	poolPoints: number;
	summary: string;
	selection: TeamScorelineSelection;
	result: TeamScorelineResult;
}

/** Common semantic boundary for cards, rules, breakdowns, stats and simulations. */
export function buildScoringPresentation(
	ruleset: Pick<ScoringRuleset, 'evaluator_key' | 'evaluator_config' | 'max_raw_points'>,
	selection: TeamScorelineSelection,
	result: TeamScorelineResult,
	award?: Partial<Pick<EvaluatedScoreResult, 'rawPoints' | 'normalizedBasisPoints'>> & { poolPoints?: number },
): ScoringPresentation {
	const evaluated = evaluatePrediction(
		ruleset.evaluator_key,
		ruleset.evaluator_config ?? {},
		selection as ScorelinePayload,
		result as ScorelinePayload,
		ruleset.max_raw_points,
	);
	const effective = {
		tierCode: evaluated.tierCode,
		rawPoints: award?.rawPoints ?? evaluated.rawPoints,
		normalizedBasisPoints: award?.normalizedBasisPoints ?? evaluated.normalizedBasisPoints,
	};
	const labels: Record<EvaluatedScoreResult['tierCode'], string> = {
		exact_score: 'Exact score',
		exact_margin: 'Exact margin',
		close_margin: 'Close margin',
		outcome: 'Correct outcome',
		miss: 'Miss',
	};
	return {
		tierCode: effective.tierCode,
		label: labels[effective.tierCode],
		rawPoints: effective.rawPoints,
		normalizedBasisPoints: effective.normalizedBasisPoints,
		poolPoints: award?.poolPoints ?? effective.rawPoints,
		summary: `${labels[effective.tierCode]}: ${selection.home}-${selection.away} vs ${result.home}-${result.away}`,
		selection,
		result,
	};
}
