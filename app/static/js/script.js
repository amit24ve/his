
const API_URL = '/api/lead';

const currentUser = {
    username: 'soheru',
    token: localStorage.getItem('access_token') || 'demo_token'
};

let leads = [];
let leadSources = [];
let salesUsers = [];
let currentPage = 1;
let totalLeads = 0;
let pageSize = 10;
let filterParams = {
    source: '',
    campaign: '',
    assigned_to: '',
    search: ''
};

const ASSIGNMENTS_STORAGE_KEY = 'bharat_crm_lead_assignments';

const ROLES = {
    SALES_EXECUTIVE: 'sales_executive',
    SALES_MANAGER: 'sales_manager',
    ACCOUNT_MANAGER: 'account_manager',
    SUPPORT_AGENT: 'support_agent',
    ADMIN: 'admin'
};

const ROLE_NAMES = {
    sales_executive: 'Sales Executive',
    sales_manager: 'Sales Manager',
    account_manager: 'Account Manager',
    support_agent: 'Support Agent',
    admin: 'Administrator'
};

let filtersActive = false;
let allLeads = [];
let leadAssignments = [];

function fixDOMIssues() {
    fixDuplicateFilterSection();
    fixDuplicateModals();
    fixDuplicateSourceFilter();
    fixAssignmentModal();
}
function fixDuplicateFilterSection() {
    const filterSections = document.querySelectorAll('.filter-section');
    if (filterSections.length > 1) {
        for (let i = 1; i < filterSections.length; i++) {
            filterSections[i].parentNode.removeChild(filterSections[i]);
        }
    }

    if (filterSections.length > 0) {
        const filterSection = filterSections[0];
        const recentLeadsCard = document.querySelector('.row:last-child .card');
        if (recentLeadsCard && filterSection.parentNode !== recentLeadsCard.parentNode) {
            recentLeadsCard.parentElement.insertBefore(filterSection, recentLeadsCard);
        }
    }
}

function fixDuplicateModals() {
    const modalIds = ['lead-assignment-modal', 'lead-details-modal'];
    modalIds.forEach(id => {
        const elements = document.querySelectorAll(`#${id}`);
        if (elements.length > 1) {
            for (let i = 0; i < elements.length - 1; i++) {
                elements[i].parentNode.removeChild(elements[i]);
            }
        }
    });
}

function fixDuplicateSourceFilter() {
    const sourceFilters = document.querySelectorAll('#source-filter');
    if (sourceFilters.length > 1) {
        const filterSectionSourceFilter = document.querySelector('.filter-section #source-filter');
        sourceFilters.forEach(filter => {
            if (filter !== filterSectionSourceFilter) {
                filter.id = 'source-filter-card';
            }
        });
    }
}
function fixAssignmentModal() {
    const modal = document.querySelector('#lead-assignment-modal');
    if (!modal) return;
    const roleSelect = modal.querySelector('#role-select');
    const salesExecutiveSelect = modal.querySelector('#sales-executive-select');
    if (roleSelect && !salesExecutiveSelect) {
        const notesGroup = modal.querySelector('#assignment-notes').closest('.mb-3');
        if (notesGroup) {
            const teamSelectDiv = document.createElement('div');
            teamSelectDiv.className = 'mb-3';
            teamSelectDiv.innerHTML = `
                <label for="sales-executive-select" class="form-label">Select Team Member</label>
                <select class="form-select" id="sales-executive-select">
                    <option value="" selected disabled>Select a team member</option>
                </select>
            `;
            notesGroup.parentNode.insertBefore(teamSelectDiv, notesGroup);
            roleSelect.addEventListener('change', function() {
                filterUsersByRole(this.value);
            });
        }
    }
}
function initElements() {
    return {
        leadsTableBody: document.getElementById('leads-table-body'),
        sourcesTableBody: document.getElementById('sources-table-body'),
        noLeadsMessage: document.getElementById('no-leads-message'),
        noSourcesMessage: document.getElementById('no-sources-message'),
        leadsLoading: document.getElementById('leads-loading'),
        sourcesLoading: document.getElementById('sources-loading'),
        pageInfo: document.getElementById('page-info'),
        prevPageBtn: document.getElementById('prev-page-btn'),
        nextPageBtn: document.getElementById('next-page-btn'),
        sourceFilter: document.getElementById('source-filter'),
        campaignFilter: document.getElementById('campaign-filter'),
        assignedToFilter: document.getElementById('assigned-to-filter'),
        leadSearch: document.getElementById('lead-search'),
        applyFiltersBtn: document.getElementById('apply-filters-btn'),
        resetFiltersBtn: document.getElementById('reset-filters-btn'),
        totalLeadsBadge: document.getElementById('total-leads-badge'),
        totalSourcesBadge: document.getElementById('total-sources-badge'),
        refreshLeadsBtn: document.getElementById('refresh-leads-btn'),
        newIntegrationBtn: document.getElementById('new-integration-btn'),
        sheetsIntegrationBtn: document.getElementById('sheets-integration-btn'),
        metaIntegrationBtn: document.getElementById('meta-integration-btn'),
        googleSheetsModal: document.getElementById('google-sheets-modal') ?
            new bootstrap.Modal(document.getElementById('google-sheets-modal')) : null,
        googleSheetsForm: document.getElementById('google-sheets-form'),
        spreadsheetUrl: document.getElementById('spreadsheet-url'),
        sheetName: document.getElementById('sheet-name'),
        headerRow: document.getElementById('header-row'),
        sheetsSpinner: document.getElementById('sheets-spinner'),
        metaAdsModal: document.getElementById('meta-ads-modal') ?
            new bootstrap.Modal(document.getElementById('meta-ads-modal')) : null,
        metaAdsForm: document.getElementById('meta-ads-form'),
        accessToken: document.getElementById('access-token'),
        adAccountId: document.getElementById('ad-account-id'),
        formId: document.getElementById('form-id'),
        addMetaMappingBtn: document.getElementById('add-meta-mapping-btn'),
        metaSpinner: document.getElementById('meta-spinner'),
        leadAssignmentModal: document.getElementById('lead-assignment-modal') ?
            new bootstrap.Modal(document.getElementById('lead-assignment-modal')) : null,
        assignLeadId: document.getElementById('assign-lead-id'),
        assignLeadName: document.getElementById('assign-lead-name'),
        roleSelect: document.getElementById('role-select'),
        salesExecutiveSelect: document.getElementById('sales-executive-select'),
        assignmentNotes: document.getElementById('assignment-notes'),
        confirmAssignBtn: document.getElementById('confirm-assign-btn'),
        assignSpinner: document.getElementById('assign-spinner'),
        leadDetailsModal: document.getElementById('lead-details-modal') ?
            new bootstrap.Modal(document.getElementById('lead-details-modal')) : null,
        leadDetailsBody: document.getElementById('lead-details-body'),
        deleteSourceModal: document.getElementById('delete-source-modal') ?
            new bootstrap.Modal(document.getElementById('delete-source-modal')) : null,
        sourceIdInput: document.getElementById('source-id-input'),
        confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
        toast: document.getElementById('toast-notification') ?
            new bootstrap.Toast(document.getElementById('toast-notification')) : null,
        toastMessage: document.getElementById('toast-message'),
        currentDatetime: document.getElementById('current-datetime'),
        userName: document.getElementById('user-name')
    };
}

const elements = initElements();

function init() {
    // Set current date and time
    if (elements.currentDatetime) {
        elements.currentDatetime.textContent = '2025-06-05 13:01:48';
    }
    if (elements.userName) {
        elements.userName.textContent = 'soheru';
    }
    setupEventListeners();
    initializeSampleUsers();
    loadLeadAssignmentsFromLocalStorage();
    loadSalesUsers().then(() => {
        loadLeadAssignments().then(() => {
            loadAllLeads().then(() => {
                loadLeadSources();
                updateLeadsWithAssignments();
            });
        });
    });
}

function setupEventListeners() {
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
    elements.refreshLeadsBtn?.addEventListener('click', refreshData);
    elements.newIntegrationBtn?.addEventListener('click', () => {
        if (elements.googleSheetsModal) elements.googleSheetsModal.show();
    });
    elements.sheetsIntegrationBtn?.addEventListener('click', () => {
        if (elements.googleSheetsModal) elements.googleSheetsModal.show();
    });
    elements.metaIntegrationBtn?.addEventListener('click', () => {
        if (elements.metaAdsModal) elements.metaAdsModal.show();
    });
    elements.googleSheetsForm?.addEventListener('submit', handleGoogleSheetsSubmit);
    elements.metaAdsForm?.addEventListener('submit', handleMetaAdsSubmit);
    elements.addMetaMappingBtn?.addEventListener('click', addMetaMapping);
    elements.confirmDeleteBtn?.addEventListener('click', confirmDeleteSource);
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
    const applyFiltersBtn = document.querySelector('#apply-filters-btn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }
    const resetFiltersBtn = document.querySelector('#reset-filters-btn');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', resetFilters);
    }
    const leadSearch = document.querySelector('#lead-search');
    if (leadSearch) {
        leadSearch.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') {
                applyFilters();
            }
        });
    }
    if (elements.roleSelect) {
        elements.roleSelect.addEventListener('change', function() {
            filterUsersByRole(this.value);
        });
    }
    elements.confirmAssignBtn?.addEventListener('click', assignLead);

    // Delegated events
    document.addEventListener('click', function(e) {
        if (e.target.closest('.remove-mapping-btn')) {
            const row = e.target.closest('.mapping-row');
            if (row && row.parentElement.children.length > 1) {
                row.remove();
            }
        }
        if (e.target.closest('.assign-lead-btn')) {
            e.preventDefault();
            const btn = e.target.closest('.assign-lead-btn');
            openAssignModal(btn.dataset.id, btn.dataset.name);
        }
        if (e.target.closest('.view-lead-btn')) {
            e.preventDefault();
            const btn = e.target.closest('.view-lead-btn');
            viewLeadDetails(btn.dataset.id);
        }
        if (e.target.closest('.delete-source-btn')) {
            e.preventDefault();
            const btn = e.target.closest('.delete-source-btn');
            if (confirm("Are you sure you want to delete this lead source?")) {
                deleteSource(btn.dataset.id);
            }
        }
        if (e.target.closest('.sync-source-btn')) {
            e.preventDefault();
            const btn = e.target.closest('.sync-source-btn');
            syncSource(btn.dataset.id);
        }
        if (e.target.closest('.followup-btn')) {
            const btn = e.target.closest('.followup-btn');
            const leadId = btn.dataset.id;
            const leadName = btn.dataset.name;
            document.getElementById("followup-lead-id").value = leadId;
            document.getElementById("followup-note").value = "";
            document.getElementById("reminder-time").value = "";
            document.getElementById("followupModalLabel").textContent = "Follow-up for " + leadName;
            loadFollowupsForLead(leadId);
            const modalEl = document.getElementById('followup-modal');
            let followupModal;
            if (bootstrap.Modal.getInstance(modalEl)) {
                followupModal = bootstrap.Modal.getInstance(modalEl);
            } else {
                followupModal = new bootstrap.Modal(modalEl);
            }
            followupModal.show();
        }
    });
       document.getElementById("followup-form")?.addEventListener("submit", async function (e) {
        e.preventDefault();
        const leadId = document.getElementById("followup-lead-id").value;
        const note = document.getElementById("followup-note").value;
        const reminderTime = document.getElementById("reminder-time").value;
        if (!note.trim()) {
            showToast("Note cannot be empty", "warning");
            return;
        }
        try {
            await axios.post('/api/followups/', {
                lead_id: leadId,
                assigned_to: currentUser.username,
                note: note,
                reminder_time: reminderTime ? new Date(reminderTime).toISOString() : null
            });
            loadFollowupsForLead(leadId);
            loadUpcomingReminders();
            document.getElementById("followup-note").value = "";
            document.getElementById("reminder-time").value = "";
            showToast("Follow-up added!", "success");
        } catch (err) {
            showToast("Error adding follow-up", "error");
        }
    });

    document.getElementById("refresh-reminders-btn")?.addEventListener("click", loadUpcomingReminders);
}
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
    updateUserSelects();
}
async function loadLeadAssignments() {
    try {
        const response = await axios.get(`${API_URL}/assignments`, {
            headers: { Authorization: `Bearer ${currentUser.token}` }
        });
        if (response.data && Array.isArray(response.data)) {
            leadAssignments = response.data;
            updateLeadsWithAssignments();
        }
    } catch (error) {
        loadLeadAssignmentsFromLocalStorage();
    }
}

// Load assignments from localStorage
function loadLeadAssignmentsFromLocalStorage() {
    try {
        const storedAssignments = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
        if (storedAssignments) {
            leadAssignments = JSON.parse(storedAssignments);
        } else {
            leadAssignments = [];
        }
    } catch {
        leadAssignments = [];
    }
}
    
    // Save assignments to localStorage
function saveAssignmentsToLocalStorage() {
    try {
        localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(leadAssignments));
    } catch {}
}

function updateLeadsWithAssignments() {
    if (!leadAssignments || leadAssignments.length === 0) return;
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
    renderLeadsTable();
}

async function loadAllLeads() {
    try {
        if (elements.leadsLoading) elements.leadsLoading.classList.remove('d-none');
        if (elements.noLeadsMessage) elements.noLeadsMessage.classList.add('d-none');
        const response = await axios.get(`${API_URL}/leads`, {
            params: { limit: 1000 },
            headers: { Authorization: `Bearer ${currentUser.token}` }
        });
        if (response.data && typeof response.data === 'object') {
            if (Array.isArray(response.data.data)) {
                allLeads = response.data.data;
                totalLeads = response.data.total || allLeads.length;
            } else if (Array.isArray(response.data)) {
                allLeads = response.data;
                totalLeads = response.data.length;
            } else {
                allLeads = [];
                totalLeads = 0;
            }
        } else {
            allLeads = [];
            totalLeads = 0;
        }
        displayPageOfLeads();
        return allLeads;
    } catch {
        allLeads = [];
        leads = [];
        renderLeadsTable();
        return [];
    } finally {
        if (elements.leadsLoading) elements.leadsLoading.classList.add('d-none');
    }
}

function displayPageOfLeads() {
    let displayLeads = [];
    if (filtersActive) {
        const filteredLeads = filterLeads(allLeads);
        totalLeads = filteredLeads.length;
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        displayLeads = filteredLeads.slice(start, end);
    } else {
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        displayLeads = allLeads.slice(start, end);
        totalLeads = allLeads.length;
    }
    leads = displayLeads;
    renderLeadsTable();
    updatePagination();
}

function applyFilters() {
    filterParams.source = document.querySelector('#source-filter')?.value || '';
    filterParams.campaign = document.querySelector('#campaign-filter')?.value || '';
    filterParams.assigned_to = document.querySelector('#assigned-to-filter')?.value || '';
    filterParams.search = document.querySelector('#lead-search')?.value || '';
    filtersActive = Boolean(filterParams.source || filterParams.campaign || filterParams.assigned_to || filterParams.search);
    currentPage = 1;
    displayPageOfLeads();
    showToast('Filters applied successfully');
}

function filterLeads(leadsArray) {
    if (!filterParams.source && !filterParams.campaign && !filterParams.assigned_to && !filterParams.search) {
        return leadsArray;
    }
    return leadsArray.filter(lead => {
        if (filterParams.source) {
            if (lead.source !== filterParams.source && lead.source_type !== filterParams.source) {
                return false;
            }
        }
        if (filterParams.campaign) {
            if (lead.campaign !== filterParams.campaign) {
                return false;
            }
        }
        if (filterParams.assigned_to) {
            if (filterParams.assigned_to === 'unassigned') {
                if (lead.assigned_to) return false;
            } else {
                if (lead.assigned_to !== filterParams.assigned_to) return false;
            }
        }
        if (filterParams.search) {
            const searchTermLower = filterParams.search.toLowerCase();
            const nameMatch = (lead.name || lead.full_name || lead.fullName || lead.Name || '').toString().toLowerCase().includes(searchTermLower);
            const emailMatch = (lead.email || lead.Email || lead.EMAIL || lead.emailAddress || lead.email_address || '').toString().toLowerCase().includes(searchTermLower);
            const phoneMatch = (lead.phone || lead.Phone || lead.PHONE || lead.phoneNumber || lead.phone_number || '').toString().toLowerCase().includes(searchTermLower);
            if (!nameMatch && !emailMatch && !phoneMatch) {
                return false;
            }
        }
        return true;
    });
}


function resetFilters() {
    document.querySelector('#source-filter').value = '';
    document.querySelector('#campaign-filter').value = '';
    document.querySelector('#assigned-to-filter').value = '';
    document.querySelector('#lead-search').value = '';
    filterParams = {
        source: '',
        campaign: '',
        assigned_to: '',
        search: ''
    };
    filtersActive = false;
    currentPage = 1;
    displayPageOfLeads();
    showToast('Filters reset successfully');
}

    
function updateUserSelects() {
    if (elements.assignedToFilter) {
        elements.assignedToFilter.innerHTML = `
            <option value="">All Users</option>
            <option value="unassigned">Unassigned</option>
        `;
        salesUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name;
            option.dataset.role = user.role;
            elements.assignedToFilter.appendChild(option);
        });
    }
}

function filterUsersByRole(role) {
    if (!elements.salesExecutiveSelect) return;
    elements.salesExecutiveSelect.innerHTML = '<option value="" selected disabled>Select a team member</option>';
    if (!role) {
        salesUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name;
            elements.salesExecutiveSelect.appendChild(option);
        });
        return;
    }
    const filteredUsers = salesUsers.filter(user => user.role === role);
    if (filteredUsers.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.disabled = true;
        option.textContent = "No users available for this role";
        elements.salesExecutiveSelect.appendChild(option);
        return;
    }
    filteredUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        elements.salesExecutiveSelect.appendChild(option);
    });
}

function openAssignModal(leadId, leadName) {
    if (!elements.leadAssignmentModal) {
        return;
    }
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
    if (elements.roleSelect) {
        elements.roleSelect.value = lead && lead.assigned_role ? lead.assigned_role : '';
        if (lead && lead.assigned_role) {
            filterUsersByRole(lead.assigned_role);
            if (isReassignment && elements.salesExecutiveSelect) {
                elements.salesExecutiveSelect.value = lead.assigned_to;
            }
        } else {
            if (elements.salesExecutiveSelect) {
                elements.salesExecutiveSelect.innerHTML = '<option value="" selected disabled>Please select a role first</option>';
            }
        }
    }
    if (elements.assignmentNotes) {
        elements.assignmentNotes.value = lead && lead.assignment_notes ? lead.assignment_notes : '';
    }
    elements.leadAssignmentModal.show();
}

async function assignLead() {
    const leadId = elements.assignLeadId?.value;
    const salesUserId = elements.salesExecutiveSelect?.value;
    const role = elements.roleSelect?.value;
    const notes = elements.assignmentNotes?.value;
    if (!role) {
        showToast('Please select a role', 'warning');
        return;
    }
    if (!salesUserId) {
        showToast('Please select a team member', 'warning');
        return;
    }
    if (elements.assignSpinner) elements.assignSpinner.classList.remove('d-none');
    if (elements.confirmAssignBtn) elements.confirmAssignBtn.disabled = true;
    const assignedUser = salesUsers.find(user => user.id === salesUserId);
    const username = assignedUser ? assignedUser.name : 'Unknown User';
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
        const response = await axios.post(`${API_URL}/assignments`, assignmentData, {
            headers: { Authorization: `Bearer ${currentUser.token}` }
        });
        const savedAssignment = response.data;
        const existingAssignmentIndex = leadAssignments.findIndex(a => a.lead_id === leadId);
        if (existingAssignmentIndex >= 0) {
            leadAssignments[existingAssignmentIndex] = savedAssignment;
        } else {
            leadAssignments.push(savedAssignment);
        }
        saveAssignmentsToLocalStorage();
    } catch (error) {
        const existingAssignmentIndex = leadAssignments.findIndex(a => a.lead_id === leadId);
        if (existingAssignmentIndex >= 0) {
            leadAssignments[existingAssignmentIndex] = assignmentData;
        } else {
            leadAssignments.push(assignmentData);
        }
        saveAssignmentsToLocalStorage();
    }
    try {
        const leadIndex = allLeads.findIndex(lead => lead.id === leadId || lead._id === leadId);
        if (leadIndex >= 0) {
            allLeads[leadIndex].assigned_to = salesUserId;
            allLeads[leadIndex].assigned_role = role;
            allLeads[leadIndex].assignment_notes = notes;
            allLeads[leadIndex].assigned_to_name = username;
            allLeads[leadIndex].assignment_date = assignmentData.created_at;
            allLeads[leadIndex].assigned_by = currentUser.username;
        }
        const currentLeadIndex = leads.findIndex(lead => lead.id === leadId || lead._id === leadId);
        if (currentLeadIndex >= 0) {
            leads[currentLeadIndex].assigned_to = salesUserId;
            leads[currentLeadIndex].assigned_role = role;
            leads[currentLeadIndex].assignment_notes = notes;
            leads[currentLeadIndex].assigned_to_name = username;
            leads[currentLeadIndex].assignment_date = assignmentData.created_at;
            leads[currentLeadIndex].assigned_by = currentUser.username;
        }
        if (elements.leadAssignmentModal) elements.leadAssignmentModal.hide();
        showToast('Lead assigned successfully');
        renderLeadsTable();
    } catch (error) {
        showToast('Failed to assign lead', 'error');
    } finally {
        if (elements.assignSpinner) elements.assignSpinner.classList.add('d-none');
        if (elements.confirmAssignBtn) elements.confirmAssignBtn.disabled = false;
    }
}

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
            leadSources = [
                { id: "1", name: "Google Sheets Import", source_type: "google_sheets", total_leads: 124, last_sync_time: "2025-06-04T15:30:00Z" },
                { id: "2", name: "Facebook Lead Form", source_type: "meta_ads", total_leads: 87, last_sync_time: "2025-06-05T06:45:00Z" },
                { id: "3", name: "Website Contact Form", source_type: "api", total_leads: 56, last_sync_time: "2025-06-05T07:15:00Z" }
            ];
        }
        renderSourcesTable();
        updateSourcesCount();
        populateSourceFilter();
    } catch {
        leadSources = [
            { id: "1", name: "Google Sheets Import", source_type: "google_sheets", total_leads: 124, last_sync_time: "2025-06-04T15:30:00Z" },
            { id: "2", name: "Facebook Lead Form", source_type: "meta_ads", total_leads: 87, last_sync_time: "2025-06-05T06:45:00Z" },
            { id: "3", name: "Website Contact Form", source_type: "api", total_leads: 56, last_sync_time: "2025-06-05T07:15:00Z" }
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


    function renderLeadsTable() {
    const leadsTable = document.getElementById('leads-table-body');
    if (!leadsTable) return;
    leadsTable.innerHTML = '';
    if (leads.length === 0) {
        document.getElementById('no-leads-message')?.classList.remove('d-none');
        return;
    }
    document.getElementById('no-leads-message')?.classList.add('d-none');

    leads.forEach(lead => {
        const nameValue = lead.name || lead.full_name || lead.fullName || lead.Name || 'N/A';
        const emailValue = lead.email || lead.Email || lead.EMAIL || lead.emailAddress || lead.email_address || 'N/A';
        const phoneValue = lead.phone || lead.Phone || lead.PHONE || lead.phoneNumber || lead.phone_number || 'N/A';
        const sourceTypeDisplay = (lead.source === 'google_sheets' || lead.source_type === 'google_sheets') ? 
            '<span class="badge source-badge source-badge-google">Google</span>' : 
            '<span class="badge source-badge source-badge-meta">Meta</span>';
        const createdDate = lead.created_at || lead.createdAt || lead.date_created || new Date().toISOString();
        let formattedDate = createdDate;
        try { formattedDate = new Date(createdDate).toLocaleString(); } catch {}
        let assignmentDisplay = '<span class="text-muted">Unassigned</span>';
        if (lead.assigned_to) {
            const userName = lead.assigned_to_name ||
                salesUsers.find(user => user.id === lead.assigned_to)?.name ||
                `User ${lead.assigned_to}`;
            assignmentDisplay = `<span class="badge bg-info">${userName}</span>`;
        }
        let roleDisplay = '<span class="text-muted">None</span>';
        if (lead.assigned_role) {
            const roleName = ROLE_NAMES[lead.assigned_role] || lead.assigned_role;
            roleDisplay = `<span class="badge bg-secondary">${roleName}</span>`;
        }
        const leadId = lead.id || lead._id || '';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><div class="fw-medium">${nameValue}</div></td>
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
                <button class="btn btn-sm btn-outline-success assign-lead-btn me-1" data-id="${leadId}" data-name="${nameValue}">
                    <i class="fas fa-user-plus"></i>
                </button>
                <button class="btn btn-outline-warning btn-sm followup-btn" data-id="${leadId}" data-name="${nameValue}">
                    <i class="fas fa-comment-medical"></i> Follow-up
                </button>
            </td>
        `;
        leadsTable.appendChild(row);
    });
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

function showToast(message, type = 'success') {
    try {
        const toast = document.getElementById('toast-notification');
        if (document.getElementById('toast-message')) {
            document.getElementById('toast-message').textContent = message;
        }
        if (toast) {
            toast.className = toast.className.replace(/bg-\w+/, '');
            switch (type) {
                case 'error': toast.classList.add('bg-danger'); break;
                case 'warning': toast.classList.add('bg-warning'); break;
                case 'info': toast.classList.add('bg-info'); break;
                default: toast.classList.add('bg-success');
            }
            if (bootstrap.Toast.getOrCreateInstance) {
                bootstrap.Toast.getOrCreateInstance(toast).show();
            } else {
                new bootstrap.Toast(toast).show();
            }
        } else {
            alert(message);
        }
    } catch {
        alert(message);
    }
}

document.addEventListener("click", function (e) {
    if (e.target.closest('.followup-btn')) {
        const btn = e.target.closest('.followup-btn');
        const leadId = btn.dataset.id;
        const leadName = btn.dataset.name;
        document.getElementById("followup-lead-id").value = leadId;
        document.getElementById("followup-note").value = "";
        document.getElementById("reminder-time").value = "";
        document.getElementById("followupModalLabel").textContent = "Follow-up for " + leadName;
        loadFollowupsForLead(leadId);
        const modalEl = document.getElementById('followup-modal');
        let followupModal;
        if (bootstrap.Modal.getInstance(modalEl)) {
            followupModal = bootstrap.Modal.getInstance(modalEl);
        } else {
            followupModal = new bootstrap.Modal(modalEl);
        }
        followupModal.show();
    }
});

document.getElementById("followup-form")?.addEventListener("submit", async function (e) {
    e.preventDefault();
    const leadId = document.getElementById("followup-lead-id").value;
    const note = document.getElementById("followup-note").value;
    const reminderTime = document.getElementById("reminder-time").value;
    if (!note.trim()) {
        showToast("Note cannot be empty", "warning");
        return;
    }
    try {
        await axios.post('/api/followups/', {
            lead_id: leadId,
            assigned_to: currentUser.username,
            note: note,
            reminder_time: reminderTime ? new Date(reminderTime).toISOString() : null
        });
        loadFollowupsForLead(leadId);
        loadUpcomingReminders();
        document.getElementById("followup-note").value = "";
        document.getElementById("reminder-time").value = "";
        showToast("Follow-up added!", "success");
    } catch (err) {
        showToast("Error adding follow-up", "error");
    }
});

async function loadFollowupsForLead(leadId) {
    const ul = document.getElementById("followup-notes-list");
    if (!ul) return;
    ul.innerHTML = "<li class='list-group-item text-muted'>Loading...</li>";
    try {
        const res = await axios.get(`/api/followups/lead/${leadId}`);
        ul.innerHTML = "";
        if (res.data && res.data.length) {
            res.data.forEach(fu => {
                const li = document.createElement("li");
                li.className = "list-group-item";
                li.innerHTML = `<b>${fu.created_at ? new Date(fu.created_at).toLocaleString() : ""}</b>: ${fu.note}
                    ${fu.reminder_time ? `<span class="badge bg-warning text-dark ms-2">Remind: ${new Date(fu.reminder_time).toLocaleString()}</span>` : ''}`;
                ul.appendChild(li);
            });
        } else {
            ul.innerHTML = "<li class='list-group-item text-muted'>No follow-ups yet.</li>";
        }
    } catch (err) {
        ul.innerHTML = "<li class='list-group-item text-danger'>Failed to load follow-ups.</li>";
    }
}

// async function loadUpcomingReminders() {
//     const ul = document.getElementById("reminders-list");
//     if (!ul) return;
//     ul.innerHTML = "<li class='list-group-item text-muted'>Loading...</li>";
//     try {
//         const res = await axios.get(`/api/followups/reminders/${currentUser.username}`);
//         ul.innerHTML = "";
//         if (res.data && res.data.length) {
//             res.data.forEach(rem => {
//                 const li = document.createElement("li");
//                 li.className = "list-group-item";
//                 li.innerHTML = `<b>${rem.reminder_time ? new Date(rem.reminder_time).toLocaleString() : ""}</b> — <span class="text-dark">${rem.note}</span>
//                     <span class="badge bg-info ms-2">Lead: ${rem.lead_id}</span>`;
//                 ul.appendChild(li);
//             });
//         } else {
//             ul.innerHTML = "<li class='list-group-item text-muted'>No reminders.</li>";
//         }
//     } catch (err) {
//         ul.innerHTML = "<li class='list-group-item text-danger'>Failed to load reminders.</li>";
//     }
// }

async function loadUpcomingReminders() {
    const ul = document.getElementById("reminders-list");
    if (!ul) return;
    ul.innerHTML = "<li class='list-group-item text-muted'>Loading...</li>";
    try {
        const res = await axios.get(`/api/followups/reminders/${currentUser.username}`);
        // Use res.data or res.data.data depending on your backend
        const reminders = Array.isArray(res.data) ? res.data : (res.data.data || []);
        ul.innerHTML = "";
        if (reminders.length) {
            reminders.forEach(rem => {
                const reminderTime = rem.reminder_time ? new Date(rem.reminder_time).toLocaleString() : "";
                const note = rem.note || "";
                const leadId = rem.lead_id || "";
                const li = document.createElement("li");
                li.className = "list-group-item";
                li.innerHTML = `<b>${reminderTime}</b> — <span class="text-dark">${note}</span>
                    <span class="badge bg-info ms-2">
                        Lead: <a href="/leads/${leadId}" class="text-white">${leadId}</a>
                    </span>`;
                ul.appendChild(li);
            });
        } else {
            ul.innerHTML = "<li class='list-group-item text-muted'>No reminders.</li>";
        }
    } catch (err) {
        console.error("Error loading reminders:", err);
        ul.innerHTML = "<li class='list-group-item text-danger'>Failed to load reminders.</li>";
    }
}

window.addEventListener("DOMContentLoaded", () => {
    loadUpcomingReminders();
    init();
});
document.getElementById("refresh-reminders-btn")?.addEventListener("click", loadUpcomingReminders);