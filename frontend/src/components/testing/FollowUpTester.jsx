import React, { useState } from 'react';
import { playNotificationSound, playBeep, playMultipleBeeps } from '../../utils/soundUtils';

const FollowUpTester = () => {
  const [testResults, setTestResults] = useState({});

  // Test sound functions
  const testSingleBeep = () => {
    try {
      playBeep(800, 300, 0.1);
      setTestResults(prev => ({ ...prev, singleBeep: 'Success ✅' }));
    } catch (error) {
      setTestResults(prev => ({ ...prev, singleBeep: `Error: ${error.message}` }));
    }
  };

  const testMultipleBeeps = () => {
    try {
      playMultipleBeeps(3, 300, 600, 200, 0.08);
      setTestResults(prev => ({ ...prev, multipleBeeps: 'Success ✅' }));
    } catch (error) {
      setTestResults(prev => ({ ...prev, multipleBeeps: `Error: ${error.message}` }));
    }
  };

  const testNotificationSound = () => {
    try {
      playNotificationSound();
      setTestResults(prev => ({ ...prev, notificationSound: 'Success ✅' }));
    } catch (error) {
      setTestResults(prev => ({ ...prev, notificationSound: `Error: ${error.message}` }));
    }
  };

  // Clear localStorage to trigger notification again
  const resetNotificationFlag = () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      const userId = user.user_id || user.id;
      const today = new Date().toISOString().split('T')[0];

      // Remove the flag that prevents showing notification today
      localStorage.removeItem(`followUpNotificationShown_${userId}`);
      setTestResults(prev => ({
        ...prev,
        resetFlag: `Reset completed for user ${userId} on ${today} ✅`
      }));
    } else {
      setTestResults(prev => ({
        ...prev,
        resetFlag: 'No user data found in localStorage ❌'
      }));
    }
  };

  // Force show notification by manipulating localStorage
  const forceShowNotification = () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      const userId = user.user_id || user.id;

      // Clear the flag and refresh page
      localStorage.removeItem(`followUpNotificationShown_${userId}`);
      window.location.reload();
    } else {
      setTestResults(prev => ({
        ...prev,
        forceShow: 'No user data found in localStorage ❌'
      }));
    }
  };

  // Check current localStorage state
  const checkLocalStorageState = () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      const userId = user.user_id || user.id;
      const today = new Date().toISOString().split('T')[0];
      const flagKey = `followUpNotificationShown_${userId}`;
      const flagValue = localStorage.getItem(flagKey);

      setTestResults(prev => ({
        ...prev,
        localStorageCheck: `
          User ID: ${userId}
          Today: ${today}
          Flag Key: ${flagKey}
          Flag Value: ${flagValue || 'Not set'}
          Status: ${flagValue === today ? 'Already shown today' : 'Will show notification'}
        `
      }));
    } else {
      setTestResults(prev => ({
        ...prev,
        localStorageCheck: 'No user data found in localStorage ❌'
      }));
    }
  };

  // Test API endpoint
  const testAPIEndpoint = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) {
        setTestResults(prev => ({
          ...prev,
          apiTest: 'No user data found in localStorage ❌'
        }));
        return;
      }

      const user = JSON.parse(userData);
      const userId = user.user_id || user.id;
      const token = localStorage.getItem('access_token');
      const today = new Date().toISOString().split('T')[0];

      const response = await fetch(`https://cubehis.avopay.pro:5000/api/followup/user/${userId}?date=${today}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const followUps = data.followups || [];
        setTestResults(prev => ({
          ...prev,
          apiTest: `
            API Response: Success ✅
            Follow-ups found: ${followUps.length}
            Data: ${JSON.stringify(data, null, 2)}
          `
        }));
      } else {
        setTestResults(prev => ({
          ...prev,
          apiTest: `API Error: ${response.status} - ${response.statusText} ❌`
        }));
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        apiTest: `Network Error: ${error.message} ❌`
      }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Follow-Up Notification Tester</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sound Testing */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 text-blue-600">🔊 Sound Testing</h3>

          <div className="space-y-3">
            <button
              onClick={testSingleBeep}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
            >
              Test Single Beep
            </button>

            <button
              onClick={testMultipleBeeps}
              className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
            >
              Test Multiple Beeps
            </button>

            <button
              onClick={testNotificationSound}
              className="w-full bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition-colors"
            >
              Test Notification Sound
            </button>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            {testResults.singleBeep && (
              <div className="p-2 bg-gray-100 rounded">
                <strong>Single Beep:</strong> {testResults.singleBeep}
              </div>
            )}
            {testResults.multipleBeeps && (
              <div className="p-2 bg-gray-100 rounded">
                <strong>Multiple Beeps:</strong> {testResults.multipleBeeps}
              </div>
            )}
            {testResults.notificationSound && (
              <div className="p-2 bg-gray-100 rounded">
                <strong>Notification Sound:</strong> {testResults.notificationSound}
              </div>
            )}
          </div>
        </div>

        {/* Notification Testing */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 text-orange-600">🔔 Notification Testing</h3>

          <div className="space-y-3">
            <button
              onClick={checkLocalStorageState}
              className="w-full bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 transition-colors"
            >
              Check Current State
            </button>

            <button
              onClick={resetNotificationFlag}
              className="w-full bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 transition-colors"
            >
              Reset Notification Flag
            </button>

            <button
              onClick={forceShowNotification}
              className="w-full bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
            >
              Force Show Notification (Reload)
            </button>

            <button
              onClick={testAPIEndpoint}
              className="w-full bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 transition-colors"
            >
              Test API Endpoint
            </button>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            {testResults.localStorageCheck && (
              <div className="p-2 bg-gray-100 rounded">
                <strong>localStorage Check:</strong>
                <pre className="whitespace-pre-wrap text-xs mt-1">{testResults.localStorageCheck}</pre>
              </div>
            )}
            {testResults.resetFlag && (
              <div className="p-2 bg-gray-100 rounded">
                <strong>Reset Flag:</strong> {testResults.resetFlag}
              </div>
            )}
            {testResults.forceShow && (
              <div className="p-2 bg-gray-100 rounded">
                <strong>Force Show:</strong> {testResults.forceShow}
              </div>
            )}
            {testResults.apiTest && (
              <div className="p-2 bg-gray-100 rounded">
                <strong>API Test:</strong>
                <pre className="whitespace-pre-wrap text-xs mt-1">{testResults.apiTest}</pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">Testing Instructions:</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
          <li>First, test the sound functions to ensure audio is working</li>
          <li>Check the current localStorage state to see if notification was already shown today</li>
          <li>Test the API endpoint to see if there are follow-ups for today</li>
          <li>Use "Reset Notification Flag" to clear the daily flag</li>
          <li>Use "Force Show Notification" to trigger the notification modal</li>
          <li>The notification should appear with sound after page reload (if there are follow-ups)</li>
        </ol>
      </div>
    </div>
  );
};

export default FollowUpTester;