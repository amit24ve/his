import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_ADMISSIONS = 'https://cubehis.avopay.pro:5000/api/ipd';
const API_PATIENTS = 'https://cubehis.avopay.pro:5000/api/patients';
const WARDS = ['General Ward', 'Private Ward', 'ICU', 'NICU', 'CCU', 'PICU', 'Burns Ward', 'Surgical Ward', 'Maternity Ward', 'Oncology Ward'];
const DEPARTMENTS = ['Cardiology', 'Oncology', 'Orthopaedics', 'Neurology', 'General Medicine', 'Gynaecology', 'Urology', 'Gastroenterology', 'Pulmonology', 'Nephrology'];
const ROOM_TYPES = ['General', 'Semi-Private', 'Private', 'ICU', 'NICU', 'Isolation'];
const BED_TYPES = ['General', 'Semi-Private', 'Private', 'ICU', 'Electric', 'Traction'];

const STATUS_COLORS = { Admitted: 'bg-blue-100 text-blue-700', Discharged: 'bg-green-100 text-green-700', Transferred: 'bg-yellow-100 text-yellow-700', Critical: 'bg-red-100 text-red-700' };

const defaultAdmitForm = { patient_name: '', mrn: '', age: '', gender: 'Male', doctor_name: '', department: 'General Medicine', ward: 'General Ward', bed_number: '', room_number: '', admission_reason: '', admission_type: 'ELECTIVE', patient_category: 'PRIVATE', attendant_name: '', attendant_mobile: '', attendant_relation: '' };

const defaultRoomForm = { room_name: '', room_number: '', ward: 'General Ward', floor: '', room_type: 'General', capacity: 4 };
const defaultBedForm = { ward: 'General Ward', room_number: '', bed_number: '', bed_type: 'General', floor: '' };

export default function IPDWardPage() {
  const [admissions, setAdmissions] = useState([]);
  const [stats, setStats] = useState({});
  const [beds, setBeds] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [showBedModal, setShowBedModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [admitForm, setAdmitForm] = useState(defaultAdmitForm);
  const [roomForm, setRoomForm] = useState(defaultRoomForm);
  const [bedForm, setBedForm] = useState(defaultBedForm);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('admissions');
  const [filters, setFilters] = useState({ status: 'Admitted', ward: '' });
  const [search, setSearch] = useState('');
  const [dischargeModal, setDischargeModal] = useState(null);
  const [dischargeNotes, setDischargeNotes] = useState('');
  const [filterWardRooms, setFilterWardRooms] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  // Patient search for admit form
  const [patSearch, setPatSearch] = useState('');
  const [patResults, setPatResults] = useState([]);
  const [patSearchLoading, setPatSearchLoading] = useState(false);
  const [showPatDrop, setShowPatDrop] = useState(false);
  const patTimerRef = useRef();

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.ward) params.set('ward', filters.ward);
      if (search) params.set('search', search);
      const [aRes, sRes, bRes, rRes] = await Promise.all([
        fetch(`${API_ADMISSIONS}/admissions?${params}`, { headers }),
        fetch(`${API_ADMISSIONS}/stats`, { headers }),
        fetch(`${API_ADMISSIONS}/beds`, { headers }),
        fetch(`${API_ADMISSIONS}/rooms`, { headers }),
      ]);
      const aData = await aRes.json();
      const sData = await sRes.json();
      const bData = await bRes.json();
      const rData = await rRes.json();
      setAdmissions(aData.admissions || []);
      setStats(sData);
      setBeds(Array.isArray(bData) ? bData : []);
      setRooms(Array.isArray(rData) ? rData : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { setPage(1); load(); }, [filters]);

  // Patient MRN search for admit modal
  const doPatSearch = async (q) => {
    if (q.length < 2) { setPatResults([]); setShowPatDrop(false); return; }
    setPatSearchLoading(true);
    try {
      const res = await fetch(`${API_PATIENTS}/search?q=${encodeURIComponent(q)}`, { headers });
      const data = await res.json();
      setPatResults(Array.isArray(data) ? data : []);
      setShowPatDrop(true);
    } catch { setPatResults([]); }
    setPatSearchLoading(false);
  };

  const onPatSearchChange = (val) => {
    setPatSearch(val);
    clearTimeout(patTimerRef.current);
    patTimerRef.current = setTimeout(() => doPatSearch(val), 350);
  };

  const selectAdmitPatient = (p) => {
    setPatSearch(`${p.full_name} — ${p.mrn}`);
    setShowPatDrop(false);
    setAdmitForm(f => ({
      ...f,
      patient_id: p.id || '',
      patient_name: p.full_name || '',
      mrn: p.mrn || '',
      age: p.age ? String(p.age) : '',
      gender: p.gender || 'Male',
      patient_category: p.patient_category === 'INSURANCE' ? 'INSURANCE' : (p.patient_category || 'PRIVATE'),
      insurance_provider: p.insurance_provider || '',
      insurance_policy_number: p.insurance_policy_number || '',
      attendant_name: p.emergency_contact_name || '',
      attendant_mobile: p.emergency_contact_mobile || '',
      attendant_relation: p.emergency_contact_relation || '',
    }));
  };

  const handleAdmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API_ADMISSIONS}/admissions`, { method: 'POST', headers, body: JSON.stringify({ ...admitForm, age: admitForm.age ? parseInt(admitForm.age) : undefined }) });
      setShowAdmitModal(false);
      setAdmitForm(defaultAdmitForm);
      setPatSearch('');
      setPatResults([]);
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleAddRoom = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_ADMISSIONS}/rooms`, { method: 'POST', headers, body: JSON.stringify({ ...roomForm, capacity: parseInt(roomForm.capacity) }) });
      if (res.ok) { setShowRoomModal(false); setRoomForm(defaultRoomForm); load(); }
      else { const err = await res.json(); alert(err.detail || 'Error adding room'); }
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleAddBed = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_ADMISSIONS}/beds`, { method: 'POST', headers, body: JSON.stringify(bedForm) });
      if (res.ok) { setShowBedModal(false); setBedForm(defaultBedForm); load(); }
      else { const err = await res.json(); alert(err.detail || 'Error adding bed'); }
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleDeleteRoom = async (id) => {
    if (!confirm('Delete this room?')) return;
    await fetch(`${API_ADMISSIONS}/rooms/${id}`, { method: 'DELETE', headers });
    load();
  };

  const handleDischarge = async () => {
    if (!dischargeModal) return;
    await fetch(`${API_ADMISSIONS}/admissions/${dischargeModal.id}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'Discharged', discharge_date: new Date().toISOString().split('T')[0], discharge_summary: dischargeNotes }) });
    setDischargeModal(null);
    setDischargeNotes('');
    load();
  };

  const bedsByWard = beds.reduce((acc, b) => { acc[b.ward] = acc[b.ward] || []; acc[b.ward].push(b); return acc; }, {});
  const filteredRooms = filterWardRooms ? rooms.filter(r => r.ward === filterWardRooms) : rooms;
  const pagedAdmissions = admissions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(admissions.length / PAGE_SIZE);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">IPD / Ward Management</h1>
          <p className="text-gray-500 text-sm mt-1">Inpatient admissions, bed management & ward monitoring</p>
        </div>
        <button onClick={() => setShowAdmitModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition">
          <i className="fas fa-hospital-user" /> Admit Patient
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Currently Admitted', value: stats.currently_admitted ?? '—', icon: 'procedures', color: 'blue' },
          { label: 'Discharged Today', value: stats.discharged_today ?? '—', icon: 'sign-out-alt', color: 'green' },
          { label: 'Total Beds', value: stats.total_beds ?? '—', icon: 'bed', color: 'gray' },
          { label: 'Occupied', value: stats.occupied_beds ?? '—', icon: 'times-circle', color: 'red' },
          { label: 'Available', value: stats.available_beds ?? '—', icon: 'check-circle', color: 'teal' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`bg-white rounded-xl p-4 shadow border-l-4 border-${s.color}-500`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
                <p className={`text-2xl font-bold text-${s.color}-600 mt-1`}>{s.value}</p>
              </div>
              <div className={`w-10 h-10 bg-${s.color}-100 rounded-full flex items-center justify-center`}>
                <i className={`fas fa-${s.icon} text-${s.color}-500`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      {stats.occupancy_rate !== undefined && (
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Bed Occupancy Rate</span>
            <span className="text-lg font-bold text-blue-700">{stats.occupancy_rate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className={`h-3 rounded-full transition-all duration-500 ${stats.occupancy_rate > 80 ? 'bg-red-500' : stats.occupancy_rate > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${stats.occupancy_rate}%` }} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { key: 'admissions', label: 'Admissions', icon: 'hospital-user' },
          { key: 'rooms', label: 'Rooms & Beds', icon: 'door-open' },
          { key: 'beds', label: 'Bed Layout', icon: 'bed' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${activeTab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-blue-600'}`}>
            <i className={`fas fa-${t.icon} mr-1.5`} />{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'admissions' && (
        <>
          <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 items-center">
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">All Status</option>
              <option>Admitted</option><option>Discharged</option><option>Transferred</option>
            </select>
            <select value={filters.ward} onChange={e => setFilters(f => ({ ...f, ward: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">All Wards</option>
              {WARDS.map(w => <option key={w}>{w}</option>)}
            </select>
            <input type="text" placeholder="Search patient..." value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ml-auto w-48" />
          </div>

          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-blue-50">
                  <tr>
                    {['IPD No', 'Patient', 'MRN', 'Ward/Bed', 'Doctor', 'Dept', 'Admitted On', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                  ) : admissions.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-400">No admissions found</td></tr>
                  ) : pagedAdmissions.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{a.ipd_reg_no}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{a.patient_name}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{a.mrn || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{a.ward} — Bed {a.bed_number}</td>
                      <td className="px-4 py-3 text-gray-600">{a.doctor_name}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{a.department}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{a.admission_date}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        {a.status === 'Admitted' && (
                          <button onClick={() => setDischargeModal(a)} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition">Discharge</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between text-sm">
                <span className="text-gray-500 text-xs">
                  Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, admissions.length)} of {admissions.length} admissions
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(1)} disabled={page === 1}
                    className="px-2 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-100">
                    <i className="fas fa-angle-double-left" />
                  </button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-2 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-100">
                    <i className="fas fa-angle-left" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    return start + i;
                  }).map(p => (
                    <button key={p} onClick={() => setPage(p)}
                      className={`px-2.5 py-1 rounded text-xs border transition ${page === p ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-100'}`}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-2 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-100">
                    <i className="fas fa-angle-right" />
                  </button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                    className="px-2 py-1 rounded text-xs border disabled:opacity-40 hover:bg-gray-100">
                    <i className="fas fa-angle-double-right" />
                  </button>
                </div>
              </div>
            )}
            {totalPages <= 1 && (
              <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500">
                Showing {admissions.length} of {admissions.length} admissions
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'beds' && (
        <div className="space-y-4">
          {Object.keys(bedsByWard).length === 0 ? (
            <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">
              <i className="fas fa-bed text-5xl mb-3 block" />
              <p>No beds configured. Use "Add Bed" to start.</p>
            </div>
          ) : Object.entries(bedsByWard).map(([ward, wardBeds]) => (
            <div key={ward} className="bg-white rounded-xl shadow p-4">
              <h3 className="font-bold text-blue-700 mb-3 text-sm uppercase tracking-wide">{ward}</h3>
              <div className="flex flex-wrap gap-2">
                {wardBeds.map(b => (
                  <div key={b.id} title={b.is_occupied ? `Occupied${b.patient_id ? ': ' + b.patient_id : ''}` : `Available — ${b.bed_type}`}
                    className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center text-xs font-bold cursor-pointer border-2 transition
                      ${b.is_occupied ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-700'}`}>
                    <i className="fas fa-bed text-base mb-0.5" />
                    {b.bed_number}
                    {b.room_number && <span className="text-[10px] opacity-70">R{b.room_number}</span>}
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3 text-xs text-gray-500">
                <span><span className="inline-block w-3 h-3 rounded bg-green-400 mr-1" />Available: {wardBeds.filter(b => !b.is_occupied).length}</span>
                <span><span className="inline-block w-3 h-3 rounded bg-red-400 mr-1" />Occupied: {wardBeds.filter(b => b.is_occupied).length}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ ROOMS & BEDS TAB ══ */}
      {activeTab === 'rooms' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <select value={filterWardRooms} onChange={e => setFilterWardRooms(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
              <option value="">All Wards</option>
              {WARDS.map(w => <option key={w}>{w}</option>)}
            </select>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setShowRoomModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition">
                <i className="fas fa-plus" /> Add Room
              </button>
              <button onClick={() => setShowBedModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
                <i className="fas fa-plus" /> Add Bed
              </button>
            </div>
          </div>

          {filteredRooms.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-12 text-center text-gray-400">
              <i className="fas fa-door-open text-5xl mb-3 block text-teal-200" />
              <p>No rooms added yet. Click "Add Room" to configure ward rooms.</p>
              <button onClick={() => setShowRoomModal(true)} className="mt-4 px-6 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition">
                Add First Room
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredRooms.map(room => {
                const roomBeds = beds.filter(b => b.ward === room.ward && b.room_number === room.room_number);
                const occupiedBeds = roomBeds.filter(b => b.is_occupied).length;
                const availBeds = roomBeds.filter(b => !b.is_occupied).length;
                const pct = room.capacity > 0 ? Math.round((occupiedBeds / room.capacity) * 100) : 0;
                return (
                  <div key={room.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
                            <i className="fas fa-door-open text-teal-600" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-800">{room.room_name}</div>
                            <div className="text-xs text-gray-400 font-mono">Room #{room.room_number}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleDeleteRoom(room.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg text-xs" title="Delete Room">
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs mb-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg font-medium">{room.ward}</span>
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg font-medium">{room.room_type}</span>
                      {room.floor && <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg">Floor: {room.floor}</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div className="bg-gray-50 rounded-xl p-2">
                        <div className="text-lg font-black text-gray-700">{room.capacity}</div>
                        <div className="text-xs text-gray-400">Capacity</div>
                      </div>
                      <div className="bg-red-50 rounded-xl p-2">
                        <div className="text-lg font-black text-red-600">{occupiedBeds}</div>
                        <div className="text-xs text-gray-400">Occupied</div>
                      </div>
                      <div className="bg-green-50 rounded-xl p-2">
                        <div className="text-lg font-black text-green-600">{availBeds}</div>
                        <div className="text-xs text-gray-400">Available</div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-400' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400">Occupancy</span>
                      <span className="text-xs font-bold text-gray-600">{pct}%</span>
                    </div>
                    {/* Bed slots */}
                    {roomBeds.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {roomBeds.map(b => (
                          <div key={b.id} title={b.is_occupied ? 'Occupied' : `Available (${b.bed_type})`}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${b.is_occupied ? 'bg-red-100 border-red-300 text-red-700' : 'bg-green-100 border-green-300 text-green-700'}`}>
                            {b.bed_number}
                          </div>
                        ))}
                        <button onClick={() => { setBedForm(f => ({ ...f, ward: room.ward, room_number: room.room_number })); setShowBedModal(true); }}
                          className="w-8 h-8 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 text-xs transition">
                          <i className="fas fa-plus" />
                        </button>
                      </div>
                    )}
                    {roomBeds.length === 0 && (
                      <button onClick={() => { setBedForm(f => ({ ...f, ward: room.ward, room_number: room.room_number })); setShowBedModal(true); }}
                        className="mt-3 w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 transition">
                        <i className="fas fa-plus mr-1" />Add beds to this room
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Admit Patient Modal */}
      <AnimatePresence>
        {showAdmitModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
                <h2 className="text-lg font-bold text-blue-800"><i className="fas fa-hospital-user mr-2" />Admit Patient</h2>
                <button onClick={() => { setShowAdmitModal(false); setPatSearch(''); setPatResults([]); }} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleAdmit} className="p-6 space-y-4">

                {/* ── MRN Patient Search ── */}
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wide">
                    <i className="fas fa-search mr-1" />Search Registered Patient (MRN / Name / Mobile)
                  </p>
                  <div className="relative">
                    <input
                      value={patSearch}
                      onChange={e => onPatSearchChange(e.target.value)}
                      placeholder="Type MRN, patient name or mobile..."
                      className="w-full border-2 border-blue-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 pr-10"
                    />
                    {patSearchLoading && <i className="fas fa-spinner fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />}
                    {showPatDrop && patResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white rounded-xl shadow-2xl border border-gray-200 z-20 mt-1 max-h-52 overflow-y-auto">
                        {patResults.map((p, i) => (
                          <button key={p.id || i} type="button" onClick={() => selectAdmitPatient(p)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0 transition">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {p.full_name?.[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-800 text-sm">{p.full_name}</div>
                              <div className="text-xs text-gray-500 flex gap-3">
                                <span className="font-mono">{p.mrn}</span>
                                <span>{p.mobile}</span>
                                <span>{p.age ? `${p.age}Y` : ''} {p.gender?.[0] || ''}</span>
                              </div>
                            </div>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{p.patient_category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {showPatDrop && patResults.length === 0 && !patSearchLoading && patSearch.length >= 2 && (
                      <div className="absolute top-full left-0 right-0 bg-white rounded-xl shadow border border-gray-200 z-20 mt-1 px-4 py-3 text-sm text-gray-400">
                        No registered patient found — fill details manually below
                      </div>
                    )}
                  </div>
                  {admitForm.mrn && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-green-700 font-medium bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                      <i className="fas fa-check-circle text-green-600" />
                      Auto-filled: <span className="font-mono font-bold">{admitForm.mrn}</span> — {admitForm.patient_name}
                    </div>
                  )}
                </div>

                {/* ── Form grid ── */}
                <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Patient Name', key: 'patient_name', required: true, span: 2 },
                  { label: 'MRN', key: 'mrn' },
                  { label: 'Age', key: 'age', type: 'number' },
                  { label: 'Doctor Name', key: 'doctor_name', required: true },
                  { label: 'Department', key: 'department', type: 'select', options: DEPARTMENTS },
                  { label: 'Ward', key: 'ward', type: 'select', options: WARDS },
                  { label: 'Room Number', key: 'room_number' },
                  { label: 'Bed Number', key: 'bed_number', required: true },
                  { label: 'Admission Reason', key: 'admission_reason', required: true, span: 2 },
                  { label: 'Attendant Name', key: 'attendant_name' },
                  { label: 'Attendant Mobile', key: 'attendant_mobile' },
                  { label: 'Attendant Relation', key: 'attendant_relation' },
                ].map(f => (
                  <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
                    {f.type === 'select' ? (
                      <select value={admitForm[f.key]} onChange={e => setAdmitForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        {f.options.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={f.type || 'text'} required={f.required} value={admitForm[f.key]} onChange={e => setAdmitForm(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    )}
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Admission Type</label>
                  <select value={admitForm.admission_type} onChange={e => setAdmitForm(p => ({ ...p, admission_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option>ELECTIVE</option><option>EMERGENCY</option><option>DAY_CARE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Patient Category</label>
                  <select value={admitForm.patient_category} onChange={e => setAdmitForm(p => ({ ...p, patient_category: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option>PRIVATE</option><option>INSURANCE</option><option>GOVT</option>
                  </select>
                </div>
                <div className="col-span-2 flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => { setShowAdmitModal(false); setPatSearch(''); setPatResults([]); }} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                    {saving ? <><i className="fas fa-spinner fa-spin mr-1" />Admitting...</> : 'Admit Patient'}
                  </button>
                </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Room Modal ── */}
      <AnimatePresence>
        {showRoomModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-teal-50">
                <h2 className="text-lg font-bold text-teal-800"><i className="fas fa-door-open mr-2" />Add Room</h2>
                <button onClick={() => setShowRoomModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleAddRoom} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Room Name<span className="text-red-500">*</span></label>
                    <input required value={roomForm.room_name} onChange={e => setRoomForm(p => ({ ...p, room_name: e.target.value }))}
                      placeholder="e.g. Room 101" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Room Number<span className="text-red-500">*</span></label>
                    <input required value={roomForm.room_number} onChange={e => setRoomForm(p => ({ ...p, room_number: e.target.value }))}
                      placeholder="e.g. 101" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Ward<span className="text-red-500">*</span></label>
                    <select value={roomForm.ward} onChange={e => setRoomForm(p => ({ ...p, ward: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                      {WARDS.map(w => <option key={w}>{w}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Floor</label>
                    <input value={roomForm.floor} onChange={e => setRoomForm(p => ({ ...p, floor: e.target.value }))}
                      placeholder="e.g. Ground, 1st, 2nd" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Room Type</label>
                    <select value={roomForm.room_type} onChange={e => setRoomForm(p => ({ ...p, room_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                      {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Bed Capacity (Max Beds)</label>
                    <input type="number" min={1} max={50} value={roomForm.capacity} onChange={e => setRoomForm(p => ({ ...p, capacity: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowRoomModal(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-60">
                    {saving ? <><i className="fas fa-spinner fa-spin mr-1" />Adding...</> : 'Add Room'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Bed Modal ── */}
      <AnimatePresence>
        {showBedModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-indigo-50">
                <h2 className="text-lg font-bold text-indigo-800"><i className="fas fa-bed mr-2" />Add Bed</h2>
                <button onClick={() => setShowBedModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleAddBed} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Ward<span className="text-red-500">*</span></label>
                    <select required value={bedForm.ward} onChange={e => setBedForm(p => ({ ...p, ward: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                      {WARDS.map(w => <option key={w}>{w}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Room Number</label>
                    <input value={bedForm.room_number} onChange={e => setBedForm(p => ({ ...p, room_number: e.target.value }))}
                      placeholder="Link to room (optional)" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Bed Number<span className="text-red-500">*</span></label>
                    <input required value={bedForm.bed_number} onChange={e => setBedForm(p => ({ ...p, bed_number: e.target.value }))}
                      placeholder="e.g. B-01, ICU-3" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Bed Type</label>
                    <select value={bedForm.bed_type} onChange={e => setBedForm(p => ({ ...p, bed_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                      {BED_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Floor</label>
                    <input value={bedForm.floor} onChange={e => setBedForm(p => ({ ...p, floor: e.target.value }))} placeholder="e.g. Ground" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowBedModal(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                    {saving ? <><i className="fas fa-spinner fa-spin mr-1" />Adding...</> : 'Add Bed'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discharge Modal */}
      <AnimatePresence>
        {dischargeModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="px-6 py-4 border-b bg-green-50">
                <h2 className="text-lg font-bold text-green-800"><i className="fas fa-sign-out-alt mr-2" />Discharge Patient</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  <strong>{dischargeModal.patient_name}</strong> — {dischargeModal.ward}, Bed {dischargeModal.bed_number}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Discharge Summary</label>
                  <textarea rows={4} value={dischargeNotes} onChange={e => setDischargeNotes(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="Enter discharge summary..." />
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setDischargeModal(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                  <button onClick={handleDischarge} className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Confirm Discharge</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
