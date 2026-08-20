import PoolDetailPage from '@/app/leagues/[id]/page';
import LeaguesPage from '@/app/leagues/page';
import LoginPage from '@/app/login/page';
import Dashboard from '@/app/page';
import PredictPage from '@/app/predict/page';
import ProfilePage from '@/app/profile/page';
import ResetPasswordPage from '@/app/reset-password/page';
import SignupPage from '@/app/signup/page';
import { QueryProvider } from '@/components/query-provider';
import * as matchesQueries from '@/lib/queries/matches';
import * as poolsQueries from '@/lib/queries/pools';
import * as predictionsQueries from '@/lib/queries/predictions';
import { act, render, screen } from '@testing-library/react';

const { mockSupabaseClient } = globalThis as any;

// Mock useParams
vi.mock('next/navigation', async () => {
	const actual = await vi.importActual('next/navigation');
	return {
		...actual,
		useRouter: () => ({
			push: vi.fn(),
			replace: vi.fn(),
			prefetch: vi.fn(),
			refresh: vi.fn(),
		}),
		usePathname: () => '/',
		useSearchParams: () => ({
			get: vi.fn(),
		}),
		useParams: () => ({ id: 'pool-123' }),
	};
});

describe('App Router Pages', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Dashboard Home (app/page.tsx)', () => {
		it('renders dashboard with featured matches and widgets correctly', async () => {
			vi.spyOn(matchesQueries, 'fetchMatches').mockResolvedValue([
				{
					id: 'm-1',
					tournament_id: 't-1',
					matchday: 12,
					round: 'Round 12',
					home_team_id: 't-a',
					away_team_id: 't-b',
					kickoff_time: new Date().toISOString(),
					home_score: null,
					away_score: null,
					status: 'scheduled',
					external_id: 1,
					created_at: '',
					updated_at: '',
					home_team: {
						id: 't-a',
						name: 'Man United',
						short_name: 'MUN',
						logo_url: null,
						external_id: 1,
						created_at: '',
						tournament_id: 't-1',
					},
					away_team: {
						id: 't-b',
						name: 'Liverpool',
						short_name: 'LIV',
						logo_url: null,
						external_id: 2,
						created_at: '',
						tournament_id: 't-1',
					},
				},
			]);
			vi.spyOn(predictionsQueries, 'fetchUserPredictions').mockResolvedValue(
				[],
			);

			await act(async () => {
				render(
					<QueryProvider>
						<Dashboard />
					</QueryProvider>,
				);
			});

			expect(screen.getByText('Man United')).toBeInTheDocument();
			expect(screen.getByText('Liverpool')).toBeInTheDocument();
		});
	});

	describe('Predict Page (app/predict/page.tsx)', () => {
		it('renders predict page and lists games', async () => {
			vi.spyOn(matchesQueries, 'fetchMatches').mockResolvedValue([]);
			vi.spyOn(predictionsQueries, 'fetchUserPredictions').mockResolvedValue(
				[],
			);

			await act(async () => {
				render(
					<QueryProvider>
						<PredictPage />
					</QueryProvider>,
				);
			});

			expect(screen.getByText('Premier League Predictor')).toBeInTheDocument();
		});
	});

	describe('Leagues Page (app/leagues/page.tsx)', () => {
		it('renders leagues and pools correctly', async () => {
			(mockSupabaseClient.auth.getUser as any).mockResolvedValue({
				data: { user: { id: 'user-123' } },
				error: null,
			});
			vi.spyOn(poolsQueries, 'fetchUserPools').mockResolvedValue([
				{
					pool_id: 'pool-123',
					user_id: 'user-123',
					role: 'creator',
					joined_at: '',
					pool: {
						id: 'pool-123',
						name: 'Elite Prediction League',
						description: 'Where champions predict',
						invite_code: 'XYZ123',
						creator_id: 'user-123',
						is_public: true,
						created_at: '',
					},
				},
			]);

			await act(async () => {
				render(
					<QueryProvider>
						<LeaguesPage />
					</QueryProvider>,
				);
			});

			expect(screen.getByText('Elite Prediction League')).toBeInTheDocument();
			expect(screen.getByText('Where champions predict')).toBeInTheDocument();
		});
	});

	describe('Pool Detail Page (app/leagues/[id]/page.tsx)', () => {
		it('renders pool standings and members leaderboard', async () => {
			vi.spyOn(poolsQueries, 'fetchPoolDetails').mockResolvedValue({
				id: 'pool-123',
				name: 'Elite Pool',
				description: 'Elite predictions',
				invite_code: 'CODE123',
				creator_id: 'user-123',
				is_public: true,
				created_at: '',
			});
			vi.spyOn(poolsQueries, 'fetchPoolLeaderboard').mockResolvedValue([
				{
					rank: 1,
					user_id: 'user-123',
					username: 'kudochamp',
					full_name: 'Kudo Champ',
					avatar_url: null,
					total_points: 30,
					exact_count: 10,
					predictions_count: 12,
					joined_at: new Date().toISOString(),
				},
			]);
			vi.spyOn(poolsQueries, 'fetchPoolMembers').mockResolvedValue([]);
			vi.spyOn(poolsQueries, 'fetchPoolPicksMatrix').mockResolvedValue({
				matches: [],
				predictions: {},
			});

			await act(async () => {
				render(
					<QueryProvider>
						<PoolDetailPage />
					</QueryProvider>,
				);
			});

			expect(screen.getByText('Elite Pool')).toBeInTheDocument();
			expect(screen.getByText('Kudo Champ')).toBeInTheDocument();
		});
	});

	describe('Login & Signup & Reset Password Pages', () => {
		it('renders Auth containers properly', () => {
			const { container: loginC } = render(<LoginPage />);
			expect(loginC.firstChild).toBeDefined();

			const { container: signupC } = render(<SignupPage />);
			expect(signupC.firstChild).toBeDefined();

			const { container: resetC } = render(<ResetPasswordPage />);
			expect(resetC.firstChild).toBeDefined();
		});
	});

	describe('Profile Page (app/profile/page.tsx)', () => {
		it('renders user profile and historical stats correctly', async () => {
			const mockUser = { id: 'user-123', email: 'user@example.com' };
			const mockProfile = {
				id: 'user-123',
				username: 'predictor_pro',
				full_name: 'Predictor Pro',
				total_points: 120,
				avatar_url: null,
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
						single: vi
							.fn()
							.mockResolvedValue({ data: mockProfile, error: null }),
					}) as any,
			);
			vi.spyOn(
				predictionsQueries,
				'fetchUserPredictionsWithMatches',
			).mockResolvedValue([]);

			await act(async () => {
				render(
					<QueryProvider>
						<ProfilePage />
					</QueryProvider>,
				);
			});

			expect(screen.getByText('Predictor Pro')).toBeInTheDocument();
			expect(screen.getByText('@predictor_pro')).toBeInTheDocument();
		});
	});
});
