// API configuration
const API_CONFIG = {
  BASE_URL: 'https://cubehis.avopay.pro:5000',
  API_PREFIX: '/api'
};

// Full API URL
export const API_URL = `${API_CONFIG.BASE_URL}${API_CONFIG.API_PREFIX}`;

// Auth endpoints
export const AUTH_API = {
  LOGIN: `${API_URL}/auth/login`,
  LOGOUT: `${API_URL}/auth/logout`,
  ME: `${API_URL}/auth/me`
};

// Lead endpoints
export const LEAD_API = {
  BASE: `${API_URL}/lead`,
  LEADS: `${API_URL}/lead/leads`,
  ASSIGN: `${API_URL}/lead/assign`,
  NOTES: `${API_URL}/lead/lead-notes`,
  ACTIVITIES: `${API_URL}/lead/lead-activities`
};

// User endpoints
export const USER_API = {
  USERS: `${API_URL}/users`
};

// Role endpoints
export const ROLE_API = {
  ROLES: `${API_URL}/roles`
};

// Followup endpoints
export const FOLLOWUP_API = {
  FOLLOWUPS: `${API_URL}/followups`
};

// Assigned leads endpoints
export const ASSIGNED_LEADS_API = {
  BASE: `${API_URL}/assigned-leads`,
  ASSIGNABLE_USERS: (userId) => `${API_URL}/assigned-leads/assignable-users/${userId}`
};

export default {
  API_URL,
  AUTH_API,
  LEAD_API,
  USER_API,
  ROLE_API,
  FOLLOWUP_API,
  ASSIGNED_LEADS_API
};
