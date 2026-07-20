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
      meeting_game_votes: {
        Row: {
          created_at: string
          game_id: string
          meeting_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          meeting_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          meeting_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_game_votes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_game_votes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_game_votes_user_id_fkey"
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
      plays: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string
          duration_minutes: number | null
          game_id: string
          id: string
          meeting_id: string | null
          played_at: string
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
          played_at: string
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
          played_at?: string
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
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
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
          votes_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_game_votes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_game_votes_meeting_id_fkey"
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
          p_participants?: Json
          p_played_at: string
        }
        Returns: string
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
      get_play_profiles: {
        Args: { p_user_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
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
          p_participants?: Json
          p_play_id: string
          p_played_at: string
        }
        Returns: string
      }
    }
    Enums: {
      game_status: "available" | "unavailable" | "loaned"
      meeting_status: "planned" | "confirmed" | "completed"
      membership_role: "member" | "admin"
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
      game_status: ["available", "unavailable", "loaned"],
      meeting_status: ["planned", "confirmed", "completed"],
      membership_role: ["member", "admin"],
    },
  },
} as const

