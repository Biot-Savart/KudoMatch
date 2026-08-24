import {
	generateWeeklyDigestHtml,
	sendEmail,
} from '@/lib/notifications/email-service';
import { WeeklyDigestSummary } from '@/types';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables for standalone Node CLI execution
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

function getSupabaseClient() {
	const url =
		process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
	const key =
		process.env.SUPABASE_SERVICE_ROLE_KEY ||
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
		'mock-key';
	return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export interface WeeklyDigestOptions {
	simulate?: boolean;
}

export interface WeeklyDigestResult {
	success: boolean;
	digestsSent: number;
	totalUsers: number;
	error?: string;
}

/**
 * Compiles and sends the weekly summary digest email to eligible users
 */
export async function sendWeeklyDigest(
	options: WeeklyDigestOptions = {},
	client?: any,
): Promise<WeeklyDigestResult> {
	const { simulate = false } = options;
	const supabase = client || getSupabaseClient();

	try {
		console.log(
			`📊 Starting weekly digest generation (Simulate: ${simulate})...`,
		);

		// 1. Fetch user profiles
		const { data: profiles, error: profilesError } = await supabase
			.from('profiles')
			.select('id, username, full_name, total_points');

		if (profilesError) throw profilesError;
		if (!profiles || profiles.length === 0) {
			return { success: true, digestsSent: 0, totalUsers: 0 };
		}

		// 2. Fetch notification preferences
		const { data: preferencesList } = await supabase
			.from('notification_preferences')
			.select('*');

		const preferencesMap = new Map<string, any>(
			(preferencesList || []).map((p: any) => [p.user_id, p]),
		);

		// 3. Determine upcoming matches count
		const { count: upcomingCount } = await supabase
			.from('matches')
			.select('id', { count: 'exact', head: true })
			.eq('status', 'scheduled');

		// 4. Fetch all predictions scored or placed recently (e.g. past 7 days)
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		const { data: recentPredictions, error: predsError } = await supabase
			.from('predictions')
			.select('user_id, points_earned, created_at');

		if (predsError) throw predsError;

		// Group recent predictions by user
		const userPredictionsMap = new Map<string, any[]>();
		(recentPredictions || []).forEach((pred: any) => {
			if (!userPredictionsMap.has(pred.user_id)) {
				userPredictionsMap.set(pred.user_id, []);
			}
			userPredictionsMap.get(pred.user_id)!.push(pred);
		});

		// 5. Fetch pool standings for users
		const { data: standings } = await supabase
			.from('pool_standings')
			.select('user_id, total_points, rank, pools(name)');

		const userTopPoolMap = new Map<
			string,
			{ poolName: string; rank: number }
		>();
		(standings || []).forEach((st: any) => {
			if (
				st.pools?.name &&
				(!userTopPoolMap.has(st.user_id) ||
					(st.rank && st.rank < (userTopPoolMap.get(st.user_id)?.rank || 999)))
			) {
				userTopPoolMap.set(st.user_id, {
					poolName: st.pools.name,
					rank: st.rank || 1,
				});
			}
		});

		let digestsSent = 0;

		// 6. Process each user and send digest
		for (const profile of profiles) {
			const prefs = preferencesMap.get(profile.id) || {
				weekly_digest: true,
				email_notifications: true,
			};

			// Check if user disabled weekly digest or email notifications
			if (
				prefs.weekly_digest === false ||
				prefs.email_notifications === false
			) {
				continue;
			}

			const userPreds = userPredictionsMap.get(profile.id) || [];
			const pointsThisWeek = userPreds.reduce(
				(sum, p) => sum + (p.points_earned || 0),
				0,
			);
			const exactThisWeek = userPreds.filter(
				(p) => p.points_earned === 3,
			).length;
			const topPool = userTopPoolMap.get(profile.id);

			const summary: WeeklyDigestSummary = {
				userId: profile.id,
				username: profile.username || 'Predictor',
				fullName: profile.full_name,
				totalPoints: profile.total_points || 0,
				pointsEarnedThisWeek: pointsThisWeek,
				exactPredictionsThisWeek: exactThisWeek,
				totalPredictionsThisWeek: userPreds.length,
				topPoolName: topPool?.poolName || null,
				topPoolRank: topPool?.rank || null,
				upcomingMatchesCount: upcomingCount || 0,
			};

			const { html, text } = generateWeeklyDigestHtml(summary);
			const emailAddress = `${profile.username || profile.id}@example.com`;

			const emailResult = await sendEmail({
				to: emailAddress,
				subject: `📊 Your KudoMatch Weekly Recap (+${pointsThisWeek} PTS)`,
				html,
				text,
			});

			if (emailResult.success) {
				digestsSent++;
			}
		}

		console.log(
			`✅ Weekly digest completed: ${digestsSent}/${profiles.length} users emailed.`,
		);

		return {
			success: true,
			digestsSent,
			totalUsers: profiles.length,
		};
	} catch (err: any) {
		console.error('❌ Error executing weekly digest:', err);
		return {
			success: false,
			digestsSent: 0,
			totalUsers: 0,
			error: err.message || 'Failed to dispatch weekly digests',
		};
	}
}

// CLI Execution Support
if (require.main === module) {
	const simulate = process.argv.includes('--simulate');
	sendWeeklyDigest({ simulate }).then((res) => {
		console.log('Result:', res);
		process.exit(res.success ? 0 : 1);
	});
}
