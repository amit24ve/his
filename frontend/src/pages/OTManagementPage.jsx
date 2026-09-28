import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'https://cubehis.avopay.pro:5000/api/ot';
const STATUS_COLORS = { Scheduled: 'bg-blue-100 text-blue-700', 'In Progress': 'bg-yellow-100 text-yellow-700', Completed: 'bg-green-100 text-green-700', Cancelled: 'bg-red-100 text-red-700', Postponed: 'bg-gray-100 text-gray-600' };

export default function OTManagementPage() {
  const [schedule, setSchedule] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ patient_name: '', mrn: '', surgeon_name: '', anaesthetist_name: '', surgery_name: '', surgery_type: 'Elective', ot_room: '', start_time: '', estimated_duration_minutes: 60, department: 'General Surgery', notes: '' });
  const [roomForm, setRoomForm] = useState({ room_name: '', room_number: '', speciality: '', equipment: '' });
  const [saving, setSaving] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('schedule');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.set('date', dateFilter);
      const [schRes, rRes, sRes] = await Promise.all([
        fetch(`${API}/schedule?${params}`, { headers }),
        fetch(`${API}/rooms`, { headers }),
        fetch(`${API}/stats`, { headers }),
      ]);
      const [schData, rData, sData] = await Promise.all([schRes.json(), rRes.json(), sRes.json()]);
      setSchedule(schData.schedule || []);
      setRooms(Array.isArray(rData) ? rData : []);
      setStats(sData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [dateFilter]);

  const handleSchedule = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/schedule`, { method: 'POST', headers, body: JSON.stringify({ ...scheduleForm, estimated_duration_minutes: parseInt(scheduleForm.estimated_duration_minutes) }) });
      setShowScheduleModal(false);
      setScheduleForm({ patient_name: '', mrn: '', surgeon_name: '', anaesthetist_name: '', surgery_name: '', surgery_type: 'Elective', ot_room: '', start_time: '', estimated_duration_minutes: 60, department: 'General Surgery', notes: '' });
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleAddRoom = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/rooms`, { method: 'POST', headers, body: JSON.stringify(roomForm) });
      setShowRoomModal(false);
      setRoomForm({ room_name: '', room_number: '', speciality: '', equipment: '' });
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const updateStatus = async (id, status) => {
    await fetch(`${API}/schedule/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ status }) });
    setEditModal(null);
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Operation Theatre (OT)</h1>
          <p className="text-gray-500 text-sm mt-1">Surgery scheduling, OT rooms & theatre management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowScheduleModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition text-sm">
            <i className="fas fa-calendar-plus" /> Schedule Surgery
          </button>
          <button onClick={() => setShowRoomModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-white border text-blue-600 rounded-lg hover:bg-blue-50 font-medium shadow transition text-sm">
            <i className="fas fa-door-open" /> Add OT Room
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today's Surgeries", value: stats.today_count ?? '—', icon: 'calendar-day', color: 'blue' },
          { label: 'In Progress', value: stats.in_progress ?? '—', icon: 'procedures', color: 'yellow' },
          { label: 'Completed Today', value: stats.completed_today ?? '—', icon: 'check-circle', color: 'green' },
          { label: 'OT Rooms', value: rooms.length || '—', icon: 'door-open', color: 'purple' },
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

      {/* OT Rooms Overview */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-2">OT Rooms Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {rooms.map(r => (
            <div key={r.id} className={`bg-white rounded-xl p-4 shadow border-2 ${r.status === 'Busy' ? 'border-red-400' : r.status === 'Maintenance' ? 'border-yellow-400' : 'border-green-400'}`}>
              <div className="font-bold text-gray-800">{r.room_name || r.room_number}</div>
              <div className="text-xs text-gray-500 mt-1">{r.speciality || 'General'}</div>
              <span className={`mt-2 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'Busy' ? 'bg-red-100 text-red-700' : r.status === 'Maintenance' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                {r.status || 'Available'}
              </span>
            </div>
          ))}
          {rooms.length === 0 && <div className="col-span-4 text-center py-6 text-gray-400 text-sm bg-white rounded-xl shadow">No OT rooms configured. Add rooms to start scheduling.</div>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[{ key: 'schedule', label: 'Surgery Schedule', icon: 'calendar' }, { key: 'rooms', label: 'Room Management', icon: 'door-open' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${activeTab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-blue-600'}`}>
            <i className={`fas fa-${t.icon} mr-1.5`} />{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'schedule' && (
        <>
          <div className="bg-white rounded-xl shadow p-4 flex gap-3">
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-blue-50">
                  <tr>
                    {['Surgery No', 'MR No.', 'Patient', 'Surgery', 'Surgeon', 'OT Room', 'Time', 'Duration', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-blue-700 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={10} className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                  ) : schedule.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-10 text-gray-400">No surgeries scheduled for this date</td></tr>
                  ) : schedule.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 font-mono text-xs font-bold text-blue-700">{s.surgery_number}</td>
                      <td className="px-3 py-3">
                        {s.mrn ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-50 border border-teal-200 font-mono text-xs font-bold text-teal-700">{s.mrn}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{s.patient_name}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{s.surgery_name}</div>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${s.surgery_type === 'Emergency' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{s.surgery_type}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-sm">{s.surgeon_name}</div>
                        {s.anaesthetist_name && <div className="text-xs text-gray-400">Anaes: {s.anaesthetist_name}</div>}
                      </td>
                      <td className="px-3 py-3 font-medium text-purple-700">{s.ot_room || '—'}</td>
                      <td className="px-3 py-3 text-xs text-gray-600">{s.start_time ? new Date(s.start_time).toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{s.estimated_duration_minutes} min</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>{s.status}</span>
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={() => setEditModal(s)} className="text-blue-500 hover:text-blue-700 text-xs"><i className="fas fa-edit" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'rooms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map(r => (
            <div key={r.id} className="bg-white rounded-xl shadow p-5 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-lg font-bold text-gray-800">{r.room_name}</div>
                  <div className="text-sm text-gray-500">Room #{r.room_number}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${r.status === 'Busy' ? 'bg-red-100 text-red-700' : r.status === 'Maintenance' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                  {r.status || 'Available'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <div><span className="font-medium">Speciality:</span> {r.speciality || '—'}</div>
                {r.equipment && <div className="mt-1 text-xs text-gray-500">{r.equipment}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Surgery Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800"><i className="fas fa-calendar-plus mr-2" />Schedule Surgery</h2>
                <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleSchedule} className="p-6 grid grid-cols-2 gap-4">
                {[
                  { label: 'Patient Name', key: 'patient_name', required: true },
                  { label: 'MRN', key: 'mrn' },
                  { label: 'Surgery Name', key: 'surgery_name', required: true, span: 2 },
                  { label: 'Surgeon Name', key: 'surgeon_name', required: true },
                  { label: 'Anaesthetist', key: 'anaesthetist_name' },
                  { label: 'Department', key: 'department' },
                  { label: 'Est. Duration (min)', key: 'estimated_duration_minutes', type: 'number' },
                ].map(f => (
                  <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
                    <input type={f.type || 'text'} required={f.required} value={scheduleForm[f.key]} onChange={e => setScheduleForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Surgery Type</label>
                  <select value={scheduleForm.surgery_type} onChange={e => setScheduleForm(p => ({ ...p, surgery_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option>Elective</option><option>Emergency</option><option>Day Care</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">OT Room</label>
                  <select value={scheduleForm.ot_room} onChange={e => setScheduleForm(p => ({ ...p, ot_room: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">-- Select Room --</option>
                    {rooms.map(r => <option key={r.id} value={r.room_name}>{r.room_name} ({r.room_number})</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Time <span className="text-red-500">*</span></label>
                  <input required type="datetime-local" value={scheduleForm.start_time} onChange={e => setScheduleForm(p => ({ ...p, start_time: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea rows={2} value={scheduleForm.notes} onChange={e => setScheduleForm(p => ({ ...p, notes: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="col-span-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowScheduleModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Scheduling...' : 'Schedule Surgery'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Room Modal */}
      <AnimatePresence>
        {showRoomModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800">Add OT Room</h2>
                <button onClick={() => setShowRoomModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleAddRoom} className="p-6 space-y-4">
                {[
                  { label: 'Room Name', key: 'room_name', required: true, placeholder: 'e.g. OT-1' },
                  { label: 'Room Number', key: 'room_number', placeholder: 'e.g. 101' },
                  { label: 'Speciality', key: 'speciality', placeholder: 'e.g. Cardiac, Ortho...' },
                  { label: 'Equipment/Notes', key: 'equipment', placeholder: 'e.g. C-arm, microscope...' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
                    <input type="text" required={f.required} placeholder={f.placeholder} value={roomForm[f.key]} onChange={e => setRoomForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                ))}
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setShowRoomModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving...' : 'Add Room'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Status Modal */}
      <AnimatePresence>
        {editModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800">Update Surgery Status</h2>
              </div>
              <div className="p-6 space-y-3">
                <div className="text-sm text-gray-700"><strong>{editModal.patient_name}</strong> — {editModal.surgery_name}</div>
                <p className="text-xs text-gray-500">Current: <span className="font-bold">{editModal.status}</span></p>
                <div className="grid grid-cols-2 gap-2">
                  {['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Postponed'].map(st => (
                    <button key={st} onClick={() => updateStatus(editModal.id, st)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition ${editModal.status === st ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 hover:border-blue-400 hover:text-blue-600'}`}>
                      {st}
                    </button>
                  ))}
                </div>
                <button onClick={() => setEditModal(null)} className="w-full mt-2 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
