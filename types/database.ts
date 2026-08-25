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
			edition_competitors: {
				Row: {
					edition_id: number | string;
					competitor_id: number | string;
					seed: number | null;
					group_conference: string | null;
					display_order: number;
					created_at: string;
				};
				Insert: {
					edition_id: number | string;
					competitor_id: number | string;
					seed?: number | null;
					group_conference?: string | null;
					display_order?: number;
					created_at?: string;
				};
				Update: {
					edition_id?: number | string;
					competitor_id?: number | string;
					seed?: number | null;
					group_conference?: string | null;
					display_order?: number;
					created_at?: string;
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
			data_providers: {
				Row: {
					slug: string;
					name: string;
					server_config_id: string | null;
					is_active: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					slug: string;
					name: string;
					server_config_id?: string | null;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					slug?: string;
					name?: string;
					server_config_id?: string | null;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
			};
			external_entity_refs: {
				Row: {
					id: number | string;
					provider_slug: string;
					entity_kind: 'competition' | 'edition' | 'competitor' | 'event';
					external_key: string;
					competition_id: number | string | null;
					edition_id: number | string | null;
					competitor_id: number | string | null;
					event_id: number | string | null;
					is_primary: boolean;
					metadata: Json;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: never;
					provider_slug: string;
					entity_kind: 'competition' | 'edition' | 'competitor' | 'event';
					external_key: string;
					competition_id?: number | string | null;
					edition_id?: number | string | null;
					competitor_id?: number | string | null;
					event_id?: number | string | null;
					is_primary?: boolean;
					metadata?: Json;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: never;
					provider_slug?: string;
					entity_kind?: 'competition' | 'edition' | 'competitor' | 'event';
					external_key?: string;
					competition_id?: number | string | null;
					edition_id?: number | string | null;
					competitor_id?: number | string | null;
					event_id?: number | string | null;
					is_primary?: boolean;
					metadata?: Json;
					created_at?: string;
					updated_at?: string;
				};
			};
			ingestion_quarantine: {
				Row: {
					id: number | string;
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
				};
				Insert: {
					id?: never;
					provider_slug: string;
					entity_kind:
						| 'competition'
						| 'edition'
						| 'competitor'
						| 'event'
						| 'result'
						| 'unknown';
					external_key?: string | null;
					reason_code: string;
					error_summary: string;
					payload_fingerprint?: string | null;
					occurrence_count?: number;
					status?: 'unresolved' | 'resolved' | 'ignored';
					first_seen_at?: string;
					last_seen_at?: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: never;
					provider_slug?: string;
					entity_kind?:
						| 'competition'
						| 'edition'
						| 'competitor'
						| 'event'
						| 'result'
						| 'unknown';
					external_key?: string | null;
					reason_code?: string;
					error_summary?: string;
					payload_fingerprint?: string | null;
					occurrence_count?: number;
					status?: 'unresolved' | 'resolved' | 'ignored';
					first_seen_at?: string;
					last_seen_at?: string;
					created_at?: string;
					updated_at?: string;
				};
			};
			scoring_rulesets: {
				Row: {
					id: number | string;
					sport_slug: string;
					market_kind: 'team_scoreline';
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
					market_kind?: 'team_scoreline';
					evaluator_key: string;
					version: number;
					max_raw_points: number;
					evaluator_config?: Json;
					ui_config?: Json;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: never;
					sport_slug?: string;
					market_kind?: 'team_scoreline';
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
					market_kind: 'team_scoreline';
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
					market_kind?: 'team_scoreline';
					payload_schema_version?: number;
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
					market_kind?: 'team_scoreline';
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
					source_kind: 'provider' | 'manual';
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
					invite_code: string;
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
					id: number | string;
					pool_id: string;
					user_id: string;
					message: string;
					created_at: string;
				};
				Insert: {
					id?: never;
					pool_id: string;
					user_id: string;
					message: string;
					created_at?: string;
				};
				Update: {
					id?: never;
					pool_id?: string;
					user_id?: string;
					message?: string;
					created_at?: string;
				};
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			get_pool_eligible_markets: {
				Args: {
					p_pool_id: string;
				};
				Returns: {
					event_market_id: number | string;
					event_id: number | string;
					market_kind: string;
					ruleset_id: number | string;
					opens_at: string;
					locks_at: string;
					status: string;
					sport_slug: string;
					competition_id: number | string;
					edition_id: number | string;
				}[];
			};
			get_pool_leaderboard: {
				Args: {
					p_pool_id: string;
				};
				Returns: {
					user_id: string;
					display_name: string | null;
					avatar_url: string | null;
					role: string;
					rank: number;
					displayed_score: number;
					raw_total: number;
					normalized_total: number;
					exact_count: number;
					submitted_count: number;
					settled_count: number;
					joined_at: string;
				}[];
			};
			get_user_score_summary: {
				Args: {
					p_user_id?: string | null;
				};
				Returns: {
					sport_slug: string | null;
					competition_id: number | string | null;
					edition_id: number | string | null;
					total_predictions: number;
					settled_predictions: number;
					exact_count: number;
					raw_total: number;
					normalized_total: number;
				}[];
			};
			create_pool: {
				Args: {
					p_name: string;
					p_invite_code: string;
					p_scope_kind: string;
					p_sport_slug?: string | null;
					p_competition_id?: number | string | null;
					p_edition_id?: number | string | null;
					p_scoring_mode?: string;
					p_is_private?: boolean;
				};
				Returns: string;
			};
			join_pool_by_invite_code: {
				Args: {
					p_invite_code: string;
				};
				Returns: string;
			};
			leave_pool: {
				Args: {
					p_pool_id: string;
				};
				Returns: boolean;
			};
			send_pool_message: {
				Args: {
					p_pool_id: string;
					p_message: string;
				};
				Returns: number | string;
			};
		};
		Enums: {
			[_ in never]: never;
		};
	};
}
