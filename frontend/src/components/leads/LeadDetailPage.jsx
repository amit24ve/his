import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Select from "react-select";

/*
 * IMPORTANT: This component now uses Indian Standard Time (IST) for all timestamps
 * All dates and times are converted to IST format (+05:30) before sending to API
 * This ensures consistent timezone handling across the application
 *
 * ROLE-BASED FIELD RESTRICTIONS (SIMPLIFIED):
 * - Phone, Name, Email, Location fields are only editable for top-level roles (level: 0 from roles API)
 * - ONLY "Assigned To" and "General Notes" fields use manager permissions (users with subordinates)
 * - District field is editable for all users
 * - All other fields are editable by everyone
 * - Permission checking is done via single API call to /api/leads/access-check endpoint
 * - Returns: {is_top_level: bool, has_subordinates: bool}
 * - This enforces proper organizational hierarchy with minimal restrictions
 */

// Indian Standard Time (IST) utility functions
const getCurrentISTTimestamp = () => {
  // Get current time in IST
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istTime = new Date(now.getTime() + istOffset - (now.getTimezoneOffset() * 60 * 1000));
  return istTime.toISOString().replace('Z', '+05:30');
};

const getCurrentLocalTime = () => {
  // Use IST time
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istTime = new Date(now.getTime() + istOffset - (now.getTimezoneOffset() * 60 * 1000));
  return istTime.toISOString().replace('Z', '+05:30');
};

const getCurrentLocalForInput = () => {
  // Create IST timestamp for datetime-local input
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istTime = new Date(now.getTime() + istOffset - (now.getTimezoneOffset() * 60 * 1000));
  const year = istTime.getFullYear();
  const month = String(istTime.getMonth() + 1).padStart(2, '0');
  const day = String(istTime.getDate()).padStart(2, '0');
  const hours = String(istTime.getHours()).padStart(2, '0');
  const minutes = String(istTime.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const createISTDateTime = (date, time) => {
  // Create IST datetime string for API calls
  if (!date || !time) return getCurrentISTTimestamp();

  // Parse the local date and time input
  const dateTime = new Date(`${date}T${time}`);

  // Convert to IST
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istTime = new Date(dateTime.getTime() + istOffset - (dateTime.getTimezoneOffset() * 60 * 1000));

  return istTime.toISOString().replace('Z', '+05:30');
};

const convertToLocal = (dateString) => {
  if (!dateString) return null;
  return new Date(dateString);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  // Format in IST timezone
  return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
};

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  // Format in IST timezone
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const getISTDateForInput = () => {
  // Get tomorrow's IST date for date input field
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istTime = new Date(now.getTime() + istOffset - (now.getTimezoneOffset() * 60 * 1000));
  const tomorrow = new Date(istTime);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
};

const isDatesEqualInLocal = (date1, date2) => {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getTime() === d2.getTime();
};

const API_BASE = "https://cubehis.avopay.pro:5000/api/lead/leads";
const FOLLOWUPS_API = "https://cubehis.avopay.pro:5000/api/followups";
const NOTES_API = "https://cubehis.avopay.pro:5000/api/lead/lead-notes";
const ACTIVITIES_API = "https://cubehis.avopay.pro:5000/api/lead/lead-activities";
const USERS_API = "https://cubehis.avopay.pro:5000/api/users";

// Helper function to get auth headers (matching HierarchyAssignment pattern)
const getAuthHeaders = () => {
  const accessToken = localStorage.getItem('access_token');
  const token = localStorage.getItem('token');
  const jwtToken = localStorage.getItem('jwt');
  const finalToken = accessToken || token || jwtToken;

  const headers = {
    'Content-Type': 'application/json'
  };

  if (finalToken) {
    if (finalToken.startsWith('Bearer ')) {
      headers['Authorization'] = finalToken;
    } else {
      headers['Authorization'] = `Bearer ${finalToken}`;
    }
  }

  // Debug logging
  console.log('🔍 Auth Headers Debug:', {
    accessToken: accessToken ? `${accessToken.substring(0, 20)}...` : 'missing',
    token: token ? `${token.substring(0, 20)}...` : 'missing',
    jwtToken: jwtToken ? `${jwtToken.substring(0, 20)}...` : 'missing',
    finalToken: finalToken ? `${finalToken.substring(0, 20)}...` : 'missing',
    authorizationHeader: headers['Authorization'] ? `${headers['Authorization'].substring(0, 30)}...` : 'missing'
  });

  return headers;
};

// Helper function to handle 401 responses
const handleUnauthorized = () => {
  console.error('Authentication failed - clearing localStorage and redirecting to login');
  localStorage.clear();
  window.location.href = '/login';
};

// Debug function to check auth status (matching HierarchyAssignment pattern)
const debugAuthStatus = () => {
  const authData = {
    access_token: localStorage.getItem('access_token'),
    token: localStorage.getItem('token'),
    jwt: localStorage.getItem('jwt'),
    user: localStorage.getItem('user'),
    allKeys: Object.keys(localStorage)
  };

  console.log('=== AUTH DEBUG STATUS ===');
  console.table(authData);

  return authData;
};

// Helper function to resolve user names
const resolveUserName = async (userId) => {
  if (!userId || userId === 'Unassigned') {
    return userId;
  }

  // Handle system users with friendly names
  if (userId === 'system') {
    return 'System Admin';
  }

  if (userId === 'Admin') {
    return 'Administrator';
  }

  try {
    const response = await fetch(`${USERS_API}/${userId}`, {
      headers: getAuthHeaders()
    });
    if (response.ok) {
      const user = await response.json();
      return user.full_name || user.name || userId;
    }
  } catch (error) {
    console.log(`Could not resolve user name for ${userId}:`, error);
  }

  return userId;
};
const sectionCard = "bg-white rounded-xl shadow border p-5 mb-4 flex flex-col gap-3";

const statusColors = {
  NEW: "bg-gray-200 text-gray-700",
  COMPLETED: "bg-green-500 text-white",
  PENDING: "bg-yellow-200 text-yellow-800",
  "IN PROGRESS": "bg-blue-200 text-blue-800",
  SPAM: "bg-orange-400 text-white",
  QUOTED: "bg-blue-700 text-white",
};
const resolveName = lead =>
  lead?.name || lead?.raw_data?.Name || "";
const resolveEmail = lead =>
  lead?.email || lead?.raw_data?.Email || "";

// Helper function to get current user's name
const getCurrentUserName = () => {
  try {
    const currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
    if (!currentUser) return "Current User";
    return currentUser.full_name || currentUser.name || currentUser.username || "Current User";
  } catch (error) {
    console.error('Error getting current user name:', error);
    return "Current User";
  }
};

// Helper function to get current user ID
const getCurrentUserId = () => {
  try {
    const currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
    if (!currentUser) return null;
    return currentUser.user_id || currentUser.username || null;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
};
const resolvePhone = lead =>
  lead?.phone || lead?.raw_data?.Phone || "";
const resolveAlternatePhone = lead =>
  lead?.alternate_phone || lead?.raw_data?.["Secondary phone number"] || lead?.raw_data?.["Alternate Phone"] || lead?.raw_data?.alternate_phone || "";

// Phone validation functions for Indian mobile numbers (supports both with and without country code)
const validateIndianPhone = (phone) => {
  if (!phone) return false;

  // Remove any non-digit characters except +
  const cleanPhone = phone.replace(/[^\d+]/g, '');

  // Handle different formats:
  // 1. +919876543210 (with +91 country code)
  // 2. 919876543210 (with 91 country code, no +)
  // 3. 9876543210 (without country code)

  if (cleanPhone.startsWith('+91')) {
    // Format: +919876543210 (13 characters total)
    const phoneNumber = cleanPhone.slice(3); // Remove +91
    return phoneNumber.length === 10 && /^[6-9]\d{9}$/.test(phoneNumber);
  } else if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
    // Format: 919876543210 (12 characters total)
    const phoneNumber = cleanPhone.slice(2); // Remove 91
    return phoneNumber.length === 10 && /^[6-9]\d{9}$/.test(phoneNumber);
  } else if (cleanPhone.length === 10) {
    // Format: 9876543210 (10 characters)
    return /^[6-9]\d{9}$/.test(cleanPhone);
  }

  return false;
};

const formatPhoneInput = (value) => {
  // Keep + symbol and digits only
  const formatted = value.replace(/[^\d+]/g, '');

  // Limit based on format
  if (formatted.startsWith('+91')) {
    return formatted.slice(0, 13); // +91 + 10 digits
  } else if (formatted.startsWith('91')) {
    return formatted.slice(0, 12); // 91 + 10 digits  
  } else if (formatted.startsWith('+')) {
    return formatted.slice(0, 13); // Allow other country codes
  } else {
    return formatted.slice(0, 10); // Just 10 digits
  }
};

const handlePhoneChange = (value, field, setLead, lead) => {
  const formattedPhone = formatPhoneInput(value);
  if (field === 'phone') {
    setLead({
      ...lead,
      phone: formattedPhone,
      raw_data: { ...(lead.raw_data || {}), 'Phone': formattedPhone }
    });
  } else if (field === 'alternate_phone') {
    setLead({
      ...lead,
      alternate_phone: formattedPhone,
      raw_data: { ...(lead.raw_data || {}), 'Alternate Phone': formattedPhone }
    });
  }
};
const resolveLocation = lead =>
  lead?.location || lead?.raw_data?.Location || "";

const resolveDistrict = lead =>
  lead?.district || lead?.raw_data?.District || "";
const resolveStatus = lead =>
  lead?.status || lead?.raw_data?.Stage || "new";
const resolveAssigned = lead =>
  lead?.assigned_to || lead?.raw_data?.Assigned || "";
const resolveNotes = lead => {
  const notes = lead?.notes || lead?.raw_data?.Notes || "";
  if (Array.isArray(notes)) {
    // If notes is an array of objects, join their 'content' fields
    return notes.map(n => (typeof n === "object" && n !== null ? n.content || JSON.stringify(n) : String(n))).join("\n");
  }
  if (typeof notes === "object" && notes !== null) {
    // If notes is a single object, try to get its content
    return notes.content || JSON.stringify(notes);
  }
  return String(notes);
};
const resolveSource = lead =>
  lead?.source_details || lead?.raw_data?.Source || lead?.source || "";
const resolveCreatedAt = lead =>
  lead?.created_at || lead?.raw_data?.Created || "";
const resolveLabels = lead =>
  (lead?.labels || lead?.Labels || lead?.raw_data?.Labels || "").toString();

function SuccessModal({ open, onClose, message }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6 relative text-center">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl"
          aria-label="Close"
        >
          &times;
        </button>
        <div className="flex justify-center mb-2">
          <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={2} fill="none" /><path stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M8 13l3 3 5-5" /></svg>
        </div>
        <div className="text-lg font-semibold text-green-700 mb-2">
          {message.includes("successfully at") ? "Success!" : message}
        </div>
        {message.includes("successfully at") && (
          <div className="text-sm text-gray-600 mb-2">
            {message}
          </div>
        )}
        <button
          className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function LeadDetailPage() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [lead, setLead] = useState(location.state?.lead || null);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState("Lead Details");
  // Follow-ups
  const [leadFollowUps, setLeadFollowUps] = useState([]);
  // Notes (will be filtered from /api/lead/notes)
  const [leadNotes, setLeadNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [addNoteLoading, setAddNoteLoading] = useState(false);
  const [addNoteError, setAddNoteError] = useState("");
  // Activities
  const [leadActivities, setLeadActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  // Add Follow-up form
  const [newFollowUpType, setNewFollowUpType] = useState("call");
  const [newFollowUpStatus, setNewFollowUpStatus] = useState("pending");
  const [newFollowUpNotes, setNewFollowUpNotes] = useState("");
  const [newFollowUpDate, setNewFollowUpDate] = useState("");
  const [newFollowUpTime, setNewFollowUpTime] = useState("");

  // Set default date and time when component loads
  useEffect(() => {
    // Set default date to tomorrow in IST
    const defaultDate = getISTDateForInput();

    // Set default time to 10:00 AM
    const defaultTime = "10:00";

    if (!newFollowUpDate) setNewFollowUpDate(defaultDate);
    if (!newFollowUpTime) setNewFollowUpTime(defaultTime);
  }, [newFollowUpDate, newFollowUpTime]);
  const [addFollowUpLoading, setAddFollowUpLoading] = useState(false);
  const [addFollowUpError, setAddFollowUpError] = useState("");

  // Status dropdown for follow-ups
  const [editingStatusId, setEditingStatusId] = useState(null);

  // Follow-up date/time editing
  const [editingFollowUpId, setEditingFollowUpId] = useState(null);
  const [editingFollowUpDate, setEditingFollowUpDate] = useState("");
  const [editingFollowUpTime, setEditingFollowUpTime] = useState("");

  // Indian Districts data for location selection - dynamically loaded
  const [indianDistricts, setIndianDistricts] = useState([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);

  // State code mapping for Indian states and UTs
  const STATE_CODE = {
    "Andhra Pradesh": "AP", "Arunachal Pradesh": "AR", "Assam": "AS", "Bihar": "BR",
    "Chhattisgarh": "CG", "Goa": "GA", "Gujarat": "GJ", "Haryana": "HR",
    "Himachal Pradesh": "HP", "Jharkhand": "JH", "Karnataka": "KA", "Kerala": "KL",
    "Madhya Pradesh": "MP", "Maharashtra": "MH", "Manipur": "MN", "Meghalaya": "ML",
    "Mizoram": "MZ", "Nagaland": "NL", "Odisha": "OD", "Punjab": "PB", "Rajasthan": "RJ",
    "Sikkim": "SK", "Tamil Nadu": "TN", "Telangana": "TG", "Tripura": "TR",
    "Uttar Pradesh": "UP", "Uttarakhand": "UK", "West Bengal": "WB",
    // UTs
    "Andaman and Nicobar Islands": "AN", "Chandigarh": "CH",
    "Dadra and Nagar Haveli and Daman and Diu": "DN",
    "Delhi": "DL", "Jammu and Kashmir": "JK", "Ladakh": "LA",
    "Lakshadweep": "LD", "Puducherry": "PY",
  };

  // Function to normalize state names
  const normalizeState = (stateName) => {
    const fixes = {
      "Orissa": "Odisha",
      "Uttaranchal": "Uttarakhand",
      "NCT of Delhi": "Delhi",
      "Dadara & Nagar Havelli": "Dadra and Nagar Haveli and Daman and Diu",
      "Dadra and Nagar Haveli": "Dadra and Nagar Haveli and Daman and Diu",
      "Daman and Diu": "Dadra and Nagar Haveli and Daman and Diu",
      "Jammu & Kashmir": "Jammu and Kashmir",
      "Pondicherry": "Puducherry",
      "UT of Jammu and Kashmir": "Jammu and Kashmir",
    };
    return fixes[stateName.trim()] || stateName.trim();
  };

  // Function to fetch and process districts data
  const fetchDistrictsData = async () => {
    setDistrictsLoading(true);
    const sources = [
      "https://gist.githubusercontent.com/nateshmbhat/7e1a28eba37364be1456f9c4688bd2a7/raw",
      "https://raw.githubusercontent.com/iaseth/data-for-india/master/districts/districts_by_state.json",
    ];

    let data = null;
    let lastError = null;

    // Try to fetch from sources
    for (const url of sources) {
      try {
        const response = await fetch(url, { timeout: 30000 });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        data = await response.json();
        break;
      } catch (error) {
        lastError = error;
        console.warn(`Failed to fetch from ${url}:`, error);
      }
    }

    if (!data) {
      console.error("Failed to fetch districts data:", lastError);
      // Fallback to a basic list if API fails
      setIndianDistricts([
        { value: "Ayodhya(UP)", label: "Ayodhya (UP)" },
        { value: "Delhi(DL)", label: "Delhi (DL)" },
        { value: "Mumbai(MH)", label: "Mumbai (MH)" },
        { value: "Bangalore(KA)", label: "Bangalore (KA)" },
        { value: "Chennai(TN)", label: "Chennai (TN)" },
        { value: "Kolkata(WB)", label: "Kolkata (WB)" },
        // Add more fallback options as needed
      ]);
      setDistrictsLoading(false);
      return;
    }

    try {
      // Convert data to consistent format
      let processedData = data;
      if (Array.isArray(data)) {
        // Convert array format to object format
        const temp = {};
        for (const row of data) {
          const stateName = normalizeState(
            row.state || row.State || row.name || ""
          );
          const districts = row.districts || row.Districts || [];
          if (stateName) {
            temp[stateName] = districts;
          }
        }
        processedData = temp;
      }

      // Process districts and create formatted options
      const districtOptions = [];
      for (const [state, districts] of Object.entries(processedData)) {
        const normalizedState = normalizeState(state);
        const stateCode = STATE_CODE[normalizedState];

        if (!stateCode) continue; // Skip unknown states

        for (const district of districts) {
          const districtName = String(district).trim();
          if (!districtName ||
            districtName.toLowerCase() === "nan" ||
            districtName.toLowerCase() === "null" ||
            districtName === "") {
            continue;
          }

          const formattedValue = `${districtName}(${stateCode})`;
          const formattedLabel = `${districtName} (${stateCode})`;

          districtOptions.push({
            value: formattedValue,
            label: formattedLabel
          });
        }
      }

      // Sort districts alphabetically by district name (first word)
      districtOptions.sort((a, b) => {
        // Extract district names (everything before the state code in parentheses)
        const districtA = a.label.split(' (')[0].toLowerCase();
        const districtB = b.label.split(' (')[0].toLowerCase();
        return districtA.localeCompare(districtB);
      });

      // Remove duplicates
      const uniqueDistricts = districtOptions.filter((district, index, self) =>
        index === self.findIndex(d => d.value === district.value)
      );

      setIndianDistricts(uniqueDistricts);
    } catch (error) {
      console.error("Error processing districts data:", error);
      // Set fallback data on processing error
      setIndianDistricts([
        { value: "Ayodhya(UP)", label: "Ayodhya (UP)" },
        { value: "Delhi(DL)", label: "Delhi (DL)" },
        { value: "Mumbai(MH)", label: "Mumbai (MH)" },
      ]);
    }

    setDistrictsLoading(false);
  };

  // Load districts data when component mounts
  useEffect(() => {
    fetchDistrictsData();
  }, []);

  // Debug editingStatusId changes
  useEffect(() => {
    console.log('editingStatusId changed to:', editingStatusId);
  }, [editingStatusId]);

  // User name resolution
  const [resolvedUserNames, setResolvedUserNames] = useState({});
  const [availableUsers, setAvailableUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Subordinates management - using role-based permissions instead
  const [hasEditPermissions, setHasEditPermissions] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [isTopLevelUser, setIsTopLevelUser] = useState(false);
  const [isManagerUser, setIsManagerUser] = useState(false);

  // Helper function to check if activity belongs to current lead
  const isActivityForCurrentLead = (activity, currentLeadId, leadObject) => {
    // Check multiple possible lead ID fields from activity
    const possibleLeadIds = [
      activity.lead_id,
      activity.related_lead_id,
      activity.object_id,
      activity.leadId,
      activity.target_id,
      activity.entity_id
    ].filter(Boolean);

    // Get all possible current lead identifiers
    const currentIds = [
      currentLeadId,
      leadObject?._id,
      leadObject?.lead_id,
      leadObject?.id,
      leadObject?.objectId
    ].filter(Boolean);

    // Enhanced matching with debugging
    const isMatch = possibleLeadIds.some(activityId =>
      currentIds.some(currentId => {
        // Exact match
        if (activityId === currentId) return true;

        // String comparison (handles ObjectId conversion)
        if (activityId.toString() === currentId.toString()) return true;

        // Handle cases where IDs might have different formats
        const activityIdStr = String(activityId).trim();
        const currentIdStr = String(currentId).trim();

        if (activityIdStr === currentIdStr) return true;

        return false;
      })
    );

    // Debug logging for troubleshooting
    if (activity && (activity._id || activity.id)) {
      console.log('Activity Match Check:', {
        activityId: activity._id || activity.id,
        activityLeadIds: possibleLeadIds,
        currentLeadIds: currentIds,
        matched: isMatch,
        activityType: activity.action || activity.activity_type || activity.type
      });
    }

    return isMatch;
  };

  // Helper function to format activity type for display
  const formatActivityType = (activity) => {
    const type = activity.action || activity.activity_type || activity.type || 'Activity';

    // Format common activity types to be more readable
    const typeMap = {
      'note_added': 'Note Added',
      'followup_created': 'Follow-up Created',
      'followup_updated': 'Follow-up Updated',
      'lead_updated': 'Lead Updated',
      'lead_created': 'Lead Created',
      'assignment_changed': 'Assignment Changed',
      'status_changed': 'Status Changed',
      'import': 'Import',
      'call': 'Call Activity',
      'email': 'Email Activity',
      'meeting': 'Meeting Activity',
      'task': 'Task Activity'
    };

    return typeMap[type] || type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Helper function to get activity icon
  const getActivityIcon = (activity) => {
    const type = activity.action || activity.activity_type || activity.type || 'activity';

    const iconMap = {
      'note_added': '📝',
      'followup_created': '📅',
      'followup_updated': '🔄',
      'lead_updated': '✏️',
      'lead_created': '➕',
      'assignment_changed': '👤',
      'status_changed': '🔄',
      'import': '📥',
      'call': '📞',
      'email': '✉️',
      'meeting': '🤝',
      'task': '✅'
    };

    return iconMap[type] || '📋';
  };

  // Helper function to get activity color theme
  const getActivityColorTheme = (activity) => {
    const type = activity.action || activity.activity_type || activity.type || 'activity';

    const colorMap = {
      'note_added': 'bg-blue-50 border-blue-200 text-blue-800',
      'followup_created': 'bg-green-50 border-green-200 text-green-800',
      'followup_updated': 'bg-yellow-50 border-yellow-200 text-yellow-800',
      'lead_updated': 'bg-purple-50 border-purple-200 text-purple-800',
      'lead_created': 'bg-emerald-50 border-emerald-200 text-emerald-800',
      'assignment_changed': 'bg-orange-50 border-orange-200 text-orange-800',
      'status_changed': 'bg-indigo-50 border-indigo-200 text-indigo-800',
      'import': 'bg-gray-50 border-gray-200 text-gray-800',
      'call': 'bg-blue-50 border-blue-200 text-blue-800',
      'email': 'bg-red-50 border-red-200 text-red-800',
      'meeting': 'bg-teal-50 border-teal-200 text-teal-800',
      'task': 'bg-green-50 border-green-200 text-green-800'
    };

    return colorMap[type] || 'bg-gray-50 border-gray-200 text-gray-800';
  };

  // Function to get display name for user
  const getDisplayName = (userId) => {
    if (!userId || userId === 'Unassigned') return userId;

    // Only handle truly system-generated entries
    if (userId === 'system' && !resolvedUserNames[userId]) return 'System Admin';
    if (userId === 'Admin' && !resolvedUserNames[userId]) return 'Administrator';
    if (userId === 'admin_user' && !resolvedUserNames[userId]) return 'Admin User';

    return resolvedUserNames[userId] || userId;
  };

  // Function to get assigned user display name from dropdown data
  const getAssignedUserDisplayName = (userId) => {
    if (!userId || userId === 'Unassigned') return 'Unassigned';

    const user = availableUsers.find(u => u.user_id === userId);
    if (user) {
      return `${user.full_name || user.username}${user.role_name ? ` - ${user.role_name}` : ''}`;
    }

    return getDisplayName(userId);
  };

  // Function to check editing permissions based on user role
  const checkEditPermissions = () => {
    setPermissionsLoading(true);
    try {
      const currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;

      if (!currentUser) {
        console.warn('No user found in localStorage');
        setHasEditPermissions(false);
        return;
      }

      // Get user roles
      const userRoles = currentUser.roles || [];
      const roleIds = currentUser.role_ids || [];

      // Check if user has management roles that can edit phone numbers and assignments
      const managementRoles = ['admin', 'manager', 'company_manager', 'director'];
      const restrictedRoles = ['executive', 'team', 'team_member', 'bde', 'bdo', 'sales_head', 'sales_manager'];

      // Check by role name (case insensitive)
      const hasManagementRole = userRoles.some(role =>
        managementRoles.some(mgmtRole =>
          role.toLowerCase().includes(mgmtRole.toLowerCase())
        )
      );

      // Check by role_ids if available
      const hasManagementRoleId = roleIds.some(roleId =>
        managementRoles.some(mgmtRole =>
          roleId.toLowerCase().includes(mgmtRole.toLowerCase())
        )
      );

      setHasEditPermissions(hasManagementRole || hasManagementRoleId);

    } catch (error) {
      console.error('Error checking edit permissions:', error);
      setHasEditPermissions(false);
    } finally {
      setPermissionsLoading(false);
    }
  };

  // Function to check user access permissions from API
  const checkUserAccess = async () => {
    try {
      const response = await fetch('https://cubehis.avopay.pro:5000/api/leads/access-check', {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        console.error('Failed to fetch user access');
        return { is_top_level: false, has_subordinates: false };
      }

      const accessData = await response.json();

      console.log(`User access check:`, accessData);

      return {
        is_top_level: accessData.is_top_level || false,
        has_subordinates: accessData.has_subordinates || false
      };

    } catch (error) {
      console.error('Error checking user access:', error);
      return { is_top_level: false, has_subordinates: false };
    }
  };

  // Initialize permissions on component mount
  const [status, setStatus] = useState(resolveStatus(lead));
  const [assigned, setAssigned] = useState(resolveAssigned(lead) || "");
  const [notes, setNotes] = useState(resolveNotes(lead));
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState(lead?.follow_up_notes || "");
  const [originalFollowUpNotes, setOriginalFollowUpNotes] = useState(lead?.follow_up_notes || "");
  const [updatingFollowUpId, setUpdatingFollowUpId] = useState(null);

  // Helper function to create activity for lead updates
  const createLeadActivity = async (oldLead, newLead, activityType = "lead_updated") => {
    try {
      const currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
      const createdBy = currentUser?.user_id || currentUser?.username || 'system';

      // Build description based on changes
      const changes = [];
      const metadata = {};

      // Check for status changes
      if (oldLead.status !== newLead.status) {
        changes.push(`status: '${oldLead.status || 'new'}' → '${newLead.status}'`);
        metadata.old_status = oldLead.status || 'new';
        metadata.new_status = newLead.status;
      }

      // Check for notes changes
      if (oldLead.notes !== newLead.notes) {
        const oldNotesDisplay = oldLead.notes || '';
        const newNotesDisplay = newLead.notes ? `[{'content': '${newLead.notes}'}]` : '';
        changes.push(`notes: '${oldNotesDisplay}' → '${newNotesDisplay}'`);
        metadata.old_notes = oldLead.notes || '';
        metadata.new_notes = newLead.notes ? [{ content: newLead.notes }] : [];
      }

      // Check for follow-up notes changes
      if (oldLead.follow_up_notes !== newLead.follow_up_notes) {
        const oldNotes = oldLead.follow_up_notes || null;
        const newNotes = newLead.follow_up_notes || [];
        changes.push(`follow_up_notes: '${oldNotes || 'None'}' → '${Array.isArray(newNotes) ? JSON.stringify(newNotes) : newNotes}'`);
        metadata.old_follow_up_notes = oldNotes;
        metadata.new_follow_up_notes = Array.isArray(newNotes) ? newNotes : [];
      }

      // Only create activity if there are actual changes
      if (changes.length === 0) {
        return null;
      }

      const activityData = {
        lead_id: lead.lead_id || leadId,
        activity_type: activityType,
        description: `Lead updated: ${changes.join(', ')}`,
        created_at: getCurrentISTTimestamp(),
        created_by: createdBy,
        metadata: metadata
      };

      console.log('Creating activity:', activityData);

      const response = await fetch(ACTIVITIES_API, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(activityData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create activity:', errorData);
        return null;
      }

      const result = await response.json();
      console.log('Activity created successfully:', result);
      return result;

    } catch (error) {
      console.error('Error creating lead activity:', error);
      return null;
    }
  };

  // Helper function to create activity for follow-up operations
  const createFollowUpActivity = async (followUpData, activityType = "followup_created") => {
    try {
      const currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
      const createdBy = currentUser?.user_id || currentUser?.username || 'system';

      const activityData = {
        lead_id: lead.lead_id || leadId,
        activity_type: activityType,
        description: `Follow-up ${activityType.replace('followup_', '')}: ${followUpData.type || 'call'} scheduled for ${formatDateTime(followUpData.scheduled_date)}`,
        created_at: getCurrentISTTimestamp(),
        created_by: createdBy,
        metadata: {
          followup_id: followUpData.id || followUpData._id,
          followup_type: followUpData.type,
          followup_status: followUpData.status,
          scheduled_date: followUpData.scheduled_date,
          remarks: followUpData.remarks,
          customer_name: followUpData.customer_name,
          customer_phone: followUpData.customer_phone,
          sent: followUpData.sent || false
        }
      };

      console.log('Creating follow-up activity:', activityData);

      const response = await fetch(ACTIVITIES_API, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(activityData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create follow-up activity:', errorData);
        return null;
      }

      const result = await response.json();
      console.log('Follow-up activity created successfully:', result);
      return result;

    } catch (error) {
      console.error('Error creating follow-up activity:', error);
      return null;
    }
  };

  // Helper function to create activity for notes
  const createNoteActivity = async (noteContent) => {
    try {
      const currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
      const createdBy = currentUser?.user_id || currentUser?.username || 'system';

      const activityData = {
        lead_id: lead.lead_id || leadId,
        activity_type: "note_added",
        description: `Note added: ${noteContent.substring(0, 100)}${noteContent.length > 100 ? '...' : ''}`,
        created_at: getCurrentISTTimestamp(),
        created_by: createdBy,
        metadata: {
          note_content: noteContent,
          note_length: noteContent.length
        }
      };

      console.log('Creating note activity:', activityData);

      const response = await fetch(ACTIVITIES_API, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(activityData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create note activity:', errorData);
        return null;
      }

      const result = await response.json();
      console.log('Note activity created successfully:', result);
      return result;

    } catch (error) {
      console.error('Error creating note activity:', error);
      return null;
    }
  };

  // Helper function to update lead's follow_up_updated_at timestamp
  const updateLeadFollowUpTimestamp = async (timestamp = null) => {
    const updateTimestamp = timestamp || getCurrentISTTimestamp();
    try {
      const response = await fetch(`${API_BASE}/${leadId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          follow_up_updated_at: updateTimestamp
        }),
      });

      if (response.ok) {
        // Update the lead state with new timestamp
        setLead(prevLead => ({
          ...prevLead,
          follow_up_updated_at: updateTimestamp
        }));
        return { success: true, timestamp: updateTimestamp };
      }

      return { success: false, timestamp: updateTimestamp };
    } catch (error) {
      console.error("Error updating follow-up timestamp:", error);
      return { success: false, timestamp: updateTimestamp };
    }
  };

  // Helper function to refresh lead data after follow-up operations
  const refreshLeadData = async () => {
    try {
      const leadRes = await fetch(`${API_BASE}/${leadId}`, {
        headers: getAuthHeaders()
      });
      if (leadRes.ok) {
        const updatedLeadData = await leadRes.json();
        setLead(updatedLeadData);
        return updatedLeadData;
      }
    } catch (error) {
      console.error("Error refreshing lead data:", error);
    }
    return null;
  };

  // Helper function to refresh follow-ups list
  const refreshFollowUpsList = async () => {
    try {
      const followupsRes = await fetch(`${FOLLOWUPS_API}/lead/${leadId}`, {
        headers: getAuthHeaders()
      });
      if (followupsRes.status === 401) {
        handleUnauthorized();
        return [];
      }
      if (!followupsRes.ok) {
        throw new Error(`HTTP error! Status: ${followupsRes.status}`);
      }
      const followupsData = await followupsRes.json();
      setLeadFollowUps(Array.isArray(followupsData) ? followupsData : []);
      return followupsData;
    } catch (error) {
      console.error("Error refreshing follow-ups list:", error);
      setLeadFollowUps([]);
      return [];
    }
  };

  // Helper function to check if follow-up data has changed
  const hasFollowUpChanged = () => {
    return followUpNotes !== originalFollowUpNotes;
  };

  // Fetch full lead
  useEffect(() => {
    // Debug auth status on component load
    debugAuthStatus();

    setLoading(true);
    fetch(`${API_BASE}/${leadId}`, {
      headers: getAuthHeaders()
    })
      .then(res => {
        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (!data) return; // Exit if we handled 401

        setLead(data);
        setStatus(resolveStatus(data));
        setAssigned(resolveAssigned(data) || "");
        setNotes(resolveNotes(data));
        setFollowUpNotes(data?.follow_up_notes || "");
        // Set original values for change detection
        setOriginalFollowUpNotes(data?.follow_up_notes || "");
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching lead:', error);
        setLoading(false);
      });
  }, [leadId]);

  // Handle click outside to close editing dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close status dropdown if clicking outside
      if (editingStatusId &&
        !event.target.closest('.status-dropdown') &&
        !event.target.closest('[data-status-button]')) {
        console.log('Clicking outside status dropdown, closing');
        setEditingStatusId(null);
      }

      // Close follow-up editing if clicking outside
      if (editingFollowUpId &&
        !event.target.closest('.followup-edit-form') &&
        !event.target.closest('[data-followup-edit-button]')) {
        console.log('Clicking outside follow-up edit form, closing');
        setEditingFollowUpId(null);
        setEditingFollowUpDate("");
        setEditingFollowUpTime("");
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [editingStatusId, editingFollowUpId]);

  // Fetch available users for assignment dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true);
      try {
        const response = await fetch(`${USERS_API}/`, {
          headers: getAuthHeaders()
        });
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        if (response.ok) {
          const users = await response.json();
          setAvailableUsers(Array.isArray(users) ? users : []);
        } else {
          console.error('Failed to fetch users:', response.status);
          setAvailableUsers([]);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        setAvailableUsers([]);
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Check edit permissions on component load
  useEffect(() => {
    checkEditPermissions();
  }, []);

  // Check permissions on component load
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const accessData = await checkUserAccess();
        setIsTopLevelUser(accessData.is_top_level);
        setIsManagerUser(accessData.has_subordinates);

        // Handle assigned field for non-managers
        const leadAssigned = resolveAssigned(lead);
        if (!accessData.has_subordinates && !leadAssigned) {
          setAssigned(getCurrentUserId() || "");
        }
      } catch (error) {
        console.error('Error loading permissions:', error);
        setIsTopLevelUser(false);
        setIsManagerUser(false);
      }
    };

    loadPermissions();
  }, []);

  // Resolve user names when lead data changes
  useEffect(() => {
    if (lead) {
      const userIds = [
        lead.assigned_to,
        lead.assigned_by,
        lead.owner,
        ...(leadNotes.map(note => note.created_by_user_id || note.created_by).filter(Boolean)),
        ...(leadFollowUps.map(fu => fu.assigned_to).filter(Boolean)),
        ...(leadActivities.map(act => act.created_by).filter(Boolean))
      ].filter(Boolean);

      const uniqueUserIds = [...new Set(userIds)];

      Promise.all(
        uniqueUserIds.map(async (userId) => {
          if (!resolvedUserNames[userId]) {
            const name = await resolveUserName(userId);
            return { userId, name };
          }
          return null;
        }).filter(Boolean)
      ).then(results => {
        const newNames = {};
        results.forEach(result => {
          if (result) {
            newNames[result.userId] = result.name;
          }
        });
        setResolvedUserNames(prev => ({ ...prev, ...newNames }));
      });
    }
  }, [lead, leadNotes, leadFollowUps, leadActivities]);

  // Fetch followups for this lead
  useEffect(() => {
    async function fetchLeadFollowups() {
      try {
        const res = await fetch(`${FOLLOWUPS_API}/lead/${leadId}`, {
          headers: getAuthHeaders()
        });
        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }
        const data = await res.json();
        setLeadFollowUps(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Error fetching followups:", e);
        setLeadFollowUps([]);
      }
    }
    fetchLeadFollowups();
  }, [leadId]);

  // Fetch activities for this lead
  useEffect(() => {
    if (activeTab === "Activity") {
      setActivitiesLoading(true);
      // Use the lead's lead_id to match activities
      const currentLeadId = lead?.lead_id || leadId;

      console.log('=== FETCHING ACTIVITIES ===');
      console.log('Current Lead Info:', {
        currentLeadId,
        leadObject: {
          _id: lead?._id,
          lead_id: lead?.lead_id,
          id: lead?.id
        },
        apiUrl: ACTIVITIES_API
      });

      fetch(`${ACTIVITIES_API}`, {
        headers: getAuthHeaders()
      })
        .then(res => {
          if (res.status === 401) {
            handleUnauthorized();
            return;
          }
          if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
          }
          return res.json();
        })
        .then(response => {
          if (!response) return; // Exit if we handled 401

          // Backend returns { data: [...], page, limit, total, pages }
          const allActivities = response.data || response || [];

          console.log('=== ALL ACTIVITIES RECEIVED ===');
          console.log('Total activities from API:', allActivities.length);
          console.log('Sample activities (first 3):', allActivities.slice(0, 3).map(act => ({
            id: act._id,
            lead_id: act.lead_id,
            type: act.action || act.activity_type,
            created_at: act.created_at
          })));

          // Filter activities to show only those matching this lead
          const filteredActivities = Array.isArray(allActivities)
            ? allActivities.filter(activity => {
              const belongs = isActivityForCurrentLead(activity, currentLeadId, lead);
              return belongs;
            })
            : [];

          console.log('=== ACTIVITY FILTERING RESULTS ===');
          console.log(`✅ Matched ${filteredActivities.length} activities for lead ${currentLeadId}`);
          console.log('Matched activities:', filteredActivities.map(act => ({
            activityId: act._id,
            leadId: act.lead_id,
            type: act.action || act.activity_type,
            description: act.description || act.details
          })));

          // Sort activities by date (newest first)
          const sortedActivities = filteredActivities.sort((a, b) => {
            const dateA = new Date(a.created_at || a.timestamp || 0);
            const dateB = new Date(b.created_at || b.timestamp || 0);
            return dateB - dateA;
          });

          setLeadActivities(sortedActivities);
        })
        .catch(err => {
          console.error("❌ Error fetching activities:", err.message);
          setLeadActivities([]);
        })
        .finally(() => setActivitiesLoading(false));
    }
  }, [activeTab, leadId, lead]);

  // Fetch notes for this lead (from /api/lead/lead-notes/{lead_id})
  useEffect(() => {
    if (activeTab === "Notes") {
      setNotesLoading(true);
      fetch(`${NOTES_API}/${leadId}`, {
        headers: getAuthHeaders()
      })
        .then(res => {
          if (res.status === 401) {
            handleUnauthorized();
            return;
          }
          if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
          }
          return res.json();
        })
        .then(response => {
          if (!response) return; // Exit if we handled 401

          // The backend returns { lead_id, notes: [...] }
          const notesArr = response.notes || [];
          setLeadNotes(Array.isArray(notesArr) ? notesArr : []);
        })
        .catch(err => {
          console.error("Error fetching notes:", err.message);
          setLeadNotes([]);
        })
        .finally(() => setNotesLoading(false));
    }
  }, [activeTab, leadId, addNoteLoading]);


  // Add/overwrite follow_up_notes for this lead
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    // Check if user is authenticated
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (!token) {
      console.log('Available localStorage keys:', Object.keys(localStorage));
      setAddNoteError("Please log in again. No authentication token found.");
      return;
    }

    setAddNoteLoading(true);
    setAddNoteError("");
    try {
      // Post new note using the notes API
      const res = await fetch(NOTES_API, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          lead_id: lead?.lead_id || leadId,
          content: newNote.trim()
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to add note");
      }

      // Create activity for note addition
      await createNoteActivity(newNote.trim());

      setNewNote("");
      // Refresh notes list
      const notesRes = await fetch(`${NOTES_API}/${leadId}`, {
        headers: getAuthHeaders()
      });
      const notesData = await notesRes.json();
      const notesArr = notesData.notes || [];
      setLeadNotes(Array.isArray(notesArr) ? notesArr : []);
      setSaveMessage("Note added successfully!");
      setModalOpen(true);
    } catch (err) {
      console.error("Error adding note:", err.message);
      setAddNoteError(`Failed to add note: ${err.message}`);
    } finally {
      setAddNoteLoading(false);
    }
  };

  // Add new follow-up
  const handleAddFollowUp = async (e) => {
    e.preventDefault();
    if (!newFollowUpNotes.trim()) return;

    // Check if user is authenticated
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (!token) {
      console.log('Available localStorage keys:', Object.keys(localStorage));
      setAddFollowUpError("Please log in again. No authentication token found.");
      return;
    }

    setAddFollowUpLoading(true);
    setAddFollowUpError("");
    try {
      // Get current user info for proper activity tracking
      const currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
      const userId = currentUser?.user_id || currentUser?.id || null;
      const userName = currentUser?.full_name || currentUser?.name || currentUser?.username || 'User';

      // Ensure we have a valid assigned_to value
      const assignedTo = userId || userName || 'system';

      // Get current timestamp in IST for tracking changes
      const currentTimestamp = getCurrentISTTimestamp();

      // Validate form data before sending
      if (!lead?.lead_id && !leadId) {
        throw new Error("Lead ID is required");
      }
      if (!newFollowUpType) {
        throw new Error("Follow-up type is required");
      }
      if (!newFollowUpStatus) {
        throw new Error("Follow-up status is required");
      }
      if (!newFollowUpNotes.trim()) {
        throw new Error("Follow-up notes are required");
      }
      if (!newFollowUpDate) {
        throw new Error("Follow-up date is required");
      }
      if (!newFollowUpTime) {
        throw new Error("Follow-up time is required");
      }
      if (!assignedTo) {
        throw new Error("Assigned to field is required");
      }
      if (!userName) {
        throw new Error("Created by field is required");
      }

      // Combine date and time into IST datetime
      const scheduledDateTime = createISTDateTime(newFollowUpDate, newFollowUpTime);

      // Post new follow-up using the followups API
      const res = await fetch(FOLLOWUPS_API, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          lead_id: lead?.lead_id || leadId,
          type: newFollowUpType,
          status: newFollowUpStatus,
          scheduled_date: scheduledDateTime, // Use the combined date and time
          remarks: newFollowUpNotes.trim(),
          assigned_to: assignedTo,
          created_by_name: userName, // Add this for proper activity tracking
          customer_name: resolveName(lead) || lead?.name || '',
          customer_phone: resolvePhone(lead) || lead?.phone || '',
          sent: false
          // Note: created_at and updated_at are handled by the backend automatically
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: "Unknown error" }));
        console.error('Follow-up creation failed:', {
          status: res.status,
          statusText: res.statusText,
          errorData,
          requestData: {
            lead_id: lead?.lead_id || leadId,
            type: newFollowUpType,
            status: newFollowUpStatus,
            scheduled_date: scheduledDateTime,
            remarks: newFollowUpNotes.trim(),
            assigned_to: assignedTo,
            created_by_name: userName,
            customer_name: resolveName(lead) || lead?.name || '',
            customer_phone: resolvePhone(lead) || lead?.phone || '',
            sent: false
          }
        });
        throw new Error(errorData.detail || `HTTP ${res.status}: ${res.statusText}`);
      }

      const followUpResult = await res.json();

      // Create activity for follow-up creation
      await createFollowUpActivity({
        id: followUpResult.id || followUpResult._id,
        type: newFollowUpType,
        status: newFollowUpStatus,
        scheduled_date: scheduledDateTime,
        remarks: newFollowUpNotes.trim(),
        customer_name: resolveName(lead) || lead?.name || '',
        customer_phone: resolvePhone(lead) || lead?.phone || '',
        sent: false
      }, "followup_created");

      // Update the lead's follow_up_updated_at timestamp
      const timestampResult = await updateLeadFollowUpTimestamp(currentTimestamp);

      // Clear form
      setNewFollowUpType("call");
      setNewFollowUpStatus("pending");
      setNewFollowUpNotes("");

      // Reset date and time to defaults using IST
      setNewFollowUpDate(getISTDateForInput());
      setNewFollowUpTime("10:00");

      // Refresh follow-ups list and lead data
      await Promise.all([
        refreshFollowUpsList(),
        refreshLeadData()
      ]);

      setSaveMessage(`Follow-up added successfully at ${formatDateTime(timestampResult.timestamp)}`);
      setModalOpen(true);
    } catch (err) {
      console.error("Error adding follow-up:", err.message);
      setAddFollowUpError(`Failed to add follow-up: ${err.message}`);
    } finally {
      setAddFollowUpLoading(false);
    }
  };

  // Update follow-up status
  const handleUpdateFollowUpStatus = async (followupId, newStatus) => {
    setUpdatingFollowUpId(followupId);
    try {
      const currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
      const userName = currentUser?.full_name || currentUser?.name || 'User';
      const currentTimestamp = getCurrentISTTimestamp();

      // Find the current follow-up for activity creation
      const currentFollowUp = leadFollowUps.find(f => (f.id || f._id) === followupId);
      const oldStatus = currentFollowUp?.status || 'pending';

      const res = await fetch(`${FOLLOWUPS_API}/${followupId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: newStatus,
          updated_by: userName,
          updated_at: currentTimestamp
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to update follow-up");
      }

      // Create activity for follow-up status update in the requested format
      await createFollowUpStatusActivity(oldStatus, newStatus);

      // Update the lead's follow_up_updated_at timestamp
      const timestampResult = await updateLeadFollowUpTimestamp(currentTimestamp);

      // Refresh follow-ups list and lead data
      await Promise.all([
        refreshFollowUpsList(),
        refreshLeadData()
      ]);

      // Close the editing dropdown
      setEditingStatusId(null);

      setSaveMessage(`Follow-up status updated successfully at ${formatDateTime(new Date().toISOString())}`);
      setModalOpen(true);
    } catch (err) {
      console.error("Error updating follow-up status:", err.message);
      setSaveMessage(`Failed to update follow-up: ${err.message}`);
      setModalOpen(false);
    } finally {
      setUpdatingFollowUpId(null);
    }
  };

  // Update follow-up date and time
  const handleUpdateFollowUpDateTime = async (followupId, newDate, newTime) => {
    setUpdatingFollowUpId(followupId);
    try {
      const currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
      const userName = currentUser?.full_name || currentUser?.name || 'User';
      const currentTimestamp = getCurrentISTTimestamp();

      // Find the current follow-up for activity creation
      const currentFollowUp = leadFollowUps.find(f => (f.id || f._id) === followupId);
      const oldDate = currentFollowUp?.scheduled_date || '';

      // Create new IST datetime from date and time inputs
      const newScheduledDateTime = createISTDateTime(newDate, newTime);

      const res = await fetch(`${FOLLOWUPS_API}/${followupId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          scheduled_date: newScheduledDateTime,
          updated_by: userName,
          updated_at: currentTimestamp
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to update follow-up");
      }

      // Create activity for follow-up date/time update
      await createFollowUpDateTimeActivity(oldDate, newScheduledDateTime);

      // Update the lead's follow_up_updated_at timestamp
      const timestampResult = await updateLeadFollowUpTimestamp(currentTimestamp);

      // Refresh follow-ups list and lead data
      await Promise.all([
        refreshFollowUpsList(),
        refreshLeadData()
      ]);

      // Close the editing form
      setEditingFollowUpId(null);
      setEditingFollowUpDate("");
      setEditingFollowUpTime("");

      setSaveMessage(`Follow-up date/time updated successfully at ${formatDateTime(timestampResult.timestamp)}`);
      setModalOpen(true);
    } catch (err) {
      console.error("Error updating follow-up date/time:", err.message);
      setSaveMessage(`Failed to update follow-up: ${err.message}`);
      setModalOpen(false);
    } finally {
      setUpdatingFollowUpId(null);
    }
  };

  // Create activity for follow-up status change in the requested format
  const createFollowUpStatusActivity = async (oldStatus, newStatus) => {
    try {
      const currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
      const createdBy = currentUser?.user_id || currentUser?.id || 'system';

      const activityData = {
        lead_id: lead.lead_id || leadId,
        activity_type: "lead_updated",
        description: `Lead updated: status: '${oldStatus}' → '${newStatus}'`,
        created_at: getCurrentISTTimestamp(),
        created_by: createdBy,
        metadata: {
          old_status: oldStatus,
          new_status: newStatus
        }
      };

      console.log('Creating follow-up status activity:', activityData);

      const response = await fetch(ACTIVITIES_API, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(activityData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create activity:', errorData);
        return null;
      }

      const result = await response.json();
      console.log('Follow-up status activity created successfully:', result);
      return result;

    } catch (error) {
      console.error('Error creating follow-up status activity:', error);
      return null;
    }
  };

  // Create activity for follow-up date/time change
  const createFollowUpDateTimeActivity = async (oldDateTime, newDateTime) => {
    try {
      const currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
      const createdBy = currentUser?.user_id || currentUser?.id || 'system';

      const activityData = {
        lead_id: lead.lead_id || leadId,
        activity_type: "lead_updated",
        description: `Follow-up rescheduled: '${formatDateTime(oldDateTime)}' → '${formatDateTime(newDateTime)}'`,
        created_at: getCurrentISTTimestamp(),
        created_by: createdBy,
        metadata: {
          old_scheduled_date: oldDateTime,
          new_scheduled_date: newDateTime
        }
      };

      console.log('Creating follow-up date/time activity:', activityData);

      const response = await fetch(ACTIVITIES_API, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(activityData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create activity:', errorData);
        return null;
      }

      const result = await response.json();
      console.log('Follow-up date/time activity created successfully:', result);
      return result;

    } catch (error) {
      console.error('Error creating follow-up date/time activity:', error);
      return null;
    }
  };


  // Generic function for any follow-up operation that needs timestamp update
  const performFollowUpOperation = async (operation, operationName = "follow-up operation") => {
    try {
      const currentTimestamp = getCurrentISTTimestamp();

      // Perform the operation
      const result = await operation();

      // Always update the follow-up timestamp after any follow-up operation
      const timestampResult = await updateLeadFollowUpTimestamp(currentTimestamp);

      // Refresh both follow-ups list and lead data
      await Promise.all([
        refreshFollowUpsList(),
        refreshLeadData()
      ]);

      return {
        success: true,
        timestamp: timestampResult.timestamp,
        result
      };
    } catch (error) {
      console.error(`Error in ${operationName}:`, error);
      throw error;
    }
  };

  // Save admin actions
  const assignLead = async () => {
    const response = await fetch(`https://cubehis.avopay.pro:5000/api/lead/assign`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        lead_id: lead.lead_id || leadId,
        assigned_to: assigned,
        assigned_by: "admin_user",
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Failed to assign");
    return data;
  };
  const updateLead = async () => {
    const currentTimestamp = getCurrentISTTimestamp();
    const followUpChanged = hasFollowUpChanged();

    const response = await fetch(`${API_BASE}/${lead.lead_id || leadId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        status,
        notes,
        follow_up_notes: followUpNotes,
        name: resolveName(lead),
        phone: resolvePhone(lead),
        location: resolveLocation(lead),
        district: resolveDistrict(lead),
        alternate_phone: resolveAlternatePhone(lead),
        product: lead?.product || "",
        assigned_to: isManagerUser ? assigned : (getCurrentUserId() || assigned),
        updated_at: currentTimestamp,
        follow_up_updated_at: followUpChanged ? currentTimestamp : lead.follow_up_updated_at
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Failed to update lead");
    return data;
  };
  const handleSave = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (isManagerUser && !notes.trim()) {
      setSaveMessage("General notes are required and cannot be empty");
      setModalOpen(false);
      return;
    }

    if (!resolveLocation(lead).trim()) {
      setSaveMessage("Location is required and cannot be empty");
      setModalOpen(false);
      return;
    }

    if (!lead?.product || lead.product.trim() === "") {
      setSaveMessage("Product Type is required and must be selected");
      setModalOpen(false);
      return;
    }

    setSaving(true);
    setSaveMessage("");
    try {
      // Store old lead data for activity creation
      const oldLeadData = {
        status: resolveStatus(lead),
        notes: resolveNotes(lead),
        follow_up_notes: lead.follow_up_notes,
        product: lead?.product || ""
      };

      // Get current timestamp for saving in IST
      const currentTimestamp = getCurrentISTTimestamp();
      const followUpChanged = hasFollowUpChanged();

      await assignLead();
      await updateLead();

      // Update follow-up timestamp if follow-up data changed
      let timestampToShow = currentTimestamp;
      if (followUpChanged) {
        const timestampResult = await updateLeadFollowUpTimestamp(currentTimestamp);
        timestampToShow = timestampResult.timestamp;
      }

      // Re-fetch lead data to ensure UI is in sync with the updated timestamps
      const updatedLead = await refreshLeadData();
      if (!updatedLead) {
        throw new Error("Failed to fetch updated lead data");
      }

      // Create activity for the lead update with new lead data
      const newLeadData = {
        status: status,
        notes: notes,
        follow_up_notes: followUpNotes,
        product: lead?.product || ""
      };

      await createLeadActivity(oldLeadData, newLeadData);

      // Update form state with fresh data
      setStatus(resolveStatus(updatedLead));
      setAssigned(resolveAssigned(updatedLead) || "");
      setNotes(resolveNotes(updatedLead));
      setFollowUpNotes(updatedLead.follow_up_notes || "");

      // Update original values for future change detection
      setOriginalFollowUpNotes(updatedLead.follow_up_notes || "");

      // Show success message with appropriate timestamp
      const displayTimestamp = followUpChanged && updatedLead.follow_up_updated_at ?
        updatedLead.follow_up_updated_at :
        (updatedLead.updated_at || timestampToShow);

      setSaveMessage(`Lead updated successfully at ${formatDateTime(displayTimestamp)} ${followUpChanged ? ' (Follow-up updated)' : ''}`);
      setModalOpen(true);
    } catch (err) {
      setSaveMessage(`Failed to update lead: ${err.message}`);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!lead) return <div className="p-8 text-center">Lead not found.</div>;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Sidebar */}
      <aside className="bg-gradient-to-b from-white to-gray-100 w-full lg:w-80 xl:w-96 px-4 sm:px-6 py-6 sm:py-8 border-r border-gray-200 shadow-sm flex-shrink-0">
        <button
          className="mb-4 sm:mb-6 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-800 font-medium shadow-sm w-full text-sm sm:text-base"
          onClick={() => navigate(-1)}
        >
          ← Back to Leads
        </button>

        {/* Profile Card */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full ring-2 ring-blue-400 overflow-hidden shadow mb-3 bg-blue-100 flex items-center justify-center text-2xl sm:text-3xl font-bold text-blue-600">
            {lead.avatar_url ? (
              <img
                src={lead.avatar_url}
                alt="avatar"
                className="object-cover w-full h-full"
              />
            ) : (
              (resolveName(lead)[0] || "?")
            )}
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 text-center leading-tight">
            {resolveName(lead)}
          </h2>
          <span className="text-xs text-gray-500 break-all"><strong>ID: {lead.lead_id || lead._id || ""} </strong></span>
        </div>
        {/* Details Section */}
        <section className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-gray-700">
          <div>
            <h3 className="font-medium text-gray-600 mb-1 text-xs sm:text-sm">Contact Info</h3>
            <ul className="space-y-1">
              <li className="break-all">
                <strong>Contact:</strong>{" "}
                <a href={`tel:${resolvePhone(lead)}`} className="text-blue-600 hover:underline">
                  {resolvePhone(lead)}
                </a>
              </li>
              {resolveAlternatePhone(lead) !== "" && (
                <li className="break-all">
                  <strong>Alternate Contact:</strong>{" "}
                  <a href={`tel:${resolveAlternatePhone(lead)}`} className="text-blue-600 hover:underline">
                    {resolveAlternatePhone(lead)}
                  </a>
                </li>
              )}
              <li className="break-all">
                <strong>Email:</strong>{""}
                <a href={`mailto:${resolveEmail(lead)}`} className="text-blue-600 hover:underline">
                  {resolveEmail(lead)}
                </a>
              </li>
              <li className="break-all">
                <strong>Address:</strong> {resolveLocation(lead)}
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-600 mb-1 text-xs sm:text-sm">Lead Info</h3>
            <ul className="space-y-1">
              <li>
                <strong>Status:</strong>{" "}
                <span
                  className={`font-medium ${resolveStatus(lead)?.toLowerCase() === "converted"
                    ? "text-green-600"
                    : resolveStatus(lead)?.toLowerCase() === "lost"
                      ? "text-red-600"
                      : "text-yellow-600"
                    }`}
                >
                  {resolveStatus(lead)}
                </span>
              </li>
              <li><strong>Source:</strong> <span className="break-all">{resolveSource(lead)}</span></li>
              <li><strong>Product:</strong> <span className="break-all">{lead?.product || "Not specified"}</span></li>
              <li><strong>Created:</strong> {formatDate(resolveCreatedAt(lead))}</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-600 mb-1 text-xs sm:text-sm">Assigned</h3>
            <div className="break-all">{getAssignedUserDisplayName(resolveAssigned(lead)) || <span className="text-gray-400">Unassigned</span>}</div>
          </div>
          {/* {lead.follow_up_updated_at && (
            <div>
              <h3 className="font-medium text-gray-600 mb-1 text-xs sm:text-sm">Last Updated</h3>
              <div className="text-xs text-blue-600">
                {formatDateTime(lead.follow_up_updated_at)}
              
              </div>
            </div>
          )} */}
        </section>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-3 sm:px-4 md:px-6 lg:px-8 py-4 gap-4 min-w-0">
        {/* Tabs */}
        <div className="flex gap-1 sm:gap-2 mt-2 mb-6 sm:mb-8 overflow-x-auto">
          <div className="flex gap-1 sm:gap-2 min-w-max">
            {[
              "Lead Details",
              "Follow Up",
              "Notes",
              "Activity",
            ].map((tab) => (
              <button
                key={tab}
                className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap ${activeTab === tab
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-blue-50"
                  }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>




        {/* Notes Tab (shows all notes for this lead, only supports overwrite) */}
        {activeTab === "Notes" && (
          <section className={`${sectionCard} w-full max-w-2xl mx-auto`}>
            <h3 className="font-semibold text-lg mb-3">Notes</h3>
            <form onSubmit={handleAddNote} className="mb-4 flex flex-col sm:flex-row gap-2">
              <textarea
                className="w-full border rounded p-2"
                rows={2}
                placeholder="Add or overwrite note (will replace previous)"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                disabled={addNoteLoading}
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
                disabled={addNoteLoading || !newNote.trim()}
              >
                {addNoteLoading ? "Saving..." : "Save Note"}
              </button>
            </form>
            {addNoteError && (
              <div className="text-red-600 mb-2">{addNoteError}</div>
            )}
            {notesLoading ? (
              <div>Loading notes...</div>
            ) : (
              <ul className="space-y-2">
                {leadNotes.length === 0 && <li className="text-gray-500">No notes found for this lead.</li>}
                {leadNotes.map((note, idx) => (
                  <li
                    key={note._id || idx}
                    className="bg-gray-100 rounded p-3 flex flex-col gap-1"
                  >
                    <div className="text-gray-800">{note.content}</div>
                    <div className="text-xs text-gray-500">
                      <span>By: {note.created_by || getDisplayName(note.created_by_user_id || note.created_by)}</span>
                      {note.created_at && <span>, {formatDateTime(note.created_at)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {activeTab === "Lead Details" && (
          <section className={`${sectionCard} w-full max-w-2xl mx-auto`}>
            <h3 className="text-2xl font-bold text-indigo-800 mb-4 flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-gradient-to-tr from-blue-400 to-green-400"></span>
              Edit Lead Details
            </h3>
            <form className="space-y-5" onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold">Name</label>
                  <input
                    className="mt-1 w-full border rounded p-2 bg-white"
                    value={resolveName(lead)}
                    onChange={e => setLead({ ...lead, name: e.target.value, raw_data: { ...(lead.raw_data || {}), Name: e.target.value } })}
                    disabled={saving || !isTopLevelUser}
                    readOnly={!isTopLevelUser}
                    placeholder={!isTopLevelUser ? "Name editing restricted to top-level roles" : "Enter name"}
                    title={!isTopLevelUser ? "You need top-level permissions to edit name" : ""}
                  />
                  {!isTopLevelUser}
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold">Status</label>
                  <select
                    className="mt-1 w-full border rounded p-2 bg-white"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    disabled={saving}
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
                  <label className="block text-gray-700 font-semibold">
                    Assigned To
                    {!isManagerUser}
                  </label>
                  {isManagerUser ? (
                    <select
                      className="mt-1 w-full border rounded p-2 bg-white"
                      value={assigned}
                      onChange={e => setAssigned(e.target.value)}
                      disabled={saving || usersLoading}
                      title="Select a user to assign this lead to"
                    >
                      <option value="">-- Select User --</option>
                      {availableUsers.map(user => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.full_name || user.username} {user.role_name ? `- ${user.role_name}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="mt-1 w-full border rounded p-2 bg-gray-100"
                      value={getCurrentUserName()}
                      readOnly
                      title="Assignment restricted to managers - automatically assigned to you"
                    />
                  )}
                  {isManagerUser ? (
                    <>
                      {usersLoading && (
                        <div className="text-xs text-gray-500 mt-1">Loading users...</div>
                      )}
                    </>
                  ) : (
                    <div className="text-amber-600 text-xs mt-1 flex items-center gap-1">
                      {/* Automatically assigned to you - Contact Manager to reassign */}
                    </div>
                  )}
                  {permissionsLoading && (
                    <div className="text-xs text-blue-500 mt-1">Checking permissions...</div>
                  )}
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold">Updated At</label>
                  <input
                    readOnly
                    className="mt-1 w-full border rounded p-2 bg-gray-100"
                    value={lead.updated_at ? formatDateTime(lead.updated_at) : formatDateTime(resolveCreatedAt(lead))}
                    title={`Last modified: ${lead.updated_at ? formatDateTime(lead.updated_at) : formatDateTime(resolveCreatedAt(lead))}`}
                  />

                </div>
                <div>
                  <label className="block text-gray-700 font-semibold">Email</label>
                  <input
                    readOnly={!isTopLevelUser}
                    className={`mt-1 w-full border rounded p-2 ${!isTopLevelUser ? 'bg-gray-100' : 'bg-white'}`}
                    value={resolveEmail(lead)}
                    onChange={isTopLevelUser ? (e => setLead({ ...lead, email: e.target.value, raw_data: { ...(lead.raw_data || {}), email: e.target.value } })) : undefined}
                    disabled={saving || !isTopLevelUser}
                    placeholder={!isTopLevelUser ? "Email editing restricted to top-level roles" : "Enter email"}
                    title={!isTopLevelUser ? "You need top-level permissions to edit email" : ""}
                  />
                  {!isTopLevelUser}
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold">Phone</label>
                  <input
                    type="tel"
                    className={`mt-1 w-full border rounded p-2 ${!hasEditPermissions
                        ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
                        : 'bg-white'
                      } ${resolvePhone(lead) && !validateIndianPhone(resolvePhone(lead))
                        ? 'border-red-500 bg-red-50'
                        : !hasEditPermissions
                          ? 'border-gray-300'
                          : 'border-gray-300'
                      }`}
                    value={resolvePhone(lead)}
                    onChange={e => handlePhoneChange(e.target.value, 'phone', setLead, lead)}
                    disabled={saving || !isTopLevelUser}
                    placeholder={!isTopLevelUser ? "Phone editing restricted to top-level roles" : "Enter phone number (+919876543210 or 9876543210)"}
                    maxLength={13}
                    title={!isTopLevelUser ? "You need top-level permissions to edit phone numbers" : "Please enter a valid Indian mobile number (+919876543210, 919876543210, or 9876543210)"}
                    readOnly={!isTopLevelUser}
                  />
                  {!isTopLevelUser}
                  {resolvePhone(lead) && !validateIndianPhone(resolvePhone(lead)) && isTopLevelUser && (
                    <p className="text-red-500 text-xs mt-1">
                      Please enter a valid Indian mobile number (+919876543210, 919876543210, or 9876543210)
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold">Alternate Phone</label>
                  <input
                    type="tel"
                    className={`mt-1 w-full border rounded p-2 bg-white ${resolveAlternatePhone(lead) && !validateIndianPhone(resolveAlternatePhone(lead))
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-300'
                      }`}
                    value={resolveAlternatePhone(lead)}
                    onChange={e => handlePhoneChange(e.target.value, 'alternate_phone', setLead, lead)}
                    disabled={saving}
                    placeholder="Enter phone number (+919876543210 or 9876543210) - optional"
                    maxLength={13}
                    title="Please enter a valid Indian mobile number (+919876543210, 919876543210, or 9876543210)"
                  />
                  {resolveAlternatePhone(lead) && !validateIndianPhone(resolveAlternatePhone(lead)) && (
                    <p className="text-red-500 text-xs mt-1">
                      Please enter a valid Indian mobile number (+919876543210, 919876543210, or 9876543210)
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold">District <span className="text-red-500">*</span></label>
                  <Select
                    className="mt-1"
                    value={indianDistricts.find(district => district.value === resolveDistrict(lead)) || null}
                    onChange={selectedOption => {
                      const districtValue = selectedOption ? selectedOption.value : '';
                      setLead({
                        ...lead,
                        district: districtValue,
                        raw_data: {
                          ...(lead.raw_data || {}),
                          District: districtValue
                        }
                      });
                    }}
                    options={indianDistricts}
                    isDisabled={saving || districtsLoading}
                    isLoading={districtsLoading}
                    placeholder={districtsLoading ? "Loading districts..." : "Select district..."}
                    isSearchable={true}
                    isClearable={true}
                    noOptionsMessage={() => districtsLoading ? "Loading districts..." : "No districts found"}
                    loadingMessage={() => "Loading districts..."}
                    filterOption={(option, inputValue) => {
                      if (!inputValue) return true;
                      const searchTerm = inputValue.toLowerCase();
                      const districtName = option.label.split(' (')[0].toLowerCase();

                      // Only show options that start with the typed characters
                      return districtName.startsWith(searchTerm);
                    }}
                    styles={{
                      control: (provided, state) => ({
                        ...provided,
                        borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
                        boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
                        '&:hover': {
                          borderColor: '#9ca3af'
                        }
                      }),
                      option: (provided, state) => ({
                        ...provided,
                        backgroundColor: state.isSelected
                          ? '#3b82f6'
                          : state.isFocused
                            ? '#eff6ff'
                            : provided.backgroundColor,
                        color: state.isSelected ? '#fff' : provided.color
                      }),
                      placeholder: (provided) => ({
                        ...provided,
                        color: districtsLoading ? '#9ca3af' : '#6b7280'
                      })
                    }}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold">
                    Location
                    {!isTopLevelUser}
                  </label>
                  <input
                    type="text"
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 ${!isTopLevelUser ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                      }`}
                    value={resolveLocation(lead)}
                    onChange={e => {
                      const locationValue = e.target.value;
                      setLead({
                        ...lead,
                        location: locationValue,
                        raw_data: {
                          ...(lead.raw_data || {}),
                          Location: locationValue
                        }
                      });
                    }}
                    disabled={saving || !isTopLevelUser}
                    readOnly={!isTopLevelUser}
                    placeholder={!isTopLevelUser ? "Location editing restricted to top-level users" : "Enter location details"}
                    title={!isTopLevelUser ? "You need top-level permissions to edit location" : "Enter location details"}
                  />
                  {!isTopLevelUser && (
                    <p className="text-gray-500 text-xs mt-1">
                      {/* Location editing is restricted to admin, sales_head, director, and company_manager roles */}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold">Source</label>
                  <input
                    readOnly
                    className="mt-1 w-full border rounded p-2 bg-gray-100"
                    value={resolveSource(lead)}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold">Product Type <span className="text-red-500">*</span></label>
                  <select
                    className="mt-1 w-full border rounded p-2 bg-white"
                    value={lead?.product || ""}
                    onChange={e => setLead({ ...lead, product: e.target.value })}
                    disabled={saving}
                    required
                  >
                    <option value="">Select Product *</option>
                    <option value="bpl_franchise">BPL Franchise</option>
                    <option value="petrol/diesel">Petrol/Diesel</option>
                    <option value="petrol/diesel/bio_cng/ev">Petrol/Diesel/Bio CNG/EV</option>
                    <option value="bio_cng">Bio CNG</option>
                    <option value="bepl_franchise">BEPL Franchise</option>
                    <option value="depo">Depo</option>
                    <option value="depo_franchise">Depo Franchise</option>
                  </select>
                  {(!lead?.product || lead.product.trim() === "") && (
                    <p className="text-red-500 text-sm mt-1">Product Type is required</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold">
                  General Notes <span className="text-red-500">*</span>
                  {!isManagerUser}
                </label>
                <textarea
                  className={`mt-1 w-full border rounded p-2 min-h-[80px] ${!isManagerUser ? 'bg-gray-100' : 'bg-white'}`}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={!isManagerUser ? "General notes editing restricted to managers" : "General notes are required for this lead"}
                  disabled={saving || !isManagerUser}
                  readOnly={!isManagerUser}
                  required={isManagerUser}
                  title={!isManagerUser ? "You need manager permissions to edit general notes" : ""}
                />
                {!isManagerUser}
                {isManagerUser && !notes.trim() && (
                  <p className="text-red-500 text-sm mt-1">General notes are required</p>
                )}
              </div>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold px-5 py-2 rounded-lg shadow transition"
                disabled={saving || !notes.trim() || !resolveLocation(lead).trim() || !lead?.product || lead.product.trim() === ""}
                title={saving ? "Updating lead with current timestamp..." : "Save changes and update timestamp"}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
            {/* Success Modal */}
            <SuccessModal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              message={saveMessage.includes("success") ? saveMessage : "Lead updated successfully!"}
            />
            {saveMessage && (
              <div className={`mt-2 text-sm ${saveMessage.includes("success") ? "text-green-600" : "text-red-600"}`}>
                {saveMessage}
              </div>
            )}
          </section>
        )}

        {activeTab === "Follow Up" && (
          <section className={`${sectionCard} w-full max-w-6xl mx-auto`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-indigo-800 flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-gradient-to-tr from-blue-400 to-green-400"></span>
                Follow Ups
              </h3>
              {lead.follow_up_updated_at && (
                <div className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full">
                  Last updated: {formatDateTime(lead.follow_up_updated_at)}
                </div>
              )}
            </div>
            {leadFollowUps.length === 0 ? (
              <div className="text-gray-400 py-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <div className="text-4xl mb-2">📅</div>
                <p className="text-lg">No follow-ups for this lead.</p>
                <p className="text-sm">Create your first follow-up below</p>
              </div>
            ) : (
              <div className="overflow-x-auto shadow-sm rounded-lg border border-gray-200 mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                    <tr className="text-gray-700 font-semibold text-xs uppercase tracking-wide">
                      <th className="py-4 px-4 text-left">Type</th>
                      <th className="py-4 px-4 text-left">Status</th>
                      <th className="py-4 px-4 text-left">Follow-up Date/Time</th>
                      <th className="py-4 px-4 text-left">Remarks</th>
                      <th className="py-4 px-4 text-left">Created</th>
                      <th className="py-4 px-4 text-left">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leadFollowUps.map(f => (
                      <tr key={f.id || f._id} className="hover:bg-blue-50 transition-colors duration-150">
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                            {f.type || 'call'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {editingStatusId === (f.id || f._id) ? (
                            <div className="relative status-dropdown">
                              <select
                                value={f.status || 'pending'}
                                onChange={(e) => {
                                  console.log('Status changed to:', e.target.value);
                                  if (e.target.value !== f.status) {
                                    handleUpdateFollowUpStatus(f.id || f._id, e.target.value);
                                  }
                                  setEditingStatusId(null);
                                }}
                                onBlur={(e) => {
                                  // Small delay to allow option selection
                                  setTimeout(() => {
                                    console.log('Select blurred, closing dropdown');
                                    setEditingStatusId(null);
                                  }, 150);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                className="px-3 py-1 rounded-full text-xs font-bold uppercase border-2 border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white shadow-lg cursor-pointer min-w-[120px]"
                                autoFocus
                                disabled={updatingFollowUpId === (f.id || f._id)}
                              >
                                <option value="pending">⏳ Pending</option>
                                <option value="completed">✅ Completed</option>
                                <option value="cancelled">❌ Cancelled</option>
                                <option value="rescheduled">🔄 Rescheduled</option>
                              </select>
                            </div>
                          ) : (
                            <button
                              data-status-button="true"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('Status button clicked:', f.id || f._id, 'Current editingStatusId:', editingStatusId);
                                setEditingStatusId(f.id || f._id);
                              }}
                              disabled={updatingFollowUpId === (f.id || f._id)}
                              style={{
                                pointerEvents: 'auto',
                                position: 'relative',
                                zIndex: 10
                              }}
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border-2 border-transparent hover:border-blue-300 ${f.status === 'completed' ? 'bg-green-100 text-green-800 hover:bg-green-200' :
                                  f.status === 'pending' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' :
                                    f.status === 'cancelled' ? 'bg-red-100 text-red-800 hover:bg-red-200' :
                                      f.status === 'rescheduled' ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' :
                                        'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                }`}
                              title="Click to change status"
                            >
                              <span>
                                {updatingFollowUpId === (f.id || f._id) ? 'Updating...' : (
                                  f.status === 'pending' ? '⏳ Pending' :
                                    f.status === 'completed' ? '✅ Completed' :
                                      f.status === 'cancelled' ? '❌ Cancelled' :
                                        f.status === 'rescheduled' ? '🔄 Rescheduled' :
                                          (f.status || 'pending')
                                )}
                              </span>
                              {updatingFollowUpId !== (f.id || f._id) && (
                                <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {editingFollowUpId === (f.id || f._id) ? (
                            <div className="flex flex-col gap-2 followup-edit-form">
                              <input
                                type="date"
                                value={editingFollowUpDate}
                                onChange={(e) => setEditingFollowUpDate(e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <input
                                type="time"
                                value={editingFollowUpTime}
                                onChange={(e) => setEditingFollowUpTime(e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (editingFollowUpDate && editingFollowUpTime) {
                                      handleUpdateFollowUpDateTime(f.id || f._id, editingFollowUpDate, editingFollowUpTime);
                                    }
                                  }}
                                  disabled={!editingFollowUpDate || !editingFollowUpTime || updatingFollowUpId === (f.id || f._id)}
                                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                  {updatingFollowUpId === (f.id || f._id) ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingFollowUpId(null);
                                    setEditingFollowUpDate("");
                                    setEditingFollowUpTime("");
                                  }}
                                  className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              data-followup-edit-button="true"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (f.scheduled_date) {
                                  const date = new Date(f.scheduled_date);
                                  // Convert to IST for editing
                                  const istOffset = 5.5 * 60 * 60 * 1000;
                                  const istTime = new Date(date.getTime() + istOffset - (date.getTimezoneOffset() * 60 * 1000));
                                  const dateStr = istTime.toISOString().split('T')[0];
                                  const timeStr = istTime.toISOString().split('T')[1].substring(0, 5);
                                  setEditingFollowUpDate(dateStr);
                                  setEditingFollowUpTime(timeStr);
                                } else {
                                  setEditingFollowUpDate(getISTDateForInput());
                                  setEditingFollowUpTime("10:00");
                                }
                                setEditingFollowUpId(f.id || f._id);
                              }}
                              disabled={updatingFollowUpId === (f.id || f._id)}
                              className="text-left hover:bg-gray-100 p-1 rounded transition-colors duration-150 w-full group"
                              title="Click to edit date/time"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium group-hover:text-blue-600">
                                  {f.scheduled_date ? formatDateTime(f.scheduled_date) : "No date set"}
                                </span>
                                <span className="text-xs text-gray-400 group-hover:text-blue-400">
                                  Click to edit
                                </span>
                              </div>
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-4 max-w-xs">
                          <div className="truncate text-gray-700" title={f.remarks}>
                            {f.remarks || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-500">
                          {f.created_at ? formatDate(f.created_at) : "-"}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col text-xs text-gray-500">
                            <span>
                              {f.updated_at ? formatDateTime(f.updated_at) :
                                f.created_at ? formatDateTime(f.created_at) : "-"}
                            </span>
                            {/* {(f.updated_at || f.created_at) && (
                              <span className="text-xs text-gray-400">IST</span>
                            )} */}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add Follow-up Form */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">+</span>
                </div>
                <h4 className="text-xl font-bold text-indigo-800">Add New Follow-up</h4>
              </div>
              <form onSubmit={handleAddFollowUp} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                    <select
                      value={newFollowUpType}
                      onChange={(e) => setNewFollowUpType(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                    >
                      <option value="call">📞 Call</option>
                      <option value="email">📧 Email</option>
                      <option value="meeting">🤝 Physical Meeting</option>
                      <option value="site_visit">💻 Online Meeting</option>
                      <option value="other">📋 Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                    <select
                      value={newFollowUpStatus}
                      onChange={(e) => setNewFollowUpStatus(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                    >
                      <option value="pending">⏳ Pending</option>
                      <option value="completed">✅ Completed</option>
                      <option value="cancelled">❌ Cancelled</option>
                      <option value="rescheduled">🔄 Rescheduled</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Follow-up Date <span className="text-red-500">*</span>
                      <span className="text-xs text-gray-500 font-normal ml-2">(IST date)</span>
                    </label>
                    <input
                      type="date"
                      value={newFollowUpDate}
                      onChange={(e) => setNewFollowUpDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Follow-up Time <span className="text-red-500">*</span>
                      <span className="text-xs text-gray-500 font-normal ml-2">(IST time)</span>
                    </label>
                    <input
                      type="time"
                      value={newFollowUpTime}
                      onChange={(e) => setNewFollowUpTime(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={newFollowUpNotes}
                    onChange={(e) => setNewFollowUpNotes(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm resize-none"
                    rows="4"
                    placeholder="Enter detailed follow-up notes and action items..."
                    required
                  />
                </div>
                {addFollowUpError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    <span className="font-medium">Error:</span> {addFollowUpError}
                  </div>
                )}
                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={addFollowUpLoading || !newFollowUpDate || !newFollowUpTime || !newFollowUpNotes.trim()}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 text-white px-8 py-3 rounded-lg text-sm font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {addFollowUpLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Adding...
                      </>
                    ) : (
                      <>
                        <span>+</span>
                        Add Follow-up
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* Activity Tab */}
        {activeTab === "Activity" && (
          <section className={`${sectionCard} w-full max-w-4xl mx-auto`}>

            {activitiesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="text-gray-600 mt-4 text-lg">Loading activities...</p>
                <p className="text-gray-500 text-sm">Fetching activity timeline for this lead</p>
              </div>
            ) : leadActivities.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 opacity-50">📋</div>
                <h4 className="text-xl font-semibold text-gray-700 mb-2">No Activities Yet</h4>
                <p className="text-gray-500 max-w-md mx-auto">
                  Activities will appear here when actions are performed on this lead.
                  Add notes, update status, or create follow-ups to see them tracked here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Activity Summary */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📊</span>
                      <span className="font-semibold text-indigo-800">Activity Summary</span>
                    </div>
                    <div className="text-sm text-indigo-600 font-medium">
                      Total: {leadActivities.length} activities
                    </div>
                  </div>
                </div>

                {/* Activity Timeline */}
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-6 top-8 bottom-0 w-0.5 bg-gradient-to-b from-indigo-200 to-purple-200"></div>

                  <div className="space-y-6">
                    {leadActivities
                      .sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp))
                      .map((activity, i) => (
                        <div key={activity._id || i} className="relative">
                          {/* Timeline dot */}
                          <div className="absolute left-3 top-6 w-6 h-6 rounded-full bg-white border-2 border-indigo-300 flex items-center justify-center shadow-sm z-10">
                            <span className="text-xs">{getActivityIcon(activity)}</span>
                          </div>

                          {/* Activity Card */}
                          <div className="ml-12 group">
                            <div className={`rounded-lg border-l-4 p-4 shadow-sm hover:shadow-md transition-all duration-200 ${getActivityColorTheme(activity)}`}>
                              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  {/* Activity Header */}
                                  <div className="flex items-center gap-3 mb-2">
                                    <h4 className="font-semibold text-lg truncate">
                                      {formatActivityType(activity)}
                                    </h4>

                                  </div>

                                  {/* Activity Description */}
                                  {(activity.details || activity.description) && (
                                    <div className="text-sm mb-3 leading-relaxed">
                                      <p className="text-gray-700">
                                        {activity.details || activity.description}
                                      </p>
                                    </div>
                                  )}

                                  {/* Activity Metadata */}
                                  {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                                    <div className="text-xs bg-white bg-opacity-50 rounded p-2 mb-2">
                                      <strong className="text-gray-700">Additional Details:</strong>
                                      <div className="mt-1 space-y-1">
                                        {Object.entries(activity.metadata).map(([key, value]) => (
                                          <div key={key} className="flex gap-2">
                                            <span className="text-gray-600 font-medium min-w-[80px]">
                                              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                                            </span>
                                            <span className="text-gray-800 break-all">
                                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Legacy Changes Display */}
                                  {activity.changes && (
                                    <div className="text-xs bg-white bg-opacity-50 rounded p-2 mb-2">
                                      <strong className="text-gray-700">Changes:</strong>
                                      <div className="mt-1 text-gray-800 break-all">
                                        {JSON.stringify(activity.changes)}
                                      </div>
                                    </div>
                                  )}

                                  {/* Activity IDs for debugging */}
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {activity.lead_id && (
                                      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                                        Lead: ...{activity.lead_id.slice(-8)}
                                      </span>
                                    )}
                                    {activity._id && (
                                      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">
                                        Activity: ...{activity._id.slice(-8)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Activity Sidebar Info */}
                                <div className="lg:text-right text-sm space-y-1 lg:min-w-[160px]">
                                  <div className="font-medium text-gray-900">
                                    {getDisplayName(activity.created_by || activity.user || activity.user_name) || 'System'}
                                  </div>
                                  <div className="text-gray-600">
                                    {activity.timestamp || activity.created_at ?
                                      formatDateTime(activity.timestamp || activity.created_at) : 'N/A'}
                                  </div>

                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};