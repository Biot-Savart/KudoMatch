const mockScriptSelect = vi.fn().mockReturnThis();
const mockScriptEq = vi.fn().mockReturnThis();
const mockScriptGte = vi.fn().mockReturnThis();
const mockScriptLte = vi.fn().mockReturnThis();
const mockScriptIn = vi.fn().mockReturnThis();
const mockScriptOrder = vi.fn().mockReturnThis();
const mockScriptLimit = vi.fn().mockReturnThis();

const mockSupabaseJsClient = {
	from: vi.fn(() => ({
		select: mockScriptSelect,
		eq: mockScriptEq,
		gte: mockScriptGte,
		lte: mockScriptLte,
		in: mockScriptIn,
		order: mockScriptOrder,
		limit: mockScriptLimit,
	})),
	rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock('@supabase/supabase-js', () => ({
	createClient: vi.fn(() => mockSupabaseJsClient),
}));

vi.mock('@/lib/supabase/server', () => ({
	createClient: vi.fn(() => (globalThis as any).mockSupabaseClient),
}));

vi.mock('@/lib/supabase/client', () => ({
	createClient: vi.fn(() => (globalThis as any).mockSupabaseClient),
}));

vi.mock('@/lib/notifications/email-service', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('@/lib/notifications/email-service')>();
	return {
		...actual,
		sendEmail: vi.fn().mockResolvedValue({ success: true, provider: 'mock' }),
	};
});

vi.mock('@/lib/notifications/push-service', () => ({
	sendWebPushNotification: vi
		.fn()
		.mockResolvedValue({ success: true, statusCode: 201 }),
	sendPushToUser: vi.fn().mockResolvedValue({ sent: 1, failed: 0, pruned: 0 }),
}));

import {
	GET as getScoresCron,
	POST as postScoresCron,
} from '@/app/api/cron/fetch-live-scores/route';
import {
	GET as getKickoffCron,
	POST as postKickoffCron,
} from '@/app/api/cron/send-kickoff-reminders/route';
import {
	GET as getDigestCron,
	POST as postDigestCron,
} from '@/app/api/cron/send-weekly-digest/route';
import * as scoreSyncScript from '@/scripts/fetch-live-scores';
import * as kickoffScript from '@/scripts/send-kickoff-reminders';
import * as digestScript from '@/scripts/send-weekly-digest';
import { NextRequest } from 'next/server';

const { mockSupabaseClient, MockQueryBuilder } = globalThis as any;

describe('Notification Cron Routes & Scripts', () => {
	const origEnv = process.env;

	beforeEach(() => {
		process.env = { ...origEnv };
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	afterEach(() => {
		process.env = origEnv;
	});

	describe('app/api/cron/fetch-live-scores/route', () => {
		it('should reject unauthorized request when CRON_SECRET is set', async () => {
			process.env.CRON_SECRET = 'secret-test-token';

			const req = new NextRequest(
				'http://localhost:3000/api/cron/fetch-live-scores',
			);
			const res = await getScoresCron(req);
			const json = await res.json();

			expect(res.status).toBe(401);
			expect(json.success).toBe(false);
			expect(json.error).toContain('Unauthorized');
		});

		it('should allow authorized request via Bearer header and execute sync', async () => {
			process.env.CRON_SECRET = 'secret-test-token';
			vi.spyOn(scoreSyncScript, 'fetchLiveScores').mockResolvedValueOnce({
				success: true,
				updated: 4,
			});

			const req = new NextRequest(
				'http://localhost:3000/api/cron/fetch-live-scores',
				{
					headers: { authorization: 'Bearer secret-test-token' },
				},
			);
			const res = await getScoresCron(req);
			const json = await res.json();

			expect(res.status).toBe(200);
			expect(json.success).toBe(true);
			expect(json.updated).toBe(4);
		});

		it('should handle POST requests identically', async () => {
			vi.spyOn(scoreSyncScript, 'fetchLiveScores').mockResolvedValueOnce({
				success: true,
				updated: 2,
			});

			const req = new NextRequest(
				'http://localhost:3000/api/cron/fetch-live-scores?simulate=true',
				{
					method: 'POST',
				},
			);
			const res = await postScoresCron(req);
			const json = await res.json();

			expect(res.status).toBe(200);
			expect(json.success).toBe(true);
		});

		it('should return 500 when fetchLiveScores fails', async () => {
			vi.spyOn(scoreSyncScript, 'fetchLiveScores').mockResolvedValueOnce({
				success: false,
				error: 'Database connection failed',
			});

			const req = new NextRequest(
				'http://localhost:3000/api/cron/fetch-live-scores',
			);
			const res = await getScoresCron(req);
			const json = await res.json();

			expect(res.status).toBe(500);
			expect(json.success).toBe(false);
		});
	});

	describe('app/api/cron/send-kickoff-reminders/route', () => {
		it('should reject unauthorized request when CRON_SECRET is set', async () => {
			process.env.CRON_SECRET = 'secret-test-token';

			const req = new NextRequest(
				'http://localhost:3000/api/cron/send-kickoff-reminders',
			);
			const res = await getKickoffCron(req);
			const json = await res.json();

			expect(res.status).toBe(401);
			expect(json.success).toBe(false);
			expect(json.error).toContain('Unauthorized');
		});

		it('should allow authorized request via Bearer header', async () => {
			process.env.CRON_SECRET = 'secret-test-token';
			vi.spyOn(kickoffScript, 'sendKickoffReminders').mockResolvedValueOnce({
				success: true,
				matchesFound: 2,
				usersNotified: 1,
				pushSent: 1,
				emailsSent: 1,
			});

			const req = new NextRequest(
				'http://localhost:3000/api/cron/send-kickoff-reminders',
				{
					headers: { authorization: 'Bearer secret-test-token' },
				},
			);
			const res = await getKickoffCron(req);
			const json = await res.json();

			expect(res.status).toBe(200);
			expect(json.success).toBe(true);
			expect(json.details.usersNotified).toBe(1);
		});

		it('should handle POST requests identically', async () => {
			vi.spyOn(kickoffScript, 'sendKickoffReminders').mockResolvedValueOnce({
				success: true,
				matchesFound: 1,
				usersNotified: 1,
				pushSent: 0,
				emailsSent: 1,
			});

			const req = new NextRequest(
				'http://localhost:3000/api/cron/send-kickoff-reminders?simulate=true',
				{
					method: 'POST',
				},
			);
			const res = await postKickoffCron(req);
			const json = await res.json();

			expect(res.status).toBe(200);
			expect(json.success).toBe(true);
		});

		it('should return 500 when sendKickoffReminders fails', async () => {
			vi.spyOn(kickoffScript, 'sendKickoffReminders').mockResolvedValueOnce({
				success: false,
				matchesFound: 0,
				usersNotified: 0,
				pushSent: 0,
				emailsSent: 0,
				error: 'Database connection failed',
			});

			const req = new NextRequest(
				'http://localhost:3000/api/cron/send-kickoff-reminders',
			);
			const res = await getKickoffCron(req);
			const json = await res.json();

			expect(res.status).toBe(500);
			expect(json.success).toBe(false);
		});
	});

	describe('app/api/cron/send-weekly-digest/route', () => {
		it('should reject unauthorized request when CRON_SECRET is set', async () => {
			process.env.CRON_SECRET = 'secret-test-token';

			const req = new NextRequest(
				'http://localhost:3000/api/cron/send-weekly-digest',
			);
			const res = await getDigestCron(req);
			const json = await res.json();

			expect(res.status).toBe(401);
			expect(json.success).toBe(false);
		});

		it('should allow authorized request via URL query parameter', async () => {
			process.env.CRON_SECRET = 'secret-test-token';
			vi.spyOn(digestScript, 'sendWeeklyDigest').mockResolvedValueOnce({
				success: true,
				digestsSent: 5,
				totalUsers: 5,
			});

			const req = new NextRequest(
				'http://localhost:3000/api/cron/send-weekly-digest?secret=secret-test-token',
			);
			const res = await getDigestCron(req);
			const json = await res.json();

			expect(res.status).toBe(200);
			expect(json.success).toBe(true);
			expect(json.details.digestsSent).toBe(5);
		});

		it('should handle POST requests identically', async () => {
			vi.spyOn(digestScript, 'sendWeeklyDigest').mockResolvedValueOnce({
				success: true,
				digestsSent: 2,
				totalUsers: 2,
			});

			const req = new NextRequest(
				'http://localhost:3000/api/cron/send-weekly-digest',
				{
					method: 'POST',
				},
			);
			const res = await postDigestCron(req);
			const json = await res.json();

			expect(res.status).toBe(200);
			expect(json.success).toBe(true);
		});

		it('should return 500 when sendWeeklyDigest fails', async () => {
			vi.spyOn(digestScript, 'sendWeeklyDigest').mockResolvedValueOnce({
				success: false,
				digestsSent: 0,
				totalUsers: 0,
				error: 'Email provider rate limit',
			});

			const req = new NextRequest(
				'http://localhost:3000/api/cron/send-weekly-digest',
			);
			const res = await getDigestCron(req);
			const json = await res.json();

			expect(res.status).toBe(500);
			expect(json.success).toBe(false);
		});
	});

	describe('scripts/send-kickoff-reminders & send-weekly-digest execution', () => {
		it('should execute sendKickoffReminders in simulation mode', async () => {
			const mockMatches = [
				{
					id: 'm1',
					kickoff_time: '2026-08-25T14:00:00Z',
					matchday: 12,
					home_team: { name: 'Arsenal' },
					away_team: { name: 'Chelsea' },
				},
			];
			const mockProfiles = [{ id: 'u1', username: 'user1' }];
			const mockPrefs = [{ user_id: 'u1', kickoff_warnings: true }];
			const mockPreds: any[] = [];

			(mockSupabaseJsClient.from as any).mockImplementation((table: string) => {
				if (table === 'matches') return new MockQueryBuilder(mockMatches);
				if (table === 'profiles') return new MockQueryBuilder(mockProfiles);
				if (table === 'notification_preferences')
					return new MockQueryBuilder(mockPrefs);
				if (table === 'predictions') return new MockQueryBuilder(mockPreds);
				if (table === 'push_subscriptions') return new MockQueryBuilder([]);
				return new MockQueryBuilder();
			});

			const result = await kickoffScript.sendKickoffReminders(
				{ simulate: true },
				mockSupabaseJsClient,
			);
			expect(result.success).toBe(true);
			expect(result.matchesFound).toBeGreaterThanOrEqual(1);
		});

		it('should execute sendWeeklyDigest successfully', async () => {
			const mockProfiles = [{ id: 'u1', username: 'user1', total_points: 25 }];
			const mockPrefs = [
				{ user_id: 'u1', weekly_digest: true, email_notifications: true },
			];
			const mockPreds = [{ user_id: 'u1', points_earned: 3 }];
			const mockStandings = [
				{
					user_id: 'u1',
					total_points: 25,
					rank: 1,
					pools: { name: 'Top Pool' },
				},
			];

			(mockSupabaseJsClient.from as any).mockImplementation((table: string) => {
				if (table === 'profiles') return new MockQueryBuilder(mockProfiles);
				if (table === 'notification_preferences')
					return new MockQueryBuilder(mockPrefs);
				if (table === 'predictions') return new MockQueryBuilder(mockPreds);
				if (table === 'pool_standings')
					return new MockQueryBuilder(mockStandings);
				if (table === 'matches') {
					return {
						select: vi.fn().mockReturnThis(),
						eq: vi
							.fn()
							.mockReturnValue(Promise.resolve({ count: 5, error: null })),
					} as any;
				}
				return new MockQueryBuilder();
			});

			const result = await digestScript.sendWeeklyDigest(
				{ simulate: true },
				mockSupabaseJsClient,
			);
			expect(result.success).toBe(true);
			expect(result.digestsSent).toBeGreaterThanOrEqual(1);
		});

		it('should execute fetchLiveScores in simulation mode successfully', async () => {
			const mockMatches = [
				{
					id: 'm1',
					external_id: 12001,
					status: 'live',
					matchday: 12,
					home_score: 0,
					away_score: 0,
					home_team: { name: 'Arsenal' },
					away_team: { name: 'Chelsea' },
				},
			];

			(mockSupabaseJsClient.from as any).mockImplementation((table: string) => {
				if (table === 'matches') {
					return {
						select: vi.fn().mockReturnThis(),
						or: vi.fn().mockReturnThis(),
						lte: vi
							.fn()
							.mockReturnValue(
								Promise.resolve({ data: mockMatches, error: null }),
							),
						update: vi.fn().mockReturnThis(),
						eq: vi
							.fn()
							.mockReturnValue(Promise.resolve({ data: [], error: null })),
					} as any;
				}
				return new MockQueryBuilder();
			});

			const result = await scoreSyncScript.fetchLiveScores(
				{ simulate: true },
				mockSupabaseJsClient,
			);
			expect(result.success).toBe(true);
			expect(result.updated).toBe(1);
		});
	});
});
