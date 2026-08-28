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
		// 1. Enforce secure Authorization Bearer header only (reject query-string secret)
		const authHeader = req.headers.get('authorization');
		const searchParams = req.nextUrl.searchParams;

		if (searchParams.has('secret')) {
			return NextResponse.json(
				{
					success: false,
					error:
						'Security violation: Passing cron secret via URL query parameter is forbidden. Use Authorization: Bearer <secret> header.',
				},
				{ status: 400 },
			);
		}

		const expectedSecret = process.env.CRON_SECRET;

		// Skip auth if CRON_SECRET is not set in development or test
		if (expectedSecret && process.env.NODE_ENV === 'production') {
			const hasBearerMatch = authHeader === `Bearer ${expectedSecret}`;

			if (!hasBearerMatch) {
				return NextResponse.json(
					{
						success: false,
						error: 'Unauthorized: Invalid cron authorization token.',
					},
					{ status: 401 },
				);
			}
		} else if (expectedSecret) {
			const hasBearerMatch = authHeader === `Bearer ${expectedSecret}`;
			if (!hasBearerMatch) {
				return NextResponse.json(
					{
						success: false,
						error: 'Unauthorized: Invalid cron authorization token.',
					},
					{ status: 401 },
				);
			}
		}

		// 2. Read execution options
		const simulate = searchParams.get('simulate') === 'true';
		const dryRun = searchParams.get('dryRun') === 'true';
		const sport =
			searchParams.get('sport') === 'rugby-union' ? 'rugby-union' : 'football';

		// 3. Trigger score ingestion process
		console.log(
			`🤖 Cron trigger received. Sport: ${sport}, Simulating: ${simulate}`,
		);
		const result = await fetchLiveScores({
			sport,
			simulate,
			dryRun,
		});

		if (!result.success && result.status !== 'already_running') {
			return NextResponse.json(
				{
					success: false,
					error: result.error || 'Ingestion failure',
					summary: result.summary,
				},
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			status: result.status,
			message: `Score sync successfully processed. Updated ${result.updated} records.`,
			updated: result.updated,
			summary: result.summary,
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
