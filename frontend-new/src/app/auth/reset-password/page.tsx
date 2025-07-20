'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetComplete, setResetComplete] = useState(false);
  const [hasResetToken, setHasResetToken] = useState(false);
  
  const router = useRouter();
  
  // Check if we have a reset token in the URL
  useEffect(() => {
    const checkResetToken = async () => {
      // The token is handled automatically by Supabase Auth
      const { data, error } = await supabase.auth.getSession();
      
      if (data.session) {
        setHasResetToken(true);
      } else {
        setError('Invalid or expired password reset link. Please request a new one.');
      }
    };
    
    checkResetToken();
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) {
        setError(error.message);
        return;
      }
      
      // Show success message
      setResetComplete(true);
      
      // Redirect to login after a delay
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // If reset is complete, show success message
  if (resetComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Password reset successful!
            </h2>
            <div className="mt-4 text-md text-gray-600">
              <p className="mb-4">
                Your password has been reset successfully.
              </p>
              <p className="mb-4">
                You will be redirected to the login page in a few seconds...
              </p>
              <div className="mt-8 border-t pt-4">
                <p>
                  <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
                    Click here if you're not redirected
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your new password below
          </p>
        </div>
        
        {!hasResetToken ? (
          <div className="text-center text-red-500">
            <p>{error || 'Invalid or expired password reset link.'}</p>
            <p className="mt-4">
              <Link href="/auth/forgot-password" className="font-medium text-blue-600 hover:text-blue-500">
                Request a new password reset link
              </Link>
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div className="mb-4">
                <label htmlFor="password" className="sr-only">
                  New Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="New Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="sr-only">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm mt-2">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
            
            <div className="text-sm text-center">
              <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
                Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}