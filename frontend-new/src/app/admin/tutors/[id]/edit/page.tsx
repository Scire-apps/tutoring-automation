// @ts-nocheck

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase as sharedSupabase } from '@/services/supabase';
import { useAuth } from '@/app/providers';

// Embedded subject options per spec
const SUBJECT_NAMES = ['Math','English','Science'];
const SUBJECT_TYPES = ['Academic','ALP','IB'];
const SUBJECT_GRADES = ['9','10','11','12'];

interface SubjectApproval {
  id: string;
  subject_name: string;
  subject_type: string;
  subject_grade: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_at: string | null;
  approved_by_admin?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface Tutor {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  school: {
    name: string;
    domain: string;
  };
}

interface TutorData {
  tutor: Tutor;
  subject_approvals: SubjectApproval[];
  available_subjects: any[];
}

export default function EditTutorPage() {
  const [tutorData, setTutorData] = useState<TutorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedSubjectName, setSelectedSubjectName] = useState('');
  const [selectedSubjectType, setSelectedSubjectType] = useState('');
  const [selectedSubjectGrade, setSelectedSubjectGrade] = useState('');
  
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tutorId = params.id as string;
  const supabase = sharedSupabase;

  // Subjects are loaded from backend into tutorData.available_subjects

  useEffect(() => {
    // Wait for auth to finish loading before trying to load data
    if (!authLoading) {
      loadTutorData();
    }
  }, [tutorId, authLoading]);

  const loadTutorData = async () => {
    try {
      console.log('🔍 TUTOR EDIT DEBUG: Starting loadTutorData...');
      console.log('🔍 TUTOR EDIT DEBUG: Auth loading:', authLoading);
      console.log('🔍 TUTOR EDIT DEBUG: User exists:', !!user);
      console.log('🔍 TUTOR EDIT DEBUG: Tutor ID:', tutorId);
      
      setLoading(true);
      
      // Wait for auth to finish loading
      if (authLoading) {
        console.log('🔍 TUTOR EDIT DEBUG: Auth still loading, waiting...');
        return;
      }
      
      if (!user) {
        console.log('🔍 TUTOR EDIT DEBUG: No user, redirecting to login');
        router.push('/auth/login');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      // Fetch via backend endpoints (service role)
      const [tutorResp, subjectsResp, approvalsResp] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/tutors/${tutorId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/subjects`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/tutors/${tutorId}/approvals`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!tutorResp.ok) throw new Error('Tutor not found');
      const tutorJson = await tutorResp.json();
      const subjectsJson = subjectsResp.ok ? await subjectsResp.json() : { subjects: [] };
      const approvalsJson = approvalsResp.ok ? await approvalsResp.json() : { subject_approvals: [] };

      const structuredData = {
        tutor: tutorJson.tutor,
        subject_approvals: approvalsJson.subject_approvals || [],
        // Normalize available subjects to a simple array of names from backend; fallback handled in UI
        available_subjects: Array.isArray(subjectsJson.subjects)
          ? subjectsJson.subjects.map((s: any) => s?.name).filter(Boolean)
          : [],
      };
      setTutorData(structuredData);
      
    } catch (err) {
      console.error('🔍 TUTOR EDIT DEBUG: Error loading tutor data:', err);
      setError('Failed to load tutor data');
    } finally {
      setLoading(false);
    }
  };

  const updateSubjectApproval = async (subject: {name:string,type:string,grade:string}, action: 'approve' | 'reject' | 'remove') => {
    try {
      console.log('🔍 TUTOR EDIT DEBUG: Updating subject approval:', { subject, action });
      setUpdating(`${subject.name}-${subject.type}-${subject.grade}`);
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      if (action === 'remove') {
        // Remove the subject approval
        console.log('🔍 TUTOR EDIT DEBUG: Attempting to remove approval for:', { tutorId, subject });
        
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/tutors/${tutorId}/subjects`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'remove',
            subject_name: subject.name,
            subject_type: subject.type,
            subject_grade: subject.grade,
          })
        });
        if (!resp.ok) throw new Error('Failed to remove subject approval');
        console.log('🔍 TUTOR EDIT DEBUG: Subject approval removed successfully');
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/tutors/${tutorId}/subjects`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            subject_name: subject.name,
            subject_type: subject.type,
            subject_grade: subject.grade,
          })
        });
        if (!resp.ok) throw new Error('Failed to update subject approval');
      }

      // Reload tutor data to reflect changes
      await loadTutorData();
      
    } catch (err) {
      console.error('🔍 TUTOR EDIT DEBUG: Error updating subject approval:', err);
      setError(`Failed to update subject approval: ${err.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const updateTutorStatus = async (status: 'active' | 'pending' | 'suspended') => {
    try {
      console.log('🔍 TUTOR EDIT DEBUG: Updating tutor status:', { tutorId, status });
      setUpdating('status');
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Update tutor status via backend (service role)
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/tutors/${tutorId}/status`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(`Failed to update tutor status: ${err.error || resp.statusText}`);
      }

      console.log('🔍 TUTOR EDIT DEBUG: Tutor status updated successfully');

      // Reload tutor data to reflect changes
      await loadTutorData();
      
    } catch (err) {
      console.error('🔍 TUTOR EDIT DEBUG: Error updating tutor status:', err);
      setError(`Failed to update tutor status: ${err.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const addCertification = async () => {
    try {
      console.log('🔍 TUTOR EDIT DEBUG: Adding certification:', { selectedSubjectName, selectedSubjectType, selectedSubjectGrade });
      setUpdating('add-cert');
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      if (!selectedSubjectName || !selectedSubjectType || !selectedSubjectGrade) {
        throw new Error('Please select subject, type, and grade');
      }

      console.log('🔍 TUTOR EDIT DEBUG: Approving subject via backend by embedded fields');
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/tutors/${tutorId}/subjects`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          subject_name: selectedSubjectName,
          subject_type: selectedSubjectType,
          subject_grade: selectedSubjectGrade,
        })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add certification');
      }
      
      console.log('🔍 TUTOR EDIT DEBUG: Certification added successfully');

      // Clear the form
      setSelectedSubjectName('');
      setSelectedSubjectType('');
      setSelectedSubjectGrade('');

      // Reload tutor data to reflect changes
      await loadTutorData();
      
    } catch (err) {
      console.error('🔍 TUTOR EDIT DEBUG: Error adding certification:', err);
      setError(`Failed to add certification: ${err.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const removeCertification = async (subjectId: string) => {
    try {
      console.log('🔍 TUTOR EDIT DEBUG: Removing certification for subject:', subjectId);
      setUpdating(subjectId);
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/tutors/${tutorId}/subjects`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', subject_id: subjectId })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to remove certification');
      }

      console.log('🔍 TUTOR EDIT DEBUG: Certification removed successfully');

      // Reload tutor data to reflect changes
      await loadTutorData();
      
    } catch (err) {
      console.error('🔍 TUTOR EDIT DEBUG: Error removing certification:', err);
      setError(`Failed to remove certification: ${err.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const getApprovalForSubject = (subject: {name:string,type:string,grade:string}): SubjectApproval | null => {
    return tutorData?.subject_approvals.find(approval => approval.subject_name === subject.name && approval.subject_type === subject.type && approval.subject_grade === subject.grade) || null;
  };

  const groupSubjectsByCategory = () => ({ });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tutor data...</p>
        </div>
      </div>
    );
  }

  if (error || !tutorData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Tutor not found'}</p>
          <button
            onClick={() => router.back()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { tutor } = tutorData;
  const groupedSubjects = groupSubjectsByCategory();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <button
                onClick={() => router.back()}
                className="text-blue-600 hover:text-blue-800 mb-2"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-3xl font-bold text-gray-900">
                Edit Tutor: {tutor.first_name} {tutor.last_name}
              </h1>
              <p className="text-gray-600">
                {tutor.school?.name || 'Not assigned'} - {tutor.email}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* Tutor Status */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Tutor Status
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Update the tutor's account status
              </p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">Current Status:</span>
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  tutor.status === 'active' ? 'bg-green-100 text-green-800' :
                  tutor.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {tutor.status}
                </span>
              </div>
              <div className="mt-4 flex space-x-3">
                {['active', 'pending', 'suspended'].map((status) => (
                  <button
                    key={status}
                    onClick={() => updateTutorStatus(status as any)}
                    disabled={tutor.status === status || updating === 'status'}
                    className={`px-4 py-2 text-sm font-medium rounded-md ${
                      tutor.status === status
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : status === 'active'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : status === 'pending'
                        ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {updating === 'status' ? 'Updating...' : `Set ${status}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Add New Certification (select embedded fields) */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Add Subject Certification
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Certify this tutor for a specific subject
              </p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                  <select value={selectedSubjectName} onChange={(e)=>setSelectedSubjectName(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md">
                    <option value="">Select...</option>
                    {(tutorData?.available_subjects && tutorData.available_subjects.length
                      ? tutorData.available_subjects
                      : SUBJECT_NAMES).map((s: string) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <select value={selectedSubjectType} onChange={(e)=>setSelectedSubjectType(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md">
                    <option value="">Select...</option>
                    {SUBJECT_TYPES.map(s=> <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Grade</label>
                  <select value={selectedSubjectGrade} onChange={(e)=>setSelectedSubjectGrade(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md">
                    <option value="">Select...</option>
                    {SUBJECT_GRADES.map(s=> <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <button onClick={addCertification} disabled={!selectedSubjectName || !selectedSubjectType || !selectedSubjectGrade || updating==='add-cert'} className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">{updating==='add-cert'?'Adding...':'Add Certification'}</button>
                </div>
              </div>
            </div>
          </div>

          {/* Current Certifications */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Current Certifications
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Subjects and grade levels this tutor is certified to teach
              </p>
            </div>
            <div className="border-t border-gray-200">
                        {tutorData.subject_approvals.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  No certifications yet. Add certifications using the form above.
                </div>
              ) : (
                <div className="px-4 py-5 sm:px-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tutorData.subject_approvals.map((approval) => (
                      <div key={approval.id} className="border rounded-lg p-4 bg-green-50">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                                      <h5 className="font-medium text-gray-900">{approval.subject_name} • {approval.subject_type}</h5>
                            <p className="text-sm text-gray-600">Grade: {approval.subject_grade}</p>
                          </div>
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            {approval.status}
                          </span>
                        </div>
                        
                        {approval.approved_at && (
                          <p className="text-xs text-gray-500 mb-2">
                            Added: {new Date(approval.approved_at).toLocaleDateString()}
                          </p>
                        )}
                        
                        <button
                                    onClick={() => updateSubjectApproval({ name: approval.subject_name, type: approval.subject_type, grade: approval.subject_grade }, 'remove')}
                          disabled={updating === approval.id}
                          className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          {updating === approval.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}