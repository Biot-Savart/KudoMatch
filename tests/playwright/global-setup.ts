import { createClient } from '@supabase/supabase-js';

export default async function globalSetup() {
	// Linked credentials are never committed. Local runs can opt into disposable
	// users with SUPABASE_SERVICE_ROLE_KEY; without it the public smoke suite
	// remains runnable against a seeded anonymous environment.
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !serviceKey || !url.includes('127.0.0.1') && !url.includes('localhost')) return;
	const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
	const suffix = Date.now();
	for (const role of ['alpha', 'beta']) {
		await admin.auth.admin.createUser({ email: `playwright-${role}-${suffix}@local.test`, password: 'LocalPlaywright!123', email_confirm: true });
	}
}

