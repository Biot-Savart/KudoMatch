import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error('❌ Missing Supabase environment variables in .env.local');
	process.exit(1);
}

// Initialize Supabase Admin client using service_role key to bypass RLS and Auth limits
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		persistSession: false,
		autoRefreshToken: false,
	},
});

// Mock users config
const mockUsers = [
	{
		username: 'marcus_striker',
		email: 'marcus@kudomatch.test',
		full_name: 'Marcus Striker',
		avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Marcus',
	},
	{
		username: 'sarah_tactician',
		email: 'sarah@kudomatch.test',
		full_name: 'Sarah Tactician',
		avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah',
	},
	{
		username: 'alex_gk',
		email: 'alex@kudomatch.test',
		full_name: 'Alex GK',
		avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Alex',
	},
	{
		username: 'sam_analytics',
		email: 'sam@kudomatch.test',
		full_name: 'Sam Analytics',
		avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sam',
	},
	{
		username: 'elena_scout',
		email: 'elena@kudomatch.test',
		full_name: 'Elena Scout',
		avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Elena',
	},
	{
		username: 'dave_pundit',
		email: 'dave@kudomatch.test',
		full_name: 'Dave Pundit',
		avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Dave',
	},
	{
		username: 'kudo_champ',
		email: 'champ@kudomatch.test',
		full_name: 'Kudo Champ',
		avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Champ',
	},
];

// Teams reference matching seed-fixtures.ts for external_ids
const eplTeams = [
	{
		name: 'Arsenal',
		short_name: 'ARS',
		external_id: 42,
		logo_url: 'https://media.api-sports.io/football/teams/42.png',
	},
	{
		name: 'Aston Villa',
		short_name: 'AVL',
		external_id: 66,
		logo_url: 'https://media.api-sports.io/football/teams/66.png',
	},
	{
		name: 'Chelsea',
		short_name: 'CHE',
		external_id: 49,
		logo_url: 'https://media.api-sports.io/football/teams/49.png',
	},
	{
		name: 'Liverpool',
		short_name: 'LIV',
		external_id: 40,
		logo_url: 'https://media.api-sports.io/football/teams/40.png',
	},
	{
		name: 'Manchester City',
		short_name: 'MCI',
		external_id: 50,
		logo_url: 'https://media.api-sports.io/football/teams/50.png',
	},
	{
		name: 'Manchester United',
		short_name: 'MUN',
		external_id: 33,
		logo_url: 'https://media.api-sports.io/football/teams/33.png',
	},
	{
		name: 'Newcastle',
		short_name: 'NEW',
		external_id: 34,
		logo_url: 'https://media.api-sports.io/football/teams/34.png',
	},
	{
		name: 'Tottenham Hotspur',
		short_name: 'TOT',
		external_id: 47,
		logo_url: 'https://media.api-sports.io/football/teams/47.png',
	},
	{
		name: 'West Ham United',
		short_name: 'WHU',
		external_id: 48,
		logo_url: 'https://media.api-sports.io/football/teams/48.png',
	},
	{
		name: 'Wolverhampton Wanderers',
		short_name: 'WOL',
		external_id: 39,
		logo_url: 'https://media.api-sports.io/football/teams/39.png',
	},
	{
		name: 'Leicester City',
		short_name: 'LEI',
		external_id: 46,
		logo_url: 'https://media.api-sports.io/football/teams/46.png',
	},
	{
		name: 'Everton',
		short_name: 'EVE',
		external_id: 45,
		logo_url: 'https://media.api-sports.io/football/teams/45.png',
	},
	{
		name: 'Brighton',
		short_name: 'BHA',
		external_id: 51,
		logo_url: 'https://media.api-sports.io/football/teams/51.png',
	},
	{
		name: 'Crystal Palace',
		short_name: 'CRY',
		external_id: 52,
		logo_url: 'https://media.api-sports.io/football/teams/52.png',
	},
	{
		name: 'Brentford',
		short_name: 'BRE',
		external_id: 55,
		logo_url: 'https://media.api-sports.io/football/teams/55.png',
	},
	{
		name: 'Fulham',
		short_name: 'FUL',
		external_id: 36,
		logo_url: 'https://media.api-sports.io/football/teams/36.png',
	},
	{
		name: 'Bournemouth',
		short_name: 'BOU',
		external_id: 35,
		logo_url: 'https://media.api-sports.io/football/teams/35.png',
	},
	{
		name: 'Ipswich Town',
		short_name: 'IPS',
		external_id: 57,
		logo_url: 'https://media.api-sports.io/football/teams/57.png',
	},
	{
		name: 'Southampton',
		short_name: 'SOU',
		external_id: 41,
		logo_url: 'https://media.api-sports.io/football/teams/41.png',
	},
	{
		name: 'Nottingham Forest',
		short_name: 'NFO',
		external_id: 65,
		logo_url: 'https://media.api-sports.io/football/teams/65.png',
	},
];

// Historical Fixtures & Actual Scorelines for Matchweek 10
const mw10Fixtures = [
	{
		home_external_id: 34,
		away_external_id: 42,
		home_score: 1,
		away_score: 0,
		external_id: 10001,
	}, // Newcastle vs Arsenal
	{
		home_external_id: 35,
		away_external_id: 50,
		home_score: 2,
		away_score: 1,
		external_id: 10002,
	}, // Bournemouth vs Man City
	{
		home_external_id: 57,
		away_external_id: 46,
		home_score: 1,
		away_score: 1,
		external_id: 10003,
	}, // Ipswich vs Leicester
	{
		home_external_id: 40,
		away_external_id: 51,
		home_score: 2,
		away_score: 1,
		external_id: 10004,
	}, // Liverpool vs Brighton
	{
		home_external_id: 65,
		away_external_id: 48,
		home_score: 3,
		away_score: 0,
		external_id: 10005,
	}, // Nottingham Forest vs West Ham
	{
		home_external_id: 41,
		away_external_id: 45,
		home_score: 1,
		away_score: 0,
		external_id: 10006,
	}, // Southampton vs Everton
	{
		home_external_id: 39,
		away_external_id: 52,
		home_score: 2,
		away_score: 2,
		external_id: 10007,
	}, // Wolves vs Crystal Palace
	{
		home_external_id: 47,
		away_external_id: 66,
		home_score: 4,
		away_score: 1,
		external_id: 10008,
	}, // Tottenham vs Aston Villa
	{
		home_external_id: 33,
		away_external_id: 49,
		home_score: 1,
		away_score: 1,
		external_id: 10009,
	}, // Man United vs Chelsea
	{
		home_external_id: 36,
		away_external_id: 55,
		home_score: 2,
		away_score: 1,
		external_id: 10010,
	}, // Fulham vs Brentford
];

// Historical Fixtures & Actual Scorelines for Matchweek 11
const mw11Fixtures = [
	{
		home_external_id: 55,
		away_external_id: 35,
		home_score: 3,
		away_score: 2,
		external_id: 11001,
	}, // Brentford vs Bournemouth
	{
		home_external_id: 52,
		away_external_id: 36,
		home_score: 0,
		away_score: 2,
		external_id: 11002,
	}, // Crystal Palace vs Fulham
	{
		home_external_id: 48,
		away_external_id: 45,
		home_score: 0,
		away_score: 0,
		external_id: 11003,
	}, // West Ham vs Everton
	{
		home_external_id: 39,
		away_external_id: 41,
		home_score: 2,
		away_score: 0,
		external_id: 11004,
	}, // Wolves vs Southampton
	{
		home_external_id: 51,
		away_external_id: 50,
		home_score: 2,
		away_score: 1,
		external_id: 11005,
	}, // Brighton vs Man City
	{
		home_external_id: 40,
		away_external_id: 66,
		home_score: 2,
		away_score: 0,
		external_id: 11006,
	}, // Liverpool vs Aston Villa
	{
		home_external_id: 33,
		away_external_id: 46,
		home_score: 3,
		away_score: 0,
		external_id: 11007,
	}, // Man United vs Leicester
	{
		home_external_id: 65,
		away_external_id: 34,
		home_score: 1,
		away_score: 3,
		external_id: 11008,
	}, // Nottingham Forest vs Newcastle
	{
		home_external_id: 47,
		away_external_id: 57,
		home_score: 1,
		away_score: 2,
		external_id: 11009,
	}, // Tottenham vs Ipswich
	{
		home_external_id: 49,
		away_external_id: 42,
		home_score: 1,
		away_score: 1,
		external_id: 11010,
	}, // Chelsea vs Arsenal
];

// Upcoming Fixtures for Matchweek 12 (to be predicted by players)
const mw12Fixtures = [
	{
		home_external_id: 49,
		away_external_id: 42,
		kickoff_offset_days: 1,
		kickoff_hour: 12,
		external_id: 12001,
	}, // Chelsea vs Arsenal
	{
		home_external_id: 50,
		away_external_id: 47,
		kickoff_offset_days: 1,
		kickoff_hour: 15,
		external_id: 12002,
	}, // Man City vs Tottenham
	{
		home_external_id: 40,
		away_external_id: 66,
		kickoff_offset_days: 2,
		kickoff_hour: 16,
		external_id: 12003,
	}, // Liverpool vs Aston Villa
	{
		home_external_id: 33,
		away_external_id: 45,
		kickoff_offset_days: 2,
		kickoff_hour: 14,
		external_id: 12004,
	}, // Man United vs Everton
	{
		home_external_id: 34,
		away_external_id: 48,
		kickoff_offset_days: 2,
		kickoff_hour: 15,
		external_id: 12005,
	}, // Newcastle vs West Ham
	{
		home_external_id: 51,
		away_external_id: 39,
		kickoff_offset_days: 3,
		kickoff_hour: 15,
		external_id: 12006,
	}, // Brighton vs Wolves
	{
		home_external_id: 36,
		away_external_id: 52,
		kickoff_offset_days: 3,
		kickoff_hour: 16,
		external_id: 12007,
	}, // Fulham vs Crystal Palace
	{
		home_external_id: 46,
		away_external_id: 55,
		kickoff_offset_days: 3,
		kickoff_hour: 14,
		external_id: 12008,
	}, // Leicester vs Brentford
	{
		home_external_id: 35,
		away_external_id: 41,
		kickoff_offset_days: 4,
		kickoff_hour: 15,
		external_id: 12009,
	}, // Bournemouth vs Southampton
	{
		home_external_id: 57,
		away_external_id: 65,
		kickoff_offset_days: 4,
		kickoff_hour: 20,
		external_id: 12010,
	}, // Ipswich vs Nottingham Forest
];

// Seed algorithm helper to generate realistic random-but-biased scores
function generatePredictionScore(
	actualHome: number,
	actualAway: number,
	biasType: 'exact' | 'diff' | 'winner' | 'incorrect',
) {
	const actualWinner =
		actualHome > actualAway
			? 'home'
			: actualHome < actualAway
				? 'away'
				: 'draw';
	const actualDiff = actualHome - actualAway;

	switch (biasType) {
		case 'exact':
			return { home: actualHome, away: actualAway };
		case 'diff':
			// Correct winner and correct goal difference, but wrong scores
			if (actualWinner === 'draw') {
				// E.g. actual is 1-1, predict 2-2
				const shift = Math.floor(Math.random() * 2) + 1;
				return { home: actualHome + shift, away: actualAway + shift };
			} else {
				// E.g. actual is 2-1 (+1), predict 3-2 (+1) or 1-0 (+1)
				const shift = Math.random() > 0.5 ? 1 : -1;
				const newHome = actualHome + shift;
				const newAway = actualAway + shift;
				if (newHome >= 0 && newAway >= 0) {
					return { home: newHome, away: newAway };
				}
				return { home: actualHome + 2, away: actualAway + 2 };
			}
		case 'winner':
			// Correct outcome, wrong goal difference
			if (actualWinner === 'home') {
				// E.g. actual is 2-1, predict 3-0 or 2-0
				return { home: actualHome + 1, away: Math.max(0, actualAway - 1) };
			} else if (actualWinner === 'away') {
				// E.g. actual is 1-2, predict 0-2 or 1-3
				return { home: Math.max(0, actualHome - 1), away: actualAway + 1 };
			} else {
				// If actual is draw (e.g. 1-1), correct outcome draw with wrong diff is impossible (draw diff is always 0),
				// so draw-outcome only translates to exact score or wrong outcome. We return exact or slight draw shift.
				return { home: actualHome + 1, away: actualAway + 1 };
			}
		case 'incorrect':
		default:
			// Completely incorrect winner
			if (actualWinner === 'home') {
				return { home: actualAway, away: actualHome + 1 }; // predict away win
			} else if (actualWinner === 'away') {
				return { home: actualHome + 1, away: actualAway }; // predict home win
			} else {
				return { home: actualHome + 2, away: actualAway }; // predict home win instead of draw
			}
	}
}

async function seedHistoricData() {
	console.log('🏁 Starting Historic Testing Data Seeder...');

	// 1. Ensure Tournament Exists
	const tournamentData = {
		name: 'Premier League 24/25',
		sport: 'football',
		season: '2024',
		status: 'active',
		logo_url: 'https://media.api-sports.io/football/leagues/39.png',
		external_id: 39,
	};

	console.log('🔄 Checking Premier League 24/25 tournament...');
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

	// 2. Ensure EPL Teams Exist
	console.log(`🔄 Seeding ${eplTeams.length} EPL teams...`);
	const finalTeams = eplTeams.map((team) => ({
		...team,
		tournament_id: tournament.id,
	}));

	const { data: insertedTeams, error: teamsErr } = await supabase
		.from('teams')
		.upsert(finalTeams, { onConflict: 'external_id' })
		.select();

	if (teamsErr || !insertedTeams) {
		console.error('❌ Failed to seed teams:', teamsErr);
		process.exit(1);
	}
	console.log('✅ Teams seeded and cached successfully.');

	// Create lookup map of external_id -> UUID
	const teamUuidMap = new Map<number, string>();
	insertedTeams.forEach((team) => {
		if (team.external_id) teamUuidMap.set(team.external_id, team.id);
	});

	// 3. Setup/Ensure Mock Auth Users & Profiles
	console.log('🔄 Provisioning mock auth users and profiles...');
	const userProfiles: any[] = [];

	for (const mockUser of mockUsers) {
		// A. Check if profile already exists in public.profiles
		const { data: existingProfile } = await supabase
			.from('profiles')
			.select('id, username')
			.eq('username', mockUser.username)
			.maybeSingle();

		if (existingProfile) {
			console.log(
				`   👤 Profile @${mockUser.username} already exists (ID: ${existingProfile.id})`,
			);
			userProfiles.push({ id: existingProfile.id, ...mockUser });
			continue;
		}

		// B. Create auth user (which automatically fires DB trigger to create public.profile)
		let userId = '';
		const { data: createdAuth, error: authErr } =
			await supabase.auth.admin.createUser({
				email: mockUser.email,
				password: 'password123',
				email_confirm: true,
				user_metadata: {
					username: mockUser.username,
					full_name: mockUser.full_name,
					avatar_url: mockUser.avatar_url,
				},
			});

		if (authErr || !createdAuth?.user) {
			if (
				authErr?.message?.includes('already been registered') ||
				authErr?.status === 422
			) {
				// User already exists in auth, find their ID
				const { data: listData } = await supabase.auth.admin.listUsers();
				const existingAuthUser = listData?.users?.find(
					(u) => u.email === mockUser.email,
				);
				if (existingAuthUser) {
					userId = existingAuthUser.id;
				} else {
					console.error(
						`   ❌ Failed to find existing auth user for @${mockUser.username} even though email exists.`,
					);
					continue;
				}
			} else {
				console.error(
					`   ❌ Failed to create auth user for @${mockUser.username}:`,
					authErr?.message,
				);
				continue;
			}
		} else {
			userId = createdAuth.user.id;
		}

		// Ensure profile exists in public.profiles
		const { data: confirmedProfile, error: profileErr } = await supabase
			.from('profiles')
			.select('id, username')
			.eq('id', userId)
			.maybeSingle();

		if (profileErr || !confirmedProfile) {
			console.warn(
				`   ⚠️ Profile missing or trigger delayed. Inserting profile manually for @${mockUser.username}...`,
			);
			const { data: manualProfile, error: manualErr } = await supabase
				.from('profiles')
				.insert({
					id: userId,
					username: mockUser.username,
					full_name: mockUser.full_name,
					avatar_url: mockUser.avatar_url,
					total_points: 0,
				})
				.select()
				.single();

			if (manualErr) {
				console.error(
					`   ❌ Failed to manually insert profile for @${mockUser.username}:`,
					manualErr.message,
				);
				continue;
			}

			if (manualProfile) {
				userProfiles.push({ id: manualProfile.id, ...mockUser });
			}
		} else {
			console.log(
				`   👤 Profile for @${mockUser.username} linked/found successfully (ID: ${confirmedProfile.id})`,
			);
			userProfiles.push({ id: confirmedProfile.id, ...mockUser });
		}
	}

	// Fetch all profiles in public.profiles to catch any existing non-mock users (such as developers' local accounts)
	const { data: allProfiles } = await supabase
		.from('profiles')
		.select('id, username');
	console.log(
		`ℹ️ Total profiles available for pool testing: ${allProfiles?.length || 0}`,
	);

	// 4. Seed Matches (MW10, MW11, MW12)
	// IMPORTANT WORKAROUND: To successfully bypass the `verify_prediction_lock` trigger which blocks
	// adding predictions to matches in the past or in live/finished status, we first insert all historic
	// matches in "scheduled" state with a FUTURE kickoff time.
	// We'll then place mock predictions, and finally update matches to "finished" with the actual scores and past kickoffs.
	console.log(
		'🔄 Staging Matchweeks 10, 11, and 12 in scheduled future state...',
	);

	const futureKickoff = new Date();
	futureKickoff.setDate(futureKickoff.getDate() + 5); // 5 days in future

	const allFixturesToStage: any[] = [];

	// MW10 staged matches
	mw10Fixtures.forEach((f) => {
		allFixturesToStage.push({
			tournament_id: tournament.id,
			matchday: 10,
			round: 'Regular Season - 10',
			home_team_id: teamUuidMap.get(f.home_external_id),
			away_team_id: teamUuidMap.get(f.away_external_id),
			kickoff_time: futureKickoff.toISOString(),
			status: 'scheduled',
			external_id: f.external_id,
		});
	});

	// MW11 staged matches
	mw11Fixtures.forEach((f) => {
		allFixturesToStage.push({
			tournament_id: tournament.id,
			matchday: 11,
			round: 'Regular Season - 11',
			home_team_id: teamUuidMap.get(f.home_external_id),
			away_team_id: teamUuidMap.get(f.away_external_id),
			kickoff_time: futureKickoff.toISOString(),
			status: 'scheduled',
			external_id: f.external_id,
		});
	});

	// MW12 actual matches (upcoming)
	const now = new Date();
	mw12Fixtures.forEach((f) => {
		const kickoff = new Date();
		kickoff.setDate(now.getDate() + f.kickoff_offset_days);
		kickoff.setHours(f.kickoff_hour, 0, 0, 0);

		allFixturesToStage.push({
			tournament_id: tournament.id,
			matchday: 12,
			round: 'Regular Season - 12',
			home_team_id: teamUuidMap.get(f.home_external_id),
			away_team_id: teamUuidMap.get(f.away_external_id),
			kickoff_time: kickoff.toISOString(),
			status: 'scheduled',
			external_id: f.external_id,
		});
	});

	console.log(`Inserting ${allFixturesToStage.length} staged matches...`);
	const { data: stagedMatches, error: matchesErr } = await supabase
		.from('matches')
		.upsert(allFixturesToStage, { onConflict: 'external_id' })
		.select();

	if (matchesErr || !stagedMatches) {
		console.error('❌ Failed to upsert staged matches:', matchesErr);
		process.exit(1);
	}
	console.log('✅ Matches staged successfully in database.');

	// Create map of match external_id -> database match ID (UUID)
	const matchIdMap = new Map<number, string>();
	stagedMatches.forEach((m) => {
		if (m.external_id) matchIdMap.set(m.external_id, m.id);
	});

	// 5. Seed Mock Predictions for Staged Matches
	console.log('🔄 Seeding historical predictions with varied point biases...');
	const predictionsToInsert: any[] = [];

	// Personas and their predicted outcome distributions to create a realistic leaderboard
	const userBiases: Record<
		string,
		Array<'exact' | 'diff' | 'winner' | 'incorrect'>
	> = {
		marcus_striker: [
			'exact',
			'exact',
			'diff',
			'diff',
			'winner',
			'winner',
			'winner',
			'incorrect',
			'incorrect',
			'exact',
		],
		sarah_tactician: [
			'diff',
			'diff',
			'diff',
			'diff',
			'winner',
			'winner',
			'exact',
			'incorrect',
			'incorrect',
			'winner',
		],
		alex_gk: [
			'winner',
			'winner',
			'winner',
			'winner',
			'incorrect',
			'incorrect',
			'incorrect',
			'diff',
			'exact',
			'winner',
		],
		sam_analytics: [
			'exact',
			'diff',
			'winner',
			'diff',
			'winner',
			'incorrect',
			'exact',
			'winner',
			'winner',
			'diff',
		],
		elena_scout: [
			'winner',
			'winner',
			'winner',
			'exact',
			'diff',
			'diff',
			'incorrect',
			'incorrect',
			'winner',
			'winner',
		],
		dave_pundit: [
			'incorrect',
			'incorrect',
			'incorrect',
			'winner',
			'winner',
			'exact',
			'diff',
			'winner',
			'incorrect',
			'incorrect',
		],
		kudo_champ: [
			'exact',
			'exact',
			'exact',
			'diff',
			'diff',
			'winner',
			'winner',
			'winner',
			'incorrect',
			'incorrect',
		],
	};

	// Helper to loop over staged matches and generate predictions for MW10 & MW11
	const seedPredictionsForMatches = (
		fixtures: typeof mw10Fixtures | typeof mw11Fixtures,
	) => {
		fixtures.forEach((f, idx) => {
			const matchId = matchIdMap.get(f.external_id);
			if (!matchId) return;

			userProfiles.forEach((user) => {
				const biasList = userBiases[user.username] || ['winner'];
				const bias = biasList[idx % biasList.length];
				const predScore = generatePredictionScore(
					f.home_score,
					f.away_score,
					bias,
				);

				predictionsToInsert.push({
					user_id: user.id,
					match_id: matchId,
					predicted_home_score: predScore.home,
					predicted_away_score: predScore.away,
				});
			});
		});
	};

	// Feed MW10 & MW11
	seedPredictionsForMatches(mw10Fixtures);
	seedPredictionsForMatches(mw11Fixtures);

	// Also seed partial predictions for upcoming Matchweek 12 for some users to demonstrate Picks Matrix
	mw12Fixtures.slice(0, 5).forEach((f, idx) => {
		const matchId = matchIdMap.get(f.external_id);
		if (!matchId) return;

		// Seed for Marcus, Sarah, Sam
		const predictUsers = userProfiles.filter((u) =>
			['marcus_striker', 'sarah_tactician', 'sam_analytics'].includes(
				u.username,
			),
		);
		predictUsers.forEach((user) => {
			const randomHome = Math.floor(Math.random() * 3);
			const randomAway = Math.floor(Math.random() * 3);
			predictionsToInsert.push({
				user_id: user.id,
				match_id: matchId,
				predicted_home_score: randomHome,
				predicted_away_score: randomAway,
			});
		});
	});

	console.log(`Inserting ${predictionsToInsert.length} mock predictions...`);
	const { error: predsErr } = await supabase
		.from('predictions')
		.upsert(predictionsToInsert, { onConflict: 'user_id,match_id' });

	if (predsErr) {
		console.error('❌ Failed to insert mock predictions:', predsErr);
		process.exit(1);
	}
	console.log('✅ Mock predictions inserted successfully.');

	// 6. Resolve Staged Matches (MW10 & MW11) with Real Past Dates and Scores
	// This will trigger the database processing triggers to calculate points!
	console.log('🔄 Resolving and scoring historical Matchweeks 10 and 11...');

	const resolvedMatchesUpdates: any[] = [];

	// MW10 actual finished updates
	const mw10Date = new Date();
	mw10Date.setDate(mw10Date.getDate() - 14); // 14 days ago
	mw10Fixtures.forEach((f) => {
		const matchId = matchIdMap.get(f.external_id);
		if (!matchId) return;

		resolvedMatchesUpdates.push({
			id: matchId,
			tournament_id: tournament.id,
			matchday: 10,
			round: 'Regular Season - 10',
			home_team_id: teamUuidMap.get(f.home_external_id),
			away_team_id: teamUuidMap.get(f.away_external_id),
			kickoff_time: mw10Date.toISOString(),
			home_score: f.home_score,
			away_score: f.away_score,
			status: 'finished',
			external_id: f.external_id,
			updated_at: new Date().toISOString(),
		});
	});

	// MW11 actual finished updates
	const mw11Date = new Date();
	mw11Date.setDate(mw11Date.getDate() - 7); // 7 days ago
	mw11Fixtures.forEach((f) => {
		const matchId = matchIdMap.get(f.external_id);
		if (!matchId) return;

		resolvedMatchesUpdates.push({
			id: matchId,
			tournament_id: tournament.id,
			matchday: 11,
			round: 'Regular Season - 11',
			home_team_id: teamUuidMap.get(f.home_external_id),
			away_team_id: teamUuidMap.get(f.away_external_id),
			kickoff_time: mw11Date.toISOString(),
			home_score: f.home_score,
			away_score: f.away_score,
			status: 'finished',
			external_id: f.external_id,
			updated_at: new Date().toISOString(),
		});
	});

	console.log(
		`Updating ${resolvedMatchesUpdates.length} matches to "finished" status to trigger scoring engine...`,
	);
	const { error: resolveErr } = await supabase
		.from('matches')
		.upsert(resolvedMatchesUpdates, { onConflict: 'id' });

	if (resolveErr) {
		console.error('❌ Failed to resolve historical matches:', resolveErr);
		process.exit(1);
	}
	console.log('✅ Matches resolved and scored successfully via DB triggers.');

	// 7. Seed Test Pools / Social Leagues
	console.log('🔄 Seeding test pools (social leagues)...');

	const poolsToCreate = [
		{
			name: 'Premier League Official Hub',
			description:
				'The official public prediction pool for all Premier League 24/25 predictors. Predict and dominate!',
			invite_code: 'PREM25',
			creator_id: userProfiles[0].id, // Marcus Striker
			is_public: true,
		},
		{
			name: 'Weekend Warriors',
			description:
				'Weekly casual banter league for die-hard fans. Only the strongest scoreline picks survive!',
			invite_code: 'WARRIOR',
			creator_id: userProfiles[1].id, // Sarah Tactician
			is_public: false,
		},
		{
			name: 'The Champions Circle',
			description:
				'Premium invitation-only league for statistical analysts and correct score masters.',
			invite_code: 'CHAMP9',
			creator_id: userProfiles[3].id, // Sam Analytics
			is_public: false,
		},
		{
			name: 'Office Banter League',
			description:
				'The ultimate corporate battleground. Predict scores, trigger Slack arguments, win bragging rights.',
			invite_code: 'BANTER',
			creator_id: userProfiles[5].id, // Dave Pundit
			is_public: false,
		},
	];

	for (const poolSpec of poolsToCreate) {
		const { data: pool, error: poolErr } = await supabase
			.from('pools')
			.upsert(poolSpec, { onConflict: 'invite_code' })
			.select()
			.single();

		if (poolErr || !pool) {
			console.error(
				`❌ Failed to seed pool "${poolSpec.name}":`,
				poolErr?.message,
			);
			continue;
		}

		console.log(
			`   🏆 Pool initialized: "${pool.name}" (Code: ${pool.invite_code})`,
		);

		// Seed pool membership for all mock users (and any dev user profiles available)
		const membersToInsert: any[] = [];
		const candidateProfiles = allProfiles || [];

		candidateProfiles.forEach((prof) => {
			// Decide role: creator if creator_id matches, otherwise member
			const role = prof.id === pool.creator_id ? 'creator' : 'member';

			// Add everyone to Premier League Hub and Office Banter League
			// Add subset of users to Weekend Warriors and Champions Circle for variety
			let shouldJoin = true;
			if (pool.invite_code === 'WARRIOR' && Math.random() > 0.7)
				shouldJoin = false;
			if (pool.invite_code === 'CHAMP9' && Math.random() > 0.6)
				shouldJoin = false;

			if (shouldJoin) {
				membersToInsert.push({
					pool_id: pool.id,
					user_id: prof.id,
					role: role,
					joined_at: new Date(Date.now() - 15 * 24 * 3600000).toISOString(), // 15 days ago
				});
			}
		});

		console.log(`      Adding ${membersToInsert.length} members to pool...`);
		const { error: membersErr } = await supabase
			.from('pool_members')
			.upsert(membersToInsert, { onConflict: 'pool_id,user_id' });

		if (membersErr) {
			console.error(
				`      ❌ Failed to populate members for pool "${pool.name}":`,
				membersErr.message,
			);
		}
	}

	// 8. Invoke Recalculate RPC to ensure absolutely flawless total scores sync
	console.log('🔄 Running recalculate_all_scores RPC on database...');
	const { error: rpcErr } = await supabase.rpc('recalculate_all_scores');

	if (rpcErr) {
		console.warn(
			'⚠️ Warning calling recalculate_all_scores RPC:',
			rpcErr.message,
		);
	} else {
		console.log('✅ Global point recalculation complete. Sync flawless.');
	}

	// 9. Display high-level stats of populated data to verify
	console.log('\n📊 Seeding Complete. High-Level Database Report:');

	const { count: userCount } = await supabase
		.from('profiles')
		.select('*', { count: 'exact', head: true });
	const { count: matchCount } = await supabase
		.from('matches')
		.select('*', { count: 'exact', head: true });
	const { count: predCount } = await supabase
		.from('predictions')
		.select('*', { count: 'exact', head: true });
	const { count: poolCount } = await supabase
		.from('pools')
		.select('*', { count: 'exact', head: true });

	console.log(`   👥 Profiles:    ${userCount}`);
	console.log(`   ⚽ Matches:     ${matchCount}`);
	console.log(`   🎯 Predictions: ${predCount}`);
	console.log(`   🏆 Pools:       ${poolCount}`);

	console.log(
		'\n⭐️ CONGRATULATIONS! Your historical testing data is populated beautifully. Launching KudoMatch dev server and test queries now!',
	);
}

seedHistoricData();
