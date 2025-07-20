'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';

export default function AdminSimplePage() {
  const [status, setStatus] = useState('Loading...');
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, message]);
  };
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        addLog('Checking authentication...');
        
        // Check if user is authenticated
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          addLog(`Session error: ${sessionError.message}`);
          setStatus('Error checking session');
          return;
        }
        
        if (!session) {
          addLog('No active session found');
          setStatus('Not authenticated');
          return;
        }
        
        addLog(`Authenticated as: ${session.user.email}`);
        setStatus(`Logged in as: ${session.user.email}`);
      } catch (err: any) {
        addLog(`Error: ${err.message}`);
        setStatus('Error occurred');
      }
    };
    
    checkAuth();
  }, []);
  
  const handleLogin = async () => {
    try {
      addLog('Attempting login...');
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: '1hashmimoi+superadmin@hdsb.ca',
        password: 'SuperAdmin123!',
      });
      
      if (error) {
        addLog(`Login error: ${error.message}`);
        return;
      }
      
      addLog('Login successful');
      setStatus(`Logged in as: ${data.user.email}`);
    } catch (err: any) {
      addLog(`Login error: ${err.message}`);
    }
  };
  
  const handleLogout = async () => {
    try {
      addLog('Logging out...');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        addLog(`Logout error: ${error.message}`);
        return;
      }
      
      addLog('Logout successful');
      setStatus('Logged out');
    } catch (err: any) {
      addLog(`Logout error: ${err.message}`);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Simple Admin Page</h1>
        
        <div className="mb-6 p-4 bg-blue-50 rounded">
          <h2 className="text-xl font-semibold mb-2">Status</h2>
          <p>{status}</p>
        </div>
        
        <div className="flex space-x-4 mb-6">
          <button
            onClick={handleLogin}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Login
          </button>
          
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Logout
          </button>
          
          <a
            href="/admin-simple/dashboard"
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 inline-block"
          >
            Go to Dashboard
          </a>
        </div>
        
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <h2 className="text-xl font-semibold mb-2">Debug Logs</h2>
          <div className="bg-black text-green-400 p-4 rounded font-mono text-sm overflow-auto max-h-60">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}