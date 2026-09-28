import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentUser } from '../hooks/useCurrentUser';
import DoctorSearchInput from '../components/DoctorSearchInput';

const API = 'https://cubehis.avopay.pro:5000/api/opd';
const PATIENTS_API = 'https://cubehis.avopay.pro:5000/api/patients';
const DOCTORS_API = 'https://cubehis.avopay.pro:5000/api/doctors';
const STATUS_COLORS = { Waiting: 'bg-yellow-100 text-yellow-700', 'In Consultation': 'bg-blue-100 text-blue-700', Completed: 'bg-green-100 text-green-700', Cancelled: 'bg-red-100 text-red-700' };

export default function OPDManagementPage() {
  const { hospital_name, headers } = useCurrentUser();
  const [visits, setVisits] = useState([]);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ patient_name: '', patient_id: '', mrn: '', mobile: '', doctor_name: '', department: 'General Medicine', visit_type: 'Consultation', chief_complaint: '', payment_mode: 'Cash', priority: 'Normal' });
  const [filters, setFilters] = useState({ status: '', department: '', doctor_name: '', visit_type: '', date_filter: 'today' });
  const [activeTab, setActiveTab] = useState('queue');
  const [lastToken, setLastToken] = useState(null);
  // Patient search (name/MRN/mobile)
  const [patSearch, setPatSearch] = useState('');
  const [patientSuggestions, setPatientSuggestions] = useState([]);
  const [showPatSuggestions, setShowPatSuggestions] = useState(false);
  const [patSearchLoading, setPatSearchLoading] = useState(false);
  const patTimerRef = useRef(null);
  const mobileTimerRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.department) params.set('department', filters.department);
      if (filters.doctor_name) params.set('doctor_name', filters.doctor_name);
      // date_filter: today | yesterday | week | all
      if (filters.date_filter === 'today') {
        params.set('date_filter', new Date().toISOString().split('T')[0]);
      } else if (filters.date_filter === 'yesterday') {
        const d = new Date(); d.setDate(d.getDate() - 1);
        params.set('date_filter', d.toISOString().split('T')[0]);
      } else if (filters.date_filter === 'all') {
        params.set('date_filter', 'all');
      }
      const [vRes, qRes, sRes] = await Promise.all([
        fetch(`${API}?${params}`, { headers }),
        fetch(`${API}/queue`, { headers }),
        fetch(`${API}/stats`, { headers }),
      ]);
      const [vData, qData, sData] = await Promise.all([vRes.json(), qRes.json(), sRes.json()]);
      setVisits(vData.visits || []);
      // queue endpoint returns array directly
      setQueue(Array.isArray(qData) ? qData : (qData.queue || []));
      setStats(sData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);

  // Patient search by name / MRN / mobile (unified search)
  const doPatSearch = async (q) => {
    if (q.length < 2) { setPatientSuggestions([]); setShowPatSuggestions(false); return; }
    setPatSearchLoading(true);
    try {
      const res = await fetch(`${PATIENTS_API}/search?q=${encodeURIComponent(q)}`, { headers });
      const data = await res.json();
      setPatientSuggestions(Array.isArray(data) ? data : []);
      setShowPatSuggestions(true);
    } catch { setPatientSuggestions([]); }
    setPatSearchLoading(false);
  };

  const onPatSearchChange = (val) => {
    setPatSearch(val);
    clearTimeout(patTimerRef.current);
    patTimerRef.current = setTimeout(() => doPatSearch(val), 350);
  };

  // Mobile number → patient lookup
  const handleMobileChange = (value) => {
    setForm(p => ({ ...p, mobile: value, patient_id: '', mrn: '' }));
    clearTimeout(mobileTimerRef.current);
    if (value.length >= 5) {
      mobileTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`${PATIENTS_API}/?search=${encodeURIComponent(value)}&limit=10`, { headers });
          const data = await res.json();
          const matches = (data.patients || []).filter(p => p.mobile === value);
          setPatientSuggestions(matches);
          setShowPatSuggestions(matches.length > 0);
        } catch (e) {}
      }, 400);
    } else {
      setPatientSuggestions([]);
      setShowPatSuggestions(false);
    }
  };

  const selectPatient = (p) => {
    setPatSearch(`${p.full_name} — ${p.mrn}`);
    setForm(prev => ({
      ...prev,
      patient_name: p.full_name,
      mrn: p.mrn || '',
      mobile: p.mobile || '',
      patient_id: p.id || '',
    }));
    setShowPatSuggestions(false);
  };



  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(API, { method: 'POST', headers, body: JSON.stringify({ ...form, patient_id: form.patient_id || 'walk-in' }) });
      const data = await res.json();
      setLastToken({ token: data.token_number, patient: data.patient_name, dept: data.department });
      setShowModal(false);
      setPatSearch('');
      setPatientSuggestions([]);
      setShowPatSuggestions(false);

      setForm({ patient_name: '', patient_id: '', mrn: '', mobile: '', doctor_name: '', department: 'General Medicine', visit_type: 'Consultation', chief_complaint: '', payment_mode: 'Cash', priority: 'Normal' });
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const updateStatus = async (id, status) => {
    await fetch(`${API}/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ status }) });
    load();
  };

  const DEPARTMENTS = ['General Medicine', 'Cardiology', 'Neurology', 'Orthopaedics', 'Gynaecology', 'Paediatrics', 'ENT', 'Ophthalmology', 'Dermatology', 'Urology', 'Nephrology', 'Oncology', 'Psychiatry', 'Dental'];

  // Visit type filter applied client-side
  const filteredVisits = filters.visit_type ? visits.filter(v => v.visit_type === filters.visit_type) : visits;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">OPD Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            {hospital_name
              ? <span><i className="fas fa-hospital mr-1 text-blue-400" />{hospital_name} · Outpatient queue &amp; consultations</span>
              : 'Outpatient queue, visits & consultations'
            }
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition text-sm">
          <i className="fas fa-user-plus" /> Register OPD Visit
        </button>
      </div>

      {/* Token success notification */}
      <AnimatePresence>
        {lastToken && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="bg-green-50 border border-green-300 rounded-xl p-4 flex items-center justify-between shadow">
            <div className="flex items-center gap-4">
              <div className="bg-green-600 text-white rounded-xl px-5 py-3 text-center min-w-[80px]">
                <div className="text-xs font-medium">TOKEN</div>
                <div className="text-4xl font-black leading-none">#{lastToken.token}</div>
              </div>
              <div>
                <div className="font-bold text-green-800 text-lg">{lastToken.patient}</div>
                <div className="text-sm text-green-600">{lastToken.dept} — OPD registered successfully</div>
              </div>
            </div>
            <button onClick={() => setLastToken(null)} className="text-green-400 hover:text-green-700 ml-4">
              <i className="fas fa-times" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today's Visits", value: stats.today_visits ?? '—', icon: 'hospital-user', color: 'blue' },
          { label: 'Waiting', value: stats.waiting ?? queue.filter(q => q.status === 'Waiting').length ?? '—', icon: 'hourglass-half', color: 'yellow' },
          { label: 'In Consultation', value: stats.in_consultation ?? '—', icon: 'stethoscope', color: 'indigo' },
          { label: 'Completed', value: stats.completed ?? '—', icon: 'check-circle', color: 'green' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`bg-white rounded-xl p-4 shadow border-l-4 border-${s.color}-500`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase">{s.label}</p>
                <p className={`text-2xl font-bold text-${s.color}-600 mt-1`}>{s.value}</p>
              </div>
              <div className={`w-10 h-10 bg-${s.color}-100 rounded-full flex items-center justify-center`}>
                <i className={`fas fa-${s.icon} text-${s.color}-500`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[{ key: 'queue', label: 'Live Queue', icon: 'list-ol' }, { key: 'all', label: "All Today's Visits", icon: 'table' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${activeTab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-blue-600'}`}>
            <i className={`fas fa-${t.icon} mr-1.5`} />{t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {activeTab === 'all' && (
        <div className="bg-white rounded-xl shadow p-4 flex gap-3 flex-wrap items-center">
          {/* Date Range */}
          <select value={filters.date_filter} onChange={e => setFilters(f => ({ ...f, date_filter: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50 text-blue-700">
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="all">All Records</option>
          </select>
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">All Status</option>
            <option>Waiting</option><option>In Consultation</option><option>Completed</option><option>Cancelled</option>
          </select>
          <select value={filters.department} onChange={e => setFilters(f => ({ ...f, department: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={filters.visit_type} onChange={e => setFilters(f => ({ ...f, visit_type: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">All Visit Types</option>
            <option>Consultation</option><option>Follow-up</option><option>Emergency</option><option>Review</option>
          </select>
          <input type="text" placeholder="Filter by Doctor..." value={filters.doctor_name}
            onChange={e => setFilters(f => ({ ...f, doctor_name: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-44" />
        </div>
      )}

      {activeTab === 'queue' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-3 text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading queue...</div>
          ) : queue.filter(q => q.status !== 'Completed').length === 0 ? (
            <div className="col-span-3 text-center py-10 text-gray-400 bg-white rounded-xl shadow">Queue is empty — no patients waiting</div>
          ) : queue.filter(q => q.status !== 'Completed').map((q, idx) => (
            <motion.div key={q.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
              className={`bg-white rounded-xl shadow p-5 border-l-4 ${q.status === 'In Consultation' ? 'border-blue-500' : 'border-yellow-400'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`text-3xl font-black ${q.status === 'In Consultation' ? 'text-blue-600' : 'text-yellow-600'}`}>#{q.token_number}</div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-600'}`}>{q.status}</span>
              </div>
              <div className="font-bold text-gray-800 text-lg">{q.patient_name}</div>
              <div className="text-xs text-gray-400 font-mono mb-3">{q.mrn} {q.mobile ? `| ${q.mobile}` : ''}</div>
              <div className="text-sm text-gray-600 space-y-1">
                <div><i className="fas fa-user-md mr-2 text-blue-400" />{q.doctor_name}</div>
                <div><i className="fas fa-hospital mr-2 text-blue-400" />{q.department}</div>
                {q.chief_complaint && <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 mt-1">{q.chief_complaint}</div>}
              </div>
              <div className="mt-4 flex gap-2">
                {q.status === 'Waiting' && (
                  <button onClick={() => updateStatus(q.id, 'In Consultation')} className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition">
                    <i className="fas fa-play mr-1" /> Start Consultation
                  </button>
                )}
                {q.status === 'In Consultation' && (
                  <button onClick={() => updateStatus(q.id, 'Completed')} className="flex-1 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition">
                    <i className="fas fa-check mr-1" /> Complete
                  </button>
                )}
                <button onClick={() => updateStatus(q.id, 'Cancelled')} className="py-2 px-3 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition">
                  <i className="fas fa-times" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {activeTab === 'all' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-blue-50">
                <tr>
                  {['Token', 'Patient', 'MRN', 'Doctor', 'Department', 'Visit Type', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                ) : filteredVisits.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">No OPD visits today</td></tr>
                ) : filteredVisits.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-xl text-blue-700">#{v.token_number}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{v.patient_name}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600">{v.mrn || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{v.doctor_name}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs bg-indigo-100 text-indigo-700">{v.department}</span></td>
                    <td className="px-4 py-3 text-gray-600">{v.visit_type}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-600'}`}>{v.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {v.status === 'Waiting' && (
                          <button onClick={() => updateStatus(v.id, 'In Consultation')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Start</button>
                        )}
                        {v.status === 'In Consultation' && (
                          <button onClick={() => updateStatus(v.id, 'Completed')} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">Complete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New OPD Visit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800"><i className="fas fa-user-plus mr-2" />Register OPD Visit</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleCreate} className="p-6 grid grid-cols-2 gap-4">
                {/* Unified patient search */}
                <div className="col-span-2 relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <i className="fas fa-search mr-1 text-blue-400" />Search Patient <span className="text-gray-400">(name, MRN, or mobile)</span>
                  </label>
                  <div className="relative">
                    <input type="text" value={patSearch} onChange={e => onPatSearchChange(e.target.value)}
                      placeholder="Type patient name, MRN or mobile..."
                      className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-8" />
                    {patSearchLoading && <i className="fas fa-spinner fa-spin absolute right-3 top-2.5 text-blue-400 text-xs" />}
                  </div>
                  {showPatSuggestions && patientSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 bg-white border rounded-xl shadow-lg mt-1 max-h-52 overflow-y-auto">
                      <div className="px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 border-b">
                        <i className="fas fa-search mr-1" /> Select patient to auto-fill
                      </div>
                      {patientSuggestions.map(p => (
                        <button key={p.id} type="button" onClick={() => selectPatient(p)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 text-left transition border-b last:border-0">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <i className="fas fa-user text-blue-500 text-xs" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-800">{p.full_name}</div>
                            <div className="text-xs text-gray-400">{p.mrn} · {p.age ? `${p.age}Y` : '—'} · {p.gender} · {p.mobile}</div>
                          </div>
                        </button>
                      ))}
                      <button type="button" onClick={() => setShowPatSuggestions(false)} className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 border-t">
                        Close
                      </button>
                    </div>
                  )}
                </div>
                {/* Auto-fill indicator */}
                {form.patient_id && (
                  <div className="col-span-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 flex items-center gap-2">
                    <i className="fas fa-check-circle text-green-500" />
                    Patient auto-filled: <strong>{form.patient_name}</strong> — MRN: <strong>{form.mrn}</strong>
                  </div>
                )}
                {/* Mobile number field */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mobile Number</label>
                  <input type="text" value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))}
                    placeholder="Mobile number..."
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Patient Name<span className="text-red-500">*</span></label>
                  <input required value={form.patient_name} onChange={e => setForm(p => ({ ...p, patient_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">MRN</label>
                  <input value={form.mrn} onChange={e => setForm(p => ({ ...p, mrn: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Doctor Name<span className="text-red-500">*</span></label>
                  <DoctorSearchInput
                    required
                    value={form.doctor_name}
                    onChange={(name, doc) => setForm(f => ({
                      ...f,
                      doctor_name: name,
                      ...(doc?.department ? { department: doc.department } : {}),
                    }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                  <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Visit Type</label>
                  <select value={form.visit_type} onChange={e => setForm(p => ({ ...p, visit_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option>Consultation</option><option>Follow-up</option><option>Emergency</option><option>Review</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option>Normal</option><option>Urgent</option><option>Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
                  <select value={form.payment_mode} onChange={e => setForm(p => ({ ...p, payment_mode: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option>Cash</option><option>Card</option><option>UPI</option><option>Insurance</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Chief Complaint</label>
                  <textarea rows={2} value={form.chief_complaint} onChange={e => setForm(p => ({ ...p, chief_complaint: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="col-span-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Registering...' : 'Register & Get Token'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
