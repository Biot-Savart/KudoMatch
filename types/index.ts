// Phase 11: Multi-Sport Core Domain Models & Schemas

export interface Sport {
	slug: string;
	name: string;
	icon_key: string | null;
	default_score_unit: string;
	is_active: boolean;
	display_order: number;
	created_at: string;
	updated_at: string;
}

export interface Competition {
	id: string; // bigint mapped to string
	sport_slug: string;
	slug: string;
	name: string;
	kind: 'league' | 'cup' | 'tour' | 'race_series';
	country: string | null;
	logo_url: string | null;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	sport?: Sport;
}

export interface CompetitionEdition {
	id: string; // bigint mapped to string
	competition_id: string;
	season_key: string;
	name: string;
	starts_at: string;
	ends_at: string;
	status: 'planned' | 'active' | 'completed' | 'cancelled';
	metadata: Record<string, any>;
	created_at: string;
	updated_at: string;
	competition?: Competition;
}

export interface Competitor {
	id: string; // bigint mapped to string
	sport_slug: string;
	kind: 'team' | 'person' | 'constructor';
	name: string;
	short_name: string | null;
	media_url: string | null;
	country_code: string | null;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	sport?: Sport;
}

export interface EditionCompetitor {
	edition_id: string;
	competitor_id: string;
	seed: number | null;
	group_conference: string | null;
	display_order: number;
	created_at: string;
	competitor?: Competitor;
}

export interface SportEvent {
	id: string; // bigint mapped to string
	edition_id: string;
	kind: 'match' | 'race' | 'session' | 'bout';
	starts_at: string;
	status:
		| 'scheduled'
		| 'live'
		| 'completed'
		| 'postponed'
		| 'cancelled'
		| 'abandoned';
	round_label: string | null;
	sequence_number: number | null;
	venue_name: string | null;
	is_neutral_venue: boolean;
	metadata: Record<string, any>;
	created_at: string;
	updated_at: string;
	edition?: CompetitionEdition;
	competitors?: EventCompetitor[];
}

export interface EventCompetitor {
	event_id: string;
	competitor_id: string;
	slot: number;
	role: 'home' | 'away' | 'participant' | null;
	created_at: string;
	competitor?: Competitor;
}

export interface DataProvider {
	slug: string;
	name: string;
	server_config_id: string | null;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface ExternalEntityRef {
	id: string; // bigint mapped to string
	provider_slug: string;
	entity_kind: 'competition' | 'edition' | 'competitor' | 'event';
	external_key: string;
	competition_id: string | null;
	edition_id: string | null;
	competitor_id: string | null;
	event_id: string | null;
	is_primary: boolean;
	metadata: Record<string, any>;
	created_at: string;
	updated_at: string;
}

export interface IngestionQuarantine {
	id: string; // bigint mapped to string
	provider_slug: string;
	entity_kind:
		| 'competition'
		| 'edition'
		| 'competitor'
		| 'event'
		| 'result'
		| 'unknown';
	external_key: string | null;
	reason_code: string;
	error_summary: string;
	payload_fingerprint: string | null;
	occurrence_count: number;
	status: 'unresolved' | 'resolved' | 'ignored';
	first_seen_at: string;
	last_seen_at: string;
	created_at: string;
	updated_at: string;
}

// Phase 12: Prediction Markets, Rulesets, Settlement & Scoped Pools Domain Models

export interface ScoringRuleset {
	id: string; // bigint mapped to string
	sport_slug: string;
	market_kind: 'team_scoreline';
	evaluator_key: string;
	version: number;
	max_raw_points: number;
	evaluator_config: Record<string, any>;
	ui_config: Record<string, any>;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	tiers?: ScoringRuleTier[];
}

export interface ScoringRuleTier {
	ruleset_id: string; // bigint mapped to string
	tier_code:
		| 'exact_score'
		| 'exact_margin'
		| 'close_margin'
		| 'outcome'
		| 'miss';
	raw_points: number;
	rank_order: number;
	label: string;
	description: string;
	example: string | null;
}

export interface EventMarket {
	id: string; // bigint mapped to string
	event_id: string; // bigint mapped to string
	market_kind: 'team_scoreline';
	payload_schema_version: number;
	ruleset_id: string; // bigint mapped to string
	sequence_no: number;
	is_current: boolean;
	opens_at: string;
	locks_at: string;
	status: 'draft' | 'open' | 'locked' | 'settled' | 'void';
	created_at: string;
	updated_at: string;
	event?: SportEvent;
	ruleset?: ScoringRuleset;
}

export interface MarketSelection {
	kind: 'team_scoreline';
	version: number;
	home: number;
	away: number;
}

export interface MarketPrediction {
	id: string; // bigint mapped to string
	user_id: string; // UUID
	event_market_id: string; // bigint mapped to string
	selection: MarketSelection;
	settlement_status: 'pending' | 'settled' | 'void';
	ruleset_id: string | null;
	result_revision: number | null;
	tier_code:
		| 'exact_score'
		| 'exact_margin'
		| 'close_margin'
		| 'outcome'
		| 'miss'
		| null;
	raw_points: number | null;
	normalized_basis_points: number | null;
	settled_at: string | null;
	created_at: string;
	updated_at: string;
	market?: EventMarket;
	profile?: Profile;
}

export interface MarketResult {
	event_market_id: string; // bigint mapped to string
	result: MarketSelection;
	revision: number;
	status: 'provisional' | 'final' | 'void';
	source_kind: 'provider' | 'manual';
	source_ref: string | null;
	source_priority: number;
	finalized_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface ScopedPool {
	id: string; // UUID
	name: string;
	created_by: string; // UUID
	invite_code: string;
	scope_kind: 'all_sports' | 'sport' | 'competition' | 'edition';
	sport_slug: string | null;
	competition_id: string | null;
	edition_id: string | null;
	scoring_mode: 'raw' | 'normalized';
	scoring_starts_at: string;
	is_private: boolean;
	created_at: string;
	updated_at: string;
	creator?: Profile;
}

export interface PoolMembershipEpisode {
	id: string; // bigint mapped to string
	pool_id: string; // UUID
	user_id: string; // UUID
	role: 'admin' | 'member';
	joined_at: string;
	left_at: string | null;
	created_at: string;
	profile?: Profile;
}

// Legacy Application Types (Retained for application stability until Phase 13 Refactor)

export interface Profile {
	id: string;
	username?: string | null;
	full_name: string | null;
	avatar_url: string | null;
	total_points?: number;
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

export interface PushSubscriptionData {
	endpoint: string;
	p256dh: string;
	auth: string;
}

export interface PushSubscriptionRecord extends PushSubscriptionData {
	id: string;
	user_id: string;
	created_at: string;
	updated_at: string;
}

export interface NotificationPreferences {
	user_id: string;
	kickoff_warnings: boolean;
	match_results: boolean;
	weekly_digest: boolean;
	email_notifications: boolean;
	push_notifications: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface NotificationPayload {
	title: string;
	body: string;
	icon?: string;
	badge?: string;
	url?: string;
	data?: Record<string, any>;
}

export interface KickoffReminderMatch {
	matchId: string;
	homeTeamName: string;
	awayTeamName: string;
	homeTeamLogo?: string | null;
	awayTeamLogo?: string | null;
	kickoffTime: string;
	gameweek?: number | null;
}

export interface WeeklyDigestSummary {
	userId: string;
	username: string;
	fullName?: string | null;
	email?: string | null;
	totalPoints: number;
	pointsEarnedThisWeek: number;
	exactPredictionsThisWeek: number;
	totalPredictionsThisWeek: number;
	topPoolName?: string | null;
	topPoolRank?: number | null;
	upcomingMatchesCount: number;
}

export interface MatchParticipantPick {
	user_id: string;
	username: string;
	avatar_url?: string | null;
	full_name?: string | null;
	predicted_home_score: number;
	predicted_away_score: number;
	points_earned: number;
}

export interface MatchCommunityInsights {
	match_id: string;
	is_locked: boolean;
	total_predictions: number;
	outcome_distribution: {
		home_win_count: number;
		draw_count: number;
		away_win_count: number;
		home_win_pct: number;
		draw_pct: number;
		away_win_pct: number;
	};
	points_distribution: {
		exact_3pts: number;
		diff_2pts: number;
		winner_1pt: number;
		miss_0pts: number;
	};
	top_scores: {
		scoreline: string;
		count: number;
		percentage: number;
	}[];
	participants: MatchParticipantPick[];
}
