'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { supabase } from '@/services/supabase';
import api from '@/services/api';

interface Invitation {
  id: string;
  email: string;
  role: string;
  school_id?: string;
  status: string;
  expires_at: string;
  created_at: string;
  invited_by_admin?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  school?: {
    name: string;
  };
}

interface School {
  id: string;
  name: string;
  domain: string;
}

export default function AdminInvitationsPage() {
  const { user, isAdmin, signOut } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    role: 'admin',
    school_id: ''
  });
  
  const router = useRouter();
  
  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      
      if (!isAdmin()) {
        router.push('/dashboard');
        return;
      }
      
      try {
        // Fetch schools via backend
        try {
          const resp = await api.listSchoolsPublic();
          setSchools(resp.schools || []);
        } catch (e) {
          console.error('Error fetching schools');
        }
        
        // Fetch invitations
        await fetchInvitations();
      } catch (err: any) {
        setError(`Error loading data: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [user, router, isSuperAdmin]);
  
  const fetchInvitations = async () => {
    try {
      console.log('Fetching invitations from:', `${process.env.NEXT_PUBLIC_API_URL}/api/admin/invitations`);
      
      // Get the current session to include auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('No authentication token available');
        return;
      }
      
      // First test if backend is reachable
      const testResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`);
      console.log('Backend health check:', testResponse.status);
      
      if (!testResponse.ok) {
        throw new Error(`Backend not reachable: ${testResponse.status}`);
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/invitations`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('Invitations response status:', response.status);
      
      const data = await response.json();
      console.log('Invitations response data:', data);
      
      if (response.ok) {
        setInvitations(data.invitations || []);
      } else {
        setError(data.error || 'Failed to fetch invitations');
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(`Error fetching invitations: ${err.message}`);
    }
  };
  
  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    
    try {
      // Get the current session to include auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('No authentication token available');
        return;
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/invitations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Reset form and close modal
        setFormData({ email: '', role: 'admin', school_id: '' });
        setShowCreateForm(false);
        
        // Show the invitation URL modal
        setInvitationUrl(data.invitation_url);
        setShowUrlModal(true);
        
        // Refresh invitations list
        await fetchInvitations();
      } else {
        setError(data.error || 'Failed to create invitation');
      }
    } catch (err: any) {
      setError(`Error creating invitation: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }
    
    try {
      // Get the current session to include auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('No authentication token available');
        return;
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        await fetchInvitations();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to cancel invitation');
      }
    } catch (err: any) {
      setError(`Error cancelling invitation: ${err.message}`);
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'used':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/login');
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="text-blue-600 hover:text-blue-500"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Admin Invitations</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSignOut}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-800">{error}</div>
          </div>
        )}
        
        {/* Create invitation button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Create New Invitation
          </button>
        </div>
        
        {/* Create invitation form modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create Admin Invitation</h3>
                
                <form onSubmit={handleCreateInvitation} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                      Role
                    </label>
                    <select
                      id="role"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  
                   {formData.role === 'admin' && (
                    <div>
                      <label htmlFor="school" className="block text-sm font-medium text-gray-700">
                        School
                      </label>
                      <select
                        id="school"
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={formData.school_id}
                        onChange={(e) => setFormData({ ...formData, school_id: e.target.value })}
                      >
                        <option value="">Select a school</option>
                        {schools.map((school) => (
                          <option key={school.id} value={school.id}>
                            {school.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300"
                    >
                      {isCreating ? 'Creating...' : 'Create Invitation'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
        
        {/* Invitation URL modal */}
        {showUrlModal && invitationUrl && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Invitation Created Successfully</h3>
                
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    The invitation has been created. Share this registration link with the invited admin:
                  </p>
                  
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        readOnly
                        value={invitationUrl}
                        className="flex-1 bg-transparent text-sm text-gray-700 mr-2 outline-none"
                      />
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(invitationUrl);
                            setCopySuccess(true);
                            setTimeout(() => setCopySuccess(false), 2000);
                          } catch (err) {
                            console.error('Failed to copy:', err);
                          }
                        }}
                        className={`px-3 py-1 text-xs rounded focus:outline-none focus:ring-2 transition-colors ${
                          copySuccess 
                            ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500' 
                            : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                        }`}
                      >
                        {copySuccess ? '✓ Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500">
                    This link will expire in 7 days. The invited person can use it to complete their admin registration.
                  </p>
                  
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => {
                        setShowUrlModal(false);
                        setInvitationUrl(null);
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Invitations table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              Admin Invitations
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Manage invitations for new administrators.
            </p>
          </div>
          <div className="border-t border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    School
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invitation.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    Admin
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invitation.school?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(invitation.status)}`}>
                        {invitation.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(invitation.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {invitation.status === 'pending' && (
                        <button
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {invitations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      No invitations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}