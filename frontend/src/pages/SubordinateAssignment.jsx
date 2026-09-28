import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaUserTie, FaUsers, FaFilter, FaSync, FaDownload } from 'react-icons/fa';
import { BsPersonCheck, BsPersonFill } from 'react-icons/bs';
import * as XLSX from 'xlsx';

const SubordinateAssignment = () => {
    const [subordinates, setSubordinates] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [leads, setLeads] = useState([]);
    const [unassignedLeads, setUnassignedLeads] = useState([]);
    const [totalLeads, setTotalLeads] = useState(0);
    const [totalUnassigned, setTotalUnassigned] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
    const [statistics, setStatistics] = useState(null);
    const [filters, setFilters] = useState({
        status: '',
        source: '',
        dateRange: ''
    });

    const API_BASE_URL = 'https://cubehis.avopay.pro:5000';

    useEffect(() => {
        // Get current user from token
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                // Parse JWT token to get user data
                const tokenData = token.split('.')[1];
                const decodedData = JSON.parse(atob(tokenData));
                console.log('Current user set from token:', decodedData);
                setCurrentUser(decodedData);

                // Load data based on the current user
                loadSubordinates(decodedData.user_id);
                loadStatistics();
                loadUnassignedLeads();
                loadAllSubordinateLeads(decodedData.user_id);
            } catch (error) {
                console.error('Error parsing token:', error);
            }
        }
    }, []);

    // Watch for unassigned toggle changes
    useEffect(() => {
        if (showUnassignedOnly) {
            loadUnassignedLeads();
        } else if (selectedUser) {
            loadLeads(selectedUser.user_id);
        } else if (currentUser) {
            loadAllSubordinateLeads(currentUser.user_id);
        }
    }, [showUnassignedOnly]);

    const loadSubordinates = async (userId) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('access_token');
            const response = await axios.get(`${API_BASE_URL}/api/assigned-leads/subordinates/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSubordinates(response.data.subordinates || []);
        } catch (error) {
            console.error('Error loading subordinates:', error);
            setSubordinates([]);
        } finally {
            setLoading(false);
        }
    };

    const loadAllSubordinateLeads = async (managerId) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('access_token');

            // Get all leads assigned to the manager's subordinates
            const url = `${API_BASE_URL}/api/assigned-leads/manager-subordinate-leads/${managerId}`;

            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.source) params.append('source', filters.source);
            if (filters.dateRange) params.append('date_range', filters.dateRange);

            const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;

            const response = await axios.get(fullUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setLeads(response.data.leads || []);
            setTotalLeads(response.data.total || 0);
        } catch (error) {
            console.error('Error loading subordinate leads:', error);
            setLeads([]);
            setTotalLeads(0);
        } finally {
            setLoading(false);
        }
    };

    const loadLeads = async (userId = null) => {
        if (!userId) {
            // If no user ID, load all subordinate leads
            if (currentUser) {
                loadAllSubordinateLeads(currentUser.user_id);
                return;
            }
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('access_token');
            let url = `${API_BASE_URL}/api/assigned-leads/leads`;

            const params = new URLSearchParams();
            params.append('assigned_user_id', userId);
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
            const token = localStorage.getItem('access_token');
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
            const token = localStorage.getItem('access_token');
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

    const handleAutoAssign = async () => {
        if (!currentUser?.user_id) {
            alert("User ID not available. Please refresh the page.");
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('access_token');

            const response = await axios.post(
                `${API_BASE_URL}/api/assigned-leads/auto-assign`,
                {
                    assigner_user_id: currentUser.user_id
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                alert(`Successfully assigned ${response.data.assigned_count} leads to ${response.data.subordinates?.length || 0} subordinates!`);

                // Refresh all data
                loadSubordinates(currentUser.user_id);
                loadStatistics();
                loadUnassignedLeads();

                if (selectedUser && !showUnassignedOnly) {
                    loadLeads(selectedUser.user_id);
                } else if (!showUnassignedOnly) {
                    loadAllSubordinateLeads(currentUser.user_id);
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
        if (!currentUser?.user_id) {
            alert("User ID not available. Please refresh the page.");
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('access_token');

            const response = await axios.post(
                `${API_BASE_URL}/api/assigned-leads/manual-assign`,
                {
                    lead_ids: Array.isArray(leadIds) ? leadIds : [leadIds],
                    assigned_to: assigneeId,
                    assigner_user_id: currentUser.user_id
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
                    loadAllSubordinateLeads(currentUser.user_id);
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
            filename = `all_subordinate_leads_${new Date().toISOString().split('T')[0]}.xlsx`;
        }

        XLSX.writeFile(wb, filename);
    };

    const renderSubordinateItem = (subordinate) => {
        const hasSubordinates = subordinate.has_subordinates;

        return (
            <div key={subordinate.user_id} className="mb-3">
                <div
                    className={`
                        p-4 border rounded-lg cursor-pointer transition-all duration-200
                        ${selectedUser?.user_id === subordinate.user_id
                            ? 'bg-blue-100 border-blue-500 shadow-md'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }
                    `}
                    onClick={() => handleUserSelect(subordinate)}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                                {subordinate.role_name === 'admin' && <FaUserTie className="text-purple-600 text-xl" />}
                                {subordinate.role_name === 'manager' && <BsPersonCheck className="text-blue-600 text-xl" />}
                                {subordinate.role_name === 'sales_manager' && <BsPersonCheck className="text-indigo-600 text-xl" />}
                                {(subordinate.role_name === 'executive' || subordinate.role_name === 'team_member') &&
                                    <BsPersonFill className="text-green-600 text-xl" />}
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800">
                                    {subordinate.name}
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Role: {subordinate.role_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                    Assigned Leads: {subordinate.assigned_leads_count || 0}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col items-end">
                            <span className="text-sm font-medium text-gray-700">
                                {hasSubordinates ? 'Has subordinates' : 'No subordinates'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">My Team Lead Management</h1>
                <p className="text-gray-600">
                    Manage leads for your direct team members. Assign leads manually or automatically to your subordinates.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Subordinates Panel */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                                <FaUsers className="mr-2 text-blue-600" />
                                My Team
                            </h2>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => currentUser && loadSubordinates(currentUser.user_id)}
                                    className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg"
                                    disabled={loading}
                                >
                                    <FaSync className={`${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {currentUser && (
                            <div className="mb-6">
                                <div className="mb-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <h3 className="font-semibold text-blue-700">Current Manager</h3>
                                    <p className="text-blue-700">
                                        {currentUser.name || currentUser.username}
                                        <span className="ml-2 text-sm">(You)</span>
                                    </p>
                                    <div className="mt-3">
                                        <button
                                            onClick={handleAutoAssign}
                                            className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition flex items-center justify-center"
                                            disabled={loading || subordinates.length === 0}
                                        >
                                            <FaSync className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                                            Auto-Assign Leads to Team
                                        </button>
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <div
                                        className="p-3 bg-gray-100 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-200"
                                        onClick={() => {
                                            setSelectedUser(null);
                                            setShowUnassignedOnly(false);
                                            loadAllSubordinateLeads(currentUser.user_id);
                                        }}
                                    >
                                        <p className="font-medium text-gray-800">
                                            View All Team Leads
                                        </p>
                                        <p className="text-xs text-gray-600">
                                            Show leads assigned to all team members
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-1 max-h-96 overflow-y-auto">
                            <h3 className="text-sm font-semibold text-gray-600 mb-2">Team Members</h3>
                            {loading && subordinates.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                    <p className="mt-2 text-gray-600">Loading team members...</p>
                                </div>
                            ) : subordinates.length > 0 ? (
                                subordinates.map(subordinate => renderSubordinateItem(subordinate))
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-500">No team members found</p>
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
                                    `Leads assigned to ${selectedUser.name}` :
                                    showUnassignedOnly ?
                                        'Unassigned Leads' :
                                        'All Team Leads'}
                                <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                                    {showUnassignedOnly ? totalUnassigned : totalLeads}
                                </span>
                            </h2>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => {
                                        if (selectedUser) {
                                            loadLeads(selectedUser.user_id);
                                        } else if (currentUser && !showUnassignedOnly) {
                                            loadAllSubordinateLeads(currentUser.user_id);
                                        } else {
                                            loadUnassignedLeads();
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
                                    <span>{showUnassignedOnly ? 'Show Team Leads' : 'Show Unassigned'}</span>
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
                                            } else if (selectedUser) {
                                                loadLeads(selectedUser.user_id);
                                            } else if (currentUser) {
                                                loadAllSubordinateLeads(currentUser.user_id);
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
                                            } else if (selectedUser) {
                                                loadLeads(selectedUser.user_id);
                                            } else if (currentUser) {
                                                loadAllSubordinateLeads(currentUser.user_id);
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
                                            } else if (selectedUser) {
                                                loadLeads(selectedUser.user_id);
                                            } else if (currentUser) {
                                                loadAllSubordinateLeads(currentUser.user_id);
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
                                                        {lead.assigned_user_info?.name || 'Unassigned'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'No date'}
                                                    </p>
                                                </div>
                                                {subordinates.length > 0 && (
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
                                                        {subordinates.map(subordinate => (
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
                                            selectedUser ? `No leads assigned to ${selectedUser.name}` :
                                                'No leads found'}
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

export default SubordinateAssignment;
