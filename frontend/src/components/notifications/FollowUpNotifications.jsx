import React, { useState, useEffect } from 'react';
import { formatDateTime } from '../../utils/dateUtils';

const FollowUpNotifications = ({ userId, userRole }) => {
  const [notifications, setNotifications] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    showOverdue: true,
    showWithin1Hour: true,
    showWithin4Hours: true,
    showWithin24Hours: false,
    autoRefresh: true
  });

  useEffect(() => {
    // Load notification settings from localStorage
    const savedSettings = localStorage.getItem('followupNotificationSettings');
    if (savedSettings) {
      try {
        setNotificationSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Error loading notification settings:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetchPendingFollowUps();

      // Auto-refresh every 5 minutes if enabled
      if (notificationSettings.autoRefresh) {
        const interval = setInterval(fetchPendingFollowUps, 5 * 60 * 1000);
        return () => clearInterval(interval);
      }
    }
  }, [userId, userRole, notificationSettings.autoRefresh]);

  const fetchPendingFollowUps = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch('https://cubehis.avopay.pro:5000/api/followups/all', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      const followups = Array.isArray(data) ? data : data.followups || data.data || [];

      // Filter for pending followups (not completed)
      const pendingFollowUps = followups.filter(f =>
        f.status !== 'completed' &&
        !dismissedNotifications.has(f._id)
      );

      // Sort by scheduled date (most urgent first)
      const sortedFollowUps = pendingFollowUps.sort((a, b) =>
        new Date(a.scheduled_date) - new Date(b.scheduled_date)
      );

      // Get followups due within configured time windows
      const now = new Date();
      const urgentFollowUps = sortedFollowUps.filter(f => {
        const scheduledDate = new Date(f.scheduled_date);
        const diffHours = (scheduledDate - now) / (1000 * 60 * 60);

        if (diffHours < 0 && notificationSettings.showOverdue) return true;
        if (diffHours <= 1 && notificationSettings.showWithin1Hour) return true;
        if (diffHours <= 4 && notificationSettings.showWithin4Hours) return true;
        if (diffHours <= 24 && notificationSettings.showWithin24Hours) return true;

        return false;
      });

      if (urgentFollowUps.length > 0) {
        setNotifications(urgentFollowUps);
        setIsVisible(true);
      }
    } catch (error) {
      console.error('Error fetching followup notifications:', error);
    }
  };

  const updateNotificationSettings = (newSettings) => {
    setNotificationSettings(newSettings);
    localStorage.setItem('followupNotificationSettings', JSON.stringify(newSettings));

    // Re-fetch notifications with new settings
    fetchPendingFollowUps();
  };

  const dismissNotification = (notificationId) => {
    setDismissedNotifications(prev => new Set([...prev, notificationId]));
    setNotifications(prev => prev.filter(n => n._id !== notificationId));

    if (notifications.length <= 1) {
      setIsVisible(false);
    }
  };

  const dismissAllNotifications = () => {
    setDismissedNotifications(prev => new Set([...prev, ...notifications.map(n => n._id)]));
    setNotifications([]);
    setIsVisible(false);
  };

  const getUrgencyColor = (scheduledDate) => {
    const now = new Date();
    const scheduled = new Date(scheduledDate);
    const diffHours = (scheduled - now) / (1000 * 60 * 60);

    if (diffHours < 0) return 'bg-red-100 border-red-500 text-red-800'; // Overdue
    if (diffHours <= 1) return 'bg-orange-100 border-orange-500 text-orange-800'; // Within 1 hour
    if (diffHours <= 4) return 'bg-yellow-100 border-yellow-500 text-yellow-800'; // Within 4 hours
    return 'bg-blue-100 border-blue-500 text-blue-800'; // Within 24 hours
  };

  const getUrgencyIcon = (scheduledDate) => {
    const now = new Date();
    const scheduled = new Date(scheduledDate);
    const diffHours = (scheduled - now) / (1000 * 60 * 60);

    if (diffHours < 0) return '🚨'; // Overdue
    if (diffHours <= 1) return '⚠️'; // Within 1 hour
    if (diffHours <= 4) return '⏰'; // Within 4 hours
    return '📅'; // Within 24 hours
  };

  const getTypeIcon = (type) => {
    const icons = {
      call: '📞',
      email: '📧',
      meeting: '🤝',
      site_visit: '🏢',
      other: '📋'
    };
    return icons[type] || '📋';
  };

  if (notifications.length === 0) return null;

  // If notifications exist but popup is closed, show a minimized notification indicator
  if (!isVisible) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-red-500 hover:bg-red-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-colors animate-bounce"
          title={`${notifications.length} pending follow-up${notifications.length !== 1 ? 's' : ''} - Click to view`}
        >
          <div className="relative">
            <span className="text-lg">🔔</span>
            <span className="absolute -top-1 -right-1 bg-white text-red-500 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {notifications.length > 9 ? '9+' : notifications.length}
            </span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md w-full">
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="text-xl">🔔</span>
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </div>
              <h3 className="font-semibold">
                Pending Follow-ups ({notifications.length})
              </h3>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-white hover:text-blue-200 text-sm px-2 py-1 rounded transition-colors"
                title="Notification settings"
              >
                ⚙️
              </button>
              <button
                onClick={dismissAllNotifications}
                className="text-white hover:text-blue-200 text-sm px-2 py-1 rounded transition-colors"
                title="Dismiss all"
              >
                Clear All
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="text-white hover:text-blue-200 transition-colors"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-gray-50 border-b border-gray-200 p-4">
            <h4 className="font-medium text-gray-900 mb-3">Notification Settings</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notificationSettings.showOverdue}
                  onChange={(e) => updateNotificationSettings({
                    ...notificationSettings,
                    showOverdue: e.target.checked
                  })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Show overdue follow-ups</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notificationSettings.showWithin1Hour}
                  onChange={(e) => updateNotificationSettings({
                    ...notificationSettings,
                    showWithin1Hour: e.target.checked
                  })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Show follow-ups within 1 hour</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notificationSettings.showWithin4Hours}
                  onChange={(e) => updateNotificationSettings({
                    ...notificationSettings,
                    showWithin4Hours: e.target.checked
                  })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Show follow-ups within 4 hours</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notificationSettings.showWithin24Hours}
                  onChange={(e) => updateNotificationSettings({
                    ...notificationSettings,
                    showWithin24Hours: e.target.checked
                  })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Show follow-ups within 24 hours</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notificationSettings.autoRefresh}
                  onChange={(e) => updateNotificationSettings({
                    ...notificationSettings,
                    autoRefresh: e.target.checked
                  })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Auto-refresh every 5 minutes</span>
              </label>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="max-h-96 overflow-y-auto">
          {notifications.map((notification, index) => (
            <div
              key={notification._id || index}
              className={`p-4 border-l-4 ${getUrgencyColor(notification.scheduled_date)} ${index < notifications.length - 1 ? 'border-b border-gray-200' : ''
                }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{getUrgencyIcon(notification.scheduled_date)}</span>
                    <span className="text-lg">{getTypeIcon(notification.type)}</span>
                    <span className="font-medium text-gray-900">
                      {notification.customer_name || notification.lead_name || 'Unknown Customer'}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 mb-1">
                    <strong>Scheduled:</strong> {formatDateTime(notification.scheduled_date)}
                  </div>

                  {notification.customer_phone && (
                    <div className="text-sm text-gray-600 mb-1">
                      <strong>Phone:</strong> {notification.customer_phone}
                    </div>
                  )}

                  <div className="text-sm text-gray-600 mb-1">
                    <strong>Type:</strong> {notification.type?.replace('_', ' ').toUpperCase()}
                  </div>

                  {notification.remarks && (
                    <div className="text-sm text-gray-600">
                      <strong>Notes:</strong> {notification.remarks}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => dismissNotification(notification._id)}
                  className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Dismiss"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Quick Actions */}
              <div className="mt-3 flex gap-2">
                {notification.lead_id && (
                  <button
                    onClick={() => {
                      window.open(`/leads/${notification.lead_id}`, '_blank');
                    }}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    View Lead
                  </button>
                )}

                {/* <button
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('access_token');
                      await fetch(`https://cubehis.avopay.pro:5000/api/followups/${notification._id}/status`, {
                        method: 'PUT',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ status: 'completed' })
                      });
                      dismissNotification(notification._id);
                    } catch (error) {
                      console.error('Error marking as completed:', error);
                    }
                  }}
                  className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                >
                  Mark Complete
                </button> */}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-2 text-center">
          <button
            onClick={() => {
              // Open all followups modal or navigate to followups page
              const event = new CustomEvent('openAllFollowUps');
              window.dispatchEvent(event);
            }}
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            View All Follow-ups →
          </button>
        </div>
      </div>
    </div>
  );
};

export default FollowUpNotifications;
