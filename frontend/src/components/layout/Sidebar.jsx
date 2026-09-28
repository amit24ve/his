import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

/* ── Hospital Mega Menu Data ── (mirrors actual sidebar routes) */
const MEGA_MENU_COLS = [
  [
    {
      title: 'PATIENT CARE', items: [
        { label: 'Dashboard', path: '/dashboard', icon: 'chart-pie' },
        { label: 'Appointments', path: '/appointments', icon: 'calendar-check' },
        { label: 'OPD Management', path: '/opd', icon: 'hospital' },
        { label: 'IPD / Ward', path: '/ipd', icon: 'bed' },
      ]
    },
    {
      title: 'PATIENT MANAGEMENT', items: [
        { label: 'Reception', path: '/reception', icon: 'hospital-user' },
        { label: 'Registration', path: '/patients/registration', icon: 'user-plus' },
        { label: 'Patient Portal', path: '/patients/portal', icon: 'notes-medical' },
        { label: 'Doctor Roster', path: '/doctors', icon: 'user-md' },
        { label: 'Departments', path: '/departments', icon: 'sitemap' },
      ]
    },
    {
      title: 'CLINICAL', items: [
        { label: 'EMR / Prescriptions', path: '/emr', icon: 'file-medical' },
        { label: 'Nursing Station', path: '/nursing', icon: 'stethoscope' },
        { label: 'OT Management', path: '/ot', icon: 'procedures' },
        { label: 'Teleconsultation', path: '/teleconsult', icon: 'video' },
      ]
    },
  ],
  [
    {
      title: 'DIAGNOSTICS', items: [
        { label: 'Laboratory', path: '/laboratory', icon: 'flask' },
        { label: 'Radiology', path: '/radiology', icon: 'x-ray' },
        { label: 'Blood Bank', path: '/blood-bank', icon: 'tint' },
      ]
    },
    {
      title: 'PHARMACY & STORE', items: [
        { label: 'Pharmacy', path: '/pharmacy', icon: 'pills' },
        { label: 'Stock Management', path: '/inventory', icon: 'boxes' },
      ]
    },
    {
      title: 'BILLING & FINANCE', items: [
        { label: 'Billing & Revenue', path: '/billing', icon: 'file-invoice-dollar' },
        { label: 'Insurance / TPA', path: '/insurance', icon: 'shield-alt' },
      ]
    },
  ],
  [
    {
      title: 'HR & STAFF', items: [
        { label: 'Staff Management', path: '/hr', icon: 'user-tie' },
        { label: 'My Attendance', path: '/attendance', icon: 'clock' },
        { label: 'Leave Requests', path: '/my-leave-requests', icon: 'calendar-times' },
      ]
    },
    {
      title: 'CERTIFICATES', items: [
        { label: 'Certificates', path: '/certificates', icon: 'certificate' },
      ]
    },
    {
      title: 'IT & ADMIN', items: [
        { label: 'Users', path: '/users/list', icon: 'users' },
        { label: 'Roles & Permissions', path: '/users/roles', icon: 'user-shield' },
        { label: 'Hospitals', path: '/users/hospitals', icon: 'hospital-alt' },
        { label: 'MIS Reports', path: '/reports', icon: 'chart-bar' },
        { label: 'Analytics', path: '/reports', icon: 'chart-area' },
      ]
    },
  ],
];

// All known permission keys used across the sidebar
const ALL_PERMISSION_KEYS = [
  'dashboard', 'appointments', 'patients', 'opd', 'ipd',
  'emr', 'nursing', 'ot', 'teleconsult',
  'pharmacy', 'laboratory', 'radiology', 'blood_bank',
  'billing', 'insurance', 'certificates', 'doctors', 'departments',
  'hr', 'inventory', 'accounts', 'reports',
  'users', 'roles', 'admin', 'super_admin'
];

function isSuperAdminRole(currentRoleNames) {
  return Array.isArray(currentRoleNames) && currentRoleNames.some(r => {
    const role = String(r || '').toLowerCase();
    return role === 'superadmin' || role === 'super_admin';
  });
}

function getStoredAdminPermissions() {
  try {
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    return Array.isArray(userObj.admin_permissions) ? userObj.admin_permissions : null;
  } catch {
    return null;
  }
}

function getUserPermissions(allRolesFromBackend, currentRoleNames, adminPermissions = null) {
  const perms = new Set();
  if (!Array.isArray(currentRoleNames)) return perms;

  // Super admin gets everything, including the control panel.
  if (isSuperAdminRole(currentRoleNames)) {
    ALL_PERMISSION_KEYS.forEach(p => perms.add(p));
    return perms;
  }

  const directPermissions = Array.isArray(adminPermissions) ? adminPermissions : getStoredAdminPermissions();
  if (Array.isArray(directPermissions)) {
    directPermissions.forEach(p => perms.add(p));
    return perms;
  }

  if (!Array.isArray(allRolesFromBackend)) return perms;
  for (const roleName of currentRoleNames) {
    const match = allRolesFromBackend.find(
      r => r.name && r.name.toLowerCase() === roleName.toLowerCase()
    );
    if (match && Array.isArray(match.permissions)) {
      if (match.permissions.includes('*')) {
        ALL_PERMISSION_KEYS.forEach(p => perms.add(p));
      } else {
        for (const p of match.permissions) {
          if (p.includes(':')) {
            // New CRUD format: "leads:read" → grant "leads" access
            const module = p.split(':')[0];
            perms.add(module);
          } else {
            perms.add(p);
          }
        }
      }
    }
  }
  return perms;
}

// Helper function to check if user is admin or HR
function isAdminOrHR(currentRoles) {
  if (!Array.isArray(currentRoles)) return false;
  return currentRoles.some(role =>
    role.toLowerCase().includes('admin') ||
    role.toLowerCase().includes('hr') ||
    role.toLowerCase() === 'administrator'
  );
}

// Hospital HIS menu items
const menuItems = [
  {
    icon: 'crown',
    label: 'Super Admin',
    path: '/super-admin',
    permission: 'super_admin',
  },
  { icon: 'chart-pie', label: 'Dashboard', path: '/dashboard', permission: 'dashboard' },
  { icon: 'calendar-check', label: 'Appointments', path: '/appointments', permission: 'appointments' },
  {
    icon: 'user-injured',
    label: 'Patient Management',
    path: '/patients',
    permission: 'patients',
    submenu: [
      { label: 'Reception', path: '/reception', permission: 'patients' },
      { label: 'Registration', path: '/patients/registration', permission: 'patients' },
      { label: 'Patient Portal', path: '/patients/portal', permission: 'patients' },
      { label: 'OPD Management', path: '/opd', permission: 'opd' },
      { label: 'IPD / Ward', path: '/ipd', permission: 'ipd' },
    ]
  },
  {
    icon: 'user-md',
    label: 'Doctors',
    path: '/doctors',
    permission: 'doctors',
    submenu: [
      { label: 'Doctor Roster', path: '/doctors', permission: 'doctors' },
      { label: 'Departments', path: '/departments', permission: 'departments' },
    ]
  },
  {
    icon: 'stethoscope',
    label: 'Clinical',
    path: '/emr',
    permission: 'emr',
    submenu: [
      { label: 'EMR / Prescriptions', path: '/emr', permission: 'emr' },
      { label: 'Nursing Station', path: '/nursing', permission: 'nursing' },
      { label: 'OT Management', path: '/ot', permission: 'ot' },
      { label: 'Teleconsultation', path: '/teleconsult', permission: 'teleconsult' },
    ]
  },
  { icon: 'pills', label: 'Pharmacy', path: '/pharmacy', permission: 'pharmacy' },
  { icon: 'flask', label: 'Laboratory', path: '/laboratory', permission: 'laboratory' },
  { icon: 'x-ray', label: 'Radiology', path: '/radiology', permission: 'radiology' },
  { icon: 'tint', label: 'Blood Bank', path: '/blood-bank', permission: 'blood_bank' },
  {
    icon: 'file-invoice-dollar',
    label: 'Billing & Finance',
    path: '/billing',
    permission: 'billing',
    submenu: [
      { label: 'Billing & Revenue', path: '/billing', permission: 'billing' },
      { label: 'Insurance / TPA', path: '/insurance', permission: 'insurance' },
    ]
  },
  {
    icon: 'certificate',
    label: 'Certificates',
    path: '/certificates',
    permission: 'certificates',
  },
  {
    icon: 'user-tie',
    label: 'HR & Staff',
    path: '/hr',
    permission: 'hr',
    submenu: [
      { label: 'Staff Management', path: '/hr', permission: 'hr', requiresAdminOrHR: true },
      { label: 'My Attendance', path: '/attendance', permission: 'hr' },
      { label: 'My Leave Requests', path: '/my-leave-requests', permission: 'hr' },
    ]
  },
  { icon: 'boxes', label: 'Stock Management', path: '/inventory', permission: 'inventory' },
  { icon: 'chart-bar', label: 'MIS Reports', path: '/reports', permission: 'reports' },
  {
    icon: 'user-shield',
    label: 'Users & Roles',
    path: '/users',
    permission: 'users',
    submenu: [
      { label: 'Users', path: '/users/list', permission: 'users' },
      { label: 'Roles', path: '/users/roles', permission: 'roles' },
      { label: 'Hospitals', path: '/users/hospitals', permission: 'users' },
    ]
  },
];

const Sidebar = ({ isOpen, toggleSidebar, isMobile }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [showMegaMenu, setShowMegaMenu] = useState(false);
  const megaMenuRef = useRef(null);

  const [currentUser, setCurrentUser] = useState('Unknown User');
  const [currentRoles, setCurrentRoles] = useState([]); // role name(s), e.g. ['admin']
  const [currentHospital, setCurrentHospital] = useState(''); // hospital_name for non-admin users
  const [adminPermissions, setAdminPermissions] = useState(null);
  const [roleObjects, setRoleObjects] = useState([]); // all roles from backend, must be fetched!
  const [userPermissions, setUserPermissions] = useState(new Set());
  const [expandedItems, setExpandedItems] = useState({
    '/patients': false,
    '/emr': false,
    '/users': false,
    '/hr': false,
    '/doctors': false,
    '/billing': false,
  });

  // Fetch roles from backend on mount
  useEffect(() => {
    fetch("https://cubehis.avopay.pro:5000/api/roles/", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
      }
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => setRoleObjects(Array.isArray(data) ? data : []))
      .catch(() => setRoleObjects([]));
  }, []);

  // Helper: extract roles array from a user object
  function extractRoles(userObj) {
    let roles = [];
    if (!userObj) return roles;
    if (userObj.roles) {
      if (Array.isArray(userObj.roles)) {
        roles = userObj.roles.map(r => typeof r === 'string' ? r : (r.name || r.id || '')).filter(Boolean);
      } else if (typeof userObj.roles === 'string') {
        roles = userObj.roles.includes(',')
          ? userObj.roles.split(',').map(r => r.trim()).filter(Boolean)
          : [userObj.roles];
      }
    }
    if (roles.length === 0) {
      const direct = userObj.role_name || userObj.role;
      if (direct) roles = [direct];
    }
    // Deduplicate
    const seen = new Set();
    return roles.filter(r => { const k = r.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  }

  // Get user/roles from localStorage, then refresh from /api/auth/me
  useEffect(() => {
    // Step 1: Load from localStorage immediately (no flicker)
    let userObj = null;
    let fullName = null;
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        userObj = JSON.parse(userStr);
        fullName = userObj.full_name || userObj.username || 'Unknown User';
      }
    } catch { /* ignore */ }
    if (!fullName) fullName = localStorage.getItem('full_name') || 'Unknown User';
    setCurrentUser(fullName);
    const localRoles = extractRoles(userObj);
    if (localRoles.length > 0) setCurrentRoles(localRoles);
    if (userObj && Array.isArray(userObj.admin_permissions)) setAdminPermissions(userObj.admin_permissions);
    // Load hospital from localStorage immediately
    if (userObj && userObj.hospital_name) setCurrentHospital(userObj.hospital_name);

    // Step 2: Fetch fresh user data from backend to get accurate roles
    const token = localStorage.getItem('access_token');
    if (!token) return;
    fetch('https://cubehis.avopay.pro:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        // Update name
        const freshName = data.full_name || data.username || fullName;
        setCurrentUser(freshName);
        // Extract roles from fresh data
        const freshRoles = extractRoles(data);
        if (freshRoles.length > 0) {
          setCurrentRoles(freshRoles);
        }
        const freshAdminPermissions = Array.isArray(data.admin_permissions) ? data.admin_permissions : null;
        setAdminPermissions(freshAdminPermissions);
        // Update hospital
        const freshHospital = data.hospital_name || '';
        setCurrentHospital(freshHospital);
        // Update localStorage so next load is also correct
        try {
          const stored = JSON.parse(localStorage.getItem('user') || '{}');
          if (freshRoles.length > 0) stored.roles = freshRoles;
          if (data.full_name) stored.full_name = data.full_name;
          if (freshAdminPermissions) stored.admin_permissions = freshAdminPermissions;
          if (freshHospital) stored.hospital_name = freshHospital;
          if (data.hospital_id) stored.hospital_id = data.hospital_id;
          localStorage.setItem('user', JSON.stringify(stored));
        } catch { /* ignore */ }
      })
      .catch(() => { /* network error — keep localStorage values */ });
  }, []);

  // Resolve menu permissions from superadmin, per-admin permissions, or role permissions.
  useEffect(() => {
    const perms = getUserPermissions(roleObjects, currentRoles, adminPermissions);
    setUserPermissions(perms);
  }, [roleObjects, currentRoles, adminPermissions]);

  useEffect(() => {
    const currentTopPath = '/' + location.pathname.split('/')[1];
    const newExpandedState = {};
    Object.keys(expandedItems).forEach(path => {
      newExpandedState[path] = (currentTopPath === path);
    });
    setExpandedItems(prev => ({
      ...prev,
      ...newExpandedState
    }));
  }, [location.pathname]);

  const toggleSubmenu = (path, e) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedItems(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const handleMenuItemClick = (path) => {
    if (!menuItems.find(item => item.path === path)?.submenu) {
      setExpandedItems({});
    }
    if (isMobile) {
      toggleSidebar(false);
    }
  };

  const isPathActive = (path) => {
    if (location.pathname === path) return true;
    if (location.pathname.startsWith(path + '/')) return true;
    const item = menuItems.find(m => m.path === path);
    if (item?.submenu) {
      return item.submenu.some(sub => location.pathname === sub.path);
    }
    return false;
  };


  const filteredMenuItems = menuItems.filter(item =>
    userPermissions.has(item.permission)
  );

  return (
    <>
      {isMobile && isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-20" onClick={() => toggleSidebar(false)} />
      )}

      <aside
        className={`h-screen bg-slate-900 text-white transition-all duration-300 ease-in-out flex-shrink-0
        ${isMobile
            ? `fixed top-0 left-0 h-full z-30 ${isOpen ? 'translate-x-0' : '-translate-x-full'} w-64`
            : `relative ${isOpen ? 'w-56' : 'w-18'}`}
        overflow-y-auto overflow-x-hidden`}
      >
        {/* Background image with opacity */}
        <img
          src="/img2.jpg"
          alt="Sidebar Background"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.24,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />

        <div className="bg-slate-900 border-b border-slate-800 flex items-center justify-between p-4 relative z-10">
          <div className="flex items-center gap-2 overflow-hidden">
            <img src="/bharat.png" alt="CubeMed HIS" className="h-6 w-6 rounded-full object-cover" />
            {(isOpen || isMobile) && <span className="text-lg font-semibold truncate">CubeMed HIS</span>}
          </div>
          {/* Hamburger opens the complete HIS map for super admins only. */}
          {isSuperAdminRole(currentRoles) && (
            <button
              onClick={() => setShowMegaMenu(v => !v)}
              className="text-gray-400 hover:text-white flex items-center justify-center w-8 h-8 rounded hover:bg-slate-700 transition-colors"
              title="Hospital Information System Menu"
            >
              <i className={`fas fa-${showMegaMenu ? 'times' : 'th'} text-sm`}></i>
            </button>
          )}
        </div>

        <div className="flex items-center p-4 border-b border-slate-800 relative z-10">
          <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center">
            <i className="fas fa-user text-white"></i>
          </div>
          {(isOpen || isMobile) && (
            <div className="ml-3 overflow-hidden">
              <div className="text-base font-medium truncate">{currentUser}</div>
              <div className="text-sm text-blue-300 truncate capitalize">
                {currentRoles.length > 0 ? currentRoles.join(', ') : 'Loading...'}
              </div>
              {currentHospital && !isSuperAdminRole(currentRoles) && (
                <div className="text-xs text-green-300 truncate mt-0.5" title={currentHospital}>
                  🏥 {currentHospital}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Menu */}
        <nav className="py-2 relative z-10">
          <ul>
            {filteredMenuItems.map(item => (
              <li key={item.path} className="relative">
                {item.submenu ? (
                  // Only show submenu if user has permission for at least one subitem
                  <>
                    {item.submenu.some(sub => {
                      // First check if user has permission
                      const hasPermission = userPermissions.has(sub.permission);
                      if (!hasPermission) return false;

                      // If item requires admin/HR, check user role
                      if (sub.requiresAdminOrHR) {
                        return isAdminOrHR(currentRoles);
                      }

                      return true;
                    }) && (
                        <>
                          <div
                            className={`flex items-center justify-between py-2.5 px-4 text-sm transition cursor-pointer
                            ${isPathActive(item.path)
                                ? 'bg-slate-800 border-l-4 border-blue-500'
                                : 'hover:bg-slate-800 border-l-4 border-transparent'}
                          `}
                            onClick={(e) => toggleSubmenu(item.path, e)}
                          >
                            <div className="flex items-center">
                              <div className={`text-center ${isOpen || isMobile ? 'w-6' : 'w-full'}`}>
                                <i className={`fas fa-${item.icon}`}></i>
                              </div>
                              {(isOpen || isMobile) && <span className="ml-2 truncate">{item.label}</span>}
                            </div>
                            {(isOpen || isMobile) && (
                              <i className={`fas fa-chevron-${expandedItems[item.path] ? 'down' : 'right'} text-xs`}></i>
                            )}
                          </div>
                          {expandedItems[item.path] && (isOpen || isMobile) && (
                            <ul className="pl-0 bg-slate-950 border-l-4 border-blue-500">
                              {item.submenu
                                .filter(sub => {
                                  // First check if user has permission
                                  const hasPermission = userPermissions.has(sub.permission);
                                  if (!hasPermission) return false;

                                  // If item requires admin/HR, check user role
                                  if (sub.requiresAdminOrHR) {
                                    return isAdminOrHR(currentRoles);
                                  }

                                  return true;
                                })
                                .map(subItem => (
                                  <li key={subItem.path}>
                                    <NavLink
                                      to={subItem.path}
                                      className={({ isActive }) => `
                                      flex items-center pl-12 py-2.5 pr-4 text-sm transition
                                      ${isActive ? 'bg-slate-900 text-blue-300' : 'text-gray-300 hover:bg-slate-800 hover:text-white'}
                                    `}
                                      onClick={() => isMobile && toggleSidebar(false)}
                                    >
                                      <span className="truncate">{subItem.label}</span>
                                    </NavLink>
                                  </li>
                                ))}
                            </ul>
                          )}
                        </>
                      )}
                  </>
                ) : (
                  <NavLink
                    to={item.path}
                    className={({ isActive }) => `
                      flex items-center py-2.5 px-4 text-sm transition
                      ${isActive ? 'bg-slate-800 border-l-4 border-blue-500' : 'hover:bg-slate-800 border-l-4 border-transparent'}
                    `}
                    onClick={() => handleMenuItemClick(item.path)}
                  >
                    <div className={`text-center ${isOpen || isMobile ? 'w-6' : 'w-full'}`}>
                      <i className={`fas fa-${item.icon}`}></i>
                    </div>
                    {(isOpen || isMobile) && <span className="ml-3 truncate">{item.label}</span>}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* ── Hospital Mega Menu: Slide-in over sidebar (left: 0, full height, high z-index) ── */}
      {showMegaMenu && (
        <>
          {/* Backdrop — only covers area to the right of the panel */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 1040, background: 'rgba(10,16,30,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={() => setShowMegaMenu(false)}
          />
          {/* Slide-in panel — starts at left:0 (over the sidebar), full height */}
          <div
            ref={megaMenuRef}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              height: '100vh',
              width: '740px',
              maxWidth: '96vw',
              zIndex: 1041,
              background: 'linear-gradient(160deg, #0f172a 0%, #111827 100%)',
              boxShadow: '12px 0 56px rgba(0,0,0,0.55)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'megaSlideIn 0.26s cubic-bezier(.22,1,.36,1) both',
              overflow: 'hidden',
              borderRight: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {/* Panel Header */}
            <div style={{
              background: '#1e293b',
              borderBottom: '1px solid rgba(59,130,246,0.35)',
              padding: '0 20px',
              height: '60px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: 'rgba(37,99,235,0.25)',
                  border: '1.5px solid rgba(59,130,246,0.45)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="20" height="20" viewBox="0 0 20 20">
                    <rect x="7" y="2" width="6" height="16" rx="2" fill="#60a5fa" />
                    <rect x="2" y="7" width="16" height="6" rx="2" fill="#60a5fa" />
                  </svg>
                </div>
                <div>
                  <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.08em' }}>HOSPITAL INFORMATION SYSTEM</div>
                  <div style={{ color: '#60a5fa', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.06em', marginTop: 1 }}>CubeMed HIS v6.0 — Quick Navigation</div>
                </div>
              </div>
              <button
                onClick={() => setShowMegaMenu(false)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, transition: 'background .15s, color .15s, border-color .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              >&times;</button>
            </div>

            {/* 3-column grid */}
            <div className="his-menu-scroll" style={{ flex: 1, overflowY: 'auto', padding: '22px 22px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0', position: 'relative' }}>
              {/* Hospital watermark */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 0 }}>
                <svg width="320" height="320" viewBox="0 0 200 200" fill="none" style={{ opacity: 0.06 }}>
                  <rect x="80" y="20" width="40" height="120" rx="8" fill="#60a5fa" />
                  <rect x="20" y="80" width="160" height="40" rx="8" fill="#60a5fa" />
                  <polyline points="10,170 35,170 45,148 55,192 65,155 75,170 190,170" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <circle cx="100" cy="95" r="88" stroke="#60a5fa" strokeWidth="3" fill="none" strokeDasharray="8 5" />
                </svg>
              </div>
              {MEGA_MENU_COLS.map((col, ci) => (
                <div key={ci} style={{
                  paddingRight: ci < 2 ? '18px' : 0,
                  borderRight: ci < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  paddingLeft: ci > 0 ? '18px' : 0,
                  position: 'relative', zIndex: 1,
                }}>
                  {col.map(section => (
                    <div key={section.title} style={{ marginBottom: '22px' }}>
                      {/* Section title */}
                      <div style={{
                        fontSize: '0.6rem', fontWeight: 800, color: '#60a5fa',
                        letterSpacing: '0.14em', textTransform: 'uppercase',
                        borderBottom: '1px solid rgba(96,165,250,0.2)',
                        paddingBottom: '6px', marginBottom: '8px',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        <span style={{ display: 'inline-block', width: 3, height: 12, background: '#3b82f6', borderRadius: 2, flexShrink: 0 }} />
                        {section.title}
                      </div>
                      {section.items.map(item => {
                        const isActive = location.pathname === item.path ||
                          (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));
                        return (
                          <button
                            key={item.label}
                            onClick={() => { navigate(item.path); setShowMegaMenu(false); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              width: '100%', textAlign: 'left',
                              background: isActive ? 'rgba(59,130,246,0.2)' : 'transparent',
                              borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: isActive ? '#93c5fd' : '#cbd5e1',
                              fontWeight: isActive ? 700 : 400,
                              fontSize: '0.78rem',
                              padding: '6px 8px',
                              borderRadius: '0 5px 5px 0',
                              marginBottom: '1px',
                              transition: 'background .12s, color .12s, border-left-color .12s',
                            }}
                            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#f1f5f9'; e.currentTarget.style.borderLeftColor = '#60a5fa'; } }}
                            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.borderLeftColor = 'transparent'; } }}
                          >
                            {item.icon && <i className={`fas fa-${item.icon}`} style={{ fontSize: '0.7rem', width: 14, textAlign: 'center', color: isActive ? '#60a5fa' : '#64748b', flexShrink: 0 }} />}
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Panel Footer */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 22px', display: 'flex', alignItems: 'center', gap: '8px', background: '#1e293b', flexShrink: 0 }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', flexShrink: 0 }} />
              <span style={{ color: '#64748b', fontSize: '0.62rem' }}>Secure Access</span>
              <span style={{ color: '#334155', fontSize: '0.62rem' }}>·</span>
              <span style={{ color: '#64748b', fontSize: '0.62rem' }}>HIPAA Compliant</span>
              <span style={{ color: '#334155', fontSize: '0.62rem' }}>·</span>
              <span style={{ color: '#64748b', fontSize: '0.62rem' }}>CubeMed HIS v6.0</span>
            </div>
          </div>
          <style>{`
            @keyframes megaSlideIn {
              from { opacity: 0; transform: translateX(-60px); }
              to   { opacity: 1; transform: translateX(0); }
            }
            .his-menu-scroll::-webkit-scrollbar { width: 4px; }
            .his-menu-scroll::-webkit-scrollbar-track { background: transparent; }
            .his-menu-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
          `}</style>
        </>
      )}
    </>
  );
};

export default Sidebar;
