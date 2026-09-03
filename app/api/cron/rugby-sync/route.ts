import { createServiceRoleClient } from '@/lib/supabase/server';
import { runRugbySyncDispatcher } from '@/lib/sports/ingestion/dispatcher';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function authorized(request: NextRequest): boolean {
	const expected = process.env.CRON_SECRET;
	if (process.env.NODE_ENV === 'production' && !expected) return false;
	if (!expected) return process.env.NODE_ENV !== 'production';
	return request.headers.get('authorization') === `Bearer ${expected}`;
}

async function handle(request: NextRequest) {
	if (!authorized(request)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
	try {
		const params = request.nextUrl.searchParams;
		const maxTargets = Math.min(Math.max(Number(params.get('maxTargets') ?? 10) || 10, 1), 100);
		const result = await runRugbySyncDispatcher({
			supabase: createServiceRoleClient(),
			maxTargets,
			invocationSource: 'cron',
		});
		return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
	} catch (error) {
		console.error('Rugby sync dispatcher failed:', error);
		return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
	}
}

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
