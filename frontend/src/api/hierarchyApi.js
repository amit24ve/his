import axios from 'axios';

// Get API URL from environment or use a fallback based on hostname
// For Vite, use import.meta.env instead of process.env
const API_URL = import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'test.soheru.me' ?
    'https://localhost:8004/api' :
    'https://cubehis.avopay.pro:5000/api');

// Debug helper function to check auth status
const checkAuthStatus = () => {
  const token = localStorage.getItem('access_token');
  const user = localStorage.getItem('user');

  console.log('Auth Check:');
  console.log('- Token exists:', !!token);
  if (token) {
    // Show first few characters for debugging
    console.log('- Token preview:', token.substring(0, 15) + '...');

    try {
      // Decode JWT to check expiration (without verification)
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        console.log('- Token exp:', new Date(payload.exp * 1000).toLocaleString());
        console.log('- Current time:', new Date().toLocaleString());
        console.log('- Token expired:', payload.exp * 1000 < Date.now());
      }
    } catch (e) {
      console.error('Error decoding token:', e);
    }
  }
  console.log('- User info exists:', !!user);

  // Return true if authentication seems valid
  return !!token;
};

// Refresh token using the refresh token endpoint
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await axios.post(`${API_URL}/auth-sync/refresh-token`, {
      refresh_token: refreshToken
    });

    if (response.data && response.data.access_token) {
      // Update stored tokens
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      console.log('Token refreshed successfully');
      return true;
    } else {
      throw new Error('Invalid response from refresh token endpoint');
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    return false;
  }
};

// Initialize authentication
const initAuth = async () => {
  try {
    const token = localStorage.getItem('access_token');

    // If no token exists, we can't initialize auth
    if (!token) {
      console.error('No token available for auth initialization');
      return false;
    }

    // Check if token is expired by decoding it
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        const isExpired = payload.exp * 1000 < Date.now();

        if (isExpired) {
          console.log('Token is expired, attempting to refresh...');
          return await refreshAccessToken();
        } else {
          // Token is still valid
          return true;
        }
      }
    } catch (e) {
      console.error('Error decoding token:', e);
      return await refreshAccessToken();
    }

    return true;
  } catch (error) {
    console.error('Error in initAuth:', error);
    return false;
  }
};

// Create axios instance with token
const getAxiosInstance = () => {
  // Run auth status check
  const isAuthenticated = checkAuthStatus();

  if (!isAuthenticated) {
    console.warn('Warning: Attempting to make API call without valid authentication');
    // Continue anyway but the request will likely fail
  }

  const token = localStorage.getItem('access_token');
  console.log('Creating axios instance with token:', token ? `${token.substring(0, 15)}...` : 'No token');

  const instance = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  });

  // Add response interceptor to handle common errors
  instance.interceptors.response.use(
    response => response,
    async error => {
      if (error.response && error.response.status === 401) {
        console.log('401 Unauthorized response, attempting token refresh...');
        // Try to refresh token
        const refreshSuccess = await refreshAccessToken();
        if (refreshSuccess) {
          // Retry the original request with new token
          const newToken = localStorage.getItem('access_token');
          error.config.headers['Authorization'] = `Bearer ${newToken}`;
          return axios(error.config);
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

// Use the initAuth function we already defined above

// API functions for user hierarchy
const hierarchyApi = {
  // Initialize auth
  initAuth,
  // Create a new user hierarchy relationship
  createHierarchy: async (userData) => {
    try {
      const response = await getAxiosInstance().post('/hierarchy', userData);
      return response.data;
    } catch (error) {
      console.error('Error creating hierarchy:', error);
      throw error;
    }
  },

  // Update a user's reporting relationship
  updateHierarchy: async (userId, reportingData) => {
    try {
      const response = await getAxiosInstance().put(`/hierarchy/${userId}`, reportingData);
      return response.data;
    } catch (error) {
      console.error('Error updating hierarchy:', error);
      throw error;
    }
  },

  // Delete a user from hierarchy
  deleteHierarchy: async (userId) => {
    try {
      const response = await getAxiosInstance().delete(`/hierarchy/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting hierarchy:', error);
      throw error;
    }
  },

  // Get a user's hierarchy details
  getUserHierarchy: async (userId) => {
    try {
      const response = await getAxiosInstance().get(`/hierarchy/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user hierarchy:', error);
      throw error;
    }
  },

  // Get a user's team structure (seniors, peers, subordinates)
  getTeamStructure: async (userId) => {
    try {
      const response = await getAxiosInstance().get(`/hierarchy/${userId}/team`);
      return response.data;
    } catch (error) {
      console.error('Error fetching team structure:', error);
      throw error;
    }
  },

  // Get all users in hierarchy
  getAllHierarchies: async () => {
    try {
      // First check auth status - this logs useful debugging information
      checkAuthStatus();

      // Ensure we have a valid token before making the request
      await initAuth();

      const api = getAxiosInstance();
      console.log('Making request to get all hierarchies to URL:', `${API_URL}/hierarchy/`);

      // Add debugging request first to test authentication
      try {
        console.log('Testing auth with debug endpoint...');
        const debugResponse = await api.get('/hierarchy/debug');
        console.log('Debug response:', debugResponse.data);
      } catch (debugError) {
        console.warn('Debug endpoint test failed:', debugError.message);
      }

      // Make the actual request with trailing slash to avoid redirect
      const response = await api.get('/hierarchy/');

      if (response.data && Array.isArray(response.data)) {
        console.log(`Hierarchy API response successful with ${response.data.length} items`);

        // Show sample of first item if available for debugging
        if (response.data.length > 0) {
          console.log('Sample hierarchy item:', JSON.stringify(response.data[0]));
        }
      } else {
        console.warn('Hierarchy API returned non-array response:', response.data);
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching all hierarchies:', error);

      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);

        // Enhanced error handling based on status codes
        if (error.response.status === 401) {
          console.error('Authentication error (401): Token is invalid or expired');
          // Try to refresh the token automatically
          try {
            await initAuth();
            console.log('Token refreshed, retrying request...');

            // Retry the request once with new token
            const api = getAxiosInstance();
            const response = await api.get('/hierarchy');
            return response.data;
          } catch (refreshError) {
            console.error('Failed to refresh token:', refreshError);
            throw new Error('Authentication failed. Please log in again.');
          }
        } else if (error.response.status === 403) {
          console.error('Permission error (403): User does not have required roles (admin or hr_manager)');
          throw new Error('You do not have permission to view the hierarchy. Required roles: admin or hr_manager');
        } else if (error.response.status === 404) {
          console.error('Not found error (404): Hierarchy endpoint not available');
        }
      } else if (error.request) {
        console.error('No response received from server. API might be down or network issue.');
      } else {
        console.error('Error setting up request:', error.message);
      }

      throw error;
    }
  },

  // Get all seniors for a user
  getUserSeniors: async (userId) => {
    try {
      const response = await getAxiosInstance().get(`/hierarchy/seniors/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user seniors:', error);
      throw error;
    }
  },

  // Get all subordinates for a user
  getUserSubordinates: async (userId) => {
    try {
      const response = await getAxiosInstance().get(`/hierarchy/subordinates/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user subordinates:', error);
      throw error;
    }
  }
};

// Add initAuth to the exported object
const apiWithAuth = {
  ...hierarchyApi,
  initAuth
};

export default apiWithAuth;
