import { createClient } from '@/lib/supabase/client';
import {
	NotificationPayload,
	PushSubscriptionData,
	PushSubscriptionRecord,
} from '@/types';

export interface PushSendResult {
	endpoint: string;
	success: boolean;
	statusCode?: number;
	error?: string;
	isExpired?: boolean;
}

/**
 * Sends a single Web Push notification to a target subscription endpoint
 */
export async function sendWebPushNotification(
	subscription: PushSubscriptionData,
	payload: NotificationPayload,
): Promise<PushSendResult> {
	const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
	const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

	try {
		const payloadString = JSON.stringify({
			title: payload.title,
			body: payload.body,
			icon: payload.icon || '/favicon.ico',
			badge: payload.badge || '/favicon.ico',
			data: {
				url: payload.url || '/predict',
				...(payload.data || {}),
			},
		});

		// When VAPID keys are provided and we are communicating with real browser endpoints
		if (vapidPublicKey && vapidPrivateKey) {
			const res = await fetch(subscription.endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					TTL: '86400', // 24 hours
					Urgency: 'high',
					Authorization: `WebPush vapid_public_key=${vapidPublicKey}`,
				},
				body: payloadString,
			});

			if (res.status === 410 || res.status === 404) {
				return {
					endpoint: subscription.endpoint,
					success: false,
					statusCode: res.status,
					isExpired: true,
					error: 'Push subscription expired or uninstalled',
				};
			}

			if (!res.ok) {
				const errorText = await res.text().catch(() => '');
				return {
					endpoint: subscription.endpoint,
					success: false,
					statusCode: res.status,
					error: `Push service rejected notification: ${res.status} ${errorText}`,
				};
			}

			return {
				endpoint: subscription.endpoint,
				success: true,
				statusCode: res.status,
			};
		}

		// Fallback / Development Simulation mode
		console.log(
			`🔔 [MOCK WEB PUSH DISPATCH] Endpoint: ${subscription.endpoint.slice(0, 30)}... | Title: "${payload.title}"`,
		);

		return {
			endpoint: subscription.endpoint,
			success: true,
			statusCode: 201,
		};
	} catch (err: any) {
		console.error(
			`⚠️ Web Push dispatch error for ${subscription.endpoint}:`,
			err,
		);
		return {
			endpoint: subscription.endpoint,
			success: false,
			error: err.message || 'Push dispatch failed',
		};
	}
}

/**
 * Dispatches Web Push notifications to all active subscriptions of a specific user
 * and cleans up expired subscriptions automatically.
 */
export async function sendPushToUser(
	userId: string,
	payload: NotificationPayload,
	client?: any,
): Promise<{
	sent: number;
	failed: number;
	pruned: number;
	success?: boolean;
	sentCount?: number;
}> {
	const supabase = client || createClient();

	const { data: subscriptions, error } = await supabase
		.from('push_subscriptions')
		.select('*')
		.eq('user_id', userId);

	if (error || !subscriptions || subscriptions.length === 0) {
		return { sent: 0, failed: 0, pruned: 0, success: true, sentCount: 0 };
	}

	let sent = 0;
	let failed = 0;
	let pruned = 0;

	for (const sub of subscriptions as PushSubscriptionRecord[]) {
		const res = await sendWebPushNotification(sub, payload);
		if (res.success) {
			sent++;
		} else {
			failed++;
			if (res.isExpired) {
				await supabase.from('push_subscriptions').delete().eq('id', sub.id);
				pruned++;
			}
		}
	}

	return {
		sent,
		failed,
		pruned,
		success: true,
		sentCount: sent,
	};
}
