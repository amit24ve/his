/**
 * HR API Utilities
 * 
 * This file provides consistent API calling functions for HR components
 */

// Import constants from hrConstants
import { API_BASE_URL } from './hrConstants';

/**
 * Get authentication token from storage
 * @returns {string|null} The authentication token or null if not found
 */
export const getAuthToken = () => {
  return localStorage.getItem('access_token') || 
         localStorage.getItem('token') ||
         sessionStorage.getItem('token');
};

/**
 * Make an authenticated API request
 * @param {string} endpoint - API endpoint (will be appended to base URL)
 * @param {object} options - Fetch options
 * @returns {Promise<any>} Response data
 */
export const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error('Authentication token not found');
  }
  
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  // Handle authentication errors
  if (response.status === 401 || response.status === 403) {
    console.error('Authentication error:', response.status);
    throw new Error('Unauthorized: You may need to log in again');
  }
  
  // For other errors
  if (!response.ok) {
    console.error('API error:', response.status, response.statusText);
    const errorText = await response.text();
    console.error('Error details:', errorText);
    throw new Error(`API request failed: ${response.statusText}`);
  }
  
  // Try to parse response as JSON
  try {
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error parsing response as JSON:', error);
    throw new Error('Invalid JSON response from server');
  }
};

/**
 * Fetch attendance data
 * @param {object} filters - Attendance filters
 * @returns {Promise<Array>} Attendance records
 */
export const fetchAttendance = async (filters = {}) => {
  const queryParams = new URLSearchParams();
  
  // Add filters to query params
  if (filters.date) queryParams.append('date', filters.date);
  if (filters.department) queryParams.append('department', filters.department);
  if (filters.employee) queryParams.append('employee', filters.employee);
  if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);
  if (filters.page) queryParams.append('page', filters.page);
  if (filters.limit) queryParams.append('limit', filters.limit);
  
  // Default to page 1, limit 100 if not provided
  if (!filters.page) queryParams.append('page', '1');
  if (!filters.limit) queryParams.append('limit', '100');
  
  const endpoint = `/api/hr/attendance?${queryParams.toString()}`;
  
  try {
    const result = await apiRequest(endpoint);
    return result.data || [];
  } catch (error) {
    console.error('Error fetching attendance:', error);
    throw error;
  }
};

/**
 * Fetch employee data
 * @returns {Promise<Array>} Employee records
 */
export const fetchEmployees = async () => {
  try {
    const result = await apiRequest('/api/employees');
    return result || [];
  } catch (error) {
    console.error('Error fetching employees:', error);
    throw error;
  }
};

/**
 * Fetch leave requests
 * @param {string} userId - User ID (optional)
 * @param {string} role - User role ('admin', 'hr', or 'employee')
 * @returns {Promise<Array>} Leave requests
 */
export const fetchLeaveRequests = async (userId, role = 'employee') => {
  try {
    let endpoint;
    
    // For regular employees, only show their own leave requests
    if (role !== 'admin' && role !== 'hr' && userId) {
      endpoint = `/api/hr/leave-requests?employee_id=${encodeURIComponent(userId)}&page=1&limit=100`;
    } else {
      // For HR/Admin, show all leave requests
      endpoint = `/api/hr/leave-requests?page=1&limit=100`;
    }
    
    console.log('Fetching leave requests from endpoint:', endpoint);
    const result = await apiRequest(endpoint);
    console.log('Raw API response:', result);
    
    // Ensure we return an array in a consistent format
    if (result && result.data && Array.isArray(result.data)) {
      return result.data;
    } else if (result && result.requests && Array.isArray(result.requests)) {
      return result.requests;
    } else if (Array.isArray(result)) {
      return result;
    }
    
    // If we couldn't parse the response as an array, return empty array
    console.warn('Could not find leave requests array in API response');
    return [];
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    
    // Try alternative endpoint if the first one failed
    try {
      console.log('Trying alternative leave requests endpoint format');
      
      let altEndpoint;
      if (role !== 'admin' && role !== 'hr' && userId) {
        altEndpoint = `/api/employees/${encodeURIComponent(userId)}/leave-requests`;
      } else {
        altEndpoint = `/api/employees/leave-requests?current_user_id=${encodeURIComponent(userId)}&current_user_roles=${encodeURIComponent(role)}`;
      }
      
      const result = await apiRequest(altEndpoint);
      // Parse the result similar to the first attempt
      if (result && result.data && Array.isArray(result.data)) {
        return result.data;
      } else if (result && result.requests && Array.isArray(result.requests)) {
        return result.requests;
      } else if (Array.isArray(result)) {
        return result;
      }
      
      // Return empty array as fallback
      return [];
    } catch (altError) {
      console.error('Alternative endpoint also failed:', altError);
      // Don't throw the error, just return empty array
      return [];
    }
  }
  
  // Ensure we always return an array
  return [];
};

/**
 * Handle leave request action (approve/reject)
 * @param {string} leaveRequestId - ID of leave request
 * @param {string} action - Action to take ('approve' or 'reject')
 * @param {string} reason - Reason for action
 * @returns {Promise<object>} Result of action
 */
export const handleLeaveAction = async (leaveRequestId, action, reason) => {
  try {
    const endpoint = `/api/hr/leave-requests/${leaveRequestId}/${action}`;
    const result = await apiRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ reason })
    });
    return result;
  } catch (error) {
    console.error(`Error ${action}ing leave request:`, error);
    throw error;
  }
};

/**
 * Create a new leave request
 * @param {object} leaveData - Leave request data
 * @returns {Promise<object>} Created leave request
 */
export const createLeaveRequest = async (leaveData) => {
  try {
    const endpoint = `/api/hr/leave-requests`;
    const result = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(leaveData)
    });
    return result;
  } catch (error) {
    console.error('Error creating leave request:', error);
    throw error;
  }
};

/**
 * Fetch user profile details
 * @param {string} userId - User ID
 * @returns {Promise<object>} User profile data
 */
export const fetchUserProfile = async (userId) => {
  try {
    const endpoint = `/api/employees/${userId}`;
    const result = await apiRequest(endpoint);
    return result;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {object} profileData - Profile data to update
 * @returns {Promise<object>} Updated profile data
 */
export const updateUserProfile = async (userId, profileData) => {
  try {
    const endpoint = `/api/employees/${userId}`;
    const result = await apiRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
    return result;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

/**
 * Change user password
 * @param {object} passwordData - Password change data
 * @returns {Promise<object>} Result of password change
 */
export const changeUserPassword = async (passwordData) => {
  try {
    const endpoint = `/api/auth/change-password`;
    const result = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(passwordData)
    });
    return result;
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

/**
 * Mark attendance (check-in/check-out)
 * @param {object} attendanceData - Attendance data
 * @returns {Promise<object>} Result of attendance marking
 */
export const markAttendance = async (attendanceData) => {
  try {
    // First try the hr/attendance/checkin endpoint
    const endpoint = `/api/hr/attendance/checkin`;
    console.log('Attempting check-in with endpoint:', endpoint);
    console.log('Check-in data:', attendanceData);
    
    try {
      const result = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(attendanceData)
      });
      console.log('Check-in successful with hr endpoint:', result);
      return result;
    } catch (hrError) {
      console.warn('HR endpoint failed, trying staff endpoint:', hrError);
      
      // Fallback to staff/attendance endpoint if hr endpoint fails
      const fallbackEndpoint = `/api/staff/attendance`;
      const fallbackResult = await apiRequest(fallbackEndpoint, {
        method: 'POST',
        body: JSON.stringify(attendanceData)
      });
      console.log('Check-in successful with staff endpoint:', fallbackResult);
      return fallbackResult;
    }
  } catch (error) {
    console.error('Error marking attendance (both endpoints failed):', error);
    throw error;
  }
};

/**
 * Edit attendance record
 * @param {string} recordId - Attendance record ID
 * @param {object} updatedData - Updated attendance data
 * @returns {Promise<object>} Updated attendance record
 */
export const editAttendanceRecord = async (recordId, updatedData) => {
  try {
    const endpoint = `/api/hr/attendance/${recordId}`;
    const result = await apiRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(updatedData)
    });
    return result;
  } catch (error) {
    console.error('Error editing attendance record:', error);
    throw error;
  }
};

/**
 * Create manual attendance record
 * @param {object} data - Attendance data
 * @returns {Promise<object>} Created attendance record
 */
export const createManualAttendance = async (data) => {
  try {
    // Using the checkin endpoint which appears to be the correct one for creating attendance
    const endpoint = `/api/hr/attendance/checkin`;
    const result = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return result;
  } catch (error) {
    console.error('Error creating manual attendance:', error);
    throw error;
  }
};

/**
 * Fetch dashboard statistics
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<object>} Dashboard statistics
 */
export const fetchDashboardStats = async (userId, role = 'employee') => {
  try {
    const isAdmin = role === 'admin' || role === 'hr';
    const endpoint = isAdmin 
      ? `/api/hr/dashboard/stats` 
      : `/api/hr/dashboard/employee/${userId}/stats`;
      
    const result = await apiRequest(endpoint);
    return result.data || result || {};
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
};

/**
 * Create a new employee
 * @param {object} employeeData - Employee data
 * @returns {Promise<object>} Created employee
 */
export const createEmployee = async (employeeData) => {
  try {
    const endpoint = `/api/hr/employees`;
    const result = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(employeeData)
    });
    return result;
  } catch (error) {
    console.error('Error creating employee:', error);
    throw error;
  }
};

/**
 * Update an existing employee
 * @param {string} employeeId - Employee ID
 * @param {object} employeeData - Updated employee data
 * @returns {Promise<object>} Updated employee
 */
export const updateEmployee = async (employeeId, employeeData) => {
  try {
    const endpoint = `/api/hr/employees/${employeeId}`;
    const result = await apiRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(employeeData)
    });
    return result;
  } catch (error) {
    console.error('Error updating employee:', error);
    throw error;
  }
};

/**
 * Fetch leads assigned to an employee
 * @param {string} employeeId - Employee ID
 * @returns {Promise<Array>} Leads assigned to employee
 */
export const fetchEmployeeLeads = async (employeeId) => {
  try {
    const endpoint = `/api/hr/employees/${employeeId}/leads`;
    const result = await apiRequest(endpoint);
    return result.data || result || [];
  } catch (error) {
    console.error('Error fetching employee leads:', error);
    return [];
  }
};

/**
 * Fetch documents for an employee
 * @param {string} employeeId - Employee ID
 * @returns {Promise<Array>} Employee documents
 */
export const fetchEmployeeDocuments = async (employeeId) => {
  try {
    const endpoint = `/api/hr/employees/${employeeId}/documents`;
    const result = await apiRequest(endpoint);
    return result.data || result || [];
  } catch (error) {
    console.error('Error fetching employee documents:', error);
    return [];
  }
};

/**
 * Upload document for an employee
 * @param {FormData} formData - Form data with file and document info
 * @returns {Promise<object>} Uploaded document
 */
export const uploadDocument = async (formData) => {
  try {
    const endpoint = `/api/hr/documents/upload`;
    
    // Remove Content-Type header to allow browser to set it with boundary
    const result = await apiRequest(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        // Remove Content-Type to let browser set it with proper boundary
      }
    });
    return result;
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
};
