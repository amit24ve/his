import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'https://cubehis.avopay.pro:5000/api/teleconsult';
const STATUS_COLORS = { Scheduled: 'bg-blue-100 text-blue-700', 'In Progress': 'bg-yellow-100 text-yellow-700', Completed: 'bg-green-100 text-green-700', Cancelled: 'bg-red-100 text-red-700', 'No Show': 'bg-gray-100 text-gray-600' };

export default function TeleconsultationPage() {
  const [consults, setConsults] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [form, setForm] = useState({ patient_name: '', mrn: '', patient_mobile: '', patient_email: '', doctor_name: '', department: 'General Medicine', scheduled_time: '', consultation_type: 'Video', chief_complaint: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ status: '', date: new Date().toISOString().split('T')[0] });

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.date) params.set('date', filters.date);
      const [cRes, sRes] = await Promise.all([
        fetch(`${API}?${params}`, { headers }),
        fetch(`${API}/stats`, { headers }),
      ]);
      const [cData, sData] = await Promise.all([cRes.json(), sRes.json()]);
      setConsults(cData.consultations || []);
      setStats(sData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(API, { method: 'POST', headers, body: JSON.stringify(form) });
      setShowModal(false);
      setForm({ patient_name: '', mrn: '', patient_mobile: '', patient_email: '', doctor_name: '', department: 'General Medicine', scheduled_time: '', consultation_type: 'Video', chief_complaint: '', notes: '' });
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const updateStatus = async (id, status) => {
    await fetch(`${API}/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ status }) });
    setEditModal(null);
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Teleconsultation</h1>
          <p className="text-gray-500 text-sm mt-1">Video & telephonic consultations scheduling</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition text-sm">
          <i className="fas fa-video" /> New Teleconsult
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Scheduled', value: stats.scheduled ?? '—', icon: 'calendar', color: 'blue' },
          { label: 'In Progress', value: stats.in_progress ?? '—', icon: 'video', color: 'yellow' },
          { label: 'Completed Today', value: stats.completed ?? '—', icon: 'check-circle', color: 'green' },
          { label: 'No Shows', value: stats.no_show ?? '—', icon: 'user-times', color: 'red' },
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
      <div className="bg-white rounded-xl shadow p-4 flex gap-3 flex-wrap">
        <input type="date" value={filters.date} onChange={e => setFilters(f => ({ ...f, date: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">All Status</option>
          <option>Scheduled</option><option>In Progress</option><option>Completed</option><option>Cancelled</option><option>No Show</option>
        </select>
      </div>

      {/* Consult Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</div>
        ) : consults.length === 0 ? (
          <div className="col-span-3 text-center py-10 text-gray-400 bg-white rounded-xl shadow">No teleconsultations scheduled</div>
        ) : consults.map(c => (
          <motion.div key={c.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow p-5 border border-gray-200 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="font-mono text-xs text-blue-600 font-bold">{c.consult_number}</span>
                <div className="font-bold text-gray-800 mt-0.5">{c.patient_name}</div>
                <div className="text-xs text-gray-400">{c.mrn} {c.patient_mobile ? `| ${c.patient_mobile}` : ''}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.consultation_type === 'Video' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  <i className={`fas fa-${c.consultation_type === 'Video' ? 'video' : 'phone'} mr-1`} />{c.consultation_type}
                </span>
              </div>
            </div>
            <div className="space-y-1.5 text-sm text-gray-600 mb-4">
              <div><i className="fas fa-user-md mr-2 text-blue-400" /><strong>Dr. {c.doctor_name}</strong> — {c.department}</div>
              <div><i className="fas fa-clock mr-2 text-gray-400" />{c.scheduled_time ? new Date(c.scheduled_time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</div>
              {c.chief_complaint && <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">{c.chief_complaint}</div>}
            </div>
            <div className="flex gap-2">
              {c.status === 'Scheduled' && (
                <>
                  <button onClick={() => updateStatus(c.id, 'In Progress')} className="flex-1 py-1.5 text-xs bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 font-medium transition">
                    <i className="fas fa-play mr-1" /> Start
                  </button>
                  <button onClick={() => setEditModal(c)} className="py-1.5 px-3 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">
                    <i className="fas fa-ellipsis-h" />
                  </button>
                </>
              )}
              {c.status === 'In Progress' && (
                <button onClick={() => updateStatus(c.id, 'Completed')} className="flex-1 py-1.5 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium transition">
                  <i className="fas fa-check mr-1" /> Complete
                </button>
              )}
              {(c.status === 'Completed' || c.status === 'Cancelled') && (
                <div className="flex-1 py-1.5 text-xs text-center text-gray-400">—</div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* New Teleconsult Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800"><i className="fas fa-video mr-2" />New Teleconsultation</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleCreate} className="p-6 grid grid-cols-2 gap-4">
                {[
                  { label: 'Patient Name', key: 'patient_name', required: true },
                  { label: 'MRN', key: 'mrn' },
                  { label: 'Mobile', key: 'patient_mobile' },
                  { label: 'Email', key: 'patient_email', type: 'email' },
                  { label: 'Doctor Name', key: 'doctor_name', required: true },
                  { label: 'Department', key: 'department' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
                    <input type={f.type || 'text'} required={f.required} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Consultation Type</label>
                  <select value={form.consultation_type} onChange={e => setForm(p => ({ ...p, consultation_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option>Video</option><option>Phone</option><option>Chat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Time <span className="text-red-500">*</span></label>
                  <input required type="datetime-local" value={form.scheduled_time} onChange={e => setForm(p => ({ ...p, scheduled_time: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Chief Complaint</label>
                  <textarea rows={2} value={form.chief_complaint} onChange={e => setForm(p => ({ ...p, chief_complaint: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="col-span-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Scheduling...' : 'Schedule Consult'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Update Modal */}
      <AnimatePresence>
        {editModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800">Update Status</h2>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-sm text-gray-700"><strong>{editModal.patient_name}</strong> — Dr. {editModal.doctor_name}</p>
                <div className="grid grid-cols-2 gap-2">
                  {['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'No Show'].map(st => (
                    <button key={st} onClick={() => updateStatus(editModal.id, st)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition ${editModal.status === st ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 hover:border-blue-400 hover:text-blue-600'}`}>
                      {st}
                    </button>
                  ))}
                </div>
                <button onClick={() => setEditModal(null)} className="w-full py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
