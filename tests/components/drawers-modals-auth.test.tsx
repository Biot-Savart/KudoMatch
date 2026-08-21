import { AuthCard } from '@/components/auth-card';
import { CreatePoolModal } from '@/components/create-pool-modal';
import { JoinPoolModal } from '@/components/join-pool-modal';
import { PredictionDrawer } from '@/components/prediction-drawer';
import { QueryProvider } from '@/components/query-provider';
import * as poolsQueries from '@/lib/queries/pools';
import * as predictionsQueries from '@/lib/queries/predictions';
import { Match } from '@/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockSupabaseClient } = globalThis as any;

describe('components/prediction-drawer', () => {
	const mockMatch: Match = {
		id: 'match-1',
		tournament_id: 't-1',
		matchday: 12,
		round: 'Regular Season',
		home_team_id: 'team-a',
		away_team_id: 'team-b',
		kickoff_time: new Date().toISOString(),
		home_score: null,
		away_score: null,
		status: 'scheduled',
		external_id: 1,
		created_at: '',
		updated_at: '',
		home_team: {
			id: 'team-a',
			name: 'Arsenal',
			short_name: 'ARS',
			logo_url: null,
			external_id: 1,
			created_at: '',
			tournament_id: 't-1',
		},
		away_team: {
			id: 'team-b',
			name: 'Chelsea',
			short_name: 'CHE',
			logo_url: null,
			external_id: 2,
			created_at: '',
			tournament_id: 't-1',
		},
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders correctly and handles score increment/decrement and saving', async () => {
		const handleClose = vi.fn();
		const upsertSpy = vi
			.spyOn(predictionsQueries, 'upsertPrediction')
			.mockResolvedValue({
				id: 'p-1',
				user_id: 'user-1',
				match_id: 'match-1',
				predicted_home_score: 1,
				predicted_away_score: 0,
				predicted_winner: 'home',
				points_earned: 0,
				created_at: '',
			});

		render(
			<QueryProvider>
				<PredictionDrawer
					isOpen={true}
					onClose={handleClose}
					match={mockMatch}
					userId="user-1"
				/>
			</QueryProvider>,
		);

		expect(screen.getByText('Arsenal')).toBeInTheDocument();
		expect(screen.getByText('Chelsea')).toBeInTheDocument();

		// Increment home goals
		const incrementButtons = screen.getAllByRole('button');
		// Button list: close (idx 0), home-minus (idx 1), home-plus (idx 2), away-minus (idx 3), away-plus (idx 4)
		await userEvent.click(incrementButtons[2]); // click home plus
		expect(screen.getByText('1')).toBeInTheDocument();

		// Trigger save
		const saveButton = screen.getByRole('button', { name: /save prediction/i });
		await userEvent.click(saveButton);

		expect(upsertSpy).toHaveBeenCalledWith('user-1', 'match-1', 1, 0);
	});
});

describe('components/create-pool-modal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('submits correctly on valid pool creation input', async () => {
		const handleClose = vi.fn();
		const handleSuccess = vi.fn();
		const createPoolSpy = vi
			.spyOn(poolsQueries, 'createPool')
			.mockResolvedValue({
				id: 'new-pool-1',
				name: 'Super Pool',
				description: 'Cool pool',
				invite_code: 'ABCDEF',
				creator_id: 'user-1',
				is_public: true,
				created_at: '',
			});

		render(
			<CreatePoolModal
				isOpen={true}
				onClose={handleClose}
				onSuccess={handleSuccess}
				userId="user-1"
			/>,
		);

		// Enter details
		const nameInput = screen.getByLabelText(/pool name/i);
		const descInput = screen.getByLabelText(/description/i);
		const publicCheckbox = screen.getByLabelText(/make pool public/i);

		await userEvent.type(nameInput, 'Super Pool');
		await userEvent.type(descInput, 'Cool pool');
		await userEvent.click(publicCheckbox);

		// Submit
		const submitBtn = screen.getByRole('button', { name: /create pool/i });
		await userEvent.click(submitBtn);

		expect(createPoolSpy).toHaveBeenCalledWith(
			'user-1',
			'Super Pool',
			'Cool pool',
			true,
		);
		expect(handleSuccess).toHaveBeenCalledWith('new-pool-1');
	});

	it('renders validation error for short pool name', async () => {
		render(
			<CreatePoolModal
				isOpen={true}
				onClose={vi.fn()}
				onSuccess={vi.fn()}
				userId="user-1"
			/>,
		);

		const nameInput = screen.getByLabelText(/pool name/i);
		await userEvent.type(nameInput, 'ab');

		const submitBtn = screen.getByRole('button', { name: /create pool/i });
		await userEvent.click(submitBtn);

		expect(
			screen.getByText('Pool name must be at least 3 characters.'),
		).toBeInTheDocument();
	});
});

describe('components/join-pool-modal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('joins correctly with valid code', async () => {
		const handleSuccess = vi.fn();
		const joinPoolSpy = vi
			.spyOn(poolsQueries, 'joinPoolByCode')
			.mockResolvedValue({
				success: true,
				pool_id: 'pool-42',
				name: 'Alpha League',
			});

		render(
			<JoinPoolModal
				isOpen={true}
				onClose={vi.fn()}
				onSuccess={handleSuccess}
			/>,
		);

		const input = screen.getByPlaceholderText(/e\.g\., abcdef/i);
		await userEvent.type(input, 'ABCDEF');

		const submitBtn = screen.getByRole('button', { name: /join pool/i });
		await userEvent.click(submitBtn);

		expect(joinPoolSpy).toHaveBeenCalledWith('ABCDEF');
		expect(handleSuccess).toHaveBeenCalledWith('pool-42', 'Alpha League');
	});

	it('renders error message when joining fails', async () => {
		vi.spyOn(poolsQueries, 'joinPoolByCode').mockResolvedValue({
			success: false,
			error: 'Invalid or expired invite code.',
		});

		render(
			<JoinPoolModal
				isOpen={true}
				onClose={vi.fn()}
				onSuccess={vi.fn()}
			/>,
		);

		const input = screen.getByPlaceholderText(/e\.g\., abcdef/i);
		await userEvent.type(input, 'WRONGG');

		const submitBtn = screen.getByRole('button', { name: /join pool/i });
		await userEvent.click(submitBtn);

		expect(
			screen.getByText('Invalid or expired invite code.'),
		).toBeInTheDocument();
	});
});

describe('components/auth-card', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('handles user login submission successfully', async () => {
		(mockSupabaseClient.auth.signInWithPassword as any).mockResolvedValueOnce({
			data: {},
			error: null,
		});

		render(<AuthCard mode="login" />);

		const emailInput = screen.getByLabelText(/email address/i);
		const passwordInput = screen.getByLabelText(/password/i);

		await userEvent.type(emailInput, 'kudo@match.com');
		await userEvent.type(passwordInput, 'secret123');

		const submitBtn = screen.getByRole('button', { name: /sign in/i });
		await userEvent.click(submitBtn);

		expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
			email: 'kudo@match.com',
			password: 'secret123',
		});
	});

	it('handles user signup submission successfully', async () => {
		(mockSupabaseClient.auth.signUp as any).mockResolvedValueOnce({
			data: { session: null },
			error: null,
		});

		render(<AuthCard mode="signup" />);

		const nameInput = screen.getByLabelText(/full name/i);
		const emailInput = screen.getByLabelText(/email address/i);
		const passwordInput = screen.getByLabelText(/password/i);

		await userEvent.type(nameInput, 'Kudo Champion');
		await userEvent.type(emailInput, 'kudo@match.com');
		await userEvent.type(passwordInput, 'secret123');

		const submitBtn = screen.getByRole('button', { name: /create account/i });
		await userEvent.click(submitBtn);

		expect(mockSupabaseClient.auth.signUp).toHaveBeenCalled();
		expect(
			screen.getByText(/check your email for the confirmation link/i),
		).toBeInTheDocument();
	});

	it('shows error if full name is empty on signup', async () => {
		render(<AuthCard mode="signup" />);

		const submitBtn = screen.getByRole('button', { name: /create account/i });
		await userEvent.click(submitBtn);

		expect(screen.getByText('Full name is required')).toBeInTheDocument();
	});

	it('handles OAuth login button click', async () => {
		render(<AuthCard mode="login" />);

		const googleBtn = screen.getByRole('button', {
			name: /continue with google/i,
		});
		await userEvent.click(googleBtn);

		expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
			provider: 'google',
			options: {
				redirectTo: 'http://localhost:3000/auth/callback',
			},
		});
	});
});
