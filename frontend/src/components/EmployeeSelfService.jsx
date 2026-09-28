import React, { useState, useEffect } from 'react';
import {
  User,
  Calendar,
  Clock,
  ClipboardList,
  Settings,
  MapPin,
  Phone,
  Mail,
  Building,
  Camera,
  Edit,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Download,
  Upload
} from 'lucide-react';

const EmployeeSelfService = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [employee, setEmployee] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Mock current user - replace with actual user context
  const currentUser = {
    id: 'emp_123',
    employee_id: '456',
    name: 'John Doe'
  };

  const API_BASE = 'https://cubehis.avopay.pro:5000/api/employees';

  useEffect(() => {
    if (activeTab === 'profile') {
      fetchProfile();
    } else if (activeTab === 'attendance') {
      fetchAttendance();
    } else if (activeTab === 'leaves') {
      fetchLeaveRequests();
    }
  }, [activeTab]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/${currentUser.employee_id}`);
      const data = await response.json();
      if (data.success) {
        setEmployee(data.employee);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/${currentUser.employee_id}/attendance`);
      const data = await response.json();
      if (data.success) {
        setAttendanceRecords(data.records);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/${currentUser.employee_id}/leave-requests`);
      const data = await response.json();
      if (data.success) {
        setLeaveRequests(data.requests);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      const response = await fetch(`${API_BASE}/${currentUser.employee_id}/attendance/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'Office' // You can get this from geolocation
        })
      });

      if (response.ok) {
        fetchAttendance();
        fetchProfile();
      }
    } catch (error) {
      console.error('Error checking in:', error);
    }
  };

  const handleCheckOut = async () => {
    try {
      const response = await fetch(`${API_BASE}/${currentUser.employee_id}/attendance/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        fetchAttendance();
        fetchProfile();
      }
    } catch (error) {
      console.error('Error checking out:', error);
    }
  };

  const TabButton = ({ id, label, icon: Icon, isActive, onClick }) => (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${isActive
          ? 'bg-blue-600 text-white shadow-lg'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );

  const StatCard = ({ title, value, icon: Icon, color = 'blue' }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-full bg-${color}-100`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Employee Portal</h1>
              <p className="text-sm text-gray-500">Welcome back, {currentUser.name}</p>
            </div>
            <div className="flex items-center space-x-4">
              {employee?.attendance_status?.can_checkout ? (
                <button
                  onClick={handleCheckOut}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-2"
                >
                  <Clock className="w-4 h-4" />
                  <span>Check Out</span>
                </button>
              ) : (
                <button
                  onClick={handleCheckIn}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
                >
                  <Clock className="w-4 h-4" />
                  <span>Check In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl mb-8">
          <TabButton
            id="profile"
            label="Profile"
            icon={User}
            isActive={activeTab === 'profile'}
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
            id="leaves"
            label="Leave Requests"
            icon={ClipboardList}
            isActive={activeTab === 'leaves'}
            onClick={setActiveTab}
          />
          <TabButton
            id="documents"
            label="Documents"
            icon={Upload}
            isActive={activeTab === 'documents'}
            onClick={setActiveTab}
          />
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && employee && (
          <div className="space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                title="Working Hours Today"
                value={employee.attendance_status?.working_hours || '0h'}
                icon={Clock}
                color="blue"
              />
              <StatCard
                title="Leave Balance"
                value={employee.leave_balance || '0'}
                icon={Calendar}
                color="green"
              />
              <StatCard
                title="Attendance Rate"
                value={`${employee.attendance_rate || 0}%`}
                icon={CheckCircle}
                color="purple"
              />
            </div>

            {/* Profile Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
                <button
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                >
                  {isEditingProfile ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                  <span>{isEditingProfile ? 'Cancel' : 'Edit'}</span>
                </button>
              </div>

              <div className="p-6">
                <div className="flex items-center space-x-6 mb-8">
                  <div className="relative">
                    <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-2xl font-bold text-blue-800">
                        {employee.full_name?.charAt(0) || 'N'}
                      </span>
                    </div>
                    {isEditingProfile && (
                      <button className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700">
                        <Camera className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-gray-900">{employee.full_name}</h4>
                    <p className="text-gray-600">{employee.position}</p>
                    <p className="text-sm text-gray-500">Employee ID: {employee.employee_id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h5 className="font-medium text-gray-900">Personal Information</h5>

                    <div className="flex items-center space-x-3">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        {isEditingProfile ? (
                          <input
                            type="email"
                            value={employee.email}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        ) : (
                          <p className="text-gray-900">{employee.email}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                        {isEditingProfile ? (
                          <input
                            type="tel"
                            value={employee.phone || ''}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        ) : (
                          <p className="text-gray-900">{employee.phone || 'Not provided'}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Address</label>
                        {isEditingProfile ? (
                          <textarea
                            value={employee.address || ''}
                            rows={2}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        ) : (
                          <p className="text-gray-900">{employee.address || 'Not provided'}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h5 className="font-medium text-gray-900">Work Information</h5>

                    <div className="flex items-center space-x-3">
                      <Building className="w-4 h-4 text-gray-400" />
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Department</label>
                        <p className="text-gray-900">{employee.department || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Position</label>
                        <p className="text-gray-900">{employee.position || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Joining Date</label>
                        <p className="text-gray-900">{employee.date_of_joining || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-4 h-4 text-gray-400" />
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Status</label>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {employee.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {isEditingProfile && (
                  <div className="mt-6 flex justify-end space-x-4">
                    <button
                      onClick={() => setIsEditingProfile(false)}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Emergency Contact</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Contact Name</label>
                    <p className="text-gray-900">{employee.emergency_contact_name || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
                    <p className="text-gray-900">{employee.emergency_contact_phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            {/* Today's Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Attendance</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Status</p>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${employee?.attendance_status?.status === 'present'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                    }`}>
                    {employee?.attendance_status?.status === 'present' ? 'Present' : 'Absent'}
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Check In</p>
                  <p className="font-medium text-gray-900">
                    {employee?.attendance_status?.checkin_time
                      ? new Date(employee.attendance_status.checkin_time).toLocaleTimeString()
                      : '--:--'
                    }
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Check Out</p>
                  <p className="font-medium text-gray-900">
                    {employee?.attendance_status?.checkout_time
                      ? new Date(employee.attendance_status.checkout_time).toLocaleTimeString()
                      : '--:--'
                    }
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Working Hours</p>
                  <p className="font-medium text-gray-900">
                    {employee?.attendance_status?.working_hours || '0'}h
                  </p>
                </div>
              </div>
            </div>

            {/* Attendance History */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Attendance History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
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
                        Working Hours
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendanceRecords.map((record) => (
                      <tr key={record._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(record.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.checkin_time ? new Date(record.checkin_time).toLocaleTimeString() : '--:--'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.checkout_time ? new Date(record.checkout_time).toLocaleTimeString() : '--:--'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.working_hours ? `${record.working_hours}h` : '--'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${record.status === 'present'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
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

        {/* Leave Requests Tab */}
        {activeTab === 'leaves' && (
          <div className="space-y-6">
            {/* Request Leave Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowLeaveModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <ClipboardList className="w-4 h-4" />
                <span>Request Leave</span>
              </button>
            </div>

            {/* Leave Requests List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">My Leave Requests</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Leave Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dates
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Days
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Applied On
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leaveRequests.map((request) => (
                      <tr key={request._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {request.leave_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {request.start_date} to {request.end_date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {request.days_requested}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${request.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : request.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {request.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(request.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {request.status === 'pending' && (
                            <button className="text-red-600 hover:text-red-800">
                              Cancel
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
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Document Management</h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Upload your documents here</p>
                <p className="text-sm text-gray-500">PDF, DOC, DOCX files up to 10MB</p>
                <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Choose Files
                </button>
              </div>
            </div>

            {/* Document List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">My Documents</h3>
              </div>
              <div className="p-6">
                <div className="text-center text-gray-500 py-8">
                  <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p>No documents uploaded yet</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <LeaveRequestModal
          onClose={() => setShowLeaveModal(false)}
          onSuccess={() => {
            setShowLeaveModal(false);
            fetchLeaveRequests();
          }}
          employeeId={currentUser.employee_id}
        />
      )}
    </div>
  );
};

// Leave Request Modal Component
const LeaveRequestModal = ({ onClose, onSuccess, employeeId }) => {
  const [formData, setFormData] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: '',
    emergency_contact: ''
  });
  const [loading, setLoading] = useState(false);

  const API_BASE = 'https://cubehis.avopay.pro:5000/api/employees';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/${employeeId}/leave-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        onSuccess();
      } else {
        alert(data.message || 'Error submitting leave request');
      }
    } catch (error) {
      console.error('Error submitting leave request:', error);
      alert('Error submitting leave request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Request Leave</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Leave Type *
            </label>
            <select
              required
              value={formData.leave_type}
              onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Leave Type</option>
              <option value="sick">Sick Leave</option>
              <option value="vacation">Vacation</option>
              <option value="personal">Personal Leave</option>
              <option value="emergency">Emergency Leave</option>
              <option value="maternity">Maternity Leave</option>
              <option value="paternity">Paternity Leave</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date *
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason *
            </label>
            <textarea
              required
              rows={3}
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Please provide a reason for your leave request..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emergency Contact
            </label>
            <input
              type="text"
              value={formData.emergency_contact}
              onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Contact person during leave"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeSelfService;
