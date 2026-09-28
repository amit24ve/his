import { useState, useEffect } from "react";
import Select from 'react-select';
import { useNavigate } from "react-router-dom";

// --- API Helper Functions ---
const API_BASE = "https://cubehis.avopay.pro:5000/api/franchises";

// ENQUIRIES
async function fetchEnquiries() {
  const res = await fetch(`${API_BASE}/enquiries`);
  if (!res.ok) throw new Error("Failed to load enquiries");
  return await res.json();
}
async function addEnquiry(enquiry) {
  const res = await fetch(`${API_BASE}/enquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(enquiry),
  });
  if (!res.ok) {
    let msg = "Failed to add enquiry";
    try {
      const data = await res.json();
      msg = data.detail || JSON.stringify(data) || msg;
    } catch {
      msg = await res.text();
    }
    throw new Error(msg);
  }
  return await res.json();
}

function EnquiryTracking() {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const rowsPerPage = 10;
  const [viewEnquiry, setViewEnquiry] = useState(null);
  const navigate = useNavigate();

  const [newEnquiry, setNewEnquiry] = useState({
    title: "Mr",
    first_name: "",
    middle_name: "",
    last_name: "",
    age: "",
    email: "",
    cell_number: "",
    location: "",
    total_cash: "",
    num_stores: "",
    type: "Form",
    status: "pending",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    setLoading(true);
    fetchEnquiries()
      .then(setEnquiries)
      .catch((e) => setError(typeof e === "string" ? e : e.message || JSON.stringify(e)))
      .finally(() => setLoading(false));
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEnquiry((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitted(false);
    const requiredFields = [
      "first_name",
      "age",
      "email",
      "cell_number",
      "location",
      "total_cash",
      "num_stores",
    ];
    for (let field of requiredFields) {
      if (!newEnquiry[field]) {
        setError("Please fill in all required fields.");
        return;
      }
    }
    try {
      await addEnquiry(newEnquiry);
      setFormOpen(false);
      setSubmitted(true);
      setNewEnquiry({
        title: "Mr",
        first_name: "",
        middle_name: "",
        last_name: "",
        age: "",
        email: "",
        cell_number: "",
        location: "",
        total_cash: "",
        num_stores: "",
        type: "Form",
        status: "pending",
        date: new Date().toISOString().split("T")[0],
      });
      setTimeout(() => setSubmitted(false), 4000);
      setLoading(true);
      fetchEnquiries()
        .then(setEnquiries)
        .finally(() => setLoading(false));
      setPage(0);
    } catch (e) {
      setError(typeof e === "string" ? e : e.message || JSON.stringify(e));
    }
  };

  // --- Search & Pagination logic ---
  const filteredEnquiries = enquiries.filter((enq) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      (enq.enquiry_id || enq._id || enq.id || "")
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

  function renderStatus(status) {
    const s = (status || "").toLowerCase();
    if (s === "approved")
      return <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-700 font-semibold text-xs shadow">Approved</span>;
    if (s === "rejected")
      return <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-700 font-semibold text-xs shadow">Rejected</span>;
    return <span className="inline-block px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 font-semibold text-xs shadow">{status}</span>;
  }

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col sm:flex-row items-center justify-between mb-8 gap-5">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-indigo-700 mb-1">
            Enquiry Tracking
          </h2>
          <p className="text-gray-500">
            Manage all franchise/dealership enquiries at one place.
          </p>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg transition gap-2 text-lg"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Enquiry
          </button>
        )}
      </div>
      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xl p-0 sm:p-4 mb-8"
        style={{ boxShadow: "0 6px 32px rgba(80,80,130,.10)" }}>
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left font-bold text-indigo-700 bg-gray-50 uppercase border-b border-gray-100 tracking-wider">Enquiry ID</th>
                <th className="px-4 py-3 text-left font-bold text-indigo-700 bg-gray-50 uppercase border-b border-gray-100 tracking-wider">Name</th>
                <th className="px-4 py-3 text-left font-bold text-indigo-700 bg-gray-50 uppercase border-b border-gray-100 tracking-wider">Location</th>
                <th className="px-4 py-3 text-left font-bold text-indigo-700 bg-gray-50 uppercase border-b border-gray-100 tracking-wider">Phone Number</th>
                <th className="px-4 py-3 text-left font-bold text-indigo-700 bg-gray-50 uppercase border-b border-gray-100 tracking-wider">Total Cash</th>
                <th className="px-4 py-3 text-left font-bold text-indigo-700 bg-gray-50 uppercase border-b border-gray-100 tracking-wider">Status</th>
                <th className="px-4 py-3 text-left font-bold text-indigo-700 bg-gray-50 uppercase border-b border-gray-100 tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedEnquiries.map((enquiry, idx) => (
                <tr
                  key={enquiry.enquiry_id || enquiry._id || enquiry.id}
                  className={idx % 2 === 0 ? "bg-white" : "bg-indigo-50/50"}
                >
                  <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                    <button
                      onClick={() => {
                        const id = enquiry.enquiry_id || enquiry._id || enquiry.id;
                        navigate(`/enquiries/${id}`);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold underline"
                    >
                      {enquiry.enquiry_id || enquiry._id || enquiry.id}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {enquiry.title} {enquiry.first_name}{" "}
                    {enquiry.middle_name ? enquiry.middle_name + " " : ""}
                    {enquiry.last_name}
                  </td>
                  <td className="px-4 py-3">{enquiry.location}</td>
                  <td className="px-4 py-3">{enquiry.cell_number}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">₹{enquiry.total_cash}</span>
                  </td>
                  <td className="px-4 py-3">{renderStatus(enquiry.status)}</td>
                  <td className="flex flex-wrap gap-2 px-4 py-3">
                    <button
                      onClick={() => setViewEnquiry(enquiry)}
                      className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-xs font-semibold hover:bg-indigo-200 transition border border-indigo-200"
                    >View</button>
                  </td>
                </tr>
              ))}
              {!loading && paginatedEnquiries.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-8">
                    No enquiries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 py-2">
          <div className="text-gray-700 font-medium text-sm">
            <b> Total Enquiries:  </b> {filteredEnquiries.length}
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
      {/* --- Modal: Add Enquiry --- */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFormOpen(false);
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="bg-white max-w-2xl w-[95vw] rounded-3xl shadow-2xl p-4 sm:p-8 relative animate-modernModal"
            style={{ maxHeight: "98vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-3xl"
              onClick={() => setFormOpen(false)}
              aria-label="Close form"
              style={{ lineHeight: 1 }}
            >
              &times;
            </button>
            <h3 className="text-2xl font-extrabold mb-4 text-indigo-700 text-center tracking-wide">
              New Enquiry
            </h3>
            {error && <div className="text-red-500 mb-3 text-center">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <select
                  name="title"
                  value={newEnquiry.title}
                  onChange={handleInputChange}
                  className="border rounded-xl p-2 w-full focus:ring-2 focus:ring-indigo-400 transition"
                >
                  <option>Mr</option>
                  <option>Mrs</option>
                  <option>Ms</option>
                  <option>Dr</option>
                  <option>Prof</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="first_name"
                  placeholder="First Name"
                  className="border rounded-xl p-2 w-full focus:ring-2 focus:ring-indigo-400 transition"
                  required
                  value={newEnquiry.first_name}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Middle Name
                </label>
                <input
                  name="middle_name"
                  placeholder="Middle Name"
                  className="border rounded-xl p-2 w-full focus:ring-2 focus:ring-indigo-400 transition"
                  value={newEnquiry.middle_name}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Last Name
                </label>
                <input
                  name="last_name"
                  placeholder="Last Name"
                  className="border rounded-xl p-2 w-full focus:ring-2 focus:ring-indigo-400 transition"
                  value={newEnquiry.last_name}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  name="age"
                  type="number"
                  placeholder="e.g. 23"
                  className="border rounded-xl p-2 w-full focus:ring-2 focus:ring-indigo-400 transition"
                  value={newEnquiry.age}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  placeholder="your@email.com"
                  className="border rounded-xl p-2 w-full focus:ring-2 focus:ring-indigo-400 transition"
                  required
                  value={newEnquiry.email}
                  onChange={handleInputChange}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  name="cell_number"
                  placeholder="(+91)"
                  className="border rounded-xl p-2 w-full focus:ring-2 focus:ring-indigo-400 transition"
                  required
                  value={newEnquiry.cell_number}
                  onChange={handleInputChange}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  name="location"
                  placeholder="City/Area"
                  className="border rounded-xl p-2 w-full focus:ring-2 focus:ring-indigo-400 transition"
                  value={newEnquiry.location}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  TOTAL Cash to invest <span className="text-red-500">*</span>
                </label>
                <input
                  name="total_cash"
                  type="number"
                  className="border rounded-xl p-2 w-full focus:ring-2 focus:ring-indigo-400 transition"
                  required
                  value={newEnquiry.total_cash}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Number of Stores <span className="text-red-500">*</span>
                </label>
                <input
                  name="num_stores"
                  type="number"
                  className="border rounded-xl p-2 w-full focus:ring-2 focus:ring-indigo-400 transition"
                  required
                  value={newEnquiry.num_stores}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mt-10 justify-center">
              <button
                type="submit"
                className="px-10 py-3 font-bold rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow transition text-lg"
              >
                Submit
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-10 py-3 rounded-2xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition font-semibold text-lg"
              >
                Cancel
              </button>
            </div>
          </form>
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

      {/* --- Success Modal --- */}
      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-[95vw] mx-2 p-8 flex flex-col items-center animate-modernModal relative">
            <button
              className="absolute top-4 right-4 text-xl font-bold text-gray-400 hover:text-gray-700"
              onClick={() => setSubmitted(false)}
              aria-label="Close success modal"
            >
              ×
            </button>
            <svg className="w-16 h-16 text-green-400 mb-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M9 12l2 2l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <h3 className="text-2xl mb-2 font-bold text-green-700 text-center">Enquiry Submitted!</h3>
            <p className="text-gray-600 text-center mb-6">Thank you for your enquiry. We will get back to you soon.</p>
            <button
              onClick={() => setSubmitted(false)}
              className="px-8 py-2 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition text-lg"
            >
              Close
            </button>
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
              <div className="flex items-start gap-2">
                <dt className="font-semibold">Enquiry ID:</dt>
                <dd>{viewEnquiry.enquiry_id || viewEnquiry._id || viewEnquiry.id}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="font-semibold">Title:</dt>
                <dd>{viewEnquiry.title}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="font-semibold">First Name:</dt>
                <dd>{viewEnquiry.first_name}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="font-semibold">Middle Name:</dt>
                <dd>{viewEnquiry.middle_name}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="font-semibold">Last Name:</dt>
                <dd>{viewEnquiry.last_name}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="font-semibold">Age:</dt>
                <dd>{viewEnquiry.age}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="font-semibold">Email:</dt>
                <dd>
                  <a href={`mailto:${viewEnquiry.email}`} className="text-blue-600 underline">
                    {viewEnquiry.email}
                  </a>
                </dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="font-semibold">Cell Number:</dt>
                <dd>{viewEnquiry.cell_number}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="font-semibold">Location:</dt>
                <dd>{viewEnquiry.location}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="font-semibold">Total Cash to Invest:</dt>
                <dd>₹{viewEnquiry.total_cash}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="font-semibold">Number of Stores:</dt>
                <dd>{viewEnquiry.num_stores}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="font-semibold">Type:</dt>
                <dd>{viewEnquiry.type}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="font-semibold">Status:</dt>
                <dd>{viewEnquiry.status}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="font-semibold">Date:</dt>
                <dd>{viewEnquiry.date}</dd>
              </div>
            </dl>
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

function FranchiseManagement() {
  const [activeTab, setActiveTab] = useState('enquiry');

  const [franchiseId] = useState("your_franchise_id_here"); // <-- Change this to a real franchise id

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center py-4 sm:h-16">
            <h1 className="text-xl sm:text-2xl font-bold text-indigo-600 mb-2 sm:mb-0">Franchise & Dealership Management</h1>
            {/* <div className="flex items-center space-x-4">
              <span className="text-gray-500 text-sm sm:text-base">{new Date().toLocaleString()}</span>
              <div className="relative">
                <img
                  className="h-8 w-8 rounded-full"
                  src={`https://ui-avatars.com/api/?name=amit24veek&background=0D8ABC&color=fff`}
                  alt="User avatar"
                />
                <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full ring-2 ring-white bg-green-400"></span>
              </div>
            </div> */}
          </div>
        </div>
      </header>
      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex flex-col sm:flex-row sm:space-x-4 overflow-x-auto">
            {[
              { id: 'enquiry', name: 'Enquiry Tracking' },
              { id: 'kyc', name: 'KYC & MoU Upload' },
              { id: 'investment', name: 'Investment Documents' },
              { id: 'locations', name: 'Franchise Map' },
              { id: 'commission', name: 'Commission & Profit' },
              { id: 'renewal', name: 'Renewal Tracking' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm sm:text-base text-center flex-1 sm:flex-none`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>
      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'enquiry' && <EnquiryTracking />}
        {activeTab === 'kyc' && <KycUploadSystem franchiseId={franchiseId} />}
        {activeTab === 'investment' && <InvestmentDocuments />}
        {activeTab === 'locations' && <FranchiseMap />}
        {activeTab === 'commission' && <CommissionProfitModule />}
        {activeTab === 'renewal' && <RenewalTracking />}
      </div>
    </div>
  );
}

const DOCS = [
  { label: "Identity Proof", key: "Identity Proof", accept: ".pdf,.jpg,.jpeg,.png", hint: "PNG, JPG, PDF up to 10MB" },
  { label: "Address Proof", key: "Address Proof", accept: ".pdf,.jpg,.jpeg,.png", hint: "PNG, JPG, PDF up to 10MB" },
  { label: "Business Registration", key: "Business Registration", accept: ".pdf,.jpg,.jpeg,.png", hint: "PNG, JPG, PDF up to 10MB" },
  { label: "MoU Document", key: "MoU Document", accept: ".pdf", hint: "PDF up to 10MB" },
];

async function uploadKycDoc(enquiryId, file, docType) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("docType", docType);
  const res = await fetch(`${API_BASE}/enquiries/${enquiryId}/upload-kyc`, {
    method: "POST",
    body: formData,
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = { detail: await res.text() };
  }
  if (!res.ok) {
    throw new Error(data.detail || "Upload failed");
  }
  return data;
}
async function fetchApprovedEnquiries() {
  const res = await fetch(`${API_BASE}/enquiries?status=approved`);
  if (!res.ok) return [];
  const data = await res.json();
  return (Array.isArray(data) ? data : []).filter(
    (enq) => (enq.status || "").toLowerCase() === "approved"
  );
}
async function fetchAllEnquiries() {
  const res = await fetch(`${API_BASE}/enquiries`);
  if (!res.ok) return [];
  const arr = await res.json();
  return Array.isArray(arr) ? arr : [];
}
async function fetchKycDocsForEnquiry(enquiryId) {
  const res = await fetch(`${API_BASE}/enquiries/${enquiryId}/kyc-docs`);
  if (!res.ok) return [];
  const arr = await res.json();
  return Array.isArray(arr) ? arr : [];
}
async function approveEnquiry(enquiryId) {
  await fetch(`${API_BASE}/enquiries/${enquiryId}/approve`, { method: "PATCH" });
}
async function rejectEnquiry(enquiryId) {
  await fetch(`${API_BASE}/enquiries/${enquiryId}/reject`, { method: "PATCH" });
}

function SimpleSelect({ options, value, onChange, ...rest }) {
  return (
    <select
      value={value ? value.value : ""}
      onChange={e => {
        const selected = options.find(opt => opt.value === e.target.value);
        onChange(selected || null);
      }}
      {...rest}
    >
      <option value="">Select approved enquiry...</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}


function Modal({ open, onClose, children, fullscreen }) {
  if (!open) return null;
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 ${fullscreen ? "p-0" : ""
        }`}
    >
      <div
        className={`bg-white p-6 rounded-lg shadow-lg relative w-full ${fullscreen ? "h-full max-w-full" : "max-w-xl"
          }`}
        style={fullscreen ? { height: "100%" } : {}}
      >
        <button
          className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-800 text-xl"
          onClick={onClose}
        >
          &times;
        </button>
        <div className={fullscreen ? "h-full flex items-center justify-center" : ""}>
          {children}
        </div>
      </div>
    </div>
  );
}



function FilePreview({ doc, fullscreen }) {
  const BASE_URL = "https://cubehis.avopay.pro:5000";
  const [imgError, setImgError] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  if (!doc || !doc.url) return null;

  const fileUrl = doc.url.startsWith("http") ? doc.url : `${BASE_URL}${doc.url}`;
  const isImage = /\.(jpg|jpeg|png)$/i.test(fileUrl);
  const isPdf = /\.pdf$/i.test(fileUrl);

  if (isImage) {
    if (imgError) {
      return (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
          Download/View Image
        </a>
      );
    }
    return (
      <img
        src={fileUrl}
        alt={doc.name || "preview"}
        className={fullscreen ? "w-full h-full object-contain" : "max-h-96 max-w-full rounded shadow"}
        style={fullscreen ? { maxHeight: "100vh" } : {}}
        onError={() => setImgError(true)}
      />
    );
  }

  if (isPdf) {
    if (iframeError) {
      return (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
          Download/View PDF
        </a>
      );
    }
    return (
      <iframe
        src={fileUrl}
        title={doc.name || "PDF Document"}
        className={fullscreen ? "w-full h-full" : "w-full h-96 rounded shadow"}
        style={fullscreen ? { minHeight: "100vh" } : {}}
        onError={() => setIframeError(true)}
      />
    );
  }

  return (
    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
      {doc.name || "Download file"}
    </a>
  );
}

function KycUploadSystem() {
  // Form states
  const [kycDocs, setKycDocs] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [previews, setPreviews] = useState({});
  const [enquiries, setEnquiries] = useState([]);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [loadingEnquiries, setLoadingEnquiries] = useState(true);

  // Table states
  const [allEnquiries, setAllEnquiries] = useState([]);
  const [tableLoading, setTableLoading] = useState(true);

  // Modal states for viewing card
  const [viewDocModal, setViewDocModal] = useState(false);
  const [modalDoc, setModalDoc] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Modal for admin view
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [modalDocs, setModalDocs] = useState([]);
  const [modalEnquiry, setModalEnquiry] = useState(null);

  const [uploading, setUploading] = useState({});
  const [uploadError, setUploadError] = useState({});
  const [successMsg, setSuccessMsg] = useState({});
  const [allUploading, setAllUploading] = useState(false);
  const [allUploadError, setAllUploadError] = useState("");
  const [allSuccessMsg, setAllSuccessMsg] = useState("");
  const [refreshTable, setRefreshTable] = useState(0);

  // Fetch approved for upload form
  useEffect(() => {
    setLoadingEnquiries(true);
    fetchApprovedEnquiries()
      .then((data) => setEnquiries(data))
      .finally(() => setLoadingEnquiries(false));
  }, []);
  // Fetch all for table
  useEffect(() => {
    setTableLoading(true);
    fetchAllEnquiries()
      .then(async (enquiries) => {
        // Fetch KYC docs for each enquiry
        const enquiriesWithDocs = await Promise.all(
          enquiries.map(async (enq) => {
            try {
              const kycDocs = await fetchKycDocsForEnquiry(enq.enquiry_id);
              console.log(`KYC docs for ${enq.enquiry_id}:`, kycDocs);
              return { ...enq, kyc_docs: kycDocs };
            } catch (error) {
              console.error(`Error fetching KYC docs for ${enq.enquiry_id}:`, error);
              return { ...enq, kyc_docs: [] };
            }
          })
        );
        setAllEnquiries(enquiriesWithDocs);
      })
      .catch((error) => {
        console.error("Error fetching enquiries:", error);
        setAllEnquiries([]);
      })
      .finally(() => setTableLoading(false));
  }, [refreshTable]);
  // Preview images for uploads
  useEffect(() => {
    Object.values(previews).forEach((url) => url && URL.revokeObjectURL(url));
    let newPreviews = {};
    for (let key of Object.keys(selectedFiles)) {
      const file = selectedFiles[key];
      if (file && file.type && file.type.startsWith("image/")) {
        newPreviews[key] = URL.createObjectURL(file);
      } else {
        newPreviews[key] = null;
      }
    }
    setPreviews(newPreviews);
    return () => {
      Object.values(newPreviews).forEach((url) => url && URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);
  // Fetch KYC docs for selected enquiry
  useEffect(() => {
    if (selectedEnquiry) {
      fetchKycDocsForEnquiry(selectedEnquiry.value)
        .then(setKycDocs);
    } else {
      setKycDocs([]);
    }
  }, [selectedEnquiry]);

  const DOC_TYPES = [
    "Identity Proof",
    "Address Proof",
    "Business Registration",
    "MoU Document"
  ];

  function isKycDocUploaded(enq, docType) {
    if (!Array.isArray(enq.kyc_docs)) return false;
    const doc = enq.kyc_docs.find(d => d.docType === docType);
    // Debug log to understand the data structure
    console.log(`Checking ${docType} for ${enq.enquiry_id}:`, doc);
    // Return true if document exists and has a valid URL and is not rejected
    return !!(doc && doc.url && (!doc.status || doc.status.toLowerCase() !== "rejected"));
  }

  const enquiryOptions = enquiries.map((enq) => ({
    value: enq.enquiry_id,
    label: `${enq.enquiry_id} - ${enq.first_name} ${enq.last_name ? enq.last_name : ""} (${enq.email || ""})`,
    raw: enq,
  }));

  const handleFileChange = (ev, docType) => {
    const file = ev.target.files?.[0];
    setSelectedFiles((prev) => ({ ...prev, [docType]: file }));
    setUploadError((prev) => ({ ...prev, [docType]: "" }));
    setSuccessMsg((prev) => ({ ...prev, [docType]: "" }));
  };


  function hasAnyPending(enq) {
    if (!Array.isArray(enq.kyc_docs)) return false;
    return DOC_TYPES.some(docType => {
      const doc = enq.kyc_docs.find(d => d.docType === docType);
      return doc && doc.status && doc.status.toLowerCase() === "pending";
    });
  }

  const handleUploadDoc = async (doc) => {
    if (!selectedEnquiry) {
      setUploadError((prev) => ({ ...prev, [doc.key]: "Please select an approved Enquiry first." }));
      return;
    }
    const file = selectedFiles[doc.key];
    if (!file) {
      setUploadError((prev) => ({ ...prev, [doc.key]: "No file selected." }));
      return;
    }
    setUploading((prev) => ({ ...prev, [doc.key]: true }));
    setUploadError((prev) => ({ ...prev, [doc.key]: "" }));
    setSuccessMsg((prev) => ({ ...prev, [doc.key]: "" }));
    try {
      const uploaded = await uploadKycDoc(selectedEnquiry.value, file, doc.key);
      setKycDocs((docs) => [
        ...docs.filter((d) => d.docType !== doc.key),
        { ...uploaded, docType: doc.key },
      ]);
      setSelectedFiles((prev) => ({ ...prev, [doc.key]: undefined }));
      setSuccessMsg((prev) => ({ ...prev, [doc.key]: "Document uploaded successfully!" }));
      // Refresh the table to show updated status
      setRefreshTable(prev => prev + 1);
    } catch (err) {
      setUploadError((prev) => ({
        ...prev,
        [doc.key]: typeof err === "string" ? err : err.message || "Upload failed",
      }));
    } finally {
      setUploading((prev) => ({ ...prev, [doc.key]: false }));
    }
  };

  function hasDoc(enq, docType) {
    if (!Array.isArray(enq.kyc_docs)) return false;
    // Find doc for this type and status
    const doc = enq.kyc_docs.find(
      d => d.docType === docType && d.status && d.status.toLowerCase() !== "rejected"
    );
    return !!doc;
  }

  // Submit All enabled if ANY file is selected and not uploading
  const anyFileSelected = DOCS.some(d => selectedFiles[d.key]);
  const anyUploading = Object.values(uploading).some(Boolean);

  const handleSubmitAll = async () => {
    setAllUploading(true);
    setAllUploadError("");
    setAllSuccessMsg("");
    if (!selectedEnquiry) {
      setAllUploadError("Please select an approved Enquiry first.");
      setAllUploading(false);
      return;
    }
    // Only upload those selected
    const filesToUpload = DOCS.filter(d => selectedFiles[d.key]);
    if (filesToUpload.length === 0) {
      setAllUploadError("Please select at least one file before submitting.");
      setAllUploading(false);
      return;
    }
    let hasError = false;
    let newDocs = [];
    for (let doc of filesToUpload) {
      try {
        const uploaded = await uploadKycDoc(selectedEnquiry.value, selectedFiles[doc.key], doc.key);
        newDocs.push({ ...uploaded, docType: doc.key });
      } catch (err) {
        setAllUploadError(`Failed to upload ${doc.label}: ${typeof err === "string" ? err : err.message || "Upload failed"}`);
        hasError = true;
        break;
      }
    }
    setAllUploading(false);
    if (!hasError) {
      setKycDocs((docs) => [
        ...docs.filter((d) => !newDocs.find(nd => nd.docType === d.docType)),
        ...newDocs
      ]);
      setSelectedFiles({});
      setAllSuccessMsg("All selected documents uploaded successfully!");
      // Refresh the table to show updated status
      setRefreshTable(prev => prev + 1);
    }
  };

  const handleRetry = (doc) => {
    setUploadError((prev) => ({ ...prev, [doc.key]: "" }));
    setSuccessMsg((prev) => ({ ...prev, [doc.key]: "" }));
    setSelectedFiles((prev) => ({ ...prev, [doc.key]: undefined }));
    setPreviews((prev) => ({ ...prev, [doc.key]: null }));
  };


  const handleApprove = async (enquiryId) => {
    await approveEnquiry(enquiryId);
    setAllEnquiries((prev) =>
      prev.map((e) =>
        e.enquiry_id === enquiryId ? { ...e, status: "approved" } : e
      )
    );
  };
  const handleReject = async (enquiryId) => {
    await rejectEnquiry(enquiryId);
    setAllEnquiries((prev) =>
      prev.map((e) =>
        e.enquiry_id === enquiryId ? { ...e, status: "rejected" } : e
      )
    );
  };
  const handleViewDocs = async (enq) => {
    // Open first KYC doc in full screen, else show modal with message
    const docs = await fetchKycDocsForEnquiry(enq.enquiry_id);
    if (docs.length > 0) {
      setModalDoc(docs[0]);
      setFullscreen(true);
      setViewDocModal(true);
    } else {
      setModalEnquiry(enq);
      setModalDocs([]);
      setViewModalOpen(true);
    }
  };
  const handleViewFileCard = (doc) => {
    setModalDoc(doc);
    setFullscreen(true);
    setViewDocModal(true);
  };
  const handleCloseModal = () => {
    setViewDocModal(false);
    setModalDoc(null);
    setFullscreen(false);
  };

  return (
    <div>
      {/* Upload Form */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg sm:text-xl font-medium text-gray-900">KYC & MoU Upload System</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Select your approved enquiry and upload required documents for verification.
          </p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Approved Enquiry <span className="text-red-600">*</span>
              </label>
              <SimpleSelect
                options={enquiryOptions}
                value={selectedEnquiry}
                onChange={setSelectedEnquiry}
                disabled={loadingEnquiries}
                className="border rounded px-2 py-1 w-full"
              />
            </div>
            <div>
              <h3 className="text-md sm:text-lg font-medium text-gray-900">Personal KYC Documents</h3>
              <div className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                {DOCS.map((doc) => (
                  <div key={doc.key} className="border rounded-lg p-4 bg-gray-50 flex flex-col gap-2">
                    <label className="block text-sm font-medium text-gray-700">{doc.label}</label>
                    <div className="flex flex-col items-center gap-2">
                      {previews[doc.key] && (
                        <img
                          src={previews[doc.key]}
                          alt="preview"
                          className="h-28 w-auto object-contain border rounded"
                        />
                      )}

                      <input
                        type="file"
                        accept={doc.accept}
                        id={`${doc.key}-upload`}
                        className="hidden"
                        onChange={(ev) => handleFileChange(ev, doc.key)}
                        disabled={uploading[doc.key] || allUploading}
                      />
                      <label
                        htmlFor={`${doc.key}-upload`}
                        className="cursor-pointer flex flex-col items-center space-y-1"
                      >
                        <span className="text-indigo-600 font-medium underline">
                          {selectedFiles[doc.key]?.name || "Choose file"}
                        </span>
                        <span className="text-xs text-gray-500">{doc.hint}</span>
                      </label>
                      {uploadError[doc.key] && (
                        <div className="text-red-600 text-xs">{uploadError[doc.key]}</div>
                      )}
                      {successMsg[doc.key] && (
                        <div className="text-green-600 text-xs">{successMsg[doc.key]}</div>
                      )}
                      {selectedFiles[doc.key] && !uploading[doc.key] && !allUploading && (
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => handleRetry(doc)}
                            className="px-4 py-1 rounded bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300"
                          >
                            Retry
                          </button>
                        </div>
                      )}
                      {uploading[doc.key] && (
                        <div className="text-xs text-indigo-600">Uploading...</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Submit All Button */}
            <div className="flex mt-4 gap-3 justify-end">
              <button
                type="button"
                className="px-8 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow text-lg transition disabled:opacity-60"
                disabled={
                  allUploading ||
                  !selectedEnquiry ||
                  !anyFileSelected ||
                  anyUploading
                }
                onClick={handleSubmitAll}
              >
                {allUploading ? "Uploading..." : "Submit All"}
              </button>
            </div>
            {allUploadError && (
              <div className="py-2 px-3 rounded bg-red-100 text-red-700 text-sm font-medium text-center">{allUploadError}</div>
            )}
            {allSuccessMsg && (
              <div className="py-2 px-3 rounded bg-green-100 text-green-700 text-sm font-medium text-center">{allSuccessMsg}</div>
            )}
          </div>
        </div>
      </div>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg px-4 py-5 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">KYC Documents Status</h3>
          <button
            onClick={() => setRefreshTable(prev => prev + 1)}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            disabled={tableLoading}
          >
            {tableLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {tableLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading enquiries...</p>
          </div>
        ) : (
          <table className="min-w-full border bg-white rounded text-center">
            <thead>
              <tr>
                <th className="border px-4 py-2" rowSpan={2}>Enquiry id</th>
                <th className="border px-4 py-2" rowSpan={2}>Name</th>
                <th className="border px-4 py-2" colSpan={DOC_TYPES.length}>KYC Docs</th>
                <th className="border px-4 py-2" rowSpan={2}>Status</th>
              </tr>
              <tr>
                {DOC_TYPES.map(type => (
                  <th key={type} className="border px-4 py-2">{type}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allEnquiries.filter(enq => enq.status && enq.status.toLowerCase() === "approved").length === 0 && (
                <tr>
                  <td colSpan={2 + DOC_TYPES.length + 1} className="text-center py-4 text-gray-500">
                    No approved enquiries found.
                  </td>
                </tr>
              )}
              {allEnquiries
                .filter(enq => enq.status && enq.status.toLowerCase() === "approved")
                .map((enq) => {
                  const pending = hasAnyPending(enq);
                  return (
                    <tr key={enq.enquiry_id} className="text-center">
                      <td className="border px-4 py-2">{enq.enquiry_id}</td>
                      <td className="border px-4 py-2">{enq.first_name}</td>
                      {DOC_TYPES.map(type => {
                        const uploaded = isKycDocUploaded(enq, type);
                        return (
                          <td key={type} className="border px-4 py-2 font-bold"
                            style={{
                              color: uploaded
                                ? "#059669" // green-600
                                : "#e11d48" // red-600
                            }}
                          >
                            {uploaded ? "Yes" : "No"}
                          </td>
                        );
                      })}
                      <td className="border px-4 py-2">
                        <span
                          className={
                            pending
                              ? "text-yellow-600 font-semibold"
                              : enq.status === "approved"
                                ? "text-green-600 font-semibold"
                                : enq.status === "rejected"
                                  ? "text-red-600 font-semibold"
                                  : "text-gray-700"
                          }
                        >
                          {pending ? "pending" : enq.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={viewDocModal} onClose={handleCloseModal} fullscreen={fullscreen}>
        {modalDoc && (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="font-bold text-lg mb-2">{modalDoc.docType}</div>
            <FilePreview doc={modalDoc} fullscreen={fullscreen} />
            <div className="mt-2 text-gray-500 text-xs">{modalDoc.name}</div>
          </div>
        )}
      </Modal>

      {/* Admin enquiry docs modal */}
      <Modal open={viewModalOpen} onClose={() => setViewModalOpen(false)} fullscreen={false}>
        <h3 className="text-lg font-semibold mb-2">
          Uploaded Documents for {modalEnquiry?.first_name} {modalEnquiry?.last_name}
        </h3>
        <ul>
          {modalDocs.length === 0 && <li>No documents uploaded.</li>}
          {modalDocs.map((doc, idx) => (
            <li key={idx} className="mb-1">
              <span className="font-semibold">{doc.docType}</span>:{" "}
              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
                {doc.name}
              </a>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}


function InvestmentDocuments() {
  const [approvedEnquiries, setApprovedEnquiries] = useState([]);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [newDoc, setNewDoc] = useState({ title: "", type: "Investment Agreement", file: null });
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Fetch approved enquiries on mount
  useEffect(() => {
    fetchApprovedEnquiries().then(enqs => {
      setApprovedEnquiries(
        enqs.map(e => ({
          value: e.enquiry_id || e._id || e.id,
          label: `${e.enquiry_id || e._id || e.id} - ${((e.first_name || "") + " " + (e.last_name || "")).trim()}`,

        }))
      );
    });
  }, []);

  // Fetch KYC docs when selectedEnquiry changes
  useEffect(() => {
    if (selectedEnquiry && selectedEnquiry.value) {
      fetchKycDocsForEnquiry(selectedEnquiry.value).then(setDocuments);
    } else {
      setDocuments([]);
    }
    setError("");
    setSuccessMsg("");
    setNewDoc({ title: "", type: "Investment Agreement", file: null });
    if (document.getElementById("file-upload")) {
      document.getElementById("file-upload").value = "";
    }
  }, [selectedEnquiry]);

  const handleInputChange = e => {
    const { name, value } = e.target;
    setNewDoc(doc => ({ ...doc, [name]: value }));
  };

  const handleFileChange = e => {
    setNewDoc(doc => ({ ...doc, file: e.target.files[0] }));
  };

  const handleUpload = async () => {
    setError("");
    setSuccessMsg("");
    if (!newDoc.title || !newDoc.file) {
      setError("Please enter document title and select a file.");
      return;
    }
    if (!selectedEnquiry) {
      setError("Please select an Approved Enquiry ID.");
      return;
    }
    setUploading(true);
    try {
      await uploadKycDoc(
        selectedEnquiry.value,
        newDoc.file,
        newDoc.type,
        newDoc.title
      );
      setSuccessMsg("Document uploaded successfully.");
      fetchKycDocsForEnquiry(selectedEnquiry.value).then(setDocuments);
      setNewDoc({ title: "", type: "Investment Agreement", file: null });
      if (document.getElementById("file-upload")) {
        document.getElementById("file-upload").value = "";
      }
    } catch (e) {
      setError(typeof e === "string" ? e : e.message || "Upload failed");
    }
    setUploading(false);
  };

  // Filtered docs for search
  const filteredDocs = documents.filter(
    d =>
      (!search || (d.title || d.name || "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
      {/* Upload Section */}
      <div className="bg-gradient-to-br from-indigo-50 to-white shadow-lg rounded-2xl mb-8 border border-indigo-100">
        <div className="px-6 py-6 border-b border-indigo-100 flex items-center gap-4">
          <div className="bg-indigo-100 text-indigo-600 rounded-xl p-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-indigo-900">Upload Investment Document</h2>
            <div className="text-gray-500 text-sm">Attach investment docs to approved enquiries</div>
          </div>
        </div>
        <div className="px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Approved Enquiry ID <span className="text-red-500">*</span></label>
              <SimpleSelect
                options={approvedEnquiries}
                value={selectedEnquiry}
                onChange={setSelectedEnquiry}
                disabled={approvedEnquiries.length === 0}
              />
            </div>
            <div>
              <label htmlFor="doc-title" className="block text-sm font-semibold text-gray-700 mb-2">Document Title</label>
              <input
                type="text"
                name="title"
                id="doc-title"
                autoComplete="off"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={newDoc.title}
                onChange={handleInputChange}
                disabled={!selectedEnquiry}
              />
            </div>
            <div>
              <label htmlFor="doc-type" className="block text-sm font-semibold text-gray-700 mb-2">Document Type</label>
              <select
                id="doc-type"
                name="type"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={newDoc.type}
                onChange={handleInputChange}
                disabled={!selectedEnquiry}
              >
                <option>Investment Agreement</option>
                <option>Property Document</option>
                <option>Equipment Invoice</option>
                <option>Bank Statement</option>
                <option>Other</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Document</label>
              <div className="flex items-center gap-3">
                <label htmlFor="file-upload" className={"flex-1 flex items-center px-4 py-3 border-2 border-dashed rounded-lg " +
                  (newDoc.file ? "border-green-300 bg-green-50" : "border-gray-300 bg-white") +
                  " cursor-pointer hover:bg-indigo-50 transition"}>
                  <svg className="w-6 h-6 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm text-gray-600">{newDoc.file ? newDoc.file.name : "Choose a file"}</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    onChange={handleFileChange}
                    disabled={!selectedEnquiry}
                  />
                </label>
                <span className="text-xs text-gray-500">PDF, DOC, DOCX up to 10MB</span>
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="inline-flex items-center px-5 py-3 border border-transparent text-sm font-semibold rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition w-full"
                onClick={handleUpload}
                disabled={!selectedEnquiry || uploading}
              >
                {uploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24"
                      xmlns="https://www.w3.org/2000/svg"><circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                    Uploading...
                  </>
                ) : "Upload Document"}
              </button>
            </div>
            {(error || successMsg) && (
              <div className="md:col-span-3">
                {error && <div className="text-red-600 mt-2">{error}</div>}
                {successMsg && <div className="text-green-600 mt-2">{successMsg}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white shadow-xl rounded-2xl mb-10 border">
        <div className="px-6 py-5 border-b flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            Investment Documents {selectedEnquiry && (<span className="text-indigo-600 font-medium">({selectedEnquiry.label})</span>)}
          </h2>
          <input
            type="text"
            placeholder="Search documents..."
            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full md:w-64 sm:text-sm border-gray-300 rounded-md"
            value={search}
            onChange={e => setSearch(e.target.value)}
            disabled={documents.length === 0}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-indigo-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-indigo-700 uppercase">Document Title</th>
                <th className="px-4 py-3 text-left font-semibold text-indigo-700 uppercase">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-indigo-700 uppercase">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-indigo-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-indigo-700 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredDocs.map(doc => (
                <tr key={doc.id || doc._id || doc.name}>
                  <td className="px-4 py-4 font-medium text-gray-900">{doc.title || doc.name}</td>
                  <td className="px-4 py-4 text-gray-700">{doc.docType || doc.type || "-"}</td>
                  <td className="px-4 py-4 text-gray-700">{doc.date || doc.uploaded_at || "-"}</td>
                  <td className="px-4 py-4">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${(doc.status || '').toLowerCase() === 'verified'
                        ? 'bg-green-100 text-green-800'
                        : (doc.status || '').toLowerCase() === 'pending review'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                      {doc.status || "Pending Review"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {doc.url && (
                      <div className="flex gap-2">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900 font-semibold transition"
                        >
                          View
                        </a>
                        <a
                          href={doc.url}
                          download
                          className="text-indigo-600 hover:text-indigo-900 font-semibold transition"
                        >
                          Download
                        </a>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400 py-8">
                    {selectedEnquiry
                      ? "No documents found for this enquiry."
                      : "Select an approved enquiry to view documents."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- FRANCHISE MAP (API INTEGRATED) ---
function FranchiseMap() {
  const franchiseLocations = [
    { id: 1, name: 'Mumbai Central', address: '123 Marine Drive, Mumbai', status: 'Active', performance: 'High' },
    { id: 2, name: 'Delhi North', address: '45 Connaught Place, Delhi', status: 'Active', performance: 'Medium' },
    { id: 3, name: 'Bangalore Tech Park', address: '78 Electronic City, Bangalore', status: 'Active', performance: 'High' },
    { id: 4, name: 'Chennai Beach', address: '567 Marina Beach Road, Chennai', status: 'Under Setup', performance: 'N/A' },
    { id: 5, name: 'Hyderabad Central', address: '890 Jubilee Hills, Hyderabad', status: 'Active', performance: 'Medium' }
  ];

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h2 className="text-lg sm:text-xl font-medium text-gray-900">Franchise Location Map</h2>
        <p className="mt-1 max-w-2xl text-sm sm:text-base">Overview of all franchise locations across the country</p>
      </div>
      <div className="border-t border-gray-200">
        <div className="h-64 sm:h-96 bg-gray-100 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-500 text-sm sm:text-lg">Interactive Map Component would be integrated here</p>
            <p className="text-gray-500 text-xs sm:text-sm absolute bottom-4 sm:bottom-6 left-4 sm:left-6">(Using Google Maps or MapBox API)</p>
          </div>
          <div className="absolute" style={{ top: '30%', left: '25%' }}>
            <div className="h-6 w-6 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xs">1</div>
          </div>
          <div className="absolute" style={{ top: '20%', left: '15%' }}>
            <div className="h-6 w-6 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xs">2</div>
          </div>
          <div className="absolute" style={{ top: '60%', left: '30%' }}>
            <div className="h-6 w-6 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xs">3</div>
          </div>
          <div className="absolute" style={{ top: '70%', left: '40%' }}>
            <div className="h-6 w-6 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-xs">4</div>
          </div>
          <div className="absolute" style={{ top: '55%', left: '35%' }}>
            <div className="h-6 w-6 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xs">5</div>
          </div>
        </div>

        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg sm:text-xl font-medium text-gray-900">Franchise Locations</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th scope="col" className="py-3 pl-4 sm:pl-0 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 sm:text-sm">Name</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 sm:text-sm">Address</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 sm:text-sm">Status</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 sm:text-sm">Performance</th>
                  <th scope="col" className="py-3 pl-3 pr-4 sm:pr-0 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {franchiseLocations.map(location => (
                  <tr key={location.id}>
                    <td className="whitespace-nowrap py-4 pl-4 sm:pl-0 pr-3 text-sm font-medium text-gray-900">{location.name}</td>
                    <td className="px-3 py-4 text-sm text-gray-500 break-words">{location.address}</td>
                    <td className="px-3 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 sm:text-sm ${location.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {location.status}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-sm">
                      {location.performance === 'N/A' ? (
                        <span className="text-gray-400">N/A</span>
                      ) : (
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 sm:text-sm ${location.performance === 'High' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                          {location.performance}
                        </span>
                      )}
                    </td>
                    <td className="py-4 pl-3 pr-4 sm:pr-0 text-right text-sm font-medium">
                      <button className="text-indigo-600 hover:text-indigo-900">Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6 border-t">
          <button
            type="button"
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full sm:w-auto"
          >
            <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="https://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add New Location
          </button>
        </div>
      </div>
    </div>
  );
}

function CommissionProfitModule() {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');

  const revenueData = {
    monthly: [30000, 35000, 25000, 40000, 32000, 48000],
    quarterly: [90000, 97000, 120000],
    yearly: [300000]
  };

  const commissionData = {
    monthly: [4500, 5250, 3750, 6000, 4800, 7200],
    quarterly: [13500, 14550, 18000],
    yearly: [45000]
  };

  return (
    <div>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <h2 className="text-lg sm:text-xl font-medium text-gray-900 mb-2 sm:mb-0">Performance & Commission Overview</h2>
          <div className="inline-flex shadow-sm rounded-md">
            <button
              type="button"
              onClick={() => setSelectedPeriod('monthly')}
              className={`${selectedPeriod === 'monthly'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700'
                } px-3 sm:px-4 py-2 text-sm font-medium rounded-l-md border border-gray-300 hover:bg-gray-50 focus:z-10 focus:outline-none`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod('quarterly')}
              className={`${selectedPeriod === 'quarterly'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700'
                } px-3 sm:px-4 py-2 text-sm font-medium border-t border-b border-gray-300 hover:bg-gray-50 focus:z-10 focus:outline-none`}
            >
              Quarterly
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod('yearly')}
              className={`${selectedPeriod === 'yearly'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700'
                } px-3 sm:px-4 py-2 text-sm font-medium rounded-r-md border border-gray-300 hover:bg-gray-50 focus:z-10 focus:outline-none`}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-lg sm:text-xl font-medium text-gray-900">Revenue</h3>
              <div className="mt-2 bg-gray-50 p-4 rounded-lg h-64 flex items-end justify-around overflow-x-auto">
                {revenueData[selectedPeriod].map((amount, index) => (
                  <div key={index} className="flex flex-col items-center min-w-[60px] sm:min-w-[80px]">
                    <div
                      className="bg-indigo-600 w-12 sm:w-16 rounded-t-md"
                      style={{ height: `${amount / 500}px` }}
                    ></div>
                    <span className="mt-2 text-xs text-gray-500">
                      {selectedPeriod === 'monthly' ? `M${index + 1}` :
                        selectedPeriod === 'quarterly' ? `Q${index + 1}` : '2025'}
                    </span>
                    <span className="mt-1 text-sm font-medium">₹{(amount / 1000).toFixed(1)}K</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-medium text-gray-900">Commission</h3>
              <div className="mt-2 bg-gray-50 p-4 rounded-lg h-64 flex items-end justify-around overflow-x-auto">
                {commissionData[selectedPeriod].map((amount, index) => (
                  <div key={index} className="flex flex-col items-center min-w-[60px] sm:min-w-[80px]">
                    <div
                      className="bg-green-600 w-12 sm:w-16 rounded-t-md"
                      style={{ height: `${amount / 100}px` }}
                    ></div>
                    <span className="mt-2 text-xs text-gray-500">
                      {selectedPeriod === 'monthly' ? `M${index + 1}` :
                        selectedPeriod === 'quarterly' ? `Q${index + 1}` : '2025'}
                    </span>
                    <span className="mt-1 text-sm font-medium">₹{(amount / 1000).toFixed(1)}K</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-gray-200 pt-6">
            <h3 className="text-lg sm:text-xl font-medium text-gray-900">Profit Breakdown</h3>
            <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">Total Revenue (YTD)</dt>
                <dd className="mt-1 text-2xl sm:text-3xl font-semibold text-gray-900">₹900,000</dd>
                <dd className="mt-2 text-sm text-green-600">
                  <span className="font-medium">+12%</span> vs last year
                </dd>
              </div>

              <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">Total Commission (YTD)</dt>
                <dd className="mt-1 text-2xl sm:text-3xl font-semibold text-gray-900">₹135,000</dd>
                <dd className="mt-2 text-sm text-green-600">
                  <span className="font-medium">+15%</span> vs last year
                </dd>
              </div>

              <div className="px-4 py-5 bg-white shadow rounded-lg overflow-hidden sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">Commission Rate</dt>
                <dd className="mt-1 text-2xl sm:text-3xl font-semibold text-gray-900">15%</dd>
                <dd className="mt-2 text-sm text-green-600">
                  <span className="font-medium">+0.5%</span> vs last period
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg sm:text-xl font-medium text-gray-900">Transaction History</h2>
        </div>
        <div className="border-t border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction ID</th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[
                { date: '2025-06-01', id: 'TRX001', desc: 'Monthly Commission Payment', amount: '₹7,200' },
                { date: '2025-05-01', id: 'TRX002', desc: 'Monthly Commission Payment', amount: '₹4,800' },
                { date: '2025-04-01', id: 'TRX003', desc: 'Monthly Commission Payment', amount: '₹6,000' },
                { date: '2025-03-01', id: 'TRX004', desc: '2025-03-25', amount: '₹3,750' },
                { date: '2025-02-01', id: 'TRX005', desc: 'Monthly Commission Payment', amount: '₹5,250' }
              ].map((transaction, i) => (
                <tr key={i}>
                  <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-sm text-gray-900">{transaction.date}</td>
                  <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-sm text-gray-900">{transaction.id}</td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-gray-500 break-words">{transaction.desc}</td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{transaction.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RenewalTracking() {
  const [renewals, setRenewals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState(""); // yyyy-mm-dd
  const [end, setEnd] = useState("");
  const [selected, setSelected] = useState(null);

  // Fetch data on filter change
  useEffect(() => {
    if (!start || !end) return;
    setLoading(true);
    fetch(`${API_BASE}/expiring-soon?start=${start}&end=${end}`)
      .then(res => res.json())
      .then(setRenewals)
      .catch(() => setRenewals([]))
      .finally(() => setLoading(false));
  }, [start, end]);

  // Helper for date input min/max
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex flex-col sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="text-lg sm:text-xl font-medium text-gray-900">
            Renewal & Expiry Tracking
          </h2>
          <p className="mt-1 max-w-2xl text-sm sm:text-base">
            Monitor upcoming renewals and expired agreements
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0 items-center">
          <label className="text-sm text-gray-600 font-medium" htmlFor="start">
            Start Date:
          </label>
          <input
            type="date"
            id="start"
            className="border px-2 py-1 rounded"
            value={start}
            max={end || ""}
            onChange={e => setStart(e.target.value)}
          />
          <label className="text-sm text-gray-600 font-medium" htmlFor="end">
            End Date:
          </label>
          <input
            type="date"
            id="end"
            className="border px-2 py-1 rounded"
            value={end}
            min={start || today}
            onChange={e => setEnd(e.target.value)}
          />
        </div>
      </div>
      <div className="border-t border-gray-200 px-4 py-5 sm:p-0 overflow-x-auto">
        {!start || !end ? (
          <div className="p-4 text-gray-500">Select start and end date.</div>
        ) : loading ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : renewals.length === 0 ? (
          <div className="p-4 text-gray-500">No franchises found in this range.</div>
        ) : (
          <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-6 sm:gap-4 sm:px-6 bg-gray-50 font-medium text-xs sm:text-sm text-gray-500">
              <dt>Name</dt>
              <dd>Address</dd>
              <dd>Region</dd>
              <dd>Expiry Date</dd>
              <dd>Status</dd>
              <dd></dd>
            </div>
            {renewals.map(item => (
              <div key={item.id} className="py-4 sm:py-5 sm:grid sm:grid-cols-6 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-900 break-words">{item.name}</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0">{item.address}</dd>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0">{item.region}</dd>
                <dd className="mt-1 text-sm sm:mt-0">{item.expiry_date}</dd>
                <dd className="mt-1 text-sm sm:mt-0">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.status === 'approved' ? 'bg-green-100 text-green-800' :
                    item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      item.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                    {item.status}
                  </span>
                </dd>
                <dd>
                  <button
                    className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded"
                    onClick={() => setSelected(item)}
                  >
                    View
                  </button>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Modern Responsive Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          aria-modal="true"
          tabIndex={-1}
          onClick={() => setSelected(null)} // click outside to close
        >
          {/* Stop click propagation inside modal */}
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-2 p-6 border flex flex-col max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 text-xl font-bold text-gray-400 hover:text-gray-700"
              onClick={() => setSelected(null)}
              aria-label="Close details modal"
            >
              ×
            </button>
            <h3 className="text-xl font-semibold mb-4 text-center border-b pb-2">Franchise Details</h3>
            <dl className="space-y-3 text-sm sm:text-base">
              <div>
                <dt className="font-semibold">Name:</dt>
                <dd>{selected.name}</dd>
              </div>
              <div>
                <dt className="font-semibold">Owner:</dt>
                <dd>{selected.owner_name}</dd>
              </div>
              <div>
                <dt className="font-semibold">Email:</dt>
                <dd>{selected.email}</dd>
              </div>
              <div>
                <dt className="font-semibold">Phone:</dt>
                <dd>{selected.phone}</dd>
              </div>
              <div>
                <dt className="font-semibold">Address:</dt>
                <dd>{selected.address}</dd>
              </div>
              <div>
                <dt className="font-semibold">Region:</dt>
                <dd>{selected.region}</dd>
              </div>
              <div>
                <dt className="font-semibold">Status:</dt>
                <dd>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${selected.status === 'approved' ? 'bg-green-100 text-green-800' :
                    selected.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      selected.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                    {selected.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Expiry Date:</dt>
                <dd>{selected.expiry_date}</dd>
              </div>
              <div>
                <dt className="font-semibold">Investment Amount:</dt>
                <dd>{selected.investment_amount}</dd>
              </div>
              <div>
                <dt className="font-semibold">Notes:</dt>
                <dd>{selected.notes}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
export default FranchiseManagement;