import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const HRStaffModuleComplete = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({});
  const [myAttendance, setMyAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState({ username: 'amit24', password: 'Amit@123' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Modal states
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showLeaveRequestModal, setShowLeaveRequestModal] = useState(false);
  const [showMarkAttendanceModal, setShowMarkAttendanceModal] = useState(false);
  const [showEmployeeDetailsModal, setShowEmployeeDetailsModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Form states
  const [employeeForm, setEmployeeForm] = useState({
    email: '',
    full_name: '',
    password: '',
    phone: '',
    department: '',
    position: '',
    role: 'employee',
    salary: '',
    location: '',
    shift: 'day',
    gender: ''
  });
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
    notes: ''
  });
  const [attendanceForm, setAttendanceForm] = useState({
    employee_id: '',
    action: 'checkin',
    notes: '',
    location: 'Office'
  });

  // Available options
  const [availableRoles, setAvailableRoles] = useState([]);
  const [formLoading, setFormLoading] = useState(false);

  const navigate = useNavigate();

  // Login function
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      // Try multiple login endpoints
      const endpoints = [
        'https://cubehis.avopay.pro:5000/api/auth/login',
        'https://cubehis.avopay.pro:5000/auth/login',
        'https://cubehis.avopay.pro:5000/login'
      ];

      let loginSuccess = false;

      for (const endpoint of endpoints) {
        try {
          // Try form data format
          const formResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              username: loginCredentials.username,
              password: loginCredentials.password
            })
          });

          if (formResponse.ok) {
            const result = await formResponse.json();
            if (result.access_token) {
              localStorage.setItem('access_token', result.access_token);
              if (result.user) {
                localStorage.setItem('user', JSON.stringify(result.user));
              }
              setShowLogin(false);
              fetchCurrentUser();
              loginSuccess = true;
              break;
            }
          }

          // Try JSON format if form data fails
          if (!loginSuccess) {
            const jsonResponse = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                username: loginCredentials.username,
                password: loginCredentials.password
              })
            });

            if (jsonResponse.ok) {
              const result = await jsonResponse.json();
              if (result.access_token) {
                localStorage.setItem('access_token', result.access_token);
                if (result.user) {
                  localStorage.setItem('user', JSON.stringify(result.user));
                }
                setShowLogin(false);
                fetchCurrentUser();
                loginSuccess = true;
                break;
              }
            }
          }
        } catch (endpointError) {
          console.error(`Error with endpoint ${endpoint}:`, endpointError);
          continue;
        }
      }

      if (!loginSuccess) {
        setLoginError('Login failed. Please check your credentials or try again later.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Network error. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Fetch available employee roles
  const fetchAvailableRoles = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch('https://cubehis.avopay.pro:5000/api/employees/roles', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAvailableRoles(result.role_list || []);
        }
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
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
      if (!token) {
        setShowLogin(true);
        setLoading(false);
        return;
      }

      // Try to get current user from users API
      const response = await fetch('https://cubehis.avopay.pro:5000/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.user) {
          setCurrentUser({
            ...result.user,
            id: result.user.user_id || result.user.id,
            employee_id: result.user.user_id || result.user.id,
            roles: result.user.roles || [],
            role: result.user.role || 'employee'
          });
          setShowLogin(false);
        } else {
          throw new Error('Invalid API response');
        }
      } else if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('access_token');
        setShowLogin(true);
      } else {
        throw new Error('API request failed');
      }
    } catch (error) {
      console.error('Error fetching user:', error);

      // Try fallback to localStorage
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
          setShowLogin(false);
        } catch {
          setShowLogin(true);
        }
      } else {
        setShowLogin(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Check if user has specific permission
  const hasPermission = (permission) => {
    if (!currentUser || !currentUser.roles) return false;
    const roles = Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.roles];
    return roles.some(role => {
      if (typeof role === 'string') {
        return role.toLowerCase().includes('admin') ||
          role.toLowerCase().includes('hr') ||
          role.toLowerCase().includes('hr_manager') ||
          role.toLowerCase().includes('human_resources');
      }
      return (role.name && (
        role.name.toLowerCase().includes('admin') ||
        role.name.toLowerCase().includes('hr') ||
        role.name.toLowerCase().includes('hr_manager') ||
        role.name.toLowerCase().includes('human_resources')
      ));
    });
  };

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      // Get employees list to calculate basic stats
      const employeesResponse = await fetch('https://cubehis.avopay.pro:5000/api/employees?page=1&limit=100', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      let stats = {
        total_employees: 0,
        present_today: 0,
        absent_today: 0,
        pending_leaves: 0,
        on_leave_today: 0
      };

      if (employeesResponse.ok) {
        const employeesResult = await employeesResponse.json();
        if (employeesResult.success) {
          const employeesList = employeesResult.data || employeesResult.employees || [];
          stats.total_employees = employeesList.length;

          // Calculate attendance stats from employee data
          employeesList.forEach(employee => {
            if (employee.attendance_status) {
              if (employee.attendance_status.status === 'present') {
                stats.present_today++;
              } else {
                stats.absent_today++;
              }
            } else {
              stats.absent_today++;
            }
          });
        }
      } else if (employeesResponse.status === 401) {
        setShowLogin(true);
        return;
      }

      // Try to get leave requests for pending count
      if (hasPermission('hr')) {
        try {
          const userRoles = Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.role || 'employee'];
          const rolesParam = userRoles.map(role => `current_user_roles=${encodeURIComponent(role)}`).join('&');

          const leaveResponse = await fetch(`https://cubehis.avopay.pro:5000/api/employees/leave-requests?current_user_id=${currentUser.id}&${rolesParam}&limit=100&status=pending`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (leaveResponse.ok) {
            const leaveResult = await leaveResponse.json();
            if (leaveResult.success) {
              stats.pending_leaves = (leaveResult.data || []).length;
            }
          }
        } catch (error) {
          console.error('Error fetching leave requests:', error);
        }
      }

      setDashboardStats(stats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  // Fetch employees list
  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      // Use the employees endpoint from your backend
      const response = await fetch('https://cubehis.avopay.pro:5000/api/employees?page=1&limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const employeesList = result.data || result.employees || [];
          setEmployees(employeesList);

          // Update total employees count in dashboard stats
          setDashboardStats(prevStats => ({
            ...prevStats,
            total_employees: employeesList.length
          }));
        }
      } else if (response.status === 401) {
        setShowLogin(true);
      } else {
        console.error('Failed to fetch employees:', response.status);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // Fetch my attendance records
  const fetchMyAttendance = async () => {
    if (!currentUser?.id) return;

    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      // Use the my-attendance endpoint with user_id query parameter
      const response = await fetch(`https://cubehis.avopay.pro:5000/api/employees/my-attendance?user_id=${currentUser.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setMyAttendance(result.data || []);
        }
      } else if (response.status === 401) {
        setShowLogin(true);
      }
    } catch (error) {
      console.error('Error fetching my attendance:', error);
    }
  };

  // Fetch leave requests
  const fetchLeaveRequests = async () => {
    if (!currentUser?.id) return;

    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      // Prepare user roles for API call
      const userRoles = Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.role || 'employee'];
      const rolesParam = userRoles.map(role => `current_user_roles=${encodeURIComponent(role)}`).join('&');

      // For HR users, fetch all leave requests; for regular users, their own requests
      const isHR = hasPermission('hr');
      const employeeIdParam = isHR ? '' : `&employee_id=${currentUser.id}`;

      const response = await fetch(`https://cubehis.avopay.pro:5000/api/employees/leave-requests?current_user_id=${currentUser.id}&${rolesParam}&limit=50${employeeIdParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setLeaveRequests(result.data || result.requests || []);
        } else {
          console.error('API returned error:', result.error || result.message);
        }
      } else if (response.status === 401) {
        setShowLogin(true);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch leave requests:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    }
  };

  // Handle leave request approval/rejection
  const handleLeaveAction = async (requestId, action) => {
    if (!currentUser?.id || !hasPermission('hr')) {
      alert('You do not have permission to perform this action');
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const userRoles = Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.role || 'employee'];
      const rolesParam = userRoles.map(role => `current_user_roles=${encodeURIComponent(role)}`).join('&');

      const response = await fetch(`https://cubehis.avopay.pro:5000/api/employees/leave-requests/${requestId}/${action}?current_user_id=${currentUser.id}&${rolesParam}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          approved_by: currentUser.id,
          comments: `${action === 'approve' ? 'Approved' : 'Rejected'} by ${currentUser.full_name || currentUser.name}`
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || `Leave request ${action}d successfully!`);
        fetchLeaveRequests(); // Refresh the list
      } else {
        const error = await response.json();
        alert(error.detail || error.message || `Failed to ${action} leave request`);
      }
    } catch (error) {
      console.error(`Error during leave ${action}:`, error);
      alert(`Failed to ${action} leave request`);
    }
  };

  // Create new employee (enhanced)
  const createEmployee = async (employeeData) => {
    if (!hasPermission('hr')) {
      alert('You do not have permission to create employees');
      return;
    }

    setFormLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://cubehis.avopay.pro:5000/api/employees/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...employeeData,
          is_active: true,
          date_of_joining: new Date().toISOString().split('T')[0]
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Employee created successfully! Employee ID: ${result.employee?.emp_id || 'Generated'}`);
        setShowAddEmployeeModal(false);
        setEmployeeForm({
          email: '',
          full_name: '',
          password: '',
          phone: '',
          department: '',
          position: '',
          role: 'employee',
          salary: '',
          location: '',
          shift: 'day',
          gender: ''
        });
        fetchEmployees();
        fetchDashboardStats();
        return result;
      } else {
        const error = await response.json();
        alert(error.detail || error.message || 'Failed to create employee');
        return null;
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      alert('Failed to create employee');
      return null;
    } finally {
      setFormLoading(false);
    }
  };

  // Update employee
  const updateEmployee = async (employeeId, updateData) => {
    if (!hasPermission('hr')) {
      alert('You do not have permission to update employees');
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`https://cubehis.avopay.pro:5000/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Employee updated successfully!');
        fetchEmployees(); // Refresh the list
        return result;
      } else {
        const error = await response.json();
        alert(error.detail || error.message || 'Failed to update employee');
        return null;
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      alert('Failed to update employee');
      return null;
    }
  };

  // Deactivate employee
  const deactivateEmployee = async (employeeId) => {
    if (!hasPermission('hr')) {
      alert('You do not have permission to deactivate employees');
      return;
    }

    if (!confirm('Are you sure you want to deactivate this employee?')) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`https://cubehis.avopay.pro:5000/api/employees/${employeeId}/deactivate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Employee deactivated successfully!');
        fetchEmployees(); // Refresh the list
      } else {
        const error = await response.json();
        alert(error.detail || error.message || 'Failed to deactivate employee');
      }
    } catch (error) {
      console.error('Error deactivating employee:', error);
      alert('Failed to deactivate employee');
    }
  };

  // Handle check-in/check-out for current user
  const handleAttendanceAction = async (action) => {
    if (!currentUser?.id) return;

    try {
      const token = localStorage.getItem('access_token');
      // Use the centralized checkin endpoint
      const response = await fetch('https://cubehis.avopay.pro:5000/api/employees/attendance/checkin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: currentUser.id,
          action: action,
          notes: `${action} by ${currentUser.full_name || currentUser.name}`,
          location: 'Office'
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || `${action === 'checkin' ? 'Checked in' : 'Checked out'} successfully!`);
        fetchMyAttendance();
        fetchDashboardStats();
        fetchEmployees();
      } else {
        const error = await response.json();
        alert(error.detail || `Failed to ${action}`);
      }
    } catch (error) {
      console.error(`Error during ${action}:`, error);
      alert(`Failed to ${action}`);
    }
  };

  // Handle check-in/check-out for other employees
  const handleEmployeeAttendanceAction = async (employeeId, action) => {
    try {
      const token = localStorage.getItem('access_token');
      // Use the centralized checkin endpoint for other employees
      const response = await fetch('https://cubehis.avopay.pro:5000/api/employees/attendance/checkin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: employeeId,
          action: action,
          notes: `${action} by manager: ${currentUser.full_name || currentUser.name}`,
          location: 'Office'
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || `Employee ${action === 'checkin' ? 'checked in' : 'checked out'} successfully!`);
        fetchEmployees();
      } else {
        const error = await response.json();
        alert(error.detail || `Failed to ${action} employee`);
      }
    } catch (error) {
      console.error(`Error during employee ${action}:`, error);
      alert(`Failed to ${action} employee`);
    }
  };

  // Upload employee document
  const uploadEmployeeDocument = async (employeeId, documentName, documentUrl) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`https://cubehis.avopay.pro:5000/api/employees/${employeeId}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: documentName,
          url: documentUrl
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Document uploaded successfully!');
        return result;
      } else {
        const error = await response.json();
        alert(error.detail || error.message || 'Failed to upload document');
        return null;
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document');
      return null;
    }
  };

  // Create leave request (enhanced)
  const createLeaveRequest = async (leaveData) => {
    setFormLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://cubehis.avopay.pro:5000/api/employees/leave-requests', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...leaveData,
          user_id: currentUser.id,
          employee_id: currentUser.id,
          status: 'pending'
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Leave request submitted successfully!');
        setShowLeaveRequestModal(false);
        setLeaveForm({
          leave_type: 'annual',
          start_date: '',
          end_date: '',
          reason: '',
          notes: ''
        });
        fetchLeaveRequests();
        fetchDashboardStats();
        return result;
      } else {
        const error = await response.json();
        alert(error.detail || error.message || 'Failed to create leave request');
        return null;
      }
    } catch (error) {
      console.error('Error creating leave request:', error);
      alert('Failed to create leave request');
      return null;
    } finally {
      setFormLoading(false);
    }
  };

  // Mark attendance for employee
  const markEmployeeAttendance = async (attendanceData) => {
    setFormLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://cubehis.avopay.pro:5000/api/employees/attendance/checkin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: attendanceData.employee_id,
          action: attendanceData.action,
          notes: attendanceData.notes || `${attendanceData.action} by ${currentUser.full_name}`,
          location: attendanceData.location || 'Office'
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || `Employee ${attendanceData.action} marked successfully!`);
        setShowMarkAttendanceModal(false);
        setAttendanceForm({
          employee_id: '',
          action: 'checkin',
          notes: '',
          location: 'Office'
        });
        fetchEmployees();
        fetchDashboardStats();
        return result;
      } else {
        const error = await response.json();
        alert(error.detail || error.message || 'Failed to mark attendance');
        return null;
      }
    } catch (error) {
      console.error('Error marking attendance:', error);
      alert('Failed to mark attendance');
      return null;
    } finally {
      setFormLoading(false);
    }
  };

  // Export attendance data
  const exportAttendanceData = async () => {
    try {
      const token = localStorage.getItem('access_token');

      // Get current date range (last 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const response = await fetch(`https://cubehis.avopay.pro:5000/api/employees/attendance/export?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Create CSV data from attendance records
        const attendanceData = [];
        for (const employee of employees) {
          if (employee.attendance_status) {
            attendanceData.push({
              'Employee Name': employee.full_name || employee.name,
              'Employee ID': employee.employee_id || employee.user_id,
              'Department': employee.department || 'N/A',
              'Status': employee.attendance_status.status || 'absent',
              'Check In': employee.attendance_status.checkin_time || 'N/A',
              'Check Out': employee.attendance_status.checkout_time || 'N/A',
              'Date': new Date().toLocaleDateString()
            });
          }
        }

        // Convert to CSV
        const csvHeaders = Object.keys(attendanceData[0] || {});
        const csvContent = [
          csvHeaders.join(','),
          ...attendanceData.map(row => csvHeaders.map(header => `"${row[header]}"`).join(','))
        ].join('\n');

        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        alert('Attendance data exported successfully!');
      } else {
        alert('Failed to export attendance data');
      }
    } catch (error) {
      console.error('Error exporting attendance:', error);
      alert('Failed to export attendance data');
    }
  };

  // Sync collections between users and employees
  const syncCollections = async () => {
    if (!hasPermission('hr')) {
      alert('You do not have permission to sync collections');
      return;
    }

    if (!confirm('This will sync data between users and employees collections. Continue?')) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://cubehis.avopay.pro:5000/api/employees/sync-collections', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Sync completed successfully!\n\nResults:\n- Users processed: ${result.results?.users_processed || 0}\n- Employees created: ${result.results?.employees_created || 0}\n- Employees processed: ${result.results?.employees_processed || 0}\n- Users created: ${result.results?.users_created || 0}`);
        fetchEmployees(); // Refresh the list
        fetchDashboardStats(); // Refresh stats
      } else {
        const error = await response.json();
        alert(error.detail || error.message || 'Failed to sync collections');
      }
    } catch (error) {
      console.error('Error syncing collections:', error);
      alert('Failed to sync collections');
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser && !showLogin) {
      fetchAvailableRoles();
      fetchDashboardStats();
      fetchEmployees();
      fetchMyAttendance();
      fetchLeaveRequests();
    }
  }, [currentUser, showLogin]);

  // Auto-login on component mount if no token
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token && !showLogin) {
      handleLogin();
    }
  }, []);

  // Login Component
  if (showLogin) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <img src="/bharat.png" alt="B2B CRM" className="h-12 w-12 rounded-full" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            HR & Staff Module Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please sign in to access the HR module
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Username
                </label>
                <div className="mt-1">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={loginCredentials.username}
                    onChange={(e) => setLoginCredentials({ ...loginCredentials, username: e.target.value })}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your username"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={loginCredentials.password}
                    onChange={(e) => setLoginCredentials({ ...loginCredentials, password: e.target.value })}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <i className="fas fa-exclamation-circle text-red-400 mt-0.5 mr-2"></i>
                    <div className="text-sm text-red-700">{loginError}</div>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loginLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Signing in...
                    </div>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Demo Credentials</span>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-500 text-center">
                Username: amit24 | Password: Amit@123
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Dashboard Component
  const Dashboard = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-600 truncate">Total Employees</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {dashboardStats.total_employees !== undefined ? dashboardStats.total_employees : (
                  <span className="text-base sm:text-lg text-gray-500">
                    <i className="fas fa-spinner fa-spin mr-1"></i>
                    Loading...
                  </span>
                )}
              </p>
              {dashboardStats.total_employees !== undefined && (
                <p className="text-xs text-gray-500 mt-1 truncate">Total users in system</p>
              )}
            </div>
            <div className="p-2 sm:p-3 bg-blue-100 rounded-full flex-shrink-0 ml-3">
              <i className="fas fa-users text-blue-600 text-sm sm:text-base"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-600 truncate">Present Today</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{dashboardStats.present_today || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Checked in employees</p>
            </div>
            <div className="p-2 sm:p-3 bg-green-100 rounded-full flex-shrink-0 ml-3">
              <i className="fas fa-check-circle text-green-600 text-sm sm:text-base"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-600 truncate">Absent Today</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600">{dashboardStats.absent_today || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Not checked in</p>
            </div>
            <div className="p-2 sm:p-3 bg-red-100 rounded-full flex-shrink-0 ml-3">
              <i className="fas fa-times-circle text-red-600 text-sm sm:text-base"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-600 truncate">Pending Leaves</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-600">
                {dashboardStats.pending_leaves !== undefined
                  ? dashboardStats.pending_leaves
                  : leaveRequests.filter(req => req.status === 'pending').length || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">Awaiting approval</p>
            </div>
            <div className="p-2 sm:p-3 bg-yellow-100 rounded-full flex-shrink-0 ml-3">
              <i className="fas fa-calendar-alt text-yellow-600 text-sm sm:text-base"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <button
            onClick={() => handleAttendanceAction('checkin')}
            className="flex flex-col items-center p-3 sm:p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <i className="fas fa-sign-in-alt text-green-600 text-lg sm:text-xl mb-2"></i>
            <span className="text-xs sm:text-sm font-medium text-green-700 text-center">Check In</span>
          </button>

          <button
            onClick={() => handleAttendanceAction('checkout')}
            className="flex flex-col items-center p-3 sm:p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <i className="fas fa-sign-out-alt text-red-600 text-lg sm:text-xl mb-2"></i>
            <span className="text-xs sm:text-sm font-medium text-red-700 text-center">Check Out</span>
          </button>

          <button
            onClick={() => setShowLeaveRequestModal(true)}
            className="flex flex-col items-center p-3 sm:p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <i className="fas fa-calendar-plus text-blue-600 text-lg sm:text-xl mb-2"></i>
            <span className="text-xs sm:text-sm font-medium text-blue-700 text-center">Request Leave</span>
          </button>

          <button
            onClick={() => setActiveTab('employees')}
            className="flex flex-col items-center p-3 sm:p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <i className="fas fa-users text-purple-600 text-lg sm:text-xl mb-2"></i>
            <span className="text-xs sm:text-sm font-medium text-purple-700 text-center">Manage Employees</span>
          </button>
        </div>
      </div>

      {/* Role-based Employee Cards */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Employees by Role</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {availableRoles.map((role) => {
            const roleEmployees = employees.filter(emp =>
              emp.role === role ||
              (Array.isArray(emp.roles) && emp.roles.includes(role)) ||
              emp.role_names?.toLowerCase().includes(role.toLowerCase())
            );
            const roleColors = {
              'hr': 'bg-pink-50 text-pink-700 border-pink-200',
              'manager': 'bg-indigo-50 text-indigo-700 border-indigo-200',
              'sales': 'bg-green-50 text-green-700 border-green-200',
              'executive': 'bg-purple-50 text-purple-700 border-purple-200',
              'team_leader': 'bg-orange-50 text-orange-700 border-orange-200',
              'admin': 'bg-red-50 text-red-700 border-red-200',
              'supervisor': 'bg-yellow-50 text-yellow-700 border-yellow-200',
              'assistant': 'bg-blue-50 text-blue-700 border-blue-200',
              'intern': 'bg-teal-50 text-teal-700 border-teal-200',
              'employee': 'bg-gray-50 text-gray-700 border-gray-200'
            };
            const colorClass = roleColors[role] || 'bg-gray-50 text-gray-700 border-gray-200';

            return (
              <div key={role} className={`border rounded-lg p-3 ${colorClass}`}>
                <div className="text-center">
                  <p className="text-lg sm:text-xl font-bold">{roleEmployees.length}</p>
                  <p className="text-xs sm:text-sm font-medium capitalize">{role.replace('_', ' ')}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Attendance */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">My Recent Attendance</h3>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-full inline-block align-middle">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {myAttendance.slice(0, 5).map((record, index) => (
                  <tr key={index}>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      {new Date(record.date).toLocaleDateString()}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      {record.checkin_time || '-'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      {record.checkout_time || '-'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
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
        {myAttendance.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            <i className="fas fa-clock text-2xl mb-2"></i>
            <p>No attendance records found</p>
          </div>
        )}
      </div>
    </div>
  );

  // Employee Management Component
  const EmployeeManagement = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Employee Management</h2>
        {hasPermission('hr') && (
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
            <button
              onClick={exportAttendanceData}
              className="w-full sm:w-auto bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base"
            >
              <i className="fas fa-download mr-2"></i>Export Data
            </button>
            <button
              onClick={() => setShowMarkAttendanceModal(true)}
              className="w-full sm:w-auto bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm sm:text-base"
            >
              <i className="fas fa-clock mr-2"></i>Mark Attendance
            </button>
            <button
              onClick={syncCollections}
              className="w-full sm:w-auto bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm sm:text-base"
            >
              <i className="fas fa-sync mr-2"></i>Sync Collections
            </button>
            <button
              onClick={() => setShowAddEmployeeModal(true)}
              className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
            >
              <i className="fas fa-plus mr-2"></i>Add Employee
            </button>
          </div>
        )}
      </div>

      {/* Role Filter Cards */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Filter by Role</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => fetchEmployees()}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-medium text-gray-700 transition-colors"
          >
            All ({employees.length})
          </button>
          {availableRoles.map((role) => {
            const count = employees.filter(emp =>
              emp.role === role ||
              (Array.isArray(emp.roles) && emp.roles.includes(role)) ||
              emp.role_names?.toLowerCase().includes(role.toLowerCase())
            ).length;
            return (
              <button
                key={role}
                onClick={() => {
                  // Filter employees by role (client-side for now)
                  const filtered = employees.filter(emp =>
                    emp.role === role ||
                    (Array.isArray(emp.roles) && emp.roles.includes(role)) ||
                    emp.role_names?.toLowerCase().includes(role.toLowerCase())
                  );
                  setEmployees(filtered);
                }}
                className="px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded-full text-xs font-medium text-blue-700 transition-colors capitalize"
              >
                {role.replace('_', ' ')} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Email</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Role</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Department</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Attendance</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee, index) => (
                <tr key={employee.id || index}>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <i className="fas fa-user text-gray-600 text-xs sm:text-sm"></i>
                        </div>
                      </div>
                      <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                          {employee.full_name || employee.name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {employee.employee_id || employee.emp_id || employee.user_id || 'No ID'}
                        </div>
                        {/* Show email on mobile when hidden */}
                        <div className="text-xs text-gray-500 truncate sm:hidden">
                          {employee.email || 'No email'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 hidden sm:table-cell">
                    {employee.email || 'No email'}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 hidden md:table-cell">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                      {employee.role || employee.role_names || 'employee'}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 hidden lg:table-cell">
                    {employee.department || 'No department'}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${employee.is_active !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                      }`}>
                      {employee.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${employee.attendance_status?.status === 'present'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                          }`}>
                          {employee.attendance_status?.status || 'absent'}
                        </span>
                      </div>
                      {hasPermission('hr') && (
                        <div className="flex space-x-1">
                          {employee.attendance_status?.can_checkin && (
                            <button
                              onClick={() => handleEmployeeAttendanceAction(employee.user_id || employee.employee_id, 'checkin')}
                              className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                              title="Check In"
                            >
                              In
                            </button>
                          )}
                          {employee.attendance_status?.can_checkout && (
                            <button
                              onClick={() => handleEmployeeAttendanceAction(employee.user_id || employee.employee_id, 'checkout')}
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
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-1 sm:space-x-2">
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setShowEmployeeDetailsModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="View Details"
                      >
                        <i className="fas fa-eye text-xs sm:text-sm"></i>
                      </button>
                      {hasPermission('hr') && (
                        <>
                          <button
                            onClick={() => {
                              const newName = prompt('Enter new name:', employee.full_name || employee.name);
                              if (newName && newName !== (employee.full_name || employee.name)) {
                                updateEmployee(employee.user_id || employee.employee_id, { full_name: newName });
                              }
                            }}
                            className="text-green-600 hover:text-green-900 p-1"
                            title="Edit"
                          >
                            <i className="fas fa-edit text-xs sm:text-sm"></i>
                          </button>
                          <button
                            onClick={() => deactivateEmployee(employee.user_id || employee.employee_id)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Deactivate"
                          >
                            <i className="fas fa-user-times text-xs sm:text-sm"></i>
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
        {employees.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <i className="fas fa-users text-3xl mb-3"></i>
            <p className="text-lg font-medium">No employees found</p>
            <p className="text-sm">Try adjusting your filters or add new employees</p>
          </div>
        )}
      </div>
    </div>
  );

  // Attendance Management Component
  const AttendanceManagement = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Attendance Management</h2>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
          <button
            onClick={exportAttendanceData}
            className="w-full sm:w-auto bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <i className="fas fa-download mr-2"></i>Export
          </button>
          {hasPermission('hr') && (
            <button
              onClick={() => setShowMarkAttendanceModal(true)}
              className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <i className="fas fa-calendar-plus mr-2"></i>Mark Attendance
            </button>
          )}
        </div>
      </div>

      {/* Attendance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-600 truncate">Today's Present</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-600">{dashboardStats.present_today || 0}</p>
            </div>
            <div className="p-2 sm:p-3 bg-green-100 rounded-full flex-shrink-0 ml-3">
              <i className="fas fa-user-check text-green-600 text-lg sm:text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-600 truncate">Today's Absent</p>
              <p className="text-2xl sm:text-3xl font-bold text-red-600">{dashboardStats.absent_today || 0}</p>
            </div>
            <div className="p-2 sm:p-3 bg-red-100 rounded-full flex-shrink-0 ml-3">
              <i className="fas fa-user-times text-red-600 text-lg sm:text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-600 truncate">On Leave</p>
              <p className="text-2xl sm:text-3xl font-bold text-yellow-600">{dashboardStats.on_leave_today || 0}</p>
            </div>
            <div className="p-2 sm:p-3 bg-yellow-100 rounded-full flex-shrink-0 ml-3">
              <i className="fas fa-calendar-times text-yellow-600 text-lg sm:text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* My Attendance Detail */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">My Attendance History</h3>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-full inline-block align-middle">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Working Hours</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {myAttendance.map((record, index) => {
                  const checkInTime = record.checkin_time;
                  const checkOutTime = record.checkout_time;
                  const workingHours = record.working_hours || '-';

                  return (
                    <tr key={index}>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {new Date(record.date).toLocaleDateString()}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {checkInTime ? new Date(checkInTime).toLocaleTimeString() : '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {checkOutTime ? new Date(checkOutTime).toLocaleTimeString() : '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 hidden sm:table-cell">
                        {workingHours} {workingHours !== '-' ? 'hours' : ''}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
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
    </div>
  );

  // Leave Management Component (for HR users)
  const LeaveManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Leave Management</h2>
        <div className="flex space-x-2">
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
            <i className="fas fa-download mr-2"></i>Export
          </button>
          <button
            onClick={() => {
              // Simple leave request form (you can enhance this with a modal)
              const leaveType = prompt('Enter leave type (sick, vacation, personal, etc.):');
              if (!leaveType) return;

              const startDate = prompt('Enter start date (YYYY-MM-DD):');
              if (!startDate) return;

              const endDate = prompt('Enter end date (YYYY-MM-DD):');
              if (!endDate) return;

              const reason = prompt('Enter reason for leave:');
              if (!reason) return;

              // Calculate total days (simple calculation)
              const start = new Date(startDate);
              const end = new Date(endDate);
              const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

              createLeaveRequest({
                leave_type: leaveType,
                start_date: startDate,
                end_date: endDate,
                reason: reason,
                total_days: totalDays,
                status: 'pending'
              });
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <i className="fas fa-calendar-plus mr-2"></i>Request Leave
          </button>
        </div>
      </div>

      {/* Leave Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Requests</p>
              <p className="text-3xl font-bold text-blue-600">{leaveRequests.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <i className="fas fa-file-alt text-blue-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-3xl font-bold text-yellow-600">
                {leaveRequests.filter(req => req.status === 'pending').length}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <i className="fas fa-clock text-yellow-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-3xl font-bold text-green-600">
                {leaveRequests.filter(req => req.status === 'approved').length}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <i className="fas fa-check-circle text-green-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-3xl font-bold text-red-600">
                {leaveRequests.filter(req => req.status === 'rejected').length}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <i className="fas fa-times-circle text-red-600 text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">All Leave Requests</h3>
        {leaveRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaveRequests.map((request, index) => (
                  <tr key={request._id || index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                            <i className="fas fa-user text-gray-600 text-xs"></i>
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {request.employee_name || request.user_name || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {request.user_id || 'No ID'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.leave_type || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="text-sm text-gray-900">
                          {request.start_date ? new Date(request.start_date).toLocaleDateString() : 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">to</div>
                        <div className="text-sm text-gray-900">
                          {request.end_date ? new Date(request.end_date).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.total_days || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${request.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : request.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {request.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {request.requested_at ? new Date(request.requested_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-900" title="View Details">
                          <i className="fas fa-eye"></i>
                        </button>
                        {hasPermission('hr') && request.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleLeaveAction(request._id, 'approve')}
                              className="text-green-600 hover:text-green-900"
                              title="Approve"
                            >
                              <i className="fas fa-check"></i>
                            </button>
                            <button
                              onClick={() => handleLeaveAction(request._id, 'reject')}
                              className="text-red-600 hover:text-red-900"
                              title="Reject"
                            >
                              <i className="fas fa-times"></i>
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
        ) : (
          <div className="text-center py-8 text-gray-500">
            <i className="fas fa-calendar-alt text-4xl mb-2"></i>
            <p>No leave requests found</p>
          </div>
        )}
      </div>
    </div>
  );

  // Profile Management Component
  const ProfileManagement = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">My Profile</h2>
        <button
          onClick={handleLogout}
          className="w-full sm:w-auto bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          <i className="fas fa-sign-out-alt mr-2"></i>Logout
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start space-y-4 sm:space-y-0 sm:space-x-6">
          <div className="flex-shrink-0 mx-auto sm:mx-0">
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gray-300 flex items-center justify-center">
              <i className="fas fa-user text-gray-600 text-2xl sm:text-3xl"></i>
            </div>
          </div>

          <div className="flex-1 space-y-4 text-center sm:text-left w-full">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                {currentUser?.full_name || currentUser?.name || 'Unknown User'}
              </h3>
              <p className="text-gray-600 text-sm sm:text-base">{currentUser?.email || 'No email'}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    : currentUser?.role || currentUser?.roles || 'No role assigned'}
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
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">My Documents</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            onClick={() => {
              // Simple document upload (you can enhance this with actual file upload)
              const documentName = prompt('Enter document name:');
              if (!documentName) return;

              const documentUrl = prompt('Enter document URL:');
              if (!documentUrl) return;

              uploadEmployeeDocument(currentUser.id, documentName, documentUrl);
            }}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
          >
            <i className="fas fa-file-upload text-gray-400 text-2xl sm:text-3xl mb-2"></i>
            <p className="text-sm text-gray-600">Upload Documents</p>
          </div>
        </div>
      </div>

      {/* Leave Requests Section */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 space-y-3 sm:space-y-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">My Leave Requests</h3>
          <button
            onClick={() => {
              // Simple leave request form (you can enhance this with a modal)
              const leaveType = prompt('Enter leave type (sick, vacation, personal, etc.):');
              if (!leaveType) return;

              const startDate = prompt('Enter start date (YYYY-MM-DD):');
              if (!startDate) return;

              const endDate = prompt('Enter end date (YYYY-MM-DD):');
              if (!endDate) return;

              const reason = prompt('Enter reason for leave:');
              if (!reason) return;

              // Calculate total days (simple calculation)
              const start = new Date(startDate);
              const end = new Date(endDate);
              const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

              createLeaveRequest({
                leave_type: leaveType,
                start_date: startDate,
                end_date: endDate,
                reason: reason,
                total_days: totalDays,
                status: 'pending'
              });
            }}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <i className="fas fa-plus mr-2"></i>Request Leave
          </button>
        </div>

        {leaveRequests.length > 0 ? (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-full inline-block align-middle">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Start Date</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">End Date</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Requested</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leaveRequests.map((request, index) => (
                    <tr key={request._id || index}>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        <div>
                          <div>{request.leave_type || 'N/A'}</div>
                          {/* Show dates on mobile when hidden */}
                          <div className="text-xs text-gray-500 sm:hidden">
                            {request.start_date ? new Date(request.start_date).toLocaleDateString() : 'N/A'} - {request.end_date ? new Date(request.end_date).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 hidden sm:table-cell">
                        {request.start_date ? new Date(request.start_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 hidden sm:table-cell">
                        {request.end_date ? new Date(request.end_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {request.total_days || 'N/A'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${request.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : request.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                          {request.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 hidden md:table-cell">
                        {request.requested_at ? new Date(request.requested_at).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <i className="fas fa-calendar-alt text-3xl sm:text-4xl mb-2"></i>
            <p className="text-sm sm:text-base">No leave requests found</p>
          </div>
        )}
      </div>
    </div>
  );

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'chart-pie', component: Dashboard },
    { id: 'employees', label: 'Employees', icon: 'users', component: EmployeeManagement },
    { id: 'attendance', label: 'Attendance', icon: 'clock', component: AttendanceManagement },
    ...(hasPermission('hr') ? [{ id: 'leaves', label: 'Leave Management', icon: 'calendar-alt', component: LeaveManagement }] : []),
    { id: 'profile', label: 'My Profile', icon: 'user', component: ProfileManagement },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || Dashboard;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 space-y-3 sm:space-y-0">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">HR & Staff Management</h1>
              <p className="text-gray-600 text-sm sm:text-base truncate">Welcome back, {currentUser?.full_name || currentUser?.name || 'User'}</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
              <span className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 text-red-600 hover:text-red-700 text-sm"
                title="Logout"
              >
                <i className="fas fa-sign-out-alt"></i>
                <span className="sm:hidden">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile menu button */}
          <div className="sm:hidden flex justify-between items-center py-3">
            <span className="text-sm font-medium text-gray-900">
              {tabs.find(tab => tab.id === activeTab)?.label || 'Dashboard'}
            </span>
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <i className={`fas fa-${showMobileMenu ? 'times' : 'bars'} text-lg`}></i>
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden sm:flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors`}
              >
                <i className={`fas fa-${tab.icon}`}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Mobile Navigation Menu */}
          {showMobileMenu && (
            <div className="sm:hidden border-t border-gray-200">
              <div className="py-3 space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setShowMobileMenu(false);
                    }}
                    className={`${activeTab === tab.id
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                      } w-full text-left border-l-4 py-2 pl-3 pr-4 text-base font-medium flex items-center space-x-3 transition-colors`}
                  >
                    <i className={`fas fa-${tab.icon} w-5`}></i>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <ActiveComponent />
      </div>

      {/* Add Employee Modal */}
      {showAddEmployeeModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add New Employee</h3>
                <button
                  onClick={() => setShowAddEmployeeModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createEmployee(employeeForm);
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={employeeForm.full_name}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, full_name: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email *</label>
                    <input
                      type="email"
                      required
                      value={employeeForm.email}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input
                      type="tel"
                      value={employeeForm.phone}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Password *</label>
                    <input
                      type="password"
                      required
                      value={employeeForm.password}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role *</label>
                    <select
                      required
                      value={employeeForm.role}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      {availableRoles.map(role => (
                        <option key={role} value={role} className="capitalize">
                          {role.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Department</label>
                    <input
                      type="text"
                      value={employeeForm.department}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Position</label>
                    <input
                      type="text"
                      value={employeeForm.position}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, position: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Salary</label>
                    <input
                      type="number"
                      value={employeeForm.salary}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, salary: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Location</label>
                    <input
                      type="text"
                      value={employeeForm.location}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, location: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Shift</label>
                    <select
                      value={employeeForm.shift}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, shift: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="day">Day Shift</option>
                      <option value="night">Night Shift</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Gender</label>
                    <select
                      value={employeeForm.gender}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, gender: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddEmployeeModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {formLoading ? 'Creating...' : 'Create Employee'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      {showLeaveRequestModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Request Leave</h3>
                <button
                  onClick={() => setShowLeaveRequestModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createLeaveRequest(leaveForm);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700">Leave Type *</label>
                  <select
                    required
                    value={leaveForm.leave_type}
                    onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="annual">Annual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="personal">Personal Leave</option>
                    <option value="emergency">Emergency Leave</option>
                    <option value="maternity">Maternity Leave</option>
                    <option value="paternity">Paternity Leave</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={leaveForm.start_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">End Date *</label>
                    <input
                      type="date"
                      required
                      value={leaveForm.end_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Reason *</label>
                  <textarea
                    required
                    rows={3}
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Please provide a reason for your leave request..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Additional Notes</label>
                  <textarea
                    rows={2}
                    value={leaveForm.notes}
                    onChange={(e) => setLeaveForm({ ...leaveForm, notes: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Any additional information..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowLeaveRequestModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {formLoading ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Mark Attendance Modal */}
      {showMarkAttendanceModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Mark Employee Attendance</h3>
                <button
                  onClick={() => setShowMarkAttendanceModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  markEmployeeAttendance(attendanceForm);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700">Employee *</label>
                  <select
                    required
                    value={attendanceForm.employee_id}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, employee_id: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.user_id || emp.id} value={emp.user_id || emp.id}>
                        {emp.full_name || emp.name} ({emp.employee_id || emp.user_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Action *</label>
                  <select
                    required
                    value={attendanceForm.action}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, action: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="checkin">Check In</option>
                    <option value="checkout">Check Out</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Location</label>
                  <input
                    type="text"
                    value={attendanceForm.location}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, location: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Office, Home, Client Site, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    rows={3}
                    value={attendanceForm.notes}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Any additional notes about the attendance..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowMarkAttendanceModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {formLoading ? 'Marking...' : 'Mark Attendance'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Employee Details Modal */}
      {showEmployeeDetailsModal && selectedEmployee && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Employee Details</h3>
                <button
                  onClick={() => setShowEmployeeDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedEmployee.full_name || selectedEmployee.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedEmployee.employee_id || selectedEmployee.emp_id || selectedEmployee.user_id || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedEmployee.email || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedEmployee.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <p className="mt-1 text-sm text-gray-900 capitalize">{selectedEmployee.role || selectedEmployee.role_names || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Department</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedEmployee.department || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Position</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedEmployee.position || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${selectedEmployee.is_active !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                      }`}>
                      {selectedEmployee.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Salary</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedEmployee.salary || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Location</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedEmployee.location || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date of Joining</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedEmployee.date_of_joining
                        ? new Date(selectedEmployee.date_of_joining).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Login</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedEmployee.last_login
                        ? new Date(selectedEmployee.last_login).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                </div>

                {/* Attendance Status */}
                {selectedEmployee.attendance_status && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Today's Attendance</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500">Status</label>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${selectedEmployee.attendance_status.status === 'present'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                          }`}>
                          {selectedEmployee.attendance_status.status || 'absent'}
                        </span>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Check In</label>
                        <p className="text-sm text-gray-900">
                          {selectedEmployee.attendance_status.checkin_time || 'Not checked in'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Check Out</label>
                        <p className="text-sm text-gray-900">
                          {selectedEmployee.attendance_status.checkout_time || 'Not checked out'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setShowEmployeeDetailsModal(false)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRStaffModuleComplete;
