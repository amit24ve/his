import React, { useState, useEffect, useRef } from 'react';
import { playNotificationSound } from '../utils/soundUtils';

const AutoNotificationDemo = () => {
  const [isActive, setIsActive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [nextNotificationIn, setNextNotificationIn] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  // Mock follow-up data
  const mockFollowUps = [
    {
      id: 'auto-demo-1',
      lead_name: 'John Smith',
      phone: '+1 234-567-8900',
      notes: 'Follow up on property inquiry for downtown apartment',
      priority: 'high',
      followup_date: new Date().toISOString(),
      status: 'pending'
    },
    {
      id: 'auto-demo-2',
      lead_name: 'Sarah Johnson',
      phone: '+1 234-567-8901', 
      notes: 'Schedule property viewing for weekend',
      priority: 'medium',
      followup_date: new Date().toISOString(),
      status: 'in_progress'
    }
  ];

  // Show notification modal with sound
  const showNotification = () => {
    setShowModal(true);
    setNotificationCount(prev => prev + 1);
    playNotificationSound();
    console.log(`Auto-notification #${notificationCount + 1} triggered`);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
  };

  // Start automatic notifications (every 30 seconds for demo)
  const startAutoNotifications = () => {
    setIsActive(true);
    setNotificationCount(0);
    
    // Show initial notification
    setTimeout(() => {
      showNotification();
    }, 2000);

    // Set up automatic interval (30 seconds for demo, would be 30 minutes in production)
    intervalRef.current = setInterval(() => {
      showNotification();
    }, 30000); // 30 seconds for demo

    // Start countdown timer
    setNextNotificationIn(30);
    countdownRef.current = setInterval(() => {
      setNextNotificationIn(prev => {
        if (prev <= 1) {
          return 30; // Reset to 30 seconds
        }
        return prev - 1;
      });
    }, 1000);

    console.log('Auto-notification demo started - notifications every 30 seconds');
  };

  // Stop automatic notifications
  const stopAutoNotifications = () => {
    setIsActive(false);
    setShowModal(false);
    setNotificationCount(0);
    setNextNotificationIn(0);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    
    console.log('Auto-notification demo stopped');
  };

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Format time
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'text-red-600 bg-red-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4 text-gray-800">
            🔔 Automatic Follow-Up Notification Demo
          </h1>
          <p className="text-gray-600 mb-4">
            This demo shows how the follow-up modal automatically appears every 30 minutes WITHOUT clicking any bell icon. 
            For demo purposes, notifications appear every 30 seconds instead of 30 minutes.
          </p>
          
          {/* Control Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-blue-600">Demo Controls</h3>
              
              <div className="space-y-3">
                <button
                  onClick={startAutoNotifications}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
                  disabled={isActive}
                >
                  {isActive ? 'Auto-Notifications Active' : 'Start Auto-Notifications'}
                </button>
                
                <button
                  onClick={stopAutoNotifications}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                  disabled={!isActive}
                >
                  Stop Auto-Notifications
                </button>
                
                <button
                  onClick={showNotification}
                  className="w-full bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors"
                >
                  Trigger Manual Notification
                </button>
              </div>
            </div>

            {/* Status */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-green-600">Status</h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Current Time:</span>
                  <span className="text-blue-600 font-mono">{formatTime(currentTime)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="font-medium">Auto-Mode:</span>
                  <span className={`px-2 py-1 rounded text-xs ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="font-medium">Notification Count:</span>
                  <span className="text-purple-600 font-bold">{notificationCount}</span>
                </div>
                
                {isActive && (
                  <div className="flex justify-between">
                    <span className="font-medium">Next in:</span>
                    <span className="text-orange-600 font-bold">{nextNotificationIn}s</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Information */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">How Auto-Notifications Work:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-700">
              <li><strong>Automatic Trigger:</strong> Modal appears every 30 minutes automatically (no clicking needed)</li>
              <li><strong>Background Timer:</strong> Runs continuously while page is open</li>
              <li><strong>Sound Alert:</strong> Plays notification sound with each automatic popup</li>
              <li><strong>User-Friendly:</strong> Clear countdown and status information</li>
              <li><strong>Persistent:</strong> Continues until follow-ups are completed or user stops it</li>
            </ul>
          </div>
        </div>

        {/* Automatic Modal */}
        {showModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="relative w-full max-w-2xl mx-auto px-2 sm:px-4 py-2 sm:py-4 h-full sm:h-auto flex items-center">
              <div className="bg-white shadow-2xl rounded-lg sm:rounded-2xl p-4 sm:p-6 flex flex-col border-2 border-orange-300 animate-slideIn w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between mb-3 sm:mb-4 flex-shrink-0">
                  <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-bell text-orange-600 text-lg sm:text-xl animate-pulse"></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg sm:text-xl font-bold text-gray-800 break-words">Follow-ups Due Today!</h2>
                      <p className="text-xs sm:text-sm text-gray-600 break-words">
                        Automatic notification #{notificationCount} - You have {mockFollowUps.length} follow-ups scheduled
                      </p>
                    </div>
                  </div>
                  <button
                    className="text-gray-400 hover:text-gray-600 text-xl sm:text-2xl transition-colors flex-shrink-0 ml-2"
                    onClick={closeModal}
                  >
                    &times;
                  </button>
                </div>

                {/* Follow-ups list */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="space-y-3">
                    {mockFollowUps.map((followUp, index) => (
                      <div
                        key={followUp.id}
                        className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <i className="fas fa-user text-blue-500 flex-shrink-0"></i>
                              <span className="font-semibold text-gray-800 break-words">
                                {followUp.lead_name}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(followUp.priority)} flex-shrink-0`}>
                                {followUp.priority}
                              </span>
                            </div>

                            <div className="flex items-start gap-2 mb-2">
                              <i className="fas fa-sticky-note text-yellow-500 mt-1 flex-shrink-0"></i>
                              <p className="text-xs sm:text-sm text-gray-700 break-words">{followUp.notes}</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="flex items-center gap-2">
                                <i className="fas fa-phone text-green-500 flex-shrink-0"></i>
                                <span className="text-xs sm:text-sm text-gray-600 break-all">{followUp.phone}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <i className="fas fa-clock text-orange-500 flex-shrink-0"></i>
                                <span className="text-xs sm:text-sm text-gray-600">Today</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 pt-3 sm:pt-4 border-t border-gray-200 gap-3 flex-shrink-0">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <i className="fas fa-clock flex-shrink-0 animate-pulse"></i>
                    <span>Automatically appears every 30 seconds (30 min in real app)</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={closeModal}
                      className="bg-orange-600 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
                    >
                      Close (Auto-shows in 30s)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Animation Styles */}
            <style jsx>{`
              .animate-fadeIn {
                animation: fadeIn 0.3s ease-out both;
              }
              .animate-slideIn {
                animation: slideIn 0.4s cubic-bezier(0.22, 1.25, 0.36, 1) both;
              }
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes slideIn {
                from {
                  opacity: 0;
                  transform: scale(0.9) translateY(-30px);
                }
                to {
                  opacity: 1;
                  transform: scale(1) translateY(0);
                }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutoNotificationDemo;