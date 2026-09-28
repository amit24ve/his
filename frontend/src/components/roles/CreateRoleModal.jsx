import React, { useEffect } from "react";
import PropTypes from "prop-types";

/**
 * Create/Edit Role Modal Component
 */
function CreateRoleModal({
  show,
  onHide,
  role,
  availableRoles,
  onChange,
  onSubmit,
  isEditing,
  loading,
  permissionOptions
}) {
  // Close modal with ESC key
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) onHide();
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onHide]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-40 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 sm:mx-0">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            {isEditing ? "Edit Role" : "Create New Role"}
          </h3>
          <button
            onClick={onHide}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="p-6 space-y-4">
            {/* Role Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={role.name || ""}
                onChange={(e) => onChange({ ...role, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
                disabled={role.name === "admin"}
                placeholder="Enter role name"
              />
              <p className="mt-1 text-xs text-gray-500">
                Must be unique and contain only alphanumeric characters and underscores
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={role.description || ""}
                onChange={(e) => onChange({ ...role, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                rows="2"
                placeholder="Enter role description"
              ></textarea>
            </div>

            {/* Report To - Enhanced with visual indicators */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border-l-4 border-blue-400 shadow-sm relative">
              <div className="absolute -top-3 right-0 bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-sm">
                New Feature
              </div>
              <div className="flex items-center mb-2">
                <div className="bg-blue-100 p-1.5 rounded-full mr-2">
                  <svg xmlns="https://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <label className="block text-sm font-medium text-gray-800 mb-0">
                  Report To <span className="text-blue-600 font-semibold">(Organizational Hierarchy)</span>
                </label>
              </div>
              <select
                name="report_to"
                value={role.report_to || ""}
                onChange={(e) => onChange({ ...role, report_to: e.target.value })}
                className="w-full px-3 py-2.5 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">-- No Manager (Top Level Role) --</option>
                {availableRoles
                  .filter((r) => r.id !== role.id) // Can't report to itself
                  .map((availableRole) => (
                    <option key={availableRole.id} value={availableRole.name}>
                      {availableRole.name}
                    </option>
                  ))}
              </select>
              <div className="mt-2 flex items-start">
                <svg xmlns="https://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 mt-0.5 mr-1.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-gray-600">
                  Define the role's position in your organization by selecting which role it reports to. 
                  This creates your management hierarchy for reporting and permissions.
                </p>
              </div>
            </div>

            {/* Permissions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Permissions
              </label>
              <div className="border border-gray-300 rounded-md p-3">
                {permissionOptions.map((option) => (
                  <div key={option.value} className="mb-2 last:mb-0">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        value={option.value}
                        checked={role.permissions.includes(option.value)}
                        onChange={(e) => {
                          const newPermissions = e.target.checked
                            ? [...role.permissions, option.value]
                            : role.permissions.filter((p) => p !== option.value);
                          onChange({ ...role, permissions: newPermissions });
                        }}
                        disabled={role.name === "admin" && option.value === "admin"}
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {option.label}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onHide}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center"
              disabled={loading || role.name === "admin"}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </>
              ) : isEditing ? (
                "Update Role"
              ) : (
                "Create Role"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

CreateRoleModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  role: PropTypes.object.isRequired,
  availableRoles: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  isEditing: PropTypes.bool.isRequired,
  loading: PropTypes.bool.isRequired,
  permissionOptions: PropTypes.array.isRequired
};

export default CreateRoleModal;
