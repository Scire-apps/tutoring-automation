export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: {
          id: string
          name: string
          domain: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          domain: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          domain?: string
          created_at?: string
          updated_at?: string
        }
      }
      tutors: {
        Row: {
          id: string
          auth_id: string
          email: string
          first_name: string
          last_name: string
          school_id?: string
          status: 'pending' | 'active' | 'suspended'
          volunteer_hours: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_id: string
          email: string
          first_name: string
          last_name: string
          school_id?: string
          status?: 'pending' | 'active' | 'suspended'
          volunteer_hours?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_id?: string
          email?: string
          first_name?: string
          last_name?: string
          school_id?: string
          status?: 'pending' | 'active' | 'suspended'
          volunteer_hours?: number
          created_at?: string
          updated_at?: string
        }
      }
      subjects: {
        Row: {
          id: string
          name: string
          category?: string
          grade_level?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category?: string
          grade_level?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          grade_level?: string
          created_at?: string
          updated_at?: string
        }
      }
      subject_approvals: {
        Row: {
          id: string
          tutor_id: string
          subject_id: string
          status: 'pending' | 'approved' | 'rejected'
          approved_by?: string
          approved_at?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tutor_id: string
          subject_id: string
          status?: 'pending' | 'approved' | 'rejected'
          approved_by?: string
          approved_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tutor_id?: string
          subject_id?: string
          status?: 'pending' | 'approved' | 'rejected'
          approved_by?: string
          approved_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      tutoring_opportunities: {
        Row: {
          id: string
          tutee_name: string
          tutee_email: string
          subject: string
          grade_level?: string
          school?: string
          availability?: string
          location_preference?: string
          additional_notes?: string
          status: 'open' | 'assigned' | 'completed' | 'cancelled'
          priority: 'low' | 'normal' | 'high'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tutee_name: string
          tutee_email: string
          subject: string
          grade_level?: string
          school?: string
          availability?: string
          location_preference?: string
          additional_notes?: string
          status?: 'open' | 'assigned' | 'completed' | 'cancelled'
          priority?: 'low' | 'normal' | 'high'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tutee_name?: string
          tutee_email?: string
          subject?: string
          grade_level?: string
          school?: string
          availability?: string
          location_preference?: string
          additional_notes?: string
          status?: 'open' | 'assigned' | 'completed' | 'cancelled'
          priority?: 'low' | 'normal' | 'high'
          created_at?: string
          updated_at?: string
        }
      }
      tutoring_jobs: {
        Row: {
          id: string
          opportunity_id: string
          tutor_id: string
          scheduled_date?: string
          scheduled_time?: string
          location?: string
          status: 'scheduled' | 'completed' | 'cancelled'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          opportunity_id: string
          tutor_id: string
          scheduled_date?: string
          scheduled_time?: string
          location?: string
          status?: 'scheduled' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          opportunity_id?: string
          tutor_id?: string
          scheduled_date?: string
          scheduled_time?: string
          location?: string
          status?: 'scheduled' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
      }
      session_recordings: {
        Row: {
          id: string
          job_id: string
          file_path: string
          file_url?: string
          duration_seconds?: number
          volunteer_hours?: number
          status: 'pending' | 'approved' | 'rejected'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          file_path: string
          file_url?: string
          duration_seconds?: number
          volunteer_hours?: number
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          file_path?: string
          file_url?: string
          duration_seconds?: number
          volunteer_hours?: number
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
          updated_at?: string
        }
      }
      communications: {
        Row: {
          id: string
          job_id?: string
          opportunity_id?: string
          type: 'email' | 'notification'
          recipient: string
          subject?: string
          content?: string
          status: 'pending' | 'sent' | 'failed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id?: string
          opportunity_id?: string
          type: 'email' | 'notification'
          recipient: string
          subject?: string
          content?: string
          status?: 'pending' | 'sent' | 'failed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          opportunity_id?: string
          type?: 'email' | 'notification'
          recipient?: string
          subject?: string
          content?: string
          status?: 'pending' | 'sent' | 'failed'
          created_at?: string
          updated_at?: string
        }
      }
      admins: {
        Row: {
          id: string
          auth_id: string
          email: string
          first_name: string
          last_name: string
          school_id?: string
          role: 'admin'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_id: string
          email: string
          first_name: string
          last_name: string
          school_id?: string
          role?: 'admin'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_id?: string
          email?: string
          first_name?: string
          last_name?: string
          school_id?: string
          role?: 'admin'
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}