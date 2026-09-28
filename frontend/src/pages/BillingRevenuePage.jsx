import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'https://cubehis.avopay.pro:5000/api/billing';
const STATUS_COLORS = { Paid: 'bg-green-100 text-green-700', Partial: 'bg-yellow-100 text-yellow-700', Pending: 'bg-red-100 text-red-700' };

export default function BillingRevenuePage() {
  const [bills, setBills] = useState([]);
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bills');
  const [showBillModal, setShowBillModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [billForm, setBillForm] = useState({ patient_name: '', mrn: '', visit_type: 'OPD', doctor_name: '', department: '', items: [], discount_percent: 0, advance_paid: 0, payment_mode: 'Cash', patient_category: 'PRIVATE' });
  const [serviceForm, setServiceForm] = useState({ service_name: '', service_code: '', category: 'Consultation', price: '', gst_percent: 0 });
  const [saving, setSaving] = useState(false);
  const [paymentModal, setPaymentModal] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [filters, setFilters] = useState({ date_filter: new Date().toISOString().split('T')[0], payment_status: '' });
  const [search, setSearch] = useState('');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.date_filter) params.set('date_filter', filters.date_filter);
      if (filters.payment_status) params.set('payment_status', filters.payment_status);
      if (search) params.set('search', search);
      const [bRes, sRes, stRes] = await Promise.all([
        fetch(`${API}/bills?${params}`, { headers }),
        fetch(`${API}/services`, { headers }),
        fetch(`${API}/stats`, { headers }),
      ]);
      const bData = await bRes.json();
      const sData = await sRes.json();
      const stData = await stRes.json();
      setBills(bData.bills || []);
      setServices(Array.isArray(sData) ? sData : []);
      setStats(stData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);

  const addBillItem = (service) => {
    setBillForm(f => ({ ...f, items: [...f.items, { service_name: service.service_name, quantity: 1, unit_price: service.price, gst_percent: service.gst_percent || 0 }] }));
  };

  const removeBillItem = (idx) => setBillForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const billTotal = billForm.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const handleCreateBill = async (e) => {
    e.preventDefault();
    if (billForm.items.length === 0) { alert('Add at least one service item'); return; }
    setSaving(true);
    try {
      await fetch(`${API}/bills`, { method: 'POST', headers, body: JSON.stringify({ ...billForm, discount_percent: parseFloat(billForm.discount_percent) || 0, advance_paid: parseFloat(billForm.advance_paid) || 0 }) });
      setShowBillModal(false);
      setBillForm({ patient_name: '', mrn: '', visit_type: 'OPD', doctor_name: '', department: '', items: [], discount_percent: 0, advance_paid: 0, payment_mode: 'Cash', patient_category: 'PRIVATE' });
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/services`, { method: 'POST', headers, body: JSON.stringify({ ...serviceForm, price: parseFloat(serviceForm.price), gst_percent: parseFloat(serviceForm.gst_percent) || 0 }) });
      setShowServiceModal(false);
      setServiceForm({ service_name: '', service_code: '', category: 'Consultation', price: '', gst_percent: 0 });
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handlePayment = async () => {
    if (!payAmount) return;
    await fetch(`${API}/bills/${paymentModal.id}/payment?amount=${payAmount}&payment_mode=${payMode}`, { method: 'PATCH', headers });
    setPaymentModal(null);
    setPayAmount('');
    load();
  };

  const printBillReceipt = (bill) => {
    const win = window.open('', '_blank');
    const itemRows = (bill.items || []).map(item => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #ddd;">${item.service_name || item.name || '—'}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">${item.quantity || 1}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">₹${item.unit_price || item.amount || 0}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">₹${((item.quantity || 1) * (item.unit_price || item.amount || 0)).toFixed(2)}</td>
      </tr>
    `).join('');
    win.document.write(`
      <html><head><title>Bill Receipt</title>
      <style>body{font-family:Arial,sans-serif;margin:20px;font-size:13px;} h2{color:#1e40af;text-align:center;} table{width:100%;border-collapse:collapse;} th{background:#eff6ff;color:#1e40af;padding:8px;border:1px solid #ddd;text-align:left;} .total-row td{font-weight:bold;background:#f9fafb;} hr{border:1px solid #1e40af;margin:10px 0;}</style>
      </head><body>
      <h2>CubeMed HIS — BILL RECEIPT</h2>
      <hr/>
      <table style="margin-bottom:10px;">
        <tr><td><b>Bill No:</b> ${bill.bill_number || '—'}</td><td><b>Date:</b> ${bill.created_at ? new Date(bill.created_at).toLocaleDateString('en-IN') : '—'}</td></tr>
        <tr><td><b>Patient:</b> ${bill.patient_name || '—'}</td><td><b>MRN:</b> ${bill.mrn || '—'}</td></tr>
        <tr><td><b>Doctor:</b> ${bill.doctor_name || '—'}</td><td><b>Visit Type:</b> ${bill.visit_type || '—'}</td></tr>
        <tr><td><b>Department:</b> ${bill.department || '—'}</td><td><b>Category:</b> ${bill.patient_category || '—'}</td></tr>
      </table>
      <hr/>
      <table>
        <thead><tr><th>Service</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
        <tbody>${itemRows || '<tr><td colspan="4" style="text-align:center;padding:10px;">No items</td></tr>'}</tbody>
      </table>
      <hr/>
      <table style="margin-top:8px;width:50%;margin-left:auto;">
        <tr><td>Gross Total:</td><td style="text-align:right;">₹${bill.gross_total || 0}</td></tr>
        <tr><td>Discount:</td><td style="text-align:right;color:red;">-₹${bill.discount_amount || 0}</td></tr>
        <tr class="total-row"><td><b>Net Amount:</b></td><td style="text-align:right;color:#15803d;"><b>₹${bill.net_amount || 0}</b></td></tr>
        <tr><td>Amount Paid:</td><td style="text-align:right;">₹${bill.amount_paid || 0}</td></tr>
        <tr class="total-row"><td><b>Balance Due:</b></td><td style="text-align:right;color:#dc2626;"><b>₹${bill.balance_due || 0}</b></td></tr>
      </table>
      <hr/>
      <p style="text-align:center;margin-top:20px;font-size:11px;color:#666;">Payment Mode: ${bill.payment_mode || '—'} | Status: ${bill.payment_status || '—'}</p>
      <p style="text-align:center;font-size:11px;color:#666;">Thank you for choosing CubeMed HIS. Get well soon!</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const exportBillsCSV = () => {
    const rows = [
      ['Bill No', 'Date', 'Patient', 'MRN', 'Doctor', 'Visit Type', 'Department', 'Gross Total', 'Discount', 'Net Amount', 'Amount Paid', 'Balance Due', 'Payment Status'],
      ...bills.map(b => [b.bill_number, b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : '', b.patient_name, b.mrn, b.doctor_name, b.visit_type, b.department, b.gross_total, b.discount_amount || 0, b.net_amount, b.amount_paid || 0, b.balance_due, b.payment_status])
    ];
    const csv = rows.map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'bills_report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Billing & Revenue</h1>
          <p className="text-gray-500 text-sm mt-1">Hospital billing, payments & revenue tracking</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportBillsCSV} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow transition text-sm">
            <i className="fas fa-file-csv" /> Export CSV
          </button>
          <button onClick={() => setShowBillModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition text-sm">
            <i className="fas fa-file-invoice" /> New Bill
          </button>
          <button onClick={() => setShowServiceModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-white border text-blue-600 rounded-lg hover:bg-blue-50 font-medium shadow transition text-sm">
            <i className="fas fa-plus" /> Add Service
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today's Bills", value: stats.today_bills ?? '—', icon: 'file-invoice', color: 'blue' },
          { label: "Today's Revenue", value: stats.today_revenue ? `₹${stats.today_revenue.toLocaleString()}` : '—', icon: 'rupee-sign', color: 'green' },
          { label: 'Collected', value: stats.today_collected ? `₹${stats.today_collected.toLocaleString()}` : '—', icon: 'hand-holding-usd', color: 'teal' },
          { label: 'Pending Dues', value: stats.pending_dues_count ?? '—', icon: 'clock', color: 'red' },
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
        {[{ key: 'bills', label: 'Bills', icon: 'file-invoice' }, { key: 'services', label: 'Services & Charges', icon: 'list-alt' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${activeTab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-blue-600'}`}>
            <i className={`fas fa-${t.icon} mr-1.5`} />{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'bills' && (
        <>
          <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3">
            <input type="date" value={filters.date_filter} onChange={e => setFilters(f => ({ ...f, date_filter: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button onClick={() => setFilters(f => ({ ...f, date_filter: '' }))} className="px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">All Records</button>
            <button onClick={() => setFilters(f => ({ ...f, date_filter: new Date().toISOString().split('T')[0] }))} className="px-3 py-2 text-sm rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700">Today</button>
            <select value={filters.payment_status} onChange={e => setFilters(f => ({ ...f, payment_status: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">All Payment Status</option>
              <option>Paid</option><option>Partial</option><option>Pending</option>
            </select>
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ml-auto w-48" />
          </div>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-blue-50">
                  <tr>
                    {['Bill No', 'MR No.', 'Patient', 'Visit Type', 'Gross Total', 'Discount', 'Net Amount', 'Balance Due', 'Payment', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-blue-700 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={10} className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                  ) : bills.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-10 text-gray-400">No bills found</td></tr>
                  ) : bills.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 font-mono text-xs font-bold text-blue-700">{b.bill_number}</td>
                      <td className="px-3 py-3">
                        {b.mrn ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-50 border border-teal-200 font-mono text-xs font-bold text-teal-700">{b.mrn}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900">{b.patient_name}</div>
                      </td>
                      <td className="px-3 py-3"><span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">{b.visit_type}</span></td>
                      <td className="px-3 py-3 font-medium text-gray-800">₹{b.gross_total}</td>
                      <td className="px-3 py-3 text-red-600 text-xs">-₹{b.discount_amount || 0}</td>
                      <td className="px-3 py-3 font-bold text-green-700">₹{b.net_amount}</td>
                      <td className="px-3 py-3 font-bold text-red-600">₹{b.balance_due}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[b.payment_status] || 'bg-gray-100 text-gray-600'}`}>{b.payment_status}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => printBillReceipt(b)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200" title="Print Receipt">
                            <i className="fas fa-print" />
                          </button>
                          {b.balance_due > 0 && (
                            <button onClick={() => setPaymentModal(b)} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">Pay</button>
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

      {activeTab === 'services' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-blue-50">
                <tr>
                  {['Service Name', 'Code', 'Category', 'Price', 'GST %'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {services.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400">No services configured</td></tr>
                ) : services.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{s.service_name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-blue-600">{s.service_code || '—'}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs bg-indigo-100 text-indigo-700">{s.category}</span></td>
                    <td className="px-4 py-3 font-bold text-green-700">₹{s.price}</td>
                    <td className="px-4 py-3 text-gray-500">{s.gst_percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Bill Modal */}
      <AnimatePresence>
        {showBillModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800"><i className="fas fa-file-invoice mr-2" />Create Bill</h2>
                <button onClick={() => setShowBillModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleCreateBill} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Patient Name', key: 'patient_name', required: true },
                    { label: 'MRN', key: 'mrn' },
                    { label: 'Doctor Name', key: 'doctor_name' },
                    { label: 'Department', key: 'department' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
                      <input type="text" required={f.required} value={billForm[f.key]} onChange={e => setBillForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Visit Type</label>
                    <select value={billForm.visit_type} onChange={e => setBillForm(p => ({ ...p, visit_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                      <option>OPD</option><option>IPD</option><option>Emergency</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
                    <select value={billForm.payment_mode} onChange={e => setBillForm(p => ({ ...p, payment_mode: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                      <option>Cash</option><option>Card</option><option>UPI</option><option>Insurance</option><option>NEFT</option>
                    </select>
                  </div>
                </div>
                {/* Service items */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Add Services</label>
                  <div className="grid grid-cols-3 gap-1 max-h-32 overflow-y-auto border rounded-lg p-2">
                    {services.map(s => (
                      <button key={s.id} type="button" onClick={() => addBillItem(s)}
                        className="text-left text-xs px-2 py-1.5 rounded hover:bg-blue-50 border border-gray-200 transition">
                        <div className="font-medium truncate">{s.service_name}</div>
                        <div className="text-green-600">₹{s.price}</div>
                      </button>
                    ))}
                  </div>
                </div>
                {billForm.items.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs text-gray-500">Service</th>
                          <th className="px-3 py-2 text-left text-xs text-gray-500">Qty</th>
                          <th className="px-3 py-2 text-left text-xs text-gray-500">Price</th>
                          <th className="px-3 py-2 text-left text-xs text-gray-500">Total</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {billForm.items.map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{item.service_name}</td>
                            <td className="px-3 py-2">
                              <input type="number" min={1} value={item.quantity} onChange={e => {
                                const items = [...billForm.items];
                                items[idx].quantity = parseInt(e.target.value) || 1;
                                setBillForm(p => ({ ...p, items }));
                              }} className="w-16 border rounded px-2 py-1 text-xs" />
                            </td>
                            <td className="px-3 py-2 text-green-700">₹{item.unit_price}</td>
                            <td className="px-3 py-2 font-bold text-green-700">₹{item.quantity * item.unit_price}</td>
                            <td className="px-3 py-2">
                              <button type="button" onClick={() => removeBillItem(idx)} className="text-red-400 hover:text-red-600"><i className="fas fa-times" /></button>
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t bg-blue-50">
                          <td colSpan={3} className="px-3 py-2 text-right font-bold text-sm">Gross Total:</td>
                          <td colSpan={2} className="px-3 py-2 font-bold text-green-700">₹{billTotal.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Discount %</label>
                    <input type="number" min={0} max={100} value={billForm.discount_percent} onChange={e => setBillForm(p => ({ ...p, discount_percent: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Advance Paid (₹)</label>
                    <input type="number" min={0} value={billForm.advance_paid} onChange={e => setBillForm(p => ({ ...p, advance_paid: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowBillModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                    {saving ? 'Creating...' : 'Create Bill'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Service Modal */}
      <AnimatePresence>
        {showServiceModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800">Add Service/Charge</h2>
                <button onClick={() => setShowServiceModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleAddService} className="p-6 space-y-4">
                {[
                  { label: 'Service Name', key: 'service_name', required: true },
                  { label: 'Service Code', key: 'service_code' },
                  { label: 'Price (₹)', key: 'price', type: 'number', required: true },
                  { label: 'GST %', key: 'gst_percent', type: 'number' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
                    <input type={f.type || 'text'} required={f.required} value={serviceForm[f.key]} onChange={e => setServiceForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select value={serviceForm.category} onChange={e => setServiceForm(p => ({ ...p, category: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {['Consultation', 'Procedure', 'Diagnostic', 'Room Charges', 'Nursing', 'Surgery', 'Pharmacy', 'Radiology', 'Laboratory', 'Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowServiceModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                    {saving ? 'Saving...' : 'Add Service'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {paymentModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="px-6 py-4 border-b bg-green-50">
                <h2 className="text-lg font-bold text-green-800">Record Payment</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <strong>{paymentModal.patient_name}</strong> — Bill {paymentModal.bill_number}
                  <div className="mt-1 text-red-600 font-bold">Balance Due: ₹{paymentModal.balance_due}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
                  <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} max={paymentModal.balance_due} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
                  <select value={payMode} onChange={e => setPayMode(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                    <option>Cash</option><option>Card</option><option>UPI</option><option>Insurance</option><option>NEFT</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setPaymentModal(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button onClick={handlePayment} className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Record Payment</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
