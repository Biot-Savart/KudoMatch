import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error('❌ Missing Supabase environment variables. Check .env.local');
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		persistSession: false,
	},
});

export async function resolveMarketResult(
	marketId: number | string,
	homeScore: number,
	awayScore: number,
	status: 'provisional' | 'final' = 'final',
) {
	console.log(
		`⚽ Setting result on market ${marketId}: ${homeScore}-${awayScore} (${status})...`,
	);

	const { data: market, error: mErr } = await supabase
		.from('event_markets')
		.select('*, events(*)')
		.eq('id', Number(marketId))
		.single();

	if (mErr || !market) {
		throw new Error(`Market not found: ${marketId}`);
	}

	// 1. Lock market if not locked
	await supabase
		.from('event_markets')
		.update({ status: 'locked' })
		.eq('id', Number(marketId));

	// 2. Insert/Update market result
	const { data: res, error: resErr } = await supabase
		.from('market_results')
		.upsert({
			event_market_id: Number(marketId),
			result: {
				kind: market.market_kind,
				version: market.payload_schema_version,
				home: homeScore,
				away: awayScore,
			},
			revision: 1,
			status,
			source_kind: 'manual',
			source_priority: 10,
			finalized_at: status === 'final' ? new Date().toISOString() : null,
			updated_at: new Date().toISOString(),
		})
		.select()
		.single();

	if (resErr) throw resErr;

	// 3. Mark market as settled and event as completed if final
	if (status === 'final') {
		await supabase
			.from('event_markets')
			.update({ status: 'settled' })
			.eq('id', Number(marketId));

		if (market.event_id) {
			await supabase
				.from('events')
				.update({ status: 'completed' })
				.eq('id', market.event_id);
		}
	}

	console.log(`✅ Market ${marketId} settled. Result recorded.`);
	return res;
}

export async function simulateRound(roundLabel: string = 'Round 12') {
	console.log(`🎲 Simulating outcomes for ${roundLabel}...`);

	const { data: events, error } = await supabase
		.from('events')
		.select('id, round_label, event_markets(id, market_kind, is_current)')
		.eq('round_label', roundLabel);

	if (error || !events || events.length === 0) {
		console.warn(`No events found for ${roundLabel}`);
		return;
	}

	for (const ev of events) {
		const currentMarket =
			(ev as any).event_markets?.find((m: any) => m.is_current) ??
			(ev as any).event_markets?.[0];
		if (!currentMarket) continue;

		const randomHome = Math.floor(Math.random() * 4);
		const randomAway = Math.floor(Math.random() * 4);
		await resolveMarketResult(
			currentMarket.id,
			randomHome,
			randomAway,
			'final',
		);
	}

	console.log(`✅ Completed simulation for ${roundLabel}`);
}

async function run() {
	const args = process.argv.slice(2);
	const hasSimulate = args.includes('--simulate');
	const hasResolve = args.includes('--resolve');

	const roundArg = args.find((a) => a.startsWith('--round='));
	const round = roundArg ? roundArg.split('=')[1] : 'Round 12';

	const marketIdArg = args.find((a) => a.startsWith('--marketId='));
	const marketId = marketIdArg ? marketIdArg.split('=')[1] : null;

	const homeScoreArg = args.find((a) => a.startsWith('--homeScore='));
	const homeScore = homeScoreArg ? parseInt(homeScoreArg.split('=')[1]) : null;

	const awayScoreArg = args.find((a) => a.startsWith('--awayScore='));
	const awayScore = awayScoreArg ? parseInt(awayScoreArg.split('=')[1]) : null;

	if (hasSimulate) {
		await simulateRound(round);
	} else if (hasResolve) {
		if (!marketId || homeScore === null || awayScore === null) {
			console.error(
				'Usage: --resolve --marketId=<id> --homeScore=<int> --awayScore=<int>',
			);
			process.exit(1);
		}
		await resolveMarketResult(marketId, homeScore, awayScore, 'final');
	} else {
		console.log(`
🏆 KudoMatch Score Settlement CLI
Usage:
  --simulate [--round="Round 12"]
  --resolve --marketId=<id> --homeScore=<n> --awayScore=<n>
`);
	}
}

if (require.main === module) {
	run()
		.then(() => process.exit(0))
		.catch((err) => {
			console.error('Error:', err);
			process.exit(1);
		});
}
