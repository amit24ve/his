import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';

const HRStaffModuleNew = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({});
  const [myAttendance, setMyAttendance] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const navigate = useNavigate();

  // Login function
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const response = await fetch('https://cubehis.avopay.pro:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: loginCredentials.username,
          password: loginCredentials.password
        })
      });

      if (response.ok) {
        const result = await response.json();

        // Store the token
        if (result.access_token) {
          localStorage.setItem('access_token', result.access_token);
          localStorage.setItem('user', JSON.stringify({
            user_id: result.user_id || loginCredentials.username,
            username: loginCredentials.username,
            full_name: result.full_name || result.name || loginCredentials.username,
            email: result.email || '',
            roles: result.roles || ['employee']
          }));

          setShowLogin(false);
          setLoginCredentials({ username: '', password: '' });

          // Retry fetching user data
          await fetchCurrentUser();
        } else {
          setLoginError('Invalid response from server');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setLoginError(errorData.detail || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Network error. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    setShowLogin(true);
    setActiveTab('dashboard');
  };

  // Fetch current user data
  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) throw new Error('No token');

      const response = await fetch('https://cubehis.avopay.pro:5000/api/employees/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.employee) {
          setCurrentUser({
            ...result.employee,
            roles: result.employee.role ? [result.employee.role] : [],
            id: result.employee.id || result.employee.employee_id
          });
        } else {
          throw new Error('Invalid API response');
        }
      } else {
        throw new Error('API request failed');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      // Fallback to localStorage
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setCurrentUser({
            id: user.user_id || user.id || user._id || 'unknown',
            employee_id: user.user_id || user.id || 'unknown',
            full_name: user.full_name || user.username || 'Unknown User',
            name: user.full_name || user.username || 'Unknown User',
            email: user.email || '',
            phone: user.phone || '',
            department: user.department || '',
            position: user.position || '',
            roles: user.roles || [],
            role: user.role || 'employee'
          });
        } catch {
          // If parsing fails, try to get from access token or default
          const token = localStorage.getItem('access_token');
          if (token) {
            // Try to extract user info from token payload (if it's a JWT)
            try {
              const base64Url = token.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
              }).join(''));
              const tokenData = JSON.parse(jsonPayload);

              setCurrentUser({
                id: tokenData.user_id || tokenData.sub || 'unknown',
                employee_id: tokenData.user_id || tokenData.sub || 'unknown',
                full_name: tokenData.full_name || 'Unknown User',
                name: tokenData.full_name || 'Unknown User',
                email: tokenData.email || '',
                phone: '',
                department: '',
                position: '',
                roles: tokenData.roles || [],
                role: 'employee'
              });
            } catch {
              setCurrentUser({
                id: 'unknown',
                employee_id: 'unknown',
                full_name: 'Unknown User',
                name: 'Unknown User',
                email: '',
                phone: '',
                department: '',
                position: '',
                roles: [],
                role: 'employee'
              });
            }
          } else {
            setCurrentUser({
              id: 'unknown',
              employee_id: 'unknown',
              full_name: 'Unknown User',
              name: 'Unknown User',
              email: '',
              phone: '',
              department: '',
              position: '',
              roles: [],
              role: 'employee'
            });
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Check if user has specific permission
  const hasPermission = (permission) => {
    if (!currentUser || !currentUser.roles) return false;
    const roles = Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.roles];
    return roles.some(role =>
      typeof role === 'string'
        ? role.toLowerCase().includes('admin') || role.toLowerCase().includes('hr')
        : (role.name && (role.name.toLowerCase().includes('admin') || role.name.toLowerCase().includes('hr')))
    );
  };

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://cubehis.avopay.pro:5000/api/employees/dashboard-stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Handle both formats - result.stats or direct properties
          const stats = result.stats || result;
          setDashboardStats(stats);
        } else {
          console.error('API error:', result.message);
          setDashboardStats({});
        }
      } else {
        console.error('HTTP error:', response.status);
        setDashboardStats({});
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setDashboardStats({});
    }
  };

  // Fetch employees list
  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://cubehis.avopay.pro:5000/api/employees?page=1&limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setEmployees(result.employees || result.data || []);
        } else {
          console.error('API error:', result.message);
          setEmployees([]);
        }
      } else {
        console.error('HTTP error:', response.status);
        setEmployees([]);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
    }
  };

  // Fetch my attendance records
  const fetchMyAttendance = async () => {
    if (!currentUser?.id) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`https://cubehis.avopay.pro:5000/api/employees/${currentUser.id}/attendance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setMyAttendance(result.records || result.data || []);
        } else {
          console.error('API error:', result.message);
          setMyAttendance([]);
        }
      } else {
        console.error('HTTP error:', response.status);
        setMyAttendance([]);
      }
    } catch (error) {
      console.error('Error fetching my attendance:', error);
      setMyAttendance([]);
    }
  };

  // Handle check-in/check-out for current user
  const handleAttendanceAction = async (action) => {
    if (!currentUser?.id) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`https://cubehis.avopay.pro:5000/api/employees/${currentUser.id}/attendance/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: `${action} by ${currentUser.full_name || currentUser.name}`,
          location: 'Office'
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || `${action === 'checkin' ? 'Checked in' : 'Checked out'} successfully!`);
        fetchMyAttendance(); // Refresh attendance data
        fetchDashboardStats(); // Refresh stats
        fetchEmployees(); // Refresh employee list to update status
      } else {
        const error = await response.json();
        alert(error.detail || `Failed to ${action}`);
      }
    } catch (error) {
      console.error(`Error during ${action}:`, error);
      alert(`Failed to ${action}`);
    }
  };

  // Handle check-in/check-out for other employees (managers and HR)
  const handleEmployeeAttendanceAction = async (employeeId, action) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`https://cubehis.avopay.pro:5000/api/employees/${employeeId}/attendance/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: `${action} by manager: ${currentUser.full_name || currentUser.name}`,
          location: 'Office'
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || `Employee ${action === 'checkin' ? 'checked in' : 'checked out'} successfully!`);
        fetchEmployees(); // Refresh employee list to update status
      } else {
        const error = await response.json();
        alert(error.detail || `Failed to ${action} employee`);
      }
    } catch (error) {
      console.error(`Error during employee ${action}:`, error);
      alert(`Failed to ${action} employee`);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchDashboardStats();
      fetchEmployees();
      fetchMyAttendance();
    }
  }, [currentUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Dashboard Component
  const Dashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Employees</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardStats.total_employees || 0}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <i className="fas fa-users text-blue-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Present Today</p>
              <p className="text-2xl font-bold text-green-600">{dashboardStats.present_today || 0}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <i className="fas fa-check-circle text-green-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Absent Today</p>
              <p className="text-2xl font-bold text-red-600">{dashboardStats.absent_today || 0}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <i className="fas fa-times-circle text-red-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Leaves</p>
              <p className="text-2xl font-bold text-yellow-600">{dashboardStats.pending_leaves || 0}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <i className="fas fa-calendar-alt text-yellow-600"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => handleAttendanceAction('checkin')}
            className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <i className="fas fa-sign-in-alt text-green-600 text-xl mb-2"></i>
            <span className="text-sm font-medium text-green-700">Check In</span>
          </button>

          <button
            onClick={() => handleAttendanceAction('checkout')}
            className="flex flex-col items-center p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <i className="fas fa-sign-out-alt text-red-600 text-xl mb-2"></i>
            <span className="text-sm font-medium text-red-700">Check Out</span>
          </button>

          <button
            onClick={() => setActiveTab('employees')}
            className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <i className="fas fa-users text-blue-600 text-xl mb-2"></i>
            <span className="text-sm font-medium text-blue-700">Manage Employees</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <i className="fas fa-clock text-purple-600 text-xl mb-2"></i>
            <span className="text-sm font-medium text-purple-700">View Attendance</span>
          </button>
        </div>
      </div>

      {/* Recent Attendance */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">My Recent Attendance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {myAttendance.slice(0, 5).map((record, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(record.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.check_in_time || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.check_out_time || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${record.status === 'present'
                        ? 'bg-green-100 text-green-800'
                        : record.status === 'absent'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                      {record.status || 'Unknown'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Employee Management Component
  const EmployeeManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
        {hasPermission('hr') && (
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <i className="fas fa-plus mr-2"></i>Add Employee
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee, index) => (
                <tr key={employee.id || index}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <i className="fas fa-user text-gray-600"></i>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {employee.full_name || employee.name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {employee.employee_id || 'No ID'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {employee.email || 'No email'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {Array.isArray(employee.roles)
                      ? employee.roles.join(', ')
                      : employee.roles || employee.role || 'No role'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {employee.department || 'No department'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${employee.is_active !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                      }`}>
                      {employee.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${employee.attendance_status?.status === 'present'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                          }`}>
                          {employee.attendance_status?.status || 'absent'}
                        </span>
                      </div>
                      {employee.can_manage_attendance && (
                        <div className="flex space-x-1">
                          {employee.attendance_status?.can_checkin && (
                            <button
                              onClick={() => handleEmployeeAttendanceAction(employee.user_id, 'checkin')}
                              className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                              title="Check In"
                            >
                              In
                            </button>
                          )}
                          {employee.attendance_status?.can_checkout && (
                            <button
                              onClick={() => handleEmployeeAttendanceAction(employee.user_id, 'checkout')}
                              className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                              title="Check Out"
                            >
                              Out
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-900">
                        <i className="fas fa-eye"></i>
                      </button>
                      {hasPermission('hr') && (
                        <>
                          <button className="text-green-600 hover:text-green-900">
                            <i className="fas fa-edit"></i>
                          </button>
                          <button className="text-red-600 hover:text-red-900">
                            <i className="fas fa-trash"></i>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Attendance Management Component
  const AttendanceManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Attendance Management</h2>
        <div className="flex space-x-2">
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
            <i className="fas fa-download mr-2"></i>Export
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <i className="fas fa-calendar-plus mr-2"></i>Mark Attendance
          </button>
        </div>
      </div>

      {/* Attendance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Present</p>
              <p className="text-3xl font-bold text-green-600">{dashboardStats.present_today || 0}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <i className="fas fa-user-check text-green-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Absent</p>
              <p className="text-3xl font-bold text-red-600">{dashboardStats.absent_today || 0}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <i className="fas fa-user-times text-red-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">On Leave</p>
              <p className="text-3xl font-bold text-yellow-600">{dashboardStats.on_leave_today || 0}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <i className="fas fa-calendar-times text-yellow-600 text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* My Attendance Detail */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">My Attendance History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Working Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {myAttendance.map((record, index) => {
                const checkIn = record.check_in_time ? new Date(`1970-01-01T${record.check_in_time}`) : null;
                const checkOut = record.check_out_time ? new Date(`1970-01-01T${record.check_out_time}`) : null;
                const workingHours = checkIn && checkOut
                  ? ((checkOut - checkIn) / (1000 * 60 * 60)).toFixed(2)
                  : '-';

                return (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(record.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.check_in_time || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.check_out_time || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {workingHours} hours
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${record.status === 'present'
                          ? 'bg-green-100 text-green-800'
                          : record.status === 'absent'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {record.status || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Profile Management Component
  const ProfileManagement = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">My Profile</h2>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start space-x-6">
          <div className="flex-shrink-0">
            <div className="h-24 w-24 rounded-full bg-gray-300 flex items-center justify-center">
              <i className="fas fa-user text-gray-600 text-3xl"></i>
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {currentUser?.full_name || 'Unknown User'}
              </h3>
              <p className="text-gray-600">{currentUser?.email || 'No email'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                <p className="mt-1 text-sm text-gray-900">{currentUser?.employee_id || currentUser?.id || 'N/A'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Department</label>
                <p className="mt-1 text-sm text-gray-900">{currentUser?.department || 'Not assigned'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <p className="mt-1 text-sm text-gray-900">
                  {Array.isArray(currentUser?.roles)
                    ? currentUser.roles.join(', ')
                    : currentUser?.roles || 'No role assigned'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Join Date</label>
                <p className="mt-1 text-sm text-gray-900">
                  {currentUser?.join_date
                    ? new Date(currentUser.join_date).toLocaleDateString()
                    : 'Not available'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documents Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">My Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
            <i className="fas fa-file-upload text-gray-400 text-3xl mb-2"></i>
            <p className="text-sm text-gray-600">Upload Documents</p>
          </div>
        </div>
      </div>

      {/* Leave Requests Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">My Leave Requests</h3>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <i className="fas fa-plus mr-2"></i>Request Leave
          </button>
        </div>

        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-calendar-alt text-4xl mb-2"></i>
          <p>No leave requests found</p>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'chart-pie', component: Dashboard },
    { id: 'employees', label: 'Employees', icon: 'users', component: EmployeeManagement },
    { id: 'attendance', label: 'Attendance', icon: 'clock', component: AttendanceManagement },
    { id: 'profile', label: 'My Profile', icon: 'user', component: ProfileManagement },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || Dashboard;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">HR & Staff Management</h1>
              <p className="text-gray-600">Welcome back, {currentUser?.full_name || 'User'}</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <i className={`fas fa-${tab.icon}`}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default HRStaffModuleNew;
