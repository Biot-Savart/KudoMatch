import { GET } from '@/app/auth/callback/route';

const { mockSupabaseClient } = globalThis as any;

describe('app/auth/callback/route', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(mockSupabaseClient.auth as any).exchangeCodeForSession = vi.fn();
	});

	it('exchanges code for session and redirects to next if successful', async () => {
		(
			(mockSupabaseClient.auth as any).exchangeCodeForSession as any
		).mockResolvedValueOnce({ error: null });

		const request = new Request(
			'https://kudomatch.com/auth/callback?code=valid-code&next=/profile',
		);
		const response = await GET(request);

		expect(
			(mockSupabaseClient.auth as any).exchangeCodeForSession,
		).toHaveBeenCalledWith('valid-code');
		expect(response.status).toBe(307); // NextResponse.redirect status code
		expect(response.headers.get('location')).toBe(
			'https://kudomatch.com/profile',
		);
	});

	it('redirects to next default / if no next query param is specified', async () => {
		(
			(mockSupabaseClient.auth as any).exchangeCodeForSession as any
		).mockResolvedValueOnce({ error: null });

		const request = new Request(
			'https://kudomatch.com/auth/callback?code=valid-code',
		);
		const response = await GET(request);

		expect(response.status).toBe(307);
		expect(response.headers.get('location')).toBe('https://kudomatch.com/');
	});

	it('redirects to login error page if code exchange fails', async () => {
		(
			(mockSupabaseClient.auth as any).exchangeCodeForSession as any
		).mockResolvedValueOnce({ error: new Error('Invalid code') });

		const request = new Request(
			'https://kudomatch.com/auth/callback?code=bad-code',
		);
		const response = await GET(request);

		expect(response.status).toBe(307);
		expect(response.headers.get('location')).toBe(
			'https://kudomatch.com/login?error=Could%20not%20authenticate%20user',
		);
	});

	it('redirects to login error page if code parameter is missing', async () => {
		const request = new Request('https://kudomatch.com/auth/callback');
		const response = await GET(request);

		expect(response.status).toBe(307);
		expect(response.headers.get('location')).toBe(
			'https://kudomatch.com/login?error=Could%20not%20authenticate%20user',
		);
	});
});
