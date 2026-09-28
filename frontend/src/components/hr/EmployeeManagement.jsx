import React, { useState, useEffect } from 'react';
import { fetchEmployees, createEmployee, updateEmployee } from '../../utils/hrAPI';
import EmployeeList from './EmployeeList';
import EmployeeForm from './EmployeeForm';
import EmployeeDetails from './EmployeeDetails';
import NotificationToast from '../common/NotificationToast';

const EmployeeManagement = ({ user, hasPermission }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  // Check if user has HR or Admin permissions
  const canManageEmployees = hasPermission('hr') || hasPermission('admin');
  
  // Redirect if not authorized
  useEffect(() => {
    if (!canManageEmployees) {
      // Redirect or show unauthorized message
      console.error('Unauthorized: Only HR and Admin can access employee management');
      // You might want to redirect here
    }
  }, [canManageEmployees]);
  
  // Fetch employees data
  useEffect(() => {
    const loadEmployees = async () => {
      if (!canManageEmployees) return;
      
      setLoading(true);
      try {
        const result = await fetchEmployees();
        console.log('Employees data:', result);
        
        if (Array.isArray(result)) {
          setEmployees(result);
        } else if (result && result.data && Array.isArray(result.data)) {
          setEmployees(result.data);
        } else {
          console.error('Unexpected employees data format:', result);
          setEmployees([]);
        }
      } catch (error) {
        console.error('Error loading employees:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadEmployees();
  }, [canManageEmployees]);
  
  // Handle adding a new employee
  const handleAddEmployee = async (employeeData) => {
    setLoading(true);
    try {
      const result = await createEmployee(employeeData);
      console.log('Employee created:', result);
      
      // Refresh employees list
      const updatedEmployees = await fetchEmployees();
      setEmployees(Array.isArray(updatedEmployees) ? updatedEmployees : 
                   (updatedEmployees?.data || []));
      
      // Close form and show success message
      setShowAddForm(false);
      setNotification({
        show: true,
        type: 'success',
        message: `Employee ${employeeData.name} was successfully added`
      });
      
    } catch (error) {
      console.error('Error creating employee:', error);
      setNotification({
        show: true,
        type: 'error',
        message: `Failed to add employee: ${error.message || 'Unknown error'}`
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle updating an existing employee
  const handleUpdateEmployee = async (employeeId, employeeData) => {
    setLoading(true);
    try {
      const result = await updateEmployee(employeeId, employeeData);
      console.log('Employee updated:', result);
      
      // Refresh employees list
      const updatedEmployees = await fetchEmployees();
      setEmployees(Array.isArray(updatedEmployees) ? updatedEmployees : 
                   (updatedEmployees?.data || []));
      
      // Update selected employee details and exit edit mode
      setSelectedEmployee(result);
      setIsEditing(false);
      setNotification({
        show: true,
        type: 'success',
        message: `Employee ${employeeData.name} was successfully updated`
      });
      
    } catch (error) {
      console.error('Error updating employee:', error);
      setNotification({
        show: true,
        type: 'error',
        message: `Failed to update employee: ${error.message || 'Unknown error'}`
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle selecting an employee for detail view
  const handleSelectEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowAddForm(false);
    setIsEditing(false);
  };
  
  // Handle edit mode
  const handleEditEmployee = () => {
    setIsEditing(true);
  };
  
  // Handle closing forms/details
  const handleClose = () => {
    setShowAddForm(false);
    setSelectedEmployee(null);
    setIsEditing(false);
  };

  // If user doesn't have permission, show access denied
  if (!canManageEmployees) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="text-center text-red-600">
          <i className="fas fa-exclamation-circle text-4xl mb-4"></i>
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p>Only HR and Admin users can access employee management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-6">
      {/* Notification Toast */}
      {notification.show && (
        <NotificationToast
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification({ ...notification, show: false })}
        />
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Employee Management</h1>
        
        {!showAddForm && !selectedEmployee && (
          <button 
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md flex items-center"
            onClick={() => setShowAddForm(true)}
          >
            <i className="fas fa-plus mr-2"></i>
            Add Employee
          </button>
        )}
        
        {(showAddForm || selectedEmployee) && (
          <button 
            className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md flex items-center"
            onClick={handleClose}
          >
            <i className="fas fa-arrow-left mr-2"></i>
            Back to List
          </button>
        )}
      </div>
      
      {loading && !showAddForm && !selectedEmployee && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {/* Show employee list if not adding or viewing details */}
      {!showAddForm && !selectedEmployee && !loading && (
        <EmployeeList 
          employees={employees} 
          onSelectEmployee={handleSelectEmployee} 
        />
      )}
      
      {/* Show add form */}
      {showAddForm && (
        <EmployeeForm 
          onSubmit={handleAddEmployee} 
          loading={loading} 
        />
      )}
      
      {/* Show employee details or edit form */}
      {selectedEmployee && !showAddForm && (
        isEditing ? (
          <EmployeeForm 
            employee={selectedEmployee} 
            isEditing={true} 
            onSubmit={(data) => handleUpdateEmployee(selectedEmployee._id, data)} 
            loading={loading} 
          />
        ) : (
          <EmployeeDetails 
            employee={selectedEmployee} 
            onEdit={handleEditEmployee} 
          />
        )
      )}
    </div>
  );
};

export default EmployeeManagement;
