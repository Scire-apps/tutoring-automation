'use client';

import { useState } from 'react';
import { supabase } from '@/services/supabase';

export default function DirectLoginPage() {
  const [email, setEmail] = useState('1hashmimoi+superadmin@hdsb.ca');
  const [password, setPassword] = useState('SuperAdmin123!');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  
  const handleLogin = async () => {
    setError(null);
    setMessage(null);
    setIsLoading(true);
    
    try {
      // Sign in with Supabase directly
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }
      
      setMessage('Login successful! Redirecting...');
      
      // Wait a moment then redirect
      setTimeout(() => {
        window.location.href = '/admin/dashboard';
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setIsLoading(false);
    }
  };
  
  const handleDirectAccess = () => {
    window.location.href = '/admin/dashboard';
  };
  
  const handleDebugAccess = () => {
    window.location.href = '/debug';
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Direct Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Bypass middleware for testing
          </p>
        </div>
        
        <div className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {error && (
            <div className="text-red-500 text-sm">
              {error}
            </div>
          )}
          
          {message && (
            <div className="text-green-500 text-sm">
              {message}
            </div>
          )}
          
          <div className="flex flex-col space-y-4">
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
            
            <button
              onClick={handleDirectAccess}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Direct Access to Admin Dashboard
            </button>
            
            <button
              onClick={handleDebugAccess}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Debug Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}