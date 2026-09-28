import React, { useState, useEffect } from "react";
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
  Cell
} from "recharts";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { FaUsers, FaChartBar, FaTasks, FaSync, FaFilter, FaDownload } from "react-icons/fa";

const API_BASE = "https://cubehis.avopay.pro:5000/api/assigned-leads";
const COLORS = ["#2563eb", "#10b981", "#f59e42", "#ef4444", "#6366f1", "#c026d3"];

function useAssignedLeadsData() {
  const [data, setData] = React.useState({
    statistics: null,
    hierarchy: [],
    users: null,
    recentAssignments: []
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      console.log('Fetching assigned leads data...');

      // Fetch statistics
      const statsResponse = await axios.get(`${API_BASE}/statistics`, { headers });

      // Fetch hierarchy  
      const hierarchyResponse = await axios.get(`${API_BASE}/hierarchy`, { headers });

      // Fetch users by role
      const usersResponse = await axios.get(`${API_BASE}/users`, { headers });

      console.log('Statistics:', statsResponse.data);
      console.log('Hierarchy:', hierarchyResponse.data);
      console.log('Users:', usersResponse.data);

      setData({
        statistics: statsResponse.data.statistics || {},
        hierarchy: hierarchyResponse.data.hierarchy || [],
        users: usersResponse.data.users_by_role || {},
        recentAssignments: statsResponse.data.statistics?.recent_assignments || []
      });
    } catch (e) {
      console.error('Error fetching assigned leads data:', e);
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}

function Modal({ open, onClose, children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-2 p-8 border flex flex-col max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 text-xl font-bold text-gray-400 hover:text-gray-700"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Reports() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const [start, setStart] = useState(`${yyyy}-${mm}-01`);
  const [end, setEnd] = useState(`${yyyy}-${mm}-${dd}`);
  const [modalData, setModalData] = useState(null);
  const [reportView, setReportView] = useState('overview'); // 'overview', 'assignments', 'performance'
  const [currentUser, setCurrentUser] = useState(null);

  const assignedLeadsData = useAssignedLeadsData();

  useEffect(() => {
    // Get current user from localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);
  }, []);

  // Process data for charts
  const processedData = React.useMemo(() => {
    if (!assignedLeadsData.data.statistics) return { overview: [], roleDistribution: [], userPerformance: [] };

    const { statistics, hierarchy, users } = assignedLeadsData.data;

    // Overview statistics
    const overviewData = [
      { name: 'Total Leads', value: statistics.total_leads || 0, color: COLORS[0] },
      { name: 'Assigned Leads', value: statistics.assigned_leads || 0, color: COLORS[1] },
      { name: 'Unassigned Leads', value: statistics.unassigned_leads || 0, color: COLORS[3] }
    ];

    // Role distribution data
    const roleDistributionData = statistics.leads_by_role ?
      Object.entries(statistics.leads_by_role).map(([roleName, roleData]) => ({
        role: roleName,
        count: roleData.count || 0,
        users: roleData.users || 0,
        efficiency: roleData.count > 0 ? Math.round((roleData.count / roleData.users) * 100) / 100 : 0
      })) : [];

    // User performance data from hierarchy
    const userPerformanceData = hierarchy.map(user => ({
      name: user.name || 'Unknown',
      role: user.role_name || 'Unknown',
      subordinates: user.subordinates?.length || 0,
      level: user.level || 0,
      assignedLeads: user.assigned_leads_count || 0,
      canAssign: (user.subordinates?.length || 0) > 0
    }));

    return {
      overview: overviewData,
      roleDistribution: roleDistributionData,
      userPerformance: userPerformanceData
    };
  }, [assignedLeadsData.data]);

  const handleRefresh = () => {
    assignedLeadsData.refetch();
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Lead Assignment Reports</h1>
            <p className="text-gray-600">Comprehensive analytics for lead distribution and team performance</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleRefresh}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              disabled={assignedLeadsData.loading}
            >
              <FaSync className={assignedLeadsData.loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex space-x-1 p-1">
          {[
            { id: 'overview', label: 'Overview', icon: FaChartBar },
            { id: 'assignments', label: 'Assignments', icon: FaTasks },
            { id: 'performance', label: 'Performance', icon: FaUsers }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setReportView(id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${reportView === id
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modal for details */}
      <Modal open={!!modalData} onClose={() => setModalData(null)}>
        {modalData && (
          <div>
            <h2 className="text-xl font-bold text-indigo-600 mb-2">{modalData.title}</h2>
            <div className="text-gray-700 text-base whitespace-pre-line">{modalData.body}</div>
          </div>
        )}
      </Modal>

      {/* Content based on selected view */}
      {assignedLeadsData.loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : assignedLeadsData.error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600">Error loading data: {assignedLeadsData.error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overview Tab */}
          {reportView === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Statistics Cards */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Distribution Overview</h3>
                <div className="grid grid-cols-3 gap-4">
                  {processedData.overview.map((stat, index) => (
                    <div key={index} className="text-center">
                      <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2`}
                        style={{ backgroundColor: `${stat.color}20` }}>
                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: stat.color }}></div>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                      <div className="text-sm text-gray-600">{stat.name}</div>
                    </div>
                  ))}
                </div>
                {assignedLeadsData.data.statistics && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      Assignment Rate: <span className="font-semibold text-green-600">
                        {Math.round(assignedLeadsData.data.statistics.assignment_rate)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Pie Chart */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={processedData.overview}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {processedData.overview.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Role Distribution Chart */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Leads by Role</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={processedData.roleDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="role" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill={COLORS[1]} name="Assigned Leads" />
                    <Bar dataKey="users" fill={COLORS[0]} name="Users" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Assignments Tab */}
          {reportView === 'assignments' && (
            <div className="space-y-6">
              {/* Recent Assignments */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Assignments</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Lead Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assigned To
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {assignedLeadsData.data.recentAssignments?.slice(0, 10).map((assignment, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {assignment.name || 'Unknown Lead'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {assignment.assigned_to_display || assignment.assigned_to || 'Unassigned'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${assignment.status === 'converted' ? 'bg-green-100 text-green-800' :
                              assignment.status === 'qualified' ? 'bg-blue-100 text-blue-800' :
                                assignment.status === 'contacted' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                              }`}>
                              {assignment.status || 'New'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {assignment.updated_at ? new Date(assignment.updated_at).toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Performance Tab */}
          {reportView === 'performance' && (
            <div className="space-y-6">
              {/* User Performance Chart */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Performance</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={processedData.userPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="assignedLeads" fill={COLORS[1]} name="Assigned Leads" />
                    <Bar dataKey="subordinates" fill={COLORS[0]} name="Subordinates" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* User Performance Table */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Details</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assigned Leads
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Subordinates
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Can Assign
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {processedData.userPerformance.map((user, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {user.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.role}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {user.assignedLeads}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {user.subordinates}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.canAssign ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                              {user.canAssign ? 'Yes' : 'No'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
