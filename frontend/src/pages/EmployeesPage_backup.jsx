import React, { useState, useEffect } from 'react';
import {
  Users, Calendar, Clock, TrendingUp, Building2, UserCheck,
  Search, Filter, Download, Plus, Edit, Trash2, MapPin,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle, XCircle
} from 'lucide-react';

const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({});
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters and pagination
  const [filters, setFilters] = useState({
    department: '',
    role: '',
    activeOnly: true,
    searchTerm: ''
  });
  const [attendanceFilters, setAttendanceFilters] = useState({
    employeeId: '',
    startDate: '',
    endDate: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [attendancePage, setAttendancePage] = useState(1);
  const itemsPerPage = 10;
  
  // UI State
  const [activeTab, setActiveTab] = useState('employees');
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch data functions
  const fetchEmployees = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.department) params.append('department', filters.department);
      if (filters.role) params.append('role', filters.role);
      params.append('active_only', filters.activeOnly);
      
      const response = await fetch(`/api/employees?${params}`);
      if (!response.ok) throw new Error('Failed to fetch employees');
      
      const data = await response.json();
      setEmployees(data);
    } catch (err) {
      setError('Failed to load employees');
      console.error(err);
    }
  };

  const fetchAttendanceRecords = async () => {
    try {
      const params = new URLSearchParams();
      if (attendanceFilters.employeeId) params.append('employee_id', attendanceFilters.employeeId);
      if (attendanceFilters.startDate) params.append('start_date', attendanceFilters.startDate);
      if (attendanceFilters.endDate) params.append('end_date', attendanceFilters.endDate);
      params.append('page', attendancePage);
      params.append('limit', itemsPerPage);
      
      const response = await fetch(`/api/employees/attendance/records?${params}`);
      if (!response.ok) throw new Error('Failed to fetch attendance records');
      
      const data = await response.json();
      setAttendanceRecords(data);
    } catch (err) {
      setError('Failed to load attendance records');
      console.error(err);
    }
  };

  const fetchAttendanceSummary = async () => {
    try {
      const params = new URLSearchParams();
      if (attendanceFilters.employeeId) params.append('employee_id', attendanceFilters.employeeId);
      params.append('month', attendanceFilters.month);
      params.append('year', attendanceFilters.year);
      
      const response = await fetch(`/api/employees/attendance/summary?${params}`);
      if (!response.ok) throw new Error('Failed to fetch attendance summary');
      
      const data = await response.json();
      setAttendanceSummary(data);
    } catch (err) {
      setError('Failed to load attendance summary');
      console.error(err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/employees/departments');
      if (!response.ok) throw new Error('Failed to fetch departments');
      
      const data = await response.json();
      setDepartments(data.departments || []);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/employees/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  // Mark attendance function
  const markAttendance = async (employeeId, status = 'present', notes = '') => {
    try {
      const response = await fetch('/api/employees/attendance/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: employeeId,
          status,
          notes,
          // Add geolocation if available
          latitude: null,
          longitude: null
        }),
      });

      if (!response.ok) throw new Error('Failed to mark attendance');

      const result = await response.json();
      alert(result.message);
      
      // Refresh attendance data
      fetchAttendanceRecords();
      fetchAttendanceSummary();
    } catch (err) {
      alert('Failed to mark attendance: ' + err.message);
    }
  };

  // Filter employees based on search
  const filteredEmployees = employees.filter(emp => {
    const searchTerm = filters.searchTerm.toLowerCase();
    return (
      emp.full_name?.toLowerCase().includes(searchTerm) ||
      emp.email?.toLowerCase().includes(searchTerm) ||
      emp.employee_id?.toLowerCase().includes(searchTerm) ||
      emp.department?.toLowerCase().includes(searchTerm)
    );
  });

  // Paginated employees
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchEmployees(),
        fetchDepartments(),
        fetchStats()
      ]);
      setLoading(false);
    };
    loadData();
  }, [filters]);

  useEffect(() => {
    if (activeTab === 'attendance') {
      fetchAttendanceRecords();
      fetchAttendanceSummary();
    }
  }, [activeTab, attendanceFilters, attendancePage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Employee Management</h1>
          <p className="text-gray-600">Manage employees and track attendance</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Employees</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_employees || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Departments</p>
                <p className="text-2xl font-bold text-gray-900">{stats.departments?.length || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Present Today</p>
                <p className="text-2xl font-bold text-gray-900">{stats.attendance?.today || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-orange-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">This Month</p>
                <p className="text-2xl font-bold text-gray-900">{stats.attendance?.this_month || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('employees')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'employees'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="h-5 w-5 inline mr-2" />
              Employees
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'attendance'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar className="h-5 w-5 inline mr-2" />
              Attendance
            </button>
          </nav>
        </div>

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <div className="bg-white rounded-lg shadow">
            {/* Filters */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search employees..."
                      value={filters.searchTerm}
                      onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    {showFilters ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
                  </button>
                </div>
                
                <button
                  onClick={() => setShowAttendanceModal(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Mark Attendance
                </button>
              </div>
              
              {/* Extended Filters */}
              {showFilters && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <select
                    value={filters.department}
                    onChange={(e) => setFilters({...filters, department: e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Departments</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  
                  <select
                    value={filters.role}
                    onChange={(e) => setFilters({...filters, role: e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Roles</option>
                    {stats.roles?.map(role => (
                      <option key={role.name} value={role.name}>{role.name}</option>
                    ))}
                  </select>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.activeOnly}
                      onChange={(e) => setFilters({...filters, activeOnly: e.target.checked})}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Active only</span>
                  </label>
                </div>
              )}
            </div>

            {/* Employee Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
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
                  {paginatedEmployees.map((employee) => (
                    <tr key={employee.employee_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {employee.full_name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {employee.full_name || employee.username}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {employee.employee_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.department || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.role_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>{employee.email}</div>
                        <div className="text-gray-500">{employee.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          employee.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {employee.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => markAttendance(employee.employee_id)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Mark Attendance"
                        >
                          <UserCheck className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setSelectedEmployee(employee)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="View Details"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * itemsPerPage, filteredEmployees.length)}
                      </span>{' '}
                      of <span className="font-medium">{filteredEmployees.length}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === currentPage
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            {/* Attendance Summary */}
            {attendanceSummary.summary && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Attendance Summary - {attendanceSummary.month}/{attendanceSummary.year}
                  </h3>
                  <div className="flex items-center space-x-4">
                    <select
                      value={attendanceFilters.month}
                      onChange={(e) => setAttendanceFilters({
                        ...attendanceFilters,
                        month: parseInt(e.target.value)
                      })}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(0, i).toLocaleString('default', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                    <select
                      value={attendanceFilters.year}
                      onChange={(e) => setAttendanceFilters({
                        ...attendanceFilters,
                        year: parseInt(e.target.value)
                      })}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() - 2 + i;
                        return (
                          <option key={year} value={year}>{year}</option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {attendanceSummary.summary.map((emp) => (
                    <div key={emp.user_id} className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">{emp.employee_name}</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Present Days:</span>
                          <span className="font-medium">{emp.total_days_present}/{emp.total_working_days}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Attendance:</span>
                          <span className={`font-medium ${
                            emp.attendance_percentage >= 90 ? 'text-green-600' :
                            emp.attendance_percentage >= 75 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {emp.attendance_percentage}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Avg Hours/Day:</span>
                          <span className="font-medium">{emp.average_hours_per_day}h</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Late Arrivals:</span>
                          <span className="font-medium text-orange-600">{emp.late_arrivals}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attendance Records */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                  <h3 className="text-lg font-semibold text-gray-900">Attendance Records</h3>
                  
                  <div className="flex items-center space-x-4">
                    <select
                      value={attendanceFilters.employeeId}
                      onChange={(e) => setAttendanceFilters({
                        ...attendanceFilters,
                        employeeId: e.target.value
                      })}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Employees</option>
                      {employees.map(emp => (
                        <option key={emp.employee_id} value={emp.employee_id}>
                          {emp.full_name || emp.username}
                        </option>
                      ))}
                    </select>
                    
                    <input
                      type="date"
                      value={attendanceFilters.startDate}
                      onChange={(e) => setAttendanceFilters({
                        ...attendanceFilters,
                        startDate: e.target.value
                      })}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Start Date"
                    />
                    
                    <input
                      type="date"
                      value={attendanceFilters.endDate}
                      onChange={(e) => setAttendanceFilters({
                        ...attendanceFilters,
                        endDate: e.target.value
                      })}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="End Date"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Check In
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Check Out
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hours
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendanceRecords.data?.map((record) => (
                      <tr key={record._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {record.employee_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(record.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.checkin_time ? new Date(record.checkin_time).toLocaleTimeString() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.checkout_time ? new Date(record.checkout_time).toLocaleTimeString() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.working_hours ? `${record.working_hours}h` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.status === 'present' ? 'bg-green-100 text-green-800' :
                            record.status === 'absent' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Quick Attendance Modal */}
        {showAttendanceModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Mark Attendance</h3>
              
              <div className="space-y-4">
                <select
                  onChange={(e) => {
                    const emp = employees.find(emp => emp.employee_id === e.target.value);
                    setSelectedEmployee(emp);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.full_name || emp.username}
                    </option>
                  ))}
                </select>
                
                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      if (selectedEmployee) {
                        markAttendance(selectedEmployee.employee_id, 'present');
                        setShowAttendanceModal(false);
                        setSelectedEmployee(null);
                      }
                    }}
                    disabled={!selectedEmployee}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Present
                  </button>
                  <button
                    onClick={() => {
                      if (selectedEmployee) {
                        markAttendance(selectedEmployee.employee_id, 'absent');
                        setShowAttendanceModal(false);
                        setSelectedEmployee(null);
                      }
                    }}
                    disabled={!selectedEmployee}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Absent
                  </button>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAttendanceModal(false);
                    setSelectedEmployee(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeesPage;
