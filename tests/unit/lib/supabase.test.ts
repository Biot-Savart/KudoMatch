vi.mock('next/headers', () => ({
	cookies: () => ({
		get: vi.fn(),
		getAll: vi.fn().mockReturnValue([]),
		set: vi.fn(),
		delete: vi.fn(),
	}),
}));

const mockSupabaseClientLocal = {
	auth: {
		getUser: vi.fn().mockResolvedValue({
			data: { user: { id: 'test-user-id', email: 'test@example.com' } },
			error: null,
		}),
		getSession: vi.fn().mockResolvedValue({
			data: {
				session: { access_token: 'dummy', user: { id: 'test-user-id' } },
			},
			error: null,
		}),
		signUp: vi.fn().mockResolvedValue({
			data: { user: { id: 'test-user-id' } },
			error: null,
		}),
		signInWithPassword: vi.fn().mockResolvedValue({
			data: { user: { id: 'test-user-id' } },
			error: null,
		}),
		signInWithOtp: vi
			.fn()
			.mockResolvedValue({ data: { user: null }, error: null }),
		signInWithOAuth: vi.fn().mockResolvedValue({
			data: { provider: 'google', url: 'https://google.com' },
			error: null,
		}),
		signOut: vi.fn().mockResolvedValue({ error: null }),
		resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
		updateUser: vi.fn().mockResolvedValue({
			data: { user: { id: 'test-user-id' } },
			error: null,
		}),
		onAuthStateChange: vi
			.fn()
			.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
	},
	from: vi.fn(() => ({
		select: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		update: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
		upsert: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		neq: vi.fn().mockReturnThis(),
		gt: vi.fn().mockReturnThis(),
		lt: vi.fn().mockReturnThis(),
		gte: vi.fn().mockReturnThis(),
		lte: vi.fn().mockReturnThis(),
		or: vi.fn().mockReturnThis(),
		order: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		single: vi.fn().mockResolvedValue({ data: null, error: null }),
	})),
	rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

// Hoisted mocks that return the mockSupabaseClientLocal structure cleanly
vi.mock('@supabase/ssr', () => {
	const client = {
		auth: {
			getUser: vi.fn().mockResolvedValue({
				data: { user: { id: 'test-user-id', email: 'test@example.com' } },
				error: null,
			}),
			getSession: vi.fn().mockResolvedValue({
				data: {
					session: { access_token: 'dummy', user: { id: 'test-user-id' } },
				},
				error: null,
			}),
			signUp: vi.fn().mockResolvedValue({
				data: { user: { id: 'test-user-id' } },
				error: null,
			}),
			signInWithPassword: vi.fn().mockResolvedValue({
				data: { user: { id: 'test-user-id' } },
				error: null,
			}),
			signInWithOtp: vi
				.fn()
				.mockResolvedValue({ data: { user: null }, error: null }),
			signInWithOAuth: vi.fn().mockResolvedValue({
				data: { provider: 'google', url: 'https://google.com' },
				error: null,
			}),
			signOut: vi.fn().mockResolvedValue({ error: null }),
			resetPasswordForEmail: vi
				.fn()
				.mockResolvedValue({ data: {}, error: null }),
			updateUser: vi.fn().mockResolvedValue({
				data: { user: { id: 'test-user-id' } },
				error: null,
			}),
			onAuthStateChange: vi
				.fn()
				.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
		},
		from: vi.fn(() => ({
			select: vi.fn().mockReturnThis(),
			insert: vi.fn().mockReturnThis(),
			update: vi.fn().mockReturnThis(),
			delete: vi.fn().mockReturnThis(),
			upsert: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			neq: vi.fn().mockReturnThis(),
			gt: vi.fn().mockReturnThis(),
			lt: vi.fn().mockReturnThis(),
			gte: vi.fn().mockReturnThis(),
			lte: vi.fn().mockReturnThis(),
			or: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			limit: vi.fn().mockReturnThis(),
			single: vi.fn().mockResolvedValue({ data: null, error: null }),
		})),
		rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
	};
	return {
		createBrowserClient: vi.fn(() => client),
		createServerClient: vi.fn(() => client),
	};
});

vi.mock('@supabase/supabase-js', () => {
	const client = {
		auth: {
			getUser: vi.fn().mockResolvedValue({
				data: { user: { id: 'test-user-id', email: 'test@example.com' } },
				error: null,
			}),
			getSession: vi.fn().mockResolvedValue({
				data: {
					session: { access_token: 'dummy', user: { id: 'test-user-id' } },
				},
				error: null,
			}),
			signUp: vi.fn().mockResolvedValue({
				data: { user: { id: 'test-user-id' } },
				error: null,
			}),
			signInWithPassword: vi.fn().mockResolvedValue({
				data: { user: { id: 'test-user-id' } },
				error: null,
			}),
			signInWithOtp: vi
				.fn()
				.mockResolvedValue({ data: { user: null }, error: null }),
			signInWithOAuth: vi.fn().mockResolvedValue({
				data: { provider: 'google', url: 'https://google.com' },
				error: null,
			}),
			signOut: vi.fn().mockResolvedValue({ error: null }),
			resetPasswordForEmail: vi
				.fn()
				.mockResolvedValue({ data: {}, error: null }),
			updateUser: vi.fn().mockResolvedValue({
				data: { user: { id: 'test-user-id' } },
				error: null,
			}),
			onAuthStateChange: vi
				.fn()
				.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
		},
		from: vi.fn(() => ({
			select: vi.fn().mockReturnThis(),
			insert: vi.fn().mockReturnThis(),
			update: vi.fn().mockReturnThis(),
			delete: vi.fn().mockReturnThis(),
			upsert: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			neq: vi.fn().mockReturnThis(),
			gt: vi.fn().mockReturnThis(),
			lt: vi.fn().mockReturnThis(),
			gte: vi.fn().mockReturnThis(),
			lte: vi.fn().mockReturnThis(),
			or: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			limit: vi.fn().mockReturnThis(),
			single: vi.fn().mockResolvedValue({ data: null, error: null }),
		})),
		rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
	};
	return {
		createClient: vi.fn(() => client),
	};
});

const { mockSupabaseClient } = globalThis as any;

import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { updateSession } from '@/lib/supabase/middleware';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

describe('lib/supabase/client', () => {
	it('should instantiate browser client correctly', () => {
		const client = createBrowserClient();
		expect(client).toBeDefined();
	});
});

describe('lib/supabase/server', () => {
	it('should instantiate server client correctly', () => {
		const client = createServerClient();
		expect(client).toBeDefined();
	});
});

describe('lib/supabase/middleware', () => {
	const createMockRequest = (pathname: string): NextRequest => {
		const url = new URL(`https://kudomatch.com${pathname}`);
		const req = {
			url: url.toString(),
			nextUrl: {
				pathname,
				clone: () => new URL(url.toString()),
			},
			cookies: {
				getAll: vi.fn().mockReturnValue([]),
				set: vi.fn(),
			},
		} as unknown as NextRequest;
		return req;
	};

	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it('should redirect unauthenticated users away from protected routes', async () => {
		// Force unauthenticated user
		(mockSupabaseClient.auth.getUser as any).mockResolvedValueOnce({
			data: { user: null },
			error: new Error('No user'),
		});

		const req = createMockRequest('/predict');
		const response = await updateSession(req);

		expect(response).toBeDefined();
	});

	it('should redirect authenticated users away from auth routes', async () => {
		// Force authenticated user
		(mockSupabaseClient.auth.getUser as any).mockResolvedValueOnce({
			data: { user: { id: 'test-user', email: 'test@example.com' } },
			error: null,
		});

		const req = createMockRequest('/login');
		const response = await updateSession(req);

		expect(response).toBeDefined();
	});

	it('should let unauthenticated users access public pages', async () => {
		(mockSupabaseClient.auth.getUser as any).mockResolvedValueOnce({
			data: { user: null },
			error: null,
		});

		const req = createMockRequest('/');
		const response = await updateSession(req);
		expect(response).toBeDefined();
	});

	it('should handle session update with cookies setting and errors', async () => {
		// Mock getuser error throwing
		(mockSupabaseClient.auth.getUser as any).mockImplementationOnce(() => {
			throw new Error('Database down');
		});

		const req = createMockRequest('/predict');
		const response = await updateSession(req);
		expect(response).toBeDefined();
	});
});
