import React, { useEffect, useState } from "react";
import { getAuthHeaders } from "../../utils/authAPI";
import { getLeadActivities } from "../../api/leadAPI";

const API_BASE = "https://cubehis.avopay.pro:5000/api";

export default function LeadActivityTimeline({ leadId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Helper function to get status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'new': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'contacted': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'qualified': return 'bg-green-100 text-green-800 border-green-200';
      case 'converted': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'lost': return 'bg-red-100 text-red-800 border-red-200';
      case 'followup': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'follow_up': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'detail-shared': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'detail_shared': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'in_progress': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Helper function to get action icon based on activity_type
  const getActionIcon = (activityType) => {
    switch (activityType?.toLowerCase()) {
      case 'lead_updated':
        return <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>;
      case 'status_changed':
        return <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>;
      case 'assignment_changed':
        return <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" /></svg>;
      case 'note_updated':
      case 'note_added':
        return <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>;
      case 'stage_changed':
        return <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;
      case 'contact_attempt':
        return <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>;
      case 'follow_up_scheduled':
      case 'meeting_scheduled':
        return <svg className="w-4 h-4 text-teal-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>;
      case 'email_sent':
        return <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>;
      default:
        return <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>;
    }
  };

  // Helper function to format activity title
  const getActivityTitle = (activityType) => {
    switch (activityType?.toLowerCase()) {
      case 'lead_updated':
        return 'Lead Updated';
      case 'status_changed':
        return 'Status Changed';
      case 'assignment_changed':
        return 'Assignment Changed';
      case 'note_updated':
      case 'note_added':
        return 'Note Added';
      case 'stage_changed':
        return 'Stage Changed';
      case 'contact_attempt':
        return 'Contact Attempt';
      case 'follow_up_scheduled':
        return 'Follow-up Scheduled';
      case 'meeting_scheduled':
        return 'Meeting Scheduled';
      case 'email_sent':
        return 'Email Sent';
      default:
        return activityType?.split('_').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ') || 'Activity';
    }
  };

  // Helper function to format status display
  const formatStatus = (status) => {
    if (!status) return status;
    return status.replace(/[-_]/g, ' ').split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Helper function to format date and time
  const formatDateTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return dateString;
    }
  };

  // Function to fetch activities
  const fetchActivities = async () => {
    setLoading(true);
    setError("");

    try {
      // Use the leadAPI utility with JWT authentication for proper auth handling
      const params = {
        page: page,
        limit: limit,
        exclude_imports: true
      };

      if (leadId) {
        params.lead_id = leadId;
      }

      console.log("Fetching all activities with auth headers");

      // Use the getLeadActivities function that includes JWT authentication
      const json = await getLeadActivities(params);
      console.log("Activities response:", json);

      // Handle the new response structure from backend
      let activitiesData = [];
      if (json && json.data && Array.isArray(json.data)) {
        activitiesData = json.data;
      } else if (Array.isArray(json)) {
        activitiesData = json;
      }

      console.log("All activities count:", activitiesData.length);

      // Show all activities (no additional filtering)
      setActivities(activitiesData);
      setTotal(json.total || activitiesData.length);

    } catch (err) {
      console.error("Error fetching activities:", err);
      setError("Failed to load activities: " + err.message);
      setActivities([]);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  };

  // Initial load and pagination changes
  useEffect(() => {
    fetchActivities();
  }, [leadId, page, limit]);
  if (loading) return (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
      <p className="mt-2 text-gray-600">Loading activities...</p>
    </div>
  );

  if (error) return (
    <div className="text-center py-8">
      <div className="text-red-500 mb-4">{error}</div>
      <button
        onClick={() => fetchActivities()}
        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        Retry
      </button>
    </div>
  );

  if (!activities.length) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Status Update Activities</h2>
              <p className="text-sm text-gray-600 mt-1">
                Status change timeline • Only showing lead status updates
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchActivities()}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
        <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-lg">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-600 font-medium">No status update activities found</p>
          <p className="text-gray-500 text-sm">Status update activities will appear here when lead statuses are changed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">            <div>
          <h2 className="text-xl font-bold text-gray-900">Status Update Activities</h2>
          <p className="text-sm text-gray-600 mt-1">
            {activities.length} status updates • Last updated {formatDateTime(lastRefresh.toISOString())}
          </p>
        </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchActivities()}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {activities.map((activity) => (
          <div key={activity.lead_id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-all duration-200">
            {/* Header with icon and status badge */}
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full border-2 border-green-200">
                    <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Status Updated
                    </h3>
                    <p className="text-sm text-gray-600 font-medium">
                      {formatDateTime(activity.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {activity.metadata?.new_status && (
                    <span className={`px-4 py-2 text-sm font-semibold rounded-full border-2 ${getStatusColor(activity.metadata.new_status)}`}>
                      {formatStatus(activity.metadata.new_status)}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    by {activity.created_by || 'system'}
                  </span>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="p-6">
              {/* Lead Information Card */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-blue-900 mb-2">Lead Information</h4>
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-xs text-blue-600 font-medium">Lead ID:</span>
                        <p className="text-sm font-mono text-blue-800">{activity.lead_id}</p>
                      </div>
                      {activity.lead_info?.name && (
                        <div>
                          <span className="text-xs text-blue-600 font-medium">Name:</span>
                          <p className="text-sm font-semibold text-blue-900">{activity.lead_info.name}</p>
                        </div>
                      )}
                      {activity.lead_info?.email && (
                        <div>
                          <span className="text-xs text-blue-600 font-medium">Email:</span>
                          <p className="text-sm text-blue-800">{activity.lead_info.email}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Change - Main Focus */}
              {activity.metadata?.old_status && activity.metadata?.new_status && (
                <div className="mb-6">
                  <h4 className="text-base font-bold text-gray-900 mb-4">Status Change</h4>
                  <div className="flex items-center justify-center p-6 bg-gradient-to-r from-orange-50 via-yellow-50 to-green-50 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <span className={`inline-block px-4 py-3 text-base font-bold rounded-xl border-2 ${getStatusColor(activity.metadata.old_status)}`}>
                          {formatStatus(activity.metadata.old_status)}
                        </span>
                        <p className="text-xs text-gray-600 mt-2 font-medium">FROM</p>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <span className={`inline-block px-4 py-3 text-base font-bold rounded-xl border-2 shadow-sm ${getStatusColor(activity.metadata.new_status)}`}>
                          {formatStatus(activity.metadata.new_status)}
                        </span>
                        <p className="text-xs text-gray-600 mt-2 font-medium">TO</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes Section */}
              {activity.description && (
                <div className="mb-6">
                  <div className="p-5 bg-amber-50 border-l-4 border-amber-400 rounded-r-xl">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-amber-600 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div className="flex-1">
                        <h5 className="text-sm font-bold text-amber-900 mb-2">Notes</h5>
                        <p className="text-sm text-amber-800 leading-relaxed">{activity.description}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Activity Footer */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      {formatDateTime(activity.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                      {activity.created_by || 'system'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">
                    ID: {activity.lead_id}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-center mt-6">
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-md">
              Page {page} of {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(total / limit)}
              className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}