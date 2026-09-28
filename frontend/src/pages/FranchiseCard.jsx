import React, { useState, useEffect } from "react";

// Helper functions: You need to implement these with your actual API endpoints!
async function fetchEnquiries() {
  const res = await fetch("https://cubehis.avopay.pro:5000/api/franchises/");
  if (!res.ok) throw new Error("Failed to load franchise enquiries");
  return await res.json();
}
async function updateEnquiryStatus(id, status) {
  // You may need to adjust the endpoint/method based on your backend
  const res = await fetch(
    `https://cubehis.avopay.pro:5000/api/franchises/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }
  );
  if (!res.ok) throw new Error("Failed to update status");
  return await res.json();
}

function FranchiseCard({ onBack }) {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewEnquiry, setViewEnquiry] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;

  useEffect(() => {
    setLoading(true);
    fetchEnquiries()
      .then(setEnquiries)
      .catch((e) =>
        setError(typeof e === "string" ? e : e.message || JSON.stringify(e))
      )
      .finally(() => setLoading(false));
  }, []);

  const getId = (enq) =>
    enq._id?.$oid || enq._id || enq.id;

  const handleApprove = async (enquiry) => {
    setStatusUpdating(true);
    setStatusError("");
    try {
      await updateEnquiryStatus(getId(enquiry), "approved");
      setEnquiries((prev) =>
        prev.map((e) =>
          getId(e) === getId(enquiry)
            ? { ...e, status: "approved" }
            : e
        )
      );
      setViewEnquiry((prev) =>
        prev ? { ...prev, status: "approved" } : prev
      );
    } catch (e) {
      setStatusError(typeof e === "string" ? e : e.message || JSON.stringify(e));
    }
    setStatusUpdating(false);
  };

  const handleReject = async (enquiry) => {
    setStatusUpdating(true);
    setStatusError("");
    try {
      await updateEnquiryStatus(getId(enquiry), "rejected");
      setEnquiries((prev) =>
        prev.map((e) =>
          getId(e) === getId(enquiry)
            ? { ...e, status: "rejected" }
            : e
        )
      );
      setViewEnquiry((prev) =>
        prev ? { ...prev, status: "rejected" } : prev
      );
    } catch (e) {
      setStatusError(typeof e === "string" ? e : e.message || JSON.stringify(e));
    }
    setStatusUpdating(false);
  };

  // Search & Pagination
  const filteredEnquiries = enquiries.filter((enq) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      (enq.first_name || "").toLowerCase().includes(query) ||
      (enq.last_name || "").toLowerCase().includes(query) ||
      (enq.email || "").toLowerCase().includes(query) ||
      (enq.location || "").toLowerCase().includes(query) ||
      (enq.cell_number || "").toLowerCase().includes(query)
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

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-8 bg-gray-50 min-h-screen">
      {/* Back Button */}
      <button
        className="mb-6 px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition inline-block"
        onClick={onBack}
      >
        &larr; Back to Dashboard
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col sm:flex-row items-center justify-between mb-8 gap-5">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-indigo-700 mb-1">
            Franchise Enquiries
          </h2>
          <p className="text-gray-500">
            All franchise/dealership applications with approve/reject actions.
          </p>
        </div>
      </div>

      {/* Search and Table */}
      <div className="bg-white rounded-2xl shadow-xl p-0 sm:p-4 mb-8">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-0">
            All Franchise Enquiries
          </h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {loading && <span className="text-sm text-gray-400 mr-4">Loading...</span>}
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
        <div className="overflow-x-auto">
          {/* Table for desktop */}
          <table className="min-w-full divide-y divide-gray-200 text-sm hidden md:table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase">Location</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase">Phone</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginatedEnquiries.map((enquiry) => (
                <tr key={getId(enquiry) || Math.random()}>
                  <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">
                    {(enquiry.title || "") + " " + (enquiry.first_name || "") + " " + (enquiry.middle_name ? enquiry.middle_name + " " : "") + (enquiry.last_name || "")}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{enquiry.location || ""}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{enquiry.cell_number || ""}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${enquiry.status === "approved"
                      ? "bg-green-100 text-green-700"
                      : enquiry.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-800"
                      }`}>
                      {enquiry.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 flex flex-wrap gap-2 whitespace-nowrap">
                    <button
                      onClick={() => setViewEnquiry(enquiry)}
                      className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-xs font-semibold hover:bg-indigo-200 transition"
                    >View</button>
                    <button
                      disabled={statusUpdating || enquiry.status === "approved"}
                      onClick={() => handleApprove(enquiry)}
                      className="bg-green-50 text-green-700 px-3 py-1 rounded text-xs font-semibold hover:bg-green-100 transition disabled:opacity-50"
                    >Approve</button>
                    <button
                      disabled={statusUpdating || enquiry.status === "rejected"}
                      onClick={() => handleReject(enquiry)}
                      className="bg-red-50 text-red-700 px-3 py-1 rounded text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50"
                    >Reject</button>
                  </td>
                </tr>
              ))}
              {!loading && paginatedEnquiries.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400 py-8">
                    No enquiries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {/* Cards for mobile */}
          <div className="md:hidden flex flex-col gap-4 py-2">
            {paginatedEnquiries.length === 0 && !loading ? (
              <div className="text-center text-gray-400 py-8">No enquiries yet.</div>
            ) : paginatedEnquiries.map((enquiry) => (
              <div
                key={getId(enquiry) || Math.random()}
                className="rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-white shadow-sm p-4 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-gray-900 text-base">
                    {(enquiry.title || "") + " " + (enquiry.first_name || "") + " " + (enquiry.middle_name ? enquiry.middle_name + " " : "") + (enquiry.last_name || "")}
                  </span>
                </div>
                <div className="flex gap-1 text-sm">
                  <span className="font-semibold text-gray-600 w-24">Location:</span>
                  <span>{enquiry.location || "-"}</span>
                </div>
                <div className="flex gap-1 text-sm">
                  <span className="font-semibold text-gray-600 w-24">Phone:</span>
                  <span>{enquiry.cell_number || "-"}</span>
                </div>
                <div className="flex gap-1 text-sm">
                  <span className="font-semibold text-gray-600 w-24">Status:</span>
                  <span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${enquiry.status === "approved"
                      ? "bg-green-100 text-green-700"
                      : enquiry.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-800"
                      }`}>
                      {enquiry.status}
                    </span>
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setViewEnquiry(enquiry)}
                    className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-xs font-semibold hover:bg-indigo-200 transition"
                  >View</button>
                  <button
                    disabled={statusUpdating || enquiry.status === "approved"}
                    onClick={() => handleApprove(enquiry)}
                    className="bg-green-50 text-green-700 px-3 py-1 rounded text-xs font-semibold hover:bg-green-100 transition disabled:opacity-50"
                  >Approve</button>
                  <button
                    disabled={statusUpdating || enquiry.status === "rejected"}
                    onClick={() => handleReject(enquiry)}
                    className="bg-red-50 text-red-700 px-3 py-1 rounded text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50"
                  >Reject</button>
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            )}
          </div>
        </div>
        {/* Pagination Controls and Total Enquiries */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 py-2">
          <div className="text-gray-700 font-medium text-sm">
            <b>Total Enquiries:</b> {filteredEnquiries.length}
          </div>
          {filteredEnquiries.length > rowsPerPage && (
            <div className="flex items-center gap-2 ml-auto">
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
      </div>

      {/* --- Modal: Enquiry Details --- */}
      {viewEnquiry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          aria-modal="true"
          tabIndex={-1}
          onClick={() => setViewEnquiry(null)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-2 p-8 border flex flex-col max-h-[90vh] overflow-y-auto animate-modernModal"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 text-xl font-bold text-gray-400 hover:text-gray-700"
              onClick={() => setViewEnquiry(null)}
              aria-label="Close details modal"
            >
              ×
            </button>
            <h3 className="text-2xl font-semibold mb-6 text-center border-b pb-2 text-indigo-700 tracking-wide">
              Enquiry Details
            </h3>
            <dl className="space-y-3 text-sm sm:text-base">
              <div>
                <dt className="font-semibold">Title:</dt>
                <dd>{viewEnquiry.title}</dd>
              </div>
              <div>
                <dt className="font-semibold">First Name:</dt>
                <dd>{viewEnquiry.first_name}</dd>
              </div>
              <div>
                <dt className="font-semibold">Middle Name:</dt>
                <dd>{viewEnquiry.middle_name}</dd>
              </div>
              <div>
                <dt className="font-semibold">Last Name:</dt>
                <dd>{viewEnquiry.last_name}</dd>
              </div>
              <div>
                <dt className="font-semibold">Email:</dt>
                <dd>
                  <a href={`mailto:${viewEnquiry.email}`} className="text-blue-600 underline">
                    {viewEnquiry.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Cell Number:</dt>
                <dd>{viewEnquiry.cell_number}</dd>
              </div>
              <div>
                <dt className="font-semibold">Location:</dt>
                <dd>{viewEnquiry.location}</dd>
              </div>
              <div>
                <dt className="font-semibold">Total Cash to Invest:</dt>
                <dd>₹{viewEnquiry.total_cash}</dd>
              </div>
              <div>
                <dt className="font-semibold">Number of Stores:</dt>
                <dd>{viewEnquiry.num_stores}</dd>
              </div>
              <div>
                <dt className="font-semibold">Status:</dt>
                <dd>{viewEnquiry.status}</dd>
              </div>
            </dl>
            {statusError && (
              <div className="text-red-500 text-center mt-4">{statusError}</div>
            )}
            <div className="flex gap-4 mt-6 justify-center">
              <button
                disabled={statusUpdating || viewEnquiry.status === "approved"}
                onClick={() => handleApprove(viewEnquiry)}
                className="bg-green-50 text-green-700 px-6 py-2 rounded text-sm font-semibold hover:bg-green-100 transition disabled:opacity-50"
              >
                Approve
              </button>
              <button
                disabled={statusUpdating || viewEnquiry.status === "rejected"}
                onClick={() => handleReject(viewEnquiry)}
                className="bg-red-50 text-red-700 px-6 py-2 rounded text-sm font-semibold hover:bg-red-100 transition disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => setViewEnquiry(null)}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded text-sm font-semibold hover:bg-gray-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FranchiseCard;