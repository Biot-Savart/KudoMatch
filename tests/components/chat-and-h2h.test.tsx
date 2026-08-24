import HeadToHead from '@/components/head-to-head';
import PoolChat from '@/components/pool-chat';
import { QueryProvider } from '@/components/query-provider';
import * as chatQueries from '@/lib/queries/chat';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
	createClient: vi.fn(() => (globalThis as any).mockSupabaseClient),
}));

describe('components/head-to-head', () => {
	const mockLeaderboard = [
		{
			rank: 1,
			user_id: 'user-me',
			username: 'current_user',
			full_name: 'Me',
			avatar_url: null,
			total_points: 30,
			exact_count: 5,
			predictions_count: 10,
			joined_at: '',
		},
		{
			rank: 2,
			user_id: 'user-opp',
			username: 'opponent_user',
			full_name: 'Opponent',
			avatar_url: null,
			total_points: 20,
			exact_count: 3,
			predictions_count: 10,
			joined_at: '',
		},
	];

	const mockMembers = [
		{
			pool_id: 'pool-1',
			user_id: 'user-me',
			role: 'member' as const,
			joined_at: '',
		},
		{
			pool_id: 'pool-1',
			user_id: 'user-opp',
			role: 'member' as const,
			joined_at: '',
		},
	];

	const mockMatrix = {
		matches: [
			{
				id: 'match-1',
				tournament_id: 't-1',
				matchday: 12,
				round: 'Week 12',
				home_team_id: 'team-h',
				away_team_id: 'team-a',
				kickoff_time: new Date(Date.now() - 3600000).toISOString(),
				home_score: 2,
				away_score: 1,
				status: 'finished' as const,
				external_id: 1,
				created_at: '',
				updated_at: '',
				home_team: {
					id: 'team-h',
					name: 'Arsenal',
					short_name: 'ARS',
					logo_url: null,
					tournament_id: 't-1',
					external_id: 1,
					created_at: '',
				},
				away_team: {
					id: 'team-a',
					name: 'Chelsea',
					short_name: 'CHE',
					logo_url: null,
					tournament_id: 't-1',
					external_id: 2,
					created_at: '',
				},
			},
		],
		predictions: {
			'user-me': {
				'match-1': {
					id: 'pred-me',
					user_id: 'user-me',
					match_id: 'match-1',
					predicted_home_score: 2,
					predicted_away_score: 1,
					predicted_winner: 'home' as const,
					points_earned: 3,
					created_at: '',
				},
			},
			'user-opp': {
				'match-1': {
					id: 'pred-opp',
					user_id: 'user-opp',
					match_id: 'match-1',
					predicted_home_score: 1,
					predicted_away_score: 1,
					predicted_winner: 'draw' as const,
					points_earned: 0,
					created_at: '',
				},
			},
		},
	};

	it('renders Head-to-Head matchup between me and selected opponent', () => {
		render(
			<HeadToHead
				poolId="pool-1"
				currentUserId="user-me"
				leaderboard={mockLeaderboard}
				members={mockMembers}
				matrixData={mockMatrix}
				defaultOpponentId="user-opp"
			/>,
		);

		expect(screen.getByText('@current_user')).toBeInTheDocument();
		expect(screen.getAllByText('@opponent_user').length).toBeGreaterThan(0);
		expect(
			screen.getByText('Overall League Stats Comparison'),
		).toBeInTheDocument();
		expect(screen.getByText('30 pts')).toBeInTheDocument();
		expect(screen.getByText('20 pts')).toBeInTheDocument();
		expect(
			screen.getByText('Active Week Predictor Battles'),
		).toBeInTheDocument();
		expect(screen.getByText('Arsenal vs Chelsea')).toBeInTheDocument();
	});
});

describe('components/pool-chat', () => {
	const mockMessages = [
		{
			id: 'msg-1',
			pool_id: 'pool-1',
			user_id: 'user-me',
			message: 'Arsenal will win 3-0!',
			created_at: new Date().toISOString(),
			profile: {
				id: 'user-me',
				username: 'me_user',
				full_name: 'Me',
				avatar_url: null,
				total_points: 10,
				created_at: '',
				updated_at: '',
			},
		},
		{
			id: 'msg-2',
			pool_id: 'pool-1',
			user_id: 'user-other',
			message: 'No way, Chelsea is winning!',
			created_at: new Date().toISOString(),
			profile: {
				id: 'user-other',
				username: 'other_user',
				full_name: 'Other',
				avatar_url: null,
				total_points: 5,
				created_at: '',
				updated_at: '',
			},
		},
	];

	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();

		vi.spyOn(chatQueries, 'fetchPoolMessages').mockResolvedValue(mockMessages);
		vi.spyOn(chatQueries, 'sendPoolMessage').mockResolvedValue(mockMessages[0]);
		vi.spyOn(chatQueries, 'deletePoolMessage').mockResolvedValue(true);

		(globalThis as any).mockSupabaseClient.channel = vi
			.fn()
			.mockImplementation(() => ({
				on: vi.fn().mockReturnThis(),
				subscribe: vi.fn().mockImplementation((cb) => {
					if (cb) cb('SUBSCRIBED');
					return { unsubscribe: vi.fn() };
				}),
			}));
		(globalThis as any).mockSupabaseClient.removeChannel = vi
			.fn()
			.mockReturnValue(true);
	});

	it('renders pool banter room and displays messages once loaded', async () => {
		render(
			<QueryProvider>
				<PoolChat
					poolId="pool-1"
					userId="user-me"
					username="me_user"
					isCreator={false}
				/>
			</QueryProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText('Live Pool Banter Room')).toBeInTheDocument();
		});

		expect(screen.getByText('Arsenal will win 3-0!')).toBeInTheDocument();
		expect(screen.getByText('No way, Chelsea is winning!')).toBeInTheDocument();
		expect(screen.getByText('@me_user')).toBeInTheDocument();
		expect(screen.getByText('@other_user')).toBeInTheDocument();
	});

	it('allows user to type and send a chat message', async () => {
		const user = userEvent.setup();

		render(
			<QueryProvider>
				<PoolChat
					poolId="pool-1"
					userId="user-me"
					username="me_user"
					isCreator={false}
				/>
			</QueryProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText('Live Pool Banter Room')).toBeInTheDocument();
		});

		const input = screen.getByPlaceholderText('Throw some banter...');
		await user.type(input, 'My new prediction pick!');

		const submitBtn = screen.getByRole('button', { name: '' });
		await user.click(submitBtn);

		expect(chatQueries.sendPoolMessage).toHaveBeenCalledWith(
			'pool-1',
			'user-me',
			'My new prediction pick!',
		);
	});

	it('allows deleting messages when user is creator or owner', async () => {
		window.confirm = vi.fn().mockReturnValue(true);
		const user = userEvent.setup();

		render(
			<QueryProvider>
				<PoolChat
					poolId="pool-1"
					userId="user-me"
					username="me_user"
					isCreator={true}
				/>
			</QueryProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText('Live Pool Banter Room')).toBeInTheDocument();
		});

		const deleteButtons = screen.getAllByTitle('Delete message');
		expect(deleteButtons.length).toBeGreaterThanOrEqual(1);

		await user.click(deleteButtons[0]);
		expect(chatQueries.deletePoolMessage).toHaveBeenCalledWith('msg-1');
	});
});
