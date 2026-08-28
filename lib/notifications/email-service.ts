import { KickoffReminderMatch, WeeklyDigestSummary } from '@/types';

export interface SendEmailOptions {
	to: string;
	subject: string;
	html: string;
	text?: string;
}

export interface EmailDispatchResult {
	success: boolean;
	provider: 'resend' | 'sendgrid' | 'mock';
	messageId?: string;
	error?: string;
}

/**
 * Generates an HTML email for matchday kickoff warnings
 */
export function generateKickoffReminderHtml(params: {
	username: string;
	matches: KickoffReminderMatch[];
	appUrl?: string;
}): { html: string; text: string } {
	const { username, matches, appUrl = 'https://kudomatch.com' } = params;
	const predictUrl = `${appUrl}/predict`;

	const matchRowsHtml = matches
		.map(
			(m) => `
      <div style="background-color: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px 16px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: 700; color: #ffffff; font-size: 14px;">
            ${m.homeTeamName} <span style="color: #64748b; font-weight: 400;">vs</span> ${m.awayTeamName}
          </div>
          <div style="font-size: 12px; color: #f59e0b; font-weight: 600;">
            ⏳ Kickoff: ${new Date(m.kickoffTime || m.startsAt || m.locksAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    `,
		)
		.join('');

	const matchRowsText = matches
		.map(
			(m) =>
				`- ${m.homeTeamName} vs ${m.awayTeamName} (Kickoff: ${new Date(m.kickoffTime || m.startsAt || m.locksAt || Date.now()).toLocaleTimeString()})`,
		)
		.join('\n');

	const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Match Kickoff Warning</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #e2e8f0; margin: 0; padding: 24px;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px;">⚽</span>
            <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 8px 0 4px 0;">Don't Miss Your Picks!</h1>
            <p style="color: #94a3b8; font-size: 14px; margin: 0;">Hey @${username}, you have unpredicted matches kicking off soon.</p>
          </div>

          <div style="margin: 24px 0;">
            <p style="font-size: 12px; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Starting Soon</p>
            ${matchRowsHtml}
          </div>

          <div style="text-align: center; margin: 32px 0 16px 0;">
            <a href="${predictUrl}" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.4);">
              Submit Predictions Now →
            </a>
          </div>

          <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 32px; padding-top: 16px; text-align: center; font-size: 11px; color: #64748b;">
            <p>You received this email because kickoff warnings are enabled in your KudoMatch profile.</p>
          </div>
        </div>
      </body>
    </html>
  `;

	const text = `
Hey @${username}!

You have unpredicted matches kicking off soon:
${matchRowsText}

Make sure to log your score predictions before lock time:
${predictUrl}
  `.trim();

	return { html, text };
}

/**
 * Generates an HTML email for weekly summary digests
 */
export function generateWeeklyDigestHtml(
	summary: WeeklyDigestSummary,
	appUrl = 'https://kudomatch.com',
): { html: string; text: string } {
	const profileUrl = `${appUrl}/profile`;
	const leaguesUrl = `${appUrl}/leagues`;

	const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weekly KudoMatch Digest</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #e2e8f0; margin: 0; padding: 24px;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px;">🏆</span>
            <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 8px 0 4px 0;">Your Weekly Match Recap</h1>
            <p style="color: #94a3b8; font-size: 14px; margin: 0;">Here is how you performed this past gameweek, @${summary.username}!</p>
          </div>

          <!-- Stats Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0;">
            <div style="background-color: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 16px; text-align: center;">
              <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Points Earned</span>
              <div style="font-size: 26px; font-weight: 900; color: #38bdf8; margin-top: 4px;">+${summary.pointsEarnedThisWeek}</div>
            </div>
            <div style="background-color: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 16px; text-align: center;">
              <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Exact Scores</span>
              <div style="font-size: 26px; font-weight: 900; color: #34d399; margin-top: 4px;">${summary.exactPredictionsThisWeek} / ${summary.totalPredictionsThisWeek}</div>
            </div>
          </div>

          <!-- Total Points & Standings Info -->
			<div style="background-color: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;">
            <div style="font-size: 14px; color: #c7d2fe; font-weight: 600;">
              Total Global Score: <span style="color: #ffffff; font-weight: 800;">${summary.totalPoints} PTS</span>
			</div>
			<div style="font-size: 12px; color: #94a3b8; margin: 12px 0; text-align: center;">
				Semantic tiers across sports: exact ${summary.tierCounts?.exact_score || 0} · margin ${summary.tierCounts?.exact_margin || 0} · close margin ${summary.tierCounts?.close_margin || 0} · outcome ${summary.tierCounts?.outcome || 0}
			</div>
            ${
							summary.topPoolName
								? `<div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Current Rank in <strong>${summary.topPoolName}</strong>: #${summary.topPoolRank || 1}</div>`
								: ''
						}
          </div>

          <div style="text-align: center; margin: 32px 0 16px 0;">
            <a href="${leaguesUrl}" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.4);">
              View Full Standings →
            </a>
          </div>

          <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 32px; padding-top: 16px; text-align: center; font-size: 11px; color: #64748b;">
            <p>You can customize weekly email notifications anytime in your <a href="${profileUrl}" style="color: #818cf8;">Profile Settings</a>.</p>
          </div>
        </div>
      </body>
    </html>
  `;

	const text = `
🏆 Weekly KudoMatch Digest for @${summary.username}

- Points Earned This Week: +${summary.pointsEarnedThisWeek}
- Exact Predictions: ${summary.exactPredictionsThisWeek} / ${summary.totalPredictionsThisWeek}
- Semantic tiers (all sports): exact ${summary.tierCounts?.exact_score || 0}, margin ${summary.tierCounts?.exact_margin || 0}, close margin ${summary.tierCounts?.close_margin || 0}, outcome ${summary.tierCounts?.outcome || 0}
- Total Global Points: ${summary.totalPoints}
${summary.topPoolName ? `- Rank in ${summary.topPoolName}: #${summary.topPoolRank || 1}` : ''}

Check out the full leaderboards: ${leaguesUrl}
  `.trim();

	return { html, text };
}

/**
 * Dispatches an email using Resend, SendGrid, or Mock transport
 */
export async function sendEmail(
	options: SendEmailOptions,
): Promise<EmailDispatchResult> {
	const resendApiKey = process.env.RESEND_API_KEY;
	const sendgridApiKey = process.env.SENDGRID_API_KEY;
	let fromEmail =
		process.env.EMAIL_FROM ||
		(resendApiKey ? 'onboarding@resend.dev' : 'notifications@kudomatch.com');

	// Resend requires verified custom domains or onboarding@resend.dev for test sending (gmail/yahoo are rejected by Resend)
	if (
		resendApiKey &&
		(fromEmail.includes('@gmail.com') ||
			fromEmail.includes('@yahoo.com') ||
			fromEmail.includes('@hotmail.com') ||
			fromEmail.includes('@outlook.com'))
	) {
		fromEmail = 'onboarding@resend.dev';
	}

	// Resend sandbox testing requirement: map @example.com test addresses to delivered@resend.dev
	const targetRecipient =
		resendApiKey && options.to.endsWith('@example.com')
			? 'delivered@resend.dev'
			: options.to;

	try {
		// 1. Resend Dispatch
		if (resendApiKey) {
			const res = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${resendApiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					from: fromEmail,
					to: targetRecipient,
					subject: options.subject,
					html: options.html,
					text: options.text,
				}),
			});

			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}));
				throw new Error(
					`Resend API error: ${res.status} ${JSON.stringify(errorData)}`,
				);
			}

			const data = await res.json();
			return { success: true, provider: 'resend', messageId: data.id };
		}

		// 2. SendGrid Dispatch
		if (sendgridApiKey) {
			const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${sendgridApiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					personalizations: [{ to: [{ email: options.to }] }],
					from: { email: fromEmail },
					subject: options.subject,
					content: [
						{ type: 'text/html', value: options.html },
						...(options.text
							? [{ type: 'text/plain', value: options.text }]
							: []),
					],
				}),
			});

			if (!res.ok) {
				const errorText = await res.text();
				throw new Error(`SendGrid API error: ${res.status} ${errorText}`);
			}

			return { success: true, provider: 'sendgrid' };
		}

		// 3. Fallback / Mock Mode (for tests and local development without API keys)
		console.log(
			`📧 [MOCK EMAIL DISPATCH] To: ${options.to} | Subject: "${options.subject}"`,
		);
		return {
			success: true,
			provider: 'mock',
			messageId: `mock-${Date.now()}`,
		};
	} catch (err: any) {
		console.error('❌ Email dispatch failed:', err);
		return {
			success: false,
			provider: resendApiKey ? 'resend' : sendgridApiKey ? 'sendgrid' : 'mock',
			error: err.message || 'Failed to dispatch email',
		};
	}
}
