// ============================================================================
// Core Domain Models & Schemas - Phase 13 Application Event-Model Refactor
// ============================================================================

export type SportSlug = 'football' | 'rugby_union' | (string & {});

export interface Sport {
	slug: SportSlug;
	name: string;
	icon_key: string | null;
	default_score_unit: string;
	is_active: boolean;
	display_order: number;
	created_at: string;
	updated_at: string;
}

export type CompetitionKind = 'league' | 'cup' | 'tour' | 'race_series';

export interface Competition {
	id: string; // bigint mapped to string
	sport_slug: SportSlug;
	slug: string;
	name: string;
	kind: CompetitionKind;
	country: string | null;
	logo_url: string | null;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	sport?: Sport;
}

export type EditionStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export interface CompetitionEdition {
	id: string; // bigint mapped to string
	competition_id: string;
	season_key: string;
	name: string;
	starts_at: string;
	ends_at: string;
	status: EditionStatus;
	metadata: Record<string, any>;
	created_at: string;
	updated_at: string;
	competition?: Competition;
}

export type CompetitorKind = 'team' | 'person' | 'constructor';

export interface Competitor {
	id: string; // bigint mapped to string
	sport_slug: SportSlug;
	kind: CompetitorKind;
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

export type EventKind = 'match' | 'race' | 'session' | 'bout';
export type EventStatus =
	| 'scheduled'
	| 'live'
	| 'completed'
	| 'finished'
	| 'postponed'
	| 'cancelled'
	| 'abandoned'
	| (string & {});

export type CompetitorRole = 'home' | 'away' | 'participant';

export interface EventCompetitor {
	event_id: string;
	competitor_id: string;
	slot: number;
	role: CompetitorRole | null;
	created_at: string;
	competitor?: Competitor;
}

export interface SportEvent {
	id: string; // bigint mapped to string
	edition_id: string;
	kind: EventKind;
	starts_at: string;
	status: EventStatus;
	round_label: string | null;
	sequence_number: number | null;
	venue_name: string | null;
	is_neutral_venue: boolean;
	metadata: Record<string, any>;
	created_at: string;
	updated_at: string;
	edition?: CompetitionEdition;
	competitors?: EventCompetitor[];
	markets?: EventMarket[];
	current_market?: EventMarket;
}

export type PredictableEvent = SportEvent;

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

// ----------------------------------------------------------------------------
// Scoring Rulesets, Tiers & Settlements
// ----------------------------------------------------------------------------

export type MarketKind = 'team_scoreline' | (string & {});

export type TierCode =
	| 'exact_score'
	| 'exact_margin'
	| 'close_margin'
	| 'outcome'
	| 'miss';

export interface ScoringRuleTier {
	ruleset_id: string; // bigint mapped to string
	tier_code: TierCode;
	raw_points: number;
	rank_order: number;
	label: string;
	description: string;
	example: string | null;
}

export interface ScoringRulesetUiConfig {
	unit?: string;
	home_label?: string;
	away_label?: string;
	score_min?: number;
	score_max?: number;
	step?: number;
	presets?: { home: number; away: number; label?: string }[];
	rules_summary?: {
		title: string;
		description: string;
		points: number;
		tier_code: TierCode;
	}[];
	[key: string]: any;
}

export interface ScoringRuleset {
	id: string; // bigint mapped to string
	sport_slug: SportSlug;
	market_kind: MarketKind;
	evaluator_key: string;
	version: number;
	max_raw_points: number;
	evaluator_config: Record<string, any>;
	ui_config: ScoringRulesetUiConfig;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	tiers?: ScoringRuleTier[];
}

export type MarketStatus = 'draft' | 'open' | 'locked' | 'settled' | 'void';

export interface EventMarket {
	id: string; // bigint mapped to string
	event_id: string; // bigint mapped to string
	market_kind: MarketKind;
	payload_schema_version: number;
	ruleset_id: string; // bigint mapped to string
	sequence_no: number;
	is_current: boolean;
	opens_at: string;
	locks_at: string;
	status: MarketStatus;
	created_at: string;
	updated_at: string;
	event?: SportEvent;
	ruleset?: ScoringRuleset;
	result?: MarketResult;
	user_prediction?: MarketPrediction;
}

// ----------------------------------------------------------------------------
// Market Selections & Results (Discriminated Unions)
// ----------------------------------------------------------------------------

export interface TeamScorelineSelection {
	kind: 'team_scoreline';
	version: number;
	home: number;
	away: number;
}

export type PredictionSelection = TeamScorelineSelection;

export interface TeamScorelineResult {
	kind: 'team_scoreline';
	version: number;
	home: number;
	away: number;
}

export type MarketResultPayload = TeamScorelineResult;

export type SettlementStatus = 'pending' | 'settled' | 'void';

export interface MarketPrediction {
	id: string; // bigint mapped to string
	user_id: string; // UUID
	event_market_id: string; // bigint mapped to string
	selection: PredictionSelection;
	settlement_status: SettlementStatus;
	ruleset_id: string | null;
	result_revision: number | null;
	tier_code: TierCode | null;
	raw_points: number | null;
	normalized_basis_points: number | null;
	settled_at: string | null;
	created_at: string;
	updated_at: string;
	market?: EventMarket;
	profile?: Profile;
}

export type MarketResultStatus = 'provisional' | 'final' | 'void';
export type MarketResultSourceKind = 'provider' | 'manual';

export interface MarketResult {
	event_market_id: string; // bigint mapped to string
	result: MarketResultPayload;
	revision: number;
	status: MarketResultStatus;
	source_kind: MarketResultSourceKind;
	source_ref: string | null;
	source_priority: number;
	finalized_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface SettlementAward {
	tier_code: TierCode;
	raw_points: number;
	normalized_basis_points: number;
	label?: string;
	description?: string;
}

// ----------------------------------------------------------------------------
// Scoped Pools, Membership & Leaderboards
// ----------------------------------------------------------------------------

export type PoolScopeKind = 'all_sports' | 'sport' | 'competition' | 'edition';
export type PoolScoringMode = 'raw' | 'normalized';

export interface ScopedPool {
	id: string; // UUID
	name: string;
	created_by: string; // UUID
	invite_code: string;
	scope_kind: PoolScopeKind;
	sport_slug: SportSlug | null;
	competition_id: string | null;
	edition_id: string | null;
	scoring_mode: PoolScoringMode;
	scoring_starts_at: string;
	is_private: boolean;
	created_at: string;
	updated_at: string;
	creator?: Profile;
	member_count?: number;
	competition?: Competition;
	edition?: CompetitionEdition;
	sport?: Sport;
}

// ScopedPool is the new primary Pool interface
export type Pool = ScopedPool;

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

export type PoolMember = PoolMembershipEpisode;

export interface PoolLeaderboardEntry {
	rank: number;
	user_id: string;
	full_name: string | null;
	avatar_url: string | null;
	total_points: number;
	exact_count: number;
	margin_count: number;
	outcome_count: number;
	predictions_count: number;
}

export interface PoolMessage {
	id: string;
	pool_id: string;
	user_id: string;
	message: string;
	created_at: string;
	profile?: Profile;
}

// ----------------------------------------------------------------------------
// Profiles, Score Summaries & Analytics
// ----------------------------------------------------------------------------

export interface Profile {
	id: string;
	email?: string;
	username?: string | null;
	full_name: string | null;
	avatar_url: string | null;
	created_at: string;
	updated_at: string;
}

export interface UserScoreSummary {
	total_raw_points: number;
	total_normalized_points: number;
	total_predictions: number;
	settled_predictions: number;
	exact_count: number;
	margin_count: number;
	outcome_count: number;
	miss_count: number;
	win_rate: number;
}

export interface MarketCommunityStats {
	total_predictions: number;
	avg_home_score: number;
	avg_away_score: number;
	home_win_pct: number;
	draw_pct: number;
	away_win_pct: number;
	top_exact_scores: {
		home: number;
		away: number;
		count: number;
		pct: number;
	}[];
}

export interface ParticipantPick {
	user_id: string;
	full_name: string | null;
	avatar_url: string | null;
	home: number;
	away: number;
	tier_code: TierCode | null;
	points: number | null;
}

export interface HeadToHeadStats {
	events_compared: number;
	wins_a: number;
	wins_b: number;
	draws: number;
	exacts_a: number;
	exacts_b: number;
	points_a: number;
	points_b: number;
}

// ----------------------------------------------------------------------------
// Notifications & Subscriptions
// ----------------------------------------------------------------------------

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

export interface KickoffReminderEvent {
	marketId?: string;
	matchId?: string;
	eventId?: string;
	homeTeamName: string;
	awayTeamName: string;
	homeTeamLogo?: string | null;
	awayTeamLogo?: string | null;
	locksAt?: string;
	startsAt?: string;
	kickoffTime?: string;
	roundLabel?: string | null;
}

export type KickoffReminderMatch = KickoffReminderEvent;

// Legacy test & compatibility aliases
export type Match = Partial<SportEvent> & {
	id: string;
	tournament_id?: string;
	matchday?: number | null;
	round?: string | null;
	home_team_id?: string;
	away_team_id?: string;
	kickoff_time?: string;
	home_score?: number | null;
	away_score?: number | null;
	status?: any;
	home_team?: any;
	away_team?: any;
	[key: string]: any;
};

export type Tournament = any;
export type Team = any;
export type Prediction = any;
export type PredictionWithMatch = any;

export interface WeeklyDigestSummary {
	userId: string;
	username?: string | null;
	fullName?: string | null;
	email?: string | null;
	totalPoints: number;
	pointsEarnedThisWeek: number;
	exactPredictionsThisWeek: number;
	totalPredictionsThisWeek: number;
	topPoolName?: string | null;
	topPoolRank?: number | null;
	upcomingEventsCount?: number;
	upcomingMatchesCount?: number;
}
