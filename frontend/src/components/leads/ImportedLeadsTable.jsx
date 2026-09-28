import React, { useState, useEffect } from "react";

// Helper functions for resolving fields
const resolveName = (lead) =>
  lead.name || (lead.raw_data && (lead.raw_data.Name || lead.raw_data.name)) || "-";
const resolveEmail = (lead) =>
  lead.email || (lead.raw_data && (lead.raw_data.Email || lead.raw_data.email)) || "-";
const resolvePhone = (lead) =>
  lead.phone || (lead.raw_data && (lead.raw_data.Phone || lead.raw_data["Secondary phone number"])) || "-";
const resolveLocation = (lead) =>
  lead.location || (lead.raw_data && (lead.raw_data.Location || lead.raw_data.location)) || "-";
const resolveStatus = (lead) =>
  lead.status || (lead.raw_data && (lead.raw_data.Stage || lead.raw_data.stage)) || "new";

function ImportedLeadsTable({ refreshKey }) {
  const [importedLeads, setImportedLeads] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [total, setTotal] = useState(0);
  const [showTodayOnly, setShowTodayOnly] = useState(true);

  const lastPage = Math.ceil(total / limit) || 1;
  const handlePrevPage = () => setPage((p) => (p > 1 ? p - 1 : 1));
  const handleNextPage = () => setPage((p) => (p < lastPage ? p + 1 : lastPage));

  // Fetch leads
  useEffect(() => {
    const fetchImportedLeads = async () => {
      setTableLoading(true);
      try {
        let url = `https://cubehis.avopay.pro:5000/api/lead/leads?page=${page}&limit=${limit}`;

        // Only add date filter if showing today only
        if (showTodayOnly) {
          // Get today's date in local timezone
          const today = new Date();

          // Create start of day in local timezone
          const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);

          // Create end of day in local timezone  
          const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

          // Format dates for API (ISO string format)
          const startDate = startOfDay.toISOString();
          const endDate = endOfDay.toISOString();

          url += `&start_date=${startDate}&end_date=${endDate}`;

          console.log('Filtering leads for today:', {
            startDate,
            endDate,
            localToday: today.toLocaleDateString()
          });
        } else {
          console.log('Fetching all recent leads');
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch leads");
        const data = await res.json();

        console.log('API Response:', data);

        // Force sort leads from lead099 to lead001
        const sortedLeads = (data.data || []).slice().sort((a, b) => {
          // Try to extract numeric part from id, fallback to 0 if not found
          const numA = parseInt((a.id || "").replace(/\D/g, ""), 10) || 0;
          const numB = parseInt((b.id || "").replace(/\D/g, ""), 10) || 0;
          return numB - numA;
        });
        setImportedLeads(sortedLeads);
        setTotal(data.total || 0);
      } catch (error) {
        console.error('Error fetching leads:', error);
        setImportedLeads([]);
        setTotal(0);
      }
      setTableLoading(false);
    };
    fetchImportedLeads();
    // eslint-disable-next-line
  }, [page, refreshKey, showTodayOnly]);

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-indigo-800">
          {showTodayOnly ? "Today's Imported Leads" : "Recent Leads"}
        </h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showTodayOnly}
              onChange={(e) => setShowTodayOnly(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-600">Today only</span>
          </label>
        </div>
      </div>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <table className="min-w-full text-sm border rounded-xl overflow-hidden bg-white">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left text-gray-700 font-semibold">Name</th>
              <th className="px-3 py-2 text-left text-gray-700 font-semibold">Phone</th>
              <th className="px-3 py-2 text-left text-gray-700 font-semibold">Email</th>
              <th className="px-3 py-2 text-left text-gray-700 font-semibold">Location</th>
              <th className="px-3 py-2 text-left text-gray-700 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {tableLoading ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-indigo-500">Loading...</td>
              </tr>
            ) : importedLeads.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-400">
                  {showTodayOnly
                    ? "No leads imported today. Import some leads to see them here."
                    : "No leads found. Import some leads to see them here."
                  }
                </td>
              </tr>
            ) : (
              importedLeads.map((lead, idx) => (
                <tr key={lead.id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-2">{resolveName(lead)}</td>
                  <td className="px-3 py-2">{resolvePhone(lead)}</td>
                  <td className="px-3 py-2">{resolveEmail(lead)}</td>
                  <td className="px-3 py-2">{resolveLocation(lead)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 rounded-full text-xs font-semibold ${resolveStatus(lead) === "new" ? "bg-yellow-100 text-yellow-800"
                        : resolveStatus(lead) === "converted" ? "bg-green-100 text-green-800"
                          : resolveStatus(lead) === "lost" ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                      }`}>
                      {resolveStatus(lead)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-3">
        {tableLoading ? (
          <div className="text-center text-indigo-500 py-4">Loading...</div>
        ) : importedLeads.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            {showTodayOnly
              ? "No leads imported today. Import some leads to see them here."
              : "No leads found. Import some leads to see them here."
            }
          </div>
        ) : (
          importedLeads.map((lead, idx) => (
            <div key={lead.id || idx} className="bg-white rounded-lg shadow border border-gray-200 p-4 flex flex-col gap-2">
              <div className="font-bold text-indigo-700 text-base">{resolveName(lead)}</div>
              <div className="text-xs text-gray-600">Phone: <span className="font-medium text-gray-900">{resolvePhone(lead)}</span></div>
              <div className="text-xs text-gray-600">Email: <span className="font-medium text-gray-900">{resolveEmail(lead)}</span></div>
              <div className="text-xs text-gray-600">Location: <span className="font-medium text-gray-900">{resolveLocation(lead)}</span></div>
              <div className="text-xs text-gray-600">Status:{" "}
                <span className={`inline-block px-2 rounded-full text-xs font-semibold ${resolveStatus(lead) === "new" ? "bg-yellow-100 text-yellow-800"
                    : resolveStatus(lead) === "converted" ? "bg-green-100 text-green-800"
                      : resolveStatus(lead) === "lost" ? "bg-red-100 text-red-800"
                        : "bg-blue-100 text-blue-800"
                  }`}>
                  {resolveStatus(lead)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Pagination */}
      <div className="flex justify-between items-center mt-4 px-2">
        <span className="text-xs text-gray-500">
          Showing {(importedLeads.length > 0 ? (page - 1) * limit + 1 : 0)}
          {" "}to{" "}
          {(page - 1) * limit + importedLeads.length}
          {" "}of{" "}
          {total} leads
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-gray-500 hover:bg-blue-50 hover:text-blue-700 shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handlePrevPage}
            disabled={page === 1}
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          <span className="px-2 py-1 rounded-lg bg-blue-600 text-white font-semibold shadow">{page}</span>
          <button
            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-gray-500 hover:bg-blue-50 hover:text-blue-700 shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleNextPage}
            disabled={page === lastPage || importedLeads.length === 0}
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportedLeadsTable;