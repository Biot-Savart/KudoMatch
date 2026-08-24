// Service Worker for KudoMatch Web Push Notifications

self.addEventListener('push', function (event) {
	if (!event.data) {
		console.log('Push event received but no payload data found.');
		return;
	}

	try {
		const payload = event.data.json();
		const title = payload.title || 'KudoMatch Alert';
		const options = {
			body: payload.body || 'You have a new notification from KudoMatch',
			icon: payload.icon || '/favicon.ico',
			badge: payload.badge || '/favicon.ico',
			data: payload.data || { url: '/predict' },
			vibrate: [100, 50, 100],
		};

		event.waitUntil(self.registration.showNotification(title, options));
	} catch (err) {
		console.error('Error handling push notification in service worker:', err);
		// Fallback for plain text
		const text = event.data.text();
		event.waitUntil(
			self.registration.showNotification('KudoMatch', {
				body: text,
				icon: '/favicon.ico',
				data: { url: '/predict' },
			}),
		);
	}
});

self.addEventListener('notificationclick', function (event) {
	event.notification.close();

	const targetUrl =
		(event.notification.data && event.notification.data.url) || '/predict';

	event.waitUntil(
		clients
			.matchAll({ type: 'window', includeUncontrolled: true })
			.then(function (windowClients) {
				// If a window is already open, focus it and navigate
				for (let i = 0; i < windowClients.length; i++) {
					const client = windowClients[i];
					if (client.url.includes(self.location.origin) && 'focus' in client) {
						client.focus();
						if ('navigate' in client) {
							client.navigate(targetUrl);
						}
						return;
					}
				}
				// If not open, open a new window
				if (clients.openWindow) {
					return clients.openWindow(targetUrl);
				}
			}),
	);
});
