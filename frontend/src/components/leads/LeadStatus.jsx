import React from 'react';

const LeadStatus = ({ status }) => {
  // Function to get the appropriate CSS class based on status
  const getStatusClass = (status) => {
    switch (status.toLowerCase()) {
      case 'new':
        return 'status-new';
      case 'contacted':
        return 'status-contacted';
      case 'qualified':
        return 'status-qualified';
      case 'proposal':
        return 'status-proposal';
      case 'converted':
        return 'status-converted';
      case 'lost':
        return 'status-lost';
      default:
        return 'status-new'; // Default fallback
    }
  };

  // Format the status text to be capitalized
  const formatStatus = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  return (
    <span className={`lead-status ${getStatusClass(status)}`}>
      {formatStatus(status)}
    </span>
  );
};

export default LeadStatus;