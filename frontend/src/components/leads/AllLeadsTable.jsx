import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getLeads } from "../../api/leadAPI";

// Helper functions
const resolveLeadId = (lead) => {
  if (lead?.lead_id) return lead.lead_id;
  if (lead?.lead_key) return lead.lead_key;
  if (typeof lead?._id === "string") return lead._id;
  if (lead?._id && typeof lead._id === "object" && lead._id.$oid) return lead._id.$oid;
  return "—";
};
const resolveName = (lead) =>
  lead?.name ||
  lead?.full_name ||
  (lead?.raw_data && (lead.raw_data.Name || lead.raw_data.name)) ||
  "—";
const resolvePhone = (lead) =>
  lead?.phone ||
  (lead?.raw_data && (lead.raw_data.Phone || lead.raw_data.phone)) ||
  "—";
const resolveAlternatePhone = (lead) =>
  lead?.alternate_phone ||
  (lead?.raw_data && (lead.raw_data["Secondary phone number"] || lead.raw_data["Alternate Phone"] || lead.raw_data.alternate_phone)) ||
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
  (lead?.raw_data && (lead.raw_data.Stage || lead.raw_data.stage)) ||
  "—";
const resolveAssigned = (lead) =>
  lead?.assigned_to ||
  (lead?.raw_data && (lead.raw_data.Owner || lead.raw_data.assigned_to)) ||
  "—";

// Date formatting helper
const formatDate = (dateString) => {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return "—";
  }
};

// Status badge color mapping
const statusColors = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  qualified: "bg-green-100 text-green-700",
  converted: "bg-purple-100 text-purple-700",
  lost: "bg-red-100 text-red-700",
};

function AllLeadsTable() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [sortedLeads, setSortedLeads] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [assigned, setAssigned] = useState("");
  const [location, setLocation] = useState("");
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState(null);

  const lastPage = Math.ceil(total / limit) || 1;
  const handlePrevPage = () => setPage((p) => (p > 1 ? p - 1 : 1));
  const handleNextPage = () => setPage((p) => (p < lastPage ? p + 1 : lastPage));

  // Debounce for search
  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1); // Reset to first page when filters change
    }, 500); // Increased debounce time to 500ms for better UX
    return () => clearTimeout(handler);
  }, [search, status, assigned, location]);

  // Fetch unique locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        // Fetch more leads to get all possible locations with authentication
        const data = await getLeads({
          page: 1,
          limit: 5000,
          sort_by: 'created_at',
          sort_order: 'desc'
        });
        
        const allLeads = data.data || [];
        console.log("Total leads for location extraction:", allLeads.length); // Debug log
          
        const uniqueLocations = [...new Set(
          allLeads
            .map(lead => {
              const loc = resolveLocation(lead);
              console.log("Raw location from lead:", loc); // Debug log
              return loc;
            })
            .filter(loc => loc && loc !== "—" && loc.trim() !== "")
            .map(loc => loc.trim()) // Trim whitespace but preserve original case
        )].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())); // Case-insensitive sort
        
        console.log("Unique locations found:", uniqueLocations); // Debug log
        setLocations(uniqueLocations);
      } catch (err) {
        console.error("Error fetching locations:", err);
        setLocations([]); // Set empty array on error
      }
    };
    fetchLocations();
  }, []);

  // Fetch leads
  useEffect(() => {
    const fetchLeads = async () => {
      setTableLoading(true);
      setError(null);
      try {
        // Use the new leadAPI for fetching leads with authentication
        const data = await getLeads({
          page: 1,
          limit: 5000, // Fetch more data to handle client-side filtering
          sort_by: 'created_at',
          sort_order: 'desc',
          search: search && search.trim() ? search.trim() : undefined,
          status: status || undefined,
          assigned_to: assigned && assigned.trim() ? assigned.trim() : undefined
        });
        
        let filteredLeads = data.data || [];
        // Client-side filtering for search (name, email, phone, alternate phone)
        if (search && search.trim()) {
          const searchTerm = search.trim().toLowerCase();
          filteredLeads = filteredLeads.filter(lead => {
            const name = resolveName(lead).toLowerCase();
            const email = resolveEmail(lead).toLowerCase();
            const phone = resolvePhone(lead).toLowerCase();
            const alternatePhone = resolveAlternatePhone(lead).toLowerCase();
            return name.includes(searchTerm) || 
                   email.includes(searchTerm) || 
                   phone.includes(searchTerm) ||
                   alternatePhone.includes(searchTerm);
          });
        }
        // Client-side filtering for location
        if (location && location.trim()) {
          const selectedLocation = location.trim().toLowerCase();
          filteredLeads = filteredLeads.filter(lead => {
            const leadLocation = resolveLocation(lead);
            const leadLocationLower = leadLocation.toLowerCase().trim();
            return leadLocationLower === selectedLocation;
          });
        }
        // Sort all filtered leads in descending order (lead099 to lead001)
        const sorted = [...filteredLeads].sort((a, b) => {
          // Try to use lead_id, lead_key, id, or _id
          const getId = (lead) => lead.lead_id || lead.lead_key || lead.id || (typeof lead._id === 'string' ? lead._id : '');
          const numA = parseInt(getId(a)?.replace(/\D/g, ""), 10);
          const numB = parseInt(getId(b)?.replace(/\D/g, ""), 10);
          return numB - numA;
        });
        // Apply pagination to sorted results
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedLeads = sorted.slice(startIndex, endIndex);
        setLeads(paginatedLeads);
        setSortedLeads(paginatedLeads);
        setTotal(sorted.length); // Use sorted count for total
      } catch (err) {
        setLeads([]);
        setSortedLeads([]);
        setTotal(0);
        setError("Unable to load leads. Please try again.");
      }
      setTableLoading(false);
    };
    fetchLeads();
  }, [page, limit, search, status, assigned, location]);


  // Clear search
  const handleClearSearch = () => setSearch("");

  // Clear all filters
  const handleClearAllFilters = () => {
    setSearch("");
    setStatus("");
    setAssigned("");
    setLocation("");
    setPage(1);
  };

  // Skeleton loader for table rows
  const SkeletonRow = () => (
    <tr className="animate-pulse">
      {[...Array(9)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </td>
      ))}
    </tr>
  );

  // Skeleton loader for mobile cards
  const SkeletonCard = () => (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-4 animate-pulse">
      {[...Array(9)].map((_, i) => (
        <div key={i} className="h-4 bg-gray-200 rounded w-full mb-2"></div>
      ))}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm" role="alert">
          {error}
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
            </select>
          </div>
          <div className="w-full lg:w-48">
            <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="location">
              Location ({locations.length})
            </label>
            <select
              id="location"
              value={location}
              onChange={(e) => {
                const selectedValue = e.target.value;
                console.log("Location filter changed to:", selectedValue); // Debug log
                console.log("Available locations:", locations); // Debug log
                setLocation(selectedValue);
              }}
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

      {/* Desktop Table */}
      <div className="hidden md:block rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm border rounded-xl bg-white">
          <thead>
            <tr className="bg-gray-100">
              {["Lead ID", "Name", "Phone", "Email", "Location", "Status", "Assigned", "Created", "Actions"].map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left text-gray-700 font-semibold tracking-wide"
                  scope="col"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableLoading ? (
              [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
            ) : sortedLeads.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-gray-500">
                  No leads found.
                </td>
              </tr>
            ) : (
              sortedLeads.map((lead, idx) => (
                <tr
                  key={typeof lead._id === "string" ? lead._id : (lead._id && lead._id.$oid ? lead._id.$oid : idx)}
                  className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } hover:bg-indigo-50 transition-colors`}
                >
                  <td className="px-4 py-3">
                    <button
                      className="text-indigo-600 hover:text-indigo-800 font-medium underline"
                      onClick={() => navigate(`/leads/${typeof lead._id === "string" ? lead._id : (lead._id && lead._id.$oid ? lead._id.$oid : "")}`, { state: { lead } })}
                      aria-label={`View details for lead ${resolveLeadId(lead)}`}
                    >
                      {resolveLeadId(lead)}
                    </button>
                  </td>
                  <td className="px-4 py-3">{resolveName(lead)}</td>
                  <td className="px-4 py-3">{resolvePhone(lead)}</td>
                  <td className="px-4 py-3">{resolveEmail(lead)}</td>
                  <td className="px-4 py-3">{resolveLocation(lead)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColors[resolveStatus(lead).toLowerCase()] || "bg-gray-100 text-gray-800"
                        }`}
                    >
                      {resolveStatus(lead)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{resolveAssigned(lead)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(lead.created_at || lead.timestamp || lead.updated_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {/* Email Icon */}
                      <button
                        className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded-full hover:bg-blue-50"
                        onClick={() => window.open(`mailto:${resolveEmail(lead)}`, '_blank')}
                        disabled={resolveEmail(lead) === "—"}
                        aria-label={`Send email to ${resolveEmail(lead)}`}
                        title={`Send email to ${resolveEmail(lead)}`}
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      </button>

                      {/* Call Icon */}
                      <button
                        className="text-green-600 hover:text-green-800 transition-colors p-1 rounded-full hover:bg-green-50"
                        onClick={() => window.open(`tel:${resolvePhone(lead)}`, '_blank')}
                        disabled={resolvePhone(lead) === "—"}
                        aria-label={`Call ${resolvePhone(lead)}`}
                        title={`Call ${resolvePhone(lead)}`}
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                      </button>

                      {/* Alternate Call Icon - Only show if alternate phone exists */}
                      {resolveAlternatePhone(lead) !== "—" && (
                        <button
                          className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded-full hover:bg-blue-50"
                          onClick={() => window.open(`tel:${resolveAlternatePhone(lead)}`, '_blank')}
                          aria-label={`Call alternate number ${resolveAlternatePhone(lead)}`}
                          title={`Call alternate: ${resolveAlternatePhone(lead)}`}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                            />
                          </svg>
                          <span className="sr-only">Alt</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-4">
        {tableLoading ? (
          [...Array(5)].map((_, i) => <SkeletonCard key={i} />)
        ) : sortedLeads.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No leads found.</div>
        ) : (
          sortedLeads.map((lead, idx) => (
            <div
              key={typeof lead._id === "string" ? lead._id : (lead._id && lead._id.$oid ? lead._id.$oid : idx)}
              className="bg-white rounded-lg shadow border border-gray-200 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow"
            >
              <div>
                <span className="font-bold text-indigo-700">Lead ID: </span>
                <button
                  className="text-indigo-600 hover:text-indigo-800 underline"
                  onClick={() => navigate(`/leads/${typeof lead._id === "string" ? lead._id : (lead._id && lead._id.$oid ? lead._id.$oid : "")}`, { state: { lead } })}
                  aria-label={`View details for lead ${resolveLeadId(lead)}`}
                >
                  {resolveLeadId(lead)}
                </button>
              </div>
              <div className="text-sm text-gray-600">
                Name: <span className="font-medium text-gray-900">{resolveName(lead)}</span>
              </div>
              <div className="text-sm text-gray-600">
                Phone: <span className="font-medium text-gray-900">{resolvePhone(lead)}</span>
              </div>
              {resolveAlternatePhone(lead) !== "—" && (
                <div className="text-sm text-gray-600">
                  Alt Phone: <span className="font-medium text-gray-900">{resolveAlternatePhone(lead)}</span>
                </div>
              )}
              <div className="text-sm text-gray-600">
                Email: <span className="font-medium text-gray-900">{resolveEmail(lead)}</span>
              </div>
              <div className="text-sm text-gray-600">
                Location: <span className="font-medium text-gray-900">{resolveLocation(lead)}</span>
              </div>
              <div className="text-sm text-gray-600">
                Status:{" "}
                <span
                  className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColors[resolveStatus(lead).toLowerCase()] || "bg-gray-100 text-gray-800"
                    }`}
                >
                  {resolveStatus(lead)}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Assigned: <span className="font-medium text-gray-900">{resolveAssigned(lead)}</span>
              </div>
              <div className="text-sm text-gray-600">
                Created: <span className="font-medium text-gray-900">{formatDate(lead.created_at || lead.timestamp || lead.updated_at)}</span>
              </div>
              <div className="text-sm text-gray-600">
                Actions:
                <div className="flex gap-2 mt-1">
                  {/* Email Icon */}
                  <button
                    className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded-full hover:bg-blue-50"
                    onClick={() => window.open(`mailto:${resolveEmail(lead)}`, '_blank')}
                    disabled={resolveEmail(lead) === "—"}
                    aria-label={`Send email to ${resolveEmail(lead)}`}
                    title={`Send email to ${resolveEmail(lead)}`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </button>

                  {/* Call Icon */}
                  <button
                    className="text-green-600 hover:text-green-800 transition-colors p-1 rounded-full hover:bg-green-50"
                    onClick={() => window.open(`tel:${resolvePhone(lead)}`, '_blank')}
                    disabled={resolvePhone(lead) === "—"}
                    aria-label={`Call ${resolvePhone(lead)}`}
                    title={`Call ${resolvePhone(lead)}`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </button>

                  {/* Alternate Call Icon - Only show if alternate phone exists */}
                  {resolveAlternatePhone(lead) !== "—" && (
                    <button
                      className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded-full hover:bg-blue-50"
                      onClick={() => window.open(`tel:${resolveAlternatePhone(lead)}`, '_blank')}
                      aria-label={`Call alternate number ${resolveAlternatePhone(lead)}`}
                      title={`Call alternate: ${resolveAlternatePhone(lead)}`}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      <span className="sr-only">Alt</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center mt-6 px-2 gap-4">
        <span className="text-sm text-gray-600">
          Showing {sortedLeads.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min((page - 1) * limit + sortedLeads.length, total)} of {total} leads
          {location && ` (filtered by location: ${location})`}
          {search && ` (search: "${search}")`}
          {status && ` (status: ${status})`}
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-full border border-gray-300 bg-white px-4 py-2 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handlePrevPage}
            disabled={page === 1}
            aria-label="Previous page"
          >
            Prev
          </button>
          <span className="px-4 py-2 rounded-full bg-indigo-600 text-white font-semibold shadow-sm">
            {page}
          </span>
          <button
            className="rounded-full border border-gray-300 bg-white px-4 py-2 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleNextPage}
            disabled={page === lastPage || leads.length === 0}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default AllLeadsTable;