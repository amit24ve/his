import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaUserTie, FaUsers, FaFilter, FaSync, FaCog, FaDownload } from 'react-icons/fa';
import { BsPersonCheck, BsPersonFill } from 'react-icons/bs';
import * as XLSX from 'xlsx';

const HierarchyAssignment = () => {
    const [hierarchy, setHierarchy] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [leads, setLeads] = useState([]);
    const [unassignedLeads, setUnassignedLeads] = useState([]);
    const [totalLeads, setTotalLeads] = useState(0);
    const [totalUnassigned, setTotalUnassigned] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [autoAssignMode, setAutoAssignMode] = useState('equal'); // 'equal' or 'smart'
    const [bulkAssignLeads, setBulkAssignLeads] = useState([]);
    const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
    const [statistics, setStatistics] = useState(null);
    const [filters, setFilters] = useState({
        status: '',
        source: '',
        dateRange: ''
    });

    const API_BASE_URL = 'https://cubehis.avopay.pro:5000';

    useEffect(() => {
        // Get current user from localStorage
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        setCurrentUser(user);

        // Load hierarchy and initial data
        loadHierarchy();
        loadStatistics();
        loadUnassignedLeads();

        // Load leads for current user by default
        if (!showUnassignedOnly && user?.user_id) {
            loadLeads(user.user_id);
            setSelectedUser(user);
        } else if (!showUnassignedOnly) {
            loadLeads();
        }
    }, []);

    // Watch for unassigned toggle changes
    useEffect(() => {
        if (showUnassignedOnly) {
            loadUnassignedLeads();
        } else if (selectedUser) {
            loadLeads(selectedUser.user_id);
        } else {
            loadLeads();
        }
    }, [showUnassignedOnly]);

    const loadHierarchy = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/assigned-leads/hierarchy`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Get the full hierarchy
            const fullHierarchy = response.data.hierarchy || [];

            // Filter hierarchy to only show current user and their subordinates
            const filteredHierarchy = currentUser?.user_id ?
                filterHierarchyForCurrentUser(fullHierarchy, currentUser.user_id) :
                fullHierarchy;

            setHierarchy(filteredHierarchy);
        } catch (error) {
            console.error('Error loading hierarchy:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadLeads = async (userId = null) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            let url = `${API_BASE_URL}/api/assigned-leads/leads`;

            const params = new URLSearchParams();
            if (userId) params.append('assigned_user_id', userId);
            if (currentUser?.user_id) params.append('requester_user_id', currentUser.user_id);
            if (filters.status) params.append('status', filters.status);
            if (filters.source) params.append('source', filters.source);
            if (filters.dateRange) params.append('date_range', filters.dateRange);
            params.append('limit', '50'); // Show more leads

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setLeads(response.data.data || []);
            setTotalLeads(response.data.total || 0);
        } catch (error) {
            console.error('Error loading leads:', error);
            setLeads([]);
            setTotalLeads(0);
        } finally {
            setLoading(false);
        }
    };

    const loadUnassignedLeads = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            let url = `${API_BASE_URL}/api/assigned-leads/unassigned-leads`;

            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.source) params.append('source', filters.source);
            if (filters.dateRange) params.append('date_range', filters.dateRange);
            params.append('limit', '50'); // Show more leads

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setUnassignedLeads(response.data.data || []);
            setTotalUnassigned(response.data.total || 0);
        } catch (error) {
            console.error('Error loading unassigned leads:', error);
            setUnassignedLeads([]);
            setTotalUnassigned(0);
        } finally {
            setLoading(false);
        }
    };

    const loadStatistics = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/assigned-leads/statistics`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStatistics(response.data.statistics || null);
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    };

    const handleUserSelect = (user) => {
        setSelectedUser(user);
        setShowUnassignedOnly(false); // Reset to show assigned leads when selecting a user
        loadLeads(user.user_id);
    };

    const handleAutoAssign = async (assignerUserId) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            const response = await axios.post(
                `${API_BASE_URL}/api/assigned-leads/auto-assign`,
                {
                    assigner_user_id: assignerUserId
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                alert(`Successfully assigned ${response.data.assigned_count} leads to ${response.data.subordinates?.length || 0} subordinates!`);

                // Refresh all data
                loadHierarchy();
                loadStatistics();
                loadUnassignedLeads();

                if (selectedUser && !showUnassignedOnly) {
                    loadLeads(selectedUser.user_id);
                } else if (!showUnassignedOnly) {
                    loadLeads();
                }
            }
        } catch (error) {
            console.error('Error auto-assigning leads:', error);
            alert('Error during auto-assignment: ' + (error.response?.data?.detail || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleManualAssign = async (leadIds, assigneeId) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            const response = await axios.post(
                `${API_BASE_URL}/api/assigned-leads/manual-assign`,
                {
                    lead_ids: Array.isArray(leadIds) ? leadIds : [leadIds],
                    assigned_to: assigneeId,
                    assigner_user_id: currentUser?.user_id
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                alert(`Successfully assigned ${response.data.assigned_count} leads!`);

                // Refresh all data
                loadStatistics();
                loadUnassignedLeads();

                if (selectedUser && !showUnassignedOnly) {
                    loadLeads(selectedUser.user_id);
                } else if (!showUnassignedOnly) {
                    loadLeads();
                }
            }
        } catch (error) {
            console.error('Error assigning lead:', error);
            alert('Error assigning lead: ' + (error.response?.data?.detail || error.message));
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        const dataToExport = showUnassignedOnly ? unassignedLeads : leads;

        if (dataToExport.length === 0) {
            alert('No leads to export');
            return;
        }

        const exportData = dataToExport.map(lead => ({
            'Lead ID': lead._id,
            'Name': lead.name || '',
            'Email': lead.email || '',
            'Phone': lead.phone || '',
            'Status': lead.status || '',
            'Source': lead.source || '',
            'Assigned To': lead.assigned_user_info?.name || 'Unassigned',
            'Created Date': lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '',
            'Location': lead.location || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Leads');

        let filename;
        if (showUnassignedOnly) {
            filename = `unassigned_leads_${new Date().toISOString().split('T')[0]}.xlsx`;
        } else if (selectedUser) {
            filename = `leads_${selectedUser.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
        } else {
            filename = `all_leads_${new Date().toISOString().split('T')[0]}.xlsx`;
        }

        XLSX.writeFile(wb, filename);
    };

    const renderHierarchyNode = (node, level = 0) => {
        const isCurrentUser = currentUser?.user_id === node.user_id;
        const hasSubordinates = node.subordinates && node.subordinates.length > 0;

        // Check if the user is a top-level admin or has report_to = null
        const isTopLevelAdmin = !node.reports_to || node.reports_to === "null" || node.reports_to === null;

        return (
            <div key={node.user_id} className={`mb-2 ${level > 0 ? 'ml-6' : ''}`}>
                <div
                    className={`
                        p-4 border rounded-lg cursor-pointer transition-all duration-200
                        ${selectedUser?.user_id === node.user_id
                            ? 'bg-blue-100 border-blue-500 shadow-md'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }
                        ${isCurrentUser ? 'ring-2 ring-green-300' : ''}
                        ${isTopLevelAdmin ? 'border-purple-200 bg-purple-50' : ''}
                    `}
                    onClick={() => handleUserSelect(node)}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                                {node.role_name === 'admin' && <FaUserTie className="text-purple-600 text-xl" />}
                                {node.role_name === 'manager' && <BsPersonCheck className="text-blue-600 text-xl" />}
                                {node.role_name === 'sales_manager' && <BsPersonCheck className="text-indigo-600 text-xl" />}
                                {(node.role_name === 'executive' || node.role_name === 'team_member') &&
                                    <BsPersonFill className="text-green-600 text-xl" />}
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800">
                                    {node.name} {isCurrentUser && <span className="text-green-600">(You)</span>}
                                </h3>
                                <p className="text-sm text-gray-600">
                                    ID: {node.user_id} | Role: {node.role_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                    Assigned Leads: {node.assigned_leads_count || 0}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            {/* Show Auto Assign button ONLY for current user and only if they have subordinates */}
                            {isCurrentUser && hasSubordinates && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAutoAssign(node.user_id);
                                    }}
                                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 flex items-center space-x-1"
                                    disabled={loading}
                                >
                                    <FaSync className="text-xs" />
                                    <span>Auto Assign</span>
                                </button>
                            )}

                            <div className="text-right">
                                <div className="text-sm font-medium text-gray-700">
                                    {hasSubordinates ? `${node.subordinates.length} subordinates` : 'No subordinates'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Render subordinates */}
                {hasSubordinates && (
                    <div className="mt-2">
                        {node.subordinates.map(subordinate =>
                            renderHierarchyNode(subordinate, level + 1)
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Filter hierarchy to show only current user and their subordinates
    const filterHierarchyForCurrentUser = (hierarchy, currentUserId) => {
        if (!currentUserId) {
            return hierarchy;
        }

        console.log("Filtering hierarchy for user:", currentUserId);

        // Find the current user's node in the hierarchy
        const findUserNode = (nodes) => {
            for (const node of nodes) {
                if (node.user_id === currentUserId) {
                    return node;
                }

                if (node.subordinates && node.subordinates.length > 0) {
                    const foundInSubordinates = findUserNode(node.subordinates);
                    if (foundInSubordinates) {
                        return foundInSubordinates;
                    }
                }
            }
            return null;
        };

        // Check if user is a top-level admin (report_to is null)
        const topLevelNode = hierarchy.find(node => node.user_id === currentUserId);
        const isTopLevel = topLevelNode &&
            (!topLevelNode.reports_to ||
                topLevelNode.reports_to === "null" ||
                topLevelNode.reports_to === null ||
                topLevelNode.role_name === "admin");

        if (isTopLevel) {
            console.log("Current user is top-level admin, showing full hierarchy");
            // If top-level admin, return entire hierarchy
            return hierarchy;
        }

        // Otherwise, find user node and return just that branch
        const userNode = findUserNode(hierarchy);
        console.log("Found user node:", userNode ? userNode.name : "Not found");
        return userNode ? [userNode] : [];
    };

    // Helper function to get all subordinates from hierarchy for manual assignment dropdown
    const getAllSubordinates = (hierarchy) => {
        const subordinates = [];

        const collectSubordinates = (nodes) => {
            for (const node of nodes) {
                // Only include subordinates, not the current user
                if (node.user_id !== currentUser?.user_id) {
                    subordinates.push(node);
                }

                if (node.subordinates && node.subordinates.length > 0) {
                    collectSubordinates(node.subordinates);
                }
            }
        };

        collectSubordinates(hierarchy);
        return subordinates;
    };

    return (
        <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Hierarchy-Based Lead Assignment</h1>
                <p className="text-gray-600">
                    Manage lead assignments based on organizational hierarchy. Auto-assign or manually distribute leads among team members.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Hierarchy Panel */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                                <FaUsers className="mr-2 text-blue-600" />
                                Team Hierarchy
                            </h2>
                            <button
                                onClick={loadHierarchy}
                                className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg"
                                disabled={loading}
                            >
                                <FaSync className={`${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Auto-assign Mode
                            </label>
                            <select
                                value={autoAssignMode}
                                onChange={(e) => setAutoAssignMode(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="equal">Equal Distribution</option>
                                <option value="smart">Smart Distribution (by workload)</option>
                            </select>
                        </div>

                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {hierarchy.length > 0 ? (
                                filterHierarchyForCurrentUser(hierarchy, currentUser?.user_id).map(node => renderHierarchyNode(node))
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    {loading ? 'Loading hierarchy...' : 'No hierarchy data available'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Leads Panel */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                                <FaFilter className="mr-2 text-green-600" />
                                {selectedUser ?
                                    `Leads assigned to ${selectedUser.name}${selectedUser.user_id === currentUser?.user_id ? ' (You)' : ''}` :
                                    'All Leads'}
                                <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                                    {showUnassignedOnly ? totalUnassigned : totalLeads}
                                </span>
                            </h2>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => {
                                        if (showUnassignedOnly) {
                                            loadUnassignedLeads();
                                        } else {
                                            // If no user selected, load current user's leads
                                            if (!selectedUser && currentUser) {
                                                loadLeads(currentUser.user_id);
                                                setSelectedUser(currentUser);
                                            } else {
                                                loadLeads(selectedUser?.user_id);
                                            }
                                        }
                                    }}
                                    className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg"
                                    disabled={loading}
                                >
                                    <FaSync className={`${loading ? 'animate-spin' : ''}`} />
                                </button>
                                <button
                                    onClick={() => setShowUnassignedOnly(!showUnassignedOnly)}
                                    className={`${showUnassignedOnly ? 'bg-blue-600' : 'bg-gray-500'} hover:opacity-90 text-white px-3 py-2 rounded-lg flex items-center space-x-1 mr-2`}
                                >
                                    <span>{showUnassignedOnly ? 'Show All Leads' : 'Show Unassigned Only'}</span>
                                </button>
                                <button
                                    onClick={exportToExcel}
                                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg flex items-center space-x-1"
                                    disabled={(showUnassignedOnly ? unassignedLeads : leads).length === 0}
                                >
                                    <FaDownload />
                                    <span>Export</span>
                                </button>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => {
                                        setFilters({ ...filters, status: e.target.value });
                                        setTimeout(() => {
                                            if (showUnassignedOnly) {
                                                loadUnassignedLeads();
                                            } else {
                                                loadLeads(selectedUser?.user_id);
                                            }
                                        }, 100);
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">All Statuses</option>
                                    <option value="new">New</option>
                                    <option value="contacted">Contacted</option>
                                    <option value="qualified">Qualified</option>
                                    <option value="converted">Converted</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                                <select
                                    value={filters.source}
                                    onChange={(e) => {
                                        setFilters({ ...filters, source: e.target.value });
                                        setTimeout(() => {
                                            if (showUnassignedOnly) {
                                                loadUnassignedLeads();
                                            } else {
                                                loadLeads(selectedUser?.user_id);
                                            }
                                        }, 100);
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">All Sources</option>
                                    <option value="website">Website</option>
                                    <option value="social_media">Social Media</option>
                                    <option value="referral">Referral</option>
                                    <option value="cold_call">Cold Call</option>
                                    <option value="email">Email</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                                <select
                                    value={filters.dateRange}
                                    onChange={(e) => {
                                        setFilters({ ...filters, dateRange: e.target.value });
                                        setTimeout(() => {
                                            if (showUnassignedOnly) {
                                                loadUnassignedLeads();
                                            } else {
                                                loadLeads(selectedUser?.user_id);
                                            }
                                        }, 100);
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">All Time</option>
                                    <option value="today">Today</option>
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                    <option value="quarter">This Quarter</option>
                                </select>
                            </div>
                        </div>

                        {/* Leads List */}
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {loading ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                    <p className="mt-2 text-gray-600">Loading leads...</p>
                                </div>
                            ) : (showUnassignedOnly ? unassignedLeads : leads).length > 0 ? (
                                (showUnassignedOnly ? unassignedLeads : leads).map(lead => (
                                    <div key={lead._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-gray-800">{lead.name || 'No Name'}</h3>
                                                <div className="text-sm text-gray-600 space-y-1">
                                                    <p>📧 {lead.email || 'No email'}</p>
                                                    <p>📱 {lead.phone || 'No phone'}</p>
                                                    <p>📍 {lead.location || 'No location'}</p>
                                                    <p className="flex items-center space-x-2">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium
                                                            ${lead.status === 'new' ? 'bg-blue-100 text-blue-800' :
                                                                lead.status === 'contacted' ? 'bg-yellow-100 text-yellow-800' :
                                                                    lead.status === 'qualified' ? 'bg-purple-100 text-purple-800' :
                                                                        lead.status === 'converted' ? 'bg-green-100 text-green-800' :
                                                                            'bg-gray-100 text-gray-800'}`}>
                                                            {lead.status || 'Unknown'}
                                                        </span>
                                                        <span className="text-gray-500">•</span>
                                                        <span>{lead.source || 'Unknown source'}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end space-y-2">
                                                <div className="text-right">
                                                    <p className="text-sm font-medium text-gray-700">
                                                        {lead.assigned_to_display || 'Unassigned'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'No date'}
                                                    </p>
                                                </div>
                                                {/* Only show manual assignment dropdown if user has subordinates */}
                                                {getAllSubordinates(filterHierarchyForCurrentUser(hierarchy, currentUser?.user_id)).length > 0 && (
                                                    <select
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                handleManualAssign(lead._id, e.target.value);
                                                                e.target.value = '';
                                                            }
                                                        }}
                                                        className="text-xs p-1 border border-gray-300 rounded"
                                                        defaultValue=""
                                                    >
                                                        <option value="">{lead.assigned_to ? 'Reassign to...' : 'Assign to...'}</option>
                                                        {getAllSubordinates(filterHierarchyForCurrentUser(hierarchy, currentUser?.user_id)).map(subordinate => (
                                                            <option key={subordinate.user_id} value={subordinate.user_id}>
                                                                {subordinate.name} ({subordinate.role_name})
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-500">
                                        {showUnassignedOnly ? 'No unassigned leads found' :
                                            selectedUser ? `No leads assigned to ${selectedUser.name}` : 'No leads found'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HierarchyAssignment;