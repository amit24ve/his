import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Base URL for your backend API
const API_BASE_URL = 'https://cubehis.avopay.pro:5000/api/lead';

const ASSIGNMENT_STAGE = {
  TO_MANAGER: 'TO_MANAGER',
  TO_EXECUTIVE: 'TO_EXECUTIVE',
};

const AssignLeads = () => {
  const [managers, setManagers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [role, setRole] = useState('admin'); // Assume user role is fetched from auth context
  const [currentManagerId, setCurrentManagerId] = useState(null);
  const [currentTeamId, setCurrentTeamId] = useState(null);
  const [stage, setStage] = useState(ASSIGNMENT_STAGE.TO_MANAGER);
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

  // Assume auth token is stored in localStorage or context
  const authToken = localStorage.getItem('token'); // Adjust based on your auth setup

  // Fetch roles and build hierarchy based on role ID and report_to relationship
  const fetchSalesUsers = async () => {
    try {
      setLoading(true);
      const rolesRes = await axios.get('https://cubehis.avopay.pro:5000/api/roles/', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const roles = rolesRes.data;

      // Build role hierarchy based on role structure from image
      // Admin (Ro-001) -> Manager (Ro-002) -> Executive (Ro-004)
      // Admin (Ro-001) -> Sales_manager (Ro-003) -> Team Member (Ro-005)

      // Helper function to determine seniority: higher role ID = senior in same reporting chain
      const getSeniorityLevel = (role) => {
        const roleIdNum = parseInt(role.id.replace('Ro-', ''));
        return roleIdNum;
      };

      // Sort roles by their ID for proper hierarchy
      const sortedRoles = roles.sort((a, b) => getSeniorityLevel(a) - getSeniorityLevel(b));

      // Build role map for quick lookup
      const roleMap = {};
      sortedRoles.forEach(r => {
        roleMap[r.id] = r;
      });

      // Find Admin role (typically Ro-001 with no report_to)
      const admin = sortedRoles.find(r =>
        r.name && r.name.toLowerCase() === 'admin' &&
        (!r.report_to || r.report_to === 'null')
      );
      const adminId = admin ? admin.id : null;

      // Build hierarchy structure
      const buildHierarchy = (parentId) => {
        const children = sortedRoles.filter(r => r.report_to === parentId);
        return children.map(child => ({
          id: child.id,
          name: child.name,
          email: child.email || '',
          report_to: child.report_to,
          role_type: child.name.toLowerCase(),
          seniority_level: getSeniorityLevel(child),
          subordinates: buildHierarchy(child.id)
        }));
      };

      // Get direct reports to admin (managers and sales_managers)
      const directReports = buildHierarchy(adminId);

      // Separate managers and sales_managers based on their subordinates
      const managers = directReports.filter(role => {
        // Manager typically has Executives reporting to them
        const hasExecutives = role.subordinates.some(sub =>
          sub.role_type === 'executive'
        );
        return role.role_type === 'manager' || hasExecutives;
      });

      const salesManagers = directReports.filter(role => {
        // Sales_manager typically has Team Members reporting to them
        const hasTeamMembers = role.subordinates.some(sub =>
          sub.role_type === 'team member' || sub.role_type === 'team_member'
        );
        return role.role_type === 'sales_manager' || role.role_type === 'sales manager' || hasTeamMembers;
      });

      // Create manager objects with their teams/executives
      const managerObjs = [
        ...managers.map(manager => ({
          id: manager.id,
          name: manager.name,
          email: manager.email,
          report_to: manager.report_to,
          role_type: 'manager',
          seniority_level: manager.seniority_level,
          teams: manager.subordinates.map(exec => ({
            id: exec.id,
            name: exec.name,
            email: exec.email,
            report_to: exec.report_to,
            role_type: exec.role_type,
            seniority_level: exec.seniority_level
          }))
        })),
        ...salesManagers.map(salesManager => ({
          id: salesManager.id,
          name: salesManager.name,
          email: salesManager.email,
          report_to: salesManager.report_to,
          role_type: 'sales_manager',
          seniority_level: salesManager.seniority_level,
          teams: salesManager.subordinates.map(member => ({
            id: member.id,
            name: member.name,
            email: member.email,
            report_to: member.report_to,
            role_type: member.role_type,
            seniority_level: member.seniority_level
          }))
        }))
      ];

      // Sort managers by seniority (higher ID = more senior)
      managerObjs.sort((a, b) => b.seniority_level - a.seniority_level);

      setManagers(managerObjs);
      if (managerObjs.length > 0) {
        setCurrentManagerId(managerObjs[0].id);
        if (managerObjs[0].teams && managerObjs[0].teams.length > 0) {
          setCurrentTeamId(managerObjs[0].teams[0].id);
        }
      }
    } catch (err) {
      setError('Failed to fetch roles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch leads
  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      const response = await axios.get(`${API_BASE_URL}/leads`, {
        headers: { Authorization: `Bearer ${authToken}` },
        params: {
          page: currentPage,
          limit: LEADS_PER_PAGE,
          search: search || undefined,
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
    fetchSalesUsers();
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [search, currentPage]);

  // Auto assign leads to managers/sales_managers (based on hierarchy)
  const autoAssignToManagers = async () => {
    try {
      setLoading(true);
      const availableManagers = managers.filter(m =>
        m.role_type === 'manager' || m.role_type === 'sales_manager'
      );

      if (availableManagers.length === 0) {
        setError('No managers available for assignment');
        return;
      }

      // Sort managers by seniority (higher role ID = more senior)
      const sortedManagers = availableManagers.sort((a, b) => b.seniority_level - a.seniority_level);

      // Prepare bulk assignment data with hierarchy-aware distribution
      const assignments = [];
      const unassignedLeads = leads.filter(lead =>
        !lead.assigned_to || lead.currentAssignment === 'Unassigned'
      );

      // Distribute leads based on manager seniority and capacity
      const perManager = Math.floor(unassignedLeads.length / sortedManagers.length);
      let remainder = unassignedLeads.length % sortedManagers.length;
      let index = 0;

      for (const manager of sortedManagers) {
        // Senior managers (higher ID) get slightly more leads if there's remainder
        const take = perManager + (remainder-- > 0 ? 1 : 0);
        const chunk = unassignedLeads.slice(index, index + take);
        index += take;

        for (const lead of chunk) {
          assignments.push({
            lead_id: lead.id,
            assigned_to: `${manager.name} (${manager.id})`,
            assigned_by: role,
            role_hierarchy_level: manager.seniority_level
          });
        }
      }

      // Use bulk assignment endpoint
      if (assignments.length > 0) {
        await axios.post(
          `${API_BASE_URL}/bulk-assign`,
          assignments,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      }

      await fetchLeads(); // Refresh leads
    } catch (err) {
      setError('Failed to auto-assign managers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Auto assign leads to executives/team members (based on selected manager)
  const autoAssignToExecutives = async () => {
    try {
      setLoading(true);
      const manager = managers.find(m => m.id === currentManagerId);

      if (!manager || !manager.teams || manager.teams.length === 0) {
        setError('No team members available under selected manager');
        return;
      }

      // Sort team members by seniority (higher ID = more senior)
      const sortedTeams = manager.teams.sort((a, b) => b.seniority_level - a.seniority_level);
      const assignments = [];

      // Filter leads assigned to the current manager
      const managerLeads = leads.filter(lead =>
        lead.currentAssignment.includes(manager.name) ||
        lead.currentAssignment.includes(manager.id)
      );

      if (managerLeads.length === 0) {
        setError('No leads assigned to this manager');
        return;
      }

      // Distribute leads among team members based on seniority
      const perTeamMember = Math.floor(managerLeads.length / sortedTeams.length);
      let remainder = managerLeads.length % sortedTeams.length;
      let index = 0;

      for (const teamMember of sortedTeams) {
        // Senior team members (higher ID) get priority on remainder leads
        const take = perTeamMember + (remainder-- > 0 ? 1 : 0);
        const chunk = managerLeads.slice(index, index + take);
        index += take;

        for (const lead of chunk) {
          assignments.push({
            lead_id: lead.id,
            assigned_to: `${teamMember.name} (${teamMember.id})`,
            assigned_by: role,
            role_hierarchy_level: teamMember.seniority_level,
            reporting_manager: manager.name
          });
        }
      }

      // Use bulk assignment endpoint
      if (assignments.length > 0) {
        await axios.post(
          `${API_BASE_URL}/bulk-assign`,
          assignments,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      }

      await fetchLeads(); // Refresh leads
    } catch (err) {
      setError('Failed to auto-assign team members');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Manual assign to manager
  const handleManagerAssign = async (leadId, managerSelection) => {
    try {
      setLoading(true);
      const assignedTo = managerSelection || 'Unassigned';
      await axios.post(
        `${API_BASE_URL}/assign`,
        {
          lead_id: leadId,
          assigned_to: assignedTo,
          assigned_by: role, // Current user role
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      await fetchLeads(); // Refresh leads
    } catch (err) {
      setError('Failed to assign manager');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Manual assign to executive
  const handleExecutiveAssign = async (leadId, executiveSelection) => {
    try {
      setLoading(true);
      const assignedTo = executiveSelection || 'Unassigned';
      await axios.post(
        `${API_BASE_URL}/assign`,
        {
          lead_id: leadId,
          assigned_to: assignedTo,
          assigned_by: role, // Current user role
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      await fetchLeads(); // Refresh leads
    } catch (err) {
      setError('Failed to assign executive');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Pagination handlers
  const handlePrevPage = () => {
    console.log('Previous clicked, current page:', currentPage); // Debug log
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      console.log('Setting page to:', newPage); // Debug log
      setCurrentPage(newPage);
    }
  };

  const handleNextPage = () => {
    console.log('Next clicked, current page:', currentPage, 'total pages:', totalPages); // Debug log
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      console.log('Setting page to:', newPage); // Debug log
      setCurrentPage(newPage);
    }
  };

  // Reset page when search changes
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Export leads to Excel - only essential assignment data
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

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `lead_assignments_${timestamp}.xlsx`);
  };

  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isTeam = role === 'team';

  // Using server-side pagination, no client-side filtering needed
  const filteredLeads = leads;

  const openDrawer = lead => {
    setSelectedLead(lead);
    setShowDrawer(true);
  };

  const closeDrawer = () => {
    setShowDrawer(false);
    setSelectedLead(null);
  };

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
            Lead Assignment
          </h1>
          <div className="flex gap-2 items-center">
            {/* Role selection and manager selection for executives */}
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="border shadow-sm rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="team">Team</option>
            </select>
            {isManager && (
              <select
                value={currentManagerId || ''}
                onChange={e => setCurrentManagerId(e.target.value)}
                className="border shadow-sm rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select Manager</option>
                {managers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role_type})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

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
          {isAdmin && (
            <>
              <button
                onClick={autoAssignToManagers}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition"
                disabled={loading}
              >
                Auto Assign to Managers
              </button>
              <button
                onClick={() => setStage(ASSIGNMENT_STAGE.TO_MANAGER)}
                className={`px-5 py-2 rounded-lg shadow transition ${stage === ASSIGNMENT_STAGE.TO_MANAGER
                    ? 'bg-green-700 text-white'
                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
              >
                Manual Assign to Managers
              </button>
            </>
          )}
          {isManager && (
            <>
              <button
                onClick={autoAssignToExecutives}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition"
                disabled={loading}
              >
                Auto Assign to Team Members
              </button>
              <button
                onClick={() => setStage(ASSIGNMENT_STAGE.TO_EXECUTIVE)}
                className={`px-5 py-2 rounded-lg shadow transition ${stage === ASSIGNMENT_STAGE.TO_EXECUTIVE
                    ? 'bg-green-700 text-white'
                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
              >
                Manual Assign to Team Members
              </button>
            </>
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
                {isAdmin && <th className="px-4 py-3 font-semibold">Assign Manager</th>}
                {isManager && <th className="px-4 py-3 font-semibold">Assign Team Member</th>}
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(lead => (
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
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <select
                        value=""
                        onChange={e => handleManagerAssign(lead.id, e.target.value)}
                        className="border rounded px-2 py-1 w-full outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="">Select Manager</option>
                        {managers
                          .filter(m => m.role_type === 'manager' || m.role_type === 'sales_manager')
                          .sort((a, b) => b.seniority_level - a.seniority_level)
                          .map(m => (
                            <option key={m.id} value={`${m.name} (${m.id})`}>
                              {m.name} - {m.role_type} (Ro-{String(m.seniority_level).padStart(3, '0')})
                            </option>
                          ))}
                      </select>
                    </td>
                  )}
                  {isManager && (
                    <td className="px-4 py-3">
                      <select
                        value=""
                        onChange={e => handleExecutiveAssign(lead.id, e.target.value)}
                        className="border rounded px-2 py-1 w-full outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="">Select Team Member</option>
                        {managers.find(m => m.id === currentManagerId)?.teams
                          ?.sort((a, b) => b.seniority_level - a.seniority_level)
                          .map(t => (
                            <option key={t.id} value={`${t.name} (${t.id})`}>
                              {t.name} - {t.role_type} (Ro-{String(t.seniority_level).padStart(3, '0')})
                            </option>
                          ))}
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
              {filteredLeads.length === 0 && !loading && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">📋</span>
                      <span>No leads available for assignment.</span>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="text-center py-8">
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

export default AssignLeads;
