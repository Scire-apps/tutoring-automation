/**
 * API utility functions with authentication
 */
import { supabase } from '@/services/supabase';

/**
 * Get the current user's JWT token for API requests
 */
export async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Make an authenticated API request
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();
  
  if (!token) {
    throw new Error('No authentication token available');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };
  
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * API endpoints with authentication
 */
export const api = {
  // Admin invitations
  async createInvitation(data: { email: string; role: string; school_id?: string }) {
    return authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/invitations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  async getInvitations() {
    return authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/invitations`);
  },
  
  async cancelInvitation(invitationId: string) {
    return authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/invitations/${invitationId}`, {
      method: 'DELETE',
    });
  },
};