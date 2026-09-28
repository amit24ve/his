import React, { useState, useEffect } from "react";
import axios from "axios";
import CreateRoleModal from "./CreateRoleModal";

// Use environment-aware API URL for Vite
const API_URL = import.meta.env.VITE_API_BASE_URL ||
  (window.location.hostname === 'localhost' ?
    'https://localhost:8004' :
    'https://cubehis.avopay.pro:5000');

function RolesManager() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentRole, setCurrentRole] = useState({
    id: "",
    name: "",
    description: "",
    report_to: "",
    permissions: []
  });
  const [availableRoles, setAvailableRoles] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formAlert, setFormAlert] = useState({ message: "", type: "" });

  const permissionOptions = [
    { value: "read_users", label: "Read Users" },
    { value: "write_users", label: "Write Users" },
    { value: "read_leads", label: "Read Leads" },
    { value: "write_leads", label: "Write Leads" },
    { value: "admin", label: "Administrator" },
  ];

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");

      if (!token) {
        setError("Authentication required");
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_URL}/api/roles/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setRoles(response.data);
      setAvailableRoles(response.data);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Error fetching roles:", err);
      setError(`Failed to load roles: ${err.message || "Unknown error"}`);
      setLoading(false);
    }
  };

  const handleShowModal = (role = null) => {
    if (role) {
      setCurrentRole({
        id: role.id,
        name: role.name,
        description: role.description || "",
        report_to: role.report_to || "",
        permissions: role.permissions || []
      });
      setIsEditing(true);
    } else {
      setCurrentRole({
        id: "",
        name: "",
        description: "",
        report_to: "",
        permissions: []
      });
      setIsEditing(false);
    }

    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentRole(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePermissionChange = (e) => {
    const { value, checked } = e.target;
    setCurrentRole(prev => {
      if (checked) {
        return {
          ...prev,
          permissions: [...prev.permissions, value]
        };
      } else {
        return {
          ...prev,
          permissions: prev.permissions.filter(p => p !== value)
        };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormAlert({ message: "", type: "" });

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setFormAlert({
          message: "You must be logged in to perform this action.",
          type: "danger"
        });
        return;
      }

      // Prepare role data, ensuring report_to is properly handled
      const roleData = {
        ...currentRole,
        report_to: currentRole.report_to || null // Ensure report_to is null if not selected
      };

      console.log(`[RolesManager] ${isEditing ? 'Updating' : 'Creating'} role with data:`, roleData);

      // Create or update role
      let response;
      if (isEditing) {
        response = await axios.put(
          `${API_URL}/api/roles/${currentRole.id}`,
          roleData,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        console.log('[RolesManager] Role updated successfully:', response.data);
        setFormAlert({
          message: "Role updated successfully!",
          type: "success"
        });
      } else {
        response = await axios.post(
          `${API_URL}/api/roles/`,
          roleData,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        console.log('[RolesManager] Role created successfully:', response.data);
        setFormAlert({
          message: "Role created successfully!",
          type: "success"
        });
      }

      setShowModal(false);
      fetchRoles(); // Refresh roles list to show the latest data
    } catch (err) {
      console.error("Error saving role:", err);
      console.error("Response data:", err.response?.data);
      console.error("Response status:", err.response?.status);
      setFormAlert({
        message: `Failed to save role: ${err.response?.data?.detail || err.message || "Unknown error"}`,
        type: "danger"
      });
    }
  };

  const handleDeleteRole = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the role "${name}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem("access_token");

      await axios.delete(`${API_URL}/api/roles/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setFormAlert({
        message: "Role deleted successfully!",
        type: "success"
      });

      fetchRoles();
    } catch (err) {
      console.error("Error deleting role:", err);
      setFormAlert({
        message: `Failed to delete role: ${err.response?.data?.detail || err.message || "Unknown error"}`,
        type: "danger"
      });
    }
  };

  return (
    <div className="p-4 bg-gradient-to-tr from-indigo-50 to-white min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-indigo-900 tracking-tight mb-1">Role Management</h1>
          <p className="text-sm text-gray-600">Create and manage roles with reporting relationships</p>
        </div>
        <button
          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-500 text-white rounded-lg hover:from-indigo-700 hover:to-blue-600 transition shadow-md flex items-center"
          onClick={() => handleShowModal()}
        >
          <svg
            xmlns="https://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Create Role
        </button>
      </div>

      {/* Organization Hierarchy Info Card */}
      <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0 mr-4">
            <div className="bg-blue-100 p-2.5 rounded-lg">
              <svg xmlns="https://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-1">New Feature: Organizational Hierarchy</h3>
            <p className="text-sm text-gray-600 mb-3">
              When creating or editing roles, you can now specify which role it reports to. This helps you build
              your organization's management structure and reporting hierarchy.
            </p>
            <div className="flex items-center flex-wrap gap-2 text-sm">
              <span className="bg-gray-100 px-2 py-1 rounded">CEO</span>
              <svg xmlns="https://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span className="bg-gray-100 px-2 py-1 rounded">Manager</span>
              <svg xmlns="https://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span className="bg-gray-100 px-2 py-1 rounded">Team Lead</span>
              <svg xmlns="https://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span className="bg-gray-100 px-2 py-1 rounded">Staff</span>
            </div>
          </div>
        </div>
      </div>

      {formAlert.message && (
        <div className={`mb-4 p-3 rounded ${formAlert.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
          {formAlert.message}
        </div>
      )}

      {/* Roles Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <div className="text-lg text-gray-600">Loading roles...</div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-600">
            <div className="text-lg mb-2">{error}</div>
            <button
              className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
              onClick={fetchRoles}
            >
              Retry
            </button>
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-lg mb-2">No roles found</div>
            <div className="text-sm">Create a new role to get started</div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-indigo-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider bg-blue-50">
                  <div className="flex items-center">
                    <svg xmlns="https://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Reports To
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider">
                  Created At
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-indigo-800 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{role.name}</div>
                    {role.name === "admin" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 ml-2">
                        System
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500">{role.description || "—"}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {role.report_to ? (
                      <div className="flex items-center">
                        <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded text-xs font-medium flex items-center">
                          <svg xmlns="https://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                          {role.report_to}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded text-xs font-medium">
                          Top Level
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(role.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleShowModal(role)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                      disabled={role.name === "admin"}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRole(role.id, role.name)}
                      className="text-red-600 hover:text-red-900"
                      disabled={role.name === "admin"}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Enhanced Create/Edit Role Modal */}
      <CreateRoleModal
        show={showModal}
        onHide={() => setShowModal(false)}
        role={currentRole}
        availableRoles={availableRoles}
        onChange={(updatedRole) => setCurrentRole(updatedRole)}
        onSubmit={handleSubmit}
        isEditing={isEditing}
        loading={loading}
        permissionOptions={permissionOptions}
      />
    </div>
  );
}

export default RolesManager;
