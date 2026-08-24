import { sendWeeklyDigest } from '@/scripts/send-weekly-digest';
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
		// 1. Verify cron authorization token
		const authHeader = req.headers.get('authorization');
		const searchParams = req.nextUrl.searchParams;
		const secretParam = searchParams.get('secret');

		const expectedSecret = process.env.CRON_SECRET;

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

		// 2. Read query execution options
		const simulate = searchParams.get('simulate') === 'true';

		// 3. Trigger weekly digest pipeline
		console.log(
			`🤖 Weekly Digest Cron trigger received. Simulating: ${simulate}`,
		);
		const result = await sendWeeklyDigest({ simulate });

		if (!result.success) {
			return NextResponse.json(
				{ success: false, error: result.error },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			message: `Weekly digests processed. Sent to ${result.digestsSent} users.`,
			details: result,
			timestamp: new Date().toISOString(),
		});
	} catch (err: any) {
		console.error('❌ Exception in send-weekly-digest cron route:', err);
		return NextResponse.json(
			{ success: false, error: err.message || 'Internal server error.' },
			{ status: 500 },
		);
	}
}
