import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Calendar, Clock, TrendingUp, BarChart3,
  User, Mail, Phone, MapPin, Building, Award,
  CheckCircle, XCircle, FileText, Activity,
  ChevronLeft, ChevronRight, Download
} from 'lucide-react';

const EmployeeDetailPage = ({ employeeId, onBack }) => {
  const [employee, setEmployee] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [attendanceCalendar, setAttendanceCalendar] = useState({});
  const [performanceReport, setPerformanceReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Mock current user - replace with actual user context
  const currentUser = {
    id: 'admin_001',
    roles: ['hr', 'admin']
  };

  useEffect(() => {
    fetchEmployeeProfile();
    if (activeTab === 'attendance') fetchAttendanceCalendar();
    if (activeTab === 'performance') fetchPerformanceReport();
  }, [employeeId, activeTab, selectedMonth, selectedYear]);

  const API_BASE = 'https://cubehis.avopay.pro:5000/api/employees';

  const fetchEmployeeProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/${employeeId}/profile?current_user_id=${currentUser.id}`);
      const data = await response.json();
      if (data.success) {
        setEmployee(data.data);
      }
    } catch (error) {
      console.error('Error fetching employee profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceCalendar = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/calendar/attendance/${employeeId}?` +
        `current_user_id=${currentUser.id}&` +
        `current_user_roles=${currentUser.roles.join('&current_user_roles=')}&` +
        `month=${selectedMonth}&year=${selectedYear}`
      );
      const data = await response.json();
      if (data.success) {
        setAttendanceCalendar(data.calendar_data);
      }
    } catch (error) {
      console.error('Error fetching attendance calendar:', error);
    }
  };

  const fetchPerformanceReport = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/reports/employee-performance/${employeeId}?` +
        `current_user_id=${currentUser.id}&` +
        `current_user_roles=${currentUser.roles.join('&current_user_roles=')}`
      );
      const data = await response.json();
      if (data.success) {
        setPerformanceReport(data.data);
      }
    } catch (error) {
      console.error('Error fetching performance report:', error);
    }
  };

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

  const StatCard = ({ icon: Icon, title, value, subtitle, color = 'blue' }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-${color}-100`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  const getAttendanceColor = (dayData) => {
    if (!dayData) return 'bg-gray-100';

    switch (dayData.type) {
      case 'attendance':
        return dayData.status === 'present' ? 'bg-green-200' : 'bg-red-200';
      case 'leave':
        return 'bg-yellow-200';
      case 'weekend':
        return 'bg-gray-200';
      default:
        return 'bg-gray-100';
    }
  };

  const renderCalendar = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1).getDay();
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-10"></div>);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dayData = attendanceCalendar[dateKey];

      days.push(
        <div
          key={day}
          className={`h-10 w-10 rounded-lg flex items-center justify-center text-sm font-medium ${getAttendanceColor(dayData)} ${dayData ? 'text-gray-800' : 'text-gray-400'
            }`}
          title={dayData ? `${dayData.type}: ${dayData.status || dayData.leave_type}` : 'No data'}
        >
          {day}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="h-10 flex items-center justify-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
        {days}
      </div>
    );
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Personal Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-medium">{employee?.full_name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{employee?.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{employee?.phone || 'N/A'}</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Building className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Department</p>
                <p className="font-medium">{employee?.department || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Award className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Position</p>
                <p className="font-medium">{employee?.position || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Joined</p>
                <p className="font-medium">{employee?.created_at ? new Date(employee.created_at).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Current Month Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          icon={Calendar}
          title="Present Days"
          value={employee?.current_month_stats?.present_days || 0}
          subtitle={`${employee?.current_month_stats?.attendance_percentage?.toFixed(1) || 0}% attendance`}
          color="green"
        />
        <StatCard
          icon={Clock}
          title="Total Hours"
          value={`${employee?.current_month_stats?.total_working_hours?.toFixed(1) || 0}h`}
          subtitle={`${employee?.current_month_stats?.avg_hours_per_day?.toFixed(1) || 0}h avg/day`}
          color="blue"
        />
        <StatCard
          icon={Activity}
          title="Activities"
          value={employee?.current_month_stats?.activities_completed || 0}
          subtitle="This month"
          color="purple"
        />
        <StatCard
          icon={FileText}
          title="Leads Assigned"
          value={employee?.current_month_stats?.leads_assigned || 0}
          subtitle="This month"
          color="orange"
        />
      </div>

      {/* Role Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Role & Permissions</h3>
        <div className="flex flex-wrap gap-2">
          {employee?.role_names?.map((role, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
            >
              {role}
            </span>
          )) || <span className="text-gray-500">No roles assigned</span>}
        </div>
      </div>
    </div>
  );

  const renderAttendance = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Attendance Calendar</h3>
        <div className="flex space-x-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i + 1}>
                {new Date(0, i).toLocaleDateString('en', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {Array.from({ length: 3 }, (_, i) => (
              <option key={i} value={new Date().getFullYear() - i}>
                {new Date().getFullYear() - i}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {renderCalendar()}

        <div className="mt-6 flex justify-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-200 rounded"></div>
            <span className="text-sm text-gray-600">Present</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-200 rounded"></div>
            <span className="text-sm text-gray-600">Absent</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-200 rounded"></div>
            <span className="text-sm text-gray-600">Leave</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-200 rounded"></div>
            <span className="text-sm text-gray-600">Weekend/Holiday</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPerformance = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Performance Report</h3>
        <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
          <Download className="w-4 h-4" />
          <span>Export Report</span>
        </button>
      </div>

      {performanceReport && (
        <>
          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              icon={TrendingUp}
              title="Conversion Rate"
              value={`${performanceReport.leads_metrics?.conversion_rate || 0}%`}
              subtitle={`${performanceReport.leads_metrics?.converted_leads || 0} of ${performanceReport.leads_metrics?.total_leads || 0} leads`}
              color="green"
            />
            <StatCard
              icon={Activity}
              title="Total Activities"
              value={performanceReport.activity_metrics?.total_activities || 0}
              subtitle={`${performanceReport.activity_metrics?.avg_activities_per_day?.toFixed(1) || 0} per day`}
              color="blue"
            />
            <StatCard
              icon={Clock}
              title="Avg Hours/Day"
              value={`${performanceReport.attendance_metrics?.avg_hours_per_day?.toFixed(1) || 0}h`}
              subtitle={`${performanceReport.attendance_metrics?.present_days || 0} present days`}
              color="purple"
            />
          </div>

          {/* Activity Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Activity Breakdown</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(performanceReport.activity_metrics?.activity_breakdown || {}).map(([type, count]) => (
                <div key={type} className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-sm text-gray-600 capitalize">{type.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Period Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Report Period</h4>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">From</p>
                <p className="font-medium">{performanceReport.period?.start_date}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">To</p>
                <p className="font-medium">{performanceReport.period?.end_date}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Employee</p>
                <p className="font-medium">{performanceReport.employee_name}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mr-6"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Employees</span>
            </button>

            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{employee?.full_name}</h1>
              <p className="text-gray-600 mt-1">
                {employee?.position} • {employee?.department} • ID: {employee?.employee_id}
              </p>
            </div>

            <div className={`px-3 py-1 rounded-full text-sm font-medium ${employee?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
              {employee?.is_active ? 'Active' : 'Inactive'}
            </div>
          </div>

          <div className="flex space-x-1 pb-4">
            <TabButton
              id="overview"
              label="Overview"
              icon={User}
              isActive={activeTab === 'overview'}
              onClick={setActiveTab}
            />
            <TabButton
              id="attendance"
              label="Attendance"
              icon={Calendar}
              isActive={activeTab === 'attendance'}
              onClick={setActiveTab}
            />
            <TabButton
              id="performance"
              label="Performance"
              icon={BarChart3}
              isActive={activeTab === 'performance'}
              onClick={setActiveTab}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'attendance' && renderAttendance()}
        {activeTab === 'performance' && renderPerformance()}
      </div>
    </div>
  );
};

export default EmployeeDetailPage;
