import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, CheckCircle, XCircle, Search, Filter, Plus,
  Download, Eye, Edit, Trash2, AlertCircle, User, Users, X
} from 'lucide-react';

// Import API utilities
import { 
  fetchAttendance, 
  fetchEmployees, 
  markAttendance as apiMarkAttendance,
  editAttendanceRecord as apiEditAttendanceRecord,
  createManualAttendance as apiCreateManualAttendance
} from '../../utils/hrAPI';

// Import constants
import hrConstants from '../../utils/hrConstants';

// Attendance Management Component
const AttendanceManagement = () => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    department: '',
    employee: '',
    status: 'all'
  });
  const [stats, setStats] = useState({
    totalPresent: 0,
    totalAbsent: 0,
    totalLate: 0,
    attendanceRate: 0
  });
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create'); // 'create' or 'edit'
  const [employees, setEmployees] = useState([]);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [formData, setFormData] = useState({
    user_id: '',
    employee_name: '',
    date: new Date().toISOString().split('T')[0],
    status: 'present',
    checkin_time: '09:00',
    checkout_time: '17:00',
    notes: ''
  });
  const [authError, setAuthError] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [location, setLocation] = useState({ latitude: null, longitude: null, address: '' });
  const [locationLoading, setLocationLoading] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState(null);

  // Get current location
  const getCurrentLocation = () => {
    setLocationLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setLocation(prev => ({ ...prev, latitude, longitude }));
          
          // Get address from coordinates (optional)
          try {
            const response = await fetch(
              `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=5aaae798298c48148346d2de4abcde8f`
            );
            if (response.ok) {
              const data = await response.json();
              if (data.results && data.results[0]) {
                setLocation(prev => ({ ...prev, address: data.results[0].formatted }));
              }
            }
          } catch (error) {
            console.log('Address lookup failed, using coordinates only');
            setLocation(prev => ({ ...prev, address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` }));
          }
          setLocationLoading(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationLoading(false);
          alert('Unable to get your location. Please enable location services.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setLocationLoading(false);
      alert('Geolocation is not supported by this browser.');
    }
  };

  // Check user role and get current user info
  const checkUserRole = () => {
    try {
      const userData = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentUser(user);
        
        // Check if user is admin (adjust this logic based on your user structure)
        const roles = user.roles || user.role || [];
        const isAdmin = Array.isArray(roles) 
          ? roles.some(role => role.toLowerCase().includes('admin') || role.toLowerCase().includes('hr'))
          : (typeof roles === 'string' && (roles.toLowerCase().includes('admin') || roles.toLowerCase().includes('hr')));
        
        setUserRole(isAdmin ? 'admin' : 'user');
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
      setUserRole('user'); // Default to user role
    }
  };

    // Initialize - check for authentication and integrate with parent component
  useEffect(() => {
    const initComponent = () => {
      // Check authentication
      const token = localStorage.getItem('access_token') || 
                   localStorage.getItem('token') || 
                   sessionStorage.getItem('token');
      
      if (!token) {
        setAuthError(true);
        return;
      }
      
      setAuthError(false);
      
      // Check user role
      checkUserRole();
      
      // Get current location for non-admin users
      getCurrentLocation();
    };
    
    initComponent();
  }, []);

  useEffect(() => {
    console.log("AttendanceManagement component mounted or filters changed", filters);
    
    // Simple function to get token using consistent approach
    const getAuthToken = () => {
      const token = localStorage.getItem('access_token') || 
                   localStorage.getItem('token') ||
                   window.sessionStorage.getItem('token');
      
      if (token) {
        console.log("Found authentication token");
        return token;
      }
      
      console.warn("No authentication token found in any location");
      return null;
    };
    
    const token = getAuthToken();
    
    if (token) {
      // Store in both locations for maximum compatibility
      localStorage.setItem('token', token);
      localStorage.setItem('access_token', token);
      console.log("Token stored in localStorage. Fetching attendance data...");
      
      if (userRole === 'admin') {
        fetchAttendanceData();
      } else if (userRole === 'user') {
        fetchUserAttendance();
      }
    } else {
      console.error("No authentication token found. Cannot fetch attendance data.");
    }
  }, [filters, userRole]);

  // Fetch today's attendance for current user
  const fetchUserAttendance = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const userAttendance = await fetchAttendance({
        date: today,
        employee: currentUser.user_id || currentUser.username || currentUser.id,
        page: 1,
        limit: 1
      });
      
      if (userAttendance && userAttendance.length > 0) {
        setTodayAttendance(userAttendance[0]);
      } else {
        setTodayAttendance(null);
      }
    } catch (error) {
      console.error('Error fetching user attendance:', error);
      setTodayAttendance(null);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch employees list for the dropdown
  useEffect(() => {
    const getEmployees = async () => {
      try {
        console.log("Fetching employees...");
        
        // Use the utility function to fetch employees
        const employeeData = await fetchEmployees();
        
        // Ensure employees is always an array, even if the API returns something else
        if (Array.isArray(employeeData)) {
          setEmployees(employeeData);
        } else if (employeeData && typeof employeeData === 'object') {
          // If it's an object with data property that's an array
          if (Array.isArray(employeeData.data)) {
            setEmployees(employeeData.data);
          } else {
            // Convert object to array if needed
            const employeeArray = Object.values(employeeData);
            setEmployees(Array.isArray(employeeArray) ? employeeArray : []);
          }
        } else {
          // Fallback to empty array
          setEmployees([]);
          console.error("Employees data is not in expected format:", employeeData);
        }
        
        console.log("Fetched employees:", employees.length);
      } catch (error) {
        console.error('Error fetching employees:', error);
        setEmployees([]); // Set to empty array on error
      }
    };
    
    getEmployees();
  }, []);

  const fetchAttendanceData = async () => {
    setLoading(true);
    console.log("Fetching attendance data with filters:", filters);
    try {
      // Use the utility function to fetch attendance data with filters
      const attendanceData = await fetchAttendance({
        date: filters.date,
        department: filters.department !== 'all' ? filters.department : '',
        employee: filters.employee !== 'all' ? filters.employee : '',
        status: filters.status !== 'all' ? filters.status : undefined,
        page: 1,
        limit: 100
      });
      
      console.log("Attendance data array:", attendanceData);
      console.log("Number of records:", attendanceData.length);
      
      if (attendanceData.length === 0) {
        console.warn("No attendance records found in response");
      }
      
      // Process the data to match our component's expected format
      const processedData = attendanceData.map(record => {
        console.log("Processing record:", record);
        return {
          id: record._id,
          user_id: record.user_id || record.employee_id,
          employee_id: record.user_id || record.employee_id,
          employee_name: record.employee_name,
          full_name: record.user_name || record.full_name || record.employee_name,
          department: record.department || 'Not Specified',
          date: record.date,
          // Format check-in time for display (extract only the time portion)
          checkin_time: record.checkin_time ? new Date(record.checkin_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : null,
          // Format check-out time for display (extract only the time portion)
          checkout_time: record.checkout_time ? new Date(record.checkout_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : null,
          working_hours: record.working_hours || 0,
          status: record.status,
          location: record.location || record.location_name || 'Office',
          notes: record.notes || '',
          geo_lat: record.geo_lat,
          geo_long: record.geo_long
        };
      });
      
      setAttendanceRecords(processedData);
      
      // Calculate statistics
      setStats({
        totalPresent: processedData.filter(r => r.status === 'present').length,
        totalAbsent: processedData.filter(r => r.status === 'absent').length,
        totalLate: processedData.filter(r => 
          r.status === 'present' && 
          r.checkin_time && 
          r.checkin_time > '09:00:00'
        ).length,
        attendanceRate: processedData.length > 0 
          ? Math.round((processedData.filter(r => r.status === 'present').length / processedData.length) * 100) 
          : 0
      });
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      // Show empty data on error
      setAttendanceRecords([]);
      setStats({
        totalPresent: 0,
        totalAbsent: 0,
        totalLate: 0,
        attendanceRate: 0
      });
      
      // Display a user-friendly error message 
      const errorMessage = error.message === 'Authentication token not found. Please log in again.' ?
        'Authentication token not found. Please log in again.' :
        'Failed to load attendance data. Please check your connection and try again.';
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (employeeId, status) => {
    try {
      // Use the utility function to mark attendance
      await apiMarkAttendance({
        user_id: employeeId,
        status: status,
        notes: `Manually marked as ${status} by admin/HR`
      });
      
      // Success message
      alert('Attendance marked successfully');
      fetchAttendanceData(); // Refresh data
    } catch (error) {
      console.error('Error marking attendance:', error);
      alert(`Error: ${error.message}`);
    }
  };
  
  const editAttendanceRecord = async (recordId, updatedData) => {
    try {
      console.log('Updating attendance record:', recordId, updatedData); // Debugging
      
      // Add user context to the update data
      const updateDataWithContext = {
        ...updatedData,
        updated_by: currentUser?.user_id || currentUser?.username || 'admin',
        updated_by_name: currentUser?.full_name || currentUser?.name || 'Administrator',
        current_user_roles: ['admin', 'hr'] // Required by some endpoints
      };
      
      // Use the utility function to edit attendance record
      await apiEditAttendanceRecord(recordId, updateDataWithContext);
      
      // Success message
      alert('Attendance record updated successfully');
      fetchAttendanceData(); // Refresh data
    } catch (error) {
      console.error('Error updating attendance:', error);
      alert(`Error: ${error.message}`);
    }
  };
  
  const createManualAttendance = async (data) => {
    try {
      console.log('Creating attendance record:', data); // Debugging
      
      // Use the utility function to create manual attendance
      await apiCreateManualAttendance(data);
      
      // Success message
      alert('Attendance record created successfully');
      fetchAttendanceData(); // Refresh data
    } catch (error) {
      console.error('Error creating attendance record:', error);
      alert(`Error: ${error.message}`);
    }
  };

  // Check-in function for regular users
  const handleCheckIn = async () => {
    if (!currentUser || !location.latitude) {
      alert('Location is required for check-in. Please enable location services.');
      return;
    }

    try {
      const now = new Date();
      const checkInData = {
        user_id: currentUser.user_id || currentUser.username || currentUser.id,
        status: 'present',
        checkin_time: now.toISOString(),
        geo_lat: location.latitude,
        geo_long: location.longitude,
        location: location.address || `${location.latitude}, ${location.longitude}`,
        notes: 'Self check-in'
      };

      await apiMarkAttendance(checkInData);
      alert('Checked in successfully!');
      fetchUserAttendance(); // Refresh user's attendance
    } catch (error) {
      console.error('Error checking in:', error);
      alert(`Check-in failed: ${error.message}`);
    }
  };

  // Check-out function for regular users
  const handleCheckOut = async () => {
    if (!currentUser || !todayAttendance) {
      alert('No check-in record found for today.');
      return;
    }

    if (!location.latitude) {
      alert('Location is required for check-out. Please enable location services.');
      return;
    }

    try {
      const now = new Date();
      const checkOutData = {
        checkout_time: now.toISOString(),
        checkout_geo_lat: location.latitude,
        checkout_geo_long: location.longitude,
        checkout_location: location.address || `${location.latitude}, ${location.longitude}`,
        notes: todayAttendance.notes ? `${todayAttendance.notes} | Self check-out` : 'Self check-out'
      };

      await apiEditAttendanceRecord(todayAttendance.id, checkOutData);
      alert('Checked out successfully!');
      fetchUserAttendance(); // Refresh user's attendance
    } catch (error) {
      console.error('Error checking out:', error);
      alert(`Check-out failed: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Show loading while determining user role */}
      {!userRole && (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      )}

      {/* Admin View - Full Attendance Management */}
      {userRole === 'admin' && (
        <>
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Attendance Management</h2>
              <p className="text-gray-600">Track and manage employee attendance</p>
            </div>
            <div className="flex space-x-3">
              <button 
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
                onClick={() => {
                  setModalType('create');
                  setFormData({
                    user_id: '',
                    employee_name: '',
                    date: new Date().toISOString().split('T')[0],
                    status: 'present',
                    checkin_time: '09:00',
                    checkout_time: '17:00',
                    notes: ''
                  });
                  setShowModal(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Manual Entry
              </button>
          <button 
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
            onClick={() => {
              // Create CSV content with updated headers
              const headers = 'User ID,Employee Name,Role,Department,Date,Check In,Check Out,Working Hours,Status,Location,Notes\n';
              const csvContent = attendanceRecords.map(record => 
                `"${record.user_id || record.employee_id || ''}","${record.full_name || record.employee_name || record.name || ''}","${record.role || record.position || record.roles?.[0] || 'Employee'}","${record.department || 'Not Specified'}","${record.date}","${record.checkin_time || ''}","${record.checkout_time || ''}",${record.working_hours || '0'},"${record.status}","${record.location || ''}","${record.notes || ''}"`
              ).join('\n');
              
              // Create blob and download link
              const blob = new Blob([headers + csvContent], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.setAttribute('hidden', '');
              a.setAttribute('href', url);
              a.setAttribute('download', `attendance-report-${new Date().toISOString().slice(0,10)}.csv`);
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Present Today</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalPresent}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Absent Today</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalAbsent}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Late Arrivals</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalLate}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.attendanceRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              value={filters.department}
              onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {hrConstants.DEPARTMENTS.map(dept => (
                <option key={dept.value} value={dept.value}>{dept.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            <input
              type="text"
              placeholder="Search employee..."
              value={filters.employee}
              onChange={(e) => setFilters(prev => ({ ...prev, employee: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              {hrConstants.ATTENDANCE_STATUS.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button 
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              onClick={() => fetchAttendanceData()}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Attendance Records</h3>
        </div>
        
        <div className="overflow-x-auto">
          {!localStorage.getItem('token') && !window.sessionStorage.getItem('token') ? (
            <div className="p-10 text-center">
              <p className="text-red-600 font-semibold mb-2">Authentication Required</p>
              <p className="text-gray-600">Please log in to view attendance records.</p>
            </div>
          ) : loading ? (
            <div className="p-10 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Loading attendance records...</p>
            </div>
          ) : attendanceRecords.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-gray-600">No attendance records found for the selected filters.</p>
            </div>
          ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th> */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check In
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check Out
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Working Hours
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendanceRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center border-2 border-blue-200 mr-2">
                        <span className="text-xs font-semibold text-blue-700">
                          {(record.user_id || record.employee_id || '??').slice(0, 1)}
                        </span>
                      </div>
                      <span className="font-medium text-blue-600">
                        {record.user_id || record.employee_id || '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {record.full_name || record.employee_name || record.name || 'Unknown Employee'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {record.role || record.position || record.roles?.[0] || 'Employee'}
                    </span>
                  </td>
                  {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.department || 'Not Specified'}
                  </td> */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.checkin_time || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.checkout_time || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.working_hours ? `${record.working_hours}h` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      record.status === 'present' 
                        ? 'bg-green-100 text-green-800'
                        : record.status === 'absent'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button 
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => alert(`Details for ${record.employee_name}: ${record.notes || 'No additional notes'}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        className="text-green-600 hover:text-green-800"
                        onClick={() => {
                          setCurrentRecord(record);
                          setModalType('edit');
                          
                          // For edit mode, we need to convert times back to HH:MM format for the time inputs
                          const checkinParts = record.checkin_time ? record.checkin_time.split(':') : ['09', '00'];
                          const checkoutParts = record.checkout_time ? record.checkout_time.split(':') : ['17', '00'];
                          const checkinTime = `${checkinParts[0].padStart(2, '0')}:${checkinParts[1].padStart(2, '0')}`;
                          const checkoutTime = `${checkoutParts[0].padStart(2, '0')}:${checkoutParts[1].padStart(2, '0')}`;
                          
                          setFormData({
                            user_id: record.user_id,
                            employee_name: record.full_name || record.employee_name,
                            date: record.date,
                            status: record.status,
                            checkin_time: checkinTime,
                            checkout_time: checkoutTime,
                            notes: record.notes || ''
                          });
                          setShowModal(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>
      </>
      )}

      {/* User View - Personal Check-in/Check-out */}
      {userRole === 'user' && (
        <>
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">My Attendance</h2>
            <p className="text-gray-600">Check in and check out for today</p>
            {currentUser && (
              <p className="text-lg font-medium text-blue-600 mt-2">
                Welcome, {currentUser.full_name || currentUser.name || currentUser.username}!
              </p>
            )}
          </div>

          {/* Location Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`p-3 rounded-full ${location.latitude ? 'bg-green-100' : 'bg-yellow-100'}`}>
                  <Clock className={`w-6 h-6 ${location.latitude ? 'text-green-600' : 'text-yellow-600'}`} />
                </div>
                <div className="ml-4">
                  <p className="text-lg font-semibold text-gray-900">
                    {location.latitude ? 'Location Detected' : 'Location Required'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {locationLoading ? 'Getting your location...' : 
                     location.address || (location.latitude ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : 'Please enable location services')}
                  </p>
                </div>
              </div>
              <button
                onClick={getCurrentLocation}
                disabled={locationLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {locationLoading ? 'Getting Location...' : 'Refresh Location'}
              </button>
            </div>
          </div>

          {/* Today's Attendance Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Today's Status</h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Loading your attendance...</p>
              </div>
            ) : todayAttendance ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-600">Status</p>
                  <p className="text-lg font-bold text-green-800 capitalize">{todayAttendance.status}</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-blue-600">Check In</p>
                  <p className="text-lg font-bold text-blue-800">
                    {todayAttendance.checkin_time ? new Date(todayAttendance.checkin_time).toLocaleTimeString() : '-'}
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <Clock className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-purple-600">Check Out</p>
                  <p className="text-lg font-bold text-purple-800">
                    {todayAttendance.checkout_time ? new Date(todayAttendance.checkout_time).toLocaleTimeString() : 'Not yet'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No attendance record for today</p>
              </div>
            )}
          </div>

          {/* Check-in/Check-out Buttons */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={handleCheckIn}
                disabled={!location.latitude || (todayAttendance && todayAttendance.checkin_time)}
                className={`w-full py-4 px-6 rounded-lg font-semibold text-lg flex items-center justify-center ${
                  !location.latitude || (todayAttendance && todayAttendance.checkin_time)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                <CheckCircle className="w-6 h-6 mr-2" />
                {todayAttendance && todayAttendance.checkin_time ? 'Already Checked In' : 'Check In'}
              </button>
              
              <button
                onClick={handleCheckOut}
                disabled={!location.latitude || !todayAttendance || !todayAttendance.checkin_time || todayAttendance.checkout_time}
                className={`w-full py-4 px-6 rounded-lg font-semibold text-lg flex items-center justify-center ${
                  !location.latitude || !todayAttendance || !todayAttendance.checkin_time || todayAttendance.checkout_time
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                <XCircle className="w-6 h-6 mr-2" />
                {!todayAttendance || !todayAttendance.checkin_time 
                  ? 'Check In First' 
                  : todayAttendance.checkout_time 
                    ? 'Already Checked Out' 
                    : 'Check Out'}
              </button>
            </div>
            
            {(!location.latitude) && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                  <p className="text-sm text-yellow-800">
                    Location access is required for attendance. Please click "Refresh Location" and allow location access.
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Modal for Creating/Editing Attendance - Admin Only */}
      {showModal && userRole === 'admin' && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {modalType === 'create' ? 'Manual Attendance Entry' : 'Edit Attendance Record'}
              </h3>
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowModal(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Employee Selection */}
              {modalType === 'create' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
                  <select
                    value={formData.user_id}
                    onChange={(e) => {
                      const selectedEmployee = employees.find(emp => 
                        (emp.user_id && emp.user_id === e.target.value) || 
                        (emp.username && emp.username === e.target.value) ||
                        (emp.id && emp.id === e.target.value)
                      );
                      setFormData({
                        ...formData,
                        user_id: e.target.value,
                        employee_name: selectedEmployee ? (selectedEmployee.name || selectedEmployee.full_name) : ''
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select an employee</option>
                    {Array.isArray(employees) ? employees.map(emp => (
                      <option key={emp._id || emp.user_id || emp.id || Math.random()} value={emp.user_id || emp.username || emp.id}>
                        {emp.name || emp.full_name || emp.username || emp.email || "Employee"} ({emp.user_id || emp.username || emp.id})
                      </option>
                    )) : <option value="">No employees found</option>}
                  </select>
                </div>
              )}
              
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {hrConstants.ATTENDANCE_STATUS.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
              
              {/* Check In Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check In Time</label>
                <input
                  type="time"
                  value={formData.checkin_time}
                  onChange={(e) => setFormData({...formData, checkin_time: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={formData.status === 'absent' || formData.status === 'leave'}
                />
              </div>
              
              {/* Check Out Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check Out Time</label>
                <input
                  type="time"
                  value={formData.checkout_time}
                  onChange={(e) => setFormData({...formData, checkout_time: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={formData.status === 'absent' || formData.status === 'leave'}
                />
              </div>
              
              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Add any relevant notes here..."
                ></textarea>
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  onClick={async () => {
                    try {
                      // Format data for API
                      const submitData = {
                        user_id: formData.user_id,
                        employee_name: formData.employee_name,
                        date: formData.date,
                        status: formData.status,
                        notes: formData.notes,
                        location: "Office Location (Manager Action)",
                        location_name: "Office Location (Manager Action)",
                        geo_lat: 28.628747,
                        geo_long: 77.381403
                      };

                      // Add time fields if status is present
                      if (formData.status === 'present') {
                        // Convert times to ISO format
                        const dateObj = new Date(formData.date);
                        const checkInDateStr = `${formData.date}T${formData.checkin_time}:00`;
                        const checkOutDateStr = formData.checkout_time ? `${formData.date}T${formData.checkout_time}:00` : null;
                        
                        submitData.checkin_time = checkInDateStr;
                        submitData.checkout_time = checkOutDateStr;
                        
                        // Calculate working hours if checkout time is provided
                        if (checkOutDateStr) {
                          const checkInTime = new Date(checkInDateStr).getTime();
                          const checkOutTime = new Date(checkOutDateStr).getTime();
                          const diffHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
                          submitData.working_hours = Math.round(diffHours * 100) / 100;
                        } else {
                          submitData.working_hours = 0;
                        }
                        
                        // Add checkout location if checkout time exists
                        if (checkOutDateStr) {
                          submitData.checkout_geo_lat = 28.628747;
                          submitData.checkout_geo_long = 77.381403;
                          submitData.checkout_location = "Office Location (Manager Action)";
                        }
                      }

                      if (modalType === 'create') {
                        await createManualAttendance(submitData);
                      } else {
                        await editAttendanceRecord(currentRecord.id, submitData);
                      }
                      
                      setShowModal(false);
                      fetchAttendanceData(); // Refresh data after update
                    } catch (error) {
                      console.error('Error saving attendance:', error);
                      alert(`Error: ${error.message}`);
                    }
                  }}
                >
                  {modalType === 'create' ? 'Create' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManagement;
