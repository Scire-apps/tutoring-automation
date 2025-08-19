// @ts-nocheck

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
  subject_name: string;
  subject_type: 'Academic'|'ALP'|'IB';
  subject_grade: '9'|'10'|'11'|'12';
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

export async function acceptOpportunity(opportunityId: string) {
  return apiRequest<{ message: string; job: any }>(
    `/api/tutor/opportunities/${opportunityId}/accept`,
    { method: 'POST' }
  );
}

export async function listOpenOpportunities() {
  return apiRequest<{ opportunities: any[] }>(
    '/api/tutor/opportunities',
    { method: 'GET' }
  );
}

export async function completeJob(
  jobId: string,
  payload: {}
) {
  return apiRequest<{ message: string; volunteer_hours_added: number }>(
    `/api/tutor/jobs/${jobId}/complete`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export async function setTuteeAvailability(
  jobId: string,
  availability: { [date: string]: string[] },
  desiredDurationMinutes: number
) {
  return apiRequest<{ message: string; job: any }>(
    `/api/tutee/jobs/${jobId}/availability`,
    { method: 'POST', body: JSON.stringify({ availability, desired_duration_minutes: desiredDurationMinutes }) }
  );
}

export async function scheduleJob(
  jobId: string,
  scheduledTimeIso: string,
  durationMinutes: number
) {
  return apiRequest<{ message: string; job: any }>(
    `/api/tutor/jobs/${jobId}/schedule`,
    { method: 'POST', body: JSON.stringify({ scheduled_time: scheduledTimeIso, duration_minutes: durationMinutes }) }
  );
}

export async function cancelJob(jobId: string) {
  return apiRequest<{ message: string; opportunity: any }>(
    `/api/tutor/jobs/${jobId}/cancel`,
    { method: 'POST' }
  );
}

export async function upsertRecordingLink(jobId: string, recordingUrl: string) {
  return apiRequest<{ message: string; recording: any }>(
    `/api/tutor/jobs/${jobId}/recording-link`,
    { method: 'POST', body: JSON.stringify({ recording_url: recordingUrl }) }
  );
}

export async function listAwaitingVerificationJobs() {
  return apiRequest<{ jobs: any[] }>(
    `/api/admin/awaiting-verification`,
    { method: 'GET' }
  );
}

export async function getRecordingLinkForJob(jobId: string) {
  return apiRequest<{ recording_url?: string }>(
    `/api/admin/awaiting-verification/${jobId}/recording`,
    { method: 'GET' }
  );
}

export async function verifyCompletedJob(jobId: string, awardedHours: number) {
  return apiRequest<{ message: string }>(
    `/api/admin/awaiting-verification/${jobId}/verify`,
    { method: 'POST', body: JSON.stringify({ awarded_hours: awardedHours }) }
  );
}

export async function listTutorPastJobs() {
  return apiRequest<{ jobs: any[] }>(
    `/api/tutor/past-jobs`,
    { method: 'GET' }
  );
}

export async function getTutorHistoryForAdmin(tutorId: string) {
  return apiRequest<{ jobs: any[] }>(
    `/api/admin/tutors/${tutorId}/history`,
    { method: 'GET' }
  );
}

// listSubjects removed (no subjects table)

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
    subject_name?: string;
    subject_type?: string;
    subject_grade?: string;
    subject?: string; // legacy
    tutee_name: string;
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
  setTuteeAvailability,
  scheduleJob,
  cancelJob,
  upsertRecordingLink,
  listAwaitingVerificationJobs,
  getRecordingLinkForJob,
  verifyCompletedJob,
  listOpenOpportunities,
  completeJob,
  listSchoolsPublic,
  listTutorPastJobs,
  getTutorHistoryForAdmin,
};

export default apiService;