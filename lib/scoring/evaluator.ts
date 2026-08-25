export type ScorelinePayload = {
	kind: 'team_scoreline';
	version: number;
	home: number;
	away: number;
};

export type ScoringTierCode =
	| 'exact_score'
	| 'exact_margin'
	| 'close_margin'
	| 'outcome'
	| 'miss';

export interface EvaluatedScoreResult {
	tierCode: ScoringTierCode;
	rawPoints: number;
	normalizedBasisPoints: number;
}

export const FOOTBALL_RULES_V1: Record<ScoringTierCode, number> = {
	exact_score: 3,
	exact_margin: 2,
	close_margin: 0, // not used in football v1
	outcome: 1,
	miss: 0,
};

export const RUGBY_UNION_RULES_V1: Record<ScoringTierCode, number> = {
	exact_score: 6,
	exact_margin: 4,
	close_margin: 3,
	outcome: 2,
	miss: 0,
};

/**
 * Evaluates a football scoreline prediction against actual result (v1).
 */
export function evaluateFootballScorelineV1(
	selection: ScorelinePayload,
	result: ScorelinePayload,
	_config: Record<string, unknown> = {},
): ScoringTierCode {
	const pHome = selection.home;
	const pAway = selection.away;
	const aHome = result.home;
	const aAway = result.away;

	// Exact score check
	if (pHome === aHome && pAway === aAway) {
		return 'exact_score';
	}

	const predMargin = pHome - pAway;
	const actMargin = aHome - aAway;

	const predOutcome = Math.sign(predMargin);
	const actOutcome = Math.sign(actMargin);

	if (predOutcome === actOutcome) {
		if (predMargin === actMargin) {
			return 'exact_margin';
		}
		return 'outcome';
	}

	return 'miss';
}

/**
 * Evaluates a rugby union scoreline prediction against actual result (v1).
 * Signed margin = home - away.
 */
export function evaluateRugbyUnionScorelineV1(
	selection: ScorelinePayload,
	result: ScorelinePayload,
	_config: Record<string, unknown> = {},
): ScoringTierCode {
	const pHome = selection.home;
	const pAway = selection.away;
	const aHome = result.home;
	const aAway = result.away;

	// Exact score check (6 pts)
	if (pHome === aHome && pAway === aAway) {
		return 'exact_score';
	}

	const predMargin = pHome - pAway;
	const actMargin = aHome - aAway;

	const predOutcome = Math.sign(predMargin);
	const actOutcome = Math.sign(actMargin);

	if (predOutcome === actOutcome) {
		// Exact signed margin (4 pts)
		if (predMargin === actMargin) {
			return 'exact_margin';
		}

		const marginError = Math.abs(predMargin - actMargin);
		// Signed margin error <= 5 (3 pts)
		if (marginError <= 5) {
			return 'close_margin';
		}

		// Outcome only (2 pts)
		return 'outcome';
	}

	return 'miss';
}

/**
 * Calculates normalized basis points (0 to 10,000) for a given raw score and max points.
 */
export function calculateNormalizedBasisPoints(
	rawPoints: number,
	maxRawPoints: number,
): number {
	if (maxRawPoints <= 0) return 0;
	return Math.round((rawPoints * 10000) / maxRawPoints);
}

/**
 * General prediction evaluator dispatcher matching PostgreSQL private.evaluate_prediction.
 */
export function evaluatePrediction(
	evaluatorKey: string,
	evaluatorConfig: Record<string, unknown>,
	selection: ScorelinePayload,
	result: ScorelinePayload,
	maxRawPoints?: number,
): EvaluatedScoreResult {
	let tierCode: ScoringTierCode = 'miss';
	let rawPoints = 0;
	let maxPts = maxRawPoints || 3;

	switch (evaluatorKey) {
		case 'football_scoreline_v1':
			tierCode = evaluateFootballScorelineV1(
				selection,
				result,
				evaluatorConfig,
			);
			rawPoints = FOOTBALL_RULES_V1[tierCode] ?? 0;
			maxPts = maxRawPoints || 3;
			break;
		case 'rugby_union_scoreline_v1':
			tierCode = evaluateRugbyUnionScorelineV1(
				selection,
				result,
				evaluatorConfig,
			);
			rawPoints = RUGBY_UNION_RULES_V1[tierCode] ?? 0;
			maxPts = maxRawPoints || 6;
			break;
		default:
			throw new Error(`Unknown evaluator key: ${evaluatorKey}`);
	}

	return {
		tierCode,
		rawPoints,
		normalizedBasisPoints: calculateNormalizedBasisPoints(rawPoints, maxPts),
	};
}
