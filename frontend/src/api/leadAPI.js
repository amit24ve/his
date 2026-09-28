/**
 * Lead Management API utilities
 * Centralized API calls for lead management with authentication
 */

import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '../utils/authAPI';

// Base URL for lead API
const LEAD_API_BASE = 'https://cubehis.avopay.pro:5000/api/lead';

/**
 * Get duplicate leads count using new endpoint
 * @returns {Promise<Object>} Response with duplicate leads count and data
 */
export const getAllDuplicateLeads = async () => {
  try {
    const url = `${LEAD_API_BASE}/duplicate-leads/all`;
    return await authenticatedGet(url);
  } catch (error) {
    console.error('Error fetching all duplicate leads:', error);
    throw error;
  }
};

/**
 * Get duplicate leads count only
 * @returns {Promise<Object>} Response with duplicate leads count
 */
export const getDuplicateLeadsCount = async () => {
  try {
    // Try first endpoint format
    let url = `${LEAD_API_BASE}/duplicates?page=1&limit=1`;
    return await authenticatedGet(url);
  } catch (error) {
    // Try alternate endpoint format if first one fails
    let url = `${LEAD_API_BASE}/duplicates/?page=1&limit=1`;
    return await authenticatedGet(url);
  }
};

/**
 * Get all leads with pagination and filtering
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @param {string} params.search - Search term
 * @param {string} params.status - Status filter
 * @param {string} params.assigned_to - Assigned to filter
 * @param {string} params.start_date - Start date filter
 * @param {string} params.end_date - End date filter
 * @returns {Promise<Object>} Leads data with pagination info
 */
export const getLeads = async (params = {}) => {
  const queryParams = new URLSearchParams();

  // Add parameters if they exist
  if (params.page) queryParams.append('page', params.page);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.search && params.search.trim()) queryParams.append('search', params.search.trim());
  if (params.status) queryParams.append('status', params.status);
  if (params.assigned_to && params.assigned_to.trim()) queryParams.append('assigned_to', params.assigned_to.trim());
  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);
  if (params.sort_by) queryParams.append('sort_by', params.sort_by);
  if (params.sort_order) queryParams.append('sort_order', params.sort_order);

  const url = `${LEAD_API_BASE}/leads?${queryParams.toString()}`;
  return await authenticatedGet(url);
};

/**
 * Get a specific lead by ID
 * @param {string} leadId - The lead ID
 * @returns {Promise<Object>} Lead data
 */
export const getLeadById = async (leadId) => {
  return await authenticatedGet(`${LEAD_API_BASE}/leads/${leadId}`);
};

/**
 * Create a new lead
 * @param {Object} leadData - Lead data to create
 * @returns {Promise<Object>} Created lead data
 */
export const createLead = async (leadData) => {
  return await authenticatedPost(`${LEAD_API_BASE}/leads`, leadData);
};

/**
 * Update a lead
 * @param {string} leadId - The lead ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated lead data
 */
export const updateLead = async (leadId, updateData) => {
  return await authenticatedPut(`${LEAD_API_BASE}/leads/${leadId}`, updateData);
};

/**
 * Delete a lead
 * @param {string} leadId - The lead ID
 * @returns {Promise<Object>} Delete confirmation
 */
export const deleteLead = async (leadId) => {
  return await authenticatedDelete(`${LEAD_API_BASE}/leads/${leadId}`);
};

/**
 * Assign a lead to a user
 * @param {Object} assignmentData - Assignment data
 * @param {string} assignmentData.lead_id - Lead ID
 * @param {string} assignmentData.assigned_to - User ID to assign to
 * @param {string} assignmentData.assigned_by - User ID who is assigning
 * @returns {Promise<Object>} Assignment result
 */
export const assignLead = async (assignmentData) => {
  return await authenticatedPost(`${LEAD_API_BASE}/assign`, assignmentData);
};

/**
 * Get lead assignments with hierarchy filtering
 * @returns {Promise<Array>} Array of lead assignments
 */
export const getLeadAssignments = async () => {
  return await authenticatedGet(`${LEAD_API_BASE}/assignments`);
};

/**
 * Get lead notes
 * @param {Object} params - Query parameters
 * @param {string} params.lead_id - Lead ID to filter notes
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @returns {Promise<Object>} Notes data with pagination
 */
export const getLeadNotes = async (params = {}) => {
  const queryParams = new URLSearchParams();

  if (params.lead_id) queryParams.append('lead_id', params.lead_id);
  if (params.page) queryParams.append('page', params.page);
  if (params.limit) queryParams.append('limit', params.limit);

  const url = `${LEAD_API_BASE}/notes?${queryParams.toString()}`;
  return await authenticatedGet(url);
};

/**
 * Create a lead note
 * @param {Object} noteData - Note data
 * @returns {Promise<Object>} Created note data
 */
export const createLeadNote = async (noteData) => {
  return await authenticatedPost(`${LEAD_API_BASE}/notes`, noteData);
};

/**
 * Get lead activities
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Activities data
 */
export const getLeadActivities = async (params = {}) => {
  const queryParams = new URLSearchParams();

  if (params.lead_id) queryParams.append('lead_id', params.lead_id);
  if (params.page) queryParams.append('page', params.page);
  if (params.limit) queryParams.append('limit', params.limit);

  const url = `${LEAD_API_BASE}/lead-activities?${queryParams.toString()}`;
  return await authenticatedGet(url);
};

/**
 * Get duplicate leads
 * @returns {Promise<Object>} Duplicate leads data
 */
export const getDuplicateLeads = async () => {
  return await authenticatedGet(`${LEAD_API_BASE}/duplicate-leads`);
};

/**
 * Import leads from Google Sheets
 * @param {Object} importData - Import configuration
 * @returns {Promise<Object>} Import result
 */
export const importFromGoogleSheets = async (importData) => {
  return await authenticatedPost(`${LEAD_API_BASE}/integrations/google-sheets`, importData);
};

/**
 * Get sales users
 * @param {string} role - Optional role filter
 * @returns {Promise<Array>} Array of sales users
 */
export const getSalesUsers = async (role = null) => {
  const url = role
    ? `${LEAD_API_BASE}/users/sales?role=${encodeURIComponent(role)}`
    : `${LEAD_API_BASE}/users/sales`;
  return await authenticatedGet(url);
};
