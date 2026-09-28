/**
 * HR Module Constants
 */

// API Base URL
export const API_BASE_URL = 'https://cubehis.avopay.pro:5000';

// Leave Types
export const LEAVE_TYPES = [
  { value: 'casual', label: 'Casual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'annual', label: 'Annual Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' },
  { value: 'other', label: 'Other' }
];

// Leave Status
export const LEAVE_STATUS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' }
];

// Employee Status
export const EMPLOYEE_STATUS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'terminated', label: 'Terminated' }
];

// Departments
export const DEPARTMENTS = [
  { value: 'sales', label: 'Sales' },
  { value: 'admin', label: 'Admin' },
  { value: 'management', label: 'Management' },
  { value: 'operations', label: 'Operations' },
  { value: 'it', label: 'IT' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'HR' }
];

// Roles
export const ROLES = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr', label: 'HR' },
  { value: 'admin', label: 'Admin' }
];

// Document Types
export const DOCUMENT_TYPES = [
  { value: 'id_proof', label: 'ID Proof' },
  { value: 'address_proof', label: 'Address Proof' },
  { value: 'resume', label: 'Resume/CV' },
  { value: 'qualification', label: 'Educational Qualification' },
  { value: 'experience', label: 'Experience Certificate' },
  { value: 'bank_details', label: 'Bank Details' },
  { value: 'other', label: 'Other Document' }
];

// Attendance Status
export const ATTENDANCE_STATUS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'leave', label: 'On Leave' },
  { value: 'late', label: 'Late' },
  { value: 'half_day', label: 'Half Day' }
];

// Department Names as strings (for systems that need simple string arrays)
export const DEPARTMENT_NAMES = [
  'Engineering',
  'Sales',
  'Marketing',
  'HR',
  'Finance',
  'Operations',
  'Customer Support',
  'IT',
  'Administration',
  'Legal'
];

// Default export for systems that prefer it
export default {
  API_BASE_URL,
  LEAVE_TYPES,
  LEAVE_STATUS,
  ATTENDANCE_STATUS,
  DEPARTMENTS,
  DEPARTMENT_NAMES,
  EMPLOYEE_STATUS,
  ROLES,
  DOCUMENT_TYPES
};
