import React, { useState } from 'react';
import { uploadDocument } from '../../utils/hrAPI';
import { DOCUMENT_TYPES } from '../../utils/hrConstants';

const DocumentUploader = ({ employeeId, currentUser, onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [documentType, setDocumentType] = useState('id_proof');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    
    if (!employeeId) {
      setError('Employee ID is required');
      return;
    }
    
    setUploading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', documentType);
      formData.append('document_name', file.name);
      formData.append('description', description || `${documentType} document uploaded by HR staff`);
      formData.append('employee_id_form', employeeId); // Additional field expected by backend
      formData.append('uploaded_by', currentUser?.username || currentUser?.user_id || 'hr_staff'); // Required by backend
      
      // Debug logging
      console.log('Uploading document with data:', {
        employeeId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        documentType,
        description: description || `${documentType} document uploaded by HR staff`,
        uploadedBy: currentUser?.username || currentUser?.user_id || 'hr_staff'
      });
      
      // Validate file size (max 10MB)
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxFileSize) {
        setError('File size must be less than 10MB');
        setUploading(false);
        return;
      }
      
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'text/plain'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        console.warn('File type not in allowed list:', file.type);
        // Don't block upload, just warn
      }
      
      const result = await uploadDocument(employeeId, formData);
      
      // Reset form
      setFile(null);
      setDescription('');
      setDocumentType('id_proof');
      
      // Callback with uploaded document
      onUploadComplete(result);
    } catch (error) {
      console.error('Error uploading document:', error);
      
      // More specific error messages
      if (error.message.includes('422')) {
        setError('Invalid data sent to server. Please check the file and try again.');
      } else if (error.message.includes('403')) {
        setError('You do not have permission to upload documents for this employee.');
      } else if (error.message.includes('401')) {
        setError('Please log in again to upload documents.');
      } else if (error.message.includes('404')) {
        setError('Employee not found. Please refresh the page and try again.');
      } else if (error.message.includes('413')) {
        setError('File is too large. Please choose a smaller file.');
      } else {
        setError(`Failed to upload document: ${error.message}`);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Document Type</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            required
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Description (Optional)</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="Brief description of the document"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
      
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Select File</label>
        <div className="flex items-center">
          <label className="flex-1">
            <div className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
              <span className="flex items-center justify-center">
                <i className="fas fa-upload mr-2"></i>
                {file ? file.name : 'Choose file...'}
              </span>
              <input
                type="file"
                className="sr-only"
                onChange={handleFileChange}
                required
              />
            </div>
          </label>
          <button
            type="submit"
            className="ml-3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md shadow-sm disabled:opacity-50"
            disabled={uploading || !file}
          >
            {uploading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              </span>
            ) : 'Upload'}
          </button>
        </div>
        
        {error && (
          <p className="text-xs text-red-600 mt-1">{error}</p>
        )}
        
        {file && (
          <div className="text-xs text-gray-500 mt-1">
            File size: {(file.size / 1024).toFixed(2)} KB
          </div>
        )}
      </div>
    </form>
  );
};

export default DocumentUploader;
