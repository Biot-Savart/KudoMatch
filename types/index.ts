export interface Profile {
	id: string;
	username: string | null;
	full_name: string | null;
	avatar_url: string | null;
	total_points: number;
	created_at: string;
	updated_at: string;
}

export interface Tournament {
	id: number;
	name: string;
	country: string;
	season: string;
	logo_url: string | null;
}

export interface Team {
	id: number;
	name: string;
	short_name: string;
	logo_url: string | null;
}

export interface Match {
	id: number;
	tournament_id: number;
	home_team_id: number;
	away_team_id: number;
	kickoff_time: string;
	round: string;
	status: 'scheduled' | 'live' | 'finished';
	home_goals: number | null;
	away_goals: number | null;
	home_team?: Team;
	away_team?: Team;
}

export interface Prediction {
	id: string;
	user_id: string;
	match_id: number;
	predicted_home_goals: number;
	predicted_away_goals: number;
	points_awarded: number | null;
	created_at: string;
	updated_at: string;
}

export interface Pool {
	id: string;
	name: string;
	invite_code: string;
	created_by: string;
	created_at: string;
}

export interface PoolMember {
	pool_id: string;
	user_id: string;
	joined_at: string;
	profile?: Profile;
}
