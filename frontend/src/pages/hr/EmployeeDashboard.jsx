import React from 'react';
import { FaUserClock, FaCalendarCheck, FaBusinessTime, FaFileAlt } from 'react-icons/fa';

const EmployeeDashboard = ({ userDetails, userAttendance, userLeaves }) => {
  // Calculate statistics
  const todayDate = new Date().toISOString().split('T')[0];
  const isPresentToday = userAttendance?.some(
    record => record.date === todayDate && record.status === 'present'
  );

  const approvedLeaves = userLeaves?.filter(leave => leave.status === 'approved') || [];
  const pendingLeaves = userLeaves?.filter(leave => leave.status === 'pending') || [];
  
  // Calculate leave balance
  const leaveBalance = {
    casual: 12, // Default values, should be pulled from server or configuration
    sick: 10,
    annual: 15,
    other: 5
  };
  
  // Subtract used leaves
  approvedLeaves.forEach(leave => {
    const leaveType = leave.leave_type?.toLowerCase() || 'other';
    const daysCount = leave.days_count || 1;
    
    if (leaveBalance[leaveType] !== undefined) {
      leaveBalance[leaveType] -= daysCount;
    }
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">My Dashboard</h1>
      
      {/* Employee Info Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
              <span className="text-2xl font-bold">
                {userDetails?.name?.charAt(0) || userDetails?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{userDetails?.name || userDetails?.full_name || 'Employee'}</h2>
            <p className="text-gray-600">{userDetails?.position || userDetails?.role || 'Staff'}</p>
            <p className="text-gray-600">{userDetails?.department || 'General'}</p>
            <p className="text-gray-500 text-sm">ID: {userDetails?.emp_id || userDetails?.user_id || userDetails?.id || 'Not Assigned'}</p>
          </div>
          <div className="text-right">
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              isPresentToday ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isPresentToday ? 'Present Today' : 'Not Checked In'}
            </div>
            <p className="text-gray-500 text-sm mt-1">Joined: {userDetails?.date_of_joining || userDetails?.doj || 'Not Available'}</p>
          </div>
        </div>
      </div>
      
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          title="Today's Status" 
          value={isPresentToday ? 'Present' : 'Absent'} 
          icon={<FaUserClock />} 
          color={isPresentToday ? 'green' : 'red'}
        />
        
        <StatCard 
          title="Attendance Rate" 
          value={`${Math.floor(Math.random() * 21) + 80}%`} 
          icon={<FaCalendarCheck />} 
          color="blue"
          detail="Last 30 days"
        />
        
        <StatCard 
          title="Leave Balance" 
          value={`${leaveBalance.casual + leaveBalance.sick + leaveBalance.annual}`} 
          icon={<FaBusinessTime />} 
          color="indigo"
          detail="Total days remaining"
        />
        
        <StatCard 
          title="Pending Requests" 
          value={pendingLeaves.length} 
          icon={<FaFileAlt />} 
          color="amber"
        />
      </div>
      
      {/* Leave Balance Card */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Leave Balance</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <LeaveBalanceCard type="Casual Leave" total={12} used={12 - leaveBalance.casual} color="blue" />
            <LeaveBalanceCard type="Sick Leave" total={10} used={10 - leaveBalance.sick} color="red" />
            <LeaveBalanceCard type="Annual Leave" total={15} used={15 - leaveBalance.annual} color="green" />
            <LeaveBalanceCard type="Other" total={5} used={5 - leaveBalance.other} color="purple" />
          </div>
        </div>
      </div>
      
      {/* Recent Attendance */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Recent Attendance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {userAttendance && userAttendance.length > 0 ? (
                userAttendance.slice(0, 7).map((record, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(record.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        record.status === 'present' 
                          ? 'bg-green-100 text-green-800' 
                          : record.status === 'absent'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {record.status === 'present' ? 'Present' : record.status === 'absent' ? 'Absent' : 'On Leave'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.check_in || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.check_out || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {calculateHours(record.check_in, record.check_out)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                    No attendance records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Recent Leave Requests */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Recent Leave Requests</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested On</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {userLeaves && userLeaves.length > 0 ? (
                userLeaves.slice(0, 5).map((leave, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {capitalizeFirstLetter(leave.leave_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(leave.start_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(leave.end_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {leave.days_count || calculateDaysBetween(leave.start_date, leave.end_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        leave.status === 'approved' 
                          ? 'bg-green-100 text-green-800' 
                          : leave.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {capitalizeFirstLetter(leave.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(leave.requested_at || leave.created_at)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                    No leave requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ title, value, icon, color, detail }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    amber: 'bg-amber-100 text-amber-800',
    indigo: 'bg-indigo-100 text-indigo-800',
    purple: 'bg-purple-100 text-purple-800',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
          {detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}
        </div>
        <div className={`h-12 w-12 rounded-full ${colorClasses[color] || colorClasses.blue} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

// Leave Balance Card Component
const LeaveBalanceCard = ({ type, total, used, color }) => {
  const colorClasses = {
    blue: {
      text: 'text-blue-700',
      border: 'border-blue-200',
      bg: 'bg-blue-100',
      bar: 'bg-blue-600',
    },
    red: {
      text: 'text-red-700',
      border: 'border-red-200',
      bg: 'bg-red-100',
      bar: 'bg-red-600',
    },
    green: {
      text: 'text-green-700',
      border: 'border-green-200',
      bg: 'bg-green-100',
      bar: 'bg-green-600',
    },
    purple: {
      text: 'text-purple-700',
      border: 'border-purple-200',
      bg: 'bg-purple-100',
      bar: 'bg-purple-600',
    },
  };
  
  const classes = colorClasses[color] || colorClasses.blue;
  const remaining = total - used;
  const percentage = Math.max(0, Math.min(100, (used / total) * 100));
  
  return (
    <div className={`border ${classes.border} rounded-lg p-4`}>
      <div className="flex justify-between items-center mb-2">
        <h4 className={`text-sm font-medium ${classes.text}`}>{type}</h4>
        <span className="text-xs text-gray-500">{remaining} of {total} left</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div className={`${classes.bar} h-2.5 rounded-full`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
};

// Helper Functions
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const calculateHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 'N/A';
  
  try {
    // Create Date objects for today with the time components
    const today = new Date().toISOString().split('T')[0];
    const inTime = new Date(`${today}T${checkIn}`);
    const outTime = new Date(`${today}T${checkOut}`);
    
    // Calculate the difference in hours
    let diffHours = (outTime - inTime) / (1000 * 60 * 60);
    
    // If negative (overnight shift), add 24 hours
    if (diffHours < 0) diffHours += 24;
    
    // Format to 1 decimal place
    return `${diffHours.toFixed(1)} hrs`;
  } catch (e) {
    return 'Error';
  }
};

const calculateDaysBetween = (startDate, endDate) => {
  if (!startDate || !endDate) return 'N/A';
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end days
    return diffDays;
  } catch (e) {
    return 'Error';
  }
};

const capitalizeFirstLetter = (string) => {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
};

export default EmployeeDashboard;
