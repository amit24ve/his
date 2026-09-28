import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, getAuthHeaders, authenticatedGet } from "../../utils/authAPI";

// Helper function to handle 401 responses
const handleUnauthorized = () => {
  console.error('Authentication failed - clearing localStorage and redirecting to login');
  localStorage.clear();
  window.location.href = '/login';
};

const statusColors = {
  NEW: "bg-gray-200 text-gray-700",
  COMPLETED: "bg-green-500 text-white",
  PENDING: "bg-yellow-200 text-yellow-800",
  "IN PROGRESS": "bg-blue-200 text-blue-800",
  SPAM: "bg-orange-400 text-white",
  QUOTED: "bg-blue-700 text-white",
  followup: "bg-purple-500 text-white",
};

// Helper to resolve MongoDB ObjectId for navigation (ALWAYS use navigation_id if present)
function getLeadNavId(f) {
  if (typeof f.navigation_id === "string" && f.navigation_id) return f.navigation_id;
  if (f.navigation_id && typeof f.navigation_id === "object" && f.navigation_id.$oid) return f.navigation_id.$oid;
  if (typeof f._id === "string" && f._id) return f._id;
  if (f._id && typeof f._id === "object" && f._id.$oid) return f._id.$oid;
  // fallback to lead_id if no _id (should be rare)
  if (typeof f.lead_id === "string" && f.lead_id) return f.lead_id;
  if (f.lead_id && typeof f.lead_id === "object" && f.lead_id.$oid) return f.lead_id.$oid;
  return "";
}

export default function FollowUpSection() {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [successMsg, setSuccessMsg] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  // Check authentication on mount
  useEffect(() => {
    const user = getCurrentUser();
    console.log('=== FollowUpSection Authentication Debug ===');
    console.log('Current user from getCurrentUser():', user);
    console.log('localStorage keys:', Object.keys(localStorage));
    console.log('access_token:', localStorage.getItem('access_token') ? 'present' : 'missing');
    console.log('user data:', localStorage.getItem('user') ? 'present' : 'missing');

    if (!user) {
      console.error('No authenticated user found');
      handleUnauthorized();
      return;
    }

    setCurrentUser(user);
  }, []);

  // Fetch followups data
  useEffect(() => {
    async function fetchFollowUps() {
      // Only fetch if user is authenticated
      if (!currentUser) return;

      try {
        console.log('Fetching follow-ups and leads with user:', currentUser);

        // Fetch both followups and leads data in parallel
        const [followupsData, leadsData] = await Promise.all([
          authenticatedGet("https://cubehis.avopay.pro:5000/api/followups/all"),
          authenticatedGet("https://cubehis.avopay.pro:5000/api/lead/leads?page=1&limit=1000")
        ]);

        console.log('Received followups data:', followupsData);
        console.log('Received leads data:', leadsData);

        // Process followups data (it's already an array)
        const followupsArray = Array.isArray(followupsData) ? followupsData : [];

        // Process leads data 
        const leadsArray = Array.isArray(leadsData.data) ? leadsData.data : [];

        // Create a map of lead_id to lead data for quick lookup
        const leadsMap = new Map();
        leadsArray.forEach(lead => {
          const leadId = lead._id || lead.id;
          if (leadId) {
            leadsMap.set(leadId, lead);
          }
        });

        // Enrich followups with lead information
        const enrichedFollowUps = followupsArray.map(followup => {
          const leadData = leadsMap.get(followup.lead_id);
          return {
            ...followup,
            // Add lead information to followup
            lead_name: leadData?.name || leadData?.full_name || '-',
            lead_email: leadData?.email || '-',
            lead_phone: leadData?.phone || '-',
            lead_location: leadData?.location || '-',
            lead_status: leadData?.status || '-',
            assigned_to_display: leadData?.assigned_to_display || leadData?.assigned_to || '-',
            // Keep the original lead_id for navigation using the lead's _id
            navigation_id: followup.lead_id,
            // Use scheduled_date as follow_up_date for compatibility
            follow_up_date: followup.scheduled_date?.split('T')[0] || '-',
            follow_up_notes: followup.remarks ? [{ content: followup.remarks }] : []
          };
        });

        console.log('Enriched followups:', enrichedFollowUps);
        setFollowUps(enrichedFollowUps);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching followups:", err);

        // Handle authentication errors specifically
        if (err.message.includes('Authentication required')) {
          handleUnauthorized();
          return;
        }

        setFollowUps([]);
        setLoading(false);
      }
    }

    fetchFollowUps();
  }, [currentUser]); // Depend on currentUser instead of empty array

  // Calculate data for filtering and display
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const filteredFollowUps = Array.isArray(followUps) ? followUps.filter(f =>
    f.lead_id?.toLowerCase?.().includes(searchQuery.toLowerCase()) ||
    f.lead_name?.toLowerCase?.().includes(searchQuery.toLowerCase()) ||
    f.assigned_to_display?.toLowerCase?.().includes(searchQuery.toLowerCase()) ||
    f.remarks?.toLowerCase?.().includes(searchQuery.toLowerCase())
  ) : [];

  let finalFollowUps = filteredFollowUps;
  if (filterStatus === "TODAY") {
    finalFollowUps = finalFollowUps.filter(f => f.follow_up_date === todayStr);
  } else if (filterStatus === "UPCOMING") {
    finalFollowUps = finalFollowUps.filter(f => new Date(f.follow_up_date) > now);
  } else if (filterStatus === "OVERDUE") {
    finalFollowUps = finalFollowUps.filter(f => new Date(f.follow_up_date) < now);
  } else if (filterStatus === "COMPLETED") {
    finalFollowUps = finalFollowUps.filter(f => f.status === "completed");
  }

  const todayDue = Array.isArray(followUps) ? followUps.filter(f => f.follow_up_date === todayStr) : [];

  // Show success message for today's followups
  useEffect(() => {
    if (todayDue.length > 0) {
      setSuccessMsg(`You have ${todayDue.length} follow-up${todayDue.length > 1 ? "s" : ""} due today!`);
      setTimeout(() => setSuccessMsg(""), 4000);
    }
  }, [followUps]);

  // Get the followup notes as a string
  const getFollowupNotes = (lead) => {
    if (!lead.follow_up_notes || !Array.isArray(lead.follow_up_notes)) return "-";
    return lead.follow_up_notes.map(note => note.content).join(", ");
  };

  // Early return if not authenticated - MOVED AFTER ALL HOOKS
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 px-2 sm:px-4 md:px-6 py-4 sm:py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center">
          <div className="text-red-500 text-2xl mr-4">⚠️</div>
          <div>
            <h3 className="font-medium text-red-800">Authentication Error</h3>
            <p className="text-red-700">Please login to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      {/* <button className="mb-6 px-5 py-2 rounded-2xl bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition" onClick={() => navigate(-1)}>← Back to Dashboard</button> */}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Follow-Up Schedule</h1>
        <p className="text-gray-600">Manage and track all scheduled follow-ups with leads</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
        <input
          type="text"
          placeholder="Search follow-ups..."
          className="w-full md:w-1/3 border px-4 py-2 rounded shadow-sm"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          {["ALL", "TODAY", "UPCOMING", "OVERDUE", "COMPLETED"].map(status => (
            <button
              key={status}
              className={`px-3 py-1 rounded border ${filterStatus === status ? "bg-indigo-600 text-white" : "bg-white text-gray-700"}`}
              onClick={() => setFilterStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>
      {successMsg && (
        <div className="mb-4 px-3 py-2 bg-green-100 text-green-700 rounded">{successMsg}</div>
      )}

      {/* Table for desktop */}
      <div className="bg-white rounded-xl shadow border overflow-x-auto hidden md:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-700 font-semibold text-xs uppercase">
              <th className="py-3 px-2 text-left">Lead ID</th>
              <th className="py-3 px-2 text-left">Lead Name</th>
              <th className="py-3 px-2 text-left">Status</th>
              <th className="py-3 px-2 text-left">Type</th>
              <th className="py-3 px-2 text-left">Updated User</th>
              <th className="py-3 px-2 text-left">Scheduled Date</th>
              <th className="py-3 px-2 text-left">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10">Loading...</td></tr>
            ) : finalFollowUps.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">No follow-ups found.</td></tr>
            ) : finalFollowUps.map(f => {
              const leadNavId = getLeadNavId(f);
              return (
                <tr key={f._id || f.id || leadNavId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="text-indigo-600 font-semibold underline hover:text-indigo-800"
                      onClick={() =>
                        leadNavId &&
                        navigate(
                          `/leads/${leadNavId}`,
                          { state: { lead: f } }
                        )
                      }
                      aria-label={`View details for lead ${leadNavId}`}
                    >
                      {f.lead_id || "-"}
                    </button>
                  </td>

                  <td className="px-2 py-2">{f.customer_name || "-"}</td>
                  <td className="px-2 py-2">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase ${f.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                        f.status === 'completed' ? 'bg-green-500 text-white' :
                          'bg-gray-200 text-gray-700'
                      }`}>
                      {f.status || 'pending'}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <span className="inline-block px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 capitalize">
                      {f.type || 'call'}
                    </span>
                  </td>
                  <td className="px-2 py-2">{f.assigned_to || "-"}</td>
                  <td className="px-2 py-2">
                    <span className={`text-gray-700 ${new Date(f.follow_up_date) < now ? "text-red-600 font-bold" : ""}`}>
                      {f.follow_up_date || "-"}
                    </span>
                  </td>
                  <td className="px-2 py-2 max-w-xs truncate">
                    {f.remarks || getFollowupNotes(f)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Card layout for mobile */}
      <div className="md:hidden flex flex-col gap-4">
        {loading ? (
          <div className="text-center py-10">Loading...</div>
        ) : finalFollowUps.length === 0 ? (
          <div className="text-center py-10 text-gray-400">No follow-ups found.</div>
        ) : finalFollowUps.map(f => {
          const leadNavId = getLeadNavId(f);
          return (
            <div
              key={f._id || f.id || leadNavId}
              className="bg-white rounded-xl shadow border p-4 flex flex-col gap-2"
            >
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  className="text-indigo-600 font-semibold text-lg underline hover:text-indigo-800"
                  onClick={() =>
                    leadNavId &&
                    navigate(
                      `/leads/${leadNavId}`,
                      { state: { lead: f } }
                    )
                  }
                  aria-label={`View details for lead ${leadNavId}`}
                >
                  {f.lead_id || "-"}
                </button>
                <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase ${f.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                    f.status === 'completed' ? 'bg-green-500 text-white' :
                      'bg-gray-200 text-gray-700'
                  }`}>
                  {f.status || 'pending'}
                </span>
              </div>
              <div>
                <span className="font-semibold text-gray-800">Lead Name: </span>
                <span className="text-gray-700">{f.lead_name || "-"}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-800">Type: </span>
                <span className="inline-block px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 capitalize">
                  {f.type || 'call'}
                </span>
              </div>
              <div>
                <span className="font-semibold text-gray-800">Assigned To: </span>
                <span className="text-gray-700">{f.assigned_to_display || "-"}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-800">Scheduled Date: </span>
                <span className={`text-gray-700 ${new Date(f.follow_up_date) < now ? "text-red-600 font-bold" : ""}`}>
                  {f.follow_up_date || "-"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-gray-800">Remarks: </span>
                <span className="text-gray-700">{f.remarks || getFollowupNotes(f)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}