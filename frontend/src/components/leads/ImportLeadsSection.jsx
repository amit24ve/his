import React, { useState, useEffect } from "react";

// Card-style modal for notices and success
function CardModal({ open, message, color, onClose }) {
  if (!open) return null;
  const colorMap = {
    green: "bg-green-50 border-green-600 text-green-700",
    purple: "bg-purple-50 border-purple-600 text-purple-700",
    sky: "bg-sky-50 border-sky-600 text-sky-700",
    blue: "bg-blue-50 border-blue-600 text-blue-700",
  };
  const selected = colorMap[color] || colorMap.blue;
  return (
    <div className="fixed inset-0 z-[9999] bg-black bg-opacity-30 flex items-center justify-center">
      <div className={`w-full max-w-sm mx-auto rounded-xl border-2 shadow-xl px-6 py-8 ${selected} flex flex-col items-center`}>
        <div className="mb-4">
          <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="white" />
            {color === "green" ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4" />
            ) : color === "blue" && message?.includes("duplicate") ? (
              // Special icon for duplicates
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v8m-4-4h8" />
            ) : color === "sky" || color === "blue" ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1 4v-4m0 4v1" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16v-4" />
            )}
          </svg>
        </div>
        <div className="text-xl font-bold mb-2">
          {color === "green" ? "Success" :
            (color === "blue" && message?.includes("duplicate")) ? "Duplicate Detected" : "Notice"}
        </div>
        <div className="text-base text-center font-medium mb-4">{message}</div>
        <button
          onClick={onClose}
          className={`w-full py-2 rounded-lg font-semibold transition ${color === "green"
            ? "bg-green-600 hover:bg-green-700 text-white"
            : color === "sky"
              ? "bg-sky-600 hover:bg-sky-700 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
        >
          OK
        </button>
      </div>
    </div>
  );
}

function ImportLeadsSection({ open, onClose, onImportSuccess }) {
  const [googleForm, setGoogleForm] = useState({ spreadsheet_url: "" });
  const [metaForm, setMetaForm] = useState({ form_id: "" });
  const [metaFormManagement, setMetaFormManagement] = useState({
    form_name: "",
    form_id: ""
  });
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [accessTokenStatus, setAccessTokenStatus] = useState({ has_token: false, token_preview: null });
  const [savedMetaForms, setSavedMetaForms] = useState([]);
  const [metaStats, setMetaStats] = useState(null);

  // Meta tokens management
  const [metaTokens, setMetaTokens] = useState([]);
  const [newToken, setNewToken] = useState({
    name: "",
    access_token: "",
    description: "",
    is_active: true
  });
  const [editingToken, setEditingToken] = useState(null);
  const [manualForm, setManualForm] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    notes: "",
    status: "new",
    campaign: "",
    assigned_to: "",
    product: "bpl_franchaise"
  });
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("manual");
  const [metaSubTab, setMetaSubTab] = useState("manage"); // "manage", "tokens", "stats"
  const [cardModal, setCardModal] = useState({ open: false, message: "", color: "green" });

  // Assignment functionality
  const [availableUsers, setAvailableUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // API constants
  const USERS_API = "https://cubehis.avopay.pro:5000/api/users";
  const META_API = "https://cubehis.avopay.pro:5000/api/meta-leads";

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const accessToken = localStorage.getItem('access_token');
    const token = localStorage.getItem('token');
    const finalToken = accessToken || token;

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${finalToken}`
    };
  };

  // Load saved Meta forms and access token status on component mount
  useEffect(() => {
    if (open && activeTab === "meta") {
      loadSavedMetaForms();
      loadMetaStats();
      loadAccessTokenStatus();
      if (metaSubTab === "tokens") {
        loadMetaTokens();
      }
    }
  }, [open, activeTab, metaSubTab]);

  const loadAccessTokenStatus = async () => {
    try {
      const response = await fetch(`${META_API}/access-token`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const status = await response.json();
        setAccessTokenStatus(status);
      }
    } catch (error) {
      console.error('Error loading access token status:', error);
    }
  };

  const loadSavedMetaForms = async () => {
    try {
      console.log('Loading Meta forms from:', `${META_API}/forms`); // Debug log
      const response = await fetch(`${META_API}/forms`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Meta forms response:', data); // Debug log
        // The API returns {success: true, forms: [...]}
        const forms = data.success && Array.isArray(data.forms) ? data.forms : [];
        console.log('Parsed forms:', forms); // Debug log
        setSavedMetaForms(forms);
      } else {
        console.error('Failed to load forms, status:', response.status);
      }
    } catch (error) {
      console.error('Error loading Meta forms:', error);
    }
  };

  const loadMetaStats = async () => {
    try {
      const response = await fetch(`${META_API}/statistics`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Meta stats response:', data); // Debug log
        // The API returns {success: true, stats: {...}}
        setMetaStats(data.success && data.stats ? data.stats : null);
      }
    } catch (error) {
      console.error('Error loading Meta stats:', error);
    }
  };

  const loadMetaTokens = async () => {
    try {
      const response = await fetch("https://cubehis.avopay.pro:5000/api/meta-tokens", {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const tokens = await response.json();
        setMetaTokens(Array.isArray(tokens) ? tokens : []);
      }
    } catch (error) {
      console.error('Error loading Meta tokens:', error);
      setMetaTokens([]);
    }
  };

  useEffect(() => {
    if (!open) {
      setActiveTab("manual");
      setGoogleForm({ spreadsheet_url: "" });
      setMetaForm({ form_id: "" });
      setMetaFormManagement({ form_name: "", form_id: "" });
      setMetaAccessToken("");
      setManualForm({
        name: "",
        email: "",
        phone: "",
        location: "",
        notes: "",
        status: "new",
        campaign: "",
        assigned_to: "",
        product: "bpl_franchaise"
      });
      setSubmitting(false);
      setCardModal({ open: false, message: "", color: "green" });
      setShowSuccessModal(false);
      setSuccessMsg("");
      setMetaSubTab("manage");
    }
  }, [open]);

  // Fetch available users for assignment dropdown
  useEffect(() => {
    if (open) {
      const fetchUsers = async () => {
        setUsersLoading(true);
        try {
          const response = await fetch(`${USERS_API}/`, {
            headers: getAuthHeaders()
          });
          if (response.ok) {
            const users = await response.json();
            setAvailableUsers(Array.isArray(users) ? users : []);
          }
        } catch (error) {
          console.error('Error fetching users:', error);
          setAvailableUsers([]);
        } finally {
          setUsersLoading(false);
        }
      };

      fetchUsers();
    }
  }, [open]);

  // Success modal auto-close
  useEffect(() => {
    let timer;
    if (showSuccessModal) {
      timer = setTimeout(() => {
        setShowSuccessModal(false);
        setSuccessMsg("");
        if (onClose) onClose();
      }, 1500);
    }
    return () => clearTimeout(timer);
  }, [showSuccessModal, onClose]);

  // Handlers
  const handleManualChange = (e) => {
    const { name, value } = e.target;
    setManualForm((f) => ({ ...f, [name]: value }));
  };

  const handleManualLeadSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    if (!manualForm.name || !manualForm.email) {
      setCardModal({ open: true, message: "Name and Email are required.", color: "purple" });
      setSubmitting(false);
      return;
    }

    try {
      // Get the current user from localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');

      const payload = {
        name: manualForm.name.trim(),
        email: manualForm.email.trim(),
        phone: manualForm.phone.trim(),
        location: manualForm.location.trim(),
        notes: manualForm.notes.trim(),
        status: manualForm.status,
        campaign: manualForm.campaign.trim(),
        assigned_to: manualForm.assigned_to || null,
        product: manualForm.product || "bpl_franchaise",
        source: "manual_entry",
        created_by: currentUser.user_id || currentUser.full_name || "user"
      };

      console.log("Sending manual lead payload:", payload);

      const res = await fetch("https://cubehis.avopay.pro:5000/api/lead/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { "Authorization": `Bearer ${token}` })
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("Manual lead creation response:", data);

      if (!res.ok) throw new Error(data.detail || "Failed to create lead");

      setSuccessMsg("Lead created successfully!");
      setShowSuccessModal(true);
      onImportSuccess && onImportSuccess();

      // Reset form
      setManualForm({
        name: "",
        email: "",
        phone: "",
        location: "",
        notes: "",
        status: "new",
        campaign: "",
        assigned_to: "",
        product: "bpl_franchaise"
      });

    } catch (e) {
      console.error("Manual lead creation error:", e);
      // Check if error is about a duplicate lead
      if (e.message && e.message.includes("Duplicate lead found")) {
        setCardModal({
          open: true,
          message: "This lead already exists and has been saved to the duplicates section for reference.",
          color: "blue"
        });
      } else {
        setCardModal({ open: true, message: e.message, color: "purple" });
      }
    }
    setSubmitting(false);
  }; const handleGoogleChange = (e) => {
    const { name, value } = e.target;
    setGoogleForm((f) => ({ ...f, [name]: value }));
  };

  const handleGoogleSheetImport = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    if (!googleForm.spreadsheet_url) {
      setCardModal({ open: true, message: "Spreadsheet URL is required.", color: "green" });
      setSubmitting(false);
      return;
    }
    try {
      // Create a comprehensive mapping that tries all common header variations
      const payload = {
        spreadsheet_url: googleForm.spreadsheet_url,
        sheet_name: googleForm.sheet_name || "Sheet1",
        header_row: parseInt(googleForm.header_row) || 1,
        force_resync: googleForm.force_resync || false,
        mapping: {
          // Map to multiple possible column names for each field
          // The backend will try each of these potential column names
          "name": "Name",
          "email": "Email",
          "phone": "Phone",
          "location": "Location",
          "notes": "Notes",
          "status": "Status",
          "campaign": "Campaign",
          "product": "Product"
        }
      };

      console.log("Sending Google Sheets import payload:", payload);

      const token = localStorage.getItem('access_token') || localStorage.getItem('token');

      const res = await fetch("https://cubehis.avopay.pro:5000/api/lead/integrations/google-sheets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { "Authorization": `Bearer ${token}` })
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("Google Sheets import response:", data);

      if (!res.ok) throw new Error(data.detail || "Failed to import from Google Sheet");

      // Show more detailed success message with count
      const importedCount = data.imported || 0;
      const duplicateCount = data.duplicates || 0;

      setSuccessMsg(
        `Successfully imported ${importedCount} leads` +
        (duplicateCount > 0 ? ` (${duplicateCount} duplicates detected and saved in duplicates section)` : "") +
        `. ${data.message || ""}`
      );

      setShowSuccessModal(true);
      onImportSuccess && onImportSuccess();
      // onClose will be called by the timer in the useEffect above
    } catch (e) {
      console.error("Google Sheets import error:", e);
      if (e.message && e.message.toLowerCase().includes("duplicate")) {
        setCardModal({
          open: true,
          message: "Some leads were identified as duplicates and have been saved to the duplicates section.",
          color: "blue"
        });
      } else {
        setCardModal({ open: true, message: e.message, color: "green" });
      }
    }
    setSubmitting(false);
  };

  const handleMetaChange = (e) => {
    const { name, value } = e.target;
    setMetaForm((f) => ({ ...f, [name]: value }));
  };

  const handleMetaManagementChange = (e) => {
    const { name, value } = e.target;
    setMetaFormManagement((f) => ({ ...f, [name]: value }));
  };

  const handleSaveMetaForm = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    if (!metaFormManagement.form_name || !metaFormManagement.form_id) {
      setCardModal({ open: true, message: "Form name and Form ID are required.", color: "sky" });
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        form_name: metaFormManagement.form_name,
        form_id: metaFormManagement.form_id,
        is_enabled: true
      };

      const response = await fetch(`${META_API}/forms`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to save Meta form");

      setCardModal({ open: true, message: "Meta form saved successfully!", color: "green" });
      setMetaFormManagement({ form_name: "", form_id: "" });
      loadSavedMetaForms();

    } catch (error) {
      setCardModal({ open: true, message: error.message, color: "sky" });
    }
    setSubmitting(false);
  };

  const handleUpdateAccessToken = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    if (!metaAccessToken.trim()) {
      setCardModal({ open: true, message: "Access token is required.", color: "sky" });
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${META_API}/access-token`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ access_token: metaAccessToken }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to update access token");

      setCardModal({ open: true, message: "Access token updated successfully!", color: "green" });
      setMetaAccessToken("");
      loadAccessTokenStatus();

    } catch (error) {
      setCardModal({ open: true, message: error.message, color: "sky" });
    }
    setSubmitting(false);
  };

  const handleToggleMetaForm = async (formId, currentStatus) => {
    try {
      console.log(`Toggling form ${formId} from ${currentStatus} to ${!currentStatus}`);
      const response = await fetch(`${META_API}/forms/${formId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_enabled: !currentStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to update form status");
      }

      setCardModal({
        open: true,
        message: `Form ${!currentStatus ? 'activated' : 'deactivated'} successfully!`,
        color: "green"
      });
      loadSavedMetaForms();

    } catch (error) {
      setCardModal({ open: true, message: error.message, color: "sky" });
    }
  };

  const handleImportFromForm = async (formId) => {
    setSubmitting(true);
    try {
      const response = await fetch(`${META_API}/import/${formId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to import from Meta form");

      setCardModal({
        open: true,
        message: `Imported ${data.imported_count || 0} leads, skipped ${data.skipped_count || 0} duplicates`,
        color: "green"
      });
      loadMetaStats();
      onImportSuccess && onImportSuccess();

    } catch (error) {
      setCardModal({ open: true, message: error.message, color: "sky" });
    }
    setSubmitting(false);
  };

  const handleMetaLeadImport = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    if (!metaForm.form_id) {
      setCardModal({ open: true, message: "Form ID is required.", color: "sky" });
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        form_id: metaForm.form_id
      };

      const response = await fetch(`${META_API}/import-manual`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to import from Meta");

      setSuccessMsg(`Imported ${data.imported_count || 0} leads, skipped ${data.skipped_count || 0} duplicates`);
      setShowSuccessModal(true);
      onImportSuccess && onImportSuccess();

    } catch (error) {
      setCardModal({ open: true, message: error.message, color: "sky" });
    }
    setSubmitting(false);
  };

  // Meta Token Management Functions
  const handleCreateToken = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    if (!newToken.name.trim() || !newToken.access_token.trim()) {
      setCardModal({ open: true, message: "Token name and access token are required.", color: "sky" });
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("https://cubehis.avopay.pro:5000/api/meta-tokens", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(newToken)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to create token");

      setCardModal({ open: true, message: "Meta token created successfully!", color: "green" });
      setNewToken({ name: "", access_token: "", description: "", is_active: true });
      loadMetaTokens();

    } catch (error) {
      setCardModal({ open: true, message: error.message, color: "sky" });
    }
    setSubmitting(false);
  };

  const handleUpdateToken = async (tokenId, updates) => {
    setSubmitting(true);
    try {
      const response = await fetch(`https://cubehis.avopay.pro:5000/api/meta-tokens/${tokenId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to update token");

      setCardModal({ open: true, message: "Meta token updated successfully!", color: "green" });
      setEditingToken(null);
      loadMetaTokens();

    } catch (error) {
      setCardModal({ open: true, message: error.message, color: "sky" });
    }
    setSubmitting(false);
  };

  const handleDeleteToken = async (tokenId) => {
    if (!confirm("Are you sure you want to delete this token?")) return;

    setSubmitting(true);
    try {
      const response = await fetch(`https://cubehis.avopay.pro:5000/api/meta-tokens/${tokenId}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to delete token");

      setCardModal({ open: true, message: "Meta token deleted successfully!", color: "green" });
      loadMetaTokens();

    } catch (error) {
      setCardModal({ open: true, message: error.message, color: "sky" });
    }
    setSubmitting(false);
  };

  const handleTestToken = async (tokenId) => {
    setSubmitting(true);
    try {
      const response = await fetch(`https://cubehis.avopay.pro:5000/api/meta-tokens/${tokenId}/test`, {
        method: "POST",
        headers: getAuthHeaders()
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to test token");

      setCardModal({
        open: true,
        message: data.success ? "Token is working!" : `Token test failed: ${data.message}`,
        color: data.success ? "green" : "red"
      });
      loadMetaTokens();

    } catch (error) {
      setCardModal({ open: true, message: error.message, color: "sky" });
    }
    setSubmitting(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] bg-black bg-opacity-30 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-[calc(95vw+100px)] max-w-[calc(32rem+100px)] sm:max-w-[calc(36rem+100px)] relative flex flex-col max-h-[calc(95vh)] animate-scale-in overflow-hidden border border-gray-200">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-400 hover:text-red-500 text-2xl font-bold z-10"
        >×</button>
        <div className="overflow-y-auto p-7 flex-1 bg-white">
          <h2 className="text-2xl font-extrabold mb-6 text-indigo-700 tracking-tight animate-slide-down flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-full bg-gradient-to-tr from-indigo-400 to-blue-400"></span>
            Import Leads
          </h2>
          {/* Tabs */}
          <div className="mb-6 flex border-b gap-2">
            <button
              className={`px-4 py-2 rounded-t-lg focus:outline-none transition-all font-semibold ${activeTab === "manual"
                ? "text-purple-600 border-b-4 border-purple-500 bg-white shadow"
                : "text-gray-500 bg-gray-50 hover:bg-white"
                }`}
              onClick={() => setActiveTab("manual")}
              style={{ borderBottomWidth: activeTab === "manual" ? 4 : 1 }}
            >
              <i className="fas fa-plus-circle mr-1"></i> Manual Entry
            </button>
            <button
              className={`px-4 py-2 rounded-t-lg focus:outline-none transition-all font-semibold ${activeTab === "google"
                ? "text-green-600 border-b-4 border-green-500 bg-white shadow"
                : "text-gray-500 bg-gray-50 hover:bg-white"
                }`}
              onClick={() => setActiveTab("google")}
              style={{ borderBottomWidth: activeTab === "google" ? 4 : 1 }}
            >
              <i className="fab fa-google mr-1"></i> Google Sheet
            </button>
            <button
              className={`px-4 py-2 rounded-t-lg focus:outline-none transition-all font-semibold ${activeTab === "meta"
                ? "text-indigo-600 border-b-4 border-indigo-500 bg-white shadow"
                : "text-gray-500 bg-gray-50 hover:bg-white"
                }`}
              onClick={() => setActiveTab("meta")}
              style={{ borderBottomWidth: activeTab === "meta" ? 4 : 1 }}
            >
              <i className="fab fa-facebook mr-1"></i> Meta Lead Ads
            </button>
          </div>
          {/* Manual Entry Tab */}
          {activeTab === "manual" && (
            <form className="space-y-6 animate-fade-in-up" onSubmit={handleManualLeadSubmit}>
              <div className="flex items-center gap-3 mb-2">
                <span className="inline-block bg-purple-100 text-purple-700 rounded-full px-3 py-1 text-xs font-bold">
                  Manual Entry
                </span>
              </div>
              <div className="rounded-lg shadow border border-purple-200 bg-white p-5 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-purple-700">Name *</label>
                    <input
                      name="name"
                      className="border-2 border-purple-300 focus:border-purple-600 p-3 rounded-lg w-full text-sm transition bg-white placeholder-purple-200"
                      value={manualForm.name}
                      onChange={handleManualChange}
                      placeholder="Full Name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-purple-700">Email *</label>
                    <input
                      name="email"
                      type="email"
                      className="border-2 border-purple-300 focus:border-purple-600 p-3 rounded-lg w-full text-sm transition bg-white placeholder-purple-200"
                      value={manualForm.email}
                      onChange={handleManualChange}
                      placeholder="email@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-purple-700">Phone</label>
                    <input
                      name="phone"
                      type="tel"
                      className="border-2 border-purple-300 focus:border-purple-600 p-3 rounded-lg w-full text-sm transition bg-white placeholder-purple-200"
                      value={manualForm.phone}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Only allow digits and limit to 10 characters
                        const numbersOnly = value.replace(/\D/g, '');
                        if (numbersOnly.length <= 10) {
                          handleManualChange({
                            target: {
                              name: 'phone',
                              value: numbersOnly
                            }
                          });
                        }
                      }}
                      placeholder="10 digit mobile number"
                      maxLength="10"
                      pattern="[0-9]{10}"
                      title="Please enter exactly 10 digits"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-purple-700">Location</label>
                    <input
                      name="location"
                      className="border-2 border-purple-300 focus:border-purple-600 p-3 rounded-lg w-full text-sm transition bg-white placeholder-purple-200"
                      value={manualForm.location}
                      onChange={handleManualChange}
                      placeholder="City, State"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-purple-700">Status</label>
                    <select
                      name="status"
                      className="border-2 border-purple-300 focus:border-purple-600 p-3 rounded-lg w-full text-sm transition bg-white"
                      value={manualForm.status}
                      onChange={handleManualChange}
                    >
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

                  <div>
                    <label className="block text-sm font-medium mb-1 text-purple-700">Campaign</label>
                    <input
                      name="campaign"
                      className="border-2 border-purple-300 focus:border-purple-600 p-3 rounded-lg w-full text-sm transition bg-white placeholder-purple-200"
                      value={manualForm.campaign}
                      onChange={handleManualChange}
                      placeholder="Campaign Name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-purple-700">Assign to</label>
                  <select
                    name="assigned_to"
                    className="border-2 border-purple-300 focus:border-purple-600 p-3 rounded-lg w-full text-sm transition bg-white"
                    value={manualForm.assigned_to}
                    onChange={handleManualChange}
                    disabled={usersLoading}
                  >
                    <option value="">-- Select User --</option>
                    {availableUsers.map(user => (
                      <option key={user.user_id} value={user.user_id}>
                        {user.full_name || user.username} {user.role_name ? `- ${user.role_name}` : ''}
                      </option>
                    ))}
                  </select>
                  {usersLoading && (
                    <div className="text-xs text-gray-500 mt-1">Loading users...</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-purple-700">Product Type</label>
                  <select
                    name="product"
                    className="border-2 border-purple-300 focus:border-purple-600 p-3 rounded-lg w-full text-sm transition bg-white"
                    value={manualForm.product}
                    onChange={handleManualChange}
                  >
                    <option value="">Select Product</option>
                    <option value="bpl_franchise">BPL Franchise</option>
                    <option value="petrol/diesel">Petrol/Diesel</option>
                    <option value="petrol/diesel/bio_cng/ev">Petrol/Diesel/Bio CNG/EV</option>
                    <option value="bio_cng">Bio CNG</option>
                    <option value="bepl_franchise">BEPL Franchise</option>
                    <option value="depo">Depo</option>
                    <option value="depo_franchise">Depo Franchise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-purple-700">Notes</label>
                  <textarea
                    name="notes"
                    rows="3"
                    className="border-2 border-purple-300 focus:border-purple-600 p-3 rounded-lg w-full text-sm transition bg-white placeholder-purple-200 resize-none"
                    value={manualForm.notes}
                    onChange={handleManualChange}
                    placeholder="Additional notes about this lead..."
                  />
                </div>



                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg px-6 py-3 transition w-full shadow-md hover:shadow-lg mt-2"
                >
                  {submitting ? "Creating Lead..." : "Create Lead"}
                </button>
              </div>
            </form>
          )}
          {/* Google Sheet Tab */}
          {activeTab === "google" && (
            <form className="space-y-6 animate-fade-in-up" onSubmit={handleGoogleSheetImport}>
              <div className="flex items-center gap-3 mb-2">
                <span className="inline-block bg-green-100 text-green-700 rounded-full px-3 py-1 text-xs font-bold">
                  Google Sheets
                </span>
              </div>
              <div className="rounded-lg shadow border border-green-200 bg-white p-5 flex flex-col gap-4">
                <div>
                  <label className="block text-base font-medium mb-1 text-green-700">Spreadsheet URL</label>
                  <input
                    name="spreadsheet_url"
                    className="border-2 border-green-300 focus:border-green-600 p-3 rounded-lg w-full text-lg transition bg-white placeholder-green-200"
                    value={googleForm.spreadsheet_url}
                    onChange={handleGoogleChange}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-green-700">Sheet Name</label>
                    <input
                      name="sheet_name"
                      className="border-2 border-green-300 focus:border-green-600 p-2 rounded-lg w-full text-sm transition bg-white"
                      value={googleForm.sheet_name}
                      onChange={handleGoogleChange}
                      placeholder="Sheet1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-green-700">Header Row</label>
                    <input
                      name="header_row"
                      type="number"
                      min="1"
                      className="border-2 border-green-300 focus:border-green-600 p-2 rounded-lg w-full text-sm transition bg-white"
                      value={googleForm.header_row}
                      onChange={handleGoogleChange}
                      placeholder="1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    name="force_resync"
                    type="checkbox"
                    id="force_resync"
                    className="w-4 h-4 text-green-600 border-2 border-green-300 rounded focus:ring-green-500"
                    checked={googleForm.force_resync}
                    onChange={(e) => setGoogleForm(f => ({ ...f, force_resync: e.target.checked }))}
                  />
                  <label htmlFor="force_resync" className="text-sm text-green-700">
                    Force re-import all data (ignore previous imports)
                  </label>
                </div>



                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg px-6 py-3 transition w-full shadow-md hover:shadow-lg mt-2"
                >
                  {submitting ? "Importing..." : "Import from Google Sheets"}
                </button>
              </div>
            </form>
          )}
          {/* Meta Ads Tab */}
          {activeTab === "meta" && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-block bg-indigo-100 text-indigo-700 rounded-full px-3 py-1 text-xs font-bold">
                  Meta Lead Ads
                </span>
              </div>

              {/* Sub-tabs Navigation */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setMetaSubTab("manage")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${metaSubTab === "manage"
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                  >
                    Manage Forms
                  </button>
                  <button
                    onClick={() => setMetaSubTab("tokens")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${metaSubTab === "tokens"
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                  >
                    Access Tokens
                  </button>
                  {/* <button
                    onClick={() => setMetaSubTab("stats")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      metaSubTab === "stats"
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Statistics
                  </button> */}
                </nav>
              </div>

              {/* Manage Forms Sub-tab */}
              {metaSubTab === "manage" && (
                <div className="space-y-6">
                  {/* Add New Form Section */}
                  <form onSubmit={handleSaveMetaForm}>
                    <div className="rounded-lg shadow border border-indigo-200 bg-white p-5 flex flex-col gap-4">
                      <h3 className="text-lg font-semibold text-indigo-700 mb-2">Add New Meta Form</h3>

                      <div>
                        <label className="block text-sm font-medium mb-1 text-indigo-700">Form Name *</label>
                        <input
                          name="form_name"
                          className="border-2 border-indigo-300 focus:border-indigo-600 p-3 rounded-lg w-full text-sm transition bg-white"
                          value={metaFormManagement.form_name}
                          onChange={handleMetaManagementChange}
                          placeholder="e.g., BPL Franchise Lead Form"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1 text-indigo-700">Form ID *</label>
                        <input
                          name="form_id"
                          className="border-2 border-indigo-300 focus:border-indigo-600 p-3 rounded-lg w-full text-sm transition bg-white"
                          value={metaFormManagement.form_id}
                          onChange={handleMetaManagementChange}
                          placeholder="Meta Lead Ad Form ID"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg px-4 py-2 transition shadow-md hover:shadow-lg"
                      >
                        {submitting ? "Saving..." : "Save Form"}
                      </button>
                    </div>
                  </form>

                  {/* Saved Forms List */}
                  <div className="rounded-lg shadow border border-indigo-200 bg-white p-5">
                    <h3 className="text-lg font-semibold text-indigo-700 mb-4">Saved Meta Forms</h3>

                    {savedMetaForms.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No Meta forms saved yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {savedMetaForms.map((form, index) => (
                          <div key={form.form_id || index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{form.form_name}</div>
                              <div className="text-sm text-gray-500">Form ID: {form.form_id}</div>
                              <div className="text-xs text-gray-400">
                                Last Import: {form.last_fetch_time ? new Date(form.last_fetch_time).toLocaleString() : 'Never'} |
                                Total Imported: {form.total_imported || 0} |
                                Total Skipped: {form.total_skipped || 0}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleImportFromForm(form.form_id)}
                                disabled={submitting}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition"
                              >
                                Import
                              </button>
                              <button
                                onClick={() => handleToggleMetaForm(form.form_id, form.is_enabled)}
                                className={`px-3 py-1 rounded text-sm transition ${form.is_enabled
                                    ? 'bg-green-500 hover:bg-green-600 text-white'
                                    : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                                  }`}
                              >
                                {form.is_enabled ? 'Active' : 'Inactive'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Access Tokens Sub-tab */}
              {metaSubTab === "tokens" && (
                <div className="space-y-6">
                  {/* Create New Token */}
                  <form onSubmit={handleCreateToken}>
                    <div className="rounded-lg shadow border border-blue-200 bg-white p-5 flex flex-col gap-4">
                      <h3 className="text-lg font-semibold text-blue-700 mb-2">Add New Access Token</h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1 text-blue-700">Token Name *</label>
                          <input
                            type="text"
                            className="border-2 border-blue-300 focus:border-blue-600 p-3 rounded-lg w-full text-sm transition bg-white"
                            value={newToken.name}
                            onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
                            placeholder="e.g., Production Token 1"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1 text-blue-700">Description</label>
                          <input
                            type="text"
                            className="border-2 border-blue-300 focus:border-blue-600 p-3 rounded-lg w-full text-sm transition bg-white"
                            value={newToken.description}
                            onChange={(e) => setNewToken({ ...newToken, description: e.target.value })}
                            placeholder="Optional description"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1 text-blue-700">Access Token *</label>
                        <input
                          type="password"
                          className="border-2 border-blue-300 focus:border-blue-600 p-3 rounded-lg w-full text-sm transition bg-white"
                          value={newToken.access_token}
                          onChange={(e) => setNewToken({ ...newToken, access_token: e.target.value })}
                          placeholder="Enter Meta/Facebook Access Token"
                          required
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_active"
                          className="w-4 h-4 text-blue-600 border-2 border-blue-300 rounded focus:ring-blue-500"
                          checked={newToken.is_active}
                          onChange={(e) => setNewToken({ ...newToken, is_active: e.target.checked })}
                        />
                        <label htmlFor="is_active" className="text-sm text-blue-700">
                          Active (token will be used in rotation)
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg px-4 py-2 transition shadow-md hover:shadow-lg"
                      >
                        {submitting ? "Creating..." : "Create Token"}
                      </button>
                    </div>
                  </form>

                  {/* Tokens List */}
                  <div className="rounded-lg shadow border border-blue-200 bg-white p-5">
                    <h3 className="text-lg font-semibold text-blue-700 mb-4">Saved Access Tokens</h3>

                    {metaTokens.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No access tokens saved yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {metaTokens.map((token) => (
                          <div key={token.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-medium text-gray-900">{token.name}</div>
                                <div className={`px-2 py-1 rounded-full text-xs ${token.is_active
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-600'
                                  }`}>
                                  {token.is_active ? 'Active' : 'Inactive'}
                                </div>
                              </div>
                              <div className="text-sm text-gray-500">{token.description}</div>
                              <div className="text-xs text-gray-400 mt-1">
                                Token: {token.access_token} |
                                Created: {new Date(token.created_at).toLocaleDateString()} |
                                Success: {token.success_count} | Errors: {token.error_count}
                                {token.last_used && ` | Last Used: ${new Date(token.last_used).toLocaleDateString()}`}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <button
                                onClick={() => handleTestToken(token.id)}
                                disabled={submitting}
                                className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm transition"
                              >
                                Test
                              </button>
                              <button
                                onClick={() => setEditingToken(token)}
                                disabled={submitting}
                                className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteToken(token.id)}
                                disabled={submitting}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Edit Token Modal */}
                  {editingToken && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Token</h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700">Token Name</label>
                            <input
                              type="text"
                              className="border-2 border-gray-300 focus:border-blue-600 p-2 rounded w-full"
                              value={editingToken.name}
                              onChange={(e) => setEditingToken({ ...editingToken, name: e.target.value })}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700">Description</label>
                            <input
                              type="text"
                              className="border-2 border-gray-300 focus:border-blue-600 p-2 rounded w-full"
                              value={editingToken.description}
                              onChange={(e) => setEditingToken({ ...editingToken, description: e.target.value })}
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="edit_is_active"
                              checked={editingToken.is_active}
                              onChange={(e) => setEditingToken({ ...editingToken, is_active: e.target.checked })}
                            />
                            <label htmlFor="edit_is_active" className="text-sm text-gray-700">Active</label>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                          <button
                            onClick={() => setEditingToken(null)}
                            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdateToken(editingToken.id, {
                              name: editingToken.name,
                              description: editingToken.description,
                              is_active: editingToken.is_active
                            })}
                            disabled={submitting}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            {submitting ? "Updating..." : "Update"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Statistics Sub-tab */}
              {metaSubTab === "stats" && (
                <div className="rounded-lg shadow border border-indigo-200 bg-white p-5">
                  <h3 className="text-lg font-semibold text-indigo-700 mb-4">Meta Leads Statistics</h3>

                  {metaStats ? (
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{metaStats.total_forms || 0}</div>
                        <div className="text-sm text-blue-500">Total Forms</div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{metaStats.total_imported || 0}</div>
                        <div className="text-sm text-purple-500">Total Imported</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">Loading statistics...</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {/* Success Modal */}
        <CardModal
          open={showSuccessModal}
          message={successMsg}
          color="green"
          onClose={() => {
            setShowSuccessModal(false);
            setSuccessMsg("");
            onClose(); // Close the main import modal
          }}
        />
        {/* Error/alert modal */}
        <CardModal open={cardModal.open} message={cardModal.message} color={cardModal.color} onClose={() => setCardModal({ ...cardModal, open: false })} />
      </div>
    </div>
  );
}

export default ImportLeadsSection;