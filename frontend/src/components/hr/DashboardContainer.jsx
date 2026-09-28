import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import EmployeeDashboard from './EmployeeDashboard';
import AttendanceManagement from './AttendanceManagement';
import LeaveManagement from './LeaveManagement';

const API_BASE_URL = 'https://cubehis.avopay.pro:5000';

const DashboardContainer = () => {
  // State Management
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({});
  const [myAttendance, setMyAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [allEmployeeAttendance, setAllEmployeeAttendance] = useState([]);

  // User Role Information
  const [isAdmin, setIsAdmin] = useState(false);
  const [isHR, setIsHR] = useState(false);

  // Initialize and load data
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Load data after authentication
  useEffect(() => {
    if (currentUser) {
      checkUserRoles();
      fetchEmployees();
      fetchDashboardStats();
      fetchAttendance();
      fetchLeaveRequests();
    }
  }, [currentUser]);

  // Check user roles and set permissions
  const checkUserRoles = () => {
    if (!currentUser) return;

    // Admin check
    const hasAdminRole =
      (currentUser.role || '').toLowerCase() === 'admin' ||
      (Array.isArray(currentUser.roles) && currentUser.roles.some(r => r.toLowerCase().includes('admin'))) ||
      !currentUser.reports_to ||
      currentUser.reports_to === null;

    // HR check
    const hasHRRole =
      (currentUser.role || '').toLowerCase().includes('hr') ||
      (currentUser.role || '').toLowerCase().includes('human resource') ||
      (Array.isArray(currentUser.roles) && currentUser.roles.some(r => r.toLowerCase().includes('hr')));

    setIsAdmin(hasAdminRole);
    setIsHR(hasHRRole);

    console.log('🔒 User Role Check - Admin:', hasAdminRole, 'HR:', hasHRRole);
  };

  // Helper for permission checks
  const hasPermission = (role) => {
    if (role === 'admin') return isAdmin;
    if (role === 'hr') return isHR;
    return false;
  };

  // Fetch current user information
  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setCurrentUser(userData);
        console.log('👤 Current user loaded:', userData);
      } else {
        console.error('Failed to fetch current user');
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching current user:', error);
      setLoading(false);
    }
  };

  // Fetch employees list (excluding customers)
  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      console.log('📡 Fetching employees');
      const response = await fetch(`${API_BASE_URL}/api/users/?except_role=customer`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();

        // Filter out customers
        const filteredEmployees = Array.isArray(result)
          ? result.filter(emp => !((emp.role || '').toLowerCase() === 'customer'))
          : [];

        setEmployees(filteredEmployees);
        console.log(`✅ ${filteredEmployees.length} employees loaded`);
      } else {
        console.error('Failed to fetch employees');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      // Use the unified endpoint for dashboard stats
      const response = await fetch(`${API_BASE_URL}/api/employees/dashboard-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setDashboardStats(result);
        console.log('📊 Dashboard stats loaded:', result);
      } else {
        console.error('Failed to fetch dashboard stats');
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  // Fetch attendance records
  const fetchAttendance = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      // Use the unified attendance endpoint
      const response = await fetch(`${API_BASE_URL}/api/employees/attendance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();

        // Process based on access level
        if (result.access_level === 'admin_hr') {
          // Admin/HR: Process all attendance records
          let allAttendance = [];

          result.records.forEach(employeeData => {
            if (employeeData.attendance_records && Array.isArray(employeeData.attendance_records)) {
              employeeData.attendance_records.forEach(record => {
                allAttendance.push({
                  ...record,
                  employee_details: employeeData.employee_details,
                  employee_name: employeeData.employee_details?.full_name || record.employee_name
                });
              });
            }
          });

          setAllEmployeeAttendance(allAttendance);

          // Set current user's attendance also
          const currentUserId = currentUser.user_id || currentUser.id;
          const userRecord = result.records.find(r => r.employee_id === currentUserId);
          if (userRecord) {
            setMyAttendance(userRecord.attendance_records || []);
          }
        } else if (result.access_level === 'personal') {
          // Regular employee: Just store their own attendance
          setMyAttendance(result.attendance_records || []);
        }

        console.log('✅ Attendance data loaded');
      } else {
        console.error('Failed to fetch attendance data');
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  // Fetch leave requests
  const fetchLeaveRequests = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      // Use the unified leave endpoint
      const response = await fetch(`${API_BASE_URL}/api/employees/leave-requests-unified`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();

        if (result.success) {
          setLeaveRequests(result.data || []);
          console.log('✅ Leave requests loaded');
        }
      } else {
        console.error('Failed to fetch leave requests');
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    }
  };

  // Check-in handler
  const handleCheckIn = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const userId = currentUser.user_id || currentUser.id;

      const response = await fetch(`${API_BASE_URL}/api/employees/attendance/checkin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_id: userId,
          date: new Date().toISOString().split('T')[0],
          status: 'present'
        })
      });

      if (response.ok) {
        alert('Check-in recorded successfully!');
        fetchAttendance(); // Refresh attendance data
      } else {
        alert('Failed to record check-in');
      }
    } catch (error) {
      console.error('Error during check-in:', error);
      alert('Error during check-in');
    }
  };

  // Check-out handler
  const handleCheckOut = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const userId = currentUser.user_id || currentUser.id;

      const response = await fetch(`${API_BASE_URL}/api/employees/attendance/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_id: userId,
          date: new Date().toISOString().split('T')[0]
        })
      });

      if (response.ok) {
        alert('Check-out recorded successfully!');
        fetchAttendance(); // Refresh attendance data
      } else {
        alert('Failed to record check-out');
      }
    } catch (error) {
      console.error('Error during check-out:', error);
      alert('Error during check-out');
    }
  };

  // Leave request approval handler
  const handleLeaveApproval = async (requestId, action, reason) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const endpoint = action === 'approve'
        ? `${API_BASE_URL}/api/employees/leave-requests/${requestId}/approve`
        : `${API_BASE_URL}/api/employees/leave-requests/${requestId}/reject`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        alert(`Leave request ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
        fetchLeaveRequests(); // Refresh leave data
      } else {
        alert(`Failed to ${action} leave request`);
      }
    } catch (error) {
      console.error(`Error ${action}ing leave request:`, error);
      alert(`Error ${action}ing leave request`);
    }
  };

  // Submit leave request handler
  const handleSubmitLeaveRequest = async (leaveData) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/employees/leave-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(leaveData)
      });

      if (response.ok) {
        alert('Leave request submitted successfully!');
        fetchLeaveRequests(); // Refresh leave data
      } else {
        alert('Failed to submit leave request');
      }
    } catch (error) {
      console.error('Error submitting leave request:', error);
      alert('Error submitting leave request');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-3 text-gray-700">Loading dashboard...</p>
      </div>
    );
  }

  // Not authenticated state
  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-red-500 text-xl mb-4">Please log in to access the dashboard</div>
        <button
          onClick={() => window.location.href = '/login'}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Navigation Header */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="text-xl font-bold text-blue-600">CRM</div>
            <nav className="hidden md:flex space-x-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Dashboard
              </button>

              <button
                onClick={() => setActiveTab('attendance')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'attendance' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Attendance
              </button>

              <button
                onClick={() => setActiveTab('leaves')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'leaves' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Leave Management
              </button>

              {(isAdmin || isHR) && (
                <button
                  onClick={() => setActiveTab('employees')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'employees' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Employees
                </button>
              )}
            </nav>
          </div>

          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-700">
              {currentUser.full_name || currentUser.name || currentUser.username}
            </div>
            <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-600 font-medium">
              {(currentUser.full_name || currentUser.name || currentUser.username || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="container mx-auto p-4">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {(isAdmin || isHR) ? (
              <Dashboard
                dashboardStats={dashboardStats}
                employees={employees}
                hasPermission={hasPermission}
              />
            ) : (
              <EmployeeDashboard
                userDetails={currentUser}
                userAttendance={myAttendance}
                userLeaves={leaveRequests.filter(leave => leave.user_id === (currentUser.user_id || currentUser.id))}
                userActivities={[]} // TODO: Add user activities if available
              />
            )}
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <AttendanceManagement
            currentUser={currentUser}
            myAttendance={myAttendance}
            allAttendance={allEmployeeAttendance}
            employees={employees}
            handleCheckIn={handleCheckIn}
            handleCheckOut={handleCheckOut}
            isAdminOrHR={isAdmin || isHR}
          />
        )}

        {/* Leave Management Tab */}
        {activeTab === 'leaves' && (
          <LeaveManagement
            currentUser={currentUser}
            leaveRequests={leaveRequests}
            handleSubmitLeaveRequest={handleSubmitLeaveRequest}
            handleLeaveApproval={handleLeaveApproval}
            isAdminOrHR={isAdmin || isHR}
          />
        )}

        {/* Employees Tab (Admin/HR Only) */}
        {activeTab === 'employees' && (isAdmin || isHR) && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
                <p className="text-gray-600 mt-1">Manage all employees in the organization</p>
              </div>
            </div>

            {/* Employee Management UI goes here */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4">
                <p className="text-gray-500">Employee management functionality will be integrated here.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardContainer;
