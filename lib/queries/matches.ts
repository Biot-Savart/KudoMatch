import { createClient } from '@/lib/supabase/client';
import { Match } from '@/types';

// Beautiful fallback matches with valid UUID formats to prevent syntax errors
const fallbackMatches: Match[] = [
	{
		id: '11111111-1111-4111-a111-111111111111',
		tournament_id: '00000000-0000-4000-a000-000000000000',
		matchday: 12,
		round: 'Regular Season - 12',
		home_team_id: '22222222-2222-4222-a222-222222222222',
		away_team_id: '33333333-3333-4333-a333-333333333333',
		kickoff_time: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // Tomorrow
		home_score: null,
		away_score: null,
		status: 'scheduled',
		external_id: 12001,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		home_team: {
			id: '22222222-2222-4222-a222-222222222222',
			tournament_id: '00000000-0000-4000-a000-000000000000',
			name: 'Chelsea',
			short_name: 'CHE',
			logo_url: 'https://media.api-sports.io/football/teams/49.png',
			external_id: 49,
			created_at: '',
		},
		away_team: {
			id: '33333333-3333-4333-a333-333333333333',
			tournament_id: '00000000-0000-4000-a000-000000000000',
			name: 'Arsenal',
			short_name: 'ARS',
			logo_url: 'https://media.api-sports.io/football/teams/42.png',
			external_id: 42,
			created_at: '',
		},
	},
	{
		id: '22222222-2222-4222-a222-422222222222',
		tournament_id: '00000000-0000-4000-a000-000000000000',
		matchday: 12,
		round: 'Regular Season - 12',
		home_team_id: '44444444-4444-4444-a444-444444444444',
		away_team_id: '55555555-5555-4555-a555-555555555555',
		kickoff_time: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(), // 2 days
		home_score: null,
		away_score: null,
		status: 'scheduled',
		external_id: 12002,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		home_team: {
			id: '44444444-4444-4444-a444-444444444444',
			tournament_id: '00000000-0000-4000-a000-000000000000',
			name: 'Manchester City',
			short_name: 'MCI',
			logo_url: 'https://media.api-sports.io/football/teams/50.png',
			external_id: 50,
			created_at: '',
		},
		away_team: {
			id: '55555555-5555-4555-a555-555555555555',
			tournament_id: '00000000-0000-4000-a000-000000000000',
			name: 'Tottenham Hotspur',
			short_name: 'TOT',
			logo_url: 'https://media.api-sports.io/football/teams/47.png',
			external_id: 47,
			created_at: '',
		},
	},
	{
		id: '33333333-3333-4333-a333-433333333333',
		tournament_id: '00000000-0000-4000-a000-000000000000',
		matchday: 12,
		round: 'Regular Season - 12',
		home_team_id: '66666666-6666-4666-a666-666666666666',
		away_team_id: '77777777-7777-4777-a777-777777777777',
		kickoff_time: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(), // 3 days
		home_score: null,
		away_score: null,
		status: 'scheduled',
		external_id: 12003,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		home_team: {
			id: '66666666-6666-4666-a666-666666666666',
			tournament_id: '00000000-0000-4000-a000-000000000000',
			name: 'Liverpool',
			short_name: 'LIV',
			logo_url: 'https://media.api-sports.io/football/teams/40.png',
			external_id: 40,
			created_at: '',
		},
		away_team: {
			id: '77777777-7777-4777-a777-777777777777',
			tournament_id: '00000000-0000-4000-a000-000000000000',
			name: 'Aston Villa',
			short_name: 'AVL',
			logo_url: 'https://media.api-sports.io/football/teams/66.png',
			external_id: 66,
			created_at: '',
		},
	},
];

export async function fetchMatches(matchday: number = 12): Promise<Match[]> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase
			.from('matches')
			.select(
				`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*)
      `,
			)
			.eq('matchday', matchday)
			.order('kickoff_time', { ascending: true });

		if (error) throw error;

		if (!data || data.length === 0) {
			console.warn(
				'⚠️ No matches found in database. Loading high-fidelity seeder fallback dataset.',
			);
			return fallbackMatches;
		}

		return data as Match[];
	} catch (err) {
		console.error('⚠️ Failed to fetch matches from Supabase:', err);
		return fallbackMatches;
	}
}

export async function fetchAvailableMatchdays(): Promise<number[]> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase.from('matches').select('matchday');

		if (error) throw error;

		if (!data || data.length === 0) {
			return [12]; // Fallback to matchday 12
		}

		const matchdays = data
			.map((m) => m.matchday)
			.filter((val, index, self) => val !== null && self.indexOf(val) === index)
			.sort((a, b) => a - b);

		return matchdays.length > 0 ? matchdays : [12];
	} catch (err) {
		console.error('⚠️ Failed to fetch available matchdays:', err);
		return [12];
	}
}

export async function fetchActiveMatchday(): Promise<number> {
	const supabase = createClient();

	try {
		// Try to find the next scheduled or live match
		const { data: upcoming, error: upcomingError } = await supabase
			.from('matches')
			.select('matchday, kickoff_time')
			.in('status', ['scheduled', 'live'])
			.order('kickoff_time', { ascending: true })
			.limit(1);

		if (!upcomingError && upcoming && upcoming.length > 0) {
			return upcoming[0].matchday;
		}

		// If no upcoming matches, find the latest finished matchday
		const { data: finished, error: finishedError } = await supabase
			.from('matches')
			.select('matchday')
			.eq('status', 'finished')
			.order('kickoff_time', { ascending: false })
			.limit(1);

		if (!finishedError && finished && finished.length > 0) {
			return finished[0].matchday;
		}

		// Default fallback
		return 12;
	} catch (err) {
		console.error('⚠️ Failed to fetch active matchday:', err);
		return 12;
	}
}
