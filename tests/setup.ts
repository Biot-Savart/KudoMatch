import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock dotenv globally
vi.mock('dotenv', () => {
	const configFn = vi.fn();
	return {
		config: configFn,
		parse: vi.fn(),
		default: {
			config: configFn,
			parse: vi.fn(),
		},
		__esModule: true,
	};
});

// Mock canvas-confetti globally
vi.mock('canvas-confetti', () => {
	const confettiMock = vi.fn();
	return {
		default: confettiMock,
		create: () => confettiMock,
		reset: vi.fn(),
	};
});

// Mock next/headers
vi.mock('next/headers', () => ({
	cookies: () => ({
		get: vi.fn(),
		getAll: vi.fn().mockReturnValue([]),
		set: vi.fn(),
		delete: vi.fn(),
	}),
}));

// Simple Mock Query Builder Class
export class MockQueryBuilder {
	private data: any;
	private error: any;

	constructor(data: any = [], error: any = null) {
		this.data = data;
		this.error = error;
	}

	select = vi.fn().mockImplementation(() => this);
	insert = vi.fn().mockImplementation(() => this);
	update = vi.fn().mockImplementation(() => this);
	delete = vi.fn().mockImplementation(() => this);
	upsert = vi.fn().mockImplementation(() => this);
	eq = vi.fn().mockImplementation(() => this);
	neq = vi.fn().mockImplementation(() => this);
	gt = vi.fn().mockImplementation(() => this);
	lt = vi.fn().mockImplementation(() => this);
	gte = vi.fn().mockImplementation(() => this);
	lte = vi.fn().mockImplementation(() => this);
	or = vi.fn().mockImplementation(() => this);
	in = vi.fn().mockImplementation(() => this);
	is = vi.fn().mockImplementation(() => this);
	not = vi.fn().mockImplementation(() => this);
	order = vi.fn().mockImplementation(() => this);
	limit = vi.fn().mockImplementation(() => this);
	single = vi.fn().mockImplementation(() => {
		const singleData = Array.isArray(this.data) ? this.data[0] : this.data;
		return Promise.resolve({ data: singleData || null, error: this.error });
	});
	maybeSingle = vi.fn().mockImplementation(() => {
		const singleData = Array.isArray(this.data) ? this.data[0] : this.data;
		return Promise.resolve({ data: singleData || null, error: this.error });
	});

	// Thenable implementation to support direct `await supabase.from(...)`
	then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
		return Promise.resolve({ data: this.data, error: this.error }).then(
			onfulfilled,
			onrejected,
		);
	}
}

export const mockSupabaseClient = {
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
	from: vi.fn(() => new MockQueryBuilder()),
	rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock('@supabase/ssr', () => ({
	createBrowserClient: vi.fn(() => mockSupabaseClient),
	createServerClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('@supabase/supabase-js', () => ({
	createClient: vi.fn(() => mockSupabaseClient),
}));

// Bind to globalThis for clean access in all tests without relative imports
(globalThis as any).mockSupabaseClient = mockSupabaseClient;
(globalThis as any).MockQueryBuilder = MockQueryBuilder;

// --- BROWSER / DOM MOCKS ---

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(), // deprecated
		removeListener: vi.fn(), // deprecated
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// Mock ResizeObserver
class ResizeObserverMock {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}
window.ResizeObserver = ResizeObserverMock;

// Mock IntersectionObserver
class IntersectionObserverMock {
	readonly root: Element | Document | null = null;
	readonly rootMargin: string = '';
	readonly thresholds: ReadonlyArray<number> = [];
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
	takeRecords = vi.fn().mockReturnValue([]);
}
window.IntersectionObserver = IntersectionObserverMock as any;

// Mock window.scroll & scrollTo
window.scrollTo = vi.fn();
window.scroll = vi.fn();

// --- NEXT.JS MOCKS ---

const mockRouter = {
	push: vi.fn(),
	replace: vi.fn(),
	prefetch: vi.fn(),
	back: vi.fn(),
	forward: vi.fn(),
	refresh: vi.fn(),
};

const mockPathname = vi.fn(() => '/');
const mockSearchParams = {
	get: vi.fn(),
	forEach: vi.fn(),
};

vi.mock('next/navigation', () => ({
	useRouter: () => mockRouter,
	usePathname: () => mockPathname(),
	useSearchParams: () => mockSearchParams,
	redirect: (url: string) => {
		throw new Error(`Redirect to: ${url}`);
	},
}));

// Mock framer-motion to avoid animation timing in tests
vi.mock('framer-motion', () => {
	const React = require('react');
	const DummyComponent = ({ children, ...props }: any) => {
		return React.createElement('div', props, children);
	};
	return {
		motion: {
			div: DummyComponent,
			button: DummyComponent,
			span: DummyComponent,
			h1: DummyComponent,
			p: DummyComponent,
		},
		AnimatePresence: ({ children }: any) => children,
	};
});

// Reset all mocks between tests
beforeEach(() => {
	vi.clearAllMocks();
});

export {};
