'use client';

import { useState } from 'react';
import apiService from '@/services/api';
import { useAuth } from '@/app/providers';
import { useRouter } from 'next/navigation';

export default function EmailTestPage() {
  const [recipient, setRecipient] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const { user, userRole } = useAuth();
  const router = useRouter();
  
  // Redirect if not authenticated or not admin
  if (!user || (userRole !== 'admin' && userRole !== 'superadmin')) {
    if (typeof window !== 'undefined') {
      router.push('/auth/login');
    }
    return null;
  }

  const handleSendTestEmail = async () => {
    if (!recipient) {
      setResult({ success: false, message: 'Please enter a recipient email address' });
      return;
    }
    
    try {
      setSending(true);
      setResult(null);
      
      await apiService.sendTestEmail(recipient);
      
      setResult({ 
        success: true, 
        message: `Test email sent successfully to ${recipient}` 
      });
    } catch (error) {
      console.error('Error sending test email:', error);
      setResult({ 
        success: false, 
        message: `Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setSending(false);
    }
  };
  
  const handleSendSessionConfirmation = async () => {
    if (!recipient) {
      setResult({ success: false, message: 'Please enter a recipient email address' });
      return;
    }
    
    try {
      setSending(true);
      setResult(null);
      
      // Use the same email for both tutor and tutee in this test
      const sessionDetails = {
        subject: 'Algebra II',
        date: 'July 20, 2025',
        time: '3:30 PM - 4:30 PM',
        location: 'School Library',
        tutor_name: 'Test Tutor',
        tutee_name: 'Test Student'
      };
      
      await apiService.sendSessionConfirmation(
        recipient,
        recipient,
        sessionDetails
      );
      
      setResult({ 
        success: true, 
        message: `Session confirmation emails sent successfully to ${recipient}` 
      });
    } catch (error) {
      console.error('Error sending session confirmation:', error);
      setResult({ 
        success: false, 
        message: `Failed to send session confirmation: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Email Service Test</h1>
            <p className="mt-1 text-sm text-gray-500">
              Test the email notification service using Brevo API
            </p>
          </div>
          
          <div className="px-4 py-5 sm:p-6">
            <div className="mb-6">
              <label htmlFor="recipient" className="block text-sm font-medium text-gray-700 mb-1">
                Recipient Email Address
              </label>
              <input
                type="email"
                id="recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter email address"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={sending || !recipient}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending...' : 'Send Test Email'}
              </button>
              
              <button
                type="button"
                onClick={handleSendSessionConfirmation}
                disabled={sending || !recipient}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending...' : 'Send Session Confirmation'}
              </button>
            </div>
            
            {result && (
              <div className={`p-4 rounded-md ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {result.message}
              </div>
            )}
            
            <div className="mt-8 border-t border-gray-200 pt-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Email Service Information</h2>
              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-medium">Service Provider:</span> Brevo API
                </p>
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-medium">From Email:</span> {process.env.NEXT_PUBLIC_EMAIL_FROM || 'noreply@tutoring-automation.com'}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">API Status:</span> Active
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}