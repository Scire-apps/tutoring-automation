'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useAuth } from '@/app/providers';
import apiService from '@/services/api';

interface TutoringJob {
  id: string;
  tutor_id: string;
  opportunity_id: string;
  status: string;
  scheduled_time?: string;
  created_at: string;
  tutoring_opportunity?: {
    tutee_first_name: string;
    tutee_last_name: string;
    tutee_email: string;
    subject: string;
    grade_level: string;
    availability_formatted: string;
    session_location: string;
  };
}

export default function SchedulingPage() {
  const [job, setJob] = useState<TutoringJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [scheduling, setScheduling] = useState(false);
  const [availabilityOptions, setAvailabilityOptions] = useState<string[]>([]);
  
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (!user) return;
    loadJobData();
  }, [user]);

  const loadJobData = async () => {
    try {
      setLoading(true);
      
      // Get tutor info
      const { data: tutorData, error: tutorError } = await supabase
        .from('tutors')
        .select('id')
        .eq('auth_id', user?.id)
        .single();

      if (tutorError || !tutorData) {
        setError('You must be logged in as a tutor to schedule sessions');
        return;
      }

      // Get job data
      const { data: jobData, error: jobError } = await supabase
        .from('tutoring_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('tutor_id', tutorData.id)
        .single();

      if (jobError || !jobData) {
        setError('Job not found or you do not have permission to schedule it');
        return;
      }

      // Get opportunity data
      const { data: opportunityData, error: opportunityError } = await supabase
        .from('tutoring_opportunities')
        .select('*')
        .eq('id', jobData.opportunity_id)
        .single();

      if (opportunityError || !opportunityData) {
        setError('Could not load tutoring opportunity details');
        return;
      }

      // Combine the data
      const fullJobData = {
        ...jobData,
        tutoring_opportunity: opportunityData
      };

      setJob(fullJobData);
      
      // Parse availability options
      if (opportunityData.availability_formatted) {
        const options = opportunityData.availability_formatted
          .split(',')
          .map(option => option.trim())
          .filter(Boolean);
        setAvailabilityOptions(options);
      }
      
    } catch (err) {
      console.error('Error loading job data:', err);
      setError('An error occurred while loading the job data');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleSession = async () => {
    if (!selectedDate || !selectedTime) {
      setError('Please select both a date and time');
      return;
    }

    try {
      setScheduling(true);
      
      // Format the scheduled time
      const scheduledDateTime = `${selectedDate}T${selectedTime}:00`;
      
      // Update the job with the scheduled time
      const { error: updateError } = await supabase
        .from('tutoring_jobs')
        .update({
          status: 'scheduled',
          scheduled_time: scheduledDateTime
        })
        .eq('id', jobId);

      if (updateError) {
        throw new Error(`Failed to schedule session: ${updateError.message}`);
      }
      
      // Get tutor data for email notification
      const { data: tutorData, error: tutorError } = await supabase
        .from('tutors')
        .select('first_name, last_name, email')
        .eq('auth_id', user?.id)
        .single();
        
      if (tutorError) {
        console.error('Error fetching tutor data for email:', tutorError);
        // Continue even if email sending fails
      } else {
        // Format date and time for email
        const formattedDate = formatDate(selectedDate);
        const formattedTime = formatTime(`${selectedTime}:00`);
        
        // Prepare session details for email
        const sessionDetails = {
          subject: job.tutoring_opportunity?.subject || '',
          date: formattedDate,
          time: formattedTime,
          location: job.tutoring_opportunity?.session_location || '',
          tutor_name: `${tutorData.first_name} ${tutorData.last_name}`,
          tutee_name: `${job.tutoring_opportunity?.tutee_first_name} ${job.tutoring_opportunity?.tutee_last_name}`
        };
        
        // Send confirmation emails
        try {
          await apiService.sendSessionConfirmation(
            tutorData.email,
            job.tutoring_opportunity?.tutee_email || '',
            sessionDetails,
            jobId
          );
          console.log('Session confirmation emails sent successfully');
        } catch (emailError) {
          console.error('Failed to send confirmation emails:', emailError);
          // Continue even if email sending fails - this is expected in development
          console.log('Email sending failed (expected in development mode) - continuing with scheduling');
        }
      }
      
      // Redirect to dashboard
      router.push('/dashboard?scheduled=success');
      
    } catch (err) {
      console.error('Error scheduling session:', err);
      setError('Failed to schedule the session. Please try again.');
    } finally {
      setScheduling(false);
    }
  };
  
  const handleCancelJob = async () => {
    if (!job) return;
    
    try {
      setScheduling(true);
      
      // 1. Update job status to cancelled
      const { error: jobError } = await supabase
        .from('tutoring_jobs')
        .update({ status: 'cancelled' })
        .eq('id', jobId);
        
      if (jobError) {
        console.error('Error cancelling job:', jobError);
        setError('Failed to cancel job. Please try again.');
        return;
      }
      
      // 2. Update opportunity status back to open with normal priority
      const { error: oppError } = await supabase
        .from('tutoring_opportunities')
        .update({ 
          status: 'open'
          // Keep the original priority, don't set to high
        })
        .eq('id', job.opportunity_id);
        
      if (oppError) {
        console.error('Error updating opportunity:', oppError);
        setError('Failed to update opportunity status. Please contact support.');
        return;
      }
      
      // 3. Send cancellation notification emails
      try {
        if (user) {
          // Get tutor's full name from auth user or construct from available data
          const tutorName = user?.user_metadata?.full_name || 
                           `${user?.user_metadata?.first_name || ''} ${user?.user_metadata?.last_name || ''}`.trim() ||
                           user?.email?.split('@')[0] || 'Tutor';
          
          const tuteeName = `${job.tutoring_opportunity?.tutee_first_name} ${job.tutoring_opportunity?.tutee_last_name}`;
          
          await apiService.sendCancellationNotification(
            user.email || '',
            job.tutoring_opportunity?.tutee_email || '',
            {
              subject: job.tutoring_opportunity?.subject || '',
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
                    <p className="mt-1">{job.tutoring_opportunity?.subject}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Grade Level</p>
                    <p className="mt-1">{job.tutoring_opportunity?.grade_level}</p>
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
              <h2 className="text-lg font-medium text-gray-900 mb-4">Select a Time</h2>
              
              {/* Date Selection */}
              <div className="mb-4">
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  id="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              {/* Time Selection */}
              <div className="mb-6">
                <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  id="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              {/* Availability Options */}
              {availabilityOptions.length > 0 && (
                <div className="mb-6">
                  <p className="block text-sm font-medium text-gray-700 mb-2">
                    Suggested Times (Based on Tutee Availability)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availabilityOptions.map((option, index) => (
                      <div 
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm cursor-pointer hover:bg-blue-200"
                        onClick={() => {
                          // This is a simplified example - in a real app, you'd parse the option
                          // and set both date and time accordingly
                          alert(`You selected: ${option}\nPlease use the date and time pickers to set the exact time.`);
                        }}
                      >
                        {formatAvailabilityOption(option)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Contact Info */}
              <div className="mb-6 p-4 bg-yellow-50 rounded-md">
                <h3 className="text-sm font-medium text-yellow-800 mb-2">Need a different time?</h3>
                <p className="text-sm text-yellow-700">
                  If none of these times work for you, you can email the tutee directly at{' '}
                  <a 
                    href={`mailto:${job.tutoring_opportunity?.tutee_email}`}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {job.tutoring_opportunity?.tutee_email}
                  </a>
                  {' '}to suggest an alternative time.
                </p>
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
                  disabled={!selectedDate || !selectedTime || scheduling}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scheduling ? 'Scheduling...' : 'Schedule Session'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}