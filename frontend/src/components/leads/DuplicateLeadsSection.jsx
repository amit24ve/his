import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDuplicateLeads, getAllDuplicateLeads, getLeadById } from '../../api/leadAPI';
import { getAuthHeaders } from '../../utils/authAPI';

// Helper functions for resolving lead data
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
  "duplicate";

const resolveAssigned = (lead) =>
  lead?.assigned_to ||
  (lead?.raw_data && (lead.raw_data.Owner || lead.raw_data.assigned_to)) ||
  "—";

const RefreshIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const DuplicateLeadsSection = () => {
  const [duplicateLeads, setDuplicateLeads] = useState([]);
  const [duplicateLeadsCount, setDuplicateLeadsCount] = useState(0);
  const [duplicateLeadsPage, setDuplicateLeadsPage] = useState(1);
  const [duplicateLeadsPages, setDuplicateLeadsPages] = useState(0);
  const [loadingDuplicateLeads, setLoadingDuplicateLeads] = useState(false);
  const [allDuplicateLeads, setAllDuplicateLeads] = useState([]);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  
  // Filter states
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [assigned, setAssigned] = useState("");
  const [location, setLocation] = useState("");
  const [locations, setLocations] = useState([]);
  
  const leadsPerPage = 10;
  const navigate = useNavigate();

  // Debounce for search and filters
  useEffect(() => {
    const handler = setTimeout(() => {
      setDuplicateLeadsPage(1); // Reset to first page when filters change
      if (allDuplicateLeads.length > 0) {
        applyFilters();
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [search, status, assigned, location, allDuplicateLeads]);

  // Filter function to apply all filters to the data
  const applyFilters = useCallback(() => {
    if (allDuplicateLeads.length === 0) return;
    
    let filteredLeads = [...allDuplicateLeads];

    // Client-side filtering for search (name, email, phone)
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      filteredLeads = filteredLeads.filter(lead => {
        const name = resolveName(lead).toLowerCase();
        const email = resolveEmail(lead).toLowerCase();
        const phone = resolvePhone(lead).toLowerCase();
        
        return name.includes(searchTerm) || 
               email.includes(searchTerm) || 
               phone.includes(searchTerm);
      });
    }

    // Filter by status
    if (status) {
      filteredLeads = filteredLeads.filter(lead => {
        const leadStatus = resolveStatus(lead).toLowerCase();
        return leadStatus === status.toLowerCase();
      });
    }

    // Filter by assigned
    if (assigned && assigned.trim()) {
      const assignedTerm = assigned.trim().toLowerCase();
      filteredLeads = filteredLeads.filter(lead => {
        const leadAssigned = resolveAssigned(lead).toLowerCase();
        return leadAssigned.includes(assignedTerm);
      });
    }

    // Filter by location
    if (location && location.trim()) {
      const selectedLocation = location.trim().toLowerCase();
      filteredLeads = filteredLeads.filter(lead => {
        const leadLocation = resolveLocation(lead).toLowerCase().trim();
        return leadLocation === selectedLocation;
      });
    }

    // Sort leads in descending order by lead_id (lead099 to lead001)
    const sortedLeads = filteredLeads.sort((a, b) => {
      const leadIdA = a.lead_id || a.lead_key || a._id || "";
      const leadIdB = b.lead_id || b.lead_key || b._id || "";
      
      return leadIdB.toString().localeCompare(leadIdA.toString(), undefined, { 
        numeric: true, 
        sensitivity: 'base' 
      });
    });

    // Apply pagination to filtered results
    const startIndex = (duplicateLeadsPage - 1) * leadsPerPage;
    const endIndex = startIndex + leadsPerPage;
    const paginatedLeads = sortedLeads.slice(startIndex, endIndex);
    
    setDuplicateLeads(paginatedLeads);
    setDuplicateLeadsCount(filteredLeads.length);
    setDuplicateLeadsPages(Math.ceil(filteredLeads.length / leadsPerPage));
  }, [allDuplicateLeads, search, status, assigned, location, duplicateLeadsPage, leadsPerPage]);

  // Clear search
  const handleClearSearch = () => setSearch("");

  // Clear all filters
  const handleClearAllFilters = () => {
    setSearch("");
    setStatus("");
    setAssigned("");
    setLocation("");
    setDuplicateLeadsPage(1);
  };

  const fetchDuplicateLeads = async (page = duplicateLeadsPage) => {
    setLoadingDuplicateLeads(true);
    try {
      // Use authenticated API call with JWT handling
      const data = await getDuplicateLeads({
        page: page, 
        limit: leadsPerPage
      });
      
      // Process the duplicate leads to include additional information
      const processedLeads = await Promise.all((data.data || []).map(async (lead) => {
        // If we have the original_lead_id but it doesn't include ObjectId, fetch it
        if (lead.original_lead_id && !lead.original_lead_object_id) {
          try {
            // Use authenticated API call to fetch lead details
            const originalLead = await getLeadById(lead.original_lead_id);
            if (originalLead) {
              lead.original_lead_object_id = originalLead._id;
            }
          } catch (err) {
            console.error(`Error fetching original lead details for ${lead.original_lead_id}:`, err);
          }
        }
        return lead;
      }));
      
      // Store all leads for filtering
      setAllDuplicateLeads(processedLeads);
      
      // Extract unique locations
      const uniqueLocations = [...new Set(
        processedLeads
          .map(lead => {
            const loc = resolveLocation(lead);
            return loc;
          })
          .filter(loc => loc && loc !== "—" && loc.trim() !== "")
          .map(loc => loc.trim())
      )].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      
      setLocations(uniqueLocations);
      
      // Reset page and apply filters will be handled by useEffect
      setDuplicateLeadsPage(1);
    } catch (error) {
      console.error("Error fetching duplicate leads:", error);
    } finally {
      setLoadingDuplicateLeads(false);
    }
  };

  const handleDuplicatePrevious = () => {
    if (duplicateLeadsPage > 1) {
      const newPage = duplicateLeadsPage - 1;
      setDuplicateLeadsPage(newPage);
    }
  };

  const handleDuplicateNext = () => {
    if (duplicateLeadsPage < duplicateLeadsPages) {
      const newPage = duplicateLeadsPage + 1;
      setDuplicateLeadsPage(newPage);
    }
  };

  // Apply filters when page changes or data loads
  useEffect(() => {
    if (allDuplicateLeads.length > 0) {
      applyFilters();
    }
  }, [applyFilters]);

  // Use the all endpoint to initially load all duplicate leads if there aren't too many
  const fetchAllDuplicateLeads = async (isAutoRefresh = false) => {
    // For auto-refresh, use different loading state to avoid disrupting user experience
    if (isAutoRefresh) {
      setIsAutoRefreshing(true);
    } else {
      setLoadingDuplicateLeads(true);
    }
    
    try {
      // Use authenticated API call with JWT handling
      const data = await getAllDuplicateLeads();
      
      // Process the data to include ObjectIds
      const processedLeads = await Promise.all((data.data || []).map(async (lead) => {
        if (lead.original_lead_id && !lead.original_lead_object_id) {
          try {
            // Use authenticated API call to fetch lead details
            const originalLead = await getLeadById(lead.original_lead_id);
            if (originalLead) {
              lead.original_lead_object_id = originalLead._id;
            }
          } catch (err) {
            console.error(`Error fetching original lead details for ${lead.original_lead_id}:`, err);
          }
        }
        return lead;
      }));
      
      if (processedLeads.length <= 1000) { // Increased limit for better filtering
        // Store all leads for filtering
        setAllDuplicateLeads(processedLeads);
        
        // Extract unique locations
        const uniqueLocations = [...new Set(
          processedLeads
            .map(lead => {
              const loc = resolveLocation(lead);
              return loc;
            })
            .filter(loc => loc && loc !== "—" && loc.trim() !== "")
            .map(loc => loc.trim())
        )].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        
        setLocations(uniqueLocations);
        
        // Reset page and apply filters will be handled by useEffect
        if (!isAutoRefresh) {
          setDuplicateLeadsPage(1);
        }
      } else {
        // Fall back to paginated if there are too many results
        fetchDuplicateLeads(1);
      }
    } catch (error) {
      console.error("Error fetching all duplicate leads:", error);
      if (!isAutoRefresh) {
        fetchDuplicateLeads(1); // Fall back to paginated
      }
    } finally {
      if (isAutoRefresh) {
        setIsAutoRefreshing(false);
      } else {
        setLoadingDuplicateLeads(false);
      }
    }
  };
  
  useEffect(() => {
    fetchAllDuplicateLeads(false); // Initial load
    
    // Set up automatic refresh every 30 seconds
    const interval = setInterval(() => {
      fetchAllDuplicateLeads(true); // Auto-refresh
    }, 30000); // 30 seconds
    
    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      {/* Auto-refresh indicator */}
      {isAutoRefreshing && (
        <div className="mb-2 flex items-center justify-center">
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600"></div>
            <span>Updating data...</span>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="search">
              Search by
            </label>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                id="search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or phone"
                className="pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition-all"
                autoComplete="off"
                aria-label="Search leads by name, email, or phone"
              />
              {search && (
                <button
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="w-full lg:w-48">
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border border-gray-300 px-3 py-2 rounded-lg text-sm w-full bg-white focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition-all"
              aria-label="Filter leads by status"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="connected">Connected</option>
              <option value="detail-shared">Detail Shared</option>
              <option value="followup">Follow-Up</option>
              <option value="interested">Interested</option>
              <option value="not-interested">Not Interested</option>
              <option value="call-back">Call-Back</option>
              <option value="lead-closed">Lead Closed</option>
              <option value="not-picked">Not Picked</option>
              <option value="not-connected-switch-off">Not Connected/Switch-Off</option>
              <option value="duplicate">Duplicate</option>
            </select>
          </div>
          <div className="w-full lg:w-48">
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="location">
              Location ({locations.length})
            </label>
            <select
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="border border-gray-300 px-3 py-2 rounded-lg text-sm w-full bg-white focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition-all"
              aria-label="Filter leads by location"
            >
              <option value="">All Locations</option>
              {locations.length === 0 ? (
                <option disabled>Loading locations...</option>
              ) : (
                locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="w-full lg:w-48">
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="assigned">
              Assigned
            </label>
            <input
              id="assigned"
              type="text"
              value={assigned}
              onChange={(e) => setAssigned(e.target.value)}
              placeholder="Assigned to"
              className="border border-gray-300 px-3 py-2 rounded-lg text-sm w-full focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition-all"
              autoComplete="off"
              aria-label="Filter leads by assigned person"
            />
          </div>
          <div className="w-full lg:w-auto">
            <button
              onClick={handleClearAllFilters}
              className="w-full lg:w-auto px-6 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors focus:ring-2 focus:ring-red-300"
              aria-label="Clear all filters"
              title="Clear all filters"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Duplicate Leads Table */}
      <LeadsTable
        recentLeads={duplicateLeads}
        loading={loadingDuplicateLeads}
        currentPage={duplicateLeadsPage}
        totalPages={duplicateLeadsPages}
        handleNext={handleDuplicateNext}
        handlePrevious={handleDuplicatePrevious}
        totalLeads={duplicateLeadsCount}
        navigate={navigate}
        title="Duplicate Leads"
        isDuplicateTable={true}
      />
    </div>
  );
};

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
  title = "Duplicate Leads",
  isDuplicateTable = true
}) => {
  // Track duplicate lead IDs to highlight them in red
  const [duplicateIdCounts, setDuplicateIdCounts] = React.useState({});
  
  // Count duplicate lead IDs when leads change
  React.useEffect(() => {
    const counts = {};
    
    // First, count occurrences of each lead ID
    recentLeads.forEach(lead => {
      // Check all possible ID fields
      const leadId = lead?.lead_id;
      const duplicateLeadId = lead?.duplicate_lead_id;
      
      // Count the lead_id
      if (leadId) {
        counts[leadId] = (counts[leadId] || 0) + 1;
      }
      
      // Also count the duplicate_lead_id if it's different
      if (duplicateLeadId && duplicateLeadId !== leadId) {
        counts[duplicateLeadId] = (counts[duplicateLeadId] || 0) + 1;
      }
    });
    
    // Mark all leads with the same ID as the original_lead_id as duplicates
    recentLeads.forEach(lead => {
      if (lead?.original_lead_id) {
        counts[lead.original_lead_id] = Math.max(2, (counts[lead.original_lead_id] || 0));
      }
    });
    
    setDuplicateIdCounts(counts);
  }, [recentLeads]);
  
  // Get display ID for UI
  const resolveLeadId = (lead) => {
    if (lead?.lead_id) return lead.lead_id;
    if (lead?.lead_key) return lead.lead_key;
    if (typeof lead?._id === "string") return lead._id;
    if (lead?._id && typeof lead._id === "object" && lead._id.$oid) return lead._id.$oid;
    return "—";
  };
  
  // Get navigation ID (ObjectId when possible)
  const getNavigationId = (lead) => {
    // For regular leads
    if (typeof lead?._id === "string") return lead._id;
    
    // For duplicate leads with original lead info
    if (lead?.original_lead_object_id) return lead.original_lead_object_id;
    if (lead?.original_lead_id) return lead.original_lead_id;
    
    return null;
  };
  
  // Function to handle navigation with the correct API path
  const navigateToLead = (leadId) => {
    if (!leadId) return;
    navigate(`/leads/${leadId}`);
  };
  
  // Determine if a lead ID should be highlighted as a duplicate
  const isDuplicateId = (lead) => {
    const id = resolveLeadId(lead);
    
    // If we have a direct count of duplicates
    if (duplicateIdCounts[id] > 1) {
      return true;
    }
    
    // If this is explicitly marked as a duplicate
    if (lead.is_duplicate === true || lead.duplicate_lead_id || lead.original_lead_id) {
      return true;
    }
    
    // If the lead has the same ID as an original_lead_id
    for (const otherLead of recentLeads) {
      if (otherLead.original_lead_id === id) {
        return true;
      }
    }
    
    return false;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <span className="text-sm text-gray-500">{totalLeads} duplicate leads</span>
        </div>

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

      {/* Loading Spinner */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading duplicate leads...</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Lead_id", "Name", "Email", "Phone", "Location", "Source", "Status", "Date"].map((head, idx) => (
                    <th key={idx} className="px-3 py-2 text-left text-gray-700 font-semibold">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentLeads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-400">No duplicate leads found.</td>
                  </tr>
                ) : (
                  recentLeads.map((lead, idx) => (
                    <tr key={lead.lead_id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2">
                        <button
                          className={`font-medium underline ${
                            resolveLeadId(lead) === "—" 
                              ? "opacity-50 cursor-not-allowed" 
                              : isDuplicateId(lead)
                                ? "text-red-600 hover:text-red-800" 
                                : "text-indigo-600 hover:text-indigo-800"
                          }`}
                          onClick={() => {
                            const id = resolveLeadId(lead);
                            // For duplicate table, prioritize navigating to the original lead
                            const navId = lead.original_lead_object_id || lead.original_lead_id || lead._id || lead.duplicate_lead_object_id || lead.duplicate_lead_id;
                            if (id !== "—" && navId) navigateToLead(navId);
                          }}
                          disabled={resolveLeadId(lead) === "—"}
                          aria-label={`View details for lead ${resolveLeadId(lead)}`}
                        >
                          {resolveLeadId(lead)}
                        </button>
                      </td>
                      
                      {/* <td className="px-3 py-2">
                        <button
                          className={`text-blue-600 hover:text-blue-800 font-medium underline ${!lead.original_lead_id ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                          onClick={() => {
                            const navigateId = getNavigationId(lead);
                            if (navigateId) navigateToLead(navigateId);
                          }}
                          disabled={!lead.original_lead_id}
                        >
                          {lead.original_lead_id || "—"}
                        </button>
                      </td> */}
                      
                      <td className="px-3 py-2">{resolveName(lead)}</td>
                      <td className="px-3 py-2">{resolveEmail(lead)}</td>
                      <td className="px-3 py-2">{resolvePhone(lead)}</td>
                      <td className="px-3 py-2">{resolveLocation(lead)}</td>
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
                          {resolveStatus(lead)}
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
                    className={`font-medium underline ${
                      resolveLeadId(lead) === "—" 
                        ? "opacity-50 cursor-not-allowed" 
                        : isDuplicateId(lead)
                          ? "text-red-600 hover:text-red-800" 
                          : "text-indigo-600 hover:text-indigo-800"
                    }`}
                    onClick={() => {
                      const id = resolveLeadId(lead);
                      // For duplicate table, prioritize navigating to the original lead
                      const navId = lead.original_lead_object_id || lead.original_lead_id || lead._id || lead.duplicate_lead_object_id || lead.duplicate_lead_id;
                      if (id !== "—" && navId) navigateToLead(navId);
                    }}
                    disabled={resolveLeadId(lead) === "—"}
                    aria-label={`View details for lead ${resolveLeadId(lead)}`}
                  >
                    {resolveLeadId(lead)}
                  </button>
                </div>
                
                {lead.original_lead_id && (
                  <div className="text-sm text-gray-600 mt-1 mb-2">
                    <span className="font-semibold">Original Lead: </span>
                    <button
                      className="text-blue-600 hover:text-blue-800 underline"
                      onClick={() => {
                        const navigateId = getNavigationId(lead);
                        navigateToLead(navigateId);
                      }}
                    >
                      {lead.original_lead_id}
                    </button>
                  </div>
                )}
                
                <div className="text-sm text-gray-600">
                  <div>Name: {resolveName(lead)}</div>
                  <div>Email: {resolveEmail(lead)}</div>
                  <div>Phone: {resolvePhone(lead)}</div>
                  <div>Location: {resolveLocation(lead)}</div>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold">
                      {lead.source || "Unknown"}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        resolveStatus(lead) === "converted"
                          ? "bg-green-100 text-green-800"
                          : resolveStatus(lead) === "lost"
                            ? "bg-red-100 text-red-800" 
                            : resolveStatus(lead) === "duplicate"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {resolveStatus(lead)}
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

export { DuplicateLeadsSection };
