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
      admins: {
        Row: {
          auth_id: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          role: string
          school_id: string | null
          updated_at: string
        }
        Insert: {
          auth_id: string
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          role?: string
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          auth_id?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          role?: string
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admins_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      awaiting_verification_jobs: {
        Row: {
          created_at: string
          desired_duration_minutes: number | null
          duration_minutes: number | null
          id: string
          language: string | null
          location: string | null
          opportunity_id: string | null
          opportunity_snapshot: Json | null
          scheduled_time: string | null
          status: string
          subject_grade: string
          subject_name: string
          subject_type: string
          tutee_availability: Json | null
          tutee_id: string
          tutee_name: string | null
          tutor_id: string
          tutor_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          desired_duration_minutes?: number | null
          duration_minutes?: number | null
          id: string
          language?: string | null
          location?: string | null
          opportunity_id?: string | null
          opportunity_snapshot?: Json | null
          scheduled_time?: string | null
          status?: string
          subject_grade: string
          subject_name: string
          subject_type: string
          tutee_availability?: Json | null
          tutee_id: string
          tutee_name?: string | null
          tutor_id: string
          tutor_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          desired_duration_minutes?: number | null
          duration_minutes?: number | null
          id?: string
          language?: string | null
          location?: string | null
          opportunity_id?: string | null
          opportunity_snapshot?: Json | null
          scheduled_time?: string | null
          status?: string
          subject_grade?: string
          subject_name?: string
          subject_type?: string
          tutee_availability?: Json | null
          tutee_id?: string
          tutee_name?: string | null
          tutor_id?: string
          tutor_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "awaiting_verification_jobs_tutee_id_fkey"
            columns: ["tutee_id"]
            isOneToOne: false
            referencedRelation: "tutees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "awaiting_verification_jobs_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      certification_requests: {
        Row: {
          created_at: string
          id: string
          subject_grade: string
          subject_name: string
          subject_type: string
          tutor_id: string
          tutor_mark: string | null
          tutor_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          subject_grade: string
          subject_name: string
          subject_type: string
          tutor_id: string
          tutor_mark?: string | null
          tutor_name: string
        }
        Update: {
          created_at?: string
          id?: string
          subject_grade?: string
          subject_name?: string
          subject_type?: string
          tutor_id?: string
          tutor_mark?: string | null
          tutor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "certification_requests_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          job_id: string | null
          opportunity_id: string | null
          recipient: string
          status: string
          subject: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          opportunity_id?: string | null
          recipient: string
          status?: string
          subject?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          opportunity_id?: string | null
          recipient?: string
          status?: string
          subject?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "tutoring_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "tutoring_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      help_questions: {
        Row: {
          auth_id: string
          created_at: string
          description: string
          id: string
          role: string
          school_id: string | null
          submitted_at: string
          tutee_id: string | null
          tutor_id: string | null
          updated_at: string
          urgency: string
          user_email: string
          user_first_name: string
          user_grade: string | null
          user_last_name: string
        }
        Insert: {
          auth_id: string
          created_at?: string
          description: string
          id?: string
          role: string
          school_id?: string | null
          submitted_at?: string
          tutee_id?: string | null
          tutor_id?: string | null
          updated_at?: string
          urgency?: string
          user_email: string
          user_first_name: string
          user_grade?: string | null
          user_last_name: string
        }
        Update: {
          auth_id?: string
          created_at?: string
          description?: string
          id?: string
          role?: string
          school_id?: string | null
          submitted_at?: string
          tutee_id?: string | null
          tutor_id?: string | null
          updated_at?: string
          urgency?: string
          user_email?: string
          user_first_name?: string
          user_grade?: string | null
          user_last_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_questions_tutee_id_fkey"
            columns: ["tutee_id"]
            isOneToOne: false
            referencedRelation: "tutees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_questions_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      past_jobs: {
        Row: {
          awarded_volunteer_hours: number | null
          created_at: string | null
          desired_duration_minutes: number | null
          duration_minutes: number | null
          id: string
          language: string | null
          location: string | null
          opportunity_id: string | null
          opportunity_snapshot: Json | null
          scheduled_time: string | null
          subject_grade: string
          subject_name: string
          subject_type: string
          tutee_availability: Json | null
          tutee_id: string
          tutor_id: string
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          awarded_volunteer_hours?: number | null
          created_at?: string | null
          desired_duration_minutes?: number | null
          duration_minutes?: number | null
          id: string
          language?: string | null
          location?: string | null
          opportunity_id?: string | null
          opportunity_snapshot?: Json | null
          scheduled_time?: string | null
          subject_grade: string
          subject_name: string
          subject_type: string
          tutee_availability?: Json | null
          tutee_id: string
          tutor_id: string
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          awarded_volunteer_hours?: number | null
          created_at?: string | null
          desired_duration_minutes?: number | null
          duration_minutes?: number | null
          id?: string
          language?: string | null
          location?: string | null
          opportunity_id?: string | null
          opportunity_snapshot?: Json | null
          scheduled_time?: string | null
          subject_grade?: string
          subject_name?: string
          subject_type?: string
          tutee_availability?: Json | null
          tutee_id?: string
          tutor_id?: string
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "past_jobs_tutee_id_fkey"
            columns: ["tutee_id"]
            isOneToOne: false
            referencedRelation: "tutees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "past_jobs_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "past_jobs_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          created_at: string
          domain: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_recordings: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          recording_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          recording_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          recording_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subject_approvals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          status: string
          subject_grade: string | null
          subject_name: string | null
          subject_type: string | null
          tutor_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          status?: string
          subject_grade?: string | null
          subject_name?: string | null
          subject_type?: string | null
          tutor_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          status?: string
          subject_grade?: string | null
          subject_name?: string | null
          subject_type?: string | null
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_approvals_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          category: string | null
          grade_level: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          grade_level?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          grade_level?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      tutees: {
        Row: {
          auth_id: string
          created_at: string
          email: string
          first_name: string
          grade: string | null
          graduation_year: number | null
          id: string
          last_name: string
          pronouns: string | null
          school_id: string | null
          subjects: Json | null
          updated_at: string
        }
        Insert: {
          auth_id: string
          created_at?: string
          email: string
          first_name: string
          grade?: string | null
          graduation_year?: number | null
          id?: string
          last_name: string
          pronouns?: string | null
          school_id?: string | null
          subjects?: Json | null
          updated_at?: string
        }
        Update: {
          auth_id?: string
          created_at?: string
          email?: string
          first_name?: string
          grade?: string | null
          graduation_year?: number | null
          id?: string
          last_name?: string
          pronouns?: string | null
          school_id?: string | null
          subjects?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutees_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      tutoring_jobs: {
        Row: {
          additional_notes: string | null
          created_at: string
          desired_duration_minutes: number | null
          duration_minutes: number | null
          finalized_schedule: Json
          id: string
          language: string | null
          location: string | null
          opportunity_id: string | null
          opportunity_snapshot: Json | null
          scheduled_time: string | null
          status: string
          subject_grade: string | null
          subject_id: string | null
          subject_name: string | null
          subject_type: string | null
          tutee_availability: Json | null
          tutee_id: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          additional_notes?: string | null
          created_at?: string
          desired_duration_minutes?: number | null
          duration_minutes?: number | null
          finalized_schedule?: Json
          id?: string
          language?: string | null
          location?: string | null
          opportunity_id?: string | null
          opportunity_snapshot?: Json | null
          scheduled_time?: string | null
          status?: string
          subject_grade?: string | null
          subject_id?: string | null
          subject_name?: string | null
          subject_type?: string | null
          tutee_availability?: Json | null
          tutee_id: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          additional_notes?: string | null
          created_at?: string
          desired_duration_minutes?: number | null
          duration_minutes?: number | null
          finalized_schedule?: Json
          id?: string
          language?: string | null
          location?: string | null
          opportunity_id?: string | null
          opportunity_snapshot?: Json | null
          scheduled_time?: string | null
          status?: string
          subject_grade?: string | null
          subject_id?: string | null
          subject_name?: string | null
          subject_type?: string | null
          tutee_availability?: Json | null
          tutee_id?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutoring_jobs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "tutoring_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutoring_jobs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutoring_jobs_tutee_id_fkey"
            columns: ["tutee_id"]
            isOneToOne: false
            referencedRelation: "tutees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutoring_jobs_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      tutoring_opportunities: {
        Row: {
          additional_notes: string | null
          availability: Json | null
          created_at: string
          id: string
          language: string | null
          location_preference: string | null
          priority: string
          status: string
          subject_grade: string | null
          subject_name: string | null
          subject_type: string | null
          tutee_id: string | null
          updated_at: string
        }
        Insert: {
          additional_notes?: string | null
          availability?: Json | null
          created_at?: string
          id?: string
          language?: string | null
          location_preference?: string | null
          priority?: string
          status?: string
          subject_grade?: string | null
          subject_name?: string | null
          subject_type?: string | null
          tutee_id?: string | null
          updated_at?: string
        }
        Update: {
          additional_notes?: string | null
          availability?: Json | null
          created_at?: string
          id?: string
          language?: string | null
          location_preference?: string | null
          priority?: string
          status?: string
          subject_grade?: string | null
          subject_name?: string | null
          subject_type?: string | null
          tutee_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutoring_opportunities_tutee_id_fkey"
            columns: ["tutee_id"]
            isOneToOne: false
            referencedRelation: "tutees"
            referencedColumns: ["id"]
          },
        ]
      }
      tutors: {
        Row: {
          approved_subject_ids: string[]
          auth_id: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          school_id: string | null
          status: string
          updated_at: string
          volunteer_hours: number
        }
        Insert: {
          approved_subject_ids?: string[]
          auth_id: string
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          school_id?: string | null
          status?: string
          updated_at?: string
          volunteer_hours?: number
        }
        Update: {
          approved_subject_ids?: string[]
          auth_id?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          school_id?: string | null
          status?: string
          updated_at?: string
          volunteer_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "tutors_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
