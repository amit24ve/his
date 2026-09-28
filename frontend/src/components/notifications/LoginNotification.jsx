import React, { useState, useEffect, useRef } from 'react';
import { playNotificationSound } from '../../utils/soundUtils';

const LoginNotification = ({ userId, userRole, onAutoShow = true }) => {
  const [showModal, setShowModal] = useState(false);
  const [hasShownOnLogin, setHasShownOnLogin] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayFollowUps, setTodayFollowUps] = useState([]);
  const [upcomingLeads, setUpcomingLeads] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const loginTimeRef = useRef(null);

  // Get current user info
  const getCurrentUser = () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        return {
          name: user.full_name || user.username || user.name || 'User',
          role: user.role || user.roles?.[0] || userRole || 'Employee',
          userId: user.user_id || user.id || userId || 'unknown'
        };
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
    return {
      name: 'User',
      role: userRole || 'Employee',
      userId: userId || 'unknown'
    };
  };

  // Check if notification was already shown for this session
  const checkIfShownThisSession = () => {
    const sessionKey = `loginNotificationShown_${userId}_${Date.now().toString().slice(0, 10)}`;
    const lastShown = sessionStorage.getItem(sessionKey);
    return !!lastShown;
  };

  // Mark notification as shown for this session
  const markAsShownThisSession = () => {
    const sessionKey = `loginNotificationShown_${userId}_${Date.now().toString().slice(0, 10)}`;
    sessionStorage.setItem(sessionKey, 'true');
    setHasShownOnLogin(true);
  };

  // Check if 30 minutes have passed since last notification
  const shouldShowRecurringNotification = () => {
    const lastShown = localStorage.getItem(`lastLoginNotification_${userId}`);
    if (!lastShown) return true;

    const timeDiff = Date.now() - parseInt(lastShown);
    return timeDiff >= 30 * 60 * 1000; // 30 minutes in milliseconds
  };

  // Set last notification time
  const setLastNotificationTime = () => {
    localStorage.setItem(`lastLoginNotification_${userId}`, Date.now().toString());
  };

  // Fetch today's follow-ups (only pending/unattended)
  const fetchTodayFollowUps = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.log('❌ No access token found for follow-ups');
        return [];
      }

      const user = getCurrentUser();
      const actualUserId = user.userId;
      const today = new Date().toISOString().split('T')[0];
      const apiUrl = `https://cubehis.avopay.pro:5000/api/followup/user/${actualUserId}?date=${today}`;

      console.log('🔍 Fetching follow-ups:', { actualUserId, today, apiUrl });

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Follow-up API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Raw follow-up data received:', data);

        const followUps = data.followups || [];
        console.log('📋 Follow-ups array:', followUps);

        // Filter only pending/unattended follow-ups
        const filteredFollowUps = followUps.filter(followUp =>
          !followUp.status ||
          followUp.status.toLowerCase() === 'pending' ||
          followUp.status.toLowerCase() === 'scheduled' ||
          followUp.status.toLowerCase() === 'not_contacted'
        );

        console.log('✅ Filtered follow-ups (pending only):', filteredFollowUps);
        return filteredFollowUps;
      } else {
        console.log('❌ Follow-up API error:', response.status, await response.text());
      }
    } catch (error) {
      console.error('❌ Error fetching today\'s follow-ups:', error);
    }
    return [];
  };

  // Fetch pending leads (not yet contacted or incomplete)
  const fetchPendingLeads = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return [];

      const response = await fetch(`https://cubehis.avopay.pro:5000/api/lead/leads?status=pending,new,uncontacted&limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const leads = data.leads || [];

        // Filter leads that need attention
        return leads.filter(lead =>
          !lead.status ||
          lead.status.toLowerCase() === 'new' ||
          lead.status.toLowerCase() === 'pending' ||
          lead.status.toLowerCase() === 'uncontacted' ||
          lead.status.toLowerCase() === 'not_contacted'
        );
      }
    } catch (error) {
      console.error('Error fetching pending leads:', error);
    }
    return [];
  };

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    setLoadingData(true);
    try {
      const [followUps, pendingLeads] = await Promise.all([
        fetchTodayFollowUps(),
        fetchPendingLeads()
      ]);

      setTodayFollowUps(followUps);
      setUpcomingLeads(pendingLeads); // Using upcomingLeads state for pending leads
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  // Show the notification modal
  const showNotificationModal = async (isRecurring = false) => {
    console.log('🔔 Showing notification modal...', { isRecurring });

    setShowModal(true);
    setCurrentTime(new Date());

    // Fetch latest data when showing notification
    if (!isRecurring) {
      await fetchDashboardData();
    }

    // Play 2-second beep sound
    console.log('🔊 Attempting to play notification sound...');
    try {
      await playNotificationSound();
      console.log('✅ Sound playback initiated');
    } catch (error) {
      console.error('❌ Sound playback failed:', error);
    }

    // Update last notification time
    setLastNotificationTime();

    if (!isRecurring) {
      markAsShownThisSession();
    }

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
          setShowModal(false);
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Setup recurring notifications every 30 minutes
  const setupRecurringNotifications = () => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up interval to check every 30 minutes
    intervalRef.current = setInterval(() => {
      console.log('30 minutes passed - showing recurring login notification');
      showNotificationModal(true);
    }, 30 * 60 * 1000); // 30 minutes

    console.log('Recurring notification system activated - will show modal every 30 minutes');
  };

  // Initial notification on component mount (after login)
  useEffect(() => {
    if (userId && onAutoShow && !hasShownOnLogin) {
      // Show notification after a short delay to ensure user has reached dashboard
      const timer = setTimeout(() => {
        console.log('LoginNotification: Showing initial notification after login...');
        showNotificationModal(false);

        // Setup recurring notifications
        setupRecurringNotifications();
      }, 1500); // 1.5 second delay after dashboard load

      loginTimeRef.current = Date.now();

      return () => {
        clearTimeout(timer);
      };
    }
  }, [userId, onAutoShow, hasShownOnLogin]);

  // Check for recurring notifications on window focus
  useEffect(() => {
    const handleWindowFocus = () => {
      if (userId && !showModal && hasShownOnLogin) {
        if (shouldShowRecurringNotification()) {
          console.log('Window focused and 30 minutes passed - showing recurring notification');
          showNotificationModal(true);
        }
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [userId, showModal, hasShownOnLogin]);

  // Cleanup intervals on unmount
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
    setLastNotificationTime();

    console.log('Login notification closed manually - next notification will appear in 30 minutes');
  };

  // Get time-based greeting
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Format date for display
  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Format time for display
  const formatTime = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Invalid time';
    }
  };

  if (!showModal) {
    return null;
  }

  const user = getCurrentUser();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg mx-auto px-4 py-4 h-full sm:h-auto flex items-center">
        <div className="bg-white shadow-2xl rounded-2xl p-6 flex flex-col border-2 border-blue-300 animate-slideIn w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between mb-4 flex-shrink-0">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="fas fa-bell text-orange-600 text-2xl animate-pulse"></i>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-gray-800 break-words">
                  Pending Tasks Alert!
                </h2>
                <p className="text-sm text-gray-600 break-words">
                  You have unattended leads and follow-ups
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Auto-close countdown */}
              <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                Auto-close: {countdown}s
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 text-2xl transition-colors flex-shrink-0"
                onClick={handleCloseModal}
                aria-label="Close notification"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-4">
              {/* Today's Pending Follow-ups */}
              {todayFollowUps.length > 0 && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-4 border-2 border-red-200">
                  <div className="flex items-center gap-3 mb-3">
                    <i className="fas fa-exclamation-triangle text-red-500 text-lg animate-pulse"></i>
                    <h3 className="font-bold text-gray-800">Urgent Follow-ups Today</h3>
                    <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                      {todayFollowUps.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {todayFollowUps.map((followUp, index) => (
                      <div key={index} className="bg-white rounded-lg p-3 border border-red-100 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800">
                              {followUp.lead_name || followUp.customer_name || 'Unknown Lead'}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              {followUp.phone && (
                                <span className="inline-flex items-center gap-1 mr-3">
                                  <i className="fas fa-phone text-green-500"></i>
                                  {followUp.phone}
                                </span>
                              )}
                            </p>
                            {followUp.notes && (
                              <p className="text-xs text-gray-500 mt-1">
                                {followUp.notes.length > 50
                                  ? `${followUp.notes.substring(0, 50)}...`
                                  : followUp.notes}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-red-600 font-bold ml-2">
                            {formatTime(followUp.followup_date)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unattended Leads */}
              {upcomingLeads.length > 0 && (
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg p-4 border-2 border-yellow-200">
                  <div className="flex items-center gap-3 mb-3">
                    <i className="fas fa-user-clock text-yellow-600 text-lg"></i>
                    <h3 className="font-bold text-gray-800">Unattended Leads</h3>
                    <span className="bg-yellow-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                      {upcomingLeads.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {upcomingLeads.slice(0, 5).map((lead, index) => (
                      <div key={index} className="bg-white rounded-lg p-3 border border-yellow-100 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800">
                              {lead.customer_name || lead.name || 'Unknown Lead'}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              {lead.phone && (
                                <span className="inline-flex items-center gap-1 mr-3">
                                  <i className="fas fa-phone text-green-500"></i>
                                  {lead.phone}
                                </span>
                              )}
                              {lead.email && (
                                <span className="inline-flex items-center gap-1">
                                  <i className="fas fa-envelope text-blue-500"></i>
                                  {lead.email.length > 20 ? `${lead.email.substring(0, 20)}...` : lead.email}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-yellow-700 font-medium mt-1">
                              Status: {lead.status || 'New'}
                            </p>
                          </div>
                          <div className="text-right ml-2">
                            <span className="text-xs text-gray-500">
                              {lead.created_at ? formatDate(lead.created_at) : 'Recently added'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {upcomingLeads.length > 5 && (
                      <p className="text-xs text-gray-500 text-center py-2">
                        +{upcomingLeads.length - 5} more unattended leads
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* No Pending Tasks */}
              {todayFollowUps.length === 0 && upcomingLeads.length === 0 && !loadingData && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border-2 border-green-200 text-center">
                  <div className="flex justify-center mb-3">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-check-circle text-green-500 text-2xl"></i>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-800 mb-2">All Caught Up!</h3>
                  <p className="text-sm text-gray-600">
                    No pending follow-ups or unattended leads. Great job!
                  </p>
                </div>
              )}

              {/* Loading State */}
              {loadingData && (
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 text-center">
                  <div className="flex justify-center items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <p className="text-sm text-gray-600">Loading your pending tasks...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t border-gray-200 gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <i className="fas fa-info-circle flex-shrink-0"></i>
              <span>Auto-closes in {countdown}s • Repeats every 30 minutes</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  console.log('🔊 Manual test sound button clicked');
                  try {
                    await playNotificationSound();
                    console.log('✅ Manual sound test completed');
                  } catch (error) {
                    console.error('❌ Manual sound test failed:', error);
                  }
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                title="Test notification sound"
              >
                🔊 Test Sound
              </button>
              <button
                onClick={handleCloseModal}
                className="bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          {/* Debug Info */}
          <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
            <p><strong>Debug Info:</strong></p>
            <p>Follow-ups today: {todayFollowUps.length} | Pending leads: {upcomingLeads.length}</p>
            <p>User ID: {getCurrentUser().userId} | Role: {getCurrentUser().role}</p>
            <p>Token exists: {!!localStorage.getItem('access_token')}</p>
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

export default LoginNotification;