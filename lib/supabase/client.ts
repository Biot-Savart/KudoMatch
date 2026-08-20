import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
	const url =
		process.env.NEXT_PUBLIC_SUPABASE_URL ||
		'https://placeholder-project-id.supabase.co';
	const anonKey =
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
		'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

	return createBrowserClient(url, anonKey);
}
