import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { useCurrentUser } from '../hooks/useCurrentUser';

const API = 'https://cubehis.avopay.pro:5000/api';
const COLORS = ['#2563eb', '#10b981', '#f59e42', '#ef4444', '#6366f1', '#c026d3', '#059669', '#7c3aed', '#0284c7'];
const hdrs = () => ({ Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` });

const today = new Date();
const firstOfYear = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
const todayStr = today.toISOString().split('T')[0];

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = n => n != null ? Number(n).toLocaleString('en-IN') : '—';
const fmtC = n => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const KPICard = ({ label, value, icon, color, sub }) => {
  const m = {
    blue: 'border-blue-500 text-blue-700 bg-blue-50', green: 'border-green-500 text-green-700 bg-green-50',
    yellow: 'border-yellow-500 text-yellow-700 bg-yellow-50', red: 'border-red-500 text-red-700 bg-red-50',
    purple: 'border-purple-500 text-purple-700 bg-purple-50', teal: 'border-teal-500 text-teal-700 bg-teal-50',
    indigo: 'border-indigo-500 text-indigo-700 bg-indigo-50',
  };
  const [border, text, bg] = (m[color] || m.blue).split(' ');
  return (
    <div className={`bg-white rounded-xl p-4 shadow border-l-4 ${border}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${text}`}>{value ?? '—'}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bg}`}>
          <i className={`fas fa-${icon} ${text}`} />
        </div>
      </div>
    </div>
  );
};

const ChartCard = ({ title, icon, children }) => (
  <div className="bg-white rounded-xl shadow p-5">
    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm">
      <i className={`fas fa-${icon} text-blue-500`} /> {title}
    </h3>
    {children}
  </div>
);

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white p-3 border shadow-lg rounded-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((e, i) => <p key={i} style={{ color: e.color }}>{e.name}: <strong>{e.value}</strong></p>)}
    </div>
  );
};

const STATUS_COLORS = {
  Scheduled: 'bg-blue-100 text-blue-700', Confirmed: 'bg-green-100 text-green-700',
  Completed: 'bg-teal-100 text-teal-700', Cancelled: 'bg-red-100 text-red-700',
  'No Show': 'bg-gray-100 text-gray-600', Admitted: 'bg-blue-100 text-blue-700',
  Discharged: 'bg-green-100 text-green-700', Paid: 'bg-green-100 text-green-700',
  Pending: 'bg-yellow-100 text-yellow-700', Partial: 'bg-orange-100 text-orange-700',
  Approved: 'bg-green-100 text-green-700', Rejected: 'bg-red-100 text-red-700',
  Settled: 'bg-teal-100 text-teal-700', Submitted: 'bg-blue-100 text-blue-700',
  'Sample Pending': 'bg-yellow-100 text-yellow-700', 'In Progress': 'bg-blue-100 text-blue-700',
  'Report Ready': 'bg-teal-100 text-teal-700',
};
const SBadge = ({ v }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[v] || 'bg-gray-100 text-gray-700'}`}>{v || '—'}</span>
);

// ── Paginated table ───────────────────────────────────────────────────────────
const PS = 10;
function DataTable({ title, icon, cols, rows, loading }) {
  const [pg, setPg] = React.useState(1);
  React.useEffect(() => { setPg(1); }, [rows]);
  const total = rows.length;
  const totalPg = Math.max(1, Math.ceil(total / PS));
  const slice = rows.slice((pg - 1) * PS, pg * PS);

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
        <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm">
          <i className={`fas fa-${icon} text-blue-500`} /> {title}
          <span className="ml-1 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{total}</span>
        </h3>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-12 text-center text-gray-400"><i className="fas fa-spinner fa-spin text-2xl" /><br className="mb-1" />Loading…</div>
        ) : !rows.length ? (
          <div className="py-12 text-center text-gray-400"><i className="fas fa-inbox text-3xl mb-2 block" />No records found for this period.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-blue-50 text-blue-800">
                <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase w-8">#</th>
                {cols.map(c => (
                  <th key={c.h} className={`px-3 py-2.5 font-semibold text-xs uppercase tracking-wide ${c.r ? 'text-right' : 'text-left'}`}>{c.h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {slice.map((row, i) => (
                <tr key={i} className="hover:bg-blue-50 transition">
                  <td className="px-3 py-2 text-gray-400">{(pg - 1) * PS + i + 1}</td>
                  {cols.map(c => (
                    <td key={c.h} className={`px-3 py-2 ${c.r ? 'text-right' : ''} ${c.cls || ''}`}>
                      {c.cell ? c.cell(row) : (row[c.k] ?? <span className="text-gray-300">—</span>)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {total > PS && (
        <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50 text-xs">
          <span className="text-gray-500">Showing {(pg - 1) * PS + 1}–{Math.min(pg * PS, total)} of {total}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPg(1)} disabled={pg === 1} className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">«</button>
            <button onClick={() => setPg(p => p - 1)} disabled={pg === 1} className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">‹</button>
            {Array.from({ length: Math.min(5, totalPg) }, (_, idx) => {
              const s = Math.max(1, Math.min(pg - 2, totalPg - 4));
              const p2 = s + idx;
              if (p2 > totalPg) return null;
              return (
                <button key={p2} onClick={() => setPg(p2)}
                  className={`px-2.5 py-1 rounded border text-xs ${p2 === pg ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-100'}`}>{p2}</button>
              );
            })}
            <button onClick={() => setPg(p => p + 1)} disabled={pg === totalPg} className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">›</button>
            <button onClick={() => setPg(totalPg)} disabled={pg === totalPg} className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">»</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Column definitions ────────────────────────────────────────────────────────
const apptCols = [
  { h: 'Token', k: 'token_number' },
  { h: 'MRN', k: 'mrn', cls: 'font-mono text-teal-700' },
  { h: 'Patient', k: 'patient_name', cls: 'font-medium' },
  { h: 'Doctor', k: 'doctor_name' },
  { h: 'Department', k: 'department' },
  { h: 'Date', k: 'appointment_date' },
  { h: 'Time', k: 'appointment_time' },
  { h: 'Type', k: 'appointment_type' },
  { h: 'Status', cell: r => <SBadge v={r.status} /> },
];

const opdCols = [
  { h: 'Token', k: 'token_number' },
  { h: 'MRN', k: 'mrn', cls: 'font-mono text-teal-700' },
  { h: 'Patient', k: 'patient_name', cls: 'font-medium' },
  { h: 'Doctor', k: 'doctor_name' },
  { h: 'Department', k: 'department' },
  { h: 'Visit Date', k: 'visit_date' },
  { h: 'Chief Complaint', k: 'chief_complaint' },
  { h: 'Status', cell: r => <SBadge v={r.status} /> },
];

const ipdCols = [
  { h: 'IPD No.', k: 'ipd_number', cls: 'font-mono' },
  { h: 'Patient', k: 'patient_name', cls: 'font-medium' },
  { h: 'MRN', k: 'mrn', cls: 'font-mono text-teal-700' },
  { h: 'Doctor', cell: r => r.doctor_name || r.attending_doctor || '—' },
  { h: 'Ward', k: 'ward' },
  { h: 'Bed', k: 'bed_number' },
  { h: 'Admitted', k: 'admission_date' },
  { h: 'Discharged', k: 'discharge_date' },
  { h: 'Status', cell: r => <SBadge v={r.status} /> },
];

const billCols = [
  { h: 'Bill No.', k: 'bill_number', cls: 'font-mono' },
  { h: 'Patient', k: 'patient_name', cls: 'font-medium' },
  { h: 'MRN', k: 'mrn', cls: 'font-mono text-teal-700' },
  { h: 'Date', k: 'bill_date' },
  { h: 'Type', cell: r => r.bill_type || r.visit_type || '—' },
  { h: 'Total', r: true, cell: r => <span className="font-medium">{fmtC(r.total_amount ?? r.net_amount)}</span> },
  { h: 'Paid', r: true, cell: r => <span className="text-green-700">{fmtC(r.paid_amount ?? r.advance_paid)}</span> },
  { h: 'Balance Due', r: true, cell: r => <span className="text-red-600">{fmtC(r.balance_due ?? ((r.total_amount ?? 0) - (r.paid_amount ?? r.advance_paid ?? 0)))}</span> },
  { h: 'Mode', k: 'payment_mode' },
  { h: 'Status', cell: r => <SBadge v={r.payment_status} /> },
];

const labCols = [
  { h: 'Order No.', k: 'order_number', cls: 'font-mono' },
  { h: 'Patient', k: 'patient_name', cls: 'font-medium' },
  { h: 'Referred By', cell: r => r.doctor_name || r.referred_by || '—' },
  { h: 'Tests', cell: r => Array.isArray(r.tests) ? r.tests.map(t => t.test_name || t).join(', ') : (r.test_name || '—') },
  { h: 'Date', k: 'order_date' },
  { h: 'Amount', r: true, cell: r => <span className="font-medium">{fmtC(r.total_amount)}</span> },
  { h: 'Urgent', cell: r => r.urgent ? <span className="text-red-600 font-semibold">Yes</span> : <span className="text-gray-400">No</span> },
  { h: 'Status', cell: r => <SBadge v={r.status} /> },
];

const pharmaBillCols = [
  { h: 'Bill No.', k: 'bill_number', cls: 'font-mono' },
  { h: 'Patient', k: 'patient_name', cls: 'font-medium' },
  { h: 'MRN', k: 'mrn', cls: 'font-mono text-teal-700' },
  { h: 'Date', k: 'bill_date' },
  { h: 'Type', k: 'visit_type' },
  { h: 'Gross', r: true, cell: r => <span>{fmtC(r.gross_amount)}</span> },
  { h: 'Discount', r: true, cell: r => <span className="text-orange-600">{fmtC(r.discount_amount)}</span> },
  { h: 'GST', r: true, cell: r => <span>{fmtC(r.gst_amount)}</span> },
  { h: 'Net Payable', r: true, cell: r => <span className="font-semibold text-blue-700">{fmtC(r.net_payable)}</span> },
  { h: 'Mode', k: 'payment_mode' },
  { h: 'Status', cell: r => <SBadge v={r.status} /> },
];

const insCols = [
  { h: 'Patient', k: 'patient_name', cls: 'font-medium' },
  { h: 'MRN', k: 'mrn', cls: 'font-mono text-teal-700' },
  { h: 'TPA Name', k: 'tpa_name' },
  { h: 'Insurance Co.', k: 'insurance_company' },
  { h: 'Type', k: 'claim_type' },
  { h: 'Policy No.', k: 'policy_number', cls: 'font-mono' },
  { h: 'Claim No.', k: 'claim_number', cls: 'font-mono' },
  { h: 'Claim Date', k: 'claim_date' },
  { h: 'Claimed', r: true, cell: r => <span className="text-purple-700">{fmtC(r.claimed_amount)}</span> },
  { h: 'Approved', r: true, cell: r => <span className="text-green-700">{fmtC(r.approved_amount)}</span> },
  { h: 'Pre-Auth', k: 'pre_auth_status' },
  { h: 'Status', cell: r => <SBadge v={r.claim_status || r.status} /> },
];

// ── CSV export ────────────────────────────────────────────────────────────────
function toCSV(cols, rows) {
  const headers = cols.map(c => c.h);
  const body = rows.map(row =>
    cols.map(c => {
      let v = c.k ? (row[c.k] ?? '') : '';
      // special overrides for non-k cols
      if (c.h === 'Doctor') v = row.doctor_name || row.attending_doctor || '';
      if (c.h === 'Tests') v = Array.isArray(row.tests) ? row.tests.map(t => t.test_name || t).join('; ') : (row.test_name || '');
      if (c.h === 'Urgent') v = row.urgent ? 'Yes' : 'No';
      if (c.h === 'Status') v = row.status || row.payment_status || row.claim_status || '';
      if (c.h === 'Total' || c.h === 'Gross') v = row.total_amount ?? row.net_amount ?? row.gross_amount ?? '';
      if (c.h === 'Paid') v = row.paid_amount ?? row.advance_paid ?? '';
      if (c.h === 'Balance Due') v = row.balance_due ?? ((row.total_amount ?? 0) - (row.paid_amount ?? row.advance_paid ?? 0));
      if (c.h === 'Net Payable') v = row.net_payable ?? '';
      if (c.h === 'Discount') v = row.discount_amount ?? '';
      if (c.h === 'GST') v = row.gst_amount ?? '';
      if (c.h === 'Claimed') v = row.claimed_amount ?? '';
      if (c.h === 'Approved') v = row.approved_amount ?? '';
      if (c.h === 'Pre-Auth') v = row.pre_auth_status ?? '';
      if (c.h === 'Status') v = row.status || row.payment_status || row.claim_status || '';
      return `"${String(v).replace(/"/g, '""')}"`;
    })
  );
  return [headers.map(h => `"${h}"`).join(','), ...body.map(r => r.join(','))].join('\n');
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HISReportsPage() {
  const { hospital_id: myHospitalId } = useCurrentUser();
  const hparam = myHospitalId ? `&hospital_id=${myHospitalId}` : '';

  const [tab, setTab] = useState('overview');
  const [from, setFrom] = useState(firstOfYear);
  const [to, setTo] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Track which tabs have already loaded their detail data
  const loadedTabs = React.useRef(new Set());

  // Summary KPI stats
  const [stats, setStats] = useState({});
  const [insStats, setInsStats] = useState({});

  // Chart data
  const [opTrend, setOpTrend] = useState([]);
  const [revTrend, setRevTrend] = useState([]);
  const [deptDist, setDeptDist] = useState([]);
  const [labStatus, setLabStatus] = useState([]);
  const [bedUtil, setBedUtil] = useState([]);
  const [pharmaTop, setPharmaTop] = useState([]);

  // Detail table rows
  const [apptRows, setApptRows] = useState([]);
  const [opdRows, setOpdRows] = useState([]);
  const [ipdRows, setIpdRows] = useState([]);
  const [billingRows, setBillingRows] = useState([]);
  const [labRows, setLabRows] = useState([]);
  const [pharmaRows, setPharmaRows] = useState([]);
  const [insRows, setInsRows] = useState([]);

  const drp = `date_from=${from}&date_to=${to}`;

  // ── Phase 1: Load only stats (fast, shown on Overview) ──────────────────
  const loadStats = async () => {
    setLoading(true);
    try {
      const p = `?from=${from}&to=${to}${hparam}`;
      const [apptSt, opdSt, ipdSt, billSt, labSt, insSt] = await Promise.allSettled([
        fetch(`${API}/appointments/stats${p}`, { headers: hdrs() }).then(r => r.json()),
        fetch(`${API}/opd/stats${p}`, { headers: hdrs() }).then(r => r.json()),
        fetch(`${API}/ipd/stats${p}`, { headers: hdrs() }).then(r => r.json()),
        fetch(`${API}/billing/stats${p}`, { headers: hdrs() }).then(r => r.json()),
        fetch(`${API}/laboratory/stats${p}`, { headers: hdrs() }).then(r => r.json()),
        fetch(`${API}/insurance/stats?from=${from}&to=${to}${hparam}`, { headers: hdrs() }).then(r => r.json()),
      ]);
      const g = r => r.status === 'fulfilled' ? r.value : {};
      const insD = g(insSt);
      setInsStats(insD);
      setStats({
        totalAppointments: g(apptSt).total ?? g(apptSt).today_total ?? 0,
        opdPatients: g(opdSt).total ?? g(opdSt).total_visits ?? 0,
        admissions: g(ipdSt).total_admissions ?? g(ipdSt).total ?? 0,
        bedOccupancy: g(ipdSt).bed_occupancy_pct,
        revenue: g(billSt).total_revenue ?? g(billSt).total ?? 0,
        pendingBills: g(billSt).pending_amount ?? 0,
        labOrders: g(labSt).total ?? 0,
        labPending: g(labSt).pending ?? 0,
        insClaims: insD.total ?? 0,
        insApproved: insD.approved ?? 0,
      });
      const trendD = g(apptSt).daily_trend || g(opdSt).daily_trend || [];
      setOpTrend(trendD.length ? trendD.map(d => ({ date: d.date, OPD: d.opd ?? d.count ?? 0, Appointments: d.appointments ?? d.total ?? 0 })) : (() => {
        const days = [];
        for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), OPD: 0, Appointments: 0 }); }
        return days;
      })());
      setRevTrend((g(billSt).daily_revenue || []).map(d => ({ date: d.date, Revenue: d.amount ?? d.revenue ?? 0 })));
      setDeptDist((g(opdSt).department_wise || g(apptSt).department_wise || []).map(d => ({ name: d.department || d.name, value: d.count || d.total })));
      const lb = g(labSt).status_breakdown || [];
      setLabStatus(lb.length ? lb : [{ name: 'Completed', value: g(labSt).completed ?? 0 }, { name: 'Pending', value: g(labSt).pending ?? 0 }, { name: 'In Progress', value: g(labSt).in_progress ?? 0 }]);
      setBedUtil((g(ipdSt).ward_wise || []).map(w => ({ ward: w.ward_name || w.name, Occupied: w.occupied ?? 0, Available: w.available ?? 0 })));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // ── Phase 2: Load detail records only for the active tab ─────────────────
  const loadTabData = useCallback(async (activeTab, forceDrp) => {
    const key = activeTab + (forceDrp || drp);
    if (loadedTabs.current.has(key)) return; // already loaded
    loadedTabs.current.add(key);
    setDetailLoading(true);
    const d = forceDrp || drp;
    try {
      if (activeTab === 'opd') {
        const [aRes, oRes] = await Promise.all([
          fetch(`${API}/appointments/?${d}&limit=500${hparam}`, { headers: hdrs() }).then(r => r.json()),
          fetch(`${API}/opd/?${d}&limit=500${hparam}`, { headers: hdrs() }).then(r => r.json()),
        ]);
        setApptRows(aRes.appointments || []);
        setOpdRows(oRes.visits || []);
      } else if (activeTab === 'ipd') {
        const res = await fetch(`${API}/ipd/admissions?${d}&limit=500${hparam}`, { headers: hdrs() }).then(r => r.json());
        setIpdRows(res.admissions || []);
      } else if (activeTab === 'billing') {
        const res = await fetch(`${API}/billing/bills?${d}&limit=500${hparam}`, { headers: hdrs() }).then(r => r.json());
        setBillingRows(res.bills || []);
      } else if (activeTab === 'lab') {
        const res = await fetch(`${API}/laboratory/orders?${d}&limit=500${hparam}`, { headers: hdrs() }).then(r => r.json());
        setLabRows(res.orders || []);
      } else if (activeTab === 'pharmacy') {
        const [from_, to_] = d.replace('date_from=', '').split('&date_to=');
        const res = await fetch(`${API}/pharmacy/bills?from_date=${from_}&to_date=${to_}&limit=500${hparam}`, { headers: hdrs() }).then(r => r.json());
        setPharmaRows(res.bills || []);
      } else if (activeTab === 'insurance') {
        const res = await fetch(`${API}/insurance/claims?${d}&limit=500${hparam}`, { headers: hdrs() }).then(r => r.json());
        setInsRows(res.claims || []);
      }
    } catch (e) { console.error(e); loadedTabs.current.delete(key); }
    setDetailLoading(false);
  }, [drp]);

  // Full refresh (Refresh button) - clear cache and reload everything
  const load = async () => {
    loadedTabs.current = new Set();
    setApptRows([]); setOpdRows([]); setIpdRows([]); setBillingRows([]);
    setLabRows([]); setPharmaRows([]); setInsRows([]);
    await loadStats();
    if (tab !== 'overview') await loadTabData(tab, drp);
  };

  // On mount: only load stats (fast)
  useEffect(() => { loadStats(); }, []);

  // When tab changes: lazy-load that tab's data
  useEffect(() => {
    if (tab !== 'overview') loadTabData(tab);
  }, [tab]);

  // Export CSV for current tab
  const handleExportCSV = () => {
    const map = {
      opd: { cols: [...apptCols.slice(0, -1), ...opdCols.slice(-2)], rows: [...apptRows, ...opdRows], name: 'OPD_Appointments' },
      appointments: { cols: apptCols, rows: apptRows, name: 'Appointments' },
      ipd: { cols: ipdCols, rows: ipdRows, name: 'IPD_Admissions' },
      billing: { cols: billCols, rows: billingRows, name: 'Billing_Revenue' },
      lab: { cols: labCols, rows: labRows, name: 'Laboratory' },
      pharmacy: { cols: pharmaBillCols, rows: pharmaRows, name: 'Pharmacy_Bills' },
      insurance: { cols: insCols, rows: insRows, name: 'Insurance_TPA' },
      overview: {
        cols: [{ h: 'Metric', k: '_m' }, { h: 'Value', k: '_v' }],
        rows: [
          { _m: 'Appointments', _v: stats.totalAppointments ?? 0 },
          { _m: 'OPD Patients', _v: stats.opdPatients ?? 0 },
          { _m: 'IPD Admissions', _v: stats.admissions ?? 0 },
          { _m: 'Bed Occupancy %', _v: stats.bedOccupancy ?? 0 },
          { _m: 'Total Revenue', _v: stats.revenue ?? 0 },
          { _m: 'Pending Bills', _v: stats.pendingBills ?? 0 },
          { _m: 'Lab Orders', _v: stats.labOrders ?? 0 },
          { _m: 'Insurance Claims', _v: stats.insClaims ?? 0 },
        ],
        name: 'Overview_Summary'
      },
    };
    const cfg = map[tab] || map.overview;
    downloadCSV(toCSV(cfg.cols, cfg.rows), `HIS_${cfg.name}_${from}_${to}.csv`);
  };

  const TABS = [
    { k: 'overview', l: 'Overview' },
    { k: 'opd', l: 'OPD / Appointments' },
    { k: 'ipd', l: 'IPD / Admissions' },
    { k: 'billing', l: 'Billing & Revenue' },
    { k: 'lab', l: 'Laboratory' },
    { k: 'pharmacy', l: 'Pharmacy' },
    { k: 'insurance', l: 'Insurance & TPA' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">MIS Reports</h1>
          <p className="text-gray-500 text-sm mt-0.5">Hospital Management Information System — Analytics &amp; Insights</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <span className="self-center text-gray-400 text-sm">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <button onClick={load} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition">
            <i className={`fas fa-sync mr-1.5 ${loading ? 'fa-spin' : ''}`} />Refresh
          </button>
          <button onClick={handleExportCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition">
            <i className="fas fa-file-csv mr-1.5" />Export CSV
          </button>
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition">
            <i className="fas fa-print mr-1.5" />Print
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition whitespace-nowrap ${tab === t.k ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Appointments" value={fmt(stats.totalAppointments)} icon="calendar-check" color="blue" sub={`${from} – ${to}`} />
            <KPICard label="OPD Patients" value={fmt(stats.opdPatients)} icon="hospital-user" color="green" />
            <KPICard label="Admissions" value={fmt(stats.admissions)} icon="bed" color="red" />
            <KPICard label="Bed Occupancy" value={stats.bedOccupancy != null ? `${stats.bedOccupancy}%` : '—'} icon="percent" color="purple" />
            <KPICard label="Total Revenue" value={fmtC(stats.revenue)} icon="rupee-sign" color="green" />
            <KPICard label="Pending Bills" value={fmtC(stats.pendingBills)} icon="file-invoice" color="yellow" />
            <KPICard label="Lab Orders" value={fmt(stats.labOrders)} icon="flask" color="teal" sub={`Pending: ${stats.labPending ?? 0}`} />
            <KPICard label="Insurance Claims" value={fmt(stats.insClaims)} icon="shield-alt" color="indigo" sub={`Approved: ${stats.insApproved ?? 0}`} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ChartCard title="Patient Flow Trend" icon="chart-line">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={opTrend}>
                  <defs>
                    <linearGradient id="opd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<Tip />} /><Legend />
                  <Area type="monotone" dataKey="OPD" stroke="#2563eb" fill="url(#opd)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Appointments" stroke="#10b981" fill="transparent" strokeWidth={2} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Department-wise Distribution" icon="chart-pie">
              {deptDist.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={deptDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {deptDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No department data</div>}
            </ChartCard>
          </div>
        </div>
      )}

      {/* ── OPD / Appointments ── */}
      {tab === 'opd' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Total Appointments" value={fmt(stats.totalAppointments)} icon="calendar-check" color="blue" />
            <KPICard label="OPD Visits" value={fmt(stats.opdPatients)} icon="hospital-user" color="green" />
            <KPICard label="Consultations Done" value={fmt(stats.opdPatients)} icon="stethoscope" color="purple" />
            <KPICard label="Avg. Wait Time" value="—" icon="hourglass-half" color="yellow" />
          </div>
          <ChartCard title="Daily Appointments & OPD Trend" icon="chart-area">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={opTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<Tip />} /><Legend />
                <Bar dataKey="Appointments" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="OPD" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Department-wise OPD Visits" icon="hospital">
            {deptDist.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={deptDist} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">No data for this period</div>}
          </ChartCard>
          <DataTable title="Appointment Records" icon="calendar-check" cols={apptCols} rows={apptRows} loading={detailLoading} />
          <DataTable title="OPD Visit Records" icon="hospital-user" cols={opdCols} rows={opdRows} loading={detailLoading} />
        </div>
      )}

      {/* ── IPD / Admissions ── */}
      {tab === 'ipd' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Total Admissions" value={fmt(stats.admissions)} icon="bed" color="red" />
            <KPICard label="Currently Admitted" value="—" icon="hospital" color="blue" />
            <KPICard label="Bed Occupancy" value={stats.bedOccupancy != null ? `${stats.bedOccupancy}%` : '—'} icon="percent" color="purple" />
            <KPICard label="Surgeries" value={fmt(stats.surgeries)} icon="procedures" color="yellow" />
          </div>
          <ChartCard title="Ward-wise Bed Utilisation" icon="bed">
            {bedUtil.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={bedUtil}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ward" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<Tip />} /><Legend />
                  <Bar dataKey="Occupied" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Available" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">No ward data for this period</div>}
          </ChartCard>
          <DataTable title="IPD Admission Records" icon="bed" cols={ipdCols} rows={ipdRows} loading={detailLoading} />
        </div>
      )}

      {/* ── Billing & Revenue ── */}
      {tab === 'billing' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Total Revenue" value={fmtC(stats.revenue)} icon="rupee-sign" color="green" />
            <KPICard label="Pending Amount" value={fmtC(stats.pendingBills)} icon="file-invoice" color="yellow" />
            <KPICard label="Paid Bills" value="—" icon="check-circle" color="blue" />
            <KPICard label="Insurance Claims" value={fmt(stats.insClaims)} icon="shield-alt" color="purple" />
          </div>
          <ChartCard title="Daily Revenue Trend" icon="chart-line">
            {revTrend.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revTrend}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                  <Tooltip content={<Tip />} />
                  <Area type="monotone" dataKey="Revenue" stroke="#10b981" fill="url(#rev)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">No revenue data for this period</div>}
          </ChartCard>
          <DataTable title="Hospital Billing Records" icon="file-invoice-dollar" cols={billCols} rows={billingRows} loading={detailLoading} />
        </div>
      )}

      {/* ── Laboratory ── */}
      {tab === 'lab' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Total Lab Orders" value={fmt(stats.labOrders)} icon="flask" color="teal" />
            <KPICard label="Pending Reports" value={fmt(stats.labPending)} icon="hourglass-half" color="yellow" />
            <KPICard label="Completed" value="—" icon="check-circle" color="green" />
            <KPICard label="TAT (Avg)" value="—" icon="clock" color="blue" sub="Turnaround time" />
          </div>
          <ChartCard title="Lab Order Status Breakdown" icon="chart-pie">
            {labStatus.some(s => s.value > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={labStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {labStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">No lab data for this period</div>}
          </ChartCard>
          <DataTable title="Lab Order Records" icon="flask" cols={labCols} rows={labRows} loading={detailLoading} />
        </div>
      )}

      {/* ── Pharmacy ── */}
      {tab === 'pharmacy' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Pharmacy Bills" value={fmt(pharmaRows.length)} icon="receipt" color="blue" />
            <KPICard label="Low Stock Items" value={fmt(stats.pharmaLowStock)} icon="exclamation-triangle" color="red" />
            <KPICard label="Total Billed" value={fmtC(pharmaRows.reduce((s, b) => s + (b.net_payable ?? 0), 0))} icon="rupee-sign" color="green" />
            <KPICard label="Expiring Soon" value="—" icon="calendar-times" color="yellow" />
          </div>
          <ChartCard title="Top Dispensed Medicines" icon="pills">
            {pharmaTop.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={pharmaTop} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="dispensed" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">No pharmacy data for this period</div>}
          </ChartCard>
          <DataTable title="Pharmacy Billing Records" icon="pills" cols={pharmaBillCols} rows={pharmaRows} loading={detailLoading} />
        </div>
      )}

      {/* ── Insurance & TPA ── */}
      {tab === 'insurance' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Total Claims" value={fmt(insStats.total)} icon="shield-alt" color="indigo" />
            <KPICard label="Approved" value={fmt(insStats.approved)} icon="check-circle" color="green" />
            <KPICard label="Submitted" value={fmt(insStats.submitted)} icon="paper-plane" color="blue" />
            <KPICard label="Rejected" value={fmt(insStats.rejected)} icon="times-circle" color="red" />
            <KPICard label="Total Claimed" value={fmtC(insStats.total_claimed)} icon="rupee-sign" color="purple" />
            <KPICard label="Total Approved" value={fmtC(insStats.total_approved_amount)} icon="hand-holding-usd" color="green" />
            <KPICard label="Settled" value={fmt(insStats.settled)} icon="check-double" color="teal" />
            <KPICard label="Active Companies" value={fmt(insStats.companies)} icon="building" color="yellow" />
          </div>
          {(insStats.total ?? 0) > 0 && (
            <ChartCard title="Claim Status Distribution" icon="chart-pie">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Approved', value: insStats.approved ?? 0 },
                      { name: 'Submitted', value: insStats.submitted ?? 0 },
                      { name: 'Rejected', value: insStats.rejected ?? 0 },
                      { name: 'Settled', value: insStats.settled ?? 0 },
                    ].filter(d => d.value > 0)}
                    dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
          <DataTable title="Insurance Claim Records" icon="shield-alt" cols={insCols} rows={insRows} loading={detailLoading} />
        </div>
      )}
    </div>
  );
}
