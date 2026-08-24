export async function triggerConfetti(options?: any) {
	if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') {
		return;
	}
	try {
		const confetti = (await import('canvas-confetti')).default;
		confetti(options);
	} catch {
		// safe fallback
	}
}
