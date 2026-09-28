import React, { useState, useEffect } from 'react';
import { formatDateTime } from '../../utils/dateUtils';

const RemindersDashboard = ({ userRole, userId }) => {
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timeWindow, setTimeWindow] = useState(60); // minutes
  const [filter, setFilter] = useState('all'); // all, pending, overdue

  const REMINDERS_API = 'https://cubehis.avopay.pro:5000/api/followups';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchReminders = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let url;
      if (userRole === 'admin') {
        url = `${REMINDERS_API}/reminders/all/admin?window_minutes=${timeWindow}`;
      } else {
        url = `${REMINDERS_API}/reminders/${userId}?window_minutes=${timeWindow}`;
      }

      const response = await fetch(url, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setReminders(Array.isArray(data) ? data : []);

    } catch (err) {
      console.error('Error fetching reminders:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const markReminderAsSent = async (reminderId) => {
    try {
      const response = await fetch(`${REMINDERS_API}/${reminderId}/mark-sent`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Remove the reminder from the list
      setReminders(prev => prev.filter(r => r.id !== reminderId));

    } catch (err) {
      console.error('Error marking reminder as sent:', err);
      alert('Failed to mark reminder as sent');
    }
  };

  const getFilteredReminders = () => {
    const now = new Date();

    return reminders.filter(reminder => {
      const scheduledDate = new Date(reminder.scheduled_date);

      switch (filter) {
        case 'pending':
          return scheduledDate > now;
        case 'overdue':
          return scheduledDate <= now;
        case 'all':
        default:
          return true;
      }
    });
  };

  const getTypeIcon = (type) => {
    const icons = {
      call: '📞',
      email: '📧',
      meeting: '🤝',
      site_visit: '💻',
      other: '📋'
    };
    return icons[type] || '📋';
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
      rescheduled: 'bg-blue-100 text-blue-800 border-blue-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getTimeStatus = (scheduledDate) => {
    const now = new Date();
    const scheduled = new Date(scheduledDate);
    const diffMinutes = Math.floor((scheduled - now) / (1000 * 60));

    if (diffMinutes < 0) {
      return { text: `Overdue by ${Math.abs(diffMinutes)} min`, color: 'text-red-600 font-bold' };
    } else if (diffMinutes <= 10) {
      return { text: `Due in ${diffMinutes} min`, color: 'text-orange-600 font-bold' };
    } else {
      return { text: `Due in ${diffMinutes} min`, color: 'text-green-600' };
    }
  };

  useEffect(() => {
    if (userId) {
      fetchReminders();
    }
  }, [userId, timeWindow]);

  const filteredReminders = getFilteredReminders();

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          🔔 Follow-up Reminders Dashboard
        </h2>
        <button
          onClick={fetchReminders}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {isLoading ? 'Refreshing...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Time Window:</label>
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(Number(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded text-sm"
          >
            <option value={10}>Next 10 minutes</option>
            <option value={30}>Next 30 minutes</option>
            <option value={60}>Next 1 hour</option>
            <option value={120}>Next 2 hours</option>
            <option value={1440}>Next 24 hours</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Filter:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="all">All Reminders</option>
            <option value="pending">Upcoming</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">Total: {reminders.length}</span>
          <span className="text-gray-600">Filtered: {filteredReminders.length}</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {/* Reminders List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading reminders...</p>
        </div>
      ) : filteredReminders.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-6xl mb-4 opacity-50">🔔</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Reminders</h3>
          <p className="text-gray-500">
            {filter === 'all'
              ? 'No follow-up reminders in the selected time window.'
              : `No ${filter} reminders found.`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReminders.map((reminder, index) => {
            const timeStatus = getTimeStatus(reminder.scheduled_date);

            return (
              <div
                key={reminder.id || index}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getTypeIcon(reminder.type)}</span>
                        <div>
                          <h3 className="font-semibold text-lg text-gray-800 capitalize">
                            {reminder.type} Follow-up
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(reminder.status)}`}
                            >
                              {reminder.status.toUpperCase()}
                            </span>
                            <span className="text-sm text-gray-500">
                              Lead: {reminder.lead_id}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-800">
                          📅 {formatDateTime(reminder.scheduled_date)}
                        </div>
                        <div className={`text-sm mt-1 ${timeStatus.color}`}>
                          {timeStatus.text}
                        </div>
                      </div>
                    </div>

                    {/* Lead Info */}
                    {(reminder.lead_name || reminder.lead_phone) && (
                      <div className="bg-blue-50 rounded p-3 mb-3">
                        <h4 className="font-medium text-blue-800 mb-1">Lead Information</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {reminder.lead_name && (
                            <div>
                              <span className="text-blue-600 font-medium">Name:</span> {reminder.lead_name}
                            </div>
                          )}
                          {reminder.lead_phone && (
                            <div>
                              <span className="text-blue-600 font-medium">Phone:</span>
                              <a
                                href={`tel:${reminder.lead_phone}`}
                                className="text-blue-700 hover:underline ml-1"
                              >
                                {reminder.lead_phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Remarks */}
                    {reminder.remarks && (
                      <div className="mb-3">
                        <h4 className="font-medium text-gray-700 mb-1">Remarks:</h4>
                        <p className="text-gray-600 text-sm bg-gray-50 p-2 rounded">
                          {reminder.remarks}
                        </p>
                      </div>
                    )}

                    {/* Assignment Info */}
                    {userRole === 'admin' && reminder.assigned_to && (
                      <div className="text-sm text-gray-600 mb-3">
                        👤 Assigned to: <span className="font-medium">{reminder.assigned_to}</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-500">
                        Created: {formatDateTime(reminder.created_at)}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => markReminderAsSent(reminder.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm transition-colors"
                        >
                          ✓ Mark as Notified
                        </button>
                        {reminder.lead_phone && (
                          <a
                            href={`tel:${reminder.lead_phone}`}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm transition-colors"
                          >
                            📞 Call Now
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RemindersDashboard;
