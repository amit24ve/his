import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// API Configuration
const API_BASE_URL = 'https://cubehis.avopay.pro:5000';

const HRStaffModule = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({});
  const [myAttendance, setMyAttendance] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState({ username: 'amit24', password: 'Amit@123' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [allEmployeeAttendance, setAllEmployeeAttendance] = useState([]);

  // Employee management states
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Enhanced employee form state with all requested fields
  const [newEmployee, setNewEmployee] = useState({
    // Personal Details
    full_name: '',
    date_of_birth: '',
    email: '',
    phone: '',

    // Address Details
    address: '',
    pincode: '',
    city: '',
    state: '',

    // Job Details
    department: '',
    position: '',
    salary: '',

    // Login Credentials
    username: '',
    password: '',
    auto_generated_password: '',
    role: 'employee',

    // Additional fields
    hire_date: new Date().toISOString().split('T')[0],
    emergency_contact: '',
    emergency_phone: ''
  });

  // Form states
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [autoGeneratePassword, setAutoGeneratePassword] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [cityOptions, setCityOptions] = useState([]);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const navigate = useNavigate();

  // Dropdown options
  const departmentOptions = [
    'Sales',
    'Management'
  ];

  const positionOptions = [
    'Manager',
    'HR',
    'Executive',
    'Senior Executive',
    'Team Lead',
    'Assistant',
    'Intern',
    'Sales Representative',
    'Sales Manager',
    'Business Development Executive'
  ];

  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'hr', label: 'HR' },
    { value: 'manager', label: 'Manager' },
    { value: 'executive', label: 'Executive' },
    { value: 'employee', label: 'Employee' }
  ];

  // Check if user is admin or HR
  const isAdminOrHR = () => {
    if (!currentUser) return false;

    // Check if admin (reports_to is None/null)
    const isAdmin = !currentUser.reports_to || currentUser.reports_to === null;

    // Check if HR role
    const isHR = currentUser.role_names?.some(role =>
      ['HR', 'Human Resource', 'Human Resources'].includes(role)
    ) || currentUser.roles?.some(role =>
      ['HR', 'Human Resource', 'Human Resources'].includes(role)
    ) || currentUser.permissions?.includes('HR');

    return isAdmin || isHR;
  };

  // Generate username from full name
  const generateUsername = (fullName) => {
    if (!fullName) return '';

    // Remove special characters and spaces, convert to lowercase
    const cleanName = fullName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // If name is too short, add date of birth
    if (cleanName.length < 6 && newEmployee.date_of_birth) {
      const dobParts = newEmployee.date_of_birth.split('-');
      const year = dobParts[0];
      const month = dobParts[1];
      const day = dobParts[2];
      return `${cleanName}${day}${month}`;
    }

    return cleanName.substring(0, 20); // Limit to 20 characters
  };

  // Generate random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Check username availability
  const checkUsernameAvailability = async (username) => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees/check-username?username=${encodeURIComponent(username)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setUsernameAvailable(result.available);
      } else {
        setUsernameAvailable(false);
      }
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  // Fetch location data from pincode
  const fetchLocationFromPincode = async (pincode) => {
    if (!pincode || pincode.length !== 6) {
      setCityOptions([]);
      setNewEmployee(prev => ({ ...prev, city: '', state: '' }));
      return;
    }

    setPincodeLoading(true);
    try {
      // Using India Post API for pincode lookup
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();

      if (data && data[0] && data[0].Status === 'Success') {
        const postOffices = data[0].PostOffice;

        // Extract unique cities and state
        const cities = [...new Set(postOffices.map(office => office.Name))];
        const state = postOffices[0].State;

        setCityOptions(cities);
        setNewEmployee(prev => ({
          ...prev,
          state: state,
          city: cities.length === 1 ? cities[0] : ''
        }));
      } else {
        setCityOptions([]);
        setNewEmployee(prev => ({ ...prev, city: '', state: '' }));
        alert('Invalid pincode or no data found');
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      setCityOptions([]);
      alert('Error fetching location data');
    } finally {
      setPincodeLoading(false);
    }
  };

  // Handle form field changes
  const handleFieldChange = (field, value) => {
    setNewEmployee(prev => ({ ...prev, [field]: value }));

    // Auto-generate username when name changes
    if (field === 'full_name') {
      const username = generateUsername(value);
      setNewEmployee(prev => ({ ...prev, username }));
      if (username) {
        checkUsernameAvailability(username);
      }
    }

    // Handle pincode change
    if (field === 'pincode') {
      fetchLocationFromPincode(value);
    }

    // Auto-generate password when enabled
    if (field === 'full_name' && autoGeneratePassword) {
      const password = generatePassword();
      setNewEmployee(prev => ({ ...prev, password, auto_generated_password: password }));
    }
  };

  // Handle auto-generate password toggle
  const toggleAutoGeneratePassword = () => {
    const newValue = !autoGeneratePassword;
    setAutoGeneratePassword(newValue);

    if (newValue) {
      const password = generatePassword();
      setNewEmployee(prev => ({ ...prev, password, auto_generated_password: password }));
    } else {
      setNewEmployee(prev => ({ ...prev, password: '', auto_generated_password: '' }));
    }
  };

  // Login function
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const endpoints = [
        'https://cubehis.avopay.pro:5000/api/auth/login',
        'https://cubehis.avopay.pro:5000/auth/login',
        'https://cubehis.avopay.pro:5000/login'
      ];

      let loginSuccess = false;

      for (const endpoint of endpoints) {
        try {
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
              roles: user.roles || [user.role || 'employee'],
              role: user.role || 'employee',
              role_names: user.role_names || [],
              reports_to: user.reports_to,
              permissions: user.permissions || []
            });
            setShowLogin(false);
            setLoading(false);
            return;
          } catch {
            console.log('❌ Failed to parse localStorage user');
          }
        }

        setShowLogin(true);
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setCurrentUser({
          ...userData,
          id: userData.user_id || userData.id || userData._id,
          employee_id: userData.employee_id || userData.user_id || userData.id,
          full_name: userData.full_name || userData.name || userData.username,
          name: userData.full_name || userData.name || userData.username
        });
        setShowLogin(false);
      } else {
        setShowLogin(true);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
      setShowLogin(true);
    } finally {
      setLoading(false);
    }
  };

  // Fetch employees
  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/employees`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setEmployees(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // Fetch all attendance records (for admin/HR)
  const fetchAllAttendance = async () => {
    if (!isAdminOrHR()) return;

    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/employees/attendance/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAllEmployeeAttendance(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error('Error fetching all attendance:', error);
    }
  };

  // Handle add employee
  const handleAddEmployee = async (e) => {
    e.preventDefault();

    // Validation
    if (!newEmployee.full_name.trim()) {
      alert('Please enter full name');
      return;
    }

    if (!newEmployee.email.trim()) {
      alert('Please enter email');
      return;
    }

    if (!newEmployee.username.trim()) {
      alert('Please enter username');
      return;
    }

    if (usernameAvailable === false) {
      alert('Username is not available');
      return;
    }

    if (!newEmployee.password.trim()) {
      alert('Please enter password');
      return;
    }

    try {
      const token = localStorage.getItem('access_token');

      const employeeData = {
        full_name: newEmployee.full_name.trim(),
        email: newEmployee.email.trim(),
        phone: newEmployee.phone.trim(),
        date_of_birth: newEmployee.date_of_birth,
        address: newEmployee.address.trim(),
        pincode: newEmployee.pincode.trim(),
        city: newEmployee.city.trim(),
        state: newEmployee.state.trim(),
        department: newEmployee.department,
        position: newEmployee.position.trim(),
        salary: newEmployee.salary ? parseFloat(newEmployee.salary) : 0,
        username: newEmployee.username.trim(),
        password: newEmployee.password,
        role: newEmployee.role,
        hire_date: newEmployee.hire_date,
        emergency_contact: newEmployee.emergency_contact.trim(),
        emergency_phone: newEmployee.emergency_phone.trim(),
        is_active: true
      };

      console.log('Creating employee with data:', employeeData);

      const response = await fetch(`${API_BASE_URL}/api/employees`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(employeeData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Employee created successfully:', result);

        alert(`Employee created successfully!\nUsername: ${newEmployee.username}\nPassword: ${newEmployee.password}`);

        // Reset form
        setNewEmployee({
          full_name: '',
          date_of_birth: '',
          email: '',
          phone: '',
          address: '',
          pincode: '',
          city: '',
          state: '',
          department: '',
          position: '',
          salary: '',
          username: '',
          password: '',
          auto_generated_password: '',
          role: 'employee',
          hire_date: new Date().toISOString().split('T')[0],
          emergency_contact: '',
          emergency_phone: ''
        });

        setCityOptions([]);
        setUsernameAvailable(null);
        setShowAddEmployee(false);

        // Refresh employees list
        fetchEmployees();
      } else {
        const error = await response.json();
        console.error('Error creating employee:', error);
        alert(error.detail || error.message || 'Failed to create employee');
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      alert('Failed to create employee. Please try again.');
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser && !showLogin) {
      fetchEmployees();
      if (isAdminOrHR()) {
        fetchAllAttendance();
      }
    }
  }, [currentUser, showLogin]);

  // Auto-generate password when enabled
  useEffect(() => {
    if (autoGeneratePassword && newEmployee.full_name) {
      const password = generatePassword();
      setNewEmployee(prev => ({ ...prev, password, auto_generated_password: password }));
    }
  }, [autoGeneratePassword, newEmployee.full_name]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              HR Staff Module Login
            </h2>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <input
                  type="text"
                  required
                  value={loginCredentials.username}
                  onChange={(e) => setLoginCredentials({ ...loginCredentials, username: e.target.value })}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Username"
                />
              </div>
              <div>
                <input
                  type="password"
                  required
                  value={loginCredentials.password}
                  onChange={(e) => setLoginCredentials({ ...loginCredentials, password: e.target.value })}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
              </div>
            </div>

            {loginError && (
              <div className="text-red-600 text-sm text-center">{loginError}</div>
            )}

            <div>
              <button
                type="submit"
                disabled={loginLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loginLoading ? 'Logging in...' : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">HR Staff Module</h1>
              <div className="ml-4 text-sm text-gray-600">
                Welcome, {currentUser?.full_name || currentUser?.name}
                {isAdminOrHR() && <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Admin/HR</span>}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('employees')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'employees'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Employee Management
            </button>
            {isAdminOrHR() && (
              <button
                onClick={() => setActiveTab('attendance')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'attendance'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                All Attendance
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Employee Management Tab */}
        {activeTab === 'employees' && (
          <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-900">Employee Management</h2>
              {isAdminOrHR() && (
                <button
                  onClick={() => setShowAddEmployee(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  <i className="fas fa-plus mr-2"></i>Add New Employee
                </button>
              )}
            </div>

            {/* Employees Table */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
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
                              ID: {employee.employee_id || employee.user_id || 'No ID'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.email || 'No email'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {Array.isArray(employee.role_names)
                          ? employee.role_names.join(', ')
                          : employee.role_names || employee.roles || employee.role || 'No role'}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            className="text-blue-600 hover:text-blue-900"
                            title="View Details"
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          {isAdminOrHR() && (
                            <>
                              <button
                                className="text-green-600 hover:text-green-900"
                                title="Edit Employee"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                className="text-red-600 hover:text-red-900"
                                title="Deactivate Employee"
                              >
                                <i className="fas fa-user-times"></i>
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
        )}

        {/* All Attendance Tab (Admin/HR only) */}
        {activeTab === 'attendance' && isAdminOrHR() && (
          <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-900">All Employee Attendance</h2>
              <button
                onClick={fetchAllAttendance}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                <i className="fas fa-sync mr-2"></i>Refresh
              </button>
            </div>

            {/* Attendance Table */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allEmployeeAttendance.map((record, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {record.employee_name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {record.employee_id || 'No ID'}
                        </div>
                      </td>
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
                        {record.working_hours || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${record.status === 'present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          className="text-blue-600 hover:text-blue-900 mr-3"
                          title="Edit Attendance"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add Employee Modal */}
      {showAddEmployee && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-medium text-gray-900">Add New Employee</h3>
                <button
                  onClick={() => setShowAddEmployee(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleAddEmployee} className="space-y-6">
                {/* Personal Details Section */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Personal Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={newEmployee.full_name}
                        onChange={(e) => handleFieldChange('full_name', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter full name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                      <input
                        type="date"
                        value={newEmployee.date_of_birth}
                        onChange={(e) => handleFieldChange('date_of_birth', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email *</label>
                      <input
                        type="email"
                        required
                        value={newEmployee.email}
                        onChange={(e) => handleFieldChange('email', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter email address"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                      <input
                        type="tel"
                        value={newEmployee.phone}
                        onChange={(e) => handleFieldChange('phone', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>
                </div>

                {/* Address Details Section */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Address Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Address</label>
                      <textarea
                        value={newEmployee.address}
                        onChange={(e) => handleFieldChange('address', e.target.value)}
                        rows={3}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter complete address"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Pincode</label>
                      <div className="relative">
                        <input
                          type="text"
                          pattern="[0-9]{6}"
                          value={newEmployee.pincode}
                          onChange={(e) => handleFieldChange('pincode', e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter 6-digit pincode"
                          maxLength={6}
                        />
                        {pincodeLoading && (
                          <div className="absolute right-3 top-3">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">City</label>
                      {cityOptions.length > 1 ? (
                        <select
                          value={newEmployee.city}
                          onChange={(e) => handleFieldChange('city', e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select City</option>
                          {cityOptions.map((city, index) => (
                            <option key={index} value={city}>{city}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={newEmployee.city}
                          onChange={(e) => handleFieldChange('city', e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="City (auto-filled from pincode)"
                          readOnly={cityOptions.length === 1}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">State</label>
                      <input
                        type="text"
                        value={newEmployee.state}
                        readOnly
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-700"
                        placeholder="State (auto-filled from pincode)"
                      />
                    </div>
                  </div>
                </div>

                {/* Job Details Section */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Job Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Department *</label>
                      <select
                        required
                        value={newEmployee.department}
                        onChange={(e) => handleFieldChange('department', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select Department</option>
                        {departmentOptions.map((dept, index) => (
                          <option key={index} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Position</label>
                      <select
                        value={newEmployee.position}
                        onChange={(e) => handleFieldChange('position', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select Position</option>
                        {positionOptions.map((position, index) => (
                          <option key={index} value={position}>{position}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Salary (per month)</label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={newEmployee.salary}
                        onChange={(e) => handleFieldChange('salary', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter salary amount"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Hire Date</label>
                      <input
                        type="date"
                        value={newEmployee.hire_date}
                        onChange={(e) => handleFieldChange('hire_date', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Login Credentials Section */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Login Credentials</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Username *</label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={newEmployee.username}
                          onChange={(e) => {
                            handleFieldChange('username', e.target.value);
                            checkUsernameAvailability(e.target.value);
                          }}
                          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${usernameAvailable === true ? 'border-green-500' :
                              usernameAvailable === false ? 'border-red-500' : 'border-gray-300'
                            }`}
                          placeholder="Auto-generated from name"
                        />
                        {checkingUsername && (
                          <div className="absolute right-3 top-3">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                          </div>
                        )}
                      </div>
                      {usernameAvailable === true && (
                        <p className="text-sm text-green-600 mt-1">✓ Username is available</p>
                      )}
                      {usernameAvailable === false && (
                        <p className="text-sm text-red-600 mt-1">✗ Username is not available</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Role *</label>
                      <select
                        required
                        value={newEmployee.role}
                        onChange={(e) => handleFieldChange('role', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        {roleOptions.map((role, index) => (
                          <option key={index} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <div className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          id="autoPassword"
                          checked={autoGeneratePassword}
                          onChange={toggleAutoGeneratePassword}
                          className="mr-2"
                        />
                        <label htmlFor="autoPassword" className="text-sm font-medium text-gray-700">
                          Auto-generate password
                        </label>
                      </div>

                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={newEmployee.password}
                          onChange={(e) => handleFieldChange('password', e.target.value)}
                          readOnly={autoGeneratePassword}
                          className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${autoGeneratePassword ? 'bg-gray-100' : ''
                            }`}
                          placeholder="Password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        >
                          <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                      {autoGeneratePassword && newEmployee.password && (
                        <p className="text-sm text-blue-600 mt-1">
                          Auto-generated password will be shown after employee creation
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Emergency Contact Section */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Emergency Contact</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Emergency Contact Name</label>
                      <input
                        type="text"
                        value={newEmployee.emergency_contact}
                        onChange={(e) => handleFieldChange('emergency_contact', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter emergency contact name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Emergency Contact Phone</label>
                      <input
                        type="tel"
                        value={newEmployee.emergency_phone}
                        onChange={(e) => handleFieldChange('emergency_phone', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter emergency contact phone"
                      />
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => setShowAddEmployee(false)}
                    className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={usernameAvailable === false || checkingUsername}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Employee
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRStaffModule;
