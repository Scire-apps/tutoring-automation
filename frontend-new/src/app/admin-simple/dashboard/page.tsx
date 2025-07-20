'use client';

export default function AdminSimpleDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <a
            href="/admin-simple"
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 inline-block"
          >
            Back to Login
          </a>
        </div>
        
        <div className="mb-6 p-4 bg-blue-50 rounded">
          <h2 className="text-xl font-semibold mb-2">User Information</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="font-medium">Email:</div>
            <div>1hashmimoi+superadmin@hdsb.ca</div>
            
            <div className="font-medium">Role:</div>
            <div>Super Admin</div>
            
            <div className="font-medium">Last Sign In:</div>
            <div>{new Date().toLocaleString()}</div>
          </div>
        </div>
        
        <div className="mb-6 p-4 bg-green-50 rounded">
          <h2 className="text-xl font-semibold mb-2">Admin Actions</h2>
          <p className="mb-4">This is a simplified admin dashboard. In a real implementation, you would see:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>School management</li>
            <li>Tutor approval controls</li>
            <li>Tutoring opportunity management</li>
            <li>System statistics</li>
          </ul>
        </div>
        
        <div className="mb-6 p-4 bg-yellow-50 rounded">
          <h2 className="text-xl font-semibold mb-2">Status</h2>
          <p>This is a static dashboard page that doesn't rely on authentication or any async operations.</p>
          <p className="mt-2">In the real implementation, this page would fetch data from the database and display dynamic content.</p>
        </div>
      </div>
    </div>
  );
}