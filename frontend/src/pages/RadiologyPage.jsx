import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'https://cubehis.avopay.pro:5000/api/radiology';
const STATUS_COLORS = { 'Sample Pending': 'bg-yellow-100 text-yellow-700', Scheduled: 'bg-blue-100 text-blue-700', Processing: 'bg-indigo-100 text-indigo-700', Completed: 'bg-green-100 text-green-700', Cancelled: 'bg-red-100 text-red-700' };
const MODALITIES = ['X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'PET Scan', 'Fluoroscopy', 'Mammography', 'Bone Densitometry'];

export default function RadiologyPage() {
  const [orders, setOrders] = useState([]);
  const [tests, setTests] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');
  const [showTestModal, setShowTestModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(null);
  const [testForm, setTestForm] = useState({ test_name: '', modality: 'X-Ray', body_part: '', price: '', turnaround_hours: 4, preparation_instructions: '' });
  const [orderForm, setOrderForm] = useState({ patient_name: '', mrn: '', doctor_name: '', department: 'General Medicine', test_id: '', urgent: false, clinical_notes: '', scheduled_time: '' });
  const [resultData, setResultData] = useState({ findings: '', impression: '', report_text: '', radiologist_name: '' });
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ status: '', modality: '', date_filter: new Date().toISOString().split('T')[0] });

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.modality) params.set('modality', filters.modality);
      if (filters.date_filter) params.set('date_filter', filters.date_filter); else params.set('date_filter', 'all');
      const [oRes, tRes, sRes] = await Promise.all([
        fetch(`${API}/orders?${params}`, { headers }),
        fetch(`${API}/tests`, { headers }),
        fetch(`${API}/stats`, { headers }),
      ]);
      const [oData, tData, sData] = await Promise.all([oRes.json(), tRes.json(), sRes.json()]);
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
      setTestForm({ test_name: '', modality: 'X-Ray', body_part: '', price: '', turnaround_hours: 4, preparation_instructions: '' });
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/orders`, { method: 'POST', headers, body: JSON.stringify(orderForm) });
      setShowOrderModal(false);
      setOrderForm({ patient_name: '', mrn: '', doctor_name: '', department: 'General Medicine', test_id: '', urgent: false, clinical_notes: '', scheduled_time: '' });
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const submitResult = async () => {
    await fetch(`${API}/orders/${showResultModal.id}/result`, { method: 'PATCH', headers, body: JSON.stringify(resultData) });
    setShowResultModal(null);
    setResultData({ findings: '', impression: '', report_text: '', radiologist_name: '' });
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Radiology</h1>
          <p className="text-gray-500 text-sm mt-1">Imaging orders, modalities & report management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowOrderModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition text-sm">
            <i className="fas fa-x-ray" /> New Order
          </button>
          <button onClick={() => setShowTestModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-white border text-blue-600 rounded-lg hover:bg-blue-50 font-medium shadow transition text-sm">
            <i className="fas fa-plus" /> Add Modality
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending / Scheduled', value: stats.pending ?? '—', icon: 'hourglass-half', color: 'yellow' },
          { label: 'Processing', value: stats.processing ?? '—', icon: 'spinner', color: 'blue' },
          { label: 'Completed Today', value: stats.completed ?? '—', icon: 'check-circle', color: 'green' },
          { label: 'Urgent Orders', value: stats.urgent ?? '—', icon: 'exclamation-triangle', color: 'red' },
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

      {/* Modality Quick Stats */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {MODALITIES.map((m, i) => (
          <button key={m} onClick={() => setFilters(f => ({ ...f, modality: f.modality === m ? '' : m }))}
            className={`rounded-xl p-3 text-center text-xs font-medium shadow transition border ${filters.modality === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:border-blue-300'}`}>
            <div className="text-lg mb-1">
              {['📷', '🖥️', '🧲', '🔊', '☢️', '📡', '🩺', '🦴'][i] || '🔬'}
            </div>
            {m}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[{ key: 'orders', label: 'Orders', icon: 'list' }, { key: 'tests', label: 'Radiology Catalogue', icon: 'x-ray' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${activeTab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-blue-600'}`}>
            <i className={`fas fa-${t.icon} mr-1.5`} />{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'orders' && (
        <>
          <div className="bg-white rounded-xl shadow p-4 flex gap-3 flex-wrap">
            <input type="date" value={filters.date_filter} onChange={e => setFilters(f => ({ ...f, date_filter: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button onClick={() => setFilters(f => ({ ...f, date_filter: '' }))} className="px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">All Records</button>
            <button onClick={() => setFilters(f => ({ ...f, date_filter: new Date().toISOString().split('T')[0] }))} className="px-3 py-2 text-sm rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700">Today</button>
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">All Status</option>
              {['Scheduled', 'Processing', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-blue-50">
                  <tr>
                    {['Order No', 'MR No.', 'Patient', 'Test / Modality', 'Doctor', 'Scheduled', 'Amount', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                  ) : orders.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-400">No radiology orders</td></tr>
                  ) : orders.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{o.order_number}</td>
                      <td className="px-4 py-3">
                        {o.mrn ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-50 border border-teal-200 font-mono text-xs font-bold text-teal-700">{o.mrn}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{o.patient_name}</div>
                        {o.urgent && <span className="text-xs text-red-500 font-bold">⚡ URGENT</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{o.test_name}</div>
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{o.modality}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{o.doctor_name}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{o.scheduled_time ? new Date(o.scheduled_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }) : '—'}</td>
                      <td className="px-4 py-3 font-medium text-green-700">₹{o.amount}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        {o.status !== 'Completed' && (
                          <button onClick={() => setShowResultModal(o)} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">Submit Report</button>
                        )}
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
                  {['Test Name', 'Modality', 'Body Part', 'Price', 'Preparation', 'TAT (hrs)'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tests.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">No radiology tests configured</td></tr>
                ) : tests.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{t.test_name}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs bg-indigo-100 text-indigo-700">{t.modality}</span></td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{t.body_part || '—'}</td>
                    <td className="px-4 py-3 font-bold text-green-700">₹{t.price}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{t.preparation_instructions || '—'}</td>
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
                <h2 className="text-lg font-bold text-blue-800">Add Radiology Test</h2>
                <button onClick={() => setShowTestModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleAddTest} className="p-6 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Test Name <span className="text-red-500">*</span></label>
                  <input required value={testForm.test_name} onChange={e => setTestForm(p => ({ ...p, test_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Modality</label>
                  <select value={testForm.modality} onChange={e => setTestForm(p => ({ ...p, modality: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {MODALITIES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Body Part</label>
                  <input value={testForm.body_part} onChange={e => setTestForm(p => ({ ...p, body_part: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Price (₹) <span className="text-red-500">*</span></label>
                  <input required type="number" value={testForm.price} onChange={e => setTestForm(p => ({ ...p, price: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">TAT (hours)</label>
                  <input type="number" value={testForm.turnaround_hours} onChange={e => setTestForm(p => ({ ...p, turnaround_hours: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Preparation Instructions</label>
                  <textarea rows={2} value={testForm.preparation_instructions} onChange={e => setTestForm(p => ({ ...p, preparation_instructions: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="col-span-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowTestModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving...' : 'Add Test'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Order Modal */}
      <AnimatePresence>
        {showOrderModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800">New Radiology Order</h2>
                <button onClick={() => setShowOrderModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleCreateOrder} className="p-6 grid grid-cols-2 gap-4">
                {[
                  { label: 'Patient Name', key: 'patient_name', required: true },
                  { label: 'MRN', key: 'mrn' },
                  { label: 'Doctor Name', key: 'doctor_name', required: true },
                  { label: 'Department', key: 'department' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
                    <input type="text" required={f.required} value={orderForm[f.key]} onChange={e => setOrderForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Select Test <span className="text-red-500">*</span></label>
                  <select required value={orderForm.test_id} onChange={e => setOrderForm(p => ({ ...p, test_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">-- Select Radiology Test --</option>
                    {tests.map(t => <option key={t.id} value={t.id}>{t.test_name} ({t.modality}) — ₹{t.price}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Time</label>
                  <input type="datetime-local" value={orderForm.scheduled_time} onChange={e => setOrderForm(p => ({ ...p, scheduled_time: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={orderForm.urgent} onChange={e => setOrderForm(p => ({ ...p, urgent: e.target.checked }))} className="rounded" />
                    <span className="text-red-600 font-medium">⚡ Urgent</span>
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Clinical Notes</label>
                  <textarea rows={2} value={orderForm.clinical_notes} onChange={e => setOrderForm(p => ({ ...p, clinical_notes: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="col-span-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowOrderModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Creating...' : 'Create Order'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Entry Modal */}
      <AnimatePresence>
        {showResultModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-green-50">
                <h2 className="text-lg font-bold text-green-800">Submit Report — {showResultModal.patient_name}</h2>
                <button onClick={() => setShowResultModal(null)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-blue-50 text-sm rounded-lg p-3 text-blue-800">
                  <strong>{showResultModal.test_name}</strong> ({showResultModal.modality}) — Order: {showResultModal.order_number}
                </div>
                {[
                  { label: 'Findings', key: 'findings', rows: 3 },
                  { label: 'Impression', key: 'impression', rows: 2 },
                  { label: 'Full Report', key: 'report_text', rows: 3 },
                  { label: 'Radiologist Name', key: 'radiologist_name', rows: 1 },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                    {f.rows === 1 ? (
                      <input value={resultData[f.key]} onChange={e => setResultData(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                    ) : (
                      <textarea rows={f.rows} value={resultData[f.key]} onChange={e => setResultData(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                    )}
                  </div>
                ))}
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowResultModal(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button onClick={submitResult} className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Submit Report</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
