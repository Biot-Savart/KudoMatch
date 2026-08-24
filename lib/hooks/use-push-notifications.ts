'use client';

import {
	deletePushSubscription,
	savePushSubscription,
} from '@/lib/queries/notifications';
import { useCallback, useEffect, useState } from 'react';

/**
 * Converts a URL base64 string to a Uint8Array for VAPID applicationServerKey
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

export function usePushNotifications(userId?: string | null) {
	const [isSupported, setIsSupported] = useState<boolean>(false);
	const [permission, setPermission] =
		useState<NotificationPermission>('default');
	const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	// Check browser capability and subscription state on mount
	useEffect(() => {
		if (
			typeof window === 'undefined' ||
			!('serviceWorker' in navigator) ||
			!('PushManager' in window) ||
			!('Notification' in window)
		) {
			setIsSupported(false);
			setLoading(false);
			return;
		}

		setIsSupported(true);
		setPermission(Notification.permission);

		const checkSubscription = async () => {
			try {
				const registration = await navigator.serviceWorker.register('/sw.js');
				const subscription = await registration.pushManager.getSubscription();
				setIsSubscribed(!!subscription);
			} catch (err: any) {
				console.error('Error checking push subscription:', err);
			} finally {
				setLoading(false);
			}
		};

		checkSubscription();
	}, []);

	const subscribe = useCallback(async () => {
		if (!isSupported) {
			setError('Push notifications are not supported in this browser.');
			return false;
		}

		if (!userId) {
			setError('You must be signed in to enable push notifications.');
			return false;
		}

		setLoading(true);
		setError(null);

		try {
			// 1. Request notification permission
			const perm = await Notification.requestPermission();
			setPermission(perm);

			if (perm !== 'granted') {
				setError('Notification permissions were denied.');
				return false;
			}

			// 2. Register service worker
			const registration = await navigator.serviceWorker.register('/sw.js');
			await navigator.serviceWorker.ready;

			// 3. Subscribe with PushManager
			const vapidKey =
				process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
				'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuNxndcxParsKMzkFiDmtvd69Y';

			const convertedVapidKey = urlBase64ToUint8Array(vapidKey);

			let subscription = await registration.pushManager.getSubscription();

			if (!subscription) {
				subscription = await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: convertedVapidKey as unknown as BufferSource,
				});
			}

			// 4. Extract subscription keys
			const jsonSub = subscription.toJSON();
			const p256dh = jsonSub.keys?.p256dh;
			const auth = jsonSub.keys?.auth;

			if (!subscription.endpoint || !p256dh || !auth) {
				throw new Error('Failed to retrieve valid push subscription keys.');
			}

			// 5. Store subscription in database
			await savePushSubscription(userId, {
				endpoint: subscription.endpoint,
				p256dh,
				auth,
			});

			setIsSubscribed(true);
			return true;
		} catch (err: any) {
			console.error('Error subscribing to push notifications:', err);
			setError(err.message || 'Failed to subscribe to push notifications.');
			return false;
		} finally {
			setLoading(false);
		}
	}, [isSupported, userId]);

	const unsubscribe = useCallback(async () => {
		if (!userId) return false;

		setLoading(true);
		setError(null);

		try {
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.getSubscription();

			if (subscription) {
				const endpoint = subscription.endpoint;
				await subscription.unsubscribe();
				await deletePushSubscription(userId, endpoint);
			}

			setIsSubscribed(false);
			return true;
		} catch (err: any) {
			console.error('Error unsubscribing from push notifications:', err);
			setError(err.message || 'Failed to unsubscribe.');
			return false;
		} finally {
			setLoading(false);
		}
	}, [userId]);

	return {
		isSupported,
		permission,
		isSubscribed,
		loading,
		error,
		subscribe,
		unsubscribe,
	};
}
