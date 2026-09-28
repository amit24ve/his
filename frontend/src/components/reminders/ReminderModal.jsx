import React, { useState, useEffect } from 'react';
import { formatDateTime } from '../../utils/dateUtils';
import AllFollowUpsModal from './AllFollowUpsModal';

const ReminderModal = ({ isOpen, onClose, reminders, userRole, onMarkSent }) => {
  const [showAllFollowUps, setShowAllFollowUps] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // Get user ID from localStorage
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setUserId(user.user_id || user.id);
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
  }, []);

  if (!isOpen || !reminders || reminders.length === 0) {
    return null;
  }

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

  const handleMarkAsSent = async (reminderId) => {
    try {
      await onMarkSent(reminderId);
    } catch (error) {
      console.error('Error marking reminder as sent:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                🔔 Follow-up Reminders
              </h2>
              <p className="text-blue-100 mt-1">
                {reminders.length} reminder{reminders.length !== 1 ? 's' : ''} within the next 10 minutes
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="space-y-4">
            {reminders.map((reminder, index) => (
              <div
                key={reminder.id || index}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow duration-200 bg-gradient-to-r from-white to-gray-50"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {/* Header Row */}
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
                              Lead ID: {reminder.lead_id}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-red-600">
                          🕐 {formatDateTime(reminder.scheduled_date)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {userRole === 'admin' && reminder.assigned_to && (
                            <span>Assigned to: {reminder.assigned_to}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Lead Information */}
                    {reminder.lead_name && (
                      <div className="bg-blue-50 rounded-lg p-3 mb-3">
                        <h4 className="font-medium text-blue-800 mb-1">Lead Information</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-blue-600 font-medium">Name:</span> {reminder.lead_name}
                          </div>
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

                    {/* Actions */}
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-500">
                        Created: {formatDateTime(reminder.created_at)}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMarkAsSent(reminder.id)}
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
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                💡 These reminders are shown 10 minutes before the scheduled time
              </div>
              <button
                onClick={() => setShowAllFollowUps(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors text-sm"
              >
                📅 View All Follow-ups
              </button>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* All Follow-ups Modal */}
      <AllFollowUpsModal
        isOpen={showAllFollowUps}
        onClose={() => setShowAllFollowUps(false)}
        userId={userId}
        userRole={userRole}
      />
    </div>
  );
};

export default ReminderModal;
