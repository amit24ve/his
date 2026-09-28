import React, { useState } from 'react';

const EmployeeList = ({ employees, onSelectEmployee }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  
  // Get unique departments for filter dropdown
  const departments = ['All', ...new Set(employees.map(emp => emp.department).filter(Boolean))];
  
  // Filter employees based on search term and department
  const filteredEmployees = employees.filter(employee => {
    // Department filter
    if (departmentFilter !== 'All' && employee.department && 
        employee.department.toLowerCase() !== departmentFilter.toLowerCase()) {
      return false;
    }
    
    // Search term filter (case insensitive)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      // Check common fields that might contain the search term
      const nameMatch = employee.name && employee.name.toLowerCase().includes(searchLower);
      const emailMatch = employee.email && employee.email.toLowerCase().includes(searchLower);
      const idMatch = (employee.user_id || employee.employee_id || '').toString().includes(searchLower);
      const phoneMatch = (employee.phone || employee.mobile || '').toString().includes(searchLower);
      const positionMatch = employee.position && employee.position.toLowerCase().includes(searchLower);
      
      if (!(nameMatch || emailMatch || idMatch || phoneMatch || positionMatch)) {
        return false;
      }
    }
    
    return true;
  });

  return (
    <div>
      {/* Search and filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search Employees</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Search by name, email, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="w-full md:w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Employee list */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Position
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                  No employees found
                </td>
              </tr>
            ) : (
              filteredEmployees.map((employee) => (
                <tr key={employee._id || employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                          {employee.name ? employee.name.charAt(0).toUpperCase() : 'E'}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                        <div className="text-xs text-gray-500">{employee.user_id || employee.employee_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{employee.position || 'N/A'}</div>
                    <div className="text-xs text-gray-500 capitalize">{employee.employee_type?.replace('_', ' ') || 'Full Time'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${employee.department === 'Sales' ? 'bg-green-100 text-green-800' : 
                        employee.department === 'Management' ? 'bg-purple-100 text-purple-800' : 
                        employee.department === 'Admin' ? 'bg-blue-100 text-blue-800' : 
                        'bg-gray-100 text-gray-800'}`}>
                      {employee.department || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{employee.email}</div>
                    <div>{employee.phone || employee.mobile}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(employee.joining_date || employee.doj).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => onSelectEmployee(employee)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeList;
