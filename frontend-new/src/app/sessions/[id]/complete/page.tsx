'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { supabase as sharedSupabase } from '@/services/supabase';
import { useAuth } from '@/app/providers';

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

export default function CompleteSessionPage() {
  const [job, setJob] = useState<TutoringJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
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
      
      // Get tutor info
      const { data: tutorData, error: tutorError } = await supabase
        .from('tutors')
        .select('id')
        .eq('auth_id', user?.id)
        .single();

      if (tutorError || !tutorData) {
        setError('You must be logged in as a tutor to complete sessions');
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
        setError('Job not found or you do not have permission to complete it');
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
      
    } catch (err) {
      console.error('Error loading job data:', err);
      setError('An error occurred while loading the job data');
    } finally {
      setLoading(false);
    }
  };

  const validateAndProcessFile = (file: File) => {
    // Clear previous validation errors
    setValidationError(null);
    
    // Check file type
    const fileType = file.type;
    if (!fileType.startsWith('audio/') && !fileType.startsWith('video/')) {
      setValidationError('Please upload an audio or video file');
      setSelectedFile(null);
      return;
    }
    
    // Check file size (max 500MB)
    const maxSize = 500 * 1024 * 1024; // 500MB in bytes
    if (file.size > maxSize) {
      setValidationError('File size exceeds 500MB limit');
      setSelectedFile(null);
      return;
    }
    
    setSelectedFile(file);
    
    // Create object URL for the file
    const objectUrl = URL.createObjectURL(file);
    
    // Get duration of audio/video file
    if (fileType.startsWith('audio/') && audioRef.current) {
      audioRef.current.src = objectUrl;
      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current) {
          const fileDuration = Math.round(audioRef.current.duration);
          // Check minimum duration (10 minutes = 600 seconds)
          if (fileDuration < 600) {
            setValidationError('Audio files must be at least 10 minutes long');
            setSelectedFile(null);
            setDuration(null);
            return;
          }
          setDuration(fileDuration);
          setValidationError(null);
        }
      };
    } else if (fileType.startsWith('video/') && videoRef.current) {
      videoRef.current.src = objectUrl;
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) {
          const fileDuration = Math.round(videoRef.current.duration);
          // Check minimum duration (10 minutes = 600 seconds)
          if (fileDuration < 600) {
            setValidationError('Video files must be at least 10 minutes long');
            setSelectedFile(null);
            setDuration(null);
            return;
          }
          setDuration(fileDuration);
          setValidationError(null);
        }
      };
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndProcessFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndProcessFile(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !job || !duration) return;
    
    try {
      setUploading(true);
      setUploadProgress(0);
      
      // Extract file metadata
      const fileType = selectedFile.type;
      const fileName = selectedFile.name;
      const fileSize = selectedFile.size;
      
      // Calculate volunteer hours (1 hour = 3600 seconds)
      const hours = duration / 3600; // Exact hours based on duration, no rounding or minimum
      
      // Simulate upload progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 5;
        });
      }, 100);
      
      // Create session recording record with just the metadata (no actual file upload)
      const { data: recordingData, error: recordingError } = await supabase
        .from('session_recordings')
        .insert({
          job_id: job.id,
          file_path: `metadata_only/${job.id}_${Date.now()}_${fileName}`, // Just for reference
          file_url: null, // No actual file URL since we're not uploading
          duration_seconds: duration,
          volunteer_hours: hours,
          status: 'approved' // Auto-approve the hours
        })
        .select()
        .single();
      
      if (recordingError) {
        clearInterval(progressInterval);
        throw new Error(`Failed to create recording record: ${recordingError.message}`);
      }
      
      // Update tutor's volunteer hours
      const { data: tutorData, error: tutorError } = await supabase
        .from('tutors')
        .select('id, volunteer_hours')
        .eq('auth_id', user?.id)
        .single();
        
      if (tutorError) {
        clearInterval(progressInterval);
        throw new Error(`Failed to get tutor data: ${tutorError.message}`);
      }
      
      // Add the new hours to the tutor's existing hours
      const updatedHours = (tutorData.volunteer_hours || 0) + hours;
      
      // Update the tutor's volunteer hours
      const { error: updateHoursError } = await supabase
        .from('tutors')
        .update({ volunteer_hours: updatedHours })
        .eq('id', tutorData.id);
        
      if (updateHoursError) {
        clearInterval(progressInterval);
        throw new Error(`Failed to update volunteer hours: ${updateHoursError.message}`);
      }
      
      // Update job status to completed
      const { error: jobUpdateError } = await supabase
        .from('tutoring_jobs')
        .update({ status: 'completed' })
        .eq('id', job.id);
      
      if (jobUpdateError) {
        clearInterval(progressInterval);
        throw new Error(`Failed to update job status: ${jobUpdateError.message}`);
      }
      
      // Update opportunity status to completed
      const { error: oppUpdateError } = await supabase
        .from('tutoring_opportunities')
        .update({ status: 'completed' })
        .eq('id', job.opportunity_id);
      
      if (oppUpdateError) {
        clearInterval(progressInterval);
        throw new Error(`Failed to update opportunity status: ${oppUpdateError.message}`);
      }
      
      // Complete the progress bar
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Show success message
      setSuccess(`Session completed successfully! ${hours.toFixed(6)} volunteer hours have been added to your account.`);
      
      // Redirect to dashboard after a delay
      setTimeout(() => {
        router.push('/dashboard?completed=success');
      }, 3000);
      
    } catch (err: any) {
      console.error('Error processing session:', err);
      setError(`Failed to complete session: ${err.message}`);
    } finally {
      setUploading(false);
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
  
  // Helper function to format duration in HH:MM:SS format
  const formatDuration = (seconds: number) => {
    if (!seconds) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
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

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
          <div className="text-green-500 text-xl mb-4">✅ {success}</div>
          <p className="text-gray-600 mb-4">Redirecting to dashboard...</p>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '100%' }}></div>
          </div>
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
            <h1 className="text-2xl font-bold text-gray-900">Complete Tutoring Session</h1>
            <p className="mt-1 text-sm text-gray-500">
              Upload a recording of your tutoring session to earn volunteer hours
            </p>
          </div>
          
          <div className="px-4 py-5 sm:p-6">
            {/* Job Details */}
            <div className="mb-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Session Details</h2>
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
                    <p className="text-sm font-medium text-gray-500">Location</p>
                    <p className="mt-1">{job.tutoring_opportunity?.session_location}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Scheduled Time</p>
                    <p className="mt-1">
                      {job.scheduled_time ? formatDate(job.scheduled_time) + ' at ' + formatTime(job.scheduled_time) : 'Not scheduled'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Upload Form */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Upload Session Recording</h2>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recording File (Audio or Video)
                </label>
                <div 
                  className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors duration-200 ${
                    isDragOver 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50/30'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="space-y-1 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                      >
                        <span>Upload a file</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          accept="audio/*,video/*"
                          onChange={handleFileChange}
                          ref={fileInputRef}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">Audio or video file up to 500MB</p>
                    <p className="text-xs text-gray-500 mt-1">Minimum duration: 10 minutes</p>
                    <p className="text-xs text-gray-500">The file will be processed locally to extract its duration</p>
                  </div>
                </div>
              </div>
              
              {/* Selected File Info */}
              {selectedFile && (
                <div className={`mb-6 p-4 rounded-md ${duration && duration >= 600 ? 'bg-blue-50' : 'bg-yellow-50'}`}>
                  <h3 className={`text-sm font-medium mb-2 ${duration && duration >= 600 ? 'text-blue-800' : 'text-yellow-800'}`}>
                    Selected File
                  </h3>
                  <div className={`text-sm space-y-1 ${duration && duration >= 600 ? 'text-blue-700' : 'text-yellow-700'}`}>
                    <p><span className="font-medium">Name:</span> {selectedFile.name}</p>
                    <p><span className="font-medium">Type:</span> {selectedFile.type}</p>
                    <p><span className="font-medium">Size:</span> {Math.round(selectedFile.size / 1024 / 1024 * 10) / 10} MB</p>
                    {duration && (
                      <>
                        <p><span className="font-medium">Duration:</span> {formatDuration(duration)} ({(duration / 3600).toFixed(6)} hours)</p>
                        {duration < 600 && (
                          <p className="text-red-600 font-medium">
                            ⚠️ File is too short. Minimum duration required: 10 minutes
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              
              {/* Hidden audio/video elements for duration calculation */}
              <audio ref={audioRef} style={{ display: 'none' }} />
              <video ref={videoRef} style={{ display: 'none' }} />
              
              {/* Upload Progress */}
              {uploading && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Progress: {uploadProgress}%
                  </label>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              )}
              
              {/* Validation Error Message */}
              {validationError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
                  {validationError}
                </div>
              )}
              
              {/* Upload Error Message */}
              {error && !validationError && (
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
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!selectedFile || !duration || uploading || (duration && duration < 600)}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading...' : 'Complete Session'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}