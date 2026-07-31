export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      achievement_definitions: {
        Row: {
          achievement_key: string
          automation_status: string
          condition_text: string
          created_at: string
          description: string
          icon_path: string | null
          is_active: boolean
          is_manual: boolean
          is_secret: boolean
          name: string
          points: number
          rarity: string
          reward_domain: Database["public"]["Enums"]["reward_domain"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          achievement_key: string
          automation_status: string
          condition_text: string
          created_at?: string
          description: string
          icon_path?: string | null
          is_active?: boolean
          is_manual?: boolean
          is_secret?: boolean
          name: string
          points?: number
          rarity: string
          reward_domain?: Database["public"]["Enums"]["reward_domain"]
          sort_order: number
          updated_at?: string
        }
        Update: {
          achievement_key?: string
          automation_status?: string
          condition_text?: string
          created_at?: string
          description?: string
          icon_path?: string | null
          is_active?: boolean
          is_manual?: boolean
          is_secret?: boolean
          name?: string
          points?: number
          rarity?: string
          reward_domain?: Database["public"]["Enums"]["reward_domain"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      achievement_domain_dependencies: {
        Row: {
          achievement_key: string
          domain: Database["public"]["Enums"]["reward_domain"]
        }
        Insert: {
          achievement_key: string
          domain: Database["public"]["Enums"]["reward_domain"]
        }
        Update: {
          achievement_key?: string
          domain?: Database["public"]["Enums"]["reward_domain"]
        }
        Relationships: [
          {
            foreignKeyName: "achievement_domain_dependencies_achievement_key_fkey"
            columns: ["achievement_key"]
            isOneToOne: false
            referencedRelation: "achievement_definitions"
            referencedColumns: ["achievement_key"]
          },
        ]
      }
      achievement_history: {
        Row: {
          achievement_key: string
          action: Database["public"]["Enums"]["achievement_history_action"]
          created_at: string
          created_by: string | null
          id: string
          reason: string
          revision: number
          triggered_by_play_id: string | null
          user_id: string
        }
        Insert: {
          achievement_key: string
          action: Database["public"]["Enums"]["achievement_history_action"]
          created_at?: string
          created_by?: string | null
          id?: string
          reason: string
          revision: number
          triggered_by_play_id?: string | null
          user_id: string
        }
        Update: {
          achievement_key?: string
          action?: Database["public"]["Enums"]["achievement_history_action"]
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          revision?: number
          triggered_by_play_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievement_history_achievement_key_fkey"
            columns: ["achievement_key"]
            isOneToOne: false
            referencedRelation: "achievement_definitions"
            referencedColumns: ["achievement_key"]
          },
          {
            foreignKeyName: "achievement_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievement_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action_type: string
          actor_user_id: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          actor_user_id: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_content: {
        Row: {
          content_key: string
          created_at: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          content_key: string
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          content_key?: string
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_content_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_members: {
        Row: {
          is_active: boolean
          joined_at: string
          role: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Insert: {
          is_active?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Update: {
          is_active?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["membership_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_definitions: {
        Row: {
          class_key: string
          created_at: string
          description: string
          icon_path: string | null
          is_active: boolean
          name: string
          playstyle: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          class_key: string
          created_at?: string
          description: string
          icon_path?: string | null
          is_active?: boolean
          name: string
          playstyle: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          class_key?: string
          created_at?: string
          description?: string
          icon_path?: string | null
          is_active?: boolean
          name?: string
          playstyle?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      class_requirements: {
        Row: {
          achievement_key: string
          class_key: string
        }
        Insert: {
          achievement_key: string
          class_key: string
        }
        Update: {
          achievement_key?: string
          class_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_requirements_achievement_key_fkey"
            columns: ["achievement_key"]
            isOneToOne: false
            referencedRelation: "achievement_definitions"
            referencedColumns: ["achievement_key"]
          },
          {
            foreignKeyName: "class_requirements_class_key_fkey"
            columns: ["class_key"]
            isOneToOne: false
            referencedRelation: "class_definitions"
            referencedColumns: ["class_key"]
          },
        ]
      }
      feedback_submissions: {
        Row: {
          admin_note: string | null
          author_id: string
          content: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["feedback_status"]
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          author_id?: string
          content: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["feedback_status"]
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["feedback_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_submissions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_expansions: {
        Row: {
          created_at: string
          game_id: string
          id: string
          is_owned: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          is_owned?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          is_owned?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_expansions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          archived_at: string | null
          bgg_rank: number | null
          bgg_url: string | null
          bgg_weight: number | null
          categories: string[]
          cover_url: string | null
          created_at: string
          current_holder_id: string | null
          description: string | null
          designer: string | null
          game_type: string | null
          id: string
          max_players: number | null
          mechanics: string[]
          min_age: number | null
          min_players: number | null
          owner_id: string
          play_time_minutes: number | null
          publisher: string | null
          release_year: number | null
          status: Database["public"]["Enums"]["game_status"]
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          bgg_rank?: number | null
          bgg_url?: string | null
          bgg_weight?: number | null
          categories?: string[]
          cover_url?: string | null
          created_at?: string
          current_holder_id?: string | null
          description?: string | null
          designer?: string | null
          game_type?: string | null
          id?: string
          max_players?: number | null
          mechanics?: string[]
          min_age?: number | null
          min_players?: number | null
          owner_id: string
          play_time_minutes?: number | null
          publisher?: string | null
          release_year?: number | null
          status?: Database["public"]["Enums"]["game_status"]
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          bgg_rank?: number | null
          bgg_url?: string | null
          bgg_weight?: number | null
          categories?: string[]
          cover_url?: string | null
          created_at?: string
          current_holder_id?: string | null
          description?: string | null
          designer?: string | null
          game_type?: string | null
          id?: string
          max_players?: number | null
          mechanics?: string[]
          min_age?: number | null
          min_players?: number | null
          owner_id?: string
          play_time_minutes?: number | null
          publisher?: string | null
          release_year?: number | null
          status?: Database["public"]["Enums"]["game_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_current_holder_id_fkey"
            columns: ["current_holder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_availability: {
        Row: {
          is_available: boolean
          meeting_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          is_available: boolean
          meeting_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          is_available?: boolean
          meeting_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_availability_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_game_proposals: {
        Row: {
          created_at: string
          game_id: string
          meeting_id: string
          proposed_by: string
        }
        Insert: {
          created_at?: string
          game_id: string
          meeting_id: string
          proposed_by: string
        }
        Update: {
          created_at?: string
          game_id?: string
          meeting_id?: string
          proposed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_game_proposals_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_game_proposals_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_game_proposals_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_game_responses: {
        Row: {
          created_at: string
          game_id: string
          meeting_id: string
          user_id: string
          wants_to_play: boolean
        }
        Insert: {
          created_at?: string
          game_id: string
          meeting_id: string
          user_id: string
          wants_to_play: boolean
        }
        Update: {
          created_at?: string
          game_id?: string
          meeting_id?: string
          user_id?: string
          wants_to_play?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "meeting_game_responses_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_game_responses_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_game_responses_proposal_fkey"
            columns: ["meeting_id", "game_id"]
            isOneToOne: false
            referencedRelation: "meeting_game_proposals"
            referencedColumns: ["meeting_id", "game_id"]
          },
          {
            foreignKeyName: "meeting_game_responses_proposal_fkey"
            columns: ["meeting_id", "game_id"]
            isOneToOne: false
            referencedRelation: "meeting_game_rankings"
            referencedColumns: ["meeting_id", "game_id"]
          },
          {
            foreignKeyName: "meeting_game_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          description: string | null
          ends_at: string
          id: string
          location: string | null
          starts_at: string
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          description?: string | null
          ends_at: string
          id?: string
          location?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          location?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      play_participants: {
        Row: {
          is_winner: boolean
          placement: number | null
          play_id: string
          score: number | null
          user_id: string
        }
        Insert: {
          is_winner?: boolean
          placement?: number | null
          play_id: string
          score?: number | null
          user_id: string
        }
        Update: {
          is_winner?: boolean
          placement?: number | null
          play_id?: string
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_participants_play_id_fkey"
            columns: ["play_id"]
            isOneToOne: false
            referencedRelation: "plays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "play_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      play_photos: {
        Row: {
          byte_size: number
          created_at: string
          created_by: string
          height: number
          id: string
          play_id: string
          position: number
          storage_path: string
          width: number
        }
        Insert: {
          byte_size: number
          created_at?: string
          created_by: string
          height: number
          id?: string
          play_id: string
          position: number
          storage_path: string
          width: number
        }
        Update: {
          byte_size?: number
          created_at?: string
          created_by?: string
          height?: number
          id?: string
          play_id?: string
          position?: number
          storage_path?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "play_photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "play_photos_play_id_fkey"
            columns: ["play_id"]
            isOneToOne: false
            referencedRelation: "plays"
            referencedColumns: ["id"]
          },
        ]
      }
      play_reward_states: {
        Row: {
          created_at: string
          is_active: boolean
          last_play_id: string | null
          revision: number
          reward_key: string
          reward_type: Database["public"]["Enums"]["reward_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_active: boolean
          last_play_id?: string | null
          revision?: number
          reward_key: string
          reward_type: Database["public"]["Enums"]["reward_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          last_play_id?: string | null
          revision?: number
          reward_key?: string
          reward_type?: Database["public"]["Enums"]["reward_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_reward_states_last_play_id_fkey"
            columns: ["last_play_id"]
            isOneToOne: false
            referencedRelation: "plays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "play_reward_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plays: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string
          duration_minutes: number | null
          game_id: string
          id: string
          meeting_id: string | null
          mode: Database["public"]["Enums"]["play_mode"]
          played_at: string
          rewards_managed: boolean
          state_note: string | null
          status: Database["public"]["Enums"]["play_status"]
          team_result: Database["public"]["Enums"]["play_team_result"] | null
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by: string
          duration_minutes?: number | null
          game_id: string
          id?: string
          meeting_id?: string | null
          mode?: Database["public"]["Enums"]["play_mode"]
          played_at: string
          rewards_managed?: boolean
          state_note?: string | null
          status?: Database["public"]["Enums"]["play_status"]
          team_result?: Database["public"]["Enums"]["play_team_result"] | null
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string
          duration_minutes?: number | null
          game_id?: string
          id?: string
          meeting_id?: string | null
          mode?: Database["public"]["Enums"]["play_mode"]
          played_at?: string
          rewards_managed?: boolean
          state_note?: string | null
          status?: Database["public"]["Enums"]["play_status"]
          team_result?: Database["public"]["Enums"]["play_team_result"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plays_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plays_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      point_events: {
        Row: {
          action_type: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          points: number
          related_entity_id: string | null
          related_entity_type: string | null
          reward_revision: number
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          points: number
          related_entity_id?: string | null
          related_entity_type?: string | null
          reward_revision?: number
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          points?: number
          related_entity_id?: string | null
          related_entity_type?: string | null
          reward_revision?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_class_key: string | null
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          active_class_key?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name: string
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          active_class_key?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_class_key_fkey"
            columns: ["active_class_key"]
            isOneToOne: false
            referencedRelation: "class_definitions"
            referencedColumns: ["class_key"]
          },
        ]
      }
      push_campaigns: {
        Row: {
          action_url: string | null
          body: string
          created_at: string
          created_by: string | null
          dedupe_key: string
          id: string
          kind: Database["public"]["Enums"]["push_campaign_kind"]
          source_entity_id: string | null
          source_entity_type: string | null
          template_key: string | null
          title: string
        }
        Insert: {
          action_url?: string | null
          body: string
          created_at?: string
          created_by?: string | null
          dedupe_key: string
          id?: string
          kind: Database["public"]["Enums"]["push_campaign_kind"]
          source_entity_id?: string | null
          source_entity_type?: string | null
          template_key?: string | null
          title: string
        }
        Update: {
          action_url?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          dedupe_key?: string
          id?: string
          kind?: Database["public"]["Enums"]["push_campaign_kind"]
          source_entity_id?: string | null
          source_entity_type?: string | null
          template_key?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_deliveries: {
        Row: {
          attempt_count: number
          campaign_id: string
          claimed_at: string | null
          created_at: string
          failed_at: string | null
          id: string
          last_error_code: string | null
          next_attempt_at: string
          recipient_user_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["push_delivery_status"]
          subscription_id: string
        }
        Insert: {
          attempt_count?: number
          campaign_id: string
          claimed_at?: string | null
          created_at?: string
          failed_at?: string | null
          id?: string
          last_error_code?: string | null
          next_attempt_at?: string
          recipient_user_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["push_delivery_status"]
          subscription_id: string
        }
        Update: {
          attempt_count?: number
          campaign_id?: string
          claimed_at?: string | null
          created_at?: string
          failed_at?: string | null
          id?: string
          last_error_code?: string | null
          next_attempt_at?: string
          recipient_user_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["push_delivery_status"]
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_deliveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "push_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_deliveries_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          disabled_at: string | null
          endpoint: string
          failure_count: number
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          disabled_at?: string | null
          endpoint: string
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          disabled_at?: string | null
          endpoint?: string
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
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
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          game_id: string
          id: string
          overall: number
          replayability: number
          theme: number
          updated_at: string
          user_id: string
          wants_to_play_again: boolean
        }
        Insert: {
          comment?: string | null
          created_at?: string
          game_id: string
          id?: string
          overall: number
          replayability: number
          theme: number
          updated_at?: string
          user_id: string
          wants_to_play_again: boolean
        }
        Update: {
          comment?: string | null
          created_at?: string
          game_id?: string
          id?: string
          overall?: number
          replayability?: number
          theme?: number
          updated_at?: string
          user_id?: string
          wants_to_play_again?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_key: string
          awarded_at: string
          awarded_by: string | null
          note: string | null
          source_entity_id: string | null
          source_event_type: string | null
          user_id: string
        }
        Insert: {
          achievement_key: string
          awarded_at?: string
          awarded_by?: string | null
          note?: string | null
          source_entity_id?: string | null
          source_event_type?: string | null
          user_id: string
        }
        Update: {
          achievement_key?: string
          awarded_at?: string
          awarded_by?: string | null
          note?: string | null
          source_entity_id?: string | null
          source_event_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_key_fkey"
            columns: ["achievement_key"]
            isOneToOne: false
            referencedRelation: "achievement_definitions"
            referencedColumns: ["achievement_key"]
          },
          {
            foreignKeyName: "user_achievements_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      game_rating_summaries: {
        Row: {
          average_overall: number | null
          average_replayability: number | null
          average_theme: number | null
          game_id: string | null
          ratings_count: number | null
          wants_to_play_again_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_game_rankings: {
        Row: {
          game_id: string | null
          meeting_id: string | null
          no_count: number | null
          yes_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_game_proposals_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_game_proposals_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_point_balances: {
        Row: {
          total_points: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_change_role: {
        Args: {
          p_new_role: Database["public"]["Enums"]["membership_role"]
          p_reason?: string
          p_target_user_id: string
        }
        Returns: undefined
      }
      admin_create_push_campaign: {
        Args: {
          p_action_url?: string
          p_body: string
          p_idempotency_key: string
          p_recipient_user_ids?: string[]
          p_template_key?: string
          p_title: string
        }
        Returns: {
          campaign_id: string
          subscription_count: number
          user_count: number
        }[]
      }
      admin_deactivate_and_anonymize_account: {
        Args: { p_reason?: string; p_target_user_id: string }
        Returns: undefined
      }
      admin_list_accounts: {
        Args: {
          p_role_filter?: Database["public"]["Enums"]["membership_role"]
          p_search?: string
        }
        Returns: {
          created_at: string
          display_name: string
          email: string
          is_active: boolean
          last_sign_in_at: string
          role: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }[]
      }
      admin_list_feedback_submissions: {
        Args: {
          p_status_filter?: Database["public"]["Enums"]["feedback_status"]
        }
        Returns: {
          admin_note: string
          author_display_name: string
          content: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["feedback_status"]
        }[]
      }
      admin_list_push_audience: {
        Args: never
        Returns: {
          active_subscription_count: number
          display_name: string
          role: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }[]
      }
      admin_list_push_campaigns: {
        Args: { p_limit?: number }
        Returns: {
          action_url: string
          body: string
          created_at: string
          created_by_name: string
          device_count: number
          failed_count: number
          id: string
          kind: Database["public"]["Enums"]["push_campaign_kind"]
          queued_count: number
          recipient_user_count: number
          sent_count: number
          skipped_count: number
          template_key: string
          title: string
        }[]
      }
      admin_provision_existing_user: {
        Args: {
          p_role?: Database["public"]["Enums"]["membership_role"]
          p_target_user_id: string
        }
        Returns: undefined
      }
      admin_push_audience_summary: {
        Args: { p_recipient_user_ids?: string[] }
        Returns: {
          subscription_count: number
          user_count: number
          users_without_subscription: number
        }[]
      }
      admin_reschedule_pending_push_deliveries: { Args: never; Returns: number }
      admin_update_feedback_submission: {
        Args: {
          p_admin_note: string
          p_id: string
          p_status: Database["public"]["Enums"]["feedback_status"]
        }
        Returns: undefined
      }
      award_current_user_simple_achievements: {
        Args: never
        Returns: {
          awarded_count: number
          awarded_keys: string[]
          points_awarded: number
        }[]
      }
      award_meeting_achievements: {
        Args: { p_play_id: string }
        Returns: {
          awarded_count: number
          awarded_keys: string[]
          points_awarded: number
        }[]
      }
      award_meeting_created_points: {
        Args: { p_meeting_id: string }
        Returns: {
          awarded: boolean
          point_event_id: string
          points: number
        }[]
      }
      award_meeting_rsvp_points: {
        Args: { p_meeting_id: string }
        Returns: {
          awarded: boolean
          point_event_id: string
          points: number
        }[]
      }
      award_meeting_vote_points: {
        Args: { p_meeting_id: string }
        Returns: {
          awarded: boolean
          point_event_id: string
          points: number
        }[]
      }
      award_play_logged_points: {
        Args: { p_play_id: string }
        Returns: {
          awarded: boolean
          point_event_id: string
          points: number
        }[]
      }
      award_play_result_achievements: {
        Args: { p_play_id: string }
        Returns: {
          awarded_count: number
          awarded_user_ids: string[]
          points_awarded: number
        }[]
      }
      award_rating_created_points: {
        Args: { p_game_id: string }
        Returns: {
          awarded: boolean
          point_event_id: string
          points: number
        }[]
      }
      award_shelf_onboarding_points: {
        Args: never
        Returns: {
          awarded_count: number
          awarded_points: number
        }[]
      }
      claim_push_deliveries: {
        Args: { p_limit?: number }
        Returns: {
          action_url: string
          attempt_count: number
          auth_secret: string
          body: string
          delivery_id: string
          endpoint: string
          p256dh: string
          subscription_id: string
          title: string
        }[]
      }
      complete_push_delivery: {
        Args: {
          p_delivery_id: string
          p_error_code?: string
          p_outcome: string
        }
        Returns: undefined
      }
      create_game_with_expansions: {
        Args: {
          p_archived_at?: string
          p_bgg_rank: number
          p_bgg_url: string
          p_bgg_weight: number
          p_categories: string[]
          p_cover_url: string
          p_current_holder_id: string
          p_description: string
          p_designer: string
          p_expansions?: Json
          p_game_type: string
          p_max_players: number
          p_mechanics: string[]
          p_min_age: number
          p_min_players: number
          p_owner_id: string
          p_play_time_minutes: number
          p_publisher: string
          p_release_year: number
          p_status: Database["public"]["Enums"]["game_status"]
          p_title: string
        }
        Returns: string
      }
      create_play_with_participants: {
        Args: {
          p_comment?: string
          p_duration_minutes?: number
          p_game_id: string
          p_meeting_id?: string
          p_mode?: Database["public"]["Enums"]["play_mode"]
          p_participants?: Json
          p_played_at: string
          p_state_note?: string
          p_status?: Database["public"]["Enums"]["play_status"]
          p_team_result?: Database["public"]["Enums"]["play_team_result"]
        }
        Returns: string
      }
      current_user_is_admin: { Args: never; Returns: boolean }
      delete_meeting: { Args: { p_meeting_id: string }; Returns: boolean }
      delete_play: { Args: { p_play_id: string }; Returns: string }
      disable_push_subscription: {
        Args: { p_endpoint: string }
        Returns: boolean
      }
      get_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          rank: number
          total_points: number
          user_id: string
        }[]
      }
      get_own_membership_status: {
        Args: never
        Returns: {
          is_active: boolean
          role: Database["public"]["Enums"]["membership_role"]
        }[]
      }
      get_own_push_subscription: {
        Args: { p_endpoint: string }
        Returns: {
          is_enabled: boolean
          subscription_id: string
        }[]
      }
      get_play_profiles: {
        Args: { p_user_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
        }[]
      }
      propose_meeting_game: {
        Args: { p_game_id: string; p_meeting_id: string }
        Returns: {
          awarded: boolean
          point_event_id: string
          points: number
        }[]
      }
      reorder_play_photos: {
        Args: { p_photo_ids: string[]; p_play_id: string }
        Returns: undefined
      }
      save_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: string
      }
      set_active_class: { Args: { p_class_key: string }; Returns: string }
      set_meeting_game_response: {
        Args: {
          p_game_id: string
          p_meeting_id: string
          p_wants_to_play: boolean
        }
        Returns: {
          awarded: boolean
          point_event_id: string
          points: number
        }[]
      }
      update_game_with_expansions: {
        Args: {
          p_bgg_rank: number
          p_bgg_url: string
          p_bgg_weight: number
          p_categories: string[]
          p_cover_url: string
          p_current_holder_id: string
          p_description: string
          p_designer: string
          p_expansions?: Json
          p_game_id: string
          p_game_type: string
          p_max_players: number
          p_mechanics: string[]
          p_min_age: number
          p_min_players: number
          p_owner_id: string
          p_play_time_minutes: number
          p_publisher: string
          p_release_year: number
          p_status: Database["public"]["Enums"]["game_status"]
          p_title: string
        }
        Returns: string
      }
      update_play_with_participants: {
        Args: {
          p_comment?: string
          p_duration_minutes?: number
          p_game_id: string
          p_meeting_id?: string
          p_mode?: Database["public"]["Enums"]["play_mode"]
          p_participants?: Json
          p_play_id: string
          p_played_at: string
          p_state_note?: string
          p_status?: Database["public"]["Enums"]["play_status"]
          p_team_result?: Database["public"]["Enums"]["play_team_result"]
        }
        Returns: string
      }
    }
    Enums: {
      achievement_history_action: "granted" | "revoked" | "regranted"
      feedback_status: "new" | "in_progress" | "completed" | "rejected"
      game_status: "available" | "unavailable" | "loaned"
      meeting_status: "planned" | "confirmed" | "completed"
      membership_role: "member" | "admin" | "observer"
      play_mode: "competitive" | "cooperative"
      play_status: "in_progress" | "completed"
      play_team_result: "win" | "loss"
      push_campaign_kind: "meeting_created" | "admin_manual"
      push_delivery_status:
        | "queued"
        | "processing"
        | "sent"
        | "failed"
        | "skipped"
      reward_domain:
        | "play"
        | "meeting"
        | "collection"
        | "rating"
        | "manual"
        | "other"
      reward_type: "play_points" | "achievement"
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
  public: {
    Enums: {
      achievement_history_action: ["granted", "revoked", "regranted"],
      feedback_status: ["new", "in_progress", "completed", "rejected"],
      game_status: ["available", "unavailable", "loaned"],
      meeting_status: ["planned", "confirmed", "completed"],
      membership_role: ["member", "admin", "observer"],
      play_mode: ["competitive", "cooperative"],
      play_status: ["in_progress", "completed"],
      play_team_result: ["win", "loss"],
      push_campaign_kind: ["meeting_created", "admin_manual"],
      push_delivery_status: [
        "queued",
        "processing",
        "sent",
        "failed",
        "skipped",
      ],
      reward_domain: [
        "play",
        "meeting",
        "collection",
        "rating",
        "manual",
        "other",
      ],
      reward_type: ["play_points", "achievement"],
    },
  },
} as const

