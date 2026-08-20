import { useUIStore } from '@/store/use-ui-store';

describe('store/use-ui-store', () => {
	beforeEach(() => {
		// Reset Zustand store state before each test
		useUIStore.setState({
			mobileMenuOpen: false,
			activePredictionMatchId: null,
			predictionDrawerOpen: false,
			notifications: [],
		});
	});

	it('should toggle mobile menu open state', () => {
		expect(useUIStore.getState().mobileMenuOpen).toBe(false);

		useUIStore.getState().setMobileMenuOpen(true);
		expect(useUIStore.getState().mobileMenuOpen).toBe(true);

		useUIStore.getState().setMobileMenuOpen(false);
		expect(useUIStore.getState().mobileMenuOpen).toBe(false);
	});

	it('should open and close prediction drawer with correct match ID', () => {
		expect(useUIStore.getState().predictionDrawerOpen).toBe(false);
		expect(useUIStore.getState().activePredictionMatchId).toBeNull();

		useUIStore.getState().openPredictionDrawer(42);
		expect(useUIStore.getState().predictionDrawerOpen).toBe(true);
		expect(useUIStore.getState().activePredictionMatchId).toBe(42);

		useUIStore.getState().closePredictionDrawer();
		expect(useUIStore.getState().predictionDrawerOpen).toBe(false);
		expect(useUIStore.getState().activePredictionMatchId).toBeNull();
	});

	it('should add, auto-dismiss, and manually remove notifications', () => {
		vi.useFakeTimers();

		expect(useUIStore.getState().notifications).toEqual([]);

		useUIStore.getState().addNotification('Test info notification');
		let notifications = useUIStore.getState().notifications;
		expect(notifications).toHaveLength(1);
		expect(notifications[0].message).toBe('Test info notification');
		expect(notifications[0].type).toBe('info');
		const firstId = notifications[0].id;

		// Add another success notification
		useUIStore.getState().addNotification('Success!', 'success');
		notifications = useUIStore.getState().notifications;
		expect(notifications).toHaveLength(2);
		expect(notifications[1].message).toBe('Success!');
		expect(notifications[1].type).toBe('success');
		const secondId = notifications[1].id;

		// Manually remove first one
		useUIStore.getState().removeNotification(firstId);
		expect(useUIStore.getState().notifications).toHaveLength(1);
		expect(useUIStore.getState().notifications[0].id).toBe(secondId);

		// Fast-forward 4 seconds to trigger auto-dismiss of the second notification
		vi.advanceTimersByTime(4000);
		expect(useUIStore.getState().notifications).toHaveLength(0);

		vi.useRealTimers();
	});
});
