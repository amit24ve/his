import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

// API base
const API_BASE = "https://cubehis.avopay.pro:5000/api/franchises";

// Utility to get Enquiry ID
function getEnquiryId(enq) {
  return enq.enquiry_id || enq._id || enq.id;
}

function EnquiryTracking({ onBack }) {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [actionModal, setActionModal] = useState({ open: false, enq: null, type: null });
  const rowsPerPage = 10;
  const navigate = useNavigate();

  // Responsive effect
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch all enquiries
  useEffect(() => {
    setLoading(true);
    fetchEnquiries()
      .then(setEnquiries)
      .catch((e) => setError(typeof e === "string" ? e : e.message || JSON.stringify(e)))
      .finally(() => setLoading(false));
  }, []);

  // Add enquiry API
  async function fetchEnquiries() {
    const res = await fetch(`${API_BASE}/enquiries`);
    if (!res.ok) throw new Error("Failed to load enquiries");
    return await res.json();
  }

  // Accept/Reject action with modal confirmation
  async function handleStatus(enq, type) {
    setActionModal({ open: false, enq: null, type: null });
    let url = "";
    let options = { method: "PATCH" };
    if (type === "approved") {
      url = `${API_BASE}/enquiries/${getEnquiryId(enq)}/approve`;
    } else if (type === "rejected") {
      url = `${API_BASE}/enquiries/${getEnquiryId(enq)}/reject`;
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(""); // Send as raw string for FastAPI
    } else {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to update status");
      }
      await fetchEnquiries().then(setEnquiries);
    } catch (err) {
      alert("Failed to update status: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  // Search & Pagination logic
  const filteredEnquiries = enquiries.filter((enq) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      (getEnquiryId(enq) || "")
        .toString()
        .toLowerCase()
        .includes(query) ||
      (enq.title || "").toLowerCase().includes(query) ||
      (enq.first_name || "").toLowerCase().includes(query) ||
      (enq.middle_name || "").toLowerCase().includes(query) ||
      (enq.last_name || "").toLowerCase().includes(query) ||
      (enq.location || "").toLowerCase().includes(query) ||
      (enq.cell_number || "").toLowerCase().includes(query) ||
      (enq.total_cash || "").toString().toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    if (page > Math.floor(filteredEnquiries.length / rowsPerPage)) setPage(0);
    // eslint-disable-next-line
  }, [search, filteredEnquiries.length]);

  const paginatedEnquiries = filteredEnquiries.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Table row (desktop) - no View or New Enquiry
  const renderRow = (enquiry) => (
    <motion.tr
      key={getEnquiryId(enquiry)}
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.18 }}
      className="hover:bg-indigo-50 transition"
    >
      {/* <td className="px-4 py-2 whitespace-nowrap align-middle font-bold text-indigo-700">{getEnquiryId(enquiry)}</td> */}
      <td className="px-4 py-2 whitespace-nowrap align-middle font-bold text-indigo-700">
        <button
          className="text-blue-700 hover:underline"
          onClick={() => navigate(`/enquiries/${getEnquiryId(enquiry)}`)}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          {getEnquiryId(enquiry)}
        </button>
      </td>

      <td className="px-4 py-2 whitespace-nowrap align-middle font-medium text-gray-900">
        {enquiry.title} {enquiry.first_name} {enquiry.middle_name ? enquiry.middle_name + " " : ""}{enquiry.last_name}
      </td>
      <td className="px-4 py-2 whitespace-nowrap align-middle">{enquiry.location}</td>
      <td className="px-4 py-2 whitespace-nowrap align-middle">{enquiry.cell_number}</td>
      <td className="px-4 py-2 whitespace-nowrap align-middle">₹{enquiry.total_cash}</td>
      <td className="px-4 py-2 whitespace-nowrap align-middle">
        <span className={`px-2 py-1 rounded text-xs font-bold ${(enquiry.status || "").toLowerCase() === "approved"
          ? "bg-green-100 text-green-700"
          : (enquiry.status || "").toLowerCase() === "rejected"
            ? "bg-red-100 text-red-700"
            : "bg-yellow-100 text-yellow-700"
          }`}>
          {enquiry.status}
        </span>
      </td>
      <td className="px-4 py-2 whitespace-nowrap align-middle">
        <div className="flex gap-2 flex-wrap">
          {(enquiry.status !== "approved" && enquiry.status !== "rejected") && (
            <>
              <button
                onClick={() => setActionModal({ open: true, enq: enquiry, type: "approved" })}
                className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-semibold hover:bg-green-200 transition"
              >Approve</button>
              <button
                onClick={() => setActionModal({ open: true, enq: enquiry, type: "rejected" })}
                className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-semibold hover:bg-red-200 transition"
              >Reject</button>
            </>
          )}
        </div>
      </td>
    </motion.tr>
  );

  // Card view (mobile) - no View or New Enquiry
  const renderCard = (enquiry) => (
    <motion.div
      key={getEnquiryId(enquiry)}
      className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white shadow p-4 mb-3 flex flex-col gap-2"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      layout
      transition={{ duration: 0.22 }}
    >
      <div className="flex items-center justify-between">
        <button
          className="text-blue-700 hover:underline"
          onClick={() => navigate(`/enquiries/${getEnquiryId(enquiry)}`)}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          {getEnquiryId(enquiry)}
        </button>
        <span className={`px-3 py-1 rounded text-xs font-bold ${(enquiry.status || "").toLowerCase() === "approved"
          ? "bg-green-100 text-green-700"
          : (enquiry.status || "").toLowerCase() === "rejected"
            ? "bg-red-100 text-red-700"
            : "bg-yellow-100 text-yellow-700"
          }`}>{enquiry.status}</span>
      </div>
      <div className="font-semibold text-[#101828]">
        {enquiry.title} {enquiry.first_name} {enquiry.middle_name ? enquiry.middle_name + " " : ""}{enquiry.last_name}
      </div>
      <div className="flex gap-2 text-sm">
        <span className="font-semibold text-gray-700 w-24">Location:</span>
        <span>{enquiry.location || "-"}</span>
      </div>
      <div className="flex gap-2 text-sm">
        <span className="font-semibold text-gray-700 w-24">Phone:</span>
        <span>{enquiry.cell_number || "-"}</span>
      </div>
      <div className="flex gap-2 text-sm">
        <span className="font-semibold text-gray-700 w-24">Total Cash:</span>
        <span>₹{enquiry.total_cash || "-"}</span>
      </div>
      {(enquiry.status !== "approved" && enquiry.status !== "rejected") && (
        <div className="flex gap-2 mt-2 justify-end">
          <button
            onClick={() => setActionModal({ open: true, enq: enquiry, type: "approved" })}
            className="bg-green-100 text-green-700 px-4 py-1 rounded font-semibold hover:bg-green-200 transition text-sm"
          >Approve</button>
          <button
            onClick={() => setActionModal({ open: true, enq: enquiry, type: "rejected" })}
            className="bg-red-100 text-red-700 px-4 py-1 rounded font-semibold hover:bg-red-200 transition text-sm"
          >Reject</button>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-8 bg-gray-50 min-h-screen">
      <button
        className="mb-6 px-5 py-2 rounded-2xl bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition"
        onClick={onBack}
      >
        &larr; Back to Dashboard
      </button>
      <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col sm:flex-row items-center justify-between mb-8 gap-5">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-indigo-700 mb-1">
            Enquiry Tracking
          </h2>
          <p className="text-gray-500">
            Manage all franchise/dealership enquiries at one place.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-0 sm:p-4 mb-8" style={{ boxShadow: "0 6px 32px rgba(80,80,130,.10)" }}>
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-0">All Franchise Enquiries</h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {loading && (
              <span className="text-sm text-gray-400 mr-4">Loading...</span>
            )}
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition w-full sm:w-60"
              style={{ minWidth: 130 }}
            />
          </div>
        </div>
        {!isMobile ? (
          <div className="overflow-x-auto">
            <motion.table
              className="min-w-full table-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.22 }}
            >
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-base">
                  <th className="px-4 py-2 text-left font-semibold">Enquiry ID</th>
                  <th className="px-4 py-2 text-left font-semibold">Name</th>
                  <th className="px-4 py-2 text-left font-semibold">Location</th>
                  <th className="px-4 py-2 text-left font-semibold">Phone Number</th>
                  <th className="px-4 py-2 text-left font-semibold">Total Cash</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                  <th className="px-4 py-2 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td>
                    </tr>
                  ) : paginatedEnquiries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400">No enquiries yet.</td>
                    </tr>
                  ) : (
                    paginatedEnquiries.map(renderRow)
                  )}
                </AnimatePresence>
              </tbody>
            </motion.table>
            <div className="px-6 py-4 font-bold text-lg text-[#222]">
              Total Enquiries: {filteredEnquiries.length}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <AnimatePresence>
              {loading ? (
                <div className="text-center py-8 text-gray-400">Loading...</div>
              ) : paginatedEnquiries.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No enquiries yet.</div>
              ) : (
                paginatedEnquiries.map(renderCard)
              )}
            </AnimatePresence>
            <div className="px-6 py-4 font-bold text-lg text-[#222]">
              Total Enquiries: {filteredEnquiries.length}
            </div>
          </div>
        )}
        {/* Pagination Controls */}
        {!isMobile && filteredEnquiries.length > rowsPerPage && (
          <div className="flex items-center gap-2 ml-auto px-6 pb-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="mx-2 text-gray-600">
              Page {page + 1} of {Math.ceil(filteredEnquiries.length / rowsPerPage)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(filteredEnquiries.length / rowsPerPage) - 1}
              className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* --- Modal: Approve/Reject Action --- */}
      {actionModal.open && actionModal.enq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-[95vw] mx-2 p-8 flex flex-col items-center animate-modernModal relative">
            <button
              className="absolute top-4 right-4 text-xl font-bold text-gray-400 hover:text-gray-700"
              onClick={() => setActionModal({ open: false, enq: null, type: null })}
              aria-label="Close action modal"
            >
              ×
            </button>
            <h3 className="text-2xl mb-2 font-bold text-indigo-700 text-center">
              {actionModal.type === "approved" ? "Approve" : "Reject"} Enquiry
            </h3>
            <p className="text-gray-700 text-center mb-6">
              Are you sure you want to {actionModal.type === "approved" ? "approve" : "reject"} enquiry <b>{getEnquiryId(actionModal.enq)}</b>?
            </p>
            <div className="flex gap-4 justify-center mt-4">
              <button
                className={`px-8 py-2 rounded-2xl font-semibold text-lg ${actionModal.type === "approved"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                onClick={() => handleStatus(actionModal.enq, actionModal.type)}
              >
                Yes, {actionModal.type.charAt(0).toUpperCase() + actionModal.type.slice(1)}
              </button>
              <button
                className="px-8 py-2 rounded-2xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition font-semibold text-lg"
                onClick={() => setActionModal({ open: false, enq: null, type: null })}
              >
                Cancel
              </button>
            </div>
          </div>
          <style>{`
            .animate-modernModal {
              animation: modernModal 0.5s cubic-bezier(.19,1,.22,1) both;
            }
            @keyframes modernModal {
              0% { opacity: 0; transform: translateY(60px) scale(0.98);}
              60% { opacity: 1; transform: translateY(-8px) scale(1.02);}
              100% { opacity: 1; transform: translateY(0) scale(1);}
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

export default EnquiryTracking;