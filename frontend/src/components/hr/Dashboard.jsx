import React from 'react';

const Dashboard = ({ dashboardStats, employees, hasPermission }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">HR Dashboard</h2>
          <p className="text-gray-600 mt-1">Overview of employee statistics and attendance</p>
        </div>
      </div>

      {/* Admin/HR Metrics */}
      {(hasPermission('hr') || hasPermission('admin')) && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-blue-800 mb-2">Admin/HR Dashboard Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-3 rounded-lg shadow">
              <p className="text-sm text-gray-600">Total Departments</p>
              <p className="text-xl font-bold">
                {[...new Set(employees.map(emp => emp.department).filter(Boolean))].length}
              </p>
            </div>
            <div className="bg-white p-3 rounded-lg shadow">
              <p className="text-sm text-gray-600">Total Roles</p>
              <p className="text-xl font-bold">
                {[...new Set(employees.map(emp => emp.role).filter(Boolean))].length}
              </p>
            </div>
            <div className="bg-white p-3 rounded-lg shadow">
              <p className="text-sm text-gray-600">Admin/HR Users</p>
              <p className="text-xl font-bold">
                {employees.filter(emp => 
                  (emp.role || '').toLowerCase().includes('admin') || 
                  (emp.role || '').toLowerCase().includes('hr') ||
                  (Array.isArray(emp.roles) && emp.roles.some(r => 
                    r.toLowerCase().includes('admin') || r.toLowerCase().includes('hr')
                  ))
                ).length}
              </p>
            </div>
            <div className="bg-white p-3 rounded-lg shadow">
              <p className="text-sm text-gray-600">Active Employees</p>
              <p className="text-xl font-bold">
                {employees.filter(emp => emp.status === 'active' || emp.is_active !== false).length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Role-based Metrics - Only visible to HR/Admin */}
      {(hasPermission('hr') || hasPermission('admin')) && dashboardStats.role_breakdown && (
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Employee Metrics by Role</h3>
            <div className="text-sm text-blue-600">
              <i className="fas fa-chart-pie mr-1"></i> {dashboardStats.role_breakdown?.length || 0} roles
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dashboardStats.role_breakdown?.length > 0 ? (
                  dashboardStats.role_breakdown.map((role, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="py-2 px-3 text-sm text-gray-900 capitalize">{role.role}</td>
                      <td className="py-2 px-3 text-sm text-gray-900">{role.total}</td>
                      <td className="py-2 px-3 text-sm text-green-600 font-medium">{role.present}</td>
                      <td className="py-2 px-3 text-sm text-red-600 font-medium">{role.absent}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full ${
                                role.attendance_rate > 75 ? 'bg-green-600' : 
                                role.attendance_rate > 50 ? 'bg-yellow-400' : 
                                'bg-red-600'
                              }`} 
                              style={{ width: `${role.attendance_rate}%` }}
                            ></div>
                          </div>
                          <span className="ml-2 text-xs font-medium text-gray-900">{role.attendance_rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="py-4 text-center text-gray-500">
                      No role data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Department-based Metrics - Only visible to HR/Admin */}
      {(hasPermission('hr') || hasPermission('admin')) && dashboardStats.department_breakdown && (
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Employee Metrics by Department</h3>
            <div className="text-sm text-blue-600">
              <i className="fas fa-building mr-1"></i> {dashboardStats.department_breakdown?.length || 0} departments
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dashboardStats.department_breakdown?.length > 0 ? (
                  dashboardStats.department_breakdown.map((dept, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="py-2 px-3 text-sm text-gray-900 capitalize">{dept.department}</td>
                      <td className="py-2 px-3 text-sm text-gray-900">{dept.total}</td>
                      <td className="py-2 px-3 text-sm text-green-600 font-medium">{dept.present}</td>
                      <td className="py-2 px-3 text-sm text-red-600 font-medium">{dept.absent}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full ${
                                dept.attendance_rate > 75 ? 'bg-green-600' : 
                                dept.attendance_rate > 50 ? 'bg-yellow-400' : 
                                'bg-red-600'
                              }`} 
                              style={{ width: `${dept.attendance_rate}%` }}
                            ></div>
                          </div>
                          <span className="ml-2 text-xs font-medium text-gray-900">{dept.attendance_rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="py-4 text-center text-gray-500">
                      No department data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Present</p>
              <p className="text-3xl font-bold text-green-600">{dashboardStats.present_today || 0}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <i className="fas fa-user-check text-green-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Absent</p>
              <p className="text-3xl font-bold text-red-600">{dashboardStats.absent_today || 0}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <i className="fas fa-user-times text-red-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">On Leave</p>
              <p className="text-3xl font-bold text-yellow-600">{dashboardStats.on_leave_today || 0}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <i className="fas fa-calendar-times text-yellow-600 text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics - Only visible to HR/Admin */}
      {(hasPermission('hr') || hasPermission('admin')) && (
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Performance Overview</h3>
            <div className="text-sm text-blue-600">
              <i className="fas fa-chart-line mr-1"></i> Today's Activities
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-600 mb-2">Lead Response Time</h4>
              <p className="text-2xl font-bold text-blue-600">{dashboardStats.average_lead_response_time || 'N/A'}</p>
              <p className="text-xs text-gray-500">Average response time</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-600 mb-2">Activities Completed</h4>
              <p className="text-2xl font-bold text-purple-600">{dashboardStats.activities_today || 0}</p>
              <p className="text-xs text-gray-500">Tasks completed today</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-600 mb-2">Lead Conversion Rate</h4>
              <p className="text-2xl font-bold text-green-600">{dashboardStats.lead_conversion_rate || '0%'}</p>
              <p className="text-xs text-gray-500">Overall conversion</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
