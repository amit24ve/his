import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'https://cubehis.avopay.pro:5000/api/insurance';
const BASE_URL = 'https://cubehis.avopay.pro:5000';

const CLAIM_STATUSES = ['Submitted', 'Under Process', 'Approved', 'Settled', 'Rejected'];
const CLAIM_STATUS_COLORS = {
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Process': 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Settled: 'bg-teal-100 text-teal-700',
  Rejected: 'bg-red-100 text-red-700',
};
const PRE_AUTH_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
};
const DOC_TYPES = ['Claim Form', 'Discharge Summary', 'Investigation Report', 'Pre-Auth Letter', 'Bills & Receipts', 'ID Proof', 'Policy Copy', 'Other'];

const defaultClaim = {
  patient_name: '', mrn: '', doctor_name: '', uhid: '', insurance_company: '',
  tpa_name: '', policy_number: '', bill_number: '', member_id: '', claim_type: 'Cashless',
  admission_date: '', discharge_date: '', diagnosis: '', treatment: '', total_bill: '',
  claimed_amount: '', approved_amount: '', copay_amount: '', deduction_amount: '',
  patient_liability: '', pre_auth_number: '', pre_auth_status: 'Pending',
  claim_status: 'Submitted', remarks: ''
};
const defaultCompany = {
  name: '', code: '', tpa_name: '', contact_person: '', phone: '', email: '',
  address: '', empanelment_type: 'Cashless', empanelment_date: '', expiry_date: '',
  coverage_types: '', discount_percentage: '', status: 'Active'
};

export default function InsuranceTpaPage() {
  const [claims, setClaims] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('claims');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(null);
  const [claimForm, setClaimForm] = useState(defaultClaim);
  const [companyForm, setCompanyForm] = useState(defaultCompany);
  const [updateForm, setUpdateForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ claim_status: '', claim_type: '', insurance_company: '' });
  const [search, setSearch] = useState('');
  // Detail view
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [claimDocs, setClaimDocs] = useState([]);
  const [docType, setDocType] = useState('Claim Form');
  const [docUploading, setDocUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [patientJourney, setPatientJourney] = useState(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyBills, setJourneyBills] = useState([]);
  const [patientInfo, setPatientInfo] = useState(null);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` };

  const loadClaims = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.claim_status) params.set('claim_status', filters.claim_status);
      if (filters.claim_type) params.set('claim_type', filters.claim_type);
      if (filters.insurance_company) params.set('insurance_company', filters.insurance_company);
      if (search) params.set('search', search);
      const res = await fetch(`${API}/claims?${params}`, { headers });
      const data = await res.json();
      setClaims(data.claims || []);
    } catch (e) { console.error(e); }
  };

  const loadCompanies = async () => {
    try {
      const res = await fetch(`${API}/companies`, { headers });
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  };

  const loadStats = async () => {
    try {
      const res = await fetch(`${API}/stats`, { headers });
      const data = await res.json();
      setStats(data);
    } catch (e) { console.error(e); }
  };

  const load = async () => {
    setLoading(true);
    await Promise.all([loadClaims(), loadCompanies(), loadStats()]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);

  const loadClaimDocs = async (claimId) => {
    try {
      const res = await fetch(`${API}/claims/${claimId}/documents`, { headers });
      const data = await res.json();
      setClaimDocs(data.documents || []);
    } catch (e) { setClaimDocs([]); }
  };

  const openClaimDetail = (claim) => {
    setSelectedClaim(claim);
    setPatientJourney(null);
    setJourneyBills([]);
    setPatientInfo(null);
    loadClaimDocs(claim.id);
    if (claim.mrn) {
      setJourneyLoading(true);
      Promise.all([
        fetch(`https://cubehis.avopay.pro:5000/api/emr/patient/${encodeURIComponent(claim.mrn)}/history`, { headers }),
        fetch(`https://cubehis.avopay.pro:5000/api/billing/bills?search=${encodeURIComponent(claim.mrn)}`, { headers }),
        fetch(`https://cubehis.avopay.pro:5000/api/patients/?search=${encodeURIComponent(claim.mrn)}&limit=1`, { headers }),
      ]).then(([histRes, billsRes, patRes]) => Promise.all([histRes.json(), billsRes.json(), patRes.json()]))
        .then(([histData, billsData, patData]) => {
          setPatientJourney(histData);
          setJourneyBills(billsData.bills || []);
          const pts = patData.patients || [];
          const match = pts.find(p => p.mrn === claim.mrn) || pts[0] || null;
          setPatientInfo(match);
        })
        .catch(e => console.error(e))
        .finally(() => setJourneyLoading(false));
    }
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedClaim) return;
    setDocUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', docType);
      await fetch(`${API}/claims/${selectedClaim.id}/documents`, {
        method: 'POST',
        headers: { Authorization: headers.Authorization },
        body: fd,
      });
      loadClaimDocs(selectedClaim.id);
    } catch (e) { console.error(e); }
    setDocUploading(false);
    e.target.value = '';
  };

  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...claimForm, total_bill: parseFloat(claimForm.total_bill) || 0, claimed_amount: parseFloat(claimForm.claimed_amount) || 0, copay_amount: parseFloat(claimForm.copay_amount) || 0 };
      await fetch(`${API}/claims`, { method: 'POST', headers, body: JSON.stringify(body) });
      setShowClaimModal(false);
      setClaimForm(defaultClaim);
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...companyForm, discount_percentage: parseFloat(companyForm.discount_percentage) || 0, coverage_types: companyForm.coverage_types ? companyForm.coverage_types.split(',').map(s => s.trim()) : [] };
      await fetch(`${API}/companies`, { method: 'POST', headers, body: JSON.stringify(body) });
      setShowCompanyModal(false);
      setCompanyForm(defaultCompany);
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleUpdateClaim = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/claims/${showUpdateModal.id}`, { method: 'PATCH', headers, body: JSON.stringify(updateForm) });
      setShowUpdateModal(null);
      setUpdateForm({});
      // refresh selected claim if open
      if (selectedClaim?.id === showUpdateModal.id) {
        const res = await fetch(`${API}/claims/${showUpdateModal.id}`, { headers });
        const updated = await res.json();
        setSelectedClaim(updated);
      }
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleDeleteClaim = async (id) => {
    if (!window.confirm('Delete this claim?')) return;
    await fetch(`${API}/claims/${id}`, { method: 'DELETE', headers });
    if (selectedClaim?.id === id) setSelectedClaim(null);
    load();
  };

  const exportClaims = () => {
    const rows = [
      ['Patient', 'MRN', 'Doctor', 'Insurance Company', 'Policy No.', 'Bill No.', 'Claim Type', 'Admission', 'Discharge', 'Bill Amt', 'Copay', 'Claimed', 'Approved', 'Pending', 'Status'],
      ...claims.map(c => [c.patient_name, c.mrn || '', c.doctor_name || '', c.insurance_company, c.policy_number, c.bill_number || '', c.claim_type, c.admission_date, c.discharge_date, c.total_bill, c.copay_amount || 0, c.claimed_amount, c.approved_amount ?? '', ((c.claimed_amount || 0) - (c.approved_amount || 0)).toFixed(2), c.claim_status])
    ];
    const csv = rows.map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'insurance_claims.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n) => (n != null && n !== '' ? `₹${Number(n).toLocaleString('en-IN')}` : '—');
  const pendingAmt = (c) => c.approved_amount != null ? Math.max(0, (c.claimed_amount || 0) - (c.approved_amount || 0)) : null;

  // ─── DETAIL VIEW ───
  if (selectedClaim) {
    const c = selectedClaim;
    const pending = pendingAmt(c);
    return (
      <div className="p-4 md:p-6 space-y-5">
        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedClaim(null)}
            className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm text-gray-600 hover:text-blue-700 hover:border-blue-400 shadow-sm transition">
            <i className="fas fa-arrow-left text-xs" /> Back to Claims
          </button>
          <div className="flex-1" />
          <button onClick={() => { setShowUpdateModal(c); setUpdateForm({ claim_status: c.claim_status, pre_auth_status: c.pre_auth_status, approved_amount: c.approved_amount, remarks: c.remarks }); }}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600 shadow transition">
            <i className="fas fa-edit" /> Update Status
          </button>
          <button onClick={() => handleDeleteClaim(c.id)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 shadow transition">
            <i className="fas fa-trash" /> Delete
          </button>
        </div>

        {/* Patient Info Banner */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white rounded-2xl p-5 shadow-lg">
          <div className="flex flex-wrap gap-6 items-start">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-2xl font-bold">
                {c.patient_name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold">{c.patient_name}</h2>
                {c.mrn && <p className="text-blue-200 text-sm font-mono mt-0.5"><i className="fas fa-id-card mr-1 text-xs" />{c.mrn}</p>}
                {c.doctor_name && <p className="text-blue-200 text-sm mt-0.5"><i className="fas fa-user-md mr-1 text-xs" />{c.doctor_name}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-5 ml-auto text-sm">
              {c.admission_date && <div><p className="text-blue-300 text-xs uppercase">Admission</p><p className="font-medium">{c.admission_date}</p></div>}
              {c.discharge_date && <div><p className="text-blue-300 text-xs uppercase">Discharge</p><p className="font-medium">{c.discharge_date}</p></div>}
              {c.diagnosis && <div><p className="text-blue-300 text-xs uppercase">Diagnosis</p><p className="font-medium max-w-xs">{c.diagnosis}</p></div>}
              <div>
                <p className="text-blue-300 text-xs uppercase">Status</p>
                <span className={`mt-1 inline-block px-3 py-1 rounded-full text-xs font-semibold ${CLAIM_STATUS_COLORS[c.claim_status] || 'bg-gray-100 text-gray-700'}`}>{c.claim_status}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Insurance Details */}
          <div className="lg:col-span-1 bg-white rounded-2xl shadow p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-700 border-b pb-2"><i className="fas fa-shield-alt text-blue-500 mr-2" />Insurance Details</h3>
            {[
              { label: 'Insurance Company', value: c.insurance_company, icon: 'building' },
              { label: 'TPA Name', value: c.tpa_name, icon: 'handshake' },
              { label: 'Policy Number', value: c.policy_number, mono: true, icon: 'file-contract' },
              { label: 'Bill Number', value: c.bill_number, mono: true, icon: 'receipt' },
              { label: 'Member ID', value: c.member_id, icon: 'id-badge' },
              { label: 'Pre-Auth No.', value: c.pre_auth_number, icon: 'check-square' },
              { label: 'Claim Type', value: c.claim_type, icon: 'tag' },
            ].map(row => row.value ? (
              <div key={row.label} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className={`fas fa-${row.icon} text-blue-400 text-xs`} />
                </div>
                <div>
                  <p className="text-xs text-gray-400">{row.label}</p>
                  <p className={`text-sm font-medium text-gray-800 ${row.mono ? 'font-mono' : ''}`}>{row.value}</p>
                </div>
              </div>
            ) : null)}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-yellow-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="fas fa-lock text-yellow-400 text-xs" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Pre-Auth Status</p>
                <span className={`mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${PRE_AUTH_COLORS[c.pre_auth_status] || 'bg-gray-100 text-gray-600'}`}>{c.pre_auth_status}</span>
              </div>
            </div>
            {c.remarks && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 border"><i className="fas fa-sticky-note text-gray-400 mr-1" />{c.remarks}</div>
            )}
          </div>

          {/* Billing Summary */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl shadow p-5">
              <h3 className="text-sm font-bold text-gray-700 border-b pb-2 mb-4"><i className="fas fa-file-invoice-dollar text-green-500 mr-2" />Billing Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Total Bill Amount', value: fmt(c.total_bill), color: 'blue', icon: 'file-invoice' },
                  { label: 'Copay (Patient)', value: fmt(c.copay_amount ?? c.patient_liability), color: 'orange', icon: 'user-tag' },
                  { label: 'Claimed Amount', value: fmt(c.claimed_amount), color: 'purple', icon: 'paper-plane' },
                  { label: 'Approved Amount', value: c.approved_amount != null ? fmt(c.approved_amount) : '—', color: 'green', icon: 'check-circle' },
                  { label: 'Pending Amount', value: pending != null ? fmt(pending) : '—', color: pending > 0 ? 'red' : 'gray', icon: 'hourglass-half' },
                  { label: 'Deduction', value: fmt(c.deduction_amount), color: 'gray', icon: 'minus-circle' },
                ].map(item => (
                  <div key={item.label} className={`rounded-xl p-4 border-l-4 border-${item.color}-400 bg-${item.color}-50`}>
                    <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                    <p className={`text-lg font-bold text-${item.color}-700`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Treatment Info */}
            {(c.treatment || c.diagnosis) && (
              <div className="bg-white rounded-2xl shadow p-5">
                <h3 className="text-sm font-bold text-gray-700 border-b pb-2 mb-3"><i className="fas fa-stethoscope text-purple-500 mr-2" />Clinical Info</h3>
                {c.diagnosis && <div className="mb-2"><p className="text-xs text-gray-400 mb-1">Diagnosis</p><p className="text-sm text-gray-700">{c.diagnosis}</p></div>}
                {c.treatment && <div><p className="text-xs text-gray-400 mb-1">Treatment / Procedure</p><p className="text-sm text-gray-700">{c.treatment}</p></div>}
              </div>
            )}
          </div>
        </div>

        {/* Documents Section */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="text-sm font-bold text-gray-700 border-b pb-2 mb-4"><i className="fas fa-paperclip text-blue-500 mr-2" />Claim Documents
            <span className="ml-2 text-xs text-gray-400 font-normal">({claimDocs.length} files)</span>
          </h3>
          {/* Upload */}
          <div className="flex flex-wrap gap-3 items-center mb-5">
            <select value={docType} onChange={e => setDocType(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleDocUpload}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
            <button onClick={() => fileInputRef.current?.click()} disabled={docUploading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition">
              {docUploading ? <><i className="fas fa-spinner fa-spin" /> Uploading...</> : <><i className="fas fa-upload" /> Upload Document</>}
            </button>
            <p className="text-xs text-gray-400">PDF, JPG, PNG, DOC supported</p>
          </div>
          {/* Doc list */}
          {claimDocs.length === 0 ? (
            <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-xl">
              <i className="fas fa-folder-open text-3xl mb-2" />
              <p className="text-sm">No documents uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {claimDocs.map((doc, i) => (
                <a key={i} href={`${BASE_URL}${doc.file_url}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 p-3 border rounded-xl hover:border-blue-400 hover:bg-blue-50 transition group">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <i className={`fas fa-${doc.file_url?.endsWith('.pdf') ? 'file-pdf text-red-500' : 'file-image text-blue-500'} text-lg`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-blue-700 truncate">{doc.doc_type}</p>
                    <p className="text-xs text-gray-400 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-300">{doc.uploaded_at?.split('T')[0]}</p>
                  </div>
                  <i className="fas fa-external-link-alt text-gray-300 group-hover:text-blue-500 text-xs ml-auto" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Patient Journey Timeline */}
        {c.mrn && (
          <div className="bg-white rounded-2xl shadow p-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3 mb-5">
              <div>
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-route text-indigo-600 text-xs" />
                  </span>
                  Patient Journey
                </h3>
                <p className="text-xs text-gray-400 mt-0.5 ml-9">Complete medical history for MRN: <span className="font-mono font-semibold text-teal-600">{c.mrn}</span></p>
              </div>
              {journeyLoading && (
                <div className="flex items-center gap-2 text-xs text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-full">
                  <i className="fas fa-spinner fa-spin" /> Loading records...
                </div>
              )}
            </div>

            {/* Summary Stats Row */}
            {!journeyLoading && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                {[
                  { label: 'Registration', value: patientInfo?.created_at ? new Date(patientInfo.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—', icon: 'id-card', color: 'teal', sub: 'Date' },
                  { label: 'Prescriptions', value: patientJourney?.prescriptions?.length ?? 0, icon: 'file-prescription', color: 'purple', sub: 'Total' },
                  { label: 'Lab Orders', value: patientJourney?.lab_orders?.length ?? 0, icon: 'flask', color: 'green', sub: 'Total' },
                  { label: 'IPD', value: patientJourney?.ipd_admissions?.length ?? 0, icon: 'bed', color: 'red', sub: 'Admissions' },
                  { label: 'Bills', value: journeyBills.length, icon: 'receipt', color: 'indigo', sub: 'Generated' },
                ].map(s => (
                  <div key={s.label} className={`bg-${s.color}-50 rounded-xl p-3 border border-${s.color}-100`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-6 h-6 rounded-full bg-${s.color}-100 flex items-center justify-center`}>
                        <i className={`fas fa-${s.icon} text-${s.color}-600 text-xs`} />
                      </div>
                      <span className="text-xs text-gray-500">{s.label}</span>
                    </div>
                    <p className={`text-lg font-bold text-${s.color}-700 leading-none`}>{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Bills Detail Table */}
            {!journeyLoading && journeyBills.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center"><i className="fas fa-file-invoice-dollar text-indigo-600 text-xs" /></span>
                  <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide">Bill Summary ({journeyBills.length})</h4>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-indigo-50 border-b border-indigo-100">
                        {['Bill No.', 'Date', 'Visit Type', 'Doctor', 'Total Amount', 'Amount Paid', 'Balance Due', 'Status'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold text-indigo-700">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {journeyBills.map(b => (
                        <tr key={b.id} className="hover:bg-indigo-50 transition">
                          <td className="px-3 py-2.5 font-mono font-bold text-indigo-700">{b.bill_number}</td>
                          <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                          <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{b.visit_type}</span></td>
                          <td className="px-3 py-2.5 text-gray-600">{b.doctor_name || '—'}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-800">₹{(b.net_amount || 0).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2.5 text-green-700 font-semibold">₹{(b.amount_paid || 0).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2.5">
                            <span className={`font-bold ${(b.balance_due || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              ₹{(b.balance_due || 0).toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${b.payment_status === 'Paid' ? 'bg-green-100 text-green-700' : b.payment_status === 'Partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{b.payment_status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td colSpan={4} className="px-3 py-2.5 text-right font-bold text-gray-500 text-xs uppercase">Grand Total</td>
                        <td className="px-3 py-2.5 font-bold text-gray-800">₹{journeyBills.reduce((s, b) => s + (b.net_amount || 0), 0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2.5 font-bold text-green-700">₹{journeyBills.reduce((s, b) => s + (b.amount_paid || 0), 0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2.5 font-bold text-red-600">₹{journeyBills.reduce((s, b) => s + (b.balance_due || 0), 0).toLocaleString('en-IN')}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Chronological Timeline */}
            {!journeyLoading && (patientInfo || patientJourney || journeyBills.length > 0) && (() => {
              // Build sorted event list
              const events = [];
              if (patientInfo?.created_at)
                events.push({ type: 'registration', date: new Date(patientInfo.created_at), data: patientInfo });
              if (c.admission_date)
                events.push({ type: 'admission', date: new Date(c.admission_date), data: c });
              patientJourney?.ipd_admissions?.forEach(a => {
                const d = a.admission_date || a.created_at;
                if (d) events.push({ type: 'ipd', date: new Date(d), data: a });
              });
              patientJourney?.prescriptions?.forEach(p => {
                if (p.created_at) events.push({ type: 'prescription', date: new Date(p.created_at), data: p });
              });
              patientJourney?.lab_orders?.forEach(l => {
                const d = l.ordered_at || l.created_at;
                if (d) events.push({ type: 'lab', date: new Date(d), data: l });
              });
              journeyBills.forEach(b => {
                if (b.created_at) events.push({ type: 'bill', date: new Date(b.created_at), data: b });
              });
              if (c.discharge_date)
                events.push({ type: 'discharge', date: new Date(c.discharge_date), data: c });
              events.sort((a, b) => a.date - b.date);

              const EVENT_CONFIG = {
                registration: { label: 'Patient Registered', icon: 'id-card', bg: 'bg-teal-500', card: 'bg-teal-50 border-teal-200', text: 'text-teal-800', sub: 'text-teal-600' },
                admission:    { label: 'Admitted to Hospital', icon: 'hospital', bg: 'bg-blue-500', card: 'bg-blue-50 border-blue-200', text: 'text-blue-800', sub: 'text-blue-600' },
                ipd:          { label: 'IPD Admission', icon: 'bed', bg: 'bg-rose-500', card: 'bg-rose-50 border-rose-200', text: 'text-rose-800', sub: 'text-rose-600' },
                prescription: { label: 'Prescription Issued', icon: 'prescription-bottle-alt', bg: 'bg-purple-500', card: 'bg-purple-50 border-purple-200', text: 'text-purple-800', sub: 'text-purple-600' },
                lab:          { label: 'Lab Order', icon: 'flask', bg: 'bg-green-500', card: 'bg-green-50 border-green-200', text: 'text-green-800', sub: 'text-green-600' },
                bill:         { label: 'Bill Generated', icon: 'file-invoice-dollar', bg: 'bg-indigo-500', card: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-800', sub: 'text-indigo-600' },
                discharge:    { label: 'Patient Discharged', icon: 'sign-out-alt', bg: 'bg-gray-500', card: 'bg-gray-50 border-gray-200', text: 'text-gray-700', sub: 'text-gray-500' },
              };

              const fmtDate = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
              const fmtTime = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

              return (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center"><i className="fas fa-stream text-gray-500 text-xs" /></span>
                    <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide">Activity Timeline ({events.length} events)</h4>
                  </div>
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-teal-300 via-indigo-200 to-gray-200" />

                    <div className="space-y-3">
                      {events.map((ev, idx) => {
                        const cfg = EVENT_CONFIG[ev.type] || EVENT_CONFIG.registration;
                        const d = ev.data;

                        return (
                          <div key={idx} className="relative flex gap-4 items-start">
                            {/* Dot */}
                            <div className={`relative z-10 w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 shadow-md border-2 border-white`}>
                              <i className={`fas fa-${cfg.icon} text-white text-xs`} />
                            </div>

                            {/* Card */}
                            <div className={`flex-1 border ${cfg.card} rounded-xl p-3 shadow-sm`}>
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</p>
                                  {/* Event-specific subtitle */}
                                  {ev.type === 'registration' && (
                                    <p className={`text-xs mt-0.5 ${cfg.sub}`}>
                                      MRN: <span className="font-mono font-semibold">{d.mrn}</span>
                                      {d.full_name && ` · ${d.full_name}`}
                                      {d.gender && ` · ${d.gender}`}
                                      {d.mobile && ` · ${d.mobile}`}
                                    </p>
                                  )}
                                  {ev.type === 'admission' && (
                                    <p className={`text-xs mt-0.5 ${cfg.sub}`}>
                                      {d.diagnosis ? `Diagnosis: ${d.diagnosis}` : 'Insurance Claim Admission'}
                                      {d.doctor_name ? ` · Dr. ${d.doctor_name}` : ''}
                                    </p>
                                  )}
                                  {ev.type === 'ipd' && (
                                    <p className={`text-xs mt-0.5 ${cfg.sub}`}>
                                      IPD #{d.ipd_number || '—'}
                                      {d.ward_name ? ` · Ward: ${d.ward_name}` : ''}
                                      {d.bed_number ? ` · Bed: ${d.bed_number}` : ''}
                                    </p>
                                  )}
                                  {ev.type === 'prescription' && (
                                    <p className={`text-xs mt-0.5 ${cfg.sub}`}>
                                      Rx: <span className="font-mono">{d.rx_number}</span>
                                      {d.doctor_name ? ` · Dr. ${d.doctor_name}` : ''}
                                      {d.department ? ` · ${d.department}` : ''}
                                    </p>
                                  )}
                                  {ev.type === 'lab' && (
                                    <p className={`text-xs mt-0.5 ${cfg.sub}`}>
                                      Order: <span className="font-mono">{d.order_number}</span>
                                      {d.doctor_name ? ` · Dr. ${d.doctor_name}` : ''}
                                    </p>
                                  )}
                                  {ev.type === 'bill' && (
                                    <p className={`text-xs mt-0.5 ${cfg.sub}`}>
                                      Bill: <span className="font-mono">{d.bill_number}</span>
                                      {d.visit_type ? ` · ${d.visit_type}` : ''}
                                      {d.doctor_name ? ` · Dr. ${d.doctor_name}` : ''}
                                    </p>
                                  )}
                                  {ev.type === 'discharge' && (
                                    <p className={`text-xs mt-0.5 ${cfg.sub}`}>
                                      Admitted: {c.admission_date || '—'} · Claim: {c.claim_status}
                                    </p>
                                  )}
                                </div>
                                {/* Date badge */}
                                <div className="text-right flex-shrink-0">
                                  <div className={`inline-flex flex-col items-end`}>
                                    <span className={`text-xs font-semibold ${cfg.text}`}>{fmtDate(ev.date)}</span>
                                    {(ev.type !== 'registration' || ev.date.getHours() !== 0) && (
                                      <span className="text-xs text-gray-400">{fmtTime(ev.date)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Extra info chips */}
                              <div className="flex flex-wrap gap-2 mt-2">
                                {ev.type === 'prescription' && d.diagnosis && (
                                  <span className="px-2 py-0.5 rounded-full bg-white border border-purple-200 text-purple-700 text-xs">
                                    <i className="fas fa-stethoscope mr-1" />{d.diagnosis}
                                  </span>
                                )}
                                {ev.type === 'prescription' && d.medications?.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-white border border-purple-200 text-purple-700 text-xs">
                                    <i className="fas fa-pills mr-1" />{d.medications.length} medicine{d.medications.length > 1 ? 's' : ''}: {d.medications.slice(0, 3).map(m => m.drug_name).filter(Boolean).join(', ')}{d.medications.length > 3 ? '…' : ''}
                                  </span>
                                )}
                                {ev.type === 'lab' && d.tests?.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-white border border-green-200 text-green-700 text-xs">
                                    <i className="fas fa-vial mr-1" />{d.tests.length} test{d.tests.length > 1 ? 's' : ''}
                                  </span>
                                )}
                                {ev.type === 'lab' && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${d.status === 'Completed' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                                    {d.status || 'Pending'}
                                  </span>
                                )}
                                {ev.type === 'bill' && (
                                  <>
                                    <span className="px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-700 text-xs font-semibold">
                                      ₹{(d.net_amount || 0).toLocaleString('en-IN')}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-white border border-green-200 text-green-700 text-xs">
                                      Paid ₹{(d.amount_paid || 0).toLocaleString('en-IN')}
                                    </span>
                                    {(d.balance_due || 0) > 0 && (
                                      <span className="px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
                                        Due ₹{d.balance_due.toLocaleString('en-IN')}
                                      </span>
                                    )}
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.payment_status === 'Paid' ? 'bg-green-50 border border-green-200 text-green-700' : d.payment_status === 'Partial' ? 'bg-yellow-50 border border-yellow-200 text-yellow-700' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                                      {d.payment_status}
                                    </span>
                                  </>
                                )}
                                {ev.type === 'ipd' && d.status && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.status === 'Admitted' ? 'bg-green-50 border border-green-200 text-green-700' : d.status === 'Discharged' ? 'bg-gray-50 border border-gray-200 text-gray-600' : 'bg-yellow-50 border border-yellow-200 text-yellow-700'}`}>
                                    {d.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Discharge Pending indicator if no discharge yet */}
                      {!c.discharge_date && (
                        <div className="relative flex gap-4 items-start">
                          <div className="relative z-10 w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0 shadow-md border-2 border-white animate-pulse">
                            <i className="fas fa-clock text-white text-xs" />
                          </div>
                          <div className="flex-1 border border-amber-200 bg-amber-50 rounded-xl p-3 shadow-sm">
                            <p className="text-sm font-bold text-amber-800">Discharge Pending</p>
                            <p className="text-xs text-amber-600 mt-0.5">Patient is currently admitted · No discharge date recorded yet</p>
                            {c.admission_date && (
                              <div className="mt-2">
                                <span className="px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-700 text-xs">
                                  <i className="fas fa-calendar-check mr-1" />Admitted: {c.admission_date}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {events.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                          <i className="fas fa-inbox text-3xl mb-2" />
                          <p className="text-sm">No activity records found for this patient</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {!journeyLoading && !patientInfo && !patientJourney && journeyBills.length === 0 && (
              <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl">
                <i className="fas fa-search text-3xl mb-2" />
                <p className="text-sm">No records found for MRN: <span className="font-mono font-semibold">{c.mrn}</span></p>
              </div>
            )}
          </div>
        )}

        {/* Update Modal (same as main list) */}
        <AnimatePresence>
          {showUpdateModal && (
            <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
                <div className="flex items-center justify-between p-5 border-b">
                  <h2 className="text-lg font-bold text-blue-800">Update Claim Status</h2>
                  <button onClick={() => setShowUpdateModal(null)} className="text-gray-400 hover:text-red-500"><i className="fas fa-times" /></button>
                </div>
                <form onSubmit={handleUpdateClaim} className="p-5 space-y-4">
                  <div><label className="text-xs text-gray-500 font-medium">Claim Status</label>
                    <select value={updateForm.claim_status || ''} onChange={e => setUpdateForm(f => ({ ...f, claim_status: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                      {CLAIM_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select></div>
                  <div><label className="text-xs text-gray-500 font-medium">Pre-Auth Status</label>
                    <select value={updateForm.pre_auth_status || ''} onChange={e => setUpdateForm(f => ({ ...f, pre_auth_status: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                      <option>Pending</option><option>Approved</option><option>Rejected</option>
                    </select></div>
                  <div><label className="text-xs text-gray-500 font-medium">Approved Amount (₹)</label>
                    <input type="number" value={updateForm.approved_amount || ''} onChange={e => setUpdateForm(f => ({ ...f, approved_amount: parseFloat(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" min="0" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Remarks</label>
                    <textarea value={updateForm.remarks || ''} onChange={e => setUpdateForm(f => ({ ...f, remarks: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" rows={3} /></div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setShowUpdateModal(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                    <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                      {saving ? 'Saving...' : 'Update'}
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

  // ─── LIST VIEW ───
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Insurance & TPA Management</h1>
          <p className="text-gray-500 text-sm mt-1">Cashless claims, pre-auth, TPA empanelment</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeTab === 'claims' && (
            <>
              <button onClick={exportClaims} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow transition text-sm">
                <i className="fas fa-file-csv" /> Export CSV
              </button>
              <button onClick={() => setShowClaimModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition text-sm">
                <i className="fas fa-plus" /> New Claim
              </button>
            </>
          )}
          {activeTab === 'companies' && (
            <button onClick={() => setShowCompanyModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition text-sm">
              <i className="fas fa-building" /> Add Company/TPA
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Claims', value: stats.total_claims ?? '—', icon: 'file-medical', color: 'blue' },
          { label: 'Submitted', value: stats.submitted ?? '—', icon: 'paper-plane', color: 'blue' },
          { label: 'Approved', value: stats.approved ?? '—', icon: 'check-circle', color: 'green' },
          { label: 'Settled', value: stats.settled ?? '—', icon: 'money-bill-wave', color: 'teal' },
          { label: 'Rejected', value: stats.rejected ?? '—', icon: 'times-circle', color: 'red' },
          { label: 'Active Companies', value: stats.active_companies ?? '—', icon: 'building', color: 'purple' },
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

      {/* Amount Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <i className="fas fa-file-invoice-dollar text-xl" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Claimed Amount</p>
            <p className="text-2xl font-bold text-blue-700">₹{(stats.total_claimed || 0).toLocaleString('en-IN')}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
            <i className="fas fa-check-double text-xl" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Approved Amount</p>
            <p className="text-2xl font-bold text-green-700">₹{(stats.total_approved || 0).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[{ key: 'claims', label: 'Claims', icon: 'file-medical' }, { key: 'companies', label: 'Companies / TPA', icon: 'building' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-blue-600'}`}>
            <i className={`fas fa-${t.icon} mr-1`} /> {t.label}
          </button>
        ))}
      </div>

      {/* Claims Tab */}
      {activeTab === 'claims' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl shadow">
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
              placeholder="Search patient / MRN / policy..." className="border rounded-lg px-3 py-2 text-sm flex-1" />
            <select value={filters.claim_status} onChange={e => setFilters(f => ({ ...f, claim_status: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">All Status</option>
              {CLAIM_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filters.claim_type} onChange={e => setFilters(f => ({ ...f, claim_type: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">All Types</option>
              <option>Cashless</option><option>Reimbursement</option>
            </select>
            <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Search</button>
          </div>

          <div className="bg-white rounded-xl shadow overflow-x-auto">
            {loading ? (
              <div className="text-center py-16 text-gray-400"><i className="fas fa-spinner fa-spin text-3xl" /></div>
            ) : claims.length === 0 ? (
              <div className="text-center py-16 text-gray-400"><i className="fas fa-file-medical text-4xl mb-2" /><p>No claims found</p></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-blue-50 text-blue-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">MR No.</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Patient</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Insurance Co.</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">TPA Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Policy No.</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Bill No.</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Claim Type</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Bill Amt</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Copay</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Claimed</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Approved</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide">Pending</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {claims.map((c, i) => {
                    const pend = pendingAmt(c);
                    return (
                      <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        onClick={() => openClaimDetail(c)}
                        className="hover:bg-blue-50 cursor-pointer transition">
                        <td className="px-4 py-3">
                          {c.mrn ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-50 border border-teal-200 font-mono text-xs font-bold text-teal-700">{c.mrn}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{c.patient_name}</p>
                          {c.doctor_name && <p className="text-xs text-gray-400 mt-0.5"><i className="fas fa-user-md mr-1" />{c.doctor_name}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">{c.insurance_company}</td>
                        <td className="px-4 py-3">
                          {c.tpa_name ? <span className="text-sm text-gray-700">{c.tpa_name}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.policy_number || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.bill_number || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.claim_type === 'Cashless' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{c.claim_type}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 font-medium">{fmt(c.total_bill)}</td>
                        <td className="px-4 py-3 text-right text-orange-600">{fmt(c.copay_amount ?? c.patient_liability)}</td>
                        <td className="px-4 py-3 text-right text-purple-700 font-medium">{fmt(c.claimed_amount)}</td>
                        <td className="px-4 py-3 text-right text-green-700 font-medium">{c.approved_amount != null ? fmt(c.approved_amount) : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-right">
                          {pend != null ? <span className={pend > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{fmt(pend)}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${CLAIM_STATUS_COLORS[c.claim_status] || 'bg-gray-100 text-gray-700'}`}>{c.claim_status}</span>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setShowUpdateModal(c); setUpdateForm({ claim_status: c.claim_status, pre_auth_status: c.pre_auth_status, approved_amount: c.approved_amount, remarks: c.remarks }); }}
                              className="p-1.5 rounded hover:bg-yellow-100 text-yellow-600 transition" title="Update Status">
                              <i className="fas fa-edit text-xs" />
                            </button>
                            <button
                              onClick={() => handleDeleteClaim(c.id)}
                              className="p-1.5 rounded hover:bg-red-100 text-red-500 transition" title="Delete">
                              <i className="fas fa-trash text-xs" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <p className="text-xs text-gray-400 text-center">Click any row to view claim details</p>
        </>
      )}

      {/* Companies Tab */}
      {activeTab === 'companies' && (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          {companies.length === 0 ? (
            <div className="text-center py-16 text-gray-400"><i className="fas fa-building text-4xl mb-2" /><p>No companies added yet</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-blue-50 text-blue-800">
                <tr>
                  <th className="px-4 py-3 text-left">Company Name</th>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">TPA</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Empanelment</th>
                  <th className="px-4 py-3 text-left">Discount</th>
                  <th className="px-4 py-3 text-left">Expiry</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companies.map((c, i) => (
                  <tr key={c.id} className="hover:bg-blue-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.code}</td>
                    <td className="px-4 py-3 text-gray-600">{c.tpa_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600"><p>{c.contact_person || '—'}</p><p className="text-xs text-gray-400">{c.phone || ''}</p></td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{c.empanelment_type}</span></td>
                    <td className="px-4 py-3 text-gray-600">{c.discount_percentage ? `${c.discount_percentage}%` : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.expiry_date || '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* New Claim Modal */}
      <AnimatePresence>
        {showClaimModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
              <div className="flex items-center justify-between p-5 border-b">
                <h2 className="text-lg font-bold text-blue-800">Register Insurance Claim</h2>
                <button onClick={() => setShowClaimModal(false)} className="text-gray-400 hover:text-red-500"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleClaimSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="text-xs text-gray-500 font-medium">Patient Name *</label>
                    <input required value={claimForm.patient_name} onChange={e => setClaimForm(f => ({ ...f, patient_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">MRN Number</label>
                    <input value={claimForm.mrn} onChange={e => setClaimForm(f => ({ ...f, mrn: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" placeholder="e.g. MRN-2026000001" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Doctor Name</label>
                    <input value={claimForm.doctor_name} onChange={e => setClaimForm(f => ({ ...f, doctor_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">UHID</label>
                    <input value={claimForm.uhid} onChange={e => setClaimForm(f => ({ ...f, uhid: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Insurance Company *</label>
                    <input required list="ins-list" value={claimForm.insurance_company} onChange={e => setClaimForm(f => ({ ...f, insurance_company: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                    <datalist id="ins-list">{companies.map(c => <option key={c.id} value={c.name} />)}</datalist></div>
                  <div><label className="text-xs text-gray-500 font-medium">TPA Name</label>
                    <input value={claimForm.tpa_name} onChange={e => setClaimForm(f => ({ ...f, tpa_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Policy Number *</label>
                    <input required value={claimForm.policy_number} onChange={e => setClaimForm(f => ({ ...f, policy_number: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Bill Number</label>
                    <input value={claimForm.bill_number} onChange={e => setClaimForm(f => ({ ...f, bill_number: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Member ID</label>
                    <input value={claimForm.member_id} onChange={e => setClaimForm(f => ({ ...f, member_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Claim Type</label>
                    <select value={claimForm.claim_type} onChange={e => setClaimForm(f => ({ ...f, claim_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                      <option>Cashless</option><option>Reimbursement</option></select></div>
                  <div><label className="text-xs text-gray-500 font-medium">Pre-Auth Status</label>
                    <select value={claimForm.pre_auth_status} onChange={e => setClaimForm(f => ({ ...f, pre_auth_status: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                      <option>Pending</option><option>Approved</option><option>Rejected</option></select></div>
                  <div><label className="text-xs text-gray-500 font-medium">Admission Date</label>
                    <input type="date" value={claimForm.admission_date} onChange={e => setClaimForm(f => ({ ...f, admission_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Discharge Date</label>
                    <input type="date" value={claimForm.discharge_date} onChange={e => setClaimForm(f => ({ ...f, discharge_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Total Bill Amount (₹)</label>
                    <input type="number" value={claimForm.total_bill} onChange={e => setClaimForm(f => ({ ...f, total_bill: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" min="0" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Copay Amount (₹)</label>
                    <input type="number" value={claimForm.copay_amount} onChange={e => setClaimForm(f => ({ ...f, copay_amount: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" min="0" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Claimed Amount (₹)</label>
                    <input type="number" value={claimForm.claimed_amount} onChange={e => setClaimForm(f => ({ ...f, claimed_amount: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" min="0" /></div>
                </div>
                <div><label className="text-xs text-gray-500 font-medium">Diagnosis</label>
                  <input value={claimForm.diagnosis} onChange={e => setClaimForm(f => ({ ...f, diagnosis: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Primary diagnosis / ICD code" /></div>
                <div><label className="text-xs text-gray-500 font-medium">Treatment / Procedure</label>
                  <textarea value={claimForm.treatment} onChange={e => setClaimForm(f => ({ ...f, treatment: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" rows={2} /></div>
                <div><label className="text-xs text-gray-500 font-medium">Remarks</label>
                  <textarea value={claimForm.remarks} onChange={e => setClaimForm(f => ({ ...f, remarks: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" rows={2} /></div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowClaimModal(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Submit Claim'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Company Modal */}
      <AnimatePresence>
        {showCompanyModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
              <div className="flex items-center justify-between p-5 border-b">
                <h2 className="text-lg font-bold text-blue-800">Add Insurance Company / TPA</h2>
                <button onClick={() => setShowCompanyModal(false)} className="text-gray-400 hover:text-red-500"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleCompanySubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="text-xs text-gray-500 font-medium">Company Name *</label>
                    <input required value={companyForm.name} onChange={e => setCompanyForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Code *</label>
                    <input required value={companyForm.code} onChange={e => setCompanyForm(f => ({ ...f, code: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. STAR, NIAC" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">TPA Name</label>
                    <input value={companyForm.tpa_name} onChange={e => setCompanyForm(f => ({ ...f, tpa_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Contact Person</label>
                    <input value={companyForm.contact_person} onChange={e => setCompanyForm(f => ({ ...f, contact_person: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Phone</label>
                    <input value={companyForm.phone} onChange={e => setCompanyForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Email</label>
                    <input type="email" value={companyForm.email} onChange={e => setCompanyForm(f => ({ ...f, email: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Empanelment Type</label>
                    <select value={companyForm.empanelment_type} onChange={e => setCompanyForm(f => ({ ...f, empanelment_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                      <option>Cashless</option><option>Reimbursement</option><option>Both</option></select></div>
                  <div><label className="text-xs text-gray-500 font-medium">Discount %</label>
                    <input type="number" value={companyForm.discount_percentage} onChange={e => setCompanyForm(f => ({ ...f, discount_percentage: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" min="0" max="100" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Empanelment Date</label>
                    <input type="date" value={companyForm.empanelment_date} onChange={e => setCompanyForm(f => ({ ...f, empanelment_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
                  <div><label className="text-xs text-gray-500 font-medium">Expiry Date</label>
                    <input type="date" value={companyForm.expiry_date} onChange={e => setCompanyForm(f => ({ ...f, expiry_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
                </div>
                <div><label className="text-xs text-gray-500 font-medium">Coverage Types (comma separated)</label>
                  <input value={companyForm.coverage_types} onChange={e => setCompanyForm(f => ({ ...f, coverage_types: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. Inpatient, Day Care, Maternity" /></div>
                <div><label className="text-xs text-gray-500 font-medium">Address</label>
                  <textarea value={companyForm.address} onChange={e => setCompanyForm(f => ({ ...f, address: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" rows={2} /></div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowCompanyModal(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Add Company'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update Claim Status Modal */}
      <AnimatePresence>
        {showUpdateModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
              <div className="flex items-center justify-between p-5 border-b">
                <h2 className="text-lg font-bold text-blue-800">Update Claim Status</h2>
                <button onClick={() => setShowUpdateModal(null)} className="text-gray-400 hover:text-red-500"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleUpdateClaim} className="p-5 space-y-4">
                <div><label className="text-xs text-gray-500 font-medium">Claim Status</label>
                  <select value={updateForm.claim_status || ''} onChange={e => setUpdateForm(f => ({ ...f, claim_status: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                    {CLAIM_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-500 font-medium">Pre-Auth Status</label>
                  <select value={updateForm.pre_auth_status || ''} onChange={e => setUpdateForm(f => ({ ...f, pre_auth_status: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                    <option>Pending</option><option>Approved</option><option>Rejected</option>
                  </select></div>
                <div><label className="text-xs text-gray-500 font-medium">Approved Amount (₹)</label>
                  <input type="number" value={updateForm.approved_amount || ''} onChange={e => setUpdateForm(f => ({ ...f, approved_amount: parseFloat(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" min="0" /></div>
                <div><label className="text-xs text-gray-500 font-medium">Remarks</label>
                  <textarea value={updateForm.remarks || ''} onChange={e => setUpdateForm(f => ({ ...f, remarks: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" rows={3} /></div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setShowUpdateModal(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Update'}
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

