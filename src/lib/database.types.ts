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
      notification_outbox: {
        Row: {
          actor_id: string | null
          attempts: number
          cancelled_at: string | null
          checkin_id: string | null
          claimed_at: string | null
          couple_id: string
          created_at: string
          goal_id: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          last_error: string | null
          recipient_id: string
          send_after: string
          sent_at: string | null
        }
        Insert: {
          actor_id?: string | null
          attempts?: number
          cancelled_at?: string | null
          checkin_id?: string | null
          claimed_at?: string | null
          couple_id: string
          created_at?: string
          goal_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          last_error?: string | null
          recipient_id: string
          send_after?: string
          sent_at?: string | null
        }
        Update: {
          actor_id?: string | null
          attempts?: number
          cancelled_at?: string | null
          checkin_id?: string | null
          claimed_at?: string | null
          couple_id?: string
          created_at?: string
          goal_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          last_error?: string | null
          recipient_id?: string
          send_after?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          last_reminded_on: string | null
          muted: Database["public"]["Enums"]["notification_kind"][]
          remind_at: string
          timezone: string
          user_id: string
        }
        Insert: {
          last_reminded_on?: string | null
          muted?: Database["public"]["Enums"]["notification_kind"][]
          remind_at?: string
          timezone?: string
          user_id: string
        }
        Update: {
          last_reminded_on?: string | null
          muted?: Database["public"]["Enums"]["notification_kind"][]
          remind_at?: string
          timezone?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_ok_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_ok_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_ok_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
      is_day_key: { Args: { p: string }; Returns: boolean }
      is_week_key: { Args: { p: string }; Returns: boolean }
      join_den: {
        Args: { p_code: string; p_color: string; p_display_name: string }
        Returns: string
      }
      mint_invite_code: { Args: never; Returns: string }
      my_couple_id: { Args: never; Returns: string }
      period_horizon: {
        Args: { p: string }
        Returns: Database["public"]["Enums"]["horizon"]
      }
      period_range: { Args: { p: string }; Returns: unknown }
      save_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_timezone: string
          p_user_agent: string
        }
        Returns: undefined
      }
      week_start: { Args: { p: string }; Returns: string }
    }
    Enums: {
      horizon: "day" | "week" | "month" | "quarter" | "year"
      notification_kind:
        | "paw_shared"
        | "paw_own"
        | "milestone_done"
        | "heart"
        | "seal"
        | "goal_added"
        | "goal_archived"
        | "partner_joined"
        | "reminder"
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
      horizon: ["day", "week", "month", "quarter", "year"],
      notification_kind: [
        "paw_shared",
        "paw_own",
        "milestone_done",
        "heart",
        "seal",
        "goal_added",
        "goal_archived",
        "partner_joined",
        "reminder",
      ],
    },
  },
} as const
