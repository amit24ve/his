import React, { useState, useEffect } from 'react';
import {
  Clock, Calendar, FileText, User, CheckCircle, XCircle,
  LogIn, LogOut, MapPin, BarChart3, CalendarDays,
  TrendingUp, Activity, Target, Timer, Coffee
} from 'lucide-react';

const EmployeeModule = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [location, setLocation] = useState(null);

  // Mock current user - replace with actual user context
  const currentUser = {
    id: 'emp_001',
    roles: ['employee']
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchProfile();
      fetchTodayAttendance();
    }
    if (activeTab === 'attendance') fetchMyAttendance();
    if (activeTab === 'leaves') fetchMyLeaves();

    // Get user location for attendance
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => console.log('Location access denied')
      );
    }
  }, [activeTab, selectedMonth, selectedYear]);

  const API_BASE = 'https://cubehis.avopay.pro:5000/api/employees';

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_BASE}/${currentUser.id}/profile?current_user_id=${currentUser.id}`);
      const data = await response.json();
      if (data.success) {
        setProfile(data.data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`${API_BASE}/attendance/my-records?user_id=${currentUser.id}&month=${new Date().getMonth() + 1}&year=${new Date().getFullYear()}&limit=1`);
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        const todayRecord = data.data.find(record => record.date === today);
        setTodayAttendance(todayRecord);
      }
    } catch (error) {
      console.error('Error fetching today attendance:', error);
    }
  };

  const fetchMyAttendance = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/attendance/my-records?user_id=${currentUser.id}&month=${selectedMonth}&year=${selectedYear}`);
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

  const fetchMyLeaves = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/leave-requests?current_user_id=${currentUser.id}&current_user_roles=${currentUser.roles.join(',')}`);
      const data = await response.json();
      if (data.success) {
        setLeaveRequests(data.data);
      }
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInOut = async (action) => {
    try {
      const payload = {
        user_id: currentUser.id,
        action: action,
        latitude: location?.latitude,
        longitude: location?.longitude,
        notes: ''
      };

      const response = await fetch(`${API_BASE}/attendance/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        alert(data.message);
        fetchTodayAttendance();
        if (activeTab === 'attendance') fetchMyAttendance();
      } else {
        alert(data.detail || 'Error recording attendance');
      }
    } catch (error) {
      console.error('Error with check in/out:', error);
      alert('Error recording attendance');
    }
  };

  const submitLeaveRequest = async (leaveData) => {
    try {
      const payload = {
        user_id: currentUser.id,
        ...leaveData
      };

      const response = await fetch(`${API_BASE}/leave-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        alert('Leave request submitted successfully');
        setShowLeaveModal(false);
        fetchMyLeaves();
      } else {
        alert(data.detail || 'Error submitting leave request');
      }
    } catch (error) {
      console.error('Error submitting leave:', error);
    }
  };

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

  const LeaveRequestModal = () => {
    const [formData, setFormData] = useState({
      leave_type: 'sick',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      reason: '',
      is_half_day: false
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      submitLeaveRequest(formData);
    };

    if (!showLeaveModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
          <h2 className="text-xl font-bold mb-4">Request Leave</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
              <select
                value={formData.leave_type}
                onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="sick">Sick Leave</option>
                <option value="vacation">Vacation</option>
                <option value="personal">Personal Leave</option>
                <option value="emergency">Emergency Leave</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_half_day}
                  onChange={(e) => setFormData({ ...formData, is_half_day: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Half Day</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea
                required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
              />
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Submit Request
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => handleCheckInOut(todayAttendance?.checkin_time ? 'checkout' : 'checkin')}
            className={`flex items-center space-x-3 p-4 rounded-lg font-medium transition-colors ${todayAttendance?.checkin_time && !todayAttendance?.checkout_time
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-green-500 hover:bg-green-600'
              }`}
          >
            {todayAttendance?.checkin_time && !todayAttendance?.checkout_time ? (
              <>
                <LogOut className="w-5 h-5" />
                <span>Check Out</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Check In</span>
              </>
            )}
          </button>
          <button
            onClick={() => setShowLeaveModal(true)}
            className="flex items-center space-x-3 p-4 bg-yellow-500 hover:bg-yellow-600 rounded-lg font-medium transition-colors"
          >
            <FileText className="w-5 h-5" />
            <span>Request Leave</span>
          </button>
        </div>
      </div>

      {/* Today's Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={Clock}
          title="Today's Status"
          value={todayAttendance?.status || 'Not Checked In'}
          subtitle={todayAttendance?.checkin_time ?
            `In: ${new Date(todayAttendance.checkin_time).toLocaleTimeString()}` :
            'Check in to start tracking'
          }
          color="blue"
        />
        <StatCard
          icon={Timer}
          title="Working Hours"
          value={todayAttendance?.working_hours?.toFixed(1) || '0.0'}
          subtitle="Hours today"
          color="green"
        />
        <StatCard
          icon={Calendar}
          title="This Month"
          value={profile?.current_month_stats?.present_days || 0}
          subtitle={`${profile?.current_month_stats?.attendance_percentage?.toFixed(1) || 0}% attendance`}
          color="purple"
        />
      </div>

      {/* Profile Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Employee ID</span>
              <span className="font-medium">{profile?.employee_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Department</span>
              <span className="font-medium">{profile?.department || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Position</span>
              <span className="font-medium">{profile?.position || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Reporting To</span>
              <span className="font-medium">{profile?.reporting_user_id || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Performance</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Working Days</span>
              <span className="font-medium">{profile?.current_month_stats?.working_days || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Present Days</span>
              <span className="font-medium">{profile?.current_month_stats?.present_days || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Hours</span>
              <span className="font-medium">{profile?.current_month_stats?.total_working_hours?.toFixed(1) || 0}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Hours/Day</span>
              <span className="font-medium">{profile?.current_month_stats?.avg_hours_per_day?.toFixed(1) || 0}h</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAttendance = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">My Attendance</h2>
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendanceRecords.map((record) => (
                <tr key={record._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {new Date(record.date).toLocaleDateString()}
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.notes || '-'}
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
        <h2 className="text-2xl font-bold text-gray-900">My Leave Requests</h2>
        <button
          onClick={() => setShowLeaveModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <FileText className="w-4 h-4" />
          <span>Request Leave</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaveRequests.map((request) => (
                <tr key={request._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {request.leave_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.days_requested} {request.is_half_day ? '(Half Day)' : 'day(s)'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.start_date} to {request.end_date}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {request.reason}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <LeaveStatusBadge status={request.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(request.requested_at).toLocaleDateString()}
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
              <h1 className="text-3xl font-bold text-gray-900">Employee Portal</h1>
              <p className="text-gray-600 mt-1">Welcome back, {profile?.full_name || 'Employee'}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
              {location && (
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <MapPin className="w-4 h-4" />
                  <span>Location Enabled</span>
                </div>
              )}
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
              id="attendance"
              label="My Attendance"
              icon={Clock}
              isActive={activeTab === 'attendance'}
              onClick={setActiveTab}
            />
            <TabButton
              id="leaves"
              label="My Leaves"
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
            {activeTab === 'attendance' && renderAttendance()}
            {activeTab === 'leaves' && renderLeaves()}
          </>
        )}
      </div>

      <LeaveRequestModal />
    </div>
  );
};

export default EmployeeModule;
