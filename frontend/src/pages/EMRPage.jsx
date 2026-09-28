import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PatientMedicalReport from '../components/common/PatientMedicalReport';

const API = 'https://cubehis.avopay.pro:5000/api/emr';

export default function EMRPage() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [viewModal, setViewModal] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [mrn, setMrn] = useState('');
  const [form, setForm] = useState({
    patient_name: '', mrn: '', patient_age: '', patient_gender: 'Male', doctor_name: '', department: 'General Medicine',
    chief_complaint: '', diagnosis: '', findings: '',
    medications: [{ drug_name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
    investigations: [], advice: '', follow_up_days: 7
  });
  const [saving, setSaving] = useState(false);
  const [reportModal, setReportModal] = useState(null);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`${API}/prescriptions?${params}`, { headers });
      const data = await res.json();
      setPrescriptions(data.prescriptions || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadHistory = async (patientMrn) => {
    if (!patientMrn) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API}/patient/${patientMrn}/history`, { headers });
      const data = await res.json();
      setHistory(data);
    } catch (e) { console.error(e); }
    setHistoryLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/prescriptions`, { method: 'POST', headers, body: JSON.stringify({ ...form, follow_up_days: parseInt(form.follow_up_days), patient_age: parseInt(form.patient_age) || undefined }) });
      setShowModal(false);
      setForm({ patient_name: '', mrn: '', patient_age: '', patient_gender: 'Male', doctor_name: '', department: 'General Medicine', chief_complaint: '', diagnosis: '', findings: '', medications: [{ drug_name: '', dosage: '', frequency: '', duration: '', instructions: '' }], investigations: [], advice: '', follow_up_days: 7 });
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const addMedRow = () => setForm(f => ({ ...f, medications: [...f.medications, { drug_name: '', dosage: '', frequency: '', duration: '', instructions: '' }] }));
  const removeMedRow = (idx) => setForm(f => ({ ...f, medications: f.medications.filter((_, i) => i !== idx) }));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Electronic Medical Records (EMR)</h1>
          <p className="text-gray-500 text-sm mt-1">Prescriptions, diagnosis & patient history</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition text-sm">
            <i className="fas fa-file-medical" /> New Prescription
          </button>
        </div>
      </div>

      {/* Search & Patient History Lookup */}
      <div className="bg-white rounded-xl shadow p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex gap-2">
          <input type="text" placeholder="Search prescriptions..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <button onClick={load} className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100"><i className="fas fa-search" /></button>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <input type="text" placeholder="Enter MRN for patient history" value={mrn} onChange={e => setMrn(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 w-52" />
          <button onClick={() => { setHistoryModal(true); loadHistory(mrn); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
            <i className="fas fa-history mr-1" /> History
          </button>
        </div>
      </div>

      {/* Prescriptions Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-blue-50">
              <tr>
                {['Rx No', 'MR No.', 'Patient', 'Doctor', 'Diagnosis', 'Medications', 'Follow-up', 'Date', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
              ) : prescriptions.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">No prescriptions found</td></tr>
              ) : prescriptions.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{p.rx_number}</td>
                  <td className="px-4 py-3">
                    {p.mrn ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-50 border border-teal-200 font-mono text-xs font-bold text-teal-700">{p.mrn}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.patient_name}</div>
                    <div className="text-xs text-gray-400">{p.patient_age ? `${p.patient_age}y` : ''} {p.patient_gender || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{p.doctor_name}</div>
                    <div className="text-xs text-gray-400">{p.department}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                    <div className="line-clamp-2">{p.diagnosis || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium">{p.medications?.length || 0} drugs</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.follow_up_days ? `${p.follow_up_days} days` : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setViewModal(p)} className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded bg-blue-50">
                      <i className="fas fa-eye mr-1" />View
                    </button>
                    <button onClick={() => setReportModal(p)} className="text-green-600 hover:text-green-800 text-xs px-2 py-1 rounded bg-green-50 ml-1">
                      <i className="fas fa-download mr-1" />Report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Prescription Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50 sticky top-0 z-10">
                <h2 className="text-lg font-bold text-blue-800"><i className="fas fa-file-medical mr-2" />New Prescription</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Patient Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2"><i className="fas fa-user-injured text-blue-500" /> Patient Information</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Patient Name', key: 'patient_name', required: true, span: 2 },
                      { label: 'MRN', key: 'mrn' },
                      { label: 'Age', key: 'patient_age', type: 'number' },
                    ].map(f => (
                      <div key={f.key} className={`col-span-${f.span || 1}`}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
                        <input type={f.type || 'text'} required={f.required} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                      <select value={form.patient_gender} onChange={e => setForm(p => ({ ...p, patient_gender: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option>Male</option><option>Female</option><option>Other</option>
                      </select>
                    </div>
                  </div>
                </div>
                {/* Doctor Info */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Doctor Name', key: 'doctor_name', required: true },
                    { label: 'Department', key: 'department' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
                      <input required={f.required} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  ))}
                </div>
                {/* Clinical */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2"><i className="fas fa-stethoscope text-blue-500" /> Clinical Notes</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Chief Complaint', key: 'chief_complaint', rows: 2 },
                      { label: 'Diagnosis', key: 'diagnosis', rows: 2 },
                      { label: 'Findings / Observations', key: 'findings', rows: 2 },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                        <textarea rows={f.rows} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Medications */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2"><i className="fas fa-pills text-blue-500" /> Medications</h3>
                    <button type="button" onClick={addMedRow} className="text-xs text-blue-600 hover:underline"><i className="fas fa-plus mr-1" />Add Drug</button>
                  </div>
                  <div className="space-y-2">
                    {form.medications.map((med, idx) => (
                      <div key={idx} className="bg-blue-50 rounded-lg p-3 grid grid-cols-5 gap-2 items-start">
                        {[
                          { placeholder: 'Drug Name', key: 'drug_name' },
                          { placeholder: 'Dosage (e.g. 500mg)', key: 'dosage' },
                          { placeholder: 'Frequency', key: 'frequency' },
                          { placeholder: 'Duration', key: 'duration' },
                          { placeholder: 'Instructions', key: 'instructions' },
                        ].map(f => (
                          <input key={f.key} type="text" placeholder={f.placeholder} value={med[f.key]} onChange={e => {
                            const meds = [...form.medications];
                            meds[idx][f.key] = e.target.value;
                            setForm(p => ({ ...p, medications: meds }));
                          }} className="border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        ))}
                        {form.medications.length > 1 && (
                          <button type="button" onClick={() => removeMedRow(idx)} className="text-red-400 hover:text-red-600 col-span-5 text-right text-xs">Remove</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Advice / Instructions</label>
                    <textarea rows={2} value={form.advice} onChange={e => setForm(p => ({ ...p, advice: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Follow-up (days)</label>
                    <input type="number" value={form.follow_up_days} onChange={e => setForm(p => ({ ...p, follow_up_days: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save Prescription'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Prescription Modal */}
      <AnimatePresence>
        {viewModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <div>
                  <h2 className="text-lg font-bold text-blue-800">Prescription &mdash; {viewModal.rx_number}</h2>
                  <p className="text-xs text-gray-500">{viewModal.created_at ? new Date(viewModal.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setViewModal(null); setReportModal(viewModal); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition"
                  >
                    <i className="fas fa-file-pdf" /> Download PDF Report
                  </button>
                  <button onClick={() => setViewModal(null)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-blue-700 uppercase mb-2">Patient</h3>
                    <div className="font-bold text-gray-800">{viewModal.patient_name}</div>
                    <div className="text-sm text-gray-500">{viewModal.mrn} | {viewModal.patient_age}y {viewModal.patient_gender}</div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-green-700 uppercase mb-2">Doctor</h3>
                    <div className="font-bold text-gray-800">{viewModal.doctor_name}</div>
                    <div className="text-sm text-gray-500">{viewModal.department}</div>
                  </div>
                </div>
                {viewModal.chief_complaint && <div><h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Chief Complaint</h3><p className="text-sm text-gray-800">{viewModal.chief_complaint}</p></div>}
                {viewModal.diagnosis && <div><h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Diagnosis</h3><p className="text-sm text-gray-800 font-medium">{viewModal.diagnosis}</p></div>}
                {viewModal.findings && <div><h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Findings</h3><p className="text-sm text-gray-800">{viewModal.findings}</p></div>}
                {viewModal.medications?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2"><i className="fas fa-pills text-blue-500" />Medications</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-blue-50">
                          <tr>
                            {['Drug', 'Dosage', 'Frequency', 'Duration', 'Instructions'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-blue-700">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {viewModal.medications.map((m, i) => (
                            <tr key={i} className="border-t">
                              <td className="px-3 py-2 font-medium">{m.drug_name}</td>
                              <td className="px-3 py-2 text-gray-600">{m.dosage}</td>
                              <td className="px-3 py-2 text-gray-600">{m.frequency}</td>
                              <td className="px-3 py-2 text-gray-600">{m.duration}</td>
                              <td className="px-3 py-2 text-gray-500 text-xs">{m.instructions}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {viewModal.advice && <div><h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Advice</h3><p className="text-sm text-gray-800">{viewModal.advice}</p></div>}
                {viewModal.follow_up_days && <div className="bg-yellow-50 rounded-lg px-4 py-2 text-sm text-yellow-800"><i className="fas fa-calendar-check mr-2" />Follow-up in <strong>{viewModal.follow_up_days} days</strong></div>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Patient History Modal */}
      <AnimatePresence>
        {historyModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-purple-50">
                <h2 className="text-lg font-bold text-purple-800"><i className="fas fa-history mr-2" />Patient History — {mrn}</h2>
                <button onClick={() => { setHistoryModal(false); setHistory(null); }} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <div className="p-6">
                {historyLoading && <div className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading history...</div>}
                {history && !historyLoading && (
                  <div className="space-y-5">
                    {/* Prescriptions */}
                    {history.prescriptions?.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><i className="fas fa-file-medical text-blue-500" />Prescriptions ({history.prescriptions.length})</h3>
                        <div className="space-y-2">
                          {history.prescriptions.map(p => (
                            <div key={p.id} className="bg-blue-50 rounded-lg p-3 text-sm">
                              <div className="flex justify-between">
                                <span className="font-bold text-blue-700">{p.rx_number}</span>
                                <span className="text-gray-400 text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : ''}</span>
                              </div>
                              <div className="text-gray-700 mt-1">{p.diagnosis || 'No diagnosis'} — Dr. {p.doctor_name}</div>
                              <div className="text-gray-500 text-xs mt-0.5">{p.medications?.length || 0} medications</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Lab Orders */}
                    {history.lab_orders?.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><i className="fas fa-flask text-green-500" />Lab Orders ({history.lab_orders.length})</h3>
                        <div className="space-y-1">
                          {history.lab_orders.map(l => (
                            <div key={l.id} className="bg-green-50 rounded px-3 py-2 text-sm flex justify-between">
                              <span className="font-mono text-xs text-green-700">{l.order_number}</span>
                              <span className="text-gray-500">{l.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* IPD Admissions */}
                    {history.ipd_admissions?.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><i className="fas fa-bed text-red-500" />IPD Admissions ({history.ipd_admissions.length})</h3>
                        <div className="space-y-1">
                          {history.ipd_admissions.map(a => (
                            <div key={a.id} className="bg-red-50 rounded px-3 py-2 text-sm flex justify-between">
                              <span className="font-medium">{a.ipd_number}</span>
                              <span className="text-gray-500">{a.ward_name} — {a.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!history.prescriptions?.length && !history.lab_orders?.length && !history.ipd_admissions?.length && (
                      <div className="text-center py-10 text-gray-400">No history found for this patient</div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Patient Medical Report PDF Modal */}
      {reportModal && (
        <PatientMedicalReport
          prescription={reportModal}
          onClose={() => setReportModal(null)}
        />
      )}
    </div>
  );
}
