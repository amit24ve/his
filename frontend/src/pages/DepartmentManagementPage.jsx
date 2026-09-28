import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'https://cubehis.avopay.pro:5000/api/departments';
const TYPES = ['Clinical', 'Diagnostic', 'Administrative', 'Support', 'Emergency'];

const defaultForm = {
  name: '', code: '', type: 'Clinical', head_of_department: '',
  location: '', floor: '', phone: '', email: '', beds_allocated: 0,
  opd_available: true, ipd_available: false, emergency_available: false,
  description: '', services: [], status: 'Active'
};

const TYPE_COLORS = {
  Clinical: 'bg-blue-100 text-blue-700',
  Diagnostic: 'bg-purple-100 text-purple-700',
  Administrative: 'bg-gray-100 text-gray-700',
  Support: 'bg-yellow-100 text-yellow-700',
  Emergency: 'bg-red-100 text-red-700',
};

export default function DepartmentManagementPage() {
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [viewDept, setViewDept] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [servicesInput, setServicesInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ type: '', status: '' });
  const [search, setSearch] = useState('');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type);
      if (filters.status) params.set('status', filters.status);
      if (search) params.set('search', search);
      const [dRes, sRes] = await Promise.all([
        fetch(`${API}?${params}`, { headers }),
        fetch(`${API}/stats`, { headers }),
      ]);
      const dData = await dRes.json();
      const sData = await sRes.json();
      setDepartments(dData.departments || []);
      setStats(sData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);

  const openAdd = () => { setEditDept(null); setForm(defaultForm); setServicesInput(''); setShowModal(true); };
  const openEdit = (d) => {
    setEditDept(d);
    setForm({ ...defaultForm, ...d });
    setServicesInput((d.services || []).join(', '));
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        beds_allocated: parseInt(form.beds_allocated) || 0,
        services: servicesInput ? servicesInput.split(',').map(s => s.trim()).filter(Boolean) : [],
      };
      if (editDept) {
        await fetch(`${API}/${editDept.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
      } else {
        await fetch(API, { method: 'POST', headers, body: JSON.stringify(body) });
      }
      setShowModal(false);
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this department?')) return;
    await fetch(`${API}/${id}`, { method: 'DELETE', headers });
    load();
  };

  const printDept = (dept) => {
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Department Info</title>
      <style>body{font-family:Arial,sans-serif;margin:20px;} h2{color:#1e40af;} table{width:100%;border-collapse:collapse;margin-top:10px;} td{padding:6px 10px;border:1px solid #ddd;} .label{font-weight:bold;background:#f3f4f6;width:35%;}</style>
      </head><body>
      <h2>CubeMed HIS — Department Profile</h2>
      <h3>${dept.name} (${dept.code || ''})</h3>
      <table>
        <tr><td class="label">Type</td><td>${dept.type}</td></tr>
        <tr><td class="label">HOD</td><td>${dept.head_of_department || '—'}</td></tr>
        <tr><td class="label">Location</td><td>${dept.location || '—'}, Floor: ${dept.floor || '—'}</td></tr>
        <tr><td class="label">Phone</td><td>${dept.phone || '—'}</td></tr>
        <tr><td class="label">Email</td><td>${dept.email || '—'}</td></tr>
        <tr><td class="label">Beds Allocated</td><td>${dept.beds_allocated || 0}</td></tr>
        <tr><td class="label">OPD Available</td><td>${dept.opd_available ? 'Yes' : 'No'}</td></tr>
        <tr><td class="label">IPD Available</td><td>${dept.ipd_available ? 'Yes' : 'No'}</td></tr>
        <tr><td class="label">Emergency</td><td>${dept.emergency_available ? 'Yes' : 'No'}</td></tr>
        <tr><td class="label">Services</td><td>${(dept.services || []).join(', ') || '—'}</td></tr>
        <tr><td class="label">Description</td><td>${dept.description || '—'}</td></tr>
        <tr><td class="label">Status</td><td>${dept.status}</td></tr>
      </table>
      <p style="margin-top:20px;font-size:12px;color:#666;">Printed on ${new Date().toLocaleString()}</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Department Management</h1>
          <p className="text-gray-500 text-sm mt-1">Hospital departments, services & HOD management</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition text-sm">
          <i className="fas fa-plus" /> Add Department
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Departments', value: stats.total ?? '—', icon: 'hospital', color: 'blue' },
          { label: 'Active', value: stats.active ?? '—', icon: 'check-circle', color: 'green' },
          { label: 'Clinical', value: stats.clinical ?? '—', icon: 'stethoscope', color: 'purple' },
          { label: 'Diagnostic', value: stats.diagnostic ?? '—', icon: 'flask', color: 'yellow' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`bg-white rounded-xl p-4 shadow border-l-4 border-${s.color}-500`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
                <p className={`text-2xl font-bold text-${s.color}-700`}>{s.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-full bg-${s.color}-100 flex items-center justify-center`}>
                <i className={`fas fa-${s.icon} text-${s.color}-500`}></i>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl shadow">
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
          placeholder="Search department..." className="border rounded-lg px-3 py-2 text-sm flex-1" />
        <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Status</option>
          <option>Active</option><option>Inactive</option>
        </select>
        <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Search</button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        {loading ? (
          <div className="text-center py-16 text-gray-400"><i className="fas fa-spinner fa-spin text-3xl" /></div>
        ) : departments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <i className="fas fa-hospital text-4xl mb-2" /><p>No departments found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-blue-50 text-blue-800">
              <tr>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">HOD</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Beds</th>
                <th className="px-4 py-3 text-left">Services</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {departments.map((d, i) => (
                <motion.tr key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="hover:bg-blue-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                  <td className="px-4 py-3 text-gray-600">{d.code || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[d.type] || 'bg-gray-100 text-gray-700'}`}>{d.type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{d.head_of_department || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{d.location || '—'}{d.floor ? `, ${d.floor}` : ''}</td>
                  <td className="px-4 py-3 text-gray-600">{d.beds_allocated || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {d.opd_available && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">OPD</span>}
                      {d.ipd_available && <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs">IPD</span>}
                      {d.emergency_available && <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-xs">ER</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{d.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setViewDept(d)} className="p-1.5 rounded text-blue-600 hover:bg-blue-100" title="View"><i className="fas fa-eye" /></button>
                      <button onClick={() => printDept(d)} className="p-1.5 rounded text-green-600 hover:bg-green-100" title="Print"><i className="fas fa-print" /></button>
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded text-yellow-600 hover:bg-yellow-100" title="Edit"><i className="fas fa-edit" /></button>
                      <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded text-red-600 hover:bg-red-100" title="Delete"><i className="fas fa-trash" /></button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
              <div className="flex items-center justify-between p-5 border-b">
                <h2 className="text-lg font-bold text-blue-800">{editDept ? 'Edit Department' : 'Add New Department'}</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Department Name *</label>
                    <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. Cardiology" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Dept. Code</label>
                    <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. CARD" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Type</label>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                      {TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Head of Department (HOD)</label>
                    <input value={form.head_of_department} onChange={e => setForm(f => ({ ...f, head_of_department: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Dr. Name" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Location</label>
                    <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Block / Wing" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Floor</label>
                    <input value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. Ground, 1st" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Phone</label>
                    <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Beds Allocated</label>
                    <input type="number" value={form.beds_allocated} onChange={e => setForm(f => ({ ...f, beds_allocated: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" min="0" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                      <option>Active</option><option>Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-4">
                  {[
                    { key: 'opd_available', label: 'OPD Available' },
                    { key: 'ipd_available', label: 'IPD Available' },
                    { key: 'emergency_available', label: 'Emergency' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} className="rounded" />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Services Offered (comma separated)</label>
                  <input value={servicesInput} onChange={e => setServicesInput(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. ECG, Echocardiography, Cardiac Catheterization" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" rows={2} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Saving...' : (editDept ? 'Update Department' : 'Add Department')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Modal */}
      <AnimatePresence>
        {viewDept && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
              <div className="flex items-center justify-between p-5 border-b">
                <h2 className="text-lg font-bold text-blue-800">Department Details</h2>
                <div className="flex gap-2">
                  <button onClick={() => printDept(viewDept)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 font-medium">
                    <i className="fas fa-print mr-1" /> Print
                  </button>
                  <button onClick={() => setViewDept(null)} className="text-gray-400 hover:text-red-500"><i className="fas fa-times" /></button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <i className="fas fa-hospital text-2xl" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{viewDept.name}</h3>
                    <p className="text-sm text-gray-500">{viewDept.type} {viewDept.code ? `| ${viewDept.code}` : ''}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${viewDept.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{viewDept.status}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['HOD', viewDept.head_of_department || '—'],
                    ['Location', [viewDept.location, viewDept.floor].filter(Boolean).join(', ') || '—'],
                    ['Phone', viewDept.phone || '—'],
                    ['Email', viewDept.email || '—'],
                    ['Beds Allocated', viewDept.beds_allocated || 0],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className="font-medium text-gray-800">{value}</p>
                    </div>
                  ))}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Availability</p>
                    <div className="flex gap-1 flex-wrap">
                      {viewDept.opd_available && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">OPD</span>}
                      {viewDept.ipd_available && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">IPD</span>}
                      {viewDept.emergency_available && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">Emergency</span>}
                    </div>
                  </div>
                </div>
                {viewDept.services?.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Services Offered</p>
                    <div className="flex flex-wrap gap-1">
                      {viewDept.services.map(s => <span key={s} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">{s}</span>)}
                    </div>
                  </div>
                )}
                {viewDept.description && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Description</p>
                    <p className="text-sm text-gray-800">{viewDept.description}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
