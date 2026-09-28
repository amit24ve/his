import React, { useState, useEffect } from 'react';
import { formatDateTime } from '../../utils/dateUtils';

const AllFollowUpsModal = ({ isOpen, onClose, userId, userRole }) => {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, upcoming, today, overdue
  const [sortBy, setSortBy] = useState('scheduled_date'); // scheduled_date, created_at, status
  const [updatingStatus, setUpdatingStatus] = useState(null); // Track which followup is being updated

  useEffect(() => {
    if (isOpen && userId) {
      fetchAllFollowUps();
    }
  }, [isOpen, userId, userRole]);

  const fetchAllFollowUps = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Always use the all followups endpoint as requested
      const endpoint = 'https://cubehis.avopay.pro:5000/api/followups/all';

      console.log('Fetching follow-ups from:', endpoint);
      console.log('User role:', userRole, 'User ID:', userId);

      const response = await fetch(endpoint, { headers });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - Please login again');
        } else if (response.status === 403) {
          throw new Error('Access denied - Insufficient permissions');
        } else {
          throw new Error(`Failed to fetch follow-ups: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log('Follow-ups response:', data);

      // Ensure data is an array
      if (Array.isArray(data)) {
        setFollowUps(data);
      } else if (data && Array.isArray(data.followups)) {
        setFollowUps(data.followups);
      } else if (data && Array.isArray(data.data)) {
        setFollowUps(data.data);
      } else {
        setFollowUps([]);
      }
    } catch (err) {
      setError(err.message || 'Error loading follow-ups');
      console.error('Error fetching follow-ups:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsCompleted = async (followUpId) => {
    setUpdatingStatus(followUpId);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`https://cubehis.avopay.pro:5000/api/followups/${followUpId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'completed' })
      });

      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.status} ${response.statusText}`);
      }

      // Update the local state
      setFollowUps(prev => prev.map(f =>
        f._id === followUpId
          ? { ...f, status: 'completed' }
          : f
      ));

    } catch (err) {
      console.error('Error updating follow-up status:', err);
      alert('Failed to mark as completed: ' + err.message);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getFilteredFollowUps = () => {
    if (!followUps.length) return [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let filtered = followUps;

    switch (filter) {
      case 'today':
        filtered = followUps.filter(f => {
          const scheduledDate = new Date(f.scheduled_date);
          return scheduledDate >= today && scheduledDate < tomorrow;
        });
        break;
      case 'upcoming':
        filtered = followUps.filter(f => {
          const scheduledDate = new Date(f.scheduled_date);
          return scheduledDate >= now;
        });
        break;
      case 'overdue':
        filtered = followUps.filter(f => {
          const scheduledDate = new Date(f.scheduled_date);
          return scheduledDate < now && f.status !== 'completed';
        });
        break;
      default:
        filtered = followUps;
    }

    // Sort the filtered results
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'scheduled_date':
          return new Date(a.scheduled_date) - new Date(b.scheduled_date);
        case 'created_at':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return new Date(a.scheduled_date) - new Date(b.scheduled_date);
      }
    });
  };

  const getFilterCounts = () => {
    if (!followUps.length) return { all: 0, today: 0, upcoming: 0, overdue: 0 };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      all: followUps.length,
      today: followUps.filter(f => {
        const scheduledDate = new Date(f.scheduled_date);
        return scheduledDate >= today && scheduledDate < tomorrow;
      }).length,
      upcoming: followUps.filter(f => {
        const scheduledDate = new Date(f.scheduled_date);
        return scheduledDate >= now;
      }).length,
      overdue: followUps.filter(f => {
        const scheduledDate = new Date(f.scheduled_date);
        return scheduledDate < now && f.status !== 'completed';
      }).length
    };
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

  const getStatusColor = (status, scheduledDate) => {
    const isOverdue = new Date(scheduledDate) < new Date() && status !== 'completed';

    if (isOverdue) {
      return 'bg-red-100 text-red-800 border-red-300';
    }

    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-300',
      rescheduled: 'bg-blue-100 text-blue-800 border-blue-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getPriorityColor = (scheduledDate) => {
    const now = new Date();
    const scheduled = new Date(scheduledDate);
    const diffHours = (scheduled - now) / (1000 * 60 * 60);

    if (diffHours < 0) return 'text-red-600'; // Overdue
    if (diffHours <= 1) return 'text-orange-600'; // Within 1 hour
    if (diffHours <= 24) return 'text-yellow-600'; // Within 24 hours
    return 'text-green-600'; // Future
  };

  const filteredFollowUps = getFilteredFollowUps();
  const filterCounts = getFilterCounts();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                � All Follow-up Schedules
              </h2>
              <p className="text-indigo-100 mt-1">
                {userRole === 'admin' || userRole === 'Admin'
                  ? 'All follow-ups across organization'
                  : 'All follow-ups from the system'} • Total: {followUps.length}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-indigo-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-2">
              <label className="text-sm font-medium text-gray-700">Filter:</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="all">All ({filterCounts.all})</option>
                <option value="today">Today ({filterCounts.today})</option>
                <option value="upcoming">Upcoming ({filterCounts.upcoming})</option>
                <option value="overdue">Overdue ({filterCounts.overdue})</option>
              </select>
            </div>

            <div className="flex gap-2">
              <label className="text-sm font-medium text-gray-700">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="scheduled_date">Schedule Date</option>
                <option value="created_at">Created Date</option>
                <option value="status">Status</option>
              </select>
            </div>

            <div className="ml-auto text-sm text-gray-600">
              Showing {filteredFollowUps.length} of {followUps.length} follow-ups
            </div>
          </div>

          {/* Quick Stats */}
          {followUps.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                Completed: {followUps.filter(f => f.status === 'completed').length}
              </span>
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                Pending: {followUps.filter(f => f.status === 'pending').length}
              </span>
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                Overdue: {followUps.filter(f => new Date(f.scheduled_date) < new Date() && f.status !== 'completed').length}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading follow-ups...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-600 font-semibold">{error}</p>
              <button
                onClick={fetchAllFollowUps}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filteredFollowUps.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3a4 4 0 118 0v4h-8z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" />
                </svg>
              </div>
              <p className="text-gray-500">No follow-ups found for the selected filter</p>
              <div className="mt-4 text-sm text-gray-400">
                <p>Total follow-ups in system: {followUps.length}</p>
                <p>Current filter: {filter}</p>
                <p>User Role: {userRole}</p>
                <p>User ID: {userId}</p>
              </div>
              <button
                onClick={fetchAllFollowUps}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                Refresh Data
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredFollowUps.map((followUp, index) => (
                <div
                  key={followUp._id || index}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getTypeIcon(followUp.type)}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {followUp.customer_name || followUp.lead_name || followUp.lead?.company_name || 'Unknown Lead'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {followUp.lead?.contact_person || followUp.customer_name || 'Contact'} • {followUp.customer_phone || followUp.lead?.phone || 'No phone'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(followUp.status, followUp.scheduled_date)}`}>
                        {followUp.status?.toUpperCase() || 'PENDING'}
                      </span>
                      <div className={`text-sm font-semibold mt-1 ${getPriorityColor(followUp.scheduled_date)}`}>
                        {formatDateTime(followUp.scheduled_date)}
                      </div>
                      {userRole === 'admin' && followUp.assigned_to && (
                        <p className="text-xs text-gray-500 mt-1">
                          Assigned to: {followUp.assigned_to}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Scheduled:</span>
                        <span className={`ml-1 font-medium ${getPriorityColor(followUp.scheduled_date)}`}>
                          {formatDateTime(followUp.scheduled_date)}
                        </span>
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Type:</span> {followUp.type?.replace('_', ' ').toUpperCase()}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Created:</span> {formatDateTime(followUp.created_at)}
                      </p>
                      {followUp.lead_id && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Lead ID:</span> {followUp.lead_id}
                        </p>
                      )}
                    </div>
                  </div>

                  {followUp.notes && (
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Notes:</span> {followUp.notes}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end mt-3 space-x-2">
                    {followUp.lead_id && (
                      <button
                        onClick={() => {
                          window.open(`/leads/${followUp.lead_id}`, '_blank');
                        }}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        View Lead
                      </button>
                    )}

                    {followUp.status === 'pending' && (
                      <button
                        className={`px-3 py-1 text-xs rounded transition-colors ${updatingStatus === followUp._id
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        onClick={() => markAsCompleted(followUp._id)}
                        disabled={updatingStatus === followUp._id}
                      >
                        {updatingStatus === followUp._id ? 'Updating...' : 'Mark Complete'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
          >
            Close
          </button>
          <button
            onClick={fetchAllFollowUps}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default AllFollowUpsModal;
