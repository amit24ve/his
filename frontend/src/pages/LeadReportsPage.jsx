import React, { useState, useEffect } from "react";
import axios from "axios";
import { format } from "date-fns";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area
} from "recharts";
import { FaUsers, FaChartBar, FaCalendarAlt, FaUserTie, FaFileDownload, FaSync, FaFilter } from "react-icons/fa";

// API Base URL
const API_BASE = "https://cubehis.avopay.pro:5000/api/reports";

// Color palette for charts
const COLORS = ["#2563eb", "#10b981", "#f59e42", "#ef4444", "#6366f1", "#c026d3", "#059669", "#7c3aed"];

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 border shadow-lg rounded-md">
                <p className="text-gray-600 text-sm font-medium">{label}</p>
                {payload.map((entry, index) => (
                    <p key={`item-${index}`} className="text-sm" style={{ color: entry.color }}>
                        {entry.name}: {entry.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export default function LeadReportsPage() {
    // State management
    const [activeTab, setActiveTab] = useState("distribution");
    const [dateRange, setDateRange] = useState({
        start: format(new Date(new Date().setDate(1)), "yyyy-MM-dd"), // First day of current month
        end: format(new Date(), "yyyy-MM-dd") // Current day
    });
    const [loading, setLoading] = useState({
        distribution: false,
        workload: false,
        hierarchy: false,
        activities: false
    });
    const [error, setError] = useState({
        distribution: null,
        workload: null,
        hierarchy: null,
        activities: null
    });
    const [data, setData] = useState({
        distribution: null,
        workload: null,
        hierarchy: null,
        activities: null
    });

    // Authentication token
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');

    // Headers for API requests
    const headers = {
        Authorization: `Bearer ${token}`
    };

    // Fetch lead distribution data
    const fetchDistribution = async () => {
        try {
            setLoading(prev => ({ ...prev, distribution: true }));
            setError(prev => ({ ...prev, distribution: null }));

            const response = await axios.get(`${API_BASE}/leads-distribution`, {
                headers,
                params: {
                    start_date: dateRange.start,
                    end_date: dateRange.end
                }
            });

            setData(prev => ({ ...prev, distribution: response.data }));
        } catch (err) {
            console.error("Error fetching distribution data:", err);
            setError(prev => ({ ...prev, distribution: err.message || "Failed to load distribution data" }));
        } finally {
            setLoading(prev => ({ ...prev, distribution: false }));
        }
    };

    // Fetch workload analysis data
    const fetchWorkload = async () => {
        try {
            setLoading(prev => ({ ...prev, workload: true }));
            setError(prev => ({ ...prev, workload: null }));

            const response = await axios.get(`${API_BASE}/workload-analysis`, {
                headers,
                params: {
                    start_date: dateRange.start,
                    end_date: dateRange.end
                }
            });

            setData(prev => ({ ...prev, workload: response.data }));
        } catch (err) {
            console.error("Error fetching workload data:", err);
            setError(prev => ({ ...prev, workload: err.message || "Failed to load workload data" }));
        } finally {
            setLoading(prev => ({ ...prev, workload: false }));
        }
    };

    // Fetch team hierarchy data
    const fetchHierarchy = async () => {
        try {
            setLoading(prev => ({ ...prev, hierarchy: true }));
            setError(prev => ({ ...prev, hierarchy: null }));

            const response = await axios.get(`${API_BASE}/team-hierarchy-report`, {
                headers
            });

            setData(prev => ({ ...prev, hierarchy: response.data }));
        } catch (err) {
            console.error("Error fetching hierarchy data:", err);
            setError(prev => ({ ...prev, hierarchy: err.message || "Failed to load hierarchy data" }));
        } finally {
            setLoading(prev => ({ ...prev, hierarchy: false }));
        }
    };

    // Fetch team activities data
    const fetchActivities = async () => {
        try {
            setLoading(prev => ({ ...prev, activities: true }));
            setError(prev => ({ ...prev, activities: null }));

            const response = await axios.get(`${API_BASE}/team-activities`, {
                headers,
                params: {
                    start_date: dateRange.start,
                    end_date: dateRange.end
                }
            });

            setData(prev => ({ ...prev, activities: response.data }));
        } catch (err) {
            console.error("Error fetching activities data:", err);
            setError(prev => ({ ...prev, activities: err.message || "Failed to load activities data" }));
        } finally {
            setLoading(prev => ({ ...prev, activities: false }));
        }
    };

    // Export assigned leads data
    const exportAssignedLeads = async () => {
        try {
            window.open(
                `${API_BASE}/assigned-leads-export/excel?start_date=${dateRange.start}&end_date=${dateRange.end}`,
                '_blank'
            );
        } catch (err) {
            console.error("Error exporting assigned leads:", err);
            // Display error notification
        }
    };

    // Refresh data based on active tab
    const refreshData = () => {
        switch (activeTab) {
            case "distribution":
                fetchDistribution();
                break;
            case "workload":
                fetchWorkload();
                break;
            case "hierarchy":
                fetchHierarchy();
                break;
            case "activities":
                fetchActivities();
                break;
            default:
                break;
        }
    };

    // Load data when tab or date range changes
    useEffect(() => {
        refreshData();
    }, [activeTab, dateRange]);

    // Tabs configuration
    const tabs = [
        { id: "distribution", label: "Lead Distribution", icon: FaChartBar },
        { id: "workload", label: "Staff Workload", icon: FaUsers },
        { id: "hierarchy", label: "Team Hierarchy", icon: FaUserTie },
        { id: "activities", label: "Team Activities", icon: FaCalendarAlt }
    ];

    return (
        <div className="w-full min-h-screen bg-gray-50 p-4 md:p-6">
            {/* Header with title and export button */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Lead Assignment Reports</h1>
                    <p className="text-gray-600 mt-1">
                        Comprehensive analysis of lead assignments and team performance
                    </p>
                </div>

                <div className="flex items-center space-x-3 mt-4 md:mt-0">
                    <button
                        onClick={exportAssignedLeads}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 text-sm"
                    >
                        <FaFileDownload />
                        <span>Export to Excel</span>
                    </button>

                    <button
                        onClick={refreshData}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 text-sm"
                        disabled={loading[activeTab]}
                    >
                        <FaSync className={loading[activeTab] ? "animate-spin" : ""} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Date range selector */}
            <div className="mb-6 bg-white rounded-lg shadow-sm border p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center space-x-2 mb-4 md:mb-0">
                        <FaFilter className="text-gray-500" />
                        <h3 className="text-lg font-medium">Date Range</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white rounded-lg shadow-sm border mb-6 overflow-x-auto">
                <div className="flex p-1 min-w-max">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id
                                ? "bg-blue-100 text-blue-700"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab content */}
            <div className="space-y-6">
                {/* Lead Distribution Tab */}
                {activeTab === "distribution" && (
                    <div>
                        {loading.distribution ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : error.distribution ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                                <p className="text-red-600">Error: {error.distribution}</p>
                                <button
                                    onClick={fetchDistribution}
                                    className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : data.distribution ? (
                            <div className="space-y-6">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    {[
                                        {
                                            title: "Total Leads",
                                            value: data.distribution.overall_stats?.total_leads || 0,
                                            color: "bg-blue-500"
                                        },
                                        {
                                            title: "Assigned Leads",
                                            value: data.distribution.overall_stats?.total_assigned || 0,
                                            color: "bg-green-500"
                                        },
                                        {
                                            title: "Assignment Rate",
                                            value: `${data.distribution.overall_stats?.assignment_rate || 0}%`,
                                            color: "bg-purple-500"
                                        },
                                        {
                                            title: "Conversion Rate",
                                            value: `${data.distribution.overall_stats?.conversion_rate || 0}%`,
                                            color: "bg-amber-500"
                                        }
                                    ].map((card, index) => (
                                        <div key={index} className="bg-white rounded-lg shadow-sm border p-4">
                                            <div className={`w-12 h-12 rounded-full ${card.color} bg-opacity-20 flex items-center justify-center mb-3`}>
                                                <div className={`w-6 h-6 rounded-full ${card.color}`}></div>
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-900">{card.value}</h3>
                                            <p className="text-sm text-gray-600">{card.title}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Daily Distribution Chart */}
                                <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Lead Distribution</h3>
                                    <div className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart
                                                data={data.distribution.daily_distribution}
                                                margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" angle={-45} textAnchor="end" height={70} />
                                                <YAxis />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend />
                                                <Area
                                                    type="monotone"
                                                    dataKey="total_leads"
                                                    name="Total Leads"
                                                    stroke={COLORS[0]}
                                                    fill={COLORS[0]}
                                                    fillOpacity={0.2}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="assigned_leads"
                                                    name="Assigned Leads"
                                                    stroke={COLORS[1]}
                                                    fill={COLORS[1]}
                                                    fillOpacity={0.2}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="converted_leads"
                                                    name="Converted Leads"
                                                    stroke={COLORS[2]}
                                                    fill={COLORS[2]}
                                                    fillOpacity={0.2}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Assignment & Conversion Rate Chart */}
                                <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment & Conversion Rates</h3>
                                    <div className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart
                                                data={data.distribution.daily_distribution}
                                                margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" angle={-45} textAnchor="end" height={70} />
                                                <YAxis />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend />
                                                <Line
                                                    type="monotone"
                                                    dataKey="assignment_rate"
                                                    name="Assignment Rate (%)"
                                                    stroke={COLORS[5]}
                                                    strokeWidth={2}
                                                    dot={{ r: 4 }}
                                                    activeDot={{ r: 6 }}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="conversion_rate"
                                                    name="Conversion Rate (%)"
                                                    stroke={COLORS[2]}
                                                    strokeWidth={2}
                                                    dot={{ r: 4 }}
                                                    activeDot={{ r: 6 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
                                <p className="text-gray-600">No data available. Please select a date range and refresh.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Staff Workload Tab */}
                {activeTab === "workload" && (
                    <div>
                        {loading.workload ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : error.workload ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                                <p className="text-red-600">Error: {error.workload}</p>
                                <button
                                    onClick={fetchWorkload}
                                    className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : data.workload ? (
                            <div className="space-y-6">
                                {/* Team Summary Chart */}
                                <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Workload Summary</h3>
                                    <div className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={data.workload.team_summary || []}
                                                margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="role" angle={-45} textAnchor="end" height={100} />
                                                <YAxis />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend />
                                                <Bar
                                                    dataKey="total_leads"
                                                    name="Total Leads"
                                                    fill={COLORS[0]}
                                                />
                                                <Bar
                                                    dataKey="converted_leads"
                                                    name="Converted Leads"
                                                    fill={COLORS[2]}
                                                />
                                                <Bar
                                                    dataKey="avg_leads_per_user"
                                                    name="Avg. Leads Per User"
                                                    fill={COLORS[4]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Staff Workload Table */}
                                <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Staff Workload Details</h3>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Staff Member
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Role
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Reports To
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Total Assigned
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Converted
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Pending
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Conversion Rate
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {(data.workload.staff_workload || []).map((staff, index) => (
                                                    <tr key={index} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                                                    <span className="text-sm font-medium text-gray-600">
                                                                        {staff.name?.charAt(0).toUpperCase() || "U"}
                                                                    </span>
                                                                </div>
                                                                <div className="ml-3">
                                                                    <p className="text-sm font-medium text-gray-900">{staff.name}</p>
                                                                    <p className="text-xs text-gray-500">{staff.email}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                            {staff.role_names?.join(", ") || "N/A"}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                            {staff.reports_to?.name || "N/A"}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                            {staff.workload?.total_assigned || 0}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-medium">
                                                            {staff.workload?.converted || 0}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-amber-600 font-medium">
                                                            {staff.workload?.pending || 0}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className="mr-2 h-2 w-16 bg-gray-200 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-green-500"
                                                                        style={{
                                                                            width: `${Math.min(staff.workload?.conversion_rate || 0, 100)}%`
                                                                        }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-xs font-medium text-gray-900">
                                                                    {staff.workload?.conversion_rate || 0}%
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Staff Recent Activities */}
                                <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Staff Activities</h3>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {(data.workload.staff_workload || [])
                                            .filter(staff => staff.recent_activities?.length > 0)
                                            .slice(0, 6)
                                            .map((staff, index) => (
                                                <div key={index} className="border rounded-lg p-3 bg-gray-50">
                                                    <div className="flex items-center mb-2">
                                                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                                            <span className="text-sm font-medium text-blue-600">
                                                                {staff.name?.charAt(0).toUpperCase() || "U"}
                                                            </span>
                                                        </div>
                                                        <div className="ml-2">
                                                            <p className="text-sm font-medium text-gray-900">{staff.name}</p>
                                                            <p className="text-xs text-gray-500">{staff.role_names?.[0] || "Staff"}</p>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        {staff.recent_activities?.slice(0, 3).map((activity, actIndex) => (
                                                            <div key={actIndex} className="bg-white p-2 rounded border text-xs">
                                                                <p className="font-medium">{activity.lead_name}</p>
                                                                <p className="text-gray-600">{activity.details || activity.action}</p>
                                                                <p className="text-gray-500 mt-1">
                                                                    {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : "N/A"}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
                                <p className="text-gray-600">No workload data available. Please select a date range and refresh.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Team Hierarchy Tab */}
                {activeTab === "hierarchy" && (
                    <div>
                        {loading.hierarchy ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : error.hierarchy ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                                <p className="text-red-600">Error: {error.hierarchy}</p>
                                <button
                                    onClick={fetchHierarchy}
                                    className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : data.hierarchy ? (
                            <div className="space-y-6">
                                {/* Role Performance Chart */}
                                <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Role Performance</h3>
                                    <div className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={data.hierarchy.role_metrics || []}
                                                margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                                                <YAxis />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend />
                                                <Bar
                                                    dataKey="user_count"
                                                    name="User Count"
                                                    fill={COLORS[0]}
                                                />
                                                <Bar
                                                    dataKey="total_leads"
                                                    name="Total Leads"
                                                    fill={COLORS[1]}
                                                />
                                                <Bar
                                                    dataKey="converted_leads"
                                                    name="Converted Leads"
                                                    fill={COLORS[2]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Role Conversion Rate Chart */}
                                <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Role Conversion Rates</h3>
                                    <div className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={data.hierarchy.role_metrics || []}
                                                margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                                                <YAxis />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend />
                                                <Bar
                                                    dataKey="conversion_rate"
                                                    name="Conversion Rate (%)"
                                                    fill={COLORS[5]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* User Stats Table */}
                                <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Member Performance</h3>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Name
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Roles
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Assigned Leads
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Converted Leads
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Conversion Rate
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {(data.hierarchy.user_stats || [])
                                                    .sort((a, b) => b.assigned_leads - a.assigned_leads)
                                                    .map((user, index) => (
                                                        <tr key={index} className="hover:bg-gray-50">
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                {user.name}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                {user.role_names?.join(", ") || "N/A"}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                                                {user.assigned_leads || 0}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600">
                                                                {user.converted_leads || 0}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                <div className="flex items-center">
                                                                    <div className="mr-2 h-2 w-16 bg-gray-200 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-green-500"
                                                                            style={{
                                                                                width: `${Math.min(user.conversion_rate || 0, 100)}%`
                                                                            }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className="text-xs font-medium text-gray-900">
                                                                        {user.conversion_rate || 0}%
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
                                <p className="text-gray-600">No hierarchy data available. Please refresh.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Team Activities Tab */}
                {activeTab === "activities" && (
                    <div>
                        {loading.activities ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : error.activities ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                                <p className="text-red-600">Error: {error.activities}</p>
                                <button
                                    onClick={fetchActivities}
                                    className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : data.activities ? (
                            <div className="space-y-6">
                                {/* Activity Metrics */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white rounded-lg shadow-sm border p-4">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Active Users</h3>
                                        <div className="space-y-3">
                                            {(data.activities.user_activity_counts || [])
                                                .sort((a, b) => b.total_activities - a.total_activities)
                                                .slice(0, 5)
                                                .map((user, index) => (
                                                    <div key={index} className="flex items-center justify-between">
                                                        <div className="flex items-center">
                                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white bg-${COLORS[index % COLORS.length]}`}>
                                                                <span>{index + 1}</span>
                                                            </div>
                                                            <div className="ml-3">
                                                                <p className="text-sm font-medium">{user.user_name}</p>
                                                                <p className="text-xs text-gray-500">
                                                                    {user.total_activities} activities
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs font-medium">
                                                                {user.assignments} assignments
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                {user.status_changes} status changes
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-lg shadow-sm border p-4 md:col-span-2">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Distribution</h3>
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={[
                                                            {
                                                                name: "Assignments",
                                                                value: (data.activities.activities || [])
                                                                    .filter(a => a.type === "lead_assignment").length
                                                            },
                                                            {
                                                                name: "Status Changes",
                                                                value: (data.activities.activities || [])
                                                                    .filter(a => a.type === "status_change").length
                                                            }
                                                        ]}
                                                        cx="50%"
                                                        cy="50%"
                                                        outerRadius={80}
                                                        dataKey="value"
                                                        label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                                                    >
                                                        <Cell fill={COLORS[0]} />
                                                        <Cell fill={COLORS[1]} />
                                                    </Pie>
                                                    <Tooltip />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>

                                {/* Activity Timeline */}
                                <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity Timeline</h3>
                                    <div className="overflow-y-auto max-h-96">
                                        <div className="space-y-4">
                                            {(data.activities.activities || []).map((activity, index) => (
                                                <div key={index} className="relative pl-8 pb-4">
                                                    <div className="absolute left-0 top-1 h-full w-0.5 bg-gray-200"></div>
                                                    <div className={`absolute left-0 top-1 w-4 h-4 rounded-full ${activity.type === "lead_assignment" ? "bg-blue-500" : "bg-green-500"
                                                        }`}></div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {activity.user_name} - {activity.lead_name}
                                                        </p>
                                                        <p className="text-xs text-gray-600 mt-1">
                                                            {activity.details}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : "N/A"}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
                                <p className="text-gray-600">No activity data available. Please select a date range and refresh.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
