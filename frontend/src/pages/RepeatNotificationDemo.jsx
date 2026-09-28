import React, { useState, useEffect } from 'react';
import FollowUpNotification from '../components/notifications/FollowUpNotification';
import { playNotificationSound } from '../utils/soundUtils';

const RepeatNotificationDemo = () => {
  const [demoUserId] = useState('demo-user-123');
  const [repeatCount, setRepeatCount] = useState(0);
  const [lastNotificationTime, setLastNotificationTime] = useState(null);
  const [isActive, setIsActive] = useState(false);

  // Format time for display
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleTimeString();
  };

  // Get time since last notification
  const getTimeSinceLastNotification = () => {
    if (!lastNotificationTime) return 'N/A';
    const minutes = Math.floor((Date.now() - lastNotificationTime) / (1000 * 60));
    return `${minutes} minutes ago`;
  };

  // Start the demo - simulate follow-up data for today
  const startDemo = () => {
    // Clear any existing localStorage for clean demo
    localStorage.removeItem(`followUpNotificationShown_${demoUserId}`);
    localStorage.removeItem(`followUpLastShownTime_${demoUserId}`);
    
    // Simulate user login
    localStorage.setItem('user', JSON.stringify({
      user_id: demoUserId,
      username: 'demo-user',
      full_name: 'Demo User'
    }));
    
    localStorage.setItem('access_token', 'demo-token-for-testing');
    
    setIsActive(true);
    setRepeatCount(0);
    setLastNotificationTime(null);
    
    // Create mock API response for testing
    window.mockFollowUpData = {
      followups: [
        {
          id: 'demo-1',
          lead_name: 'John Doe',
          phone: '+1 234-567-8900',
          notes: 'Follow up on property inquiry for downtown apartment',
          priority: 'high',
          followup_date: new Date().toISOString(),
          status: 'pending'
        },
        {
          id: 'demo-2', 
          lead_name: 'Jane Smith',
          phone: '+1 234-567-8901',
          notes: 'Schedule property viewing for weekend',
          priority: 'medium',
          followup_date: new Date().toISOString(),
          status: 'in_progress'
        }
      ]
    };
  };

  const stopDemo = () => {
    setIsActive(false);
    localStorage.removeItem(`followUpNotificationShown_${demoUserId}`);
    localStorage.removeItem(`followUpLastShownTime_${demoUserId}`);
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    delete window.mockFollowUpData;
  };

  const triggerRepeatNow = () => {
    // Set last shown time to 31 minutes ago to trigger immediate repeat
    const thirtyOneMinutesAgo = Date.now() - (31 * 60 * 1000);
    localStorage.setItem(`followUpLastShownTime_${demoUserId}`, thirtyOneMinutesAgo.toString());
    
    // Refresh the component
    window.location.reload();
  };

  const setShortInterval = () => {
    // For demo purposes, set last shown time to 29 minutes ago
    // This will trigger repeat in 1 minute instead of waiting 30 minutes
    const twentyNineMinutesAgo = Date.now() - (29 * 60 * 1000);
    localStorage.setItem(`followUpLastShownTime_${demoUserId}`, twentyNineMinutesAgo.toString());
    setLastNotificationTime(twentyNineMinutesAgo);
  };

  // Monitor localStorage changes
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const lastShown = localStorage.getItem(`followUpLastShownTime_${demoUserId}`);
      if (lastShown && lastShown !== lastNotificationTime?.toString()) {
        setLastNotificationTime(parseInt(lastShown));
        setRepeatCount(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [demoUserId, lastNotificationTime]);

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4 text-gray-800">
            🔔 Follow-Up Notification Repeat System Demo
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Control Panel */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-blue-600">Demo Controls</h3>
              
              <div className="space-y-3">
                <button
                  onClick={startDemo}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
                  disabled={isActive}
                >
                  {isActive ? 'Demo Active' : 'Start Demo'}
                </button>
                
                <button
                  onClick={stopDemo}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                  disabled={!isActive}
                >
                  Stop Demo
                </button>
                
                <button
                  onClick={triggerRepeatNow}
                  className="w-full bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors"
                  disabled={!isActive}
                >
                  Trigger Repeat Now
                </button>
                
                <button
                  onClick={setShortInterval}
                  className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors"
                  disabled={!isActive}
                >
                  Set 1min Interval (Test)
                </button>
              </div>
            </div>

            {/* Status Panel */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-green-600">Demo Status</h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Demo Status:</span>
                  <span className={`px-2 py-1 rounded text-xs ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="font-medium">Repeat Count:</span>
                  <span className="text-blue-600 font-bold">{repeatCount}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="font-medium">Last Notification:</span>
                  <span className="text-purple-600">{formatTime(lastNotificationTime)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="font-medium">Time Since Last:</span>
                  <span className="text-orange-600">{getTimeSinceLastNotification()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Explanation */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">How the Repeat System Works:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-700">
              <li><strong>Initial Notification:</strong> Shows when page loads if there are follow-ups for today</li>
              <li><strong>30-Minute Repeat:</strong> Automatically shows notification again every 30 minutes</li>
              <li><strong>Sound Alert:</strong> Plays beep sound with each notification (initial and repeats)</li>
              <li><strong>Snooze Option:</strong> Users can snooze for 10 minutes from the modal</li>
              <li><strong>Persistent:</strong> Continues reminding until follow-ups are completed</li>
              <li><strong>Smart Timing:</strong> Tracks last shown time to ensure accurate 30-minute intervals</li>
            </ul>
          </div>

          {/* Demo Instructions */}
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-semibold text-yellow-800 mb-2">Demo Instructions:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-700">
              <li>Click "Start Demo" to activate the notification system with mock data</li>
              <li>The initial notification should appear after 2 seconds</li>
              <li>Use "Set 1min Interval" to test repeat functionality quickly (instead of waiting 30 minutes)</li>
              <li>Use "Trigger Repeat Now" to immediately show a repeat notification</li>
              <li>Monitor the status panel to see repeat counts and timing</li>
              <li>Click "Stop Demo" to clean up and end the demonstration</li>
            </ol>
          </div>
        </div>

        {/* The actual notification component for demo */}
        {isActive && <FollowUpNotification userId={demoUserId} />}
      </div>
    </div>
  );
};

export default RepeatNotificationDemo;