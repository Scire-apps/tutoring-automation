// @ts-nocheck

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase as sharedSupabase } from '@/services/supabase';
import { useAuth } from '@/app/providers';
import apiService from '@/services/api';
import { TwoWeekTimeGrid, compressSelectionToDateMap } from '@/components/two-week-time-grid';

interface TutoringJob {
  id: string;
  tutor_id: string;
  opportunity_id: string;
  status: string;
  scheduled_time?: string;
  created_at: string;
  tutoring_opportunity?: {
    tutee_first_name?: string; tutee_last_name?: string; email?: string;
    subject_name?: string; subject_type?: string; subject_grade?: string;
    availability?: any;
    location_preference?: string;
  };
}

export default function SchedulingPage() {
  const [job, setJob] = useState<TutoringJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateSelection, setDateSelection] = useState<{[date: string]: Array<{start:string;end:string}>}>({});
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [desiredMinutesFromTutee, setDesiredMinutesFromTutee] = useState<number | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [availabilityOptions, setAvailabilityOptions] = useState<string[]>([]);
  const [allowedMask, setAllowedMask] = useState<{ [k: string]: Array<{ start: string; end: string }> }>({});
  
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;
  const supabase = sharedSupabase;

  useEffect(() => {
    if (!user) return;
    loadJobData();
  }, [user]);

  const loadJobData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tutor/jobs/${jobId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` }
      });
      if (!resp.ok) { setError('Job not found or not permitted'); return; }
      const json = await resp.json();
      const jobData = json.job;
      setJob(jobData);
      const opportunityData = jobData?.tutoring_opportunity;
      // Build allowed mask from tutee_availability (date keys)
      const a = (jobData?.tutee_availability || {}) as { [k: string]: string[] };
      const mask: { [k: string]: Array<{ start: string; end: string }> } = {};
      Object.entries(a).forEach(([date, arr]) => {
        mask[date] = (arr || []).map((s: string) => {
          const [start, end] = s.split('-');
          return { start, end };
        });
      });
      setAllowedMask(mask);
      // Desired session length
      if (typeof jobData?.desired_duration_minutes === 'number') {
        setDesiredMinutesFromTutee(jobData.desired_duration_minutes);
        setDurationMinutes(jobData.desired_duration_minutes);
      }
      
    } catch (err) {
      console.error('Error loading job data:', err);
      setError('An error occurred while loading the job data');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleSession = async () => {
    try {
      setScheduling(true);
      // Single session: exactly one day/time selection
      const m = compressSelectionToDateMap(dateSelection || {});
      let pickedDate: string | null = null;
      let pickedRange: string | null = null;
      Object.entries(m).forEach(([date, ranges]) => {
        if (!pickedDate && Array.isArray(ranges) && ranges.length > 0) {
          pickedDate = date;
          pickedRange = ranges[0];
        }
      });
      if (!pickedDate || !pickedRange) throw new Error('Please select a time slot');
      const [start, end] = pickedRange.split('-');
      const mins = diffMinutes(start, end);
      // Enforce exact duration requested by tutee when provided
      if (desiredMinutesFromTutee !== null && mins !== desiredMinutesFromTutee) {
        throw new Error(`Session must be exactly ${desiredMinutesFromTutee} minutes long.`);
      }
      // Fallback guard if desired duration isn't provided
      if (desiredMinutesFromTutee === null && (mins < 60 || mins > 180)) {
        throw new Error('Session must be 1 to 3 hours');
      }

      // Build ISO from date + start time in local timezone
      const [y,mn,d] = pickedDate.split('-').map(Number);
      const [sh, sm] = start.split(':').map(Number);
      const dt = new Date(y, mn-1, d, sh, sm);
      const iso = dt.toISOString();

      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tutor/jobs/${jobId}/schedule`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        // Send explicit local date/time to avoid backend timezone drift when matching availability
        body: JSON.stringify({ scheduled_time: iso, duration_minutes: durationMinutes, date: pickedDate, start_time: start })
      });
      if (!r.ok) {
        const j = await r.json().catch(()=>({}));
        throw new Error(j.error || j.details || 'Failed to schedule');
      }
      
      // Send session confirmation email with single date/time (best-effort)
      try {
        await apiService.sendSessionConfirmation(
          // Tutor email
          user?.email || '',
          // Tutee email: prefer fetched job.tutee.email, fallback to snapshot
          (job as any)?.tutee?.email || job?.tutoring_opportunity?.email || '',
          {
            subject: `${job?.tutoring_opportunity?.subject_name || ''} • ${job?.tutoring_opportunity?.subject_type || ''} • Grade ${job?.tutoring_opportunity?.subject_grade || ''}`.trim(),
            location: job?.tutoring_opportunity?.location_preference || '',
            tutor_name: (user?.user_metadata?.full_name || `${user?.user_metadata?.first_name || ''} ${user?.user_metadata?.last_name || ''}`.trim() || user?.email?.split('@')[0] || 'Tutor'),
            tutee_name: `${(job as any)?.tutee?.first_name ?? ''} ${(job as any)?.tutee?.last_name ?? ''}`.trim() || `${job?.tutoring_opportunity?.tutee_first_name ?? ''} ${job?.tutoring_opportunity?.tutee_last_name ?? ''}`.trim(),
            date: pickedDate,
            time: start,
          } as any,
          jobId
        );
      } catch (e) { /* non-fatal */ }

      router.push('/dashboard?scheduled=success');
      
    } catch (err: any) {
      console.error('Error scheduling session:', err);
      setError(err?.message || 'Failed to schedule the session.');
    } finally {
      setScheduling(false);
    }
  };

  function diffMinutes(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return (eh*60+em) - (sh*60+sm);
  }
  
  const handleCancelJob = async () => {
    if (!job) return;
    
    try {
      setScheduling(true);
      
      // 1. Call backend cancel endpoint to recreate opportunity and delete job
      try {
        await apiService.cancelJob(jobId);
      } catch (cancelErr) {
        console.error('Error cancelling via API:', cancelErr);
        setError('Failed to cancel job. Please try again.');
        return;
      }
      
      // 3. Send cancellation notification emails
      try {
        if (user) {
          // Get tutor's full name from auth user or construct from available data
          const tutorName = user?.user_metadata?.full_name || 
                           `${user?.user_metadata?.first_name || ''} ${user?.user_metadata?.last_name || ''}`.trim() ||
                           user?.email?.split('@')[0] || 'Tutor';
          
          const tuteeName = `${(job as any)?.tutee?.first_name ?? ''} ${(job as any)?.tutee?.last_name ?? ''}`.trim() || `${job.tutoring_opportunity?.tutee_first_name ?? ''} ${job.tutoring_opportunity?.tutee_last_name ?? ''}`.trim();
          
          await apiService.sendCancellationNotification(
            user.email || '',
            ((job as any)?.tutee?.email) || job.tutoring_opportunity?.tutee?.email || '',
            {
              subject: `${job?.tutoring_opportunity?.subject_name || ''} • ${job?.tutoring_opportunity?.subject_type || ''} • Grade ${job?.tutoring_opportunity?.subject_grade || ''}`.trim(),
              tutor_name: tutorName,
              tutee_name: tuteeName,
              reason: 'Tutor cancelled before scheduling'
            },
            jobId
          );
          console.log('Cancellation notification emails sent successfully');
        }
      } catch (emailError) {
        console.error('Failed to send cancellation notifications:', emailError);
        // Don't fail the entire process if email fails
      }
      
      // 4. Redirect to dashboard with cancellation message
      router.push('/dashboard?cancelled=true');
      
    } catch (err) {
      console.error('Error in handleCancelJob:', err);
      setError('An unexpected error occurred while cancelling the job.');
    } finally {
      setScheduling(false);
    }
  };

  // Helper function to format time in 12-hour format with AM/PM
  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    
    try {
      // For handling ISO format or time-only strings
      let time;
      if (timeString.includes('T')) {
        // Full ISO datetime
        time = new Date(timeString);
      } else {
        // Time-only string (HH:MM)
        const [hours, minutes] = timeString.split(':').map(Number);
        time = new Date();
        time.setHours(hours, minutes);
      }
      
      return time.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (err) {
      console.error('Error formatting time:', err);
      return timeString; // Return original if parsing fails
    }
  };
  
  // Helper function to format date in "Month Day, Year" format
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    try {
      // If dateString is "YYYY-MM-DD", parse it as local date to avoid timezone issues
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day); // month is 0-indexed
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } else {
        // For other date formats, use the original approach
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    } catch (err) {
      console.error('Error formatting date:', err);
      return dateString; // Return original if parsing fails
    }
  };
  
  const formatAvailabilityOption = (option: string) => {
    // This function could parse and format the availability string
    // For now, we'll just return it as is
    return option;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
          <div className="text-red-500 text-xl mb-4">⚠️ {error}</div>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
          <div className="text-red-500 text-xl mb-4">Job not found</div>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Schedule Tutoring Session</h1>
            <p className="mt-1 text-sm text-gray-500">
              Select a time within the tutee's availability window
            </p>
          </div>
          
          <div className="px-4 py-5 sm:p-6">
            {/* Job Details */}
            <div className="mb-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Tutoring Details</h2>
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Tutee</p>
                    <p className="mt-1">
                      {job.tutoring_opportunity?.tutee_first_name} {job.tutoring_opportunity?.tutee_last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Subject</p>
                    <p className="mt-1">{job.tutoring_opportunity?.subject_name} • {job.tutoring_opportunity?.subject_type} • Grade {job.tutoring_opportunity?.subject_grade}</p>
                  </div>
                  <div>
                    
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Location</p>
                    <p className="mt-1">{job.tutoring_opportunity?.session_location}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium text-gray-500">Tutee Availability</p>
                    <div className="mt-2">
                      <p className="text-sm text-gray-700 mb-1">
                        <span className="font-medium">Date:</span>{' '}
                        {job.tutoring_opportunity?.availability_date ? 
                          formatDate(job.tutoring_opportunity.availability_date) : 
                          'Not specified'}
                      </p>
                      <p className="text-sm text-gray-700 mb-1">
                        <span className="font-medium">Time:</span>
                      </p>
                      {job.tutoring_opportunity?.availability_start_time && 
                       job.tutoring_opportunity?.availability_end_time ? (
                        <div className="inline-flex items-center">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                            {formatTime(job.tutoring_opportunity.availability_start_time)}
                          </span>
                          <svg className="w-4 h-4 mx-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                            {formatTime(job.tutoring_opportunity.availability_end_time)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">{job.tutoring_opportunity?.availability_formatted || 'Not specified'}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Scheduling Form */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Select Session Time</h2>
              <div className="space-y-6">
                <div className="border rounded p-3">
                  <div className="mb-2 text-sm font-medium text-gray-700">Choose a time within the tutee's availability{desiredMinutesFromTutee ? ` — exactly ${desiredMinutesFromTutee} minutes` : ''}</div>
                  <TwoWeekTimeGrid
                    value={dateSelection}
                    allowed={allowedMask as any}
                    maxMinutesPerSession={desiredMinutesFromTutee ?? 180}
                    singleDayOnly
                    singleContiguousRange
                    onChange={(next)=> setDateSelection(next)}
                  />
                </div>
              </div>
              
              {/* Duration is fixed by tutee preference when provided */}
              {desiredMinutesFromTutee && (
                <div className="mt-4 text-sm text-gray-700">
                  Session duration requested by tutee: <span className="font-medium">{desiredMinutesFromTutee} minutes</span>
                </div>
              )}
              
              {/* Contact Info */}
              <div className="mb-6 p-4 bg-yellow-50 rounded-md">
                <h3 className="text-sm font-medium text-yellow-800 mb-2">Note</h3>
                <p className="text-sm text-yellow-700">You must select a single continuous block exactly equal to the tutee's requested duration{desiredMinutesFromTutee ? ` (${desiredMinutesFromTutee} minutes)` : ''}, and it must be within the tutee's availability (green regions).</p>
              </div>
              
              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
                  {error}
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Back to Dashboard
                </button>
                <button
                  type="button"
                  onClick={handleCancelJob}
                  disabled={scheduling}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scheduling ? 'Processing...' : 'Cancel Job'}
                </button>
                <button
                  type="button"
                  onClick={handleScheduleSession}
                  disabled={scheduling}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scheduling ? 'Scheduling...' : 'Save Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}