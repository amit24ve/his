import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'https://cubehis.avopay.pro:5000/api/patients';
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const defaultForm = { full_name: '', date_of_birth: '', age: '', gender: 'Male', mobile: '', email: '', address: '', city: '', blood_group: 'O+', emergency_contact_name: '', emergency_contact_mobile: '', aadhar_number: '', patient_category: 'PRIVATE', insurance_provider: '', insurance_policy_number: '' };

const calculateAge = (dob) => {
  if (!dob) return '';
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? String(age) : '';
};

export default function PatientRegistrationPage() {
  const [patients, setPatients] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ blood_group: '', patient_category: '', gender: '' });
  const [total, setTotal] = useState(0);
  const [viewPatient, setViewPatient] = useState(null);
  const [mobileSuggestions, setMobileSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [previewToken, setPreviewToken] = useState(null);
  const mobileTimerRef = useRef(null);
  const suggestBoxRef = useRef(null);

  const fetchPreviewToken = async () => {
    try {
      const res = await fetch(`${API}/next-token`, { headers });
      const data = await res.json();
      setPreviewToken(data.token_number || null);
    } catch { setPreviewToken(null); }
  };

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filters.blood_group) params.set('blood_group', filters.blood_group);
      if (filters.patient_category) params.set('patient_category', filters.patient_category);
      if (filters.gender) params.set('gender', filters.gender);
      const [pRes, sRes] = await Promise.all([
        fetch(`${API}/?${params}`, { headers }),
        fetch(`${API}/stats`, { headers }),
      ]);
      const pData = await pRes.json();
      const sData = await sRes.json();
      setPatients(pData.patients || []);
      setTotal(pData.total || 0);
      setStats(sData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);

  const handleSearch = (e) => { e.preventDefault(); load(); };

  // DOB → Age auto-calculation
  const handleDobChange = (dob) => {
    const age = calculateAge(dob);
    setForm(p => ({ ...p, date_of_birth: dob, age }));
  };

  // Mobile search for family members
  const handleMobileChange = (value) => {
    setForm(p => ({ ...p, mobile: value }));
    clearTimeout(mobileTimerRef.current);
    if (value.length >= 5) {
      mobileTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`${API}/?search=${encodeURIComponent(value)}&limit=10`, { headers });
          const data = await res.json();
          const matches = (data.patients || []).filter(p => p.mobile === value);
          setMobileSuggestions(matches);
          setShowSuggestions(matches.length > 0);
        } catch (e) {}
      }, 400);
    } else {
      setMobileSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (p) => {
    setViewPatient(p);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/`, { method: 'POST', headers, body: JSON.stringify({ ...form, age: form.age ? parseInt(form.age) : undefined }) });
      setShowModal(false);
      setForm(defaultForm);
      setMobileSuggestions([]);
      setShowSuggestions(false);
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Patient Registration</h1>
          <p className="text-gray-500 text-sm mt-1">Register new patients & manage patient records</p>
        </div>
        <button onClick={() => { setShowModal(true); fetchPreviewToken(); }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition">
          <i className="fas fa-user-plus" /> Register Patient
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Patients', value: stats.total_patients ?? '—', icon: 'users', color: 'blue' },
          { label: 'Male', value: stats.male ?? '—', icon: 'male', color: 'cyan' },
          { label: 'Female', value: stats.female ?? '—', icon: 'female', color: 'pink' },
          { label: 'Private', value: stats.private ?? '—', icon: 'user-tie', color: 'indigo' },
          { label: 'Insurance', value: stats.insurance ?? '—', icon: 'shield-alt', color: 'purple' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`bg-white rounded-xl p-4 shadow border-l-4 border-${s.color}-500`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
                <p className={`text-2xl font-bold text-${s.color}-600 mt-1`}>{s.value}</p>
              </div>
              <div className={`w-10 h-10 bg-${s.color}-100 rounded-full flex items-center justify-center`}>
                <i className={`fas fa-${s.icon} text-${s.color}-500`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input type="text" placeholder="Search by name, mobile, MRN..." value={search} onChange={e => setSearch(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-60" />
          <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><i className="fas fa-search" /></button>
        </form>
        <select value={filters.gender} onChange={e => setFilters(f => ({ ...f, gender: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">All Genders</option>
          <option>Male</option><option>Female</option><option>Other</option>
        </select>
        <select value={filters.blood_group} onChange={e => setFilters(f => ({ ...f, blood_group: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">All Blood Groups</option>
          {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
        </select>
        <select value={filters.patient_category} onChange={e => setFilters(f => ({ ...f, patient_category: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">All Categories</option>
          <option>PRIVATE</option><option>INSURANCE</option><option>GOVT</option>
        </select>
      </div>

      {/* Patient Cards */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-blue-50">
              <tr>
                {['MRN', 'Token No.', 'Patient', 'Age/Gender', 'Blood Group', 'Mobile', 'Category', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
              ) : patients.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12">
                  <i className="fas fa-user-slash text-4xl text-gray-200 mb-3 block" />
                  <p className="text-gray-400">No patients found</p>
                </td></tr>
              ) : patients.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-mono font-bold text-blue-700 text-xs">{p.mrn}</td>
                  <td className="px-4 py-3 font-mono font-bold text-green-700 text-xs">{p.token_number || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.full_name}</div>
                    <div className="text-xs text-gray-400">{p.city || p.address || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.age ? `${p.age}Y` : '—'} / {p.gender}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">{p.blood_group || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.mobile}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.patient_category === 'INSURANCE' ? 'bg-purple-100 text-purple-700' : p.patient_category === 'GOVT' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {p.patient_category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setViewPatient(p)} className="p-1.5 rounded hover:bg-blue-100 text-blue-600 transition" title="View">
                      <i className="fas fa-eye text-xs" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500">Showing {patients.length} of {total} patients</div>
      </div>

      {/* Registration Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800"><i className="fas fa-user-plus mr-2" />Register New Patient</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">
                {/* Token Number - auto generated */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Token Number <span className="ml-1 text-xs font-normal text-amber-600 normal-case">(auto-generated)</span>
                  </label>
                  <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center shadow-sm flex-shrink-0">
                      <i className="fas fa-ticket-alt text-white text-sm" />
                    </div>
                    <div>
                      <p className="text-2xl font-black font-mono tracking-widest text-amber-700">{previewToken ?? '—'}</p>
                      <p className="text-xs text-amber-500 mt-0.5">This token will be assigned on registration</p>
                    </div>
                  </div>
                </div>
                <div className="col-span-2 text-xs font-bold text-blue-700 uppercase tracking-wide border-b pb-1">Personal Information</div>
                {/* Full Name */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name<span className="text-red-500">*</span></label>
                  <input type="text" required value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                {/* Mobile with family-member lookup */}
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mobile<span className="text-red-500">*</span></label>
                  <input type="text" required value={form.mobile} onChange={e => handleMobileChange(e.target.value)}
                    placeholder="Enter mobile number"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  {showSuggestions && (
                    <div ref={suggestBoxRef} className="absolute z-50 left-0 right-0 bg-white border rounded-xl shadow-lg mt-1 max-h-52 overflow-y-auto">
                      <div className="px-3 py-2 text-xs font-bold text-orange-600 bg-orange-50 border-b flex items-center gap-1">
                        <i className="fas fa-users" /> {mobileSuggestions.length} patient(s) already registered with this number
                      </div>
                      {mobileSuggestions.map(s => (
                        <button key={s.id} type="button" onClick={() => selectSuggestion(s)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 text-left transition border-b last:border-0">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <i className="fas fa-user text-blue-500 text-xs" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-800">{s.full_name}</div>
                            <div className="text-xs text-gray-400">{s.mrn} · {s.age ? `${s.age}Y` : '—'} · {s.gender}</div>
                          </div>
                        </button>
                      ))}
                      <button type="button" onClick={() => setShowSuggestions(false)} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 border-t">
                        Close — Register as new patient
                      </button>
                    </div>
                  )}
                </div>
                {/* Age */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
                  <input type="number" value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                {/* DOB with auto-age calc */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth <span className="text-gray-400 font-normal">(auto-fills age)</span></label>
                  <input type="date" value={form.date_of_birth} onChange={e => handleDobChange(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                {/* Email, Aadhar, Address, City */}
                {[
                  { label: 'Email', key: 'email', type: 'email' },
                  { label: 'Aadhar Number', key: 'aadhar_number' },
                  { label: 'Address', key: 'address', span: 2 },
                  { label: 'City', key: 'city' },
                ].map(f => (
                  <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                    <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gender<span className="text-red-500">*</span></label>
                  <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Blood Group</label>
                  <select value={form.blood_group} onChange={e => setForm(p => ({ ...p, blood_group: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div className="col-span-2 text-xs font-bold text-blue-700 uppercase tracking-wide border-b pb-1 mt-2">Emergency Contact</div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Emergency Contact Name</label>
                  <input value={form.emergency_contact_name} onChange={e => setForm(p => ({ ...p, emergency_contact_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Emergency Contact Mobile</label>
                  <input value={form.emergency_contact_mobile} onChange={e => setForm(p => ({ ...p, emergency_contact_mobile: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="col-span-2 text-xs font-bold text-blue-700 uppercase tracking-wide border-b pb-1 mt-2">Patient Category</div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select value={form.patient_category} onChange={e => setForm(p => ({ ...p, patient_category: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option>PRIVATE</option><option>INSURANCE</option><option>GOVT</option>
                  </select>
                </div>
                {form.patient_category === 'INSURANCE' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Insurance Provider</label>
                      <input value={form.insurance_provider} onChange={e => setForm(p => ({ ...p, insurance_provider: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Policy Number</label>
                      <input value={form.insurance_policy_number} onChange={e => setForm(p => ({ ...p, insurance_policy_number: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  </>
                )}
                <div className="col-span-2 flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                    {saving ? <><i className="fas fa-spinner fa-spin mr-1" />Saving...</> : 'Register Patient'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Patient Modal */}
      <AnimatePresence>
        {viewPatient && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800">Patient Details</h2>
                <button onClick={() => setViewPatient(null)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <i className="fas fa-user text-blue-500 text-2xl" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-gray-900">{viewPatient.full_name}</div>
                    <div className="text-sm text-blue-600 font-mono font-medium">{viewPatient.mrn}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Age', viewPatient.age ? `${viewPatient.age} years` : '—'],
                    ['Gender', viewPatient.gender],
                    ['Blood Group', viewPatient.blood_group],
                    ['Mobile', viewPatient.mobile],
                    ['Email', viewPatient.email || '—'],
                    ['Category', viewPatient.patient_category],
                    ['Address', viewPatient.address || '—'],
                    ['City', viewPatient.city || '—'],
                    ['Emergency Contact', viewPatient.emergency_contact_name || '—'],
                    ['Emergency Mobile', viewPatient.emergency_contact_mobile || '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 font-medium">{k}</div>
                      <div className="text-gray-800 font-medium mt-0.5">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
