import {
	EvaluatedScoreResult,
	evaluateMarketPrediction,
} from '@/lib/scoring/evaluator';
import {
	PoolLeaderboardEntry,
	SportSlug,
	TeamScorelineResult,
	TeamScorelineSelection,
	TierCode,
} from '@/types';

export type ScoringTier =
	| 'exact'
	| 'diff'
	| 'winner'
	| 'exact_score'
	| 'exact_margin'
	| 'close_margin'
	| 'outcome'
	| 'miss'
	| 'unscored';

export interface ScoringExplanation {
	points: number;
	tier: ScoringTier;
	tierLabel: string;
	colorClass: string;
	badgeBg: string;
	badgeBorder: string;
	icon: string;
	predictedOutcome: 'home' | 'draw' | 'away' | null;
	actualOutcome: 'home' | 'draw' | 'away' | null;
	outcomeMatched: boolean;
	goalDiffMatched: boolean;
	exactScoreMatched: boolean;
	predDiff: number | null;
	actualDiff: number | null;
	summary: string;
	details: string;
}

export interface ScoringRule {
	points: number;
	tier_code: TierCode;
	title: string;
	badge: string;
	icon: string;
	color: string;
	bgGradient: string;
	borderColor: string;
	description: string;
	example: {
		predicted: string;
		actual: string;
		explanation: string;
	};
}

export const FOOTBALL_SCORING_RULES: ScoringRule[] = [
	{
		points: 3,
		tier_code: 'exact_score',
		title: 'Exact Score',
		badge: '3 PTS',
		icon: '🎯',
		color: 'text-emerald-400',
		bgGradient: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
		borderColor: 'border-emerald-500/30',
		description:
			'You correctly predicted the exact final scoreline for both home and away teams.',
		example: {
			predicted: '2 - 1',
			actual: '2 - 1',
			explanation: 'Exact match on both scores generates the maximum 3 points.',
		},
	},
	{
		points: 2,
		tier_code: 'exact_margin',
		title: 'Outcome & Goal Difference',
		badge: '2 PTS',
		icon: '↔️',
		color: 'text-teal-400',
		bgGradient: 'from-teal-500/15 via-teal-500/5 to-transparent',
		borderColor: 'border-teal-500/30',
		description:
			'You got the match winner correct and the winning margin (goal difference) matches the final score.',
		example: {
			predicted: '2 - 0 (+2 diff)',
			actual: '3 - 1 (+2 diff)',
			explanation:
				'Home win was predicted and the goal difference (+2) matched.',
		},
	},
	{
		points: 1,
		tier_code: 'outcome',
		title: 'Winner Only',
		badge: '1 PT',
		icon: '👍',
		color: 'text-blue-400',
		bgGradient: 'from-blue-500/15 via-blue-500/5 to-transparent',
		borderColor: 'border-blue-500/30',
		description:
			'You picked the correct outcome (Home Win, Draw, or Away Win), but the score and margin differed.',
		example: {
			predicted: '2 - 1 (+1 diff)',
			actual: '4 - 0 (+4 diff)',
			explanation:
				'Home win outcome was correct, but margin and score were different.',
		},
	},
	{
		points: 0,
		tier_code: 'miss',
		title: 'Incorrect Outcome',
		badge: '0 PTS',
		icon: '❌',
		color: 'text-slate-400',
		bgGradient: 'from-slate-500/10 via-slate-500/5 to-transparent',
		borderColor: 'border-white/10',
		description:
			'The actual match outcome (Win/Draw/Loss) did not match your prediction.',
		example: {
			predicted: '2 - 1 (Home Win)',
			actual: '1 - 1 (Draw)',
			explanation: 'Predicted home win, but the match finished in a draw.',
		},
	},
];

export const SCORING_RULES = FOOTBALL_SCORING_RULES;

/**
 * Evaluates scoreline prediction and returns tier code and points.
 */
export function evaluateScoreline(
	predHome: number,
	predAway: number,
	actualHome: number,
	actualAway: number,
	sportSlug: SportSlug = 'football',
	version: number = 1,
): EvaluatedScoreResult {
	const sel: TeamScorelineSelection = {
		kind: 'team_scoreline',
		version,
		home: predHome,
		away: predAway,
	};
	const res: TeamScorelineResult = {
		kind: 'team_scoreline',
		version,
		home: actualHome,
		away: actualAway,
	};
	return evaluateMarketPrediction(
		sportSlug,
		'team_scoreline',
		version,
		sel,
		res,
	);
}

/**
 * Calculates awarded points for a scoreline prediction.
 */
export function calculatePredictionPoints(
	predHome: number | null | undefined,
	predAway: number | null | undefined,
	actualHome: number | null | undefined,
	actualAway: number | null | undefined,
	sportSlug: SportSlug = 'football',
	version: number = 1,
): number {
	if (
		predHome === null ||
		predHome === undefined ||
		predAway === null ||
		predAway === undefined ||
		actualHome === null ||
		actualHome === undefined ||
		actualAway === null ||
		actualAway === undefined
	) {
		return 0;
	}

	const result = evaluateScoreline(
		predHome,
		predAway,
		actualHome,
		actualAway,
		sportSlug,
		version,
	);
	return result.rawPoints;
}

/**
 * Returns a rich scoring explanation for UI modals and badges.
 */
export function getScoringExplanation(
	predHome: number | null | undefined,
	predAway: number | null | undefined,
	actualHome: number | null | undefined,
	actualAway: number | null | undefined,
	statusOrSport: string = 'football',
	version: number = 1,
): ScoringExplanation {
	const isUnscoredStatus =
		statusOrSport === 'scheduled' ||
		actualHome === null ||
		actualHome === undefined ||
		actualAway === null ||
		actualAway === undefined;

	if (isUnscoredStatus) {
		return {
			points: 0,
			tier: 'unscored',
			tierLabel: 'Pending',
			colorClass: 'text-slate-400',
			badgeBg: 'bg-slate-500/10',
			badgeBorder: 'border-slate-500/20',
			icon: '⏳',
			predictedOutcome:
				predHome !== null &&
				predAway !== null &&
				predHome !== undefined &&
				predAway !== undefined
					? predHome > predAway
						? 'home'
						: predHome < predAway
							? 'away'
							: 'draw'
					: null,
			actualOutcome: null,
			outcomeMatched: false,
			goalDiffMatched: false,
			exactScoreMatched: false,
			predDiff:
				predHome !== null &&
				predAway !== null &&
				predHome !== undefined &&
				predAway !== undefined
					? predHome - predAway
					: null,
			actualDiff: null,
			summary: 'Match has not finished yet.',
			details: 'Points will be calculated once the match finishes.',
		};
	}

	if (
		predHome === null ||
		predHome === undefined ||
		predAway === null ||
		predAway === undefined
	) {
		return {
			points: 0,
			tier: 'miss',
			tierLabel: 'No Prediction',
			colorClass: 'text-slate-500',
			badgeBg: 'bg-slate-500/10',
			badgeBorder: 'border-slate-500/20',
			icon: '⚪',
			predictedOutcome: null,
			actualOutcome:
				actualHome > actualAway
					? 'home'
					: actualHome < actualAway
						? 'away'
						: 'draw',
			outcomeMatched: false,
			goalDiffMatched: false,
			exactScoreMatched: false,
			predDiff: null,
			actualDiff: actualHome - actualAway,
			summary: 'No prediction submitted for this match.',
			details: 'You did not submit a scoreline prediction before kickoff.',
		};
	}

	const sport =
		statusOrSport === 'finished' || statusOrSport === 'live'
			? 'football'
			: (statusOrSport as SportSlug);
	const evaluation = evaluateScoreline(
		predHome,
		predAway,
		actualHome,
		actualAway,
		sport,
		version,
	);

	const predDiff = predHome - predAway;
	const actualDiff = actualHome - actualAway;
	const predictedOutcome =
		predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw';
	const actualOutcome =
		actualHome > actualAway
			? 'home'
			: actualHome < actualAway
				? 'away'
				: 'draw';
	const outcomeMatched = predictedOutcome === actualOutcome;
	const exactScoreMatched = predHome === actualHome && predAway === actualAway;
	const goalDiffMatched = outcomeMatched && predDiff === actualDiff;

	switch (evaluation.tierCode) {
		case 'exact_score':
			return {
				points: evaluation.rawPoints,
				tier: 'exact',
				tierLabel: 'Exact Score',
				colorClass: 'text-emerald-400',
				badgeBg: 'bg-emerald-500/20',
				badgeBorder: 'border-emerald-500/40',
				icon: '🎯',
				predictedOutcome,
				actualOutcome,
				outcomeMatched: true,
				goalDiffMatched: true,
				exactScoreMatched: true,
				predDiff,
				actualDiff,
				summary: `Perfect call! You predicted the exact ${actualHome}-${actualAway} scoreline.`,
				details: `Both home (${predHome}) and away (${predAway}) goals matched exactly, awarding maximum ${evaluation.rawPoints} points.`,
			};

		case 'exact_margin':
			return {
				points: evaluation.rawPoints,
				tier: 'diff',
				tierLabel: 'Winner + Goal Diff',
				colorClass: 'text-teal-400',
				badgeBg: 'bg-teal-500/20',
				badgeBorder: 'border-teal-500/40',
				icon: '↔️',
				predictedOutcome,
				actualOutcome,
				outcomeMatched: true,
				goalDiffMatched: true,
				exactScoreMatched: false,
				predDiff,
				actualDiff,
				summary: `Great call! Correct winner with exact goal difference (${actualDiff > 0 ? `+${actualDiff}` : actualDiff}).`,
				details: `Predicted ${predHome}-${predAway} (${predDiff > 0 ? `+${predDiff}` : predDiff} diff) vs Actual ${actualHome}-${actualAway} (${actualDiff > 0 ? `+${actualDiff}` : actualDiff} diff).`,
			};

		case 'close_margin':
			return {
				points: evaluation.rawPoints,
				tier: 'diff',
				tierLabel: 'Close Margin',
				colorClass: 'text-cyan-400',
				badgeBg: 'bg-cyan-500/20',
				badgeBorder: 'border-cyan-500/40',
				icon: '📐',
				predictedOutcome,
				actualOutcome,
				outcomeMatched: true,
				goalDiffMatched: false,
				exactScoreMatched: false,
				predDiff,
				actualDiff,
				summary: `Close call! Correct winner with close margin error.`,
				details: `Predicted ${predHome}-${predAway} vs Actual ${actualHome}-${actualAway}.`,
			};

		case 'outcome':
			return {
				points: evaluation.rawPoints,
				tier: 'winner',
				tierLabel: 'Winner Only',
				colorClass: 'text-blue-400',
				badgeBg: 'bg-blue-500/20',
				badgeBorder: 'border-blue-500/40',
				icon: '👍',
				predictedOutcome,
				actualOutcome,
				outcomeMatched: true,
				goalDiffMatched: false,
				exactScoreMatched: false,
				predDiff,
				actualDiff,
				summary: `Correct outcome! You picked the right winner.`,
				details: `Predicted ${predictedOutcome.toUpperCase()} win (${predHome}-${predAway}), Actual ${actualHome}-${actualAway}.`,
			};

		case 'miss':
		default:
			return {
				points: 0,
				tier: 'miss',
				tierLabel: 'Incorrect',
				colorClass: 'text-rose-400',
				badgeBg: 'bg-rose-500/15',
				badgeBorder: 'border-rose-500/30',
				icon: '❌',
				predictedOutcome,
				actualOutcome,
				outcomeMatched: false,
				goalDiffMatched: false,
				exactScoreMatched: false,
				predDiff,
				actualDiff,
				summary: `Outcome missed. Predicted ${predictedOutcome.toUpperCase()} win, but result was ${actualOutcome.toUpperCase()}.`,
				details: `Predicted ${predHome}-${predAway} vs Actual ${actualHome}-${actualAway}.`,
			};
	}
}

export interface SimulatedLeaderboardEntry extends PoolLeaderboardEntry {
	simulated_points: number;
	simulatedPoints: number;
	simulated_exact_count: number;
	simulated_rank: number;
	rank_delta: number;
	rankDelta: number;
}

/**
 * Computes tie-break order between leaderboard entries.
 */
export function compareLeaderboardEntries(
	a: PoolLeaderboardEntry,
	b: PoolLeaderboardEntry,
): number {
	if (b.total_points !== a.total_points) return b.total_points - a.total_points;
	if (b.exact_count !== a.exact_count) return b.exact_count - a.exact_count;
	const bMargin = b.margin_count ?? 0;
	const aMargin = a.margin_count ?? 0;
	if (bMargin !== aMargin) return bMargin - aMargin;
	const bOutcome = b.outcome_count ?? 0;
	const aOutcome = a.outcome_count ?? 0;
	if (bOutcome !== aOutcome) return bOutcome - aOutcome;
	return (a.full_name ?? '').localeCompare(b.full_name ?? '');
}

/**
 * Simulates pool standings given hypothetical event scorelines.
 */
export function simulatePoolStandings(
	leaderboard: PoolLeaderboardEntry[],
	predictionsByMember: Record<string, Record<string, any>>,
	events: any[],
	simulatedScores: Record<string, { home_score: number; away_score: number }>,
	sportSlug: SportSlug = 'football',
): { simulatedLeaderboard: SimulatedLeaderboardEntry[] } {
	const entries: SimulatedLeaderboardEntry[] = leaderboard.map((entry) => {
		let addedPoints = 0;
		let addedExact = 0;

		const userPicks = predictionsByMember[entry.user_id] || {};

		for (const ev of events) {
			const sim = simulatedScores[ev.id];
			if (!sim) continue;

			const pick = userPicks[ev.id] || userPicks[ev.current_market?.id ?? ''];
			if (!pick) continue;

			const homePick =
				pick.predicted_home_score ?? pick.home ?? pick.selection?.home;
			const awayPick =
				pick.predicted_away_score ?? pick.away ?? pick.selection?.away;

			if (typeof homePick === 'number' && typeof awayPick === 'number') {
				const evalRes = evaluateScoreline(
					homePick,
					awayPick,
					sim.home_score,
					sim.away_score,
					sportSlug,
				);
				addedPoints += evalRes.rawPoints;
				if (evalRes.tierCode === 'exact_score') {
					addedExact++;
				}
			}
		}

		const totalSimPoints = entry.total_points + addedPoints;
		const totalSimExact = entry.exact_count + addedExact;

		return {
			...entry,
			simulated_points: totalSimPoints,
			simulatedPoints: totalSimPoints,
			simulated_exact_count: totalSimExact,
			simulated_rank: entry.rank,
			rank: entry.rank,
			rank_delta: 0,
			rankDelta: 0,
		};
	});

	// Sort by simulated points
	entries.sort((a, b) => {
		if (b.simulated_points !== a.simulated_points) {
			return b.simulated_points - a.simulated_points;
		}
		if (b.simulated_exact_count !== a.simulated_exact_count) {
			return b.simulated_exact_count - a.simulated_exact_count;
		}
		return (a.full_name ?? '').localeCompare(b.full_name ?? '');
	});

	// Re-assign ranks and calculate rank deltas
	entries.forEach((item, idx) => {
		const newRank = idx + 1;
		const initialRank = item.rank;
		item.simulated_rank = newRank;
		item.rank = newRank;
		item.rank_delta = initialRank - newRank; // positive = climbed up
		item.rankDelta = initialRank - newRank;
	});

	return { simulatedLeaderboard: entries };
}
