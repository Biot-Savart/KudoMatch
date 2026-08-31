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
			.select('id, full_name, email');

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

		// 3. Determine upcoming events count
		const { count: upcomingCount } = await supabase
			.from('events')
			.select('id', { count: 'exact', head: true })
			.eq('status', 'scheduled');

		// 4. Fetch all predictions scored or placed recently (e.g. past 7 days)
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		const { data: allPredictions, error: predsError } = await supabase
			.from('predictions')
			.select('user_id, raw_points, tier_code, created_at, settlement_status');

		if (predsError) throw predsError;

		// Group predictions by user
		const userPredictionsMap = new Map<string, any[]>();
		(allPredictions || []).forEach((pred: any) => {
			if (!userPredictionsMap.has(pred.user_id)) {
				userPredictionsMap.set(pred.user_id, []);
			}
			userPredictionsMap.get(pred.user_id)!.push(pred);
		});

		let digestsSent = 0;

		// 5. Process each user and send digest
		for (const profile of profiles) {
			const prefs = preferencesMap.get(profile.id) || {
				weekly_digest: true,
				email_notifications: true,
			};

			if (!prefs.weekly_digest || !prefs.email_notifications) {
				continue;
			}

			const userPreds = userPredictionsMap.get(profile.id) || [];
			const totalPoints = userPreds.reduce(
				(sum, p) => sum + (p.raw_points || 0),
				0,
			);

			const recentPreds = userPreds.filter(
				(p) => new Date(p.created_at) >= sevenDaysAgo,
			);
			const pointsThisWeek = recentPreds.reduce(
				(sum, p) => sum + (p.raw_points || 0),
				0,
			);
			const exactsThisWeek = recentPreds.filter(
				(p) => p.tier_code === 'exact_score',
			).length;
			const tierCounts = recentPreds.reduce((counts, prediction) => {
				const tier = prediction.tier_code as keyof NonNullable<WeeklyDigestSummary['tierCounts']>;
				if (tier) counts[tier] = (counts[tier] || 0) + 1;
				return counts;
			}, {} as NonNullable<WeeklyDigestSummary['tierCounts']>);

			const summaryData: WeeklyDigestSummary = {
				userId: profile.id,
				fullName: profile.full_name || 'Predictor',
				email: profile.email,
				totalPoints,
				pointsEarnedThisWeek: pointsThisWeek,
				exactPredictionsThisWeek: exactsThisWeek,
				totalPredictionsThisWeek: recentPreds.length,
				upcomingEventsCount: upcomingCount || 0,
				tierCounts,
			};

			if (simulate) {
				console.log(
					`[SIMULATION] Weekly digest prepared for user ${profile.id} (${profile.email}):`,
					summaryData,
				);
				digestsSent++;
				continue;
			}

			// In real dispatch mode, send with email service if RESEND_API_KEY is configured
			if (process.env.RESEND_API_KEY && profile.email) {
				try {
					const emailContent = generateWeeklyDigestHtml(
						{
							userId: profile.id,
							username: profile.full_name || 'Predictor',
							fullName: profile.full_name || 'Predictor',
							email: profile.email,
							totalPoints: summaryData.totalPoints,
							pointsEarnedThisWeek: summaryData.pointsEarnedThisWeek,
							exactPredictionsThisWeek: summaryData.exactPredictionsThisWeek,
							totalPredictionsThisWeek: summaryData.totalPredictionsThisWeek,
							topPoolName: summaryData.topPoolName || undefined,
							topPoolRank: summaryData.topPoolRank || undefined,
							upcomingEventsCount: summaryData.upcomingEventsCount,
							upcomingMatchesCount: summaryData.upcomingEventsCount,
						},
						process.env.NEXT_PUBLIC_APP_URL || 'https://kudomatch.com',
					);

					const res = await sendEmail({
						to: profile.email,
						subject: `📈 Your Weekly KudoMatch Digest: +${pointsThisWeek} pts this week!`,
						html: emailContent.html,
						text: emailContent.text,
					});

					if (res.success) {
						digestsSent++;
					}
				} catch (emailErr) {
					console.warn(
						`Failed to send weekly digest email to user ${profile.id}:`,
						emailErr,
					);
				}
			}
		}

		console.log(
			`✅ Weekly digest completed. Sent ${digestsSent} digests to ${profiles.length} users.`,
		);

		return {
			success: true,
			digestsSent,
			totalUsers: profiles.length,
		};
	} catch (err: any) {
		console.error('❌ Error in sendWeeklyDigest:', err);
		return {
			success: false,
			digestsSent: 0,
			totalUsers: 0,
			error: err.message || 'Unknown error occurred',
		};
	}
}

// Standalone execution if called directly
if (require.main === module) {
	const simulate = process.argv.includes('--simulate');
	sendWeeklyDigest({ simulate })
		.then((res) => {
			console.log('✅ Weekly digest pipeline completed:', res);
			process.exit(res.success ? 0 : 1);
		})
		.catch((err) => {
			console.error('💥 Fatal error in weekly digest script:', err);
			process.exit(1);
		});
}
