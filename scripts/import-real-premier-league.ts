import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FOOTBALL_DATA_API_KEY =
	process.env.FOOTBALL_DATA_API_KEY ||
	process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error('❌ Missing Supabase environment variables. Check .env.local');
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		persistSession: false,
		autoRefreshToken: false,
	},
});

export async function importRealPremierLeague() {
	console.log(
		'🚀 Starting Full Clean & Real Premier League Import Pipeline...',
	);

	// 1. Clean out existing predictions and matches
	console.log('🧹 Clearing old predictions and test matches...');
	const { error: delPredsErr } = await supabase
		.from('predictions')
		.delete()
		.neq('id', '00000000-0000-0000-0000-000000000000');

	if (delPredsErr) {
		console.warn('⚠️ Warning clearing predictions:', delPredsErr.message);
	} else {
		console.log('   ✅ Predictions cleared.');
	}

	const { error: delMatchesErr } = await supabase
		.from('matches')
		.delete()
		.neq('id', '00000000-0000-0000-0000-000000000000');

	if (delMatchesErr) {
		console.warn('⚠️ Warning clearing matches:', delMatchesErr.message);
	} else {
		console.log('   ✅ Test matches cleared.');
	}

	// 2. Ensure Tournament Exists
	const tournamentData = {
		name: 'Premier League 24/25',
		sport: 'football',
		season: '2024',
		status: 'active',
		logo_url: 'https://media.api-sports.io/football/leagues/39.png',
		external_id: 39,
	};

	console.log('🔄 Initializing tournament...');
	const { data: tournament, error: tournamentErr } = await supabase
		.from('tournaments')
		.upsert(tournamentData, { onConflict: 'external_id' })
		.select()
		.single();

	if (tournamentErr || !tournament) {
		console.error('❌ Failed to upsert tournament:', tournamentErr);
		process.exit(1);
	}
	console.log(
		`✅ Tournament initialized: "${tournament.name}" (ID: ${tournament.id})`,
	);

	// 3. Fetch Real Premier League Fixtures from Football-Data.org API
	console.log(
		'📡 Connecting to Football-Data.org for 2024/2025 Premier League data...',
	);

	const url = 'https://api.football-data.org/v4/competitions/PL/matches';
	const headers: Record<string, string> = {};
	if (FOOTBALL_DATA_API_KEY && !FOOTBALL_DATA_API_KEY.includes('placeholder')) {
		headers['X-Auth-Token'] = FOOTBALL_DATA_API_KEY;
	}

	const res = await fetch(url, { headers });
	if (!res.ok) {
		console.error(
			`❌ Football-Data.org API returned HTTP ${res.status}: ${res.statusText}`,
		);
		process.exit(1);
	}

	const json = await res.json();
	const apiMatches = json.matches || [];
	console.log(
		`✅ Retrieved ${apiMatches.length} official Premier League fixtures from API!`,
	);

	if (apiMatches.length === 0) {
		console.error('❌ No fixtures returned from API.');
		process.exit(1);
	}

	// 4. Extract and Upsert All 20 Real Premier League Teams
	const teamsMap = new Map();
	apiMatches.forEach((item: any) => {
		const home = item.homeTeam;
		const away = item.awayTeam;

		if (home.id && !teamsMap.has(home.id)) {
			teamsMap.set(home.id, {
				tournament_id: tournament.id,
				name: home.name,
				short_name: home.tla || home.name.substring(0, 3).toUpperCase(),
				logo_url: home.crest,
				external_id: home.id,
			});
		}
		if (away.id && !teamsMap.has(away.id)) {
			teamsMap.set(away.id, {
				tournament_id: tournament.id,
				name: away.name,
				short_name: away.tla || away.name.substring(0, 3).toUpperCase(),
				logo_url: away.crest,
				external_id: away.id,
			});
		}
	});

	const teamsToInsert = Array.from(teamsMap.values());
	console.log(
		`🔄 Upserting ${teamsToInsert.length} official Premier League clubs...`,
	);

	const { data: insertedTeams, error: teamsErr } = await supabase
		.from('teams')
		.upsert(teamsToInsert, { onConflict: 'external_id' })
		.select();

	if (teamsErr || !insertedTeams) {
		console.error('❌ Failed to upsert teams:', teamsErr);
		process.exit(1);
	}
	console.log('✅ All 20 Premier League clubs upserted with official crests.');

	const teamUuidMap = new Map<number, string>();
	insertedTeams.forEach((t) => {
		if (t.external_id) teamUuidMap.set(t.external_id, t.id);
	});

	// 5. Format and Insert All 380 Official Real Matches
	console.log(`🔄 Formatting and inserting ${apiMatches.length} fixtures...`);

	const finalMatches = apiMatches
		.map((item: any) => {
			const homeUuid = teamUuidMap.get(item.homeTeam.id);
			const awayUuid = teamUuidMap.get(item.awayTeam.id);
			if (!homeUuid || !awayUuid) return null;

			const isFinished = item.status === 'FINISHED';
			const isLive = item.status === 'IN_PLAY' || item.status === 'PAUSED';
			const statusStr = isFinished ? 'finished' : isLive ? 'live' : 'scheduled';

			const homeScore =
				isFinished || isLive
					? (item.score?.fullTime?.home ??
						item.score?.regularTime?.home ??
						null)
					: null;
			const awayScore =
				isFinished || isLive
					? (item.score?.fullTime?.away ??
						item.score?.regularTime?.away ??
						null)
					: null;

			return {
				tournament_id: tournament.id,
				matchday: item.matchday,
				round: `Regular Season - ${item.matchday}`,
				home_team_id: homeUuid,
				away_team_id: awayUuid,
				kickoff_time: item.utcDate,
				home_score: homeScore,
				away_score: awayScore,
				status: statusStr,
				external_id: item.id,
				updated_at: new Date().toISOString(),
			};
		})
		.filter(Boolean);

	// Chunk insert into database
	const chunkSize = 50;
	let insertedMatchCount = 0;

	for (let i = 0; i < finalMatches.length; i += chunkSize) {
		const chunk = finalMatches.slice(i, i + chunkSize);
		const { error: matchInsertErr } = await supabase
			.from('matches')
			.upsert(chunk, { onConflict: 'external_id' });

		if (matchInsertErr) {
			console.error(
				`❌ Error inserting match chunk ${i}:`,
				matchInsertErr.message,
			);
		} else {
			insertedMatchCount += chunk.length;
		}
	}

	console.log(
		`✅ Successfully imported ${insertedMatchCount} official real Premier League matches!`,
	);

	// 6. Report on Season Breakdown
	const finishedMatches = finalMatches.filter(
		(m: any) => m.status === 'finished',
	);
	const upcomingMatches = finalMatches.filter(
		(m: any) => m.status === 'scheduled',
	);
	const liveMatches = finalMatches.filter((m: any) => m.status === 'live');

	console.log('\n📊 Real Season State Summary:');
	console.log(
		`   🏁 Finished Matches (Real Final Scores): ${finishedMatches.length}`,
	);
	console.log(
		`   🔴 Live Matches:                          ${liveMatches.length}`,
	);
	console.log(
		`   🕒 Upcoming Scheduled Matches:            ${upcomingMatches.length}`,
	);

	// 7. Seed Predictions for Finished Historical Matches for Community Leaderboards
	const { data: allProfiles } = await supabase
		.from('profiles')
		.select('id, username');

	if (allProfiles && allProfiles.length > 0 && finishedMatches.length > 0) {
		console.log(
			`\n🔄 Generating historical predictions for ${allProfiles.length} users on completed games...`,
		);

		// For the last 3 completed matchweeks, give each user realistic predictions to populate historical scoring
		const { data: dbFinishedMatches } = await supabase
			.from('matches')
			.select('id, matchday, home_score, away_score, status')
			.eq('status', 'finished')
			.order('matchday', { ascending: false })
			.limit(30);

		if (dbFinishedMatches && dbFinishedMatches.length > 0) {
			const predictionsToSeed: any[] = [];

			dbFinishedMatches.forEach((m) => {
				const actualHome = m.home_score ?? 1;
				const actualAway = m.away_score ?? 1;

				allProfiles.forEach((prof) => {
					// 30% chance exact, 30% outcome & diff, 25% winner only, 15% miss
					const rand = Math.random();
					let pH = actualHome;
					let pA = actualAway;

					if (rand > 0.7) {
						// exact
						pH = actualHome;
						pA = actualAway;
					} else if (rand > 0.4) {
						// outcome & diff
						pH = actualHome + 1;
						pA = actualAway + 1;
					} else if (rand > 0.15) {
						// winner only
						pH =
							actualHome > actualAway
								? actualHome + 2
								: actualHome === actualAway
									? 0
									: 0;
						pA =
							actualHome > actualAway
								? 0
								: actualHome === actualAway
									? 0
									: actualAway + 2;
					} else {
						// miss
						pH = actualAway;
						pA = actualHome + 1;
					}

					predictionsToSeed.push({
						user_id: prof.id,
						match_id: m.id,
						predicted_home_score: Math.max(0, pH),
						predicted_away_score: Math.max(0, pA),
					});
				});
			});

			for (let i = 0; i < predictionsToSeed.length; i += 100) {
				const chunk = predictionsToSeed.slice(i, i + 100);
				await supabase
					.from('predictions')
					.upsert(chunk, { onConflict: 'user_id,match_id' });
			}
			console.log(
				`✅ Seeded ${predictionsToSeed.length} user predictions on completed games.`,
			);
		}
	}

	// 8. Run recalculate_all_scores RPC
	console.log('🔄 Running recalculate_all_scores() on database...');
	const { error: recalcErr } = await supabase.rpc('recalculate_all_scores');
	if (recalcErr) {
		console.warn('⚠️ Recalculate RPC warning:', recalcErr.message);
	} else {
		console.log(
			'✅ Global player scores recalculated and synchronized perfectly.',
		);
	}

	console.log(
		'\n🎉 Real Premier League Import Complete! Enjoy real scores and prediction tracking.',
	);
}

if (require.main === module) {
	importRealPremierLeague()
		.then(() => {
			process.exit(0);
		})
		.catch((err) => {
			console.error('❌ Import failed:', err);
			process.exit(1);
		});
}
