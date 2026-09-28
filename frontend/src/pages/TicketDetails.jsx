import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageCircle, Clock, User2, Info, Star } from "lucide-react";

const API_BASE = "https://cubehis.avopay.pro:5000/api/tickets";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString();
}
function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleString();
}

export default function TicketDetails() {
  const { ticket_id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tabs state
  const [activeTab, setActiveTab] = useState("Activity");
  const [activities, setActivities] = useState([]);
  const [history, setHistory] = useState([]);
  const [feedback, setFeedback] = useState([]);

  // Fetch ticket details and extract activities, history, feedback
  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/${ticket_id}`)
      .then(res => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(data => {
        setTicket(data);

        // --- Extract Activities ---
        let acts = [];
        if (Array.isArray(data.resolution_log)) {
          acts = data.resolution_log.map((log, idx) => ({
            id: idx + 1,
            action: log.action || "Update",
            user: log.user || "System",
            details: log.details || "",
            time: formatDateTime(log.timestamp) || ""
          }));
        }
        // Optionally, add ticket creation as first activity:
        acts.unshift({
          id: 0,
          action: "Ticket Raised",
          user: data.raised_by || "Unknown",
          details: data.subject ? `Subject: ${data.subject}` : "",
          time: formatDateTime(data.created_at)
        });
        setActivities(acts);

        // --- Extract Status History ---
        let hist = [];
        if (Array.isArray(data.status_history)) {
          hist = data.status_history.map((sh, idx) => ({
            id: idx + 1,
            status: sh.status,
            by: sh.changed_by || data.raised_by || "System",
            at: formatDateTime(sh.timestamp)
          }));
        }
        setHistory(hist);

        // --- Extract Feedback ---
        // If feedback is array
        if (Array.isArray(data.feedback)) {
          setFeedback(data.feedback.map((fb, idx) => ({
            id: idx + 1,
            rating: fb.rating,
            comment: fb.comment,
            by: fb.by || data.raised_by,
            at: formatDateTime(fb.timestamp)
          })));
        } else if (data.feedback) {
          setFeedback([{
            id: 1,
            rating: data.feedback.rating,
            comment: data.feedback.comment,
            by: data.feedback.by || data.raised_by,
            at: formatDateTime(data.feedback.timestamp)
          }]);
        } else {
          setFeedback([]);
        }
      })
      .catch(() => setTicket(null))
      .finally(() => setLoading(false));
  }, [ticket_id]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!ticket) return <div className="p-8 text-center text-gray-500">Ticket not found.</div>;

  // Status styles
  const statusColor =
    ticket.status?.toLowerCase() === "resolved"
      ? "text-green-600 bg-green-50"
      : ticket.status?.toLowerCase() === "in progress"
        ? "text-yellow-700 bg-yellow-50"
        : "text-blue-700 bg-blue-50";

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gradient-to-tr from-slate-100 via-white to-slate-100">
      {/* Sidebar */}
      <aside className="bg-white w-full md:w-80 px-6 py-10 border-b md:border-b-0 md:border-r border-gray-100 flex-shrink-0 flex flex-col items-center shadow-md md:rounded-tr-3xl md:rounded-br-3xl">
        <button
          className="mb-7 px-5 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-800 font-semibold shadow transition flex items-center gap-2 w-full"
          onClick={() => navigate(-1)}
        >
          <span className="text-lg">←</span> Back to Tickets
        </button>
        <div className="flex flex-col items-center mb-8 w-full">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-slate-200 via-white to-slate-200 overflow-hidden mb-4 flex items-center justify-center shadow-inner">
            <Info className="text-blue-500 w-10 h-10" />
          </div>
          <div className="text-xl font-extrabold text-gray-900 mb-1 text-center break-words tracking-tight">
            {ticket.subject || "Ticket Details"}
          </div>
          <span className="rounded-full px-3 py-1 bg-blue-100 text-blue-600 text-xs font-semibold mt-1 mb-0 select-all">
            Ticket #{ticket.ticket_number ?? ticket.ticket_id}
          </span>
        </div>
        <section className="w-full">
          <h3 className="text-lg text-gray-800 font-bold mb-3 tracking-tight">Ticket Info</h3>
          <div className="space-y-4">
            <div>
              <span className="font-semibold text-gray-500"><strong>Status:</strong></span>{" "}
              <span className={`inline-block font-bold rounded px-2 py-0.5 ml-1 text-sm ${statusColor}`}>
                {ticket.status}
              </span>
            </div>
            <div>
              <span className="font-semibold text-gray-500">Created At:</span>{" "}
              <span className="text-gray-800">{formatDateTime(ticket.created_at)}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-500">Closed At:</span>{" "}
              <span className="text-gray-800">{formatDateTime(ticket.closed_at)}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-500">User ID:</span>{" "}
              <span className="text-gray-800">{ticket.user_id}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-500">Raised By:</span>
              <span className="flex items-center gap-2 mt-1 text-gray-800">
                <User2 className="w-5 h-5" />
                {ticket.raised_by || "Unknown"}
              </span>
            </div>
            <div>
              <span className="font-semibold text-gray-500">Priority:</span>{" "}
              <span className="text-gray-800">{ticket.priority || "Normal"}</span>
            </div>
            {ticket.assigned_to && (
              <div>
                <span className="font-semibold text-gray-500">Assigned To:</span>{" "}
                <span className="text-gray-800">{ticket.assigned_to}</span>
              </div>
            )}
            {ticket.category && (
              <div>
                <span className="font-semibold text-gray-500">Category:</span>{" "}
                <span className="text-gray-800">{ticket.category}</span>
              </div>
            )}
          </div>
        </section>
      </aside>
      {/* Main Content */}
      <main className="flex-1 flex flex-col px-2 py-4 xs:px-3 sm:px-8 md:px-12 gap-6">
        {/* Tabs */}
        <nav className="flex gap-2 mt-2 mb-8 flex-wrap overflow-x-auto whitespace-nowrap border-b border-gray-100 pb-2">
          {[
            { label: "Activity", icon: <MessageCircle className="w-5 h-5" /> },
            { label: "Ticket History", icon: <Clock className="w-5 h-5" /> },
            { label: "Ticket Details", icon: <Info className="w-5 h-5" /> },
            { label: "Feedback", icon: <Star className="w-5 h-5" /> }
          ].map(({ label, icon }) => (
            <button
              key={label}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-base font-semibold transition-all duration-150
                ${activeTab === label
                  ? "bg-blue-600 text-white shadow"
                  : "bg-white text-gray-700 hover:bg-blue-50 border border-gray-200"
                }`}
              onClick={() => setActiveTab(label)}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </nav>
        {/* Activity Tab */}
        {activeTab === "Activity" && (
          <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 w-full flex flex-col gap-6">
            <h3 className="font-bold text-xl mb-3 text-gray-900 tracking-tight">Ticket Activity</h3>
            <ul className="divide-y">
              {activities.length === 0 && (
                <li className="text-gray-400 py-4">No activity yet.</li>
              )}
              {activities.map((act) => (
                <li key={act.id} className="py-4 flex flex-col gap-1 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <span className="font-medium text-gray-800">{act.action}</span>
                    {act.details && (
                      <div className="text-xs text-gray-500">{act.details}</div>
                    )}
                  </div>
                  <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-end min-w-[140px]">
                    <span className="text-xs text-gray-700">{act.user}</span>
                    <span className="text-xs text-gray-400">{act.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* Ticket History Tab */}
        {activeTab === "Ticket History" && (
          <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 w-full flex flex-col gap-6">
            <h3 className="font-bold text-xl mb-3 text-gray-900 tracking-tight">Status History</h3>
            <ul className="divide-y">
              {history.length === 0 && (
                <li className="text-gray-400 py-4">No history found.</li>
              )}
              {history.map(h => (
                <li key={h.id} className="py-4 flex flex-col sm:flex-row items-start gap-1">
                  <span className="font-semibold text-blue-800">{h.status}</span>
                  <span className="text-sm text-gray-700 ml-3">{h.by}</span>
                  <span className="text-xs text-gray-400 ml-auto">{h.at}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* Ticket Details Tab */}
        {activeTab === "Ticket Details" && (
          <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 w-full flex flex-col gap-6">
            <h3 className="font-bold text-xl mb-3 text-gray-900 tracking-tight">Ticket Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="font-semibold text-gray-700">Subject:</span>
                <span className="ml-2">{ticket.subject}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Category:</span>
                <span className="ml-2">{ticket.category}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Priority:</span>
                <span className="ml-2">{ticket.priority}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Status:</span>
                <span className="ml-2">{ticket.status}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Raised By:</span>
                <span className="ml-2">{ticket.raised_by}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Assigned To:</span>
                <span className="ml-2">{ticket.assigned_to}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="font-semibold text-gray-700">Description:</span>
                <span className="ml-2">{ticket.description}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Created At:</span>
                <span className="ml-2">{formatDateTime(ticket.created_at)}</span>
              </div>
            </div>
          </section>
        )}
        {/* Feedback Tab */}
        {activeTab === "Feedback" && (
          <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 w-full flex flex-col gap-6">
            <h3 className="font-bold text-xl mb-3 text-gray-900 tracking-tight">Feedback</h3>
            <ul className="divide-y">
              {feedback.length === 0 && (
                <li className="text-gray-400 py-4">No feedback given.</li>
              )}
              {feedback.map(f => (
                <li key={f.id} className="py-4 flex flex-col gap-1">
                  <div>
                    <span className="inline-block bg-yellow-100 text-yellow-800 rounded px-2 py-0.5 font-bold text-lg mr-2">{f.rating}★</span>
                    <span className="text-gray-800">{f.comment}</span>
                  </div>
                  <div className="text-xs text-gray-500">{f.by}, {f.at}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}