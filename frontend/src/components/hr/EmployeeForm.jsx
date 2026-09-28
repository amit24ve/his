import React, { useState, useEffect } from 'react';
import { fetchCities, fetchStateByPincode } from '../../utils/addressUtils';
import { DEPARTMENTS, ROLES } from '../../utils/hrConstants';

const EmployeeForm = ({ employee = null, isEditing = false, onSubmit, loading }) => {
  const [formData, setFormData] = useState({
    // Personal Info
    name: '',
    dob: '',
    email: '',
    phone: '',
    gender: '',
    
    // Address
    address: '',
    pincode: '',
    city: '',
    state: '',
    country: 'India',
    
    // Job Details
    position: '',
    department: 'sales',
    doj: new Date().toISOString().split('T')[0],
    salary: '',
    location: '',
    shift: '9am - 6pm',
    employee_type: 'full_time',
    
    // Reporting Structure
    reports_to: '',
    
    // Emergency Contacts
    emergency_contact_name: '',
    emergency_contact_phone: '',
    
    // Banking Details
    bank_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    
    // Login Credentials
    role: 'employee',
    role_ids: [],
    roles: [],
    user_id: '',
    username: '',
    password: '',
    use_generated_password: true
  });
  
  const [cities, setCities] = useState([]);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [generatedUserId, setGeneratedUserId] = useState('');
  
  // Positions data
  const positions = {
    'sales': ['Sales Executive', 'Sales Manager', 'Sales Representative', 'Business Development'],
    'admin': ['Administrative Assistant', 'Office Manager', 'Executive Assistant'],
    'management': ['General Manager', 'CEO', 'COO', 'Department Head'],
    'operations': ['Operations Manager', 'Operations Executive', 'Logistics Coordinator'],
    'it': ['Developer', 'System Administrator', 'IT Support', 'Network Engineer'],
    'finance': ['Accountant', 'Finance Manager', 'Financial Analyst'],
    'hr': ['HR Executive', 'HR Manager', 'Recruiter', 'Training Coordinator']
  };

  // Initialize form with employee data if editing
  useEffect(() => {
    if (isEditing && employee) {
      // Log employee data for debugging
      console.log('Employee data for editing:', employee);
      
      setFormData({
        // Personal Info
        name: getNestedValue(employee, ['name', 'full_name', 'fullName'], ''),
        dob: getNestedValue(employee, ['dob', 'date_of_birth', 'dateOfBirth', 'birth_date'], ''),
        email: getNestedValue(employee, ['email', 'emailAddress', 'email_address'], ''),
        phone: getNestedValue(employee, ['phone', 'mobile', 'phoneNumber', 'phone_number', 'contact'], ''),
        gender: getNestedValue(employee, ['gender', 'sex'], ''),
        
        // Address
        address: getNestedValue(employee, ['address', 'streetAddress', 'street_address'], ''),
        pincode: getNestedValue(employee, ['pincode', 'zip_code', 'zipCode', 'postal_code', 'postalCode'], ''),
        city: getNestedValue(employee, ['city', 'town'], ''),
        state: getNestedValue(employee, ['state', 'province'], ''),
        country: getNestedValue(employee, ['country', 'nation'], 'India'),
        
        // Job Details
        position: getNestedValue(employee, ['position', 'designation', 'title', 'job_title', 'jobTitle'], ''),
        department: getNestedValue(employee, ['department', 'dept', 'team'], 'Sales'),
        doj: getNestedValue(employee, ['joining_date', 'date_of_joining', 'joiningDate', 'dateOfJoining', 'doj', 'start_date', 'startDate'], ''),
        salary: getNestedValue(employee, ['salary', 'base_salary', 'baseSalary', 'compensation'], ''),
        location: getNestedValue(employee, ['location', 'work_location', 'workLocation', 'office', 'branch'], ''),
        shift: getNestedValue(employee, ['shift', 'workHours', 'work_hours'], '9am - 6pm'),
        employee_type: getNestedValue(employee, ['employee_type', 'employment_type', 'employeeType', 'employmentType', 'contract_type'], 'full_time'),
        
        // Reporting Structure
        reports_to: getNestedValue(employee, ['reports_to', 'reportsTo', 'manager', 'supervisor', 'managerId', 'manager_id'], ''),
        
        // Emergency Contacts
        emergency_contact_name: getNestedValue(employee, ['emergency_contact_name', 'emergency_contact.name', 'emergencyContact.name', 'emergencyContactName'], ''),
        emergency_contact_phone: getNestedValue(employee, ['emergency_contact_phone', 'emergency_contact.phone', 'emergencyContact.phone', 'emergencyContactPhone', 'emergency_phone'], ''),
        
        // Banking Details
        bank_name: getNestedValue(employee, ['bank_name', 'bank_details.bank_name', 'bankDetails.bankName', 'bankName'], ''),
        bank_account_number: getNestedValue(employee, ['bank_account_number', 'bank_details.account_number', 'bankDetails.accountNumber', 'account_number', 'accountNumber'], ''),
        bank_ifsc: getNestedValue(employee, ['bank_ifsc', 'bank_details.ifsc', 'bankDetails.ifsc', 'ifsc_code', 'ifscCode'], ''),
        
        // Login Credentials
        role: getNestedValue(employee, ['role', 'user_role', 'userRole'], 'employee'),
        role_ids: getNestedValue(employee, ['role_ids', 'roleIds', 'roles_ids'], []),
        roles: getNestedValue(employee, ['roles', 'userRoles'], []) || [getNestedValue(employee, ['role', 'user_role'], 'employee')],
        user_id: getNestedValue(employee, ['user_id', 'employee_id', 'emp_id', 'id', 'employeeId'], ''),
        username: getNestedValue(employee, ['username', 'user_name', 'userName', 'login'], ''),
        password: '',
        use_generated_password: false
      });
    } else {
      // Generate ID for new employee
      generateUserId();
    }
  }, [isEditing, employee]);

  // Generate username when name changes
  useEffect(() => {
    if (!isEditing && formData.name) {
      generateUsername(formData.name);
    }
  }, [formData.name, isEditing]);

  // Fetch cities and state when pincode changes
  useEffect(() => {
    const handlePincodeChange = async () => {
      if (formData.pincode && formData.pincode.length === 6) {
        setPincodeLoading(true);
        try {
          // Get state from pincode
          const stateResult = await fetchStateByPincode(formData.pincode);
          if (stateResult && stateResult.state) {
            setFormData(prev => ({
              ...prev,
              state: stateResult.state
            }));
            
            // Get cities for the state
            const citiesResult = await fetchCities(stateResult.state);
            if (citiesResult && Array.isArray(citiesResult)) {
              setCities(citiesResult);
            }
          }
        } catch (error) {
          console.error('Error fetching location data:', error);
        } finally {
          setPincodeLoading(false);
        }
      }
    };
    
    handlePincodeChange();
  }, [formData.pincode]);

  // Generate a 3-digit user ID
  const generateUserId = () => {
    const id = Math.floor(100 + Math.random() * 900).toString();
    setGeneratedUserId(id);
    setFormData(prev => ({
      ...prev,
      user_id: id
    }));
  };

  // Generate username from name (lowercase, no spaces)
  const generateUsername = (name) => {
    if (!name) return;
    
    const username = name.toLowerCase().replace(/\s+/g, '');
    setFormData(prev => ({
      ...prev,
      username
    }));
  };

  // Generate random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(password);
    setFormData(prev => ({
      ...prev,
      password,
      use_generated_password: true
    }));
  };
  
  // Enhanced helper function to safely get a value from possibly nested object structure and handle multiple field naming variations
  const getNestedValue = (obj, path, defaultValue = '') => {
    if (!obj) return defaultValue;
    
    // If path is an array, try each path in order
    if (Array.isArray(path)) {
      for (let p of path) {
        const value = getNestedValue(obj, p);
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      }
      return defaultValue;
    }
    
    // Handle direct properties
    if (obj[path] !== undefined && obj[path] !== null) return obj[path];
    
    // Handle dot notation paths for nested objects
    const parts = path.split('.');
    let current = obj;
    
    for (let part of parts) {
      if (current[part] === undefined || current[part] === null) {
        return defaultValue;
      }
      current = current[part];
    }
    
    return current;
  };

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Special handling for checkbox
    if (type === 'checkbox') {
      setFormData({
        ...formData,
        [name]: checked
      });
      
      // If turning on generated password, generate one
      if (name === 'use_generated_password' && checked) {
        generatePassword();
      }
      return;
    }
    
    // Special handling for department (to update available positions)
    if (name === 'department') {
      setFormData({
        ...formData,
        [name]: value,
        position: '' // Reset position when department changes
      });
      return;
    }
    
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // Field validations
  const [errors, setErrors] = useState({});
  
  // Validate all fields
  const validateForm = () => {
    const newErrors = {};
    
    // Required fields
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.phone) newErrors.phone = 'Phone number is required';
    
    // Email format
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Valid email address is required';
    }
    
    // Phone format (at least 10 digits)
    if (formData.phone && !/^\d{10,15}$/.test(formData.phone.replace(/[^0-9]/g, ''))) {
      newErrors.phone = 'Valid phone number is required (10-15 digits)';
    }
    
    // Department and position
    if (!formData.department) newErrors.department = 'Department is required';
    if (!formData.position) newErrors.position = 'Position is required';
    
    // Credentials
    if (!isEditing) {
      if (!formData.user_id) newErrors.user_id = 'Employee ID is required';
      if (!formData.username) newErrors.username = 'Username is required';
      if (!formData.password) newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      // Scroll to the first error
      const firstError = document.querySelector('.error-message');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    
    // Log the validation passed
    console.log('Form validation passed, proceeding with submission');
    
    // Format data for submission
    let formattedData = {
      ...formData,
      // API requires name instead of full_name
      name: formData.name,
      full_name: formData.name,
      
      // Map frontend fields to expected backend fields
      date_of_joining: formData.doj,
      date_of_birth: formData.dob,
      zip_code: formData.pincode,
      
      // Add position field as role for backward compatibility
      position: formData.position,
      designation: formData.position,
      
      // Make sure emergency contact fields are passed directly
      emergency_contact_name: formData.emergency_contact_name,
      emergency_contact_phone: formData.emergency_contact_phone,
      
      // Make sure bank details are passed directly
      bank_account_number: formData.bank_account_number,
      bank_name: formData.bank_name,
      bank_ifsc: formData.bank_ifsc,
      
      // Also include these fields in the nested format for backward compatibility
      emergency_contact: {
        name: formData.emergency_contact_name,
        phone: formData.emergency_contact_phone
      },
      bank_details: {
        bank_name: formData.bank_name,
        account_number: formData.bank_account_number,
        ifsc: formData.bank_ifsc
      }
    };
    
    // Handle role fields - ensure both role fields are set correctly
    if (typeof formData.role === 'string' && !formData.roles.includes(formData.role)) {
      formattedData.roles = [...formData.roles, formData.role];
    }
    
    // If using generated password and editing, don't send password
    if (isEditing && !formData.password) {
      delete formattedData.password;
    }
    
    // Make sure is_active field is included
    formattedData.is_active = true;
    
    // Log the formatted data for debugging
    console.log('Original form data:', formData);
    console.log('Submitting employee data:', formattedData);
    
    // Add field version tracking for debugging API issues
    formattedData._form_version = "1.2";
    
    onSubmit(formattedData);
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">
        {isEditing ? 'Edit Employee' : 'Add New Employee'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Personal Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                type="text"
                name="name"
                className={`w-full px-3 py-2 border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                value={formData.name}
                onChange={handleChange}
              />
              {errors.name && <p className="mt-1 text-xs text-red-500 error-message">{errors.name}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input
                type="date"
                name="dob"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.dob}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <input
                type="email"
                name="email"
                className={`w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                value={formData.email}
                onChange={handleChange}
              />
              {errors.email && <p className="mt-1 text-xs text-red-500 error-message">{errors.email}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                name="phone"
                className={`w-full px-3 py-2 border ${errors.phone ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                value={formData.phone}
                onChange={handleChange}
              />
              {errors.phone && <p className="mt-1 text-xs text-red-500 error-message">{errors.phone}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                name="gender"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.gender}
                onChange={handleChange}
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Address Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-4">Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                name="address"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.address}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
              <input
                type="text"
                name="pincode"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.pincode}
                onChange={handleChange}
                maxLength={6}
              />
              {pincodeLoading && <p className="text-xs text-blue-600 mt-1">Loading location data...</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <select
                name="city"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.city}
                onChange={handleChange}
              >
                <option value="">Select City</option>
                {cities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                name="country"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.country}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                name="state"
                className="w-full px-3 py-2 border border-gray-300 bg-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.state}
                onChange={handleChange}
                readOnly
              />
            </div>
          </div>
        </div>
        
        {/* Job Details */}
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-4">Job Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                name="department"
                className={`w-full px-3 py-2 border ${errors.department ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                value={formData.department}
                onChange={handleChange}
              >
                <option value="">Select Department</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept.value} value={dept.value}>{dept.label}</option>
                ))}
              </select>
              {errors.department && <p className="mt-1 text-xs text-red-500 error-message">{errors.department}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Position/Title</label>
              <div className="flex">
                <select
                  name="position"
                  className={`w-full px-3 py-2 border ${errors.position ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                  value={positions[formData.department]?.includes(formData.position) ? formData.position : ''}
                  onChange={handleChange}
                >
                  <option value="">Select Position</option>
                  {positions[formData.department]?.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
              {formData.position && !positions[formData.department]?.includes(formData.position) && (
                <p className="text-xs text-amber-600 mt-1">
                  Using custom position: {formData.position}
                </p>
              )}
              {errors.position && <p className="mt-1 text-xs text-red-500 error-message">{errors.position}</p>}
              <div className="mt-2">
                <input
                  type="text"
                  name="position"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={!positions[formData.department]?.includes(formData.position) ? formData.position : ''}
                  onChange={handleChange}
                  placeholder="Or type custom position title here"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining</label>
              <input
                type="date"
                name="doj"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.doj}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salary</label>
              <input
                type="number"
                name="salary"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.salary}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                name="location"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.location}
                onChange={handleChange}
                placeholder="Work location/branch"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
              <select
                name="shift"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.shift}
                onChange={handleChange}
              >
                <option value="9am - 6pm">9:00 AM - 6:00 PM</option>
                <option value="8am - 5pm">8:00 AM - 5:00 PM</option>
                <option value="10am - 7pm">10:00 AM - 7:00 PM</option>
                <option value="night">Night Shift</option>
                <option value="flexible">Flexible Hours</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
              <select
                name="employee_type"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.employee_type}
                onChange={handleChange}
              >
                <option value="full_time">Full-Time</option>
                <option value="part_time">Part-Time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
                <option value="probation">Probation</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reports To</label>
              <input
                type="text"
                name="reports_to"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.reports_to}
                onChange={handleChange}
                placeholder="Manager's User ID"
              />
            </div>
          </div>
        </div>
        
        {/* Login Credentials */}
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-4">Login Credentials</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">System Role</label>
              <select
                name="role"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.role}
                onChange={handleChange}
              >
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">System access role (separate from job position)</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
              <div className="flex">
                <input
                  type="text"
                  name="user_id"
                  className={`w-full px-3 py-2 border ${errors.user_id ? 'border-red-500' : 'border-gray-300'} rounded-l-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                  value={formData.user_id}
                  onChange={handleChange}
                  maxLength={3}
                  readOnly={!isEditing}
                />
                {!isEditing && (
                  <button
                    type="button"
                    className="bg-gray-200 px-3 rounded-r-md border border-l-0 border-gray-300 hover:bg-gray-300"
                    onClick={generateUserId}
                  >
                    <i className="fas fa-sync-alt"></i>
                  </button>
                )}
              </div>
              {errors.user_id ? (
                <p className="mt-1 text-xs text-red-500 error-message">{errors.user_id}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">3-digit auto-generated ID</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                name="username"
                className={`w-full px-3 py-2 border ${errors.username ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                value={formData.username}
                onChange={handleChange}
                readOnly={!isEditing}
              />
              {errors.username ? (
                <p className="mt-1 text-xs text-red-500 error-message">{errors.username}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Auto-generated from name</p>
              )}
            </div>
            
            {!isEditing || (isEditing && formData.password) ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="flex">
                  <input
                    type="text"
                    name="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={formData.password}
                    onChange={handleChange}
                    readOnly={formData.use_generated_password}
                  />
                  <button
                    type="button"
                    className="bg-gray-200 px-3 rounded-r-md border border-l-0 border-gray-300 hover:bg-gray-300"
                    onClick={generatePassword}
                  >
                    <i className="fas fa-sync-alt"></i>
                  </button>
                </div>
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    id="use_generated_password"
                    name="use_generated_password"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={formData.use_generated_password}
                    onChange={handleChange}
                  />
                  <label htmlFor="use_generated_password" className="ml-2 block text-sm text-gray-700">
                    Use auto-generated password
                  </label>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    id="change_password"
                    name="change_password"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    onChange={(e) => {
                      if (e.target.checked) {
                        generatePassword();
                      } else {
                        setFormData({
                          ...formData,
                          password: '',
                          use_generated_password: false
                        });
                      }
                    }}
                  />
                  <label htmlFor="change_password" className="ml-2 block text-sm text-gray-700">
                    Change password
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Emergency Contact */}
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-4">Emergency Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
              <input
                type="text"
                name="emergency_contact_name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.emergency_contact_name}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Phone</label>
              <input
                type="text"
                name="emergency_contact_phone"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.emergency_contact_phone}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
        
        {/* Banking Details */}
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-4">Banking Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
              <input
                type="text"
                name="bank_name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.bank_name}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
              <input
                type="text"
                name="bank_account_number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.bank_account_number}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
              <input
                type="text"
                name="bank_ifsc"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.bank_ifsc}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
        
        {/* Submit buttons */}
        <div className="flex justify-end space-x-3">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md shadow-sm"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              isEditing ? 'Update Employee' : 'Add Employee'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmployeeForm;
