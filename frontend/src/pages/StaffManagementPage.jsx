import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  EmployeeDashboard,
  AttendanceManagement,
  LeaveManagement,
  ProfileManagement
} from '../components/hr';
import DocumentUploader from '../components/common/DocumentUploader';

// Import constants
import { API_BASE_URL } from '../utils/hrConstants';

const HRStaffModuleNew = () => {
  // State Management
  const [activeTab, setActiveTab] = useState('attendance');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    onLeaveToday: 0,
    pendingLeaveRequests: 0,
    departmentBreakdown: []
  });
  const [myAttendance, setMyAttendance] = useState([]);
  const [allEmployeeAttendance, setAllEmployeeAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveCounts, setLeaveCounts] = useState({
    casual: 0,
    casual_pending: 0,
    sick: 0,
    sick_pending: 0,
    annual: 0,
    annual_pending: 0,
    other: 0,
    other_pending: 0
  });
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Employee Management States
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showEmployeeDetailsModal, setShowEmployeeDetailsModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [newEmployeeData, setNewEmployeeData] = useState({
    full_name: '',
    email: '',
    phone: '',
    dob: '',
    address: '',
    pincode: '',
    city: '',
    state: '',
    country: 'India',
    department: '',
    position: '',
    doj: new Date().toISOString().split('T')[0],
    salary: '',
    role: 'employee',
    role_ids: [],
    roles: [],
    reports_to: '',
    employee_type: 'full_time',
    shift: '9am - 6pm',
    gender: '',
    location: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    custom_password: false,
    password: ''
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [cities, setCities] = useState([]);
  const [activeEmployeeTab, setActiveEmployeeTab] = useState('profile');
  const [availableRoles, setAvailableRoles] = useState([]);
  const [showDocumentUploadModal, setShowDocumentUploadModal] = useState(false);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  
  // User Role Information
  const [isAdmin, setIsAdmin] = useState(false);
  const [isHR, setIsHR] = useState(false);
  
  const navigate = useNavigate();
  
  // Initialize and load data
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      return;
    }
    
    fetchCurrentUser();
  }, [navigate]);
  
  // Load data after authentication
  useEffect(() => {
    if (currentUser) {
      console.log('📝 Current user loaded, initializing Staff Management...');
      
      // First check user roles to determine permissions
      checkUserRoles();
      
      // Fetch available roles and departments for dropdowns
      fetchAvailableRoles();
      fetchAvailableDepartments();
      
      // Fetch data with a slight delay to ensure roles are set
      setTimeout(() => {
        // Fetch employees data first
        fetchEmployees().then(() => {
          // After employees are loaded, fetch other data in parallel
          Promise.all([
            fetchDashboardStats(),
            fetchAttendance(),
            fetchLeaveRequests(),
            fetchAvailableRoles(),
            fetchAvailableDepartments()
          ]).then(() => {
            console.log('✅ All Staff Management data loaded successfully');
          }).catch(err => {
            console.error('Error loading some Staff Management data:', err);
          });
        }).catch(err => {
          console.error('Error loading employees:', err);
          // Still try to load other data
          Promise.all([
            fetchDashboardStats(),
            fetchAttendance(),
            fetchLeaveRequests(),
            fetchAvailableRoles(),
            fetchAvailableDepartments()
          ]).catch(err => {
            console.error('Error loading additional Staff Management data:', err);
          });
        });
      }, 100);
    }
  }, [currentUser]);

  // Check user roles and set permissions
  const checkUserRoles = () => {
    if (!currentUser) return;
    
    // Log the currentUser object to debug
    console.log('🔍 Current user data:', JSON.stringify(currentUser, null, 2));
    
    // Find the user ID from various possible fields
    const userId = currentUser?.id || currentUser?.user_id || currentUser?._id;
    if (!userId) {
      console.warn('❌ No user ID found in current user data');
    } else {
      console.log(`✓ Found user ID: ${userId}`);
    }
    
    // Extract all possible roles
    let userRoles = [];
    
    // Check for roles array - process different possible formats
    if (Array.isArray(currentUser.roles)) {
      // Handle both string roles and object roles
      currentUser.roles.forEach(role => {
        if (typeof role === 'string') {
          userRoles.push(role);
        } else if (typeof role === 'object' && role !== null) {
          // Handle role objects that might have name, role, or other properties
          const roleName = role.name || role.role || role.title || Object.values(role)[0];
          if (roleName && typeof roleName === 'string') {
            userRoles.push(roleName);
          }
        }
      });
      console.log('✓ Found roles array, extracted:', userRoles);
    }
    
    // Check for role string
    if (currentUser.role && typeof currentUser.role === 'string') {
      userRoles.push(currentUser.role);
      console.log('✓ Found role string:', currentUser.role);
    }
    
    // Check for role_names array
    if (Array.isArray(currentUser.role_names)) {
      userRoles = [...userRoles, ...currentUser.role_names.filter(r => r)];
      console.log('✓ Found role_names array:', currentUser.role_names);
    }
    
    // Check if the user has a position that indicates admin role
    if (currentUser.position && typeof currentUser.position === 'string' && 
        (currentUser.position.toLowerCase().includes('admin') || 
         currentUser.position.toLowerCase().includes('director') || 
         currentUser.position.toLowerCase().includes('ceo') || 
         currentUser.position.toLowerCase().includes('cto'))) {
      userRoles.push('admin');
      console.log('✓ Found admin position:', currentUser.position);
    }
    
    // Admin check - comprehensive check across various fields
    const hasAdminRole = 
      (currentUser.role || '').toLowerCase().includes('admin') || 
      userRoles.some(r => (r || '').toLowerCase().includes('admin')) ||
      !currentUser.reports_to ||
      currentUser.reports_to === null ||
      currentUser.reports_to === "" ||
      (currentUser.can_approve_all === true);
    
    // HR check - comprehensive check across various fields
    const hasHRRole =
      (currentUser.role || '').toLowerCase().includes('hr') ||
      (currentUser.role || '').toLowerCase().includes('human resource') ||
      userRoles.some(r => 
        (r || '').toLowerCase().includes('hr') || 
        (r || '').toLowerCase().includes('human resource')
      ) ||
      (currentUser.department || '').toLowerCase().includes('hr') ||
      (currentUser.department || '').toLowerCase().includes('human resource');
    
    setIsAdmin(hasAdminRole);
    setIsHR(hasHRRole);
    
    console.log('🔒 User Role Check - Admin:', hasAdminRole, 'HR:', hasHRRole);
    console.log('🔑 Detected roles:', userRoles.join(', '));
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
        navigate('/login');
        return;
      }
      
      // First get basic user data
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        console.log("Raw user data from /api/auth/me:", userData);
        console.log('Basic user data loaded:', userData);
        
        // Now fetch complete employee profile with all fields
        const employeeId = userData.user_id;
        const profileResponse = await fetch(`${API_BASE_URL}/api/employees/${employeeId}/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          console.log('Complete employee profile loaded:', profileData);
          
          // Combine the data, prioritizing profile data
          const completeUserData = {
            ...userData,
            ...profileData.data,
            // Ensure these fields are preserved from the original user data
            role: userData.role || profileData.data?.role,
            roles: userData.roles || profileData.data?.roles
          };
          
          setCurrentUser(completeUserData);
          console.log('🔍 Enhanced user data:', completeUserData);
        } else {
          console.warn('Could not load detailed employee profile, using basic data');
          setCurrentUser(userData);
        }
      } else {
        console.error('Failed to fetch current user');
        localStorage.removeItem('access_token');
        navigate('/login');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching current user:', error);
      setLoading(false);
      localStorage.removeItem('access_token');
      navigate('/login');
    }
  };

  // Fetch employees list (excluding customers)
  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      console.log('📡 Fetching employees');
      
      // Get user ID for role-based filtering
      const userId = currentUser?.id || currentUser?.user_id || currentUser?._id;
      if (!userId) {
        console.error('Unable to determine user ID from current user data');
        return;
      }
      
      console.log('🔍 Using user ID for employees API:', userId);
      
      // Determine if we should use the role-based endpoint
      const roleParam = isAdmin ? 'admin' : (isHR ? 'hr' : 'employee');
      
      // Using the new HR staff route
      const response = await fetch(`${API_BASE_URL}/api/hr/employees?page=1&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Log the raw response for debugging
      const responseText = await response.text();
      console.log(`📬 Employees API response:`, responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
        console.log('✅ Employees data parsed:', result);
      } catch (e) {
        console.error('Error parsing employees response as JSON:', e);
        console.error('Response was:', responseText);
        alert(`Error loading employees: Invalid JSON response from server`);
        return;
      }
      
      if (response.ok) {
        // Handle different response formats - the API might return data in an object
        const employeesData = result.data || result.employees || result;
        
        // Filter out customers
        const filteredEmployees = Array.isArray(employeesData) 
          ? employeesData.filter(emp => {
              const empRole = (emp.role || '').toLowerCase();
              return empRole !== 'customer' && !empRole.includes('customer');
            })
          : [];
        
        setEmployees(filteredEmployees);
        console.log(`✅ ${filteredEmployees.length} employees loaded`);
        
        if (filteredEmployees.length === 0) {
          console.warn('⚠️ No employees found in API response after filtering');
          console.log('Original data:', JSON.stringify(employeesData, null, 2));
        }
      } else {
        // Try to extract error message and show to user
        let errorMessage;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.detail || errorData.message || errorData.error || `Error ${response.status}`;
        } catch (e) {
          errorMessage = `Error ${response.status}: ${responseText.substring(0, 100)}`;
        }
        
        console.error('Failed to fetch employees:', errorMessage);
        alert(`Failed to load employees: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      alert(`Error loading employees: ${error.message || String(error)}`);
    }
  };
  
  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      
      console.log('📊 Fetching dashboard statistics');
      
      // Get all possible ID fields from currentUser to ensure we find the correct one
      const userId = currentUser?.id || currentUser?.user_id || currentUser?._id;
      if (!userId) {
        console.error('Unable to determine user ID from current user data');
        return;
      }
      
      // Determine role for role-based access
      const roleParam = isAdmin ? 'admin' : (isHR ? 'hr' : 'employee');
      
      console.log(`🔍 Fetching dashboard with user ID: ${userId}, role: ${roleParam}`);
      
      // Using the new HR staff route
      const dashboardEndpoint = `${API_BASE_URL}/api/hr/dashboard`;
      
      console.log(`📡 Fetching from: ${dashboardEndpoint}`);
      
      const response = await fetch(dashboardEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Log the raw response for debugging
      const responseText = await response.text();
      console.log(`📬 Dashboard API response:`, responseText);
      
      let stats;
      try {
        stats = JSON.parse(responseText);
        console.log('✅ Dashboard data parsed:', stats);
      } catch (e) {
        console.error('Error parsing dashboard response as JSON:', e);
        console.error('Response was:', responseText);
        // Fall back to manual calculation
        stats = null;
      }
      
      if (response.ok && stats) {
        // Handle different response formats - data might be nested
        const dashboardData = stats?.data || stats?.stats || stats;
        setDashboardStats(dashboardData);
        console.log('📊 Dashboard stats loaded');
      } else {
        console.error('Failed to fetch dashboard stats, falling back to manual calculation');
        
        // Try alternative endpoint if the first one failed
        let alternativeStats = null;
        
        try {
          const altEndpoint = `${API_BASE_URL}/api/employees/statistics?user_id=${encodeURIComponent(userId)}&role=${roleParam}`;
          console.log(`🔄 Trying alternative endpoint: ${altEndpoint}`);
          
          const altResponse = await fetch(altEndpoint, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (altResponse.ok) {
            const altData = await altResponse.json();
            const dashboardData = altData?.data || altData?.stats || altData;
            if (dashboardData && typeof dashboardData === 'object') {
              alternativeStats = dashboardData;
              setDashboardStats(dashboardData);
              console.log('✅ Dashboard stats loaded from alternative endpoint');
            }
          }
        } catch (altError) {
          console.error('Alternative endpoint also failed:', altError);
        }
        
        // If alternative endpoint also failed, use manual calculation
        if (!alternativeStats) {
          // Set default stats if API fails
          const today = new Date().toISOString().split('T')[0];
          
          const manualStats = {
            totalEmployees: employees.length,
            presentToday: allEmployeeAttendance.filter(a => a.date === today && a.status === 'present').length,
            absentToday: employees.length - allEmployeeAttendance.filter(a => a.date === today && a.status === 'present').length,
            onLeaveToday: leaveRequests.filter(l => {
              const startDate = new Date(l.start_date);
              const endDate = new Date(l.end_date);
              const todayDate = new Date(today);
              return l.status === 'approved' && startDate <= todayDate && endDate >= todayDate;
            }).length,
            pendingLeaveRequests: leaveRequests.filter(l => l.status === 'pending').length,
            departmentBreakdown: []
          };
          
          setDashboardStats(manualStats);
          console.log('📊 Using manually calculated dashboard stats');
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      
      // Still ensure we have some stats
      const today = new Date().toISOString().split('T')[0];
      const fallbackStats = {
        totalEmployees: employees.length,
        presentToday: 0,
        absentToday: 0,
        onLeaveToday: 0,
        pendingLeaveRequests: 0,
        departmentBreakdown: []
      };
      
      setDashboardStats(fallbackStats);
    }
  };
  
  // Fetch attendance records
  const fetchAttendance = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      
      console.log('🗓️ Fetching attendance records');
      
      // Get all possible ID fields from currentUser to ensure we find the correct one
      const userId = currentUser?.id || currentUser?.user_id || currentUser?._id;
      if (!userId) {
        console.error('Unable to determine user ID from current user data');
        return;
      }
      
      // Determine role for role-based access
      const roleParam = isAdmin ? 'admin' : (isHR ? 'hr' : 'employee');
      
      console.log(`🔍 Fetching attendance with user ID: ${userId}, role: ${roleParam}`);
      
      // Using the new HR staff route
      let myAttendanceEndpoint = `${API_BASE_URL}/api/hr/attendance?page=1&limit=100`;
      
      // For regular employees, only show their own attendance
      if (!isAdmin && !isHR) {
        myAttendanceEndpoint = `${API_BASE_URL}/api/hr/attendance?employee_id=${encodeURIComponent(userId)}&page=1&limit=100`;
      }
      
      console.log(`📡 Fetching from: ${myAttendanceEndpoint}`);
      
      const myResponse = await fetch(myAttendanceEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Log the raw response for debugging
      const myResponseText = await myResponse.text();
      console.log(`📬 My attendance API response:`, myResponseText);
      
      let myData;
      try {
        myData = JSON.parse(myResponseText);
        console.log('✅ My attendance data parsed:', myData);
      } catch (e) {
        console.error('Error parsing attendance response as JSON:', e);
        console.error('Response was:', myResponseText);
        myData = [];
      }
      
      if (myResponse.ok) {
        // Handle different response formats - data might be nested
        const attendanceData = myData?.data || myData?.attendance || myData;
        setMyAttendance(Array.isArray(attendanceData) ? attendanceData : []);
      } else {
        console.error('Failed to fetch my attendance:', myResponseText);
        // Try alternative endpoint if the first one failed
        try {
          const altEndpoint = `${API_BASE_URL}/api/employees/attendance/user?user_id=${encodeURIComponent(userId)}`;
          console.log(`🔄 Trying alternative endpoint: ${altEndpoint}`);
          
          const altResponse = await fetch(altEndpoint, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (altResponse.ok) {
            const altData = await altResponse.json();
            const attendanceData = altData?.data || altData?.attendance || altData;
            setMyAttendance(Array.isArray(attendanceData) ? attendanceData : []);
            console.log('✅ Attendance loaded from alternative endpoint');
          }
        } catch (altError) {
          console.error('Alternative endpoint also failed:', altError);
        }
      }
      
      // Fetch all attendance (for HR/Admin)
      if (isAdmin || isHR) {
        // Using the updated endpoints from employees_new.py with role parameter
        const allAttendanceEndpoint = `${API_BASE_URL}/api/employees/attendance/all?current_user_id=${encodeURIComponent(userId)}&role=${roleParam}`;
        
        console.log(`📡 Fetching all attendance from: ${allAttendanceEndpoint}`);
        
        const allResponse = await fetch(allAttendanceEndpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        // Log the raw response for debugging
        const allResponseText = await allResponse.text();
        console.log(`📬 All attendance API response:`, allResponseText);
        
        let allData;
        try {
          allData = JSON.parse(allResponseText);
          console.log('✅ All attendance data parsed:', allData);
        } catch (e) {
          console.error('Error parsing all attendance response as JSON:', e);
          console.error('Response was:', allResponseText);
          allData = [];
        }
        
        if (allResponse.ok) {
          // Handle different response formats
          const allAttendanceData = allData?.data || allData?.attendance || allData;
          setAllEmployeeAttendance(Array.isArray(allAttendanceData) ? allAttendanceData : []);
          console.log(`📋 Loaded ${Array.isArray(allAttendanceData) ? allAttendanceData.length : 0} attendance records`);
        } else {
          console.error('Failed to fetch all attendance:', allResponseText);
        }
      }
      
      console.log('✅ Attendance records loaded');
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };
  
  // Fetch leave requests
  // Handle adding a new employee
  const handleAddEmployee = () => {
    // Reset selected employee if there was one
    setSelectedEmployee(null);
    
    // Initialize form with empty values and default values for required fields
    setNewEmployeeData({
      full_name: '',
      email: '',
      phone: '',
      dob: '',
      address: '',
      pincode: '',
      city: '',
      state: '',
      country: 'India',
      department: '',
      position: '',
      doj: new Date().toISOString().split('T')[0],
      salary: '',
      role: 'employee',
      role_ids: [],
      roles: [],
      reports_to: '',
      employee_type: 'full_time',
      shift: '9am - 6pm',
      gender: '',
      location: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      bank_name: '',
      bank_account_number: '',
      bank_ifsc: '',
      custom_password: false,
      password: ''
    });
    
    // Show the modal
    setShowAddEmployeeModal(true);
  };
  
  // Handle input change in new employee form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEmployeeData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle pincode lookup for city and state
  const handlePincodeBlur = async (e) => {
    const pincode = e.target.value.trim();
    if (pincode.length === 6) {
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const data = await response.json();
        
        if (data[0].Status === 'Success') {
          const postOffices = data[0].PostOffice;
          const state = postOffices[0].State;
          const availableCities = [...new Set(postOffices.map(po => po.District))];
          
          setCities(availableCities);
          setNewEmployeeData(prev => ({
            ...prev,
            state,
            city: availableCities[0] || ''
          }));
        } else {
          alert("Invalid Pincode. Please enter a valid 6-digit pincode.");
        }
      } catch (error) {
        console.error("Error fetching pincode data:", error);
      }
    }
  };
  
  // Handle view employee details
  const handleViewEmployee = async (employee) => {
    // First fetch complete employee details including all fields
    console.log("Viewing employee, initial data:", employee);
    
    // Try to fetch complete profile data for this employee
    const employeeId = employee.user_id || employee.id || employee._id || employee.employee_id;
    if (employeeId) {
      const completeEmployeeData = await fetchEmployeeById(employeeId);
      if (completeEmployeeData) {
        // Merge the data, prioritizing the fetched data but keeping any fields
        // that might only exist in the original data
        const mergedData = { ...employee, ...completeEmployeeData };
        console.log("Enhanced employee data for display:", mergedData);
        setSelectedEmployee(mergedData);
      } else {
        console.log("Could not fetch enhanced employee data, using basic data");
        setSelectedEmployee(employee);
      }
    } else {
      console.log("No employee ID found, using basic employee data");
      setSelectedEmployee(employee);
    }
    
    setActiveEmployeeTab('profile');
    setShowEmployeeDetailsModal(true);
  };
  
  // Handle edit employee
  const handleEditEmployee = (employee) => {
    if (!employee) {
      console.error("No employee data provided to edit function");
      return;
    }
    
    // Keep the selected employee data
    setSelectedEmployee(employee);
    
    console.log("Editing employee:", employee);
    
    // Helper function to safely get nested values
    const getNestedValue = (obj, path, defaultValue = '') => {
      const parts = path.split('.');
      let result = obj;
      
      for (const part of parts) {
        if (result == null || result[part] === undefined) return defaultValue;
        result = result[part];
      }
      
      return result || defaultValue;
    };
    
    // Look for fields in both direct properties and potential nested objects
    const extractField = (fieldName, defaultValue = '') => {
      // Try standard property
      if (employee[fieldName] !== undefined && employee[fieldName] !== null) {
        return employee[fieldName];
      }
      
      // Try variations of the field name
      const variations = {
        'full_name': ['name', 'fullName', 'full_name', 'employee_name'],
        'email': ['email', 'emailAddress', 'email_address'],
        'phone': ['phone', 'phoneNumber', 'phone_number', 'mobile'],
        'dob': ['date_of_birth', 'dob', 'birthdate', 'birth_date'],
        'address': ['address', 'streetAddress', 'street_address'],
        'pincode': ['zip_code', 'pincode', 'postal_code', 'postalCode', 'zip'],
        'city': ['city', 'town'],
        'state': ['state', 'province', 'region'],
        'country': ['country', 'nation'],
        'department': ['department', 'dept', 'division'],
        'position': ['position', 'title', 'job_title', 'jobTitle', 'designation'],
        'doj': ['date_of_joining', 'doj', 'joining_date', 'joinDate', 'join_date', 'start_date'],
        'salary': ['salary', 'wage', 'pay', 'compensation'],
        'employee_type': ['employee_type', 'employeeType', 'employment_type', 'type'],
        'shift': ['shift', 'work_hours', 'workHours', 'schedule'],
        'gender': ['gender', 'sex'],
        'location': ['location', 'office', 'work_location', 'site'],
        'emergency_contact_name': ['emergency_contact_name', 'emergency_contact.name', 'emergencyContact.name'],
        'emergency_contact_phone': ['emergency_contact_phone', 'emergency_contact.phone', 'emergencyContact.phone'],
        'bank_name': ['bank_name', 'bank_details.bank_name', 'bankDetails.bankName', 'bank.name'],
        'bank_account_number': ['bank_account_number', 'bank_details.account_number', 'bankDetails.accountNumber', 'bank.accountNumber'],
        'bank_ifsc': ['bank_ifsc', 'bank_details.ifsc', 'bankDetails.ifsc', 'bank.ifsc']
      };
      
      if (variations[fieldName]) {
        for (const variant of variations[fieldName]) {
          // Check if it's a nested path
          if (variant.includes('.')) {
            const nestedValue = getNestedValue(employee, variant);
            if (nestedValue) return nestedValue;
          } 
          // Check direct property
          else if (employee[variant] !== undefined && employee[variant] !== null) {
            return employee[variant];
          }
        }
      }
      
      return defaultValue;
    };
    
    // Populate the form with employee data - handle all available fields
    const formData = {
      full_name: extractField('full_name'),
      email: extractField('email'),
      phone: extractField('phone'),
      dob: extractField('dob'),
      address: extractField('address'),
      pincode: extractField('pincode'),
      city: extractField('city'),
      state: extractField('state'),
      country: extractField('country', 'India'),
      department: extractField('department'),
      position: extractField('position'),
      doj: extractField('doj', new Date().toISOString().split('T')[0]),
      salary: extractField('salary'),
      role: extractField('role', 'employee'),
      role_ids: employee.role_ids || [],
      roles: employee.roles || [employee.role].filter(Boolean),
      reports_to: extractField('reports_to'),
      employee_type: extractField('employee_type', 'full_time'),
      shift: extractField('shift', '9am - 6pm'),
      gender: extractField('gender'),
      location: extractField('location'),
      emergency_contact_name: extractField('emergency_contact_name'),
      emergency_contact_phone: extractField('emergency_contact_phone'),
      bank_name: extractField('bank_name'),
      bank_account_number: extractField('bank_account_number'),
      bank_ifsc: extractField('bank_ifsc'),
      custom_password: false,
      password: ''
    };
    
    setNewEmployeeData(formData);
    
    console.log("Form data populated:", formData);
    
    // Check if we have valid data using the local formData object
    if (formData.full_name || formData.email) {
      setShowEmployeeDetailsModal(false);
      setShowAddEmployeeModal(true);
    } else {
      console.error("Failed to populate employee form data for editing");
      alert("Could not load employee data for editing. Please try again.");
    }
  };
  
  // Handle document upload with improved error handling
  const handleUploadDocument = () => {
    if (!selectedEmployee) {
      console.error("Cannot upload document: No employee selected");
      alert("Please select an employee first");
      return;
    }
    
    setShowDocumentUploadModal(true);
  };

  // Handle document upload completion
  const handleDocumentUploadComplete = async (newDocument) => {
    try {
      // Refresh employee data to include the new document
      const employeeId = selectedEmployee.user_id || selectedEmployee.employee_id || selectedEmployee._id || selectedEmployee.id;
      const updatedEmployee = await fetchEmployeeById(employeeId);
      if (updatedEmployee) {
        setSelectedEmployee(updatedEmployee);
      }
      
      setShowDocumentUploadModal(false);
      console.log('Document uploaded successfully!');
    } catch (error) {
      console.error('Error refreshing employee data after upload:', error);
    }
  };
  
  // Handle document deletion
  const handleDeleteDocument = async (documentId) => {
    if (!selectedEmployee || !documentId) return;
    
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/api/employees/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        alert('Document deleted successfully');
        
        // Refresh employee data
        const updatedEmployee = await fetchEmployeeById(selectedEmployee.user_id || selectedEmployee.id || selectedEmployee._id);
        if (updatedEmployee) {
          setSelectedEmployee(updatedEmployee);
        }
      } else {
        alert('Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Error deleting document');
    }
  };
  
  // Fetch available roles for the dropdown
  const fetchAvailableRoles = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      
      console.log('🔍 Fetching available user roles');
      
      // Try multiple possible endpoints for roles
      const endpoints = [
        `${API_BASE_URL}/api/roles`,
        `${API_BASE_URL}/api/employees/roles`,
        `${API_BASE_URL}/api/users/roles`,
        `${API_BASE_URL}/api/auth/roles`
      ];
      
      let rolesFound = false;
      
      for (const endpoint of endpoints) {
        try {
          console.log(`Trying to fetch roles from: ${endpoint}`);
          const response = await fetch(endpoint, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            
            // The API might return roles in different formats, handle various possible structures
            let roles = [];
            
            if (data.roles && Array.isArray(data.roles)) {
              roles = data.roles;
            } else if (data.role_list && Array.isArray(data.role_list)) {
              roles = data.role_list;
            } else if (data.data && Array.isArray(data.data)) {
              roles = data.data;
            } else if (Array.isArray(data)) {
              roles = data;
            }
            
            // Extract role names if the roles are objects
            const roleNames = roles.map(role => {
              if (typeof role === 'string') return role;
              if (typeof role === 'object' && role !== null) {
                return role.name || role.role_name || role.title || Object.values(role)[0];
              }
              return null;
            }).filter(Boolean);
            
            // If we got roles, use them and break the loop
            if (roleNames.length > 0) {
              setAvailableRoles(roleNames);
              console.log('✅ Fetched available roles:', roleNames);
              rolesFound = true;
              break;
            }
          }
        } catch (endpointError) {
          console.error(`Error with endpoint ${endpoint}:`, endpointError);
          continue;
        }
      }
      
      // If no roles were found from any endpoint, use defaults
      if (!rolesFound) {
        console.log('⚠️ No roles found, using default roles');
        setAvailableRoles(['admin', 'hr', 'manager', 'employee', 'sales']);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      // Fallback to default roles
      setAvailableRoles(['admin', 'hr', 'manager', 'employee', 'sales']);
    }
  };
  
  const fetchAvailableDepartments = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      
      console.log('🔍 Fetching available departments');
      
      // Try multiple possible endpoints for departments
      const endpoints = [
        `${API_BASE_URL}/api/employees/departments`,
        `${API_BASE_URL}/api/departments`,
        `${API_BASE_URL}/api/users/departments`
      ];
      
      let departmentsFound = false;
      
      for (const endpoint of endpoints) {
        try {
          console.log(`Trying to fetch departments from: ${endpoint}`);
          const response = await fetch(endpoint, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            
            // The API might return departments in different formats, handle various possible structures
            let departments = [];
            
            if (data.departments && Array.isArray(data.departments)) {
              departments = data.departments;
            } else if (data.data && Array.isArray(data.data)) {
              departments = data.data;
            } else if (Array.isArray(data)) {
              departments = data;
            }
            
            // If we got departments, use them and break the loop
            if (departments.length > 0) {
              setAvailableDepartments(departments);
              console.log('✅ Fetched available departments:', departments);
              departmentsFound = true;
              break;
            }
          }
        } catch (endpointError) {
          console.error(`Error with endpoint ${endpoint}:`, endpointError);
          continue;
        }
      }
      
      // If no departments were found from any endpoint, use defaults
      if (!departmentsFound) {
        console.log('⚠️ No departments found, using default departments');
        setAvailableDepartments([
          'Sales', 
          'Marketing', 
          'Human Resources', 
          'IT', 
          'Finance', 
          'Operations', 
          'Customer Service', 
          'Admin', 
          'Management'
        ]);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      // Fallback to default departments
      setAvailableDepartments([
        'Sales', 
        'Marketing', 
        'Human Resources', 
        'IT', 
        'Finance', 
        'Operations', 
        'Customer Service', 
        'Admin', 
        'Management'
      ]);
    }
  };
  
  // Fetch employee by ID
  const fetchEmployeeById = async (employeeId) => {
    try {
      const token = localStorage.getItem('access_token');
      
      console.log('Fetching employee details with ID:', employeeId);
      
      // First try to fetch the complete profile with all fields
      const profileResponse = await fetch(`${API_BASE_URL}/api/employees/${employeeId}/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (profileResponse.ok) {
        const profileResult = await profileResponse.json();
        console.log('Fetched employee profile data:', profileResult);
        
        // The profile endpoint might return data in different formats
        const profileData = profileResult.data || profileResult.employee || profileResult;
        
        // Fetch employee documents
        try {
          const documentsResponse = await fetch(`${API_BASE_URL}/api/employees/${employeeId}/documents`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (documentsResponse.ok) {
            const documentsResult = await documentsResponse.json();
            // Add documents to profile data
            profileData.documents = documentsResult.data || [];
          }
        } catch (err) {
          console.error('Error fetching employee documents:', err);
          // Continue without documents if fetch fails
          profileData.documents = [];
        }
        
        // Fetch employee leads
        try {
          const leadsResponse = await fetch(`${API_BASE_URL}/api/employees/${employeeId}/leads`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (leadsResponse.ok) {
            const leadsResult = await leadsResponse.json();
            // Add leads to profile data
            profileData.leads = leadsResult.data || [];
            profileData.leadsTotal = leadsResult.total || 0;
          }
        } catch (err) {
          console.error('Error fetching employee leads:', err);
          // Continue without leads if fetch fails
          profileData.leads = [];
          profileData.leadsTotal = 0;
        }
        
        if (profileData) {
          return profileData;
        }
      }
      
      // Fallback to basic employee endpoint if profile fetch failed
      console.log('Falling back to basic employee endpoint');
      const response = await fetch(`${API_BASE_URL}/api/employees/${employeeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Fetched basic employee data:', result);
        return result.employee || result.data || result;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching employee:', error);
      return null;
    }
  };
  
  // Handle save new employee
  const handleSaveEmployee = async () => {
    if (!newEmployeeData.full_name || !newEmployeeData.email || !newEmployeeData.phone) {
      alert("Please fill in all required fields");
      return;
    }
    
    setSaveLoading(true);
    
    try {
      const token = localStorage.getItem('access_token');
      
      // Use existing username if editing, otherwise generate a new one
      const username = selectedEmployee 
        ? newEmployeeData.username 
        : newEmployeeData.full_name.toLowerCase().replace(/\s+/g, '.').substring(0, 20);
      
      // Generate random password if custom password not set
      const password = selectedEmployee
        ? (newEmployeeData.custom_password ? newEmployeeData.password : undefined)
        : (newEmployeeData.custom_password 
            ? newEmployeeData.password 
            : Math.random().toString(36).slice(-8) + Math.random().toString(36).toUpperCase().slice(-2) + '1!');
      
      // Preserve original employee ID if we're updating
      const employeeId = selectedEmployee?.user_id || selectedEmployee?.id || selectedEmployee?._id;
      
      // Log the original employee data for debugging
      if (selectedEmployee) {
        console.log('Original employee data before update:', selectedEmployee);
      }
      
      // Prepare complete employee data with all fields from the model
      // Format the data exactly as the backend schema expects based on the provided example
      const employeeData = {
        // Include the ID if we're editing an existing employee - backend expects user_id
        ...(employeeId ? { user_id: employeeId } : {}),
        
        // Core identity fields - Include both variations of field names for maximum compatibility
        name: newEmployeeData.full_name,
        full_name: newEmployeeData.full_name,
        email: newEmployeeData.email,
        phone: newEmployeeData.phone,
        username: username,
        ...(password ? { password, custom_password: newEmployeeData.custom_password } : {}),
        
        // Employment details - Include both standard and alternative field names
        date_of_joining: newEmployeeData.doj || new Date().toISOString().split('T')[0],
        doj: newEmployeeData.doj || new Date().toISOString().split('T')[0],
        date_of_birth: newEmployeeData.dob || null,
        dob: newEmployeeData.dob || null,
        department: newEmployeeData.department || null,
        position: newEmployeeData.position || null,
        salary: newEmployeeData.salary ? newEmployeeData.salary.toString() : '0',
        
        // Role information - Include all variations that might be used
        role: newEmployeeData.role || 'employee',
        role_ids: newEmployeeData.role_ids && newEmployeeData.role_ids.length > 0 
          ? newEmployeeData.role_ids 
          : newEmployeeData.role === 'admin' ? ["Ro-002"] : ["Ro-003"],  // Updated to match example
        roles: Array.isArray(newEmployeeData.roles) && newEmployeeData.roles.length > 0
          ? newEmployeeData.roles 
          : [newEmployeeData.role === 'admin' ? 'manager' : 'employee'],  // Updated to match example
        reports_to: newEmployeeData.reports_to || null,
        reporting_user_id: newEmployeeData.reports_to || null,
        
        // Address information - Include both field name versions
        address: newEmployeeData.address || null,
        city: newEmployeeData.city || null,
        state: newEmployeeData.state || null,
        zip_code: newEmployeeData.pincode || null,
        pincode: newEmployeeData.pincode || null,
        country: newEmployeeData.country || 'India',
        
        // Emergency contact - both flat fields and nested object as in example
        emergency_contact_name: newEmployeeData.emergency_contact_name || null,
        emergency_contact_phone: newEmployeeData.emergency_contact_phone || null,
        emergency_contact: {
          name: newEmployeeData.emergency_contact_name || null,
          phone: newEmployeeData.emergency_contact_phone || null
        },
        
        // Bank details - both flat fields and nested object as in example
        bank_name: newEmployeeData.bank_name || null,
        bank_account_number: newEmployeeData.bank_account_number || null,
        bank_ifsc: newEmployeeData.bank_ifsc || null,
        bank_details: {
          bank_name: newEmployeeData.bank_name || null,
          account_number: newEmployeeData.bank_account_number || null,
          ifsc: newEmployeeData.bank_ifsc || null
        },
        
        // Additional details
        gender: newEmployeeData.gender || null,
        shift: newEmployeeData.shift || "9am - 6pm",
        employee_type: newEmployeeData.employee_type || "full_time",
        is_active: true,
        location: newEmployeeData.location || null
      };
      
      // Use standard user/employee routes
      const method = selectedEmployee ? 'PUT' : 'POST';
      const endpoint = selectedEmployee 
        ? `${API_BASE_URL}/api/employees/${employeeId}`  // Update existing employee
        : `${API_BASE_URL}/api/employees`; // Create new employee
      
      console.log('Sending employee data to endpoint:', endpoint);
      console.log('Using ID for update:', selectedEmployee ? (selectedEmployee.user_id || selectedEmployee.id || selectedEmployee._id) : 'N/A (new employee)');
      console.log('Employee data being sent:', employeeData);
      
      // Log the request body for debugging
      console.log('Sending request body:', JSON.stringify(employeeData, null, 2));

      // For updates, specifically handle the user_id properly
      // For PUT, include user_id in body (needed for backend schema compliance)
      // unlike REST standards, this API seems to expect user_id in both URL and body
      let requestData = {...employeeData};

      // Add specific fields for HR staff endpoints based on the schema
      // Use the exact format from the provided schema example
      requestData = {
        user_id: employeeId || null,
        name: newEmployeeData.full_name,
        full_name: newEmployeeData.full_name,
        email: newEmployeeData.email,
        phone: newEmployeeData.phone,
        date_of_joining: newEmployeeData.doj || new Date().toISOString().split('T')[0],
        doj: newEmployeeData.doj || new Date().toISOString().split('T')[0],
        date_of_birth: newEmployeeData.dob || null,
        dob: newEmployeeData.dob || null,
        department: newEmployeeData.department || null,
        position: newEmployeeData.position || null,
        salary: newEmployeeData.salary ? newEmployeeData.salary.toString() : '0',
        role: newEmployeeData.role || 'employee',
        role_ids: newEmployeeData.role_ids && newEmployeeData.role_ids.length > 0 
          ? newEmployeeData.role_ids 
          : newEmployeeData.role === 'admin' ? ["Ro-002"] : ["Ro-003"],
        roles: Array.isArray(newEmployeeData.roles) && newEmployeeData.roles.length > 0
          ? newEmployeeData.roles 
          : [newEmployeeData.role === 'admin' ? 'manager' : 'employee'],
        reports_to: newEmployeeData.reports_to || null,
        reporting_user_id: newEmployeeData.reports_to || null,
        address: newEmployeeData.address || null,
        city: newEmployeeData.city || null,
        state: newEmployeeData.state || null,
        zip_code: newEmployeeData.pincode || null,
        pincode: newEmployeeData.pincode || null,
        country: newEmployeeData.country || 'India',
        emergency_contact_name: newEmployeeData.emergency_contact_name || null,
        emergency_contact_phone: newEmployeeData.emergency_contact_phone || null,
        emergency_contact: {
          name: newEmployeeData.emergency_contact_name || null,
          phone: newEmployeeData.emergency_contact_phone || null
        },
        bank_name: newEmployeeData.bank_name || null,
        bank_account_number: newEmployeeData.bank_account_number || null,
        bank_ifsc: newEmployeeData.bank_ifsc || null,
        bank_details: {
          bank_name: newEmployeeData.bank_name || null,
          account_number: newEmployeeData.bank_account_number || null,
          ifsc: newEmployeeData.bank_ifsc || null
        },
        gender: newEmployeeData.gender || null,
        shift: newEmployeeData.shift || "9am - 6pm",
        employee_type: newEmployeeData.employee_type || "full_time",
        is_active: true,
        location: newEmployeeData.location || null
      };
      
      // Add password only if it's provided or new employee
      if (password) {
        requestData.password = password;
        requestData.custom_password = newEmployeeData.custom_password;
      }
      
      // Add username only if it's available
      if (username) {
        requestData.username = username;
      }

      // Log the final cleaned request body
      console.log('Final request body after cleaning:', JSON.stringify(requestData, null, 2));

      const response = await fetch(endpoint, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      // Log the response status and headers for debugging
      console.log('API response status:', response.status);
      console.log('API response headers:', Array.from(response.headers.entries()));
      
      let result;
      let responseOk = response.ok;
      let responseClone;
      
      // First attempt primary HR-specific endpoints
      if (response.ok) {
        // First make a clone of the response before consuming it
        responseClone = response.clone();
        
        // Parse the JSON from the original response
        result = await response.json();
        console.log('API success response:', result);
      } else {
        // If the first endpoint fails, try alternative endpoints
        if (selectedEmployee) {
          // For updates, try the alternative update endpoint
          console.log('Primary update endpoint failed, trying alternative endpoint...');
          const alternativeEndpoint = `${API_BASE_URL}/api/users/${employeeId}`;
          console.log('Alternative endpoint:', alternativeEndpoint);
          
          // Add employee_id to the request body for this endpoint
          const alternativeRequestData = {
            ...requestData,
            user_id: employeeId
          };
          
          const alternativeResponse = await fetch(alternativeEndpoint, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(alternativeRequestData)
          });
          
          console.log('Alternative API response status:', alternativeResponse.status);
          
          if (alternativeResponse.ok) {
            responseOk = true;
            responseClone = alternativeResponse.clone();
            result = await alternativeResponse.json();
            console.log('Alternative API success response for update:', result);
          } else {
            console.error('Both primary and alternative update endpoints failed');
            const errorText = await alternativeResponse.text();
            console.error('Alternative update endpoint error:', errorText);
          }
        } else {
          // For new employee creation, try an alternative create endpoint
          console.log('Primary creation endpoint failed, trying alternative endpoint...');
          const alternativeEndpoint = `${API_BASE_URL}/api/users`;
          console.log('Alternative endpoint:', alternativeEndpoint);
          
          const alternativeResponse = await fetch(alternativeEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
          });
          
          console.log('Alternative API response status:', alternativeResponse.status);
          
          if (alternativeResponse.ok) {
            responseOk = true;
            responseClone = alternativeResponse.clone();
            result = await alternativeResponse.json();
            console.log('Alternative API success response for create:', result);
          } else {
            console.error('Both primary and alternative creation endpoints failed');
            const errorText = await alternativeResponse.text();
            console.error('Alternative creation endpoint error:', errorText);
          }
        }
        
        // If both primary and alternative endpoints failed, log the error from the primary endpoint
        if (!responseOk) {
          const errorText = await response.text();
          console.error(`API error response (${response.status} ${response.statusText}):`, errorText);
          
          try {
            // Try to parse error as JSON for more detailed information
            const errorJson = JSON.parse(errorText);
            console.error('Error details:', errorJson);
            
            // Check for validation errors which might indicate schema issues
            if (errorJson.detail && typeof errorJson.detail === 'string' && 
                errorJson.detail.includes('validation error')) {
              console.error('Schema validation error detected. Check field formats.');
            }
          } catch (e) {
            // If error text isn't JSON, just log as text
            console.error('Error response is not JSON format');
          }
        }
      }
      
      if (responseOk) {
        // Process successful response
        
        // Try to get raw text from the clone for debugging (optional, will skip if fails)
        try {
          if (responseClone) {
            const rawResponse = await responseClone.text();
            console.log('Raw API response text:', rawResponse);
          }
        } catch (cloneErr) {
          console.warn('Could not get raw response text:', cloneErr);
        }
        
        // Display success message
        if (selectedEmployee) {
          alert('Employee updated successfully!');
          
          // Update the selected employee with the new data returned from API
          if (result && (result.data || result.employee || result.success)) {
            const updatedEmployee = result.data || result.employee || 
                                   (result.success && typeof result.updated_user !== 'undefined' ? employeeData : result);
            console.log('Updated employee data from API:', updatedEmployee);
            
            // Compare sent data with received data to check for discrepancies
            if (typeof updatedEmployee === 'object' && updatedEmployee !== null) {
              console.log('Data comparison between sent and received:');
              Object.keys(employeeData).forEach(key => {
                if (JSON.stringify(employeeData[key]) !== JSON.stringify(updatedEmployee[key]) && 
                    updatedEmployee[key] !== undefined) {
                  console.log(`Field '${key}' - Sent: ${JSON.stringify(employeeData[key])}, Received: ${JSON.stringify(updatedEmployee[key])}`);
                }
              });
            } else {
              console.log('No detailed employee data returned from API, using sent data');
            }
            
            // Update the UI with the data we received from the success response
            setSelectedEmployee({...selectedEmployee, ...updatedEmployee});
            
            // Refresh the employee list to show updated data
            setTimeout(async () => {
              try {
                await fetchEmployees();
                console.log('Employee list refreshed after update');
              } catch (refreshError) {
                console.error('Error refreshing employee list:', refreshError);
              }
            }, 500);
            
            // Make a separate request to verify the data was actually saved
            setTimeout(async () => {
              try {
                const employeeIdForVerification = selectedEmployee.user_id || 
                                               selectedEmployee.id || 
                                               selectedEmployee._id || 
                                               selectedEmployee.employee_id || 
                                               employeeId;
                                               
                if (!employeeIdForVerification) {
                  console.error('No employee ID available for verification');
                  return;
                }
                                               
                // Use standard employee endpoints for verification
                const verificationEndpoint = `${API_BASE_URL}/api/employees/${employeeIdForVerification}`;
                console.log(`Verifying data was saved by fetching from endpoint: ${verificationEndpoint}`);
                
                const verifyResponse = await fetch(verificationEndpoint, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                });
                
                if (verifyResponse.ok) {
                  const verifyData = await verifyResponse.json();
                  const verifiedEmployee = verifyData.data || verifyData.employee || verifyData;
                  console.log('Verification data after update:', verifiedEmployee);
                  
                  // Update the UI with the verified data
                  setSelectedEmployee(prevState => {
                    return {...prevState, ...verifiedEmployee};
                  });
                } else {
                  console.warn(`Verification request failed with status: ${verifyResponse.status}`);
                  
                  // Try alternative endpoint for verification
                  try {
                    const altVerificationEndpoint = `${API_BASE_URL}/api/users/${employeeIdForVerification}`;
                    console.log(`Trying alternative verification endpoint: ${altVerificationEndpoint}`);
                    
                    const altVerifyResponse = await fetch(altVerificationEndpoint, {
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      }
                    });
                    
                    if (altVerifyResponse.ok) {
                      const altVerifyData = await altVerifyResponse.json();
                      const altVerifiedEmployee = altVerifyData.data || altVerifyData.employee || altVerifyData;
                      console.log('Alternative verification data after update:', altVerifiedEmployee);
                      
                      // Update the UI with the verified data
                      setSelectedEmployee(prevState => {
                        return {...prevState, ...altVerifiedEmployee};
                      });
                    } else {
                      console.warn(`Alternative verification request failed with status: ${altVerifyResponse.status}`);
                    }
                  } catch (altVerifyError) {
                    console.error('Error with alternative verification:', altVerifyError);
                  }
                }
              } catch (verifyError) {
                console.error('Error verifying updated data:', verifyError);
              }
            }, 1000); // Slightly longer delay to ensure backend has processed the update
          }
        } else {
          // Show generated credentials for new employees
          if (!newEmployeeData.custom_password) {
            alert(`Employee created successfully!\n\nLogin credentials:\nUsername: ${username}\nPassword: ${password}\n\nPlease save these credentials.`);
          } else {
            alert('Employee created successfully!');
          }
          
          // Refresh the employees list to include the new employee
          setTimeout(async () => {
            try {
              await fetchEmployees();
              console.log('Employee list refreshed after creating new employee');
            } catch (refreshError) {
              console.error('Error refreshing employee list:', refreshError);
            }
          }, 500);
        }
        
        // Reset form and close modal
        setShowAddEmployeeModal(false);
        setSelectedEmployee(null);
        setNewEmployeeData({
          full_name: '',
          email: '',
          phone: '',
          dob: '',
          address: '',
          pincode: '',
          city: '',
          state: '',
          country: 'India',
          department: '',
          position: '',
          doj: new Date().toISOString().split('T')[0],
          salary: '',
          role: 'employee',
          role_ids: [],
          roles: [],
          reports_to: '',
          employee_type: 'full_time',
          shift: '9am - 6pm',
          gender: '',
          location: '',
          emergency_contact_name: '',
          emergency_contact_phone: '',
          bank_name: '',
          bank_account_number: '',
          bank_ifsc: '',
          custom_password: false,
          password: ''
        });
        
        // Refresh the employees list after a short delay to ensure backend has processed the update
        setTimeout(async () => {
          console.log('Refreshing employee list to reflect changes');
          await fetchEmployees();
          
          // If this was an update, immediately fetch the latest employee data to verify update
          if (selectedEmployee) {
            const empId = selectedEmployee.user_id || selectedEmployee.id || selectedEmployee._id;
            console.log(`Re-fetching updated employee with ID: ${empId}`);
            const refreshedEmployee = await fetchEmployeeById(empId);
            if (refreshedEmployee) {
              console.log('Refreshed employee data after update:', refreshedEmployee);
              
              // Force update any UI components that might be displaying this employee
              // This is a fallback in case the normal state updates aren't working
              if (document.getElementById('employee-refresh-trigger')) {
                document.getElementById('employee-refresh-trigger').click();
              }
            }
          }
        }, 500); // Small delay to ensure backend has processed the update
      } else {
        // Clone the response before trying to read its body
        const errorResponseClone = response.clone();
        
        let errorMessage = 'Failed to save employee';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
          console.error('API error response:', errorData);
        } catch (e) {
          // If JSON parsing fails, try to get text
          try {
            const errorText = await errorResponseClone.text();
            console.error('Error response text:', errorText);
            errorMessage = `Failed to save employee: ${response.status} ${response.statusText}`;
          } catch (textError) {
            // If all else fails, just use status
            errorMessage = `Failed to save employee: ${response.status} ${response.statusText}`;
          }
          console.error('Failed to parse API error response, status:', response.status, response.statusText);
        }
        
        // Log additional debugging info
        console.error(`API endpoint that failed: ${endpoint}`);
        console.error(`ID being used: ${selectedEmployee ? (selectedEmployee.user_id || selectedEmployee.id || selectedEmployee._id) : 'N/A (new employee)'}`);
        
        alert(`${errorMessage}\n\nStatus code: ${response.status}\nPlease check the console for details.`);
      }
    } catch (error) {
      console.error('Error saving employee:', error);
      alert(`An error occurred while saving the employee: ${error.message || 'Unknown error'}`);
    } finally {
      setSaveLoading(false);
    }
  };
  
  const fetchLeaveRequests = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      
      console.log('🏝️ Fetching leave requests');
      
      // Get all possible ID fields from currentUser to ensure we find the correct one
      const userId = currentUser?.id || currentUser?.user_id || currentUser?._id;
      if (!userId) {
        console.error('Unable to determine user ID from current user data');
        return;
      }
      
      // Log the entire user object for debugging
      console.log('🔍 Current user object:', JSON.stringify(currentUser, null, 2));
      
      // Determine role for role-based access
      const roleParam = isAdmin ? 'admin' : (isHR ? 'hr' : 'employee');
      
      console.log(`🔑 Using user ID: ${userId}, roleParam: ${roleParam}`);
      
      // Using the new HR staff route
      let endpoint;
      
      // For regular employees, only show their own leave requests
      if (!isAdmin && !isHR) {
        endpoint = `${API_BASE_URL}/api/hr/leave-requests?employee_id=${encodeURIComponent(userId)}&page=1&limit=100`;
      } else {
        // For HR/Admin, show all leave requests
        endpoint = `${API_BASE_URL}/api/hr/leave-requests?page=1&limit=100`;
      }
      
      console.log(`📡 Fetching from endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Log the raw response for debugging
      const responseText = await response.text();
      console.log(`📬 Raw API response: ${responseText}`);
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
        console.log('✅ Leave request response parsed:', responseData);
      } catch (e) {
        console.error('Error parsing leave request response as JSON:', e);
        console.error('Response was:', responseText);
        
        // Try alternative endpoint if the first one failed with JSON parse error
        try {
          console.log('🔄 Trying alternative leave requests endpoint format');
          
          // For regular employees, use their specific endpoint which is more reliable
          let altEndpoint;
          if (!isAdmin && !isHR) {
            altEndpoint = `${API_BASE_URL}/api/employees/${encodeURIComponent(userId)}/leave-requests`;
            console.log('👤 Using employee-specific endpoint for regular user');
          } else {
            // For admin/HR users, use the admin endpoint with proper parameters
            altEndpoint = `${API_BASE_URL}/api/employees/leave-requests?current_user_id=${encodeURIComponent(userId)}&current_user_roles=${encodeURIComponent(rolesParam)}`;
            console.log('👑 Using admin endpoint for leave requests');
          }
          
          console.log(`📡 Fetching from: ${altEndpoint}`);
          
          const altResponse = await fetch(altEndpoint, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          const altText = await altResponse.text();
          responseData = JSON.parse(altText);
          
        } catch (altError) {
          console.error('Alternative endpoint also failed:', altError);
          alert(`Error loading leave requests: Invalid JSON response from server`);
          return;
        }
      }
      
      if (response.ok) {
        // Handle the structured response format from employees_new.py
        const data = responseData.data || responseData.requests || responseData;
        
        // Set leave requests from the data
        setLeaveRequests(Array.isArray(data) ? data : []);
        console.log(`📋 Loaded ${Array.isArray(data) ? data.length : 0} leave requests`);
        
        // Calculate leave counts for admin dashboard
        if (isAdmin || isHR) {
          const counts = {
            casual: 0,
            casual_pending: 0,
            sick: 0, 
            sick_pending: 0,
            annual: 0,
            annual_pending: 0,
            other: 0,
            other_pending: 0
          };
          
          if (Array.isArray(data)) {
            data.forEach(leave => {
              const type = leave.leave_type?.toLowerCase() || 'other';
              
              if (leave.status === 'pending') {
                counts[`${type}_pending`] = (counts[`${type}_pending`] || 0) + 1;
              }
              
              counts[type] = (counts[type] || 0) + 1;
            });
          }
          
          setLeaveCounts(counts);
          
          // Use metadata from response if available
          if (responseData.can_manage_all !== undefined) {
            // Update local state to reflect if the user can manage all leave requests
            setIsAdmin(responseData.can_manage_all);
          }
        }
        
        console.log('✅ Leave requests loaded');
      } else {
        console.error('Failed to fetch leave requests:', responseText);
        // Try to extract error message and show to user
        let errorMessage;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.detail || errorData.message || errorData.error || `Error ${response.status}`;
        } catch (e) {
          errorMessage = `Error ${response.status}: ${responseText.substring(0, 100)}`;
        }
        
        alert(`Failed to load leave requests: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      alert(`Error loading leave requests: ${error.message || String(error)}`);
    }
  };
  
  // Handle check-in
  const handleCheckIn = async (notes = '') => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      
      console.log('✍️ Recording check in');
      
      // Get all possible ID fields from currentUser to ensure we find the correct one
      const userId = currentUser?.id || currentUser?.user_id || currentUser?._id;
      if (!userId) {
        console.error('Unable to determine user ID from current user data');
        alert('Unable to check in: User ID not found');
        return;
      }
      
      // Determine role for role-based access
      const roleParam = isAdmin ? 'admin' : (isHR ? 'hr' : 'employee');
      
      console.log(`🔍 Recording check-in with user ID: ${userId}, role: ${roleParam}`);
      
      // Using the new HR staff route
      const response = await fetch(`${API_BASE_URL}/api/hr/attendance/checkin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          employee_id: userId
        })
      });
      
      // Always log the full response for debugging
      let responseText;
      try {
        responseText = await response.text();
        console.log(`📡 Check-in Response:`, responseText);
      } catch (e) {
        responseText = "Unable to get response text";
        console.error('Error getting response text:', e);
      }
      
      if (response.ok) {
        // Try to parse response
        try {
          const responseData = JSON.parse(responseText);
          console.log('✅ Check-in recorded successfully:', responseData);
          alert('Check-in recorded successfully!');
        } catch (e) {
          console.log('Check-in successful but unable to parse response');
        }
        
        // Refresh attendance
        fetchAttendance();
      } else {
        console.error('Failed to record check-in:', responseText);
        
        // Try alternative endpoint if the first one failed
        try {
          const altEndpoint = `${API_BASE_URL}/api/employees/${encodeURIComponent(userId)}/attendance/checkin`;
          console.log(`🔄 Trying alternative endpoint: ${altEndpoint}`);
          
          const altResponse = await fetch(altEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notes })
          });
          
          if (altResponse.ok) {
            console.log('✅ Check-in recorded using alternative endpoint');
            alert('Check-in recorded successfully!');
            fetchAttendance();
            return;
          } else {
            const altText = await altResponse.text();
            console.error('Alternative endpoint also failed:', altText);
            alert(`Failed to record check-in: ${altText.substring(0, 100)}`);
          }
        } catch (altError) {
          console.error('Error with alternative check-in endpoint:', altError);
        }
        
        // Extract error message and show to user
        let errorMessage;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.detail || errorData.message || errorData.error || `Error ${response.status}`;
        } catch (e) {
          errorMessage = responseText.substring(0, 100) || `Error ${response.status}`;
        }
        
        alert(`Failed to record check-in: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error recording check-in:', error);
      alert(`Error recording check-in: ${error.message || String(error)}`);
    }
  };
  
  // Handle check-out
  const handleCheckOut = async (notes = '') => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      
      console.log('✍️ Recording check out');
      
      // Get all possible ID fields from currentUser to ensure we find the correct one
      const userId = currentUser?.id || currentUser?.user_id || currentUser?._id;
      if (!userId) {
        console.error('Unable to determine user ID from current user data');
        alert('Unable to check out: User ID not found');
        return;
      }
      
      // Determine role for role-based access
      const roleParam = isAdmin ? 'admin' : (isHR ? 'hr' : 'employee');
      
      console.log(`🔍 Recording check-out with user ID: ${userId}, role: ${roleParam}`);
      
      // Using the new HR staff route
      const response = await fetch(`${API_BASE_URL}/api/hr/attendance/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          employee_id: userId
        })
      });
      
      // Always log the full response for debugging
      let responseText;
      try {
        responseText = await response.text();
        console.log(`📡 Check-out Response:`, responseText);
      } catch (e) {
        responseText = "Unable to get response text";
        console.error('Error getting response text:', e);
      }
      
      if (response.ok) {
        // Try to parse response
        try {
          const responseData = JSON.parse(responseText);
          console.log('✅ Check-out recorded successfully:', responseData);
          alert('Check-out recorded successfully!');
        } catch (e) {
          console.log('Check-out successful but unable to parse response');
        }
        
        // Refresh attendance
        fetchAttendance();
      } else {
        console.error('Failed to record check-out:', responseText);
        
        // Try the employee-specific endpoint if the generic one failed
        try {
          const altEndpoint = `${API_BASE_URL}/api/employees/${encodeURIComponent(userId)}/attendance/checkout`;
          console.log(`🔄 Trying employee-specific endpoint: ${altEndpoint}`);
          
          const altResponse = await fetch(altEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              notes,
              user_id: userId // Include user_id in case the API needs it
            })
          });
          
          if (altResponse.ok) {
            console.log('✅ Check-out recorded using employee-specific endpoint');
            alert('Check-out recorded successfully!');
            fetchAttendance();
            return;
          } else {
            const altText = await altResponse.text();
            console.error('Employee-specific endpoint also failed:', altText);
          }
        } catch (altError) {
          console.error('Error with employee-specific checkout endpoint:', altError);
        }
        
        // Extract error message and show to user
        let errorMessage;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.detail || errorData.message || errorData.error || `Error ${response.status}`;
        } catch (e) {
          errorMessage = responseText.substring(0, 100) || `Error ${response.status}`;
        }
        
        alert(`Failed to record check-out: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error recording check-out:', error);
      alert(`Error recording check-out: ${error.message || String(error)}`);
    }
  };
  
  // Update attendance record
  const handleUpdateAttendance = async (recordId, updateData) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      
      console.log('📝 Updating attendance record:', recordId, updateData);
      // Using the endpoints from employees_new.py
      const response = await fetch(`${API_BASE_URL}/api/employees/attendance/${recordId}/edit`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      if (response.ok) {
        // Refresh attendance records
        fetchAttendance();
        console.log('✅ Attendance record updated successfully');
      } else {
        console.error('Failed to update attendance record:', await response.text());
      }
    } catch (error) {
      console.error('Error updating attendance record:', error);
    }
  };
  
  // Submit leave request
  const handleSubmitLeaveRequest = async (leaveData) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return false;
      
      console.log('🏝️ Submitting leave request:', leaveData);
      
      // Log the entire user object for debugging
      console.log('🔍 Current user object for leave request:', JSON.stringify(currentUser, null, 2));
      
      // Get all possible ID fields from currentUser to ensure we find the correct one
      const userId = currentUser?.id || currentUser?.user_id || currentUser?._id;
      if (!userId) {
        console.error('Unable to determine user ID from current user data');
        alert('Unable to submit leave request: User ID not found');
        return false;
      }
      
      // Add current user ID if not set
      if (!leaveData.employee_id) {
        leaveData.employee_id = userId;
      }
      
      // Ensure user_id is set for backend API (this is critical for the employee_new.py API)
      leaveData.user_id = userId;
      
      // Get employee name from various possible fields
      const employeeName = currentUser?.name || 
                         currentUser?.full_name || 
                         currentUser?.username || 
                         'Employee';
      
      // Get email from currentUser
      const employeeEmail = currentUser?.email || '';
      
      // Get department from currentUser
      const department = currentUser?.department || '';
      
      console.log(`🔑 Submitting leave request for user ID: ${userId}, name: ${employeeName}`);
      
      // Add required fields as per employees_new.py API
      const enhancedLeaveData = {
        ...leaveData,
        user_id: userId,
        employee_id: userId, // Ensure both are set for backward compatibility
        employee_name: employeeName,
        employee_email: employeeEmail,
        requested_at: new Date().toISOString(),
        status: 'pending',
        department: department,
        days_count: calculateDaysBetween(leaveData.start_date, leaveData.end_date),
        days_requested: calculateDaysBetween(leaveData.start_date, leaveData.end_date),
        is_half_day: leaveData.is_half_day || false
      };
      
      // Using the new HR staff route
      const requestData = JSON.stringify({
        employee_id: userId,
        start_date: leaveData.start_date,
        end_date: leaveData.end_date,
        leave_type: leaveData.leave_type,
        reason: leaveData.reason
      });
      console.log('📤 Submitting leave request data:', requestData);
      
      const response = await fetch(`${API_BASE_URL}/api/hr/leave-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: requestData
      });
      
      // Always log the full response for debugging
      let responseText = "Unable to get response text";
      try {
        responseText = await response.text();
        console.log(`📡 Submit Leave Response (${response.status}):`);
        console.log(responseText); // Log the full text to help debug any issues
      } catch (e) {
        console.error('Error getting response text:', e);
      }
      
      if (response.ok) {
        let responseData;
        
        try {
          responseData = JSON.parse(responseText);
          console.log('✅ Parsed response data:', responseData);
        } catch (e) {
          console.error('Error parsing JSON response:', e);
          console.log('Response was:', responseText);
          alert('Error: Server returned invalid data. Please try again or contact support.');
          return false;
        }
        
        // Check if operation was successful - look for success flag or status code
        const isSuccess = responseData.success === true || 
                         responseData.status === 'success' || 
                         (responseData.data && !responseData.error);
        
        if (isSuccess) {
          console.log('✅ Leave request submitted successfully');
          alert('Leave request submitted successfully!');
          
          // Try to refresh leave requests
          try {
            await fetchLeaveRequests();
          } catch (refreshError) {
            console.error('Error refreshing leave requests after submission:', refreshError);
          }
          
          return true;
        } else {
          const errorMessage = responseData.message || responseData.error || responseData.detail || 'Unknown error';
          console.error('Failed to submit leave request:', errorMessage);
          alert(`Failed to submit leave request: ${errorMessage}`);
          return false;
        }
      } else {
        let errorMessage;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.detail || errorData.message || errorData.error || `Error ${response.status}`;
        } catch (e) {
          errorMessage = responseText.substring(0, 200) || `Error ${response.status}`;
        }
        
        console.error('Failed to submit leave request:', errorMessage);
        alert(`Failed to submit leave request: ${errorMessage}`);
        return false;
      }
    } catch (error) {
      const errorMessage = error.message || String(error);
      console.error('Error submitting leave request:', errorMessage);
      alert(`Error submitting leave request: ${errorMessage}`);
      return false;
    }
  };
  
  // Helper function to calculate days between two dates
  const calculateDaysBetween = (startDate, endDate) => {
    if (!startDate || !endDate) return 1;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end days
    
    return diffDays;
  };
  
  // Handle leave approval/rejection
  const handleLeaveRequestAction = async (requestId, action, reason = '') => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return false;
      
      console.log(`🏝️ ${action === 'approve' ? 'Approving' : 'Rejecting'} leave request:`, requestId);
      
      // Log the entire user object for debugging
      console.log('🔍 Current user object for leave action:', JSON.stringify(currentUser, null, 2));
      
      // Get current user ID for the API - try all possible ID fields
      const userId = currentUser?.id || currentUser?.user_id || currentUser?._id;
      if (!userId) {
        console.error('Unable to determine user ID from current user data');
        alert(`Unable to ${action} leave request: User ID not found`);
        return false;
      }
      
      // Make sure requestId is properly formatted
      // If it's an object with _id field (MongoDB format), extract string ID
      const formattedRequestId = requestId?.toString?.() || 
                               (requestId?._id?.toString?.()) || 
                               requestId;
      
      if (!formattedRequestId) {
        console.error('Invalid request ID provided');
        alert(`Unable to ${action} leave request: Invalid request ID`);
        return false;
      }
      
      console.log(`🔑 Using request ID: ${formattedRequestId}, user ID: ${userId}`);
      
      // Using the new HR staff route
      const endpoint = `${API_BASE_URL}/api/hr/leave-requests/${encodeURIComponent(formattedRequestId)}`;
      
      console.log(`📡 Sending ${action} request to: ${endpoint}`);
      
      // Prepare payload with required fields
      const payload = { 
        status: action === 'approve' ? 'approved' : 'rejected',
        comments: reason || `${action === 'approve' ? 'Approved' : 'Rejected'}`
      };
      
      console.log(`📤 Sending payload:`, JSON.stringify(payload));
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      // Always log the full response for debugging
      let responseText = "Unable to get response text";
      try {
        responseText = await response.text();
        console.log(`📡 ${action.toUpperCase()} Response (${response.status}):`);
        console.log(responseText); // Log the full text to help debug any issues
      } catch (e) {
        console.error('Error getting response text:', e);
      }
      
      if (response.ok) {
        let responseData;
        
        try {
          responseData = JSON.parse(responseText);
          console.log('✅ Parsed response data:', responseData);
        } catch (e) {
          console.error('Error parsing JSON response:', e);
          console.log('Response was:', responseText);
          alert(`Error: Server returned invalid data when trying to ${action} leave request. Please try again.`);
          return false;
        }
        
        // Check if operation was successful - look for success flag or status code
        const isSuccess = responseData.success === true || 
                         responseData.status === 'success' || 
                         (responseData.data && !responseData.error);
        
        if (isSuccess) {
          // Refresh leave requests
          console.log(`✅ Leave request ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
          alert(`Leave request ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
          
          // Try to refresh leave requests
          try {
            await fetchLeaveRequests();
          } catch (refreshError) {
            console.error('Error refreshing leave requests after action:', refreshError);
          }
          
          return true;
        } else {
          const errorMessage = responseData.message || responseData.error || responseData.detail || 'Unknown error';
          console.error(`Failed to ${action} leave request:`, errorMessage);
          alert(`Failed to ${action} leave request: ${errorMessage}`);
          return false;
        }
      } else {
        let errorMessage;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.detail || errorData.message || errorData.error || `Error ${response.status}`;
        } catch (e) {
          errorMessage = responseText.substring(0, 200) || `Error ${response.status}`;
        }
        
        // Check specifically for "employee not found" error
        if (errorMessage.toLowerCase().includes('employee not found') || 
            errorMessage.toLowerCase().includes('user not found')) {
          alert(`Unable to ${action} leave request: Your user account was not recognized by the system. Please contact your administrator.`);
        } else {
          alert(`Failed to ${action} leave request: ${errorMessage}`);
        }
        
        console.error(`Failed to ${action} leave request:`, errorMessage);
        return false;
      }
    } catch (error) {
      const errorMessage = error.message || String(error);
      console.error(`Error ${action}ing leave request:`, errorMessage);
      alert(`Error ${action}ing leave request: ${errorMessage}`);
      return false;
    }
  };
  
  // Update user profile
  const handleUpdateProfile = async (profileData) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return false;
      
      console.log('👤 Updating user profile:', profileData);
      
      const userId = currentUser?.id || currentUser?.user_id;
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      });
      
      if (response.ok) {
        // Update current user data
        fetchCurrentUser();
        console.log('✅ Profile updated successfully');
        return true;
      } else {
        console.error('Failed to update profile');
        return false;
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  };
  
  // Change password
  const handlePasswordChange = async (passwordData) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return false;
      
      console.log('🔒 Changing password');
      
      const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(passwordData)
      });
      
      if (response.ok) {
        console.log('✅ Password changed successfully');
        return true;
      } else {
        console.error('Failed to change password');
        return false;
      }
    } catch (error) {
      console.error('Error changing password:', error);
      return false;
    }
  };
  
  // Upload profile image
  const handleUploadProfileImage = async (imageFile) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return false;
      
      console.log('🖼️ Uploading profile image');
      
      const formData = new FormData();
      formData.append('file', imageFile);
      
      const userId = currentUser.user_id || currentUser.id;
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}/upload-profile-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (response.ok) {
        // Update current user data
        fetchCurrentUser();
        console.log('✅ Profile image uploaded successfully');
        return true;
      } else {
        console.error('Failed to upload profile image');
        return false;
      }
    } catch (error) {
      console.error('Error uploading profile image:', error);
      return false;
    }
  };
  
  // Sign out function
  const handleSignOut = () => {
    localStorage.removeItem('access_token');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-3 text-gray-700">Loading Staff Management...</p>
      </div>
    );
  }
  
  const isAdminOrHR = isAdmin || isHR;
  
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header with user info */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="text-xl font-bold text-blue-600">Staff Management</div>
            <div className="hidden md:flex space-x-1">
              {(isAdmin || isHR) && (
                <button 
                  onClick={() => setActiveTab('employees')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'employees' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Staff Management
                </button>
              )}
              
              <button 
                onClick={() => setActiveTab('attendance')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'attendance' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                My Attendance
              </button>
              
              <button 
                onClick={() => setActiveTab('leaves')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'leaves' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                My Leave Requests
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center">
              <div className="mr-2 text-right">
                <div className="text-sm font-medium text-gray-900">{currentUser?.name || currentUser?.full_name}</div>
                <div className="text-xs text-gray-500">{currentUser?.email}</div>
              </div>
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                {(currentUser?.name || currentUser?.full_name)?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
            
            <div className="md:hidden">
              <button 
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-md text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Navigation - Shown when menu is open */}
      {menuOpen && (
        <div className="md:hidden bg-white shadow-sm border-t">
          <div className="container mx-auto px-4 py-2">
            {(isAdmin || isHR) && (
              <button 
                onClick={() => {
                  setActiveTab('employees');
                  setMenuOpen(false);
                }}
                className={`block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'employees' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}
              >
                Staff Management
              </button>
            )}
            
            <button 
              onClick={() => {
                setActiveTab('attendance');
                setMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'attendance' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}
            >
              My Attendance
            </button>
            
            <button 
              onClick={() => {
                setActiveTab('leaves');
                setMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${activeTab === 'leaves' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}
            >
              My Leave Requests
            </button>
            
            <button 
              onClick={handleSignOut}
              className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-600"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
      
      {/* Main Content Area */}
      <div className="container mx-auto p-4">
        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <AttendanceManagement 
            currentUser={currentUser}
            myAttendance={myAttendance}
            allAttendance={allEmployeeAttendance}
            employees={employees}
            handleCheckIn={handleCheckIn}
            handleCheckOut={handleCheckOut}
            handleUpdateAttendance={handleUpdateAttendance}
            isAdminOrHR={isAdminOrHR}
          />
        )}
        
        {/* Leave Management Tab */}
        {activeTab === 'leaves' && (
          <LeaveManagement 
            hasPermission={hasPermission}
            leaveRequests={leaveRequests}
            employees={employees}
            user={currentUser}
            loading={loading}
            handleLeaveRequestAction={handleLeaveRequestAction}
            handleCreateLeaveRequest={handleSubmitLeaveRequest}
            leaveCounts={leaveCounts}
            userLeaves={leaveRequests.filter(leave => 
              leave.user_id === (currentUser?.id || currentUser?.user_id)
            )}
          />
        )}
        
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <ProfileManagement 
            userDetails={currentUser}
            handleUpdateProfile={handleUpdateProfile}
            handlePasswordChange={handlePasswordChange}
            uploadProfileImage={handleUploadProfileImage}
          />
        )}
        
        {/* Employees Tab (Admin/HR Only) */}
        {activeTab === 'employees' && isAdminOrHR && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
                <p className="text-gray-600 mt-1">Manage all employees in the organization</p>
              </div>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={handleAddEmployee}
              >
                Add New Employee
              </button>
            </div>
            
            {/* Employee filters and list will go here */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-medium">All Employees</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {employees.map(employee => {
                      // Get employee name from various possible fields
                      const employeeName = employee.name || employee.full_name || employee.first_name || 
                                          (employee.first_name && employee.last_name ? `${employee.first_name} ${employee.last_name}` : null) ||
                                          employee.username || employee.email?.split('@')[0] || 'Unknown Employee';
                      
                      // Get first letter for avatar
                      const avatarLetter = employeeName ? employeeName.charAt(0).toUpperCase() : 'U';
                      
                      return (
                      <tr key={employee.id || employee._id || employee.user_id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0">
                              {employee?.profile_image ? (
                                <img className="h-10 w-10 rounded-full object-cover" src={employee.profile_image} alt={employeeName} />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                                  {avatarLetter}
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{employeeName}</div>
                              <div className="text-xs text-gray-500">{employee.email || 'No email'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {employee.position || employee.role || 'Not assigned'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {employee.phone || 'No phone'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button 
                            onClick={() => handleViewEmployee(employee)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            View
                          </button>
                          <button 
                            onClick={() => handleEditEmployee(employee)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {/* Employee Details Modal */}
        {selectedEmployee && showEmployeeDetailsModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                        Employee Details
                      </h3>
                    </div>
                    <div className="mt-3 sm:mt-0">
                      <button 
                        onClick={() => {
                          console.log("Edit button clicked, employee data:", selectedEmployee);
                          handleEditEmployee(selectedEmployee);
                        }}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                      >
                        Edit Employee
                      </button>
                    </div>
                  </div>
                  
                  {/* Employee Tabs */}
                  <div className="border-b border-gray-200">
                    <nav className="-mb-px flex" aria-label="Tabs">
                      <button
                        onClick={() => setActiveEmployeeTab('profile')}
                        className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                          activeEmployeeTab === 'profile'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Profile
                      </button>
                      <button
                        onClick={() => setActiveEmployeeTab('leads')}
                        className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                          activeEmployeeTab === 'leads'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Leads
                      </button>
                      <button
                        onClick={() => setActiveEmployeeTab('documents')}
                        className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                          activeEmployeeTab === 'documents'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Documents
                      </button>
                    </nav>
                  </div>
                  
                  {/* Tab Content */}
                  <div className="mt-4">
                    {/* Profile Tab */}
                    {activeEmployeeTab === 'profile' && (
                      <div className="space-y-6">
                        <div className="flex items-center space-x-4">
                          {(() => {
                            // Get employee name from various possible fields
                            const employeeName = selectedEmployee.name || selectedEmployee.full_name || selectedEmployee.first_name || 
                                                (selectedEmployee.first_name && selectedEmployee.last_name ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : null) ||
                                                selectedEmployee.username || selectedEmployee.email?.split('@')[0] || 'Unknown Employee';
                            
                            // Get first letter for avatar
                            const avatarLetter = employeeName ? employeeName.charAt(0).toUpperCase() : 'U';
                            
                            return (
                              <>
                                {selectedEmployee.profile_image ? (
                                  <img
                                    src={selectedEmployee.profile_image}
                                    alt={employeeName}
                                    className="h-20 w-20 rounded-full object-cover border-2 border-gray-200"
                                  />
                                ) : (
                                  <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 text-xl font-semibold border-2 border-gray-200">
                                    {avatarLetter}
                                  </div>
                                )}
                                <div>
                                  <h4 className="text-lg font-semibold">{employeeName}</h4>
                                  <p className="text-gray-600">{selectedEmployee.position || selectedEmployee.role}</p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Personal Information */}
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <h5 className="font-semibold mb-3 text-gray-700">Personal Information</h5>
                            <div className="space-y-2">
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Full Name:</span>
                                <span className="col-span-2">
                                  {selectedEmployee.name || selectedEmployee.full_name || selectedEmployee.first_name || 
                                   (selectedEmployee.first_name && selectedEmployee.last_name ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : null) ||
                                   selectedEmployee.username || selectedEmployee.email?.split('@')[0] || 'Not provided'}
                                </span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Gender:</span>
                                <span className="col-span-2">{selectedEmployee.gender || 'Not provided'}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Date of Birth:</span>
                                <span className="col-span-2">
                                  {selectedEmployee.dob || selectedEmployee.date_of_birth ? 
                                    new Date(selectedEmployee.dob || selectedEmployee.date_of_birth).toLocaleDateString() : 
                                    'Not provided'}
                                </span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Email:</span>
                                <span className="col-span-2">{selectedEmployee.email || 'Not provided'}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Phone:</span>
                                <span className="col-span-2">{selectedEmployee.phone || 'Not provided'}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Employee ID:</span>
                                <span className="col-span-2">{selectedEmployee.employee_id || selectedEmployee.emp_id || selectedEmployee.id || 'Not assigned'}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Address Information */}
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <h5 className="font-semibold mb-3 text-gray-700">Address</h5>
                            <div className="space-y-2">
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Address:</span>
                                <span className="col-span-2">{selectedEmployee.address || 'Not provided'}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Pincode:</span>
                                <span className="col-span-2">{selectedEmployee.pincode || selectedEmployee.zip_code || 'Not provided'}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">City:</span>
                                <span className="col-span-2">{selectedEmployee.city || 'Not provided'}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">State:</span>
                                <span className="col-span-2">{selectedEmployee.state || 'Not provided'}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Country:</span>
                                <span className="col-span-2">{selectedEmployee.country || 'India'}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Job Details */}
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <h5 className="font-semibold mb-3 text-gray-700">Job Details</h5>
                            <div className="space-y-2">
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Department:</span>
                                <span className="col-span-2">{selectedEmployee.department || 'Not assigned'}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Position:</span>
                                <span className="col-span-2">{selectedEmployee.position || selectedEmployee.role || 'Not assigned'}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Employee Type:</span>
                                <span className="col-span-2">{selectedEmployee.employee_type || 'Full Time'}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Date of Joining:</span>
                                <span className="col-span-2">
                                  {selectedEmployee.doj || selectedEmployee.date_of_joining || selectedEmployee.joining_date ? 
                                    new Date(selectedEmployee.doj || selectedEmployee.date_of_joining || selectedEmployee.joining_date).toLocaleDateString() : 
                                    'Not provided'}
                                </span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Shift:</span>
                                <span className="col-span-2">{selectedEmployee.shift || '9am - 6pm'}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Location:</span>
                                <span className="col-span-2">{selectedEmployee.location || 'Not provided'}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Salary:</span>
                                <span className="col-span-2">₹ {selectedEmployee.salary || 'Not provided'}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Account Details */}
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <h5 className="font-semibold mb-3 text-gray-700">Account Details</h5>
                            <div className="space-y-2">
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Username:</span>
                                <span className="col-span-2">{selectedEmployee.username || 'Not provided'}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Role:</span>
                                <span className="col-span-2">{selectedEmployee.role || 'Employee'}</span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Status:</span>
                                <span className={`col-span-2 ${selectedEmployee.is_active ? 'text-green-600' : 'text-red-600'}`}>
                                  {selectedEmployee.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Emergency Contact Details */}
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <h5 className="font-semibold mb-3 text-gray-700">Emergency Contact</h5>
                            <div className="space-y-2">
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Name:</span>
                                <span className="col-span-2">
                                  {selectedEmployee.emergency_contact_name || 
                                   (selectedEmployee.emergency_contact && selectedEmployee.emergency_contact.name) || 
                                   'Not provided'}
                                </span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Phone:</span>
                                <span className="col-span-2">
                                  {selectedEmployee.emergency_contact_phone || 
                                   (selectedEmployee.emergency_contact && selectedEmployee.emergency_contact.phone) || 
                                   'Not provided'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Bank Details */}
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <h5 className="font-semibold mb-3 text-gray-700">Bank Details</h5>
                            <div className="space-y-2">
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Bank Name:</span>
                                <span className="col-span-2">
                                  {selectedEmployee.bank_name || 
                                   (selectedEmployee.bank_details && selectedEmployee.bank_details.bank_name) || 
                                   'Not provided'}
                                </span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">Account Number:</span>
                                <span className="col-span-2">
                                  {selectedEmployee.bank_account_number || 
                                   (selectedEmployee.bank_details && selectedEmployee.bank_details.account_number) || 
                                   'Not provided'}
                                </span>
                              </div>
                              <div className="grid grid-cols-3">
                                <span className="text-gray-600">IFSC Code:</span>
                                <span className="col-span-2">
                                  {selectedEmployee.bank_ifsc || 
                                   (selectedEmployee.bank_details && selectedEmployee.bank_details.ifsc) || 
                                   'Not provided'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Leads Tab */}
                    {activeEmployeeTab === 'leads' && (
                      <div>
                        <h5 className="font-semibold mb-3">Assigned Leads</h5>
                        <div className="flex justify-between items-center mb-4">
                          <div className="text-sm text-gray-500">
                            Total: {selectedEmployee.leadsTotal || selectedEmployee.leads?.length || 0} leads
                          </div>
                        </div>
                        
                        {selectedEmployee.leads && selectedEmployee.leads.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead ID</th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created Date</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {selectedEmployee.leads.map(lead => (
                                  <tr key={lead._id || lead.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lead.lead_id || lead._id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.company_name || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${lead.status === 'New' ? 'bg-blue-100 text-blue-800' : 
                                          lead.status === 'Working' ? 'bg-yellow-100 text-yellow-800' :
                                          lead.status === 'Qualified' ? 'bg-green-100 text-green-800' :
                                          lead.status === 'Converted' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {lead.status}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {new Date(lead.created_at || lead.created_date || Date.now()).toLocaleDateString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="py-8 text-center text-gray-500">No leads assigned to this employee</div>
                        )}
                      </div>
                    )}
                    
                    {/* Documents Tab */}
                    {activeEmployeeTab === 'documents' && (
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h5 className="font-semibold">Employee Documents</h5>
                          <button 
                            onClick={() => handleUploadDocument()}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                          >
                            <svg className="mr-2 -ml-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            Upload Document
                          </button>
                        </div>
                        
                        {selectedEmployee.documents && selectedEmployee.documents.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {selectedEmployee.documents.map((doc, index) => (
                              <div key={doc._id || index} className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
                                <div className="p-4 flex flex-col h-full">
                                  <div className="flex items-center mb-3">
                                    <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                    <div className="flex-1 truncate">
                                      <h6 className="font-medium text-gray-900 truncate">{doc.document_name || doc.filename || `Document ${index + 1}`}</h6>
                                      <p className="text-sm text-gray-500">{doc.document_type || 'General'}</p>
                                    </div>
                                  </div>
                                  <div className="mt-2 text-sm text-gray-500">
                                    <p>
                                      <span className="font-medium">Uploaded:</span> {doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : "Unknown"}
                                    </p>
                                    {doc.description && (
                                      <p className="mt-1 line-clamp-2">{doc.description}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-between mt-auto">
                                  <a 
                                    href={`${API_BASE_URL}/api/employees/${selectedEmployee.user_id || selectedEmployee._id}/documents/${doc._id || doc.id}/download`} 
                                    download
                                    className="text-xs font-medium text-indigo-600 hover:text-indigo-500 flex items-center"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download
                                  </a>
                                  <button 
                                    onClick={() => handleDeleteDocument(doc._id || doc.id)}
                                    className="text-xs font-medium text-red-600 hover:text-red-500 flex items-center"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center text-gray-500">No documents uploaded for this employee</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end">
                  <button 
                    type="button" 
                    className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                    onClick={() => {
                      setShowEmployeeDetailsModal(false);
                      setSelectedEmployee(null);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Add Employee Modal */}
        {showAddEmployeeModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                        {selectedEmployee ? 'Edit Employee' : 'Add New Employee'}
                      </h3>
                      <div className="mt-4">
                        <form className="space-y-6">
                          {/* Personal Information Section */}
                          <div>
                            <h4 className="text-md font-medium text-gray-800 border-b pb-2 mb-4">Personal Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                                  Full Name*
                                </label>
                                <input
                                  type="text"
                                  name="full_name"
                                  id="full_name"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  placeholder="Enter full name"
                                  value={newEmployeeData.full_name}
                                  onChange={handleInputChange}
                                  required
                                />
                              </div>
                              <div>
                                <label htmlFor="dob" className="block text-sm font-medium text-gray-700">
                                  Date of Birth
                                </label>
                                <input
                                  type="date"
                                  name="dob"
                                  id="dob"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  value={newEmployeeData.dob}
                                  onChange={handleInputChange}
                                />
                              </div>
                              <div>
                                <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
                                  Gender
                                </label>
                                <select
                                  name="gender"
                                  id="gender"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  value={newEmployeeData.gender || ''}
                                  onChange={handleInputChange}
                                >
                                  <option value="">Select Gender</option>
                                  <option value="Male">Male</option>
                                  <option value="Female">Female</option>
                                  <option value="Other">Other</option>
                                  <option value="Prefer not to say">Prefer not to say</option>
                                </select>
                              </div>
                              <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                  Email*
                                </label>
                                <input
                                  type="email"
                                  name="email"
                                  id="email"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  placeholder="Enter email address"
                                  value={newEmployeeData.email}
                                  onChange={handleInputChange}
                                  required
                                />
                              </div>
                              <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                                  Phone Number*
                                </label>
                                <input
                                  type="tel"
                                  name="phone"
                                  id="phone"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  placeholder="Enter phone number"
                                  value={newEmployeeData.phone}
                                  onChange={handleInputChange}
                                  required
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* Address Section */}
                          <div>
                            <h4 className="text-md font-medium text-gray-800 border-b pb-2 mb-4">Address</h4>
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                                  Address
                                </label>
                                <input
                                  type="text"
                                  name="address"
                                  id="address"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  placeholder="Enter address"
                                  value={newEmployeeData.address}
                                  onChange={handleInputChange}
                                />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <label htmlFor="pincode" className="block text-sm font-medium text-gray-700">
                                    Pincode
                                  </label>
                                  <input
                                    type="text"
                                    name="pincode"
                                    id="pincode"
                                    className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                    placeholder="Enter pincode"
                                    value={newEmployeeData.pincode}
                                    onChange={handleInputChange}
                                    onBlur={handlePincodeBlur}
                                  />
                                </div>
                                <div>
                                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                                    City
                                  </label>
                                  <select
                                    id="city"
                                    name="city"
                                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={newEmployeeData.city}
                                    onChange={handleInputChange}
                                  >
                                    <option value="">Select City</option>
                                    {cities.map((city, index) => (
                                      <option key={index} value={city}>{city}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                                    State
                                  </label>
                                  <input
                                    type="text"
                                    name="state"
                                    id="state"
                                    className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md bg-gray-100"
                                    placeholder="Auto-populated from pincode"
                                    value={newEmployeeData.state}
                                    readOnly
                                  />
                                </div>
                              </div>
                                <div>
                                  <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                                    Country
                                  </label>
                                  <input
                                    type="text"
                                    name="country"
                                    id="country"
                                    className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                    placeholder="Enter country"
                                    value={newEmployeeData.country}
                                    onChange={handleInputChange}
                                  />
                                </div>
                            </div>
                          </div>
                          
                          {/* Job Details Section */}
                          <div>
                            <h4 className="text-md font-medium text-gray-800 border-b pb-2 mb-4">Job Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label htmlFor="position" className="block text-sm font-medium text-gray-700">
                                  Position
                                </label>
                                <input
                                  type="text"
                                  name="position"
                                  id="position"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  placeholder="Enter position"
                                  value={newEmployeeData.position}
                                  onChange={handleInputChange}
                                />
                              </div>
                              <div>
                                <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                                  Department
                                </label>
                                <select
                                  id="department"
                                  name="department"
                                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                  value={newEmployeeData.department}
                                  onChange={handleInputChange}
                                >
                                  <option value="">Select Department</option>
                                  
                                  {/* If no departments are fetched yet, show default options */}
                                  {availableDepartments.length === 0 && (
                                    <>
                                      <option value="Sales">Sales</option>
                                      <option value="Admin">Admin</option>
                                      <option value="Management">Management</option>
                                      <option value="HR">Human Resources</option>
                                      <option value="IT">Information Technology</option>
                                      <option value="Finance">Finance</option>
                                    </>
                                  )}
                                  
                                  {/* Show all available departments from API */}
                                  {availableDepartments.map((department, index) => (
                                    <option key={index} value={department}>
                                      {department}
                                    </option>
                                  ))}
                                  <option value="Marketing">Marketing</option>
                                  <option value="Operations">Operations</option>
                                </select>
                              </div>
                              <div>
                                <label htmlFor="doj" className="block text-sm font-medium text-gray-700">
                                  Date of Joining
                                </label>
                                <input
                                  type="date"
                                  name="doj"
                                  id="doj"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  value={newEmployeeData.doj}
                                  onChange={handleInputChange}
                                />
                              </div>
                              <div>
                                <label htmlFor="salary" className="block text-sm font-medium text-gray-700">
                                  Salary
                                </label>
                                <input
                                  type="number"
                                  name="salary"
                                  id="salary"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  placeholder="Enter salary"
                                  value={newEmployeeData.salary}
                                  onChange={handleInputChange}
                                />
                              </div>
                              <div>
                                <label htmlFor="employee_type" className="block text-sm font-medium text-gray-700">
                                  Employment Type
                                </label>
                                <select
                                  id="employee_type"
                                  name="employee_type"
                                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                  value={newEmployeeData.employee_type}
                                  onChange={handleInputChange}
                                >
                                  <option value="full_time">Full Time</option>
                                  <option value="part_time">Part Time</option>
                                  <option value="contract">Contract</option>
                                  <option value="intern">Intern</option>
                                  <option value="probation">Probation</option>
                                </select>
                              </div>
                              <div>
                                <label htmlFor="shift" className="block text-sm font-medium text-gray-700">
                                  Work Shift
                                </label>
                                <input
                                  type="text"
                                  name="shift"
                                  id="shift"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  placeholder="e.g. 9am - 6pm"
                                  value={newEmployeeData.shift}
                                  onChange={handleInputChange}
                                />
                              </div>
                              <div>
                                <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                                  Work Location
                                </label>
                                <input
                                  type="text"
                                  name="location"
                                  id="location"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  placeholder="e.g. Head Office, Mumbai Branch"
                                  value={newEmployeeData.location}
                                  onChange={handleInputChange}
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* Login Credentials Section */}
                          <div>
                            <h4 className="text-md font-medium text-gray-800 border-b pb-2 mb-4">Login Credentials</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                                  Role
                                </label>
                                <select
                                  id="role"
                                  name="role"
                                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                  value={newEmployeeData.role}
                                  onChange={handleInputChange}
                                >
                                  {/* If no roles are fetched yet, show default option */}
                                  {availableRoles.length === 0 && (
                                    <option value="employee">Employee</option>
                                  )}
                                  
                                  {/* Show all available roles from API */}
                                  {availableRoles.map((role, index) => (
                                    <option key={index} value={role.toLowerCase()}>
                                      {role.charAt(0).toUpperCase() + role.slice(1).toLowerCase().replace(/_/g, ' ')}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                                  Username
                                </label>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                                    {selectedEmployee ? 'Current' : 'Auto-generated'}
                                  </span>
                                  <input
                                    type="text"
                                    name="username"
                                    id="username"
                                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 bg-gray-100"
                                    value={selectedEmployee 
                                      ? newEmployeeData.username
                                      : (newEmployeeData.full_name ? newEmployeeData.full_name.toLowerCase().replace(/\s+/g, '.') : '')}
                                    readOnly
                                  />
                                </div>
                              </div>
                              <div className="col-span-2">
                                <div className="flex items-center">
                                  <input
                                    id="custom_password"
                                    name="custom_password"
                                    type="checkbox"
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                    checked={newEmployeeData.custom_password}
                                    onChange={(e) => setNewEmployeeData({
                                      ...newEmployeeData,
                                      custom_password: e.target.checked
                                    })}
                                  />
                                  <label htmlFor="custom_password" className="ml-2 block text-sm text-gray-700">
                                    Set custom password (otherwise auto-generated)
                                  </label>
                                </div>
                              </div>
                              {newEmployeeData.custom_password && (
                                <div className="col-span-2">
                                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                    Password
                                  </label>
                                  <input
                                    type="password"
                                    name="password"
                                    id="password"
                                    className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                    placeholder="Enter password"
                                    value={newEmployeeData.password}
                                    onChange={handleInputChange}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Emergency Contact Section */}
                          <div>
                            <h4 className="text-md font-medium text-gray-800 border-b pb-2 mb-4">Emergency Contact</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label htmlFor="emergency_contact_name" className="block text-sm font-medium text-gray-700">
                                  Emergency Contact Name
                                </label>
                                <input
                                  type="text"
                                  name="emergency_contact_name"
                                  id="emergency_contact_name"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  placeholder="Enter emergency contact name"
                                  value={newEmployeeData.emergency_contact_name || ''}
                                  onChange={handleInputChange}
                                />
                              </div>
                              <div>
                                <label htmlFor="emergency_contact_phone" className="block text-sm font-medium text-gray-700">
                                  Emergency Contact Phone
                                </label>
                                <input
                                  type="text"
                                  name="emergency_contact_phone"
                                  id="emergency_contact_phone"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  placeholder="Enter emergency contact phone"
                                  value={newEmployeeData.emergency_contact_phone || ''}
                                  onChange={handleInputChange}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Banking Details Section */}
                          <div>
                            <h4 className="text-md font-medium text-gray-800 border-b pb-2 mb-4">Banking Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700">
                                  Bank Name
                                </label>
                                <input
                                  type="text"
                                  name="bank_name"
                                  id="bank_name"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  placeholder="Enter bank name"
                                  value={newEmployeeData.bank_name || ''}
                                  onChange={handleInputChange}
                                />
                              </div>
                              <div>
                                <label htmlFor="bank_account_number" className="block text-sm font-medium text-gray-700">
                                  Account Number
                                </label>
                                <input
                                  type="text"
                                  name="bank_account_number"
                                  id="bank_account_number"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  placeholder="Enter account number"
                                  value={newEmployeeData.bank_account_number || ''}
                                  onChange={handleInputChange}
                                />
                              </div>
                              <div>
                                <label htmlFor="bank_ifsc" className="block text-sm font-medium text-gray-700">
                                  IFSC Code
                                </label>
                                <input
                                  type="text"
                                  name="bank_ifsc"
                                  id="bank_ifsc"
                                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                  placeholder="Enter IFSC code"
                                  value={newEmployeeData.bank_ifsc || ''}
                                  onChange={handleInputChange}
                                />
                              </div>
                            </div>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button 
                    type="button" 
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={handleSaveEmployee}
                    disabled={saveLoading}
                  >
                    {saveLoading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </span>
                    ) : "Save"}
                  </button>
                  <button 
                    type="button" 
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setShowAddEmployeeModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Upload Modal */}
        {showDocumentUploadModal && selectedEmployee && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">
                        Upload Document for {selectedEmployee.name || selectedEmployee.full_name}
                      </h3>
                      <div className="mt-4">
                        <DocumentUploader 
                          employeeId={selectedEmployee.user_id || selectedEmployee.employee_id || selectedEmployee._id || selectedEmployee.id}
                          currentUser={currentUser}
                          onUploadComplete={handleDocumentUploadComplete}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button 
                    type="button" 
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                    onClick={() => setShowDocumentUploadModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HRStaffModuleNew;
