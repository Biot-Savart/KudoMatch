import { sendKickoffReminders } from '@/scripts/send-kickoff-reminders';
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
		const windowParam = searchParams.get('window');
		const windowMinutes = windowParam ? parseInt(windowParam, 10) : 60;

		// 3. Trigger kickoff reminder pipeline
		console.log(
			`🤖 Kickoff Reminders Cron trigger received. Simulating: ${simulate}, Window: ${windowMinutes}m`,
		);
		const result = await sendKickoffReminders({ simulate, windowMinutes });

		if (!result.success) {
			return NextResponse.json(
				{ success: false, error: result.error },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			message: `Kickoff reminders evaluated. ${result.usersNotified} users notified for ${result.matchesFound} matches.`,
			details: result,
			timestamp: new Date().toISOString(),
		});
	} catch (err: any) {
		console.error('❌ Exception in send-kickoff-reminders cron route:', err);
		return NextResponse.json(
			{ success: false, error: err.message || 'Internal server error.' },
			{ status: 500 },
		);
	}
}
