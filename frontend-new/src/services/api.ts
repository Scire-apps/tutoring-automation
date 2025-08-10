/**
 * API service for communicating with the backend
 */

import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tutoring-automation-sdt9.onrender.com';

/**
 * Base API request function with error handling and authentication
 */
async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  // Get current session for authentication
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(session?.access_token && {
      'Authorization': `Bearer ${session.access_token}`
    }),
    ...options.headers,
  };
  
  const config = {
    ...options,
    headers,
  };
  
  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data as T;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * Check the status of backend services
 */
export async function checkServicesStatus() {
  return apiRequest<{
    database: { status: string; message?: string };
    email: { status: string };
    storage: { status: string };
    forms: { status: string };
  }>('/api/services/status');
}

// Tutee endpoints
export async function getTuteeDashboard() {
  return apiRequest<{ tutee: any; opportunities: any[]; jobs: any[] }>(
    '/api/tutee/dashboard',
    { method: 'GET' }
  );
}

export async function createTuteeOpportunity(payload: {
  subject_id: string;
  grade_level?: string;
  sessions_per_week: number;
  availability: any;
  location_preference?: string;
  additional_notes?: string;
  priority?: 'low' | 'normal' | 'high';
}) {
  return apiRequest<{ message: string; opportunity: any }>(
    '/api/tutee/opportunities',
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

// Tutor endpoints
export async function getTutorDashboard() {
  return apiRequest<{ tutor: any; approved_subject_ids: string[]; opportunities: any[]; jobs: any[] }>(
    '/api/tutor/dashboard',
    { method: 'GET' }
  );
}

export async function acceptOpportunity(opportunityId: string, finalizedSchedule: Array<{ date: string; time: string }>) {
  return apiRequest<{ message: string; job: any }>(
    `/api/tutor/opportunities/${opportunityId}/accept`,
    { method: 'POST', body: JSON.stringify({ finalized_schedule: finalizedSchedule }) }
  );
}

export async function listSubjects() {
  return apiRequest<{ subjects: any[] }>(
    '/api/subjects',
    { method: 'GET' }
  );
}

export async function listSchoolsPublic() {
  const url = `${API_URL}/api/public/schools`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch schools');
  return res.json();
}

/**
 * Get a pre-signed URL for file upload
 */
export async function getUploadUrl() {
  return apiRequest<{
    upload_url: string;
    fields: Record<string, string>;
    expires_in: number;
  }>('/api/storage/upload-url', {
    method: 'POST',
  });
}

/**
 * Upload a file using the pre-signed URL
 */
export async function uploadFile(file: File, uploadUrl: string, fields: Record<string, string>) {
  const formData = new FormData();
  
  // Add the fields to the form data
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  
  // Add the file as the last field
  formData.append('file', file);
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }
  
  return true;
}

/**
 * Send a test email
 */
export async function sendTestEmail(recipient: string) {
  return apiRequest<{ message: string }>('/api/email/test', {
    method: 'POST',
    body: JSON.stringify({ recipient }),
  });
}

/**
 * Send session confirmation emails
 */
export async function sendSessionConfirmation(
  tutorEmail: string,
  tuteeEmail: string,
  sessionDetails: {
    subject: string;
    date: string;
    time: string;
    location: string;
    tutor_name: string;
    tutee_name: string;
  },
  jobId?: string
) {
  return apiRequest<{ message: string }>('/api/email/session-confirmation', {
    method: 'POST',
    body: JSON.stringify({
      tutor_email: tutorEmail,
      tutee_email: tuteeEmail,
      session_details: sessionDetails,
      job_id: jobId,
    }),
  });
}

/**
 * Send job assignment notification to tutor
 */
export async function sendJobAssignmentNotification(
  tutorEmail: string,
  tutorName: string,
  jobDetails: {
    subject: string;
    tutee_name: string;
    grade_level: string;
    location: string;
  },
  jobId?: string
) {
  return apiRequest<{ message: string }>('/api/email/job-assignment', {
    method: 'POST',
    body: JSON.stringify({
      tutor_email: tutorEmail,
      tutor_name: tutorName,
      job_details: jobDetails,
      job_id: jobId,
    }),
  });
}

/**
 * Send cancellation notification emails
 */
export async function sendCancellationNotification(
  tutorEmail: string,
  tuteeEmail: string,
  cancellationDetails: {
    subject: string;
    tutor_name: string;
    tutee_name: string;
    reason: string;
  },
  jobId?: string
) {
  return apiRequest<{ message: string }>('/api/email/cancellation', {
    method: 'POST',
    body: JSON.stringify({
      tutor_email: tutorEmail,
      tutee_email: tuteeEmail,
      cancellation_details: cancellationDetails,
      job_id: jobId,
    }),
  });
}

/**
 * Send session reminder emails
 */
export async function sendSessionReminder(
  tutorEmail: string,
  tuteeEmail: string,
  sessionDetails: {
    subject: string;
    date: string;
    time: string;
    location: string;
    tutor_name: string;
    tutee_name: string;
  },
  jobId?: string
) {
  return apiRequest<{ message: string }>('/api/email/reminder', {
    method: 'POST',
    body: JSON.stringify({
      tutor_email: tutorEmail,
      tutee_email: tuteeEmail,
      session_details: sessionDetails,
      job_id: jobId,
    }),
  });
}

/**
 * Send subject approval status notification
 */
export async function sendApprovalStatusNotification(
  tutorEmail: string,
  tutorName: string,
  approvalDetails: {
    subject: string;
    status: string;
    admin_name: string;
  }
) {
  return apiRequest<{ message: string }>('/api/email/approval-status', {
    method: 'POST',
    body: JSON.stringify({
      tutor_email: tutorEmail,
      tutor_name: tutorName,
      approval_details: approvalDetails,
    }),
  });
}

/**
 * API service object
 */
const apiService = {
  checkServicesStatus,
  getUploadUrl,
  uploadFile,
  sendTestEmail,
  sendSessionConfirmation,
  sendJobAssignmentNotification,
  sendCancellationNotification,
  sendSessionReminder,
  sendApprovalStatusNotification,
  getTuteeDashboard,
  createTuteeOpportunity,
  getTutorDashboard,
  acceptOpportunity,
  listSubjects,
  listSchoolsPublic,
};

export default apiService;