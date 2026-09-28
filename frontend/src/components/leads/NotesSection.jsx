import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authenticatedGet } from "../../utils/authAPI";

// Utility function to format datetime in IST
const formatDateTimeIST = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

// For display (show business lead_id or fallback to _id)
const resolveLeadId = (lead) => {
  if (lead?.lead_id) return lead.lead_id;
  if (lead?.lead_key) return lead.lead_key;
  if (typeof lead?._id === "string") return lead._id;
  if (lead?._id && typeof lead._id === "object" && lead._id.$oid) return lead._id.$oid;
  return "—";
};

// For navigation: prefer lead_id for better UX, fallback to _id if needed
const getNavigationLeadId = (lead) => {
  // First try lead_id (business identifier)
  if (lead?.lead_id) return lead.lead_id;
  if (lead?.lead_key) return lead.lead_key;

  // Fallback to ObjectId if no business identifier exists
  if (typeof lead?._id === "string") return lead._id;
  if (lead?._id && typeof lead._id === "object" && lead._id.$oid) return lead._id.$oid;

  return "";
};

function Modal({ open, onClose, content }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl"
          aria-label="Close"
        >
          &times;
        </button>
        <h3 className="text-lg font-semibold mb-4">Full Note</h3>
        <div className="text-gray-800 whitespace-pre-line">{content}</div>
      </div>
    </div>
  );
}

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function NotesSection() {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    async function fetchFollowups() {
      setLoading(true);
      try {
        // Use authenticatedGet for the notes API call
        const data = await authenticatedGet("https://cubehis.avopay.pro:5000/api/lead/notes");
        console.log("API Response:", data); // Debug log

        // The API returns { data: [...], page, limit, total, pages }
        const notesData = data.data || [];
        console.log("Notes data:", notesData); // Debug log

        // For each note, we need to get the full lead information
        const leadsWithNotes = [];
        for (const note of notesData) {
          try {
            if (!note.lead_id) continue;
            // Use authenticatedGet for individual lead fetching using lead_id
            const leadData = await authenticatedGet(`https://cubehis.avopay.pro:5000/api/lead/leads/${note.lead_id}`);
            console.log("Lead data:", leadData); // Debug log
            // Handle notes/follow_up_notes as arrays or strings
            let noteText = "";
            if (Array.isArray(leadData.notes) && leadData.notes.length > 0) {
              noteText = leadData.notes.map(n => n.content || "").join("\n");
            } else if (typeof leadData.notes === "string") {
              noteText = leadData.notes;
            }
            let followUpNoteText = "";
            if (Array.isArray(leadData.follow_up_notes) && leadData.follow_up_notes.length > 0) {
              followUpNoteText = leadData.follow_up_notes.map(n => n.content || "").join("\n");
            } else if (typeof leadData.follow_up_notes === "string") {
              followUpNoteText = leadData.follow_up_notes;
            }
            leadsWithNotes.push({
              ...leadData,
              _id: leadData._id, // Keep the actual lead's ObjectId
              lead_id: leadData.lead_id || note.lead_id, // Use lead's lead_id
              follow_up_notes: followUpNoteText || noteText || note.content || "",
              notes: noteText || note.content || "",
              updated_at: note.updated_at,
              created_at: note.created_at
            });
          } catch (err) {
            console.error(`Error fetching lead ${note.lead_id}:`, err);
          }
        }

        console.log("Final leads with notes:", leadsWithNotes); // Debug log
        setFollowups(leadsWithNotes);
        setError(null);
      } catch (err) {
        console.error("Error fetching notes:", err);
        if (err.message.includes('Authentication required')) {
          setError("Authentication failed. Please log in again to view notes.");
          // Clear the localStorage and navigate to login if needed
          localStorage.clear();
        } else {
          setError("Failed to load follow-up notes: " + err.message);
        }
        setFollowups([]);
      }
      setLoading(false);
    }
    fetchFollowups();
  }, []);

  // Error boundary for rendering
  if (error) {
    return (
      <div className="p-4 bg-gradient-to-tr from-indigo-50 to-white min-h-screen">
        <button className="mb-6 px-5 py-2 rounded-2xl bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition" onClick={() => navigate(-1)}>← Back to Dashboard</button>
        <div className="text-2xl font-extrabold mb-6 text-indigo-800 tracking-tight">Follow-Up Notes</div>
        <div className="text-red-600 mb-2">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-tr from-indigo-50 to-white min-h-screen">
      {/* <button className="mb-6 px-5 py-2 rounded-2xl bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition" onClick={() => navigate(-1)}>← Back to Dashboard</button> */}
      <h2 className="text-2xl font-extrabold mb-6 text-indigo-800 tracking-tight">
        Follow-Up Notes
      </h2>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        content={modalContent}
      />
      {/* Cards for small screens */}
      <div className="block md:hidden">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <div className="text-lg text-gray-600">Loading follow-up notes...</div>
            <div className="text-sm text-gray-500">Fetching leads with notes</div>
          </div>
        ) : followups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-lg mb-2">No follow-up notes found</div>
            <div className="text-sm">Notes will appear here when leads have notes added</div>
          </div>
        ) : (
          <div className="space-y-4">
            {followups.map((item, idx) => {
              const navId = getNavigationLeadId(item);
              return (
                <div
                  key={navId + (item.updated_at || idx)}
                  className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-indigo-400"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                      {item.status || "Unknown"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDateTimeIST(item.updated_at)}
                    </span>
                  </div>
                  <div className="font-bold text-indigo-900">{item.name || "No Name"}</div>
                  <div className="text-xs text-gray-500 mb-2">
                    Lead ID:{" "}
                    <button
                      className="font-medium text-indigo-700 underline hover:text-indigo-900"
                      onClick={() =>
                        navigate(`/leads/${navId}`, { state: { lead: item } })
                      }
                    >
                      {resolveLeadId(item)}
                    </button>
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold text-gray-700">
                      Assigned To:{" "}
                    </span>
                    <span>{item.assigned_to || "Unassigned"}</span>
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold text-gray-700">
                      Follow-Up Date:{" "}
                    </span>
                    <span>
                      {item.follow_up_date
                        ? new Date(item.follow_up_date).toLocaleDateString(
                          "en-IN"
                        )
                        : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Notes: </span>
                    {item.follow_up_notes && item.follow_up_notes.length > 50 ? (
                      <>
                        <span>
                          {item.follow_up_notes.slice(0, 50)}...
                          <button
                            onClick={() => {
                              setModalContent(item.follow_up_notes);
                              setModalOpen(true);
                            }}
                            className="ml-2 text-indigo-600 hover:underline text-xs font-semibold"
                          >
                            Read More
                          </button>
                        </span>
                      </>
                    ) : (
                      <span>{item.follow_up_notes || item.notes || "No notes"}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Table for medium and larger screens */}
      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-xl shadow-lg">
          <table className="min-w-full bg-white text-sm rounded-xl">
            <thead>
              <tr className="bg-indigo-100 text-indigo-900">
                <th className="px-4 py-3 border-b font-semibold text-left">
                  Lead ID
                </th>
                <th className="px-4 py-3 border-b font-semibold text-left">
                  Name
                </th>
                <th className="px-4 py-3 border-b font-semibold text-left">
                  Assigned To
                </th>
                <th className="px-4 py-3 border-b font-semibold text-left">
                  Status
                </th>

                <th className="px-4 py-3 border-b font-semibold text-left">
                  Last Updated
                </th>
                <th className="px-4 py-3 border-b font-semibold text-left">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-8"
                  >
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <div className="text-lg text-gray-600">Loading follow-up notes...</div>
                    <div className="text-sm text-gray-500">Fetching leads with notes</div>
                  </td>
                </tr>
              ) : followups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    <div className="text-lg mb-2">No follow-up notes found</div>
                    <div className="text-sm">Notes will appear here when leads have notes added</div>
                  </td>
                </tr>
              ) : (
                followups.map((item, idx) => {
                  const navId = getNavigationLeadId(item);
                  return (
                    <tr
                      key={navId + (item.updated_at || idx)}
                      className={classNames(
                        idx % 2 === 0 ? "bg-white" : "bg-indigo-50",
                        "transition-colors"
                      )}
                    >
                      {/* Lead ID clickable */}
                      <td className="px-4 py-3 border-b font-mono">
                        <button
                          className="text-indigo-700 underline hover:text-indigo-900 cursor-pointer"
                          onClick={() =>
                            navigate(`/leads/${navId}`, { state: { lead: item } })
                          }
                          title="View full details"
                        >
                          {resolveLeadId(item)}
                        </button>
                      </td>
                      <td className="px-4 py-3 border-b">{item.name || "No Name"}</td>
                      <td className="px-4 py-3 border-b">{item.assigned_to || "Unassigned"}</td>
                      <td className="px-4 py-3 border-b">
                        <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold">
                          {item.status || "Unknown"}
                        </span>
                      </td>
                      {/* <td className="px-4 py-3 border-b">
                        {item.follow_up_date
                          ? new Date(item.follow_up_date).toLocaleDateString(
                              "en-IN"
                            )
                          : "-"}
                      </td> */}
                      <td className="px-4 py-3 border-b">
                        {formatDateTimeIST(item.updated_at)}
                      </td>
                      <td className="px-4 py-3 border-b">
                        {item.follow_up_notes &&
                          item.follow_up_notes.length > 50 ? (
                          <>
                            {item.follow_up_notes.slice(0, 50)}...
                            <button
                              onClick={() => {
                                setModalContent(item.follow_up_notes);
                                setModalOpen(true);
                              }}
                              className="ml-2 text-indigo-600 hover:underline text-xs font-semibold"
                            >
                              Read More
                            </button>
                          </>
                        ) : (
                          item.follow_up_notes || item.notes || "No notes"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default NotesSection;
