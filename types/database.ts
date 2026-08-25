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
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
	};
}
