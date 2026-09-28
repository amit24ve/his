import { useState, useEffect } from "react";
import React from "react";
import Select from "react-select";
import { useNavigate } from "react-router-dom";

// --- COMPONENTS for Each Tab (AssignTaskTab updated at bottom) ---

function SuccessModal({ show, onClose, message }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-sm w-full text-center animate-fade-in">
        <div className="flex justify-center mb-4">
          <svg className="h-12 w-12 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} fill="none" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Success!</h2>
        <p className="text-gray-700 mb-4">{message}</p>
        <button
          className="px-5 py-2 rounded bg-green-600 hover:bg-green-700 text-white font-semibold mt-2"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}


function ProgressTrackerTab({ reports, employees }) {
  const [selectedReport, setSelectedReport] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const reportsPerPage = 10;
  const navigate = useNavigate();

  // Ensure reports is always an array
  const safeReports = Array.isArray(reports) ? reports : [];
  // Ensure employees is always an array
  const safeEmployees = Array.isArray(employees) ? employees : [];

  // Map employee_id to employee name
  const empMap = {};
  safeEmployees.forEach(emp => {
    empMap[emp.value] = emp.label;
  });

  // Filter reports by employee name or ID
  const filteredReports = safeReports.filter((r) => {
    const name = empMap[r.assigned_to || r.employee_id] || "";
    const empId = (r.assigned_to || r.employee_id || "").toLowerCase();
    return (
      empId.includes(searchTerm.toLowerCase()) ||
      name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredReports.length / reportsPerPage);
  const indexOfLast = currentPage * reportsPerPage;
  const indexOfFirst = indexOfLast - reportsPerPage;
  const currentReports = filteredReports.slice(indexOfFirst, indexOfLast);

  // Status card summary
  const countByStatus = (status) =>
    safeReports.filter((r) => r.status?.toLowerCase() === status).length;

  // Status color utility
  const statusClasses = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "approved":
        return "bg-green-100 text-green-700";
      case "completed":
        return "bg-gray-200 text-gray-800";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (

    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-yellow-100 rounded-xl p-4">
          <p className="text-yellow-700 font-semibold text-lg">Pending</p>
          <p className="text-2xl font-bold">{countByStatus("pending")}</p>
        </div>
        <div className="bg-blue-100 rounded-xl p-4">
          <p className="text-blue-700 font-semibold text-lg">In Progress</p>
          <p className="text-2xl font-bold">{countByStatus("approved")}</p>
        </div>
        <div className="bg-green-100 rounded-xl p-4">
          <p className="text-green-700 font-semibold text-lg">Completed</p>
          <p className="text-2xl font-bold">{countByStatus("completed")}</p>
        </div>
      </div>
      <div className="relative bg-white rounded-lg shadow p-5 mb-8">


        {/* Top Section: Heading + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Daily Work Report Tracker
          </h3>
          <input
            type="text"
            placeholder="Search by employee name or ID"
            className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition w-full sm:w-60"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset page when searching
            }}
          />
        </div>

        {/* Summary Cards */}


        {/* Table Section */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-blue-50 text-gray-700 text-sm">
                <th className="py-2 px-3 text-left">Date</th>
                <th className="py-2 px-3 text-left">Employee</th>
                <th className="py-2 px-3 text-left">Report</th>
                <th className="py-2 px-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {currentReports.length > 0 ? (
                currentReports.map((r, idx) => (
                  <tr key={r._id || r.report_id || idx} className="border-b last:border-b-0">
                    <td className="py-2 px-3">
                      {r.created_at
                        ? new Date(r.created_at).toLocaleDateString()
                        : r.date
                          ? new Date(r.date).toLocaleDateString()
                          : ""}
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => navigate(`/employee/${r.assigned_to || r.employee_id}`)}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {empMap[r.assigned_to || r.employee_id] || r.assigned_to || r.employee_id}
                      </button>
                    </td>
                    <td className="py-2 px-3 max-w-xs">
                      {(r.remarks || r.content || "").length > 20 ? (
                        <>
                          <span className="text-gray-700">
                            {(r.remarks || r.content).slice(0, 20)}...
                          </span>
                          <button
                            className="ml-2 text-blue-600 underline text-sm"
                            onClick={() => setSelectedReport(r)}
                          >
                            Read more
                          </button>
                        </>
                      ) : (
                        r.remarks || r.content || ""
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${statusClasses(r.status?.toLowerCase())}`}>
                        {r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : "Submitted"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-gray-500">
                    No reports found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-end mt-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-4 py-1 rounded border text-sm font-medium ${currentPage === 1
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-white hover:bg-gray-100 text-gray-800 border-gray-300"
                    }`}
                >
                  Previous
                </button>

                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-1 rounded border text-sm font-medium ${currentPage === totalPages
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-white hover:bg-gray-100 text-gray-800 border-gray-300"
                    }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal for full content */}
        {selectedReport && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-xl w-full relative">
              <h4 className="text-lg font-semibold mb-3 text-blue-800">
                Full Report from{" "}
                {empMap[selectedReport.assigned_to || selectedReport.employee_id] ||
                  selectedReport.assigned_to ||
                  selectedReport.employee_id}
              </h4>
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {selectedReport.remarks || selectedReport.content || ""}
              </p>
              <button
                onClick={() => setSelectedReport(null)}
                className="absolute top-2 right-2 text-gray-500 hover:text-red-500 text-xl font-bold"
              >
                &times;
              </button>
              <div className="mt-4 text-right">
                <button
                  onClick={() => setSelectedReport(null)}
                  className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}




function ApprovalsTab({ tasks, approveTask, loading, user }) {
  const [remarks, setRemarks] = useState("");
  return (
    <div className="bg-white rounded-lg shadow p-5 mb-8">
      <h3 className="text-lg font-semibold text-blue-700 mb-4 flex items-center gap-2">
        <svg className="h-6 w-6 text-yellow-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} fill="none" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
        </svg>
        Approvals Needed (Admin)
      </h3>
      <div>
        {tasks.filter(t => t.status === "pending").length === 0 ? (
          <p className="text-gray-500">No pending approvals.</p>
        ) : (
          <ul className="space-y-2">
            {tasks
              .filter(t => t.status === "pending")
              .map(t => (
                <li key={t.id} className="flex items-center gap-2">
                  <span className="font-medium">{t.title}</span>
                  <span className="text-gray-400">assigned to</span>
                  <span className="font-semibold">{t.assigned_to}</span>
                  <span className="text-gray-500 ml-2">[Due: {t.due_date}]</span>
                  <input
                    className="border rounded-md p-1 text-xs ml-2"
                    placeholder="Remarks"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                  />
                  <button
                    className="ml-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold transition"
                    onClick={() => {
                      approveTask(t.id, user, remarks, "approved");
                      setRemarks("");
                    }}
                    disabled={loading}
                  >
                    {loading ? "Approving..." : "Approve"}
                  </button>
                  <button
                    className="ml-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition"
                    onClick={() => {
                      approveTask(t.id, user, remarks, "rejected");
                      setRemarks("");
                    }}
                    disabled={loading}
                  >
                    {loading ? "Rejecting..." : "Reject"}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}



function NotificationTab({ notifications }) {
  const today = new Date().toISOString().slice(0, 10);
  const todaysNotifications = notifications.filter((n) => {
    if (n.date) return n.date === today;
    if (n.time && (n.time === "Just now" || n.time.includes("min ago"))) return true;
    if (n.time && /^\d{4}-\d{2}-\d{2}/.test(n.time)) return n.time.slice(0, 10) === today;
    return false;
  });

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h3 className="text-lg font-semibold text-blue-700 mb-4 flex items-center gap-2">
        <svg className="h-6 w-6 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        Notifications (Today)
      </h3>
      {todaysNotifications.length === 0 ? (
        <div className="text-gray-500">No notifications for today.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-blue-50 text-gray-700 text-sm">
                <th className="py-2 px-3 text-left">Message</th>
                <th className="py-2 px-3 text-left">Type</th>
                <th className="py-2 px-3 text-left">Time</th>
              </tr>
            </thead>
            <tbody>
              {todaysNotifications.map((n) => (
                <tr key={n.id} className="border-b last:border-b-0">
                  <td className="py-2 px-3">{n.message}</td>
                  <td className="py-2 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${n.type === "email" ? "bg-blue-100 text-blue-700" : n.type === "sms" ? "bg-green-100 text-green-700" : "bg-indigo-100 text-indigo-700"}`}>
                      {n.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2 px-3">{n.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const NAV_SECTIONS = [
  { key: "assign", name: "Assign Task" },
  { key: "tracker", name: "Progress Tracker" },
];

// --- AssignTaskTab (with employeeOptions and leadOptions passed as props) ---


function AssignTaskTab({
  newTask,
  handleTaskChange,
  addTask,
  loading,
  employeeOptions = [],
  leadOptions = [],
}) {
  // For compatibility, convert handleTaskChange to a callback for react-select
  const onSelectChange = (field) => (selected) => {
    handleTaskChange({
      target: { name: field, value: selected ? selected.value : "" }
    });
  };

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-6 sm:p-8 mb-8 border border-blue-100 transition">
      <h3 className="text-xl font-bold text-blue-800 flex items-center gap-3 mb-6">
        <span className="inline-flex items-center justify-center bg-blue-50 rounded-full p-2 shadow">
          <svg className="h-7 w-7 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} fill="none" />
          </svg>
        </span>
        Assign Task
      </h3>
      <form
        className="grid gap-4 sm:grid-cols-2 md:grid-cols-3"
        onSubmit={e => { e.preventDefault(); addTask(); }}
        autoComplete="off"
      >
        <div className="mb-4">
          <label
            className="block text-sm font-medium text-blue-900 mb-1"
            htmlFor="task-title"
          >
            Task Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
            id="task-title"
            name="title"
            value={newTask.title}
            onChange={handleTaskChange}
            placeholder="Enter task title"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-900 mb-1" htmlFor="task-assign">
            Assign To <span className="text-red-500">*</span>
          </label>
          <Select
            inputId="task-assign"
            classNamePrefix="react-select"
            options={employeeOptions}
            onChange={onSelectChange("assignedTo")}
            value={employeeOptions.find((opt) => opt.value === newTask.assignedTo) || null}
            placeholder="Search employee"
            isSearchable
            isClearable={false}
            required
            styles={{
              control: (base) => ({
                ...base,
                minHeight: "44px",
                borderRadius: "0.5rem",
                borderColor: "#cbd5e1",
                boxShadow: "none",
                background: "rgba(255,255,255,0.9)"
              }),
              menu: (base) => ({
                ...base,
                zIndex: 10
              })
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-900 mb-1" htmlFor="task-due">
            Due Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            className="w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
            id="task-due"
            name="due"
            value={newTask.due}
            onChange={handleTaskChange}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-900 mb-1" htmlFor="task-lead">
            Lead <span className="text-gray-400">(optional)</span>
          </label>
          <Select
            inputId="task-lead"
            classNamePrefix="react-select"
            options={leadOptions}
            onChange={onSelectChange("linkedId")}
            value={leadOptions.find((opt) => opt.value === newTask.linkedId) || null}
            placeholder="Search lead"
            isClearable
            isSearchable
            styles={{
              control: (base) => ({
                ...base,
                minHeight: "44px",
                borderRadius: "0.5rem",
                borderColor: "#cbd5e1",
                boxShadow: "none",
                background: "rgba(255,255,255,0.9)"
              }),
              menu: (base) => ({
                ...base,
                zIndex: 10
              })
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-900 mb-1" htmlFor="task-remarks">
            Remarks
          </label>
          <textarea
            className="w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 resize-y"
            id="task-remarks"
            name="remarks"
            value={newTask.remarks}
            onChange={handleTaskChange}
            placeholder="Remarks"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-900 mb-1" htmlFor="task-status">
            Status
          </label>
          <select
            id="task-status"
            name="status"
            className="w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
            value={newTask.status}
            onChange={handleTaskChange}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="col-span-full flex justify-end mt-2">
          <button
            type="submit"
            disabled={loading}
            className="text-white bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-purple-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center mb-2"
          >
            {loading ? "Adding..." : "Add Task"}
          </button>
        </div>
      </form>
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function TaskWorkflowManagement() {
  const [activeTab, setActiveTab] = useState("assign");
  const [tasks, setTasks] = useState([]);
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [leadOptions, setLeadOptions] = useState([]);
  const [newTask, setNewTask] = useState({
    title: "",
    assignedTo: "",
    due: "",
    linkedType: "",
    linkedId: "",
    remarks: "",
    status: "pending",
  });
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [dailyReports, setDailyReports] = useState([]);

  // Simulate login user (replace by your auth/user system)
  const user = "amit24ve";

  // Fetch all tasks, employees, and leads on load
  useEffect(() => {
    fetchTasks();
    fetchEmployees();
    fetchLeads();
    fetchDailyReports();
    // eslint-disable-next-line
  }, []);

  // Fetch Employees
  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch("https://cubehis.avopay.pro:5000/api/auth/users", {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setEmployeeOptions(
        Array.isArray(data) ? data.map(user => ({
          value: user.username || user.username,
          label: `${user.username} (${user.username})`
        })) : []
      );
    } catch (e) {
      console.error('Error fetching employees:', e);
      setEmployeeOptions([]);
    }
  };
  const fetchDailyReports = async () => {
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch("https://cubehis.avopay.pro:5000/api/tasks/", {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      // Ensure data is always an array
      setDailyReports(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching daily reports:', e);
      setDailyReports([]);
    }
  };

  // Fetch Leads
  const fetchLeads = async () => {
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch("https://cubehis.avopay.pro:5000/api/lead/leads?limit=1000", {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      const leadsArr = data.data || [];
      setLeadOptions(
        Array.isArray(leadsArr) ? leadsArr.map(lead => ({
          value: lead.lead_id,
          label: `${lead.name} - ${lead.phone} (${lead.lead_id})`
        })) : []
      );
    } catch (e) {
      console.error('Error fetching leads:', e);
      setLeadOptions([]);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch("https://cubehis.avopay.pro:5000/api/tasks/", {
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
      });
      if (!res.ok) throw new Error("Failed to fetch tasks.");
      let data = await res.json();
      // Ensure data is always an array
      if (!Array.isArray(data)) {
        data = [];
      }
      const mapped = data.map(t => ({
        ...t,
        id: t.id || t._id || (t._id && t._id.$oid) || undefined,
        due_date: t.due_date
          ? typeof t.due_date === "string"
            ? t.due_date.slice(0, 10)
            : t.due_date.$date
              ? t.due_date.$date.slice(0, 10)
              : ""
          : "",
        created_at: t.created_at
          ? typeof t.created_at === "string"
            ? t.created_at
            : t.created_at.$date
              ? t.created_at.$date.slice(0, 19).replace("T", " ")
              : ""
          : "",
        approved_at: t.approved_at
          ? typeof t.approved_at === "string"
            ? t.approved_at
            : t.approved_at.$date
              ? t.approved_at.$date.slice(0, 10)
              : ""
          : "",
      }));
      setTasks(mapped);
    } catch (e) {
      console.error('Error fetching tasks:', e);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskChange = (e) => {
    const { name, value } = e.target;
    setNewTask((prev) => ({ ...prev, [name]: value }));
  };

  const addTask = async () => {
    if (!newTask.title || !newTask.assignedTo || !newTask.due) return;
    setLoading(true);
    try {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8);
      const taskPayload = {
        title: newTask.title,
        assigned_to: newTask.assignedTo,
        due_date: newTask.due,
        status: newTask.status,
        linked_type: newTask.linkedType || undefined,
        linked_id: newTask.linkedId || undefined,
        created_by: user,
        remarks: newTask.remarks || undefined,
      };
      const res = await fetch("https://cubehis.avopay.pro:5000/api/tasks/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
        },
        body: JSON.stringify(taskPayload),
      });
      if (!res.ok) throw new Error("Failed to add task");
      await fetchTasks();
      setNotifications((prev) => [
        {
          id: Date.now(),
          message: `Task '${taskPayload.title}' assigned to ${taskPayload.assigned_to}.`,
          type: "mobile",
          time: `${todayStr} ${timeStr}`,
          date: todayStr,
        },
        ...prev,
      ]);
      setNewTask({
        title: "",
        assignedTo: "",
        due: "",
        linkedType: "",
        linkedId: "",
        remarks: "",
        status: "pending",
      });
      setShowSuccess(true);
    } catch (e) {
      alert("Failed to add task");
    }
    setLoading(false);
  };

  // Update task status: PATCH /api/tasks/{task_id}/status
  const updateTaskStatus = async (taskId, status, approvedBy, remarks) => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8);
      const patchPayload = {
        status,
        approved_by: approvedBy,
        remarks: remarks || undefined,
      };
      await fetch(`https://cubehis.avopay.pro:5000/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
        },
        body: JSON.stringify(patchPayload),
      });
      await fetchTasks();
      setNotifications((prev) => [
        {
          id: Date.now(),
          message: `Task ${status} by ${approvedBy}.`,
          type: status === "approved" ? "email" : "sms",
          time: `${todayStr} ${timeStr}`,
          date: todayStr,
        },
        ...prev,
      ]);
    } catch (e) {
      alert(`Failed to update task status to ${status}`);
    }
    setLoading(false);
  };

  // For ApprovalsTab: wrapper for updateTaskStatus with "approved" or "rejected"
  const approveTask = async (taskId, approvedBy, remarks, status = "approved") => {
    await updateTaskStatus(taskId, status, approvedBy, remarks);
  };

  return (
    <div className="bg-gray-50 min-h-screen py-8 px-2 sm:px-6 lg:px-8 font-sans">

      <SuccessModal
        show={showSuccess}
        onClose={() => setShowSuccess(false)}
        message="Task added successfully!"
      />
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-700 mb-1">Task & Workflow Management</h2>
          <p className="text-gray-500 text-base">
            Assign tasks, track progress, manage approvals, and stay notified.
          </p>
        </div>
        <div className="border-b border-gray-200 bg-white mb-8">
          <nav className="-mb-px flex flex-wrap sm:flex-row sm:space-x-3 overflow-x-auto scrollbar-hide">
            {NAV_SECTIONS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`${activeTab === tab.key
                  ? 'border-b-2 border-blue-500 text-blue-700 font-semibold'
                  : 'border-b-2 border-transparent text-gray-700 hover:text-blue-600 hover:border-blue-300'
                  } whitespace-nowrap py-3 px-3 font-medium text-base text-left transition focus:outline-none`}
                style={{ minWidth: 120 }}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
        {loading && <div className="p-4 text-center">Loading...</div>}
        {!loading && activeTab === "assign" && (
          <AssignTaskTab
            newTask={newTask}
            handleTaskChange={handleTaskChange}
            addTask={addTask}
            loading={loading}
            employeeOptions={employeeOptions}
            leadOptions={leadOptions}
          />
        )}
        {!loading && activeTab === "tracker" && (
          <ProgressTrackerTab reports={dailyReports}
            employees={employeeOptions} />
        )}
        {!loading && activeTab === "approvals" && (
          <ApprovalsTab tasks={tasks} approveTask={approveTask} loading={loading} user={user} />
        )}
        {!loading && activeTab === "notification" && (
          <NotificationTab notifications={notifications} />
        )}
      </div>
    </div>
  );
}