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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      chat_usage: {
        Row: {
          conversations_this_upload: number
          created_at: string
          current_upload_id: string | null
          id: string
          questions_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          conversations_this_upload?: number
          created_at?: string
          current_upload_id?: string | null
          id?: string
          questions_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          conversations_this_upload?: number
          created_at?: string
          current_upload_id?: string | null
          id?: string
          questions_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          created_at: string
          credits_total: number
          credits_used: number
          expires_at: string
          id: string
          plan_name: string
          purchased_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_total: number
          credits_used?: number
          expires_at: string
          id?: string
          plan_name: string
          purchased_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_total?: number
          credits_used?: number
          expires_at?: string
          id?: string
          plan_name?: string
          purchased_at?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_otps: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          otp_code: string
          used: boolean
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          otp_code: string
          used?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp_code?: string
          used?: boolean
        }
        Relationships: []
      }
      password_reset_rate_limits: {
        Row: {
          email: string
          id: string
          requested_at: string
        }
        Insert: {
          email: string
          id?: string
          requested_at?: string
        }
        Update: {
          email?: string
          id?: string
          requested_at?: string
        }
        Relationships: []
      }
      scan_history: {
        Row: {
          analysis_text: string
          created_at: string
          id: string
          image_url: string
          outfit_category: string | null
          style_score: number | null
          thumbnail_url: string | null
          user_id: string
        }
        Insert: {
          analysis_text: string
          created_at?: string
          id?: string
          image_url: string
          outfit_category?: string | null
          style_score?: number | null
          thumbnail_url?: string | null
          user_id: string
        }
        Update: {
          analysis_text?: string
          created_at?: string
          id?: string
          image_url?: string
          outfit_category?: string | null
          style_score?: number | null
          thumbnail_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      upload_rate_limits: {
        Row: {
          id: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          id?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          id?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          conversations_per_upload: number
          cooldown_until: string | null
          created_at: string
          credits_expire_at: string | null
          credits_purchased_at: string | null
          credits_total: number
          credits_used: number
          display_name: string | null
          free_chats_used: number
          free_compare_attempts_used: number
          free_scans_used: number
          id: string
          paid_chat_credits: number
          paid_scan_credits: number
          plan_type: Database["public"]["Enums"]["plan_type"]
          save_scan_history: boolean
          terms_accepted: boolean
          terms_accepted_timestamp: string | null
          updated_at: string
          uploads_limit: number
          uploads_used: number
          user_id: string
        }
        Insert: {
          conversations_per_upload?: number
          cooldown_until?: string | null
          created_at?: string
          credits_expire_at?: string | null
          credits_purchased_at?: string | null
          credits_total?: number
          credits_used?: number
          display_name?: string | null
          free_chats_used?: number
          free_compare_attempts_used?: number
          free_scans_used?: number
          id?: string
          paid_chat_credits?: number
          paid_scan_credits?: number
          plan_type?: Database["public"]["Enums"]["plan_type"]
          save_scan_history?: boolean
          terms_accepted?: boolean
          terms_accepted_timestamp?: string | null
          updated_at?: string
          uploads_limit?: number
          uploads_used?: number
          user_id: string
        }
        Update: {
          conversations_per_upload?: number
          cooldown_until?: string | null
          created_at?: string
          credits_expire_at?: string | null
          credits_purchased_at?: string | null
          credits_total?: number
          credits_used?: number
          display_name?: string | null
          free_chats_used?: number
          free_compare_attempts_used?: number
          free_scans_used?: number
          id?: string
          paid_chat_credits?: number
          paid_scan_credits?: number
          plan_type?: Database["public"]["Enums"]["plan_type"]
          save_scan_history?: boolean
          terms_accepted?: boolean
          terms_accepted_timestamp?: string | null
          updated_at?: string
          uploads_limit?: number
          uploads_used?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_password_reset_data: { Args: never; Returns: undefined }
    }
    Enums: {
      plan_type: "free" | "basic" | "yearly"
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
      plan_type: ["free", "basic", "yearly"],
    },
  },
} as const
