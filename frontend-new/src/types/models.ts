/**
 * Type definitions for data models
 */

// Base model interface with common fields
export interface BaseModel {
  id: string;
  created_at: string;
  updated_at: string;
}

// School model
export interface School extends BaseModel {
  name: string;
  domain: string;
}

// Tutor model
export interface Tutor extends BaseModel {
  auth_id: string;
  email: string;
  first_name: string;
  last_name: string;
  school_id?: string;
  status: 'pending' | 'active' | 'suspended';
  volunteer_hours: number;
  school?: School;
}

// Subject model
export interface Subject extends BaseModel {
  name: string;
  category?: string;
  grade_level?: string;
}

// Subject approval model
export interface SubjectApproval extends BaseModel {
  tutor_id: string;
  subject_id: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  tutor?: Tutor;
  subject?: Subject;
}

// Tutoring opportunity model
export interface TutoringOpportunity extends BaseModel {
  tutee_name: string;
  tutee_email: string;
  subject: string;
  grade_level?: string;
  school?: string;
  availability?: string;
  location_preference?: string;
  additional_notes?: string;
  status: 'open' | 'assigned' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
}

// Tutoring job model
export interface TutoringJob extends BaseModel {
  opportunity_id: string;
  tutor_id: string;
  scheduled_date?: string;
  scheduled_time?: string;
  location?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  opportunity?: TutoringOpportunity;
  tutor?: Tutor;
}

// Session recording model
export interface SessionRecording extends BaseModel {
  job_id: string;
  file_path: string;
  file_url?: string;
  duration_seconds?: number;
  volunteer_hours?: number;
  status: 'pending' | 'approved' | 'rejected';
  job?: TutoringJob;
}

// Communication model
export interface Communication extends BaseModel {
  job_id?: string;
  opportunity_id?: string;
  type: 'email' | 'notification';
  recipient: string;
  subject?: string;
  content?: string;
  status: 'pending' | 'sent' | 'failed';
  job?: TutoringJob;
  opportunity?: TutoringOpportunity;
}

// Admin model
export interface Admin extends BaseModel {
  auth_id: string;
  email: string;
  first_name: string;
  last_name: string;
  school_id?: string;
  role: 'admin';
  school?: School;
}

// Form submission from Google Forms
export interface FormSubmission {
  formId: string;
  formTitle: string;
  timestamp: string;
  responses: {
    questionTitle: string;
    answer: string;
  }[];
}

// API response interfaces
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  status: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}