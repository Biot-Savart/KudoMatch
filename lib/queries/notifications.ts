import { createClient } from '@/lib/supabase/client';
import {
	NotificationPreferences,
	PushSubscriptionData,
	PushSubscriptionRecord,
} from '@/types';

export const notificationsQueryKeys = {
	all: ['notifications'] as const,
	preferences: (userId: string) =>
		[...notificationsQueryKeys.all, 'preferences', userId] as const,
	subscriptions: (userId: string) =>
		[...notificationsQueryKeys.all, 'subscriptions', userId] as const,
};

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

export async function fetchNotificationPreferences(
	userId: string,
): Promise<NotificationPreferences> {
	const supabase = createClient();

	const { data, error } = await supabase
		.from('notification_preferences')
		.select('*')
		.eq('user_id', userId)
		.single();

	if (error) {
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
		console.error(
			`Error fetching notification preferences for user ${userId}:`,
			error,
		);
		throw error;
	}

	return data as NotificationPreferences;
}

export async function updateNotificationPreferences(
	userId: string,
	preferences: Partial<
		Omit<NotificationPreferences, 'user_id' | 'created_at' | 'updated_at'>
	>,
): Promise<NotificationPreferences> {
	const supabase = createClient();

	const { data, error } = await supabase
		.from('notification_preferences')
		.upsert({
			user_id: userId,
			...preferences,
			updated_at: new Date().toISOString(),
		})
		.select()
		.single();

	if (error) {
		console.error(
			`Error updating notification preferences for user ${userId}:`,
			error,
		);
		throw error;
	}

	return data as NotificationPreferences;
}

export async function fetchUserPushSubscriptions(
	userId: string,
): Promise<PushSubscriptionRecord[]> {
	const supabase = createClient();

	const { data, error } = await supabase
		.from('push_subscriptions')
		.select('*')
		.eq('user_id', userId);

	if (error) {
		console.error(
			`Error fetching push subscriptions for user ${userId}:`,
			error,
		);
		throw error;
	}

	return data as PushSubscriptionRecord[];
}

export async function savePushSubscription(
	userId: string,
	subscription: PushSubscriptionData,
): Promise<PushSubscriptionRecord> {
	const supabase = createClient();

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

	if (error) {
		console.error(`Error saving push subscription for user ${userId}:`, error);
		throw error;
	}

	return data as PushSubscriptionRecord;
}

export async function deletePushSubscription(
	userId: string,
	endpoint: string,
): Promise<boolean> {
	const supabase = createClient();

	const { error } = await supabase
		.from('push_subscriptions')
		.delete()
		.eq('user_id', userId)
		.eq('endpoint', endpoint);

	if (error) {
		console.error(
			`Error deleting push subscription for user ${userId}:`,
			error,
		);
		throw error;
	}

	return true;
}
