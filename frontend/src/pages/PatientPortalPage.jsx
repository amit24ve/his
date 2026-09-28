import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'https://cubehis.avopay.pro:5000/api';
const hdr = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
});

// ── helpers ────────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
};

const Badge = ({ text, color = 'gray' }) => {
  const map = { green:'bg-green-100 text-green-700', red:'bg-red-100 text-red-700', blue:'bg-blue-100 text-blue-700', yellow:'bg-yellow-100 text-yellow-700', purple:'bg-purple-100 text-purple-700', orange:'bg-orange-100 text-orange-700', gray:'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[color]||map.gray}`}>{text}</span>;
};

const EmptyState = ({ icon = 'inbox', text }) => (
  <div className="text-center py-10 text-gray-400">
    <i className={`fas fa-${icon} text-3xl mb-2 block opacity-40`} />
    <p className="text-sm">{text}</p>
  </div>
);

const colorMap = {
  blue:   { bg:'bg-blue-50',   text:'text-blue-600',   dot:'bg-blue-500',   border:'border-blue-200' },
  green:  { bg:'bg-green-50',  text:'text-green-600',  dot:'bg-green-500',  border:'border-green-200' },
  red:    { bg:'bg-red-50',    text:'text-red-600',    dot:'bg-red-500',    border:'border-red-200' },
  purple: { bg:'bg-purple-50', text:'text-purple-600', dot:'bg-purple-500', border:'border-purple-200' },
  yellow: { bg:'bg-yellow-50', text:'text-yellow-600', dot:'bg-yellow-400', border:'border-yellow-200' },
  orange: { bg:'bg-orange-50', text:'text-orange-600', dot:'bg-orange-400', border:'border-orange-200' },
};

// ─────────────────────────────────────────────────────────────────────────────
export default function PatientPortalPage() {
  const [searchMode, setSearchMode]       = useState('name'); // 'name' | 'mrn' | 'mobile'
  const [searchVal,  setSearchVal]        = useState('');
  const [patients,   setPatients]         = useState([]);
  const [family,     setFamily]           = useState([]);
  const [loading,    setLoading]          = useState(false);
  const [selected,   setSelected]         = useState(null);
  const [history,    setHistory]          = useState(null);
  const [loadingHist,setLoadingHist]      = useState(false);
  const [activeTab,  setActiveTab]        = useState('timeline');
  const [dateFilter, setDateFilter]       = useState('');
  const [familyMode, setFamilyMode]       = useState(false);
  const [viewRecord, setViewRecord]       = useState(null);
  const debounceRef = useRef(null);

  // ── search ──────────────────────────────────────────────────────────────────
  const doSearch = async (val = searchVal) => {
    if (!val.trim()) {
      setFamilyMode(false);
      setFamily([]);
      setLoading(true);
      try {
        const res = await fetch(`${API}/patients/?limit=30`, { headers: hdr() });
        const data = await res.json();
        setPatients(Array.isArray(data) ? data : (data.patients || []));
      } catch { setPatients([]); }
      setLoading(false);
      return;
    }
    setLoading(true);
    setSelected(null); setHistory(null); setFamilyMode(false);
    try {
      if (searchMode === 'mobile') {
        const res = await fetch(`${API}/patients/family/by-mobile?mobile=${encodeURIComponent(val.trim())}`, { headers: hdr() });
        const data = await res.json();
        setFamily(data.family || []);
        setPatients(data.family || []);
        setFamilyMode(true);
      } else {
        const params = new URLSearchParams({ search: val.trim(), limit: '50' });
        const res = await fetch(`${API}/patients/?${params}`, { headers: hdr() });
        const data = await res.json();
        setPatients(Array.isArray(data) ? data : (data.patients || []));
        setFamilyMode(false);
      }
    } catch { setPatients([]); }
    setLoading(false);
  };

  const handleInput = (v) => {
    setSearchVal(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 500);
  };

  useEffect(() => { doSearch(''); }, []);

  // ── open patient history ────────────────────────────────────────────────────
  const openPatient = async (p) => {
    setSelected(p);
    setHistory(null);
    setLoadingHist(true);
    setActiveTab('timeline');
    try {
      const id = p.id || p._id;
      const res = await fetch(`${API}/emr/patient/${id}/history`, { headers: hdr() });
      const data = await res.json();
      setHistory(data);
    } catch { setHistory({}); }
    setLoadingHist(false);
  };

  // ── timeline builder ────────────────────────────────────────────────────────
  const buildTimeline = () => {
    if (!history) return [];
    const ev = [];

    (history.opd_visits || []).forEach(v => ev.push({
      date: v.visit_date || v.created_at, type: 'opd', icon: 'stethoscope', color: 'blue',
      title: `OPD Visit — ${v.department || '—'}`,
      subtitle: `Dr. ${v.doctor_name || '—'} | ${v.visit_type || 'Consultation'}`,
      detail: `${v.chief_complaint ? 'Complaint: ' + v.chief_complaint : ''} | Status: ${v.status || '—'}`,
    }));

    (history.prescriptions || []).forEach(p => ev.push({
      date: p.visit_date || p.created_at, type: 'prescription', icon: 'file-medical', color: 'purple',
      title: `Prescription — Dr. ${p.doctor_name || '—'}`,
      subtitle: p.diagnosis || 'No diagnosis noted',
      detail: `Dept: ${p.department||'—'} | Rx: ${p.rx_number} | ${p.medications?.length||0} medication(s)`,
    }));

    (history.lab_orders || []).forEach(l => ev.push({
      date: l.order_date || l.created_at, type: 'lab', icon: 'flask', color: 'green',
      title: `Lab Order — ${l.order_number || ''}`,
      subtitle: (l.tests||[]).map(t=>t.test_name||t).join(', ') || 'Lab investigation',
      detail: `Status: ${l.status||'Pending'}`,
    }));

    (history.ipd_admissions || []).forEach(a => ev.push({
      date: a.admission_date || a.created_at, type: 'admission', icon: 'bed', color: 'red',
      title: `IPD Admission — ${a.ipd_number||''}`,
      subtitle: `Ward: ${a.ward_name||'—'} | ${a.diagnosis||''}`,
      detail: `Bed: ${a.bed_number||'—'} | Status: ${a.status||'—'}`,
    }));

    (history.appointments || []).forEach(ap => ev.push({
      date: ap.appointment_date, type: 'appointment', icon: 'calendar-check', color: 'orange',
      title: `Appointment — Dr. ${ap.doctor_name||'—'}`,
      subtitle: `${ap.department||''} | ${ap.appointment_type||'OPD'}`,
      detail: `Time: ${ap.appointment_time||'—'} | Status: ${ap.status||'—'}`,
    }));

    ev.sort((a, b) => new Date(b.date) - new Date(a.date));
    return ev;
  };

  const timeline = buildTimeline();
  const filtTimeline = dateFilter ? timeline.filter(e => e.date && e.date.startsWith(dateFilter)) : timeline;

  // ── print record ────────────────────────────────────────────────────────────
  const printRecord = (type, data) => {
    const patName = selected?.full_name || selected?.name || '';
    const patMRN  = selected?.mrn || '';
    const fieldMap = {
      opd: [['Date', fmtDate(data.visit_date)], ['Department', data.department||'—'], ['Doctor', `Dr. ${data.doctor_name||'—'}`], ['Visit Type', data.visit_type||'—'], ['Chief Complaint', data.chief_complaint||'—'], ['Status', data.status||'—']],
      prescription: [['Rx No', data.rx_number||'—'], ['Date', fmtDate(data.visit_date||data.created_at)], ['Doctor', `Dr. ${data.doctor_name||'—'}`], ['Department', data.department||'—'], ['Diagnosis', data.diagnosis||'—'], ['Medications', `${(data.medications||[]).length} item(s)`]],
      lab: [['Order No', data.order_number||'—'], ['Date', fmtDate(data.order_date||data.created_at)], ['Tests', (data.tests||[]).map(t=>t.test_name||t).join(', ')||'—'], ['Doctor', data.doctor_name||'—'], ['Status', data.status||'—']],
      admission: [['IPD No', data.ipd_number||'—'], ['Admitted', fmtDate(data.admission_date)], ['Discharged', data.discharge_date?fmtDate(data.discharge_date):'Still Admitted'], ['Ward/Bed', `${data.ward_name||'—'} / Bed: ${data.bed_number||'—'}`], ['Diagnosis', data.diagnosis||'—'], ['Status', data.status||'—']],
    };
    const rows = (fieldMap[type]||[]).map(([k,v])=>`<tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:600;color:#555;border:1px solid #dee2e6;width:150px">${k}</td><td style="padding:8px 12px;border:1px solid #dee2e6">${v}</td></tr>`).join('');
    const w = window.open('','_blank','width=700,height=600');
    w.document.write(`<html><head><title>Print</title></head><body style="font-family:Arial,sans-serif;padding:24px"><h2 style="margin:0 0 4px">${patName}</h2><p style="margin:0 0 16px;color:#666;font-size:13px">MRN: ${patMRN}</p><table style="border-collapse:collapse;width:100%">${rows}</table></body></html>`);
    w.document.close(); w.print();
  };

  // ── download PDF ─────────────────────────────────────────────────────────────
  const downloadPDF = (type, id) => {
    const urlMap = { opd:`${API}/opd/${id}/pdf`, prescription:`${API}/emr/prescriptions/${id}/pdf`, lab:`${API}/laboratory/${id}/pdf`, admission:`${API}/ipd/admissions/${id}/pdf` };
    if (urlMap[type]) window.open(`${urlMap[type]}?token=${localStorage.getItem('access_token')||''}`, '_blank');
  };

  const tabCls = (t) =>
    `px-4 py-2 text-sm font-semibold rounded-lg transition ${activeTab===t?'bg-blue-600 text-white shadow':'text-gray-600 hover:bg-gray-100'}`;

  const statCards = history ? [
    { label:'OPD Visits',    val: (history.opd_visits||[]).length,    color:'blue',   icon:'stethoscope' },
    { label:'Prescriptions', val: (history.prescriptions||[]).length, color:'purple', icon:'file-medical' },
    { label:'Lab Orders',    val: (history.lab_orders||[]).length,    color:'green',  icon:'flask' },
    { label:'Admissions',    val: (history.ipd_admissions||[]).length,color:'red',    icon:'bed' },
  ] : [];

  const PatientCard = ({ p, highlight = false }) => (
    <div
      onClick={() => openPatient(p)}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b hover:bg-blue-50 transition
        ${selected?.id === p.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
        ${highlight ? 'bg-orange-50' : ''}`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold
        ${p.gender?.toLowerCase()==='female'?'bg-pink-400':'bg-blue-500'}`}>
        {(p.full_name||p.name||'?')[0].toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm text-gray-800 truncate">{p.full_name||p.name}</div>
        <div className="text-xs text-gray-500">
          <span className="font-mono bg-gray-100 px-1 rounded mr-1">{p.mrn}</span>
          {p.age ? `${p.age}y` : ''}
          {p.gender ? ` · ${p.gender}` : ''}
          {p.blood_group ? ` · ${p.blood_group}` : ''}
        </div>
        <div className="text-xs text-gray-400">{p.mobile}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-xs font-bold text-blue-600">{p.visit_count||0}</div>
        <div className="text-xs text-gray-400">visits</div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-blue-800">Patient Portal</h1>
        <p className="text-gray-500 text-sm mt-0.5">Search patients by Name, MRN, or Mobile — see full history and family members</p>
      </div>

      {/* ── Search Bar ── */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {[
            { key:'name',   label:'Search by Name',   icon:'user' },
            { key:'mrn',    label:'Search by MRN',    icon:'id-card' },
            { key:'mobile', label:'Family by Mobile', icon:'users' },
          ].map(m => (
            <button key={m.key} onClick={() => { setSearchMode(m.key); setSearchVal(''); setPatients([]); setFamily([]); setFamilyMode(false); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition
                ${searchMode===m.key?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'}`}>
              <i className={`fas fa-${m.icon}`} />{m.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={
              searchMode==='name'   ? 'Type patient name...' :
              searchMode==='mrn'    ? 'Enter MRN e.g. MRN-2026000001' :
                                      'Enter 10-digit mobile number...'
            }
            value={searchVal}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button onClick={() => doSearch()}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition flex-shrink-0">
            <i className="fas fa-search mr-1.5" />Search
          </button>
          {searchVal && (
            <button onClick={() => { setSearchVal(''); doSearch(''); setSelected(null); }}
              className="px-3 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50">
              <i className="fas fa-times" />
            </button>
          )}
        </div>
      </div>

      {/* ── Family Group Banner ── */}
      <AnimatePresence>
        {familyMode && family.length > 0 && (
          <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <i className="fas fa-users text-orange-500 text-lg" />
              <div>
                <div className="font-bold text-orange-800">{family.length} Family Member{family.length>1?'s':''} — Mobile: {searchVal}</div>
                <div className="text-xs text-orange-600">Click any member to see their complete history</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {family.map(p => (
                <button key={p.id||p._id} onClick={() => openPatient(p)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition
                    ${selected?.id===p.id?'bg-orange-500 text-white border-orange-500':'bg-white text-gray-700 border-orange-200 hover:border-orange-400'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0
                    ${p.gender?.toLowerCase()==='female'?'bg-pink-400':'bg-blue-500'}`}>
                    {(p.full_name||p.name||'?')[0]}
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{p.full_name||p.name}</div>
                    <div className="text-xs opacity-70">{p.mrn} · {p.age?`${p.age}y`:'—'} · {p.visit_count||0} visits</div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-5 flex-col xl:flex-row">

        {/* ── Patient List ── */}
        <div className="bg-white rounded-xl shadow overflow-hidden xl:w-80 flex-shrink-0">
          <div className="bg-blue-50 px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-bold text-blue-800 text-sm">
              <i className="fas fa-users mr-2" />
              {familyMode ? `Family (${patients.length})` : `Patients (${patients.length})`}
            </h2>
            {loading && <i className="fas fa-spinner fa-spin text-blue-400 text-xs" />}
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-320px)]">
            {loading ? (
              <div className="p-6 text-center text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</div>
            ) : patients.length === 0 ? (
              <EmptyState icon="search" text="No patients found. Try searching above." />
            ) : patients.map(p => (
              <PatientCard key={p.id||p._id} p={p} highlight={familyMode} />
            ))}
          </div>
        </div>

        {/* ── Patient Detail ── */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="bg-white rounded-xl shadow flex flex-col items-center justify-center h-72 gap-3">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
                <i className="fas fa-user-injured text-blue-300 text-3xl" />
              </div>
              <p className="text-gray-500 font-medium">Select a patient to view their history</p>
              {familyMode && family.length > 0 && (
                <p className="text-sm text-orange-500">Click a family member above to view their records</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">

              {/* Patient Info Card */}
              <div className="bg-white rounded-xl shadow p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 text-white text-2xl font-bold
                    ${selected.gender?.toLowerCase()==='female'?'bg-pink-400':'bg-blue-500'}`}>
                    {(selected.full_name||selected.name||'?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h2 className="text-xl font-bold text-gray-900">{selected.full_name||selected.name}</h2>
                      <Badge text={selected.mrn} color="blue" />
                      {selected.blood_group && <Badge text={selected.blood_group} color="red" />}
                      {selected.patient_category && <Badge text={selected.patient_category} color={selected.patient_category==='INSURANCE'?'purple':selected.patient_category==='GOVT'?'green':'gray'} />}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-sm text-gray-600">
                      {[
                        ['fa-birthday-cake', `DOB: ${fmtDate(selected.date_of_birth)}`],
                        ['fa-user',          `${selected.age||'?'}y · ${selected.gender||'—'}`],
                        ['fa-phone',         selected.mobile || '—'],
                        ['fa-envelope',      selected.email || '—'],
                        ['fa-map-marker-alt',selected.city || selected.address || '—'],
                        ['fa-id-card',       `Reg: ${fmtDate(selected.created_at)}`],
                      ].map(([icon, val], i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <i className={`fas ${icon} text-gray-400 text-xs w-4 flex-shrink-0`} />
                          <span className="truncate text-xs">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
                    {statCards.map(s => (
                      <div key={s.label} className={`text-center px-3 py-2 rounded-xl ${colorMap[s.color]?.bg}`}>
                        <i className={`fas fa-${s.icon} ${colorMap[s.color]?.text} text-sm mb-1 block`} />
                        <div className={`text-2xl font-black ${colorMap[s.color]?.text}`}>{loadingHist?'…':s.val}</div>
                        <div className="text-xs text-gray-500 whitespace-nowrap">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {(selected.emergency_contact_name || selected.insurance_provider) && (
                  <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-xs text-gray-600">
                    {selected.emergency_contact_name && (
                      <span><i className="fas fa-phone-alt text-red-400 mr-1" /><b>Emergency:</b> {selected.emergency_contact_name} ({selected.emergency_contact_mobile||'—'})</span>
                    )}
                    {selected.insurance_provider && (
                      <span><i className="fas fa-shield-alt text-purple-400 mr-1" /><b>Insurance:</b> {selected.insurance_provider} — {selected.insurance_policy_number||'—'}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { key:'timeline',      label:'Timeline',      icon:'clock',        count: filtTimeline.length },
                  { key:'opd',           label:'OPD Visits',    icon:'stethoscope',  count: (history?.opd_visits||[]).length },
                  { key:'prescriptions', label:'Prescriptions', icon:'file-medical', count: (history?.prescriptions||[]).length },
                  { key:'lab',           label:'Lab Reports',   icon:'flask',        count: (history?.lab_orders||[]).length },
                  { key:'admissions',    label:'Admissions',    icon:'bed',          count: (history?.ipd_admissions||[]).length },
                ].map(t => (
                  <button key={t.key} className={tabCls(t.key)} onClick={() => setActiveTab(t.key)}>
                    <i className={`fas fa-${t.icon} mr-1.5`} />{t.label}
                    {t.count > 0 && (
                      <span className={`ml-1.5 text-xs font-bold px-1.5 rounded-full ${activeTab===t.key?'bg-white text-blue-600':'bg-blue-600 text-white'}`}>{t.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="bg-white rounded-xl shadow overflow-hidden">

                {/* Timeline */}
                {activeTab === 'timeline' && (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <i className="fas fa-clock text-blue-500" />Medical Timeline
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{filtTimeline.length}</span>
                      </h3>
                      <div className="flex items-center gap-2">
                        <input type="month" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        {dateFilter && <button onClick={()=>setDateFilter('')} className="text-xs text-gray-400 hover:text-gray-600"><i className="fas fa-times" /></button>}
                      </div>
                    </div>
                    {loadingHist ? (
                      <div className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading history...</div>
                    ) : filtTimeline.length === 0 ? (
                      <EmptyState icon="clock" text="No records found for this period." />
                    ) : (
                      <div className="relative">
                        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
                        <div className="space-y-3">
                          {filtTimeline.map((ev, i) => {
                            const c = colorMap[ev.color] || colorMap.blue;
                            return (
                              <motion.div key={i} initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.03 }}
                                className="flex gap-4 relative pl-12">
                                <div className={`absolute left-2.5 top-2.5 w-5 h-5 rounded-full ${c.dot} ring-2 ring-white flex items-center justify-center z-10`}>
                                  <i className={`fas fa-${ev.icon} text-white`} style={{fontSize:'9px'}} />
                                </div>
                                <div className={`flex-1 border ${c.border} rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition`}>
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <div>
                                      <div className="font-semibold text-gray-800 text-sm">{ev.title}</div>
                                      <div className="text-xs text-gray-600 mt-0.5">{ev.subtitle}</div>
                                      {ev.detail && <div className="text-xs text-gray-400 mt-0.5">{ev.detail}</div>}
                                    </div>
                                    <span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(ev.date)}</span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* OPD Visits */}
                {activeTab === 'opd' && (
                  <div>
                    <div className="px-5 py-4 border-b bg-blue-50 flex items-center gap-2">
                      <i className="fas fa-stethoscope text-blue-500" />
                      <h3 className="font-bold text-blue-800">OPD Visits</h3>
                      <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{(history?.opd_visits||[]).length}</span>
                    </div>
                    {loadingHist ? (
                      <div className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</div>
                    ) : !(history?.opd_visits?.length) ? (
                      <EmptyState icon="stethoscope" text="No OPD visits on record." />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-blue-50 text-xs font-semibold text-blue-700 uppercase">
                            <tr>{['Date','Department','Doctor','Visit Type','Chief Complaint','Status','Actions'].map(h=>(
                              <th key={h} className="px-4 py-3 text-left">{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {history.opd_visits.map((v,i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(v.visit_date)}</td>
                                <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs">{v.department||'—'}</span></td>
                                <td className="px-4 py-3 text-gray-700">Dr. {v.doctor_name||'—'}</td>
                                <td className="px-4 py-3 text-gray-600">{v.visit_type||'Consultation'}</td>
                                <td className="px-4 py-3 text-gray-600 max-w-xs"><div className="line-clamp-2">{v.chief_complaint||'—'}</div></td>
                                <td className="px-4 py-3">
                                  <Badge text={v.status||'—'} color={v.status==='Completed'?'green':v.status==='Waiting'?'yellow':v.status==='Cancelled'?'red':'gray'} />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1">
                                    <button onClick={() => setViewRecord({type:'opd', data:v})} className="p-1.5 rounded hover:bg-blue-100 text-blue-600 transition" title="View"><i className="fas fa-eye text-xs" /></button>
                                    <button onClick={() => printRecord('opd', v)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition" title="Print"><i className="fas fa-print text-xs" /></button>
                                    <button onClick={() => downloadPDF('opd', v.id||v.visit_id)} className="p-1.5 rounded hover:bg-green-100 text-green-600 transition" title="Download PDF"><i className="fas fa-file-pdf text-xs" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Prescriptions */}
                {activeTab === 'prescriptions' && (
                  <div>
                    <div className="px-5 py-4 border-b bg-purple-50 flex items-center gap-2">
                      <i className="fas fa-file-medical text-purple-500" />
                      <h3 className="font-bold text-purple-800">Prescriptions</h3>
                      <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{(history?.prescriptions||[]).length}</span>
                    </div>
                    {loadingHist ? (
                      <div className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</div>
                    ) : !(history?.prescriptions?.length) ? (
                      <EmptyState icon="file-medical" text="No prescriptions on record." />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-purple-50 text-xs font-semibold text-purple-700 uppercase">
                            <tr>{['Rx No','Date','Doctor','Dept','Diagnosis','Medications','Actions'].map(h=>(
                              <th key={h} className="px-4 py-3 text-left">{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {history.prescriptions.map((p,i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-xs font-bold text-purple-700">{p.rx_number}</td>
                                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(p.visit_date||p.created_at)}</td>
                                <td className="px-4 py-3"><div className="font-medium">Dr. {p.doctor_name}</div></td>
                                <td className="px-4 py-3 text-xs text-gray-500">{p.department}</td>
                                <td className="px-4 py-3 max-w-xs"><div className="line-clamp-2 text-gray-700">{p.diagnosis||'—'}</div></td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium">{p.medications?.length||0}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1">
                                    <button onClick={() => setViewRecord({type:'prescription', data:p})} className="p-1.5 rounded hover:bg-purple-100 text-purple-600 transition" title="View"><i className="fas fa-eye text-xs" /></button>
                                    <button onClick={() => printRecord('prescription', p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition" title="Print"><i className="fas fa-print text-xs" /></button>
                                    <button onClick={() => downloadPDF('prescription', p.id||p.prescription_id)} className="p-1.5 rounded hover:bg-green-100 text-green-600 transition" title="Download PDF"><i className="fas fa-file-pdf text-xs" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Lab Reports */}
                {activeTab === 'lab' && (
                  <div>
                    <div className="px-5 py-4 border-b bg-green-50 flex items-center gap-2">
                      <i className="fas fa-flask text-green-500" />
                      <h3 className="font-bold text-green-800">Lab Investigations</h3>
                      <span className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{(history?.lab_orders||[]).length}</span>
                    </div>
                    {loadingHist ? (
                      <div className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</div>
                    ) : !(history?.lab_orders?.length) ? (
                      <EmptyState icon="flask" text="No lab orders on record." />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-green-50 text-xs font-semibold text-green-700 uppercase">
                            <tr>{['Order No','Date','Tests','Doctor','Status','Actions'].map(h=>(
                              <th key={h} className="px-4 py-3 text-left">{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {history.lab_orders.map((l,i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-xs font-bold text-green-700">{l.order_number}</td>
                                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(l.order_date||l.created_at)}</td>
                                <td className="px-4 py-3">
                                  {(l.tests||[]).map((t,j)=>(
                                    <span key={j} className="inline-block mr-1 mb-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">{t.test_name||t}</span>
                                  ))}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">{l.doctor_name||'—'}</td>
                                <td className="px-4 py-3">
                                  <Badge text={l.status||'Pending'} color={l.status==='Completed'?'green':l.status==='Processing'?'yellow':'gray'} />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1">
                                    <button onClick={() => setViewRecord({type:'lab', data:l})} className="p-1.5 rounded hover:bg-green-100 text-green-600 transition" title="View"><i className="fas fa-eye text-xs" /></button>
                                    <button onClick={() => printRecord('lab', l)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition" title="Print"><i className="fas fa-print text-xs" /></button>
                                    <button onClick={() => downloadPDF('lab', l.id||l.order_id)} className="p-1.5 rounded hover:bg-green-100 text-green-700 transition" title="Download PDF"><i className="fas fa-file-pdf text-xs" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Admissions */}
                {activeTab === 'admissions' && (
                  <div>
                    <div className="px-5 py-4 border-b bg-red-50 flex items-center gap-2">
                      <i className="fas fa-bed text-red-500" />
                      <h3 className="font-bold text-red-800">IPD Admissions</h3>
                      <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{(history?.ipd_admissions||[]).length}</span>
                    </div>
                    {loadingHist ? (
                      <div className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</div>
                    ) : !(history?.ipd_admissions?.length) ? (
                      <EmptyState icon="bed" text="No IPD admissions on record." />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-red-50 text-xs font-semibold text-red-700 uppercase">
                            <tr>{['IPD No','Admitted','Discharged','Ward/Bed','Diagnosis','Status','Actions'].map(h=>(
                              <th key={h} className="px-4 py-3 text-left">{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {history.ipd_admissions.map((a,i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-xs font-bold text-red-700">{a.ipd_number||'—'}</td>
                                <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(a.admission_date)}</td>
                                <td className="px-4 py-3 text-xs text-gray-500">
                                  {a.discharge_date ? fmtDate(a.discharge_date) : <span className="text-yellow-600 font-medium">Admitted</span>}
                                </td>
                                <td className="px-4 py-3"><div className="font-medium">{a.ward_name||'—'}</div><div className="text-xs text-gray-400">Bed: {a.bed_number||'—'}</div></td>
                                <td className="px-4 py-3 max-w-xs"><div className="line-clamp-2 text-gray-700">{a.diagnosis||'—'}</div></td>
                                <td className="px-4 py-3">
                                  <Badge text={a.status||'Active'} color={a.status==='Discharged'?'green':a.status==='Active'?'red':'gray'} />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1">
                                    <button onClick={() => setViewRecord({type:'admission', data:a})} className="p-1.5 rounded hover:bg-red-100 text-red-600 transition" title="View"><i className="fas fa-eye text-xs" /></button>
                                    <button onClick={() => printRecord('admission', a)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition" title="Print"><i className="fas fa-print text-xs" /></button>
                                    <button onClick={() => downloadPDF('admission', a.id||a.admission_id)} className="p-1.5 rounded hover:bg-green-100 text-green-600 transition" title="Download PDF"><i className="fas fa-file-pdf text-xs" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Record Detail Modal ── */}
      <AnimatePresence>
        {viewRecord && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setViewRecord(null)}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800">
                  <i className={`fas fa-${viewRecord.type==='opd'?'stethoscope':viewRecord.type==='prescription'?'file-medical':viewRecord.type==='lab'?'flask':'bed'} mr-2`} />
                  {viewRecord.type==='opd'?'OPD Visit Details':viewRecord.type==='prescription'?'Prescription Details':viewRecord.type==='lab'?'Lab Report Details':'Admission Details'}
                </h2>
                <button onClick={() => setViewRecord(null)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <div className="p-6 space-y-4 text-sm">
                <div className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                  <i className="fas fa-user mr-1 text-blue-400" />{selected?.full_name} — <span className="font-mono">{selected?.mrn}</span>
                </div>

                {viewRecord.type === 'opd' && (
                  <div className="grid grid-cols-2 gap-3">
                    {[['Date', fmtDate(viewRecord.data.visit_date)], ['Department', viewRecord.data.department||'—'], ['Doctor', `Dr. ${viewRecord.data.doctor_name||'—'}`], ['Visit Type', viewRecord.data.visit_type||'—'], ['Payment Mode', viewRecord.data.payment_mode||'—'], ['Status', viewRecord.data.status||'—']].map(([k,v])=>(
                      <div key={k} className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-400">{k}</div><div className="font-medium text-gray-800 mt-0.5">{v}</div></div>
                    ))}
                    {viewRecord.data.chief_complaint && <div className="col-span-2 bg-blue-50 rounded-lg p-3"><div className="text-xs text-gray-400">Chief Complaint</div><div className="text-gray-800 mt-0.5">{viewRecord.data.chief_complaint}</div></div>}
                  </div>
                )}

                {viewRecord.type === 'prescription' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[['Rx Number', viewRecord.data.rx_number||'—'], ['Date', fmtDate(viewRecord.data.visit_date||viewRecord.data.created_at)], ['Doctor', `Dr. ${viewRecord.data.doctor_name||'—'}`], ['Department', viewRecord.data.department||'—']].map(([k,v])=>(
                        <div key={k} className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-400">{k}</div><div className="font-medium text-gray-800 mt-0.5">{v}</div></div>
                      ))}
                    </div>
                    {viewRecord.data.diagnosis && <div className="bg-purple-50 rounded-lg p-3"><div className="text-xs text-gray-400">Diagnosis</div><div className="text-gray-800 mt-0.5">{viewRecord.data.diagnosis}</div></div>}
                    {(viewRecord.data.medications||[]).length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Medications ({viewRecord.data.medications.length})</div>
                        {viewRecord.data.medications.map((med,i)=>(
                          <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-1">
                            <i className="fas fa-pills text-purple-400 text-xs" />
                            <span>{med.medicine_name||med.name||String(med)}</span>
                            {med.dosage && <span className="text-xs text-gray-400 ml-auto">{med.dosage}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {viewRecord.type === 'lab' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[['Order No', viewRecord.data.order_number||'—'], ['Date', fmtDate(viewRecord.data.order_date||viewRecord.data.created_at)], ['Doctor', viewRecord.data.doctor_name||'—'], ['Status', viewRecord.data.status||'—']].map(([k,v])=>(
                        <div key={k} className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-400">{k}</div><div className="font-medium text-gray-800 mt-0.5">{v}</div></div>
                      ))}
                    </div>
                    {(viewRecord.data.tests||[]).length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Tests ({viewRecord.data.tests.length})</div>
                        {viewRecord.data.tests.map((t,i)=>(
                          <div key={i} className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2 mb-1">
                            <i className="fas fa-flask text-green-400 text-xs" />
                            <span>{t.test_name||String(t)}</span>
                            {t.result && <span className="ml-auto text-xs font-medium text-green-700">{t.result}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {viewRecord.type === 'admission' && (
                  <div className="grid grid-cols-2 gap-3">
                    {[['IPD No', viewRecord.data.ipd_number||'—'], ['Status', viewRecord.data.status||'—'], ['Admitted', fmtDate(viewRecord.data.admission_date)], ['Discharged', viewRecord.data.discharge_date?fmtDate(viewRecord.data.discharge_date):'Still Admitted'], ['Ward', viewRecord.data.ward_name||'—'], ['Bed', viewRecord.data.bed_number||'—']].map(([k,v])=>(
                      <div key={k} className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-400">{k}</div><div className="font-medium text-gray-800 mt-0.5">{v}</div></div>
                    ))}
                    {viewRecord.data.diagnosis && <div className="col-span-2 bg-red-50 rounded-lg p-3"><div className="text-xs text-gray-400">Diagnosis</div><div className="text-gray-800 mt-0.5">{viewRecord.data.diagnosis}</div></div>}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t">
                  <button onClick={() => printRecord(viewRecord.type, viewRecord.data)}
                    className="flex-1 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center justify-center gap-2">
                    <i className="fas fa-print" /> Print
                  </button>
                  <button onClick={() => downloadPDF(viewRecord.type, viewRecord.data.id||viewRecord.data.visit_id||viewRecord.data.order_id||viewRecord.data.admission_id)}
                    className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2">
                    <i className="fas fa-file-pdf" /> Download PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
