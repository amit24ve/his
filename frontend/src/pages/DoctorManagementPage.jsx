import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DoctorSearchInput from '../components/DoctorSearchInput';

const API = 'https://cubehis.avopay.pro:5000/api/doctors';
const DEPARTMENTS = ['Cardiology', 'Oncology', 'Orthopaedics', 'Neurology', 'General Medicine', 'Gynaecology', 'Urology', 'Gastroenterology', 'Pulmonology', 'Nephrology', 'Paediatrics', 'Dermatology', 'Psychiatry', 'ENT', 'Ophthalmology', 'Anaesthesia', 'Radiology', 'Pathology', 'Emergency', 'ICU'];
const DESIGNATIONS = ['Director', 'HOD', 'Senior Consultant', 'Consultant', 'Junior Consultant', 'Resident', 'Intern'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const defaultForm = {
  name: '', registration_number: '', department: 'General Medicine', specialization: '',
  qualification: '', designation: 'Consultant', gender: 'Male', dob: '',
  email: '', phone: '', emergency_phone: '', experience_years: '',
  joining_date: '', consulting_hours: '', consultation_fee: '',
  address: '', status: 'Active', availability_days: []
};

const STATUS_COLORS = {
  Active: 'bg-green-100 text-green-700',
  'On Leave': 'bg-yellow-100 text-yellow-700',
  Inactive: 'bg-red-100 text-red-700'
};

const defaultScheduleForm = {
  doctor_id: '', doctor_name: '', date: '', shift: 'Morning',
  start_time: '', end_time: '', department: 'General Medicine', room: '', max_patients: 20, notes: ''
};

function printDoctorCard(doctor) {
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Doctor Profile</title>
    <style>body{font-family:Arial,sans-serif;margin:20px;} h2{color:#1e40af;} table{width:100%;border-collapse:collapse;margin-top:10px;} td{padding:6px 10px;border:1px solid #ddd;} .label{font-weight:bold;background:#f3f4f6;width:35%;}</style>
    </head><body>
    <h2>CubeMed HIS — Doctor Profile</h2>
    <h3>${doctor.name}</h3>
    <table>
      <tr><td class="label">Reg. Number</td><td>${doctor.registration_number || '—'}</td></tr>
      <tr><td class="label">Designation</td><td>${doctor.designation || '—'}</td></tr>
      <tr><td class="label">Department</td><td>${doctor.department || '—'}</td></tr>
      <tr><td class="label">Specialization</td><td>${doctor.specialization || '—'}</td></tr>
      <tr><td class="label">Qualification</td><td>${doctor.qualification || '—'}</td></tr>
      <tr><td class="label">Experience</td><td>${doctor.experience_years ? doctor.experience_years + ' years' : '—'}</td></tr>
      <tr><td class="label">Phone</td><td>${doctor.phone || '—'}</td></tr>
      <tr><td class="label">Email</td><td>${doctor.email || '—'}</td></tr>
      <tr><td class="label">Consultation Fee</td><td>₹${doctor.consultation_fee || '—'}</td></tr>
      <tr><td class="label">Consulting Hours</td><td>${doctor.consulting_hours || '—'}</td></tr>
      <tr><td class="label">Available Days</td><td>${(doctor.availability_days || []).join(', ') || '—'}</td></tr>
      <tr><td class="label">Status</td><td>${doctor.status || '—'}</td></tr>
    </table>
    <p style="margin-top:20px;font-size:12px;color:#666;">Printed on ${new Date().toLocaleString()}</p>
    </body></html>
  `);
  win.document.close();
  win.print();
}

export default function DoctorManagementPage() {
  const [doctors, setDoctors] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editDoctor, setEditDoctor] = useState(null);
  const [viewDoctor, setViewDoctor] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [scheduleForm, setScheduleForm] = useState(defaultScheduleForm);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('doctors');
  const [filters, setFilters] = useState({ department: '', status: '' });
  const [search, setSearch] = useState('');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.department) params.set('department', filters.department);
      if (filters.status) params.set('status', filters.status);
      if (search) params.set('search', search);
      const [dRes, sRes] = await Promise.all([
        fetch(`${API}?${params}`, { headers }),
        fetch(`${API}/stats`, { headers }),
      ]);
      const dData = await dRes.json();
      const sData = await sRes.json();
      setDoctors(dData.doctors || []);
      setStats(sData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadSchedules = async () => {
    try {
      const res = await fetch(`${API}/schedule/list`, { headers });
      const data = await res.json();
      setSchedules(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, [filters]);
  useEffect(() => { if (activeTab === 'schedule') loadSchedules(); }, [activeTab]);

  const openAdd = () => { setEditDoctor(null); setForm(defaultForm); setShowModal(true); };
  const openEdit = (d) => { setEditDoctor(d); setForm({ ...defaultForm, ...d }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, experience_years: form.experience_years ? parseInt(form.experience_years) : undefined, consultation_fee: form.consultation_fee ? parseFloat(form.consultation_fee) : undefined };
      if (editDoctor) {
        await fetch(`${API}/${editDoctor.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
      } else {
        await fetch(API, { method: 'POST', headers, body: JSON.stringify(body) });
      }
      setShowModal(false);
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this doctor?')) return;
    await fetch(`${API}/${id}`, { method: 'DELETE', headers });
    load();
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/schedule`, { method: 'POST', headers, body: JSON.stringify({ ...scheduleForm, max_patients: parseInt(scheduleForm.max_patients) }) });
      setShowScheduleModal(false);
      setScheduleForm(defaultScheduleForm);
      loadSchedules();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const toggleDay = (day) => {
    setForm(f => ({
      ...f,
      availability_days: f.availability_days?.includes(day)
        ? f.availability_days.filter(d => d !== day)
        : [...(f.availability_days || []), day]
    }));
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Doctor Management</h1>
          <p className="text-gray-500 text-sm mt-1">Consultant profiles, schedules & availability</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeTab === 'doctors' && (
            <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition text-sm">
              <i className="fas fa-user-md" /> Add Doctor
            </button>
          )}
          {activeTab === 'schedule' && (
            <button onClick={() => setShowScheduleModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow transition text-sm">
              <i className="fas fa-calendar-plus" /> Add Schedule
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Doctors', value: stats.total ?? '—', icon: 'user-md', color: 'blue' },
          { label: 'Active', value: stats.active ?? '—', icon: 'check-circle', color: 'green' },
          { label: 'On Leave', value: stats.on_leave ?? '—', icon: 'calendar-times', color: 'yellow' },
          { label: 'Inactive', value: stats.inactive ?? '—', icon: 'times-circle', color: 'red' },
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: 'doctors', label: 'Doctor Roster', icon: 'user-md' },
          { key: 'schedule', label: 'Duty Schedule', icon: 'calendar-alt' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-blue-600'}`}>
            <i className={`fas fa-${t.icon} mr-1`} /> {t.label}
          </button>
        ))}
      </div>

      {/* Doctors Tab */}
      {activeTab === 'doctors' && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl shadow">
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
              placeholder="Search doctor / specialty..." className="border rounded-lg px-3 py-2 text-sm flex-1" />
            <select value={filters.department} onChange={e => setFilters(f => ({ ...f, department: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">All Status</option>
              <option>Active</option><option>On Leave</option><option>Inactive</option>
            </select>
            <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Search</button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            {loading ? (
              <div className="text-center py-16 text-gray-400"><i className="fas fa-spinner fa-spin text-3xl" /></div>
            ) : doctors.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <i className="fas fa-user-md text-4xl mb-2" /><p>No doctors found</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-blue-50 text-blue-800">
                  <tr>
                    <th className="px-4 py-3 text-left">Doctor</th>
                    <th className="px-4 py-3 text-left">Reg. No.</th>
                    <th className="px-4 py-3 text-left">Department</th>
                    <th className="px-4 py-3 text-left">Specialization</th>
                    <th className="px-4 py-3 text-left">Phone</th>
                    <th className="px-4 py-3 text-left">Fee</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {doctors.map((d, i) => (
                    <motion.tr key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="hover:bg-blue-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                            {d.name?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{d.name}</p>
                            <p className="text-xs text-gray-500">{d.designation}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{d.registration_number}</td>
                      <td className="px-4 py-3 text-gray-600">{d.department}</td>
                      <td className="px-4 py-3 text-gray-600">{d.specialization}</td>
                      <td className="px-4 py-3 text-gray-600">{d.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{d.consultation_fee ? `₹${d.consultation_fee}` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-700'}`}>{d.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => setViewDoctor(d)} className="p-1.5 rounded text-blue-600 hover:bg-blue-100" title="View"><i className="fas fa-eye" /></button>
                          <button onClick={() => printDoctorCard(d)} className="p-1.5 rounded text-green-600 hover:bg-green-100" title="Print"><i className="fas fa-print" /></button>
                          <button onClick={() => openEdit(d)} className="p-1.5 rounded text-yellow-600 hover:bg-yellow-100" title="Edit"><i className="fas fa-edit" /></button>
                          <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded text-red-600 hover:bg-red-100" title="Delete"><i className="fas fa-trash" /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          {schedules.length === 0 ? (
            <div className="text-center py-16 text-gray-400"><i className="fas fa-calendar-alt text-4xl mb-2" /><p>No schedules yet</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-blue-50 text-blue-800">
                <tr>
                  <th className="px-4 py-3 text-left">Doctor</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Shift</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left">Room</th>
                  <th className="px-4 py-3 text-left">Max Patients</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedules.map((s, i) => (
                  <tr key={s.id} className="hover:bg-blue-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.doctor_name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.date}</td>
                    <td className="px-4 py-3 text-gray-600">{s.shift}</td>
                    <td className="px-4 py-3 text-gray-600">{s.start_time} - {s.end_time}</td>
                    <td className="px-4 py-3 text-gray-600">{s.department}</td>
                    <td className="px-4 py-3 text-gray-600">{s.room || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{s.max_patients}</td>
                    <td className="px-4 py-3">
                      <button onClick={async () => { await fetch(`${API}/schedule/${s.id}`, { method: 'DELETE', headers }); loadSchedules(); }}
                        className="p-1.5 rounded text-red-600 hover:bg-red-100"><i className="fas fa-trash" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add/Edit Doctor Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}>
              <div className="flex items-center justify-between p-5 border-b">
                <h2 className="text-lg font-bold text-blue-800">{editDoctor ? 'Edit Doctor' : 'Add New Doctor'}</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Full Name *</label>
                    <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Dr. Full Name" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Registration Number *</label>
                    <input required value={form.registration_number} onChange={e => setForm(f => ({ ...f, registration_number: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="MCI/State Reg No." />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Department *</label>
                    <select required value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                      {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Specialization *</label>
                    <input required value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. Interventional Cardiology" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Qualification *</label>
                    <input required value={form.qualification} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="MBBS, MD, DM..." />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Designation</label>
                    <select value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                      {DESIGNATIONS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Gender</label>
                    <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                      <option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Date of Birth</label>
                    <input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Phone</label>
                    <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Mobile number" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Emergency Phone</label>
                    <input value={form.emergency_phone} onChange={e => setForm(f => ({ ...f, emergency_phone: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Emergency contact" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Experience (Years)</label>
                    <input type="number" value={form.experience_years} onChange={e => setForm(f => ({ ...f, experience_years: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" min="0" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Joining Date</label>
                    <input type="date" value={form.joining_date} onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Consultation Fee (₹)</label>
                    <input type="number" value={form.consultation_fee} onChange={e => setForm(f => ({ ...f, consultation_fee: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" min="0" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Consulting Hours</label>
                    <input value={form.consulting_hours} onChange={e => setForm(f => ({ ...f, consulting_hours: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. 9:00 AM - 1:00 PM" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                      <option>Active</option><option>On Leave</option><option>Inactive</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Address</label>
                  <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" rows={2} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Available Days</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => (
                      <button type="button" key={day} onClick={() => toggleDay(day)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition ${form.availability_days?.includes(day) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Saving...' : (editDoctor ? 'Update Doctor' : 'Add Doctor')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
              <div className="flex items-center justify-between p-5 border-b">
                <h2 className="text-lg font-bold text-blue-800">Add Duty Schedule</h2>
                <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-red-500"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleScheduleSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Doctor Name *</label>
                    <DoctorSearchInput
                      required
                      value={scheduleForm.doctor_name}
                      onChange={(name, doc) => setScheduleForm(f => ({
                        ...f,
                        doctor_name: name,
                        ...(doc?.id ? { doctor_id: doc.id } : {}),
                      }))}
                      inputClass="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Date *</label>
                    <input type="date" required value={scheduleForm.date} onChange={e => setScheduleForm(f => ({ ...f, date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Shift</label>
                    <select value={scheduleForm.shift} onChange={e => setScheduleForm(f => ({ ...f, shift: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                      <option>Morning</option><option>Afternoon</option><option>Evening</option><option>Night</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Department</label>
                    <select value={scheduleForm.department} onChange={e => setScheduleForm(f => ({ ...f, department: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                      {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Start Time *</label>
                    <input type="time" required value={scheduleForm.start_time} onChange={e => setScheduleForm(f => ({ ...f, start_time: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">End Time *</label>
                    <input type="time" required value={scheduleForm.end_time} onChange={e => setScheduleForm(f => ({ ...f, end_time: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Room / OPD No.</label>
                    <input value={scheduleForm.room} onChange={e => setScheduleForm(f => ({ ...f, room: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. OPD-3" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Max Patients</label>
                    <input type="number" value={scheduleForm.max_patients} onChange={e => setScheduleForm(f => ({ ...f, max_patients: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" min="1" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Notes</label>
                  <textarea value={scheduleForm.notes} onChange={e => setScheduleForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" rows={2} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowScheduleModal(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Schedule'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Doctor Modal */}
      <AnimatePresence>
        {viewDoctor && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
              <div className="flex items-center justify-between p-5 border-b">
                <h2 className="text-lg font-bold text-blue-800">Doctor Profile</h2>
                <div className="flex gap-2">
                  <button onClick={() => printDoctorCard(viewDoctor)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 font-medium">
                    <i className="fas fa-print mr-1" /> Print
                  </button>
                  <button onClick={() => setViewDoctor(null)} className="text-gray-400 hover:text-red-500"><i className="fas fa-times" /></button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl">
                    {viewDoctor.name?.[0]}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{viewDoctor.name}</h3>
                    <p className="text-sm text-gray-500">{viewDoctor.designation} — {viewDoctor.department}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[viewDoctor.status]}`}>{viewDoctor.status}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Reg. Number', viewDoctor.registration_number],
                    ['Specialization', viewDoctor.specialization],
                    ['Qualification', viewDoctor.qualification],
                    ['Experience', viewDoctor.experience_years ? `${viewDoctor.experience_years} yrs` : '—'],
                    ['Phone', viewDoctor.phone || '—'],
                    ['Email', viewDoctor.email || '—'],
                    ['Emergency Phone', viewDoctor.emergency_phone || '—'],
                    ['Consultation Fee', viewDoctor.consultation_fee ? `₹${viewDoctor.consultation_fee}` : '—'],
                    ['Consulting Hours', viewDoctor.consulting_hours || '—'],
                    ['Joining Date', viewDoctor.joining_date || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className="font-medium text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>
                {viewDoctor.availability_days?.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Available Days</p>
                    <div className="flex flex-wrap gap-1">
                      {viewDoctor.availability_days.map(d => (
                        <span key={d} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{d}</span>
                      ))}
                    </div>
                  </div>
                )}
                {viewDoctor.address && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Address</p>
                    <p className="text-sm text-gray-800">{viewDoctor.address}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
