/**
 * Robust retry, timeout, and backoff utility for external sports data providers
 */

export interface RetryOptions {
	maxRetries?: number;
	initialDelayMs?: number;
	maxDelayMs?: number;
	backoffFactor?: number;
	timeoutMs?: number;
	onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

export async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	errorMessage = 'Operation timed out',
): Promise<T> {
	let timer: NodeJS.Timeout | null = null;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			reject(new Error(errorMessage));
		}, timeoutMs);
	});

	try {
		return await Promise.race([promise, timeoutPromise]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

export async function withRetry<T>(
	operation: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const maxRetries = options.maxRetries ?? 3;
	const initialDelayMs = options.initialDelayMs ?? 500;
	const maxDelayMs = options.maxDelayMs ?? 5000;
	const backoffFactor = options.backoffFactor ?? 2;
	const timeoutMs = options.timeoutMs ?? 15000;

	let lastError: unknown;

	for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
		try {
			return await withTimeout(
				operation(),
				timeoutMs,
				`Request timed out after ${timeoutMs}ms`,
			);
		} catch (error: any) {
			lastError = error;

			// Do not retry 4xx client errors except 429
			const is4xx =
				error?.status &&
				error.status >= 400 &&
				error.status < 500 &&
				error.status !== 429;
			if (is4xx || attempt > maxRetries) {
				throw error;
			}

			// Calculate delay with exponential backoff and jitter
			let delay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
			if (error?.retryAfterMs && typeof error.retryAfterMs === 'number') {
				delay = error.retryAfterMs;
			}
			const jitter = Math.random() * 0.3 * delay;
			const totalDelay = Math.min(delay + jitter, maxDelayMs);

			options.onRetry?.(attempt, error, totalDelay);
			await new Promise((resolve) => setTimeout(resolve, totalDelay));
		}
	}

	throw lastError;
}
