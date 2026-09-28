import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'https://cubehis.avopay.pro:5000/api/nursing';

export default function NursingStationPage() {
  const [notes, setNotes] = useState([]);
  const [patients, setPatients] = useState([]);
  const [medications, setMedications] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('patients');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showMedModal, setShowMedModal] = useState(false);
  const [noteForm, setNoteForm] = useState({ patient_name: '', mrn: '', bed_number: '', ward_name: '', note_type: 'General', content: '', vitals: { bp: '', pulse: '', temperature: '', spo2: '', respiration_rate: '' } });
  const [medForm, setMedForm] = useState({ patient_name: '', mrn: '', bed_number: '', ward_name: '', drug_name: '', dosage: '', route: 'Oral', scheduled_time: '', nurse_name: '' });
  const [saving, setSaving] = useState(false);
  const [selectedWard, setSelectedWard] = useState('');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedWard) params.set('ward', selectedWard);
      const [nRes, pRes, mRes, sRes] = await Promise.all([
        fetch(`${API}/notes?${params}`, { headers }),
        fetch(`${API}/ward-patients?${params}`, { headers }),
        fetch(`${API}/medications?${params}`, { headers }),
        fetch(`${API}/stats`, { headers }),
      ]);
      const [nData, pData, mData, sData] = await Promise.all([nRes.json(), pRes.json(), mRes.json(), sRes.json()]);
      setNotes(nData.notes || []);
      setPatients(pData.patients || []);
      setMedications(mData.medications || []);
      setStats(sData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedWard]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/notes`, { method: 'POST', headers, body: JSON.stringify(noteForm) });
      setShowNoteModal(false);
      setNoteForm({ patient_name: '', mrn: '', bed_number: '', ward_name: '', note_type: 'General', content: '', vitals: { bp: '', pulse: '', temperature: '', spo2: '', respiration_rate: '' } });
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleAdministerMed = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/medications`, { method: 'POST', headers, body: JSON.stringify(medForm) });
      setShowMedModal(false);
      setMedForm({ patient_name: '', mrn: '', bed_number: '', ward_name: '', drug_name: '', dosage: '', route: 'Oral', scheduled_time: '', nurse_name: '' });
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const NOTE_TYPE_COLORS = { General: 'bg-blue-100 text-blue-700', Vitals: 'bg-green-100 text-green-700', 'Medication Admin': 'bg-purple-100 text-purple-700', Incident: 'bg-red-100 text-red-700', Assessment: 'bg-yellow-100 text-yellow-700' };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Nursing Station</h1>
          <p className="text-gray-500 text-sm mt-1">Ward management, nursing notes & medication administration</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowMedModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium shadow transition text-sm">
            <i className="fas fa-syringe" /> Give Medication
          </button>
          <button onClick={() => setShowNoteModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition text-sm">
            <i className="fas fa-notes-medical" /> Add Note
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Ward Patients', value: stats.total_patients ?? '—', icon: 'bed', color: 'blue' },
          { label: "Today's Notes", value: stats.notes_today ?? '—', icon: 'notes-medical', color: 'green' },
          { label: 'Medications Given', value: stats.medications_today ?? '—', icon: 'syringe', color: 'purple' },
          { label: 'Vital Checks', value: stats.vitals_today ?? '—', icon: 'heartbeat', color: 'red' },
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

      {/* Ward Filter */}
      <div className="bg-white rounded-xl shadow p-4 flex gap-3 items-center">
        <span className="text-sm font-medium text-gray-600">Filter by Ward:</span>
        <input type="text" placeholder="e.g. General Ward, ICU..." value={selectedWard} onChange={e => setSelectedWard(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-56" />
        {selectedWard && <button onClick={() => setSelectedWard('')} className="text-xs text-red-500 hover:underline">Clear</button>}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { key: 'patients', label: 'Ward Patients', icon: 'bed' },
          { key: 'notes', label: 'Nursing Notes', icon: 'notes-medical' },
          { key: 'medications', label: 'Medication Log', icon: 'syringe' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${activeTab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-blue-600'}`}>
            <i className={`fas fa-${t.icon} mr-1.5`} />{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'patients' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-blue-50">
                <tr>
                  {['MR No.', 'Patient', 'Ward / Bed', 'Doctor', 'Diagnosis', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                ) : patients.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">No ward patients found</td></tr>
                ) : patients.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {p.mrn ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-50 border border-teal-200 font-mono text-xs font-bold text-teal-700">{p.mrn}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-800">{p.patient_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div><i className="fas fa-hospital mr-1 text-blue-400" />{p.ward_name || '—'}</div>
                      <div className="text-xs text-gray-400"><i className="fas fa-bed mr-1" />Bed: {p.bed_number || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.doctor_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                      {p.diagnosis ? <span className="bg-gray-50 rounded px-2 py-1">{p.diagnosis}</span> : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === 'Admitted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-blue-50">
                <tr>
                  {['MR No.', 'Patient', 'Ward/Bed', 'Type', 'Note', 'Vitals', 'Nurse', 'Time'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                ) : notes.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">No nursing notes today</td></tr>
                ) : notes.map(n => (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {n.mrn ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-50 border border-teal-200 font-mono text-xs font-bold text-teal-700">{n.mrn}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{n.patient_name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{n.ward_name} / Bed {n.bed_number}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${NOTE_TYPE_COLORS[n.note_type] || 'bg-gray-100 text-gray-600'}`}>{n.note_type}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                      <div className="line-clamp-2">{n.content}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {n.vitals && Object.entries(n.vitals).filter(([, v]) => v).map(([k, v]) => (
                        <div key={k}><span className="font-medium">{k}:</span> {v}</div>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{n.nurse_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{n.created_at ? new Date(n.created_at).toLocaleTimeString('en-IN', { hour12: true }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'medications' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-purple-50">
                <tr>
                  {['MR No.', 'Patient', 'Ward/Bed', 'Drug', 'Dosage', 'Route', 'Scheduled', 'Given By', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {medications.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-gray-400">No medications logged today</td></tr>
                ) : medications.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {m.mrn ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-50 border border-teal-200 font-mono text-xs font-bold text-teal-700">{m.mrn}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.patient_name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{m.ward_name} / {m.bed_number}</td>
                    <td className="px-4 py-3 font-medium text-purple-700">{m.drug_name}</td>
                    <td className="px-4 py-3 text-gray-600">{m.dosage}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs bg-indigo-100 text-indigo-700">{m.route}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{m.scheduled_time ? new Date(m.scheduled_time).toLocaleTimeString('en-IN', { hour12: true }) : '—'}</td>
                    <td className="px-4 py-3 text-sm">{m.nurse_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.status === 'Administered' ? 'bg-green-100 text-green-700' : m.status === 'Missed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{m.status || 'Scheduled'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      <AnimatePresence>
        {showNoteModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800"><i className="fas fa-notes-medical mr-2" />Add Nursing Note</h2>
                <button onClick={() => setShowNoteModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleAddNote} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Patient Name', key: 'patient_name', required: true },
                    { label: 'MRN', key: 'mrn' },
                    { label: 'Ward Name', key: 'ward_name' },
                    { label: 'Bed Number', key: 'bed_number' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
                      <input required={f.required} value={noteForm[f.key]} onChange={e => setNoteForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Note Type</label>
                    <select value={noteForm.note_type} onChange={e => setNoteForm(p => ({ ...p, note_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                      {['General', 'Vitals', 'Medication Admin', 'Incident', 'Assessment'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nurse Name</label>
                    <input value={noteForm.nurse_name || ''} onChange={e => setNoteForm(p => ({ ...p, nurse_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
                {/* Vitals */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Vitals (optional)</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { label: 'BP', key: 'bp', placeholder: '120/80' },
                      { label: 'Pulse', key: 'pulse', placeholder: '72' },
                      { label: 'Temp °F', key: 'temperature', placeholder: '98.6' },
                      { label: 'SpO2 %', key: 'spo2', placeholder: '98' },
                      { label: 'RR', key: 'respiration_rate', placeholder: '16' },
                    ].map(v => (
                      <div key={v.key}>
                        <label className="block text-xs text-gray-500 mb-1">{v.label}</label>
                        <input placeholder={v.placeholder} value={noteForm.vitals[v.key]} onChange={e => setNoteForm(p => ({ ...p, vitals: { ...p.vitals, [v.key]: e.target.value } }))} className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Note Content <span className="text-red-500">*</span></label>
                  <textarea required rows={4} value={noteForm.content} onChange={e => setNoteForm(p => ({ ...p, content: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setShowNoteModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save Note'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Give Medication Modal */}
      <AnimatePresence>
        {showMedModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-purple-50">
                <h2 className="text-lg font-bold text-purple-800"><i className="fas fa-syringe mr-2" />Administer Medication</h2>
                <button onClick={() => setShowMedModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleAdministerMed} className="p-6 grid grid-cols-2 gap-4">
                {[
                  { label: 'Patient Name', key: 'patient_name', required: true },
                  { label: 'MRN', key: 'mrn' },
                  { label: 'Ward Name', key: 'ward_name' },
                  { label: 'Bed Number', key: 'bed_number' },
                  { label: 'Drug Name', key: 'drug_name', required: true },
                  { label: 'Dosage', key: 'dosage', required: true },
                  { label: 'Nurse Name', key: 'nurse_name', required: true },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
                    <input required={f.required} value={medForm[f.key]} onChange={e => setMedForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Route</label>
                  <select value={medForm.route} onChange={e => setMedForm(p => ({ ...p, route: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                    {['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhalation', 'Sublingual'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Time</label>
                  <input type="datetime-local" value={medForm.scheduled_time} onChange={e => setMedForm(p => ({ ...p, scheduled_time: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div className="col-span-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowMedModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-60">{saving ? 'Saving...' : 'Administer'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
