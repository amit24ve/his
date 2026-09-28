import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

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

// ---- Utility functions ----
function calculateDays(start, end) {
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "N/A";
    const diffTime = endDate - startDate;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  } catch {
    return "N/A";
  }
}

function formatDate(dateStr) {
  try {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) throw new Error("Invalid Date");
    return date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return "Invalid Date";
  }
}

function isOnLeave(start, end, status) {
  if (status !== "approved") return false;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return false;
    return startDate <= today && today <= endDate;
  } catch {
    return false;
  }
}

// ---- Stat Card Component ----
const StatCard = ({ label, value, color, onClick, isActive }) => (
  <div
    style={{
      background: isActive ? "#f0f6ff" : "#fff",
      borderRadius: "15px",
      boxShadow: "0 2px 12px #e6e9f0",
      padding: "20px 20px 20px 20px",
      minWidth: "180px",
      flex: "1 1 220px",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      justifyContent: "center",
      marginBottom: "12px",
      cursor: "pointer",
      border: isActive ? `2px solid ${color}` : "2px solid transparent",
      transition: "background 0.18s, border 0.18s",
      userSelect: "none",
    }}
    onClick={onClick}
    tabIndex={0}
    role="button"
    aria-pressed={isActive}
    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { onClick(); } }}
  >
    <div style={{ color: "#495057", fontSize: "1.1rem", marginBottom: "12px" }}>{label}</div>
    <span style={{ color, fontWeight: 700, fontSize: "2rem", lineHeight: 1 }}>{value}</span>
  </div>
);

// ---- Confirm and Modal Components ----
function ConfirmCard({ open, action, leave, onCancel, onConfirm, rejectReason, setRejectReason, loading }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="w-full max-w-md p-6 bg-white rounded-2xl shadow-2xl flex flex-col items-center"
            role="dialog"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
          >
            <div className="text-4xl mb-4">{action === "approved" ? "✅" : "❌"}</div>
            <h2 id="confirm-title" className="text-xl font-semibold text-gray-900 mb-3 text-center">
              {action === "approved" ? "Approve Leave Request?" : "Reject Leave Request?"}
            </h2>
            <div id="confirm-desc" className="text-sm text-gray-600 mb-5 text-center space-y-2">
              <div>
                <span className="font-medium">Employee ID:</span>{" "}
                <span className="font-mono">{leave?.employee_id || "N/A"}</span>
              </div>
              <div>
                <span className="font-medium">Dates:</span>{" "}
                {leave?.start_date && leave?.end_date
                  ? `${formatDate(leave.start_date)} → ${formatDate(leave.end_date)}`
                  : "N/A"}
              </div>
              <div>
                <span className="font-medium">Days:</span>{" "}
                {leave?.start_date && leave?.end_date
                  ? calculateDays(leave.start_date, leave.end_date)
                  : "N/A"}
              </div>
              <div>
                <span className="font-medium">Reason:</span> {leave?.reason || "N/A"}
              </div>
            </div>
            {action === "rejected" && (
              <div className="w-full mb-4">
                <label htmlFor="reject-reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Rejection
                </label>
                <textarea
                  id="reject-reason"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please provide a reason for rejecting this leave"
                  required
                  autoFocus
                />
              </div>
            )}
            <div className="flex gap-3 w-full">
              <button
                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-white shadow-sm transition duration-150 ${action === "approved"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                onClick={onConfirm}
                disabled={loading || (action === "rejected" && !rejectReason.trim())}
                aria-label={action === "approved" ? "Confirm approval" : "Confirm rejection"}
              >
                {loading ? (
                  <svg
                    className="animate-spin h-5 w-5 mx-auto"
                    xmlns="https://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                ) : action === "approved" ? "Approve" : "Reject"}
              </button>
              <button
                className="flex-1 px-4 py-2 rounded-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 shadow-sm transition duration-150"
                onClick={onCancel}
                aria-label="Cancel action"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Modal({ open, onClose, status, message }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-white p-6 rounded-2xl shadow-2xl min-w-[300px] max-w-sm flex flex-col items-center"
            role="dialog"
            aria-labelledby="modal-title"
            aria-describedby="modal-desc"
          >
            <div className="text-4xl mb-4">
              {status === "success" ? (
                <span role="img" aria-label="success">✅</span>
              ) : status === "error" ? (
                <span role="img" aria-label="error">❌</span>
              ) : (
                <span role="img" aria-label="info">ℹ️</span>
              )}
            </div>
            <h2 id="modal-title" className="text-lg font-semibold text-gray-900 mb-3 text-center">
              {status === "success" ? "Success" : status === "error" ? "Error" : "Info"}
            </h2>
            <p id="modal-desc" className="text-sm text-gray-600 mb-5 text-center">
              {message}
            </p>
            <button
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition duration-150"
              onClick={onClose}
              aria-label="Close modal"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---- Main Component ----
const API_BASE = "https://cubehis.avopay.pro:5000/api/staff/";

const LeaveRequestCard = ({ onBackToLeaveTab }) => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("start_date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [updatingId, setUpdatingId] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const navigate = useNavigate();

  const [resultModal, setResultModal] = useState({
    open: false,
    status: "info",
    message: "",
  });

  const [confirmCard, setConfirmCard] = useState({
    open: false,
    leave: null,
    action: "",
  });

  const [rejectReason, setRejectReason] = useState("");

  // Track which card is active for filtering (null = all)
  // options: null, "all", "pending", "approved", "on_leave"

  const [activeCard, setActiveCard] = useState("all");

  useEffect(() => {
    fetch(`${API_BASE}leave-requests`, {
      headers: getAuthHeaders()
    })
      .then((res) => res.json())
      .then((data) => {
        setLeaveRequests(data);
        setFilteredRequests(data);
      })
      .catch(() => {
        setResultModal({
          open: true,
          status: "error",
          message: "Failed to fetch leave requests.",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  // Card click handler
  const handleCardClick = type => {
    setActiveCard(type);
    if (type === "all") {
      setStatusFilter("all");
    } else if (type === "pending") {
      setStatusFilter("pending");
    } else if (type === "approved") {
      setStatusFilter("approved");
    } else if (type === "on_leave") {
      setStatusFilter("on_leave");
    }
  };

  useEffect(() => {
    let result = [...leaveRequests];

    // Filter by search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (req) =>
          (req.employee_id && req.employee_id.toLowerCase().includes(q)) ||
          (req.reason && req.reason.toLowerCase().includes(q)) ||
          (req.status && req.status.toLowerCase().includes(q))
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      if (statusFilter === "on_leave") {
        result = result.filter((req) => isOnLeave(req.start_date, req.end_date, req.status));
      } else {
        result = result.filter((req) => req.status?.toLowerCase() === statusFilter);
      }
    }

    // Sort
    result.sort((a, b) => {
      const aValue = sortBy === "start_date" ? new Date(a.start_date) : a.employee_id;
      const bValue = sortBy === "start_date" ? new Date(b.start_date) : b.employee_id;
      if (sortBy === "start_date") {
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      }
      return sortOrder === "asc"
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    setFilteredRequests(result);
  }, [search, statusFilter, sortBy, sortOrder, leaveRequests]);

  // Handler to open confirm modal (just opens modal, no loading state)
  const askConfirmation = (leave, action) => {
    setConfirmCard({
      open: true,
      leave,
      action,
    });
    if (action === "rejected") setRejectReason("");
  };

  // Handler to actually update status
  const handleConfirmed = async () => {
    if (confirmCard.leave && confirmCard.action) {
      setConfirmLoading(true);
      setUpdatingId(confirmCard.leave.employee_id); // <-- Set updatingId here!
      await handleStatus(
        confirmCard.leave,
        confirmCard.action,
        confirmCard.action === "rejected" ? rejectReason : ""
      );
      setUpdatingId(null);
      setConfirmLoading(false);
    }
    setConfirmCard({ open: false, leave: null, action: "" });
  };

  // Remove setUpdatingId from handleStatus (it's now in handleConfirmed)
  const handleStatus = async (leave, newStatus, rejectReasonArg = "") => {
    const employeeId = leave.employee_id;
    if (!employeeId) {
      setResultModal({
        open: true,
        status: "error",
        message: "Error: Invalid employee ID.",
      });
      return;
    }
    const idx = leaveRequests.findIndex((req) => req.employee_id === employeeId);
    const oldRequest = leaveRequests[idx];

    setLeaveRequests((prev) =>
      prev.map((req) =>
        req.employee_id === employeeId ? { ...req, status: newStatus, message: rejectReasonArg } : req
      )
    );

    const payload = {
      status: newStatus,
      employee_id: leave.employee_id,
    };
    if (newStatus === "rejected") payload.message = rejectReasonArg;

    try {
      const res = await fetch(`${API_BASE}leave-requests/${employeeId}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }
      const updated = await res.json();
      setLeaveRequests((prev) =>
        prev.map((req) => (req.employee_id === employeeId ? updated : req))
      );
      setResultModal({
        open: true,
        status: "success",
        message:
          newStatus === "approved"
            ? `Leave approved for Employee ID ${employeeId}`
            : `Leave rejected for Employee ID ${employeeId}. Reason: ${rejectReasonArg}`,
      });
    } catch (e) {
      setLeaveRequests((prev) => prev.map((req, i) => (i === idx ? oldRequest : req)));
      setResultModal({
        open: true,
        status: "error",
        message: "Failed to update status.",
      });
    }
    setRejectReason("");
  };

  // ---- Stat Card Calculations ----
  const total = leaveRequests.length;
  const pending = leaveRequests.filter(l => l.status === "pending").length;
  const approved = leaveRequests.filter(l => l.status === "approved").length;
  const onLeave = leaveRequests.filter(l => isOnLeave(l.start_date, l.end_date, l.status)).length;

  // ---- Table Layout ----
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-gray-100 min-h-screen">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-full sm:w-auto px-4 py-2 mb-2 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition duration-150"
        onClick={() => { navigate(-1) }}
        aria-label="Back to Leave Tab"

      >
        ← Back to Dashboard
      </motion.button>
      <div className="relative mb-8">
        <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-blue-100 bg-gradient-to-br from-indigo-100 via-blue-50 to-white px-8 py-12 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          {/* Decorative SVG background */}
          <svg className="absolute -top-10 -right-10 w-50 h-50 opacity-20 pointer-events-none select-none" viewBox="0 0 320 320" fill="none" xmlns="https://www.w3.org/2000/svg">
            <circle cx="220" cy="100" r="120" fill="#6366f1" fillOpacity="0.13" />
            <circle cx="300" cy="200" r="60" fill="#3b82f6" fillOpacity="0.10" />
            <rect x="40" y="220" width="120" height="40" rx="20" fill="#a5b4fc" fillOpacity="0.12" />
          </svg>
          <div className="flex flex-col md:flex-row items-center gap-6 w-full z-10">
            <span className="inline-flex items-center justify-center rounded-full bg-white/80 shadow-lg p-5 border-2 border-indigo-200">
              <svg className="w-16 h-16 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="#e0e7ff" />
                <path d="M16 3v4M8 3v4" stroke="#6366f1" strokeWidth="2" />
                <path d="M3 9h18" stroke="#6366f1" strokeWidth="2" />
              </svg>
            </span>
            <div className="flex flex-col items-center md:items-start">
              <h1 className="text-5xl font-extrabold text-blue-900 tracking-tight leading-tight drop-shadow-md text-center md:text-left">
                Leave Requests
              </h1>
              <div className="text-indigo-500 text-lg md:text-xl font-semibold mt-2 text-center md:text-left tracking-wide">
                Modern Employee Leave Management
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={resultModal.open}
        status={resultModal.status}
        message={resultModal.message}
        onClose={() => setResultModal({ ...resultModal, open: false })}
      />
      <ConfirmCard
        open={confirmCard.open}
        action={confirmCard.action}
        leave={confirmCard.leave}
        onCancel={() => setConfirmCard({ open: false, leave: null, action: "" })}
        onConfirm={handleConfirmed}
        rejectReason={rejectReason}
        setRejectReason={setRejectReason}
        loading={confirmLoading}
      />

      {/* ---- Stat Cards ---- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <StatCard
          label="Leave Applications"
          value={total}
          color="#3b5bdb"
          onClick={() => handleCardClick("all")}
          isActive={activeCard === "all"}
        />
        <StatCard
          label="Pending Applications"
          value={pending}
          color="#fd7e14"
          onClick={() => handleCardClick("pending")}
          isActive={activeCard === "pending"}
        />
        <StatCard
          label="Approved Applications"
          value={approved}
          color="#12b886"
          onClick={() => handleCardClick("approved")}
          isActive={activeCard === "approved"}
        />
        <StatCard
          label="Employees On Leave"
          value={onLeave}
          color="#a259e6"
          onClick={() => handleCardClick("on_leave")}
          isActive={activeCard === "on_leave"}
        />
      </div>

      {/* ---- Table ---- */}
      <motion.div
        className="bg-white rounded-xl shadow-lg p-0 overflow-x-auto"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {loading ? (
          <motion.div
            className="text-center py-12 text-gray-500 text-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            Loading leave requests...
          </motion.div>
        ) : filteredRequests.length === 0 ? (
          <motion.div
            className="text-center py-12 text-gray-500 text-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            No leave requests found.
          </motion.div>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-left">Sr </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-left">Employee</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-left">Leave Application</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-left">Dates</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-left">Leave</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-left">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((request, idx) => (
                  <tr key={request.employee_id + request.start_date + request.end_date}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">{idx + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-blue-700 hover:underline cursor-pointer">
                      <span onClick={() => navigate(`/employee/${request.employee_id}`)}>
                        {request.employee_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">{request.reason}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {formatDate(request.start_date)} — {formatDate(request.end_date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {calculateDays(request.start_date, request.end_date)} Day/s
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full capitalize ${request.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : request.status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                        }`}>
                        {request.status}
                        {isOnLeave(request.start_date, request.end_date, request.status) && " (On Leave)"}
                      </span>
                      {request.status === "rejected" && request.message && (
                        <div className="text-xs text-red-600 mt-1">
                          <span className="font-medium">Reason:</span> {request.message}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {request.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1 rounded-md bg-green-600 text-white hover:bg-green-700 text-xs font-bold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed relative"
                            onClick={() => askConfirmation(request, "approved")}
                            disabled={updatingId === request.employee_id || confirmLoading}
                            aria-label={`Approve leave for employee ${request.employee_id}`}
                          >
                            {(updatingId === request.employee_id && confirmLoading) ? (
                              <svg
                                className="animate-spin h-4 w-4 text-white"
                                xmlns="https://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                              </svg>
                            ) : (
                              "Accept"
                            )}
                          </button>
                          <button
                            className="px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 text-xs font-bold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed relative"
                            onClick={() => askConfirmation(request, "rejected")}
                            disabled={updatingId === request.employee_id || confirmLoading}
                            aria-label={`Reject leave for employee ${request.employee_id}`}
                          >
                            {(updatingId === request.employee_id && confirmLoading) ? (
                              <svg
                                className="animate-spin h-4 w-4 text-white"
                                xmlns="https://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                              </svg>
                            ) : (
                              "Reject"
                            )}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default LeaveRequestCard;