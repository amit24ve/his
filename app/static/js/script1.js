// API Configuration
const API_URL = 'https://cubehis.avopay.pro:5000';

// DOM Elements
const sections = document.querySelectorAll('.section');
const navLinks = document.querySelectorAll('[data-section]');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const logoutBtn = document.getElementById('logout-btn');
const unauthenticatedNav = document.getElementById('unauthenticated-nav');
const authenticatedNav = document.getElementById('authenticated-nav');
const currentDateTimeElement = document.getElementById('current-datetime');

function updateDateTime() {
    try {
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const day = String(now.getUTCDate()).padStart(2, '0');
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');

        const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        document.getElementById('current-datetime').textContent = formattedDateTime;
    } catch (error) {
        console.error("Error updating date/time:", error);
        // Fallback to basic display
        const simpleDate = new Date().toISOString().replace('T', ' ').split('.')[0];
        document.getElementById('current-datetime').textContent = simpleDate;
    }
}
// Call once on load
updateDateTime();
setInterval(updateDateTime, 1000);

// Token Management
const tokenStorage = {
    setTokens: function (accessToken, refreshToken) {
        localStorage.setItem('access_token', accessToken);
        if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken);
        }
        // Store token timestamp to check expiration
        localStorage.setItem('token_timestamp', new Date().getTime());
    },
    getAccessToken: async function () {
        const token = localStorage.getItem('access_token');
        const timestamp = localStorage.getItem('token_timestamp');

        // If token is more than 25 minutes old, try to refresh it
        if (token && timestamp && (new Date().getTime() - timestamp > 25 * 60 * 1000)) {
            console.log("Token might be expired, attempting refresh...");
            await this.refreshToken();
        }
    },

    refreshToken: async function () {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) return false;

        try {
            const response = await fetch(`${API_URL}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (response.ok) {
                const data = await response.json();
                this.setTokens(data.access_token, data.refresh_token || refreshToken);
                return true;
            }
            return false;
        } catch (error) {
            console.error("Token refresh failed:", error);
            return false;
        }
    },
    clearTokens: function () {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_info');
    },
    setUserInfo: function (userInfo) {
        localStorage.setItem('user_info', JSON.stringify(userInfo));
    },
    getUserInfo: function () {
        const userInfo = localStorage.getItem('user_info');
        return userInfo ? JSON.parse(userInfo) : null;
    },
    isLoggedIn: function () {
        return !!this.getAccessToken();
    }
};
tokenStorage.getAccessToken = function () {
    return localStorage.getItem('access_token');
};
// Section Navigation
function showSection(sectionId) {
    console.log(`Showing section: ${sectionId}`);
    sections.forEach(section => {
        section.classList.remove('active');
    });

    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
    }
}

// Update UI based on authentication state
function updateUI() {
    console.log("Updating UI, logged in:", tokenStorage.isLoggedIn());
    if (tokenStorage.isLoggedIn()) {
        // Show authenticated UI
        unauthenticatedNav.style.display = 'none';
        authenticatedNav.style.display = 'flex';

        // Show dashboard section
        showSection('dashboard-section');

        // Update user name
        const userInfo = tokenStorage.getUserInfo();
        const userName = document.getElementById('user-name');

        if (userName) {
            userName.textContent = userInfo?.username || 'soheru';
        }

        // Update welcome message based on role
        const welcomeMsg = document.getElementById('welcome-message');
        if (welcomeMsg) {
            let message = 'Welcome back!';

            if (userInfo?.roles?.length > 0) {
                if (userInfo.roles.includes('admin')) {
                    message = 'Welcome Administrator! You have full access to the system.';
                } else if (userInfo.roles.includes('sales')) {
                    message = 'Welcome to the Sales Dashboard! Here are your leads and targets.';
                } else if (userInfo.roles.includes('franchise')) {
                    message = 'Welcome to the Franchise Dashboard! Monitor your franchise network.';
                } else if (userInfo.roles.includes('support')) {
                    message = 'Welcome to the Support Dashboard! View open tickets and customer issues.';
                }
            }

            welcomeMsg.textContent = message;
        }

        // Update timestamp
        updateDateTime();
    } else {
        // Show unauthenticated UI
        unauthenticatedNav.style.display = 'flex';
        authenticatedNav.style.display = 'none';

        // Show home section by default
        showSection('home-section');
    }
}

// Login function with proper OAuth2 format
// Login function with proper OAuth2 format
async function login(username, password) {
    const errorAlert = document.getElementById('login-error');
    errorAlert.classList.add('d-none');

    console.log(`Attempting to login user: ${username}`);

    try {
        // Create URL encoded form data which OAuth2 requires
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('password', password);

        // Log request details
        console.log("Login URL:", `${API_URL}/api/auth/login`);

        // Make the login request
        const response = await axios.post(`${API_URL}/api/auth/login`, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log("Login success! Response:", response.data);

        // Successful login - store tokens
        if (response.data?.access_token) {
            tokenStorage.setTokens(
                response.data.access_token,
                response.data.refresh_token || null
            );

            // Store user info if available in response
            if (response.data.user) {
                // Ensure user has admin role for role management
                if (username === 'soheru') {
                    response.data.user.roles = response.data.user.roles || [];
                    if (!response.data.user.roles.includes('admin')) {
                        response.data.user.roles.push('admin');
                    }
                }

                tokenStorage.setUserInfo(response.data.user);
                updateUI();
                return true;
            }

            // Try to fetch user profile
            try {
                const userResponse = await axios.get(`${API_URL}/api/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${response.data.access_token}`
                    }
                });

                console.log("User profile:", userResponse.data);

                // Ensure user has admin role for role management if user is soheru
                if (username === 'soheru') {
                    userResponse.data.roles = userResponse.data.roles || [];
                    if (!userResponse.data.roles.includes('admin')) {
                        userResponse.data.roles.push('admin');
                    }
                }

                tokenStorage.setUserInfo(userResponse.data);
            } catch (userError) {
                console.error("Error getting user profile:", userError);
                // Create basic user info if profile fetch fails
                tokenStorage.setUserInfo({
                    id: new Date().getTime().toString(),
                    username: username,
                    full_name: "Soheru User",
                    email: `${username}@example.com`,
                    roles: username === 'soheru' ? ['user', 'admin'] : ['user'] // Add admin role for soheru
                });
            }

            updateUI();
            return true;
        } else {
            console.error("Invalid login response:", response.data);
            errorAlert.textContent = "Login failed: Invalid server response";
            errorAlert.classList.remove('d-none');
            return false;
        }
    } catch (error) {
        console.error("Login error:", error);

        let errorMessage = "Login failed. Please try again.";

        if (error.response) {
            console.error("Error response:", error.response);
            if (error.response.status === 401) {
                errorMessage = "Invalid username or password";
            } else if (error.response.data?.detail) {
                errorMessage = error.response.data.detail;
            } else {
                errorMessage = `Server error (${error.response.status})`;
            }
        } else if (error.request) {
            errorMessage = "Network error. Server may be offline. Please try again later.";
            console.error("Network error:", error.request);
        }

        // Show error message
        errorAlert.textContent = errorMessage;
        errorAlert.classList.remove('d-none');
        return false;
    }
}

// Register function with all required fields
async function register(userData) {
    console.log("Registration data:", userData);

    try {
        const response = await axios.post(`${API_URL}/api/auth/register`, userData);
        console.log("Registration success:", response.data);
        return response.data;
    } catch (error) {
        console.error("Registration error:", error);

        let errorMessage = "Registration failed.";
        if (error.response && error.response.data) {
            if (error.response.data.detail) {
                errorMessage = error.response.data.detail;
            } else {
                errorMessage = JSON.stringify(error.response.data);
            }
        }

        throw new Error(errorMessage);
    }
}

// Logout function
async function logout() {
    const token = tokenStorage.getAccessToken();
    console.log("Logging out user with token:", token ? "Present" : "Missing");

    try {
        if (token) {
            try {
                // Call server-side logout
                await axios.post(`${API_URL}/api/auth/logout`, {}, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                console.log("Server logout successful");
            } catch (error) {
                console.warn("Server logout failed, continuing with client logout:", error);
            }
        }
    } finally {
        // Always clear tokens and update UI regardless of server response
        tokenStorage.clearTokens();
        updateUI();
        showSection('home-section');

        // Show logout confirmation if on login page
        if (document.getElementById('login-section').classList.contains('active')) {
            const loginErrorAlert = document.getElementById('login-error');
            if (loginErrorAlert) {
                loginErrorAlert.textContent = "You have been logged out successfully.";
                loginErrorAlert.classList.remove('d-none');
                loginErrorAlert.classList.remove('alert-danger');
                loginErrorAlert.classList.add('alert-success');

                setTimeout(() => {
                    loginErrorAlert.classList.add('d-none');
                }, 3000);
            }
        }
    }
}

// Add demo login for testing
function demoLogin() {
    console.log("Demo login activated");

    // Try to get actual token from the API first
    const username = 'soheru';
    const password = 'demo';

    // Try to login with actual API first
    fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            'username': username,
            'password': password
        })
    })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                // API login failed, fallback to fake demo mode
                throw new Error('API login failed');
            }
        })
        .then(data => {
            // Real API login succeeded
            console.log("Real API login successful:", data);

            // Store the real token
            tokenStorage.setTokens(
                data.access_token,
                data.refresh_token || null
            );

            // Ensure user has admin role
            const userInfo = data.user || {};
            userInfo.roles = userInfo.roles || [];
            if (!userInfo.roles.includes('admin')) {
                userInfo.roles.push('admin');
            }

            tokenStorage.setUserInfo(userInfo);
            updateUI();

            // Show success message
            const loginErrorAlert = document.getElementById('login-error');
            if (loginErrorAlert) {
                loginErrorAlert.textContent = "Login successful with your real token!";
                loginErrorAlert.classList.remove('d-none');
                loginErrorAlert.classList.remove('alert-danger');
                loginErrorAlert.classList.add('alert-success');
            }
        })
        .catch(error => {
            console.log("Falling back to demo mode:", error);

            // Generate fake token as fallback
            const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6InNvaGVydSIsInJvbGVzIjpbImFkbWluIl0sImlhdCI6MTUxNjIzOTAyMn0.fake_signature';

            tokenStorage.setTokens(fakeToken, 'demo_refresh_token');
            tokenStorage.setUserInfo({
                id: '6838065b2a4343841f7d3c85',
                username: 'amit',
                email: 'soheru@example.com',
                full_name: 'Amit',
                roles: ['admin']
            });

            setupDemoInterceptor();
            updateUI();

            // Show demo mode message
            const loginErrorAlert = document.getElementById('login-error');
            if (loginErrorAlert) {
                loginErrorAlert.textContent = "Demo mode activated (offline mode)";
                loginErrorAlert.classList.remove('d-none');
                loginErrorAlert.classList.remove('alert-danger');
                loginErrorAlert.classList.add('alert-success');
            }
        });

    return true;
}

// Example frontend code for automatic token refresh
function setupTokenRefresh() {
    // Check token expiry every minute
    setInterval(async () => {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        // Parse JWT to check expiration (without verification)
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) return;

        try {
            const payload = JSON.parse(atob(tokenParts[1]));
            const expiry = payload.exp * 1000; // Convert to milliseconds
            const now = Date.now();

            // If token expires in less than 1 hour, refresh it
            if (expiry - now < 60 * 60 * 1000) {
                console.log('Token expiring soon, refreshing...');
                const refreshToken = localStorage.getItem('refresh_token');

                const response = await fetch('/api/auth/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: refreshToken })
                });

                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('access_token', data.access_token);
                    localStorage.setItem('refresh_token', data.refresh_token);
                    console.log('Token refreshed successfully');
                } else {
                    console.log('Token refresh failed, redirecting to login');
                    window.location.href = '/login';
                }
            }
        } catch (error) {
            console.error('Error checking token expiry:', error);
        }
    }, 60000); // Check every minute
}

// Call this function when your app initializes
setupTokenRefresh();

// Add this new function to handle demo mode API calls
function setupDemoInterceptor() {
    // Remove any existing interceptors
    axios.interceptors.request.eject(window.demoInterceptor);

    // Add interceptor for demo mode
    window.demoInterceptor = axios.interceptors.response.use(
        // Success handler - let successful responses pass through
        response => response,
        // Error handler - intercept 401/403 errors for demo mode
        async error => {
            // Check if this is an authentication error
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                // Check if we're in demo mode
                if (tokenStorage.getAccessToken() && tokenStorage.getAccessToken().startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ')) {
                    console.log("Intercepting auth error in demo mode:", error.config.url);

                    // For role creation endpoint
                    if (error.config.url.includes('/api/roles')) {
                        console.log("Simulating successful role creation");

                        // Get the role data from the request
                        const roleData = JSON.parse(error.config.data);

                        // Generate a mock response
                        return {
                            data: {
                                id: 'demo_' + new Date().getTime(),
                                name: roleData.name,
                                description: roleData.description,
                                permissions: roleData.permissions || [],
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                                created_by: 'soheru'
                            },
                            status: 201,
                            statusText: 'Created'
                        };
                    }
                }
            }

            // For other errors, reject as normal
            return Promise.reject(error);
        }
    );
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function () {
    console.log("Document loaded, setting up event listeners");

    // Section navigation
    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            showSection(sectionId);
        });
    });

    // Login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;

            if (!username || !password) {
                const errorAlert = document.getElementById('login-error');
                errorAlert.textContent = "Please enter both username and password";
                errorAlert.classList.remove('d-none');
                return;
            }

            const success = await login(username, password);

            // Enable demo login for testing when regular login fails
            if (!success && (username === 'demo' || username === 'soheru') && password === 'demo') {
                demoLogin();
            }
        });
    }

    // Register form submission
    if (registerForm) {
        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const fullName = document.getElementById('fullName').value.trim();
            const username = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const errorAlert = document.getElementById('register-error');

            // Validate form
            if (!fullName || !username || !email || !password) {
                errorAlert.textContent = "Please fill in all required fields";
                errorAlert.classList.remove('d-none');
                return;
            }

            // Validate passwords match
            if (password !== confirmPassword) {
                errorAlert.textContent = "Passwords do not match";
                errorAlert.classList.remove('d-none');
                return;
            }

            try {
                // Use special handling for demo users
                if ((username === 'demo' || username === 'soheru') && password === 'demo') {
                    // Show success message
                    errorAlert.textContent = "Demo registration successful! You can now login.";
                    errorAlert.classList.remove('d-none');
                    errorAlert.classList.remove('alert-danger');
                    errorAlert.classList.add('alert-success');

                    // Clear form
                    registerForm.reset();

                    // Redirect to login after a short delay
                    setTimeout(() => {
                        showSection('login-section');
                    }, 2000);
                    return;
                }

                // Prepare the user data - make sure fields match backend expectations
                const userData = {
                    full_name: fullName,
                    username: username,
                    email: email,
                    password: password,
                    phone: "", // Optional fields that your backend expects
                    department: ""
                };

                // Regular registration
                await register(userData);

                // Show success message
                errorAlert.textContent = "Registration successful! You can now login.";
                errorAlert.classList.remove('d-none');
                errorAlert.classList.remove('alert-danger');
                errorAlert.classList.add('alert-success');

                // Clear form
                registerForm.reset();

                // Redirect to login after a short delay
                setTimeout(() => {
                    showSection('login-section');
                }, 2000);
            } catch (error) {
                // Show error message
                errorAlert.textContent = error.message || "Registration failed. Please try again.";
                errorAlert.classList.remove('d-none');
            }
        });
    }

    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            logout();
        });
    }


    //delete user function
    async function deleteUser(userId) {
        const token = tokenStorage.getAccessToken();
        if (!token) {
            console.error("No authentication token available");
            return false;
        }

        console.log(`Attempting to delete user ID: ${userId}`);

        try {
            const response = await axios.delete(`${API_URL}/api/auth/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log("Delete response:", response.status);

            if (response.status === 204) {
                console.log("User deleted successfully");
                return true;
            } else {
                console.error("Unexpected status code:", response.status);
                return false;
            }
        } catch (error) {
            console.error("Error deleting user:", error);

            if (error.response) {
                console.error("Response status:", error.response.status);
                console.error("Response data:", error.response.data);

                if (error.response.status === 401) {
                    // Handle authentication error
                    alert("You are not authorized to delete this user. Please log in again.");
                    logout();  // Force logout on authentication failure
                } else if (error.response.status === 403) {
                    alert("You don't have permission to delete this user.");
                } else if (error.response.status === 404) {
                    alert("User not found.");
                } else {
                    alert(`Error deleting user: ${error.response.data.detail || "Unknown error"}`);
                }
            } else {
                alert("Network error while trying to delete user.");
            }

            return false;
        }
    }

    // Make functions available for console debugging
    window.login = login;
    window.logout = logout;
    window.demoLogin = demoLogin;
    window.tokenStorage = tokenStorage;
    window.showSection = showSection;

    // Initial UI update
    updateUI();
});
const roleManagement = {
    // DOM Elements for role management
    elements: {
        rolesList: document.getElementById('roles-table-body'),
        createRoleBtn: document.getElementById('createRoleBtn'),
        refreshRolesBtn: document.getElementById('refreshRolesBtn'),
        rolesLoading: document.getElementById('roles-loading'),
        noRolesFound: document.getElementById('no-roles-found'),
        roleAlert: document.getElementById('role-alert'),
        roleModal: new bootstrap.Modal(document.getElementById('roleModal')),
        roleForm: document.getElementById('roleForm'),
        roleName: document.getElementById('roleName'),
        roleDescription: document.getElementById('roleDescription'),
        roleId: document.getElementById('roleId'),
        roleReportTo: document.getElementById('roleReportTo'),
        saveRoleBtn: document.getElementById('saveRoleBtn'),
        saveRoleBtnText: document.getElementById('saveRoleBtnText'),
        saveRoleBtnLoading: document.getElementById('saveRoleBtnLoading'),
        deleteRoleModal: new bootstrap.Modal(document.getElementById('deleteRoleModal')),
        deleteRoleName: document.getElementById('deleteRoleName'),
        confirmDeleteRoleBtn: document.getElementById('confirmDeleteRoleBtn')
    },

    // Initialize role management
    init: function () {
        // Debug check for roleReportTo
        if (document.getElementById('roleReportTo')) {
            console.log("roleReportTo element found");
        } else {
            console.error("roleReportTo element not found!");
        }

        // Load roles on tab activation
        document.querySelector('a[data-bs-target="#roles"]').addEventListener('shown.bs.tab', function () {
            roleManagement.loadRoles();
        });

        // Setup event listeners
        if (this.elements.createRoleBtn) {
            this.elements.createRoleBtn.addEventListener('click', this.showCreateRoleModal.bind(this));
        }

        if (this.elements.refreshRolesBtn) {
            this.elements.refreshRolesBtn.addEventListener('click', this.loadRoles.bind(this));
        }

        if (this.elements.roleForm) {
            this.elements.roleForm.addEventListener('submit', this.handleRoleFormSubmit.bind(this));
        }

        if (this.elements.confirmDeleteRoleBtn) {
            this.elements.confirmDeleteRoleBtn.addEventListener('click', this.handleDeleteRole.bind(this));
        }
    },

    // Load roles from API
    loadRoles: async function () {
        try {
            this.setLoading(true);
            this.showAlert('', 'none');

            const token = tokenStorage.getAccessToken();
            const response = await axios.get(`${API_URL}/api/roles`);

            this.renderRolesList(response.data);
        } catch (error) {
            console.error('Error loading roles:', error.response ? error.response.data : error.message);
            this.showAlert('Failed to load roles. Please try again.', 'danger');
        } finally {
            this.setLoading(false);
        }
    },

    // Render roles list
    renderRolesList: function (roles) {
        const tbody = this.elements.rolesList;
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!roles || roles.length === 0) {
            this.elements.noRolesFound.classList.remove('d-none');
            return;
        }

        this.elements.noRolesFound.classList.add('d-none');

        roles.forEach(role => {
            const tr = document.createElement('tr');

            // Format created_at date
            const createdDate = new Date(role.created_at);
            const formattedDate = createdDate.toLocaleDateString() + ' ' + createdDate.toLocaleTimeString();

            // Check if role is system role (admin or user)
            const isSystemRole = ['admin', 'user'].includes(role.name);

            tr.innerHTML = `
                <td>
                    <strong>${role.name}</strong>
                    ${isSystemRole ? '<span class="badge bg-info ms-2">System</span>' : ''}
                </td>
                <td>${role.description || '-'}</td>
                <td>${role.report_to || '-'}</td>
                <td>${role.created_by || '-'}</td>
                <td>${formattedDate}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary edit-role-btn" data-id="${role.id}" ${isSystemRole ? 'disabled' : ''}>
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-role-btn ms-2" data-id="${role.id}" data-name="${role.name}" ${isSystemRole ? 'disabled' : ''}>
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;

            // Add event listeners for edit and delete buttons
            const editBtn = tr.querySelector('.edit-role-btn');
            if (editBtn) {
                editBtn.addEventListener('click', () => this.showEditRoleModal(role));
            }

            const deleteBtn = tr.querySelector('.delete-role-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.showDeleteRoleModal(role.id, role.name));
            }

            tbody.appendChild(tr);
        });
    },

    // Show create role modal
    showCreateRoleModal: function () {
        this.elements.roleForm.reset();
        this.elements.roleId.value = '';
        this.elements.saveRoleBtnText.textContent = 'Create Role';
        document.getElementById('roleModalLabel').textContent = 'Create New Role';
        this.loadRoleOptions(); // Load available roles for the Report To dropdown
        this.elements.roleModal.show();
    },

    // Show edit role modal
    showEditRoleModal: function (role) {
        this.elements.roleForm.reset();
        this.elements.roleId.value = role.id;
        this.elements.roleName.value = role.name;
        this.elements.roleDescription.value = role.description || '';
        this.loadRoleOptions(); // Load available roles for the Report To dropdown
        this.elements.roleReportTo.value = role.report_to || '';

        // Set permissions if role has them
        if (role.permissions && Array.isArray(role.permissions)) {
            role.permissions.forEach(perm => {
                const checkbox = document.getElementById(`perm_${perm}`);
                if (checkbox) checkbox.checked = true;
            });
        }

        this.elements.saveRoleBtnText.textContent = 'Update Role';
        document.getElementById('roleModalLabel').textContent = 'Edit Role';
        this.elements.roleModal.show();
    },

    // Show delete role modal
    showDeleteRoleModal: function (roleId, roleName) {
        // Set the role name text directly using the provided parameter
        if (this.elements.deleteRoleName) {
            this.elements.deleteRoleName.textContent = roleName || "this role";
        }

        // Store role ID for delete operation
        if (this.elements.confirmDeleteRoleBtn) {
            this.elements.confirmDeleteRoleBtn.dataset.roleId = roleId;
        }

        // Show the modal
        this.elements.deleteRoleModal.show();
    },

    // Handle role form submission (create/update)
    // Handle role form submission (create/update)
    handleRoleFormSubmit: async function (event) {
        event.preventDefault();

        const roleId = this.elements.roleId.value;
        const isEdit = !!roleId;

        // Get form data
        const formData = {
            name: this.elements.roleName.value,
            description: this.elements.roleDescription.value,
            report_to: this.elements.roleReportTo.value || null
        };

        // Input validation
        if (!formData.name || formData.name.trim() === '') {
            this.showAlert('Role name is required', 'danger');
            return;
        }

        // Get selected permissions
        const permissions = [];
        document.querySelectorAll('#permissions-container input[type="checkbox"]:checked').forEach(checkbox => {
            permissions.push(checkbox.value);
        });
        formData.permissions = permissions;

        try {
            this.setSaveBtnLoading(true);
            const token = tokenStorage.getAccessToken();

            // Check if token exists
            if (!token) {
                this.showAlert('You must be logged in to perform this action. Please log in again.', 'danger');
                this.setSaveBtnLoading(false);
                return;
            }

            // Log full token for debugging
            console.log("Creating role with token:", token);

            let response;
            if (isEdit) {
                // Update existing role
                response = await axios.put(`${API_URL}/api/roles/${roleId}`, formData, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                this.showAlert('Role updated successfully!', 'success');
            } else {
                // Create new role - Add some debugging
                console.log("Sending role creation request to:", `${API_URL}/api/roles/`);
                console.log("With data:", JSON.stringify(formData));
                console.log("With headers:", { 'Authorization': `Bearer ${token}` });

                try {
                    response = await axios.post(`${API_URL}/api/roles/`, formData, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    console.log("Role created successfully:", response.data);
                    this.showAlert('Role created successfully!', 'success');
                } catch (innerError) {
                    console.error("Inner error details:", innerError.response ? innerError.response : innerError);
                    throw innerError; // Re-throw to be caught by the outer catch
                }
            }

            this.elements.roleModal.hide();
            this.loadRoles();  // Refresh the roles list
        } catch (error) {
            console.error('Error saving role:', error);

            let errorMsg = 'Failed to save role.';

            // Enhanced error logging
            if (error.response) {
                console.error("Response status:", error.response.status);
                console.error("Response headers:", error.response.headers);
                console.error("Response data:", error.response.data);

                if (error.response.status === 401) {
                    errorMsg = 'Authentication failed. Please log in again with valid credentials.';

                    // Try automatic re-login for demo user
                    if (tokenStorage.getUserInfo()?.username === 'soheru') {
                        console.log("Attempting automatic re-login for soheru...");
                        demoLogin();
                        errorMsg += ' Attempting automatic re-login...';
                    }
                } else if (error.response.status === 403) {
                    errorMsg = 'You do not have permission to create roles. Admin rights required.';
                } else if (error.response.data && error.response.data.detail) {
                    errorMsg = error.response.data.detail;
                }
            } else if (error.request) {
                console.error("Request made but no response received:", error.request);
                errorMsg = "Network error. Server may be offline. Please try again later.";
            } else {
                console.error("Error during request setup:", error.message);
            }

            this.showAlert(errorMsg, 'danger');
        } finally {
            this.setSaveBtnLoading(false);
        }
    },

    // Helper: Show alert message
    showAlert: function (message, type) {
        const alertElement = this.elements.roleAlert;
        if (!alertElement) return;

        if (!message || type === 'none') {
            alertElement.classList.add('d-none');
            return;
        }

        alertElement.textContent = message;
        alertElement.className = `alert alert-${type}`;
        alertElement.classList.remove('d-none');

        // Auto hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                alertElement.classList.add('d-none');
            }, 3000);
        }
    },

    // Helper: Set loading state for roles list
    setLoading: function (isLoading) {
        if (isLoading) {
            this.elements.rolesLoading.classList.remove('d-none');
            this.elements.refreshRolesBtn.disabled = true;
        } else {
            this.elements.rolesLoading.classList.add('d-none');
            this.elements.refreshRolesBtn.disabled = false;
        }
    },

    // Helper: Set loading state for save button
    setSaveBtnLoading: function (isLoading) {
        if (isLoading) {
            this.elements.saveRoleBtn.disabled = true;
            this.elements.saveRoleBtnText.classList.add('d-none');
            this.elements.saveRoleBtnLoading.classList.remove('d-none');
        } else {
            this.elements.saveRoleBtn.disabled = false;
            this.elements.saveRoleBtnText.classList.remove('d-none');
            this.elements.saveRoleBtnLoading.classList.add('d-none');
        }
    },

    // Load Report To options from roles
    loadRoleOptions: async function () {
        try {
            const token = tokenStorage.getAccessToken();
            if (!token) {
                console.error("No authentication token for loading role options");
                return;
            }

            // Clear the dropdown except for the default option
            const reportToSelect = this.elements.roleReportTo;
            while (reportToSelect.options.length > 1) {
                reportToSelect.remove(1);
            }

            // Fetch all available roles
            const response = await axios.get(`${API_URL}/api/roles/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data && Array.isArray(response.data)) {
                // Add each role as an option
                response.data.forEach(role => {
                    const option = document.createElement('option');
                    option.value = role.name; // Using role name as the value
                    option.textContent = role.name;
                    reportToSelect.appendChild(option);
                });
                console.log(`Loaded ${response.data.length} role options for reporting hierarchy`);
            }
        } catch (error) {
            console.error('Error loading role options:', error);
        }
    },
};


// Add the missing handleDeleteRole function to the roleManagement object
// Fix for the delete role modal text issue
roleManagement.showDeleteRoleModal = function (roleId, roleName) {
    // Just set the role name in the designated span
    const deleteRoleNameSpan = document.getElementById('deleteRoleName');
    if (deleteRoleNameSpan) {
        deleteRoleNameSpan.textContent = roleName;
    }

    // Set the role ID on the delete button for reference
    this.elements.confirmDeleteRoleBtn.dataset.roleId = roleId;

    // Show the modal
    this.elements.deleteRoleModal.show();
};

// Execute this function to apply the fix
// Add proper handleDeleteRole function to the roleManagement object
roleManagement.handleDeleteRole = async function () {
    const roleId = this.elements.confirmDeleteRoleBtn.dataset.roleId;
    if (!roleId) {
        console.error("No role ID found for deletion");
        return;
    }

    try {
        // Show loading state
        this.elements.confirmDeleteRoleBtn.disabled = true;
        this.elements.confirmDeleteRoleBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Deleting...';

        console.log(`Deleting role with ID: ${roleId}`);
        const token = tokenStorage.getAccessToken();

        // Make DELETE request to API
        const response = await axios.delete(`${API_URL}/api/roles/${roleId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log("Delete response status:", response.status);

        // Show success message
        this.showAlert('Role deleted successfully!', 'success');

        // Refresh roles list
        await this.loadRoles();

    } catch (error) {
        console.error("Error deleting role:", error);

        let errorMsg = 'Failed to delete role.';

        if (error.response) {
            if (error.response.status === 403) {
                errorMsg = 'You do not have permission to delete roles.';
            } else if (error.response.status === 404) {
                errorMsg = 'Role not found. It may have been already deleted.';
            } else if (error.response.data && error.response.data.detail) {
                errorMsg = error.response.data.detail;
            }
        }

        this.showAlert(errorMsg, 'danger');
    } finally {
        // Reset button state
        this.elements.confirmDeleteRoleBtn.disabled = false;
        this.elements.confirmDeleteRoleBtn.innerHTML = '<i class="fas fa-trash-alt me-2"></i>Delete';

        // Hide the modal
        this.elements.deleteRoleModal.hide();
    }
};

// While we're at it, let's also fix the issue with the role name display in the modal
// that might be getting overwritten by the datetime function
roleManagement.showDeleteRoleModal = function (roleId, roleName) {
    // Set the role name text directly using the provided parameter
    if (this.elements.deleteRoleName) {
        this.elements.deleteRoleName.textContent = roleName || "this role";
    }

    // Store role ID for delete operation
    if (this.elements.confirmDeleteRoleBtn) {
        this.elements.confirmDeleteRoleBtn.dataset.roleId = roleId;
    }

    // Show the modal
    this.elements.deleteRoleModal.show();
};


// Add this to the window object for direct API access
window.createRoleDirectly = async function (roleName, roleDescription = "", permissions = [], reportTo = null) {
    // Get auth token
    const token = tokenStorage.getAccessToken();
    if (!token) {
        console.error("No authentication token available for direct role creation");
        return false;
    }

    try {
        console.log(`Creating role "${roleName}" directly via API`);

        const roleData = {
            name: roleName,
            description: roleDescription,
            permissions: permissions,
            report_to: reportTo
        };

        // Make the API request with full token
        const response = await fetch(`${API_URL}/api/roles/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(roleData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`API error (${response.status}):`, errorData);
            return false;
        }

        const data = await response.json();
        console.log("Role created successfully:", data);

        // Refresh roles list
        roleManagement.loadRoles();
        roleManagement.showAlert(`Role "${roleName}" created successfully!`, 'success');

        return data;
    } catch (error) {
        console.error("Error creating role directly:", error);
        return false;
    }
};

// Add this to help debug token issues
window.checkTokenValidity = async function () {
    const token = tokenStorage.getAccessToken();

    if (!token) {
        console.error("No token available to check");
        return "No token found";
    }

    console.log("Checking token:", token.substring(0, 15) + "...");

    try {
        // Try a simple authenticated request
        const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const userData = await response.json();
            console.log("Token is valid! User data:", userData);
            return "Token is valid";
        } else {
            console.error("Token is invalid:", await response.text());
            return `Token is invalid (${response.status})`;
        }
    } catch (error) {
        console.error("Error checking token:", error);
        return "Error checking token";
    }
};
document.addEventListener('DOMContentLoaded', function () {
    roleManagement.init();
});

// Lead Management Module

// Lead Management Module
// Lead Management Module
const leadManagement = {
    // Initialize the module
    init: function () {
        console.log("Initializing Lead Management module...");

        try {
            // Setup event listeners with null checking to prevent errors
            document.getElementById('createLeadBtn')?.addEventListener('click', this.showCreateLeadModal.bind(this));
            document.getElementById('leadForm')?.addEventListener('submit', this.handleLeadFormSubmit.bind(this));
            document.getElementById('followupForm')?.addEventListener('submit', this.handleFollowupFormSubmit.bind(this));
            document.getElementById('completeFollowupForm')?.addEventListener('submit', this.handleCompleteFollowupFormSubmit.bind(this));
            document.getElementById('quotationForm')?.addEventListener('submit', this.handleQuotationFormSubmit.bind(this));
            const self = this;
            const refreshBtn = document.getElementById('refresh-leads-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', function () {
                    console.log("Refresh button clicked");
                    self.loadLeads();
                });
            };
            document.getElementById('refresh-my-leads-btn')?.addEventListener('click', this.loadMyLeads.bind(this));
            document.getElementById('refresh-followups-btn')?.addEventListener('click', this.loadFollowUps.bind(this));
            document.getElementById('refresh-quotations-btn')?.addEventListener('click', this.loadQuotations.bind(this));

            // Setup quotation item calculation
            const addQuotationItemBtn = document.getElementById('addQuotationItemBtn');
            if (addQuotationItemBtn) {
                addQuotationItemBtn.addEventListener('click', this.addQuotationItem.bind(this));
                this.setupQuotationItemEvents();
            }

            // Setup dynamic fields
            document.getElementById('scheduleNextFollowup')?.addEventListener('change', function () {
                const nextFollowupFields = document.getElementById('nextFollowupFields');
                if (nextFollowupFields) {
                    nextFollowupFields.classList.toggle('d-none', !this.checked);
                }
            });

            // Load data when tab is shown
            document.querySelector('a[data-bs-target="#leads"]')?.addEventListener('shown.bs.tab', () => {
                this.loadDashboardStats();
                this.loadLeads();
            });

            // Load data when inner tabs are shown
            document.getElementById('my-leads-tab')?.addEventListener('shown.bs.tab', this.loadMyLeads.bind(this));
            document.getElementById('followups-tab')?.addEventListener('shown.bs.tab', this.loadFollowUps.bind(this));
            document.getElementById('quotations-tab')?.addEventListener('shown.bs.tab', this.loadQuotations.bind(this));

            // Setup filters
            document.getElementById('lead-status-filter')?.addEventListener('change', this.loadLeads.bind(this));
            document.getElementById('lead-source-filter')?.addEventListener('change', this.loadLeads.bind(this));
            document.getElementById('lead-search-btn')?.addEventListener('click', this.loadLeads.bind(this));
            document.getElementById('my-lead-status-filter')?.addEventListener('change', this.loadMyLeads.bind(this));
            document.getElementById('my-lead-search-btn')?.addEventListener('click', this.loadMyLeads.bind(this));
            document.getElementById('quotation-status-filter')?.addEventListener('change', this.loadQuotations.bind(this));
            document.getElementById('quotation-search-btn')?.addEventListener('click', this.loadQuotations.bind(this));

            // Set default dates where applicable
            this.setDefaultDates();

            // Load initial data
            this.loadSalesExecutives();

            // If we're on the leads tab initially, load data
            if (document.querySelector('.tab-pane#leads.active')) {
                console.log("Loading initial lead data...");
                this.loadDashboardStats();
                this.loadLeads();
                this.loadMyLeads();
            }

            // Add default data if needed
            if (API_URL.includes('localhost') || !tokenStorage.getAccessToken().includes('.')) {
                console.log("Development mode detected - adding mock leads data");
                this.addDefaultMockLeads();
            } else {
                this.checkAndAddDefaultLeads();
            }
        } catch (error) {
            console.error("Error initializing lead management:", error);
        }
    },

    // Set default dates
    setDefaultDates: function () {
        // Set default date for quotation validity (30 days from now)
        const validUntilField = document.getElementById('quotationValidUntil');
        if (validUntilField) {
            const date = new Date();
            date.setDate(date.getDate() + 30);
            validUntilField.valueAsDate = date;
        }

        // Set default date/time for followup (tomorrow at 10 AM)
        const followupDateField = document.getElementById('followupScheduledDate');
        if (followupDateField) {
            const date = new Date();
            date.setDate(date.getDate() + 1);
            date.setHours(10, 0, 0, 0);
            followupDateField.value = this.formatDateTimeForInput(date);
        }
    },

    // Format date for datetime-local input
    formatDateTimeForInput: function (date) {
        return date.getFullYear().toString() + '-' +
            (date.getMonth() + 1).toString().padStart(2, '0') + '-' +
            date.getDate().toString().padStart(2, '0') + 'T' +
            date.getHours().toString().padStart(2, '0') + ':' +
            date.getMinutes().toString().padStart(2, '0');
    },

    // Check and add default leads if none exist
    checkAndAddDefaultLeads: function () {
        console.log("Checking if default leads need to be added...");

        const token = tokenStorage.getAccessToken();
        if (!token) {
            console.log("No auth token found, skipping default leads check");
            return;
        }

        axios.get(`${API_URL}/api/leads/check-leads-exist`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => {
                if (!response.data.has_leads) {
                    console.log("No leads found, adding default leads");
                    this.addDefaultLeads();
                } else {
                    console.log("Leads already exist, skipping default leads creation");
                }
            })
            .catch(error => {
                console.error("Error checking for existing leads:", error);
            });
    },

    // Add default leads to system
    addDefaultLeads: function () {
        const token = tokenStorage.getAccessToken();

        axios.post(`${API_URL}/api/leads/create-default-leads`, {}, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => {
                console.log("Successfully added default leads");

                // Refresh leads display
                this.loadLeads();
                this.loadMyLeads();
                this.loadDashboardStats();

                // Show success message
                this.showLeadAlert('Default leads have been added to help you get started!', 'success');
            })
            .catch(error => {
                console.error("Error adding default leads:", error);
            });
    },

    // Add mock leads for development/demo mode
    addDefaultMockLeads: function () {
        // Update dashboard stats with mock data
        this.updateDashboardStat('total-leads-count', 5);
        this.updateDashboardStat('hot-leads-count', 1);
        this.updateDashboardStat('converted-leads-count', 1);
        this.updateDashboardStat('todays-followups-count', 2);

        // Load mock leads in tables
        const leadsTableBody = document.getElementById('leads-table-body');
        const noLeadsFound = document.getElementById('no-leads-found');

        if (leadsTableBody && noLeadsFound) {
            this.generateMockLeads(leadsTableBody, null, noLeadsFound);
        }

        // Also load my leads
        const myLeadsTableBody = document.getElementById('my-leads-table-body');
        const noMyLeadsFound = document.getElementById('no-my-leads-found');

        if (myLeadsTableBody && noMyLeadsFound) {
            // Get current user
            const userInfo = tokenStorage.getUserInfo();
            const username = userInfo?.username || 'soheruwhy';

            // Generate mock data for current user
            const mockLeads = [
                {
                    id: 'lead1',
                    full_name: 'Rajesh Kumar',
                    company: 'ABC Industries',
                    email: 'rajesh@abc-industries.com',
                    phone: '+91 9876543210',
                    source: 'website',
                    status: 'hot',
                    next_followup_date: new Date().toISOString(),
                    assigned_to: 'user1',
                    assigned_to_name: username
                },
                {
                    id: 'lead2',
                    full_name: 'Priya Sharma',
                    company: 'Sunshine Exports',
                    email: 'p.sharma@sunshine-exports.com',
                    phone: '+91 8765432109',
                    source: 'whatsapp',
                    status: 'warm',
                    next_followup_date: new Date(Date.now() + 86400000).toISOString(),
                    assigned_to: 'user1',
                    assigned_to_name: username
                },
                {
                    id: 'lead5',
                    full_name: 'Vikram Singh',
                    company: 'Royal Enterprises',
                    email: 'vikram@royal.in',
                    phone: '+91 8765432100',
                    source: 'email',
                    status: 'converted',
                    assigned_to: 'user1',
                    assigned_to_name: username
                }
            ];

            noMyLeadsFound.classList.add('d-none');
            mockLeads.forEach(lead => {
                this.renderMyLeadRow(lead, myLeadsTableBody);
            });
        }
    },

    // Load dashboard statistics
    loadDashboardStats: function () {
        // Initialize with zeros
        this.updateDashboardStat('total-leads-count', 0);
        this.updateDashboardStat('hot-leads-count', 0);
        this.updateDashboardStat('converted-leads-count', 0);
        this.updateDashboardStat('todays-followups-count', 0);

        // Get stats from API
        this.fetchDashboardStats();
    },

    // Fetch dashboard stats from API
    fetchDashboardStats: function () {
        const token = tokenStorage.getAccessToken();
        if (!token) return;

        // Fetch total leads count
        axios.get(`${API_URL}/api/leads?limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => {
                const totalLeads = response.data.length > 0 ? response.headers['x-total-count'] || 0 : 0;
                this.updateDashboardStat('total-leads-count', totalLeads);
            })
            .catch(error => {
                console.error('Error fetching total leads:', error);
                // Use mock data in development/demo mode
                if (API_URL.includes('localhost') || !tokenStorage.getAccessToken().includes('.')) {
                    this.updateDashboardStat('total-leads-count', 5);
                }
            });

        // Fetch hot leads count
        axios.get(`${API_URL}/api/leads?status=hot&limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => {
                const hotLeads = response.data.length > 0 ? response.headers['x-total-count'] || 0 : 0;
                this.updateDashboardStat('hot-leads-count', hotLeads);
            })
            .catch(error => {
                console.error('Error fetching hot leads:', error);
                // Use mock data in development/demo mode
                if (API_URL.includes('localhost') || !tokenStorage.getAccessToken().includes('.')) {
                    this.updateDashboardStat('hot-leads-count', 1);
                }
            });

        // Fetch converted leads count
        axios.get(`${API_URL}/api/leads?status=converted&limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => {
                const convertedLeads = response.data.length > 0 ? response.headers['x-total-count'] || 0 : 0;
                this.updateDashboardStat('converted-leads-count', convertedLeads);
            })
            .catch(error => {
                console.error('Error fetching converted leads:', error);
                // Use mock data in development/demo mode
                if (API_URL.includes('localhost') || !tokenStorage.getAccessToken().includes('.')) {
                    this.updateDashboardStat('converted-leads-count', 1);
                }
            });

        // Fetch today's followups count
        axios.get(`${API_URL}/api/followups/today/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => {
                const todayFollowups = response.data ? response.data.length : 0;
                this.updateDashboardStat('todays-followups-count', todayFollowups);
            })
            .catch(error => {
                console.error('Error fetching today\'s followups:', error);
                // Use mock data in development/demo mode
                if (API_URL.includes('localhost') || !tokenStorage.getAccessToken().includes('.')) {
                    this.updateDashboardStat('todays-followups-count', 2);
                }
            });
    },

    // Update dashboard stat
    updateDashboardStat: function (elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    },

    // Show alert message in lead section
    showLeadAlert: function (message, type) {
        const alertElement = document.getElementById('lead-alert');
        if (!alertElement) return;

        if (!message || type === 'none') {
            alertElement.classList.add('d-none');
            return;
        }

        alertElement.textContent = message;
        alertElement.className = `alert alert-${type}`;
        alertElement.classList.remove('d-none');

        // Auto hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                alertElement.classList.add('d-none');
            }, 3000);
        }
    },

    // Load sales executives for assignment
    loadSalesExecutives: function () {
        const select = document.getElementById('leadAssignedTo');
        if (!select) return;

        // Clear existing options except the first one
        while (select.options.length > 1) {
            select.remove(1);
        }

        // In dev/demo mode, add some sample users
        if (API_URL.includes('localhost') || !tokenStorage.getAccessToken().includes('.')) {
            const demoUsers = [
                { id: 'user1', username: 'soheruwhy', full_name: 'Soheru User' },
                { id: 'user2', username: 'john_sales', full_name: 'John Sales' },
                { id: 'user3', username: 'priya_sales', full_name: 'Priya Sales' }
            ];

            demoUsers.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.username + (user.full_name ? ` (${user.full_name})` : '');
                select.appendChild(option);
            });

            return;
        }

        // Get real users from API
        const token = tokenStorage.getAccessToken();

        axios.get(`${API_URL}/api/auth/users?role=sales`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => {
                // Add sales executives
                response.data.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = user.username + (user.full_name ? ` (${user.full_name})` : '');
                    select.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Error loading sales executives:', error);

                // Add current user as fallback
                const userInfo = tokenStorage.getUserInfo();
                if (userInfo && userInfo.id) {
                    const option = document.createElement('option');
                    option.value = userInfo.id;
                    option.textContent = userInfo.username + (userInfo.full_name ? ` (${userInfo.full_name})` : '');
                    select.appendChild(option);
                }
            });
    },

    // Set default form values
    setDefaultFormValues: function () {
        // Set default lead source to website
        const sourceSelect = document.getElementById('leadSource');
        if (sourceSelect && !sourceSelect.value) {
            sourceSelect.value = 'website';
        }

        // Set default lead status to new
        const statusSelect = document.getElementById('leadStatus');
        if (statusSelect && !statusSelect.value) {
            statusSelect.value = 'new';
        }

        // Set default assigned to current user
        const userInfo = tokenStorage.getUserInfo();
        if (userInfo && userInfo.id) {
            const assignedSelect = document.getElementById('leadAssignedTo');
            if (assignedSelect) {
                // Check if option exists for current user
                const options = Array.from(assignedSelect.options);
                const userOption = options.find(opt => opt.value === userInfo.id);

                // If option exists, select it
                if (userOption) {
                    assignedSelect.value = userInfo.id;
                }
                // If not, add option and select it
                else if (userInfo.username) {
                    const newOption = document.createElement('option');
                    newOption.value = userInfo.id;
                    newOption.textContent = userInfo.username + (userInfo.full_name ? ` (${userInfo.full_name})` : '');
                    assignedSelect.appendChild(newOption);
                    assignedSelect.value = userInfo.id;
                }
            }
        }
    },

    // Load all leads
    loadLeads: function () {
        console.log("loadLeads function called");

        const leadsTableBody = document.getElementById('leads-table-body');
        const noLeadsFound = document.getElementById('no-leads-found');
        const leadsLoading = document.getElementById('leads-loading');

        if (!leadsTableBody || !noLeadsFound || !leadsLoading) {
            console.error("Required DOM elements not found", {
                leadsTableBody: !!leadsTableBody,
                noLeadsFound: !!noLeadsFound,
                leadsLoading: !!leadsLoading
            });
            return;
        }

        // Show loading state
        leadsTableBody.innerHTML = '';
        noLeadsFound.classList.add('d-none');
        leadsLoading.classList.remove('d-none');

        // Get filters
        const status = document.getElementById('lead-status-filter')?.value || '';
        const source = document.getElementById('lead-source-filter')?.value || '';
        const search = document.getElementById('lead-search')?.value || '';

        // If we're in development/demo mode, generate mock data
        if (API_URL.includes('localhost') || !tokenStorage.getAccessToken().includes('.')) {
            console.log("Using mock data in development mode");
            setTimeout(() => {
                this.generateMockLeads(leadsTableBody, leadsLoading, noLeadsFound, status, source, search);
            }, 500); // Simulate network delay
            return;
        }

        // Otherwise, fetch real data from API
        console.log("Fetching leads from API...");
        let url = `${API_URL}/api/leads?limit=100`;
        if (status) url += `&status=${status}`;
        if (source) url += `&source=${source}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;

        const token = tokenStorage.getAccessToken();
        if (!token) {
            console.error("No auth token available");
            leadsLoading.classList.add('d-none');
            noLeadsFound.classList.remove('d-none');
            noLeadsFound.textContent = 'Authentication error. Please log in again.';
            return;
        }

        // Log the request we're about to make
        console.log(`Making API request to: ${url}`);

        axios.get(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => {
                console.log("API response received:", response.data);
                leadsLoading.classList.add('d-none');

                if (!response.data || response.data.length === 0) {
                    console.log("No leads found in response");
                    noLeadsFound.classList.remove('d-none');
                    return;
                }

                console.log(`Rendering ${response.data.length} leads`);

                // Render leads
                response.data.forEach(lead => {
                    this.renderLeadRow(lead, leadsTableBody);
                });
            })
            .catch(error => {
                console.error('Error loading leads:', error);
                leadsLoading.classList.add('d-none');
                noLeadsFound.classList.remove('d-none');

                // Show more detailed error message
                if (error.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    console.error("Error response data:", error.response.data);
                    console.error("Error response status:", error.response.status);
                    noLeadsFound.textContent = `Error loading leads: ${error.response.status} - ${error.response.data.detail || 'Server error'}`;
                } else if (error.request) {
                    // The request was made but no response was received
                    console.error("No response received:", error.request);
                    noLeadsFound.textContent = 'Network error. Server did not respond.';
                } else {
                    // Something happened in setting up the request
                    noLeadsFound.textContent = `Error loading leads: ${error.message}`;
                }
            });
    },

    // Generate mock leads data for development/demo purposes
    generateMockLeads: function (tableBody, loadingElement, noLeadsElement, filterStatus, filterSource, filterSearch) {
        if (loadingElement) loadingElement.classList.add('d-none');

        // Get current user
        const userInfo = tokenStorage.getUserInfo();
        const username = userInfo?.username || 'soheruwhy';

        // Mock data
        const mockLeads = [
            {
                id: 'lead1',
                full_name: 'Rajesh Kumar',
                company: 'ABC Industries',
                email: 'rajesh@abc-industries.com',
                phone: '+91 9876543210',
                source: 'website',
                status: 'hot',
                next_followup_date: new Date('2025-06-03 10:00:00').toISOString(),
                assigned_to_name: username
            },
            {
                id: 'lead2',
                full_name: 'Priya Sharma',
                company: 'Sunshine Exports',
                email: 'p.sharma@sunshine-exports.com',
                phone: '+91 8765432109',
                source: 'whatsapp',
                status: 'warm',
                next_followup_date: new Date(Date.now() + 86400000).toISOString(),
                assigned_to_name: username
            },
            {
                id: 'lead3',
                full_name: 'Anil Agarwal',
                company: 'Tech Solutions Ltd',
                email: 'anil@techsolutions.in',
                phone: '+91 7654321098',
                source: 'referral',
                status: 'cold',
                assigned_to_name: null
            },
            {
                id: 'lead4',
                full_name: 'Sneha Patel',
                company: 'Green Organics',
                email: 'sneha@greenorganics.com',
                phone: '+91 9876543211',
                source: 'facebook',
                status: 'new',
                assigned_to_name: null
            },
            {
                id: 'lead5',
                full_name: 'Vikram Singh',
                company: 'Royal Enterprises',
                email: 'vikram@royal.in',
                phone: '+91 8765432100',
                source: 'email',
                status: 'converted',
                assigned_to_name: username
            }
        ];

        // Apply filters if provided
        let filteredLeads = mockLeads;

        if (filterStatus) {
            filteredLeads = filteredLeads.filter(lead => lead.status === filterStatus);
        }

        if (filterSource) {
            filteredLeads = filteredLeads.filter(lead => lead.source === filterSource);
        }

        if (filterSearch) {
            const searchLower = filterSearch.toLowerCase();
            filteredLeads = filteredLeads.filter(lead =>
                lead.full_name.toLowerCase().includes(searchLower) ||
                (lead.company && lead.company.toLowerCase().includes(searchLower)) ||
                (lead.email && lead.email.toLowerCase().includes(searchLower)) ||
                (lead.phone && lead.phone.includes(searchLower))
            );
        }

        if (filteredLeads.length === 0) {
            noLeadsElement.classList.remove('d-none');
            return;
        }

        // Render mock leads
        noLeadsElement.classList.add('d-none');
        filteredLeads.forEach(lead => {
            this.renderLeadRow(lead, tableBody);
        });
    },

    // Render a lead row
    renderLeadRow: function (lead, tableBody) {
        const tr = document.createElement('tr');

        // Status badge class
        let statusClass = 'bg-secondary';
        if (lead.status === 'hot') statusClass = 'bg-danger';
        else if (lead.status === 'warm') statusClass = 'bg-warning';
        else if (lead.status === 'cold') statusClass = 'bg-info';
        else if (lead.status === 'converted') statusClass = 'bg-success';
        else if (lead.status === 'new') statusClass = 'bg-primary';

        // Format date
        const nextFollowup = lead.next_followup_date ? new Date(lead.next_followup_date).toLocaleString() : '-';

        tr.innerHTML = `
            <td>
                <div class="fw-bold">${lead.full_name}</div>
                <div class="small">${lead.company || '-'}</div>
            </td>
            <td>
                <div>${lead.email || '-'}</div>
                <div>${lead.phone || '-'}</div>
            </td>
            <td>${lead.source}</td>
            <td><span class="badge ${statusClass}">${lead.status}</span></td>
            <td>${lead.assigned_to_name || '-'}</td>
            <td>${nextFollowup}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary view-lead-btn" data-id="${lead.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary edit-lead-btn" data-id="${lead.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info followup-lead-btn" data-id="${lead.id}" data-name="${lead.full_name}">
                        <i class="fas fa-calendar-plus"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success quotation-lead-btn" data-id="${lead.id}" data-name="${lead.full_name}">
                        <i class="fas fa-file-invoice-dollar"></i>
                    </button>
                </div>
            </td>
        `;

        // Add event listeners
        const viewBtn = tr.querySelector('.view-lead-btn');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => this.viewLead(lead.id));
        }

        const editBtn = tr.querySelector('.edit-lead-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.showEditLeadModal(lead.id));
        }

        const followupBtn = tr.querySelector('.followup-lead-btn');
        if (followupBtn) {
            followupBtn.addEventListener('click', () => this.showFollowupModal(lead.id, lead.full_name));
        }

        const quotationBtn = tr.querySelector('.quotation-lead-btn');
        if (quotationBtn) {
            quotationBtn.addEventListener('click', () => this.showCreateQuotationModal(lead.id, lead.full_name));
        }

        tableBody.appendChild(tr);
    },

    // Load leads assigned to current user
    loadMyLeads: function () {
        const myLeadsTableBody = document.getElementById('my-leads-table-body');
        const noMyLeadsFound = document.getElementById('no-my-leads-found');

        if (!myLeadsTableBody || !noMyLeadsFound) return;

        // Show loading state
        myLeadsTableBody.innerHTML = '';
        noMyLeadsFound.classList.add('d-none');

        // Get filters
        const status = document.getElementById('my-lead-status-filter')?.value || '';
        const search = document.getElementById('my-lead-search')?.value || '';

        // In dev/demo mode, generate mock data for current user
        if (API_URL.includes('localhost') || !tokenStorage.getAccessToken().includes('.')) {
            // Get current username
            const userInfo = tokenStorage.getUserInfo();
            const username = userInfo?.username || 'soheruwhy';

            // Filter mock leads by assigned to current user
            const myLeads = [
                {
                    id: 'lead1',
                    full_name: 'Rajesh Kumar',
                    company: 'ABC Industries',
                    email: 'rajesh@abc-industries.com',
                    phone: '+91 9876543210',
                    source: 'website',
                    status: 'hot',
                    next_followup_date: new Date('2025-06-03 10:00:00').toISOString(),
                    assigned_to: 'user1',
                    assigned_to_name: username
                },
                {
                    id: 'lead2',
                    full_name: 'Priya Sharma',
                    company: 'Sunshine Exports',
                    email: 'p.sharma@sunshine-exports.com',
                    phone: '+91 8765432109',
                    source: 'whatsapp',
                    status: 'warm',
                    next_followup_date: new Date(Date.now() + 86400000).toISOString(),
                    assigned_to: 'user1',
                    assigned_to_name: username
                },
                {
                    id: 'lead5',
                    full_name: 'Vikram Singh',
                    company: 'Royal Enterprises',
                    email: 'vikram@royal.in',
                    phone: '+91 8765432100',
                    source: 'email',
                    status: 'converted',
                    assigned_to: 'user1',
                    assigned_to_name: username
                }
            ];

            // Apply filters
            let filteredLeads = myLeads;

            if (status) {
                filteredLeads = filteredLeads.filter(lead => lead.status === status);
            }

            if (search) {
                const searchLower = search.toLowerCase();
                filteredLeads = filteredLeads.filter(lead =>
                    lead.full_name.toLowerCase().includes(searchLower) ||
                    (lead.company && lead.company.toLowerCase().includes(searchLower)) ||
                    (lead.email && lead.email.toLowerCase().includes(searchLower))
                );
            }

            if (filteredLeads.length === 0) {
                noMyLeadsFound.classList.remove('d-none');
                return;
            }

            // Render my leads
            filteredLeads.forEach(lead => {
                this.renderMyLeadRow(lead, myLeadsTableBody);
            });

            return;
        }

        // API request for real data
        let url = `${API_URL}/api/leads/assigned-to-me/list?limit=100`;

        axios.get(url, {
        })
            .then(response => {
                if (!response.data || response.data.length === 0) {
                    noMyLeadsFound.classList.remove('d-none');
                    return;
                }

                // Render my leads
                response.data.forEach(lead => {
                    this.renderMyLeadRow(lead, myLeadsTableBody);
                });
            })
            .catch(error => {
                console.error('Error loading my leads:', error);
                noMyLeadsFound.classList.remove('d-none');
                noMyLeadsFound.textContent = 'Error loading leads. Please try again.';
            });
    },

    // Render a lead row for "My Leads" tab
    renderMyLeadRow: function (lead, tableBody) {
        const tr = document.createElement('tr');

        // Status badge class
        let statusClass = 'bg-secondary';
        if (lead.status === 'hot') statusClass = 'bg-danger';
        else if (lead.status === 'warm') statusClass = 'bg-warning';
        else if (lead.status === 'cold') statusClass = 'bg-info';
        else if (lead.status === 'converted') statusClass = 'bg-success';
        else if (lead.status === 'new') statusClass = 'bg-primary';

        // Format date
        const nextFollowup = lead.next_followup_date ? new Date(lead.next_followup_date).toLocaleString() : '-';

        tr.innerHTML = `
            <td>
                <div class="fw-bold">${lead.full_name}</div>
                <div class="small">${lead.company || '-'}</div>
            </td>
            <td>
                <div>${lead.email || '-'}</div>
                <div>${lead.phone || '-'}</div>
            </td>
            <td>${lead.source}</td>
            <td><span class="badge ${statusClass}">${lead.status}</span></td>
            <td>${nextFollowup}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary view-lead-btn" data-id="${lead.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info followup-lead-btn" data-id="${lead.id}" data-name="${lead.full_name}">
                        <i class="fas fa-calendar-plus"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success quotation-lead-btn" data-id="${lead.id}" data-name="${lead.full_name}">
                        <i class="fas fa-file-invoice-dollar"></i>
                    </button>
                </div>
            </td>
        `;

        // Add event listeners
        const viewBtn = tr.querySelector('.view-lead-btn');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => this.viewLead(lead.id));
        }

        const followupBtn = tr.querySelector('.followup-lead-btn');
        if (followupBtn) {
            followupBtn.addEventListener('click', () => this.showFollowupModal(lead.id, lead.full_name));
        }

        const quotationBtn = tr.querySelector('.quotation-lead-btn');
        if (quotationBtn) {
            quotationBtn.addEventListener('click', () => this.showCreateQuotationModal(lead.id, lead.full_name));
        }

        tableBody.appendChild(tr);
    },

    // Load follow-ups
    loadFollowUps: function () {
        // Load today's followups
        this.loadTodaysFollowUps();

        // Load upcoming followups
        this.loadUpcomingFollowUps();

        // Load completed followups
        this.loadCompletedFollowUps();
    },

    // Load today's followups
    loadTodaysFollowUps: function () {
        const todayFollowupsTable = document.getElementById('today-followups-table-body');
        const noTodayFollowupsFound = document.getElementById('no-today-followups-found');

        if (!todayFollowupsTable || !noTodayFollowupsFound) return;

        // Show loading state
        todayFollowupsTable.innerHTML = '';
        noTodayFollowupsFound.classList.add('d-none');

        // In demo mode, generate mock data
        if (API_URL.includes('localhost') || !tokenStorage.getAccessToken().includes('.')) {
            const mockFollowups = [
                {
                    id: 'followup1',
                    lead_id: 'lead1',
                    lead_name: 'Rajesh Kumar',
                    type: 'call',
                    scheduled_date: new Date('2025-06-02 11:30:00'),
                    status: 'pending',
                    remarks: 'Discuss technical requirements'
                },
                {
                    id: 'followup2',
                    lead_id: 'lead2',
                    lead_name: 'Priya Sharma',
                    type: 'meeting',
                    scheduled_date: new Date('2025-06-02 15:00:00'),
                    status: 'pending',
                    remarks: 'Demo presentation at client office'
                }
            ];

            if (mockFollowups.length === 0) {
                noTodayFollowupsFound.classList.remove('d-none');
                return;
            }

            // Render today's followups
            mockFollowups.forEach(followup => {
                this.renderTodayFollowupRow(followup, todayFollowupsTable);
            });

            return;
        }

        const token = tokenStorage.getAccessToken();

        axios.get(`${API_URL}/api/followups/today/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => {
                if (!response.data || response.data.length === 0) {
                    noTodayFollowupsFound.classList.remove('d-none');
                    return;
                }

                // Render today's followups
                response.data.forEach(followup => {
                    this.renderTodayFollowupRow(followup, todayFollowupsTable);
                });
            })
            .catch(error => {
                console.error('Error loading today\'s followups:', error);
                noTodayFollowupsFound.classList.remove('d-none');
                noTodayFollowupsFound.textContent = 'Error loading follow-ups. Please try again.';
            });
    },

    // Render today's followup row
    renderTodayFollowupRow: function (followup, tableBody) {
        const tr = document.createElement('tr');

        // Status badge class
        let statusClass = 'bg-secondary';
        if (followup.status === 'pending') statusClass = 'bg-warning';
        else if (followup.status === 'completed') statusClass = 'bg-success';
        else if (followup.status === 'cancelled') statusClass = 'bg-danger';
        else if (followup.status === 'rescheduled') statusClass = 'bg-info';

        // Format date
        const scheduledTime = followup.scheduled_date ? new Date(followup.scheduled_date).toLocaleTimeString() : '-';

        tr.innerHTML = `
            <td class="fw-bold">${followup.lead_name}</td>
            <td>${followup.type}</td>
            <td>${scheduledTime}</td>
            <td><span class="badge ${statusClass}">${followup.status}</span></td>
            <td>${followup.remarks || '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline-success complete-followup-btn" data-id="${followup.id}" data-lead-id="${followup.lead_id}" data-lead-name="${followup.lead_name}" data-type="${followup.type}">
                    <i class="fas fa-check me-1"></i> Complete
                </button>
            </td>
        `;

        // Add event listener
        const completeBtn = tr.querySelector('.complete-followup-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', () => this.showCompleteFollowupModal(
                followup.id,
                followup.lead_id,
                followup.lead_name,
                followup.type
            ));
        }

        tableBody.appendChild(tr);
    },

    // Load upcoming followups
    loadUpcomingFollowUps: function () {
        const upcomingFollowupsTable = document.getElementById('upcoming-followups-table-body');
        const noUpcomingFollowupsFound = document.getElementById('no-upcoming-followups-found');

        if (!upcomingFollowupsTable || !noUpcomingFollowupsFound) return;

        // Show loading state
        upcomingFollowupsTable.innerHTML = '';
        noUpcomingFollowupsFound.classList.add('d-none');

        // Get tomorrow's date
        const tomorrow = new Date('2025-06-03 00:00:00');

        // In demo mode, generate mock data
        if (API_URL.includes('localhost') || !tokenStorage.getAccessToken().includes('.')) {
            const mockFollowups = [
                {
                    id: 'followup3',
                    lead_id: 'lead5',
                    lead_name: 'Vikram Singh',
                    type: 'email',
                    scheduled_date: new Date('2025-06-03 10:00:00'),
                    status: 'pending',
                    remarks: 'Send revised quotation'
                },
                {
                    id: 'followup4',
                    lead_id: 'lead3',
                    lead_name: 'Anil Agarwal',
                    type: 'site_visit',
                    scheduled_date: new Date('2025-06-04 14:30:00'),
                    status: 'pending',
                    remarks: 'Site inspection with technical team'
                }
            ];

            if (mockFollowups.length === 0) {
                noUpcomingFollowupsFound.classList.remove('d-none');
                return;
            }

            // Render upcoming followups
            mockFollowups.forEach(followup => {
                this.renderUpcomingFollowupRow(followup, upcomingFollowupsTable);
            });

            return;
        }

        const token = tokenStorage.getAccessToken();

        axios.get(`${API_URL}/api/followups?status=pending&from_date=${tomorrow.toISOString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => {
                if (!response.data || response.data.length === 0) {
                    noUpcomingFollowupsFound.classList.remove('d-none');
                    return;
                }

                // Render upcoming followups
                response.data.forEach(followup => {
                    this.renderUpcomingFollowupRow(followup, upcomingFollowupsTable);
                });
            })
            .catch(error => {
                console.error('Error loading upcoming followups:', error);
                noUpcomingFollowupsFound.classList.remove('d-none');
                noUpcomingFollowupsFound.textContent = 'Error loading follow-ups. Please try again.';
            });
    },

    // Render upcoming followup row
    renderUpcomingFollowupRow: function (followup, tableBody) {
        const tr = document.createElement('tr');

        // Status badge class
        let statusClass = 'bg-secondary';
        if (followup.status === 'pending') statusClass = 'bg-warning';
        else if (followup.status === 'completed') statusClass = 'bg-success';
        else if (followup.status === 'cancelled') statusClass = 'bg-danger';
        else if (followup.status === 'rescheduled') statusClass = 'bg-info';

        // Format date
        const scheduledDate = followup.scheduled_date ? new Date(followup.scheduled_date).toLocaleString() : '-';

        tr.innerHTML = `
            <td class="fw-bold">${followup.lead_name}</td>
            <td>${followup.type}</td>
            <td>${scheduledDate}</td>
            <td><span class="badge ${statusClass}">${followup.status}</span></td>
            <td>${followup.remarks || '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline-secondary reschedule-followup-btn" data-id="${followup.id}" data-lead-id="${followup.lead_id}">
                    <i class="fas fa-calendar-alt me-1"></i> Reschedule
                </button>
            </td>
        `;

        // Add event listener for reschedule button
        const rescheduleBtn = tr.querySelector('.reschedule-followup-btn');
        if (rescheduleBtn) {
            rescheduleBtn.addEventListener('click', () => this.showRescheduleFollowupModal(
                followup.id,
                followup.lead_id,
                followup.lead_name
            ));
        }

        tableBody.appendChild(tr);
    },

    // Load completed followups
    loadCompletedFollowUps: function () {
        const completedFollowupsTable = document.getElementById('completed-followups-table-body');
        const noCompletedFollowupsFound = document.getElementById('no-completed-followups-found');

        if (!completedFollowupsTable || !noCompletedFollowupsFound) return;

        // Show loading state
        completedFollowupsTable.innerHTML = '';
        noCompletedFollowupsFound.classList.add('d-none');

        // In demo mode, generate mock data
        if (API_URL.includes('localhost') || !tokenStorage.getAccessToken().includes('.')) {
            const yesterday = new Date('2025-06-01');

            const mockFollowups = [
                {
                    id: 'followup5',
                    lead_id: 'lead1',
                    lead_name: 'Rajesh Kumar',
                    type: 'call',
                    scheduled_date: new Date('2025-06-01 14:00:00'),
                    actual_date: new Date('2025-06-01 14:10:00'),
                    status: 'completed',
                    remarks: 'Initial discussion',
                    feedback: 'Client requested detailed proposal. Send quotation by tomorrow.'
                },
                {
                    id: 'followup6',
                    lead_id: 'lead2',
                    lead_name: 'Priya Sharma',
                    type: 'email',
                    scheduled_date: new Date('2025-06-01 11:00:00'),
                    actual_date: new Date('2025-06-01 11:30:00'),
                    status: 'completed',
                    remarks: 'Send product brochure',
                    feedback: 'Client is comparing with competitors. Follow up in 3 days.'
                }
            ];

            if (mockFollowups.length === 0) {
                noCompletedFollowupsFound.classList.remove('d-none');
                return;
            }

            // Render completed followups
            mockFollowups.forEach(followup => {
                this.renderCompletedFollowupRow(followup, completedFollowupsTable);
            });

            return;
        }

        const token = tokenStorage.getAccessToken();

        axios.get(`${API_URL}/api/followups?status=completed&limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => {
                if (!response.data || response.data.length === 0) {
                    noCompletedFollowupsFound.classList.remove('d-none');
                    return;
                }

                // Render completed followups
                response.data.forEach(followup => {
                    this.renderCompletedFollowupRow(followup, completedFollowupsTable);
                });
            })
            .catch(error => {
                console.error('Error loading completed followups:', error);
                noCompletedFollowupsFound.classList.remove('d-none');
                noCompletedFollowupsFound.textContent = 'Error loading completed follow-ups. Please try again.';
            });
    },

    // Render completed followup row
    renderCompletedFollowupRow: function (followup, tableBody) {
        const tr = document.createElement('tr');

        // Format date
        const scheduledDate = followup.scheduled_date ? new Date(followup.scheduled_date).toLocaleString() : '-';
        const actualDate = followup.actual_date ? new Date(followup.actual_date).toLocaleString() : '-';

        tr.innerHTML = `
            <td class="fw-bold">${followup.lead_name}</td>
            <td>${followup.type}</td>
            <td>${scheduledDate}</td>
            <td>${actualDate}</td>
            <td>${followup.feedback || '-'}</td>
        `;

        tableBody.appendChild(tr);
    },
    createLead: function (leadData) {
        console.log("Creating new lead with full data:", leadData);

        // Add timestamps for consistency with backend
        leadData.created_at = new Date().toISOString();
        leadData.updated_at = new Date().toISOString();

        // Get token for authorization
        const token = tokenStorage.getAccessToken();
        if (!token) {
            showToast("No authentication token found. Please log in again.", "danger");
            return Promise.reject(new Error("No authentication token"));
        }

        // Log the exact API URL
        const apiUrl = `${API_URL}/api/leads/`;
        console.log("Sending POST request to:", apiUrl);
        console.log("With authorization token:", token.substring(0, 10) + "...");

        // Make the API call with extensive logging
        return axios.post(apiUrl, leadData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
                console.log("Lead creation API response:", response.status, response.statusText);
                console.log("Created lead data:", response.data);

                if (!response.data || !response.data.id) {
                    console.error("API returned success but without lead data/ID");
                    throw new Error("Invalid response from server");
                }

                // Test if the lead was actually created by immediately requesting it
                return this.getLead(response.data.id)
                    .then(verifiedLead => {
                        console.log("Lead verified as created:", verifiedLead);
                        return response.data; // Return original data
                    })
                    .catch(error => {
                        console.error("Lead creation succeeded but verification failed:", error);
                        throw new Error("Lead was created but couldn't be verified. Please refresh.");
                    });
            })
            .catch(error => {
                console.error("Error creating lead:", error);
                const errorMessage = error.response?.data?.detail || error.message || "Unknown error";
                const statusCode = error.response?.status || "Unknown";

                console.error(`API Error (${statusCode}): ${errorMessage}`);
                throw new Error(errorMessage);
            });
    },

    // Add a getLead method for verification
    getLead: function (id) {
        const token = tokenStorage.getAccessToken();

        return axios.get(`${API_URL}/api/leads/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => response.data)
            .catch(error => {
                console.error(`Error fetching lead ${id}:`, error);
                throw error;
            });
    },
    // Load quotations
    loadQuotations: function () {
        const quotationsTableBody = document.getElementById('quotations-table-body');
        const noQuotationsFound = document.getElementById('no-quotations-found');

        if (!quotationsTableBody || !noQuotationsFound) return;

        // Show loading state
        quotationsTableBody.innerHTML = '';
        noQuotationsFound.classList.add('d-none');

        // Get filters
        const status = document.getElementById('quotation-status-filter')?.value || '';
        const search = document.getElementById('quotation-search')?.value || '';

        // In demo mode, generate mock data
        if (API_URL.includes('localhost') || !tokenStorage.getAccessToken().includes('.')) {
            const mockQuotations = [
                {
                    id: 'quot1',
                    quotation_number: 'QT-2025-00001',
                    lead_id: 'lead1',
                    lead_name: 'Rajesh Kumar',
                    created_at: new Date('2025-06-01'),
                    total: 145000,
                    status: 'draft'
                },
                {
                    id: 'quot2',
                    quotation_number: 'QT-2025-00002',
                    lead_id: 'lead2',
                    lead_name: 'Priya Sharma',
                    created_at: new Date('2025-06-03'),
                    total: 75600,
                    status: 'sent'
                },
                {
                    id: 'quot3',
                    quotation_number: 'QT-2025-00003',
                    lead_id: 'lead5',
                    lead_name: 'Vikram Singh',
                    created_at: new Date('2025-06-05'),
                    total: 250000,
                    status: 'accepted'
                }
            ];

            // Apply filters
            let filteredQuotations = mockQuotations;

            if (status) {
                filteredQuotations = filteredQuotations.filter(quot => quot.status === status);
            }

            if (search) {
                const searchLower = search.toLowerCase();
                filteredQuotations = filteredQuotations.filter(quot =>
                    quot.lead_name.toLowerCase().includes(searchLower) ||
                    quot.quotation_number.toLowerCase().includes(searchLower)
                );
            }

            if (filteredQuotations.length === 0) {
                noQuotationsFound.classList.remove('d-none');
                return;
            }

            // Render quotations
            filteredQuotations.forEach(quotation => {
                this.renderQuotationRow(quotation, quotationsTableBody);
            });

            return;
        }

        // API request for real data
        let url = `${API_URL}/api/quotations?limit=100`;
        if (status) url += `&status=${status}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;

        const token = tokenStorage.getAccessToken();

        axios.get(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => {
                if (!response.data || response.data.length === 0) {
                    noQuotationsFound.classList.remove('d-none');
                    return;
                }

                // Render quotations
                response.data.forEach(quotation => {
                    this.renderQuotationRow(quotation, quotationsTableBody);
                });
            })
            .catch(error => {
                console.error('Error loading quotations:', error);
                noQuotationsFound.classList.remove('d-none');
                noQuotationsFound.textContent = 'Error loading quotations. Please try again.';
            });
    },

    // Render a quotation row
    renderQuotationRow: function (quotation, tableBody) {
        const tr = document.createElement('tr');

        // Status badge class
        let statusClass = 'bg-secondary';
        if (quotation.status === 'draft') statusClass = 'bg-secondary';
        else if (quotation.status === 'sent') statusClass = 'bg-info';
        else if (quotation.status === 'viewed') statusClass = 'bg-primary';
        else if (quotation.status === 'accepted') statusClass = 'bg-success';
        else if (quotation.status === 'rejected') statusClass = 'bg-danger';
        else if (quotation.status === 'expired') statusClass = 'bg-warning';

        // Format date
        const createdDate = quotation.created_at ? new Date(quotation.created_at).toLocaleDateString() : '-';

        // Format amount
        const amount = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(quotation.total);

        tr.innerHTML = `
            <td>${quotation.quotation_number}</td>
            <td>${quotation.lead_name}</td>
            <td>${createdDate}</td>
            <td>${amount}</td>
            <td><span class="badge ${statusClass}">${quotation.status}</span></td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary view-quotation-btn" data-id="${quotation.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${quotation.status === 'draft' ? `
                    <button class="btn btn-sm btn-outline-secondary edit-quotation-btn" data-id="${quotation.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline-info send-quotation-btn" data-id="${quotation.id}" 
                        ${quotation.status !== 'draft' ? 'disabled' : ''}>
                        <i class="fas fa-paper-plane"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success payment-milestone-btn" data-id="${quotation.id}" 
                        data-lead-id="${quotation.lead_id}">
                        <i class="fas fa-money-bill-wave"></i>
                    </button>
                </div>
            </td>
        `;

        // Add event listeners
        const viewBtn = tr.querySelector('.view-quotation-btn');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => this.viewQuotation(quotation.id));
        }

        const editBtn = tr.querySelector('.edit-quotation-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.editQuotation(quotation.id));
        }

        const sendBtn = tr.querySelector('.send-quotation-btn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendQuotation(quotation.id));
        }

        const milestoneBtn = tr.querySelector('.payment-milestone-btn');
        if (milestoneBtn) {
            milestoneBtn.addEventListener('click', () => this.showPaymentMilestoneModal(quotation.id, quotation.lead_id));
        }

        tableBody.appendChild(tr);
    },

    // Show create lead modal
    showCreateLeadModal: function () {
        // Reset form
        const leadForm = document.getElementById('leadForm');
        if (leadForm) leadForm.reset();

        // Reset hidden fields
        const leadIdField = document.getElementById('leadId');
        if (leadIdField) leadIdField.value = '';

        // Set modal title and button text
        const modalTitle = document.getElementById('leadModalLabel');
        if (modalTitle) modalTitle.textContent = 'Add New Lead';

        const saveBtn = document.getElementById('saveLeadBtnText');
        if (saveBtn) saveBtn.textContent = 'Save Lead';

        // Set default values
        this.setDefaultFormValues();

        // Show modal
        const leadModal = new bootstrap.Modal(document.getElementById('leadModal'));
        leadModal.show();
    },

    // View lead details
    viewLead: function (leadId) {
        // In a real implementation, this could open a detailed view
        // For now, we'll just open the edit modal
        this.showEditLeadModal(leadId);
    },

    // Handle lead form submission
    handleLeadFormSubmit: function (e) {
        e.preventDefault();

        // Get form data
        const leadId = document.getElementById('leadId').value;
        const isEdit = !!leadId;

        // Get all form values
        const formData = {
            full_name: document.getElementById('leadFullName').value,
            company: document.getElementById('leadCompany').value,
            email: document.getElementById('leadEmail').value,
            phone: document.getElementById('leadPhone').value,
            source: document.getElementById('leadSource').value,
            status: document.getElementById('leadStatus').value,
            requirements: document.getElementById('leadRequirements').value,
            notes: document.getElementById('leadNotes').value,
            assigned_to: document.getElementById('leadAssignedTo').value || null,
            // Add timestamps for backend consistency
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Validate required fields
        if (!formData.full_name) {
            this.showLeadAlert('Lead name is required.', 'danger');
            return;
        }

        // Show loading state
        const saveBtn = document.getElementById('saveLeadBtn');
        const saveBtnText = document.getElementById('saveLeadBtnText');
        const saveBtnLoading = document.getElementById('saveLeadBtnLoading');

        if (saveBtn) saveBtn.disabled = true;
        if (saveBtnText) saveBtnText.classList.add('d-none');
        if (saveBtnLoading) saveBtnLoading.classList.remove('d-none');

        // In dev/demo mode, simulate success
        if (API_URL.includes('localhost') || !tokenStorage.getAccessToken().includes('.')) {
            setTimeout(() => {
                // Hide modal - NOTE: Check for both possible modal IDs
                const leadModal = bootstrap.Modal.getInstance(document.getElementById('leadModal')) ||
                    bootstrap.Modal.getInstance(document.getElementById('createLeadModal'));
                if (leadModal) leadModal.hide();

                // Show success alert
                this.showLeadAlert(`Lead ${isEdit ? 'updated' : 'created'} successfully!`, 'success');

                // Reset form
                const leadForm = document.getElementById('leadForm');
                if (leadForm) leadForm.reset();

                // Refresh lead listings
                this.loadLeads();
                if (this.loadMyLeads) this.loadMyLeads();
                if (this.loadDashboardStats) this.loadDashboardStats();

                // Reset loading state
                if (saveBtn) saveBtn.disabled = false;
                if (saveBtnText) saveBtnText.classList.remove('d-none');
                if (saveBtnLoading) saveBtnLoading.classList.add('d-none');
            }, 1000);
            return;
        }

        // API request for real data
        const token = tokenStorage.getAccessToken();
        const url = isEdit ? `${API_URL}/api/leads/${leadId}` : `${API_URL}/api/leads`;
        const method = isEdit ? 'put' : 'post';

        console.log(`[DEBUG] ${method.toUpperCase()} ${url}`, formData);

        axios({
            method: method,
            url: url,
            data: formData,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
                console.log('[SUCCESS] Lead saved:', response.data);

                // Hide modal - check for both possible modal IDs
                const leadModal = bootstrap.Modal.getInstance(document.getElementById('leadModal')) ||
                    bootstrap.Modal.getInstance(document.getElementById('createLeadModal'));
                if (leadModal) {
                    leadModal.hide();
                } else {
                    console.warn('[WARN] Could not find modal to hide');
                }

                // Show success alert
                this.showLeadAlert(`Lead ${isEdit ? 'updated' : 'created'} successfully!`, 'success');

                // Reset form
                const leadForm = document.getElementById('leadForm');
                if (leadForm) leadForm.reset();

                // Important: Delay to ensure database consistency
                setTimeout(() => {
                    // Force a complete reload of leads
                    console.log('[DEBUG] Refreshing lead data');

                    // Refresh lead listings - with catch for missing methods
                    this.loadLeads();
                    if (typeof this.loadMyLeads === 'function') this.loadMyLeads();
                    if (typeof this.loadDashboardStats === 'function') this.loadDashboardStats();
                }, 500);
            })
            .catch(error => {
                console.error('[ERROR] Saving lead failed:', error);

                // Extract detailed error message
                let errorMsg = 'Error saving lead. Please try again.';
                if (error.response?.data?.detail) {
                    errorMsg = error.response.data.detail;
                } else if (error.response?.data?.message) {
                    errorMsg = error.response.data.message;
                } else if (error.message) {
                    errorMsg = error.message;
                }

                this.showLeadAlert(`Error: ${errorMsg}`, 'danger');

                // Log additional debug info
                console.log('[DEBUG] Form data that failed:', formData);
                console.log('[DEBUG] API URL that failed:', url);
                console.log('[DEBUG] Request method:', method);
            })
            .finally(() => {
                // Reset loading state
                if (saveBtn) saveBtn.disabled = false;
                if (saveBtnText) saveBtnText.classList.remove('d-none');
                if (saveBtnLoading) saveBtnLoading.classList.add('d-none');
            });
    },

    // Add this helper function to test database connection directly
    testDBConnection: function () {
        const token = tokenStorage.getAccessToken();

        axios.get(`${API_URL}/api/leads?limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => {
                console.log('[DEBUG] Database test successful:', response.data);
                this.showLeadAlert('Database connection successful!', 'success');
            })
            .catch(error => {
                console.error('[ERROR] Database test failed:', error);
                this.showLeadAlert('Database connection failed!', 'danger');
            });
    }
};

// Date/Time and User Display Module (should be in a separate file)
const dateTimeUserDisplay = {
    // Initialize the module
    init: function () {
        console.log("Initializing Date/Time and User Display...");

        // Get display elements
        this.dateTimeElement = document.getElementById('current-datetime');
        this.userNameElement = document.getElementById('user-name');

        // Set initial values
        this.updateDateTime();
        this.setUserName();

        // Update time every second
        setInterval(this.updateDateTime.bind(this), 1000);
    },

    // Update the date and time display
    updateDateTime: function () {
        if (!this.dateTimeElement) return;

        const now = new Date();

        // Format as UTC time in YYYY-MM-DD HH:MM:SS format
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const day = String(now.getUTCDate()).padStart(2, '0');
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');

        const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        this.dateTimeElement.textContent = formattedDateTime;

        // Add tooltip with local time
        const localTimeString = now.toLocaleString();
        this.dateTimeElement.title = `Local time: ${localTimeString}`;
    },

    // Set the username display
    setUserName: function () {
        if (!this.userNameElement) return;

        // Get user info from token storage or use a default
        const userInfo = tokenStorage.getUserInfo();
        const username = userInfo?.username || 'soheru';

        // Set the username in the display
        this.userNameElement.textContent = username;
    }
};



document.addEventListener("DOMContentLoaded", function () {
    checkDatabaseConnection();

    function checkDatabaseConnection() {
        const statusEl = document.getElementById('db-connection-status');
        if (!statusEl) return;

        statusEl.className = 'alert alert-info mb-3';
        statusEl.textContent = 'Checking database connection...';

        const token = tokenStorage.getAccessToken();

        axios.get(`${API_URL}/api/leads/test-db-connection`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => {
                if (response.data.success) {
                    statusEl.className = 'alert alert-success mb-3';
                    statusEl.textContent = `Database connected. ${response.data.leads_count} leads found.`;
                    setTimeout(() => {
                        statusEl.style.display = 'none';
                    }, 5000);
                } else {
                    statusEl.className = 'alert alert-warning mb-3';
                    statusEl.textContent = `Database issue: ${response.data.message}`;
                }
            })
            .catch(error => {
                statusEl.className = 'alert alert-danger mb-3';
                statusEl.textContent = `Database connection error: ${error.response?.data?.detail || error.message}`;
            });
    }
    // Directly attach event listener to refresh button
    const refreshBtn = document.getElementById('refresh-leads-btn');
    if (refreshBtn) {
        console.log("Found refresh button, attaching event listener");
        refreshBtn.addEventListener('click', function () {
            console.log("Refresh button clicked");
            // Explicitly call the loadLeads function with the correct context
            leadManagement.loadLeads();
        });
    } else {
        console.error("Refresh button not found in DOM");
    }
});
// Initialize the modules when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    dateTimeUserDisplay.init();
    leadManagement.init();
});