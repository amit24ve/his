import React, { useState } from "react";
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

import { motion, AnimatePresence } from "framer-motion";

const API_BASE = "https://cubehis.avopay.pro:5000/api/reports";
const COLORS = ["#2563eb", "#10b981", "#f59e42", "#ef4444", "#6366f1", "#c026d3"];

function useReportData(endpoint, params = {}) {
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let url = new URL(API_BASE + endpoint);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    setLoading(true);
    setError(null);

    console.log(`Fetching data from: ${url.toString()}`);

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(response => {
        console.log(`Response from ${endpoint}:`, response);

        // Check if API response has a 'data' property, which is common in REST APIs
        if (response && response.data) {
          setData(response.data);
        } else {
          // If not, use the whole response as data
          setData(response);
        }
      })
      .catch(e => {
        console.error(`Error fetching ${endpoint}:`, e);
        setError(e.toString());
      })
      .finally(() => setLoading(false));
  }, [endpoint, JSON.stringify(params)]);

  return { data, loading, error };
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
  const [leadAssignmentView, setLeadAssignmentView] = useState('individual'); // 'individual', 'role', or 'hierarchy'

  const execPerf = useReportData("/executive-performance", { start, end });
  const regionSales = useReportData("/region-sales", { start, end });
  const franchiseProfits = useReportData("/franchise-profits", { start, end });
  const leadAssignments = useReportData("/lead-assignments", { start, end }); // New endpoint for lead assignments

  const execPerfChartData = Array.isArray(execPerf.data) && execPerf.data.length > 0
    ? execPerf.data.map((row) => ({
      Executive: row.executive,
      "Total Leads": row.total_leads,
      Converted: row.converted,
    }))
    : [];

  const regionSalesChartData = Array.isArray(regionSales.data) && regionSales.data.length > 0
    ? regionSales.data.map((row) => ({
      Region: row.region,
      "Total Sales": row.total_sales,
    }))
    : [];

  const franchiseProfitsChartData = Array.isArray(franchiseProfits.data) && franchiseProfits.data.length > 0
    ? franchiseProfits.data.map((row) => ({
      Franchise: row.franchise_id,
      Profit: row.profit,
    }))
    : [];

  // Lead Assignment chart data
  const leadAssignmentChartData = Array.isArray(leadAssignments.data) && leadAssignments.data.length > 0
    ? leadAssignments.data.map((row) => ({
      Assignee: row.assignee_name,
      "Assigned": row.assigned_count,
      "Pending": row.pending_count || 0,
      "Processed": row.processed_count || 0,
      "Role": row.role_name,
      "ReportsTo": row.reports_to || "None",
      "HierarchyLevel": row.hierarchy_level || getHierarchyLevelFromRole(row.role_name)
    }))
    : [];

  // Helper function to determine hierarchy level based on role name
  function getHierarchyLevelFromRole(roleName) {
    if (!roleName) return 4; // Default level
    const role = roleName.toLowerCase();
    if (role.includes('admin')) return 1;
    if (role.includes('manager')) return 2;
    if (role.includes('executive')) return 3;
    if (role.includes('team member')) return 3;
    return 4; // Other roles
  }

  return (
    <section className="w-full px-4 py-12 bg-gradient-to-tr from-slate-50 via-white to-gray-100 min-h-screen flex flex-col items-center">
      {/* Modal for details (example: show more info when row clicked) */}
      <Modal open={!!modalData} onClose={() => setModalData(null)}>
        {modalData && (
          <div>
            <h2 className="text-xl font-bold text-indigo-600 mb-2">{modalData.title}</h2>
            <div className="text-gray-700 text-base whitespace-pre-line">{modalData.body}</div>
          </div>
        )}
      </Modal>

      {/* Header */}
      <motion.div
        className="flex justify-center items-center w-full mb-12"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 20 }}
      >
        <div className="bg-white rounded-3xl shadow-xl max-w-3xl w-full px-8 py-10 text-center border border-gray-100">
          <div className="flex justify-center mb-6">
            <motion.svg
              className="w-16 h-16 text-blue-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 48 48"
              initial={{ scale: 0.85, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 220, damping: 12 }}
            >
              <rect x="6" y="12" width="36" height="24" rx="4" fill="#dbeafe" />
              <path d="M12 30V18M20 30V24M28 30V22M36 30V14" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
            </motion.svg>
          </div>
          <motion.h2
            className="text-3xl sm:text-4xl font-extrabold text-blue-600 mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            Reports & Analytics
          </motion.h2>
          <motion.p
            className="text-lg text-gray-600 mb-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Gain actionable insights with dashboards. Track executive performance, franchise profitability, regional sales, and export reports with powerful filters—all in one platform.
          </motion.p>
        </div>
      </motion.div>

      {/* Date filter */}
      <motion.div
        className="my-10 flex gap-4 flex-wrap items-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <label className="font-semibold text-gray-600">
          Start: <input type="date" value={start} max={end} onChange={e => setStart(e.target.value)} className="border rounded px-2 py-1 ml-2" />
        </label>
        <label className="font-semibold text-gray-600">
          End: <input type="date" value={end} min={start} max={`${yyyy}-${mm}-${dd}`} onChange={e => setEnd(e.target.value)} className="border rounded px-2 py-1 ml-2" />
        </label>
      </motion.div>

      {/* Executive Performance Table Only */}
      <motion.div
        className="mb-12 w-full max-w-4xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, type: "spring", stiffness: 120 }}
      >
        <h3 className="text-xl font-bold mb-2">Executive-wise Performance</h3>
        {execPerf.loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-blue-600">Loading data...</div>
          </div>
        ) : execPerf.error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-500">Error loading data: {execPerf.error}</p>
          </div>
        ) : execPerf.data && execPerf.data.length > 0 ? (
          <motion.div
            className="overflow-x-auto rounded"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <table className="min-w-full bg-white border rounded shadow-md">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">Executive</th>
                  <th className="py-2 px-4 border-b">Total Leads</th>
                  <th className="py-2 px-4 border-b">Converted</th>
                  <th className="py-2 px-4 border-b">Qualified</th>
                  <th className="py-2 px-4 border-b">Lost</th>
                </tr>
              </thead>
              <tbody>
                {execPerf.data.map((row, i) => (
                  <motion.tr
                    key={i}
                    whileHover={{ scale: 1.03, backgroundColor: "#e0e7ff" }}
                    className="cursor-pointer"
                    onClick={() =>
                      setModalData({
                        title: `Executive: ${row.executive}`,
                        body: `Total Leads: ${row.total_leads}\nConverted: ${row.converted}`,
                      })
                    }
                  >
                    <td className="py-2 px-4 border-b">{row.executive}</td>
                    <td className="py-2 px-4 border-b text-center">{row.total_leads}</td>
                    <td className="py-2 px-4 border-b text-center">{row.converted}</td>
                    <td className="py-2 px-4 border-b text-center">{row.qualified}</td>
                    <td className="py-2 px-4 border-b text-center">{row.lost}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs text-gray-400 mt-1">Click any row for details</div>
          </motion.div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-500">No executive performance data available for the selected date range.</p>
          </div>
        )}
      </motion.div>

      {/* Region-wise Leads Table Only */}
      <motion.div
        className="mb-12 w-full max-w-4xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, type: "spring", stiffness: 120 }}
      >
        <h3 className="text-xl font-bold mb-6">Region-wise Leads</h3>
        {regionSales.loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-blue-600">Loading data...</div>
          </div>
        ) : regionSales.error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-500">Error loading data: {regionSales.error}</p>
          </div>
        ) : regionSales.data && regionSales.data.length > 0 ? (
          <motion.div
            className="overflow-x-auto rounded"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
          >
            <table className="min-w-full bg-white border rounded shadow-md">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">Region</th>
                  <th className="py-2 px-4 border-b">Total Leads</th>
                </tr>
              </thead>
              <tbody>
                {regionSales.data.map((row, i) => (
                  <motion.tr
                    key={i}
                    whileHover={{ scale: 1.03, backgroundColor: "#f0fdf4" }}
                    className="cursor-pointer"
                    onClick={() =>
                      setModalData({
                        title: `Region: ${row.region}`,
                        body: `Total Leads: ${row.total_sales}`,
                      })
                    }
                  >
                    <td className="py-2 px-4 border-b">{row.region}</td>
                    <td className="py-2 px-4 border-b">{row.total_sales}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs text-gray-400 mt-1">Click any row for details</div>
          </motion.div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-500">No regional sales data available for the selected date range.</p>
          </div>
        )}
      </motion.div>



      {/* Lead Assignments Table Only */}
      <motion.div
        className="mb-12 w-full max-w-4xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, type: "spring", stiffness: 120 }}
      >
        <h3 className="text-xl font-bold">Lead Assignment Distribution</h3>
        {leadAssignments.loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-blue-600">Loading data...</div>
          </div>
        ) : leadAssignments.error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-500">Error loading data: {leadAssignments.error}</p>
          </div>
        ) : leadAssignments.data && leadAssignments.data.length > 0 ? (
          <motion.div
            className="overflow-x-auto rounded"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
          >
            <table className="min-w-full bg-white border rounded shadow-md">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">Assignee</th>
                  <th className="py-2 px-4 border-b">Role</th>
                  <th className="py-2 px-4 border-b">Reports To</th>
                  <th className="py-2 px-4 border-b">Assigned</th>
                  <th className="py-2 px-4 border-b">Pending</th>
                  <th className="py-2 px-4 border-b">Processed</th>
                </tr>
              </thead>
              <tbody>
                {leadAssignments.data.map((row, i) => (
                  <motion.tr
                    key={i}
                    whileHover={{ scale: 1.03, backgroundColor: "#e0f2fe" }}
                    className="cursor-pointer"
                    onClick={() =>
                      setModalData({
                        title: `Assignee: ${row.assignee_name}`,
                        body: `Role: ${row.role_name}\nReports To: ${row.reports_to || 'None'}\nTotal Assigned: ${row.assigned_count}\nPending: ${row.pending_count || 0}\nProcessed: ${row.processed_count || 0}`,
                      })
                    }
                  >
                    <td className="py-2 px-4 border-b">{row.assignee_name}</td>
                    <td className="py-2 px-4 border-b">{row.role_name}</td>
                    <td className="py-2 px-4 border-b">{row.reports_to || 'None'}</td>
                    <td className="py-2 px-4 border-b text-center">{row.assigned_count}</td>
                    <td className="py-2 px-4 border-b text-center">{row.pending_count || 0}</td>
                    <td className="py-2 px-4 border-b text-center">{row.processed_count || 0}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs text-gray-400 mt-1">Click any row for details</div>
          </motion.div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-500">No lead assignment data available for the selected date range.</p>
          </div>
        )}
      </motion.div>

      {/* MIS Download Links */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.13 }}
      >
        <h3 className="text-xl font-bold mb-2">Download Daily MIS</h3>
        <a
          href={`${API_BASE}/mis/daily/excel?date=${end}`}
          className="text-blue-600 underline font-medium"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download Excel
        </a>
        {" | "}
        <a
          href={`${API_BASE}/mis/daily/pdf?date=${end}`}
          className="text-blue-600 underline font-medium"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download PDF
        </a>
      </motion.div>
      {/* Animations for fade/pop */}
      <style>
        {`
          .fade-in {
            animation: fade-in 0.3s cubic-bezier(.4,0,.2,1);
          }
          @keyframes fade-in {
            0% { opacity: 0; transform: scale(0.96); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}
      </style>
    </section>
  );
}
