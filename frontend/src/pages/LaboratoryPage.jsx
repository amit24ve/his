import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DoctorSearchInput from '../components/DoctorSearchInput';

const API = 'https://cubehis.avopay.pro:5000/api/laboratory';
const CATEGORIES = ['Haematology', 'Biochemistry', 'Microbiology', 'Serology', 'Histopathology', 'Cytology', 'Urine Analysis', 'Hormones', 'Tumour Markers', 'Immunology'];
const STATUS_COLORS = { 'Sample Pending': 'bg-yellow-100 text-yellow-700', Processing: 'bg-blue-100 text-blue-700', Completed: 'bg-green-100 text-green-700', Cancelled: 'bg-red-100 text-red-700' };

export default function LaboratoryPage() {
  const [orders, setOrders] = useState([]);
  const [tests, setTests] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');
  const [showTestModal, setShowTestModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [testForm, setTestForm] = useState({ test_name: '', test_code: '', category: 'Haematology', price: '', normal_range: '', unit: '', turnaround_hours: 24 });
  const [orderForm, setOrderForm] = useState({ patient_name: '', mrn: '', doctor_name: '', department: 'General Medicine', tests: [], urgent: false, sample_type: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [resultModal, setResultModal] = useState(null);
  const [resultData, setResultData] = useState({ results: [{ test_name: '', value: '', unit: '', normal_range: '', flag: 'Normal' }], technician_name: '', remarks: '' });
  const [filters, setFilters] = useState({ status: '', urgent: '', date_filter: new Date().toISOString().split('T')[0] });

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.date_filter) params.set('date_filter', filters.date_filter); else params.set('date_filter', 'all');
      const [oRes, tRes, sRes] = await Promise.all([
        fetch(`${API}/orders?${params}`, { headers }),
        fetch(`${API}/tests`, { headers }),
        fetch(`${API}/stats`, { headers }),
      ]);
      const oData = await oRes.json();
      const tData = await tRes.json();
      const sData = await sRes.json();
      setOrders(oData.orders || []);
      setTests(Array.isArray(tData) ? tData : []);
      setStats(sData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);

  const handleAddTest = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/tests`, { method: 'POST', headers, body: JSON.stringify({ ...testForm, price: parseFloat(testForm.price), turnaround_hours: parseInt(testForm.turnaround_hours) }) });
      setShowTestModal(false);
      setTestForm({ test_name: '', test_code: '', category: 'Haematology', price: '', normal_range: '', unit: '', turnaround_hours: 24 });
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (orderForm.tests.length === 0) { alert('Select at least one test'); return; }
    setSaving(true);
    try {
      await fetch(`${API}/orders`, { method: 'POST', headers, body: JSON.stringify(orderForm) });
      setShowOrderModal(false);
      setOrderForm({ patient_name: '', mrn: '', doctor_name: '', department: 'General Medicine', tests: [], urgent: false, sample_type: '', notes: '' });
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const submitResults = async () => {
    await fetch(`${API}/orders/${resultModal.id}/results`, { method: 'PATCH', headers, body: JSON.stringify(resultData) });
    setResultModal(null);
    setResultData({ results: [{ test_name: '', value: '', unit: '', normal_range: '', flag: 'Normal' }], technician_name: '', remarks: '' });
    load();
  };

  const toggleTest = (testId) => {
    setOrderForm(f => ({ ...f, tests: f.tests.includes(testId) ? f.tests.filter(t => t !== testId) : [...f.tests, testId] }));
  };

  const printLabReport = (order) => {
    const win = window.open('', '_blank');
    const resultRows = (order.results || []).map(r => `
      <tr>
        <td style="padding:6px 10px;border:1px solid #ddd;">${r.test_name || '—'}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:bold;">${r.value || '—'} ${r.unit || ''}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;">${r.normal_range || '—'}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;color:${r.flag === 'High' ? '#dc2626' : r.flag === 'Low' ? '#2563eb' : '#15803d'};">${r.flag || 'Normal'}</td>
      </tr>
    `).join('');
    win.document.write(`
      <html><head><title>Lab Report</title>
      <style>body{font-family:Arial,sans-serif;margin:20px;font-size:13px;} h2{color:#1e40af;text-align:center;} table{width:100%;border-collapse:collapse;} th{background:#eff6ff;color:#1e40af;padding:8px;border:1px solid #ddd;text-align:left;} hr{border:1px solid #1e40af;margin:10px 0;}</style>
      </head><body>
      <h2>CubeMed HIS — LAB REPORT</h2>
      <hr/>
      <table style="margin-bottom:10px;">
        <tr><td><b>Order No:</b> ${order.order_number || '—'}</td><td><b>Date:</b> ${order.ordered_at ? new Date(order.ordered_at).toLocaleDateString('en-IN') : '—'}</td></tr>
        <tr><td><b>Patient:</b> ${order.patient_name || '—'}</td><td><b>MRN:</b> ${order.mrn || '—'}</td></tr>
        <tr><td><b>Referring Doctor:</b> ${order.doctor_name || '—'}</td><td><b>Department:</b> ${order.department || '—'}</td></tr>
        <tr><td><b>Sample Type:</b> ${order.sample_type || '—'}</td><td><b>Urgent:</b> ${order.urgent ? 'Yes' : 'No'}</td></tr>
        ${order.technician_name ? `<tr><td colspan="2"><b>Technician:</b> ${order.technician_name}</td></tr>` : ''}
      </table>
      <hr/>
      <h3>Test Results</h3>
      ${resultRows ? `
      <table>
        <thead><tr><th>Test Name</th><th>Result</th><th>Reference Range</th><th>Flag</th></tr></thead>
        <tbody>${resultRows}</tbody>
      </table>` : '<p>Results not yet available</p>'}
      ${order.remarks ? `<p style="margin-top:10px;"><b>Remarks:</b> ${order.remarks}</p>` : ''}
      <p style="margin-top:30px;font-size:11px;color:#666;text-align:center;">Generated by CubeMed HIS — ${new Date().toLocaleString()}</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const exportLabCSV = () => {
    const rows = [
      ['Order No', 'Date', 'Patient', 'MRN', 'Doctor', 'Department', 'Tests', 'Total', 'Status', 'Urgent'],
      ...orders.map(o => [o.order_number, o.ordered_at ? new Date(o.ordered_at).toLocaleDateString('en-IN') : '', o.patient_name, o.mrn, o.doctor_name, o.department, o.tests?.length || 0, o.total_amount, o.status, o.urgent ? 'Yes' : 'No'])
    ];
    const csv = rows.map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'lab_orders.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Laboratory Management</h1>
          <p className="text-gray-500 text-sm mt-1">Lab orders, tests & result reporting</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportLabCSV} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow transition text-sm">
            <i className="fas fa-file-csv" /> Export CSV
          </button>
          <button onClick={() => setShowOrderModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition text-sm">
            <i className="fas fa-flask" /> New Order
          </button>
          <button onClick={() => setShowTestModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-white border text-blue-600 rounded-lg hover:bg-blue-50 font-medium shadow transition text-sm">
            <i className="fas fa-plus" /> Add Test
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Sample Pending', value: stats.pending ?? '—', icon: 'hourglass-half', color: 'yellow' },
          { label: 'Processing', value: stats.processing ?? '—', icon: 'cogs', color: 'blue' },
          { label: 'Completed', value: stats.completed ?? '—', icon: 'check-circle', color: 'green' },
          { label: 'Urgent Pending', value: stats.urgent_pending ?? '—', icon: 'exclamation-circle', color: 'red' },
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
        {[{ key: 'orders', label: "Today's Orders", icon: 'list' }, { key: 'tests', label: 'Test Catalogue', icon: 'flask' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${activeTab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-blue-600'}`}>
            <i className={`fas fa-${t.icon} mr-1.5`} />{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'orders' && (
        <>
          <div className="bg-white rounded-xl shadow p-4 flex gap-3 flex-wrap items-center">
            <input type="date" value={filters.date_filter} onChange={e => setFilters(f => ({ ...f, date_filter: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button onClick={() => setFilters(f => ({ ...f, date_filter: '' }))} className="px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">All Records</button>
            <button onClick={() => setFilters(f => ({ ...f, date_filter: new Date().toISOString().split('T')[0] }))} className="px-3 py-2 text-sm rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700">Today</button>
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">All Status</option>
              {['Sample Pending', 'Processing', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filters.urgent} onChange={e => setFilters(f => ({ ...f, urgent: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">All Orders</option>
              <option value="yes">Urgent Only</option>
              <option value="no">Non-Urgent</option>
            </select>
            <input type="text" placeholder="Search patient / MRN..." value={filters.search || ''} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-52 ml-auto" />
          </div>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-blue-50">
                  <tr>
                    {['Order No', 'MR No.', 'Patient', 'Doctor', 'Tests', 'Total', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={8} className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                  ) : orders.filter(o => {
                    if (filters.urgent === 'yes' && !o.urgent) return false;
                    if (filters.urgent === 'no' && o.urgent) return false;
                    if (filters.search && !o.patient_name?.toLowerCase().includes(filters.search.toLowerCase()) && !o.mrn?.toLowerCase().includes(filters.search.toLowerCase())) return false;
                    return true;
                  }).length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-gray-400">No orders found</td></tr>
                  ) : orders.filter(o => {
                    if (filters.urgent === 'yes' && !o.urgent) return false;
                    if (filters.urgent === 'no' && o.urgent) return false;
                    if (filters.search && !o.patient_name?.toLowerCase().includes(filters.search.toLowerCase()) && !o.mrn?.toLowerCase().includes(filters.search.toLowerCase())) return false;
                    return true;
                  }).map(o => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{o.order_number}</td>
                      <td className="px-4 py-3">
                        {o.mrn ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-50 border border-teal-200 font-mono text-xs font-bold text-teal-700">{o.mrn}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{o.patient_name}</div>
                        {o.urgent && <span className="text-xs text-red-500 font-bold">⚡ URGENT</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{o.doctor_name}</td>
                      <td className="px-4 py-3 text-gray-600">{o.tests?.length || 0} tests</td>
                      <td className="px-4 py-3 font-medium text-green-700">₹{o.total_amount}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => printLabReport(o)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200" title="Print Report">
                            <i className="fas fa-print" />
                          </button>
                          {o.status !== 'Completed' && (
                            <button onClick={() => setResultModal(o)} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition">Results</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'tests' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-blue-50">
                <tr>
                  {['Test Name', 'Code', 'Category', 'Price', 'Normal Range', 'Unit', 'TAT (hrs)'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tests.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">No tests configured</td></tr>
                ) : tests.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{t.test_name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-blue-600">{t.test_code || '—'}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">{t.category}</span></td>
                    <td className="px-4 py-3 font-medium text-green-700">₹{t.price}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.normal_range || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.unit || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{t.turnaround_hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Test Modal */}
      <AnimatePresence>
        {showTestModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800">Add Lab Test</h2>
                <button onClick={() => setShowTestModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleAddTest} className="p-6 grid grid-cols-2 gap-4">
                {[
                  { label: 'Test Name', key: 'test_name', required: true, span: 2 },
                  { label: 'Test Code', key: 'test_code' },
                  { label: 'Price (₹)', key: 'price', type: 'number', required: true },
                  { label: 'Normal Range', key: 'normal_range' },
                  { label: 'Unit (e.g. mg/dL)', key: 'unit' },
                  { label: 'TAT (hours)', key: 'turnaround_hours', type: 'number' },
                ].map(f => (
                  <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
                    <input type={f.type || 'text'} required={f.required} value={testForm[f.key]} onChange={e => setTestForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select value={testForm.category} onChange={e => setTestForm(p => ({ ...p, category: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2 flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowTestModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                    {saving ? 'Saving...' : 'Add Test'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Order Modal */}
      <AnimatePresence>
        {showOrderModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800">New Lab Order</h2>
                <button onClick={() => setShowOrderModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleCreateOrder} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Patient Name', key: 'patient_name', required: true },
                    { label: 'MRN', key: 'mrn' },
                    { label: 'Department', key: 'department' },
                    { label: 'Sample Type', key: 'sample_type' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
                      <input type="text" required={f.required} value={orderForm[f.key]} onChange={e => setOrderForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Doctor Name<span className="text-red-500">*</span></label>
                    <DoctorSearchInput
                      required
                      value={orderForm.doctor_name}
                      onChange={(name) => setOrderForm(p => ({ ...p, doctor_name: name }))}
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={orderForm.urgent} onChange={e => setOrderForm(p => ({ ...p, urgent: e.target.checked }))} className="rounded" />
                      <span className="text-red-600 font-medium">⚡ Urgent</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Select Tests ({orderForm.tests.length} selected)</label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {tests.map(t => (
                      <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-blue-50 rounded p-1">
                        <input type="checkbox" checked={orderForm.tests.includes(t.id)} onChange={() => toggleTest(t.id)} className="rounded text-blue-600" />
                        <span className="truncate">{t.test_name}</span>
                        <span className="text-xs text-green-600 ml-auto">₹{t.price}</span>
                      </label>
                    ))}
                    {tests.length === 0 && <div className="col-span-2 text-center text-gray-400 py-4 text-sm">No tests available. Add tests first.</div>}
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowOrderModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                    {saving ? 'Creating...' : 'Create Order'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Entry Modal */}
      <AnimatePresence>
        {resultModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-green-50">
                <h2 className="text-lg font-bold text-green-800">Enter Lab Results — {resultModal.patient_name}</h2>
                <button onClick={() => setResultModal(null)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <div className="p-6 space-y-4">
                {resultData.results.map((r, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-3">
                    {[
                      { label: 'Test Name', key: 'test_name' },
                      { label: 'Value', key: 'value' },
                      { label: 'Unit', key: 'unit' },
                      { label: 'Normal Range', key: 'normal_range' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                        <input type="text" value={r[f.key]} onChange={e => {
                          const updated = [...resultData.results];
                          updated[idx][f.key] = e.target.value;
                          setResultData(p => ({ ...p, results: updated }));
                        }} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-400" />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Flag</label>
                      <select value={r.flag} onChange={e => {
                        const updated = [...resultData.results];
                        updated[idx].flag = e.target.value;
                        setResultData(p => ({ ...p, results: updated }));
                      }} className="w-full border rounded px-2 py-1.5 text-sm">
                        <option>Normal</option><option>High</option><option>Low</option><option>Critical</option>
                      </select>
                    </div>
                  </div>
                ))}
                <button onClick={() => setResultData(p => ({ ...p, results: [...p.results, { test_name: '', value: '', unit: '', normal_range: '', flag: 'Normal' }] }))}
                  className="text-sm text-blue-600 hover:underline"><i className="fas fa-plus mr-1" />Add Another Result</button>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Technician Name</label>
                    <input value={resultData.technician_name} onChange={e => setResultData(p => ({ ...p, technician_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                    <input value={resultData.remarks} onChange={e => setResultData(p => ({ ...p, remarks: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setResultModal(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button onClick={submitResults} className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Submit Results</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
