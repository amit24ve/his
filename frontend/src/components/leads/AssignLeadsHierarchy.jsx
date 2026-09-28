import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Base URL for your backend API
const API_BASE_URL = 'https://cubehis.avopay.pro:5000/api/lead';
const USERS_API_URL = 'https://cubehis.avopay.pro:5000/api/users';

const AssignLeadsHierarchy = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [subordinates, setSubordinates] = useState([]);
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const LEADS_PER_PAGE = 10;
  const navigate = useNavigate();

  // Get auth token
  const authToken = localStorage.getItem('token') || localStorage.getItem('access_token');

  // Get current user info from token
  const getCurrentUserFromToken = () => {
    try {
      if (!authToken) return null;

      const payload = JSON.parse(atob(authToken.split('.')[1]));
      return {
        id: payload.user_id || payload.sub,
        username: payload.username || payload.preferred_username,
        email: payload.email,
        roles: payload.roles || []
      };
    } catch (error) {
      console.error('Error parsing token:', error);
      return null;
    }
  };

  // Fetch current user details and subordinates
  const fetchUserHierarchy = async () => {
    try {
      setLoading(true);
      const userFromToken = getCurrentUserFromToken();

      if (!userFromToken) {
        setError('Unable to get user information');
        return;
      }

      setCurrentUser(userFromToken);

      // Get subordinates for current user using the new API
      const subordinatesRes = await axios.get(`${API_BASE_URL.replace('/api/lead', '')}/api/assigned-leads/assignable-users/${userFromToken.id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const subordinatesData = subordinatesRes.data.users || [];
      setSubordinates(subordinatesData);
      console.log(`Found ${subordinatesData.length} subordinates`);

    } catch (err) {
      console.error('Error fetching user hierarchy:', err);
      setError('Failed to fetch user hierarchy');
      setSubordinates([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch leads
  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError(null);

      const userFromToken = getCurrentUserFromToken();
      if (!userFromToken) {
        setError('Unable to get user information');
        return;
      }

      const response = await axios.get(`${API_BASE_URL.replace('/api/lead', '')}/api/assigned-leads/leads`, {
        headers: { Authorization: `Bearer ${authToken}` },
        params: {
          page: currentPage,
          limit: LEADS_PER_PAGE,
          search: search || undefined,
          requester_user_id: userFromToken.id
        },
      });

      const leadsData = response.data.data.map(lead => ({
        id: lead._id,
        name: lead.name || 'Unnamed Lead',
        email: lead.email || '',
        phone: lead.phone || '',
        status: lead.status || 'new',
        assigned_to: lead.assigned_to || null,
        currentAssignment: lead.assigned_to || 'Unassigned'
      }));

      setLeads(leadsData);
      setTotalLeads(response.data.total || 0);
      setTotalPages(response.data.pages || 1);
    } catch (err) {
      console.error('Error fetching leads:', err);
      setError('Failed to fetch leads');
      setLeads([]);
      setTotalLeads(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on mount and when search or currentPage changes
  useEffect(() => {
    fetchUserHierarchy();
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [search, currentPage]);

  // Auto assign leads to direct subordinates only
  const autoAssignToSubordinates = async () => {
    try {
      setLoading(true);

      if (subordinates.length === 0) {
        setError('No subordinates available for assignment');
        return;
      }

      const userFromToken = getCurrentUserFromToken();
      if (!userFromToken) {
        setError('Unable to get user information');
        return;
      }

      // Use the hierarchy-aware auto-assign endpoint
      const response = await axios.post(
        `${API_BASE_URL.replace('/api/lead', '')}/api/assigned-leads/auto-assign`,
        {
          assigner_user_id: userFromToken.id
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (response.data.success) {
        console.log(`Auto-assigned ${response.data.assigned_count} leads to subordinates`);
        await fetchLeads(); // Refresh leads
        setError(null);
      } else {
        setError(response.data.message || 'Failed to auto-assign leads');
      }

    } catch (err) {
      setError('Failed to auto-assign leads');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Manual assign to subordinate
  const handleManualAssign = async (leadId, subordinateSelection) => {
    try {
      setLoading(true);

      if (!subordinateSelection || subordinateSelection === 'Unassigned') {
        setError('Please select a subordinate to assign the lead to');
        return;
      }

      const userFromToken = getCurrentUserFromToken();
      if (!userFromToken) {
        setError('Unable to get user information');
        return;
      }

      // Extract user_id from the selection (format: "Name (user_id)")
      const userIdMatch = subordinateSelection.match(/\(([^)]+)\)$/);
      const assignedToUserId = userIdMatch ? userIdMatch[1] : subordinateSelection;

      // Use the hierarchy-aware manual assign endpoint
      const response = await axios.post(
        `${API_BASE_URL.replace('/api/lead', '')}/api/assigned-leads/manual-assign`,
        {
          lead_ids: [leadId],
          assigned_to: assignedToUserId,
          assigner_user_id: userFromToken.id
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (response.data.success) {
        console.log(`Manually assigned lead ${leadId} to ${assignedToUserId}`);
        await fetchLeads(); // Refresh leads
        setError(null);
      } else {
        setError(response.data.message || 'Failed to assign lead');
      }

    } catch (err) {
      setError('Failed to assign lead');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Pagination handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Reset page when search changes
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  // Export leads to Excel
  const exportToExcel = () => {
    const exportData = leads.map(lead => ({
      Name: lead.name,
      Email: lead.email,
      Phone: lead.phone,
      Status: lead.status,
      'Assigned To': lead.currentAssignment,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lead Assignment');

    const timestamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `lead_assignments_${timestamp}.xlsx`);
  };

  const openDrawer = lead => {
    setSelectedLead(lead);
    setShowDrawer(true);
  };

  const closeDrawer = () => {
    setShowDrawer(false);
    setSelectedLead(null);
  };

  // Group subordinates by level for display
  const directSubordinates = subordinates; // All subordinates are now direct from the API
  const indirectSubordinates = []; // Not used in the new structure

  return (
    <div className="min-h-screen bg-gradient-to-tr from-blue-50 to-yellow-50 p-0 sm:p-6">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-4 sm:p-8 relative">
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-center py-3 px-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Header & Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 bg-gray-100 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-full shadow-sm hover:bg-gray-200 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-blue-800 tracking-tight">
            Hierarchical Lead Assignment
          </h1>
          <div className="text-sm text-gray-600">
            {currentUser && (
              <span>Logged in as: <strong>{currentUser.username}</strong></span>
            )}
          </div>
        </div>

        {/* Current User & Subordinates Info */}
        {currentUser && (
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">Your Team Hierarchy</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-blue-700 mb-1">Direct Reports ({directSubordinates.length})</h4>
                {directSubordinates.length > 0 ? (
                  <ul className="text-sm space-y-1">
                    {directSubordinates.slice(0, 5).map(sub => (
                      <li key={sub.user_id} className="text-blue-600">
                        • {sub.name} - {sub.role_name}
                      </li>
                    ))}
                    {directSubordinates.length > 5 && (
                      <li className="text-blue-500 italic">... and {directSubordinates.length - 5} more</li>
                    )}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm">No direct reports</p>
                )}
              </div>
              <div>
                <h4 className="font-medium text-blue-700 mb-1">Indirect Reports ({indirectSubordinates.length})</h4>
                {indirectSubordinates.length > 0 ? (
                  <ul className="text-sm space-y-1">
                    {indirectSubordinates.slice(0, 5).map(sub => (
                      <li key={sub.user_id} className="text-blue-600">
                        • {sub.name} - {sub.role_name}
                      </li>
                    ))}
                    {indirectSubordinates.length > 5 && (
                      <li className="text-blue-500 italic">... and {indirectSubordinates.length - 5} more</li>
                    )}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm">No indirect reports</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search + Export */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-6">
          <input
            type="text"
            aria-label="Search leads"
            placeholder="Search by name, email or phone..."
            value={search}
            onChange={handleSearchChange}
            className="border shadow-sm rounded px-4 py-2 w-full md:w-2/5 focus:ring-2 focus:ring-blue-200 transition"
          />
          <button
            onClick={exportToExcel}
            className="bg-yellow-500 text-white px-5 py-2 rounded-lg font-medium shadow hover:bg-yellow-600 transition"
          >
            Export to Excel
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-5">
          {subordinates.length > 0 && (
            <button
              onClick={autoAssignToSubordinates}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition"
              disabled={loading}
            >
              Auto Assign to Subordinates ({subordinates.length})
            </button>
          )}

          {subordinates.length === 0 && !loading && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded-lg">
              You have no subordinates. Only users with reports can assign leads.
            </div>
          )}
        </div>

        {/* Leads Table */}
        <div className="overflow-x-auto border rounded-lg shadow-sm">
          <table className="min-w-full text-sm text-left divide-y divide-gray-100">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Assigned To</th>
                {subordinates.length > 0 && (
                  <th className="px-4 py-3 font-semibold">Assign To Subordinate</th>
                )}
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id} className="border-t hover:bg-blue-50 transition group">
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-blue-900">
                    <span className="cursor-pointer hover:underline" onClick={() => openDrawer(lead)}>
                      {lead.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{lead.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{lead.phone}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${lead.status === 'new' ? 'bg-blue-100 text-blue-800' :
                      lead.status === 'contacted' ? 'bg-yellow-100 text-yellow-800' :
                        lead.status === 'qualified' ? 'bg-green-100 text-green-800' :
                          lead.status === 'converted' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                      }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-block text-gray-700 font-medium px-2 py-1 rounded bg-gray-100">
                      {lead.currentAssignment}
                    </span>
                  </td>
                  {subordinates.length > 0 && (
                    <td className="px-4 py-3">
                      <select
                        value=""
                        onChange={e => handleManualAssign(lead.id, e.target.value)}
                        className="border rounded px-2 py-1 w-full outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="">Select Subordinate</option>

                        {/* All subordinates (now direct from API) */}
                        {subordinates.length > 0 && (
                          <optgroup label="Assignable Users">
                            {subordinates.map(sub => (
                              <option key={sub.user_id} value={`${sub.name} (${sub.user_id})`}>
                                {sub.name} - {sub.role_name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </td>
                  )}
                  <td className="px-2 py-3 sm:hidden">
                    <button
                      className="text-blue-700 underline text-xs"
                      onClick={() => openDrawer(lead)}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && !loading && (
                <tr>
                  <td colSpan={subordinates.length > 0 ? 7 : 6} className="text-center py-8 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">📋</span>
                      <span>No leads available for assignment.</span>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={subordinates.length > 0 ? 7 : 6} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="text-gray-500">Loading leads...</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Total Leads and Pagination */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="text-sm text-gray-500 font-medium">
            Showing {totalLeads > 0 ? ((currentPage - 1) * LEADS_PER_PAGE) + 1 : 0} to {Math.min(currentPage * LEADS_PER_PAGE, totalLeads)} of {totalLeads} leads
          </span>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={handlePrevPage}
                disabled={currentPage <= 1 || loading}
                className={`px-4 py-2 rounded-lg border transition-colors ${currentPage <= 1 || loading
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }`}
              >
                Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={currentPage >= totalPages || loading}
                className={`px-4 py-2 rounded-lg border transition-colors ${currentPage >= totalPages || loading
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer for Lead Details */}
      {showDrawer && selectedLead && (
        <div className="fixed inset-0 z-40 bg-black/40 flex justify-end sm:hidden">
          <div className="w-11/12 max-w-xs bg-white rounded-l-2xl shadow-xl px-6 py-6 h-full flex flex-col">
            <button
              className="self-end text-gray-500 hover:text-red-500 text-2xl mb-2"
              onClick={closeDrawer}
              aria-label="Close lead details"
            >
              ×
            </button>
            <h2 className="text-lg font-bold text-blue-700 mb-4">Lead Details</h2>
            <div className="flex flex-col gap-2">
              <span>
                <span className="font-semibold">Name:</span> {selectedLead.name}
              </span>
              <span>
                <span className="font-semibold">Email:</span> {selectedLead.email}
              </span>
              <span>
                <span className="font-semibold">Phone:</span> {selectedLead.phone}
              </span>
              <span>
                <span className="font-semibold">Status:</span> {selectedLead.status}
              </span>
              <span>
                <span className="font-semibold">Assigned To:</span>{' '}
                {selectedLead.currentAssignment}
              </span>
            </div>
          </div>
          <div className="flex-1" onClick={closeDrawer}></div>
        </div>
      )}
    </div>
  );
};

export default AssignLeadsHierarchy;
