import React, { useEffect, useMemo, useState } from 'react';

const API = 'https://cubehis.avopay.pro:5000/api';

const defaultHospital = {
  name: '',
  code: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
  email: '',
  hospital_type: 'Multi-Specialty',
  ownership: 'Private',
  total_beds: '',
  total_rooms: '',
  is_active: true,
};

const defaultAdmin = {
  username: '',
  full_name: '',
  email: '',
  password: '',
  phone: '',
  department: 'Administration',
  hospital_id: '',
  admin_permissions: ['dashboard', 'appointments', 'patients', 'opd', 'billing', 'reports'],
  is_active: true,
};

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
  };
}

function getIsSuperAdmin() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const roles = Array.isArray(user.roles)
      ? user.roles.map(r => (typeof r === 'string' ? r : r.name || '').toLowerCase())
      : typeof user.roles === 'string' ? [user.roles.toLowerCase()] : [];
    return roles.includes('superadmin') || roles.includes('super_admin');
  } catch {
    return false;
  }
}

function normalizeError(err, fallback) {
  if (typeof err?.detail === 'string') return err.detail;
  if (Array.isArray(err?.detail)) return err.detail.map(item => item.msg).join(', ');
  return fallback;
}

export default function SuperAdminPage() {
  const [activeTab, setActiveTab] = useState('create');
  const [overview, setOverview] = useState({});
  const [permissions, setPermissions] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [hospitalForm, setHospitalForm] = useState(defaultHospital);
  const [adminForm, setAdminForm] = useState(defaultAdmin);
  const [existingAdminForm, setExistingAdminForm] = useState(defaultAdmin);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editForm, setEditForm] = useState(defaultAdmin);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const isSuperAdmin = getIsSuperAdmin();

  const permissionsByGroup = useMemo(() => {
    return permissions.reduce((acc, item) => {
      const group = item.group || 'Other';
      acc[group] = acc[group] || [];
      acc[group].push(item);
      return acc;
    }, {});
  }, [permissions]);

  const load = async () => {
    setLoading(true);
    try {
      const [overviewRes, permissionsRes, hospitalsRes, adminsRes] = await Promise.all([
        fetch(`${API}/super-admin/overview`, { headers: getHeaders() }),
        fetch(`${API}/super-admin/permissions`, { headers: getHeaders() }),
        fetch(`${API}/hospitals/`, { headers: getHeaders() }),
        fetch(`${API}/super-admin/admins`, { headers: getHeaders() }),
      ]);
      if (!overviewRes.ok) throw new Error('Super admin access required');
      const overviewData = await overviewRes.json();
      const permissionsData = await permissionsRes.json();
      const hospitalsData = await hospitalsRes.json();
      const adminsData = await adminsRes.json();
      setOverview(overviewData || {});
      setPermissions(permissionsData.permissions || []);
      setHospitals(Array.isArray(hospitalsData) ? hospitalsData : hospitalsData.hospitals || []);
      setAdmins(adminsData.admins || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not load super admin data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setHospitalField = (key, value) => setHospitalForm(prev => ({ ...prev, [key]: value }));
  const setAdminField = (key, value) => setAdminForm(prev => ({ ...prev, [key]: value }));
  const setExistingAdminField = (key, value) => setExistingAdminForm(prev => ({ ...prev, [key]: value }));
  const setEditField = (key, value) => setEditForm(prev => ({ ...prev, [key]: value }));

  const togglePermission = (formSetter, current, key) => {
    const next = current.includes(key)
      ? current.filter(item => item !== key)
      : [...current, key];
    formSetter('admin_permissions', next);
  };

  const selectPermissionGroup = (formSetter, current, groupItems, checked) => {
    const keys = groupItems.map(item => item.key);
    const set = new Set(current);
    keys.forEach(key => checked ? set.add(key) : set.delete(key));
    formSetter('admin_permissions', Array.from(set));
  };

  const buildHospitalPayload = () => ({
    ...hospitalForm,
    total_beds: hospitalForm.total_beds ? Number(hospitalForm.total_beds) : undefined,
    total_rooms: hospitalForm.total_rooms ? Number(hospitalForm.total_rooms) : undefined,
  });

  const createHospitalWithAdmin = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/super-admin/hospitals-with-admin`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ hospital: buildHospitalPayload(), admin: adminForm }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      setHospitalForm(defaultHospital);
      setAdminForm(defaultAdmin);
      setMessage({ type: 'success', text: 'Hospital and admin created successfully' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: normalizeError(err, 'Could not create hospital admin') });
    } finally {
      setSaving(false);
    }
  };

  const createAdminForExistingHospital = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/super-admin/admins`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(existingAdminForm),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      setExistingAdminForm(defaultAdmin);
      setMessage({ type: 'success', text: 'Admin created successfully' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: normalizeError(err, 'Could not create admin') });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (admin) => {
    setEditingAdmin(admin);
    setEditForm({
      username: admin.username || '',
      full_name: admin.full_name || '',
      email: admin.email || '',
      password: '',
      phone: admin.phone || '',
      department: admin.department || 'Administration',
      hospital_id: admin.hospital_id || '',
      admin_permissions: Array.isArray(admin.admin_permissions) ? admin.admin_permissions : [],
      is_active: admin.is_active !== false,
    });
  };

  const updateAdmin = async (e) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = { ...editForm };
      if (!payload.password) delete payload.password;
      const res = await fetch(`${API}/super-admin/admins/${editingAdmin.id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      setEditingAdmin(null);
      setMessage({ type: 'success', text: 'Admin updated successfully' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: normalizeError(err, 'Could not update admin') });
    } finally {
      setSaving(false);
    }
  };

  const deactivateAdmin = async (admin) => {
    if (!window.confirm(`Deactivate ${admin.username}?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/super-admin/admins/${admin.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw await res.json();
      setMessage({ type: 'success', text: 'Admin deactivated' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: normalizeError(err, 'Could not deactivate admin') });
    } finally {
      setSaving(false);
    }
  };

  const renderPermissions = (current, formSetter) => (
    <div className="space-y-4">
      {Object.entries(permissionsByGroup).map(([group, items]) => {
        const allSelected = items.every(item => current.includes(item.key));
        return (
          <div key={group} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 text-sm">{group}</h3>
              <label className="inline-flex items-center gap-2 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={e => selectPermissionGroup(formSetter, current, items, e.target.checked)}
                />
                Select group
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map(item => (
                <label key={item.key} className="flex items-center gap-2 rounded-md border border-gray-100 px-3 py-2 text-sm hover:bg-blue-50">
                  <input
                    type="checkbox"
                    checked={current.includes(item.key)}
                    onChange={() => togglePermission(formSetter, current, item.key)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <div className="bg-white border border-red-100 rounded-lg p-8 text-center shadow-sm">
          <i className="fas fa-lock text-red-500 text-3xl mb-3" />
          <h1 className="text-xl font-bold text-gray-900">Super admin access required</h1>
          <p className="text-gray-500 mt-2">This panel is only available to the super admin role.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Super Admin Control</h1>
          <p className="text-sm text-gray-500 mt-1">Create hospitals, assign hospital admins, and control sidebar permissions.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
          <i className="fas fa-rotate" /> Refresh
        </button>
      </div>

      {message && (
        <div className={`rounded-md px-4 py-3 text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Hospitals', overview.hospitals || 0, 'hospital'],
          ['Admins', overview.admins || 0, 'user-shield'],
          ['Active Admins', overview.active_admins || 0, 'circle-check'],
          ['Inactive Admins', overview.inactive_admins || 0, 'circle-pause'],
        ].map(([label, value, icon]) => (
          <div key={label} className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500 mt-1">{label}</div>
              </div>
              <div className="w-10 h-10 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                <i className={`fas fa-${icon}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-lg shadow-sm">
        <div className="flex flex-wrap border-b border-gray-100">
          {[
            ['create', 'Create Hospital + Admin', 'hospital-user'],
            ['admin', 'Add Admin', 'user-plus'],
            ['manage', 'Manage Admins', 'sliders'],
          ].map(([key, label, icon]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-3 text-sm font-semibold inline-flex items-center gap-2 border-b-2 ${activeTab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
            >
              <i className={`fas fa-${icon}`} /> {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-12 text-center text-blue-600">
            <i className="fas fa-spinner fa-spin mr-2" /> Loading super admin data...
          </div>
        ) : (
          <div className="p-4 md:p-6">
            {activeTab === 'create' && (
              <form onSubmit={createHospitalWithAdmin} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <section className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-900">Hospital Details</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input label="Hospital Name" value={hospitalForm.name} onChange={v => setHospitalField('name', v)} required />
                    <Input label="Code" value={hospitalForm.code} onChange={v => setHospitalField('code', v)} required />
                    <Input label="City" value={hospitalForm.city} onChange={v => setHospitalField('city', v)} required />
                    <Input label="State" value={hospitalForm.state} onChange={v => setHospitalField('state', v)} />
                    <Input label="Phone" value={hospitalForm.phone} onChange={v => setHospitalField('phone', v)} />
                    <Input label="Email" value={hospitalForm.email} onChange={v => setHospitalField('email', v)} />
                    <Input label="Beds" type="number" value={hospitalForm.total_beds} onChange={v => setHospitalField('total_beds', v)} />
                    <Input label="Rooms" type="number" value={hospitalForm.total_rooms} onChange={v => setHospitalField('total_rooms', v)} />
                    <div className="sm:col-span-2">
                      <Input label="Address" value={hospitalForm.address} onChange={v => setHospitalField('address', v)} required />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-900">Primary Admin</h2>
                  <AdminFields form={adminForm} setField={setAdminField} showHospital={false} hospitals={hospitals} />
                  <h3 className="font-semibold text-gray-900">Sidebar Permissions</h3>
                  {renderPermissions(adminForm.admin_permissions, setAdminField)}
                  <button disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md py-2.5 font-semibold">
                    {saving ? 'Creating...' : 'Create Hospital and Admin'}
                  </button>
                </section>
              </form>
            )}

            {activeTab === 'admin' && (
              <form onSubmit={createAdminForExistingHospital} className="max-w-4xl space-y-5">
                <h2 className="text-lg font-bold text-gray-900">Create Admin For Existing Hospital</h2>
                <AdminFields form={existingAdminForm} setField={setExistingAdminField} showHospital hospitals={hospitals} />
                <h3 className="font-semibold text-gray-900">Sidebar Permissions</h3>
                {renderPermissions(existingAdminForm.admin_permissions, setExistingAdminField)}
                <button disabled={saving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md font-semibold">
                  {saving ? 'Creating...' : 'Create Admin'}
                </button>
              </form>
            )}

            {activeTab === 'manage' && (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-gray-100 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-4 py-3">Admin</th>
                        <th className="text-left px-4 py-3">Hospital</th>
                        <th className="text-left px-4 py-3">Permissions</th>
                        <th className="text-center px-4 py-3">Status</th>
                        <th className="text-right px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {admins.map(admin => (
                        <tr key={admin.id} className="hover:bg-blue-50/40">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{admin.full_name || admin.username}</div>
                            <div className="text-xs text-gray-500">{admin.username} | {admin.email}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{admin.hospital_name || admin.hospital_id || '-'}</td>
                          <td className="px-4 py-3 text-gray-600 max-w-sm">
                            {(admin.admin_permissions || []).length} module{(admin.admin_permissions || []).length === 1 ? '' : 's'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${admin.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {admin.is_active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openEdit(admin)} className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-md font-semibold">Edit</button>
                            <button onClick={() => deactivateAdmin(admin)} className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md font-semibold">Deactivate</button>
                          </td>
                        </tr>
                      ))}
                      {admins.length === 0 && (
                        <tr>
                          <td colSpan="5" className="px-4 py-12 text-center text-gray-400">No hospital admins found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {editingAdmin && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={updateAdmin} className="bg-white w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-lg shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-bold text-lg">Edit Admin</h2>
              <button type="button" onClick={() => setEditingAdmin(null)} className="w-8 h-8 rounded-md hover:bg-gray-100">
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <AdminFields form={editForm} setField={setEditField} showHospital hospitals={hospitals} passwordOptional />
              <h3 className="font-semibold text-gray-900">Sidebar Permissions</h3>
              {renderPermissions(editForm.admin_permissions, setEditField)}
            </div>
            <div className="flex justify-end gap-3 border-t px-5 py-4">
              <button type="button" onClick={() => setEditingAdmin(null)} className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 font-semibold">Cancel</button>
              <button disabled={saving} className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold disabled:bg-blue-300">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', required = false, placeholder = '' }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-600 mb-1">{label}{required ? ' *' : ''}</span>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </label>
  );
}

function AdminFields({ form, setField, showHospital, hospitals, passwordOptional = false }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Input label="Full Name" value={form.full_name} onChange={v => setField('full_name', v)} required />
      <Input label="Username" value={form.username} onChange={v => setField('username', v)} required />
      <Input label="Email" type="email" value={form.email} onChange={v => setField('email', v)} required />
      <Input label={passwordOptional ? 'New Password' : 'Password'} type="password" value={form.password} onChange={v => setField('password', v)} required={!passwordOptional} placeholder={passwordOptional ? 'Leave blank to keep current' : ''} />
      <Input label="Phone" value={form.phone} onChange={v => setField('phone', v)} />
      <Input label="Department" value={form.department} onChange={v => setField('department', v)} />
      {showHospital && (
        <label className="block sm:col-span-2">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Hospital *</span>
          <select
            value={form.hospital_id || ''}
            onChange={e => setField('hospital_id', e.target.value)}
            required
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">Select hospital</option>
            {hospitals.map(hospital => (
              <option key={hospital.id} value={hospital.id}>{hospital.name} ({hospital.code})</option>
            ))}
          </select>
        </label>
      )}
      <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
        <input type="checkbox" checked={form.is_active !== false} onChange={e => setField('is_active', e.target.checked)} />
        Active login
      </label>
    </div>
  );
}
