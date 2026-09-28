import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";


const API_URL = "https://cubehis.avopay.pro:5000/api/roles/";

// Each section defines which CRUD actions are relevant.
// Permissions stored as "module:action" strings, e.g. "leads:create".
const PERMISSION_SECTIONS = [
  { key: "dashboard", label: "Dashboard", actions: ["read"], group: "general" },
  // Hospital Clinical
  { key: "appointments", label: "Appointments", actions: ["create", "read", "update", "delete"], group: "hospital" },
  { key: "patients", label: "Patient Registration", actions: ["create", "read", "update", "delete"], group: "hospital" },
  { key: "opd", label: "OPD Management", actions: ["create", "read", "update", "delete"], group: "hospital" },
  { key: "ipd", label: "IPD / Ward", actions: ["create", "read", "update", "delete"], group: "hospital" },
  { key: "emr", label: "EMR / Prescriptions", actions: ["create", "read", "update", "delete"], group: "hospital" },
  { key: "nursing", label: "Nursing Station", actions: ["create", "read", "update", "delete"], group: "hospital" },
  { key: "ot", label: "OT Management", actions: ["create", "read", "update", "delete"], group: "hospital" },
  // Diagnostics & Pharmacy
  { key: "laboratory", label: "Laboratory", actions: ["create", "read", "update", "delete"], group: "hospital" },
  { key: "radiology", label: "Radiology", actions: ["create", "read", "update", "delete"], group: "hospital" },
  { key: "pharmacy", label: "Pharmacy", actions: ["create", "read", "update", "delete"], group: "hospital" },
  { key: "blood_bank", label: "Blood Bank", actions: ["create", "read", "update", "delete"], group: "hospital" },
  // Finance & Billing
  { key: "billing", label: "Billing & Revenue", actions: ["create", "read", "update", "delete"], group: "hospital" },
  // CRM / Leads
  { key: "leads", label: "Leads & CRM", actions: ["create", "read", "update", "delete"], group: "crm" },
  { key: "customers", label: "Customers", actions: ["create", "read", "update", "delete"], group: "crm" },
  // HR & Admin
  { key: "hr", label: "HR & Staff", actions: ["create", "read", "update", "delete"], group: "hospital" },
  { key: "users", label: "Users", actions: ["create", "read", "update", "delete"], group: "admin" },
  { key: "roles", label: "Roles", actions: ["create", "read", "update", "delete"], group: "admin" },
  // Other Modules
  { key: "inventory", label: "Inventory / Stock", actions: ["create", "read", "update", "delete"], group: "hospital" },
  { key: "tasks", label: "Tasks & Workflow", actions: ["create", "read", "update", "delete"], group: "general" },
  { key: "tickets", label: "Support Tickets", actions: ["create", "read", "update", "delete"], group: "general" },
  { key: "documents", label: "Documents", actions: ["create", "read", "update", "delete"], group: "general" },
  { key: "teleconsult", label: "Teleconsultation", actions: ["create", "read", "update", "delete"], group: "hospital" },
  { key: "loyalty", label: "Loyalty Platform", actions: ["create", "read", "update", "delete"], group: "crm" },
  { key: "franchise", label: "Franchise", actions: ["create", "read", "update", "delete"], group: "admin" },
  { key: "reports", label: "MIS Reports", actions: ["read"], group: "general" },
  { key: "admin", label: "Admin Panel", actions: ["read"], group: "admin" },
];

// All hospital-related permission keys (scoped to a single hospital)
const HOSPITAL_PERMISSION_SECTIONS = PERMISSION_SECTIONS.filter(s => s.group === "hospital");

// Normalize legacy flat permissions like "leads" → ["leads:create","leads:read",...]
function normalizeLegacyPermissions(perms) {
  const result = [];
  for (const p of perms) {
    if (p === '*') { result.push('*'); continue; }
    if (p.includes(':')) { result.push(p); continue; }
    const section = PERMISSION_SECTIONS.find(s => s.key === p);
    if (section) {
      section.actions.forEach(a => result.push(`${p}:${a}`));
    } else {
      result.push(p);
    }
  }
  return result;
}

const modalVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 70 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 340, damping: 30 } },
  exit: { opacity: 0, scale: 0.95, y: 40, transition: { duration: 0.18 } }
};

const toastVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } },
  exit: { opacity: 0, y: 40, transition: { duration: 0.2 } }
};

const errorAnim = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 210, damping: 18 } },
  exit: { opacity: 0, y: 10, transition: { duration: 0.2 } }
};

const tableRowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03, type: "spring", stiffness: 120, damping: 14 }
  }),
  exit: { opacity: 0, x: 20, transition: { duration: 0.16 } }
};

const RolePermissionsModal = ({ role, onClose, onSaved }) => {
  const isAdminRole = role.name && role.name.toLowerCase() === "admin";

  // Admin always has all permissions — locked
  const adminAllPerms = PERMISSION_SECTIONS.flatMap(s => s.actions.map(a => `${s.key}:${a}`));

  const [permissions, setPermissions] = useState(() =>
    isAdminRole ? adminAllPerms : normalizeLegacyPermissions(role.permissions || [])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const hasPerm = (key, action) =>
    isAdminRole || permissions.includes(`${key}:${action}`);

  const togglePerm = (key, action) => {
    if (isAdminRole) return; // admin locked
    const p = `${key}:${action}`;
    setPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const toggleSection = (section) => {
    if (isAdminRole) return;
    const all = section.actions.map(a => `${section.key}:${a}`);
    const allChecked = all.every(p => permissions.includes(p));
    if (allChecked) {
      setPermissions(prev => prev.filter(p => !all.includes(p)));
    } else {
      setPermissions(prev => {
        const next = [...prev];
        all.forEach(p => { if (!next.includes(p)) next.push(p); });
        return next;
      });
    }
  };

  const toggleAll = () => {
    if (isAdminRole) return;
    const allPerms = PERMISSION_SECTIONS.flatMap(s => s.actions.map(a => `${s.key}:${a}`));
    const allChecked = allPerms.every(p => permissions.includes(p));
    setPermissions(allChecked ? [] : allPerms);
  };

  // Select all hospital-scoped permissions (clinical, diagnostics, billing, HR, inventory)
  const selectAllHospitalPerms = () => {
    if (isAdminRole) return;
    const hospPerms = HOSPITAL_PERMISSION_SECTIONS.flatMap(s => s.actions.map(a => `${s.key}:${a}`));
    const dashPerms = ["dashboard:read"];
    const allHosp = [...new Set([...hospPerms, ...dashPerms])];
    const allChecked = allHosp.every(p => permissions.includes(p));
    if (allChecked) {
      setPermissions(prev => prev.filter(p => !allHosp.includes(p)));
    } else {
      setPermissions(prev => {
        const next = [...prev];
        allHosp.forEach(p => { if (!next.includes(p)) next.push(p); });
        return next;
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      if (!role.id) throw new Error("Role missing 'id'. Can't save.");
      const finalPerms = isAdminRole ? ["*"] : permissions;
      const res = await fetch(`${API_URL}${role.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
        },
        body: JSON.stringify({ permissions: finalPerms }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to save permissions");
      }
      setTimeout(() => setShowSuccessModal(true), 100);
    } catch (err) {
      setError(err.message || "Could not save permissions.");
    }
    setSaving(false);
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    onSaved && onSaved();
    onClose();
  };

  const allSelected = isAdminRole || PERMISSION_SECTIONS.flatMap(s => s.actions.map(a => `${s.key}:${a}`)).every(p => permissions.includes(p));
  const allHospSelected = HOSPITAL_PERMISSION_SECTIONS.flatMap(s => s.actions.map(a => `${s.key}:${a}`)).every(p => permissions.includes(p));

  // Group label colors
  const groupBadge = {
    hospital: "bg-green-100 text-green-700",
    admin: "bg-red-100 text-red-700",
    crm: "bg-blue-100 text-blue-700",
    general: "bg-gray-100 text-gray-600",
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2"
        initial="hidden" animate="visible" exit="exit" variants={modalVariants}
      >
        <motion.div
          className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl relative border border-blue-200 flex flex-col max-h-[92vh]"
          initial={{ scale: 0.88, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 230, damping: 20 } }}
          exit={{ scale: 0.95, opacity: 0, y: 20, transition: { duration: 0.18 } }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 shrink-0">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-bold text-blue-800">
                  Permissions — "{role.name}"
                </h3>
                {isAdminRole && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                    🔒 Super Admin — All Access
                  </span>
                )}
                {!isAdminRole && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                    🏥 Hospital-Scoped Role
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {isAdminRole
                  ? "Admin has all permissions by default and cannot be restricted."
                  : "Users with this role can only access data from their assigned hospital."}
              </p>
            </div>
            <button onClick={onClose} className="text-2xl text-gray-400 hover:text-red-500 font-bold leading-none">×</button>
          </div>

          {/* Quick Actions — only for non-admin */}
          {!isAdminRole && (
            <div className="px-4 sm:px-5 py-2 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-2 items-center shrink-0">
              <span className="text-xs text-gray-500 font-medium mr-1">Quick Select:</span>
              <button
                onClick={selectAllHospitalPerms}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${allHospSelected
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-green-700 border-green-400 hover:bg-green-50"
                  }`}
              >
                🏥 All Hospital Permissions
              </button>
              <button
                onClick={toggleAll}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${allSelected
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-blue-700 border-blue-400 hover:bg-blue-50"
                  }`}
              >
                ✅ Select All
              </button>
              <button
                onClick={() => setPermissions([])}
                className="px-3 py-1 rounded-lg text-xs font-semibold border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 transition"
              >
                ✕ Clear All
              </button>
            </div>
          )}

          {/* CRUD Table */}
          <div className="overflow-auto flex-1 p-3 sm:p-5">
            {isAdminRole && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium flex items-center gap-2">
                🔒 Admin role automatically has <strong>all permissions</strong> across all hospitals. This cannot be changed.
              </div>
            )}
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <th className="text-left p-2 sm:p-3 font-semibold text-blue-800 rounded-tl-lg min-w-[140px]">Module</th>
                  <th className="text-center p-2 sm:p-3 font-semibold text-gray-500 w-16">Scope</th>
                  <th className="text-center p-2 sm:p-3 font-semibold text-gray-600 w-16">
                    <span className="text-xs">All</span>
                  </th>
                  <th className="text-center p-2 sm:p-3 font-semibold text-green-700 w-16">Create</th>
                  <th className="text-center p-2 sm:p-3 font-semibold text-blue-600 w-16">Read</th>
                  <th className="text-center p-2 sm:p-3 font-semibold text-yellow-600 w-16">Update</th>
                  <th className="text-center p-2 sm:p-3 font-semibold text-red-600 rounded-tr-lg w-16">Delete</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_SECTIONS.map((section, idx) => {
                  const rowAllChecked = section.actions.every(a => hasPerm(section.key, a));
                  return (
                    <tr key={section.key} className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition`}>
                      <td className="p-2 sm:p-3 font-medium text-gray-800">{section.label}</td>
                      <td className="p-2 sm:p-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${groupBadge[section.group] || "bg-gray-100 text-gray-500"}`}>
                          {section.group === "hospital" ? "🏥" : section.group === "admin" ? "🔑" : section.group === "crm" ? "📋" : "⚙️"}
                        </span>
                      </td>
                      <td className="p-2 sm:p-3 text-center">
                        <input
                          type="checkbox"
                          checked={rowAllChecked}
                          onChange={() => toggleSection(section)}
                          className="w-4 h-4 cursor-pointer"
                          disabled={isAdminRole}
                        />
                      </td>
                      {['create', 'read', 'update', 'delete'].map(action => (
                        <td key={action} className="p-2 sm:p-3 text-center">
                          {section.actions.includes(action) ? (
                            <input
                              type="checkbox"
                              checked={hasPerm(section.key, action)}
                              onChange={() => togglePerm(section.key, action)}
                              className="w-4 h-4 cursor-pointer"
                              disabled={isAdminRole}
                            />
                          ) : (
                            <span className="text-gray-300 text-base">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-gray-100 shrink-0">
            {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
            <div className="flex gap-2 justify-between items-center">
              {!isAdminRole && (
                <span className="text-xs text-gray-500">
                  {permissions.length} permission{permissions.length !== 1 ? "s" : ""} selected
                </span>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition">Cancel</button>
                <motion.button
                  className="bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-lg px-5 py-2 shadow hover:from-blue-700 hover:to-blue-600 text-sm"
                  onClick={handleSave}
                  disabled={saving}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {saving ? "Saving..." : "Save Permissions"}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-60"
            initial="hidden" animate="visible" exit="exit" variants={modalVariants}
            key="success-modal"
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-xs sm:max-w-md p-6 shadow-2xl text-center border border-green-200"
              initial={{ scale: 0.85, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 230, damping: 20 } }}
              exit={{ scale: 0.95, opacity: 0, y: 20, transition: { duration: 0.18 } }}
            >
              <div className="text-5xl mb-3">✅</div>
              <h3 className="text-xl font-bold mb-2 text-green-800">Saved!</h3>
              <p className="text-gray-600 text-sm mb-5">
                Permissions for <span className="font-semibold text-green-700">"{role.name}"</span> updated successfully.
              </p>
              <motion.button
                className="bg-gradient-to-r from-green-600 to-green-400 text-white rounded-lg px-6 py-2 font-semibold hover:from-green-700 hover:to-green-500 shadow w-full"
                onClick={handleSuccessModalClose}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                Great!
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

function getIsAdmin() {
  let userObj = null;
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      userObj = JSON.parse(userStr);
    }
  } catch { }
  let roles = [];
  if (userObj && userObj.roles) {
    if (Array.isArray(userObj.roles)) {
      roles = userObj.roles.map(r => typeof r === 'string' ? r.toLowerCase() : (r.name || r.id || "").toLowerCase());
    } else if (typeof userObj.roles === 'string') {
      if (userObj.roles.includes(',')) {
        roles = userObj.roles.split(',').map(r => r.trim().toLowerCase());
      } else {
        roles = [userObj.roles.toLowerCase()];
      }
    }
  }
  return roles.includes('admin');
}

const RolesManagement = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newParentId, setNewParentId] = useState(""); // <-- Add state for parent role
  const [deleteRole, setDeleteRole] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [permRole, setPermRole] = useState(null);
  const [showRoleExistsModal, setShowRoleExistsModal] = useState(false);
  const [existingRoleName, setExistingRoleName] = useState("");

  const isAdmin = getIsAdmin();

  useEffect(() => {
    fetchRoles();
    // eslint-disable-next-line
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type }), 2100);
  };

  const fetchRoles = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch roles");
      const data = await res.json();
      setRoles(data);
    } catch (err) {
      setError("Could not load roles.");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const trimmedRoleName = newRoleName.trim();
    try {
      const payload = { name: trimmedRoleName };
      // Send report_to (not parent_id) to match backend
      if (newParentId) payload.report_to = newParentId;
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        if (
          res.status === 400 &&
          errData &&
          typeof errData.detail === "string" &&
          errData.detail.toLowerCase().includes("already exists")
        ) {
          setExistingRoleName(trimmedRoleName);
          setShowRoleExistsModal(true);
          setSaving(false);
          return;
        }
        throw new Error(errData.detail || "Failed to create role");
      }

      setShowCreate(false);
      setNewRoleName("");
      setNewParentId(""); // <-- Reset parent selection
      setError("");
      showToast("Role created successfully", "success");
      fetchRoles();
    } catch (err) {
      setError(err.message || "Could not create role.");
      showToast(err.message || "Could not create role.", "error");
    }
    setSaving(false);
  };

  const handleDeleteRole = async () => {
    if (!deleteRole) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}${deleteRole.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Could not delete role");
      }
      setShowDeleteModal(false);
      setDeleteRole(null);
      fetchRoles();
      showToast("Role deleted successfully", "success");
    } catch (err) {
      setError(err.message || "Could not delete role.");
      showToast(err.message || "Could not delete role.", "error");
    }
    setSaving(false);
  };

  return (
    <div className="p-2 sm:p-3 md:p-7">
      {/* Toast Message */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            className={`fixed top-6 left-1/2 z-50 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg text-white font-semibold
              ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={toastVariants}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 140, damping: 18 }}>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-2">
          <div className="w-full">
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 tracking-tight drop-shadow text-center sm:text-left mb-2">Roles Management</h2>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.98 }}
              className="bg-gradient-to-r from-blue-600 to-blue-400 text-white px-4 sm:px-6 py-2 rounded-lg shadow-md hover:from-blue-700 hover:to-blue-500 font-semibold transition w-full sm:w-auto"
              onClick={() => {
                setShowCreate(true);
                setError("");
              }}
            >
              + Create Role
            </motion.button>
          </div>
        </div>
        <div className="overflow-x-auto bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
          <table className="min-w-[350px] sm:min-w-[600px] md:min-w-[1000px] w-full text-xs sm:text-base">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-blue-100 text-left">
                <th className="p-2 sm:p-4 font-semibold text-blue-700">Role ID</th>
                <th className="p-2 sm:p-4 font-semibold text-blue-700">Role Name</th>
                <th className="p-2 sm:p-4 font-semibold text-blue-700">Scope</th>
                <th className="p-2 sm:p-4 font-semibold text-blue-700">Reports To</th>
                <th className="p-2 sm:p-4 font-semibold text-blue-700">Created</th>
                <th className="p-2 sm:p-4 font-semibold text-blue-700">Actions</th>
              </tr>
            </thead>
            <AnimatePresence>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-t animate-pulse">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="p-3 sm:p-4">
                          <div className="h-4 bg-gray-200 rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : error ? (
                  <tr><td colSpan={5} className="p-6 text-center text-red-500 font-medium">{error}</td></tr>
                ) : roles.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-4 text-center text-gray-400">
                      No roles found.
                    </td>
                  </tr>
                ) : roles.map((role, i) => {
                  // Find parent role name by id (support both parent_id and report_to)
                  const parentId = role.parent_id || role.report_to;
                  const parentRole = roles.find(r => r.id === parentId);
                  const isAdminRow = role.name && role.name.toLowerCase() === "admin";
                  return (
                    <motion.tr
                      key={role.id}
                      variants={tableRowVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      custom={i}
                      className="border-t hover:bg-blue-50 transition"
                    >
                      <td className="p-2 sm:p-4 text-xs sm:text-sm text-gray-700 font-mono break-all">{role.id}</td>
                      <td className="p-2 sm:p-4 font-semibold capitalize break-all">
                        {role.name}
                        {isAdminRow && <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">🔒 Super</span>}
                      </td>
                      <td className="p-2 sm:p-4">
                        {isAdminRow ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">All Hospitals</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">🏥 Hospital Only</span>
                        )}
                      </td>
                      <td className="p-2 sm:p-4 text-sm text-gray-600">
                        {parentRole ? `${parentRole.name} (${parentRole.id})` : <span className="italic text-gray-400">None</span>}
                      </td>
                      <td className="p-2 sm:p-4 text-xs text-gray-500 break-all">
                        {role.created_at ? new Date(role.created_at).toLocaleString() : ""}
                      </td>
                      <td className="p-2 sm:p-4 flex flex-col sm:flex-row flex-wrap gap-2">
                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white text-xs font-bold shadow transition"
                          onClick={() => setPermRole(role)}
                        >
                          {isAdminRow ? "🔒 View Permissions" : "Set Permissions"}
                        </motion.button>
                        {!isAdminRow && (
                          <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            className="px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-600 hover:text-white text-xs font-bold shadow transition"
                            onClick={() => {
                              setDeleteRole(role);
                              setShowDeleteModal(true);
                              setError("");
                            }}
                          >
                            Delete
                          </motion.button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </AnimatePresence>
          </table>
        </div>
      </motion.div>

      {/* Create Role Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            key="create-modal"
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-xs sm:max-w-md p-4 sm:p-7 shadow-2xl relative border border-blue-200"
              initial={{ scale: 0.85, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 230, damping: 20 } }}
              exit={{ scale: 0.95, opacity: 0, y: 20, transition: { duration: 0.18 } }}
            >
              <button
                onClick={() => {
                  setShowCreate(false);
                  setError("");
                  setNewParentId("");
                }}
                className="absolute top-2 right-3 text-2xl text-gray-400 hover:text-red-500 font-bold"
                aria-label="Close"
              >×</button>
              <h3 className="text-lg sm:text-xl font-bold mb-4 text-blue-800 text-center">Create New Role</h3>
              <form onSubmit={handleCreateRole} className="space-y-4">
                <div>
                  <label className="block text-sm mb-1 font-medium text-gray-700">Role Name</label>
                  <input
                    value={newRoleName}
                    onChange={e => setNewRoleName(e.target.value)}
                    className="border rounded-lg p-2 w-full"
                    placeholder="e.g. sales, admin, manager"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 font-medium text-gray-700">Senior Role (Optional)</label>
                  <select
                    value={newParentId}
                    onChange={e => setNewParentId(e.target.value)}
                    className="border rounded-lg p-2 w-full"
                  >
                    <option value="">-- No Senior Role --</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name} ({role.id})
                      </option>
                    ))}
                  </select>
                </div>
                <AnimatePresence>
                  {error && (
                    <motion.div
                      className="text-red-600 text-sm"
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      variants={errorAnim}
                      key="create-error"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-400 text-white font-semibold rounded-lg px-4 py-2 mt-2 shadow-sm hover:from-blue-700 hover:to-blue-500"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {saving ? "Saving..." : "Create Role"}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Role Modal */}
      <AnimatePresence>
        {showDeleteModal && deleteRole && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            key="delete-modal"
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-xs sm:max-w-md p-4 sm:p-7 shadow-2xl relative text-center border border-red-200"
              initial={{ scale: 0.85, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 230, damping: 20 } }}
              exit={{ scale: 0.95, opacity: 0, y: 20, transition: { duration: 0.18 } }}
            >
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteRole(null);
                  setError("");
                }}
                className="absolute top-2 right-3 text-2xl text-gray-400 hover:text-red-500 font-bold"
                aria-label="Close"
              >×</button>
              <div className="text-4xl mb-2 text-red-400 animate-pulse">⚠️</div>
              <h3 className="text-lg sm:text-xl font-bold mb-4 text-red-800">Delete Role</h3>
              <div className="mb-2 text-xs text-gray-600 break-all">
                Role ID: <span className="font-mono">{deleteRole.id}</span>
              </div>
              <p className="mb-6 text-gray-700">
                Are you sure you want to delete the role <span className="font-semibold">{deleteRole.name}</span>?
              </p>
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="text-red-600 text-sm mb-2"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={errorAnim}
                    key="delete-error"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <motion.button
                  className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 font-semibold shadow w-full sm:w-auto"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteRole(null);
                    setError("");
                  }}
                  disabled={saving}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  className="bg-red-600 text-white rounded-lg px-4 py-2 font-semibold hover:bg-red-700 shadow w-full sm:w-auto"
                  onClick={handleDeleteRole}
                  disabled={saving}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                >
                  {saving ? "Deleting..." : "Delete"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role Already Exists Modal */}
      <AnimatePresence>
        {showRoleExistsModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            key="role-exists-modal"
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-xs sm:max-w-md p-4 sm:p-7 shadow-2xl relative text-center border border-yellow-200"
              initial={{ scale: 0.85, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 230, damping: 20 } }}
              exit={{ scale: 0.95, opacity: 0, y: 20, transition: { duration: 0.18 } }}
            >
              <button
                onClick={() => {
                  setShowRoleExistsModal(false);
                  setExistingRoleName("");
                }}
                className="absolute top-2 right-3 text-2xl text-gray-400 hover:text-red-500 font-bold"
                aria-label="Close"
              >×</button>
              <div className="text-4xl mb-2 text-yellow-400">⚠️</div>
              <h3 className="text-lg sm:text-xl font-bold mb-4 text-yellow-800">Role Already Exists</h3>
              <p className="mb-6 text-gray-700">
                The role <span className="font-semibold text-yellow-700">"{existingRoleName}"</span> already exists in the system.
              </p>
              <p className="mb-6 text-sm text-gray-600">
                Please choose a different name for your new role.
              </p>
              <motion.button
                className="bg-gradient-to-r from-blue-600 to-blue-400 text-white rounded-lg px-6 py-2 font-semibold hover:from-blue-700 hover:to-blue-500 shadow w-full sm:w-auto"
                onClick={() => {
                  setShowRoleExistsModal(false);
                  setExistingRoleName("");
                }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                OK, Got It
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Permissions Modal */}
      {permRole && (
        <RolePermissionsModal
          role={permRole}
          onClose={() => setPermRole(null)}
          onSaved={fetchRoles}
        />
      )}
    </div>
  );
};

export default RolesManagement;