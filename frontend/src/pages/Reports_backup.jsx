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
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then(setData)
      .catch(e => setError(e.toString()))
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

  const execPerf = useReportData("/executive-performance", { start, end });
  const regionSales = useReportData("/region-sales", { start, end });
  const franchiseProfits = useReportData("/franchise-profits", { start, end });

  // Create chart data with sample fallback
  const execPerfChartData = Array.isArray(execPerf.data) && execPerf.data.length > 0
    ? execPerf.data.map((row) => ({
      Executive: row.executive,
      "Total Leads": row.total_leads,
      Converted: row.converted,
    }))
    : [
      { Executive: "Sample Executive 1", "Total Leads": 45, Converted: 23 },
      { Executive: "Sample Executive 2", "Total Leads": 38, Converted: 19 },
      { Executive: "Sample Executive 3", "Total Leads": 52, Converted: 31 },
    ];

  const regionSalesChartData = Array.isArray(regionSales.data) && regionSales.data.length > 0
    ? regionSales.data.map((row) => ({
      Region: row.region,
      "Total Sales": row.total_sales,
    }))
    : [
      { Region: "North", "Total Sales": 125000 },
      { Region: "South", "Total Sales": 98000 },
      { Region: "East", "Total Sales": 87000 },
      { Region: "West", "Total Sales": 110000 },
    ];

  const franchiseProfitsChartData = Array.isArray(franchiseProfits.data) && franchiseProfits.data.length > 0
    ? franchiseProfits.data.map((row) => ({
      Franchise: row.franchise_id,
      Profit: row.profit,
    }))
    : [
      { Franchise: "FR001", Profit: 25000 },
      { Franchise: "FR002", Profit: 32000 },
      { Franchise: "FR003", Profit: 18000 },
      { Franchise: "FR004", Profit: 28000 },
    ];

  return (
    <section className="w-full px-4 py-12 bg-gradient-to-tr from-slate-50 via-white to-gray-100 min-h-screen flex flex-col items-center">
      {/* Modal for details */}
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

      {/* Executive Performance */}
      <motion.div
        className="mb-12 w-full max-w-4xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, type: "spring", stiffness: 120 }}
      >
        <h3 className="text-xl font-bold mb-6">Executive-wise Performance</h3>

        {/* Status and Debug Info */}
        {execPerf.loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-blue-600">Loading charts...</div>
          </div>
        )}

        {execPerf.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-500">Error loading data: {execPerf.error}</p>
          </div>
        )}

        {/* Always show chart */}
        <motion.div
          className="bg-white p-6 rounded-lg shadow-lg mb-6 overflow-x-auto border"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.18 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-700">Executive Performance Chart</h4>
            {(!Array.isArray(execPerf.data) || execPerf.data.length === 0) && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Sample Data</span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={execPerfChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="Executive"
                tick={{ fontSize: 12 }}
                stroke="#666"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#666"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              <Bar dataKey="Total Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Converted" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Data table - only show if we have real data */}
        {execPerf.data && execPerf.data.length > 0 && (
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
        )}
      </motion.div>

      {/* Region-wise Sales */}
      <motion.div
        className="mb-12 w-full max-w-4xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, type: "spring", stiffness: 120 }}
      >
        <h3 className="text-xl font-bold mb-6">Region-wise Sales</h3>

        {regionSales.loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-blue-600">Loading charts...</div>
          </div>
        )}

        {regionSales.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-500">Error loading data: {regionSales.error}</p>
          </div>
        )}

        {/* Always show chart */}
        <motion.div
          className="bg-white p-6 rounded-lg shadow-lg mb-6 overflow-x-auto border"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.22 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-700">Regional Sales Distribution</h4>
            {(!Array.isArray(regionSales.data) || regionSales.data.length === 0) && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Sample Data</span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={regionSalesChartData}
                nameKey="Region"
                dataKey="Total Sales"
                cx="50%"
                cy="50%"
                outerRadius={120}
                fill="#2563eb"
                label={({ Region, value }) => `${Region}: ${value}`}
                labelLine={false}
              >
                {regionSalesChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Data table - only show if we have real data */}
        {regionSales.data && regionSales.data.length > 0 && (
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
                  <th className="py-2 px-4 border-b">Total Sales</th>
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
                        body: `Total Sales: ${row.total_sales}`,
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
        )}
      </motion.div>

      {/* Franchise Profits */}
      <motion.div
        className="mb-12 w-full max-w-4xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, type: "spring", stiffness: 120 }}
      >
        <h3 className="text-xl font-bold mb-6">Franchise-wise Profit Summary</h3>

        {franchiseProfits.loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-blue-600">Loading charts...</div>
          </div>
        )}

        {franchiseProfits.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-500">Error loading data: {franchiseProfits.error}</p>
          </div>
        )}

        {/* Always show chart */}
        <motion.div
          className="bg-white p-6 rounded-lg shadow-lg mb-6 overflow-x-auto border"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.26 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-700">Franchise Profit Trends</h4>
            {(!Array.isArray(franchiseProfits.data) || franchiseProfits.data.length === 0) && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Sample Data</span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={franchiseProfitsChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="Franchise"
                tick={{ fontSize: 12 }}
                stroke="#666"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#666"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="Profit"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 6, fill: '#3b82f6' }}
                activeDot={{ r: 8, fill: '#1d4ed8' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Data table - only show if we have real data */}
        {franchiseProfits.data && franchiseProfits.data.length > 0 && (
          <motion.div
            className="overflow-x-auto rounded"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
          >
            <table className="min-w-full bg-white border rounded shadow-md">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">Franchise ID</th>
                  <th className="py-2 px-4 border-b">Profit</th>
                </tr>
              </thead>
              <tbody>
                {franchiseProfits.data.map((row, i) => (
                  <motion.tr
                    key={i}
                    whileHover={{ scale: 1.03, backgroundColor: "#f3e8ff" }}
                    className="cursor-pointer"
                    onClick={() =>
                      setModalData({
                        title: `Franchise: ${row.franchise_id}`,
                        body: `Profit: ${row.profit}`,
                      })
                    }
                  >
                    <td className="py-2 px-4 border-b">{row.franchise_id}</td>
                    <td className="py-2 px-4 border-b">{row.profit}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs text-gray-400 mt-1">Click any row for details</div>
          </motion.div>
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
    </section>
  );
}
