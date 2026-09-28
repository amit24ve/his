import React, { useState, useEffect } from 'react';
import { 
  fetchLeaveRequests,
  handleLeaveAction as apiHandleLeaveAction, 
  createLeaveRequest as apiCreateLeaveRequest
} from '../../utils/hrAPI';
import { formatDate } from '../../utils/dateUtils';

const LeaveManagement = ({ 
  hasPermission, 
  user
}) => {
  const [loading, setLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveType, setLeaveType] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [processingActions, setProcessingActions] = useState(new Set()); // Track which actions are being processed
  const [newLeaveData, setNewLeaveData] = useState({
    start_date: '',
    end_date: '',
    reason: '',
    leave_type: 'casual'
  });
  
  // Available leave types
  const leaveTypes = [
    { value: 'casual', label: 'Casual Leave' },
    { value: 'sick', label: 'Sick Leave' },
    { value: 'annual', label: 'Annual Leave' },
    { value: 'unpaid', label: 'Unpaid Leave' },
    { value: 'other', label: 'Other' }
  ];
  
  // Load leave requests
  useEffect(() => {
    const loadLeaveData = async () => {
      setLoading(true);
      try {
        // Fetch leave requests from API
        const userId = user?.id || user?.user_id;
        const userRole = (hasPermission('admin') || hasPermission('hr')) ? 'admin' : 'employee';
        
        console.log('Fetching leave requests with userId:', userId, 'userRole:', userRole);
        const result = await fetchLeaveRequests(userId, userRole);
        console.log('Leave requests data:', result);
        
        // Debug the API response in more detail
        console.log('API response type:', typeof result);
        
        // Handle various response formats
        if (result) {
          if (result.data && Array.isArray(result.data)) {
            console.log('Setting leave requests from data property:', result.data.length);
            setLeaveRequests(result.data);
          } else if (result.requests && Array.isArray(result.requests)) {
            console.log('Setting leave requests from requests property:', result.requests.length);
            setLeaveRequests(result.requests);
          } else if (Array.isArray(result)) {
            console.log('Setting leave requests from direct array:', result.length);
            setLeaveRequests(result);
          } else {
            console.error('Unexpected API response format:', result);
            // Initialize with empty array to avoid rendering issues
            setLeaveRequests([]);
          }
        } else {
          console.error('No result returned from API');
          setLeaveRequests([]);
        }
      } catch (error) {
        console.error('Error loading leave data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadLeaveData();

    // Set up auto-refresh every 30 seconds for HR/Admin users
    let intervalId;
    if (hasPermission('admin') || hasPermission('hr')) {
      intervalId = setInterval(() => {
        console.log('Auto-refreshing leave data...');
        refreshLeaveData();
      }, 30000); // 30 seconds
    }

    // Cleanup interval on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [user, hasPermission]);
  
  // Filter leave requests based on user selection
  // Debug leave requests data
  console.log('LeaveRequests array:', leaveRequests);
  console.log('Leave type filter:', leaveType);
  console.log('Status filter:', statusFilter);
  
  const filteredLeaveRequests = leaveRequests?.filter(leave => {
    // Skip undefined leave items
    if (!leave) return false;
    
    // Debug each leave item to check structure
    console.log('Checking leave item:', leave);
    
    // Filter by leave type
    if (leaveType !== 'All' && leave.leave_type && leaveType) {
      // Try direct match first
      if (leave.leave_type.toLowerCase() !== leaveType.toLowerCase()) {
        // Then try includes match
        if (!leave.leave_type.toLowerCase().includes(leaveType.toLowerCase())) {
          return false;
        }
      }
    }
    
    // Filter by status
    if (statusFilter !== 'All' && leave.status && statusFilter) {
      if (leave.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
    }
    
    return true;
  });
  
  const handleCreateLeave = async () => {
    try {
      setLoading(true);
      
      // Add the user ID
      const leaveRequestData = {
        ...newLeaveData,
        user_id: user?.id || user?.user_id
      };
      
      console.log('Creating leave request:', leaveRequestData);
      await apiCreateLeaveRequest(leaveRequestData);
      
      // Refetch leave requests using the refresh function
      await refreshLeaveData();
      
      // Close form and reset
      setShowCreateForm(false);
      setNewLeaveData({
        start_date: '',
        end_date: '',
        reason: '',
        leave_type: 'casual'
      });
      
      alert('Leave request created successfully');
    } catch (error) {
      console.error('Error creating leave request:', error);
      alert('Error creating leave request');
    } finally {
      setLoading(false);
    }
  };
  
  const handleLeaveRequestAction = async (leaveId, action, reason = '') => {
    const actionKey = `${leaveId}-${action}`;
    
    try {
      // Add this action to processing set for button state management
      setProcessingActions(prev => new Set(prev).add(actionKey));
      
      console.log(`Processing ${action} for leave ID:`, leaveId);
      await apiHandleLeaveAction(leaveId, action, reason);
      
      // Refetch leave requests to get updated data
      await refreshLeaveData();
      
      alert(`Leave request ${action}d successfully`);
    } catch (error) {
      console.error(`Error ${action}ing leave request:`, error);
      alert(`Error ${action}ing leave request`);
    } finally {
      // Remove this action from processing set
      setProcessingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }
  };

  // Create a reusable function to refresh leave data
  const refreshLeaveData = async () => {
    try {
      const userId = user?.id || user?.user_id;
      const userRole = (hasPermission('admin') || hasPermission('hr')) ? 'admin' : 'employee';
      
      console.log('Refreshing leave data with userId:', userId, 'userRole:', userRole);
      const result = await fetchLeaveRequests(userId, userRole);
      console.log('Refreshed leave data:', result);
      
      // Handle various response formats
      if (result) {
        if (result.data && Array.isArray(result.data)) {
          console.log('Updated leave requests from data property:', result.data.length);
          setLeaveRequests(result.data);
        } else if (result.requests && Array.isArray(result.requests)) {
          console.log('Updated leave requests from requests property:', result.requests.length);
          setLeaveRequests(result.requests);
        } else if (Array.isArray(result)) {
          console.log('Updated leave requests from direct array:', result.length);
          setLeaveRequests(result);
        } else {
          console.error('Unexpected API response format during refresh:', result);
          setLeaveRequests([]);
        }
      } else {
        console.error('No result returned from API during refresh');
        setLeaveRequests([]);
      }
    } catch (error) {
      console.error('Error refreshing leave data:', error);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leave Management</h2>
          <p className="text-gray-600 mt-1">Manage employee leave requests</p>
        </div>
        
        <div className="flex space-x-3">
          {/* Manual refresh button for HR/Admin */}
          {(hasPermission('hr') || hasPermission('admin')) && (
            <button
              onClick={() => refreshLeaveData()}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center disabled:opacity-50"
              title="Refresh leave requests"
            >
              <i className={`fas fa-sync-alt mr-2 ${loading ? 'fa-spin' : ''}`}></i> 
              Refresh
            </button>
          )}
          
          {/* Only show create button for regular users */}
          {!hasPermission('hr') && !hasPermission('admin') && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
            >
              <i className="fas fa-plus-circle mr-2"></i> Request Leave
            </button>
          )}
        </div>
      </div>

      {/* Create Leave Request Form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Request Leave</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Leave Type</label>
                <select
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  value={newLeaveData.leave_type}
                  onChange={(e) => setNewLeaveData({...newLeaveData, leave_type: e.target.value})}
                >
                  {leaveTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  value={newLeaveData.start_date}
                  onChange={(e) => setNewLeaveData({...newLeaveData, start_date: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  value={newLeaveData.end_date}
                  onChange={(e) => setNewLeaveData({...newLeaveData, end_date: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Reason</label>
                <textarea
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  value={newLeaveData.reason}
                  onChange={(e) => setNewLeaveData({...newLeaveData, reason: e.target.value})}
                ></textarea>
              </div>
              
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={handleCreateLeave}
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Leave Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Leave Type</label>
            <select 
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
            >
              <option value="All">All Types</option>
              {leaveTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          
          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select 
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leave Requests List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Type</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr key="loading-row">
                <td colSpan="6" className="px-6 py-4 text-center">Loading...</td>
              </tr>
            ) : filteredLeaveRequests && filteredLeaveRequests.length > 0 ? (
              // Debug the number of items being rendered
              console.log('Rendering', filteredLeaveRequests.length, 'leave requests') || 
              filteredLeaveRequests.map((leave) => {
                if (!leave || typeof leave !== 'object') {
                  console.error('Invalid leave item:', leave);
                  return null; // Skip rendering this item
                }
                return (
                  <tr key={leave._id || `leave-${Math.random()}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                            <i className="fas fa-user"></i>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{leave.employee_name || leave.name || "Unknown"}</div>
                          <div className="text-xs text-gray-500">ID: {leave.user_id || leave.employee_id || "N/A"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${leave.leave_type?.toLowerCase().includes('casual') ? 'bg-blue-100 text-blue-800' : 
                        leave.leave_type?.toLowerCase().includes('sick') ? 'bg-red-100 text-red-800' :
                        leave.leave_type?.toLowerCase().includes('annual') ? 'bg-green-100 text-green-800' : 
                        'bg-purple-100 text-purple-800'}`}>
                        {leave.leave_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{formatDate(leave.start_date)}</div>
                      <div className="text-xs text-gray-400">to</div>
                      <div>{formatDate(leave.end_date)}</div>
                      <div className="text-xs font-semibold mt-1">{leave.days_requested} days</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="max-w-xs overflow-hidden text-ellipsis">{leave.reason}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${leave.status === 'approved' ? 'bg-green-100 text-green-800' : 
                        leave.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                        'bg-yellow-100 text-yellow-800'}`}>
                        {leave.status?.charAt(0).toUpperCase() + leave.status?.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {/* Show approval buttons only to HR/Admin and only for pending requests */}
                      {(hasPermission('hr') || hasPermission('admin')) && leave.status === 'pending' ? (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleLeaveRequestAction(leave._id, 'approve')}
                            disabled={processingActions.has(`${leave._id}-approve`) || processingActions.has(`${leave._id}-reject`)}
                            className={`${
                              processingActions.has(`${leave._id}-approve`) 
                                ? 'text-green-400 cursor-not-allowed' 
                                : 'text-green-600 hover:text-green-900'
                            }`}
                            title={processingActions.has(`${leave._id}-approve`) ? 'Processing...' : 'Approve'}
                          >
                            {processingActions.has(`${leave._id}-approve`) ? (
                              <i className="fas fa-spinner fa-spin"></i>
                            ) : (
                              <i className="fas fa-check-circle"></i>
                            )}
                          </button>
                          <button
                            onClick={() => handleLeaveRequestAction(leave._id, 'reject')}
                            disabled={processingActions.has(`${leave._id}-approve`) || processingActions.has(`${leave._id}-reject`)}
                            className={`${
                              processingActions.has(`${leave._id}-reject`) 
                                ? 'text-red-400 cursor-not-allowed' 
                                : 'text-red-600 hover:text-red-900'
                            }`}
                            title={processingActions.has(`${leave._id}-reject`) ? 'Processing...' : 'Reject'}
                          >
                            {processingActions.has(`${leave._id}-reject`) ? (
                              <i className="fas fa-spinner fa-spin"></i>
                            ) : (
                              <i className="fas fa-times-circle"></i>
                            )}
                          </button>
                        </div>
                      ) : (
                        // Show status icon for non-HR/Admin users or non-pending requests
                        <div>
                          {leave.status === 'approved' ? (
                            <span className="text-green-600"><i className="fas fa-check-circle"></i></span>
                          ) : leave.status === 'rejected' ? (
                            <span className="text-red-600"><i className="fas fa-times-circle"></i></span>
                          ) : (
                            <span className="text-yellow-500"><i className="fas fa-clock"></i></span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr key="no-data-row">
                <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                  No leave requests found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaveManagement;
