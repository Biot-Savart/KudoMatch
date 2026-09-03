export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      competition_editions: {
        Row: {
          competition_id: number
          created_at: string
          ends_at: string
          id: number
          metadata: Json
          name: string
          season_key: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          competition_id: number
          created_at?: string
          ends_at: string
          id?: never
          metadata?: Json
          name: string
          season_key: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          competition_id?: number
          created_at?: string
          ends_at?: string
          id?: never
          metadata?: Json
          name?: string
          season_key?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_editions_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_provider_settings: {
        Row: {
          allow_single_source_result_finalization: boolean
          competition_id: number
          config: Json
          created_at: string
          enabled: boolean
          fixture_authority: boolean
          fixture_priority: number | null
          history_priority: number | null
          observe_only: boolean
          provider_slug: string
          result_priority: number | null
          standings_priority: number | null
          updated_at: string
        }
        Insert: {
          allow_single_source_result_finalization?: boolean
          competition_id: number
          config?: Json
          created_at?: string
          enabled?: boolean
          fixture_authority?: boolean
          fixture_priority?: number | null
          history_priority?: number | null
          observe_only?: boolean
          provider_slug: string
          result_priority?: number | null
          standings_priority?: number | null
          updated_at?: string
        }
        Update: {
          allow_single_source_result_finalization?: boolean
          competition_id?: number
          config?: Json
          created_at?: string
          enabled?: boolean
          fixture_authority?: boolean
          fixture_priority?: number | null
          history_priority?: number | null
          observe_only?: boolean
          provider_slug?: string
          result_priority?: number | null
          standings_priority?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_provider_settings_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_provider_settings_provider_slug_fkey"
            columns: ["provider_slug"]
            isOneToOne: false
            referencedRelation: "data_providers"
            referencedColumns: ["slug"]
          },
        ]
      }
      competitions: {
        Row: {
          country: string | null
          created_at: string
          id: number
          is_active: boolean
          kind: string
          logo_url: string | null
          name: string
          slug: string
          sport_slug: string
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: never
          is_active?: boolean
          kind?: string
          logo_url?: string | null
          name: string
          slug: string
          sport_slug: string
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: never
          is_active?: boolean
          kind?: string
          logo_url?: string | null
          name?: string
          slug?: string
          sport_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_sport_slug_fkey"
            columns: ["sport_slug"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["slug"]
          },
        ]
      }
      competitors: {
        Row: {
          country_code: string | null
          created_at: string
          id: number
          is_active: boolean
          kind: string
          media_url: string | null
          name: string
          short_name: string | null
          sport_slug: string
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: never
          is_active?: boolean
          kind?: string
          media_url?: string | null
          name: string
          short_name?: string | null
          sport_slug: string
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: never
          is_active?: boolean
          kind?: string
          media_url?: string | null
          name?: string
          short_name?: string | null
          sport_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitors_sport_slug_fkey"
            columns: ["sport_slug"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["slug"]
          },
        ]
      }
      data_providers: {
        Row: {
          created_at: string
          is_active: boolean
          name: string
          server_config_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          name: string
          server_config_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          name?: string
          server_config_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      edition_competitors: {
        Row: {
          competitor_id: number
          created_at: string
          display_order: number | null
          edition_id: number
          group_conference: string | null
          seed: number | null
        }
        Insert: {
          competitor_id: number
          created_at?: string
          display_order?: number | null
          edition_id: number
          group_conference?: string | null
          seed?: number | null
        }
        Update: {
          competitor_id?: number
          created_at?: string
          display_order?: number | null
          edition_id?: number
          group_conference?: string | null
          seed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "edition_competitors_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edition_competitors_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "competition_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_competitors: {
        Row: {
          competitor_id: number
          created_at: string
          event_id: number
          role: string | null
          slot: number
        }
        Insert: {
          competitor_id: number
          created_at?: string
          event_id: number
          role?: string | null
          slot: number
        }
        Update: {
          competitor_id?: number
          created_at?: string
          event_id?: number
          role?: string | null
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_competitors_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_competitors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_data_quality: {
        Row: {
          conflict_details: Json
          created_at: string
          event_id: number
          last_verified_at: string | null
          next_verification_at: string | null
          preferred_provider_slug: string | null
          quality_status: string
          source_count: number
          updated_at: string
        }
        Insert: {
          conflict_details?: Json
          created_at?: string
          event_id: number
          last_verified_at?: string | null
          next_verification_at?: string | null
          preferred_provider_slug?: string | null
          quality_status?: string
          source_count?: number
          updated_at?: string
        }
        Update: {
          conflict_details?: Json
          created_at?: string
          event_id?: number
          last_verified_at?: string | null
          next_verification_at?: string | null
          preferred_provider_slug?: string | null
          quality_status?: string
          source_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_data_quality_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_data_quality_preferred_provider_slug_fkey"
            columns: ["preferred_provider_slug"]
            isOneToOne: false
            referencedRelation: "data_providers"
            referencedColumns: ["slug"]
          },
        ]
      }
      event_markets: {
        Row: {
          created_at: string
          event_id: number
          id: number
          is_current: boolean
          locks_at: string
          market_kind: string
          opens_at: string
          payload_schema_version: number
          ruleset_id: number
          sequence_no: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: number
          id?: never
          is_current?: boolean
          locks_at: string
          market_kind: string
          opens_at: string
          payload_schema_version?: number
          ruleset_id: number
          sequence_no?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: number
          id?: never
          is_current?: boolean
          locks_at?: string
          market_kind?: string
          opens_at?: string
          payload_schema_version?: number
          ruleset_id?: number
          sequence_no?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_markets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_markets_ruleset_id_fkey"
            columns: ["ruleset_id"]
            isOneToOne: false
            referencedRelation: "scoring_rulesets"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          edition_id: number
          id: number
          is_neutral_venue: boolean
          kind: string
          metadata: Json
          round_label: string | null
          sequence_number: number | null
          starts_at: string
          status: string
          updated_at: string
          venue_name: string | null
        }
        Insert: {
          created_at?: string
          edition_id: number
          id?: never
          is_neutral_venue?: boolean
          kind?: string
          metadata?: Json
          round_label?: string | null
          sequence_number?: number | null
          starts_at: string
          status?: string
          updated_at?: string
          venue_name?: string | null
        }
        Update: {
          created_at?: string
          edition_id?: number
          id?: never
          is_neutral_venue?: boolean
          kind?: string
          metadata?: Json
          round_label?: string | null
          sequence_number?: number | null
          starts_at?: string
          status?: string
          updated_at?: string
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "competition_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      external_entity_refs: {
        Row: {
          competition_id: number | null
          competitor_id: number | null
          created_at: string
          edition_id: number | null
          entity_kind: string
          event_id: number | null
          external_key: string
          id: number
          is_primary: boolean
          metadata: Json
          provider_slug: string
          updated_at: string
        }
        Insert: {
          competition_id?: number | null
          competitor_id?: number | null
          created_at?: string
          edition_id?: number | null
          entity_kind: string
          event_id?: number | null
          external_key: string
          id?: never
          is_primary?: boolean
          metadata?: Json
          provider_slug: string
          updated_at?: string
        }
        Update: {
          competition_id?: number | null
          competitor_id?: number | null
          created_at?: string
          edition_id?: number | null
          entity_kind?: string
          event_id?: number | null
          external_key?: string
          id?: never
          is_primary?: boolean
          metadata?: Json
          provider_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_entity_refs_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_entity_refs_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_entity_refs_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "competition_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_entity_refs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_entity_refs_provider_slug_fkey"
            columns: ["provider_slug"]
            isOneToOne: false
            referencedRelation: "data_providers"
            referencedColumns: ["slug"]
          },
        ]
      }
      ingestion_quarantine: {
        Row: {
          created_at: string
          entity_kind: string
          error_summary: string
          external_key: string | null
          first_seen_at: string
          id: number
          last_seen_at: string
          occurrence_count: number
          payload_fingerprint: string | null
          provider_slug: string
          raw_payload: Json | null
          reason_code: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_kind: string
          error_summary: string
          external_key?: string | null
          first_seen_at?: string
          id?: never
          last_seen_at?: string
          occurrence_count?: number
          payload_fingerprint?: string | null
          provider_slug: string
          raw_payload?: Json | null
          reason_code: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_kind?: string
          error_summary?: string
          external_key?: string | null
          first_seen_at?: string
          id?: never
          last_seen_at?: string
          occurrence_count?: number
          payload_fingerprint?: string | null
          provider_slug?: string
          raw_payload?: Json | null
          reason_code?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_quarantine_provider_slug_fkey"
            columns: ["provider_slug"]
            isOneToOne: false
            referencedRelation: "data_providers"
            referencedColumns: ["slug"]
          },
        ]
      }
      ingestion_run_leases: {
        Row: {
          acquired_at: string
          created_at: string
          expires_at: string
          holder_id: string
          lease_key: string
          updated_at: string
        }
        Insert: {
          acquired_at?: string
          created_at?: string
          expires_at: string
          holder_id: string
          lease_key: string
          updated_at?: string
        }
        Update: {
          acquired_at?: string
          created_at?: string
          expires_at?: string
          holder_id?: string
          lease_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      ingestion_runs: {
        Row: {
          conflict_count: number
          correlation_id: string | null
          created_at: string
          duration_ms: number
          edition_id: number | null
          error_message: string | null
          failed_count: number
          fetched_count: number
          finished_at: string | null
          id: number
          inserted_count: number
          operation: string
          provider_slug: string
          quarantined_count: number
          rate_limit_count: number
          request_count: number
          retries_count: number
          schema_error_count: number
          sport_slug: string
          started_at: string
          status: string
          summary: Json
          unchanged_count: number
          updated_at: string
          updated_count: number
        }
        Insert: {
          conflict_count?: number
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number
          edition_id?: number | null
          error_message?: string | null
          failed_count?: number
          fetched_count?: number
          finished_at?: string | null
          id?: never
          inserted_count?: number
          operation?: string
          provider_slug: string
          quarantined_count?: number
          rate_limit_count?: number
          request_count?: number
          retries_count?: number
          schema_error_count?: number
          sport_slug: string
          started_at?: string
          status: string
          summary?: Json
          unchanged_count?: number
          updated_at?: string
          updated_count?: number
        }
        Update: {
          conflict_count?: number
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number
          edition_id?: number | null
          error_message?: string | null
          failed_count?: number
          fetched_count?: number
          finished_at?: string | null
          id?: never
          inserted_count?: number
          operation?: string
          provider_slug?: string
          quarantined_count?: number
          rate_limit_count?: number
          request_count?: number
          retries_count?: number
          schema_error_count?: number
          sport_slug?: string
          started_at?: string
          status?: string
          summary?: Json
          unchanged_count?: number
          updated_at?: string
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_runs_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "competition_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_runs_provider_slug_fkey"
            columns: ["provider_slug"]
            isOneToOne: false
            referencedRelation: "data_providers"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "ingestion_runs_sport_slug_fkey"
            columns: ["sport_slug"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["slug"]
          },
        ]
      }
      market_results: {
        Row: {
          created_at: string
          event_market_id: number
          finalized_at: string | null
          result: Json
          revision: number
          source_kind: string
          source_priority: number
          source_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_market_id: number
          finalized_at?: string | null
          result: Json
          revision?: number
          source_kind: string
          source_priority?: number
          source_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_market_id?: number
          finalized_at?: string | null
          result?: Json
          revision?: number
          source_kind?: string
          source_priority?: number
          source_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_results_event_market_id_fkey"
            columns: ["event_market_id"]
            isOneToOne: true
            referencedRelation: "event_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_notifications: boolean
          kickoff_warnings: boolean
          match_results: boolean
          push_notifications: boolean
          updated_at: string
          user_id: string
          weekly_digest: boolean
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean
          kickoff_warnings?: boolean
          match_results?: boolean
          push_notifications?: boolean
          updated_at?: string
          user_id: string
          weekly_digest?: boolean
        }
        Update: {
          created_at?: string
          email_notifications?: boolean
          kickoff_warnings?: boolean
          match_results?: boolean
          push_notifications?: boolean
          updated_at?: string
          user_id?: string
          weekly_digest?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_members: {
        Row: {
          created_at: string
          id: number
          joined_at: string
          left_at: string | null
          pool_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          joined_at?: string
          left_at?: string | null
          pool_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          joined_at?: string
          left_at?: string | null
          pool_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_members_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_messages: {
        Row: {
          created_at: string
          id: number
          message: string
          pool_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          message: string
          pool_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          message?: string
          pool_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_messages_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pools: {
        Row: {
          competition_id: number | null
          created_at: string
          created_by: string
          edition_id: number | null
          id: string
          invite_code: string
          is_private: boolean
          name: string
          scope_kind: string
          scoring_mode: string
          scoring_starts_at: string
          sport_slug: string | null
          updated_at: string
        }
        Insert: {
          competition_id?: number | null
          created_at?: string
          created_by: string
          edition_id?: number | null
          id?: string
          invite_code: string
          is_private?: boolean
          name: string
          scope_kind: string
          scoring_mode: string
          scoring_starts_at?: string
          sport_slug?: string | null
          updated_at?: string
        }
        Update: {
          competition_id?: number | null
          created_at?: string
          created_by?: string
          edition_id?: number | null
          id?: string
          invite_code?: string
          is_private?: boolean
          name?: string
          scope_kind?: string
          scoring_mode?: string
          scoring_starts_at?: string
          sport_slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pools_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pools_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pools_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "competition_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pools_sport_slug_fkey"
            columns: ["sport_slug"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["slug"]
          },
        ]
      }
      predictions: {
        Row: {
          created_at: string
          event_market_id: number
          id: number
          normalized_basis_points: number | null
          raw_points: number | null
          result_revision: number | null
          ruleset_id: number | null
          selection: Json
          settled_at: string | null
          settlement_status: string
          tier_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_market_id: number
          id?: never
          normalized_basis_points?: number | null
          raw_points?: number | null
          result_revision?: number | null
          ruleset_id?: number | null
          selection: Json
          settled_at?: string | null
          settlement_status?: string
          tier_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_market_id?: number
          id?: never
          normalized_basis_points?: number | null
          raw_points?: number | null
          result_revision?: number | null
          ruleset_id?: number | null
          selection?: Json
          settled_at?: string | null
          settlement_status?: string
          tier_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_event_market_id_fkey"
            columns: ["event_market_id"]
            isOneToOne: false
            referencedRelation: "event_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_ruleset_id_fkey"
            columns: ["ruleset_id"]
            isOneToOne: false
            referencedRelation: "scoring_rulesets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_catalog_sources: {
        Row: {
          competition_id: number | null
          competitor_id: number | null
          country_code: string | null
          created_at: string
          display_name: string
          edition_id: number | null
          entity_kind: string
          external_key: string
          first_fetched_at: string
          id: number
          is_active: boolean
          last_fetched_at: string
          latest_valid_raw_payload: Json | null
          mapped_at: string | null
          mapped_by: string | null
          mapping_status: string
          media_url: string | null
          normalized_name: string
          payload_fingerprint: string | null
          provider_slug: string
          provider_updated_at: string | null
          short_name: string | null
          sport_slug: string
          updated_at: string
        }
        Insert: {
          competition_id?: number | null
          competitor_id?: number | null
          country_code?: string | null
          created_at?: string
          display_name: string
          edition_id?: number | null
          entity_kind: string
          external_key: string
          first_fetched_at?: string
          id?: never
          is_active?: boolean
          last_fetched_at?: string
          latest_valid_raw_payload?: Json | null
          mapped_at?: string | null
          mapped_by?: string | null
          mapping_status?: string
          media_url?: string | null
          normalized_name: string
          payload_fingerprint?: string | null
          provider_slug: string
          provider_updated_at?: string | null
          short_name?: string | null
          sport_slug: string
          updated_at?: string
        }
        Update: {
          competition_id?: number | null
          competitor_id?: number | null
          country_code?: string | null
          created_at?: string
          display_name?: string
          edition_id?: number | null
          entity_kind?: string
          external_key?: string
          first_fetched_at?: string
          id?: never
          is_active?: boolean
          last_fetched_at?: string
          latest_valid_raw_payload?: Json | null
          mapped_at?: string | null
          mapped_by?: string | null
          mapping_status?: string
          media_url?: string | null
          normalized_name?: string
          payload_fingerprint?: string | null
          provider_slug?: string
          provider_updated_at?: string | null
          short_name?: string | null
          sport_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_catalog_sources_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_catalog_sources_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_catalog_sources_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "competition_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_catalog_sources_provider_slug_fkey"
            columns: ["provider_slug"]
            isOneToOne: false
            referencedRelation: "data_providers"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "provider_catalog_sources_sport_slug_fkey"
            columns: ["sport_slug"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["slug"]
          },
        ]
      }
      provider_event_sources: {
        Row: {
          away_score: number | null
          created_at: string
          event_id: number | null
          first_fetched_at: string
          home_score: number | null
          id: number
          last_fetched_at: string
          latest_valid_raw_payload: Json | null
          mapping_reason: string | null
          mapping_state: string
          normalized_kickoff_at: string
          normalized_status: string
          payload_fingerprint: string | null
          provider_away_competitor_key: string | null
          provider_competition_key: string | null
          provider_edition_key: string | null
          provider_event_key: string
          provider_home_competitor_key: string | null
          provider_slug: string
          provider_updated_at: string | null
          round_name: string | null
          updated_at: string
          venue_name: string | null
        }
        Insert: {
          away_score?: number | null
          created_at?: string
          event_id?: number | null
          first_fetched_at?: string
          home_score?: number | null
          id?: never
          last_fetched_at?: string
          latest_valid_raw_payload?: Json | null
          mapping_reason?: string | null
          mapping_state?: string
          normalized_kickoff_at: string
          normalized_status: string
          payload_fingerprint?: string | null
          provider_away_competitor_key?: string | null
          provider_competition_key?: string | null
          provider_edition_key?: string | null
          provider_event_key: string
          provider_home_competitor_key?: string | null
          provider_slug: string
          provider_updated_at?: string | null
          round_name?: string | null
          updated_at?: string
          venue_name?: string | null
        }
        Update: {
          away_score?: number | null
          created_at?: string
          event_id?: number | null
          first_fetched_at?: string
          home_score?: number | null
          id?: never
          last_fetched_at?: string
          latest_valid_raw_payload?: Json | null
          mapping_reason?: string | null
          mapping_state?: string
          normalized_kickoff_at?: string
          normalized_status?: string
          payload_fingerprint?: string | null
          provider_away_competitor_key?: string | null
          provider_competition_key?: string | null
          provider_edition_key?: string | null
          provider_event_key?: string
          provider_home_competitor_key?: string | null
          provider_slug?: string
          provider_updated_at?: string | null
          round_name?: string | null
          updated_at?: string
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_event_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_event_sources_provider_slug_fkey"
            columns: ["provider_slug"]
            isOneToOne: false
            referencedRelation: "data_providers"
            referencedColumns: ["slug"]
          },
        ]
      }
      provider_mapping_audit: {
        Row: {
          actor_identity: string
          correlation_id: string | null
          created_at: string
          entity_kind: string
          external_key: string
          id: number
          new_canonical_id: number | null
          operation: string
          previous_canonical_id: number | null
          provider_catalog_source_id: number
          provider_slug: string
          reason: string
        }
        Insert: {
          actor_identity: string
          correlation_id?: string | null
          created_at?: string
          entity_kind: string
          external_key: string
          id?: never
          new_canonical_id?: number | null
          operation: string
          previous_canonical_id?: number | null
          provider_catalog_source_id: number
          provider_slug: string
          reason: string
        }
        Update: {
          actor_identity?: string
          correlation_id?: string | null
          created_at?: string
          entity_kind?: string
          external_key?: string
          id?: never
          new_canonical_id?: number | null
          operation?: string
          previous_canonical_id?: number | null
          provider_catalog_source_id?: number
          provider_slug?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_mapping_audit_provider_catalog_source_id_fkey"
            columns: ["provider_catalog_source_id"]
            isOneToOne: false
            referencedRelation: "provider_catalog_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_mapping_audit_provider_slug_fkey"
            columns: ["provider_slug"]
            isOneToOne: false
            referencedRelation: "data_providers"
            referencedColumns: ["slug"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_rule_tiers: {
        Row: {
          description: string
          example: string | null
          label: string
          rank_order: number
          raw_points: number
          ruleset_id: number
          tier_code: string
        }
        Insert: {
          description: string
          example?: string | null
          label: string
          rank_order: number
          raw_points: number
          ruleset_id: number
          tier_code: string
        }
        Update: {
          description?: string
          example?: string | null
          label?: string
          rank_order?: number
          raw_points?: number
          ruleset_id?: number
          tier_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rule_tiers_ruleset_id_fkey"
            columns: ["ruleset_id"]
            isOneToOne: false
            referencedRelation: "scoring_rulesets"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_rulesets: {
        Row: {
          created_at: string
          evaluator_config: Json
          evaluator_key: string
          id: number
          is_active: boolean
          market_kind: string
          max_raw_points: number
          sport_slug: string
          ui_config: Json
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          evaluator_config?: Json
          evaluator_key: string
          id?: never
          is_active?: boolean
          market_kind: string
          max_raw_points: number
          sport_slug: string
          ui_config?: Json
          updated_at?: string
          version: number
        }
        Update: {
          created_at?: string
          evaluator_config?: Json
          evaluator_key?: string
          id?: never
          is_active?: boolean
          market_kind?: string
          max_raw_points?: number
          sport_slug?: string
          ui_config?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rulesets_sport_slug_fkey"
            columns: ["sport_slug"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["slug"]
          },
        ]
      }
      sports: {
        Row: {
          created_at: string
          default_score_unit: string
          display_order: number
          icon_key: string | null
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_score_unit?: string
          display_order?: number
          icon_key?: string | null
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_score_unit?: string
          display_order?: number
          icon_key?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_ingestion_lease: {
        Args: {
          p_holder_id: string
          p_lease_key: string
          p_ttl_seconds?: number
        }
        Returns: boolean
      }
      apply_canonical_ingestion_batch: {
        Args: { p_batch: Json }
        Returns: Json
      }
      apply_provider_source_batch: { Args: { p_batch: Json }; Returns: Json }
      create_pool: {
        Args: {
          p_competition_id?: number
          p_edition_id?: number
          p_invite_code: string
          p_is_private?: boolean
          p_name: string
          p_scope_kind: string
          p_scoring_mode?: string
          p_sport_slug?: string
        }
        Returns: string
      }
      get_market_community_stats: {
        Args: { p_market_id: number }
        Returns: {
          avg_away_score: number
          avg_home_score: number
          away_win_pct: number
          draw_pct: number
          home_win_pct: number
          top_exact_scores: Json
          total_predictions: number
        }[]
      }
      get_pool_eligible_markets: {
        Args: { p_pool_id: string }
        Returns: {
          competition_id: number
          edition_id: number
          event_id: number
          event_market_id: number
          locks_at: string
          market_kind: string
          opens_at: string
          ruleset_id: number
          sport_slug: string
          status: string
        }[]
      }
      get_pool_leaderboard: {
        Args: { p_pool_id: string }
        Returns: {
          avatar_url: string
          exact_count: number
          full_name: string
          margin_count: number
          outcome_count: number
          predictions_count: number
          rank: number
          total_points: number
          user_id: string
        }[]
      }
      get_user_score_summary:
        | {
            Args: { p_user_id?: string }
            Returns: {
              competition_id: number
              edition_id: number
              exact_count: number
              normalized_total: number
              raw_total: number
              settled_predictions: number
              sport_slug: string
              total_predictions: number
            }[]
          }
        | {
            Args: { p_sport_slug?: string; p_user_id: string }
            Returns: {
              exact_count: number
              margin_count: number
              miss_count: number
              outcome_count: number
              settled_predictions: number
              total_normalized_points: number
              total_predictions: number
              total_raw_points: number
              win_rate: number
            }[]
          }
      join_pool_by_invite_code: {
        Args: { p_invite_code: string }
        Returns: string
      }
      leave_pool: { Args: { p_pool_id: string }; Returns: boolean }
      manage_provider_catalog_mapping: {
        Args: {
          p_actor_identity?: string
          p_canonical_id?: number
          p_operation: string
          p_reason?: string
          p_source_id: number
        }
        Returns: Json
      }
      release_ingestion_lease: {
        Args: { p_holder_id: string; p_lease_key: string }
        Returns: boolean
      }
      send_pool_message: {
        Args: { p_message: string; p_pool_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

