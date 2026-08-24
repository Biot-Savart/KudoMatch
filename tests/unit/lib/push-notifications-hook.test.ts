import { usePushNotifications } from '@/lib/hooks/use-push-notifications';
import * as notifQueries from '@/lib/queries/notifications';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@/lib/queries/notifications', () => ({
	savePushSubscription: vi.fn().mockResolvedValue({ id: 'sub-1' }),
	deletePushSubscription: vi.fn().mockResolvedValue(true),
	fetchNotificationPreferences: vi.fn().mockResolvedValue({}),
	updateNotificationPreferences: vi.fn().mockResolvedValue({}),
}));

describe('lib/hooks/use-push-notifications', () => {
	const origNotification = window.Notification;
	const origNavigator = window.navigator;

	let mockGetSubscription: any;
	let mockSubscribe: any;
	let mockUnsubscribe: any;

	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();

		mockUnsubscribe = vi.fn().mockResolvedValue(true);
		mockGetSubscription = vi.fn().mockResolvedValue({
			endpoint: 'https://push.example.com/test-endpoint',
			toJSON: () => ({
				keys: {
					p256dh: 'test-p256dh-key',
					auth: 'test-auth-key',
				},
			}),
			unsubscribe: mockUnsubscribe,
		});

		mockSubscribe = vi.fn().mockResolvedValue({
			endpoint: 'https://push.example.com/test-endpoint',
			toJSON: () => ({
				keys: {
					p256dh: 'test-p256dh-key',
					auth: 'test-auth-key',
				},
			}),
		});

		// Setup Mock ServiceWorker and PushManager on navigator and window
		const mockServiceWorker = {
			register: vi.fn().mockResolvedValue({
				pushManager: {
					getSubscription: mockGetSubscription,
					subscribe: mockSubscribe,
				},
			}),
			ready: Promise.resolve({
				pushManager: {
					getSubscription: mockGetSubscription,
					subscribe: mockSubscribe,
				},
			}),
		};

		Object.defineProperty(window.navigator, 'serviceWorker', {
			value: mockServiceWorker,
			writable: true,
			configurable: true,
		});

		(window as any).PushManager = function () {};
		(window as any).Notification = {
			permission: 'default',
			requestPermission: vi.fn().mockResolvedValue('granted'),
		};
	});

	afterEach(() => {
		(window as any).Notification = origNotification;
	});

	it('initializes and detects push notification support', async () => {
		const { result } = renderHook(() => usePushNotifications('user-1'));

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.isSupported).toBe(true);
		expect(result.current.isSubscribed).toBe(true);
	});

	it('subscribes to push notifications successfully when permission is granted', async () => {
		mockGetSubscription.mockResolvedValueOnce(null);

		const { result } = renderHook(() => usePushNotifications('user-1'));

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		let success = false;
		await act(async () => {
			success = await result.current.subscribe();
		});

		expect(success).toBe(true);
		expect(result.current.isSubscribed).toBe(true);
		expect(notifQueries.savePushSubscription).toHaveBeenCalled();
	});

	it('fails gracefully when notification permission is denied', async () => {
		(window as any).Notification.requestPermission = vi
			.fn()
			.mockResolvedValue('denied');

		const { result } = renderHook(() => usePushNotifications('user-1'));

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		let success = true;
		await act(async () => {
			success = await result.current.subscribe();
		});

		expect(success).toBe(false);
		expect(result.current.error).toContain('denied');
	});

	it('unsubscribes from push notifications successfully', async () => {
		const { result } = renderHook(() => usePushNotifications('user-1'));

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		let success = false;
		await act(async () => {
			success = await result.current.unsubscribe();
		});

		expect(success).toBe(true);
		expect(mockUnsubscribe).toHaveBeenCalled();
		expect(notifQueries.deletePushSubscription).toHaveBeenCalledWith(
			'user-1',
			'https://push.example.com/test-endpoint',
		);
		expect(result.current.isSubscribed).toBe(false);
	});

	it('prevents subscribe action when user is not signed in', async () => {
		const { result } = renderHook(() => usePushNotifications(null));

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		let success = true;
		await act(async () => {
			success = await result.current.subscribe();
		});

		expect(success).toBe(false);
		expect(result.current.error).toContain('signed in');
	});
});
