import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RAPIDAPI_KEY =
	process.env.RAPIDAPI_KEY || process.env.NEXT_PUBLIC_RAPIDAPI_KEY;
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
	},
});

// MOCK DATASET FOR OFFLINE FALLBACK
const fallbackTeams = [
	{
		name: 'Arsenal',
		short_name: 'ARS',
		logo_url: 'https://media.api-sports.io/football/teams/42.png',
		external_id: 42,
	},
	{
		name: 'Aston Villa',
		short_name: 'AVL',
		logo_url: 'https://media.api-sports.io/football/teams/66.png',
		external_id: 66,
	},
	{
		name: 'Chelsea',
		short_name: 'CHE',
		logo_url: 'https://media.api-sports.io/football/teams/49.png',
		external_id: 49,
	},
	{
		name: 'Liverpool',
		short_name: 'LIV',
		logo_url: 'https://media.api-sports.io/football/teams/40.png',
		external_id: 40,
	},
	{
		name: 'Manchester City',
		short_name: 'MCI',
		logo_url: 'https://media.api-sports.io/football/teams/50.png',
		external_id: 50,
	},
	{
		name: 'Manchester United',
		short_name: 'MUN',
		logo_url: 'https://media.api-sports.io/football/teams/33.png',
		external_id: 33,
	},
	{
		name: 'Newcastle',
		short_name: 'NEW',
		logo_url: 'https://media.api-sports.io/football/teams/34.png',
		external_id: 34,
	},
	{
		name: 'Tottenham Hotspur',
		short_name: 'TOT',
		logo_url: 'https://media.api-sports.io/football/teams/47.png',
		external_id: 47,
	},
	{
		name: 'West Ham United',
		short_name: 'WHU',
		logo_url: 'https://media.api-sports.io/football/teams/48.png',
		external_id: 48,
	},
	{
		name: 'Wolverhampton Wanderers',
		short_name: 'WOL',
		logo_url: 'https://media.api-sports.io/football/teams/39.png',
		external_id: 39,
	},
	{
		name: 'Leicester City',
		short_name: 'LEI',
		logo_url: 'https://media.api-sports.io/football/teams/46.png',
		external_id: 46,
	},
	{
		name: 'Everton',
		short_name: 'EVE',
		logo_url: 'https://media.api-sports.io/football/teams/45.png',
		external_id: 45,
	},
	{
		name: 'Brighton',
		short_name: 'BHA',
		logo_url: 'https://media.api-sports.io/football/teams/51.png',
		external_id: 51,
	},
	{
		name: 'Crystal Palace',
		short_name: 'CRY',
		logo_url: 'https://media.api-sports.io/football/teams/52.png',
		external_id: 52,
	},
	{
		name: 'Brentford',
		short_name: 'BRE',
		logo_url: 'https://media.api-sports.io/football/teams/55.png',
		external_id: 55,
	},
	{
		name: 'Fulham',
		short_name: 'FUL',
		logo_url: 'https://media.api-sports.io/football/teams/36.png',
		external_id: 36,
	},
	{
		name: 'Bournemouth',
		short_name: 'BOU',
		logo_url: 'https://media.api-sports.io/football/teams/35.png',
		external_id: 35,
	},
	{
		name: 'Ipswich Town',
		short_name: 'IPS',
		logo_url: 'https://media.api-sports.io/football/teams/57.png',
		external_id: 57,
	},
	{
		name: 'Southampton',
		short_name: 'SOU',
		logo_url: 'https://media.api-sports.io/football/teams/41.png',
		external_id: 41,
	},
	{
		name: 'Nottingham Forest',
		short_name: 'NFO',
		logo_url: 'https://media.api-sports.io/football/teams/65.png',
		external_id: 65,
	},
];

// 10 matches for Matchweek 12
const fallbackMatches = [
	{
		matchday: 12,
		round: 'Regular Season - 12',
		home_external_id: 49,
		away_external_id: 42,
		kickoff_offset_days: 1,
		kickoff_hour: 15,
		external_id: 12001,
	}, // Chelsea vs Arsenal
	{
		matchday: 12,
		round: 'Regular Season - 12',
		home_external_id: 50,
		away_external_id: 47,
		kickoff_offset_days: 2,
		kickoff_hour: 17,
		external_id: 12002,
	}, // Man City vs Tottenham
	{
		matchday: 12,
		round: 'Regular Season - 12',
		home_external_id: 40,
		away_external_id: 66,
		kickoff_offset_days: 3,
		kickoff_hour: 16,
		external_id: 12003,
	}, // Liverpool vs Aston Villa
	{
		matchday: 12,
		round: 'Regular Season - 12',
		home_external_id: 33,
		away_external_id: 45,
		kickoff_offset_days: 2,
		kickoff_hour: 12,
		external_id: 12004,
	}, // Man United vs Everton
	{
		matchday: 12,
		round: 'Regular Season - 12',
		home_external_id: 34,
		away_external_id: 48,
		kickoff_offset_days: 1,
		kickoff_hour: 15,
		external_id: 12005,
	}, // Newcastle vs West Ham
	{
		matchday: 12,
		round: 'Regular Season - 12',
		home_external_id: 51,
		away_external_id: 39,
		kickoff_offset_days: 1,
		kickoff_hour: 15,
		external_id: 12006,
	}, // Brighton vs Wolves
	{
		matchday: 12,
		round: 'Regular Season - 12',
		home_external_id: 36,
		away_external_id: 52,
		kickoff_offset_days: 2,
		kickoff_hour: 15,
		external_id: 12007,
	}, // Fulham vs Crystal Palace
	{
		matchday: 12,
		round: 'Regular Season - 12',
		home_external_id: 46,
		away_external_id: 55,
		kickoff_offset_days: 1,
		kickoff_hour: 15,
		external_id: 12008,
	}, // Leicester vs Brentford
	{
		matchday: 12,
		round: 'Regular Season - 12',
		home_external_id: 35,
		away_external_id: 41,
		kickoff_offset_days: 3,
		kickoff_hour: 14,
		external_id: 12009,
	}, // Bournemouth vs Southampton
	{
		matchday: 12,
		round: 'Regular Season - 12',
		home_external_id: 57,
		away_external_id: 65,
		kickoff_offset_days: 2,
		kickoff_hour: 15,
		external_id: 12010,
	}, // Ipswich vs Nottingham Forest
];

async function seed() {
	console.log('🚀 Starting Data Ingestion Pipeline...');

	// 1. Seed Tournament
	const tournamentData = {
		name: 'Premier League 24/25',
		sport: 'football',
		season: '2024',
		status: 'active',
		logo_url: 'https://media.api-sports.io/football/leagues/39.png',
		external_id: 39,
	};

	console.log('Inserting tournament...');
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

	let apiTeams: any[] = [];
	let apiFixtures: any[] = [];
	let usingLiveApi = false;

	// 2. Try Fetching from Football-Data.org (FIRST PRIORITY DIRECT API)
	if (
		FOOTBALL_DATA_API_KEY &&
		FOOTBALL_DATA_API_KEY !== 'your-football-data-api-key' &&
		!FOOTBALL_DATA_API_KEY.includes('placeholder')
	) {
		try {
			console.log(
				'📡 Fetching Premier League fixtures from Football-Data.org...',
			);
			const url = 'https://api.football-data.org/v4/competitions/PL/matches';
			const res = await fetch(url, {
				headers: {
					'X-Auth-Token': FOOTBALL_DATA_API_KEY,
				},
			});

			if (!res.ok) throw new Error(`HTTP error ${res.status}`);

			const json = await res.json();
			const matches = json.matches || [];

			if (matches.length > 0) {
				console.log(
					`✅ Retrieved ${matches.length} fixtures from Football-Data.org!`,
				);
				usingLiveApi = true;

				const teamsMap = new Map();
				matches.forEach((item: any) => {
					const home = item.homeTeam;
					const away = item.awayTeam;

					if (home.id) {
						teamsMap.set(home.id, {
							name: home.name,
							short_name: home.tla || home.name.substring(0, 3).toUpperCase(),
							logo_url: home.crest,
							external_id: home.id,
						});
					}
					if (away.id) {
						teamsMap.set(away.id, {
							name: away.name,
							short_name: away.tla || away.name.substring(0, 3).toUpperCase(),
							logo_url: away.crest,
							external_id: away.id,
						});
					}
				});

				apiTeams = Array.from(teamsMap.values());
				apiFixtures = matches.map((item: any) => {
					const isFinished = item.status === 'FINISHED';
					const isLive = item.status === 'IN_PLAY' || item.status === 'PAUSED';

					return {
						matchday: item.matchday,
						round: `Regular Season - ${item.matchday}`,
						home_external_id: item.homeTeam.id,
						away_external_id: item.awayTeam.id,
						kickoff_time: item.utcDate,
						home_score: isFinished ? item.score.fullTime.home : null,
						away_score: isFinished ? item.score.fullTime.away : null,
						status: isFinished ? 'finished' : isLive ? 'live' : 'scheduled',
						external_id: item.id,
					};
				});
			}
		} catch (err) {
			console.warn(
				'⚠️ Football-Data.org fetch failed, trying RapidAPI/API-Football next...',
				err,
			);
		}
	}

	// 3. Fallback to API-Football (RapidAPI) if key exists and Football-Data wasn't run
	if (
		!usingLiveApi &&
		RAPIDAPI_KEY &&
		RAPIDAPI_KEY !== 'your-supabase-anon-key' &&
		!RAPIDAPI_KEY.includes('placeholder')
	) {
		try {
			console.log(
				'📡 Fetching Premier League fixtures from RapidAPI/API-Football...',
			);
			const url =
				'https://api-football-v1.p.rapidapi.com/v3/fixtures?league=39&season=2024';
			const res = await fetch(url, {
				headers: {
					'x-rapidapi-key': RAPIDAPI_KEY,
					'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
				},
			});

			if (!res.ok) throw new Error(`HTTP error ${res.status}`);

			const json = await res.json();
			const fixtures = json.response || [];

			if (fixtures.length > 0) {
				console.log(
					`✅ Retrieved ${fixtures.length} fixtures from API-Football!`,
				);
				usingLiveApi = true;

				const teamsMap = new Map();
				fixtures.forEach((item: any) => {
					const home = item.teams.home;
					const away = item.teams.away;
					teamsMap.set(home.id, {
						name: home.name,
						short_name: home.name.substring(0, 3).toUpperCase(),
						logo_url: home.logo,
						external_id: home.id,
					});
					teamsMap.set(away.id, {
						name: away.name,
						short_name: away.name.substring(0, 3).toUpperCase(),
						logo_url: away.logo,
						external_id: away.id,
					});
				});

				apiTeams = Array.from(teamsMap.values());
				apiFixtures = fixtures.map((item: any) => {
					return {
						matchday: parseInt(item.league.round.replace(/[^0-9]/g, '')) || 1,
						round: item.league.round,
						home_external_id: item.teams.home.id,
						away_external_id: item.teams.away.id,
						kickoff_time: item.fixture.date,
						home_score: item.goals.home,
						away_score: item.goals.away,
						status:
							item.fixture.status.short === 'FT'
								? 'finished'
								: item.fixture.status.short === '1H' ||
									  item.fixture.status.short === '2H'
									? 'live'
									: 'scheduled',
						external_id: item.fixture.id,
					};
				});
			}
		} catch (err) {
			console.warn(
				'⚠️ API-Football fetch failed. Swerving back to beautiful built-in fallback dataset:',
				err,
			);
		}
	}

	if (!usingLiveApi) {
		console.log(
			'ℹ️ No active/functioning live API keys detected. Launching local fallback seeder.',
		);
	}

	// Define lists to upsert
	const teamsToUpsert = usingLiveApi ? apiTeams : fallbackTeams;
	const finalTeams = teamsToUpsert.map((t) => ({
		...t,
		tournament_id: tournament.id,
	}));

	console.log(`Inserting ${finalTeams.length} teams...`);
	const { data: insertedTeams, error: teamsErr } = await supabase
		.from('teams')
		.upsert(finalTeams, { onConflict: 'external_id' })
		.select();

	if (teamsErr || !insertedTeams) {
		console.error('❌ Failed to upsert teams:', teamsErr);
		process.exit(1);
	}

	console.log('✅ Teams inserted/updated successfully.');

	// Create lookup map of external_id -> UUID
	const teamUuidMap = new Map<number, string>();
	insertedTeams.forEach((team) => {
		if (team.external_id) teamUuidMap.set(team.external_id, team.id);
	});

	// Format matches
	let finalMatchesToInsert: any[] = [];

	if (usingLiveApi) {
		finalMatchesToInsert = apiFixtures.map((fixture) => {
			const homeUuid = teamUuidMap.get(fixture.home_external_id);
			const awayUuid = teamUuidMap.get(fixture.away_external_id);

			return {
				tournament_id: tournament.id,
				matchday: fixture.matchday,
				round: fixture.round,
				home_team_id: homeUuid,
				away_team_id: awayUuid,
				kickoff_time: fixture.kickoff_time,
				home_score: fixture.home_score,
				away_score: fixture.away_score,
				status: fixture.status,
				external_id: fixture.external_id,
				updated_at: new Date().toISOString(),
			};
		});
	} else {
		// Generate dates based on local time offset for fallbacks
		const now = new Date();
		finalMatchesToInsert = fallbackMatches.map((fixture) => {
			const homeUuid = teamUuidMap.get(fixture.home_external_id);
			const awayUuid = teamUuidMap.get(fixture.away_external_id);

			const kickoff = new Date();
			kickoff.setDate(now.getDate() + fixture.kickoff_offset_days);
			kickoff.setHours(fixture.kickoff_hour, 0, 0, 0);

			return {
				tournament_id: tournament.id,
				matchday: fixture.matchday,
				round: fixture.round,
				home_team_id: homeUuid,
				away_team_id: awayUuid,
				kickoff_time: kickoff.toISOString(),
				home_score: null,
				away_score: null,
				status: 'scheduled',
				external_id: fixture.external_id,
				updated_at: new Date().toISOString(),
			};
		});
	}

	// Filter out any matches with undefined home or away team UUIDs
	finalMatchesToInsert = finalMatchesToInsert.filter(
		(m) => m.home_team_id && m.away_team_id,
	);

	console.log(`Inserting ${finalMatchesToInsert.length} fixtures...`);

	// Chunk inserts if too large
	const chunkSize = 100;
	for (let i = 0; i < finalMatchesToInsert.length; i += chunkSize) {
		const chunk = finalMatchesToInsert.slice(i, i + chunkSize);
		const { error: matchesErr } = await supabase
			.from('matches')
			.upsert(chunk, { onConflict: 'external_id' });

		if (matchesErr) {
			console.error(`❌ Failed to upsert match chunk:`, matchesErr);
			process.exit(1);
		}
	}

	console.log(
		'🎉 Seeding complete! Database is successfully prepared with live/mock fixtures.',
	);
}

seed();
