import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Helper functions
const resolveLeadId = (lead) => {
  if (lead?.lead_id) return lead.lead_id;
  if (lead?.lead_key) return lead.lead_key;
  if (typeof lead?._id === "string") return lead._id;
  if (lead?._id && typeof lead._id === "object" && lead._id.$oid) return lead._id.$oid;
  if (lead?.id) return lead.id;
  return "—";
};
const resolveName = (lead) =>
  lead?.name ||
  lead?.full_name ||
  (lead?.raw_data && (lead.raw_data.Name || lead.raw_data.name)) ||
  "—";
const resolvePhone = (lead) =>
  lead?.phone ||
  (lead?.raw_data && (lead.raw_data.Phone || lead.raw_data["Secondary phone number"])) ||
  "—";
const resolveEmail = (lead) =>
  lead?.email ||
  (lead?.raw_data && (lead.raw_data.Email || lead.raw_data.email)) ||
  "—";
const resolveLocation = (lead) =>
  lead?.location ||
  (lead?.raw_data && (lead.raw_data.Location || lead.raw_data.location)) ||
  "—";
const resolveStatus = (lead) =>
  lead?.status ||
  (lead?.raw_data && (lead.raw_data.Stage || lead.raw_data.stage)) ||
  "new";

// Status badge color mapping
const statusColors = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  qualified: "bg-green-100 text-green-700",
  converted: "bg-purple-100 text-purple-700",
  lost: "bg-red-100 text-red-700",
};

// Date formatting helper for leads
const formatDate = (dateString) => {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      return "Today " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Check if it's yesterday
    else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // For older dates
    else {
      return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  } catch (e) {
    return "—";
  }
};

function NewLeadsTable({ refreshKey }) {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isShowingFallback, setIsShowingFallback] = useState(false);

  // Fetch new leads (today's leads only)
  useEffect(() => {
    const fetchNewLeads = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        const url = `https://cubehis.avopay.pro:5000/api/lead/leads?limit=100&sort_by=created_at&sort_order=desc`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch leads");
        const data = await res.json();
        let allLeads = data.data || [];

        // Sort allLeads by lead ID descending (lead099 to lead001)
        allLeads.sort((a, b) => {
          const leadIdA = resolveLeadId(a);
          const leadIdB = resolveLeadId(b);
          const numericA = leadIdA.replace(/\D/g, '');
          const numericB = leadIdB.replace(/\D/g, '');
          if (numericA && numericB && numericA !== '' && numericB !== '') {
            return parseInt(numericB) - parseInt(numericA);
          }
          return leadIdB.localeCompare(leadIdA);
        });

        // Filter leads created today only
        const todayLeads = allLeads.filter(lead => {
          const leadDate = new Date(lead.created_at || lead.timestamp || lead.updated_at);
          return leadDate.toDateString() === today.toDateString();
        });

        // If no leads found for today, show recent leads as fallback
        if (todayLeads.length === 0) {
          // Show last 10 leads regardless of date, already sorted
          let recentLeads = allLeads.slice(0, 10);
          setLeads(recentLeads);
          setIsShowingFallback(true);
        } else {
          setLeads(todayLeads);
          setIsShowingFallback(false);
        }
      } catch (err) {
        console.error("Error fetching new leads:", err);
        setLeads([]);
        setError("Unable to load new leads. Please try again.");
      }
      setLoading(false);
    };

    fetchNewLeads();
  }, [refreshKey]);

  const handleLeadClick = (lead) => {
    const leadId = resolveLeadId(lead);
    if (leadId !== "—") {
      navigate(`/leads/${leadId}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-center py-8">
          <div className="text-red-500 mb-2">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No New Leads Today</h3>
          <p className="text-gray-500">No leads have been imported or created today yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      {/* Fallback Notice */}
      {isShowingFallback && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-yellow-800">
              <span className="font-medium">No leads imported today yet.</span> Showing recent leads instead.
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {isShowingFallback
            ? `Recent Leads (${leads.length})`
            : `Today's New Leads (${leads.length})`
          }
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {isShowingFallback
              ? "Recent leads (newest lead ID first: lead091→lead001)"
              : "Today's leads only (newest lead ID first: lead091→lead001)"
            }
          </span>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lead ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time Created
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leads.map((lead, index) => {
              const leadId = resolveLeadId(lead);
              const leadDate = new Date(lead.created_at || lead.timestamp || lead.updated_at);
              const isToday = leadDate.toDateString() === new Date().toDateString();

              return (
                <tr
                  key={leadId + index}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${!isShowingFallback && isToday ? 'bg-blue-50 border-l-4 border-l-green-400' : 'hover:bg-gray-100'}`}
                  onClick={() => handleLeadClick(lead)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-blue-600">
                    {!isShowingFallback && isToday && <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>}
                    {leadId}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {resolveName(lead)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {resolveEmail(lead)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {resolvePhone(lead)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[resolveStatus(lead)] || statusColors.new}`}>
                      {resolveStatus(lead)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">
                    {formatDate(lead.created_at || lead.timestamp || lead.updated_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {leads.map((lead, index) => {
          const leadId = resolveLeadId(lead);
          const leadDate = new Date(lead.created_at || lead.timestamp || lead.updated_at);
          const isToday = leadDate.toDateString() === new Date().toDateString();

          return (
            <div
              key={leadId + index}
              className={`border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow ${!isShowingFallback && isToday ? 'border-blue-300 bg-blue-50 border-l-4 border-l-green-400' : 'border-gray-200 bg-white'}`}
              onClick={() => handleLeadClick(lead)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-mono text-blue-600 flex items-center">
                  {!isShowingFallback && isToday && <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>}
                  {leadId}
                </span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[resolveStatus(lead)] || statusColors.new}`}>
                  {resolveStatus(lead)}
                </span>
              </div>
              <div className="text-sm font-medium text-gray-900 mb-1">{resolveName(lead)}</div>
              <div className="text-sm text-gray-700 mb-1">{resolveEmail(lead)}</div>
              <div className="text-sm text-gray-700 mb-1">{resolvePhone(lead)}</div>
              <div className="text-xs text-gray-500 font-medium">
                Created: {formatDate(lead.created_at || lead.timestamp || lead.updated_at)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default NewLeadsTable;
