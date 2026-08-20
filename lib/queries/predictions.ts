import { createClient } from '@/lib/supabase/client';
import { Prediction, PredictionWithMatch } from '@/types';

export async function fetchUserPredictions(
	userId: string,
): Promise<Prediction[]> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase
			.from('predictions')
			.select('*')
			.eq('user_id', userId);

		if (error) throw error;
		return (data || []) as Prediction[];
	} catch (err) {
		console.error('⚠️ Failed to fetch user predictions from Supabase:', err);
		return [];
	}
}

export async function fetchUserPredictionsWithMatches(
	userId: string,
): Promise<PredictionWithMatch[]> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase
			.from('predictions')
			.select(
				`
				*,
				match:matches (
					*,
					home_team:teams!matches_home_team_id_fkey(*),
					away_team:teams!matches_away_team_id_fkey(*)
				)
			`,
			)
			.eq('user_id', userId);

		if (error) throw error;
		return (data || []) as PredictionWithMatch[];
	} catch (err) {
		console.error(
			'⚠️ Failed to fetch user predictions with matches from Supabase:',
			err,
		);
		return [];
	}
}

export async function upsertPrediction(
	userId: string,
	matchId: string,
	homeScore: number,
	awayScore: number,
): Promise<Prediction | null> {
	const supabase = createClient();

	try {
		const { data, error } = await supabase
			.from('predictions')
			.upsert(
				{
					user_id: userId,
					match_id: matchId,
					predicted_home_score: homeScore,
					predicted_away_score: awayScore,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: 'user_id,match_id' },
			)
			.select()
			.single();

		if (error) throw error;
		return data as Prediction;
	} catch (err: any) {
		console.error('⚠️ Failed to upsert prediction in Supabase:', err);
		throw new Error(err.message || 'Failed to save prediction.');
	}
}
