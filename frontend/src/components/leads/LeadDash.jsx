import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getLeads, getDuplicateLeadsCount, getAllDuplicateLeads } from "../../api/leadAPI";
import { getAuthHeaders } from "../../utils/authAPI";

// === SVG ICONS ===
const ImportIcon = () => (
  <svg width="48" height="48" className="mb-4" viewBox="0 0 48 48" fill="none">
    <linearGradient id="importGradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
      <stop stopColor="#00C6FB" />
      <stop offset="1" stopColor="#005BEA" />
    </linearGradient>
    <path d="M24 6v24M24 30l-8-8M24 30l8-8M8 42h32" stroke="url(#importGradient)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AssignIcon = () => (
  <svg width="48" height="48" className="mb-4" viewBox="0 0 48 48" fill="none">
    <defs>
      <linearGradient id="assignGradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8F5CFF" />
        <stop offset="1" stopColor="#00C6FB" />
      </linearGradient>
    </defs>
    <rect x="8" y="8" width="20" height="28" rx="2" stroke="url(#assignGradient)" strokeWidth="2" />
    <circle cx="38" cy="14" r="6" stroke="url(#assignGradient)" strokeWidth="2" />
    <circle cx="38" cy="34" r="6" stroke="url(#assignGradient)" strokeWidth="2" />
    <circle cx="38" cy="24" r="6" stroke="url(#assignGradient)" strokeWidth="2" />
    <path d="M28 14H32M28 24H32M28 34H32" stroke="url(#assignGradient)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const FollowUpIcon = () => (
  <svg width="48" height="48" className="mb-4" viewBox="0 0 48 48" fill="none">
    <linearGradient id="followGradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
      <stop stopColor="#0EA5E9" />
      <stop offset="1" stopColor="#6366F1" />
    </linearGradient>
    <rect x="8" y="8" width="32" height="32" rx="8" stroke="url(#followGradient)" strokeWidth="3" />
    <path d="M24 16v8l5 5" stroke="url(#followGradient)" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const NotesIcon = () => (
  <svg width="48" height="48" className="mb-4" viewBox="0 0 48 48" fill="none">
    <linearGradient id="notesGradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
      <stop stopColor="#9333EA" />
      <stop offset="1" stopColor="#F59E42" />
    </linearGradient>
    <rect x="10" y="10" width="28" height="28" rx="4" stroke="url(#notesGradient)" strokeWidth="2" />
    <path d="M16 18h16M16 24h10" stroke="url(#notesGradient)" strokeWidth="2" strokeLinecap="round" />
    <circle cx="18" cy="30" r="2" fill="url(#notesGradient)" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

// === MAIN COMPONENT ===
const LeadsDash = ({ onImportClick }) => {
  const [allLeads, setAllLeads] = useState([]);
  const [recentLeads, setRecentLeads] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const leadsPerPage = 10;
  const navigate = useNavigate();

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  // Function to extract numeric part from lead ID for sorting
  const extractLeadNumber = (lead) => {
    const leadId = lead?.lead_id || lead?.lead_key || '';
    const match = leadId.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Function to fetch all leads and sort them
  const fetchAllLeads = async () => {
    setLoading(true);
    try {
      // Fetch all leads without pagination
      const data = await getLeads({
        page: 1,
        limit: 10000 // Large number to get all leads
      });
      
      const leads = data.data || [];
      
      // Sort leads by lead ID in descending order (lead099 to lead001)
      const sortedLeads = leads.sort((a, b) => {
        const numA = extractLeadNumber(a);
        const numB = extractLeadNumber(b);
        return numB - numA; // Descending order
      });
      
      setAllLeads(sortedLeads);
      setTotalLeads(sortedLeads.length);
      setTotalPages(Math.ceil(sortedLeads.length / leadsPerPage));
      
      // Set the first page of leads
      updateCurrentPageLeads(sortedLeads, 1);
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLoading(false);
    }
  };

  // Function to update leads for current page
  const updateCurrentPageLeads = (leads, page) => {
    const startIndex = (page - 1) * leadsPerPage;
    const endIndex = startIndex + leadsPerPage;
    setRecentLeads(leads.slice(startIndex, endIndex));
  };

  // Update displayed leads when page changes
  useEffect(() => {
    if (allLeads.length > 0) {
      updateCurrentPageLeads(allLeads, currentPage);
    }
  }, [currentPage, allLeads]);

  const fetchLeads = async (page = currentPage) => {
    // This function is kept for compatibility but now just calls fetchAllLeads
    if (allLeads.length === 0) {
      await fetchAllLeads();
    }
  };

  const handleRefresh = () => {
    fetchAllLeads(); // Refresh all leads and re-sort
    fetchDuplicateLeadsCount();
    fetchNewLeadsCount();
  };

  useEffect(() => {
    fetchAllLeads(); // Fetch all leads on component mount
  }, []);

  const [duplicateLeadsCount, setDuplicateLeadsCount] = useState(0);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  
  // Fetch duplicate leads count only
  const fetchDuplicateLeadsCount = async () => {
    try {
      console.log('Fetching duplicate leads count...');
      // Use the new API endpoint to get all duplicate leads
      const data = await getAllDuplicateLeads();
      console.log('Duplicate leads response:', data);
      
      // Extract count from the response
      const count = data?.data?.length || data?.total || data?.count || 0;
      setDuplicateLeadsCount(count);
    } catch (error) {
      console.error("Error fetching duplicate leads count:", error);
      // Fallback to the old endpoint if the new one fails
      try {
        const fallbackData = await getDuplicateLeadsCount();
        setDuplicateLeadsCount(fallbackData.total || 0);
      } catch (fallbackError) {
        console.error("Error with fallback duplicate leads count:", fallbackError);
      }
    }
  };

  // Fetch new leads count
  const fetchNewLeadsCount = async () => {
    try {
      // Use authenticated API call with JWT handling to get leads with status "new"
      const data = await getLeads({
        status: 'new',
        page: 1,
        limit: 1 // We only need the count, not the actual data
      });
      setNewLeadsCount(data.total || 0);
    } catch (error) {
      console.error("Error fetching new leads count:", error);
    }
  };

  useEffect(() => {
    fetchDuplicateLeadsCount();
    fetchNewLeadsCount();
  }, []);

  const stats = {
    totalLeads,
    newLeads: newLeadsCount,
    duplicateLeads: duplicateLeadsCount,
    managers: 2,
  };

  console.log('Current stats:', stats);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Lead Management Dashboard</h1>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              loading 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
            }`}
          >
            <RefreshIcon className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh Leads'}
          </button>
        </div>

        {/* === Stats Section === */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <StatCard title="Total Leads" value={stats.totalLeads} color="indigo" />
          <StatCard title="New Leads" value={stats.newLeads} color="blue" />
          <StatCard title="Duplicate Leads" value={stats.duplicateLeads} color="green" />
          <StatCard title="Managers" value={stats.managers} color="purple" />
        </div>

        {/* === Action Cards === */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div onClick={onImportClick} className="group bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-2 cursor-pointer border border-gray-200 flex flex-col items-center text-center">
            <ImportIcon />
            <ActionCard title="Import Leads" description="Upload and distribute new leads." color="indigo" />
          </div>

          <Link to="/hierarchy-assignment" className="group bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-2 cursor-pointer border border-gray-200 flex flex-col items-center text-center">
            <AssignIcon />
            <ActionCard title="Assign Leads" description="Manually assign leads to managers and members." color="violet" />
          </Link>

          <Link to="/follow-up" className="group bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-2 cursor-pointer border border-gray-200 flex flex-col items-center text-center">
            <FollowUpIcon />
            <ActionCard title="Follow Up" description="Track and update follow-up activities." color="sky" />
          </Link>

          <Link to="/notes" className="group bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-2 cursor-pointer border border-gray-200 flex flex-col items-center text-center">
            <NotesIcon />
            <ActionCard title="Notes" description="Add and manage notes for leads." color="orange" />
          </Link>
        </div>

        {/* === Leads Table Component === */}
        <LeadsTable
          recentLeads={recentLeads}
          loading={loading}
          currentPage={currentPage}
          totalPages={totalPages}
          handleNext={handleNext}
          handlePrevious={handlePrevious}
          totalLeads={totalLeads}
          navigate={navigate}
          onRefresh={handleRefresh}
          title="Recent Leads"
        />


      </div>
    </div>
  );
};

// === STAT CARD ===
const StatCard = ({ title, value, color }) => (
  <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition-shadow">
    <p className="text-gray-600">{title}</p>
    <p className={`text-3xl font-bold text-${color}-600`}>{value}</p>
  </div>
);

// === ACTION CARD TEXT ===
const ActionCard = ({ title, description, color }) => (
  <>
    <h2 className={`text-lg font-semibold text-gray-900 mb-1 group-hover:text-${color}-600 transition`}>
      {title}
    </h2>
    <p className="text-gray-600 text-sm">{description}</p>
  </>
);

// === TABLE + PAGINATION ===
const LeadsTable = ({ 
  recentLeads, 
  loading, 
  currentPage, 
  totalPages, 
  handleNext, 
  handlePrevious, 
  totalLeads, 
  navigate, 
  onRefresh,
  title = "Recent Leads",
  isDuplicateTable = false
}) => {
  const resolveLeadId = (lead) => {
    if (lead?.lead_id) return lead.lead_id;
    if (lead?.lead_key) return lead.lead_key;
    if (typeof lead?._id === "string") return lead._id;
    if (lead?._id && typeof lead._id === "object" && lead._id.$oid) return lead._id.$oid;
    return "—";
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <span className="text-sm text-gray-500">{totalLeads} {isDuplicateTable ? 'duplicate' : 'total'} leads</span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition-all ${
              loading 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Page {currentPage} of {totalPages}</span>
              <div className="flex gap-1">
                <button
                  onClick={handlePrevious}
                  disabled={currentPage === 1 || loading}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${currentPage === 1 || loading
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                >
                  Previous
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentPage === totalPages || loading}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${currentPage === totalPages || loading
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading Spinner */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading leads...</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {isDuplicateTable ? 
                    ["Lead ID", "Original Lead", "Name", "Email", "Phone", "Location", "Source", "Status", "Date"].map((head, idx) => (
                      <th key={idx} className="px-3 py-2 text-left text-gray-700 font-semibold">{head}</th>
                    ))
                    :
                    ["Lead ID", "Name", "Email", "Phone", "Location", "Source", "Status", "Date"].map((head, idx) => (
                      <th key={idx} className="px-3 py-2 text-left text-gray-700 font-semibold">{head}</th>
                    ))
                  }
                </tr>
              </thead>
              <tbody>
                {recentLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">No leads found.</td>
                  </tr>
                ) : (
                  recentLeads.map((lead, idx) => (
                    <tr key={lead._id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2">
                        <button
                          className={`text-indigo-600 hover:text-indigo-800 font-medium underline ${resolveLeadId(lead) === "—" ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                          onClick={() => {
                            const id = resolveLeadId(lead);
                            if (id !== "—") navigate(`/leads/${lead._id}`, { state: { lead } });
                          }}
                          disabled={resolveLeadId(lead) === "—"}
                          aria-label={`View details for lead ${resolveLeadId(lead)}`}
                        >
                          {resolveLeadId(lead)}
                        </button>
                      </td>
                      
                      {isDuplicateTable && (
                        <td className="px-3 py-2">
                          <button
                            className={`text-blue-600 hover:text-blue-800 font-medium underline ${!lead.original_lead_id ? "opacity-50 cursor-not-allowed" : ""
                              }`}
                            onClick={() => {
                              if (lead.original_lead_id) navigate(`/leads/${lead.original_lead_id}`);
                            }}
                            disabled={!lead.original_lead_id}
                          >
                            {lead.original_lead_id || "—"}
                          </button>
                        </td>
                      )}
                      
                      <td className="px-3 py-2">{lead.name || "-"}</td>
                      <td className="px-3 py-2">{lead.email || "-"}</td>
                      <td className="px-3 py-2">{lead.phone || "-"}</td>
                      <td className="px-3 py-2">{lead.location || "-"}</td>
                      <td className="px-3 py-2">
                        <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          {lead.source || "Unknown"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                            lead.status === "converted"
                              ? "bg-green-100 text-green-800"
                              : lead.status === "lost"
                                ? "bg-red-100 text-red-800"
                                : lead.status === "duplicate"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {lead.status || "new"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">
                        {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 
                         lead.duplicate_created_at ? new Date(lead.duplicate_created_at).toLocaleDateString() : "N/A"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2">
            {recentLeads.map((lead, idx) => (
              <div key={lead._id || idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="font-semibold text-gray-900 mb-1">
                  <span className="text-gray-600">Lead ID: </span>
                  <button
                    className={`text-indigo-600 hover:text-indigo-800 underline ${resolveLeadId(lead) === "—" ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    onClick={() => {
                      const id = resolveLeadId(lead);
                      if (id !== "—") navigate(`/leads/${lead._id}`, { state: { lead } });
                    }}
                    disabled={resolveLeadId(lead) === "—"}
                    aria-label={`View details for lead ${resolveLeadId(lead)}`}
                  >
                    {resolveLeadId(lead)}
                  </button>
                </div>
                
                {isDuplicateTable && lead.original_lead_id && (
                  <div className="text-sm text-gray-600 mt-1 mb-2">
                    <span className="font-semibold">Original Lead: </span>
                    <button
                      className="text-blue-600 hover:text-blue-800 underline"
                      onClick={() => navigate(`/leads/${lead.original_lead_id}`)}
                    >
                      {lead.original_lead_id}
                    </button>
                  </div>
                )}
                
                <div className="text-sm text-gray-600">
                  <div>Name: {lead.name || "-"}</div>
                  <div>Email: {lead.email || "-"}</div>
                  <div>Phone: {lead.phone || "-"}</div>
                  <div>Location: {lead.location || "-"}</div>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold">
                      {lead.source || "Unknown"}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        lead.status === "converted"
                          ? "bg-green-100 text-green-800"
                          : lead.status === "lost"
                            ? "bg-red-100 text-red-800" 
                            : lead.status === "duplicate"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {lead.status || "new"}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Added: {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 
                           lead.duplicate_created_at ? new Date(lead.duplicate_created_at).toLocaleDateString() : "N/A"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LeadsDash;