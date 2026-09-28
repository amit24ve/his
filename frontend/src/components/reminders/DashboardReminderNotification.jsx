import React, { useState, useEffect } from 'react';
import useReminders from '../../hooks/useReminders';
import ReminderModal from './ReminderModal';
import AllFollowUpsModal from './AllFollowUpsModal';

const DashboardReminderNotification = ({ userRole, userId, isHeaderVersion = false }) => {
  const {
    reminders,
    isLoading,
    showModal,
    markReminderAsSent,
    hideModal,
    showModalManually
  } = useReminders(userRole, userId);

  const [showAllFollowUps, setShowAllFollowUps] = useState(false);
  const [todayNotificationCount, setTodayNotificationCount] = useState(0);
  const [lastSeenDate, setLastSeenDate] = useState(null);

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Fetch today's notifications count
  useEffect(() => {
    const fetchTodayNotifications = async () => {
      if (!userId) return;

      try {
        const token = localStorage.getItem('access_token');
        const today = getTodayDate();

        // Fetch today's follow-ups
        const response = await fetch(`https://cubehis.avopay.pro:5000/api/followup/user/${userId}?date=${today}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const todayFollowUps = data.followups || [];

          // Get last seen date from localStorage
          const lastSeen = localStorage.getItem(`lastSeenNotifications_${userId}`);
          const lastSeenDateStr = lastSeen || null;

          setLastSeenDate(lastSeenDateStr);

          // If user hasn't seen notifications today, show all today's notifications
          // If they have seen some today, only show new ones since last seen time
          if (!lastSeenDateStr || lastSeenDateStr !== today) {
            // First time seeing notifications today - show all today's count
            setTodayNotificationCount(todayFollowUps.length);
          } else {
            // User has seen notifications today, check for new ones
            // For simplicity, we'll show all today's notifications that are still active
            setTodayNotificationCount(todayFollowUps.length);
          }
        }
      } catch (error) {
        console.error('Error fetching today notifications:', error);
        setTodayNotificationCount(0);
      }
    };

    fetchTodayNotifications();

    // Refresh every 30 seconds
    const interval = setInterval(fetchTodayNotifications, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  // Mark notifications as seen when bell is clicked
  const handleBellClick = () => {
    // Mark current date as seen
    const today = getTodayDate();
    localStorage.setItem(`lastSeenNotifications_${userId}`, today);

    if (reminders.length > 0) {
      // If there are immediate reminders, show the reminder modal
      showModalManually();
    } else {
      // If no immediate reminders, show all follow-ups
      setShowAllFollowUps(true);
    }
  };

  // Don't render anything if loading or no user
  if (isLoading || !userId) {
    return null;
  }

  // Calculate total count (immediate reminders + today's notifications)
  const totalCount = reminders.length + todayNotificationCount;

  // Header version - just the bell icon for the header
  if (isHeaderVersion) {
    return (
      <>
        <button
          onClick={handleBellClick}
          className="p-2 rounded-full text-gray-600 hover:bg-gray-100 relative transition-colors"
          title={totalCount > 0 ? `${totalCount} notification${totalCount !== 1 ? 's' : ''} - ${reminders.length} immediate reminder${reminders.length !== 1 ? 's' : ''}, ${todayNotificationCount} today's notification${todayNotificationCount !== 1 ? 's' : ''} - Click to view` : 'Click to view all follow-ups'}
        >
          <i className={`fas fa-bell ${totalCount > 0 ? 'text-red-600 animate-pulse' : ''}`}></i>
          {totalCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {totalCount > 99 ? '99+' : totalCount}
            </span>
          )}
        </button>

        {/* Reminder Modal for immediate reminders */}
        <ReminderModal
          isOpen={showModal}
          onClose={hideModal}
          reminders={reminders}
          userRole={userRole}
          onMarkSent={markReminderAsSent}
        />

        {/* All Follow-ups Modal */}
        <AllFollowUpsModal
          isOpen={showAllFollowUps}
          onClose={() => setShowAllFollowUps(false)}
          userId={userId}
          userRole={userRole}
        />
      </>
    );
  }

  // Original floating version for dashboard
  return (
    <>
      {/* Notification Bell - Show when there are reminders but modal is not open */}
      {totalCount > 0 && !showModal && (
        <div className="fixed top-4 right-4 z-40">
          <button
            onClick={handleBellClick}
            className="relative bg-red-600 text-white p-3 rounded-full shadow-lg hover:bg-red-700 transition-colors animate-pulse"
            title={`${totalCount} notification${totalCount !== 1 ? 's' : ''} - ${reminders.length} immediate reminder${reminders.length !== 1 ? 's' : ''}, ${todayNotificationCount} today's notification${todayNotificationCount !== 1 ? 's' : ''}`}
          >
            <span className="text-xl">🔔</span>
            {totalCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-yellow-400 text-red-800 text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                {totalCount > 99 ? '99+' : totalCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Reminder Modal */}
      <ReminderModal
        isOpen={showModal}
        onClose={hideModal}
        reminders={reminders}
        userRole={userRole}
        onMarkSent={markReminderAsSent}
      />
    </>
  );
};

export default DashboardReminderNotification;
