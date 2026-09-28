import React, { useState, useEffect } from "react";
import { Form, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { FaExclamationTriangle } from "react-icons/fa";
import { getCurrentUser, getAuthHeaders } from "../../utils/authAPI";
import ImportLeadsSection from "./ImportLeadsSection";
import AllLeadsTable from "./AllLeadsTable";
import FollowUpSection from "./FollowUpSection";
import LeadsDashboard from "./LeadsDashboard";
import NotesSection from "./NotesSection";
import LeadDetailPage from "./LeadDetailPage";
import LeadActivityTimeline from "./LeadActivityTimeline";
import { DuplicateLeadsSection } from "./DuplicateLeadsSection";


/**
 * Lead Management Component with JWT Authentication
 * 
 * This component implements JWT authentication exactly like HierarchyAssignment:
 * 1. Checks for multiple token types (access_token, token, jwt) using getCurrentUser()
 * 2. Sets currentUser state if authenticated
 * 3. Shows an authentication error message if no valid user is found
 * 4. Uses the same auth headers pattern for all API requests
 */

// Responsive tab config
const TABS = [
  { label: "Import Leads", key: "import" },
  { label: "All Leads", key: "all" },
  { label: "Duplicate-Leads", key: "duplicate-leads" },
  { label: "Follow-up", key: "followup" },
  { label: "Notes", key: "notes" },
  { label: "Activity", key: "activity" },
  
];

function LeadManagement() {
  const [activeTab, setActiveTab] = useState("import");
  const [enquiry, setEnquiry] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [importedFollowUp, setImportedFollowUp] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const queryparams = new URLSearchParams(location.search);
  const tabfromQuery = queryparams.get("tab");

  // Check JWT authentication on component mount (matching HierarchyAssignment pattern)
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setCurrentUser(user);
    } else {
      console.warn('User not authenticated. Please log in to access lead management.');
      // Optionally redirect to login page
      // navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    if(tabfromQuery) {
      setActiveTab(tabfromQuery);
      sessionStorage.setItem("activeTab", tabfromQuery); // Save active tab in session storage
    } else {
      const lastTab = sessionStorage.getItem("activeTab")||"import"; // Default to "import" if no tab is saved
      setActiveTab(lastTab);
    }
  },[location.search]);

  // When import is successful, increment refreshKey to reload table
  const handleImportSuccess = () => setRefreshKey((k) => k + 1);

  // Early return for authentication error (exactly matching HierarchyAssignment)
  if (!currentUser) {
    return (
      <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center">
          <FaExclamationTriangle className="text-red-500 text-2xl mr-4" />
          <div>
            <h3 className="font-medium text-red-800">Authentication Error</h3>
            <p className="text-red-700">Please login to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-2 sm:px-4 md:px-6 py-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-indigo-700">
            Lead Management
          </h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">
            Track and manage potential customer interactions
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-x-2 gap-y-1 sm:gap-x-4 md:gap-x-6 border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`py-2 px-3 sm:px-4 text-sm sm:text-base font-semibold transition border-b-4 ${
              activeTab === tab.key
                ? "border-indigo-600 text-indigo-700 bg-white"
                : "border-transparent text-gray-500 hover:text-indigo-700 hover:bg-gray-100"
            }`}
            style={{ minWidth: 90 }}
            onClick={() => {
              setActiveTab(tab.key);
              sessionStorage.setItem("activeTab", tab.key); // Save active tab in session storage
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content and Nested Routing */}
      <div className={`rounded-xl shadow ${activeTab === 'notes' ? 'bg-transparent p-0' : 'bg-white p-3 sm:p-5'} min-h-[300px] relative`}>
        {/* Nested route (lead detail page) renders here if path matches */}
        <Routes location={location}>
          <Route path="/leads/:id" element={<LeadDetailPage />} />
        </Routes>
        {/* Show only if not rendering a nested route or overlay */}
        {activeTab === "import" && (
          <>
            <div className="mb-4">
              <LeadsDashboard />
            </div>
            <ImportLeadsSection
              open={showImportModal}
              onClose={() => setShowImportModal(false)}
              onImportSuccess={handleImportSuccess}
            />
          </>
        )}
        {activeTab === "all" && (
          <div className="overflow-x-auto">
            <AllLeadsTable key={refreshKey} />
          </div>
        )}
        {activeTab === "activity" && (
          <div className="text-gray-600 text-sm sm:text-base">
            <LeadActivityTimeline />
          </div>
        )}
        {activeTab === "followup" && (
          <div className="text-gray-600 text-sm sm:text-base">
            <FollowUpSection importedFollowUp={importedFollowUp} />
          </div>
        )}
        {activeTab === "notes" && (
          <div className="w-full h-full">
            <NotesSection />
          </div>
        )}
        {activeTab === "duplicate-leads" && (
          <div className="w-full h-full">
            <DuplicateLeadsSection />
          </div>
        )}
      </div>
    </div>
  );
}

export default LeadManagement;