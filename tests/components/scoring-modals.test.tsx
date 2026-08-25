vi.mock('canvas-confetti', () => ({
	__esModule: true,
	default: Object.assign(vi.fn(), {
		create: vi.fn(() => vi.fn()),
		reset: vi.fn(),
	}),
}));

vi.mock('@/lib/queries/matches', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/lib/queries/matches')>();
	return {
		...actual,
		fetchMatchCommunityInsights: vi.fn().mockResolvedValue({
			match_id: 'm1',
			is_locked: true,
			total_predictions: 10,
			outcome_distribution: {
				home_win_count: 6,
				draw_count: 2,
				away_win_count: 2,
				home_win_pct: 60,
				draw_pct: 20,
				away_win_pct: 20,
			},
			points_distribution: {
				exact_3pts: 2,
				diff_2pts: 3,
				winner_1pt: 3,
				miss_0pts: 2,
			},
			top_scores: [{ scoreline: '2 - 1', count: 4, percentage: 40 }],
			participants: [],
		}),
	};
});

import { GameweekPerformanceSummary } from '@/components/gameweek-performance-summary';
import { MatchPoolInsightsModal } from '@/components/match-pool-insights-modal';
import { ScoreBreakdownModal } from '@/components/score-breakdown-modal';
import { ScoringRulesModal } from '@/components/scoring-rules-modal';
import { WhatIfScenarioSimulator } from '@/components/what-if-simulator';
import { Match, PoolLeaderboardEntry, Prediction } from '@/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

const mockMatch: Match = {
	id: 'm1',
	tournament_id: 't1',
	matchday: 12,
	round: 'Round 12',
	home_team_id: 'ht1',
	away_team_id: 'at1',
	kickoff_time: new Date(Date.now() - 3600000).toISOString(),
	home_score: 2,
	away_score: 1,
	status: 'finished',
	external_id: 1001,
	created_at: '',
	updated_at: '',
	home_team: {
		id: 'ht1',
		tournament_id: 't1',
		name: 'Arsenal',
		short_name: 'ARS',
		logo_url: 'https://example.com/ars.png',
		external_id: 42,
		created_at: '',
	},
	away_team: {
		id: 'at1',
		tournament_id: 't1',
		name: 'Chelsea',
		short_name: 'CHE',
		logo_url: 'https://example.com/che.png',
		external_id: 49,
		created_at: '',
	},
};

const mockPrediction: Prediction = {
	id: 'p1',
	user_id: 'u1',
	match_id: 'm1',
	predicted_home_score: 2,
	predicted_away_score: 1,
	predicted_winner: 'home',
	points_earned: 3,
	created_at: '',
};

function renderWithClient(ui: React.ReactElement) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
	);
}

describe('Phase 9 Visual Scoring Components', () => {
	describe('ScoreBreakdownModal', () => {
		it('renders exact score breakdown correctly with rule verification steps', () => {
			const handleClose = vi.fn();
			render(
				<ScoreBreakdownModal
					isOpen={true}
					onClose={handleClose}
					match={mockMatch}
					prediction={mockPrediction}
				/>,
			);

			expect(screen.getByText('Scoring Breakdown')).toBeInTheDocument();
			expect(screen.getByText('+3 PTS')).toBeInTheDocument();
			expect(screen.getByText('Exact Score')).toBeInTheDocument();
			expect(screen.getAllByText('HIT (+1)').length).toBe(3);
			expect(
				screen.getByText(
					/You correctly predicted 2 home goals and 1 away goals/,
				),
			).toBeInTheDocument();

			fireEvent.click(screen.getByRole('button', { name: /Close Breakdown/i }));
			expect(handleClose).toHaveBeenCalledTimes(1);
		});

		it('renders HIT and MISS appropriately for partially correct predictions', () => {
			const partialPrediction: Prediction = {
				...mockPrediction,
				predicted_home_score: 3,
				predicted_away_score: 0, // Actual is 2-1: Outcome is Home Win (HIT), Goal Diff is 3 vs 1 (MISS), Exact is 3-0 vs 2-1 (MISS)
				points_earned: 1,
			};

			render(
				<ScoreBreakdownModal
					isOpen={true}
					onClose={vi.fn()}
					match={mockMatch}
					prediction={partialPrediction}
				/>,
			);

			expect(screen.getByText('+1 PTS')).toBeInTheDocument();
			expect(screen.getByText('Winner Only')).toBeInTheDocument();
			expect(screen.getAllByText('HIT (+1)').length).toBe(1);
			expect(screen.getAllByText('MISS').length).toBe(2);
		});

		it('toggles universal rules accordion inside breakdown modal', () => {
			render(
				<ScoreBreakdownModal
					isOpen={true}
					onClose={vi.fn()}
					match={mockMatch}
					prediction={mockPrediction}
				/>,
			);

			const toggleBtn = screen.getByText(
				/How Are Prediction Points Calculated/i,
			);
			fireEvent.click(toggleBtn);

			expect(
				screen.getByText(/Outcome & Goal Difference/i),
			).toBeInTheDocument();
			expect(screen.getByText(/Winner Only/i)).toBeInTheDocument();
		});
	});

	describe('ScoringRulesModal', () => {
		it('renders all 4 scoring rules and interactive sandbox', () => {
			const handleClose = vi.fn();
			render(
				<ScoringRulesModal
					isOpen={true}
					onClose={handleClose}
				/>,
			);

			expect(screen.getByText('Official Scoring Rules')).toBeInTheDocument();
			expect(
				screen.getByText('Interactive Scoring Sandbox'),
			).toBeInTheDocument();
			expect(screen.getAllByText('+3 PTS').length).toBeGreaterThan(0);
			expect(screen.getAllByText('+2 PTS').length).toBeGreaterThan(0);

			fireEvent.click(screen.getByRole('button', { name: /Got It/i }));
			expect(handleClose).toHaveBeenCalledTimes(1);
		});
	});

	describe('GameweekPerformanceSummary', () => {
		it('renders gameweek score stats and points breakdown', () => {
			const map = new Map<string, Prediction>();
			map.set(mockMatch.id, mockPrediction);

			const handleRules = vi.fn();
			const handleSim = vi.fn();

			render(
				<GameweekPerformanceSummary
					matches={[mockMatch]}
					predictionsMap={map}
					matchday={12}
					onOpenRulesModal={handleRules}
					onOpenSimulator={handleSim}
				/>,
			);

			expect(screen.getByText('Matchweek 12 Performance')).toBeInTheDocument();
			expect(screen.getByText('Exact 3-Pointers')).toBeInTheDocument();
			expect(screen.getByText('1 / 1 fixtures predicted')).toBeInTheDocument();

			fireEvent.click(screen.getByRole('button', { name: /Scoring Rules/i }));
			expect(handleRules).toHaveBeenCalledTimes(1);

			fireEvent.click(screen.getByRole('button', { name: /What-If/i }));
			expect(handleSim).toHaveBeenCalledTimes(1);
		});
	});

	describe('WhatIfScenarioSimulator', () => {
		const mockLeaderboard: PoolLeaderboardEntry[] = [
			{
				rank: 1,
				user_id: 'u1',
				username: 'topdog',
				full_name: 'Top Dog',
				avatar_url: null,
				total_points: 20,
				exact_count: 4,
				predictions_count: 10,
				joined_at: '',
			},
			{
				rank: 2,
				user_id: 'u2',
				username: 'challenger',
				full_name: 'Challenger',
				avatar_url: null,
				total_points: 18,
				exact_count: 2,
				predictions_count: 10,
				joined_at: '',
			},
		];

		const mockPredictionsByMember = {
			u1: { [mockMatch.id]: mockPrediction },
			u2: {
				[mockMatch.id]: {
					...mockPrediction,
					id: 'p2',
					user_id: 'u2',
					predicted_home_score: 3,
					predicted_away_score: 0,
				},
			},
		};

		it('renders simulation controls and live projection banner', () => {
			const handleClose = vi.fn();
			render(
				<WhatIfScenarioSimulator
					isOpen={true}
					onClose={handleClose}
					matches={[mockMatch]}
					leaderboard={mockLeaderboard}
					predictionsByMember={mockPredictionsByMember}
					currentUserId="u2"
					poolName="Championship League"
				/>,
			);

			expect(
				screen.getByText('"What-If" Scenario Simulator'),
			).toBeInTheDocument();
			expect(
				screen.getByText(/Simulate standings for Championship League/),
			).toBeInTheDocument();
			expect(screen.getByText('Projected Points')).toBeInTheDocument();

			fireEvent.click(screen.getByRole('button', { name: /Done Simulating/i }));
			expect(handleClose).toHaveBeenCalledTimes(1);
		});
	});

	describe('MatchPoolInsightsModal', () => {
		it('renders modal with match details and community outcome bar', () => {
			const handleClose = vi.fn();
			renderWithClient(
				<MatchPoolInsightsModal
					isOpen={true}
					onClose={handleClose}
					match={mockMatch}
					poolName="Derby Pool"
				/>,
			);

			expect(screen.getByText('Derby Pool Insights')).toBeInTheDocument();
			expect(
				screen.getByText('Arsenal vs Chelsea • Matchweek 12'),
			).toBeInTheDocument();
		});
	});
});
