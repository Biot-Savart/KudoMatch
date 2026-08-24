import {
	calculatePredictionPoints,
	getScoringExplanation,
	simulatePoolStandings,
} from '@/lib/utils/scoring';
import { Match, PoolLeaderboardEntry, Prediction } from '@/types';

describe('Scoring Logic Utilities (lib/utils/scoring.ts)', () => {
	describe('calculatePredictionPoints', () => {
		it('returns 3 points for exact scoreline hit', () => {
			expect(calculatePredictionPoints(2, 1, 2, 1)).toBe(3);
			expect(calculatePredictionPoints(0, 0, 0, 0)).toBe(3);
			expect(calculatePredictionPoints(3, 3, 3, 3)).toBe(3);
		});

		it('returns 2 points for correct outcome with matching goal difference', () => {
			// Home Win: +2 goal difference
			expect(calculatePredictionPoints(2, 0, 3, 1)).toBe(2);
			// Away Win: -1 goal difference
			expect(calculatePredictionPoints(1, 2, 0, 1)).toBe(2);
			// Draw: 0 goal difference
			expect(calculatePredictionPoints(1, 1, 2, 2)).toBe(2);
		});

		it('returns 1 point for correct outcome with different goal difference', () => {
			// Home Win: predicted +1 diff, actual was +3 diff
			expect(calculatePredictionPoints(2, 1, 4, 1)).toBe(1);
			// Away Win: predicted -2 diff, actual was -1 diff
			expect(calculatePredictionPoints(0, 2, 1, 2)).toBe(1);
		});

		it('returns 0 points for incorrect outcome', () => {
			// Predicted Home win, actual was Draw
			expect(calculatePredictionPoints(2, 1, 1, 1)).toBe(0);
			// Predicted Home win, actual was Away win
			expect(calculatePredictionPoints(3, 1, 0, 2)).toBe(0);
			// Predicted Draw, actual was Home win
			expect(calculatePredictionPoints(2, 2, 1, 0)).toBe(0);
		});

		it('handles null and undefined values safely with 0 points', () => {
			expect(calculatePredictionPoints(null, 1, 2, 1)).toBe(0);
			expect(calculatePredictionPoints(2, undefined, 2, 1)).toBe(0);
			expect(calculatePredictionPoints(2, 1, null, null)).toBe(0);
		});
	});

	describe('getScoringExplanation', () => {
		it('provides detailed explanation for exact score', () => {
			const res = getScoringExplanation(2, 1, 2, 1, 'finished');
			expect(res.points).toBe(3);
			expect(res.tier).toBe('exact');
			expect(res.exactScoreMatched).toBe(true);
			expect(res.outcomeMatched).toBe(true);
			expect(res.goalDiffMatched).toBe(true);
		});

		it('provides detailed explanation for outcome & diff', () => {
			const res = getScoringExplanation(2, 0, 4, 2, 'finished');
			expect(res.points).toBe(2);
			expect(res.tier).toBe('diff');
			expect(res.exactScoreMatched).toBe(false);
			expect(res.goalDiffMatched).toBe(true);
			expect(res.outcomeMatched).toBe(true);
		});

		it('provides detailed explanation for winner only', () => {
			const res = getScoringExplanation(2, 1, 4, 0, 'finished');
			expect(res.points).toBe(1);
			expect(res.tier).toBe('winner');
			expect(res.exactScoreMatched).toBe(false);
			expect(res.goalDiffMatched).toBe(false);
			expect(res.outcomeMatched).toBe(true);
		});

		it('handles unscored / unstarted matches safely', () => {
			const res = getScoringExplanation(null, null, null, null, 'scheduled');
			expect(res.points).toBe(0);
			expect(res.tier).toBe('unscored');
		});
	});

	describe('simulatePoolStandings', () => {
		const mockLeaderboard: PoolLeaderboardEntry[] = [
			{
				rank: 1,
				user_id: 'u1',
				username: 'alice',
				full_name: 'Alice W',
				avatar_url: null,
				total_points: 10,
				exact_count: 2,
				predictions_count: 5,
				joined_at: '',
			},
			{
				rank: 2,
				user_id: 'u2',
				username: 'bob',
				full_name: 'Bob T',
				avatar_url: null,
				total_points: 9,
				exact_count: 1,
				predictions_count: 5,
				joined_at: '',
			},
		];

		const mockMatches: Match[] = [
			{
				id: 'm1',
				tournament_id: 't1',
				matchday: 12,
				round: 'Round 12',
				home_team_id: 'ht1',
				away_team_id: 'at1',
				kickoff_time: new Date().toISOString(),
				home_score: 1,
				away_score: 1,
				status: 'live',
				external_id: 101,
				created_at: '',
				updated_at: '',
			},
		];

		const mockPredictions: Record<string, Record<string, Prediction>> = {
			u1: {
				m1: {
					id: 'p1',
					user_id: 'u1',
					match_id: 'm1',
					predicted_home_score: 0,
					predicted_away_score: 1,
					predicted_winner: 'away',
					points_earned: 0,
					created_at: '',
				},
			},
			u2: {
				m1: {
					id: 'p2',
					user_id: 'u2',
					match_id: 'm1',
					predicted_home_score: 2,
					predicted_away_score: 1,
					predicted_winner: 'home',
					points_earned: 0,
					created_at: '',
				},
			},
		};

		it('simulates rank movement accurately when match scores change', () => {
			// If match ends 2-1: Bob (u2) gets exact 3 pts (9+3 = 12), Alice (u1) predicted 0-1 (0 pts, stays 10) -> Bob overtakes Alice!
			const result = simulatePoolStandings(
				mockLeaderboard,
				mockPredictions,
				mockMatches,
				{
					m1: { home_score: 2, away_score: 1 },
				},
			);

			const bob = result.simulatedLeaderboard.find((x) => x.user_id === 'u2');
			const alice = result.simulatedLeaderboard.find((x) => x.user_id === 'u1');

			expect(bob?.simulatedPoints).toBe(12);
			expect(bob?.rank).toBe(1);
			expect(bob?.rankDelta).toBe(1); // moved from rank 2 to 1 (+1)

			expect(alice?.simulatedPoints).toBe(10);
			expect(alice?.rank).toBe(2);
			expect(alice?.rankDelta).toBe(-1); // moved from rank 1 to 2 (-1)
		});
	});
});
