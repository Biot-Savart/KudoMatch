import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	const urlStr =
		process.env.NEXT_PUBLIC_SUPABASE_URL ||
		'https://placeholder-project-id.supabase.co';
	const anonKey =
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
		'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

	const supabase = createServerClient(urlStr, anonKey, {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value, options }) =>
					request.cookies.set(name, value),
				);
				supabaseResponse = NextResponse.next({
					request,
				});
				cookiesToSet.forEach(({ name, value, options }) =>
					supabaseResponse.cookies.set(name, value, options),
				);
			},
		},
	});

	// This will refresh session if expired - required for Server Components
	// and Route Handlers to get the correct user.
	let user = null;
	try {
		if (
			process.env.NEXT_PUBLIC_SUPABASE_URL &&
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
		) {
			const {
				data: { user: authUser },
			} = await supabase.auth.getUser();
			user = authUser;
		}
	} catch (err) {
		console.error('Supabase middleware error:', err);
	}

	const url = request.nextUrl.clone();

	// Define protected and auth-only routes
	const isProtectedRoute =
		url.pathname.startsWith('/predict') ||
		url.pathname.startsWith('/leagues') ||
		url.pathname.startsWith('/profile');

	const isAuthRoute =
		url.pathname.startsWith('/login') ||
		url.pathname.startsWith('/signup') ||
		url.pathname.startsWith('/reset-password');

	if (!user && isProtectedRoute) {
		// Redirect unauthenticated users to login page
		url.pathname = '/login';
		return NextResponse.redirect(url);
	}

	if (user && isAuthRoute) {
		// Redirect authenticated users to home dashboard
		url.pathname = '/';
		return NextResponse.redirect(url);
	}

	return supabaseResponse;
}
