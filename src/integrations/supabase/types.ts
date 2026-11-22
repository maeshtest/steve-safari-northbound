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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_activity_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      application_documents: {
        Row: {
          application_id: string
          created_at: string
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded: boolean
        }
        Insert: {
          application_id: string
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded?: boolean
        }
        Update: {
          application_id?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          uploaded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_notes: {
        Row: {
          application_id: string
          author_email: string | null
          author_id: string
          body: string
          created_at: string
          id: string
        }
        Insert: {
          application_id: string
          author_email?: string | null
          author_id: string
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          application_id?: string
          author_email?: string | null
          author_id?: string
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applicant_token_hash: string
          county: string
          created_at: string
          email: string
          full_name: string
          id: string
          info_requested: string | null
          info_requested_at: string | null
          national_id: string
          paid_at: string | null
          payment_status: Database["public"]["Enums"]["payment_state"]
          phone: string
          public_consent: boolean
          reference: string
          stage: Database["public"]["Enums"]["member_stage"]
          terms_accepted_at: string
          terms_version: string
          updated_at: string
        }
        Insert: {
          applicant_token_hash: string
          county: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          info_requested?: string | null
          info_requested_at?: string | null
          national_id: string
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_state"]
          phone: string
          public_consent?: boolean
          reference: string
          stage?: Database["public"]["Enums"]["member_stage"]
          terms_accepted_at?: string
          terms_version: string
          updated_at?: string
        }
        Update: {
          applicant_token_hash?: string
          county?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          info_requested?: string | null
          info_requested_at?: string | null
          national_id?: string
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_state"]
          phone?: string
          public_consent?: boolean
          reference?: string
          stage?: Database["public"]["Enums"]["member_stage"]
          terms_accepted_at?: string
          terms_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          handled: boolean
          id: string
          message: string
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email: string
          handled?: boolean
          id?: string
          message: string
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          handled?: boolean
          id?: string
          message?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          application_id: string | null
          batch_id: string | null
          body: string
          category: string
          created_at: string
          error: string | null
          id: string
          provider: string | null
          provider_message_id: string | null
          sent_by: string | null
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          application_id?: string | null
          batch_id?: string | null
          body: string
          category?: string
          created_at?: string
          error?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          sent_by?: string | null
          status: string
          subject: string
          to_email: string
        }
        Update: {
          application_id?: string | null
          batch_id?: string | null
          body?: string
          category?: string
          created_at?: string
          error?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          slug: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          name: string
          slug?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          key: string
          last_test_at: string | null
          last_test_message: string | null
          last_test_ok: boolean | null
          public_config: Json
          secret_ciphertext: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          public_config?: Json
          secret_ciphertext?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          key?: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          public_config?: Json
          secret_ciphertext?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      payment_callbacks: {
        Row: {
          external_reference: string | null
          id: string
          payload: Json
          processing_result: string | null
          received_at: string
          verified: boolean
        }
        Insert: {
          external_reference?: string | null
          id?: string
          payload: Json
          processing_result?: string | null
          received_at?: string
          verified?: boolean
        }
        Update: {
          external_reference?: string | null
          id?: string
          payload?: Json
          processing_result?: string | null
          received_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          application_id: string
          checkout_request_id: string | null
          created_at: string
          external_reference: string
          id: string
          last_checked_at: string | null
          mpesa_receipt: string | null
          phone: string
          provider_reference: string | null
          result_desc: string | null
          status: Database["public"]["Enums"]["payment_txn_status"]
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          application_id: string
          checkout_request_id?: string | null
          created_at?: string
          external_reference: string
          id?: string
          last_checked_at?: string | null
          mpesa_receipt?: string | null
          phone: string
          provider_reference?: string | null
          result_desc?: string | null
          status?: Database["public"]["Enums"]["payment_txn_status"]
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          application_id?: string
          checkout_request_id?: string | null
          created_at?: string
          external_reference?: string
          id?: string
          last_checked_at?: string | null
          mpesa_receipt?: string | null
          phone?: string
          provider_reference?: string | null
          result_desc?: string | null
          status?: Database["public"]["Enums"]["payment_txn_status"]
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          must_change_password: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          must_change_password?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_hits: {
        Row: {
          hit_at: string
          id: number
          key: string
        }
        Insert: {
          hit_at?: string
          id?: number
          key: string
        }
        Update: {
          hit_at?: string
          id?: number
          key?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      status_history: {
        Row: {
          application_id: string
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          from_stage: Database["public"]["Enums"]["member_stage"] | null
          id: string
          note: string | null
          to_stage: Database["public"]["Enums"]["member_stage"]
        }
        Insert: {
          application_id: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          from_stage?: Database["public"]["Enums"]["member_stage"] | null
          id?: string
          note?: string | null
          to_stage: Database["public"]["Enums"]["member_stage"]
        }
        Update: {
          application_id?: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          from_stage?: Database["public"]["Enums"]["member_stage"] | null
          id?: string
          note?: string | null
          to_stage?: Database["public"]["Enums"]["member_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      terms_acceptances: {
        Row: {
          accepted_at: string
          application_id: string
          id: string
          policy_version: string
          user_agent: string | null
        }
        Insert: {
          accepted_at?: string
          application_id: string
          id?: string
          policy_version: string
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string
          application_id?: string
          id?: string
          policy_version?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terms_acceptances_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          consent_confirmed: boolean
          created_at: string
          featured: boolean
          id: string
          location: string | null
          name: string
          photo_url: string | null
          published: boolean
          quote: string
          role_title: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          consent_confirmed?: boolean
          created_at?: string
          featured?: boolean
          id?: string
          location?: string | null
          name: string
          photo_url?: string | null
          published?: boolean
          quote: string
          role_title?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          consent_confirmed?: boolean
          created_at?: string
          featured?: boolean
          id?: string
          location?: string | null
          name?: string
          photo_url?: string | null
          published?: boolean
          quote?: string
          role_title?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_overview: { Args: never; Returns: Json }
      change_application_stage: {
        Args: {
          _application_id: string
          _note?: string
          _to_stage: Database["public"]["Enums"]["member_stage"]
        }
        Returns: Database["public"]["Enums"]["member_stage"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hit_rate_limit: {
        Args: { _key: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      log_admin_activity: {
        Args: {
          _action: string
          _details?: Json
          _target_id: string
          _target_type: string
        }
        Returns: undefined
      }
      public_directory: {
        Args: { _list: string }
        Returns: {
          county: string
          display_name: string
          listed_since: string
        }[]
      }
      public_directory_counts: { Args: never; Returns: Json }
      public_display_name: { Args: { _full_name: string }; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "editor"
      member_stage:
        | "registered"
        | "pending_approval"
        | "approved"
        | "sponsorship_approved"
        | "waiting_for_flight"
        | "alumni"
        | "rejected"
        | "withdrawn"
      payment_state: "unpaid" | "pending" | "paid" | "failed"
      payment_txn_status:
        | "initiated"
        | "queued"
        | "success"
        | "failed"
        | "cancelled"
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
      app_role: ["super_admin", "admin", "editor"],
      member_stage: [
        "registered",
        "pending_approval",
        "approved",
        "sponsorship_approved",
        "waiting_for_flight",
        "alumni",
        "rejected",
        "withdrawn",
      ],
      payment_state: ["unpaid", "pending", "paid", "failed"],
      payment_txn_status: [
        "initiated",
        "queued",
        "success",
        "failed",
        "cancelled",
      ],
    },
  },
} as const
