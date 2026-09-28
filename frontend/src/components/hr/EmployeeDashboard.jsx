import React, { useState } from 'react';
import { formatDate } from '../../utils/dateUtils';
import { FaUserClock, FaCalendarCheck, FaBusinessTime, FaFileAlt } from 'react-icons/fa';

const EmployeeDashboard = ({ 
  userDetails, 
  userAttendance,
  userLeaves,
  userActivities
}) => {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  
  // Debug to see what data is coming in
  console.log('EmployeeDashboard userDetails:', userDetails);
  console.log('Available bank details:', {
    bank_name: userDetails?.bank_name,
    bank_account_number: userDetails?.bank_account_number,
    bank_ifsc: userDetails?.bank_ifsc
  });
  
  // Get today's attendance record
  const todayAttendance = userAttendance?.find(record => record.date === today) || {};
  
  // Calculate leave stats
  const casualLeaveUsed = userLeaves?.casual_leave_used || 0;
  const casualLeaveTotal = userLeaves?.casual_leave_total || 15;
  const sickLeaveUsed = userLeaves?.sick_leave_used || 0;
  const sickLeaveTotal = userLeaves?.sick_leave_total || 10;
  
  // Calculate attendance percentage
  const totalWorkingDays = userAttendance?.length || 0;
  const presentDays = userAttendance?.filter(record => record.status === 'present')?.length || 0;
  const attendancePercentage = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0;
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Dashboard</h2>
          <p className="text-gray-600 mt-1">Personal overview and statistics</p>
        </div>
        <div className="text-sm text-gray-500">
          <span className="font-medium">{formatDate(new Date())}</span>
        </div>
      </div>
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {userDetails?.profile_image ? (
              <img className="h-16 w-16 rounded-full border-2 border-white object-cover" src={userDetails.profile_image} alt="" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-blue-400 flex items-center justify-center text-white text-2xl border-2 border-white">
                {userDetails?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            )}
          </div>
          <div className="ml-4">
            <h3 className="text-xl font-bold">Welcome back, {userDetails?.name || 'User'}</h3>
            <p className="text-blue-100">{userDetails?.role || 'Employee'} • {userDetails?.department || 'Department'}</p>
          </div>
        </div>
      </div>
      
      {/* Personal Information Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Basic Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-500 border-b pb-2">Basic Details</h4>
            <div>
              <p className="text-xs text-gray-500">Employee ID</p>
              <p className="text-sm">{userDetails?.employee_id || userDetails?.user_id || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Employee Type</p>
              <p className="text-sm capitalize">{userDetails?.employee_type?.replace('_', ' ') || 'Full Time'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Date of Joining</p>
              <p className="text-sm">{formatDate(userDetails?.date_of_joining || userDetails?.doj)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Date of Birth</p>
              <p className="text-sm">{userDetails?.date_of_birth ? formatDate(userDetails.date_of_birth) : 'N/A'}</p>
            </div>
          </div>
          
          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-500 border-b pb-2">Contact Information</h4>
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm">{userDetails?.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Phone</p>
              <p className="text-sm">{userDetails?.phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Address</p>
              <p className="text-sm">{userDetails?.address || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">City, State</p>
              <p className="text-sm">{userDetails?.city || 'N/A'}, {userDetails?.state || 'N/A'}</p>
            </div>
          </div>
          
          {/* Bank Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-500 border-b pb-2">Bank Details</h4>
            <div>
              <p className="text-xs text-gray-500">Bank Name</p>
              <p className="text-sm">{userDetails?.bank_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Account Number</p>
              <p className="text-sm">{userDetails?.bank_account_number ? 'XXXX-XXXX-' + userDetails.bank_account_number.slice(-4) : 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">IFSC Code</p>
              <p className="text-sm">{userDetails?.bank_ifsc || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Emergency Contact</p>
              <p className="text-sm">{userDetails?.emergency_contact_name ? `${userDetails.emergency_contact_name} (${userDetails.emergency_contact_phone || 'No phone'})` : 'Not provided'}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Today's Attendance Card */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <h3 className="text-sm font-medium text-gray-600">Today's Attendance</h3>
          <div className="mt-2">
            {todayAttendance.status === 'present' ? (
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-green-600">Present</span>
                <span className="text-sm text-gray-500">
                  {todayAttendance.check_in || '-'} - {todayAttendance.check_out || 'Now'}
                </span>
              </div>
            ) : todayAttendance.status === 'absent' ? (
              <span className="text-lg font-bold text-red-600">Absent</span>
            ) : todayAttendance.status === 'on_leave' ? (
              <span className="text-lg font-bold text-yellow-600">On Leave</span>
            ) : (
              <div className="flex items-center">
                <span className="text-lg font-medium text-gray-400">Not Marked</span>
                <button className="ml-3 px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200">
                  Check In
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Attendance Rate */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <h3 className="text-sm font-medium text-gray-600">Attendance Rate</h3>
          <div className="mt-2">
            <div className="flex items-center">
              <div className="text-lg font-bold text-green-600">{attendancePercentage}%</div>
              <div className="ml-auto w-1/2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      attendancePercentage > 90 ? 'bg-green-600' : 
                      attendancePercentage > 75 ? 'bg-blue-500' :
                      attendancePercentage > 60 ? 'bg-yellow-500' : 
                      'bg-red-500'
                    }`}
                    style={{ width: `${attendancePercentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {presentDays}/{totalWorkingDays} days present
            </div>
          </div>
        </div>
        
        {/* Casual Leave */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <h3 className="text-sm font-medium text-gray-600">Casual Leave</h3>
          <div className="mt-2">
            <div className="flex items-center">
              <div className="text-lg font-bold text-purple-600">
                {casualLeaveUsed}/{casualLeaveTotal}
              </div>
              <div className="ml-auto w-1/2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-purple-500"
                    style={{ width: `${(casualLeaveUsed / casualLeaveTotal) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {casualLeaveTotal - casualLeaveUsed} days remaining
            </div>
          </div>
        </div>
        
        {/* Sick Leave */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-500">
          <h3 className="text-sm font-medium text-gray-600">Sick Leave</h3>
          <div className="mt-2">
            <div className="flex items-center">
              <div className="text-lg font-bold text-amber-600">
                {sickLeaveUsed}/{sickLeaveTotal}
              </div>
              <div className="ml-auto w-1/2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-amber-500"
                    style={{ width: `${(sickLeaveUsed / sickLeaveTotal) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {sickLeaveTotal - sickLeaveUsed} days remaining
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent Activities */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
          <div className="text-sm text-blue-600">
            <button className="hover:underline focus:outline-none">View All</button>
          </div>
        </div>
        
        {userActivities && userActivities.length > 0 ? (
          <div className="space-y-4">
            {userActivities.slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-md">
                <div className={`p-2 rounded-full
                  ${activity.type === 'login' ? 'bg-green-100 text-green-600' : 
                  activity.type === 'leave' ? 'bg-yellow-100 text-yellow-600' : 
                  activity.type === 'task' ? 'bg-blue-100 text-blue-600' : 
                  'bg-gray-100 text-gray-600'}`}>
                  <i className={`fas fa-${
                    activity.type === 'login' ? 'sign-in-alt' : 
                    activity.type === 'leave' ? 'calendar-alt' : 
                    activity.type === 'task' ? 'tasks' : 
                    'bell'
                  }`}></i>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-800">{activity.description}</p>
                  <p className="text-xs text-gray-500">
                    {activity.timestamp ? (
                      new Date(activity.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    ) : 'Unknown time'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-gray-500">
            <i className="fas fa-inbox text-3xl mb-3"></i>
            <p>No recent activities to display</p>
          </div>
        )}
      </div>
      
      {/* Weekly Attendance Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Attendance</h3>
        
        <div className="h-60">
          {/* This is where you'd implement a chart component */}
          {/* For now, we'll use a simple representation */}
          <div className="h-full flex items-end justify-around">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
              // Generate random heights for demonstration
              const height = Math.floor(Math.random() * 70) + 20;
              const isPresent = height > 50;
              
              return (
                <div key={index} className="flex flex-col items-center">
                  <div 
                    className={`w-10 ${isPresent ? 'bg-green-500' : 'bg-red-400'} rounded-t-md`}
                    style={{ height: `${height}%` }}
                  ></div>
                  <div className="text-xs font-medium text-gray-600 mt-2">{day}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
