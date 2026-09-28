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
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const LEADS_PER_PAGE = 10;
  const navigate = useNavigate();

  // Assume auth token is stored in localStorage or context
  const authToken = localStorage.getItem('token'); // Adjust based on your auth setup

  // Fetch users and build hierarchy based on their roles and reporting structure
  const fetchSalesUsers = async () => {
    try {
      setLoading(true);

      // Fetch both roles and users from database
      const [rolesRes, usersRes] = await Promise.all([
        axios.get('https://cubehis.avopay.pro:5000/api/roles/', {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        axios.get('https://cubehis.avopay.pro:5000/api/users/', {
          headers: { Authorization: `Bearer ${authToken}` },
        })
      ]);

      const roles = rolesRes.data;
      const users = usersRes.data || [];

      console.log('Fetched roles:', roles);
      console.log('Fetched users:', users);

      // Build role map for quick lookup
      const roleMap = {};
      roles.forEach(r => {
        roleMap[r.id] = r;
      });

      // Helper function to determine seniority: higher role ID = senior in same reporting chain
      const getSeniorityLevel = (roleId) => {
        const roleIdNum = parseInt(roleId.replace('Ro-', ''));
        return roleIdNum;
      };

      // Find top-level role (Admin - whose report_to is null)
      const topRole = roles.find(r =>
        r.name && r.name.toLowerCase() === 'admin' &&
        (!r.report_to || r.report_to === 'null')
      );
      const topRoleId = topRole ? topRole.id : null;

      console.log('Found top role (Admin):', topRole);

      // Build user hierarchy based on their roles and reports_to relationship
      const buildUserHierarchy = (parentRoleId, parentUserId = null) => {
        // Find roles that report to this parent role
        const childRoles = roles.filter(r => r.report_to === parentRoleId);

        return childRoles.map(childRole => {
          // Find all users with this role
          const usersWithRole = users.filter(user => {
            // Check if user has this role ID in their role_ids array
            if (user.role_ids && Array.isArray(user.role_ids)) {
              const hasRole = user.role_ids.includes(childRole.id);
              // If we have a specific parent user, check reports_to
              if (parentUserId && hasRole) {
                return user.reports_to === parentUserId;
              }
              return hasRole;
            }
            // Fallback: check if roles string/array contains the role name
            if (user.roles) {
              const userRoles = Array.isArray(user.roles) ? user.roles : [user.roles];
              const hasRole = userRoles.some(role =>
                role.toLowerCase().includes(childRole.name.toLowerCase())
              );
              // If we have a specific parent user, check reports_to
              if (parentUserId && hasRole) {
                return user.reports_to === parentUserId;
              }
              return hasRole;
            }
            return false;
          });

          return usersWithRole.map(user => ({
            id: user.user_id || user._id || user.id,
            name: user.full_name || user.username || 'Unknown User',
            email: user.email || '',
            role_id: childRole.id,
            role_name: childRole.name,
            role_type: childRole.name.toLowerCase().replace(' ', '_'),
            report_to: childRole.report_to, // The role this role reports to
            reports_to: parentUserId, // The specific user this user reports to
            seniority_level: getSeniorityLevel(childRole.id),
            subordinates: buildUserHierarchy(childRole.id, user.user_id || user._id || user.id)
          }));
        }).flat(); // Flatten the array since we map over roles then users
      };

      // Get direct reports to admin (managers and sales_managers)
      const directReports = buildUserHierarchy(topRoleId);

      console.log('Direct reports to admin:', directReports);

      // Separate managers and sales_managers based on their role names
      const managers = directReports.filter(user =>
        user.role_name.toLowerCase().includes('manager') && !user.role_name.toLowerCase().includes('sales')
      );

      const salesManagers = directReports.filter(user =>
        user.role_name.toLowerCase().includes('sales') && user.role_name.toLowerCase().includes('manager')
      );

      // Create manager objects with their teams/executives
      const managerObjs = [
        ...managers.map(manager => ({
          id: manager.id,
          name: manager.name,
          email: manager.email,
          role_id: manager.role_id,
          role_name: manager.role_name,
          report_to: manager.report_to,
          reports_to: manager.reports_to, // Keep track of who this manager reports to
          role_type: 'manager',
          seniority_level: manager.seniority_level,
          teams: manager.subordinates || []
        })),
        ...salesManagers.map(salesManager => ({
          id: salesManager.id,
          name: salesManager.name,
          email: salesManager.email,
          role_id: salesManager.role_id,
          role_name: salesManager.role_name,
          report_to: salesManager.report_to,
          reports_to: salesManager.reports_to, // Keep track of who this sales manager reports to
          role_type: 'sales_manager',
          seniority_level: salesManager.seniority_level,
          teams: salesManager.subordinates || []
        }))
      ];

      // Sort managers by seniority (higher ID = more senior)
      managerObjs.sort((a, b) => b.seniority_level - a.seniority_level);

      console.log('Final manager objects with users:', managerObjs);

      setManagers(managerObjs);
      if (managerObjs.length > 0) {
        setCurrentManagerId(managerObjs[0].id);
        if (managerObjs[0].teams && managerObjs[0].teams.length > 0) {
          setCurrentTeamId(managerObjs[0].teams[0].id);
        }
      }
    } catch (err) {
      setError('Failed to fetch users and roles');
      console.error('Error fetching users and roles:', err);
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
        assigned_to_name: lead.assigned_to_name || '',
        assigned_to_display: lead.assigned_to_display || '',
        currentAssignment: lead.assigned_to_name || lead.assigned_to_display || lead.assigned_to || 'Unassigned'
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

  // Fetch data on mount and when search or currentPage/selectedAssignee changes
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

      // Get admin user (for reporting structure)
      const adminUser = role === 'admin' ? { id: localStorage.getItem('userId') || 'admin' } : null;

      // Distribute leads evenly among all managers
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
            assigned_to: manager.id, // Use user ID instead of name
            assigned_by: role,
            reports_to: adminUser ? adminUser.id : null // Managers report to admin
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
      setError(`Failed to auto-assign managers: ${err.response?.data?.detail || err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Auto assign leads to executives/team members (based on selected manager)
  const autoAssignToExecutives = async () => {
    try {
      setLoading(true);

      // Get subordinates based on current role and find current user's specific subordinates
      let availableSubordinates = [];
      let currentUserName = '';
      let currentUser = null;

      if (role === 'manager') {
        // Find the current manager and their specific subordinates
        currentUser = managers.find(m => m.role_type === 'manager');
        currentUserName = currentUser ? `${currentUser.name} - ${currentUser.role_name}` : 'manager';

        // Manager assigns only to executives who directly report to them
        if (currentUser) {
          // Get all executives who report to this specific manager
          availableSubordinates = currentUser.teams ? currentUser.teams.filter(t =>
            t.role_type === 'executive'
          ) : [];
        }

      } else if (role === 'sales_manager') {
        // Find the current sales manager and their specific subordinates
        currentUser = managers.find(m => m.role_type === 'sales_manager');
        currentUserName = currentUser ? `${currentUser.name} - ${currentUser.role_name}` : 'sales_manager';

        // Sales manager assigns only to team members who directly report to them
        if (currentUser) {
          // Get all team members who report to this specific sales manager
          availableSubordinates = currentUser.teams ? currentUser.teams.filter(t =>
            (t.role_type === 'team' || t.role_type === 'team_member')
          ) : [];
        }
      }

      console.log('Current user:', currentUser);
      console.log('Available subordinates for', currentUserName, ':', availableSubordinates);

      if (availableSubordinates.length === 0) {
        setError(`No ${role === 'manager' ? 'executives' : 'team members'} available who report directly to you. Please check reporting relationships.`);
        return;
      }

      // Sort subordinates by seniority (higher ID = more senior)
      const sortedSubordinates = availableSubordinates.sort((a, b) => b.seniority_level - a.seniority_level);
      const assignments = [];

      // Filter leads that are assigned to the current manager/sales_manager
      const assignableLeads = leads.filter(lead => {
        const assignment = lead.currentAssignment.toLowerCase();
        const assignedToName = lead.assigned_to_name ? lead.assigned_to_name.toLowerCase() : '';
        const assignedToDisplay = lead.assigned_to_display ? lead.assigned_to_display.toLowerCase() : '';

        // Check if lead is assigned to current user
        return (currentUser && (
          assignment.includes(currentUser.name.toLowerCase()) ||
          assignedToName === currentUser.name.toLowerCase() ||
          assignedToDisplay.includes(currentUser.name.toLowerCase()) ||
          lead.assigned_to === currentUser.id ||
          lead.assigned_user_id === currentUser.id
        )) || assignment === role || // If assigned by role name
          assignment.includes(role.replace('_', ' ')); // sales_manager -> sales manager
      });

      console.log('Assignable leads for', currentUserName, ':', assignableLeads);

      if (assignableLeads.length === 0) {
        setError(`No leads assigned to you (${currentUserName}) to redistribute. Please ensure leads are assigned to you first.`);
        return;
      }

      // Distribute leads among subordinates evenly
      const perSubordinate = Math.floor(assignableLeads.length / sortedSubordinates.length);
      let remainder = assignableLeads.length % sortedSubordinates.length;
      let index = 0;

      for (const subordinate of sortedSubordinates) {
        // Senior subordinates (higher ID) get priority on remainder leads
        const take = perSubordinate + (remainder-- > 0 ? 1 : 0);
        const chunk = assignableLeads.slice(index, index + take);
        index += take;

        for (const lead of chunk) {
          assignments.push({
            lead_id: lead.id,
            assigned_to: subordinate.id, // Use user ID instead of name
            assigned_by: role,
            reports_to: currentUser ? currentUser.id : null // Track the reporting relationship
          });
        }
      }

      console.log('Assignment payload:', assignments);

      // Use bulk assignment endpoint
      if (assignments.length > 0) {
        await axios.post(
          `${API_BASE_URL}/bulk-assign`,
          assignments,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );

        setError(null); // Clear any previous errors
        // Show success message
        const successMsg = `Successfully assigned ${assignments.length} leads to ${sortedSubordinates.length} ${role === 'manager' ? 'executives' : 'team members'} who report directly to you`;
        console.log(successMsg);
      }

      await fetchLeads(); // Refresh leads
    } catch (err) {
      setError(`Failed to auto-assign ${role === 'manager' ? 'executives' : 'team members'}: ${err.response?.data?.detail || err.message}`);
      console.error('Auto-assign error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Manual assign to manager
  const handleManagerAssign = async (leadId, managerSelection) => {
    try {
      setLoading(true);

      // Validate that admin can assign this lead
      if (role === 'admin') {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) {
          setError('Lead not found');
          return;
        }
      }

      // Get admin user ID (for reporting structure)
      const adminUserId = role === 'admin' ? localStorage.getItem('userId') || 'admin' : null;

      const assignedTo = managerSelection || 'Unassigned';
      await axios.post(
        `${API_BASE_URL}/assign`,
        {
          lead_id: leadId,
          assigned_to: assignedTo,
          assigned_by: role, // Current user role
          reports_to: adminUserId // Managers report to admin
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      setError(null); // Clear any previous errors
      await fetchLeads(); // Refresh leads
    } catch (err) {
      setError(`Failed to assign manager: ${err.response?.data?.detail || err.message}`);
      console.error('Manager assign error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Manual assign to executive/team member
  const handleExecutiveAssign = async (leadId, executiveSelection) => {
    try {
      setLoading(true);

      // Validate that the lead can be assigned by this manager
      const lead = leads.find(l => l.id === leadId);
      if (!lead) {
        setError('Lead not found');
        return;
      }

      // Check if the lead is assigned to current user or unassigned
      const assignment = lead.currentAssignment.toLowerCase();
      const assignedToName = lead.assigned_to_name ? lead.assigned_to_name.toLowerCase() : '';
      const assignedToDisplay = lead.assigned_to_display ? lead.assigned_to_display.toLowerCase() : '';

      let currentUser = null;

      if (role === 'manager') {
        currentUser = managers.find(m => m.role_type === 'manager');
      } else if (role === 'sales_manager') {
        currentUser = managers.find(m => m.role_type === 'sales_manager');
      }

      const canAssign = assignment === 'unassigned' ||
        (currentUser && (
          assignment.includes(currentUser.name.toLowerCase()) ||
          assignedToName === currentUser.name.toLowerCase() ||
          assignedToDisplay.includes(currentUser.name.toLowerCase()) ||
          lead.assigned_to === currentUser.id ||
          lead.assigned_user_id === currentUser.id
        )) ||
        assignment.includes(role.toLowerCase()) ||
        assignment.includes(role.replace('_', ' ').toLowerCase());

      if (!canAssign) {
        setError(`You can only assign leads that are currently assigned to you. This lead is assigned to: ${lead.currentAssignment}`);
        return;
      }

      // Additional validation: Check if the selected executive/team member is under current user's management
      let isValidSubordinate = false;
      let reportingSubordinates = [];

      if (role === 'manager') {
        const currentManager = managers.find(m => m.role_type === 'manager');
        if (currentManager) {
          // Get all executives who report to this manager
          reportingSubordinates = currentManager.teams ? currentManager.teams.filter(t =>
            t.role_type === 'executive'
          ) : [];

          isValidSubordinate = reportingSubordinates.some(t => t.id === executiveSelection);
        }
      } else if (role === 'sales_manager') {
        const currentSalesManager = managers.find(m => m.role_type === 'sales_manager');
        if (currentSalesManager) {
          // Get all team members who report to this sales manager
          reportingSubordinates = currentSalesManager.teams ? currentSalesManager.teams.filter(t =>
            (t.role_type === 'team' || t.role_type === 'team_member')
          ) : [];

          isValidSubordinate = reportingSubordinates.some(t => t.id === executiveSelection);
        }
      }

      if (!isValidSubordinate && executiveSelection !== 'Unassigned') {
        setError(`You can only assign leads to ${role === 'manager' ? 'executives' : 'team members'} who report directly to you.`);
        return;
      }

      const assignedTo = executiveSelection || 'Unassigned';
      await axios.post(
        `${API_BASE_URL}/assign`,
        {
          lead_id: leadId,
          assigned_to: assignedTo,
          assigned_by: role, // Current user role
          reports_to: currentUser ? currentUser.id : null // Track the reporting relationship
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      setError(null); // Clear any previous errors
      await fetchLeads(); // Refresh leads
    } catch (err) {
      setError(`Failed to assign ${role === 'manager' ? 'executive' : 'team member'}: ${err.response?.data?.detail || err.message}`);
      console.error('Executive/Team assignment error:', err);
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
  const isManager = role === 'manager' || role === 'sales_manager';
  const isExecutive = role === 'executive';
  const isTeam = role === 'team';

  // Filter leads by selected assignee (show only leads assigned to selected user)
  const filteredLeads = selectedAssignee
    ? leads.filter(lead => {
      // Check if the selected assignee matches any of the assignment fields
      const assigneeMatch =
        lead.assigned_to === selectedAssignee ||
        lead.assigned_to_name === selectedAssignee ||
        lead.assigned_to_display === selectedAssignee ||
        lead.assigned_user_id === selectedAssignee ||
        lead.currentAssignment === selectedAssignee ||
        (lead.currentAssignment && lead.currentAssignment.includes(selectedAssignee)) ||
        // Also check if the selected assignee matches the display name part before the " - "
        (lead.assigned_to_display && lead.assigned_to_display.split(' - ')[0] === selectedAssignee) ||
        (lead.assigned_to_name && lead.assigned_to_name.toLowerCase() === selectedAssignee.toLowerCase());

      // Debug log
      if (selectedAssignee && assigneeMatch) {
        console.log(`Lead ${lead.name} matches assignee ${selectedAssignee}:`, {
          assigned_to: lead.assigned_to,
          assigned_to_name: lead.assigned_to_name,
          assigned_to_display: lead.assigned_to_display,
          assigned_user_id: lead.assigned_user_id,
          currentAssignment: lead.currentAssignment
        });
      }

      return assigneeMatch;
    })
    : leads;

  // Debug log for filtering
  console.log('Selected assignee:', selectedAssignee);
  console.log('Total leads:', leads.length);
  console.log('Filtered leads:', filteredLeads.length);

  // Log unique assignee values for debugging
  if (leads.length > 0) {
    const uniqueAssignees = new Set([
      ...leads.map(lead => lead.assigned_to).filter(Boolean),
      ...leads.map(lead => lead.assigned_to_name).filter(Boolean),
      ...leads.map(lead => lead.assigned_to_display).filter(Boolean),
      ...leads.map(lead => lead.assigned_user_id).filter(Boolean)
    ]);
    console.log('Unique assignees found in leads:', Array.from(uniqueAssignees));
  }

  const openDrawer = lead => {
    setSelectedLead(lead);
    setShowDrawer(true);
  };

  const closeDrawer = () => {
    setShowDrawer(false);
    setSelectedLead(null);
  };

  // Handler to navigate to HierarchyAssignment page
  const handleGoToHierarchy = () => {
    navigate("/hierarchy-assignment");
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-blue-50 to-yellow-50 p-0 sm:p-6">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-4 sm:p-8 relative">
        {/* Button to go to Hierarchy Assignment */}
        <button
          onClick={handleGoToHierarchy}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-700 transition mb-4"
        >
          Go to Hierarchy Assignment
        </button>
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
            {/* Single role selection dropdown */}
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="border shadow-sm rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="sales_manager">Sales Manager</option>
              <option value="executive">Executive</option>
              <option value="team">Team</option>
            </select>
            {/* User selection dropdown for filtering leads by assignee */}
            <select
              value={selectedAssignee}
              onChange={e => setSelectedAssignee(e.target.value)}
              className="border shadow-sm rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-300 ml-2"
            >
              <option value="">Show All Leads</option>
              {/* Get unique assignees from the actual leads data */}
              {[...new Set([
                ...leads.map(lead => lead.assigned_to_name).filter(Boolean),
                ...leads.map(lead => lead.assigned_to_display).filter(Boolean),
                ...leads.map(lead => lead.assigned_to).filter(Boolean),
                ...leads.map(lead => lead.assigned_user_id).filter(Boolean)
              ])].sort().map(assignee => (
                <option key={assignee} value={assignee}>
                  {assignee}
                </option>
              ))}
              {/* Also include managers and their teams from hierarchy */}
              {managers.length > 0 && (
                <>
                  <optgroup label="Available Users">
                    {managers.map(m => (
                      <option key={`mgr-${m.id}`} value={m.name}>
                        {m.name} - {m.role_name}
                      </option>
                    ))}
                    {managers.map(m =>
                      m.teams && m.teams.map(t => (
                        <option key={`team-${t.id}`} value={t.name}>
                          {t.name} - {t.role_name}
                        </option>
                      ))
                    )}
                  </optgroup>
                </>
              )}
            </select>
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

        {/* Action Buttons - Updated for hierarchy clarity */}
        <div className="flex flex-wrap gap-2 mb-5">
          {isAdmin && (
            <>
              <button
                onClick={autoAssignToManagers}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition flex items-center gap-2"
                disabled={loading}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Auto Assign to Managers/Sales Managers
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
          {(isManager || isExecutive) && (
            <>
              <button
                onClick={autoAssignToExecutives}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition flex items-center gap-2"
                disabled={loading}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                Auto Assign to {role === 'manager' ? 'Executives' : 'Team Members'}
              </button>
              <button
                onClick={() => setStage(ASSIGNMENT_STAGE.TO_EXECUTIVE)}
                className={`px-5 py-2 rounded-lg shadow transition ${stage === ASSIGNMENT_STAGE.TO_EXECUTIVE
                  ? 'bg-green-700 text-white'
                  : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
              >
                Manual Assign to {role === 'manager' ? 'Executives' : 'Team Members'}
              </button>
            </>
          )}
        </div>

        {/* Hierarchy Information Panel */}
        {managers.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Current User Hierarchy</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {managers.map(manager => (
                <div key={manager.id} className="bg-white rounded p-3 border">
                  <div className="font-semibold text-blue-700">
                    {manager.name} - {manager.role_name}
                  </div>
                  <div className="text-gray-600 capitalize">
                    Level {manager.seniority_level} | ID: {manager.role_id}
                  </div>
                  {manager.teams && manager.teams.length > 0 && (
                    <div className="mt-2 pl-3 border-l-2 border-gray-200">
                      <div className="text-gray-500 font-medium mb-1">Direct Reports:</div>
                      {manager.teams.map(team => (
                        <div key={team.id} className="text-gray-500 text-xs">
                          → {team.name} - {team.role_name}
                        </div>
                      ))}
                    </div>
                  )}
                  {(!manager.teams || manager.teams.length === 0) && (
                    <div className="mt-1 text-gray-400 italic text-xs">No direct reports</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
                {isAdmin && <th className="px-4 py-3 font-semibold">Assign to Level 2</th>}
                {(isManager || isExecutive) && <th className="px-4 py-3 font-semibold">Assign to Level 3</th>}
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
                        {/* Dropdown options for manager selection */}
                        <option value="">Select Manager/Sales Manager</option>
                        {managers
                          .filter(m => m.role_type === 'manager' || m.role_type === 'sales_manager')
                          .sort((a, b) => b.seniority_level - a.seniority_level)
                          .map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} - {m.role_name}
                            </option>
                          ))}
                      </select>
                    </td>
                  )}
                  {(isManager || isExecutive) && (
                    <td className="px-4 py-3">
                      {/* Only show dropdown if lead can be assigned by current user */}
                      {(() => {
                        const assignment = lead.currentAssignment.toLowerCase();
                        const assignedToName = lead.assigned_to_name ? lead.assigned_to_name.toLowerCase() : '';
                        const assignedToDisplay = lead.assigned_to_display ? lead.assigned_to_display.toLowerCase() : '';

                        let currentUser = null;
                        if (role === 'manager') {
                          currentUser = managers.find(m => m.role_type === 'manager');
                        } else if (role === 'sales_manager') {
                          currentUser = managers.find(m => m.role_type === 'sales_manager');
                        }

                        const canAssign = assignment === 'unassigned' ||
                          (currentUser && (
                            assignment.includes(currentUser.name.toLowerCase()) ||
                            assignedToName === currentUser.name.toLowerCase() ||
                            assignedToDisplay.includes(currentUser.name.toLowerCase()) ||
                            lead.assigned_to === currentUser.id ||
                            lead.assigned_user_id === currentUser.id
                          )) ||
                          assignment.includes(role.toLowerCase()) ||
                          assignment.includes(role.replace('_', ' ').toLowerCase());

                        if (!canAssign) {
                          return (
                            <span className="text-xs text-gray-500 italic">
                              Not assignable by you
                            </span>
                          );
                        }

                        // Get current user's direct subordinates only
                        let availableSubordinates = [];
                        if (role === 'manager') {
                          const currentManager = managers.find(m => m.role_type === 'manager');
                          availableSubordinates = currentManager && currentManager.teams ?
                            currentManager.teams.filter(t => t.role_type === 'executive') : [];
                        } else if (role === 'sales_manager') {
                          const currentSalesManager = managers.find(m => m.role_type === 'sales_manager');
                          availableSubordinates = currentSalesManager && currentSalesManager.teams ?
                            currentSalesManager.teams.filter(t => t.role_type === 'team' || t.role_type === 'team_member') : [];
                        }

                        return (
                          <select
                            value=""
                            onChange={e => handleExecutiveAssign(lead.id, e.target.value)}
                            className="border rounded px-2 py-1 w-full outline-none focus:ring-2 focus:ring-blue-200"
                          >
                            <option value="">
                              Select {role === 'manager' ? 'Executive' : 'Team Member'}
                            </option>
                            {/* Show only direct subordinates */}
                            {availableSubordinates
                              .sort((a, b) => b.seniority_level - a.seniority_level)
                              .map(t => (
                                <option key={t.id} value={t.id}>
                                  {t.name} - {t.role_name}
                                </option>
                              ))}
                            {availableSubordinates.length === 0 && (
                              <option disabled>No direct subordinates available</option>
                            )}
                          </select>
                        );
                      })()}
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
                  <td colSpan={isAdmin ? 7 : (isManager || isExecutive) ? 7 : 6} className="text-center py-8 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">📋</span>
                      <span>No leads available for assignment.</span>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={isAdmin ? 7 : (isManager || isExecutive) ? 7 : 6} className="text-center py-8">
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
