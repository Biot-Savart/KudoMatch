import { create } from 'zustand';

interface UIState {
	// Mobile drawer state
	mobileMenuOpen: boolean;
	setMobileMenuOpen: (open: boolean) => void;

	// Match details slide-over prediction drawer
	activePredictionMatchId: number | null;
	predictionDrawerOpen: boolean;
	openPredictionDrawer: (matchId: number) => void;
	closePredictionDrawer: () => void;

	// Global notifications list
	notifications: Array<{
		id: string;
		message: string;
		type: 'info' | 'success' | 'error';
	}>;
	addNotification: (
		message: string,
		type?: 'info' | 'success' | 'error',
	) => void;
	removeNotification: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
	mobileMenuOpen: false,
	setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

	activePredictionMatchId: null,
	predictionDrawerOpen: false,
	openPredictionDrawer: (matchId) =>
		set({ activePredictionMatchId: matchId, predictionDrawerOpen: true }),
	closePredictionDrawer: () =>
		set({ activePredictionMatchId: null, predictionDrawerOpen: false }),

	notifications: [],
	addNotification: (message, type = 'info') => {
		const id = Math.random().toString(36).substring(2, 9);
		set((state) => ({
			notifications: [...state.notifications, { id, message, type }],
		}));
		// Automatically dismiss after 4 seconds
		setTimeout(() => {
			set((state) => ({
				notifications: state.notifications.filter((n) => n.id !== id),
			}));
		}, 4000);
	},
	removeNotification: (id) =>
		set((state) => ({
			notifications: state.notifications.filter((n) => n.id !== id),
		})),
}));
