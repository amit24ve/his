import React, { useState, useEffect } from 'react';
import {
  Users, Clock, Calendar, UserPlus, CheckCircle, XCircle,
  TrendingUp, FileText, Filter, Search, Download, Edit3,
  ChevronLeft, ChevronRight, Eye, UserCheck, UserX,
  BarChart3, PieChart, Activity, Target, MapPin
} from 'lucide-react';

const HRStaffModule = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [employees, setEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    department: '',
    status: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [stats, setStats] = useState({});
  const [showCreateEmployeeModal, setShowCreateEmployeeModal] = useState(false);
  const [currentUserRoles, setCurrentUserRoles] = useState(['hr', 'admin']);

  // Mock current user - replace with actual user context
  const currentUser = {
    id: 'admin_001',
    roles: ['hr', 'admin']
  };

  useEffect(() => {
    fetchOverviewStats();
    if (activeTab === 'employees') fetchEmployees();
    if (activeTab === 'attendance') fetchAttendanceRecords();
    if (activeTab === 'leaves') fetchLeaveRequests();
  }, [activeTab, filters]);

  import React, { useState, useEffect } from 'react';
  import {
    Users,
    UserPlus,
    Calendar,
    ClipboardList,
    BarChart3,
    Settings,
    Search,
    Filter,
    Download,
    Edit,
    Trash2,
    Eye,
    CheckCircle,
    XCircle,
    Clock,
    MapPin,
    Phone,
    Mail,
    Building
  } from 'lucide-react';

  const HRStaffModule = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [employees, setEmployees] = useState([]);
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showCreateEmployee, setShowCreateEmployee] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [filters, setFilters] = useState({
      search: '',
      department: '',
      status: '',
      date: ''
    });

    // Mock current user - replace with actual user context
    const currentUser = {
      id: 'hr_001',
      roles: ['hr', 'admin'],
      name: 'HR Manager'
    };

    const API_BASE = 'https://cubehis.avopay.pro:5000/api/employees';

    const fetchOverviewStats = async () => {
      try {
        const response = await fetch(`${API_BASE}/stats/overview?current_user_roles=${currentUser.roles.join('&current_user_roles=')}`);
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: 1,
          limit: 50,
          current_user_id: currentUser.id,
          ...(filters.department && { department: filters.department }),
          ...(filters.status && { active_only: filters.status === 'active' })
        });

        const response = await fetch(`${API_BASE}/?${params}`);
        const data = await response.json();
        if (data.success) {
          setEmployees(data.data);
        }
      } catch (error) {
        console.error('Error fetching employees:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchAttendanceRecords = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          current_user_roles: currentUser.roles.join(','),
          date: filters.date,
          page: 1,
          limit: 100
        });

        const response = await fetch(`${API_BASE}/attendance/all-records?${params}`);
        const data = await response.json();
        if (data.success) {
          setAttendanceRecords(data.data);
        }
      } catch (error) {
        console.error('Error fetching attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchLeaveRequests = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          current_user_id: currentUser.id,
          current_user_roles: currentUser.roles.join(','),
          page: 1,
          limit: 100,
          ...(filters.status && { status: filters.status })
        });

        const response = await fetch(`${API_BASE}/leave-requests?${params}`);
        const data = await response.json();
        if (data.success) {
          setLeaveRequests(data.data);
        }
      } catch (error) {
        console.error('Error fetching leave requests:', error);
      } finally {
        setLoading(false);
      }
    };

    const handleLeaveAction = async (requestId, action, reason = '') => {
      try {
        const endpoint = action === 'approve' ? 'approve' : 'reject';
        const payload = action === 'reject' ? { reason } : { notes: 'Approved by HR' };

        const response = await fetch(
          `${API_BASE}/leave-requests/${requestId}/${endpoint}?current_user_roles=${currentUser.roles.join('&current_user_roles=')}&current_user_id=${currentUser.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );

        const data = await response.json();
        if (data.success) {
          fetchLeaveRequests();
          alert(`Leave request ${action}d successfully`);
        }
      } catch (error) {
        console.error(`Error ${action}ing leave:`, error);
      }
    };

    const deactivateEmployee = async (employeeId) => {
      if (!confirm('Are you sure you want to deactivate this employee?')) return;

      try {
        const response = await fetch(`${API_BASE}/${employeeId}/deactivate`, {
          method: 'PUT'
        });
        const data = await response.json();
        if (data.success) {
          fetchEmployees();
          alert('Employee deactivated successfully');
        }
      } catch (error) {
        console.error('Error deactivating employee:', error);
      }
    };

    const StatCard = ({ icon: Icon, title, value, change, color = 'blue' }) => (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {change && (
              <p className={`text-sm mt-1 ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {change > 0 ? '+' : ''}{change}% from last month
              </p>
            )}
          </div>
          <div className={`p-3 rounded-lg bg-${color}-100`}>
            <Icon className={`w-6 h-6 text-${color}-600`} />
          </div>
        </div>
      </div>
    );

    const TabButton = ({ id, label, icon: Icon, isActive, onClick }) => (
      <button
        onClick={() => onClick(id)}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${isActive
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
      >
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </button>
    );

    const AttendanceStatusBadge = ({ status }) => {
      const colors = {
        present: 'bg-green-100 text-green-800',
        absent: 'bg-red-100 text-red-800',
        late: 'bg-yellow-100 text-yellow-800',
        weekend: 'bg-gray-100 text-gray-600'
      };

      return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.absent}`}>
          {status || 'Absent'}
        </span>
      );
    };

    const LeaveStatusBadge = ({ status }) => {
      const colors = {
        pending: 'bg-yellow-100 text-yellow-800',
        approved: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800'
      };

      return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
          {status}
        </span>
      );
    };

    const CreateEmployeeModal = () => {
      const [formData, setFormData] = useState({
        user_id: '',
        full_name: '',
        email: '',
        phone: '',
        department: '',
        position: '',
        role_ids: [],
        salary: '',
        hire_date: new Date().toISOString().split('T')[0]
      });

      const handleSubmit = async (e) => {
        e.preventDefault();
        try {
          const response = await fetch(`${API_BASE}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });

          const data = await response.json();
          if (data.success) {
            setShowCreateEmployeeModal(false);
            fetchEmployees();
            alert('Employee created successfully');
            setFormData({
              user_id: '', full_name: '', email: '', phone: '',
              department: '', position: '', role_ids: [], salary: '',
              hire_date: new Date().toISOString().split('T')[0]
            });
          }
        } catch (error) {
          console.error('Error creating employee:', error);
        }
      };

      if (!showCreateEmployeeModal) return null;

      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Create New Employee</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input
                  type="text"
                  required
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateEmployeeModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    };

    const renderDashboard = () => (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={Users}
            title="Total Employees"
            value={stats.total_employees || 0}
            color="blue"
          />
          <StatCard
            icon={UserCheck}
            title="Present Today"
            value={stats.present_today || 0}
            change={stats.attendance_rate}
            color="green"
          />
          <StatCard
            icon={FileText}
            title="Pending Leaves"
            value={stats.pending_leave_requests || 0}
            color="yellow"
          />
          <StatCard
            icon={Target}
            title="Leads This Month"
            value={stats.leads_this_month || 0}
            color="purple"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Attendance Rate</span>
                <span className="font-semibold">{stats.attendance_rate?.toFixed(1) || 0}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Activities Today</span>
                <span className="font-semibold">{stats.activities_this_month || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${stats.attendance_rate || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => setShowCreateEmployeeModal(true)}
                className="w-full flex items-center space-x-2 p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add New Employee</span>
              </button>
              <button
                onClick={() => setActiveTab('attendance')}
                className="w-full flex items-center space-x-2 p-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
              >
                <Clock className="w-4 h-4" />
                <span>View Today's Attendance</span>
              </button>
              <button
                onClick={() => setActiveTab('leaves')}
                className="w-full flex items-center space-x-2 p-3 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>Review Leave Requests</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );

    const renderEmployees = () => (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
          <button
            onClick={() => setShowCreateEmployeeModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex space-x-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search employees..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              </div>
              <select
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Departments</option>
                <option value="Sales">Sales</option>
                <option value="Marketing">Marketing</option>
                <option value="IT">IT</option>
                <option value="HR">HR</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Today's Attendance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.map((employee) => (
                  <tr key={employee.employee_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{employee.full_name}</div>
                        <div className="text-sm text-gray-500">{employee.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employee.department || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employee.position || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                        {employee.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <AttendanceStatusBadge status={employee.attendance_status?.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => setSelectedEmployee(employee)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {employee.is_active && (
                        <button
                          onClick={() => deactivateEmployee(employee.employee_id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );

    const renderAttendance = () => (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Attendance Management</h2>
          <div className="flex space-x-3">
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceRecords.map((record) => (
                  <tr key={record._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{record.employee_name}</div>
                        <div className="text-sm text-gray-500">{record.user_id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.employee_details?.department || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.checkin_time ? new Date(record.checkin_time).toLocaleTimeString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.checkout_time ? new Date(record.checkout_time).toLocaleTimeString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.working_hours?.toFixed(2) || '0.00'}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <AttendanceStatusBadge status={record.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );

    const renderLeaves = () => (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Leave Management</h2>
          <div className="flex space-x-3">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaveRequests.map((request) => (
                  <tr key={request._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{request.employee_name}</div>
                        <div className="text-sm text-gray-500">{request.user_id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.leave_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.days_requested} {request.is_half_day ? '(Half Day)' : 'day(s)'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.start_date} to {request.end_date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <LeaveStatusBadge status={request.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleLeaveAction(request._id, 'approve')}
                            className="text-green-600 hover:text-green-900"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Enter rejection reason:');
                              if (reason) handleLeaveAction(request._id, 'reject', reason);
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">HR Management System</h1>
                <p className="text-gray-600 mt-1">Manage employees, attendance, and leave requests</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex space-x-1 pb-4">
              <TabButton
                id="dashboard"
                label="Dashboard"
                icon={BarChart3}
                isActive={activeTab === 'dashboard'}
                onClick={setActiveTab}
              />
              <TabButton
                id="employees"
                label="Employees"
                icon={Users}
                isActive={activeTab === 'employees'}
                onClick={setActiveTab}
              />
              <TabButton
                id="attendance"
                label="Attendance"
                icon={Clock}
                isActive={activeTab === 'attendance'}
                onClick={setActiveTab}
              />
              <TabButton
                id="leaves"
                label="Leave Requests"
                icon={FileText}
                isActive={activeTab === 'leaves'}
                onClick={setActiveTab}
              />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading && (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {!loading && (
            <>
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'employees' && renderEmployees()}
              {activeTab === 'attendance' && renderAttendance()}
              {activeTab === 'leaves' && renderLeaves()}
            </>
          )}
        </div>

        <CreateEmployeeModal />
      </div>
    );
  };

  export default HRStaffModule;
