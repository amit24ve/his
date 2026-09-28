import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = "https://cubehis.avopay.pro:5000/api/franchises/enquiries";
const BACKEND_BASE = "https://cubehis.avopay.pro:5000";

const sectionCard =
  "bg-gray-100 rounded-xl shadow border p-5 mb-4 flex flex-col gap-5";



function ModalCard({ open, onClose, children, width = 'max-w-md' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex items-center justify-center w-full h-full px-2 sm:px-4">
        <div
          className={`relative w-[90vw] ${width} p-4 sm:p-6 max-h-[80vh] overflow-y-auto bg-white shadow-xl rounded-xl`}
        >
          <button
            onClick={onClose}
            className="absolute top-2 right-2 sm:right-3 text-gray-400 hover:text-red-500 text-xl sm:text-2xl font-bold z-10"
            aria-label="Close"
          >
            ×
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}


function AddPaymentModal({ open, onClose, onSubmit, newPayment, setNewPayment }) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setSubmitting(false);
  }, [open]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewPayment(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    setSubmitting(true);
    await onSubmit(e);
    setSubmitting(false);
  };

  return (
    <ModalCard open={open} onClose={onClose} width="max-w-lg">
      <h2 className="text-2xl text-blue-700 font-bold mb-4">Add New Payment</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Amount <span className="text-red-600">*</span></label>
          <input
            name="amount"
            type="number"
            min="1"
            required
            placeholder="Enter amount"
            className="border p-2 rounded w-full focus:ring focus:ring-blue-200"
            value={newPayment.amount}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Payment Date <span className="text-red-600">*</span></label>
          <input
            name="date"
            type="date"
            required
            className="border p-2 rounded w-full focus:ring focus:ring-blue-200"
            value={newPayment.date || ""}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Mode <span className="text-red-600">*</span></label>
          <select
            name="mode"
            required
            className="border p-2 rounded w-full focus:ring focus:ring-blue-200"
            value={newPayment.mode}
            onChange={handleChange}
          >
            <option value="">Select Mode</option>
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status <span className="text-red-600">*</span></label>
          <select
            name="status"
            required
            className="border p-2 rounded w-full focus:ring focus:ring-blue-200"
            value={newPayment.status}
            onChange={handleChange}
          >
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Remark</label>
          <input
            name="remark"
            type="text"
            placeholder="Enter remark (optional)"
            className="border p-2 rounded w-full focus:ring focus:ring-blue-200"
            value={newPayment.remark}
            onChange={handleChange}
          />
        </div>
        <button
          type="submit"
          className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded px-4 py-3 shadow-sm transition text-lg"
          disabled={submitting}
        >
          {submitting ? 'Adding...' : 'Add Payment'}
        </button>
      </form>
    </ModalCard>
  );
}

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

function canShowActionButtons(status) {
  return (
    status?.toLowerCase() !== "approved" &&
    status?.toLowerCase() !== "rejected"
  );
}

export default function EnquiryProfileView() {
  const { enquiry_id } = useParams();
  const navigate = useNavigate();
  const [enquiry, setEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Documents");
  const [kycDocs, setKycDocs] = useState([]);
  const [notes, setNotes] = useState(""); // legacy single-note field
  const [notesEdit, setNotesEdit] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [kycStatusMsg, setKycStatusMsg] = useState("");
  const [uploadingIdx, setUploadingIdx] = useState(-1);
  const [uploadFiles, setUploadFiles] = useState({});
  const [uploadMsgs, setUploadMsgs] = useState({});
  const fileInputRefs = useRef({});
  // New: multiple notes per enquiry
  const [multiNotes, setMultiNotes] = useState([]);
  const [multiNotesLoading, setMultiNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [addNoteLoading, setAddNoteLoading] = useState(false);
  const [addNoteError, setAddNoteError] = useState("");
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({ amount: "", mode: "", status: "success", remark: "" });


  useEffect(() => {
    if (activeTab === "Payments") {
      setPaymentsLoading(true);
      fetch(`${API_BASE}/${enquiry_id}/payments`)
        .then(res => res.json())
        .then(res => setPayments(Array.isArray(res) ? res : [])) // <-- always array!
        .catch(() => setPayments([]))
        .finally(() => setPaymentsLoading(false));
    }
  }, [activeTab, enquiry_id]);

  const handleAddPayment = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/${enquiry_id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPayment),
    });
    if (res.ok) {
      setShowAddPayment(false);
      setNewPayment({ amount: "", mode: "", status: "success", remark: "" });
      // Refresh payments
      const updated = await fetch(`${API_BASE}/${enquiry_id}/payments`).then(r => r.json());
      setPayments(updated);
    }
  };

  // Fetch enquiry details
  useEffect(() => {
    const fetchEnquiry = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/${enquiry_id}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setEnquiry(data);
        setNotes(data.notes || "");
      } catch (err) {
        setEnquiry(null);
      }
      setLoading(false);
    };
    fetchEnquiry();
  }, [enquiry_id]);

  // Fetch KYC docs when Documents tab active
  useEffect(() => {
    if (activeTab === "Documents") {
      fetch(`${API_BASE}/${enquiry_id}/kyc-docs`)
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((docs) => setKycDocs(Array.isArray(docs) ? docs : []))
        .catch(() => setKycDocs([]));
    }
  }, [activeTab, enquiry_id, kycStatusMsg, uploadingIdx]);

  // Fetch all notes (multi-note)
  useEffect(() => {
    if (activeTab === "Notes") {
      setMultiNotesLoading(true);
      fetch(`${API_BASE}/${enquiry_id}/notes`)
        .then(res => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then(notesArr => setMultiNotes(Array.isArray(notesArr) ? notesArr : []))
        .catch(() => setMultiNotes([]))
        .finally(() => setMultiNotesLoading(false));
    }
  }, [activeTab, enquiry_id, addNoteLoading]);

  // PATCH Notes (legacy single-note field)
  const handleNotesSave = async () => {
    setNotesSaving(true);
    setNotesError("");
    try {
      const res = await fetch(`${API_BASE}/${enquiry_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        throw new Error("Failed to update notes");
      }
      setNotesEdit(false);
      const updated = await res.json();
      setEnquiry((prev) => ({ ...prev, notes: updated.notes }));
    } catch (err) {
      setNotesError("Failed to save notes.");
    }
    setNotesSaving(false);
  };

  // PATCH KYC doc status
  const handleKycStatus = async (docType, status) => {
    setKycStatusMsg("");
    try {
      const res = await fetch(
        `${API_BASE}/${enquiry_id}/kyc-doc-status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docType, status }),
        }
      );
      if (!res.ok) throw new Error("Failed");
      setKycStatusMsg(`Status updated for ${docType}`);
    } catch (err) {
      setKycStatusMsg("Failed to update status.");
    }
  };

  // Handle per-file input change
  const handleFileChange = (idx, file) => {
    setUploadFiles((prev) => ({ ...prev, [idx]: file }));
  };

  const handleReupload = async (e, doc, idx) => {
    e.preventDefault();
    setUploadingIdx(idx);
    setUploadMsgs((prev) => ({ ...prev, [idx]: "" }));
    const file = uploadFiles[idx];
    if (!file) {
      setUploadMsgs((prev) => ({ ...prev, [idx]: "Please select a file." }));
      setUploadingIdx(-1);
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("docType", doc.docType);
    try {
      const res = await fetch(
        `${API_BASE}/${enquiry_id}/upload-kyc`,
        {
          method: "POST",
          body: formData,
        }
      );
      if (!res.ok) throw new Error("Failed to upload document");
      setUploadMsgs((prev) => ({
        ...prev,
        [idx]: "Document uploaded successfully",
      }));
      setKycStatusMsg(""); // triggers refresh
      setUploadFiles((prev) => ({ ...prev, [idx]: null }));
      if (fileInputRefs.current[idx]) fileInputRefs.current[idx].value = "";
      setTimeout(() => {
        setUploadMsgs((prev) => ({ ...prev, [idx]: "" }));
      }, 2500);
    } catch {
      setUploadMsgs((prev) => ({
        ...prev,
        [idx]: "Failed to upload document",
      }));
    }
    setUploadingIdx(-1);
  };

  // Add a multi-note
  const handleAddMultiNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setAddNoteLoading(true);
    setAddNoteError("");
    try {
      const res = await fetch(`${API_BASE}/${enquiry_id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote, author: enquiry?.first_name || "anonymous" }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      setNewNote("");
      // Will auto-refresh notes by useEffect
    } catch {
      setAddNoteError("Failed to add note.");
    }
    setAddNoteLoading(false);
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!enquiry)
    return <div className="p-8 text-center">Enquiry not found.</div>;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Sidebar */}
      <aside className="bg-gradient-to-b from-white to-gray-100 w-full md:w-80 px-6 py-8 border-r border-gray-200 shadow-sm flex-shrink-0">
        <button
          className="mb-6 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-800 font-medium shadow-sm w-full"
          onClick={() => navigate(-1)}
        >
          ← Back to Franchise
        </button>

        {/* Profile Card */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-white-100 via-blue-200 to-blue-300 overflow-hidden mb-4 shadow-inner flex  border-2 border-blue-300 items-center justify-center">
            {enquiry.avatar_url ? (
              <img
                src={enquiry.avatar_url}
                alt="avatar"
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="bg-blue-100 w-full h-full flex items-center justify-center text-3xl font-bold text-black-600">
                {enquiry.first_name?.[0]}
                {enquiry.last_name?.[0]}
              </div>
            )}
          </div>
          <h2 className=" text-3xl font-extrabold text-gray-900 text-center">
            {enquiry.first_name} {enquiry.last_name}
          </h2>
          <span className="rounded-full px-3 py-1 bg-blue-100 text-blue-600 text-m font-semibold mt-1 mb-0 select-all">{enquiry.enquiry_id}</span>
        </div>

        {/* Details Section */}
        <section className="space-y-4 text-sm text-gray-700">
          <div>
            <h3 className="font-3 font-bold text-gray-600">Contact Info :-</h3>
            <ul className="space-y-1">
              <li>
                <strong>Phone:</strong>{" "}
                <a href={`tel:${enquiry.cell_number}`} className="text-blue-600 hover:underline">
                  {enquiry.cell_number}
                </a>
              </li>
              <li>
                <strong>Email:</strong>{" "}
                <a href={`mailto:${enquiry.email}`} className="text-blue-600 hover:underline">
                  {enquiry.email}
                </a>
              </li>
              <li>
                <strong>Address:</strong> {enquiry.location}
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-gray-600 mb-1">Personal Info</h3>
            <ul className="space-y-1">
              {enquiry.age && <li><strong>Age:</strong> {enquiry.age}</li>}
              {enquiry.date_of_birth && (
                <li><strong>DOB:</strong> {formatDate(enquiry.date_of_birth)}</li>
              )}
              {enquiry.insurance && <li><strong>Insurance:</strong> {enquiry.insurance}</li>}
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-gray-600 mb-1">Franchise Info</h3>
            <ul className="space-y-1">
              <li><strong>Total Cash:</strong> ₹{enquiry.total_cash}</li>
              <li><strong>Total Stores:</strong> {enquiry.num_stores}</li>
              <li>
                <strong>Status:</strong>{" "}
                <span
                  className={`font-medium ${enquiry.status?.toLowerCase() === "approved"
                    ? "text-green-600"
                    : enquiry.status?.toLowerCase() === "rejected"
                      ? "text-red-600"
                      : "text-yellow-600"
                    }`}
                >
                  {enquiry.status}
                </span>
              </li>
              {enquiry.date && (
                <li><strong>Enquiry Date:</strong> {formatDate(enquiry.date)}</li>
              )}
              {enquiry.approved_at && (
                <li><strong>Approved:</strong> {formatDate(enquiry.approved_at)}</li>
              )}
              {enquiry.rejected_at && (
                <li><strong>Rejected:</strong> {formatDate(enquiry.rejected_at)}</li>
              )}
            </ul>
          </div>

          {enquiry.tags?.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-600 mb-1">Tags</h3>
              <div className="flex flex-wrap gap-1">
                {enquiry.tags.map((tag) => (
                  <span key={tag} className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {enquiry.assigned_experts?.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-600 mb-1">Experts</h3>
              <ul className="list-disc list-inside text-gray-700 text-xs">
                {enquiry.assigned_experts.map((exp, idx) => (
                  <li key={idx}>{exp}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </aside>


      {/* Main Content */}
      <main className="flex-1 flex flex-col px-2 py-4 xs:px-2 sm:px-4 md:px-8 gap-4">
        <div className="flex gap-2 mt-2 mb-8 flex-wrap overflow-x-auto whitespace-nowrap">
          {[
            "Documents",
            "Payments",
            "Franchise Map",
            "Notes",
            "Renewal Tracking",
            "ActivityLogs",
          ].map((tab) => (
            <button
              key={tab}
              className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === tab
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-blue-50"
                }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Documents Tab */}
        {activeTab === "Documents" && (
          <section className={sectionCard + " w-[740px] h-[380px] mx-auto"}>
            <h3 className="font-bold text-2xl mb-6 text-gray-900 tracking-tight">KYC Documents</h3>
            {kycStatusMsg && (
              <div className="text-green-700 mb-4 text-base font-medium">{kycStatusMsg}</div>
            )}
            {kycDocs.length === 0 ? (
              <div className="text-gray-500 text-center py-10">No documents uploaded.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {kycDocs.map((doc, idx) => {
                  const isRejected = doc.status?.toLowerCase() === "rejected";
                  const canAct = canShowActionButtons(doc.status);
                  return (
                    <div
                      key={doc.url || doc.name + doc.docType + idx}
                      className={`
                bg-white shadow-md rounded-xl border border-gray-100 p-5 flex flex-col gap-4 relative 
                transition-transform hover:scale-[1.02] hover:shadow-lg
                ${isRejected ? "border-red-200" : ""}
              `}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                          <span className="text-2xl text-blue-500">
                            {doc.name?.match(/\.(jpg|jpeg|png|pdf)$/i)
                              ? doc.name?.toLowerCase().endsWith("pdf")
                                ? "📄"
                                : "📷"
                              : "📁"}
                          </span>
                        </div>
                        <div className="flex-1">
                          <a
                            href={
                              doc.url?.startsWith("http")
                                ? doc.url
                                : `${BACKEND_BASE}${doc.url}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-lg text-blue-700 hover:underline break-all"
                          >
                            {doc.name}
                          </a>
                          <div className="flex gap-2 mt-1">
                            <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold border border-blue-100">
                              {doc.docType}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold border 
                      ${doc.status?.toLowerCase() === "approved"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : doc.status?.toLowerCase() === "rejected"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-gray-50 text-gray-500 border-gray-200"
                              }
                    `}>
                              {doc.status || "Pending"}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Action buttons */}
                      {canAct && (
                        <div className="flex gap-3 mt-2">
                          <button
                            className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg shadow transition"
                            onClick={() => handleKycStatus(doc.docType, "Approved")}
                          >
                            Approve
                          </button>
                          <button
                            className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow transition"
                            onClick={() => handleKycStatus(doc.docType, "Rejected")}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {/* Inline re-upload for rejected */}
                      {isRejected && !canAct && (
                        <form
                          className="flex flex-col gap-2 mt-2"
                          onSubmit={e => handleReupload(e, doc, idx)}
                        >
                          <label className="block text-sm font-medium text-gray-700">
                            <input
                              ref={el => (fileInputRefs.current[idx] = el)}
                              type="file"
                              className="block w-full text-sm border border-gray-300 rounded px-2 py-1 mt-1"
                              onChange={e => handleFileChange(idx, e.target.files[0])}
                              accept="image/*,application/pdf"
                            />
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="flex-1 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition"
                              disabled={uploadingIdx === idx}
                            >
                              {uploadingIdx === idx ? "Uploading..." : "Re-upload"}
                            </button>
                            {uploadMsgs[idx] && (
                              <span
                                className="flex-1 text-sm font-medium"
                                style={{
                                  color: uploadMsgs[idx].toLowerCase().includes("success")
                                    ? "#15803d"
                                    : "#dc2626"
                                }}
                              >
                                {uploadMsgs[idx]}
                              </span>
                            )}
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === "Notes" && (
          <section className={sectionCard + " w-[720px] mx-auto"}>
            <h3 className="font-bold text-2xl mb-5 text-blue-900 tracking-tight flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87"></path><path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 010 7.75"></path></svg>
              Notes
            </h3>
            <form onSubmit={handleAddMultiNote} className="mb-6 flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label htmlFor="new-note" className="block text-sm font-medium text-gray-700 mb-1">
                  Add a new note
                </label>
                <textarea
                  id="new-note"
                  className="w-full border border-blue-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-800 transition"
                  rows={2}
                  placeholder="Type your note here..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  disabled={addNoteLoading}
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold shadow hover:bg-blue-700 disabled:bg-gray-300 transition"
                disabled={addNoteLoading || !newNote.trim()}
              >
                {addNoteLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Adding...
                  </span>
                ) : "Add Note"}
              </button>
            </form>
            {addNoteError && (
              <div className="text-red-600 mb-4">{addNoteError}</div>
            )}
            {multiNotesLoading ? (
              <div className="text-center text-blue-500 py-10">Loading notes...</div>
            ) : (
              <ul className="space-y-3">
                {multiNotes.length === 0 && <li className="text-gray-400 text-center">No notes added yet.</li>}
                {multiNotes
                  .slice()
                  .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                  .map(note => (
                    <li
                      key={note.id}
                      className="bg-white border border-blue-100 rounded-lg p-4 shadow hover:shadow-md transition group relative"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                        </div>
                        <div className="flex-1">
                          <div className="text-gray-800 text-base leading-relaxed">{note.content}</div>
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            {note.author && (
                              <span className="inline-flex items-center gap-1 font-medium text-blue-600">
                                <svg className="w-4 h-4 inline-block" fill="currentColor" viewBox="0 0 20 20"><path d="M10 10a4 4 0 100-8 4 4 0 000 8zm6 8a6 6 0 00-12 0h12z" /></svg>
                                {note.author}
                              </span>
                            )}
                            {note.created_at && (
                              <span>
                                • {formatDateTime(note.created_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        )}

        {activeTab === "Franchise Map" && (
          <section className={sectionCard + " w-[740px] h-[380px] mx-auto"}>
            <h3 className="font-semibold text-lg mb-3">Franchise Map</h3>
            {/* Dummy map area */}
            <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center mb-4 relative overflow-hidden">
              <div className="absolute inset-0">
                {[
                  { name: "Franchise A", status: "active" },
                  { name: "Franchise B", status: "pending" },
                  { name: "Franchise C", status: "inactive" }
                ].map((f, idx) => (
                  <div
                    key={f.name}
                    style={{
                      position: "absolute",
                      left: `${30 + idx * 30}%`,
                      top: `${40 + idx * 10}%`,
                      transform: "translate(-50%, -50%)"
                    }}
                    className={`rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold border-2 border-white shadow-md cursor-pointer
              ${f.status === "active"
                        ? "bg-green-500 text-white"
                        : f.status === "pending"
                          ? "bg-yellow-400 text-white"
                          : "bg-gray-400 text-white"
                      }
            `}
                    title={f.name}
                  >
                    {f.name[0]}
                  </div>
                ))}
              </div>
              <span className="text-gray-400 font-bold">[Map Placeholder]</span>
            </div>
            <div>
              <h4 className="font-medium mb-2 text-gray-700">Franchises</h4>
              <ul className="divide-y">
                {[
                  { name: "Franchise A", region: "Delhi", status: "active", latitude: 28.61, longitude: 77.20 },
                  { name: "Franchise B", region: "Mumbai", status: "pending", latitude: 19.07, longitude: 72.87 },
                  { name: "Franchise C", region: "Bangalore", status: "inactive", latitude: 12.97, longitude: 77.59 }
                ].map(f => (
                  <li key={f.name} className="py-2 flex items-center gap-2">
                    <span
                      className={`inline-block w-3 h-3 rounded-full ${f.status === "active"
                        ? "bg-green-500"
                        : f.status === "pending"
                          ? "bg-yellow-400"
                          : "bg-gray-400"
                        }`}
                      title={f.status}
                    ></span>
                    <span className="font-semibold">{f.name}</span>
                    <span className="text-xs text-gray-500 ml-2">{f.region}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      ({f.latitude}, {f.longitude})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {activeTab === "Renewal Tracking" && (
          <section className={sectionCard + " w-[740px] h-[380px] mx-auto"}>
            <h3 className="font-semibold text-lg mb-3">Renewal Tracking</h3>
            {/* Dummy summary */}
            <div className="mb-5">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 bg-blue-50 rounded p-3 flex flex-col items-center">
                  <span className="text-2xl font-bold text-blue-700">2025-12-10</span>
                  <span className="text-xs text-gray-500">Next Renewal Date</span>
                </div>
                <div className="flex-1 bg-green-50 rounded p-3 flex flex-col items-center">
                  <span className="text-2xl font-bold text-green-700">Active</span>
                  <span className="text-xs text-gray-500">Status</span>
                </div>
                <div className="flex-1 bg-yellow-50 rounded p-3 flex flex-col items-center">
                  <span className="text-2xl font-bold text-yellow-600">180</span>
                  <span className="text-xs text-gray-500">Days Remaining</span>
                </div>
              </div>
            </div>
            {/* Dummy renewal history */}
            <div>
              <h4 className="font-medium mb-2 text-gray-700">Renewal History</h4>
              <ul className="divide-y">
                {[
                  {
                    date: "2024-12-10",
                    status: "Renewed",
                    amount: 5000,
                    remark: "Renewed on time",
                  },
                  {
                    date: "2023-12-10",
                    status: "Renewed",
                    amount: 4800,
                    remark: "Renewed with discount",
                  },
                  {
                    date: "2022-12-10",
                    status: "Renewed",
                    amount: 4700,
                    remark: "",
                  },
                ].map((item, i) => (
                  <li key={i} className="py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <span className="text-sm font-semibold text-gray-800 w-36">{item.date}</span>
                    <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded mr-2">{item.status}</span>
                    <span className="text-sm text-blue-900 w-28">₹ {item.amount}</span>
                    <span className="text-xs text-gray-500">{item.remark}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Dummy renew button */}
            <div className="mt-6 flex justify-end">
              <button
                className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                onClick={() => alert("Renewal process initiated (dummy)!")}
              >
                Renew Now
              </button>
            </div>
          </section>
        )}
        {activeTab === "ActivityLogs" && (
          <section className={`${sectionCard} w-full max-w-2xl mx-auto`}>
            <h3 className="font-semibold text-lg mb-3">Activity Logs</h3>
            <ul className="divide-y">
              {[
                {
                  time: "2025-06-30 10:20",
                  user: "Amit Verma",
                  action: "Added payment",
                  details: "₹5000 (UPI) for renewal"
                },
                {
                  time: "2025-06-29 14:57",
                  user: "Sonia Singh",
                  action: "Uploaded KYC Document",
                  details: "Aadhar card uploaded"
                },
                {
                  time: "2025-06-28 16:11",
                  user: "Amit Verma",
                  action: "Added Note",
                  details: "Follow up called, awaiting response."
                },
                {
                  time: "2025-06-27 11:03",
                  user: "System",
                  action: "Enquiry Created",
                  details: ""
                }
              ].map((log, i) => (
                <li key={i} className="py-3 flex flex-col gap-1 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <span className="font-medium text-gray-800">{log.action}</span>
                    {log.details && (
                      <div className="text-xs text-gray-500">{log.details}</div>
                    )}
                  </div>
                  <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-end min-w-[140px]">
                    <span className="text-xs text-gray-700">{log.user}</span>
                    <span className="text-xs text-gray-400">{log.time}</span>
                  </div>
                </li>
              ))}
            </ul>
            {/* Dummy filter/search UI */}


          </section>
        )}

        {/* {activeTab === "Payments" && (
          <section className={sectionCard + " w-[740px] h-[380px] mx-auto"}>
            <h3 className="font-semibold text-lg mb-3">Payments</h3>
            <button
              className="mb-2 px-3 py-1 bg-blue-600 text-white rounded opacity-70 cursor-not-allowed"
              disabled
            >
              Add Payment
            </button>
            <table className="w-full text-sm mb-2">
              <thead>
                <tr>
                  <th className="text-left py-1 px-2">Amount</th>
                  <th className="text-left py-1 px-2">Date</th>
                  <th className="text-left py-1 px-2">Mode</th>
                  <th className="text-left py-1 px-2">Status</th>
                  <th className="text-left py-1 px-2">Remark</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    amount: 5000,
                    date: "2025-06-30",
                    mode: "UPI",
                    status: "success",
                    remark: "Advance payment"
                  },
                  {
                    amount: 3500,
                    date: "2025-04-15",
                    mode: "Card",
                    status: "success",
                    remark: "2nd Installment"
                  },
                  {
                    amount: 1200,
                    date: "2025-02-12",
                    mode: "Cash",
                    status: "pending",
                    remark: "Cash pending"
                  }
                ].map((pay, i) => (
                  <tr key={i}>
                    <td className="py-1 px-2">₹{pay.amount}</td>
                    <td className="py-1 px-2">{pay.date}</td>
                    <td className="py-1 px-2">{pay.mode}</td>
                    <td className={`py-1 px-2 font-semibold ${pay.status === "success" ? "text-green-700" :
                      pay.status === "pending" ? "text-yellow-700" : "text-gray-700"
                      }`}>
                      {pay.status}
                    </td>
                    <td className="py-1 px-2">{pay.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>

          </section>
        )} */}


        {activeTab === "Payments" && (
          <section className={sectionCard + " w-[740px] h-[380px] mx-auto"}>
            <h3 className="font-semibold text-lg mb-3">Payments</h3>
            <button
              className="mb-2 px-3 py-1 bg-blue-600 text-white rounded hover:opacity-90"
              onClick={() => setShowAddPayment(true)}
            >
              Add Payment
            </button>
            {paymentsLoading ? (
              <div className="text-center py-8 text-blue-500">Loading payments...</div>
            ) : (
              <table className="w-full text-sm mb-2">
                <thead>
                  <tr>
                    <th className="text-left py-1 px-2">Amount</th>
                    <th className="text-left py-1 px-2">Date</th>
                    <th className="text-left py-1 px-2">Mode</th>
                    <th className="text-left py-1 px-2">Status</th>
                    <th className="text-left py-1 px-2">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(payments) && payments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-5 text-gray-400 text-center">
                        No payments recorded.
                      </td>
                    </tr>
                  ) : (
                    [...(payments || [])]
                      .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date, newest first
                      .map((pay, i) => (
                        <tr key={pay.id || i}>
                          <td className="py-1 px-2">₹{pay.amount}</td>
                          <td className="py-1 px-2">{formatDate(pay.date)}</td>
                          <td className="py-1 px-2">{pay.mode}</td>
                          <td className={`py-1 px-2 font-semibold ${pay.status === "success"
                              ? "text-green-700"
                              : pay.status === "pending"
                                ? "text-yellow-700"
                                : "text-gray-700"
                            }`}>
                            {pay.status}
                          </td>
                          <td className="py-1 px-2">{pay.remark}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            )}

            {/* Add Payment Modal */}
            <AddPaymentModal
              open={showAddPayment}
              onClose={() => setShowAddPayment(false)}
              onSubmit={handleAddPayment}
              newPayment={newPayment}
              setNewPayment={setNewPayment}
            />
          </section>
        )}
        {/* ...other tabs, add responsive containers as needed */}
      </main>
    </div>
  );
}
