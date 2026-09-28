import React, { useState, useEffect } from 'react';
import {
  User, Mail, Lock, Building, Phone, MapPin, Calendar,
  FileText, Save, X, Eye, EyeOff, UserPlus, Upload,
  AlertCircle, CheckCircle, Loader2
} from 'lucide-react';

const EmployeeCreateForm = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'India',
    department: '',
    position: '',
    role_ids: [],
    reporting_user_id: '',
    date_of_birth: '',
    date_of_joining: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    bank_account_number: '',
    bank_name: '',
    bank_ifsc: '',
    salary: '',
    employee_type: 'full_time', // full_time, part_time, contract, intern
    is_active: true,
    additional_info: {
      blood_group: '',
      aadhar_number: '',
      pan_number: '',
      passport_number: '',
      driving_license: '',
      qualification: '',
      experience_years: '',
      skills: '',
      languages: ''
    }
  });

  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const API_BASE = 'https://cubehis.avopay.pro:5000/api/employees';

  useEffect(() => {
    if (isOpen) {
      fetchRoles();
      fetchEmployees();
      fetchDepartments();
    }
  }, [isOpen]);

  useEffect(() => {
    // Auto-generate username based on full name
    if (formData.full_name) {
      const username = formData.full_name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      setFormData(prev => ({ ...prev, username }));
    }
  }, [formData.full_name]);

  const fetchRoles = async () => {
    try {
      const response = await fetch(`${API_BASE}/roles`);
      const data = await response.json();
      if (data.success) {
        setRoles(data.roles);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE}?active_only=true&limit=100`);
      const data = await response.json();
      if (data.success) {
        setEmployees(data.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch(`${API_BASE}/departments`);
      const data = await response.json();
      if (data.success) {
        setDepartments(data.departments);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.password.trim()) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.department.trim()) newErrors.department = 'Department is required';
    if (!formData.position.trim()) newErrors.position = 'Position is required';
    if (formData.role_ids.length === 0) newErrors.role_ids = 'At least one role is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess(data.data);
          handleClose();
        }, 1500);
      } else {
        setErrors({ submit: data.message || 'Failed to create employee' });
      }
    } catch (error) {
      setErrors({ submit: 'Failed to create employee. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      full_name: '',
      username: '',
      email: '',
      password: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      country: 'India',
      department: '',
      position: '',
      role_ids: [],
      reporting_user_id: '',
      date_of_birth: '',
      date_of_joining: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      bank_account_number: '',
      bank_name: '',
      bank_ifsc: '',
      salary: '',
      employee_type: 'full_time',
      is_active: true,
      additional_info: {
        blood_group: '',
        aadhar_number: '',
        pan_number: '',
        passport_number: '',
        driving_license: '',
        qualification: '',
        experience_years: '',
        skills: '',
        languages: ''
      }
    });
    setErrors({});
    setSuccess(false);
    onClose();
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.startsWith('additional_info.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        additional_info: {
          ...prev.additional_info,
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleRoleChange = (roleId) => {
    setFormData(prev => ({
      ...prev,
      role_ids: prev.role_ids.includes(roleId)
        ? prev.role_ids.filter(id => id !== roleId)
        : [...prev.role_ids, roleId]
    }));
  };

  const InputField = ({ label, name, type = 'text', required = false, placeholder, icon: Icon, ...props }) => (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-5 w-5 text-gray-400" />
          </div>
        )}
        <input
          type={type}
          name={name}
          value={name.includes('.') ? formData.additional_info[name.split('.')[1]] : formData[name]}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={`w-full ${Icon ? 'pl-10' : 'pl-3'} pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[name] ? 'border-red-300' : 'border-gray-300'
            }`}
          {...props}
        />
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
          </button>
        )}
      </div>
      {errors[name] && <p className="text-sm text-red-600">{errors[name]}</p>}
    </div>
  );

  const SelectField = ({ label, name, options, required = false, placeholder }) => (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        name={name}
        value={formData[name]}
        onChange={handleInputChange}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[name] ? 'border-red-300' : 'border-gray-300'
          }`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {errors[name] && <p className="text-sm text-red-600">{errors[name]}</p>}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserPlus className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Create New Employee</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {success && (
          <div className="p-4 bg-green-50 border-l-4 border-green-400">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="ml-2 text-sm text-green-700">Employee created successfully!</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Full Name"
                name="full_name"
                required
                placeholder="Enter full name"
                icon={User}
              />
              <InputField
                label="Username"
                name="username"
                placeholder="Auto-generated from name"
                icon={User}
                disabled
              />
              <InputField
                label="Email Address"
                name="email"
                type="email"
                required
                placeholder="Enter email address"
                icon={Mail}
              />
              <InputField
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter password"
                icon={Lock}
              />
              <InputField
                label="Phone Number"
                name="phone"
                required
                placeholder="Enter phone number"
                icon={Phone}
              />
              <InputField
                label="Date of Birth"
                name="date_of_birth"
                type="date"
                icon={Calendar}
              />
            </div>
          </div>

          {/* Work Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Work Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label="Department"
                name="department"
                required
                placeholder="Select department"
                options={departments.map(dept => ({ value: dept, label: dept }))}
              />
              <InputField
                label="Position"
                name="position"
                required
                placeholder="Enter position/job title"
                icon={Building}
              />
              <InputField
                label="Date of Joining"
                name="date_of_joining"
                type="date"
                icon={Calendar}
              />
              <SelectField
                label="Employee Type"
                name="employee_type"
                options={[
                  { value: 'full_time', label: 'Full Time' },
                  { value: 'part_time', label: 'Part Time' },
                  { value: 'contract', label: 'Contract' },
                  { value: 'intern', label: 'Intern' }
                ]}
              />
              <SelectField
                label="Reporting Manager"
                name="reporting_user_id"
                placeholder="Select reporting manager"
                options={employees.map(emp => ({ value: emp.user_id, label: emp.full_name }))}
              />
              <InputField
                label="Salary"
                name="salary"
                type="number"
                placeholder="Enter salary amount"
              />
            </div>
          </div>

          {/* Roles & Permissions */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Roles & Permissions</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Roles <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.role_ids.includes(role.id)}
                      onChange={() => handleRoleChange(role.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{role.name}</span>
                  </label>
                ))}
              </div>
              {errors.role_ids && <p className="text-sm text-red-600 mt-1">{errors.role_ids}</p>}
            </div>
          </div>

          {/* Address Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Address Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <InputField
                  label="Address"
                  name="address"
                  placeholder="Enter full address"
                  icon={MapPin}
                />
              </div>
              <InputField
                label="City"
                name="city"
                placeholder="Enter city"
              />
              <InputField
                label="State"
                name="state"
                placeholder="Enter state"
              />
              <InputField
                label="ZIP Code"
                name="zip_code"
                placeholder="Enter ZIP code"
              />
              <InputField
                label="Country"
                name="country"
                placeholder="Enter country"
              />
            </div>
          </div>

          {/* Emergency Contact */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Emergency Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Emergency Contact Name"
                name="emergency_contact_name"
                placeholder="Enter emergency contact name"
                icon={User}
              />
              <InputField
                label="Emergency Contact Phone"
                name="emergency_contact_phone"
                placeholder="Enter emergency contact phone"
                icon={Phone}
              />
            </div>
          </div>

          {/* Bank Details */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Bank Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Bank Account Number"
                name="bank_account_number"
                placeholder="Enter bank account number"
              />
              <InputField
                label="Bank Name"
                name="bank_name"
                placeholder="Enter bank name"
              />
              <InputField
                label="IFSC Code"
                name="bank_ifsc"
                placeholder="Enter IFSC code"
              />
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label="Blood Group"
                name="additional_info.blood_group"
                options={[
                  { value: 'A+', label: 'A+' },
                  { value: 'A-', label: 'A-' },
                  { value: 'B+', label: 'B+' },
                  { value: 'B-', label: 'B-' },
                  { value: 'AB+', label: 'AB+' },
                  { value: 'AB-', label: 'AB-' },
                  { value: 'O+', label: 'O+' },
                  { value: 'O-', label: 'O-' }
                ]}
              />
              <InputField
                label="Aadhar Number"
                name="additional_info.aadhar_number"
                placeholder="Enter Aadhar number"
              />
              <InputField
                label="PAN Number"
                name="additional_info.pan_number"
                placeholder="Enter PAN number"
              />
              <InputField
                label="Passport Number"
                name="additional_info.passport_number"
                placeholder="Enter passport number"
              />
              <InputField
                label="Driving License"
                name="additional_info.driving_license"
                placeholder="Enter driving license number"
              />
              <InputField
                label="Qualification"
                name="additional_info.qualification"
                placeholder="Enter highest qualification"
              />
              <InputField
                label="Experience (Years)"
                name="additional_info.experience_years"
                type="number"
                placeholder="Enter years of experience"
              />
              <InputField
                label="Skills"
                name="additional_info.skills"
                placeholder="Enter skills (comma separated)"
              />
              <InputField
                label="Languages Known"
                name="additional_info.languages"
                placeholder="Enter languages (comma separated)"
              />
            </div>
          </div>

          {/* Account Status */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Account Status</h3>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Active Employee</span>
            </label>
          </div>

          {errors.submit && (
            <div className="p-4 bg-red-50 border-l-4 border-red-400">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span className="ml-2 text-sm text-red-700">{errors.submit}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Create Employee</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeCreateForm;
