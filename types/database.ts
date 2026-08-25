export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export interface Database {
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string;
					email: string;
					full_name: string | null;
					avatar_url: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id: string;
					email: string;
					full_name?: string | null;
					avatar_url?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					email?: string;
					full_name?: string | null;
					avatar_url?: string | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			sports: {
				Row: {
					slug: string;
					name: string;
					icon_key: string | null;
					default_score_unit: string;
					is_active: boolean;
					display_order: number;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					slug: string;
					name: string;
					icon_key?: string | null;
					default_score_unit?: string;
					is_active?: boolean;
					display_order?: number;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					slug?: string;
					name?: string;
					icon_key?: string | null;
					default_score_unit?: string;
					is_active?: boolean;
					display_order?: number;
					created_at?: string;
					updated_at?: string;
				};
			};
			competitions: {
				Row: {
					id: number | string;
					sport_slug: string;
					slug: string;
					name: string;
					kind: 'league' | 'cup' | 'tour' | 'race_series';
					country: string | null;
					logo_url: string | null;
					is_active: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: never;
					sport_slug: string;
					slug: string;
					name: string;
					kind?: 'league' | 'cup' | 'tour' | 'race_series';
					country?: string | null;
					logo_url?: string | null;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: never;
					sport_slug?: string;
					slug?: string;
					name?: string;
					kind?: 'league' | 'cup' | 'tour' | 'race_series';
					country?: string | null;
					logo_url?: string | null;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
			};
			competition_editions: {
				Row: {
					id: number | string;
					competition_id: number | string;
					season_key: string;
					name: string;
					starts_at: string;
					ends_at: string;
					status: 'planned' | 'active' | 'completed' | 'cancelled';
					metadata: Json;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: never;
					competition_id: number | string;
					season_key: string;
					name: string;
					starts_at: string;
					ends_at: string;
					status?: 'planned' | 'active' | 'completed' | 'cancelled';
					metadata?: Json;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: never;
					competition_id?: number | string;
					season_key?: string;
					name?: string;
					starts_at?: string;
					ends_at?: string;
					status?: 'planned' | 'active' | 'completed' | 'cancelled';
					metadata?: Json;
					created_at?: string;
					updated_at?: string;
				};
			};
			competitors: {
				Row: {
					id: number | string;
					sport_slug: string;
					kind: 'team' | 'person' | 'constructor';
					name: string;
					short_name: string | null;
					media_url: string | null;
					country_code: string | null;
					is_active: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: never;
					sport_slug: string;
					kind?: 'team' | 'person' | 'constructor';
					name: string;
					short_name?: string | null;
					media_url?: string | null;
					country_code?: string | null;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: never;
					sport_slug?: string;
					kind?: 'team' | 'person' | 'constructor';
					name?: string;
					short_name?: string | null;
					media_url?: string | null;
					country_code?: string | null;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
			};
			events: {
				Row: {
					id: number | string;
					edition_id: number | string;
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
					metadata: Json;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: never;
					edition_id: number | string;
					kind?: 'match' | 'race' | 'session' | 'bout';
					starts_at: string;
					status?:
						| 'scheduled'
						| 'live'
						| 'completed'
						| 'postponed'
						| 'cancelled'
						| 'abandoned';
					round_label?: string | null;
					sequence_number?: number | null;
					venue_name?: string | null;
					is_neutral_venue?: boolean;
					metadata?: Json;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: never;
					edition_id?: number | string;
					kind?: 'match' | 'race' | 'session' | 'bout';
					starts_at?: string;
					status?:
						| 'scheduled'
						| 'live'
						| 'completed'
						| 'postponed'
						| 'cancelled'
						| 'abandoned';
					round_label?: string | null;
					sequence_number?: number | null;
					venue_name?: string | null;
					is_neutral_venue?: boolean;
					metadata?: Json;
					created_at?: string;
					updated_at?: string;
				};
			};
			event_competitors: {
				Row: {
					event_id: number | string;
					competitor_id: number | string;
					slot: number;
					role: 'home' | 'away' | 'participant' | null;
					created_at: string;
				};
				Insert: {
					event_id: number | string;
					competitor_id: number | string;
					slot: number;
					role?: 'home' | 'away' | 'participant' | null;
					created_at?: string;
				};
				Update: {
					event_id?: number | string;
					competitor_id?: number | string;
					slot?: number;
					role?: 'home' | 'away' | 'participant' | null;
					created_at?: string;
				};
			};
			scoring_rulesets: {
				Row: {
					id: number | string;
					sport_slug: string;
					market_kind: string;
					evaluator_key: string;
					version: number;
					max_raw_points: number;
					evaluator_config: Json;
					ui_config: Json;
					is_active: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: never;
					sport_slug: string;
					market_kind: string;
					evaluator_key: string;
					version: number;
					max_raw_points: number;
					evaluator_config: Json;
					ui_config: Json;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: never;
					sport_slug?: string;
					market_kind?: string;
					evaluator_key?: string;
					version?: number;
					max_raw_points?: number;
					evaluator_config?: Json;
					ui_config?: Json;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
			};
			scoring_rule_tiers: {
				Row: {
					ruleset_id: number | string;
					tier_code: string;
					raw_points: number;
					rank_order: number;
					label: string;
					description: string;
					example: string | null;
				};
				Insert: {
					ruleset_id: number | string;
					tier_code: string;
					raw_points: number;
					rank_order: number;
					label: string;
					description: string;
					example?: string | null;
				};
				Update: {
					ruleset_id?: number | string;
					tier_code?: string;
					raw_points?: number;
					rank_order?: number;
					label?: string;
					description?: string;
					example?: string | null;
				};
			};
			event_markets: {
				Row: {
					id: number | string;
					event_id: number | string;
					market_kind: string;
					payload_schema_version: number;
					ruleset_id: number | string;
					sequence_no: number;
					is_current: boolean;
					opens_at: string;
					locks_at: string;
					status: 'draft' | 'open' | 'locked' | 'settled' | 'void';
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: never;
					event_id: number | string;
					market_kind: string;
					payload_schema_version: number;
					ruleset_id: number | string;
					sequence_no?: number;
					is_current?: boolean;
					opens_at: string;
					locks_at: string;
					status?: 'draft' | 'open' | 'locked' | 'settled' | 'void';
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: never;
					event_id?: number | string;
					market_kind?: string;
					payload_schema_version?: number;
					ruleset_id?: number | string;
					sequence_no?: number;
					is_current?: boolean;
					opens_at?: string;
					locks_at?: string;
					status?: 'draft' | 'open' | 'locked' | 'settled' | 'void';
					created_at?: string;
					updated_at?: string;
				};
			};
			predictions: {
				Row: {
					id: number | string;
					user_id: string;
					event_market_id: number | string;
					selection: Json;
					settlement_status: 'pending' | 'settled' | 'void';
					ruleset_id: number | string | null;
					result_revision: number | null;
					tier_code: string | null;
					raw_points: number | null;
					normalized_basis_points: number | null;
					settled_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: never;
					user_id: string;
					event_market_id: number | string;
					selection: Json;
					settlement_status?: 'pending' | 'settled' | 'void';
					ruleset_id?: number | string | null;
					result_revision?: number | null;
					tier_code?: string | null;
					raw_points?: number | null;
					normalized_basis_points?: number | null;
					settled_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: never;
					user_id?: string;
					event_market_id?: number | string;
					selection?: Json;
					settlement_status?: 'pending' | 'settled' | 'void';
					ruleset_id?: number | string | null;
					result_revision?: number | null;
					tier_code?: string | null;
					raw_points?: number | null;
					normalized_basis_points?: number | null;
					settled_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			market_results: {
				Row: {
					event_market_id: number | string;
					result: Json;
					revision: number;
					status: 'provisional' | 'final' | 'void';
					source_kind: 'provider' | 'manual';
					source_ref: string | null;
					source_priority: number;
					finalized_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					event_market_id: number | string;
					result: Json;
					revision?: number;
					status?: 'provisional' | 'final' | 'void';
					source_kind?: 'provider' | 'manual';
					source_ref?: string | null;
					source_priority?: number;
					finalized_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					event_market_id?: number | string;
					result?: Json;
					revision?: number;
					status?: 'provisional' | 'final' | 'void';
					source_kind?: 'provider' | 'manual';
					source_ref?: string | null;
					source_priority?: number;
					finalized_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			pools: {
				Row: {
					id: string;
					name: string;
					created_by: string;
					invite_code: string;
					scope_kind: 'all_sports' | 'sport' | 'competition' | 'edition';
					sport_slug: string | null;
					competition_id: number | string | null;
					edition_id: number | string | null;
					scoring_mode: 'raw' | 'normalized';
					scoring_starts_at: string;
					is_private: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					created_by: string;
					invite_code?: string;
					scope_kind: 'all_sports' | 'sport' | 'competition' | 'edition';
					sport_slug?: string | null;
					competition_id?: number | string | null;
					edition_id?: number | string | null;
					scoring_mode?: 'raw' | 'normalized';
					scoring_starts_at?: string;
					is_private?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					created_by?: string;
					invite_code?: string;
					scope_kind?: 'all_sports' | 'sport' | 'competition' | 'edition';
					sport_slug?: string | null;
					competition_id?: number | string | null;
					edition_id?: number | string | null;
					scoring_mode?: 'raw' | 'normalized';
					scoring_starts_at?: string;
					is_private?: boolean;
					created_at?: string;
					updated_at?: string;
				};
			};
			pool_members: {
				Row: {
					id: number | string;
					pool_id: string;
					user_id: string;
					role: 'admin' | 'member';
					joined_at: string;
					left_at: string | null;
					created_at: string;
				};
				Insert: {
					id?: never;
					pool_id: string;
					user_id: string;
					role?: 'admin' | 'member';
					joined_at?: string;
					left_at?: string | null;
					created_at?: string;
				};
				Update: {
					id?: never;
					pool_id?: string;
					user_id?: string;
					role?: 'admin' | 'member';
					joined_at?: string;
					left_at?: string | null;
					created_at?: string;
				};
			};
			pool_messages: {
				Row: {
					id: string;
					pool_id: string;
					user_id: string;
					message: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					pool_id: string;
					user_id: string;
					message: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					pool_id?: string;
					user_id?: string;
					message?: string;
					created_at?: string;
				};
			};
			notification_preferences: {
				Row: {
					user_id: string;
					kickoff_warnings: boolean;
					match_results: boolean;
					weekly_digest: boolean;
					email_notifications: boolean;
					push_notifications: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					user_id: string;
					kickoff_warnings?: boolean;
					match_results?: boolean;
					weekly_digest?: boolean;
					email_notifications?: boolean;
					push_notifications?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					user_id?: string;
					kickoff_warnings?: boolean;
					match_results?: boolean;
					weekly_digest?: boolean;
					email_notifications?: boolean;
					push_notifications?: boolean;
					created_at?: string;
					updated_at?: string;
				};
			};
			push_subscriptions: {
				Row: {
					id: string;
					user_id: string;
					endpoint: string;
					p256dh: string;
					auth: string;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					endpoint: string;
					p256dh: string;
					auth: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					endpoint?: string;
					p256dh?: string;
					auth?: string;
					created_at?: string;
					updated_at?: string;
				};
			};
		};
		Views: Record<string, never>;
		Functions: {
			get_user_score_summary: {
				Args: {
					p_user_id: string;
					p_sport_slug?: string | null;
				};
				Returns: {
					total_raw_points: number;
					total_normalized_points: number;
					total_predictions: number;
					settled_predictions: number;
					exact_count: number;
					margin_count: number;
					outcome_count: number;
					miss_count: number;
					win_rate: number;
				}[];
			};
			get_market_community_stats: {
				Args: {
					p_market_id: number | string;
				};
				Returns: {
					total_predictions: number;
					avg_home_score: number;
					avg_away_score: number;
					home_win_pct: number;
					draw_pct: number;
					away_win_pct: number;
					top_exact_scores: Json;
				}[];
			};
			get_pool_leaderboard: {
				Args: {
					p_pool_id: string;
				};
				Returns: {
					rank: number;
					user_id: string;
					full_name: string | null;
					avatar_url: string | null;
					total_points: number;
					exact_count: number;
					margin_count: number;
					outcome_count: number;
					predictions_count: number;
				}[];
			};
		};
	};
}

export type Tables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']> = never;
