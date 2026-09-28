import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useCurrentUser';
import DoctorSearchInput from '../components/DoctorSearchInput';

const API_BASE = 'https://cubehis.avopay.pro:5000/api';
const API_PATIENTS = `${API_BASE}/patients`;

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Other'];
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed'];
const CATEGORIES = ['CASH', 'INSURANCE', 'NWH STAFF MEDICAL SCHEME', 'CORPORATE', 'NHIF', 'DIPLOMATIC'];
const DEPARTMENTS = [
  'General Medicine', 'Cardiology', 'Neurology', 'Orthopaedics', 'Gynaecology',
  'Paediatrics', 'ENT', 'Ophthalmology', 'Dermatology', 'Urology',
  'Nephrology', 'Oncology', 'Psychiatry', 'Dental', 'Radiology',
];
const RELATIONS = ['Father', 'Mother', 'Spouse', 'Sibling', 'Child', 'Friend', 'Guardian', 'Other'];
const VISIT_TYPES = ['Consultation', 'Follow-up', 'Emergency', 'Walk-in', 'Referral', 'Review'];
const PAYMENT_MODES = ['Cash', 'Card', 'UPI', 'Insurance', 'Credit', 'NHIF'];

const blankForm = {
  full_name: '', date_of_birth: '', age: '', gender: 'Male', marital_status: 'Single',
  blood_group: 'O+', nationality: 'Indian', religion: '', occupation: '',
  mobile: '', alt_mobile: '', email: '', address: '', city: '', state: '', pin_code: '',
  aadhar_number: '', pan_number: '', passport_number: '',
  emergency_contact_name: '', emergency_contact_mobile: '', emergency_contact_relation: 'Father',
  patient_category: 'CASH', department: 'General Medicine', referred_by: '',
  chief_complaint: '', known_allergies: '', past_history: '',
  insurance_provider: '', insurance_policy_number: '', insurance_validity: '',
  visit_type: 'Consultation', payment_mode: 'Cash', doctor_name: '',
  admit_date: '', exit_date: '',
};

const CAT_COLORS = {
  CASH: 'bg-green-100 text-green-700',
  INSURANCE: 'bg-blue-100 text-blue-700',
  'NWH STAFF MEDICAL SCHEME': 'bg-purple-100 text-purple-700',
  CORPORATE: 'bg-indigo-100 text-indigo-700',
  NHIF: 'bg-teal-100 text-teal-700',
  DIPLOMATIC: 'bg-orange-100 text-orange-700',
};
const STATUS_COLORS = {
  Waiting: 'bg-amber-100 text-amber-700 border border-amber-300',
  'In Consultation': 'bg-blue-100 text-blue-700 border border-blue-300',
  Completed: 'bg-green-100 text-green-700 border border-green-300',
  Cancelled: 'bg-red-100 text-red-700 border border-red-300',
};

const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-gray-50 hover:bg-white transition';

function StatCard({ label, value, icon, color }) {
  const palettes = {
    blue: 'border-blue-500 text-blue-600 bg-blue-50',
    green: 'border-green-500 text-green-600 bg-green-50',
    amber: 'border-amber-500 text-amber-600 bg-amber-50',
    red: 'border-red-500 text-red-600 bg-red-50',
    purple: 'border-purple-500 text-purple-600 bg-purple-50',
    teal: 'border-teal-500 text-teal-600 bg-teal-50',
  };
  const [border, text, bg] = palettes[color]?.split(' ') ?? [];
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${border}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-black mt-1 ${text}`}>{value ?? '—'}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bg}`}>
          <i className={`fas fa-${icon} ${text} text-lg`} />
        </div>
      </div>
    </div>
  );
}

function FLabel({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const STEPS = [
  { n: 1, label: 'Search / Quick', icon: 'search' },
  { n: 2, label: 'Personal Info', icon: 'user' },
  { n: 3, label: 'Contact & ID', icon: 'address-card' },
  { n: 4, label: 'Visit Details', icon: 'stethoscope' },
  { n: 5, label: 'Insurance + Docs', icon: 'shield-alt' },
];

export default function ReceptionPage() {
  const [activeTab, setActiveTab] = useState('today');
  const navigate = useNavigate();
  const { isAdmin, hospital_id, hospital_name, headers } = useCurrentUser();
  const [todayVisits, setTodayVisits] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [regStep, setRegStep] = useState(1);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  // Auto-fill state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [foundPatient, setFoundPatient] = useState(null); // existing patient object
  const [patientVisitHistory, setPatientVisitHistory] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  // Other
  const [pSearch, setPSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewPatient, setViewPatient] = useState(null);
  const [viewVisits, setViewVisits] = useState([]);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [successData, setSuccessData] = useState(null); // shown after registration
  const [previewToken, setPreviewToken] = useState(null);
  const fileRef = useRef();
  const searchTimerRef = useRef();
  const dropdownRef = useRef();

  const fetchPreviewToken = async () => {
    try {
      const res = await fetch(`${API_PATIENTS}/next-token`, { headers });
      const data = await res.json();
      setPreviewToken(data.token_number || null);
    } catch { setPreviewToken(null); }
  };

  // headers come from useCurrentUser hook above

  // ── Load page data ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (pSearch) params.set('search', pSearch);
      if (filterCat) params.set('patient_category', filterCat);
      const tvParams = new URLSearchParams();
      if (visitDate) tvParams.set('date', visitDate);
      const [tvRes, ptRes, stRes] = await Promise.all([
        fetch(`${API_PATIENTS}/visits?${tvParams}`, { headers }),
        fetch(`${API_PATIENTS}/?${params}`, { headers }),
        fetch(`${API_PATIENTS}/stats`, { headers }),
      ]);
      const tvData = await tvRes.json();
      const ptData = await ptRes.json();
      const stData = await stRes.json();
      setTodayVisits(tvData.visits || []);
      setAllPatients(ptData.patients || []);
      setStats(stData);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [pSearch, filterCat, visitDate]);

  useEffect(() => { load(); }, [filterCat, visitDate]);

  // ── Auto-fill search (debounced) ──
  const doSearch = async (q) => {
    if (q.length < 3) { setSearchResults([]); setShowDropdown(false); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`${API_PATIENTS}/search?q=${encodeURIComponent(q)}`, { headers });
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
      setShowDropdown(true);
    } catch { setSearchResults([]); }
    setSearchLoading(false);
  };

  const onSearchChange = (val) => {
    setSearchQuery(val);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(val), 350);
  };

  const selectPatient = async (p) => {
    setFoundPatient(p);
    setShowDropdown(false);
    setSearchQuery(`${p.full_name} — ${p.mobile}`);
    // Fill all form fields from existing patient
    setForm({
      full_name: p.full_name || '',
      date_of_birth: p.date_of_birth || '',
      age: p.age ? String(p.age) : '',
      gender: p.gender || 'Male',
      marital_status: p.marital_status || 'Single',
      blood_group: p.blood_group || 'O+',
      nationality: p.nationality || 'Indian',
      religion: p.religion || '',
      occupation: p.occupation || '',
      mobile: p.mobile || '',
      alt_mobile: p.alt_mobile || '',
      email: p.email || '',
      address: p.address || '',
      city: p.city || '',
      state: p.state || '',
      pin_code: p.pin_code || '',
      aadhar_number: p.aadhar_number || '',
      pan_number: p.pan_number || '',
      passport_number: p.passport_number || '',
      emergency_contact_name: p.emergency_contact_name || '',
      emergency_contact_mobile: p.emergency_contact_mobile || '',
      emergency_contact_relation: p.emergency_contact_relation || 'Father',
      patient_category: p.patient_category || 'CASH',
      department: p.department || 'General Medicine',
      referred_by: '',
      chief_complaint: '',
      known_allergies: p.known_allergies || '',
      past_history: p.past_history || '',
      insurance_provider: p.insurance_provider || '',
      insurance_policy_number: p.insurance_policy_number || '',
      insurance_validity: p.insurance_validity || '',
      visit_type: 'Follow-up',
      payment_mode: p.payment_mode || 'Cash',
      doctor_name: p.doctor_name || '',
      admit_date: new Date().toISOString().split('T')[0],
      exit_date: '',
    });
    // Load visit history
    try {
      const vRes = await fetch(`${API_PATIENTS}/visits?patient_id=${p.id}`, { headers });
      const vData = await vRes.json();
      setPatientVisitHistory(vData.visits || []);
    } catch { setPatientVisitHistory([]); }
  };

  const clearPatient = () => {
    setFoundPatient(null);
    setSearchQuery('');
    setForm(blankForm);
    setPatientVisitHistory([]);
    setSearchResults([]);
  };

  // ── Age calculation from DOB (accurate, month+day aware) ──
  const calcAge = (dob) => {
    if (!dob) return '';
    const today = new Date();
    const birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? String(age) : '';
  };

  // ── Form field change ──
  const change = (e) => {
    const { name, value } = e.target;
    setForm(f => {
      const next = { ...f, [name]: value };
      if (name === 'date_of_birth') {
        next.age = calcAge(value);
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        age: form.age ? parseInt(form.age) : undefined,
        hospital_id: hospital_id || undefined,
        hospital_name: hospital_name || undefined,
      };
      if (foundPatient) {
        // Returning patient — add new visit
        const res = await fetch(`${API_PATIENTS}/visits`, {
          method: 'POST', headers,
          body: JSON.stringify({
            patient_id: foundPatient.id,
            mrn: foundPatient.mrn,
            patient_name: foundPatient.full_name,
            visit_date: payload.admit_date || new Date().toISOString().split('T')[0],
            admit_date: payload.admit_date || new Date().toISOString().split('T')[0],
            exit_date: payload.exit_date || null,
            department: payload.department,
            doctor_name: payload.doctor_name,
            visit_type: payload.visit_type,
            payment_mode: payload.payment_mode,
            patient_category: payload.patient_category,
            chief_complaint: payload.chief_complaint,
            status: 'Waiting',
          }),
        });
        const visitResult = await res.json();
        setSuccessData({
          mrn: foundPatient.mrn,
          name: foundPatient.full_name,
          department: payload.department,
          doctor: payload.doctor_name,
          visitDate: payload.admit_date || new Date().toISOString().split('T')[0],
          isNew: false,
          token: visitResult.token_number || null,
        });
      } else {
        // New patient
        const res = await fetch(`${API_PATIENTS}/`, { method: 'POST', headers, body: JSON.stringify(payload) });
        const result = await res.json();
        setSuccessData({
          mrn: result.mrn,
          name: result.full_name || payload.full_name,
          department: payload.department,
          doctor: payload.doctor_name,
          visitDate: payload.admit_date || new Date().toISOString().split('T')[0],
          isNew: true,
          token: result.token_number || null,
        });
      }
      setShowModal(false);
      clearPatient();
      setRegStep(1);
      setUploadFiles([]);
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  // ── View patient details & history ──
  const openView = async (p) => {
    setViewPatient(p);
    try {
      const res = await fetch(`${API_PATIENTS}/visits?patient_id=${p.id}`, { headers });
      const data = await res.json();
      setViewVisits(data.visits || []);
    } catch { setViewVisits([]); }
  };

  const openNew = () => {
    clearPatient();
    setRegStep(1);
    setUploadFiles([]);
    setShowModal(true);
    fetchPreviewToken();
  };

  const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center shadow-lg">
            <i className="fas fa-hospital-user text-white text-xl" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-blue-900">Reception</h1>
            <p className="text-gray-400 text-sm">
              {hospital_name
                ? <span><i className="fas fa-hospital mr-1 text-blue-400" />{hospital_name} · Patient Registration</span>
                : 'Patient Registration · Queue · Visit History'
              }
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {hospital_name && (
            <div className="hidden sm:flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-sm text-blue-700 font-medium">
              <i className="fas fa-hospital-alt text-blue-500" />{hospital_name}
            </div>
          )}
          <button onClick={openNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-semibold shadow hover:shadow-md hover:from-blue-700 hover:to-blue-900 transition text-sm">
            <i className="fas fa-user-plus" /> New Visit / Register
          </button>
          <button onClick={load} className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 shadow-sm transition">
            <i className="fas fa-sync-alt" />
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatCard label="Today's Visits" value={todayVisits.length} icon="calendar-day" color="blue" />
        <StatCard label="Waiting" value={todayVisits.filter(v => v.status === 'Waiting').length} icon="hourglass-half" color="amber" />
        <StatCard label="In Consultation" value={todayVisits.filter(v => v.status === 'In Consultation').length} icon="stethoscope" color="blue" />
        <StatCard label="Completed Today" value={todayVisits.filter(v => v.status === 'Completed').length} icon="check-circle" color="green" />
        <StatCard label="Total Patients" value={stats.total_patients} icon="users" color="purple" />
        <StatCard label="Insurance" value={stats.insurance} icon="shield-alt" color="teal" />
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700 font-medium flex-shrink-0">
            <i className="fas fa-calendar-day text-blue-500" />{todayStr}
          </div>
          <form onSubmit={e => { e.preventDefault(); load(); }} className="flex flex-1 gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input value={pSearch} onChange={e => setPSearch(e.target.value)}
                placeholder="Search name, MRN, mobile..."
                className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Search</button>
          </form>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'today', label: "Today's Visits", icon: 'calendar-day' },
          { key: 'patients', label: 'All Patients', icon: 'users' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition ${activeTab === t.key ? 'bg-white text-blue-700 shadow' : 'text-gray-500 hover:text-gray-700'}`}>
            <i className={`fas fa-${t.icon}`} />{t.label}
          </button>
        ))}
      </div>

      {/* ══════════════ TODAY'S VISITS ══════════════ */}
      {activeTab === 'today' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="fas fa-calendar-day text-blue-600" />
              <span className="font-bold text-blue-800">Visit List</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{todayVisits.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={visitDate}
                onChange={e => setVisitDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={() => setVisitDate(new Date().toISOString().split('T')[0])}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >Today</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100">
                  {['Token', 'Patient', 'MRN', 'Visit Date', 'Exit Date', 'Dept / Doctor', 'Visit Type', 'Category', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="text-center py-12 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                ) : todayVisits.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
                        <i className="fas fa-user-plus text-blue-300 text-xl" />
                      </div>
                      <p className="text-gray-400">No visits today yet</p>
                      <button onClick={openNew} className="text-sm text-blue-600 font-semibold hover:underline">Register first patient →</button>
                    </div>
                  </td></tr>
                ) : todayVisits.map((v, i) => {
                  const isEmergency = v.visit_type === 'Emergency';
                  return (
                  <tr key={v.id || i} className={`border-b transition group ${isEmergency ? 'bg-red-50/50 border-red-100 hover:bg-red-50' : 'border-gray-50 hover:bg-blue-50/30'}`}>
                    <td className="px-4 py-3 font-bold text-blue-700">#{v.token_number || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${isEmergency ? 'bg-gradient-to-br from-red-500 to-red-700' : 'bg-gradient-to-br from-blue-500 to-blue-700'}`}>
                          {(v.patient_name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-gray-800">{v.patient_name}</span>
                          {isEmergency && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold animate-pulse">
                                <i className="fas fa-ambulance text-xs" /> CASUALTY
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{v.mrn || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{v.admit_date || v.visit_date || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{v.exit_date || <span className="text-amber-500 font-medium">Active</span>}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      <div>{v.department || '—'}</div>
                      <div className="text-gray-400">{v.doctor_name || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {isEmergency
                        ? <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold">Emergency</span>
                        : <span className="text-gray-500">{v.visit_type || '—'}</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CAT_COLORS[v.patient_category] || 'bg-gray-100 text-gray-600'}`}>
                        {v.patient_category || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-600'}`}>
                        {v.status || 'Waiting'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button className="p-1.5 text-orange-500 hover:bg-orange-100 rounded-lg text-xs" title="Print Token">
                          <i className="fas fa-print" />
                        </button>
                        <button
                          onClick={() => navigate('/ipd')}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg text-xs"
                          title="Admit to IPD Ward">
                          <i className="fas fa-bed" />
                        </button>
                        {isEmergency && (
                          <span className="p-1.5 text-red-500 text-xs" title="Emergency / Casualty Patient">
                            <i className="fas fa-ambulance" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t bg-gray-50 flex justify-between text-xs text-gray-500">
            <span>Total: {todayVisits.length}</span>
            <span>{todayStr}</span>
          </div>
        </div>
      )}

      {/* ══════════════ ALL PATIENTS ══════════════ */}
      {activeTab === 'patients' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
            <div className="flex items-center gap-2">
              <i className="fas fa-users text-indigo-600" />
              <span className="font-bold text-indigo-800">Patient Records</span>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">{allPatients.length}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-indigo-50 border-b">
                  {['#', 'Patient Name', 'MRN', 'Age/Gender', 'Mobile', 'Blood', 'Category', 'Visits', 'Reg Date', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-indigo-700 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                ) : allPatients.map((p, i) => (
                  <tr key={p.id || i} className="border-b border-gray-50 hover:bg-indigo-50/30 transition group">
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {(p.full_name || '?')[0].toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-800">{p.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.mrn || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.age ? `${p.age}Y` : '—'} / {p.gender?.[0] || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.mobile || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">{p.blood_group || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CAT_COLORS[p.patient_category] || 'bg-gray-100 text-gray-600'}`}>
                        {p.patient_category || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{p.visit_count || 1}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openView(p)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg text-xs" title="View Details">
                          <i className="fas fa-eye" />
                        </button>
                        <button onClick={() => { selectPatient(p); setShowModal(true); setRegStep(4); fetchPreviewToken(); }}
                          className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg text-xs" title="New Visit">
                          <i className="fas fa-plus" />
                        </button>
                        <button className="p-1.5 text-orange-500 hover:bg-orange-100 rounded-lg text-xs" title="Print">
                          <i className="fas fa-print" />
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

      {/* ══════════════ REGISTRATION / VISIT MODAL ══════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <i className={`fas fa-${foundPatient ? 'user-check' : 'user-plus'} text-white`} />
                </div>
                <div>
                  <div className="text-white font-bold">{foundPatient ? 'New Visit — Returning Patient' : 'Patient Registration'}</div>
                  <div className="text-blue-200 text-xs">Step {regStep} of {STEPS.length}</div>
                </div>
              </div>
              <button onClick={() => { setShowModal(false); clearPatient(); }} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 text-lg font-bold">×</button>
            </div>

            {/* Step tabs */}
            <div className="flex border-b border-gray-100 flex-shrink-0">
              {STEPS.map(s => (
                <button key={s.n} onClick={() => setRegStep(s.n)}
                  className={`flex-1 py-3 text-xs font-semibold flex flex-col items-center gap-1 transition border-b-2 ${regStep === s.n ? 'border-blue-600 text-blue-700 bg-blue-50' : regStep > s.n ? 'border-green-400 text-green-600' : 'border-transparent text-gray-400'}`}>
                  <i className={`fas fa-${regStep > s.n ? 'check-circle' : s.icon} text-sm`} />
                  <span className="hidden sm:block">{s.label}</span>
                </button>
              ))}
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-5">

                {/* ─── STEP 1: Search / Quick Lookup ─── */}
                {regStep === 1 && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <div className="flex items-center gap-2 mb-3">
                        <i className="fas fa-search text-blue-600" />
                        <span className="font-bold text-blue-800">Search Existing Patient</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">Type patient name, mobile number, or MRN to auto-fill all details. Leave blank to register new.</p>
                      <div className="relative" ref={dropdownRef}>
                        <div className="relative">
                          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input value={searchQuery} onChange={e => onSearchChange(e.target.value)}
                            placeholder="Enter name, mobile number, or MRN..."
                            className="w-full pl-10 pr-10 py-3 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                          />
                          {searchLoading && <i className="fas fa-spinner fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />}
                          {foundPatient && <button type="button" onClick={clearPatient} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><i className="fas fa-times" /></button>}
                        </div>
                        {showDropdown && searchResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 bg-white rounded-xl shadow-2xl border border-gray-200 z-10 mt-1 max-h-64 overflow-y-auto">
                            {searchResults.map((p, i) => (
                              <button key={p.id || i} type="button" onClick={() => selectPatient(p)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0 transition">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                  {p.full_name?.[0]?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-gray-800">{p.full_name}</div>
                                  <div className="text-xs text-gray-500 flex gap-3">
                                    <span><i className="fas fa-phone mr-1 text-blue-400" />{p.mobile}</span>
                                    <span className="font-mono">{p.mrn}</span>
                                    <span>{p.age ? `${p.age}Y` : ''} {p.gender?.[0] || ''}</span>
                                  </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CAT_COLORS[p.patient_category] || 'bg-gray-100 text-gray-600'}`}>
                                  {p.patient_category}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        {showDropdown && searchResults.length === 0 && !searchLoading && searchQuery.length >= 3 && (
                          <div className="absolute top-full left-0 right-0 bg-white rounded-xl shadow-lg border border-gray-200 z-10 mt-1 px-4 py-3 text-sm text-gray-400">
                            No patient found — will register as new patient
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Found patient banner */}
                    {foundPatient && (
                      <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white text-lg font-black flex-shrink-0">
                            {foundPatient.full_name?.[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <i className="fas fa-check-circle text-green-600" />
                              <span className="font-bold text-green-800">Returning Patient Found</span>
                            </div>
                            <div className="text-sm text-gray-700 font-semibold">{foundPatient.full_name}</div>
                            <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                              <span><i className="fas fa-id-card mr-1 text-blue-400" />{foundPatient.mrn}</span>
                              <span><i className="fas fa-phone mr-1 text-blue-400" />{foundPatient.mobile}</span>
                              <span><i className="fas fa-tint mr-1 text-red-400" />{foundPatient.blood_group}</span>
                              <span><i className="fas fa-repeat mr-1 text-purple-400" />Visits: {foundPatient.visit_count || 1}</span>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${CAT_COLORS[foundPatient.patient_category] || ''}`}>
                            {foundPatient.patient_category}
                          </span>
                        </div>
                        {patientVisitHistory.length > 0 && (
                          <div className="mt-3 border-t border-green-200 pt-3">
                            <p className="text-xs font-semibold text-green-700 mb-2">Previous Visits ({patientVisitHistory.length}):</p>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {patientVisitHistory.map((v, i) => (
                                <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 text-xs border border-green-100">
                                  <span className="text-gray-600">{v.admit_date || v.visit_date}</span>
                                  <span className="text-gray-500">{v.department}</span>
                                  <span className="text-gray-500">{v.doctor_name}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-600'}`}>{v.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!foundPatient && (
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                        <i className="fas fa-info-circle mr-2" />
                        No patient selected — continue to register a new patient, or type above to search.
                      </div>
                    )}
                  </div>
                )}

                {/* ─── STEP 2: Personal Info ─── */}
                {regStep === 2 && (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-blue-100">
                      <span className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center"><i className="fas fa-user text-blue-600 text-xs" /></span>
                      <span className="font-bold text-blue-800">Personal Information</span>
                      {foundPatient && <span className="ml-2 text-xs text-green-600 font-medium"><i className="fas fa-check-circle mr-1" />Auto-filled</span>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <FLabel label="Full Name" required><input name="full_name" value={form.full_name} onChange={change} required placeholder="Patient's full name" className={inp} /></FLabel>
                      </div>
                      <FLabel label="Date of Birth"><input name="date_of_birth" type="date" value={form.date_of_birth} onChange={change} className={inp} /></FLabel>
                      <FLabel label="Age (Years)"><input name="age" type="number" value={form.age} onChange={change} placeholder="Auto-calculated from DOB" className={inp} /></FLabel>
                      <FLabel label="Gender" required>
                        <select name="gender" value={form.gender} onChange={change} className={inp}>
                          {GENDERS.map(g => <option key={g}>{g}</option>)}
                        </select>
                      </FLabel>
                      <FLabel label="Marital Status">
                        <select name="marital_status" value={form.marital_status} onChange={change} className={inp}>
                          {MARITAL.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </FLabel>
                      <FLabel label="Blood Group">
                        <select name="blood_group" value={form.blood_group} onChange={change} className={inp}>
                          {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                        </select>
                      </FLabel>
                      <FLabel label="Nationality"><input name="nationality" value={form.nationality} onChange={change} className={inp} /></FLabel>
                      <FLabel label="Religion"><input name="religion" value={form.religion} onChange={change} placeholder="Optional" className={inp} /></FLabel>
                      <FLabel label="Occupation"><input name="occupation" value={form.occupation} onChange={change} placeholder="Optional" className={inp} /></FLabel>
                    </div>
                  </div>
                )}

                {/* ─── STEP 3: Contact & Identity ─── */}
                {regStep === 3 && (
                  <div className="space-y-4">
                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-green-100">
                        <span className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center"><i className="fas fa-phone text-green-600 text-xs" /></span>
                        <span className="font-bold text-green-800">Contact Information</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FLabel label="Mobile Number" required><input name="mobile" value={form.mobile} onChange={change} required placeholder="Primary mobile" className={inp} /></FLabel>
                        <FLabel label="Alternate Mobile"><input name="alt_mobile" value={form.alt_mobile} onChange={change} className={inp} /></FLabel>
                        <FLabel label="Email"><input name="email" type="email" value={form.email} onChange={change} className={inp} /></FLabel>
                        <FLabel label="City"><input name="city" value={form.city} onChange={change} className={inp} /></FLabel>
                        <FLabel label="State"><input name="state" value={form.state} onChange={change} className={inp} /></FLabel>
                        <FLabel label="PIN Code"><input name="pin_code" value={form.pin_code} onChange={change} maxLength={6} className={inp} /></FLabel>
                        <div className="sm:col-span-2">
                          <FLabel label="Address"><textarea name="address" value={form.address} onChange={change} rows={2} className={inp} /></FLabel>
                        </div>
                      </div>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-purple-100">
                        <span className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center"><i className="fas fa-id-card text-purple-600 text-xs" /></span>
                        <span className="font-bold text-purple-800">Identity Documents</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FLabel label="Aadhar Number"><input name="aadhar_number" value={form.aadhar_number} onChange={change} placeholder="XXXX XXXX XXXX" maxLength={14} className={inp} /></FLabel>
                        <FLabel label="PAN Number"><input name="pan_number" value={form.pan_number} onChange={change} placeholder="ABCDE1234F" maxLength={10} className={inp} /></FLabel>
                        <FLabel label="Passport"><input name="passport_number" value={form.passport_number} onChange={change} className={inp} /></FLabel>
                      </div>
                    </div>
                    <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-red-100">
                        <span className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center"><i className="fas fa-phone-alt text-red-600 text-xs" /></span>
                        <span className="font-bold text-red-800">Emergency Contact</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FLabel label="Contact Name"><input name="emergency_contact_name" value={form.emergency_contact_name} onChange={change} className={inp} /></FLabel>
                        <FLabel label="Contact Mobile"><input name="emergency_contact_mobile" value={form.emergency_contact_mobile} onChange={change} className={inp} /></FLabel>
                        <FLabel label="Relation">
                          <select name="emergency_contact_relation" value={form.emergency_contact_relation} onChange={change} className={inp}>
                            {RELATIONS.map(r => <option key={r}>{r}</option>)}
                          </select>
                        </FLabel>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── STEP 4: Visit Details ─── */}
                {regStep === 4 && (
                  <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-teal-100">
                      <span className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center"><i className="fas fa-stethoscope text-teal-600 text-xs" /></span>
                      <span className="font-bold text-teal-800">Visit / Clinical Details</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Token Number - auto generated */}
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
                          Token Number <span className="ml-1 text-xs font-normal text-amber-600 normal-case">(auto-generated)</span>
                        </label>
                        <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl px-4 py-3">
                          <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center shadow-sm flex-shrink-0">
                            <i className="fas fa-ticket-alt text-white text-sm" />
                          </div>
                          <div>
                            <p className="text-2xl font-black font-mono tracking-widest text-amber-700">{previewToken ?? '—'}</p>
                            <p className="text-xs text-amber-500 mt-0.5">This token will be assigned at registration</p>
                          </div>
                        </div>
                      </div>
                      <FLabel label="Visit Date" required>
                        <input name="admit_date" type="date" value={form.admit_date} onChange={change} required className={inp} />
                      </FLabel>
                      <FLabel label="Exit / Discharge Date">
                        <input name="exit_date" type="date" value={form.exit_date} onChange={change} className={inp} />
                        <span className="text-xs text-gray-400">Leave blank for ongoing admission</span>
                      </FLabel>
                      <FLabel label="Patient Category" required>
                        <select name="patient_category" value={form.patient_category} onChange={change} className={inp}>
                          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </FLabel>
                      <FLabel label="Department">
                        <select name="department" value={form.department} onChange={change} className={inp}>
                          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                        </select>
                      </FLabel>
                      <FLabel label="Consulting Doctor">
                        <DoctorSearchInput
                          value={form.doctor_name}
                          onChange={(name, doc) => setForm(f => ({
                            ...f,
                            doctor_name: name,
                            ...(doc?.department ? { department: doc.department } : {}),
                          }))}
                          inputClass={inp.replace('w-full ', '')}
                          required
                        />
                      </FLabel>
                      <FLabel label="Visit Type">
                        <select name="visit_type" value={form.visit_type} onChange={change} className={inp}>
                          {VISIT_TYPES.map(v => <option key={v}>{v}</option>)}
                        </select>
                      </FLabel>
                      <FLabel label="Payment Mode">
                        <select name="payment_mode" value={form.payment_mode} onChange={change} className={inp}>
                          {PAYMENT_MODES.map(v => <option key={v}>{v}</option>)}
                        </select>
                      </FLabel>
                      <FLabel label="Referred By">
                        <input name="referred_by" value={form.referred_by} onChange={change} placeholder="Referral source" className={inp} />
                      </FLabel>
                      <div className="sm:col-span-2">
                        <FLabel label="Chief Complaint / Reason">
                          <textarea name="chief_complaint" value={form.chief_complaint} onChange={change} rows={2} placeholder="Main complaint or reason for visit" className={inp} />
                        </FLabel>
                      </div>
                      <FLabel label="Known Allergies">
                        <input name="known_allergies" value={form.known_allergies} onChange={change} placeholder="e.g. Penicillin, Sulfa drugs" className={inp} />
                      </FLabel>
                      <FLabel label="Past Medical History">
                        <input name="past_history" value={form.past_history} onChange={change} placeholder="Relevant history, chronic conditions" className={inp} />
                      </FLabel>
                    </div>
                  </div>
                )}

                {/* ─── STEP 5: Insurance + Docs + Summary ─── */}
                {regStep === 5 && (
                  <div className="space-y-4">
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-indigo-100">
                        <span className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center"><i className="fas fa-shield-alt text-indigo-600 text-xs" /></span>
                        <span className="font-bold text-indigo-800">Insurance / TPA</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FLabel label="Insurance Provider"><input name="insurance_provider" value={form.insurance_provider} onChange={change} placeholder="e.g. Star Health" className={inp} /></FLabel>
                        <FLabel label="Policy Number"><input name="insurance_policy_number" value={form.insurance_policy_number} onChange={change} className={inp} /></FLabel>
                        <FLabel label="Policy Validity"><input name="insurance_validity" type="date" value={form.insurance_validity} onChange={change} className={inp} /></FLabel>
                      </div>
                    </div>

                    {/* Document Upload */}
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center"><i className="fas fa-folder-open text-amber-600 text-xs" /></span>
                        <span className="font-bold text-amber-800">Upload Documents / Reports</span>
                      </div>
                      <div className="border-2 border-dashed border-amber-300 rounded-xl p-5 text-center cursor-pointer hover:bg-amber-50 transition"
                        onClick={() => fileRef.current?.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); setUploadFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]); }}>
                        <i className="fas fa-cloud-upload-alt text-2xl text-amber-400 mb-1" />
                        <p className="text-sm text-gray-600">Drag & drop or click to upload</p>
                        <p className="text-xs text-gray-400 mt-1">Lab reports, X-rays, prescriptions, ID proof (PDF, JPG, PNG)</p>
                        <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                          onChange={e => setUploadFiles(prev => [...prev, ...Array.from(e.target.files)])} />
                      </div>
                      {uploadFiles.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {uploadFiles.map((f, i) => (
                            <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-xs border border-amber-100">
                              <div className="flex items-center gap-2">
                                <i className={`fas fa-${f.type.includes('pdf') ? 'file-pdf text-red-500' : 'file-image text-blue-500'}`} />
                                {f.name}
                              </div>
                              <button type="button" onClick={() => setUploadFiles(p => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><i className="fas fa-times" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Summary */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center gap-2 mb-3">
                        <i className="fas fa-clipboard-check text-blue-600" />
                        <span className="font-bold text-blue-800">{foundPatient ? 'New Visit Summary' : 'Registration Summary'}</span>
                      </div>
                      {foundPatient && (
                        <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 font-medium">
                          <i className="fas fa-user-check mr-2" />Same Patient ID: {foundPatient.mrn} · {foundPatient.full_name}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          ['Name', form.full_name || '—'], ['Age/Gender', `${form.age || '—'}Y / ${form.gender}`],
                          ['Mobile', form.mobile || '—'], ['Blood Group', form.blood_group],
                          ['Category', form.patient_category], ['Department', form.department],
                          ['Visit Date', form.admit_date || 'Today'], ['Exit Date', form.exit_date || 'Open'],
                          ['Doctor', form.doctor_name || '—'], ['Payment', form.payment_mode],
                          ['Visit Type', form.visit_type], ['Complaint', form.chief_complaint ? form.chief_complaint.slice(0, 30) + '...' : '—'],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <span className="text-gray-400">{k}</span>
                            <span className="font-semibold text-gray-800 text-right">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
                <button type="button" onClick={() => regStep > 1 ? setRegStep(s => s - 1) : setShowModal(false)}
                  className="flex items-center gap-2 px-5 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition">
                  <i className={`fas fa-${regStep > 1 ? 'arrow-left' : 'times'}`} />{regStep > 1 ? 'Back' : 'Cancel'}
                </button>
                <div className="flex gap-1 items-center">
                  {STEPS.map(s => (
                    <span key={s.n} className={`h-2 rounded-full transition-all ${s.n === regStep ? 'w-6 bg-blue-600' : s.n < regStep ? 'w-2 bg-green-400' : 'w-2 bg-gray-200'}`} />
                  ))}
                </div>
                {regStep < STEPS.length ? (
                  <button type="button" onClick={() => setRegStep(s => s + 1)}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow">
                    Next <i className="fas fa-arrow-right" />
                  </button>
                ) : (
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition shadow disabled:opacity-60">
                    {saving ? <><i className="fas fa-spinner fa-spin" /> Saving...</> : <><i className="fas fa-check" /> {foundPatient ? 'Add Visit' : 'Register Patient'}</>}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ REGISTRATION SUCCESS MODAL ══════════════ */}
      {successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Green header */}
            <div className={`px-6 py-5 flex flex-col items-center text-center ${successData.isNew ? 'bg-gradient-to-br from-green-600 to-emerald-700' : 'bg-gradient-to-br from-blue-600 to-blue-800'}`}>
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-3">
                <i className={`fas fa-${successData.isNew ? 'user-check' : 'calendar-check'} text-white text-3xl`} />
              </div>
              <h2 className="text-white text-xl font-black">
                {successData.isNew ? 'Patient Registered!' : 'Visit Added!'}
              </h2>
              <p className="text-white/80 text-sm mt-1">
                {successData.isNew ? 'New patient successfully registered' : 'Visit recorded for returning patient'}
              </p>
            </div>

            {/* Token + MRN Badge */}
            <div className="px-6 pt-6 pb-2 flex flex-col items-center gap-3">
              {successData.token && (
                <div className="w-full flex flex-col items-center">
                  <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1.5">Queue Token</p>
                  <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-2xl px-8 py-4 shadow-sm w-full justify-center">
                    <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center shadow">
                      <i className="fas fa-ticket-alt text-white text-lg" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Token Number</p>
                      <span className="text-4xl font-black font-mono tracking-widest text-amber-700">{successData.token}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="w-full flex flex-col items-center">
                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1.5">Medical Record Number</p>
                <div className="flex items-center gap-3 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl px-8 py-3 w-full justify-center">
                  <i className="fas fa-id-card text-xl text-blue-500" />
                  <span className="text-2xl font-black font-mono tracking-widest text-blue-800">{successData.mrn}</span>
                </div>
                {successData.isNew && (
                  <p className="text-xs text-amber-600 mt-1.5 font-medium">
                    <i className="fas fa-exclamation-circle mr-1" />Save this MRN for future visits
                  </p>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="px-6 pb-4">
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                {[
                  ['Patient', successData.name],
                  ['Date', successData.visitDate],
                  ['Department', successData.department || '—'],
                  ['Doctor', successData.doctor || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                    <span className="text-gray-400 block">{k}</span>
                    <span className="font-semibold text-gray-800">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                <i className="fas fa-print" /> Print Token
              </button>
              <button
                onClick={() => setSuccessData(null)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow">
                <i className="fas fa-check" /> Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ PATIENT DETAIL + HISTORY MODAL ══════════════ */}
      {viewPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-xl">
                  {viewPatient.full_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="text-white font-bold">{viewPatient.full_name}</div>
                  <div className="text-indigo-200 text-xs font-mono">{viewPatient.mrn} · Visits: {viewPatient.visit_count || 1}</div>
                </div>
              </div>
              <button onClick={() => setViewPatient(null)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 text-lg font-bold">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Personal */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="font-bold text-blue-800 mb-3 text-sm flex items-center gap-2"><i className="fas fa-user text-blue-500" />Personal Details</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {[
                    ['Age', viewPatient.age ? `${viewPatient.age}Y` : '—'],
                    ['Gender', viewPatient.gender || '—'],
                    ['Blood Group', viewPatient.blood_group || '—'],
                    ['DOB', viewPatient.date_of_birth || '—'],
                    ['Marital', viewPatient.marital_status || '—'],
                    ['Aadhar', viewPatient.aadhar_number || '—'],
                  ].map(([k, v]) => (
                    <div key={k}><span className="text-xs text-gray-400 block">{k}</span><span className="font-semibold text-gray-800">{v}</span></div>
                  ))}
                </div>
              </div>
              {/* Contact */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <p className="font-bold text-green-800 mb-3 text-sm flex items-center gap-2"><i className="fas fa-phone text-green-500" />Contact</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {[
                    ['Mobile', viewPatient.mobile || '—'],
                    ['Alt Mobile', viewPatient.alt_mobile || '—'],
                    ['Email', viewPatient.email || '—'],
                    ['City', viewPatient.city || '—'],
                    ['State', viewPatient.state || '—'],
                    ['Emergency', viewPatient.emergency_contact_name || '—'],
                  ].map(([k, v]) => (
                    <div key={k}><span className="text-xs text-gray-400 block">{k}</span><span className="font-semibold text-gray-800">{v}</span></div>
                  ))}
                </div>
              </div>
              {/* Visit History */}
              {viewVisits.length > 0 && (
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <p className="font-bold text-purple-800 mb-3 text-sm flex items-center gap-2"><i className="fas fa-history text-purple-500" />Visit History ({viewVisits.length})</p>
                  <div className="space-y-2">
                    {viewVisits.map((v, i) => (
                      <div key={i} className="bg-white rounded-lg px-4 py-3 border border-purple-100 text-sm flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-700">{v.admit_date || v.visit_date}</div>
                          <div className="text-xs text-gray-400">{v.department} · {v.doctor_name || '—'}</div>
                          {v.chief_complaint && <div className="text-xs text-gray-500 mt-1 italic">{v.chief_complaint}</div>}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-600'}`}>{v.status}</span>
                          {v.exit_date && <span className="text-xs text-gray-400">Exit: {v.exit_date}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex gap-2 justify-end flex-shrink-0">
              <button onClick={() => { selectPatient(viewPatient); setViewPatient(null); setShowModal(true); setRegStep(4); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition">
                <i className="fas fa-plus mr-2" />New Visit
              </button>
              <button onClick={() => setViewPatient(null)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
