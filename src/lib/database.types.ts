export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      checkins: {
        Row: {
          at: string
          couple_id: string
          day: string
          goal_id: string
          horizon: Database["public"]["Enums"]["horizon"]
          id: string
          user_id: string
        }
        Insert: {
          at?: string
          couple_id: string
          day: string
          goal_id: string
          horizon: Database["public"]["Enums"]["horizon"]
          id?: string
          user_id: string
        }
        Update: {
          at?: string
          couple_id?: string
          day?: string
          goal_id?: string
          horizon?: Database["public"]["Enums"]["horizon"]
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      couples: {
        Row: {
          anniversary: string | null
          created_at: string
          created_by: string
          id: string
          invite_code: string | null
          pup_name: string | null
        }
        Insert: {
          anniversary?: string | null
          created_at?: string
          created_by: string
          id?: string
          invite_code?: string | null
          pup_name?: string | null
        }
        Update: {
          anniversary?: string | null
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string | null
          pup_name?: string | null
        }
        Relationships: []
      }
      goal_seals: {
        Row: {
          couple_id: string
          goal_id: string
          sealed_at: string
          user_id: string
        }
        Insert: {
          couple_id: string
          goal_id: string
          sealed_at?: string
          user_id: string
        }
        Update: {
          couple_id?: string
          goal_id?: string
          sealed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_seals_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_seals_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          archived_at: string | null
          charm: string | null
          couple_id: string
          created_at: string
          created_by: string
          horizon: Database["public"]["Enums"]["horizon"]
          id: string
          owner_id: string | null
          parent_goal_id: string | null
          period: string | null
          target_units: number | null
          title: string
        }
        Insert: {
          archived_at?: string | null
          charm?: string | null
          couple_id: string
          created_at?: string
          created_by: string
          horizon: Database["public"]["Enums"]["horizon"]
          id?: string
          owner_id?: string | null
          parent_goal_id?: string | null
          period?: string | null
          target_units?: number | null
          title: string
        }
        Update: {
          archived_at?: string | null
          charm?: string | null
          couple_id?: string
          created_at?: string
          created_by?: string
          horizon?: Database["public"]["Enums"]["horizon"]
          id?: string
          owner_id?: string | null
          parent_goal_id?: string | null
          period?: string | null
          target_units?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_parent_goal_id_fkey"
            columns: ["parent_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      keepalive: {
        Row: {
          id: number
        }
        Insert: {
          id: number
        }
        Update: {
          id?: number
        }
        Relationships: []
      }
      members: {
        Row: {
          color: string
          couple_id: string
          display_name: string
          joined_at: string
          user_id: string
        }
        Insert: {
          color: string
          couple_id: string
          display_name: string
          joined_at?: string
          user_id: string
        }
        Update: {
          color?: string
          couple_id?: string
          display_name?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          checkin_id: string
          couple_id: string
          created_at: string
          kind: string
          user_id: string
        }
        Insert: {
          checkin_id: string
          couple_id: string
          created_at?: string
          kind?: string
          user_id: string
        }
        Update: {
          checkin_id?: string
          couple_id?: string
          created_at?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_den: {
        Args: { p_color: string; p_display_name: string }
        Returns: {
          couple_id: string
          invite_code: string
        }[]
      }
      fresh_share_code: { Args: never; Returns: string }
      gen_share_code: { Args: never; Returns: string }
      join_den: {
        Args: { p_code: string; p_color: string; p_display_name: string }
        Returns: string
      }
      mint_invite_code: { Args: never; Returns: string }
      my_couple_id: { Args: never; Returns: string }
      parent_horizon: {
        Args: { h: Database["public"]["Enums"]["horizon"] }
        Returns: Database["public"]["Enums"]["horizon"]
      }
      period_horizon: {
        Args: { p: string }
        Returns: Database["public"]["Enums"]["horizon"]
      }
      period_range: { Args: { p: string }; Returns: unknown }
    }
    Enums: {
      horizon: "day" | "month" | "quarter" | "year"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      horizon: ["day", "month", "quarter", "year"],
    },
  },
} as const
