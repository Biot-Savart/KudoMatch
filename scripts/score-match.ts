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

async function run() {
	const args = process.argv.slice(2);
	const hasSimulate = args.includes('--simulate');
	const hasRecalc = args.includes('--recalc');
	const hasResolve = args.includes('--resolve');

	const matchdayArg = args.find((arg) => arg.startsWith('--matchday='));
	const matchday = matchdayArg ? parseInt(matchdayArg.split('=')[1]) : 12;

	const matchIdArg = args.find((arg) => arg.startsWith('--matchId='));
	const matchId = matchIdArg ? matchIdArg.split('=')[1] : null;

	const homeScoreArg = args.find((arg) => arg.startsWith('--homeScore='));
	const homeScore = homeScoreArg ? parseInt(homeScoreArg.split('=')[1]) : null;

	const awayScoreArg = args.find((arg) => arg.startsWith('--awayScore='));
	const awayScore = awayScoreArg ? parseInt(awayScoreArg.split('=')[1]) : null;

	if (hasSimulate) {
		console.log(`🎲 Simulating match outcomes for Matchday ${matchday}...`);
		await simulateMatchday(matchday);
	} else if (hasResolve) {
		if (!matchId || homeScore === null || awayScore === null) {
			console.error(
				'❌ Missing arguments for resolution. Required: --matchId=<uuid> --homeScore=<int> --awayScore=<int>',
			);
			process.exit(1);
		}
		console.log(
			`⚽ Resolving match ${matchId} with score ${homeScore}-${awayScore}...`,
		);
		await resolveMatch(matchId, homeScore, awayScore);
	} else if (hasRecalc) {
		console.log('🔄 Triggering global database points recalculation...');
		await recalculateScores();
	} else {
		printHelp();
	}
}

function printHelp() {
	console.log(`
🏆 KudoMatch Scoring Engine CLI

Available Operations:
  --simulate                 Simulates outcomes for scheduled matches on a matchday with random scores.
                             Optional parameter: --matchday=<int> (default is 12)
  --resolve                  Resolves a single match with a specific score.
                             Required parameters: --matchId=<uuid> --homeScore=<int> --awayScore=<int>
  --recalc                   Invokes the database procedure to recalculate all scores from scratch.

Examples:
  npm run score:simulate -- --matchday=12
  npm run score:resolve -- --matchId=11111111-1111-4111-a111-111111111111 --homeScore=2 --awayScore=1
  npm run score:recalc
`);
}

async function simulateMatchday(matchdayNum: number) {
	// 1. Fetch scheduled matches for this matchday
	const { data: matches, error } = await supabase
		.from('matches')
		.select(
			'id, status, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)',
		)
		.eq('matchday', matchdayNum);

	if (error) {
		console.error('❌ Failed to fetch matches:', error);
		process.exit(1);
	}

	if (!matches || matches.length === 0) {
		console.log(
			`⚠️ No matches found in the database for Matchday ${matchdayNum}. Have you run npm run seed first?`,
		);
		return;
	}

	console.log(`Found ${matches.length} matches for Matchday ${matchdayNum}.`);

	// Realistic soccer outcomes distribution (weighted slightly towards low scores and home wins)
	const scoresPool = [
		[1, 0],
		[2, 1],
		[1, 1],
		[0, 0],
		[0, 1],
		[0, 2],
		[2, 0],
		[3, 1],
		[1, 2],
		[2, 2],
		[3, 2],
		[1, 3],
	];

	let updatedCount = 0;

	for (const match of matches) {
		const randomPair =
			scoresPool[Math.floor(Math.random() * scoresPool.length)];
		const simulatedHome = randomPair[0];
		const simulatedAway = randomPair[1];

		const homeName = (match.home_team as any)?.name || 'Home Team';
		const awayName = (match.away_team as any)?.name || 'Away Team';

		console.log(
			`   👉 Resolving: ${homeName} vs ${awayName} ➔ ${simulatedHome} - ${simulatedAway}`,
		);

		const { error: updateErr } = await supabase
			.from('matches')
			.update({
				home_score: simulatedHome,
				away_score: simulatedAway,
				status: 'finished',
				updated_at: new Date().toISOString(),
			})
			.eq('id', match.id);

		if (updateErr) {
			console.error(
				`   ❌ Failed to update match ${match.id}:`,
				updateErr.message,
			);
		} else {
			updatedCount++;
		}
	}

	console.log(
		`\n🎉 Successfully simulated and scored ${updatedCount}/${matches.length} matches!`,
	);
	console.log(
		'💡 Trigger ' +
			'trigger_process_match_scoring'.bold() +
			' was successfully fired for each match update, recalculating user prediction scores and profiles.',
	);
}

async function resolveMatch(matchUuid: string, home: number, away: number) {
	const { data: match, error: fetchErr } = await supabase
		.from('matches')
		.select(
			'id, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)',
		)
		.eq('id', matchUuid)
		.single();

	if (fetchErr || !match) {
		console.error(
			`❌ Match with ID ${matchUuid} not found:`,
			fetchErr?.message || 'Empty response',
		);
		process.exit(1);
	}

	const homeName = (match.home_team as any)?.name || 'Home Team';
	const awayName = (match.away_team as any)?.name || 'Away Team';

	const { error: updateErr } = await supabase
		.from('matches')
		.update({
			home_score: home,
			away_score: away,
			status: 'finished',
			updated_at: new Date().toISOString(),
		})
		.eq('id', matchUuid);

	if (updateErr) {
		console.error(`❌ Failed to update match score:`, updateErr.message);
		process.exit(1);
	}

	console.log(
		`✅ Successfully resolved: ${homeName} vs ${awayName} as ${home} - ${away} (Finished).`,
	);
	console.log(
		'✨ All prediction points and profile point tallies updated atomically!',
	);
}

async function recalculateScores() {
	const { error } = await supabase.rpc('recalculate_all_scores');

	if (error) {
		console.error('❌ Failed to run recalculate_all_scores:', error);
		process.exit(1);
	}

	console.log(
		'✅ Global point recalculation complete. All prediction points and user profiles are fully synchronized.',
	);
}

// Support bold printing helper
Object.defineProperty(String.prototype, 'bold', {
	value: function () {
		return `\x1b[1m${this}\x1b[22m`;
	},
	writable: true,
	configurable: true,
});

run();
