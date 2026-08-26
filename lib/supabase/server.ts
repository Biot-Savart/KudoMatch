import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export function createClient() {
	// Bypass next/headers request scope check during Vitest unit testing
	const cookieStore =
		typeof process !== 'undefined' && process.env.VITEST === 'true'
			? {
					getAll: () => [],
					set: () => {},
					delete: () => {},
				}
			: cookies();

	const url =
		process.env.NEXT_PUBLIC_SUPABASE_URL ||
		'https://placeholder-project-id.supabase.co';
	const anonKey =
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
		'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

	return createServerClient(url, anonKey, {
		cookies: {
			getAll() {
				return cookieStore.getAll();
			},
			setAll(cookiesToSet) {
				try {
					cookiesToSet.forEach(({ name, value, options }) =>
						cookieStore.set(name, value, options),
					);
				} catch {
					// The `setAll` method can be called from a Server Component.
					// This can be ignored if you have middleware refreshing
					// user sessions.
				}
			},
		},
	});
}

/**
 * Creates a server-only service-role client for background jobs and ingestion pipelines.
 * Never expose the service role key to client components or public bundles.
 * Requires both SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL).
 */
export function createServiceRoleClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !serviceRoleKey) {
		throw new Error(
			'Missing Supabase service-role credentials: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.',
		);
	}

	return createSupabaseClient(url, serviceRoleKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
		},
	});
}
