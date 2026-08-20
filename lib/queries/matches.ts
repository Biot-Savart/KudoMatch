import { createClient } from '@/lib/supabase/client';
import { Match } from '@/types';

// Beautiful fallback matches for offline/unseeded states
const fallbackMatches: Match[] = [
	{
		id: 'm1',
		tournament_id: 't1',
		matchday: 12,
		round: 'Regular Season - 12',
		home_team_id: 'home1',
		away_team_id: 'away1',
		kickoff_time: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // Tomorrow
		home_score: null,
		away_score: null,
		status: 'scheduled',
		external_id: 12001,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		home_team: {
			id: 'home1',
			tournament_id: 't1',
			name: 'Chelsea',
			short_name: 'CHE',
			logo_url: 'https://media.api-sports.io/football/teams/49.png',
			external_id: 49,
			created_at: '',
		},
		away_team: {
			id: 'away1',
			tournament_id: 't1',
			name: 'Arsenal',
			short_name: 'ARS',
			logo_url: 'https://media.api-sports.io/football/teams/42.png',
			external_id: 42,
			created_at: '',
		},
	},
	{
		id: 'm2',
		tournament_id: 't1',
		matchday: 12,
		round: 'Regular Season - 12',
		home_team_id: 'home2',
		away_team_id: 'away2',
		kickoff_time: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(), // 2 days
		home_score: null,
		away_score: null,
		status: 'scheduled',
		external_id: 12002,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		home_team: {
			id: 'home2',
			tournament_id: 't1',
			name: 'Manchester City',
			short_name: 'MCI',
			logo_url: 'https://media.api-sports.io/football/teams/50.png',
			external_id: 50,
			created_at: '',
		},
		away_team: {
			id: 'away2',
			tournament_id: 't1',
			name: 'Tottenham Hotspur',
			short_name: 'TOT',
			logo_url: 'https://media.api-sports.io/football/teams/47.png',
			external_id: 47,
			created_at: '',
		},
	},
	{
		id: 'm3',
		tournament_id: 't1',
		matchday: 12,
		round: 'Regular Season - 12',
		home_team_id: 'home3',
		away_team_id: 'away3',
		kickoff_time: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(), // 3 days
		home_score: null,
		away_score: null,
		status: 'scheduled',
		external_id: 12003,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		home_team: {
			id: 'home3',
			tournament_id: 't1',
			name: 'Liverpool',
			short_name: 'LIV',
			logo_url: 'https://media.api-sports.io/football/teams/40.png',
			external_id: 40,
			created_at: '',
		},
		away_team: {
			id: 'away3',
			tournament_id: 't1',
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
