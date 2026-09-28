import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'https://cubehis.avopay.pro:5000/api/blood-bank';
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const STATUS_COLORS = { Available: 'bg-green-100 text-green-700', Issued: 'bg-red-100 text-red-700', Expired: 'bg-gray-100 text-gray-600', Reserved: 'bg-yellow-100 text-yellow-700' };

export default function BloodBankPage() {
  const [inventory, setInventory] = useState({});
  const [units, setUnits] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inventory');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [unitForm, setUnitForm] = useState({ blood_group: 'A+', donor_name: '', donor_mobile: '', units: 1, collection_date: new Date().toISOString().split('T')[0], expiry_date: '', component: 'Whole Blood', source: 'Voluntary' });
  const [issueForm, setIssueForm] = useState({ blood_group: 'A+', patient_name: '', mrn: '', doctor_name: '', ward: '', units_required: 1, purpose: '' });
  const [saving, setSaving] = useState(false);
  const [filterGroup, setFilterGroup] = useState('');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` };

  const load = async () => {
    setLoading(true);
    try {
      const [invRes, uRes, sRes] = await Promise.all([
        fetch(`${API}/inventory`, { headers }),
        fetch(`${API}/units`, { headers }),
        fetch(`${API}/stats`, { headers }),
      ]);
      const [invData, uData, sData] = await Promise.all([invRes.json(), uRes.json(), sRes.json()]);
      setInventory(invData.inventory || invData || {});
      setUnits(Array.isArray(uData.units) ? uData.units : []);
      setStats(sData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAddUnit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/units`, { method: 'POST', headers, body: JSON.stringify({ ...unitForm, units: parseInt(unitForm.units) }) });
      setShowAddModal(false);
      setUnitForm({ blood_group: 'A+', donor_name: '', donor_mobile: '', units: 1, collection_date: new Date().toISOString().split('T')[0], expiry_date: '', component: 'Whole Blood', source: 'Voluntary' });
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleIssue = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/issue`, { method: 'POST', headers, body: JSON.stringify({ ...issueForm, units_required: parseInt(issueForm.units_required) }) });
      setShowIssueModal(false);
      setIssueForm({ blood_group: 'A+', patient_name: '', mrn: '', doctor_name: '', ward: '', units_required: 1, purpose: '' });
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const totalAvailable = Object.values(inventory).reduce((sum, v) => sum + (v.available || 0), 0);
  const criticalGroups = BLOOD_GROUPS.filter(g => (inventory[g]?.available || 0) < 3);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-red-800">Blood Bank</h1>
          <p className="text-gray-500 text-sm mt-1">Inventory management, donations & blood issue</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowIssueModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow transition text-sm">
            <i className="fas fa-hand-holding-medical" /> Issue Blood
          </button>
          <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-white border text-red-600 rounded-lg hover:bg-red-50 font-medium shadow transition text-sm">
            <i className="fas fa-plus" /> Add Donation
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Available Units', value: stats.total_available ?? totalAvailable ?? '—', icon: 'tint', color: 'red' },
          { label: 'Issued Today', value: stats.issued_today ?? '—', icon: 'procedures', color: 'blue' },
          { label: 'Donations Today', value: stats.donations_today ?? '—', icon: 'heart', color: 'green' },
          { label: 'Critical Groups', value: criticalGroups.length || '0', icon: 'exclamation-triangle', color: 'yellow', subtitle: criticalGroups.join(', ') || 'None' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`bg-white rounded-xl p-4 shadow border-l-4 border-${s.color}-500`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase">{s.label}</p>
                <p className={`text-2xl font-bold text-${s.color}-600 mt-1`}>{s.value}</p>
                {s.subtitle && <p className="text-xs text-gray-400 mt-0.5">{s.subtitle}</p>}
              </div>
              <div className={`w-10 h-10 bg-${s.color}-100 rounded-full flex items-center justify-center`}>
                <i className={`fas fa-${s.icon} text-${s.color}-500`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Blood Group Inventory Grid */}
      <div>
        <h2 className="text-lg font-bold text-gray-700 mb-3">Blood Group Inventory</h2>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {BLOOD_GROUPS.map(bg => {
            const data = inventory[bg] || { available: 0, total: 0 };
            const pct = data.total > 0 ? (data.available / data.total) * 100 : 0;
            const critical = data.available < 3;
            const low = data.available < 10;
            return (
              <motion.div key={bg} initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: BLOOD_GROUPS.indexOf(bg) * 0.05 }}
                className={`bg-white rounded-xl shadow p-4 text-center border-2 cursor-pointer transition ${critical ? 'border-red-400' : low ? 'border-yellow-400' : 'border-green-300'} ${filterGroup === bg ? 'ring-2 ring-blue-400' : ''}`}
                onClick={() => setFilterGroup(filterGroup === bg ? '' : bg)}>
                <div className={`text-2xl font-black ${critical ? 'text-red-600' : low ? 'text-yellow-600' : 'text-green-700'}`}>{bg}</div>
                <div className="text-3xl font-bold text-gray-800 mt-1">{data.available}</div>
                <div className="text-xs text-gray-500">units</div>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full">
                  <div className={`h-1.5 rounded-full ${critical ? 'bg-red-500' : low ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                {critical && <div className="mt-1 text-xs text-red-500 font-bold">⚠ Critical</div>}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[{ key: 'inventory', label: 'Unit Log', icon: 'list' }, { key: 'crossmatch', label: 'Issue History', icon: 'history' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${activeTab === t.key ? 'border-red-600 text-red-700' : 'border-transparent text-gray-500 hover:text-red-600'}`}>
            <i className={`fas fa-${t.icon} mr-1.5`} />{t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-red-50">
              <tr>
                {['Blood Group', 'Component', 'Donor', 'Source', 'Collected', 'Expiry', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
              ) : units.filter(u => !filterGroup || u.blood_group === filterGroup).length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No blood units found</td></tr>
              ) : units.filter(u => !filterGroup || u.blood_group === filterGroup).map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-black text-red-700 text-lg">{u.blood_group}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs bg-pink-100 text-pink-700">{u.component}</span></td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.donor_name || '—'}</div>
                    <div className="text-xs text-gray-400">{u.donor_mobile || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{u.source}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{u.collection_date}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{u.expiry_date || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[u.status] || 'bg-gray-100 text-gray-600'}`}>{u.status || 'Available'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Donation Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-red-50">
                <h2 className="text-lg font-bold text-red-800"><i className="fas fa-heart mr-2" />Add Blood Donation</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleAddUnit} className="p-6 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Blood Group</label>
                  <select value={unitForm.blood_group} onChange={e => setUnitForm(p => ({ ...p, blood_group: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                    {BLOOD_GROUPS.map(bg => <option key={bg}>{bg}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Component</label>
                  <select value={unitForm.component} onChange={e => setUnitForm(p => ({ ...p, component: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                    {['Whole Blood', 'Packed RBC', 'Platelets', 'Plasma', 'Cryoprecipitate'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                {[
                  { label: 'Donor Name', key: 'donor_name' },
                  { label: 'Donor Mobile', key: 'donor_mobile' },
                  { label: 'Units', key: 'units', type: 'number' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                    <input type={f.type || 'text'} value={unitForm[f.key]} onChange={e => setUnitForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
                  <select value={unitForm.source} onChange={e => setUnitForm(p => ({ ...p, source: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                    <option>Voluntary</option><option>Replacement</option><option>Apheresis</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Collection Date</label>
                  <input type="date" value={unitForm.collection_date} onChange={e => setUnitForm(p => ({ ...p, collection_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
                  <input type="date" value={unitForm.expiry_date} onChange={e => setUnitForm(p => ({ ...p, expiry_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
                <div className="col-span-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">{saving ? 'Saving...' : 'Add Donation'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Issue Blood Modal */}
      <AnimatePresence>
        {showIssueModal && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b bg-red-50">
                <h2 className="text-lg font-bold text-red-800"><i className="fas fa-hand-holding-medical mr-2" />Issue Blood</h2>
                <button onClick={() => setShowIssueModal(false)} className="text-gray-400 hover:text-gray-700"><i className="fas fa-times" /></button>
              </div>
              <form onSubmit={handleIssue} className="p-6 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Blood Group <span className="text-red-500">*</span></label>
                  <select required value={issueForm.blood_group} onChange={e => setIssueForm(p => ({ ...p, blood_group: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                    {BLOOD_GROUPS.map(bg => <option key={bg}>{bg}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Units Required <span className="text-red-500">*</span></label>
                  <input required type="number" min={1} value={issueForm.units_required} onChange={e => setIssueForm(p => ({ ...p, units_required: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
                {[
                  { label: 'Patient Name', key: 'patient_name', required: true },
                  { label: 'MRN', key: 'mrn' },
                  { label: 'Doctor Name', key: 'doctor_name', required: true },
                  { label: 'Ward / Department', key: 'ward' },
                  { label: 'Purpose / Diagnosis', key: 'purpose' },
                ].map(f => (
                  <div key={f.key} className={f.key === 'purpose' ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && <span className="text-red-500">*</span>}</label>
                    <input type="text" required={f.required} value={issueForm[f.key]} onChange={e => setIssueForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                  </div>
                ))}
                <div className="col-span-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowIssueModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">{saving ? 'Processing...' : 'Issue Blood'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
