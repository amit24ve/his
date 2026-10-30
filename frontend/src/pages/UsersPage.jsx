import React, { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

function getIsAdmin() {
  try {
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    // Check username directly
    const uname = (userObj.username || '').toLowerCase();
    if (uname === 'admin' || uname.includes('admin')) return true;
    // Check role_name field
    const roleName = (userObj.role_name || userObj.role || '').toLowerCase();
    if (roleName.includes('admin')) return true;
    // Check roles array
    const roles = Array.isArray(userObj.roles)
      ? userObj.roles.map(r => (typeof r === 'string' ? r : r.name || '').toLowerCase())
      : typeof userObj.roles === 'string' ? [userObj.roles.toLowerCase()] : [];
    return roles.some(r => r.includes('admin'));
  } catch { return false; }
}

function getIsSuperAdmin() {
  try {
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const roles = Array.isArray(userObj.roles)
      ? userObj.roles.map(r => (typeof r === 'string' ? r : r.name || '').toLowerCase())
      : typeof userObj.roles === 'string' ? [userObj.roles.toLowerCase()] : [];
    return roles.includes('superadmin') || roles.includes('super_admin');
  } catch { return false; }
}

function getCurrentUserId() {
  try {
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    return userObj.id || userObj.user_id || null;
  } catch { return null; }
}

function getCurrentUserRoleIds() {
  try {
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    if (Array.isArray(userObj.role_ids) && userObj.role_ids.length > 0) return userObj.role_ids;
    return [];
  } catch { return []; }
}

const initialNewUser = {
  username: "",
  full_name: "",
  email: "",
  password: "",
  is_active: true,
  roles: [],
};

const permissionId = item => item?.key || item?.id || "";
const cleanPermissionList = value => Array.isArray(value) ? value.filter(Boolean) : [];

function mergeAdminPermissions(users, admins) {
  if (!Array.isArray(admins) || admins.length === 0) return users;
  const byKey = new Map();
  admins.forEach(admin => {
    [admin.id, admin.user_id, admin.username, admin.email].filter(Boolean).forEach(key => {
      byKey.set(String(key), admin);
    });
  });
  return users.map(user => {
    const match = [user.id, user.user_id, user.username, user.email]
      .filter(Boolean)
      .map(key => byKey.get(String(key)))
      .find(Boolean);
    return match
      ? {
        ...user,
        admin_permissions: cleanPermissionList(match.admin_permissions),
        is_hospital_admin: true,
      }
      : user;
  });
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

const cardVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 80 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 340, damping: 30 } },
  exit: { opacity: 0, scale: 0.95, y: 60, transition: { duration: 0.2 } }
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

const iconToneClasses = {
  blue: "text-blue-600 hover:bg-blue-100 border-blue-100",
  indigo: "text-indigo-600 hover:bg-indigo-100 border-indigo-100",
  amber: "text-amber-600 hover:bg-amber-100 border-amber-100",
  red: "text-red-600 hover:bg-red-100 border-red-100",
  green: "text-green-600 hover:bg-green-100 border-green-100",
  slate: "text-slate-600 hover:bg-slate-100 border-slate-100",
};

function IconActionButton({ title, icon, tone = "blue", disabled = false, loading = false, onClick }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled || loading}
      onClick={onClick}
      className={`h-9 w-9 inline-flex items-center justify-center rounded-md border bg-white text-sm shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${iconToneClasses[tone] || iconToneClasses.blue}`}
    >
      <i className={`fas ${loading ? "fa-spinner fa-spin" : `fa-${icon}`}`} />
    </button>
  );
}

const UserProfiles = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const didMount = useRef(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [roles, setRoles] = useState([]);
  const [newUser, setNewUser] = useState(initialNewUser);
  const [actionLoading, setActionLoading] = useState("");
  const [modal, setModal] = useState({ show: false, title: "", message: "", type: "success" });
  const [deactivateCard, setDeactivateCard] = useState({ show: false, user: null });
  const [deleteCard, setDeleteCard] = useState({ show: false, user: null });
  const [editingRolesUser, setEditingRolesUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editUserData, setEditUserData] = useState({
    full_name: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    role_ids: []
  });
  const [hospitals, setHospitals] = useState([]);
  const [assignHospitalCard, setAssignHospitalCard] = useState({ show: false, user: null, selectedHospitalId: "" });
  const [assignHospitalLoading, setAssignHospitalLoading] = useState(false);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [adminPermissionUser, setAdminPermissionUser] = useState(null);
  const [adminPermissionDraft, setAdminPermissionDraft] = useState([]);
  const [adminPermissionSaving, setAdminPermissionSaving] = useState(false);
  const [adminPermissionError, setAdminPermissionError] = useState("");

  const isAdmin = getIsAdmin();
  const isSuperAdmin = getIsSuperAdmin();
  const currentUserId = getCurrentUserId();
  const currentUserRoleIds = getCurrentUserRoleIds();

  // Memoize roles map for fast lookup — avoids O(n) find on every row render
  const rolesMap = useMemo(() => {
    const map = {};
    roles.forEach(r => { map[r.id] = r.name; });
    return map;
  }, [roles]);

  const permissionsByGroup = useMemo(() => {
    return availablePermissions.reduce((acc, item) => {
      const group = item.group || "Other";
      acc[group] = acc[group] || [];
      acc[group].push(item);
      return acc;
    }, {});
  }, [availablePermissions]);

  useEffect(() => {
    const token = localStorage.getItem("access_token") || "";
    const headers = { Authorization: `Bearer ${token}` };

    // Parallel fetch — all 3 at once instead of sequential
    const fetchAll = async () => {
      setLoading(true);
      setError("");
      try {
        const promises = [
          fetch("https://cubehis.avopay.pro:5000/api/auth/users/", { headers }),
          fetch("https://cubehis.avopay.pro:5000/api/roles/", { headers }),
        ];
        if (isAdmin) promises.push(fetch("https://cubehis.avopay.pro:5000/api/hospitals/", { headers }));

        const results = await Promise.all(promises);
        const [usersRes, rolesRes, hospitalsRes] = results;

        if (usersRes.ok) {
          let data = await usersRes.json();
          if (isSuperAdmin) {
            const [permissionsRes, adminsRes] = await Promise.all([
              fetch("https://cubehis.avopay.pro:5000/api/super-admin/permissions", { headers }),
              fetch("https://cubehis.avopay.pro:5000/api/super-admin/admins", { headers }),
            ]);
            if (permissionsRes.ok) {
              const permissionsData = await permissionsRes.json();
              setAvailablePermissions(permissionsData.permissions || []);
            }
            if (adminsRes.ok) {
              const adminsData = await adminsRes.json();
              data = mergeAdminPermissions(data, adminsData.admins || []);
            }
          }
          setUsers(data);
        } else {
          setError("Could not load users.");
        }
        if (rolesRes.ok) {
          const data = await rolesRes.json();
          setRoles(data);
        }
        if (hospitalsRes && hospitalsRes.ok) {
          const data = await hospitalsRes.json();
          setHospitals(Array.isArray(data) ? data : (data.hospitals || []));
        }
      } catch {
        setError("Could not load users.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();

    // Auto-open create form if navigated from HR module or if 'create' param is present
    if (searchParams.get('create') === 'true' || location.state?.openCreate) {
      setShowCreate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Run only on mount — searchParams handled separately below

  const showModal = (title, message, type = "success") => {
    setModal({ show: true, title, message, type });
    setTimeout(() => setModal({ show: false, title: "", message: "", type }), 2200);
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("https://cubehis.avopay.pro:5000/api/auth/users/", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` }
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      let data = await res.json();
      if (isSuperAdmin) {
        const adminsRes = await fetch("https://cubehis.avopay.pro:5000/api/super-admin/admins", {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` }
        });
        if (adminsRes.ok) {
          const adminsData = await adminsRes.json();
          data = mergeAdminPermissions(data, adminsData.admins || []);
        }
      }
      setUsers(data);
    } catch {
      setError("Could not load users.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHospitals = async () => {
    try {
      const res = await fetch("https://cubehis.avopay.pro:5000/api/hospitals/", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setHospitals(Array.isArray(data) ? data : (data.hospitals || []));
    } catch { }
  };

  const handleAssignHospital = async () => {
    if (!assignHospitalCard.user) return;
    setAssignHospitalLoading(true);
    try {
      const userId = assignHospitalCard.user.id || assignHospitalCard.user.user_id;
      const hospital = hospitals.find(h => (h._id || h.id) === assignHospitalCard.selectedHospitalId);
      const res = await fetch(`https://cubehis.avopay.pro:5000/api/auth/users/${userId}/hospital`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
        },
        body: JSON.stringify({ hospital_id: assignHospitalCard.selectedHospitalId, hospital_name: hospital?.name || "" })
      });
      if (!res.ok) {
        const err = await res.json();
        showModal("Failed", err.detail || "Failed to assign hospital", "error");
      } else {
        showModal("Success", "Hospital assigned successfully", "success");
        fetchUsers();
      }
    } catch {
      showModal("Failed", "Could not assign hospital", "error");
    }
    setAssignHospitalLoading(false);
    setAssignHospitalCard({ show: false, user: null, selectedHospitalId: "" });
  };

  const handleRemoveHospital = async (user) => {
    const userId = user.id || user.user_id;
    try {
      const res = await fetch(`https://cubehis.avopay.pro:5000/api/auth/users/${userId}/hospital`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` }
      });
      if (!res.ok) {
        const err = await res.json();
        showModal("Failed", err.detail || "Failed to remove hospital", "error");
      } else {
        showModal("Success", "Hospital removed successfully", "success");
        fetchUsers();
      }
    } catch {
      showModal("Failed", "Could not remove hospital", "error");
    }
  };

  function renderRoles(user) {
    if (Array.isArray(user.roles) && user.roles.length > 0) {
      return user.roles.map(role => {
        if (typeof role === "string") return rolesMap[role] || role;
        // For object roles: look up by id in rolesMap first, then use name
        return rolesMap[role.id] || role.name || role.id || "";
      }).filter(Boolean).join(", ");
    } else if (typeof user.roles === "string") {
      return rolesMap[user.roles] || user.roles;
    }
    // Fallback: resolve from role_ids using rolesMap
    if (Array.isArray(user.role_ids) && user.role_ids.length > 0) {
      const resolved = user.role_ids.map(rid => rolesMap[rid] || rid).filter(Boolean);
      if (resolved.length > 0) return resolved.join(", ");
    }
    return "";
  }

  function getRoleNames(user) {
    const names = [];
    if (Array.isArray(user.roles)) {
      user.roles.forEach(role => {
        if (typeof role === "string") names.push(rolesMap[role] || role);
        else names.push(rolesMap[role.id] || role.name || role.id || "");
      });
    } else if (typeof user.roles === "string") {
      names.push(rolesMap[user.roles] || user.roles);
    }
    if (Array.isArray(user.role_ids)) {
      user.role_ids.forEach(roleId => names.push(rolesMap[roleId] || roleId));
    }
    return names.filter(Boolean).map(name => String(name).toLowerCase());
  }

  function canEditAdminPermissions(user) {
    if (!isSuperAdmin) return false;
    return user.is_hospital_admin || getRoleNames(user).some(role => role === "admin" || role === "administrator");
  }

  const openAdminPermissions = async (user) => {
    setAdminPermissionUser(user);
    setAdminPermissionDraft(cleanPermissionList(user.admin_permissions));
    setAdminPermissionError("");
    if (availablePermissions.length > 0) return;
    try {
      const res = await fetch("https://cubehis.avopay.pro:5000/api/super-admin/permissions", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` }
      });
      if (!res.ok) throw new Error("Could not load permissions");
      const data = await res.json();
      setAvailablePermissions(data.permissions || []);
    } catch (err) {
      setAdminPermissionError(err.message || "Could not load permissions");
    }
  };

  const toggleAdminPermission = (key) => {
    setAdminPermissionDraft(prev => prev.includes(key)
      ? prev.filter(item => item !== key)
      : [...prev, key]);
  };

  const setAdminPermissionGroup = (items, checked) => {
    const keys = items.map(permissionId).filter(Boolean);
    setAdminPermissionDraft(prev => {
      const next = new Set(prev);
      keys.forEach(key => checked ? next.add(key) : next.delete(key));
      return Array.from(next);
    });
  };

  const saveAdminPermissions = async () => {
    if (!adminPermissionUser) return;
    const userId = adminPermissionUser.id || adminPermissionUser.user_id || adminPermissionUser._id;
    if (!userId) {
      setAdminPermissionError("Missing admin id");
      return;
    }
    setAdminPermissionSaving(true);
    setAdminPermissionError("");
    try {
      const res = await fetch(`https://cubehis.avopay.pro:5000/api/super-admin/admins/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
        },
        body: JSON.stringify({ admin_permissions: adminPermissionDraft })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update permissions");
      const updated = data.admin || {};
      setUsers(prev => prev.map(user => {
        const sameUser = [user.id, user.user_id, user.username, user.email]
          .filter(Boolean)
          .some(key => [updated.id, updated.user_id, updated.username, updated.email].filter(Boolean).map(String).includes(String(key)));
        return sameUser
          ? { ...user, admin_permissions: cleanPermissionList(updated.admin_permissions), is_hospital_admin: true }
          : user;
      }));
      showModal("Success", "Admin permissions updated successfully", "success");
      setAdminPermissionUser(null);
      setAdminPermissionDraft([]);
    } catch (err) {
      setAdminPermissionError(err.message || "Could not update permissions");
    } finally {
      setAdminPermissionSaving(false);
    }
  };

  const onNewUserChange = e => {
    const { name, value, type, checked } = e.target;
    if (name === "is_active") {
      setNewUser(u => ({ ...u, is_active: checked }));
    } else if (name === "roles") {
      setNewUser(u => ({
        ...u,
        roles: [value]
      }));
    } else {
      setNewUser(u => ({ ...u, [name]: value }));
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        ...newUser,
        role_ids: newUser.roles,
      };
      delete payload.roles;
      const res = await fetch("https://cubehis.avopay.pro:5000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        showModal("Failed", errData.detail || "Failed to create user", "error");
        setError(errData.detail || "Failed to create user");
        setLoading(false);
        return;
      }
      setShowCreate(false);
      setNewUser(initialNewUser);
      fetchUsers();
      showModal("Success", "User created successfully", "success");
    } catch (err) {
      setError(err.message || "Could not create user.");
      showModal("Failed", err.message || "Could not create user.", "error");
    }
    setLoading(false);
  };

  const handleDeactivateUser = (user) => {
    setDeactivateCard({ show: true, user });
  };

  const confirmDeactivateUser = async (user) => {
    setActionLoading(user.id + "-deactivate");
    setError("");
    try {
      const payload = { is_active: false };
      const res = await fetch(
        `https://cubehis.avopay.pro:5000/api/auth/users/${user.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
          },
          body: JSON.stringify(payload)
        }
      );
      if (!res.ok) {
        const errData = await res.json();
        showModal("Failed", errData.detail || "Failed to deactivate user", "error");
        throw new Error(errData.detail || "Failed to deactivate user");
      }
      fetchUsers();
      showModal("Success", "User deactivated successfully", "success");
    } catch (err) {
      setError(err.message || "Could not deactivate user.");
      showModal("Failed", err.message || "Could not deactivate user.", "error");
    }
    setActionLoading("");
    setDeactivateCard({ show: false, user: null });
  };

  const handleActivateUser = async (user) => {
    setActionLoading(user.id + "-activate");
    setError("");
    try {
      const payload = { is_active: true };
      const res = await fetch(
        `https://cubehis.avopay.pro:5000/api/auth/users/${user.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
          },
          body: JSON.stringify(payload)
        }
      );
      if (!res.ok) {
        const errData = await res.json();
        showModal("Failed", errData.detail || "Failed to activate user", "error");
        throw new Error(errData.detail || "Failed to activate user");
      }
      fetchUsers();
      showModal("Success", "User activated successfully", "success");
    } catch (err) {
      setError(err.message || "Could not activate user.");
      showModal("Failed", err.message || "Could not activate user.", "error");
    }
    setActionLoading("");
  };

  // Show delete card popup instead of browser confirm
  const handleDeleteUser = (user) => {
    setDeleteCard({ show: true, user });
  };

  const confirmDeleteUser = async (user) => {
    setActionLoading(user.id + "-delete");
    setError("");
    try {
      const res = await fetch(
        `https://cubehis.avopay.pro:5000/api/auth/users/${user.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
          }
        }
      );
      if (res.status === 204) {
        fetchUsers();
        showModal("Success", "User deleted successfully", "success");
      } else {
        const errData = await res.json();
        showModal("Failed", errData.detail || "Failed to delete user", "error");
        throw new Error(errData.detail || "Failed to delete user");
      }
    } catch (err) {
      setError(err.message || "Could not delete user.");
      showModal("Failed", err.message || "Could not delete user.", "error");
    }
    setActionLoading("");
    setDeleteCard({ show: false, user: null });
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    // Extract role IDs: prefer role_ids, fallback to roles array (objects or strings)
    let roleIds = [];
    if (Array.isArray(user.role_ids) && user.role_ids.length > 0) {
      roleIds = user.role_ids;
    } else if (Array.isArray(user.roles) && user.roles.length > 0) {
      roleIds = user.roles.map(r => typeof r === 'string' ? r : (r.id || r.name || String(r)));
    }
    setEditUserData({
      full_name: user.full_name || "",
      email: user.email || "",
      username: user.username || "",
      password: "",
      confirmPassword: "",
      role_ids: roleIds
    });
  };

  const handleEditUserChange = (e) => {
    const { name, value } = e.target;
    setEditUserData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditUserRoleChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setEditUserData(prev => ({
      ...prev,
      role_ids: selectedOptions
    }));
  };

  const updateUser = async () => {
    if (!editingUser) return;

    // Validate passwords match if password is being changed
    if (editUserData.password && editUserData.password !== editUserData.confirmPassword) {
      showModal("Failed", "Passwords do not match", "error");
      return;
    }

    setActionLoading(editingUser.id + "-update");
    setError("");
    try {
      const userId = editingUser.id || editingUser.user_id || editingUser._id;

      const payload = {
        username: editUserData.username.trim(),
        full_name: editUserData.full_name.trim(),
        email: editUserData.email.trim(),
      };

      // Only include password if it's actually being changed
      if (editUserData.password && editUserData.password.trim()) {
        payload.password = editUserData.password;
      }

      // Only admin can update roles
      if (isAdmin && editUserData.role_ids && editUserData.role_ids.length > 0) {
        const selectedRoleNames = editUserData.role_ids.map(roleId => {
          const role = roles.find(r => r.id === roleId || r.name === roleId);
          return role ? role.name : roleId;
        }).filter(Boolean);
        payload.role_ids = editUserData.role_ids;
        payload.roles = selectedRoleNames.length === 1 ? selectedRoleNames[0] : selectedRoleNames;
      }

      const res = await fetch(`https://cubehis.avopay.pro:5000/api/auth/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        showModal("Failed", errData.detail || "Failed to update user", "error");
        throw new Error(errData.detail || "Failed to update user");
      }

      fetchUsers();
      showModal("Success", "User updated successfully", "success");
      setEditingUser(null);
      setEditUserData({ full_name: "", email: "", username: "", password: "", confirmPassword: "", role_ids: [] });
    } catch (err) {
      setError(err.message || "Could not update user.");
      showModal("Failed", err.message || "Could not update user.", "error");
    }
    setActionLoading("");
  };

  // const isAdmin = () => {
  //   try {
  //     const userStr = localStorage.getItem("user");
  //     if (userStr) {
  //       const userObj = JSON.parse(userStr);
  //       let roles = [];
  //       if (userObj.roles) {
  //         if (Array.isArray(userObj.roles)) {
  //           roles = userObj.roles.map(r => typeof r === "string" ? r.toLowerCase() : (r.name || r.id || "").toLowerCase());
  //         } else if (typeof userObj.roles === "string") {
  //           roles = [userObj.roles.toLowerCase()];
  //         }
  //       }
  //       return roles.includes("admin");
  //     }
  //   } catch { }
  //   return false;
  // };

  // Responsive grid columns for forms
  const inputCol = "col-span-12 sm:col-span-6";
  const inputColFull = "col-span-12";
  const labelStyle = "block mb-1 font-medium";
  const inputStyle = "border rounded p-2 w-full focus:ring focus:ring-blue-100";
  const errorStyle = "text-red-600 text-sm mb-2";

  return (
    <div className="p-2 sm:p-3 md:p-6">
      {/* Animated Modal for feedback */}
      <AnimatePresence>
        {modal.show && (
          <motion.div
            className={`fixed top-6 left-1/2 z-50 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg text-white font-semibold
              ${modal.type === "success" ? "bg-green-600" : "bg-red-600"}`}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={toastVariants}
          >
            <div className="text-lg font-bold">{modal.title}</div>
            <div className="text-base">{modal.message}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deactivate confirmation card */}
      <AnimatePresence>
        {deactivateCard.show && deactivateCard.user && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={cardVariants}
            key="deactivate-card"
          >
            <motion.div
              className="bg-white rounded-2xl max-w-sm w-full p-7 shadow-2xl flex flex-col items-center border-2 border-yellow-400"
              initial={{ scale: 0.91, opacity: 0, y: 60 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }}
              exit={{ scale: 0.95, opacity: 0, y: 20, transition: { duration: 0.15 } }}
            >
              <div className="text-4xl mb-2 text-yellow-400 animate-pulse">⚠️</div>
              <div className="text-xl font-bold mb-1 text-gray-800 text-center">Deactivate User</div>
              <div className="text-gray-700 mb-4 text-base text-center">
                Are you sure you want to deactivate <span className="font-semibold">{deactivateCard.user.full_name || deactivateCard.user.username}</span>?<br />
                <span className="text-yellow-600">They will not be able to log in until reactivated.</span>
              </div>
              <div className="flex gap-3 w-full mt-2 flex-col sm:flex-row">
                <button
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg px-4 py-2 font-semibold transition"
                  disabled={actionLoading === deactivateCard.user.id + "-deactivate"}
                  onClick={() => confirmDeactivateUser(deactivateCard.user)}
                >
                  {actionLoading === deactivateCard.user.id + "-deactivate" ? "Deactivating..." : "Deactivate"}
                </button>
                <button
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 font-semibold transition shadow"
                  onClick={() => setDeactivateCard({ show: false, user: null })}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation card */}
      <AnimatePresence>
        {deleteCard.show && deleteCard.user && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={cardVariants}
            key="delete-card"
          >
            <motion.div
              className="bg-white rounded-2xl max-w-sm w-full p-7 shadow-2xl flex flex-col items-center border-2 border-red-400"
              initial={{ scale: 0.91, opacity: 0, y: 60 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }}
              exit={{ scale: 0.95, opacity: 0, y: 20, transition: { duration: 0.15 } }}
            >
              <div className="text-4xl mb-2 text-red-500 animate-pulse">🗑️</div>
              <div className="text-xl font-bold mb-1 text-gray-800 text-center">Delete User</div>
              <div className="text-gray-700 mb-4 text-base text-center">
                Are you sure you want to <span className="font-semibold text-red-600">delete</span> <span className="font-semibold">{deleteCard.user.full_name || deleteCard.user.username}</span>?<br />
                This action cannot be undone.
              </div>
              <div className="flex gap-3 w-full mt-2 flex-col sm:flex-row">
                <button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 font-semibold transition"
                  disabled={actionLoading === deleteCard.user.id + "-delete"}
                  onClick={() => confirmDeleteUser(deleteCard.user)}
                >
                  {actionLoading === deleteCard.user.id + "-delete" ? "Deleting..." : "Delete"}
                </button>
                <button
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 font-semibold transition shadow"
                  onClick={() => setDeleteCard({ show: false, user: null })}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin sidebar permissions */}
      <AnimatePresence>
        {adminPermissionUser && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-3"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            key="admin-permissions-modal"
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
              initial={{ scale: 0.88, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 230, damping: 20 } }}
              exit={{ scale: 0.95, opacity: 0, y: 20, transition: { duration: 0.18 } }}
            >
              <div className="flex items-start justify-between p-4 sm:p-5 border-b border-gray-100 shrink-0">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900">Sidebar Permissions</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {adminPermissionUser.full_name || adminPermissionUser.username}
                    {adminPermissionUser.hospital_name ? ` · ${adminPermissionUser.hospital_name}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAdminPermissionUser(null);
                    setAdminPermissionDraft([]);
                    setAdminPermissionError("");
                  }}
                  className="h-8 w-8 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
                  aria-label="Close"
                >
                  <i className="fas fa-times" />
                </button>
              </div>

              <div className="overflow-y-auto p-4 sm:p-5 space-y-4">
                {Object.keys(permissionsByGroup).length === 0 ? (
                  <div className="py-10 text-center text-gray-400">
                    <i className="fas fa-spinner fa-spin mr-2" />Loading permissions...
                  </div>
                ) : Object.entries(permissionsByGroup).map(([group, items]) => {
                  const allSelected = items.every(item => adminPermissionDraft.includes(permissionId(item)));
                  return (
                    <section key={group} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <h4 className="font-semibold text-gray-800 text-sm">{group}</h4>
                        <label className="inline-flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={e => setAdminPermissionGroup(items, e.target.checked)}
                          />
                          Select group
                        </label>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {items.map(item => {
                          const key = permissionId(item);
                          return (
                            <label key={key} className="flex items-center gap-2 rounded-md border border-gray-100 px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={adminPermissionDraft.includes(key)}
                                onChange={() => toggleAdminPermission(key)}
                              />
                              <span>{item.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>

              <div className="p-4 border-t border-gray-100 shrink-0">
                {adminPermissionError && <div className="text-red-600 text-sm mb-3">{adminPermissionError}</div>}
                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminPermissionUser(null);
                      setAdminPermissionDraft([]);
                      setAdminPermissionError("");
                    }}
                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={adminPermissionSaving || availablePermissions.length === 0}
                    onClick={saveAdminPermissions}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold text-sm"
                  >
                    {adminPermissionSaving ? "Saving..." : "Save Permissions"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 140, damping: 18 }}>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 tracking-tight drop-shadow text-center w-full sm:w-auto">
            User Profiles
          </h2>
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.98 }}
              className="bg-gradient-to-r from-blue-600 to-blue-400 text-white px-4 sm:px-6 py-2 rounded-lg shadow-md hover:from-blue-700 hover:to-blue-500 font-semibold transition w-full sm:w-auto"
              onClick={() => setShowCreate(true)}
            >
              + New User
            </motion.button>
          )}
        </div>
        <div className="overflow-x-auto bg-white rounded-2xl shadow-lg border border-gray-100">
          <table className="min-w-[350px] sm:min-w-[600px] md:min-w-[860px] w-full text-xs sm:text-base">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-blue-100 text-left">
                <th className="p-2 sm:p-3 md:p-4 font-semibold text-blue-700">User Name</th>
                <th className="p-2 sm:p-3 md:p-4 font-semibold text-blue-700">Name</th>
                <th className="p-2 sm:p-3 md:p-4 font-semibold text-blue-700">Email</th>
                <th className="p-2 sm:p-3 md:p-4 font-semibold text-blue-700">Role</th>
                <th className="p-2 sm:p-3 md:p-4 font-semibold text-blue-700">Hospital</th>
                <th className="p-2 sm:p-3 md:p-4 font-semibold text-blue-700">Status</th>
                {isAdmin && <th className="p-2 sm:p-3 md:p-4 font-semibold text-blue-700 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="p-3 md:p-4">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr><td colSpan={7} className="p-6 text-center text-red-500 font-medium">{error}</td></tr>
              ) : users.filter(u => !u.is_system).length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-400">No users found.</td></tr>
              ) : users.filter(u => !u.is_system).map((u) => (
                <tr key={u.id} className="border-t hover:bg-blue-50 transition">
                  <td className="p-2 sm:p-3 md:p-4 font-medium break-all">{u.username}</td>
                  <td className="p-2 sm:p-3 md:p-4 font-medium break-all">{u.full_name || u.username}</td>
                  <td className="p-2 sm:p-3 md:p-4 break-all">{u.email}</td>
                  <td className="p-2 sm:p-3 md:p-4 capitalize break-all">{renderRoles(u)}</td>
                  <td className="p-2 sm:p-3 md:p-4">
                    {u.hospital_name || u.hospital_id
                      ? <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">{u.hospital_name || u.hospital_id}</span>
                      : <span className="text-gray-400 text-xs">—</span>
                    }
                  </td>
                  <td className="p-2 sm:p-3 md:p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${u.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="p-2 sm:p-3 md:p-4">
                      <div className="flex justify-end gap-2 flex-wrap min-w-[136px]">
                        {u.is_active ? (
                          <>
                            <IconActionButton
                              title="Edit user"
                              icon="edit"
                              tone="blue"
                              disabled={actionLoading === u.id + "-update"}
                              onClick={() => handleEditUser(u)}
                            />
                            <IconActionButton
                              title="Assign hospital"
                              icon="hospital"
                              tone="indigo"
                              onClick={() => setAssignHospitalCard({ show: true, user: u, selectedHospitalId: u.hospital_id || "" })}
                            />
                            {canEditAdminPermissions(u) && (
                              <IconActionButton
                                title="Edit sidebar permissions"
                                icon="user-shield"
                                tone="slate"
                                onClick={() => openAdminPermissions(u)}
                              />
                            )}
                            <IconActionButton
                              title="Deactivate user"
                              icon="user-slash"
                              tone="amber"
                              disabled={actionLoading === u.id + "-deactivate"}
                              loading={actionLoading === u.id + "-deactivate"}
                              onClick={() => handleDeactivateUser(u)}
                            />
                            <IconActionButton
                              title="Delete user"
                              icon="trash"
                              tone="red"
                              disabled={actionLoading === u.id + "-delete"}
                              loading={actionLoading === u.id + "-delete"}
                              onClick={() => handleDeleteUser(u)}
                            />
                          </>
                        ) : (
                          <IconActionButton
                            title="Activate user"
                            icon="user-check"
                            tone="green"
                            disabled={actionLoading === u.id + "-activate"}
                            loading={actionLoading === u.id + "-activate"}
                            onClick={() => handleActivateUser(u)}
                          />
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            key="edit-user-modal"
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-xs sm:max-w-lg md:max-w-2xl p-4 sm:p-6 md:p-7 shadow-2xl relative border border-blue-200"
              initial={{ scale: 0.85, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 230, damping: 20 } }}
              exit={{ scale: 0.95, opacity: 0, y: 20, transition: { duration: 0.18 } }}
            >
              <button
                onClick={() => {
                  setEditingUser(null);
                  setEditUserData({
                    full_name: "",
                    email: "",
                    username: "",
                    password: "",
                    confirmPassword: "",
                    role_ids: []
                  });
                }}
                className="absolute top-2 right-3 text-2xl text-gray-400 hover:text-red-500 font-bold"
                aria-label="Close"
              >×</button>
              <h3 className="text-lg sm:text-2xl font-bold mb-3 text-blue-800 text-center">
                Edit User: {editingUser.full_name || editingUser.username}
              </h3>
              <form onSubmit={(e) => { e.preventDefault(); updateUser(); }} className="grid grid-cols-12 gap-3 sm:gap-4 md:gap-5">
                <div className="col-span-12 sm:col-span-6">
                  <label className="block mb-1 font-medium">Username</label>
                  <input
                    name="username"
                    value={editUserData.username}
                    onChange={handleEditUserChange}
                    className="border rounded p-2 w-full focus:ring focus:ring-blue-100"
                    required
                    placeholder="johndoe"
                  />
                </div>
                <div className="col-span-12 sm:col-span-6">
                  <label className="block mb-1 font-medium">Full Name</label>
                  <input
                    name="full_name"
                    value={editUserData.full_name}
                    onChange={handleEditUserChange}
                    className="border rounded p-2 w-full focus:ring focus:ring-blue-100"
                    required
                    placeholder="John Doe"
                  />
                </div>
                <div className="col-span-12">
                  <label className="block mb-1 font-medium">Email</label>
                  <input
                    name="email"
                    type="email"
                    value={editUserData.email}
                    onChange={handleEditUserChange}
                    className="border rounded p-2 w-full focus:ring focus:ring-blue-100"
                    required
                    placeholder="johndoe@example.com"
                  />
                </div>
                <div className="col-span-12 sm:col-span-6">
                  <label className="block mb-1 font-medium">New Password</label>
                  <input
                    name="password"
                    type="password"
                    value={editUserData.password}
                    onChange={handleEditUserChange}
                    className="border rounded p-2 w-full focus:ring focus:ring-blue-100"
                    placeholder="Leave blank to keep current password"
                    autoComplete="new-password"
                  />
                </div>
                <div className="col-span-12 sm:col-span-6">
                  <label className="block mb-1 font-medium">Confirm New Password</label>
                  <input
                    name="confirmPassword"
                    type="password"
                    value={editUserData.confirmPassword}
                    onChange={handleEditUserChange}
                    className="border rounded p-2 w-full focus:ring focus:ring-blue-100"
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />
                </div>
                {/* Roles: admin sees full multi-select dropdown; non-admin sees read-only current roles */}
                {isAdmin ? (
                  <div className="col-span-12">
                    <label className="block mb-1 font-medium">Assign Roles <span className="text-xs text-blue-500">(Admin only — hold Ctrl/Cmd for multiple)</span></label>
                    <select
                      multiple
                      value={editUserData.role_ids}
                      onChange={handleEditUserRoleChange}
                      className="border rounded p-2 w-full focus:ring focus:ring-blue-100"
                      size={Math.min(roles.length + 1, 6)}
                    >
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      Currently assigned:&nbsp;
                      <strong>
                        {editUserData.role_ids.length > 0
                          ? editUserData.role_ids.map(rid => {
                            const found = roles.find(r => r.id === rid || r.name === rid);
                            return found ? found.name : rid;
                          }).join(', ')
                          : (editingUser.roles && Array.isArray(editingUser.roles) && editingUser.roles.length > 0
                            ? editingUser.roles.map(r => typeof r === 'string' ? r : (r.name || r.id)).join(', ')
                            : 'None')}
                      </strong>
                    </p>
                  </div>
                ) : (
                  <div className="col-span-12">
                    <label className="block mb-1 font-medium">Current Roles</label>
                    <div className="border rounded p-2 bg-gray-50 text-gray-600 text-sm">
                      {editUserData.role_ids.length > 0
                        ? editUserData.role_ids.map(rid => {
                          const found = roles.find(r => r.id === rid || r.name === rid);
                          return found ? found.name : rid;
                        }).join(', ')
                        : (editingUser.roles && Array.isArray(editingUser.roles) && editingUser.roles.length > 0
                          ? editingUser.roles.map(r => typeof r === 'string' ? r : (r.name || r.id)).join(', ')
                          : 'No roles assigned')}
                    </div>
                  </div>
                )}
                {error && (
                  <div className="col-span-12 text-red-600 text-sm mb-2">{error}</div>
                )}
                <div className="col-span-12">
                  <motion.button
                    type="submit"
                    disabled={actionLoading === editingUser.id + "-update"}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-400 text-white font-semibold rounded px-4 py-2 mt-2 shadow-sm hover:from-blue-700 hover:to-blue-500"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {actionLoading === editingUser.id + "-update" ? "Updating..." : "Update User"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create User Modal */}
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
              className="bg-white rounded-2xl w-full max-w-xs sm:max-w-lg md:max-w-2xl p-4 sm:p-6 md:p-7 shadow-2xl relative border border-blue-200"
              initial={{ scale: 0.85, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 230, damping: 20 } }}
              exit={{ scale: 0.95, opacity: 0, y: 20, transition: { duration: 0.18 } }}
            >
              <button
                onClick={() => setShowCreate(false)}
                className="absolute top-2 right-3 text-2xl text-gray-400 hover:text-red-500 font-bold"
                aria-label="Close"
              >×</button>
              <h3 className="text-lg sm:text-2xl font-bold mb-3 text-blue-800 text-center">Create New User</h3>
              <form onSubmit={handleCreateUser} className="grid grid-cols-12 gap-3 sm:gap-4 md:gap-5">
                <div className={inputCol}>
                  <label className={labelStyle}>Username</label>
                  <input
                    name="username"
                    value={newUser.username}
                    onChange={onNewUserChange}
                    className={inputStyle}
                    required
                    placeholder="johndoe"
                    autoFocus
                  />
                </div>
                <div className={inputCol}>
                  <label className={labelStyle}>Full Name</label>
                  <input
                    name="full_name"
                    value={newUser.full_name}
                    onChange={onNewUserChange}
                    className={inputStyle}
                    required
                    placeholder="John Doe"
                  />
                </div>
                <div className={inputCol}>
                  <label className={labelStyle}>Email</label>
                  <input
                    name="email"
                    type="email"
                    value={newUser.email}
                    onChange={onNewUserChange}
                    className={inputStyle}
                    required
                    placeholder="johndoe@example.com"
                  />
                </div>
                <div className={inputCol}>
                  <label className={labelStyle}>Password</label>
                  <input
                    name="password"
                    type="password"
                    value={newUser.password}
                    onChange={onNewUserChange}
                    className={inputStyle}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
                <div className={inputCol}>
                  <label className={labelStyle}>Role</label>
                  <select
                    name="roles"
                    value={newUser.roles[0] || ""}
                    onChange={onNewUserChange}
                    className={inputStyle}
                    required
                  >
                    <option value="">Select Role</option>
                    {(isAdmin
                      ? roles
                      : roles.filter(r => currentUserRoleIds.includes(r.id))
                    ).map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div className={inputCol + " flex items-center"}>
                  <label className={labelStyle + " mr-2 mb-0"}>Active</label>
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={newUser.is_active}
                    onChange={onNewUserChange}
                    className="h-5 w-5"
                  />
                </div>
                {error && (
                  <div className={inputColFull + " " + errorStyle}>{error}</div>
                )}
                <div className={inputColFull}>
                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-400 text-white font-semibold rounded px-4 py-2 mt-2 shadow-sm hover:from-blue-700 hover:to-blue-500"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {loading ? "Saving..." : "Create User"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Assign Hospital Modal */}
      <AnimatePresence>
        {assignHospitalCard.show && assignHospitalCard.user && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
            initial="hidden" animate="visible" exit="exit" variants={cardVariants}
            key="assign-hospital-card"
          >
            <motion.div
              className="bg-white rounded-2xl max-w-sm w-full p-7 shadow-2xl flex flex-col border-2 border-indigo-400"
              initial={{ scale: 0.91, opacity: 0, y: 60 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }}
              exit={{ scale: 0.95, opacity: 0, y: 20, transition: { duration: 0.15 } }}
            >
              <div className="text-2xl mb-2 text-center">🏥</div>
              <div className="text-xl font-bold mb-1 text-gray-800 text-center">Assign Hospital</div>
              <div className="text-gray-600 text-sm mb-3 text-center">
                Assign a hospital to <span className="font-semibold">{assignHospitalCard.user.full_name || assignHospitalCard.user.username}</span>
              </div>
              {assignHospitalCard.user.hospital_name && (
                <div className="mb-3 text-center">
                  <span className="text-xs text-gray-500">Current: </span>
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">{assignHospitalCard.user.hospital_name}</span>
                  <button
                    className="ml-2 text-xs text-red-500 hover:underline"
                    onClick={() => { handleRemoveHospital(assignHospitalCard.user); setAssignHospitalCard({ show: false, user: null, selectedHospitalId: "" }); }}
                  >Remove</button>
                </div>
              )}
              <select
                className="border rounded p-2 w-full mb-4 focus:ring focus:ring-indigo-100"
                value={assignHospitalCard.selectedHospitalId}
                onChange={e => setAssignHospitalCard(prev => ({ ...prev, selectedHospitalId: e.target.value }))}
              >
                <option value="">-- Select Hospital --</option>
                {hospitals.map(h => (
                  <option key={h._id || h.id} value={h._id || h.id}>{h.name} {h.code ? `(${h.code})` : ""}</option>
                ))}
              </select>
              <div className="flex gap-3 w-full">
                <button
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 font-semibold transition"
                  disabled={assignHospitalLoading || !assignHospitalCard.selectedHospitalId}
                  onClick={handleAssignHospital}
                >
                  {assignHospitalLoading ? "Assigning..." : "Assign"}
                </button>
                <button
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 font-semibold transition"
                  onClick={() => setAssignHospitalCard({ show: false, user: null, selectedHospitalId: "" })}
                >Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserProfiles;
