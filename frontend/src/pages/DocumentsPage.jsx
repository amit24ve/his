import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const statusColor = {
  Signed: "bg-green-100 text-green-700",
  Sent: "bg-yellow-100 text-yellow-700",
  Generated: "bg-blue-100 text-blue-700",
  Pending: "bg-gray-100 text-gray-500",
};

const docTypes = ["Agreement", "Quotation", "MoU", "Receipt", "Other"];
const API_BASE = "https://cubehis.avopay.pro:5000/api/documents";
const ROWS_PER_PAGE = 10;

// Animation variants for modal
const modalVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 60 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 28 } },
  exit: { opacity: 0, scale: 0.95, y: 32, transition: { duration: 0.19 } }
};

function InfoModal({ open, status, message, onClose }) {
  // status: 'success' | 'error' | 'info'
  const color =
    status === 'success'
      ? 'bg-green-100 text-green-700 border-green-400'
      : status === 'error'
        ? 'bg-red-100 text-red-700 border-red-400'
        : 'bg-blue-100 text-blue-700 border-blue-300';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={modalVariants}
        >
          <motion.div
            className={`w-full max-w-xs sm:max-w-sm md:max-w-md rounded-2xl p-7 shadow-2xl border-2 ${color} flex flex-col items-center relative`}
            initial={{ scale: 0.92, opacity: 0, y: 60 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 24, transition: { duration: 0.19 } }}
          >
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-red-600 transition"
              onClick={onClose}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="w-full text-center">
              <div className="mb-3">
                {status === "success" && (
                  <svg className="mx-auto w-10 h-10 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {status === "error" && (
                  <svg className="mx-auto w-10 h-10 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {status === "info" && (
                  <svg className="mx-auto w-10 h-10 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01" />
                  </svg>
                )}
              </div>
              <div className="font-bold text-lg mb-2">{status === "success" ? "Success" : status === "error" ? "Error" : "Info"}</div>
              <div className="text-base">{message}</div>
              <button
                className="mt-6 px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function DocumentManagement() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [franchiseOption, setFranchiseOption] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [docs, setDocs] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateType, setTemplateType] = useState("Agreement");
  const [templateFilled, setTemplateFilled] = useState({
    client: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    details: "",
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const uploadRef = useRef();
  const [hoveredRow, setHoveredRow] = useState(null);

  // Info modal state
  const [infoModal, setInfoModal] = useState({ open: false, status: "info", message: "" });

  // Pagination state
  const [page, setPage] = useState(1);

  useEffect(() => {
    setClients([
      { id: "ABC Enterprises", name: "ABC Enterprises" },
      { id: "XYZ Franchise", name: "XYZ Franchise" },
    ]);
    fetchDocuments();
    // eslint-disable-next-line
  }, []);

  const fetchDocuments = async () => {
    let url = `${API_BASE}/`;
    const params = [];
    if (selectedClient) params.push(`generated_for=${encodeURIComponent(selectedClient)}`);
    if (params.length) url += "?" + params.join("&");

    const res = await fetch(url);
    if (res.ok) {
      const docs = await res.json();
      setDocs(
        docs.map((d) => ({
          ...d,
          client: d.generated_for,
          type: d.type,
          filename: d.pdf_url ? d.pdf_url.split("/").pop() : "Document.pdf",
          uploaded: d.timestamp
            ? d.timestamp.$date
              ? new Date(d.timestamp.$date).toLocaleDateString()
              : new Date(d.timestamp).toLocaleDateString()
            : "",
          status: d.status || "Generated",
          url: d.pdf_url
            ? d.pdf_url.startsWith("http")
              ? d.pdf_url
              : `https://cubehis.avopay.pro:5000${d.pdf_url}`
            : "#",
        }))
      );
    }
  };

  useEffect(() => {
    fetchDocuments();
    setPage(1); // Reset page when filtering
    // eslint-disable-next-line
  }, [selectedClient]);

  const filteredDocs = docs.filter(
    (d) =>
      (!selectedClient || d.client === selectedClient) &&
      (
        (d.filename && d.filename.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.type && d.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.client && d.client.toLowerCase().includes(searchTerm.toLowerCase()))
      )
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredDocs.length / ROWS_PER_PAGE);
  const paginatedDocs = filteredDocs.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const onFileChange = (e) => {
    setSelectedFile(e.target.files[0] || null);
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedClient) {
      setInfoModal({
        open: true,
        status: "error",
        message: "Please select a client/franchise and a file to upload.",
      });
      return;
    }
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("type", "Other");
    formData.append("generated_for", selectedClient);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        await fetchDocuments();
        setInfoModal({
          open: true,
          status: "success",
          message: "Document uploaded successfully.",
        });
      } else {
        setInfoModal({
          open: true,
          status: "error",
          message: "Failed to upload document. Please try again.",
        });
      }
    } catch {
      setInfoModal({
        open: true,
        status: "error",
        message: "An error occurred during upload.",
      });
    }
    setSelectedFile(null);
    if (uploadRef.current) uploadRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!templateFilled.client) {
      setInfoModal({
        open: true,
        status: "error",
        message: "Please select a client/franchise for generation.",
      });
      return;
    }
    const body = {
      type: templateType,
      generated_for: templateFilled.client,
      template_data: {
        date: templateFilled.date,
        amount: templateFilled.amount,
        details: templateFilled.details,
      },
    };
    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchDocuments();
        setShowTemplateModal(false);
        setTemplateFilled({
          client: "",
          date: new Date().toISOString().slice(0, 10),
          amount: "",
          details: "",
        });
        setInfoModal({
          open: true,
          status: "success",
          message: "Document generated successfully.",
        });
      } else {
        setInfoModal({
          open: true,
          status: "error",
          message: "Failed to generate document. Please try again.",
        });
      }
    } catch {
      setInfoModal({
        open: true,
        status: "error",
        message: "An error occurred during generation.",
      });
    }
  };

  return (
    <div className="bg-gradient-to-tr from-blue-50 via-white to-indigo-50 min-h-screen py-8 px-2 sm:px-6 lg:px-8 font-sans">
      <InfoModal
        open={infoModal.open}
        status={infoModal.status}
        message={infoModal.message}
        onClose={() => setInfoModal({ ...infoModal, open: false })}
      />
      <div className="max-w-6xl mx-auto space-y-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          className="bg-white rounded-2xl shadow-xl border border-blue-100 p-7 flex flex-col md:flex-row items-center justify-between gap-5"
        >
          <div>
            <h2 className="text-3xl font-bold text-blue-800 tracking-tight mb-2 flex items-center gap-2">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth={2}></rect>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 3h8v4H8z" />
              </svg>
              Document Management System
            </h2>
            <p className="text-gray-500 text-base max-w-lg">
              Upload, generate and manage all documents in one place. Search, filter and download agreements, MoUs, receipts and more.
            </p>
          </div>
        </motion.div>

        {/* Actions bar */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg border border-blue-100 px-4 py-4"
        >
          <div className="flex flex-row flex-wrap items-end gap-4 w-full">
            {/* Client/Franchise */}
            <div className="flex flex-col min-w-[220px] flex-1">
              <label className="font-semibold text-blue-700 mb-1" htmlFor="client">
                Client/Franchise
              </label>
              <select
                id="client"
                className="border-2 border-blue-100 rounded-xl p-2 w-full focus:ring-2 focus:ring-blue-300"
                value={selectedClient}
                onChange={e => {
                  setSelectedClient(e.target.value);
                  setFranchiseOption("");
                }}
              >
                <option value="">All</option>
                {clients.map(cl => (
                  <option key={cl.id} value={cl.name}>{cl.name}</option>
                ))}
              </select>
            </div>

            {/* Select Action */}
            <div className="flex flex-col min-w-[220px] flex-1">
              <label className="font-semibold text-blue-700 mb-1" htmlFor="franchiseOption">
                Select Action
              </label>
              <select
                id="franchiseOption"
                className="border-2 border-blue-100 rounded-xl p-2 w-full focus:ring-2 focus:ring-blue-300"
                value={franchiseOption}
                onChange={e => {
                  setFranchiseOption(e.target.value);
                  setSelectedFile(null);
                  if (uploadRef.current) uploadRef.current.value = "";
                }}
              // always enabled
              >
                <option value="">Select...</option>
                <option value="upload">Upload Document</option>
                <option value="generate">Fill Template & Generate</option>
              </select>
            </div>

            {/* Upload Document or Fill Template */}
            <div className="flex flex-col min-w-[270px] flex-1">
              <label className="font-semibold text-blue-700 mb-1" htmlFor="upload">
                {franchiseOption === "upload"
                  ? "Upload Document"
                  : franchiseOption === "generate"
                    ? "Generate Document"
                    : <span className="opacity-0">Upload Document</span>
                }
              </label>
              {/* Upload */}
              {selectedClient && franchiseOption === "upload" && (
                <div className="flex w-full">
                  <input
                    id="upload"
                    type="file"
                    ref={uploadRef}
                    className="border-2 border-blue-100 rounded-l-xl p-2 w-full text-sm cursor-pointer"
                    onChange={onFileChange}
                    disabled={!selectedClient}
                    style={{ borderRight: 0 }}
                  />
                  <motion.button
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-r-xl font-semibold transition shadow flex items-center justify-center whitespace-nowrap"
                    onClick={handleUpload}
                    disabled={!selectedFile}
                    type="button"
                    whileHover={{ scale: 1.07, backgroundColor: "#2563eb" }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    Upload
                  </motion.button>
                </div>
              )}
              {/* Fill Template */}
              {selectedClient && franchiseOption === "generate" && (
                <div className="flex w-full h-[38px]">
                  <motion.button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-semibold transition shadow flex items-center justify-center"
                    onClick={() => {
                      setTemplateFilled(f => ({ ...f, client: selectedClient }));
                      setShowTemplateModal(true);
                    }}
                    type="button"
                    whileHover={{ scale: 1.07, backgroundColor: "#2563eb" }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Fill Template & Generate
                  </motion.button>
                </div>
              )}
              {(!selectedClient || franchiseOption === "") && <div className="h-[38px]" />}
            </div>
          </div>
        </motion.div>

        {/* MODAL for Agreement Template - animated */}
        <AnimatePresence>
          {showTemplateModal && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalVariants}
              key="template-modal"
            >
              <motion.div
                className="bg-white w-full max-w-lg rounded-2xl p-8 shadow-2xl relative border-2 border-blue-200"
                initial={{ scale: 0.92, opacity: 0, y: 60 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 24, transition: { duration: 0.19 } }}
                style={{ width: '95vw', maxWidth: 480 }}
              >
                <button
                  className="absolute top-3 right-3 text-gray-400 hover:text-red-600 transition"
                  onClick={() => setShowTemplateModal(false)}
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <h3 className="text-xl font-bold text-blue-800 mb-6">
                  Auto-fill & Generate {templateType} PDF
                </h3>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-700">Type</label>
                    <select
                      className="border-2 border-blue-100 rounded-lg p-2 w-full"
                      value={templateType}
                      onChange={e => setTemplateType(e.target.value)}
                    >
                      {docTypes.map(type => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700">Client/Franchise</label>
                    <select
                      className="border-2 border-blue-100 rounded-lg p-2 w-full"
                      value={templateFilled.client}
                      onChange={e => setTemplateFilled(f => ({ ...f, client: e.target.value }))}
                    >
                      <option value="">Select...</option>
                      {clients.map(cl => (
                        <option key={cl.id} value={cl.name}>{cl.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700">Date</label>
                    <input
                      type="date"
                      className="border-2 border-blue-100 rounded-lg p-2 w-full"
                      value={templateFilled.date}
                      onChange={e => setTemplateFilled(f => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                  {(templateType === "Quotation" || templateType === "Receipt") && (
                    <div>
                      <label className="block text-sm font-medium text-blue-700">Amount</label>
                      <input
                        type="number"
                        className="border-2 border-blue-100 rounded-lg p-2 w-full"
                        value={templateFilled.amount}
                        onChange={e => setTemplateFilled(f => ({ ...f, amount: e.target.value }))}
                        placeholder="Enter amount"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-blue-700">Details/Notes</label>
                    <textarea
                      className="border-2 border-blue-100 rounded-lg p-2 w-full"
                      value={templateFilled.details}
                      onChange={e => setTemplateFilled(f => ({ ...f, details: e.target.value }))}
                      placeholder="Optional notes or details"
                    />
                  </div>
                </div>
                <div className="mt-8 flex justify-end gap-3">
                  <button
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2 rounded-lg font-semibold"
                    onClick={() => setShowTemplateModal(false)}
                  >
                    Cancel
                  </button>
                  <motion.button
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold shadow"
                    onClick={handleGenerate}
                    disabled={!templateFilled.client}
                    whileHover={{ scale: 1.07, backgroundColor: "#2563eb" }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Generate PDF
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Document Table */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.15 }}
          className="bg-white rounded-2xl shadow-lg p-2 sm:p-7 mt-3 border border-blue-100"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-3">
            <h3 className="text-xl font-bold text-blue-800 flex items-center gap-2">
              <svg className="h-7 w-7 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth={2}></rect>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 3h8v4H8z" />
              </svg>
              Documents
            </h3>
            <div className="w-full md:w-[300px]">
              <input
                id="search"
                type="text"
                className="border-2 border-blue-100 rounded-xl p-2 w-full focus:ring-2 focus:ring-blue-200"
                placeholder="Search by name, type..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1); // Reset page when searching
                }}
              />
            </div>
          </div>
          <div className="overflow-x-auto border border-blue-50 rounded-lg">
            <table className="min-w-[650px] w-full text-xs sm:text-sm md:text-base">
              <thead>
                <tr className="bg-blue-50 text-blue-700 text-sm">
                  <th className="px-2 sm:px-4 py-3 font-bold text-left">Client</th>
                  <th className="px-2 sm:px-4 py-3 font-bold text-left">Type</th>
                  <th className="px-2 sm:px-4 py-3 font-bold text-left">Filename</th>
                  <th className="px-2 sm:px-4 py-3 font-bold text-left">Uploaded</th>
                  <th className="px-2 sm:px-4 py-3 font-bold text-left">Status</th>
                  <th className="px-2 sm:px-4 py-3 font-bold text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDocs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-gray-400 text-center py-8 text-lg">
                      No documents found.
                    </td>
                  </tr>
                ) : (
                  paginatedDocs.map((doc, idx) => (
                    <motion.tr
                      key={doc.id}
                      initial={false}
                      animate={hoveredRow === idx ? { scale: 1.02, backgroundColor: "#eff6ff", boxShadow: "0 2px 16px 0 #60a5fa33" } : { scale: 1, backgroundColor: "#fff", boxShadow: "none" }}
                      transition={{ type: "spring", stiffness: 150, damping: 16 }}
                      className="transition border-b last:border-b-0 cursor-pointer"
                      onMouseEnter={() => setHoveredRow(idx)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td className="px-2 sm:px-4 py-3">{doc.client}</td>
                      <td className="px-2 sm:px-4 py-3">{doc.type}</td>
                      <td className="px-2 sm:px-4 py-3 font-mono text-xs">{doc.filename}</td>
                      <td className="px-2 sm:px-4 py-3">{doc.uploaded}</td>
                      <td className="px-2 sm:px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor[doc.status] || "bg-gray-100 text-gray-700"}`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3">
                        {doc.url && doc.url !== "#" ? (
                          <a
                            href={doc.url}
                            className="text-blue-700 hover:underline font-semibold text-xs"
                            download={doc.filename}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {["Generated", "Signed", "Sent"].includes(doc.status) ? (
                              <span>
                                <svg className="inline w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                Download
                              </span>
                            ) : (
                              <span>
                                <svg className="inline w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A2 2 0 0020 6.382V5a2 2 0 00-2-2H6a2 2 0 00-2 2v1.382a2 2 0 00.447 1.342L9 10" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                                </svg>
                                View
                              </span>
                            )}
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">N/A</span>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Total document and Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-2">
            <span className="text-gray-600 font-medium">
              Total Documents: {filteredDocs.length}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <motion.button
                  className="px-4 py-2 rounded border bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Prev
                </motion.button>
                <span className="mx-2 text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <motion.button
                  className="px-4 py-2 rounded border bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Next
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}