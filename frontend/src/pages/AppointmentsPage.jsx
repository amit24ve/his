import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DoctorSearchInput from '../components/DoctorSearchInput';

const API = 'https://cubehis.avopay.pro:5000/api/appointments';
const PATIENTS_API = 'https://cubehis.avopay.pro:5000/api/patients';
const HOSPITALS_API = 'https://cubehis.avopay.pro:5000/api/hospitals';

const DEPARTMENTS = ['Cardiology', 'Oncology', 'Orthopaedics', 'Gynaecology', 'Neurology', 'General Medicine', 'Paediatrics', 'Dermatology', 'ENT', 'Ophthalmology', 'Urology', 'Gastroenterology'];
const STATUS_COLORS = { Scheduled: 'bg-blue-100 text-blue-700', Completed: 'bg-green-100 text-green-700', Cancelled: 'bg-red-100 text-red-700', 'In Consultation': 'bg-yellow-100 text-yellow-700' };

const today = new Date().toISOString().split('T')[0];
const defaultForm = { patient_name: '', patient_mobile: '', patient_age: '', patient_gender: 'Male', doctor_name: '', department: 'General Medicine', appointment_date: today, appointment_time: '09:00', appointment_type: 'OPD', notes: '', mrn: '' };

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ date_from: today, date_to: today, status: '', department: '', appointment_type: '', hospital_id: '' });
  const [datePreset, setDatePreset] = useState('today');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [patientSuggestions, setPatientSuggestions] = useState([]);
  const [showPatSuggestions, setShowPatSuggestions] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const mobileTimerRef = useRef(null);
  const customRangeRef = useRef(null);

  // Close custom range popup on outside click
  useEffect(() => {
    const handler = (e) => { if (customRangeRef.current && !customRangeRef.current.contains(e.target)) setShowCustomRange(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDatePreset = (val) => {
    setDatePreset(val);
    setShowCustomRange(false);
    if (val === 'today') {
      setFilters(f => ({ ...f, date_from: today, date_to: today }));
    } else if (val === 'week') {
      const d = new Date(); const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setFilters(f => ({ ...f, date_from: mon.toISOString().split('T')[0], date_to: sun.toISOString().split('T')[0] }));
    } else if (val === 'month') {
      const d = new Date();
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      setFilters(f => ({ ...f, date_from: first.toISOString().split('T')[0], date_to: last.toISOString().split('T')[0] }));
    } else if (val === 'custom') {
      setShowCustomRange(true);
    }
  };

  const applyCustomRange = () => {
    if (customFrom && customTo) {
      setFilters(f => ({ ...f, date_from: customFrom, date_to: customTo }));
      setShowCustomRange(false);
    }
  };

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` };

  // Fetch hospitals for filter dropdown
  useEffect(() => {
    fetch(`${HOSPITALS_API}/?limit=100`, { headers })
      .then(r => r.json())
      .then(d => setHospitals(d.hospitals || []))
      .catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);
      if (filters.status) params.set('status', filters.status);
      if (filters.department) params.set('department', filters.department);
      if (filters.hospital_id) params.set('hospital_id', filters.hospital_id);
      const [aRes, sRes] = await Promise.all([
        fetch(`${API}/?${params}`, { headers }),
        fetch(`${API}/stats`, { headers }),
      ]);
      const aData = await aRes.json();
      const sData = await sRes.json();
      setAppointments(aData.appointments || []);
      setTotal(aData.total || 0);
      setStats(sData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);

  // Mobile → patient lookup
  const handleMobileChange = (value) => {
    setForm(p => ({ ...p, patient_mobile: value }));
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
    setForm(prev => ({ ...prev, patient_name: p.full_name, patient_mobile: p.mobile, patient_age: p.age ? String(p.age) : '', patient_gender: p.gender || 'Male', mrn: p.mrn || '' }));
    setShowPatSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/`, { method: 'POST', headers, body: JSON.stringify({ ...form, patient_age: form.patient_age ? parseInt(form.patient_age) : undefined, mrn: form.mrn || undefined }) });
      setShowModal(false);
      setForm(defaultForm);
      load();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const updateStatus = async (id, status) => {
    await fetch(`${API}/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ status }) });
    load();
  };

  const clearFilters = () => { setFilters({ date_from: today, date_to: today, status: '', department: '', appointment_type: '', hospital_id: '' }); setDatePreset('today'); setCustomFrom(''); setCustomTo(''); };

  const filtered = appointments.filter(a => {
    if (search && !a.patient_name?.toLowerCase().includes(search.toLowerCase()) && !a.patient_mobile?.includes(search) && !a.mrn?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.appointment_type && a.appointment_type !== filters.appointment_type) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Appointments</h1>
          <p className="text-gray-500 text-sm mt-1">Manage patient appointments & scheduling</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition">
          <i className="fas fa-plus" /> New Appointment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today's Total", value: stats.today_total ?? '—', icon: 'calendar-check', color: 'blue' },
          { label: 'Scheduled', value: stats.today_scheduled ?? '—', icon: 'clock', color: 'yellow' },
          { label: 'Completed', value: stats.today_completed ?? '—', icon: 'check-circle', color: 'green' },
          { label: 'Cancelled', value: stats.today_cancelled ?? '—', icon: 'times-circle', color: 'red' },
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

      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 items-center">

        {/* Date Preset Dropdown */}
        <div className="relative" ref={customRangeRef}>
          <div className="flex items-center gap-0 border rounded-lg overflow-hidden">
            <span className="px-2.5 bg-blue-50 border-r h-full flex items-center">
              <i className="fas fa-calendar-alt text-blue-500 text-xs" />
            </span>
            <select
              value={datePreset}
              onChange={e => handleDatePreset(e.target.value)}
              className="pl-2 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white appearance-none cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
            <i className="fas fa-chevron-down text-gray-400 text-xs -ml-6 pointer-events-none" />
          </div>

          {/* Custom Range Popup */}
          <AnimatePresence>
            {showCustomRange && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full mt-2 z-50 bg-white border border-blue-200 rounded-xl shadow-xl p-4 w-72"
              >
                <p className="text-xs font-semibold text-blue-700 mb-3 flex items-center gap-1.5">
                  <i className="fas fa-calendar-range" /> Custom Date Range
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">From</label>
                    <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">To</label>
                    <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <button
                    onClick={applyCustomRange}
                    disabled={!customFrom || !customTo}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                    Apply Range
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px h-6 bg-gray-200" />

        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">All Status</option>
          {['Scheduled', 'In Consultation', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filters.department} onChange={e => setFilters(f => ({ ...f, department: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={filters.appointment_type} onChange={e => setFilters(f => ({ ...f, appointment_type: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">All Types</option>
          {['OPD', 'IPD', 'Teleconsult', 'Emergency'].map(t => <option key={t}>{t}</option>)}
        </select>

        {hospitals.length > 1 && (
          <select value={filters.hospital_id} onChange={e => setFilters(f => ({ ...f, hospital_id: e.target.value }))}
            className="border border-purple-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-purple-50 text-purple-800">
            <option value="">All Hospitals</option>
            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {datePreset === 'custom' && filters.date_from && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              {filters.date_from} → {filters.date_to}
            </span>
          )}
          <input type="text" placeholder="Search patient / MRN..." value={search} onChange={e => setSearch(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-52" />
          <button onClick={clearFilters} title="Clear filters"
            className="p-2 rounded-lg border hover:bg-red-50 hover:border-red-300 text-gray-400 hover:text-red-500 transition">
            <i className="fas fa-times text-xs" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-blue-50">
              <tr>
                {['Token', 'MRN', 'Patient', 'Doctor', 'Department', 'Time', 'Type', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">No appointments found</td></tr>
              ) : filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-bold text-blue-700">#{a.token_number}</td>
                  <td className="px-4 py-3">
                    {a.mrn ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 border border-teal-200 text-teal-700 rounded-md text-xs font-mono font-semibold">
                        <i className="fas fa-id-card text-teal-400" style={{fontSize:'10px'}} />
                        {a.mrn}
                      </span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{a.patient_name}</div>
                    <div className="text-xs text-gray-400">{a.patient_mobile}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{a.doctor_name}</td>
                  <td className="px-4 py-3 text-gray-600">{a.department}</td>
                  <td className="px-4 py-3 text-gray-600">{a.appointment_time}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{a.appointment_type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {a.status === 'Scheduled' && (
                        <button onClick={() => updateStatus(a.id, 'In Consultation')} title="Start" className="p-1.5 rounded hover:bg-yellow-100 text-yellow-600 transition">
                          <i className="fas fa-play text-xs" />
                        </button>
                      )}
                      {a.status === 'In Consultation' && (
                        <button onClick={() => updateStatus(a.id, 'Completed')} title="Complete" className="p-1.5 rounded hover:bg-green-100 text-green-600 transition">
                          <i className="fas fa-check text-xs" />
                        </button>
                      )}
                      {a.status !== 'Cancelled' && a.status !== 'Completed' && (
                        <button onClick={() => updateStatus(a.id, 'Cancelled')} title="Cancel" className="p-1.5 rounded hover:bg-red-100 text-red-500 transition">
                          <i className="fas fa-times text-xs" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500">Showing {filtered.length} of {total} appointments</div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-bold text-blue-800">New Appointment</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">
                {/* Mobile with patient lookup */}
                <div className="col-span-2 relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mobile Number <span className="text-gray-400">(search existing patient)</span></label>
                  <input type="text" required value={form.patient_mobile} onChange={e => handleMobileChange(e.target.value)}
                    placeholder="Enter mobile to search patient..."
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  {showPatSuggestions && (
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
                            <div className="text-xs text-gray-400">{p.mrn} · {p.age ? `${p.age}Y` : '—'} · {p.gender}</div>
                          </div>
                        </button>
                      ))}
                      <button type="button" onClick={() => setShowPatSuggestions(false)} className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 border-t">Close</button>
                    </div>
                  )}
                </div>
                {/* Patient Name */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Patient Name<span className="text-red-500">*</span></label>
                  <input type="text" required value={form.patient_name} onChange={e => setForm(p => ({ ...p, patient_name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                {/* MRN Number */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    MRN Number
                    <span className="ml-2 text-xs text-teal-600 font-normal">{form.mrn ? '(from existing patient)' : '(will be auto-generated)'}</span>
                  </label>
                  <div className="relative">
                    <i className="fas fa-id-card absolute left-3 top-1/2 -translate-y-1/2 text-teal-400 text-xs" />
                    <input type="text" value={form.mrn} onChange={e => setForm(p => ({ ...p, mrn: e.target.value }))}
                      placeholder="Auto-generated if left blank"
                      className="w-full border border-teal-200 rounded-lg pl-8 pr-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-400 bg-teal-50 text-teal-800 placeholder:text-teal-300 placeholder:font-sans" />
                  </div>
                </div>
                {/* Age & Gender */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
                  <input type="number" value={form.patient_age} onChange={e => setForm(p => ({ ...p, patient_age: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                  <select value={form.patient_gender} onChange={e => setForm(p => ({ ...p, patient_gender: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select value={form.appointment_type} onChange={e => setForm(p => ({ ...p, appointment_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option>OPD</option><option>IPD</option><option>Teleconsult</option><option>Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Doctor Name<span className="text-red-500">*</span></label>
                  <DoctorSearchInput
                    required
                    value={form.doctor_name}
                    onChange={(name, doc) => setForm(p => ({
                      ...p,
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input type="date" value={form.appointment_date} onChange={e => setForm(p => ({ ...p, appointment_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                  <input type="time" value={form.appointment_time} onChange={e => setForm(p => ({ ...p, appointment_time: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="col-span-2 flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60">
                    {saving ? <><i className="fas fa-spinner fa-spin mr-1" /> Saving...</> : 'Book Appointment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
