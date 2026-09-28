import React from 'react';
import FollowUpTester from '../components/testing/FollowUpTester';
import TopHeader from '../components/layout/TopHeader';

const TestPage = () => {
  // Mock functions for TopHeader (since we're testing in isolation)
  const mockToggleSidebar = () => console.log('Sidebar toggled');
  const mockLogout = () => console.log('Logout triggered');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Include TopHeader to test the actual notification */}
      <TopHeader 
        toggleSidebar={mockToggleSidebar}
        currentDateTime={new Date().toLocaleString()}
        currentUser={JSON.parse(localStorage.getItem('user') || '{}').username || 'testuser'}
        logout={mockLogout}
      />
      
      {/* Main testing content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Follow-Up Notification Testing</h1>
          <p className="text-gray-600">
            This page allows you to test the follow-up notification feature. 
            The TopHeader above includes the actual FollowUpNotification component.
          </p>
        </div>
        
        <FollowUpTester />
        
        {/* Additional testing info */}
        <div className="mt-8 p-6 bg-white rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">How the Feature Works:</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="p-3 bg-blue-50 border-l-4 border-blue-400">
              <strong>Automatic Trigger:</strong> The notification automatically checks for today's follow-ups when the page loads (2-second delay).
            </div>
            <div className="p-3 bg-green-50 border-l-4 border-green-400">
              <strong>One-Time Daily:</strong> The notification only shows once per day per user to avoid annoyance.
            </div>
            <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400">
              <strong>Sound Alert:</strong> When the notification appears, it plays a 3-tone ascending beep sequence.
            </div>
            <div className="p-3 bg-purple-50 border-l-4 border-purple-400">
              <strong>Rich Information:</strong> The modal shows customer names, notes, contact info, priority levels, and scheduled times.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPage;