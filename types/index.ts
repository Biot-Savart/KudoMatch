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
	id: string; // UUID
	name: string;
	sport: string;
	season: string | null;
	status: 'upcoming' | 'active' | 'finished';
	logo_url: string | null;
	external_id: number | null; // API-Football League ID
	created_at: string;
}

export interface Team {
	id: string; // UUID
	tournament_id: string | null; // UUID references public.tournaments(id)
	name: string;
	short_name: string | null;
	logo_url: string | null;
	external_id: number | null; // API-Football Team ID
	created_at: string;
}

export interface Match {
	id: string; // UUID
	tournament_id: string; // UUID
	matchday: number | null;
	round: string | null;
	home_team_id: string; // UUID references public.teams(id)
	away_team_id: string; // UUID references public.teams(id)
	kickoff_time: string;
	home_score: number | null;
	away_score: number | null;
	status: 'scheduled' | 'live' | 'finished' | 'cancelled';
	external_id: number | null; // API-Football Fixture ID
	created_at: string;
	updated_at: string;
	home_team?: Team;
	away_team?: Team;
}

export interface Prediction {
	id: string; // UUID
	user_id: string; // UUID references public.profiles(id)
	match_id: string; // UUID references public.matches(id)
	predicted_home_score: number;
	predicted_away_score: number;
	predicted_winner: 'home' | 'away' | 'draw' | null;
	points_earned: number;
	created_at: string;
}

export interface PredictionWithMatch extends Prediction {
	match?: Match & {
		home_team?: Team;
		away_team?: Team;
	};
}

export interface Pool {
	id: string; // UUID
	name: string;
	description: string | null;
	invite_code: string;
	creator_id: string; // UUID references public.profiles(id)
	is_public: boolean;
	created_at: string;
	creator?: Profile;
	member_count?: number;
}

export interface PoolMember {
	pool_id: string; // UUID REFERENCES pools(id)
	user_id: string; // UUID REFERENCES profiles(id)
	role: 'creator' | 'admin' | 'member';
	joined_at: string;
	profile?: Profile;
}

export interface PoolStanding {
	pool_id: string; // UUID
	user_id: string; // UUID
	total_points: number;
	wins: number;
	rank: number | null;
	profile?: Profile;
}

export interface PoolLeaderboardEntry {
	rank: number;
	user_id: string;
	username: string | null;
	full_name: string | null;
	avatar_url: string | null;
	total_points: number;
	exact_count: number;
	predictions_count: number;
	joined_at: string;
}

export interface PoolMessage {
	id: string;
	pool_id: string;
	user_id: string;
	message: string;
	created_at: string;
	profile?: Profile;
}

export interface HeadToHeadStats {
	matches_compared: number;
	wins_a: number;
	wins_b: number;
	draws: number;
	exacts_a: number;
	exacts_b: number;
	points_a: number;
	points_b: number;
}
