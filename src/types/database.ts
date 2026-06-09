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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_kind: Database["public"]["Enums"]["account_kind"] | null
          created_at: string
          id: number
          metadata: Json
          org_id: string | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_kind?: Database["public"]["Enums"]["account_kind"] | null
          created_at?: string
          id?: never
          metadata?: Json
          org_id?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_kind?: Database["public"]["Enums"]["account_kind"] | null
          created_at?: string
          id?: never
          metadata?: Json
          org_id?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          batch_id: string | null
          body: string | null
          created_at: string
          id: number
          kind: string | null
          metadata: Json
          org_id: string | null
          recipient_email: string
          recipient_id: string | null
          sender_id: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string
        }
        Insert: {
          batch_id?: string | null
          body?: string | null
          created_at?: string
          id?: never
          kind?: string | null
          metadata?: Json
          org_id?: string | null
          recipient_email: string
          recipient_id?: string | null
          sender_id?: string | null
          session_id?: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string
        }
        Update: {
          batch_id?: string | null
          body?: string | null
          created_at?: string
          id?: never
          kind?: string | null
          metadata?: Json
          org_id?: string | null
          recipient_email?: string
          recipient_id?: string | null
          sender_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      help_requests: {
        Row: {
          created_at: string
          description: string
          id: string
          org_id: string
          profile_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["help_status"]
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          org_id: string
          profile_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["help_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          org_id?: string
          profile_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["help_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Relationships: [
          {
            foreignKeyName: "help_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subjects: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          grade_level: number | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          grade_level?: number | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          grade_level?: number | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_subjects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          created_at: string
          email: string
          first_name: string
          grade: number | null
          id: string
          kind: Database["public"]["Enums"]["account_kind"]
          last_name: string
          org_id: string | null
          pronouns: string | null
          status: Database["public"]["Enums"]["account_status"]
          status_note: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string
          email: string
          first_name: string
          grade?: number | null
          id: string
          kind: Database["public"]["Enums"]["account_kind"]
          last_name: string
          org_id?: string | null
          pronouns?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          status_note?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string
          email?: string
          first_name?: string
          grade?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["account_kind"]
          last_name?: string
          org_id?: string | null
          pronouns?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          status_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          availability: Json | null
          awarded_hours: number | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_reason: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          language: string | null
          location: string | null
          location_preference: Database["public"]["Enums"]["location_preference"]
          notes: string
          org_id: string
          org_subject_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          recording_url: string | null
          requester_id: string
          scheduled_at: string | null
          status: Database["public"]["Enums"]["session_status"]
          tutor_id: string | null
          updated_at: string
          verification_note: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          availability?: Json | null
          awarded_hours?: number | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          language?: string | null
          location?: string | null
          location_preference: Database["public"]["Enums"]["location_preference"]
          notes: string
          org_id: string
          org_subject_id: string
          priority?: Database["public"]["Enums"]["priority_level"]
          recording_url?: string | null
          requester_id: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          tutor_id?: string | null
          updated_at?: string
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          availability?: Json | null
          awarded_hours?: number | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          language?: string | null
          location?: string | null
          location_preference?: Database["public"]["Enums"]["location_preference"]
          notes?: string
          org_id?: string
          org_subject_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          recording_url?: string | null
          requester_id?: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          tutor_id?: string | null
          updated_at?: string
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_requester_fk"
            columns: ["requester_id", "org_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "sessions_subject_fk"
            columns: ["org_subject_id", "org_id"]
            isOneToOne: false
            referencedRelation: "org_subjects"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "sessions_tutor_fk"
            columns: ["tutor_id", "org_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "sessions_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_approvals: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          direct_grant: boolean
          evidence: string | null
          id: string
          org_id: string
          org_subject_id: string
          profile_id: string
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          direct_grant?: boolean
          evidence?: string | null
          id?: string
          org_id: string
          org_subject_id: string
          profile_id: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          direct_grant?: boolean
          evidence?: string | null
          id?: string
          org_id?: string
          org_subject_id?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_approvals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_approvals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_approvals_profile_fk"
            columns: ["profile_id", "org_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "subject_approvals_subject_fk"
            columns: ["org_subject_id", "org_id"]
            isOneToOne: false
            referencedRelation: "org_subjects"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      subject_templates: {
        Row: {
          category: string | null
          created_at: string
          grade_level: number | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          grade_level?: number | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          grade_level?: number | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      volunteer_hours_ledger: {
        Row: {
          awarded_by: string | null
          created_at: string
          hours: number
          id: number
          kind: Database["public"]["Enums"]["ledger_kind"]
          note: string | null
          org_id: string
          profile_id: string
          session_id: string | null
        }
        Insert: {
          awarded_by?: string | null
          created_at?: string
          hours: number
          id?: never
          kind: Database["public"]["Enums"]["ledger_kind"]
          note?: string | null
          org_id: string
          profile_id: string
          session_id?: string | null
        }
        Update: {
          awarded_by?: string | null
          created_at?: string
          hours?: number
          id?: never
          kind?: Database["public"]["Enums"]["ledger_kind"]
          note?: string | null
          org_id?: string
          profile_id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_hours_ledger_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_hours_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_hours_ledger_profile_fk"
            columns: ["profile_id", "org_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "volunteer_hours_ledger_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization: {
        Args: { p_name: string; p_slug: string }
        Returns: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
    }
    Enums: {
      account_kind: "member" | "manager" | "admin"
      account_status: "pending" | "active" | "suspended" | "rejected"
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "withdrawn"
        | "revoked"
      email_status: "sent" | "failed"
      help_status: "open" | "resolved"
      ledger_kind: "award" | "adjustment"
      location_preference: "online" | "in_person"
      priority_level: "low" | "normal" | "high"
      session_status:
        | "open"
        | "claimed"
        | "availability_set"
        | "scheduled"
        | "completed"
        | "needs_changes"
        | "verified"
        | "cancelled"
      urgency_level: "low" | "normal" | "high"
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
      account_kind: ["member", "manager", "admin"],
      account_status: ["pending", "active", "suspended", "rejected"],
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "withdrawn",
        "revoked",
      ],
      email_status: ["sent", "failed"],
      help_status: ["open", "resolved"],
      ledger_kind: ["award", "adjustment"],
      location_preference: ["online", "in_person"],
      priority_level: ["low", "normal", "high"],
      session_status: [
        "open",
        "claimed",
        "availability_set",
        "scheduled",
        "completed",
        "needs_changes",
        "verified",
        "cancelled",
      ],
      urgency_level: ["low", "normal", "high"],
    },
  },
} as const
