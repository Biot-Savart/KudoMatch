import { BottomNav } from '@/components/bottom-nav';
import { MatchCard } from '@/components/match-card';
import { Navbar } from '@/components/navbar';
import { QueryProvider } from '@/components/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { Match, Prediction } from '@/types';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockSupabaseClient } = globalThis as any;

describe('components/bottom-nav', () => {
	it('renders bottom navigation with correct tabs', () => {
		const usePathnameMock = require('next/navigation').usePathname;
		usePathnameMock.mockReturnValue('/');

		render(<BottomNav />);
		expect(screen.getByText('Dashboard')).toBeInTheDocument();
		expect(screen.getByText('Predict')).toBeInTheDocument();
		expect(screen.getByText('Pools')).toBeInTheDocument();
		expect(screen.getByText('Profile')).toBeInTheDocument();
	});

	it('renders null on auth routes (login/signup)', () => {
		const usePathnameMock = require('next/navigation').usePathname;
		usePathnameMock.mockReturnValue('/login');

		const { container } = render(<BottomNav />);
		expect(container.firstChild).toBeNull();
	});
});

describe('components/navbar', () => {
	let subCallback: any;

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock subscription
		(mockSupabaseClient as any).channel = vi.fn().mockImplementation(() => ({
			on: vi.fn().mockImplementation((event, filter, cb) => {
				subCallback = cb;
				return {
					subscribe: vi.fn(),
				};
			}),
		})) as any;
	});

	it('renders navbar for anonymous user correctly', async () => {
		const usePathnameMock = require('next/navigation').usePathname;
		usePathnameMock.mockReturnValue('/');
		(mockSupabaseClient.auth.getUser as any).mockResolvedValue({
			data: { user: null },
			error: null,
		});

		await act(async () => {
			render(<Navbar />);
		});

		expect(screen.getByText('Kudo')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
	});

	it('renders navbar for logged-in user and handles menu toggle and sign out', async () => {
		const usePathnameMock = require('next/navigation').usePathname;
		usePathnameMock.mockReturnValue('/');

		const mockUser = { id: 'user-123', email: 'user@example.com' };
		const mockProfile = {
			id: 'user-123',
			username: 'kudoman',
			full_name: 'Kudo Man',
			total_points: 15,
		};

		(mockSupabaseClient.auth.getUser as any).mockResolvedValue({
			data: { user: mockUser },
			error: null,
		});
		vi.spyOn(mockSupabaseClient, 'from').mockImplementation(
			() =>
				({
					select: vi.fn().mockReturnThis(),
					eq: vi.fn().mockReturnThis(),
					single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
				}) as any,
		);

		await act(async () => {
			render(<Navbar />);
		});

		expect(screen.getByText('15 pts')).toBeInTheDocument();

		// Trigger dropdown toggle
		const dropdownBtn = screen.getByRole('button', { name: /ku/i });
		await userEvent.click(dropdownBtn);

		expect(screen.getByText('Kudo Man')).toBeInTheDocument();
		expect(screen.getByText('@kudoman')).toBeInTheDocument();

		// Trigger Sign Out
		const signOutBtn = screen.getByRole('button', { name: /sign out/i });
		await userEvent.click(signOutBtn);
		expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();

		// Test real-time payload update
		if (subCallback) {
			act(() => {
				subCallback({ new: { ...mockProfile, total_points: 20 } });
			});
			expect(screen.getByText('20 pts')).toBeInTheDocument();
		}
	});

	it('renders null on auth routes', async () => {
		const usePathnameMock = require('next/navigation').usePathname;
		usePathnameMock.mockReturnValue('/login');

		const { container } = render(<Navbar />);
		expect(container.firstChild).toBeNull();
	});
});

describe('components/query-provider', () => {
	it('renders child components correctly', () => {
		render(
			<QueryProvider>
				<div>Query Child</div>
			</QueryProvider>,
		);
		expect(screen.getByText('Query Child')).toBeInTheDocument();
	});
});

describe('components/theme-provider', () => {
	it('renders theme provider child component', () => {
		render(
			<ThemeProvider attribute="class">
				<div>Theme Child</div>
			</ThemeProvider>,
		);
		expect(screen.getByText('Theme Child')).toBeInTheDocument();
	});
});

describe('components/match-card', () => {
	const mockTeamA = {
		id: 'team-a',
		name: 'Team Alpha',
		short_name: 'ALP',
		logo_url: '/logo-a.png',
		external_id: 1,
		created_at: '',
		tournament_id: 't-1',
	};
	const mockTeamB = {
		id: 'team-b',
		name: 'Team Beta',
		short_name: 'BET',
		logo_url: '/logo-b.png',
		external_id: 2,
		created_at: '',
		tournament_id: 't-1',
	};

	const mockMatch: Match = {
		id: 'match-1',
		tournament_id: 't-1',
		matchday: 12,
		round: 'Regular Season - 12',
		home_team_id: 'team-a',
		away_team_id: 'team-b',
		kickoff_time: new Date(Date.now() + 1000 * 600).toISOString(), // Scheduled in 10 mins
		home_score: null,
		away_score: null,
		status: 'scheduled',
		external_id: 101,
		created_at: '',
		updated_at: '',
		home_team: mockTeamA,
		away_team: mockTeamB,
	};

	it('renders scheduled match countdown, handles quick predicts', async () => {
		const handlePredict = vi.fn();
		const handleQuickPredict = vi.fn();

		render(
			<MatchCard
				match={mockMatch}
				userId="user-123"
				onPredict={handlePredict}
				onQuickPredict={handleQuickPredict}
			/>,
		);

		expect(screen.getByText('Team Alpha')).toBeInTheDocument();
		expect(screen.getByText('Team Beta')).toBeInTheDocument();

		// Predict button click
		const predictBtn = screen.getByRole('button', { name: /predict/i });
		await userEvent.click(predictBtn);
		expect(handlePredict).toHaveBeenCalledWith(mockMatch);

		// Quick selection click options
		const homeBtn = screen.getByText('1');
		await userEvent.click(homeBtn);
		expect(handleQuickPredict).toHaveBeenCalledWith('match-1', 2, 1);

		const drawBtn = screen.getByText('X');
		await userEvent.click(drawBtn);
		expect(handleQuickPredict).toHaveBeenCalledWith('match-1', 1, 1);

		const awayBtn = screen.getByText('2');
		await userEvent.click(awayBtn);
		expect(handleQuickPredict).toHaveBeenCalledWith('match-1', 1, 2);
	});

	it('renders finished match score and points awarded', () => {
		const mockFinishedMatch: Match = {
			...mockMatch,
			status: 'finished',
			home_score: 3,
			away_score: 1,
		};

		const mockPrediction: Prediction = {
			id: 'pred-1',
			user_id: 'user-123',
			match_id: 'match-1',
			predicted_home_score: 3,
			predicted_away_score: 1,
			predicted_winner: 'home',
			points_earned: 3,
			created_at: '',
		};

		render(
			<MatchCard
				match={mockFinishedMatch}
				userId="user-123"
				existingPrediction={mockPrediction}
				onPredict={vi.fn()}
				onQuickPredict={vi.fn()}
			/>,
		);

		// Verify actual finished scores
		expect(screen.getByText('3')).toBeInTheDocument();
		expect(screen.getByText('1')).toBeInTheDocument();
		// Verify +3 PTS badge
		expect(screen.getByText('+3 PTS')).toBeInTheDocument();
		expect(screen.getByText('Exact Score')).toBeInTheDocument();
	});
});
