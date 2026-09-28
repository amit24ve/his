import React, { useState, useEffect, useRef } from 'react';
import { playNotificationSound } from '../../utils/soundUtils';

const FollowUpNotification = ({ userId }) => {
  const [todayFollowUps, setTodayFollowUps] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [hasShownToday, setHasShownToday] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
  const [autoCloseTimer, setAutoCloseTimer] = useState(null);
  const [countdown, setCountdown] = useState(10);
  const intervalRef = useRef(null);
  const lastShownTimeRef = useRef(null);
  const countdownRef = useRef(null);

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Get current time in minutes since midnight
  const getCurrentTimeInMinutes = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  };

  // Check if we've already shown the notification today
  const checkIfShownToday = () => {
    const today = getTodayDate();
    const lastShown = localStorage.getItem(`followUpNotificationShown_${userId}`);
    return lastShown === today;
  };

  // Mark that we've shown the notification today
  const markAsShownToday = () => {
    const today = getTodayDate();
    localStorage.setItem(`followUpNotificationShown_${userId}`, today);
    setHasShownToday(true);
  };

  // Get last shown time for repeat notifications
  const getLastShownTime = () => {
    const lastTime = localStorage.getItem(`followUpLastShownTime_${userId}`);
    return lastTime ? parseInt(lastTime) : null;
  };

  // Set last shown time for repeat notifications
  const setLastShownTime = () => {
    const currentTime = Date.now();
    localStorage.setItem(`followUpLastShownTime_${userId}`, currentTime.toString());
    lastShownTimeRef.current = currentTime;
  };

  // Check if 30 minutes have passed since last notification
  const shouldShowRepeatNotification = () => {
    const lastTime = getLastShownTime();
    if (!lastTime) return true;

    const currentTime = Date.now();
    const timeDifference = currentTime - lastTime;
    const thirtyMinutesInMs = 30 * 60 * 1000; // 30 minutes in milliseconds

    return timeDifference >= thirtyMinutesInMs;
  };

  // Fetch today's follow-ups
  const fetchTodayFollowUps = async () => {
    if (!userId) {
      return;
    }

    try {
      // Check for mock data first (for demo purposes)
      if (window.mockFollowUpData) {
        console.log('Using mock follow-up data for demo');
        return window.mockFollowUpData.followups || [];
      }

      const token = localStorage.getItem('access_token');
      const today = getTodayDate();

      const response = await fetch(`https://cubehis.avopay.pro:5000/api/followup/user/${userId}?date=${today}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const followUps = data.followups || [];

        if (followUps.length > 0) {
          setTodayFollowUps(followUps);
          return followUps;
        }
      }
    } catch (error) {
      console.error('Error fetching today\'s follow-ups:', error);
    }
    return [];
  };

  // Show notification modal
  const showNotificationModal = (followUps, isRepeat = false) => {
    if (followUps.length > 0) {
      setTodayFollowUps(followUps);
      setShowModal(true);

      // Play notification sound
      playNotificationSound();

      // Update timing
      setLastShownTime();

      if (!isRepeat) {
        markAsShownToday();
      }

      // Increment repeat count for tracking
      setRepeatCount(prev => prev + 1);

      // Start auto-close countdown (10 seconds)
      setCountdown(10);

      // Clear any existing countdown
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }

      // Start countdown timer
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            // Auto-close when countdown reaches 0
            setShowModal(false);
            clearInterval(countdownRef.current);
            console.log('Modal auto-closed after 10 seconds');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      console.log(`Follow-up notification shown ${isRepeat ? '(repeat)' : '(initial)'}: ${followUps.length} follow-ups - will auto-close in 10 seconds`);
    }
  };

  // Setup repeat notification system
  const setupRepeatNotifications = (followUps) => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Only setup repeat if there are follow-ups for today
    if (followUps.length === 0) return;

    // Set up interval to check every 30 minutes (1800000 ms)
    intervalRef.current = setInterval(() => {
      console.log('30 minutes passed - automatically showing follow-up notification');
      showNotificationModal(followUps, true);
    }, 30 * 60 * 1000); // 30 minutes

    console.log('Auto-repeat notification system activated - will show modal every 30 minutes automatically');
  };

  // Check for today's follow-ups on component mount and setup repeat system
  useEffect(() => {
    if (userId) {
      // Initial check after page load - ALWAYS check on refresh
      const timer = setTimeout(async () => {
        console.log('FollowUpNotification: Checking for today\'s follow-ups...');
        const followUps = await fetchTodayFollowUps();

        // Always show if there are follow-ups for today
        if (followUps.length > 0) {
          console.log(`Found ${followUps.length} follow-ups for today, showing initial notification`);

          // Show initial notification immediately
          showNotificationModal(followUps, false);

          // Setup automatic repeat every 30 minutes
          setupRepeatNotifications(followUps);
        } else {
          console.log('No follow-ups found for today');
        }
      }, 1500); // Reduced delay for faster response

      return () => {
        clearTimeout(timer);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [userId]);

  // Force check on window focus (when user comes back to tab)
  useEffect(() => {
    const handleWindowFocus = async () => {
      if (userId && !showModal) {
        const followUps = await fetchTodayFollowUps();
        if (followUps.length > 0) {
          // Check if 30 minutes have passed since last notification
          if (shouldShowRepeatNotification()) {
            console.log('Window focused and 30 minutes passed - showing notification');
            showNotificationModal(followUps, true);
          }
        }
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [userId, showModal]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // Close modal handler
  const handleCloseModal = () => {
    setShowModal(false);

    // Clear countdown timer
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    // Update the last shown time when modal is closed
    setLastShownTime();

    console.log('Modal closed manually - next automatic notification will appear in 30 minutes');
  };

  // Format time from datetime string
  const formatTime = (datetimeStr) => {
    try {
      const date = new Date(datetimeStr);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Invalid time';
    }
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

  if (!showModal || todayFollowUps.length === 0) {
    return null;
  }

  return (
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
                  You have {todayFollowUps.length} follow-up{todayFollowUps.length !== 1 ? 's' : ''} scheduled for today
                  {repeatCount > 1 && (
                    <span className="block sm:inline sm:ml-2 mt-1 sm:mt-0">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        Reminder #{repeatCount}
                      </span>
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Auto-close countdown */}
              <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                Auto-close: {countdown}s
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 text-xl sm:text-2xl transition-colors flex-shrink-0"
                onClick={handleCloseModal}
                aria-label="Close notification"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Follow-ups list - Scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-3">
              {todayFollowUps.map((followUp, index) => (
                <div
                  key={followUp.id || index}
                  className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Customer/Lead name */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <i className="fas fa-user text-blue-500 flex-shrink-0"></i>
                        <span className="font-semibold text-gray-800 break-words">
                          {followUp.lead_name || followUp.customer_name || 'Unknown Customer'}
                        </span>
                        {followUp.priority && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(followUp.priority)} flex-shrink-0`}>
                            {followUp.priority}
                          </span>
                        )}
                      </div>

                      {/* Follow-up details */}
                      {followUp.notes && (
                        <div className="flex items-start gap-2 mb-2">
                          <i className="fas fa-sticky-note text-yellow-500 mt-1 flex-shrink-0"></i>
                          <p className="text-xs sm:text-sm text-gray-700 break-words">{followUp.notes}</p>
                        </div>
                      )}

                      {/* Contact info and time in responsive layout */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {followUp.phone && (
                          <div className="flex items-center gap-2">
                            <i className="fas fa-phone text-green-500 flex-shrink-0"></i>
                            <span className="text-xs sm:text-sm text-gray-600 break-all">{followUp.phone}</span>
                          </div>
                        )}

                        {/* Follow-up time */}
                        <div className="flex items-center gap-2">
                          <i className="fas fa-clock text-orange-500 flex-shrink-0"></i>
                          <span className="text-xs sm:text-sm text-gray-600">
                            {followUp.followup_date ? formatTime(followUp.followup_date) : 'No time specified'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status indicator */}
                    <div className="flex sm:block justify-end sm:ml-4">
                      <div className={`w-3 h-3 rounded-full ${followUp.status === 'completed' ? 'bg-green-500' :
                          followUp.status === 'in_progress' ? 'bg-yellow-500' :
                            'bg-red-500'
                        }`} title={followUp.status || 'pending'}></div>
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
              <span>Auto-closes in {countdown} seconds • Next reminder in 30 minutes</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => {
                  // Keep modal open (stop auto-close)
                  if (countdownRef.current) {
                    clearInterval(countdownRef.current);
                  }
                  setCountdown(0);
                  console.log('Auto-close stopped - modal will stay open');
                }}
                className="bg-blue-500 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors order-2 sm:order-1"
              >
                Keep Open
              </button>
              <button
                onClick={handleCloseModal}
                className="bg-orange-600 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors order-1 sm:order-2"
              >
                Close Now
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Styles */}
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
  );
};

export default FollowUpNotification;