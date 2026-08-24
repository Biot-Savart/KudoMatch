import {
	generateKickoffReminderHtml,
	sendEmail,
} from '@/lib/notifications/email-service';
import { sendPushToUser } from '@/lib/notifications/push-service';
import { KickoffReminderMatch, Match } from '@/types';
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

export interface KickoffRemindersOptions {
	simulate?: boolean;
	windowMinutes?: number;
}

export interface KickoffRemindersResult {
	success: boolean;
	matchesFound: number;
	usersNotified: number;
	pushSent: number;
	emailsSent: number;
	error?: string;
}

/**
 * Finds upcoming matches and notifies users who haven't predicted them yet
 */
export async function sendKickoffReminders(
	options: KickoffRemindersOptions = {},
): Promise<KickoffRemindersResult> {
	const { simulate = false, windowMinutes = 60 } = options;
	const supabase = getSupabaseClient();

	try {
		const now = new Date();
		const windowEnd = new Date(now.getTime() + windowMinutes * 60 * 1000);

		// 1. Fetch matches scheduled within the upcoming window
		let matchesQuery = supabase
			.from('matches')
			.select(
				`
				*,
				home_team:teams!matches_home_team_id_fkey (*),
				away_team:teams!matches_away_team_id_fkey (*)
			`,
			)
			.eq('status', 'scheduled');

		if (!simulate) {
			matchesQuery = matchesQuery
				.gte('kickoff_time', now.toISOString())
				.lte('kickoff_time', windowEnd.toISOString());
		} else {
			// In simulate mode, grab up to 5 upcoming scheduled matches
			matchesQuery = matchesQuery
				.order('kickoff_time', { ascending: true })
				.limit(5);
		}

		const { data: upcomingMatches, error: matchesError } = await matchesQuery;

		if (matchesError) throw matchesError;

		if (!upcomingMatches || upcomingMatches.length === 0) {
			console.log('ℹ️ No upcoming matches found within reminder window.');
			return {
				success: true,
				matchesFound: 0,
				usersNotified: 0,
				pushSent: 0,
				emailsSent: 0,
			};
		}

		const matchIds = upcomingMatches.map((m: Match) => m.id);
		console.log(
			`🎯 Found ${upcomingMatches.length} matches kicking off soon:`,
			upcomingMatches.map(
				(m: any) => `${m.home_team?.name} vs ${m.away_team?.name}`,
			),
		);

		// 2. Fetch users with notification preferences
		const { data: userProfiles, error: profilesError } = await supabase
			.from('profiles')
			.select('id, username, full_name');

		if (profilesError) throw profilesError;
		if (!userProfiles || userProfiles.length === 0) {
			return {
				success: true,
				matchesFound: upcomingMatches.length,
				usersNotified: 0,
				pushSent: 0,
				emailsSent: 0,
			};
		}

		// 3. Fetch preferences
		const { data: preferencesList } = await supabase
			.from('notification_preferences')
			.select('*');

		const preferencesMap = new Map(
			(preferencesList || []).map((p: any) => [p.user_id, p]),
		);

		// 4. Fetch existing predictions for these upcoming matches
		const { data: existingPredictions, error: predsError } = await supabase
			.from('predictions')
			.select('user_id, match_id')
			.in('match_id', matchIds);

		if (predsError) throw predsError;

		const userPredictedMatchMap = new Map<string, Set<string>>();
		(existingPredictions || []).forEach((pred: any) => {
			if (!userPredictedMatchMap.has(pred.user_id)) {
				userPredictedMatchMap.set(pred.user_id, new Set());
			}
			userPredictedMatchMap.get(pred.user_id)!.add(pred.match_id);
		});

		let usersNotified = 0;
		let pushSent = 0;
		let emailsSent = 0;

		// 5. Send reminders to users who have missing predictions
		for (const profile of userProfiles) {
			const prefs = preferencesMap.get(profile.id) || {
				kickoff_warnings: true,
				email_notifications: true,
				push_notifications: true,
			};

			// Skip if user explicitly disabled kickoff warnings
			if (prefs.kickoff_warnings === false) {
				continue;
			}

			const predictedSet = userPredictedMatchMap.get(profile.id) || new Set();
			const unpredicted = upcomingMatches.filter(
				(m: Match) => !predictedSet.has(m.id),
			);

			if (unpredicted.length === 0) {
				continue;
			}

			usersNotified++;
			const reminderMatches: KickoffReminderMatch[] = unpredicted.map(
				(m: any) => ({
					matchId: m.id,
					homeTeamName: m.home_team?.short_name || m.home_team?.name || 'Home',
					awayTeamName: m.away_team?.short_name || m.away_team?.name || 'Away',
					homeTeamLogo: m.home_team?.logo_url,
					awayTeamLogo: m.away_team?.logo_url,
					kickoffTime: m.kickoff_time,
					gameweek: m.matchday,
				}),
			);

			// A. Dispatch Web Push Notification
			if (prefs.push_notifications !== false) {
				const pushPayload = {
					title: '⚽ Matchday Kickoff Alert',
					body: `You have ${reminderMatches.length} unpredicted match${reminderMatches.length > 1 ? 'es' : ''} starting soon!`,
					url: '/predict',
				};

				const pushResult = await sendPushToUser(profile.id, pushPayload);
				pushSent += pushResult.sent;
			}

			// B. Dispatch Email Notification
			if (prefs.email_notifications !== false) {
				const { html, text } = generateKickoffReminderHtml({
					username: profile.username || 'Predictor',
					matches: reminderMatches,
				});

				// In production, user email is in auth.users or profiles
				const emailAddress = `${profile.username || profile.id}@example.com`;
				const emailResult = await sendEmail({
					to: emailAddress,
					subject: `⚽ KudoMatch: ${reminderMatches.length} upcoming match${reminderMatches.length > 1 ? 'es' : ''} need your picks!`,
					html,
					text,
				});

				if (emailResult.success) {
					emailsSent++;
				}
			}
		}

		console.log(
			`✅ Reminders processed: ${usersNotified} users notified (${pushSent} pushes, ${emailsSent} emails).`,
		);

		return {
			success: true,
			matchesFound: upcomingMatches.length,
			usersNotified,
			pushSent,
			emailsSent,
		};
	} catch (err: any) {
		console.error('❌ Error executing kickoff reminders:', err);
		return {
			success: false,
			matchesFound: 0,
			usersNotified: 0,
			pushSent: 0,
			emailsSent: 0,
			error: err.message || 'Failed to dispatch reminders',
		};
	}
}

// CLI Execution Support
if (require.main === module) {
	const simulate = process.argv.includes('--simulate');
	sendKickoffReminders({ simulate }).then((res) => {
		console.log('Result:', res);
		process.exit(res.success ? 0 : 1);
	});
}
