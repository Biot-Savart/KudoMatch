import { Match, PoolLeaderboardEntry, Prediction } from '@/types';

export type ScoringTier = 'exact' | 'diff' | 'winner' | 'miss' | 'unscored';

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

export const SCORING_RULES: ScoringRule[] = [
	{
		points: 3,
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

/**
 * Calculates the awarded points for a prediction against a given actual or live score.
 */
export function calculatePredictionPoints(
	predHome: number | null | undefined,
	predAway: number | null | undefined,
	actualHome: number | null | undefined,
	actualAway: number | null | undefined,
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

	// 1. Exact score matched: 3 points
	if (predHome === actualHome && predAway === actualAway) {
		return 3;
	}

	const predDiff = predHome - predAway;
	const actualDiff = actualHome - actualAway;

	const predOutcome = predDiff > 0 ? 'home' : predDiff < 0 ? 'away' : 'draw';
	const actualOutcome =
		actualDiff > 0 ? 'home' : actualDiff < 0 ? 'away' : 'draw';

	// If outcome did not match: 0 points
	if (predOutcome !== actualOutcome) {
		return 0;
	}

	// 2. Correct outcome + correct goal difference: 2 points
	if (predDiff === actualDiff) {
		return 2;
	}

	// 3. Correct outcome only: 1 point
	return 1;
}

/**
 * Returns a transparent step-by-step scoring breakdown explanation.
 */
export function getScoringExplanation(
	predHome: number | null | undefined,
	predAway: number | null | undefined,
	actualHome: number | null | undefined,
	actualAway: number | null | undefined,
	status: 'scheduled' | 'live' | 'finished' | 'cancelled' = 'finished',
): ScoringExplanation {
	const hasPrediction =
		predHome !== null &&
		predHome !== undefined &&
		predAway !== null &&
		predAway !== undefined;
	const hasActual =
		actualHome !== null &&
		actualHome !== undefined &&
		actualAway !== null &&
		actualAway !== undefined;

	const pH = hasPrediction ? (predHome as number) : null;
	const pA = hasPrediction ? (predAway as number) : null;
	const predDiff = pH !== null && pA !== null ? pH - pA : null;
	const predictedOutcome: 'home' | 'draw' | 'away' | null =
		predDiff !== null
			? predDiff > 0
				? 'home'
				: predDiff < 0
					? 'away'
					: 'draw'
			: null;

	if (!hasPrediction || !hasActual) {
		return {
			points: 0,
			tier: 'unscored',
			tierLabel: 'Unscored',
			colorClass: 'text-slate-500',
			badgeBg: 'bg-slate-500/10',
			badgeBorder: 'border-slate-500/20',
			icon: '⏳',
			predictedOutcome,
			actualOutcome: null,
			outcomeMatched: false,
			goalDiffMatched: false,
			exactScoreMatched: false,
			predDiff,
			actualDiff: null,
			summary: !hasPrediction
				? 'No prediction submitted.'
				: 'Match score has not been recorded yet.',
			details:
				'Points are calculated automatically once match scores are entered or synced.',
		};
	}

	const aH = actualHome as number;
	const aA = actualAway as number;
	const actualDiff = aH - aA;
	const actualOutcome: 'home' | 'draw' | 'away' =
		actualDiff > 0 ? 'home' : actualDiff < 0 ? 'away' : 'draw';

	const outcomeMatched = predictedOutcome === actualOutcome;
	const goalDiffMatched = outcomeMatched && predDiff === actualDiff;
	const exactScoreMatched = pH === aH && pA === aA;

	const isLive = status === 'live';
	const livePrefix = isLive ? 'Live Tracking: ' : '';

	if (exactScoreMatched) {
		return {
			points: 3,
			tier: 'exact',
			tierLabel: `${livePrefix}Exact Score`,
			colorClass: 'text-emerald-400',
			badgeBg: 'bg-emerald-500/10',
			badgeBorder: 'border-emerald-500/30',
			icon: '🎯',
			predictedOutcome,
			actualOutcome,
			outcomeMatched: true,
			goalDiffMatched: true,
			exactScoreMatched: true,
			predDiff,
			actualDiff,
			summary: `Bullseye! You nailed the exact ${pH} - ${pA} scoreline.`,
			details: `You correctly predicted ${pH} home goals and ${pA} away goals (+3 PTS).`,
		};
	}

	if (goalDiffMatched) {
		return {
			points: 2,
			tier: 'diff',
			tierLabel: `${livePrefix}Outcome & Goal Diff`,
			colorClass: 'text-teal-400',
			badgeBg: 'bg-teal-500/10',
			badgeBorder: 'border-teal-500/30',
			icon: '↔️',
			predictedOutcome,
			actualOutcome,
			outcomeMatched: true,
			goalDiffMatched: true,
			exactScoreMatched: false,
			predDiff,
			actualDiff,
			summary: `Great pick! Correct outcome with matching goal difference (${predDiff! > 0 ? '+' : ''}${predDiff}).`,
			details: `You predicted a ${predDiff! > 0 ? 'Home Win' : predDiff! < 0 ? 'Away Win' : 'Draw'} by ${Math.abs(predDiff!)} goal(s), which matched the actual outcome margin (+2 PTS).`,
		};
	}

	if (outcomeMatched) {
		return {
			points: 1,
			tier: 'winner',
			tierLabel: `${livePrefix}Winner Only`,
			colorClass: 'text-blue-400',
			badgeBg: 'bg-blue-500/10',
			badgeBorder: 'border-blue-500/30',
			icon: '👍',
			predictedOutcome,
			actualOutcome,
			outcomeMatched: true,
			goalDiffMatched: false,
			exactScoreMatched: false,
			predDiff,
			actualDiff,
			summary: `Good call! Correct match outcome (${actualOutcome === 'home' ? 'Home Win' : actualOutcome === 'away' ? 'Away Win' : 'Draw'}).`,
			details: `You correctly picked the winner/draw (+1 PT). The scoreline was ${aH} - ${aA} (predicted ${pH} - ${pA}).`,
		};
	}

	return {
		points: 0,
		tier: 'miss',
		tierLabel: `${livePrefix}Miss`,
		colorClass: 'text-slate-400',
		badgeBg: 'bg-slate-500/10',
		badgeBorder: 'border-slate-500/20',
		icon: '❌',
		predictedOutcome,
		actualOutcome,
		outcomeMatched: false,
		goalDiffMatched: false,
		exactScoreMatched: false,
		predDiff,
		actualDiff,
		summary: `Outcome miss: Predicted ${predictedOutcome === 'home' ? 'Home Win' : predictedOutcome === 'away' ? 'Away Win' : 'Draw'}, actual was ${actualOutcome === 'home' ? 'Home Win' : actualOutcome === 'away' ? 'Away Win' : 'Draw'}.`,
		details: `Actual result was ${aH} - ${aA}, while your prediction was ${pH} - ${pA} (0 PTS).`,
	};
}

/**
 * Calculates simulated pool standings under a hypothetical scenario of match scores.
 */
export function simulatePoolStandings(
	leaderboard: PoolLeaderboardEntry[],
	predictionsByMember: Record<string, Record<string, Prediction>>,
	matches: Match[],
	simulatedScores: Record<string, { home_score: number; away_score: number }>,
): {
	simulatedLeaderboard: (PoolLeaderboardEntry & {
		originalRank: number;
		rankDelta: number;
		simulatedPoints: number;
		pointsDelta: number;
	})[];
} {
	const memberSimulatedPoints: Record<
		string,
		{ total: number; exactCount: number }
	> = {};

	// Base current points
	leaderboard.forEach((entry) => {
		memberSimulatedPoints[entry.user_id] = {
			total: entry.total_points,
			exactCount: entry.exact_count,
		};
	});

	// For each match in simulatedScores, calculate point differences
	matches.forEach((match) => {
		const sim = simulatedScores[match.id];
		if (!sim) return;

		leaderboard.forEach((member) => {
			const pred = predictionsByMember[member.user_id]?.[match.id];
			if (!pred) return;

			// Current points earned on this match
			const currentEarned =
				match.status === 'finished'
					? calculatePredictionPoints(
							pred.predicted_home_score,
							pred.predicted_away_score,
							match.home_score,
							match.away_score,
						)
					: 0;

			// Simulated points earned
			const simEarned = calculatePredictionPoints(
				pred.predicted_home_score,
				pred.predicted_away_score,
				sim.home_score,
				sim.away_score,
			);

			const diff = simEarned - currentEarned;
			if (memberSimulatedPoints[member.user_id]) {
				memberSimulatedPoints[member.user_id].total += diff;
				if (simEarned === 3 && currentEarned !== 3) {
					memberSimulatedPoints[member.user_id].exactCount += 1;
				} else if (simEarned !== 3 && currentEarned === 3) {
					memberSimulatedPoints[member.user_id].exactCount -= 1;
				}
			}
		});
	});

	// Build and sort simulated leaderboard
	const simulatedList = leaderboard.map((entry) => {
		const simData = memberSimulatedPoints[entry.user_id] || {
			total: entry.total_points,
			exactCount: entry.exact_count,
		};
		return {
			...entry,
			originalRank: entry.rank,
			simulatedPoints: simData.total,
			pointsDelta: simData.total - entry.total_points,
			exact_count: simData.exactCount,
			rank: 0,
			rankDelta: 0,
		};
	});

	// Sort by simulatedPoints descending, then exact_count descending
	simulatedList.sort((a, b) => {
		if (b.simulatedPoints !== a.simulatedPoints) {
			return b.simulatedPoints - a.simulatedPoints;
		}
		return b.exact_count - a.exact_count;
	});

	// Assign new ranks and rankDelta
	simulatedList.forEach((item, index) => {
		item.rank = index + 1;
		item.rankDelta = item.originalRank - item.rank; // Positive means moved up!
	});

	return { simulatedLeaderboard: simulatedList };
}
