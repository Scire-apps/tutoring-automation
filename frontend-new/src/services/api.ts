// @ts-nocheck

/**
 * API service for communicating with the backend
 */

import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tutoring-automation-sdt9.onrender.com';

// In-memory client-side TTL cache for GET requests
type CacheEntry = { ts: number; maxAge: number; data: any };
const memoryCache: Map<string, CacheEntry> = new Map();
const DEFAULT_TTL_MS = Number(process.env.NEXT_PUBLIC_API_CACHE_TTL || 5000);

function cacheKey(method: string, url: string, token?: string) {
  return `${method}|${url}|${token || ''}`;
}

function pickTtlMs(endpoint: string): number {
  try {
    if (endpoint.startsWith('/api/admin/overview')) return Number(process.env.NEXT_PUBLIC_ADMIN_OVERVIEW_TTL || 3000);
    if (endpoint.startsWith('/api/admin/tutors/') && endpoint.endsWith('/edit-data')) return Number(process.env.NEXT_PUBLIC_ADMIN_EDIT_TTL || 3000);
    if (endpoint.startsWith('/api/admin/help-requests')) return Number(process.env.NEXT_PUBLIC_ADMIN_HELP_TTL || 5000);
    if (endpoint.startsWith('/api/admin/awaiting-verification')) return Number(process.env.NEXT_PUBLIC_ADMIN_AWAITING_TTL || 2000);
    if (endpoint.startsWith('/api/admin/tutors') || endpoint.startsWith('/api/admin/opportunities') || endpoint.startsWith('/api/admin/jobs') || endpoint.startsWith('/api/admin/schools')) return Number(process.env.NEXT_PUBLIC_ADMIN_LIST_TTL || 5000);
    // Tutor-side TTLs
    if (endpoint.startsWith('/api/tutor/dashboard')) return Number(process.env.NEXT_PUBLIC_TUTOR_DASHBOARD_TTL || 3000);
    if (endpoint.startsWith('/api/tutor/opportunities')) return Number(process.env.NEXT_PUBLIC_TUTOR_LIST_TTL || 3000);
    if (endpoint.startsWith('/api/tutor/past-jobs')) return Number(process.env.NEXT_PUBLIC_TUTOR_PAST_TTL || 8000);
    if (endpoint.startsWith('/api/tutor/jobs/')) return Number(process.env.NEXT_PUBLIC_TUTOR_JOB_TTL || 3000);
    if (endpoint.startsWith('/api/tutor/approvals')) return Number(process.env.NEXT_PUBLIC_TUTOR_APPROVALS_TTL || 4000);
    if (endpoint.startsWith('/api/public/')) return Number(process.env.NEXT_PUBLIC_PUBLIC_CACHE_TTL || 600000);
  } catch (_) {}
  return DEFAULT_TTL_MS;
}

function getCached(method: string, fullUrl: string, token?: string) {
  const key = cacheKey(method, fullUrl, token);
  const entry = memoryCache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.ts;
  if (age > entry.maxAge) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(method: string, fullUrl: string, token: string | undefined, data: any, maxAgeMs: number) {
  const key = cacheKey(method, fullUrl, token);
  memoryCache.set(key, { ts: Date.now(), maxAge: maxAgeMs, data });
}

function invalidateCacheByPrefix(prefix: string) {
  try {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.includes(`|${API_URL}${prefix}`)) {
        memoryCache.delete(key);
      }
    }
  } catch (_) {}
}

// Note: Email scrubbing for display is handled per-page; no centralized mutation here.

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
  
  const method = (options.method || 'GET').toString().toUpperCase();
  const config = {
    ...options,
    headers,
  };
  
  try {
    // Serve from cache for eligible GETs
    if (
      method === 'GET' &&
      (endpoint.startsWith('/api/admin/') || endpoint.startsWith('/api/public/') || endpoint.startsWith('/api/tutor/') || endpoint.startsWith('/api/tutee/'))
    ) {
      const cached = getCached(method, url, session?.access_token);
      if (cached != null) return cached as T;
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
      let errorMessage = `API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage += ` - ${errorData.error}`;
          if (errorData.details) {
            errorMessage += `: ${errorData.details}`;
          }
        }
      } catch (e) {
        // If we can't parse the error response, use the default message
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    // Store in cache for eligible GETs
    if (
      method === 'GET' &&
      (endpoint.startsWith('/api/admin/') || endpoint.startsWith('/api/public/') || endpoint.startsWith('/api/tutor/') || endpoint.startsWith('/api/tutee/'))
    ) {
      setCached(method, url, session?.access_token, data, pickTtlMs(endpoint));
    } else if (method !== 'GET') {
      // Invalidate caches on mutations
      if (endpoint.startsWith('/api/admin/')) {
        invalidateCacheByPrefix('/api/admin');
      }
      if (endpoint.startsWith('/api/tutor/')) {
        invalidateCacheByPrefix('/api/tutor');
      }
      if (endpoint.startsWith('/api/tutee/')) {
        invalidateCacheByPrefix('/api/tutee');
      }
    }
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

export async function cancelTuteeOpportunity(opportunityId: string) {
  return apiRequest<{ message: string; opportunity: any }>(
    `/api/tutee/opportunities/${opportunityId}/cancel`,
    { method: 'POST' }
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

export async function cancelJobAsTutee(jobId: string) {
  return apiRequest<{ message: string; opportunity: any }>(
    `/api/tutee/jobs/${jobId}/cancel`,
    { method: 'POST' }
  );
}

export async function getJobDetails(jobId: string) {
  return apiRequest<{ job: any }>(
    `/api/tutor/jobs/${jobId}`,
    { method: 'GET' }
  );
}

export async function getTuteeJobDetails(jobId: string) {
  return apiRequest<{ job: any }>(
    `/api/tutee/jobs/${jobId}`,
    { method: 'GET' }
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

export async function getAdminOverview() {
  return apiRequest<{
    admin: any;
    tutors: any[];
    opportunities: any[];
    awaiting_jobs: any[];
    certification_requests: any[];
    schools: any[];
  }>(`/api/admin/overview`, { method: 'GET' });
}

export async function getTutorEditData(tutorId: string) {
  return apiRequest<{
    tutor: any;
    subject_approvals: any[];
    subjects: { name: string }[];
  }>(`/api/admin/tutors/${tutorId}/edit-data`, { method: 'GET' });
}

export async function getTutorDetailsAdmin(tutorId: string) {
  return apiRequest<{ tutor: any; subject_approvals?: any[] }>(`/api/admin/tutors/${tutorId}`, { method: 'GET' });
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

export async function updateTutorStatusAdmin(tutorId: string, status: 'active'|'pending'|'suspended') {
  return apiRequest<{ message: string }>(
    `/api/admin/tutors/${tutorId}/status`,
    { method: 'PUT', body: JSON.stringify({ status }) }
  );
}

export async function updateTutorSubjectApprovalAdmin(
  tutorId: string,
  payload: { action: 'approve'|'reject'|'remove'; subject_name?: string; subject_type?: string; subject_grade?: string; subject_id?: string }
) {
  return apiRequest<{ message?: string }>(
    `/api/admin/tutors/${tutorId}/subjects`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

// Certification Requests (Tutor)
export async function createCertificationRequest(payload: {
  subject_name: string;
  subject_type: 'Academic'|'ALP'|'IB';
  subject_grade: '9'|'10'|'11'|'12';
  tutor_mark?: string;
}) {
  return apiRequest<{ message: string; request: any }>(
    `/api/tutor/certification-requests`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export async function listOwnCertificationRequests() {
  return apiRequest<{ requests: any[] }>(
    `/api/tutor/certification-requests`,
    { method: 'GET' }
  );
}

export async function getTutorApprovals() {
  return apiRequest<{ approved_subjects: any[]; approvals: any[] }>(
    `/api/tutor/approvals`,
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
 * Submit a help request (tutor or tutee)
 */
export async function submitHelpRequest(payload: { urgency: 'urgent'|'non-urgent'; description: string }) {
  return apiRequest<{ message: string; help: any }>(
    `/api/help/submit`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

/**
 * Admin: list help requests (scoped by admin's school)
 */
export async function listHelpRequests() {
  return apiRequest<{ help_requests: any[] }>(
    `/api/admin/help-requests`,
    { method: 'GET' }
  );
}

/**
 * Admin: resolve (delete) a help request by id
 */
export async function resolveHelpRequest(requestId: string) {
  return apiRequest<{ message: string }>(
    `/api/admin/help-requests/${requestId}`,
    { method: 'DELETE' }
  );
}

export async function deleteCertificationRequestAdmin(requestId: string) {
  return apiRequest<{ message: string }>(
    `/api/admin/certification-requests/${requestId}`,
    { method: 'DELETE' }
  );
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
  cancelJobAsTutee,
  getJobDetails,
  upsertRecordingLink,
  listAwaitingVerificationJobs,
  getRecordingLinkForJob,
  verifyCompletedJob,
  listOpenOpportunities,
  cancelTuteeOpportunity,
  completeJob,
  listSchoolsPublic,
  listTutorPastJobs,
  getTutorHistoryForAdmin,
  updateTutorStatusAdmin,
  updateTutorSubjectApprovalAdmin,
  createCertificationRequest,
  listOwnCertificationRequests,
  getTutorApprovals,
  getTuteeJobDetails,
  submitHelpRequest,
  listHelpRequests,
  resolveHelpRequest,
  // Admin aggregate + edit-data (client-side cached)
  getAdminOverview,
  getTutorEditData,
  getTutorDetailsAdmin,
  // New: admin delete certification request
  deleteCertificationRequestAdmin,
};

export default apiService;