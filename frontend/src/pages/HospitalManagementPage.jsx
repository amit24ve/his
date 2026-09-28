import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_HOSPITALS = 'https://cubehis.avopay.pro:5000/api/hospitals';

const HOSPITAL_TYPES = ['Multi-Specialty', 'Super-Specialty', 'General', 'Specialty', 'Teaching', 'Nursing Home', 'Clinic', 'Trauma Center'];
const OWNERSHIP_TYPES = ['Private', 'Government', 'Trust', 'NGO', 'Corporate'];
const ACCREDITATION_TYPES = ['NABH', 'JCI', 'ISO', 'NABL', 'None'];

const defaultForm = {
  name: '', code: '', address: '', city: '', state: '', pincode: '', phone: '',
  alt_phone: '', email: '', website: '', total_beds: '', total_rooms: '',
  specialties: '', registration_number: '', license_number: '', accreditation: 'None',
  hospital_type: 'Multi-Specialty', ownership: 'Private', established_year: '',
  contact_person: '', contact_designation: '', logo_url: '', is_active: true, notes: '',
};

export default function HospitalManagementPage() {
  const [hospitals, setHospitals] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editHospital, setEditHospital] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [activeStep, setActiveStep] = useState(1);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` };

  const load = async () => {
    setLoading(true);
    try {
      const [hRes, sRes] = await Promise.all([
        fetch(`${API_HOSPITALS}/`, { headers }),
        fetch(`${API_HOSPITALS}/stats`, { headers }),
      ]);
      const hData = await hRes.json();
      const sData = await sRes.json();
      // API returns { hospitals: [...], total, page }
      setHospitals(Array.isArray(hData) ? hData : (hData.hospitals || []));
      setStats(sData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditHospital(null);
    setForm(defaultForm);
    setActiveStep(1);
    setShowModal(true);
  };

  const openEdit = (h) => {
    setEditHospital(h);
    setForm({
      ...defaultForm,
      ...h,
      specialties: Array.isArray(h.specialties) ? h.specialties.join(', ') : (h.specialties || ''),
      total_beds: h.total_beds ?? '',
      total_rooms: h.total_rooms ?? '',
      established_year: h.established_year ?? '',
    });
    setActiveStep(1);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        total_beds: form.total_beds ? parseInt(form.total_beds) : undefined,
        total_rooms: form.total_rooms ? parseInt(form.total_rooms) : undefined,
        established_year: form.established_year ? parseInt(form.established_year) : undefined,
        specialties: form.specialties ? form.specialties.split(',').map(s => s.trim()).filter(Boolean) : [],
      };
      const url = editHospital ? `${API_HOSPITALS}/${editHospital.id}` : `${API_HOSPITALS}/`;
      const method = editHospital ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (res.ok) {
        setShowModal(false);
        load();
      } else {
        const err = await res.json();
        alert(err.detail || 'Error saving hospital');
      }
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this hospital permanently?')) return;
    await fetch(`${API_HOSPITALS}/${id}`, { method: 'DELETE', headers });
    load();
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const filtered = hospitals.filter(h => {
    const q = search.toLowerCase();
    const matchSearch = !q || h.name?.toLowerCase().includes(q) || h.code?.toLowerCase().includes(q) || h.city?.toLowerCase().includes(q);
    const matchType = !filterType || h.hospital_type === filterType;
    return matchSearch && matchType;
  });

  const STEPS = ['Basic Info', 'Contact & Location', 'Details & Accreditation'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Hospital Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage all hospitals in the network</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold shadow hover:bg-blue-700 transition">
          <i className="fas fa-hospital-alt" /> Add Hospital
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Hospitals', value: stats.total || 0, icon: 'hospital', color: 'blue' },
          { label: 'Active', value: stats.active || 0, icon: 'check-circle', color: 'green' },
          { label: 'Total Beds', value: stats.total_beds || 0, icon: 'bed', color: 'teal' },
          { label: 'Total Rooms', value: stats.total_rooms || 0, icon: 'door-open', color: 'purple' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl bg-${s.color}-100 flex items-center justify-center`}>
              <i className={`fas fa-${s.icon} text-${s.color}-600 text-xl`} />
            </div>
            <div>
              <div className="text-2xl font-black text-gray-800">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, code, city..."
            className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Types</option>
          {HOSPITAL_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <span className="text-sm text-gray-500">{filtered.length} hospital{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-blue-600">
          <i className="fas fa-spinner fa-spin text-2xl mr-3" /> Loading hospitals...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-16 text-center text-gray-400">
          <i className="fas fa-hospital-alt text-5xl mb-4 block text-blue-100" />
          <p className="text-lg font-medium">No hospitals found</p>
          <p className="text-sm mt-1">Click "Add Hospital" to register your first hospital</p>
          <button onClick={openAdd} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition">
            Add First Hospital
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Hospital</th>
                  <th className="text-left px-5 py-3">Location</th>
                  <th className="text-left px-5 py-3">Type</th>
                  <th className="text-center px-5 py-3">Beds</th>
                  <th className="text-left px-5 py-3">Contact Person</th>
                  <th className="text-center px-5 py-3">Accreditation</th>
                  <th className="text-center px-5 py-3">Status</th>
                  <th className="text-center px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(h => (
                  <tr key={h.id} className="hover:bg-blue-50/30 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <i className="fas fa-hospital text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">{h.name}</div>
                          <div className="text-xs text-gray-400 font-mono">{h.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      <div>{h.city}</div>
                      <div className="text-xs text-gray-400">{h.state} {h.pincode}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium">{h.hospital_type}</span>
                      <div className="text-xs text-gray-400 mt-1">{h.ownership}</div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="font-bold text-gray-700">{h.total_beds ?? '—'}</div>
                      <div className="text-xs text-gray-400">{h.total_rooms ? `${h.total_rooms} rooms` : ''}</div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      <div>{h.contact_person || '—'}</div>
                      <div className="text-xs text-gray-400">{h.contact_designation}</div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {h.accreditation && h.accreditation !== 'None' ? (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-medium">{h.accreditation}</span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${h.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {h.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(h)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Edit">
                          <i className="fas fa-edit" />
                        </button>
                        <button onClick={() => handleDelete(h.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition" title="Delete">
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col"
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50 rounded-t-2xl flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-blue-800">
                    <i className="fas fa-hospital-alt mr-2" />{editHospital ? 'Edit Hospital' : 'Add Hospital'}
                  </h2>
                  <p className="text-xs text-blue-500 mt-0.5">Step {activeStep} of {STEPS.length}: {STEPS[activeStep - 1]}</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>

              {/* Step indicator */}
              <div className="px-6 pt-4 flex-shrink-0">
                <div className="flex gap-1">
                  {STEPS.map((s, i) => (
                    <div key={s} className="flex-1">
                      <div className={`h-1.5 rounded-full transition-colors ${activeStep > i ? 'bg-blue-600' : 'bg-gray-200'}`} />
                      <div className={`text-xs mt-1 text-center ${activeStep === i + 1 ? 'text-blue-700 font-semibold' : 'text-gray-400'}`}>{s}</div>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {activeStep === 1 && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="label">Hospital Name<span className="text-red-500">*</span></label>
                        <input required value={form.name} onChange={e => f('name', e.target.value)} placeholder="Full hospital name"
                          className="field" />
                      </div>
                      <div>
                        <label className="label">Hospital Code<span className="text-red-500">*</span></label>
                        <input required value={form.code} onChange={e => f('code', e.target.value.toUpperCase())} placeholder="e.g. HIS-001"
                          className="field font-mono" />
                      </div>
                      <div>
                        <label className="label">Hospital Type</label>
                        <select value={form.hospital_type} onChange={e => f('hospital_type', e.target.value)} className="field">
                          {HOSPITAL_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Ownership</label>
                        <select value={form.ownership} onChange={e => f('ownership', e.target.value)} className="field">
                          {OWNERSHIP_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Established Year</label>
                        <input type="number" min={1800} max={new Date().getFullYear()} value={form.established_year}
                          onChange={e => f('established_year', e.target.value)} placeholder="e.g. 2005" className="field" />
                      </div>
                      <div>
                        <label className="label">Total Beds</label>
                        <input type="number" min={0} value={form.total_beds} onChange={e => f('total_beds', e.target.value)} className="field" />
                      </div>
                      <div>
                        <label className="label">Total Rooms</label>
                        <input type="number" min={0} value={form.total_rooms} onChange={e => f('total_rooms', e.target.value)} className="field" />
                      </div>
                      <div className="col-span-2">
                        <label className="label">Specialties (comma separated)</label>
                        <input value={form.specialties} onChange={e => f('specialties', e.target.value)}
                          placeholder="e.g. Cardiology, Orthopaedics, Neurology" className="field" />
                      </div>
                      <div className="col-span-2 flex items-center gap-3">
                        <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => f('is_active', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded" />
                        <label htmlFor="is_active" className="text-sm text-gray-700">Active Hospital</label>
                      </div>
                    </div>
                  )}

                  {activeStep === 2 && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="label">Address</label>
                        <input value={form.address} onChange={e => f('address', e.target.value)} placeholder="Street address" className="field" />
                      </div>
                      <div>
                        <label className="label">City</label>
                        <input value={form.city} onChange={e => f('city', e.target.value)} className="field" />
                      </div>
                      <div>
                        <label className="label">State</label>
                        <input value={form.state} onChange={e => f('state', e.target.value)} className="field" />
                      </div>
                      <div>
                        <label className="label">Pin Code</label>
                        <input value={form.pincode} onChange={e => f('pincode', e.target.value)} maxLength={6} className="field" />
                      </div>
                      <div>
                        <label className="label">Phone</label>
                        <input type="tel" value={form.phone} onChange={e => f('phone', e.target.value)} className="field" />
                      </div>
                      <div>
                        <label className="label">Alt Phone</label>
                        <input type="tel" value={form.alt_phone} onChange={e => f('alt_phone', e.target.value)} className="field" />
                      </div>
                      <div>
                        <label className="label">Email</label>
                        <input type="email" value={form.email} onChange={e => f('email', e.target.value)} className="field" />
                      </div>
                      <div>
                        <label className="label">Website</label>
                        <input value={form.website} onChange={e => f('website', e.target.value)} placeholder="https://..." className="field" />
                      </div>
                      <div>
                        <label className="label">Contact Person</label>
                        <input value={form.contact_person} onChange={e => f('contact_person', e.target.value)} className="field" />
                      </div>
                      <div>
                        <label className="label">Designation</label>
                        <input value={form.contact_designation} onChange={e => f('contact_designation', e.target.value)} className="field" />
                      </div>
                    </div>
                  )}

                  {activeStep === 3 && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Registration Number</label>
                        <input value={form.registration_number} onChange={e => f('registration_number', e.target.value)} className="field" />
                      </div>
                      <div>
                        <label className="label">License Number</label>
                        <input value={form.license_number} onChange={e => f('license_number', e.target.value)} className="field" />
                      </div>
                      <div>
                        <label className="label">Accreditation</label>
                        <select value={form.accreditation} onChange={e => f('accreditation', e.target.value)} className="field">
                          {ACCREDITATION_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Logo URL</label>
                        <input type="url" value={form.logo_url} onChange={e => f('logo_url', e.target.value)} placeholder="https://..." className="field" />
                      </div>
                      <div className="col-span-2">
                        <label className="label">Notes</label>
                        <textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={3}
                          className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer nav */}
                <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl flex-shrink-0">
                  <button type="button" onClick={() => setActiveStep(s => Math.max(1, s - 1))} disabled={activeStep === 1}
                    className="px-4 py-2 border rounded-xl text-sm hover:bg-white disabled:opacity-40 transition">
                    <i className="fas fa-chevron-left mr-1" /> Back
                  </button>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl text-sm hover:bg-white transition">Cancel</button>
                    {activeStep < STEPS.length ? (
                      <button type="button" onClick={() => setActiveStep(s => s + 1)}
                        className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition">
                        Next <i className="fas fa-chevron-right ml-1" />
                      </button>
                    ) : (
                      <button type="submit" disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition">
                        {saving ? <><i className="fas fa-spinner fa-spin mr-1" />Saving...</> : (editHospital ? 'Update Hospital' : 'Add Hospital')}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .label { display:block; font-size:0.75rem; font-weight:500; color:#4b5563; margin-bottom:0.25rem; }
        .field { width:100%; border:1px solid #d1d5db; border-radius:0.5rem; padding:0.5rem 0.75rem; font-size:0.875rem; outline:none; }
        .field:focus { ring: 2px; border-color:#3b82f6; box-shadow:0 0 0 2px rgba(59,130,246,0.3); }
      `}</style>
    </div>
  );
}
