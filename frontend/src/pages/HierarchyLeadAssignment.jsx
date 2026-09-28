import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaUserTie,
    FaUsers,
    FaFilter,
    FaSync,
    FaDownload,
    FaExclamationTriangle,
    FaUsersCog,
    FaChartPie,
    //   FaAssignUserAlt,
    FaEye,
    FaUserCheck,
    FaRegUser
} from 'react-icons/fa';
import { BsPersonCheck, BsPersonFill, BsPersonGear, BsPersonBadge } from 'react-icons/bs';
import { MdAssignmentInd, MdAutorenew, MdVisibility } from 'react-icons/md';
import * as XLSX from 'xlsx';

// Helper function to get auth headers
const getAuthHeaders = () => {
    const accessToken = localStorage.getItem('access_token');
    const token = localStorage.getItem('token');
    const jwtToken = localStorage.getItem('jwt');
    const finalToken = accessToken || token || jwtToken;

    const headers = {
        'Content-Type': 'application/json'
    };

    if (finalToken) {
        if (finalToken.startsWith('Bearer ')) {
            headers['Authorization'] = finalToken;
        } else {
            headers['Authorization'] = `Bearer ${finalToken}`;
        }
    }

    return headers;
};

// Helper function to get current user data
const getCurrentUser = () => {
    try {
        const userStr = localStorage.getItem('user');
        if (!userStr) return null;

        const user = JSON.parse(userStr);
        const userId = user.id || user.user_id;

        if (!userId) return null;

        return {
            user_id: userId,
            id: userId,
            username: user.username || '',
            name: user.full_name || user.name || user.username || 'User',
            email: user.email || '',
            roles: user.roles || []
        };
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
};

const HierarchyLeadAssignment = () => {
    const [currentUser, setCurrentUser] = useState(null);
    const [hierarchy, setHierarchy] = useState(null);
    const [subordinates, setSubordinates] = useState([]);
    const [selectedSubordinate, setSelectedSubordinate] = useState(null);
    const [leads, setLeads] = useState([]);
    const [unassignedLeads, setUnassignedLeads] = useState([]);
    const [showUnassigned, setShowUnassigned] = useState(false);
    const [statistics, setStatistics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        status: '',
        source: '',
        dateRange: ''
    });

    const API_BASE_URL = 'https://cubehis.avopay.pro:5000';

    useEffect(() => {
        const user = getCurrentUser();
        if (user) {
            setCurrentUser(user);
            loadUserData(user.user_id);
        }
    }, []);

    const loadUserData = async (userId) => {
        try {
            setLoading(true);
            await Promise.all([
                loadHierarchy(userId),
                loadSubordinates(userId),
                loadStatistics(userId)
            ]);
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadHierarchy = async (userId) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/assigned-leads2/hierarchy/${userId}`, {
                headers: getAuthHeaders()
            });
            setHierarchy(response.data.hierarchy);
        } catch (error) {
            console.error('Error loading hierarchy:', error);
        }
    };

    const loadSubordinates = async (userId) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/assigned-leads2/subordinates/${userId}`, {
                headers: getAuthHeaders()
            });
            setSubordinates(response.data.subordinates);
        } catch (error) {
            console.error('Error loading subordinates:', error);
        }
    };

    const loadStatistics = async (userId) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/assigned-leads2/statistics/${userId}`, {
                headers: getAuthHeaders()
            });
            setStatistics(response.data.statistics);
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    };

    const loadSubordinateLeads = async (subordinateId = null) => {
        try {
            setLoading(true);
            let url;

            if (subordinateId) {
                url = `${API_BASE_URL}/api/assigned-leads2/leads/${subordinateId}`;
            } else {
                url = `${API_BASE_URL}/api/assigned-leads2/subordinate-leads/${currentUser.user_id}`;
            }

            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.source) params.append('source', filters.source);
            if (filters.dateRange) params.append('date_range', filters.dateRange);

            const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;

            const response = await axios.get(fullUrl, {
                headers: getAuthHeaders()
            });

            setLeads(response.data.leads);
        } catch (error) {
            console.error('Error loading leads:', error);
            setLeads([]);
        } finally {
            setLoading(false);
        }
    };

    const loadUnassignedLeads = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.source) params.append('source', filters.source);
            if (filters.dateRange) params.append('date_range', filters.dateRange);

            const url = `${API_BASE_URL}/api/assigned-leads2/unassigned-leads/${currentUser.user_id}`;
            const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;

            const response = await axios.get(fullUrl, {
                headers: getAuthHeaders()
            });

            setUnassignedLeads(response.data.leads);
        } catch (error) {
            console.error('Error loading unassigned leads:', error);
            setUnassignedLeads([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAutoAssign = async () => {
        if (!currentUser) return;

        try {
            setLoading(true);
            const response = await axios.post(
                `${API_BASE_URL}/api/assigned-leads2/auto-assign/${currentUser.user_id}`,
                {},
                { headers: getAuthHeaders() }
            );

            if (response.data.success) {
                alert(`Successfully assigned ${response.data.assigned_count} leads!`);
                // Refresh data
                loadUserData(currentUser.user_id);
                if (showUnassigned) {
                    loadUnassignedLeads();
                } else {
                    loadSubordinateLeads();
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
        if (!currentUser) return;

        try {
            setLoading(true);
            const response = await axios.post(
                `${API_BASE_URL}/api/assigned-leads2/manual-assign/${currentUser.user_id}`,
                {
                    lead_ids: Array.isArray(leadIds) ? leadIds : [leadIds],
                    assigned_to: assigneeId
                },
                { headers: getAuthHeaders() }
            );

            if (response.data.success) {
                alert(`Successfully assigned ${response.data.assigned_count} leads!`);
                // Refresh data
                loadUserData(currentUser.user_id);
                if (showUnassigned) {
                    loadUnassignedLeads();
                } else {
                    loadSubordinateLeads();
                }
            }
        } catch (error) {
            console.error('Error manually assigning leads:', error);
            alert('Error assigning leads: ' + (error.response?.data?.detail || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleSubordinateSelect = (subordinate) => {
        setSelectedSubordinate(subordinate);
        setShowUnassigned(false);
        loadSubordinateLeads(subordinate.user_id);
    };

    const handleToggleUnassigned = () => {
        setShowUnassigned(!showUnassigned);
        setSelectedSubordinate(null);
        if (!showUnassigned) {
            loadUnassignedLeads();
        } else {
            loadSubordinateLeads();
        }
    };

    const exportToExcel = () => {
        const dataToExport = showUnassigned ? unassignedLeads : leads;
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

        const filename = showUnassigned
            ? `unassigned_leads_${new Date().toISOString().split('T')[0]}.xlsx`
            : `leads_${new Date().toISOString().split('T')[0]}.xlsx`;

        XLSX.writeFile(wb, filename);
    };

    const getRoleIcon = (roles) => {
        if (!roles || roles.length === 0) return <FaRegUser className="text-gray-500" />;

        const roleNames = roles.map(r => r.name.toLowerCase());

        if (roleNames.includes('admin') || roleNames.includes('director')) {
            return <FaUserTie className="text-purple-600" />;
        } else if (roleNames.includes('manager') || roleNames.includes('sales_manager')) {
            return <BsPersonCheck className="text-blue-600" />;
        } else if (roleNames.includes('executive') || roleNames.includes('sales_executive')) {
            return <BsPersonFill className="text-green-600" />;
        } else {
            return <FaUserCheck className="text-indigo-600" />;
        }
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'new': return 'bg-blue-100 text-blue-800';
            case 'contacted': return 'bg-yellow-100 text-yellow-800';
            case 'qualified': return 'bg-purple-100 text-purple-800';
            case 'converted': return 'bg-green-100 text-green-800';
            case 'closed': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (!currentUser) {
        return (
            <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center">
                    <FaExclamationTriangle className="text-red-500 text-2xl mr-4" />
                    <div>
                        <h3 className="font-medium text-red-800">Authentication Error</h3>
                        <p className="text-red-700">Please login to access this page.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center">
                    <FaUsersCog className="mr-3 text-blue-600" />
                    Hierarchy Lead Management
                </h1>
                <p className="text-gray-600">
                    Manage leads through your organizational hierarchy. Assign leads to subordinates and track performance.
                </p>
            </div>

            {/* Current User Info & Statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                            <BsPersonBadge className="mr-2 text-blue-600" />
                            Current User Info
                        </h2>
                        {hierarchy && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                                    <div className="flex items-center space-x-3">
                                        {getRoleIcon(hierarchy.roles)}
                                        <div>
                                            <h3 className="font-semibold text-gray-800">{hierarchy.name}</h3>
                                            <p className="text-sm text-gray-600">{hierarchy.email}</p>
                                            <p className="text-xs text-gray-500">
                                                Roles: {hierarchy.roles.map(r => r.name).join(', ')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-blue-700">
                                            {hierarchy.is_top_level ? 'Top Level User' : 'Team Member'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {hierarchy.can_see_unassigned ? 'Can view unassigned leads' : 'Cannot view unassigned leads'}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={handleAutoAssign}
                                        disabled={loading || subordinates.length === 0}
                                        className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <MdAutorenew className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                                        Auto Assign Leads
                                    </button>

                                    {hierarchy.can_see_unassigned && (
                                        <button
                                            onClick={handleToggleUnassigned}
                                            className={`flex items-center justify-center px-4 py-3 rounded-lg transition-colors ${showUnassigned
                                                ? 'bg-orange-600 text-white hover:bg-orange-700'
                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}
                                        >
                                            <MdVisibility className="mr-2" />
                                            {showUnassigned ? 'Hide Unassigned' : 'View Unassigned'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                            <FaChartPie className="mr-2 text-green-600" />
                            Statistics
                        </h2>
                        {statistics && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                                    <span className="text-sm font-medium text-gray-700">Subordinates</span>
                                    <span className="text-lg font-bold text-green-600">{statistics.subordinates_count}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                                    <span className="text-sm font-medium text-gray-700">Total Assigned</span>
                                    <span className="text-lg font-bold text-blue-600">{statistics.total_leads_assigned_to_subordinates}</span>
                                </div>
                                {statistics.user_info.can_see_unassigned && (
                                    <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
                                        <span className="text-sm font-medium text-gray-700">Unassigned</span>
                                        <span className="text-lg font-bold text-orange-600">{statistics.unassigned_leads_count}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
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
                            <button
                                onClick={() => loadSubordinates(currentUser.user_id)}
                                className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg transition-colors"
                                disabled={loading}
                            >
                                <FaSync className={`${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {/* All Team Leads Option */}
                            <div
                                className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${!selectedSubordinate && !showUnassigned
                                    ? 'bg-blue-100 border-blue-500 shadow-md'
                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                    }`}
                                onClick={() => {
                                    setSelectedSubordinate(null);
                                    setShowUnassigned(false);
                                    loadSubordinateLeads();
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <FaUsers className="text-blue-600" />
                                        <div>
                                            <h3 className="font-medium text-gray-800">All Team Leads</h3>
                                            <p className="text-sm text-gray-600">View all subordinate leads</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Individual Subordinates */}
                            {subordinates.map((subordinate) => (
                                <div
                                    key={subordinate.user_id}
                                    className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${selectedSubordinate?.user_id === subordinate.user_id
                                        ? 'bg-blue-100 border-blue-500 shadow-md'
                                        : 'bg-white border-gray-200 hover:bg-gray-50'
                                        }`}
                                    onClick={() => handleSubordinateSelect(subordinate)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            {getRoleIcon(subordinate.roles)}
                                            <div>
                                                <h3 className="font-medium text-gray-800">{subordinate.name}</h3>
                                                <p className="text-sm text-gray-600">
                                                    {subordinate.roles.map(r => r.name).join(', ')}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Leads: {subordinate.assigned_leads_count}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {subordinates.length === 0 && !loading && (
                                <div className="text-center py-8">
                                    <p className="text-gray-500">No subordinates found</p>
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
                                {showUnassigned ? 'Unassigned Leads' :
                                    selectedSubordinate ? `${selectedSubordinate.name}'s Leads` : 'All Team Leads'}
                                <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                                    {showUnassigned ? unassignedLeads.length : leads.length}
                                </span>
                            </h2>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => {
                                        if (showUnassigned) {
                                            loadUnassignedLeads();
                                        } else {
                                            loadSubordinateLeads(selectedSubordinate?.user_id);
                                        }
                                    }}
                                    className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg transition-colors"
                                    disabled={loading}
                                >
                                    <FaSync className={`${loading ? 'animate-spin' : ''}`} />
                                </button>
                                <button
                                    onClick={exportToExcel}
                                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg flex items-center space-x-1 transition-colors"
                                    disabled={(showUnassigned ? unassignedLeads : leads).length === 0}
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
                                            if (showUnassigned) {
                                                loadUnassignedLeads();
                                            } else {
                                                loadSubordinateLeads(selectedSubordinate?.user_id);
                                            }
                                        }, 100);
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                            if (showUnassigned) {
                                                loadUnassignedLeads();
                                            } else {
                                                loadSubordinateLeads(selectedSubordinate?.user_id);
                                            }
                                        }, 100);
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                            if (showUnassigned) {
                                                loadUnassignedLeads();
                                            } else {
                                                loadSubordinateLeads(selectedSubordinate?.user_id);
                                            }
                                        }, 100);
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                            ) : (showUnassigned ? unassignedLeads : leads).length > 0 ? (
                                (showUnassigned ? unassignedLeads : leads).map(lead => (
                                    <div key={lead._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-gray-800">{lead.name || 'No Name'}</h3>
                                                <div className="text-sm text-gray-600 space-y-1">
                                                    <p>📧 {lead.email || 'No email'}</p>
                                                    <p>📱 {lead.phone || 'No phone'}</p>
                                                    <p>📍 {lead.location || 'No location'}</p>
                                                    <p className="flex items-center space-x-2">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
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
                                                        className="text-xs p-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                        defaultValue=""
                                                    >
                                                        <option value="">{lead.assigned_to ? 'Reassign to...' : 'Assign to...'}</option>
                                                        {subordinates.map(subordinate => (
                                                            <option key={subordinate.user_id} value={subordinate.user_id}>
                                                                {subordinate.name} ({subordinate.roles.map(r => r.name).join(', ')})
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
                                        {showUnassigned ? 'No unassigned leads found' : 'No leads found'}
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

export default HierarchyLeadAssignment;
