import { fetchLiveScores } from '@/scripts/fetch-live-scores';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
	return handleCron(req);
}

export async function POST(req: NextRequest) {
	return handleCron(req);
}

async function handleCron(req: NextRequest) {
	try {
		// 1. Verify cron authorization token to prevent unauthorized triggers
		const authHeader = req.headers.get('authorization');
		const searchParams = req.nextUrl.searchParams;
		const secretParam = searchParams.get('secret');

		const expectedSecret = process.env.CRON_SECRET;

		// Skip auth if CRON_SECRET is not set in development
		if (expectedSecret) {
			const hasBearerMatch = authHeader === `Bearer ${expectedSecret}`;
			const hasParamMatch = secretParam === expectedSecret;

			if (!hasBearerMatch && !hasParamMatch) {
				return NextResponse.json(
					{ success: false, error: 'Unauthorized: Invalid cron secret key.' },
					{ status: 401 },
				);
			}
		}

		// 2. Read execution options from query parameters
		const simulate = searchParams.get('simulate') === 'true';

		// 3. Trigger score ingestion process
		console.log(`🤖 Cron trigger received. Simulating: ${simulate}`);
		const result = await fetchLiveScores({ simulate });

		if (!result.success) {
			return NextResponse.json(
				{ success: false, error: result.error },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			message: `Score sync successfully executed. Updated ${result.updated} matches.`,
			updated: result.updated,
			timestamp: new Date().toISOString(),
		});
	} catch (err: any) {
		console.error('❌ Exception in fetch-live-scores cron route:', err);
		return NextResponse.json(
			{ success: false, error: err.message || 'Internal server error.' },
			{ status: 500 },
		);
	}
}
