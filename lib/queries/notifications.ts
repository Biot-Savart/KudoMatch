import { createClient } from '@/lib/supabase/client';
import {
	NotificationPreferences,
	PushSubscriptionData,
	PushSubscriptionRecord,
} from '@/types';

/**
 * Default notification preferences
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<
	NotificationPreferences,
	'user_id' | 'created_at' | 'updated_at'
> = {
	kickoff_warnings: true,
	match_results: true,
	weekly_digest: true,
	email_notifications: true,
	push_notifications: true,
};

/**
 * Fetches the notification preferences for a user, or creates defaults if none exist
 */
export async function fetchNotificationPreferences(
	userId: string,
): Promise<NotificationPreferences> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase
			.from('notification_preferences')
			.select('*')
			.eq('user_id', userId)
			.single();

		if (error) {
			// If not found, attempt to insert defaults
			if (error.code === 'PGRST116') {
				const { data: created, error: insertError } = await supabase
					.from('notification_preferences')
					.insert({
						user_id: userId,
						...DEFAULT_NOTIFICATION_PREFERENCES,
					})
					.select()
					.single();

				if (insertError) throw insertError;
				return created as NotificationPreferences;
			}
			throw error;
		}

		return data as NotificationPreferences;
	} catch (err) {
		console.error(
			`⚠️ Failed to fetch notification preferences for user ${userId}:`,
			err,
		);
		throw err;
	}
}

/**
 * Updates notification preferences for a user
 */
export async function updateNotificationPreferences(
	userId: string,
	preferences: Partial<
		Omit<NotificationPreferences, 'user_id' | 'created_at' | 'updated_at'>
	>,
): Promise<NotificationPreferences> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase
			.from('notification_preferences')
			.upsert({
				user_id: userId,
				...preferences,
				updated_at: new Date().toISOString(),
			})
			.select()
			.single();

		if (error) throw error;
		return data as NotificationPreferences;
	} catch (err) {
		console.error(
			`⚠️ Failed to update notification preferences for user ${userId}:`,
			err,
		);
		throw err;
	}
}

/**
 * Saves a browser push subscription for a user (upserts by endpoint)
 */
export async function savePushSubscription(
	userId: string,
	subscription: PushSubscriptionData,
): Promise<PushSubscriptionRecord> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase
			.from('push_subscriptions')
			.upsert(
				{
					user_id: userId,
					endpoint: subscription.endpoint,
					p256dh: subscription.p256dh,
					auth: subscription.auth,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: 'endpoint' },
			)
			.select()
			.single();

		if (error) throw error;
		return data as PushSubscriptionRecord;
	} catch (err) {
		console.error(
			`⚠️ Failed to save push subscription for user ${userId}:`,
			err,
		);
		throw err;
	}
}

/**
 * Deletes a push subscription for a user by endpoint
 */
export async function deletePushSubscription(
	userId: string,
	endpoint: string,
): Promise<boolean> {
	const supabase = createClient();

	try {
		const { error } = await supabase
			.from('push_subscriptions')
			.delete()
			.eq('user_id', userId)
			.eq('endpoint', endpoint);

		if (error) throw error;
		return true;
	} catch (err) {
		console.error(
			`⚠️ Failed to delete push subscription for user ${userId}:`,
			err,
		);
		throw err;
	}
}

/**
 * Fetches all active push subscriptions for a user
 */
export async function fetchUserPushSubscriptions(
	userId: string,
): Promise<PushSubscriptionRecord[]> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase
			.from('push_subscriptions')
			.select('*')
			.eq('user_id', userId);

		if (error) throw error;
		return (data || []) as PushSubscriptionRecord[];
	} catch (err) {
		console.error(
			`⚠️ Failed to fetch push subscriptions for user ${userId}:`,
			err,
		);
		throw err;
	}
}
