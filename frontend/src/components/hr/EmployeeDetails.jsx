import React, { useState, useEffect } from 'react';
import { fetchEmployeeLeads, fetchEmployeeDocuments } from '../../utils/hrAPI';
import DocumentUploader from '../common/DocumentUploader';
import { formatDate } from '../../utils/dateUtils';

const EmployeeDetails = ({ employee, onEdit }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [leads, setLeads] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadDetails, setLeadDetails] = useState(null);
  const [showUploader, setShowUploader] = useState(false);
  const [loading, setLoading] = useState({
    leads: false,
    documents: false,
    leadDetails: false
  });
  
  // Helper function to safely get field value from different possible property names
  const getField = (fieldOptions, defaultValue = 'Not set') => {
    console.log("Looking for field options:", fieldOptions, "in employee:", employee);
    
    if (!employee) return defaultValue;
    
    // If fieldOptions is a string, wrap it in an array
    const options = typeof fieldOptions === 'string' ? [fieldOptions] : fieldOptions;
    
    for (const option of options) {
      // Handle nested properties with dot notation
      if (option.includes('.')) {
        const parts = option.split('.');
        let value = employee;
        
        for (const part of parts) {
          if (!value || value[part] === undefined) {
            value = undefined;
            break;
          }
          value = value[part];
        }
        
        if (value !== undefined && value !== null && value !== '') 
          return value;
      } 
      // Handle direct properties
      else if (employee[option] !== undefined && employee[option] !== null && employee[option] !== '') {
        return employee[option];
      }
    }
    
    return defaultValue;
  };

  // Fetch employee leads
  useEffect(() => {
    const loadEmployeeLeads = async () => {
      if (activeTab !== 'leads') return;
      
      setLoading(prev => ({ ...prev, leads: true }));
      try {
        const employeeId = employee._id || employee.id || employee.user_id || employee.employee_id;
        const result = await fetchEmployeeLeads(employeeId);
        
        if (Array.isArray(result)) {
          setLeads(result);
        } else if (result && result.data && Array.isArray(result.data)) {
          setLeads(result.data);
        } else {
          console.error('Unexpected employee leads data format:', result);
          setLeads([]);
        }
      } catch (error) {
        console.error('Error loading employee leads:', error);
      } finally {
        setLoading(prev => ({ ...prev, leads: false }));
      }
    };
    
    loadEmployeeLeads();
  }, [employee, activeTab]);

  // Fetch employee documents
  useEffect(() => {
    const loadEmployeeDocuments = async () => {
      if (activeTab !== 'documents') return;
      
      setLoading(prev => ({ ...prev, documents: true }));
      try {
        const employeeId = employee._id || employee.id || employee.user_id || employee.employee_id;
        const result = await fetchEmployeeDocuments(employeeId);
        
        if (Array.isArray(result)) {
          setDocuments(result);
        } else if (result && result.data && Array.isArray(result.data)) {
          setDocuments(result.data);
        } else {
          console.error('Unexpected employee documents data format:', result);
          setDocuments([]);
        }
      } catch (error) {
        console.error('Error loading employee documents:', error);
      } finally {
        setLoading(prev => ({ ...prev, documents: false }));
      }
    };
    
    loadEmployeeDocuments();
  }, [employee, activeTab]);

  // Handle document upload
  const handleDocumentUpload = (newDocument) => {
    setDocuments(prev => [...prev, newDocument]);
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div className="flex items-center">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
            {employee.name ? employee.name.charAt(0).toUpperCase() : 'E'}
          </div>
          <div className="ml-4">
            <h2 className="text-xl font-semibold text-gray-900">{employee.name}</h2>
            <div className="flex flex-col sm:flex-row sm:items-center mt-1">
              <span className="text-sm text-gray-600">{employee.position || 'Position not set'}</span>
              <span className="hidden sm:block mx-2 text-gray-400">•</span>
              <span className="text-sm text-gray-600">{employee.department || 'Department not set'}</span>
              <span className="hidden sm:block mx-2 text-gray-400">•</span>
              <span className="text-sm text-gray-600">ID: {employee.user_id || employee.employee_id}</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={onEdit}
          className="mt-4 md:mt-0 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md flex items-center"
        >
          <i className="fas fa-edit mr-2"></i>
          Edit Profile
        </button>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
              activeTab === 'profile' 
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </button>
          <button
            className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
              activeTab === 'leads' 
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('leads')}
          >
            Leads
          </button>
          <button
            className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
              activeTab === 'documents' 
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('documents')}
          >
            Documents
          </button>
        </nav>
      </div>
      
      {/* Tab Content */}
      <div className="p-6">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-8">
            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">Personal Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Full Name</p>
                  <p className="mt-1">{getField(['name', 'full_name', 'fullName'])}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Date of Birth</p>
                  <p className="mt-1">{getField(['dob', 'date_of_birth', 'birthDate']) !== 'Not set' 
                    ? formatDate(getField(['dob', 'date_of_birth', 'birthDate'])) 
                    : 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Email Address</p>
                  <p className="mt-1">{getField('email')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone Number</p>
                  <p className="mt-1">{getField(['phone', 'mobile', 'phoneNumber', 'phone_number'])}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Gender</p>
                  <p className="mt-1 capitalize">{getField('gender')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Employee Type</p>
                  <p className="mt-1 capitalize">{getField(['employee_type', 'employeeType'])?.replace('_', ' ')}</p>
                </div>
              </div>
            </div>
            
            {/* Address Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">Address</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium text-gray-500">Street Address</p>
                  <p className="mt-1">{getField(['address', 'streetAddress', 'street_address'])}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Pincode</p>
                  <p className="mt-1">{getField(['pincode', 'zip_code', 'zipCode', 'postal_code'])}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">City</p>
                  <p className="mt-1">{getField(['city', 'town'])}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">State</p>
                  <p className="mt-1">{getField(['state', 'province', 'region'])}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Country</p>
                  <p className="mt-1">{getField(['country', 'nation'], 'India')}</p>
                </div>
              </div>
            </div>
            
            {/* Job Details */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">Job Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Department</p>
                  <p className="mt-1">{getField(['department', 'dept', 'division'])}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Position</p>
                  <p className="mt-1">{getField(['position', 'designation', 'title', 'jobTitle'])}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Employee Type</p>
                  <p className="mt-1 capitalize">{getField(['employee_type', 'employeeType'])?.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Date of Joining</p>
                  <p className="mt-1">{getField(['date_of_joining', 'joining_date', 'doj', 'joinDate']) !== 'Not set' 
                    ? formatDate(getField(['date_of_joining', 'joining_date', 'doj', 'joinDate'])) 
                    : 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Salary</p>
                  <p className="mt-1">
                    {getField('salary') !== 'Not set' 
                      ? `₹${Number(getField('salary')).toLocaleString()}`
                      : 'Not set'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Location</p>
                  <p className="mt-1">{getField(['location', 'office', 'work_location'])}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Shift</p>
                  <p className="mt-1">{getField(['shift', 'workHours', 'work_hours'])}</p>
                </div>
              </div>
            </div>
            
            {/* Emergency Contact */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">Emergency Contact</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Name</p>
                  <p className="mt-1">{getField(['emergency_contact_name', 'emergency_contact.name', 'emergencyContact.name'])}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="mt-1">{getField(['emergency_contact_phone', 'emergency_contact.phone', 'emergencyContact.phone', 'emergency_phone'])}</p>
                </div>
              </div>
            </div>
            
            {/* Bank Details */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">Bank Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Bank Name</p>
                  <p className="mt-1">{getField(['bank_name', 'bank_details.bank_name', 'bankDetails.bankName'])}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Account Number</p>
                  <p className="mt-1">{getField(['bank_account_number', 'bank_details.account_number', 'bankDetails.accountNumber', 'account_number'])}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">IFSC Code</p>
                  <p className="mt-1">{getField(['bank_ifsc', 'bank_details.ifsc', 'bankDetails.ifsc', 'ifsc_code'])}</p>
                </div>
              </div>
            </div>
            
            {/* Login Details */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">Login Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Employee ID</p>
                  <p className="mt-1">{getField(['user_id', 'employee_id', 'emp_id', 'id'])}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Username</p>
                  <p className="mt-1">{getField(['username', 'userName', 'user_name'])}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Role</p>
                  <p className="mt-1 capitalize">{getField(['role', 'user_role', 'userRole'], 'employee')}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Leads Tab */}
        {activeTab === 'leads' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-700">Assigned Leads</h3>
            </div>
            
            {loading.leads ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : leads.length === 0 ? (
              <div className="bg-gray-50 p-6 text-center rounded-md">
                <p className="text-gray-500">No leads assigned to this employee yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Assigned</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leads.map((lead) => (
                      <tr key={lead._id || lead.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{lead.lead_id}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{lead.name || lead.customer_name}</div>
                          <div className="text-xs text-gray-500">{lead.phone || lead.contact}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${lead.status === 'active' ? 'bg-green-100 text-green-800' : 
                              lead.status === 'closed' ? 'bg-red-100 text-red-800' : 
                              lead.status === 'converted' ? 'bg-blue-100 text-blue-800' : 
                              'bg-yellow-100 text-yellow-800'}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(lead.assigned_date || lead.date_assigned || lead.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {lead.source || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        
        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-700">Employee Documents</h3>
              <button
                onClick={() => setShowUploader(!showUploader)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md flex items-center"
              >
                <i className="fas fa-plus mr-2"></i>
                Upload Document
              </button>
            </div>
            
            {/* Document Uploader - Show/Hide */}
            {showUploader && (
              <div className="bg-blue-50 p-4 rounded-md mb-6 border border-blue-200">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-medium text-blue-800">Upload New Document</h4>
                  <button
                    onClick={() => setShowUploader(false)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <DocumentUploader 
                  employeeId={employee._id || employee.id || employee.user_id || employee.employee_id}
                  onUploadComplete={(newDocument) => {
                    handleDocumentUpload(newDocument);
                    setShowUploader(false);
                  }}
                />
              </div>
            )}
            
            {/* Documents List */}
            {loading.documents ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : documents.length === 0 ? (
              <div className="bg-gray-50 p-6 text-center rounded-md">
                <p className="text-gray-500">No documents uploaded for this employee yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((document) => (
                  <div key={document._id || document.id} className="border rounded-md overflow-hidden bg-white">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-lg text-blue-600">
                          <i className={`fas ${document.file_type === 'pdf' ? 'fa-file-pdf' : 
                                          document.file_type === 'image' ? 'fa-file-image' : 
                                          document.file_type === 'doc' ? 'fa-file-word' : 
                                          'fa-file'}`}></i>
                        </div>
                        <div className="text-xs text-gray-500">{formatDate(document.uploaded_date || document.created_at)}</div>
                      </div>
                      <h3 className="text-sm font-medium mt-2">{document.name || document.title || document.file_name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{document.description || 'No description'}</p>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 border-t flex justify-end">
                      <a 
                        href={document.file_url || document.url || `#`} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        View Document
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDetails;
