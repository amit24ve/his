/**
 * B2B CRM - Lead Management System
 * Version: 2.3.0
 * Last Updated: 2025-06-05
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log("Initializing CRM application...");
    
    // Base API URL
    const API_URL = '/api/lead';
    
    // Current user and authentication data
    const currentUser = {
        username: 'soheru',
        token: localStorage.getItem('access_token') || 'demo_token'
    };

    // State variables
    let leads = []; // Current page of leads
    let leadSources = [];
    let salesUsers = []; // All users who can be assigned leads 
    let currentPage = 1;
    let totalLeads = 0;
    let pageSize = 10;
    let filterParams = {
        source: '',
        campaign: '',
        assigned_to: '',
        search: ''
    };

    // LOCAL STORAGE key for assignments
    const ASSIGNMENTS_STORAGE_KEY = 'bharat_crm_lead_assignments';

    // Role definitions
    const ROLES = {
        SALES_EXECUTIVE: 'sales_executive',
        SALES_MANAGER: 'sales_manager',
        ACCOUNT_MANAGER: 'account_manager',
        SUPPORT_AGENT: 'support_agent',
        ADMIN: 'admin'
    };

    // Role display names
    const ROLE_NAMES = {
        sales_executive: 'Sales Executive',
        sales_manager: 'Sales Manager',
        account_manager: 'Account Manager',
        support_agent: 'Support Agent',
        admin: 'Administrator'
    };

    // Keep track of whether filters are active
    let filtersActive = false;
    
    // Store all leads for client-side filtering and pagination
    let allLeads = [];
    
    // Store lead assignments - using localStorage instead of API
    let leadAssignments = [];

    /**
     * Fix DOM issues that are causing problems
     */
    function fixDOMIssues() {
        console.log("Fixing DOM issues...");
        
        // 1. Fix duplicate filter section
        fixDuplicateFilterSection();
        
        // 2. Fix duplicate modals
        fixDuplicateModals();
        
        // 3. Fix duplicate source filter
        fixDuplicateSourceFilter();
        
        // 4. Fix assignment modal missing team select
        fixAssignmentModal();
    }

    /**
     * Fix duplicate filter section issue
     */
    function fixDuplicateFilterSection() {
        const filterSections = document.querySelectorAll('.filter-section');
        console.log(`Found ${filterSections.length} filter sections`);
        
        if (filterSections.length > 1) {
            // Keep only the first one
            for (let i = 1; i < filterSections.length; i++) {
                filterSections[i].parentNode.removeChild(filterSections[i]);
            }
        }
        
        // Make sure it's in the right place - before the Recent Leads card
        if (filterSections.length > 0) {
            const filterSection = filterSections[0];
            const recentLeadsCard = document.querySelector('.row:last-child .card');
            
            if (recentLeadsCard && filterSection.parentNode !== recentLeadsCard.parentNode) {
                recentLeadsCard.parentElement.insertBefore(filterSection, recentLeadsCard);
            }
        }
    }

    /**
     * Fix duplicate modals issues
     */
    function fixDuplicateModals() {
        // Elements that might have duplicates
        const modalIds = ['lead-assignment-modal', 'lead-details-modal'];
        
        modalIds.forEach(id => {
            const elements = document.querySelectorAll(`#${id}`);
            if (elements.length > 1) {
                console.log(`Found ${elements.length} elements with ID "${id}", removing duplicates...`);
                
                // Keep the last one (most complete), remove the rest
                for (let i = 0; i < elements.length - 1; i++) {
                    elements[i].parentNode.removeChild(elements[i]);
                }
            }
        });
    }

    /**
     * Fix duplicate source filter issues
     */
    function fixDuplicateSourceFilter() {
        // The problem is there are two source-filter selects
        // 1. One in the filter section
        // 2. One in the card header
        
        const sourceFilters = document.querySelectorAll('#source-filter');
        if (sourceFilters.length > 1) {
            console.log(`Found ${sourceFilters.length} source-filter elements, fixing...`);
            
            // Keep the one in the filter section, rename the one in the card header
            const filterSectionSourceFilter = document.querySelector('.filter-section #source-filter');
            
            sourceFilters.forEach(filter => {
                // If it's not the filter section one, rename it
                if (filter !== filterSectionSourceFilter) {
                    filter.id = 'source-filter-card';
                }
            });
        }
    }

    /**
     * Fix lead assignment modal
     */
    function fixAssignmentModal() {
        // Check if we need to add a sales executive select to the modal
        const modal = document.querySelector('#lead-assignment-modal');
        if (!modal) return;
        
        // Check if the modal has a role select but no sales executive select
        const roleSelect = modal.querySelector('#role-select');
        const salesExecutiveSelect = modal.querySelector('#sales-executive-select');
        
        if (roleSelect && !salesExecutiveSelect) {
            // Find where to insert the sales executive select
            const notesGroup = modal.querySelector('#assignment-notes').closest('.mb-3');
            if (notesGroup) {
                // Create sales executive select div
                const teamSelectDiv = document.createElement('div');
                teamSelectDiv.className = 'mb-3';
                teamSelectDiv.innerHTML = `
                    <label for="sales-executive-select" class="form-label">Select Team Member</label>
                    <select class="form-select" id="sales-executive-select">
                        <option value="" selected disabled>Select a team member</option>
                    </select>
                `;
                
                // Insert before notes
                notesGroup.parentNode.insertBefore(teamSelectDiv, notesGroup);
                
                // Add event listener to role select
                roleSelect.addEventListener('change', function() {
                    filterUsersByRole(this.value);
                });
            }
        }
    }

    // Fix DOM issues first
    fixDOMIssues();

    // Initialize element references after fixing DOM issues
    function initElements() {
        return {
            // Tables and containers
            leadsTableBody: document.getElementById('leads-table-body'),
            sourcesTableBody: document.getElementById('sources-table-body'),
            noLeadsMessage: document.getElementById('no-leads-message'),
            noSourcesMessage: document.getElementById('no-sources-message'),
            leadsLoading: document.getElementById('leads-loading'),
            sourcesLoading: document.getElementById('sources-loading'),
            
            // Pagination elements
            pageInfo: document.getElementById('page-info'),
            prevPageBtn: document.getElementById('prev-page-btn'),
            nextPageBtn: document.getElementById('next-page-btn'),
            
            // Filters and counts
            sourceFilter: document.getElementById('source-filter'),
            campaignFilter: document.getElementById('campaign-filter'),
            assignedToFilter: document.getElementById('assigned-to-filter'),
            leadSearch: document.getElementById('lead-search'),
            applyFiltersBtn: document.getElementById('apply-filters-btn'),
            resetFiltersBtn: document.getElementById('reset-filters-btn'),
            totalLeadsBadge: document.getElementById('total-leads-badge'),
            totalSourcesBadge: document.getElementById('total-sources-badge'),
            
            // Buttons
            refreshLeadsBtn: document.getElementById('refresh-leads-btn'),
            newIntegrationBtn: document.getElementById('new-integration-btn'),
            sheetsIntegrationBtn: document.getElementById('sheets-integration-btn'),
            metaIntegrationBtn: document.getElementById('meta-integration-btn'),
            
            // Google Sheets form elements
            googleSheetsModal: document.getElementById('google-sheets-modal') ? 
                new bootstrap.Modal(document.getElementById('google-sheets-modal')) : null,
            googleSheetsForm: document.getElementById('google-sheets-form'),
            spreadsheetUrl: document.getElementById('spreadsheet-url'),
            sheetName: document.getElementById('sheet-name'),
            headerRow: document.getElementById('header-row'),
            sheetsSpinner: document.getElementById('sheets-spinner'),
            
            // Meta Ads form elements
            metaAdsModal: document.getElementById('meta-ads-modal') ? 
                new bootstrap.Modal(document.getElementById('meta-ads-modal')) : null,
            metaAdsForm: document.getElementById('meta-ads-form'),
            accessToken: document.getElementById('access-token'),
            adAccountId: document.getElementById('ad-account-id'),
            formId: document.getElementById('form-id'),
            addMetaMappingBtn: document.getElementById('add-meta-mapping-btn'),
            metaSpinner: document.getElementById('meta-spinner'),
            
            // Lead assignment elements
            leadAssignmentModal: document.getElementById('lead-assignment-modal') ? 
                new bootstrap.Modal(document.getElementById('lead-assignment-modal')) : null,
            assignLeadId: document.getElementById('assign-lead-id'),
            assignLeadName: document.getElementById('assign-lead-name'),
            roleSelect: document.getElementById('role-select'),
            salesExecutiveSelect: document.getElementById('sales-executive-select'),
            assignmentNotes: document.getElementById('assignment-notes'),
            confirmAssignBtn: document.getElementById('confirm-assign-btn'),
            assignSpinner: document.getElementById('assign-spinner'),
            
            // Lead details modal
            leadDetailsModal: document.getElementById('lead-details-modal') ? 
                new bootstrap.Modal(document.getElementById('lead-details-modal')) : null,
            leadDetailsBody: document.getElementById('lead-details-body'),
            
            // Delete source modal elements
            deleteSourceModal: document.getElementById('delete-source-modal') ? 
                new bootstrap.Modal(document.getElementById('delete-source-modal')) : null,
            sourceIdInput: document.getElementById('source-id-input'),
            confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
            
            // Toast notification
            toast: document.getElementById('toast-notification') ? 
                new bootstrap.Toast(document.getElementById('toast-notification')) : null,
            toastMessage: document.getElementById('toast-message'),
            
            // Date and user elements
            currentDatetime: document.getElementById('current-datetime'),
            userName: document.getElementById('user-name')
        };
    }

    const elements = initElements();

    // Initialize the application
    function init() {
        // Set current date and time as requested
        const datetimeElement = document.getElementById('current-datetime');
        if (datetimeElement) {
            datetimeElement.textContent = '2025-06-05 13:01:48';
        }
        
        // Set current username
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            userNameElement.textContent = 'soheru';
        }
        
        // Set up event listeners
        setupEventListeners();
        
        // Load initial data
        initializeSampleUsers(); // Create sample users since API endpoint is missing
        loadLeadAssignmentsFromLocalStorage(); // Load assignments from localStorage
        loadSalesUsers().then(() => {
            loadLeadAssignments().then(() => {
                loadAllLeads().then(() => {
                    loadLeadSources();
                    updateLeadsWithAssignments();
                });
            });
        });
    }

    // Set up event listeners
    function setupEventListeners() {
        // Attach event listeners to navigation links
        document.getElementById('dashboard-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/dashboard';
        });
        
        document.getElementById('leads-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/leads';
        });
        
        document.getElementById('logout-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('access_token');
            window.location.href = '/login';
        });
        
        // Refresh button
        elements.refreshLeadsBtn?.addEventListener('click', refreshData);
        
        // Integration buttons
        elements.newIntegrationBtn?.addEventListener('click', () => {
            if (elements.googleSheetsModal) elements.googleSheetsModal.show();
        });
        
        elements.sheetsIntegrationBtn?.addEventListener('click', () => {
            if (elements.googleSheetsModal) elements.googleSheetsModal.show();
        });
        
        elements.metaIntegrationBtn?.addEventListener('click', () => {
            if (elements.metaAdsModal) elements.metaAdsModal.show();
        });
        
        // Form submissions
        elements.googleSheetsForm?.addEventListener('submit', handleGoogleSheetsSubmit);
        elements.metaAdsForm?.addEventListener('submit', handleMetaAdsSubmit);
        
        // Add mapping button for Meta
        elements.addMetaMappingBtn?.addEventListener('click', addMetaMapping);
        
        // Delete source confirmation
        elements.confirmDeleteBtn?.addEventListener('click', confirmDeleteSource);
        
        // Pagination buttons
        elements.prevPageBtn?.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                displayPageOfLeads();
            }
        });
        
        elements.nextPageBtn?.addEventListener('click', () => {
            if (currentPage * pageSize < totalLeads) {
                currentPage++;
                displayPageOfLeads();
            }
        });
        
        // Filter buttons
        const applyFiltersBtn = document.querySelector('#apply-filters-btn');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', applyFilters);
        }
        
        const resetFiltersBtn = document.querySelector('#reset-filters-btn');
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', resetFilters);
        }
        
        // Search input - apply filter on Enter key
        const leadSearch = document.querySelector('#lead-search');
        if (leadSearch) {
            leadSearch.addEventListener('keyup', function(e) {
                if (e.key === 'Enter') {
                    applyFilters();
                }
            });
        }
        
        // Role select - filter users by role
        if (elements.roleSelect) {
            elements.roleSelect.addEventListener('change', function() {
                filterUsersByRole(this.value);
            });
        }
        
        // Lead assignment button
        elements.confirmAssignBtn?.addEventListener('click', assignLead);
        
        // Set up delegation for dynamic elements
        document.addEventListener('click', function(e) {
            // Handle mapping row removal
            if (e.target.closest('.remove-mapping-btn')) {
                const row = e.target.closest('.mapping-row');
                if (row && row.parentElement.children.length > 1) {
                    row.remove();
                }
            }
            
            // Handle lead assignment button clicks
            if (e.target.closest('.assign-lead-btn')) {
                e.preventDefault();
                const btn = e.target.closest('.assign-lead-btn');
                openAssignModal(btn.dataset.id, btn.dataset.name);
            }
            
            // Handle view lead details button clicks
            if (e.target.closest('.view-lead-btn')) {
                e.preventDefault();
                const btn = e.target.closest('.view-lead-btn');
                viewLeadDetails(btn.dataset.id);
            }
            
            // Handle delete source button clicks
            if (e.target.closest('.delete-source-btn')) {
                e.preventDefault();
                const btn = e.target.closest('.delete-source-btn');
                if (confirm("Are you sure you want to delete this lead source?")) {
                    deleteSource(btn.dataset.id);
                }
            }
            
            // Handle sync source button clicks
            if (e.target.closest('.sync-source-btn')) {
                e.preventDefault();
                const btn = e.target.closest('.sync-source-btn');
                syncSource(btn.dataset.id);
            }
        });
    }

    // Initialize sample users since the API endpoint is missing
    function initializeSampleUsers() {
        salesUsers = [
            { id: "1", name: "Alex Johnson", email: "alex@example.com", role: "sales_executive" },
            { id: "2", name: "Priya Sharma", email: "priya@example.com", role: "sales_executive" },
            { id: "3", name: "Raj Patel", email: "raj@example.com", role: "sales_manager" },
            { id: "4", name: "Sarah Khan", email: "sarah@example.com", role: "account_manager" },
            { id: "5", name: "Vikram Singh", email: "vikram@example.com", role: "account_manager" },
            { id: "6", name: "John Smith", email: "john@example.com", role: "sales_executive" },
            { id: "7", name: "Maria Garcia", email: "maria@example.com", role: "sales_manager" },
            { id: "8", name: "soheru", email: "soheru@example.com", role: "admin" }
        ];
        
        // Update user dropdowns
        updateUserSelects();
    }


    // Load lead assignments from database
    async function loadLeadAssignments() {
        try {
            console.log("Loading lead assignments from database");
            
            const response = await axios.get(`${API_URL}/assignments`, {
                headers: { Authorization: `Bearer ${currentUser.token}` }
            });
            
            if (response.data && Array.isArray(response.data)) {
                leadAssignments = response.data;
                
                // Update leads with assignment data
                updateLeadsWithAssignments();
                
                console.log(`Loaded ${leadAssignments.length} assignments from database`);
            }
        } catch (error) {
            console.error("Error loading lead assignments:", error);
            showToast("Failed to load assignment data", "error");
            
            // Fallback to localStorage
            loadLeadAssignmentsFromLocalStorage();
        }
    }
    
    // Load assignments from localStorage
    function loadLeadAssignmentsFromLocalStorage() {
        try {
            const storedAssignments = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
            if (storedAssignments) {
                leadAssignments = JSON.parse(storedAssignments);
                console.log(`Loaded ${leadAssignments.length} assignments from localStorage`);
            } else {
                leadAssignments = [];
                console.log("No saved assignments found in localStorage");
            }
        } catch (error) {
            console.error("Error loading assignments from localStorage:", error);
            leadAssignments = [];
        }
    }
    
    // Save assignments to localStorage
    function saveAssignmentsToLocalStorage() {
        try {
            localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(leadAssignments));
            console.log(`Saved ${leadAssignments.length} assignments to localStorage`);
        } catch (error) {
            console.error("Error saving assignments to localStorage:", error);
            showToast("Error saving assignment data", "error");
        }
    }

    // Update leads with assignment data from localStorage
    function updateLeadsWithAssignments() {
        if (!leadAssignments || leadAssignments.length === 0) return;
        
        // Update all leads with assignment information
        allLeads.forEach(lead => {
            const assignment = leadAssignments.find(a => a.lead_id === (lead.id || lead._id));
            if (assignment) {
                lead.assigned_to = assignment.user_id;
                lead.assigned_role = assignment.role;
                lead.assigned_to_name = assignment.user_name;
                lead.assignment_notes = assignment.notes;
                lead.assignment_date = assignment.created_at;
                lead.last_updated = assignment.updated_at;
            }
        });
        
        // Update current page of leads
        renderLeadsTable();
    }

    // Load ALL leads at once (no pagination)
    async function loadAllLeads() {
        try {
            if (elements.leadsLoading) elements.leadsLoading.classList.remove('d-none');
            if (elements.noLeadsMessage) elements.noLeadsMessage.classList.add('d-none');
            
            console.log("Loading all leads...");
            
            const response = await axios.get(`${API_URL}/leads`, {
                params: { limit: 1000 }, // High limit to get all leads
                headers: { Authorization: `Bearer ${currentUser.token}` }
            });
            
            // Better handling of MongoDB-style response structure
            if (response.data && typeof response.data === 'object') {
                if (Array.isArray(response.data.data)) {
                    // Format 1: { data: [...], total: X }
                    allLeads = response.data.data;
                    totalLeads = response.data.total || allLeads.length;
                } else if (Array.isArray(response.data)) {
                    // Format 2: Direct array
                    allLeads = response.data;
                    totalLeads = response.data.length;
                } else {
                    // Format 3: Unexpected format, fallback
                    allLeads = [];
                    totalLeads = 0;
                    console.warn("Unexpected response format:", response.data);
                }
            } else {
                allLeads = [];
                totalLeads = 0;
            }
            
            console.log(`Loaded ${allLeads.length} leads`);
            
            // Display the first page of leads
            displayPageOfLeads();
            
            return allLeads;
        } catch (error) {
            console.error('Error loading leads:', error);
            showToast('Failed to load leads', 'error');
            allLeads = [];
            leads = [];
            renderLeadsTable();
            return [];
        } finally {
            if (elements.leadsLoading) elements.leadsLoading.classList.add('d-none');
        }
    }

    // Common function for showing the current page of leads
    function displayPageOfLeads() {
        console.log(`Displaying page ${currentPage} of leads...`);
        
        let displayLeads = [];
        
        if (filtersActive) {
            // Apply filters to all leads
            const filteredLeads = filterLeads(allLeads);
            totalLeads = filteredLeads.length;
            
            // Get current page
            const start = (currentPage - 1) * pageSize;
            const end = start + pageSize;
            displayLeads = filteredLeads.slice(start, end);
        } else {
            // Just show the current page from all leads
            const start = (currentPage - 1) * pageSize;
            const end = start + pageSize;
            displayLeads = allLeads.slice(start, end);
            totalLeads = allLeads.length;
        }
        
        // Update the current page of leads and render
        leads = displayLeads;
        console.log(`Showing ${leads.length} leads on page ${currentPage}`);
        
        renderLeadsTable();
        updatePagination();
    }

    // Apply filters - Updated to use client-side filtering
    function applyFilters() {
        console.log("Applying filters...");
        
        // Get filter values directly from DOM
        const sourceFilter = document.querySelector('#source-filter');
        const campaignFilter = document.querySelector('#campaign-filter');
        const assignedToFilter = document.querySelector('#assigned-to-filter');
        const leadSearch = document.querySelector('#lead-search');
        
        // Update filter parameters
        filterParams.source = sourceFilter ? sourceFilter.value : '';
        filterParams.campaign = campaignFilter ? campaignFilter.value : '';
        filterParams.assigned_to = assignedToFilter ? assignedToFilter.value : '';
        filterParams.search = leadSearch ? leadSearch.value : '';
        
        console.log("Filter parameters:", filterParams);
        
        // Check if any filters are active
        filtersActive = Boolean(filterParams.source || filterParams.campaign || 
                                filterParams.assigned_to || filterParams.search);
        
        // Reset to first page
        currentPage = 1;
        
        // Display leads with filter
        displayPageOfLeads();
        
        // Show toast confirmation
        showToast('Filters applied successfully');
    }

    // Filter the leads array based on current filter params
    function filterLeads(leadsArray) {
        if (!filterParams.source && !filterParams.campaign && 
            !filterParams.assigned_to && !filterParams.search) {
            return leadsArray;
        }
        
        return leadsArray.filter(lead => {
            // Source filter
            if (filterParams.source) {
                if (lead.source !== filterParams.source && lead.source_type !== filterParams.source) {
                    return false;
                }
            }
            
            // Campaign filter
            if (filterParams.campaign) {
                if (lead.campaign !== filterParams.campaign) {
                    return false;
                }
            }
            
            // Assignment filter
            if (filterParams.assigned_to) {
                if (filterParams.assigned_to === 'unassigned') {
                    if (lead.assigned_to) return false;
                } else {
                    if (lead.assigned_to !== filterParams.assigned_to) return false;
                }
            }
            
            // Text search
            if (filterParams.search) {
                const searchTermLower = filterParams.search.toLowerCase();
                
                // Check multiple possible fields for search term
                const nameMatch = (lead.name || lead.full_name || lead.fullName || lead.Name || '')
                    .toString().toLowerCase().includes(searchTermLower);
                    
                const emailMatch = (lead.email || lead.Email || lead.EMAIL || lead.emailAddress || lead.email_address || '')
                    .toString().toLowerCase().includes(searchTermLower);
                    
                const phoneMatch = (lead.phone || lead.Phone || lead.PHONE || lead.phoneNumber || lead.phone_number || '')
                    .toString().toLowerCase().includes(searchTermLower);
                
                if (!nameMatch && !emailMatch && !phoneMatch) {
                    return false;
                }
            }
            
            return true;
        });
    }

    // Reset all filters
    function resetFilters() {
        console.log("Resetting filters...");
        
        // Reset form elements directly from DOM
        const sourceFilter = document.querySelector('#source-filter');
        const campaignFilter = document.querySelector('#campaign-filter');
        const assignedToFilter = document.querySelector('#assigned-to-filter');
        const leadSearch = document.querySelector('#lead-search');
        
        if (sourceFilter) sourceFilter.value = '';
        if (campaignFilter) campaignFilter.value = '';
        if (assignedToFilter) assignedToFilter.value = '';
        if (leadSearch) leadSearch.value = '';
        
        // Reset filter parameters
        filterParams = {
            source: '',
            campaign: '',
            assigned_to: '',
            search: ''
        };
        
        // Set filters inactive
        filtersActive = false;
        
        // Reset to first page
        currentPage = 1;
        
        // Display first page of all leads
        displayPageOfLeads();
        
        // Show toast confirmation
        showToast('Filters reset successfully');
    }
    
    // Update all user selection dropdowns
    function updateUserSelects() {
        // Update assigned-to filter in the main UI
        if (elements.assignedToFilter) {
            elements.assignedToFilter.innerHTML = `
                <option value="">All Users</option>
                <option value="unassigned">Unassigned</option>
            `;
            
            salesUsers.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.name;
                // Add role as data attribute
                option.dataset.role = user.role;
                elements.assignedToFilter.appendChild(option);
            });
        }
    }

    // Filter users in the sales executive select by role
    function filterUsersByRole(role) {
        console.log("Filtering users by role:", role);
        
        if (!elements.salesExecutiveSelect) return;
        
        // Reset the select
        elements.salesExecutiveSelect.innerHTML = '<option value="" selected disabled>Select a team member</option>';
        
        // If no role selected, show all users
        if (!role) {
            salesUsers.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.name;
                elements.salesExecutiveSelect.appendChild(option);
            });
            return;
        }
        
        // Filter users by role
        const filteredUsers = salesUsers.filter(user => user.role === role);
        
        // If no users found for this role
        if (filteredUsers.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.disabled = true;
            option.textContent = "No users available for this role";
            elements.salesExecutiveSelect.appendChild(option);
            return;
        }
        
        // Add filtered users to dropdown
        filteredUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name;
            elements.salesExecutiveSelect.appendChild(option);
        });
    }

    // Open lead assignment modal
    function openAssignModal(leadId, leadName) {
        if (!elements.leadAssignmentModal) {
            console.error("Lead assignment modal not available");
            return;
        }
        
        // Check if lead is already assigned
        const lead = allLeads.find(l => (l.id === leadId || l._id === leadId));
        const isReassignment = lead && lead.assigned_to;
        
        if (elements.assignLeadId) elements.assignLeadId.value = leadId;
        if (elements.assignLeadName) {
            elements.assignLeadName.textContent = leadName || 'Selected Lead';
            if (isReassignment) {
                const currentAssignee = salesUsers.find(u => u.id === lead.assigned_to);
                if (currentAssignee) {
                    elements.assignLeadName.innerHTML = `${leadName} <span class="text-muted">(currently assigned to ${currentAssignee.name})</span>`;
                }
            }
        }
        
        // Reset role and user selects
        if (elements.roleSelect) {
            elements.roleSelect.value = lead && lead.assigned_role ? lead.assigned_role : '';
            
            // If role is preselected, filter users by that role
            if (lead && lead.assigned_role) {
                filterUsersByRole(lead.assigned_role);
                
                // Preselect the current assignee if this is a reassignment
                if (isReassignment && elements.salesExecutiveSelect) {
                    elements.salesExecutiveSelect.value = lead.assigned_to;
                }
            } else {
                if (elements.salesExecutiveSelect) {
                    // Reset and populate with placeholder
                    elements.salesExecutiveSelect.innerHTML = '<option value="" selected disabled>Please select a role first</option>';
                }
            }
        }
        
        if (elements.assignmentNotes) {
            elements.assignmentNotes.value = lead && lead.assignment_notes ? lead.assignment_notes : '';
        }
        
        elements.leadAssignmentModal.show();
    }

    // Assign lead to team member - Using API and falling back to localStorage
    async function assignLead() {
        const leadId = elements.assignLeadId?.value;
        const salesUserId = elements.salesExecutiveSelect?.value;
        const role = elements.roleSelect?.value;
        const notes = elements.assignmentNotes?.value;
        
        // Validate role selection
        if (!role) {
            showToast('Please select a role', 'warning');
            return;
        }
        
        // Validate team member selection
        if (!salesUserId) {
            showToast('Please select a team member', 'warning');
            return;
        }
        
        // Show spinner
        if (elements.assignSpinner) elements.assignSpinner.classList.remove('d-none');
        if (elements.confirmAssignBtn) elements.confirmAssignBtn.disabled = true;
        
        // Get assigned user details
        const assignedUser = salesUsers.find(user => user.id === salesUserId);
        const username = assignedUser ? assignedUser.name : 'Unknown User';
        
        // Create assignment data object
        const assignmentData = {
            lead_id: leadId,
            user_id: salesUserId,
            user_name: username,
            role: role,
            notes: notes,
            assigned_by: currentUser.username,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        try {
            // Try API first
            const response = await axios.post(`${API_URL}/assignments`, assignmentData, {
                headers: { Authorization: `Bearer ${currentUser.token}` }
            });
            
            // Get the saved assignment data
            const savedAssignment = response.data;
            
            // Update assignments array
            const existingAssignmentIndex = leadAssignments.findIndex(a => a.lead_id === leadId);
            if (existingAssignmentIndex >= 0) {
                leadAssignments[existingAssignmentIndex] = savedAssignment;
            } else {
                leadAssignments.push(savedAssignment);
            }
            
            // Also update localStorage as backup
            saveAssignmentsToLocalStorage();
            
        } catch (error) {
            console.warn('API assignment failed, using localStorage only:', error);
            
            // Update or add to the assignments array
            const existingAssignmentIndex = leadAssignments.findIndex(a => a.lead_id === leadId);
            if (existingAssignmentIndex >= 0) {
                leadAssignments[existingAssignmentIndex] = assignmentData;
            } else {
                leadAssignments.push(assignmentData);
            }
            
            // Save to localStorage
            saveAssignmentsToLocalStorage();
        }
        
        try {
            // Update the lead in our local data
            const leadIndex = allLeads.findIndex(lead => lead.id === leadId || lead._id === leadId);
            if (leadIndex >= 0) {
                allLeads[leadIndex].assigned_to = salesUserId;
                allLeads[leadIndex].assigned_role = role;
                allLeads[leadIndex].assignment_notes = notes;
                allLeads[leadIndex].assigned_to_name = username;
                allLeads[leadIndex].assignment_date = assignmentData.created_at;
                allLeads[leadIndex].assigned_by = currentUser.username;
            }
            
            // Update in current leads array if present
            const currentLeadIndex = leads.findIndex(lead => lead.id === leadId || lead._id === leadId);
            if (currentLeadIndex >= 0) {
                leads[currentLeadIndex].assigned_to = salesUserId;
                leads[currentLeadIndex].assigned_role = role;
                leads[currentLeadIndex].assignment_notes = notes;
                leads[currentLeadIndex].assigned_to_name = username;
                leads[currentLeadIndex].assignment_date = assignmentData.created_at;
                leads[currentLeadIndex].assigned_by = currentUser.username;
            }
            
            // Hide the modal
            if (elements.leadAssignmentModal) elements.leadAssignmentModal.hide();
            
            showToast('Lead assigned successfully');
            
            // Re-render current page
            renderLeadsTable();
            
        } catch (error) {
            console.error('Error updating lead assignments:', error);
            showToast('Failed to assign lead', 'error');
        } finally {
            if (elements.assignSpinner) elements.assignSpinner.classList.add('d-none');
            if (elements.confirmAssignBtn) elements.confirmAssignBtn.disabled = false;
        }
    }

    // Load lead sources from API
    async function loadLeadSources() {
        try {
            if (elements.sourcesLoading) elements.sourcesLoading.classList.remove('d-none');
            if (elements.noSourcesMessage) elements.noSourcesMessage.classList.add('d-none');
            
            const response = await axios.get(`${API_URL}/lead-sources`, {
                headers: { Authorization: `Bearer ${currentUser.token}` }
            });
            
            if (response.data && Array.isArray(response.data)) {
                leadSources = response.data;
            } else {
                // Fallback test data
                leadSources = [
                    {
                        id: "1", 
                        name: "Google Sheets Import", 
                        source_type: "google_sheets",
                        total_leads: 124,
                        last_sync_time: "2025-06-04T15:30:00Z"
                    },
                    {
                        id: "2", 
                        name: "Facebook Lead Form", 
                        source_type: "meta_ads",
                        total_leads: 87,
                        last_sync_time: "2025-06-05T06:45:00Z"
                    },
                    {
                        id: "3", 
                        name: "Website Contact Form", 
                        source_type: "api",
                        total_leads: 56,
                        last_sync_time: "2025-06-05T07:15:00Z"
                    }
                ];
            }
            
            renderSourcesTable();
            updateSourcesCount();
            populateSourceFilter();
            
        } catch (error) {
            console.error('Error loading lead sources:', error);
            showToast('Failed to load lead sources', 'error');
            
            // Fallback test data
            leadSources = [
                {
                    id: "1", 
                    name: "Google Sheets Import", 
                    source_type: "google_sheets",
                    total_leads: 124,
                    last_sync_time: "2025-06-04T15:30:00Z"
                },
                {
                    id: "2", 
                    name: "Facebook Lead Form", 
                    source_type: "meta_ads",
                    total_leads: 87,
                    last_sync_time: "2025-06-05T06:45:00Z"
                },
                {
                    id: "3", 
                    name: "Website Contact Form", 
                    source_type: "api",
                    total_leads: 56,
                    last_sync_time: "2025-06-05T07:15:00Z"
                }
            ];
            
            renderSourcesTable();
            updateSourcesCount();
            populateSourceFilter();
        } finally {
            if (elements.sourcesLoading) elements.sourcesLoading.classList.add('d-none');
        }
    }

    // Enhance the lead table header
    function enhanceLeadTableHeader() {
        try {
            const tableHeader = document.querySelector('thead tr');
            if (!tableHeader) return;
            
            // Check if Assigned To column exists
            const headers = tableHeader.querySelectorAll('th');
            let assignedHeaderExists = false;
            let roleHeaderExists = false;
            
            for (const header of headers) {
                const headerText = header.textContent.trim();
                if (headerText === 'Assigned To') {
                    assignedHeaderExists = true;
                }
                if (headerText === 'Role') {
                    roleHeaderExists = true;
                }
            }
            
            // Add Role header if missing
            if (!roleHeaderExists) {
                const newHeader = document.createElement('th');
                newHeader.textContent = 'Role';
                
                // Add before Actions column
                const actionsHeader = tableHeader.querySelector('th:last-child');
                if (actionsHeader) {
                    tableHeader.insertBefore(newHeader, actionsHeader);
                } else {
                    tableHeader.appendChild(newHeader);
                }
            }
            
            // Add Assigned To header if missing
            if (!assignedHeaderExists) {
                const newHeader = document.createElement('th');
                newHeader.textContent = 'Assigned To';
                
                // Add before Role column
                const roleHeader = Array.from(headers).find(h => h.textContent.trim() === 'Role');
                if (roleHeader) {
                    tableHeader.insertBefore(newHeader, roleHeader);
                } else {
                    // Or before Actions
                    const actionsHeader = tableHeader.querySelector('th:last-child');
                    if (actionsHeader) {
                        tableHeader.insertBefore(newHeader, actionsHeader);
                    } else {
                        tableHeader.appendChild(newHeader);
                    }
                }
            }
        } catch (error) {
            console.error("Error enhancing lead table header:", error);
        }
    }

    // Render the leads table
    function renderLeadsTable() {
        try {
            // Make sure table header has all needed columns
            enhanceLeadTableHeader();
            
            const leadsTable = elements.leadsTableBody;
            if (!leadsTable) return;
            
            leadsTable.innerHTML = '';
            
            if (leads.length === 0) {
                if (elements.noLeadsMessage) {
                    elements.noLeadsMessage.textContent = filtersActive ? 
                        'No leads match your filter criteria.' : 
                        'No leads found.';
                    elements.noLeadsMessage.classList.remove('d-none');
                }
                return;
            }
            
            if (elements.noLeadsMessage) 
                elements.noLeadsMessage.classList.add('d-none');
            
            leads.forEach(lead => {
                const row = document.createElement('tr');
                
                // Handle multiple possible name field variations
                const nameValue = lead.name || lead.full_name || lead.fullName || lead.Name || 'N/A';
                
                // Handle multiple possible email field variations
                const emailValue = lead.email || lead.Email || lead.EMAIL || lead.emailAddress || lead.email_address || 'N/A';
                
                // Handle phone variations
                const phoneValue = lead.phone || lead.Phone || lead.PHONE || lead.phoneNumber || lead.phone_number || 'N/A';
                
                // Handle source type display
                const sourceTypeDisplay = (lead.source === 'google_sheets' || lead.source_type === 'google_sheets') ? 
                    '<span class="badge source-badge source-badge-google">Google</span>' : 
                    '<span class="badge source-badge source-badge-meta">Meta</span>';
                
                // Handle created date
                const createdDate = lead.created_at || lead.createdAt || lead.date_created || 
                    new Date().toLocaleString();
                
                // Format the date if it's a valid date string
                let formattedDate = 'Unknown';
                if (typeof createdDate === 'string') {
                    try {
                        formattedDate = new Date(createdDate).toLocaleString();
                    } catch (e) {
                        formattedDate = createdDate;
                    }
                } else if (createdDate instanceof Date) {
                    formattedDate = createdDate.toLocaleString();
                }
                
                // Handle assignment status
                let assignmentDisplay = '<span class="text-muted">Unassigned</span>';
                
                if (lead.assigned_to) {
                    // Find the user's name
                    const userName = lead.assigned_to_name || 
                        salesUsers.find(user => user.id === lead.assigned_to)?.name || 
                        `User ${lead.assigned_to}`;
                    
                    assignmentDisplay = `<span class="badge bg-info">${userName}</span>`;
                }
                
                // Handle role display
                let roleDisplay = '<span class="text-muted">None</span>';
                if (lead.assigned_role) {
                    // Get pretty role name
                    const roleName = ROLE_NAMES[lead.assigned_role] || lead.assigned_role;
                    roleDisplay = `<span class="badge bg-secondary">${roleName}</span>`;
                }
                
                // Handle ID variations
                const leadId = lead.id || lead._id || '';
                
                row.innerHTML = `
                    <td>
                        <div class="fw-medium">${nameValue}</div>
                    </td>
                    <td>${emailValue}</td>
                    <td>${phoneValue}</td>
                    <td>${sourceTypeDisplay}</td>
                    <td class="date-display">${formattedDate}</td>
                    <td>${assignmentDisplay}</td>
                    <td>${roleDisplay}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary view-lead-btn me-1" data-id="${leadId}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success assign-lead-btn" data-id="${leadId}" data-name="${nameValue}">
                            <i class="fas fa-user-plus"></i>
                        </button>
                    </td>
                `;
                
                leadsTable.appendChild(row);
            });
        } catch (error) {
            console.error("Error rendering leads table:", error);
        }
    }

    // Render the sources table
    function renderSourcesTable() {
        try {
            const sourcesTable = elements.sourcesTableBody;
            if (!sourcesTable) return;
            
            sourcesTable.innerHTML = '';
            
            if (leadSources.length === 0) {
                if (elements.noSourcesMessage) 
                    elements.noSourcesMessage.classList.remove('d-none');
                return;
            }
            
            if (elements.noSourcesMessage) 
                elements.noSourcesMessage.classList.add('d-none');
            
            leadSources.forEach(source => {
                const row = document.createElement('tr');
                
                // Determine source type display
                const sourceTypeDisplay = source.source_type === 'google_sheets' ? 
                    '<span class="badge source-badge source-badge-google">Google Sheets</span>' : 
                    '<span class="badge source-badge source-badge-meta">Meta Ads</span>';
                
                // Format last sync date
                let lastSyncDate = 'Never';
                if (source.last_sync_time) {
                    try {
                        lastSyncDate = new Date(source.last_sync_time).toLocaleString();
                    } catch (e) {
                        lastSyncDate = source.last_sync_time;
                    }
                }
                
                // Store source ID for API calls
                const sourceId = source.integration_id || source.id || source._id;
                
                row.innerHTML = `
                    <td>
                        <div class="d-flex align-items-center">
                            ${sourceTypeDisplay}
                            <span class="ms-2">${source.name || 'Unnamed Source'}</span>
                        </div>
                    </td>
                    <td>${source.source_type || 'Unknown'}</td>
                    <td>${source.total_leads || 0}</td>
                    <td class="date-display">${lastSyncDate}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1 sync-source-btn" data-id="${sourceId}">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-source-btn" data-id="${sourceId}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                sourcesTable.appendChild(row);
            });
        } catch (error) {
            console.error("Error rendering sources table:", error);
        }
    }

    // View lead details in modal
    function viewLeadDetails(leadId) {
        try {
            // Find the lead by ID - first check current page, then all leads
            let lead = leads.find(l => (l.id === leadId || l._id === leadId));
            
            if (!lead) {
                // Try to find in all leads if not found in current page
                lead = allLeads.find(l => (l.id === leadId || l._id === leadId));
            }
            
            if (!lead) {
                showToast('Lead not found', 'error');
                return;
            }
            
            const modalBody = elements.leadDetailsBody;
            if (!modalBody || !elements.leadDetailsModal) {
                console.error("Lead details modal elements not found");
                return;
            }
            
            // Create a table for lead details
            modalBody.innerHTML = '';
            const detailsTable = document.createElement('table');
            detailsTable.className = 'table table-borderless';
            
            // Add assignment section at the top if assigned
            if (lead.assigned_to) {
                const assignmentSection = document.createElement('div');
                assignmentSection.className = 'card mb-3 border-info';
                
                // Get user info
                const assignedUser = salesUsers.find(user => user.id === lead.assigned_to);
                const roleName = ROLE_NAMES[lead.assigned_role] || lead.assigned_role || 'Unknown Role';
                
                // Format assignment date
                let assignmentDate = 'Unknown date';
                if (lead.assignment_date) {
                    try {
                        assignmentDate = new Date(lead.assignment_date).toLocaleString();
                    } catch (e) {
                        assignmentDate = lead.assignment_date;
                    }
                }
                
                assignmentSection.innerHTML = `
                    <div class="card-header bg-info text-white">
                        <h5 class="mb-0">Assignment Information</h5>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <p><strong>Assigned To:</strong> ${assignedUser ? assignedUser.name : 'Unknown User'}</p>
                                <p><strong>Role:</strong> ${roleName}</p>
                            </div>
                            <div class="col-md-6">
                                <p><strong>Assigned By:</strong> ${lead.assigned_by || currentUser.username}</p>
                                <p><strong>Assignment Date:</strong> ${assignmentDate}</p>
                            </div>
                        </div>
                        ${lead.assignment_notes ? `<div class="mt-2"><strong>Notes:</strong> ${lead.assignment_notes}</div>` : ''}
                    </div>
                `;
                
                modalBody.appendChild(assignmentSection);
            }
            
            // Add each field to the table
            Object.entries(lead).forEach(([key, value]) => {
                // Skip internal fields and assignment fields (already displayed above)
                if (key === '_id' || key === '__v' || 
                    key === 'assigned_to' || key === 'assigned_role' || 
                    key === 'assignment_notes' || key === 'assignment_date' || 
                    key === 'assigned_to_name' || key === 'assigned_by') return;
                
                // Format field name
                const fieldName = key
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
                
                // Format the value
                let displayValue = value;
                
                // Format date fields
                if ((key === 'created_at' || key === 'updated_at') && value) {
                    try {
                        displayValue = new Date(value).toLocaleString();
                    } catch (e) {
                        displayValue = value;
                    }
                } 
                // Format source fields
                else if (key === 'source') {
                    const badgeClass = value === 'google_sheets' ? 'source-badge-google' : 'source-badge-meta';
                    const sourceName = value === 'google_sheets' ? 'Google Sheets' : 'Meta Ads';
                    displayValue = `<span class="badge source-badge ${badgeClass}">${sourceName}</span>`;
                }
                // Format raw data object
                else if (key === 'raw_data' && value) {
                    try {
                        displayValue = `<pre>${JSON.stringify(value, null, 2)}</pre>`;
                    } catch (e) {
                        displayValue = `<div class="text-muted">Complex data structure</div>`;
                    }
                }
                // Handle null/undefined values
                else if (value === null || value === undefined) {
                    displayValue = 'N/A';
                }
                // Handle other objects
                else if (typeof value === 'object' && value !== null) {
                    try {
                        displayValue = `<pre>${JSON.stringify(value, null, 2)}</pre>`;
                    } catch (e) {
                        displayValue = `<div class="text-muted">Complex data structure</div>`;
                    }
                }
                
                // Create a row for this field
                const row = document.createElement('tr');
                row.className = 'lead-detail-row';
                row.innerHTML = `
                    <td class="lead-field-name" width="30%">${fieldName}</td>
                    <td class="lead-field-value">${displayValue}</td>
                `;
                
                detailsTable.appendChild(row);
            });
            
            // Section heading for lead details
            const leadDetailsHeading = document.createElement('h5');
            leadDetailsHeading.className = 'mb-3 mt-3';
            leadDetailsHeading.textContent = 'Lead Details';
            
            modalBody.appendChild(leadDetailsHeading);
            modalBody.appendChild(detailsTable);
            
            // Update modal title with lead name
            const modalTitle = document.getElementById('leadDetailsModalLabel');
            if (modalTitle) {
                modalTitle.textContent = `Lead Details: ${lead.name || lead.full_name || 'Lead ' + leadId}`;
            }
            
            // Show the modal
            elements.leadDetailsModal.show();
        } catch (error) {
            console.error("Error displaying lead details:", error);
            showToast('Error displaying lead details', 'error');
        }
    }

    // Update pagination display
    function updatePagination() {
        try {
            if (!elements.pageInfo || !elements.prevPageBtn || !elements.nextPageBtn) {
                return;
            }
            
            const startItem = (currentPage - 1) * pageSize + 1;
            const endItem = Math.min(startItem + leads.length - 1, totalLeads);
            
            // Update page info text
            elements.pageInfo.textContent = `${startItem}-${endItem} of ${totalLeads}`;
            
            // Update button states
            elements.prevPageBtn.disabled = currentPage <= 1;
            elements.nextPageBtn.disabled = endItem >= totalLeads;
            
            // Update total leads badge
            if (elements.totalLeadsBadge) {
                elements.totalLeadsBadge.textContent = `${totalLeads} Leads`;
            }
        } catch (error) {
            console.error("Error updating pagination:", error);
        }
    }

    // Update sources count badge
    function updateSourcesCount() {
        try {
            if (elements.totalSourcesBadge) {
                elements.totalSourcesBadge.textContent = `${leadSources.length} Sources`;
            }
        } catch (error) {
            console.error("Error updating sources count:", error);
        }
    }

    // Populate source filter dropdown
    function populateSourceFilter() {
        try {
            // Get both source filter elements (one in filter section, one in card header)
            const sourceFilter = document.querySelector('#source-filter');
            const sourceFilterCard = document.querySelector('#source-filter-card');
            
            // Clear and populate the first filter
            if (sourceFilter) {
                sourceFilter.innerHTML = '<option value="">All Sources</option>';
                
                // Get unique source types
                const sourceTypes = new Set();
                leadSources.forEach(source => {
                    if (source.source_type) sourceTypes.add(source.source_type);
                });
                
                // Add options for each source type
                sourceTypes.forEach(sourceType => {
                    const option = document.createElement('option');
                    option.value = sourceType;
                    option.textContent = sourceType === 'google_sheets' ? 'Google Sheets' : 
                                       (sourceType === 'meta_ads' ? 'Meta Ads' : sourceType);
                    sourceFilter.appendChild(option);
                });
            }
            
            // Also populate the second filter if it exists
            if (sourceFilterCard) {
                sourceFilterCard.innerHTML = '<option value="">All Sources</option>';
                
                // Get unique source types
                const sourceTypes = new Set();
                leadSources.forEach(source => {
                    if (source.source_type) sourceTypes.add(source.source_type);
                });
                
                // Add options for each source type
                sourceTypes.forEach(sourceType => {
                    const option = document.createElement('option');
                    option.value = sourceType;
                    option.textContent = sourceType === 'google_sheets' ? 'Google Sheets' : 
                                       (sourceType === 'meta_ads' ? 'Meta Ads' : sourceType);
                    sourceFilterCard.appendChild(option);
                });
            }
            
        } catch (error) {
            console.error("Error populating source filter:", error);
        }
    }

    // Add a new meta mapping row
    function addMetaMapping() {
        try {
            const container = document.querySelector('.meta-mapping-container');
            if (!container) return;
            
            const firstRow = container.querySelector('.mapping-row');
            if (!firstRow) return;
            
            const newRow = firstRow.cloneNode(true);
            
            // Reset field values
            if (newRow.querySelector('select')) newRow.querySelector('select').selectedIndex = 0;
            if (newRow.querySelector('input')) newRow.querySelector('input').value = '';
            
            // Add to container
            container.appendChild(newRow);
        } catch (error) {
            console.error("Error adding meta mapping:", error);
        }
    }

    // Refresh all data
    function refreshData() {
        console.log("Refreshing all data...");
        currentPage = 1;
        
        // Reset filter active state
        filtersActive = false;
        
        // Reset all filters visually
        const sourceFilter = document.querySelector('#source-filter');
        const campaignFilter = document.querySelector('#campaign-filter');
        const assignedToFilter = document.querySelector('#assigned-to-filter');
        const leadSearch = document.querySelector('#lead-search');
        
        if (sourceFilter) sourceFilter.value = '';
        if (campaignFilter) campaignFilter.value = '';
        if (assignedToFilter) assignedToFilter.value = '';
        if (leadSearch) leadSearch.value = '';
        
        // Reset filter parameters
        filterParams = {
            source: '',
            campaign: '',
            assigned_to: '',
            search: ''
        };
        
        // Reload all data
        loadAllLeads().then(() => {
            loadLeadSources();
            updateLeadsWithAssignments(); // Apply assignments to refreshed leads
        });
        
        showToast('Data refreshed successfully');
    }
    
    // Update leads with assignment data
    function updateLeadsWithAssignments() {
        if (!leadAssignments || leadAssignments.length === 0) return;
        
        // Update all leads with assignment information
        allLeads.forEach(lead => {
            const assignment = leadAssignments.find(a => a.lead_id === (lead.id || lead._id));
            if (assignment) {
                lead.assigned_to = assignment.user_id;
                lead.assigned_role = assignment.role;
                lead.assigned_to_name = assignment.user_name;
                lead.assignment_notes = assignment.notes;
                lead.assignment_date = assignment.created_at;
                lead.last_updated = assignment.updated_at;
            }
        });
        
        // Update current page of leads
        renderLeadsTable();
    }

    // Handle Google Sheets integration form submission
    async function handleGoogleSheetsSubmit(e) {
        e.preventDefault();
        
        try {
            // Get spreadsheet URL
            const spreadsheetUrl = elements.spreadsheetUrl?.value?.trim();
            
            if (!spreadsheetUrl) {
                showToast('Please enter a Google Sheets URL', 'warning');
                return;
            }
            
            // Show spinner
            if (elements.sheetsSpinner) 
                elements.sheetsSpinner.classList.remove('d-none');
            
            // Get other form values with defaults
            const sheetName = elements.sheetName?.value?.trim() || 'Sheet1';
            const headerRow = parseInt(elements.headerRow?.value) || 1;
            
            // Call API to integrate
            const response = await axios.post(`${API_URL}/integrations/google-sheets`, {
                spreadsheet_url: spreadsheetUrl,
                sheet_name: sheetName,
                header_row: headerRow,
                created_by: currentUser.username
            }, {
                                headers: { Authorization: `Bearer ${currentUser.token}` }
            });
            
            // Show success message
            showToast('Google Sheets integration added successfully');
            
            // Close modal
            if (elements.googleSheetsModal)
                elements.googleSheetsModal.hide();
            
            // Reset form
            if (elements.spreadsheetUrl)
                elements.spreadsheetUrl.value = '';
            
            // Refresh data
            setTimeout(refreshData, 1000);
        } catch (error) {
            console.error('Error adding Google Sheets integration:', error);
            showToast('Failed to add Google Sheets integration', 'error');
        } finally {
            // Hide spinner
            if (elements.sheetsSpinner)
                elements.sheetsSpinner.classList.add('d-none');
        }
    }

    // Load sales users for assignment dropdown
    async function loadSalesUsers() {
        try {
            console.log("Loading sales users");
            
            const response = await axios.get(`${API_URL}/users/sales`, {
                headers: { Authorization: `Bearer ${currentUser.token}` }
            });
            
            if (response.data && Array.isArray(response.data)) {
                salesUsers = response.data;
                
                // Update the UI elements that display users
                updateUserSelects();
                
                console.log(`Loaded ${salesUsers.length} sales users`);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            showToast('Failed to load team members', 'error');
            
            // Add current user to the sample data
            salesUsers.push({
                id: "9", 
                name: "soherucontinue", 
                email: "soherucontinue@example.com", 
                role: "admin"
            });
            
            updateUserSelects();
        }
    }

    // Handle Meta Ads integration form submission
    async function handleMetaAdsSubmit(e) {
        e.preventDefault();
        
        try {
            // Get form values
            const accessToken = elements.accessToken?.value?.trim();
            const adAccountId = elements.adAccountId?.value?.trim();
            
            if (!accessToken || !adAccountId) {
                showToast('Please enter all required fields', 'warning');
                return;
            }
            
            // Show spinner
            if (elements.metaSpinner)
                elements.metaSpinner.classList.remove('d-none');
                
            // Gather mapping data from the form
            const mappingRows = document.querySelectorAll('.mapping-row');
            const mapping = {};
            
            mappingRows.forEach(row => {
                const field = row.querySelector('.mapping-field')?.value;
                const column = row.querySelector('.mapping-column')?.value;
                
                if (field && column) {
                    mapping[field] = column;
                }
            });
            
            // Call API to integrate
            await axios.post(`${API_URL}/integrations/meta-ads`, {
                access_token: accessToken,
                ad_account_id: adAccountId,
                form_id: elements.formId?.value?.trim() || undefined,
                mapping: mapping,
                created_by: currentUser.username
            }, {
                headers: { Authorization: `Bearer ${currentUser.token}` }
            });
            
            // Show success message
            showToast('Meta Ads integration added successfully');
            
            // Close modal
            if (elements.metaAdsModal)
                elements.metaAdsModal.hide();
            
            // Reset form
            if (elements.accessToken) elements.accessToken.value = '';
            if (elements.adAccountId) elements.adAccountId.value = '';
            if (elements.formId) elements.formId.value = '';
            
            // Refresh data
            setTimeout(refreshData, 1000);
        } catch (error) {
            console.error('Error adding Meta Ads integration:', error);
            showToast('Failed to add Meta Ads integration', 'error');
        } finally {
            // Hide spinner
            if (elements.metaSpinner)
                elements.metaSpinner.classList.add('d-none');
        }
    }

    // Delete a lead source
    async function deleteSource(sourceId) {
        showToast('Deleting lead source...', 'info');
        
        try {
            await axios.delete(`${API_URL}/lead-sources/${sourceId}`, {
                headers: { Authorization: `Bearer ${currentUser.token}` }
            });
            
            showToast('Lead source deleted successfully');
            
            // Refresh data after deletion
            setTimeout(() => {
                loadLeadSources();
            }, 1000);
            
        } catch (error) {
            console.error('Error deleting lead source:', error);
            showToast('Failed to delete lead source', 'error');
        }
    }

    // Confirm source delete from modal
    function confirmDeleteSource() {
        try {
            const sourceId = elements.sourceIdInput?.value?.trim();
            
            if (!sourceId) {
                showToast('Please enter a source ID', 'warning');
                return;
            }
            
            if (elements.deleteSourceModal)
                elements.deleteSourceModal.hide();
                
            deleteSource(sourceId);
        } catch (error) {
            console.error("Error confirming source deletion:", error);
        }
    }

    // Sync a specific lead source
    async function syncSource(sourceId) {
        showToast('Syncing lead source...', 'info');
        
        try {
            await axios.post(`${API_URL}/lead-sources/${sourceId}/sync`, {
                triggered_by: currentUser.username,
                timestamp: "2025-06-05 13:08:30"
            }, {
                headers: { Authorization: `Bearer ${currentUser.token}` }
            });
            
            showToast('Lead source synced successfully');
            
            // Refresh lead sources after sync
            setTimeout(() => {
                loadLeadSources();
                loadAllLeads(); // Also refresh leads as new ones might have been added
            }, 1000);
            
        } catch (error) {
            console.error('Error syncing lead source:', error);
            showToast('Failed to sync lead source', 'error');
        }
    }

    // Display a toast notification
    function showToast(message, type = 'success') {
        try {
            console.log(`Toast: ${message} (${type})`);
            
            // Set toast message
            if (elements.toastMessage)
                elements.toastMessage.textContent = message;
            
            // Set toast type
            const toast = document.getElementById('toast-notification');
            
            if (toast) {
                toast.className = toast.className.replace(/bg-\w+/, '');
                switch (type) {
                    case 'error':
                        toast.classList.add('bg-danger');
                        break;
                    case 'warning':
                        toast.classList.add('bg-warning');
                        break;
                    case 'info':
                        toast.classList.add('bg-info');
                        break;
                    default:
                        toast.classList.add('bg-success');
                }
                
                // Show toast
                if (elements.toast) {
                    elements.toast.show();
                } else {
                    // Fallback - initialize toast
                    const bsToast = new bootstrap.Toast(toast);
                    bsToast.show();
                }
            } else {
                // Fallback if toast element not found
                console.log(`Toast message: ${message} (${type})`);
                alert(message);
            }
        } catch (error) {
            console.error("Error showing toast:", error);
            // Ultimate fallback
            alert(message);
        }
    }

    // Initialize the application
    init();
});
