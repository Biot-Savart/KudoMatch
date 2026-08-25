import {
	generateKickoffReminderHtml,
	sendEmail,
} from '@/lib/notifications/email-service';
import { sendPushToUser } from '@/lib/notifications/push-service';
import { KickoffReminderEvent } from '@/types';
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
 * Finds upcoming events and notifies users who haven't predicted them yet
 */
export async function sendKickoffReminders(
	options: KickoffRemindersOptions = {},
	client?: any,
): Promise<KickoffRemindersResult> {
	const { simulate = false, windowMinutes = 60 } = options;
	const supabase = client || getSupabaseClient();

	try {
		const now = new Date();
		const windowEnd = new Date(now.getTime() + windowMinutes * 60 * 1000);

		// 1. Fetch event markets locking within the upcoming window
		let marketsQuery = supabase
			.from('event_markets')
			.select(
				`
				id,
				locks_at,
				events:events(
					id,
					starts_at,
					round_label,
					status,
					event_competitors:event_competitors(
						slot,
						role,
						competitors:competitors(*)
					)
				)
			`,
			)
			.eq('is_current', true)
			.eq('status', 'open');

		if (!simulate) {
			marketsQuery = marketsQuery
				.gte('locks_at', now.toISOString())
				.lte('locks_at', windowEnd.toISOString());
		} else {
			marketsQuery = marketsQuery
				.order('locks_at', { ascending: true })
				.limit(5);
		}

		const { data: upcomingMarkets, error: marketsError } = await marketsQuery;

		if (marketsError) throw marketsError;

		if (!upcomingMarkets || upcomingMarkets.length === 0) {
			console.log('ℹ️ No upcoming markets found within reminder window.');
			return {
				success: true,
				matchesFound: 0,
				usersNotified: 0,
				pushSent: 0,
				emailsSent: 0,
			};
		}

		const upcomingEvents: KickoffReminderEvent[] = upcomingMarkets
			.filter((m: any) => m.events)
			.map((m: any) => {
				const ev = m.events;
				const homeComp =
					ev.event_competitors?.find(
						(c: any) => c.slot === 1 || c.role === 'home',
					)?.competitors ?? ev.event_competitors?.[0]?.competitors;
				const awayComp =
					ev.event_competitors?.find(
						(c: any) => c.slot === 2 || c.role === 'away',
					)?.competitors ?? ev.event_competitors?.[1]?.competitors;

				return {
					marketId: String(m.id),
					eventId: String(ev.id),
					homeTeamName: homeComp?.name || 'Home',
					awayTeamName: awayComp?.name || 'Away',
					homeTeamLogo: homeComp?.media_url ?? null,
					awayTeamLogo: awayComp?.media_url ?? null,
					locksAt: m.locks_at,
					startsAt: ev.starts_at,
					roundLabel: ev.round_label,
				};
			});

		const marketIds = upcomingEvents.map((e) => Number(e.marketId));

		// 2. Fetch users
		const { data: userProfiles, error: profilesError } = await supabase
			.from('profiles')
			.select('id, full_name');

		if (profilesError) throw profilesError;
		if (!userProfiles || userProfiles.length === 0) {
			return {
				success: true,
				matchesFound: upcomingEvents.length,
				usersNotified: 0,
				pushSent: 0,
				emailsSent: 0,
			};
		}

		// 3. Fetch preferences
		const { data: preferencesList } = await supabase
			.from('notification_preferences')
			.select('*');

		const preferencesMap = new Map<string, any>(
			(preferencesList || []).map((p: any) => [p.user_id, p]),
		);

		// 4. Fetch all predictions on these markets
		const { data: predictionsList, error: predError } = await supabase
			.from('predictions')
			.select('user_id, event_market_id')
			.in('event_market_id', marketIds);

		if (predError) throw predError;

		const userPredictedMarketSet = new Set<string>(
			(predictionsList || []).map(
				(p: any) => `${p.user_id}_${p.event_market_id}`,
			),
		);

		let usersNotified = 0;
		let pushSent = 0;
		let emailsSent = 0;

		for (const profile of userProfiles) {
			const userId = profile.id;
			const prefs = preferencesMap.get(userId);

			if (prefs && !prefs.kickoff_warnings) {
				continue;
			}

			const unpredictedEvents = upcomingEvents.filter(
				(e) => !userPredictedMarketSet.has(`${userId}_${e.marketId}`),
			);

			if (unpredictedEvents.length === 0) {
				continue;
			}

			usersNotified++;
			const count = unpredictedEvents.length;
			const nextEvent = unpredictedEvents[0];
			const title = `⚽ Upcoming Kickoff Reminder!`;
			const body =
				count === 1
					? `${nextEvent.homeTeamName} vs ${nextEvent.awayTeamName} locks soon. Submit your pick!`
					: `You have ${count} matches locking soon starting with ${nextEvent.homeTeamName} vs ${nextEvent.awayTeamName}.`;

			const allowPush = !prefs || prefs.push_notifications;
			const allowEmail = !prefs || prefs.email_notifications;

			if (allowPush) {
				const pushResult = await sendPushToUser(userId, {
					title,
					body,
					url: '/predict',
					data: { type: 'kickoff_reminder', count },
				});
				if (pushResult && pushResult.sent > 0) {
					pushSent += pushResult.sent;
				}
			}

			if (allowEmail && process.env.RESEND_API_KEY) {
				try {
					const { data: authUser } =
						await supabase.auth.admin.getUserById(userId);
					if (authUser?.user?.email) {
						const emailContent = generateKickoffReminderHtml({
							username: profile.full_name || 'Predictor',
							matches: unpredictedEvents.map((e) => ({
								matchId: e.eventId,
								homeTeamName: e.homeTeamName,
								awayTeamName: e.awayTeamName,
								homeTeamLogo: e.homeTeamLogo,
								awayTeamLogo: e.awayTeamLogo,
								kickoffTime: e.startsAt,
							})),
							appUrl:
								process.env.NEXT_PUBLIC_APP_URL || 'https://kudomatch.com',
						});

						const emailResult = await sendEmail({
							to: authUser.user.email,
							subject: `⏰ Don't miss out! ${count} match${count > 1 ? 'es' : ''} kicking off soon`,
							html: emailContent.html,
							text: emailContent.text,
						});

						if (emailResult.success) {
							emailsSent++;
						}
					}
				} catch (emailErr) {
					console.warn(
						`Failed to send reminder email to user ${userId}:`,
						emailErr,
					);
				}
			}
		}

		return {
			success: true,
			matchesFound: upcomingEvents.length,
			usersNotified,
			pushSent,
			emailsSent,
		};
	} catch (err: any) {
		console.error('❌ Error in sendKickoffReminders:', err);
		return {
			success: false,
			matchesFound: 0,
			usersNotified: 0,
			pushSent: 0,
			emailsSent: 0,
			error: err.message || 'Unknown error occurred',
		};
	}
}

// Standalone execution if called directly
if (require.main === module) {
	const simulate = process.argv.includes('--simulate');
	sendKickoffReminders({ simulate })
		.then((res) => {
			console.log('✅ Kickoff reminder pipeline completed:', res);
			process.exit(res.success ? 0 : 1);
		})
		.catch((err) => {
			console.error('💥 Fatal error in kickoff reminder script:', err);
			process.exit(1);
		});
}
