
import React, { useState } from "react";

const features = [
  {
    title: "User Role Management",
    description: "Assign, modify, and monitor user roles and permissions for secure, flexible access control.",
    icon: (
      <svg className="w-9 h-9 text-blue-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 20v-2a4 4 0 014-4h8a4 4 0 014 4v2" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    title: "System Configuration",
    description: "Customize system preferences, integrations, and operational settings to align with your business needs.",
    icon: (
      <svg className="w-9 h-9 text-green-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 8.6 15a1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 15 8.6c.26 0 .52.03.76.09" />
      </svg>
    ),
  },
  {
    title: "Data Backup & Recovery",
    description: "Safeguard critical information with automated backups and rapid recovery tools for business continuity.",
    icon: (
      <svg className="w-9 h-9 text-orange-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    title: "Notifications & Announcement Settings",
    description: "Manage system alerts, push notifications, and announcements for timely user communication.",
    icon: (
      <svg className="w-9 h-9 text-purple-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M18 16v-5a6 6 0 10-12 0v5m2 2h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="20" r="1" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
];

export default function Admin() {
  // State for showing backend-connected actions
  const [username, setUsername] = useState("");
  const [grantResult, setGrantResult] = useState("");
  const [grantLoading, setGrantLoading] = useState(false);

  const [becomeResult, setBecomeResult] = useState("");
  const [becomeLoading, setBecomeLoading] = useState(false);

  const API_BASE = "https://cubehis.avopay.pro:5000/api/admin"; // Replace with your actual API base URL 

  // Handler for grant-admin (by username)
  const handleGrantAdmin = async (e) => {
    e.preventDefault();
    if (!username) return;
    setGrantLoading(true);
    setGrantResult("");
    try {
      const res = await fetch(`${API_BASE}/grant-admin/${encodeURIComponent(username)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        setGrantResult(data.message || "Admin rights granted!");
      } else {
        setGrantResult(data.detail || "Failed to grant admin rights.");
      }
    } catch (err) {
      setGrantResult("Error: " + err.message);
    }
    setGrantLoading(false);
  };

  // Handler for become-admin (current user)
  const handleBecomeAdmin = async () => {
    setBecomeLoading(true);
    setBecomeResult("");
    try {
      const res = await fetch(`${API_BASE}/become-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        setBecomeResult(data.message || "Admin rights granted!");
      } else {
        setBecomeResult(data.detail || "Failed to become admin.");
      }
    } catch (err) {
      setBecomeResult("Error: " + err.message);
    }
    setBecomeLoading(false);
  };

  // Handler for bypass-admin-check (emergency only)
  const [bypassResult, setBypassResult] = useState("");
  const [bypassLoading, setBypassLoading] = useState(false);
  const handleBypassAdmin = async () => {
    setBypassLoading(true);
    setBypassResult("");
    try {
      const res = await fetch(`${API_BASE}/bypass-admin-check`);
      const data = await res.json();
      if (res.ok) {
        setBypassResult(data.message || "Bypass enabled!");
      } else {
        setBypassResult(data.detail || "Failed to enable bypass.");
      }
    } catch (err) {
      setBypassResult("Error: " + err.message);
    }
    setBypassLoading(false);
  };

  return (
    <section className="w-full min-h-screen px-4 py-12 bg-gradient-to-tr from-slate-50 via-white to-blue-50 flex flex-col items-center">
      {/* Card-style header with icon */}
      <div className="flex justify-center items-center w-full mb-10 px-4">
        <div className="bg-gradient-to-br from-white/80 to-blue-50/80 backdrop-blur-md rounded-3xl shadow-2xl max-w-2xl w-full px-8 py-9 sm:py-11 text-center border border-gray-200 transition-all hover:shadow-blue-200">
          <div className="flex justify-center mb-6">
            <svg className="w-16 h-16 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 48 48">
              <rect x="10" y="14" width="28" height="20" rx="6" fill="#dbeafe" />
              <path d="M16 24h16M16 32h8" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
              <circle cx="34" cy="24" r="2" fill="#2563eb" />
            </svg>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-700 mb-3 leading-tight tracking-tight">
            Admin Control Panel
          </h2>
          <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
            Centralize your organization’s system management with advanced controls for users, configuration, data safety, and notifications—all in a secure, modern interface.
          </p>
        </div>
      </div>

      {/* Feature cards */}
      <div className="max-w-4xl w-full flex flex-col items-center text-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="rounded-2xl shadow-lg bg-white p-8 flex flex-col items-center hover:scale-[1.03] transition-transform border border-gray-100"
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">{feature.title}</h3>
              <p className="text-gray-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="w-full max-w-2xl mt-14 mb-8 border-t border-blue-100" />

      {/* Admin actions section */}
      <div className="w-full max-w-2xl p-6 bg-white/90 rounded-2xl shadow-md border border-gray-100 mt-4">
        <h3 className="text-lg font-bold text-blue-700 mb-4">Development Admin Actions (Local IP only)</h3>
        <form className="flex flex-col sm:flex-row gap-4 items-center mb-4" onSubmit={handleGrantAdmin}>
          <input
            className="border border-gray-300 px-4 py-2 rounded-lg flex-1 text-sm"
            type="text"
            placeholder="Username to grant admin"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <button
            className="bg-blue-600 text-white font-semibold rounded-lg px-5 py-2 transition hover:bg-blue-700 disabled:opacity-60"
            type="submit"
            disabled={grantLoading || !username}
          >
            {grantLoading ? "Granting..." : "Grant Admin"}
          </button>
        </form>
        {grantResult && <div className="text-sm mb-3">{grantResult}</div>}

        <button
          className="bg-green-600 text-white font-semibold rounded-lg px-5 py-2 mb-3 transition hover:bg-green-700 disabled:opacity-60"
          type="button"
          onClick={handleBecomeAdmin}
          disabled={becomeLoading}
        >
          {becomeLoading ? "Processing..." : "Become Admin (Current User)"}
        </button>
        {becomeResult && <div className="text-sm mb-3">{becomeResult}</div>}

        <button
          className="bg-orange-500 text-white font-semibold rounded-lg px-5 py-2 mb-3 transition hover:bg-orange-600 disabled:opacity-60"
          type="button"
          onClick={handleBypassAdmin}
          disabled={bypassLoading}
        >
          {bypassLoading ? "Enabling..." : "Emergency: Bypass Admin Check"}
        </button>
        {bypassResult && <div className="text-sm text-orange-700">{bypassResult}</div>}
        <div className="text-xs text-gray-400 mt-2">
          <b>Note:</b> These actions are only available from <code>localhost</code> or <code>127.0.0.1</code>.
          Remove from production for security.
        </div>
      </div>
    </section>
  );
}