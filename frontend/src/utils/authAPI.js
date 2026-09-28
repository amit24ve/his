/**
 * Authentication API utilities for making authenticated requests
 */

/**
 * Get the JWT token from localStorage (multiple token types like HierarchyAssignment)
 * @returns {string|null} The JWT token or null if not found
 */
export const getAuthToken = () => {
  const accessToken = localStorage.getItem('access_token');
  const token = localStorage.getItem('token');
  const jwtToken = localStorage.getItem('jwt');
  return accessToken || token || jwtToken;
};

/**
 * Get the default headers for authenticated requests (matches HierarchyAssignment pattern)
 * @returns {Object} Headers object with Authorization and Content-Type
 */
export const getAuthHeaders = () => {
  const finalToken = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (finalToken) {
    if (finalToken.startsWith('Bearer ')) {
      headers['Authorization'] = finalToken;
    } else {
      headers['Authorization'] = `Bearer ${finalToken}`;
    }
  }
  
  return headers;
};

/**
 * Make an authenticated fetch request
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options (method, body, etc.)
 * @returns {Promise<Response>} The fetch response
 */
export const authenticatedFetch = async (url, options = {}) => {
  const headers = getAuthHeaders();
  
  // Merge the auth headers with any existing headers
  const mergedOptions = {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  };
  
  const response = await fetch(url, mergedOptions);
  
  // Handle 401 Unauthorized responses
  if (response.status === 401) {
    // Clear all token types and redirect to login
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('jwt');
    // You can add redirect logic here if needed
    console.warn('Authentication failed. Token may be expired.');
    throw new Error('Authentication required. Please log in again.');
  }
  
  return response;
};

/**
 * Make an authenticated GET request and return JSON data
 * @param {string} url - The URL to fetch
 * @returns {Promise<Object>} The JSON response data
 */
export const authenticatedGet = async (url) => {
  const response = await authenticatedFetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

/**
 * Make an authenticated POST request
 * @param {string} url - The URL to fetch
 * @param {Object} data - The data to send in the request body
 * @returns {Promise<Object>} The JSON response data
 */
export const authenticatedPost = async (url, data) => {
  const response = await authenticatedFetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

/**
 * Make an authenticated PUT request
 * @param {string} url - The URL to fetch
 * @param {Object} data - The data to send in the request body
 * @returns {Promise<Object>} The JSON response data
 */
export const authenticatedPut = async (url, data) => {
  const response = await authenticatedFetch(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

/**
 * Make an authenticated DELETE request
 * @param {string} url - The URL to fetch
 * @returns {Promise<Object>} The JSON response data
 */
export const authenticatedDelete = async (url) => {
  const response = await authenticatedFetch(url, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

/**
 * Check if user is authenticated (has a valid token)
 * @returns {boolean} True if user has a token, false otherwise
 */
export const isAuthenticated = () => {
  return !!getAuthToken();
};

/**
 * Get current user data from localStorage (matches HierarchyAssignment pattern)
 * @returns {Object|null} User object or null if not found/invalid
 */
export const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;

    const user = JSON.parse(userStr);
    const userId = user.id || user.user_id;

    if (!userId) return null;

    return {
      user_id: userId,
      id: userId,
      username: user.username || '',
      name: user.full_name || user.name || user.username || 'User',
      email: user.email || '',
      roles: user.roles || []
    };
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};
