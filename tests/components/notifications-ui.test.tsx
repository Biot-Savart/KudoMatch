import { NotificationSettings } from '@/components/notification-settings';
import { QueryProvider } from '@/components/query-provider';
import * as notifQueries from '@/lib/queries/notifications';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/supabase/client', () => ({
	createClient: vi.fn(() => (globalThis as any).mockSupabaseClient),
}));

describe('components/notification-settings', () => {
	const defaultPrefs = {
		user_id: 'user-1',
		kickoff_warnings: true,
		match_results: true,
		weekly_digest: true,
		email_notifications: true,
		push_notifications: false,
	};

	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		vi.spyOn(notifQueries, 'fetchNotificationPreferences').mockResolvedValue(
			defaultPrefs,
		);
		vi.spyOn(notifQueries, 'updateNotificationPreferences').mockResolvedValue(
			defaultPrefs,
		);
	});

	it('renders notification options and toggle switches', async () => {
		render(
			<QueryProvider>
				<NotificationSettings userId="user-1" />
			</QueryProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText('Notification Alerts')).toBeInTheDocument();
		});

		expect(screen.getByText('Matchday Kickoff Reminders')).toBeInTheDocument();
		expect(screen.getByText('Match Results & Points')).toBeInTheDocument();
		expect(screen.getByText('Weekly Gameweek Digest')).toBeInTheDocument();
		expect(screen.getByText('Email Channel Delivery')).toBeInTheDocument();
	});

	it('toggles preference switch and calls updateNotificationPreferences', async () => {
		const user = userEvent.setup();

		render(
			<QueryProvider>
				<NotificationSettings userId="user-1" />
			</QueryProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText('Notification Alerts')).toBeInTheDocument();
		});

		const switches = screen.getAllByRole('switch');
		expect(switches.length).toBeGreaterThanOrEqual(4);

		// Click kickoff warnings switch
		await user.click(switches[0]);

		expect(notifQueries.updateNotificationPreferences).toHaveBeenCalledWith(
			'user-1',
			{ kickoff_warnings: false },
		);
	});
});
