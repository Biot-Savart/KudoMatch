vi.mock('@/lib/supabase/client', () => ({
	createClient: vi.fn(() => (globalThis as any).mockSupabaseClient),
}));

import { urlBase64ToUint8Array } from '@/lib/hooks/use-push-notifications';
import {
	generateKickoffReminderHtml,
	generateWeeklyDigestHtml,
	sendEmail,
} from '@/lib/notifications/email-service';
import {
	sendPushToUser,
	sendWebPushNotification,
} from '@/lib/notifications/push-service';
import {
	deletePushSubscription,
	fetchNotificationPreferences,
	fetchUserPushSubscriptions,
	savePushSubscription,
	updateNotificationPreferences,
} from '@/lib/queries/notifications';

const { mockSupabaseClient, MockQueryBuilder } = globalThis as any;

describe('lib/queries/notifications', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it('should fetch notification preferences successfully', async () => {
		const mockPrefs = {
			user_id: 'user-1',
			kickoff_warnings: true,
			match_results: true,
			weekly_digest: true,
			email_notifications: true,
			push_notifications: true,
		};

		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(mockPrefs);
		});

		const result = await fetchNotificationPreferences('user-1');
		expect(result).toEqual(mockPrefs);
	});

	it('should create default preferences if none found (PGRST116)', async () => {
		const mockCreated = {
			user_id: 'user-1',
			kickoff_warnings: true,
			match_results: true,
			weekly_digest: true,
			email_notifications: true,
			push_notifications: true,
		};

		let callCount = 0;
		vi.spyOn(mockSupabaseClient, 'from').mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return new MockQueryBuilder(null, { code: 'PGRST116' });
			}
			return new MockQueryBuilder(mockCreated);
		});

		const result = await fetchNotificationPreferences('user-1');
		expect(result).toEqual(mockCreated);
	});

	it('should update notification preferences successfully', async () => {
		const mockUpdated = {
			user_id: 'user-1',
			kickoff_warnings: false,
			match_results: true,
		};

		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(mockUpdated);
		});

		const result = await updateNotificationPreferences('user-1', {
			kickoff_warnings: false,
		});
		expect(result).toEqual(mockUpdated);
	});

	it('should save push subscription successfully', async () => {
		const mockSubRecord = {
			id: 'sub-1',
			user_id: 'user-1',
			endpoint: 'https://push.example.com/sub/123',
			p256dh: 'p256dh-key',
			auth: 'auth-secret',
		};

		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(mockSubRecord);
		});

		const result = await savePushSubscription('user-1', {
			endpoint: 'https://push.example.com/sub/123',
			p256dh: 'p256dh-key',
			auth: 'auth-secret',
		});
		expect(result).toEqual(mockSubRecord);
	});

	it('should delete push subscription successfully', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder([], null);
		});

		const result = await deletePushSubscription(
			'user-1',
			'https://push.example.com/sub/123',
		);
		expect(result).toBe(true);
	});

	it('should fetch user push subscriptions list', async () => {
		const mockSubs = [
			{ id: 'sub-1', endpoint: 'https://push.example.com/sub/1' },
		];

		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(mockSubs);
		});

		const result = await fetchUserPushSubscriptions('user-1');
		expect(result).toEqual(mockSubs);
	});

	it('should handle errors in fetchNotificationPreferences', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(null, new Error('Database query error'));
		});

		await expect(fetchNotificationPreferences('user-1')).rejects.toThrow(
			'Database query error',
		);
	});

	it('should handle errors in updateNotificationPreferences', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(null, new Error('Update failed'));
		});

		await expect(
			updateNotificationPreferences('user-1', { kickoff_warnings: false }),
		).rejects.toThrow('Update failed');
	});

	it('should handle errors in savePushSubscription', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(null, new Error('Save sub failed'));
		});

		await expect(
			savePushSubscription('user-1', {
				endpoint: 'https://push.example.com',
				p256dh: 'p',
				auth: 'a',
			}),
		).rejects.toThrow('Save sub failed');
	});

	it('should handle errors in deletePushSubscription', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(null, new Error('Delete sub failed'));
		});

		await expect(
			deletePushSubscription('user-1', 'https://push.example.com'),
		).rejects.toThrow('Delete sub failed');
	});

	it('should handle errors in fetchUserPushSubscriptions', async () => {
		vi.spyOn(mockSupabaseClient, 'from').mockImplementationOnce(() => {
			return new MockQueryBuilder(null, new Error('Fetch subs failed'));
		});

		await expect(fetchUserPushSubscriptions('user-1')).rejects.toThrow(
			'Fetch subs failed',
		);
	});
});

describe('lib/notifications/email-service', () => {
	const origFetch = globalThis.fetch;
	const origEnv = process.env;

	beforeEach(() => {
		process.env = { ...origEnv };
	});

	afterEach(() => {
		globalThis.fetch = origFetch;
		process.env = origEnv;
	});

	it('should generate kickoff reminder HTML and text templates', () => {
		const result = generateKickoffReminderHtml({
			username: 'alex',
			matches: [
				{
					matchId: 'm1',
					homeTeamName: 'Arsenal',
					awayTeamName: 'Chelsea',
					kickoffTime: new Date().toISOString(),
				},
			],
		});

		expect(result.html).toContain('Arsenal');
		expect(result.html).toContain('Chelsea');
		expect(result.html).toContain('@alex');
		expect(result.text).toContain('Arsenal vs Chelsea');
	});

	it('should generate weekly summary digest HTML and text templates', () => {
		const result = generateWeeklyDigestHtml({
			userId: 'u1',
			username: 'alex',
			totalPoints: 42,
			pointsEarnedThisWeek: 9,
			exactPredictionsThisWeek: 2,
			totalPredictionsThisWeek: 4,
			topPoolName: 'Champions League Pool',
			topPoolRank: 1,
			upcomingMatchesCount: 10,
		});

		expect(result.html).toContain('+9');
		expect(result.html).toContain('42 PTS');
		expect(result.html).toContain('Champions League Pool');
		expect(result.text).toContain('+9');
		expect(result.text).toContain('Champions League Pool');
	});

	it('should dispatch email via mock transport when API keys are absent', async () => {
		delete process.env.RESEND_API_KEY;
		delete process.env.SENDGRID_API_KEY;

		const res = await sendEmail({
			to: 'test@example.com',
			subject: 'Test Subject',
			html: '<p>Hello</p>',
		});

		expect(res.success).toBe(true);
		expect(res.provider).toBe('mock');
	});

	it('should dispatch email via Resend when RESEND_API_KEY is present', async () => {
		process.env.RESEND_API_KEY = 're_test_123';
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({ id: 'resend-msg-123' }),
		}) as any;

		const res = await sendEmail({
			to: 'test@example.com',
			subject: 'Test Resend',
			html: '<p>Hello Resend</p>',
		});

		expect(res.success).toBe(true);
		expect(res.provider).toBe('resend');
		expect(res.messageId).toBe('resend-msg-123');
	});

	it('should dispatch email via SendGrid when SENDGRID_API_KEY is present', async () => {
		delete process.env.RESEND_API_KEY;
		process.env.SENDGRID_API_KEY = 'SG.test12345';
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			text: vi.fn().mockResolvedValue(''),
		}) as any;

		const res = await sendEmail({
			to: 'test@example.com',
			subject: 'Test SendGrid',
			html: '<p>Hello SendGrid</p>',
		});

		expect(res.success).toBe(true);
		expect(res.provider).toBe('sendgrid');
	});

	it('should handle Resend API error responses', async () => {
		process.env.RESEND_API_KEY = 're_test_invalid';
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 403,
			json: vi.fn().mockResolvedValue({ message: 'Forbidden' }),
		}) as any;

		const res = await sendEmail({
			to: 'test@example.com',
			subject: 'Fail Resend',
			html: '<p>Fail</p>',
		});

		expect(res.success).toBe(false);
		expect(res.error).toBeDefined();
	});

	it('should handle SendGrid API error responses', async () => {
		delete process.env.RESEND_API_KEY;
		process.env.SENDGRID_API_KEY = 'SG.invalid';
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
			text: vi.fn().mockResolvedValue('Unauthorized'),
		}) as any;

		const res = await sendEmail({
			to: 'test@example.com',
			subject: 'Fail SendGrid',
			html: '<p>Fail</p>',
		});

		expect(res.success).toBe(false);
		expect(res.error).toBeDefined();
	});
});

describe('lib/notifications/push-service', () => {
	const origEnv = process.env;
	const origFetch = globalThis.fetch;

	beforeEach(() => {
		process.env = { ...origEnv };
	});

	afterEach(() => {
		globalThis.fetch = origFetch;
		process.env = origEnv;
	});

	it('should send web push notification in mock mode', async () => {
		delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
		delete process.env.VAPID_PRIVATE_KEY;

		const result = await sendWebPushNotification(
			{
				endpoint: 'https://push.example.com/test',
				p256dh: 'p256dh',
				auth: 'auth',
			},
			{
				title: 'Test Notification',
				body: 'Test Body',
			},
		);

		expect(result.success).toBe(true);
		expect(result.statusCode).toBe(201);
	});

	it('should identify expired subscriptions (410 Gone)', async () => {
		process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public-key';
		process.env.VAPID_PRIVATE_KEY = 'test-private-key';

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 410,
		}) as any;

		const result = await sendWebPushNotification(
			{
				endpoint: 'https://push.example.com/expired',
				p256dh: 'p256dh',
				auth: 'auth',
			},
			{ title: 'Expired Test', body: 'Expired' },
		);

		expect(result.success).toBe(false);
		expect(result.isExpired).toBe(true);
	});

	it('should handle general push service rejection error response', async () => {
		process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public-key';
		process.env.VAPID_PRIVATE_KEY = 'test-private-key';

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			text: vi.fn().mockResolvedValue('Server Error'),
		}) as any;

		const result = await sendWebPushNotification(
			{
				endpoint: 'https://push.example.com/fail',
				p256dh: 'p256dh',
				auth: 'auth',
			},
			{ title: 'Server error test', body: 'Error' },
		);

		expect(result.success).toBe(false);
		expect(result.error).toContain('500');
	});

	it('should send push notifications to user and prune expired ones', async () => {
		const mockSubs = [
			{
				id: 'sub-1',
				endpoint: 'https://push.example.com/1',
				p256dh: 'p',
				auth: 'a',
			},
		];

		vi.spyOn(mockSupabaseClient, 'from').mockImplementation(() => {
			return new MockQueryBuilder(mockSubs);
		});

		const result = await sendPushToUser('user-1', {
			title: 'User Alert',
			body: 'Hi User',
		});

		expect(result.sent).toBe(1);
		expect(result.failed).toBe(0);
	});

	it('should convert urlBase64ToUint8Array accurately', () => {
		const base64 = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFg';
		const arr = urlBase64ToUint8Array(base64);
		expect(arr).toBeInstanceOf(Uint8Array);
		expect(arr.length).toBeGreaterThan(0);
	});
});
