import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
	const cookieStore = cookies();
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
