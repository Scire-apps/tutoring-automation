"use client";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Main Icon */}
        <div className="mb-8">
          <div className="mx-auto w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center shadow-lg">
            <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
            </svg>
          </div>
        </div>

        {/* Main Message */}
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Under Development
        </h1>
        
        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
          We&apos;re working hard to bring you something amazing. 
          Our team is crafting an exceptional experience that will be ready soon.
        </p>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex justify-center space-x-2 mb-4">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <p className="text-sm text-gray-500">
            Building something special...
          </p>
        </div>

        {/* Coming Soon Badge */}
        <div className="inline-flex items-center px-4 py-2 bg-white rounded-full shadow-md border border-gray-200">
          <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
          <span className="text-sm font-medium text-gray-700">Coming Soon</span>
        </div>
      </div>
    </div>
  );
}