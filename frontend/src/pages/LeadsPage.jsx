import React, { useEffect } from 'react';
import LeadManagement from '../components/leads/LeadManagement';

const LeadsPage = () => {
  // Update page title when component mounts
  useEffect(() => {
    document.title = 'B2B CRM - Lead Management';
  }, []);

  return (
    <div>
      {/* Render the Lead Management Component */}
      <LeadManagement />
    </div>
  );
};

export default LeadsPage;