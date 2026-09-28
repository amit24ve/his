import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DoctorSearchInput from "../components/DoctorSearchInput";

const API = "https://cubehis.avopay.pro:5000/api/pharmacy";
const H_API = "https://cubehis.avopay.pro:5000/api/hospitals";
const PATIENTS_API = "https://cubehis.avopay.pro:5000/api/patients";
const DOCTORS_API = "https://cubehis.avopay.pro:5000/api/doctors";
const DEPTS_API = "https://cubehis.avopay.pro:5000/api/departments";
const token = () => localStorage.getItem("access_token") || "";
const H = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

const CATEGORIES = ["Tablet", "Capsule", "Syrup", "Injection", "Ointment", "Drops", "Inhaler", "Powder", "Solution", "Cream", "Gel", "Suspension", "Suppository", "Patch"];
const UNITS = ["Strip", "Bottle", "Vial", "Tube", "Sachet", "Ampule", "Box", "Pcs", "Pack"];
const SCHEDULES = ["OTC", "H", "H1", "X"];
const PAYMENT_MODES = ["Cash", "Card", "UPI", "Credit", "Insurance"];

// ---------------------------------------------------------------------------
// Current User helpers
// ---------------------------------------------------------------------------
function getCurrentUser() {
  try {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : {};
  } catch { return {}; }
}
function isAdmin(user) {
  const roles = Array.isArray(user?.roles)
    ? user.roles
    : typeof user?.roles === "string" ? [user.roles] : [];
  return roles.some(r => typeof r === "string" && (r.toLowerCase() === "admin" || r.toLowerCase() === "superadmin"));
}
function getUserHospitalId(user) {
  return user?.hospital_id || null;
}

// ---------------------------------------------------------------------------
// Shared UI Components
// ---------------------------------------------------------------------------
function HospitalBadge({ name, className = "" }) {
  if (!name) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200 ${className}`}>
      <i className="fas fa-hospital text-xs" />{name}
    </span>
  );
}

function HospitalSelector({ hospitals, selectedId, onChange, showAll = true }) {
  return (
    <div className="flex items-center gap-2">
      <i className="fas fa-hospital text-indigo-500" />
      <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Hospital:</label>
      <select
        value={selectedId || ""}
        onChange={e => onChange(e.target.value || null)}
        className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-[180px] bg-white"
      >
        {showAll && <option value="">All Hospitals</option>}
        {hospitals.map(h => (
          <option key={h.id} value={h.id}>{h.name} {h.city ? `(${h.city})` : ""}</option>
        ))}
      </select>
    </div>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-0.5 flex-wrap border-b mb-4">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${active === t.key ? "border-blue-600 text-blue-700 bg-blue-50 rounded-t" : "border-transparent text-gray-500 hover:text-blue-600"}`}>
          <i className={`fas fa-${t.icon} text-xs`} />{t.label}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, icon, color, sub, onClick }) {
  const cls = {
    blue: "border-blue-500 bg-blue-50 text-blue-700",
    green: "border-green-500 bg-green-50 text-green-700",
    yellow: "border-yellow-500 bg-yellow-50 text-yellow-700",
    red: "border-red-500 bg-red-50 text-red-700",
    purple: "border-purple-500 bg-purple-50 text-purple-700",
    indigo: "border-indigo-500 bg-indigo-50 text-indigo-700",
    orange: "border-orange-500 bg-orange-50 text-orange-700",
  };
  const c = cls[color] || cls.blue;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`bg-white rounded-xl p-4 shadow border-l-4 ${c.split(" ")[0]} ${onClick ? "cursor-pointer hover:shadow-md" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${c.split(" ")[2]}`}>{value ?? "—"}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${c.split(" ")[1]}`}>
          <i className={`fas fa-${icon} ${c.split(" ")[2]}`} />
        </div>
      </div>
    </motion.div>
  );
}

function Modal({ open, onClose, title, icon, children, wide }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-4xl" : "max-w-2xl"} max-h-[93vh] flex flex-col`}
          initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl flex-shrink-0">
            <h2 className="text-base font-bold text-white"><i className={`fas fa-${icon} mr-2`} />{title}</h2>
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl"><i className="fas fa-times" /></button>
          </div>
          <div className="overflow-y-auto flex-1 p-5">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function InputField({ label, name, value, onChange, type = "text", required, options, placeholder, col2, min, step }) {
  return (
    <div className={col2 ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {options ? (
        <select name={name} value={value} onChange={onChange} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          {options.map(o => <option key={typeof o === "object" ? o.value : o} value={typeof o === "object" ? o.value : o}>{typeof o === "object" ? o.label : o}</option>)}
        </select>
      ) : (
        <input type={type} name={name} value={value} onChange={onChange} required={required} placeholder={placeholder} min={min} step={step}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADMIN MULTI-HOSPITAL OVERVIEW
// ---------------------------------------------------------------------------
function MultiHospitalOverview({ onSelectHospital }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/admin/multi-hospital-summary`, { headers: H() })
      .then(r => r.json()).then(d => { setData(d.hospitals || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  if (loading) return <div className="py-10 text-center text-gray-400"><i className="fas fa-spinner fa-spin text-2xl" /></div>;
  if (!data.length) return <div className="py-10 text-center text-gray-400">No hospital data found</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">
          <i className="fas fa-hospital-alt text-indigo-500" />All Hospitals — Pharmacy Overview
        </h2>
        <span className="text-xs text-gray-400">{data.length} hospitals</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.map(h => (
          <motion.div key={h.hospital_id}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow border border-gray-100 p-5 hover:shadow-lg transition cursor-pointer group"
            onClick={() => onSelectHospital(h.hospital_id, h.hospital_name)}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-800 group-hover:text-blue-700 transition text-sm">{h.hospital_name}</h3>
                {h.city && <p className="text-xs text-gray-400 mt-0.5"><i className="fas fa-map-marker-alt mr-1" />{h.city}</p>}
              </div>
              <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center">
                <i className="fas fa-hospital text-indigo-600 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 bg-blue-50 rounded-lg">
                <p className="text-lg font-bold text-blue-700">{h.total_medicines}</p>
                <p className="text-xs text-gray-500">Medicines</p>
              </div>
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <p className="text-lg font-bold text-green-700">₹{h.today_revenue}</p>
                <p className="text-xs text-gray-500">Today Revenue</p>
              </div>
              <div className="text-center p-2 bg-yellow-50 rounded-lg">
                <p className="text-lg font-bold text-yellow-700">{h.today_bills}</p>
                <p className="text-xs text-gray-500">Today Bills</p>
              </div>
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <p className="text-lg font-bold text-red-700">{h.low_stock_batches}</p>
                <p className="text-xs text-gray-500">Low Stock</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t flex justify-between text-xs text-gray-500">
              <span><i className="fas fa-file-invoice mr-1 text-blue-400" />Pending POs: <b className="text-blue-600">{h.pending_pos}</b></span>
              <span><i className="fas fa-warehouse mr-1 text-green-400" />MRP: <b className="text-green-600">₹{h.stock_mrp_value}</b></span>
            </div>
            <div className="mt-2 text-center text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition">
              Click to view pharmacy →
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DASHBOARD TAB
// ---------------------------------------------------------------------------
function DashboardTab({ hospitalId, onTabChange }) {
  const [dashboard, setDashboard] = useState(null);
  useEffect(() => {
    const p = hospitalId ? `?hospital_id=${hospitalId}` : "";
    fetch(`${API}/dashboard${p}`, { headers: H() })
      .then(r => r.json()).then(setDashboard).catch(() => { });
  }, [hospitalId]);
  if (!dashboard) return <div className="text-center py-16 text-gray-400"><i className="fas fa-spinner fa-spin text-2xl mb-3" /><div>Loading dashboard...</div></div>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Medicines" value={dashboard.medicines?.total_active} icon="pills" color="blue" onClick={() => onTabChange("medicines")} />
        <StatCard label="Low Stock" value={dashboard.medicines?.low_stock} icon="exclamation-triangle" color="yellow" onClick={() => onTabChange("alerts")} />
        <StatCard label="Out of Stock" value={dashboard.medicines?.out_of_stock} icon="times-circle" color="red" onClick={() => onTabChange("alerts")} />
        <StatCard label="Near Expiry (90d)" value={dashboard.medicines?.expiry_alerts_90d} icon="calendar-times" color="purple" sub={`${dashboard.medicines?.expired_in_stock || 0} expired`} onClick={() => onTabChange("alerts")} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today's Bills" value={dashboard.today_billing?.total_bills} icon="receipt" color="green" sub={`₹${dashboard.today_billing?.revenue || 0}`} onClick={() => onTabChange("billing")} />
        <StatCard label="Monthly Revenue" value={`₹${dashboard.monthly_billing?.revenue || 0}`} icon="chart-line" color="indigo" sub={`${dashboard.monthly_billing?.total_bills || 0} bills`} />
        <StatCard label="Medicines" value={dashboard.medicines?.total_active} icon="pills" color="blue" onClick={() => onTabChange("medicines")} />
        <StatCard label="Stock Batches" value={dashboard.medicines?.total_batches} icon="boxes" color="purple" onClick={() => onTabChange("stock")} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white rounded-xl shadow p-5">
          <h3 className="text-sm font-bold text-gray-600 mb-4 flex items-center gap-2"><i className="fas fa-warehouse text-blue-400" />Stock Valuation</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-yellow-50 rounded-xl">
              <p className="text-xs text-gray-500 uppercase font-semibold">Purchase Value</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">₹{dashboard.stock_valuation?.purchase_value || 0}</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <p className="text-xs text-gray-500 uppercase font-semibold">MRP Value</p>
              <p className="text-2xl font-bold text-green-700 mt-1">₹{dashboard.stock_valuation?.mrp_value || 0}</p>
            </div>
          </div>
          <div className="mt-3 text-center text-xs text-gray-400">
            Potential profit: <span className="font-semibold text-green-600">₹{((dashboard.stock_valuation?.mrp_value || 0) - (dashboard.stock_valuation?.purchase_value || 0)).toFixed(2)}</span>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-5 text-white">
          <h3 className="text-sm font-bold mb-3 opacity-90">Quick Actions</h3>
          <div className="space-y-2">
            {[{ label: "Add Medicine", icon: "pills", tab: "medicines" }, { label: "Receive Stock", icon: "truck-loading", tab: "grn" }, { label: "New Bill", icon: "receipt", tab: "billing" }, { label: "View Alerts", icon: "bell", tab: "alerts" }, { label: "Reports", icon: "chart-bar", tab: "reports" }].map(a => (
              <button key={a.tab} onClick={() => onTabChange(a.tab)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition text-left">
                <i className={`fas fa-${a.icon} text-xs w-4`} />{a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MEDICINE MASTER TAB
// ---------------------------------------------------------------------------
function MedicineMasterTab({ hospitalId }) {
  const [medicines, setMedicines] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [outStock, setOutStock] = useState(false);
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", generic_name: "", brand_name: "", category: "Tablet", sub_category: "", manufacturer: "", hsn_code: "", gst_percent: 0, composition: "", unit: "Strip", pack_size: "", schedule: "OTC", storage_condition: "", mrp: "", purchase_price: "", selling_price: "", reorder_level: 10, max_stock_level: "", is_controlled: false, is_active: true, rack_location: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page, limit: 20 });
    if (search) p.set("search", search);
    if (catFilter) p.set("category", catFilter);
    if (lowStock) p.set("low_stock", "true");
    if (outStock) p.set("out_of_stock", "true");
    if (hospitalId) p.set("hospital_id", hospitalId);
    const r = await fetch(`${API}/medicines?${p}`, { headers: H() });
    const d = await r.json();
    setMedicines(d.medicines || []);
    setTotal(d.total || 0);
    setLoading(false);
  }, [search, catFilter, lowStock, outStock, page, hospitalId]);

  useEffect(() => { load(); }, [load]);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };
  const openAdd = () => { setEditId(null); setForm({ name: "", generic_name: "", brand_name: "", category: "Tablet", sub_category: "", manufacturer: "", hsn_code: "", gst_percent: 0, composition: "", unit: "Strip", pack_size: "", schedule: "OTC", storage_condition: "", mrp: "", purchase_price: "", selling_price: "", reorder_level: 10, max_stock_level: "", is_controlled: false, is_active: true, rack_location: "", notes: "" }); setShowAdd(true); };
  const openEdit = (m) => {
    setEditId(m.id);
    setForm({ name: m.name || "", generic_name: m.generic_name || "", brand_name: m.brand_name || "", category: m.category || "Tablet", sub_category: m.sub_category || "", manufacturer: m.manufacturer || "", hsn_code: m.hsn_code || "", gst_percent: m.gst_percent || 0, composition: m.composition || "", unit: m.unit || "Strip", pack_size: m.pack_size || "", schedule: m.schedule || "OTC", storage_condition: m.storage_condition || "", mrp: m.mrp || "", purchase_price: m.purchase_price || "", selling_price: m.selling_price || "", reorder_level: m.reorder_level || 10, max_stock_level: m.max_stock_level || "", is_controlled: m.is_controlled || false, is_active: m.is_active !== false, rack_location: m.rack_location || "", notes: m.notes || "" });
    setShowAdd(true);
  };
  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true);
    const body = { ...form, mrp: parseFloat(form.mrp) || 0, purchase_price: parseFloat(form.purchase_price) || undefined, selling_price: parseFloat(form.selling_price) || undefined, gst_percent: parseFloat(form.gst_percent) || 0, reorder_level: parseInt(form.reorder_level) || 10, pack_size: parseInt(form.pack_size) || undefined, max_stock_level: parseInt(form.max_stock_level) || undefined };
    if (hospitalId) body.hospital_id = hospitalId;
    const url = editId ? `${API}/medicines/${editId}` : `${API}/medicines`;
    const method = editId ? "PUT" : "POST";
    await fetch(url, { method, headers: H(), body: JSON.stringify(body) });
    setShowAdd(false); load(); setSaving(false);
  };
  const handleDelete = async id => {
    if (!window.confirm("Deactivate this medicine?")) return;
    await fetch(`${API}/medicines/${id}`, { method: "DELETE", headers: H() });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Search name / generic / composition..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-60" />
        <select value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={lowStock} onChange={e => setLowStock(e.target.checked)} className="rounded" />Low Stock</label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={outStock} onChange={e => setOutStock(e.target.checked)} className="rounded" />Out of Stock</label>
        <button onClick={openAdd} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5"><i className="fas fa-plus" />Add Medicine</button>
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b text-xs text-gray-500">Showing {medicines.length} of {total} medicines</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-blue-50">
              <tr>{["Name", "Generic", "Category", "Schedule", "MRP", "Sell Price", "Stock", "Reorder", "Rack", "Actions"].map(h => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={10} className="py-10 text-center text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                : medicines.length === 0 ? <tr><td colSpan={10} className="py-10 text-center text-gray-400">No medicines found</td></tr>
                  : medicines.map(m => (
                    <tr key={m.id} className={`hover:bg-gray-50 transition ${m.is_out_of_stock ? "bg-red-50" : m.is_low_stock ? "bg-yellow-50" : ""}`}>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-gray-900">{m.name}</div>
                        {m.brand_name && <div className="text-xs text-gray-400">{m.brand_name}</div>}
                        {m.is_controlled && <span className="text-xs text-red-500 font-medium">⚠ Controlled</span>}
                        {!m.is_active && <span className="text-xs text-gray-400 ml-1">(Inactive)</span>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[120px]"><div className="truncate">{m.generic_name || "—"}</div></td>
                      <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">{m.category}</span></td>
                      <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded text-xs font-medium ${m.schedule === "X" ? "bg-red-100 text-red-700" : m.schedule === "H" || m.schedule === "H1" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>{m.schedule || "OTC"}</span></td>
                      <td className="px-3 py-2.5 font-medium text-gray-700">₹{m.mrp}</td>
                      <td className="px-3 py-2.5 text-green-700 font-medium">₹{m.selling_price || m.mrp}</td>
                      <td className="px-3 py-2.5">
                        <span className={`font-bold ${m.is_out_of_stock ? "text-red-600" : m.is_low_stock ? "text-yellow-600" : "text-green-600"}`}>{m.total_stock ?? 0}</span>
                        <span className="text-xs text-gray-400 ml-1">{m.unit}</span>
                        {m.is_low_stock && !m.is_out_of_stock && <span className="ml-1 text-xs text-yellow-500">⚠</span>}
                        {m.is_out_of_stock && <span className="ml-1 text-xs text-red-500">Out</span>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs">{m.reorder_level}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{m.rack_location || "—"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-blue-100 text-blue-600" title="Edit"><i className="fas fa-edit text-xs" /></button>
                          <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded hover:bg-red-100 text-red-500" title="Deactivate"><i className="fas fa-trash text-xs" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
          <span className="text-sm text-gray-500">Page {page} · {total} total</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
        </div>
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editId ? "Edit Medicine" : "Add Medicine"} icon="pills" wide>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <InputField label="Medicine Name" name="name" value={form.name} onChange={handleChange} required col2 />
          <InputField label="Generic Name" name="generic_name" value={form.generic_name} onChange={handleChange} />
          <InputField label="Brand Name" name="brand_name" value={form.brand_name} onChange={handleChange} />
          <InputField label="Category" name="category" value={form.category} onChange={handleChange} options={CATEGORIES} />
          <InputField label="Sub Category" name="sub_category" value={form.sub_category} onChange={handleChange} placeholder="e.g. Antibiotic" />
          <InputField label="Manufacturer" name="manufacturer" value={form.manufacturer} onChange={handleChange} />
          <InputField label="HSN Code" name="hsn_code" value={form.hsn_code} onChange={handleChange} />
          <InputField label="Composition" name="composition" value={form.composition} onChange={handleChange} col2 placeholder="Active ingredient + strength" />
          <InputField label="Unit" name="unit" value={form.unit} onChange={handleChange} options={UNITS} />
          <InputField label="Pack Size" name="pack_size" value={form.pack_size} onChange={handleChange} type="number" placeholder="e.g. 10" />
          <InputField label="Schedule" name="schedule" value={form.schedule} onChange={handleChange} options={SCHEDULES} />
          <InputField label="Storage Condition" name="storage_condition" value={form.storage_condition} onChange={handleChange} placeholder="Room temp / Refrigerate" />
          <InputField label="MRP (₹)" name="mrp" value={form.mrp} onChange={handleChange} type="number" required step="0.01" />
          <InputField label="Purchase Price (₹)" name="purchase_price" value={form.purchase_price} onChange={handleChange} type="number" step="0.01" />
          <InputField label="Selling Price (₹)" name="selling_price" value={form.selling_price} onChange={handleChange} type="number" step="0.01" />
          <InputField label="GST %" name="gst_percent" value={form.gst_percent} onChange={handleChange} type="number" step="0.01" />
          <InputField label="Reorder Level" name="reorder_level" value={form.reorder_level} onChange={handleChange} type="number" />
          <InputField label="Max Stock Level" name="max_stock_level" value={form.max_stock_level} onChange={handleChange} type="number" />
          <InputField label="Rack Location" name="rack_location" value={form.rack_location} onChange={handleChange} placeholder="e.g. A3-R2" />
          <InputField label="Notes" name="notes" value={form.notes} onChange={handleChange} />
          <div className="col-span-2 flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"><input type="checkbox" name="is_controlled" checked={form.is_controlled} onChange={handleChange} className="rounded" />Controlled Substance</label>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"><input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} className="rounded" />Active</label>
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? <><i className="fas fa-spinner fa-spin mr-1" />Saving...</> : editId ? "Update Medicine" : "Add Medicine"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STOCK TAB
// ---------------------------------------------------------------------------
function StockTab({ hospitalId }) {
  const [stock, setStock] = useState([]); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(false);
  const [loc, setLoc] = useState(""); const [expDays, setExpDays] = useState(""); const [page, setPage] = useState(1);
  const [showTransfer, setShowTransfer] = useState(false);
  const [tForm, setTForm] = useState({ medicine_id: "", medicine_name: "", tMedSearch: "", tMedSugs: [], batch_number: "", from_location: "", to_location: "", quantity: "", reason: "", transferred_by: "" });
  const [locations, setLocations] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page, limit: 50 });
    if (loc) p.set("location", loc);
    if (expDays) p.set("expiring_in_days", expDays);
    if (hospitalId) p.set("hospital_id", hospitalId);
    const r = await fetch(`${API}/stock?${p}`, { headers: H() });
    const d = await r.json();
    setStock(d.stock || []); setTotal(d.total || 0); setLoading(false);
  }, [loc, expDays, page, hospitalId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const p = hospitalId ? `?hospital_id=${hospitalId}` : "";
    fetch(`${API}/stock/locations${p}`, { headers: H() }).then(r => r.json()).then(d => setLocations(d.locations || []));
  }, [hospitalId]);

  const handleTransfer = async e => {
    e.preventDefault();
    const body = { medicine_id: tForm.medicine_id, medicine_name: tForm.medicine_name, batch_number: tForm.batch_number, from_location: tForm.from_location, to_location: tForm.to_location, quantity: parseInt(tForm.quantity), reason: tForm.reason, transferred_by: tForm.transferred_by };
    if (hospitalId) body.hospital_id = hospitalId;
    await fetch(`${API}/stock/transfer`, { method: "POST", headers: H(), body: JSON.stringify(body) });
    setShowTransfer(false); load();
  };

  // Medicine search for transfer modal
  const searchTMed = async (q) => {
    if (q.length < 2) { setTForm(f => ({ ...f, tMedSugs: [] })); return; }
    const p = new URLSearchParams({ q, limit: 8 });
    if (hospitalId) p.set("hospital_id", hospitalId);
    const r = await fetch(`${API}/medicines/search?${p}`, { headers: H() });
    const d = await r.json();
    setTForm(f => ({ ...f, tMedSugs: d.medicines || [] }));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {locations.slice(0, 4).map(l => (
          <div key={l.location} className="bg-white rounded-xl shadow p-4 border-l-4 border-indigo-400">
            <p className="text-xs font-semibold text-gray-500 uppercase">{l.location}</p>
            <p className="text-xl font-bold text-indigo-600 mt-1">{l.total_qty}</p>
            <p className="text-xs text-gray-400">{l.total_batches} batches</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Filter by location..." value={loc} onChange={e => { setLoc(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-44" />
        <input type="number" placeholder="Expiring in N days" value={expDays} onChange={e => { setExpDays(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-44" />
        <button onClick={() => setShowTransfer(true)} className="ml-auto px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-1.5"><i className="fas fa-exchange-alt" />Transfer Stock</button>
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b text-xs text-gray-500">{total} batch records</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-blue-50"><tr>{["Medicine", "Batch No.", "Expiry", "Location", "Qty", "Buy Price", "MRP", "Status"].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-blue-700 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={8} className="py-10 text-center text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                : stock.length === 0 ? <tr><td colSpan={8} className="py-10 text-center text-gray-400">No stock records</td></tr>
                  : stock.map(s => {
                    const today = new Date().toISOString().split("T")[0];
                    const exp = s.expiry_date || "";
                    const isExp = exp && exp < today;
                    const isNear = exp && !isExp && exp <= new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];
                    return <tr key={s.id} className={`hover:bg-gray-50 ${isExp ? "bg-red-50" : isNear ? "bg-yellow-50" : ""}`}>
                      <td className="px-3 py-2.5 font-medium text-gray-900">{s.medicine_name}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-blue-700">{s.batch_number}</td>
                      <td className="px-3 py-2.5 text-xs"><span className={isExp ? "text-red-600 font-semibold" : isNear ? "text-yellow-600 font-medium" : "text-gray-500"}>{exp || "—"}</span>{isExp && <span className="ml-1 text-xs text-red-500 font-bold">EXPIRED</span>}{isNear && <span className="ml-1 text-xs text-yellow-500">Near</span>}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{s.location}</td>
                      <td className="px-3 py-2.5 font-bold text-blue-700">{s.quantity}</td>
                      <td className="px-3 py-2.5 text-gray-600">₹{s.purchase_price || "—"}</td>
                      <td className="px-3 py-2.5 text-green-700 font-medium">₹{s.mrp || "—"}</td>
                      <td className="px-3 py-2.5">{isExp ? <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-600">Expired</span> : isNear ? <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-600">Near Expiry</span> : <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-600">OK</span>}</td>
                    </tr>;
                  })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
          <span className="text-sm text-gray-500">Page {page} · {total} total</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= total} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
        </div>
      </div>
      <Modal open={showTransfer} onClose={() => { setShowTransfer(false); setTForm({ medicine_id: "", medicine_name: "", tMedSearch: "", tMedSugs: [], batch_number: "", from_location: "", to_location: "", quantity: "", reason: "", transferred_by: "" }); }} title="Transfer Stock" icon="exchange-alt">
        <form onSubmit={handleTransfer} className="grid grid-cols-2 gap-4">
          {/* Medicine search */}
          <div className="col-span-2 relative">
            <label className="block text-xs font-medium text-gray-600 mb-1">Medicine <span className="text-red-500">*</span></label>
            <input type="text" placeholder="Search medicine from stock..."
              value={tForm.tMedSearch || tForm.medicine_name}
              onChange={e => { setTForm(f => ({ ...f, tMedSearch: e.target.value, medicine_name: e.target.value })); searchTMed(e.target.value); }}
              onBlur={() => setTimeout(() => setTForm(f => ({ ...f, tMedSugs: [] })), 200)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" required />
            {(tForm.tMedSugs || []).length > 0 && (
              <div className="absolute z-50 mt-1 bg-white border rounded-xl shadow-xl w-full overflow-hidden">
                {tForm.tMedSugs.map((m, i) => (
                  <button key={i} type="button" onMouseDown={() => setTForm(f => ({ ...f, medicine_id: m.id, medicine_name: m.name, tMedSearch: m.name, tMedSugs: [] }))}
                    className="w-full px-3 py-2.5 text-left hover:bg-orange-50 border-b last:border-0 text-sm">
                    <div className="font-semibold text-gray-800">{m.name}</div>
                    <div className="text-xs text-gray-400">{m.generic_name} · Stock: {m.total_stock ?? 0} {m.unit} · MRP ₹{m.mrp}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <InputField label="Batch Number" name="batch_number" value={tForm.batch_number} onChange={e => setTForm(f => ({ ...f, [e.target.name]: e.target.value }))} required placeholder="e.g. BT-001" />
          <InputField label="Quantity to Transfer" name="quantity" value={tForm.quantity} onChange={e => setTForm(f => ({ ...f, [e.target.name]: e.target.value }))} type="number" required />
          <InputField label="From Location" name="from_location" value={tForm.from_location} onChange={e => setTForm(f => ({ ...f, [e.target.name]: e.target.value }))} required placeholder="Main Pharmacy" />
          <InputField label="To Location" name="to_location" value={tForm.to_location} onChange={e => setTForm(f => ({ ...f, [e.target.name]: e.target.value }))} required placeholder="OPD Store" />
          <InputField label="Transferred By" name="transferred_by" value={tForm.transferred_by} onChange={e => setTForm(f => ({ ...f, [e.target.name]: e.target.value }))} placeholder="Staff name" />
          <InputField label="Reason" name="reason" value={tForm.reason} onChange={e => setTForm(f => ({ ...f, [e.target.name]: e.target.value }))} placeholder="e.g. OPD demand" col2 />
          <div className="col-span-2 flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setShowTransfer(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-6 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">Transfer Stock</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUPPLIERS TAB
// ---------------------------------------------------------------------------
function SuppliersTab({ hospitalId }) {
  const [suppliers, setSuppliers] = useState([]); const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", contact_person: "", phone: "", email: "", address: "", gst_number: "", drug_license_number: "", payment_terms: "", credit_limit: "", notes: "" });
  const [saving, setSaving] = useState(false); const [editId, setEditId] = useState(null);

  const load = async () => {
    setLoading(true);
    const p = hospitalId ? `?limit=100&hospital_id=${hospitalId}` : "?limit=100";
    const r = await fetch(`${API}/suppliers${p}`, { headers: H() });
    const d = await r.json();
    setSuppliers(d.suppliers || []); setLoading(false);
  };
  useEffect(() => { load(); }, [hospitalId]);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const openAdd = () => { setEditId(null); setForm({ name: "", contact_person: "", phone: "", email: "", address: "", gst_number: "", drug_license_number: "", payment_terms: "", credit_limit: "", notes: "" }); setShowAdd(true); };
  const openEdit = s => { setEditId(s.id); setForm({ name: s.name || "", contact_person: s.contact_person || "", phone: s.phone || "", email: s.email || "", address: s.address || "", gst_number: s.gst_number || "", drug_license_number: s.drug_license_number || "", payment_terms: s.payment_terms || "", credit_limit: s.credit_limit || "", notes: s.notes || "" }); setShowAdd(true); };
  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true);
    const url = editId ? `${API}/suppliers/${editId}` : `${API}/suppliers`;
    const method = editId ? "PUT" : "POST";
    const body = { ...form, credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : undefined, is_active: true };
    if (hospitalId && !editId) body.hospital_id = hospitalId;
    await fetch(url, { method, headers: H(), body: JSON.stringify(body) });
    setShowAdd(false); load(); setSaving(false);
  };
  const handleDelete = async id => {
    if (!window.confirm("Deactivate this supplier?")) return;
    await fetch(`${API}/suppliers/${id}`, { method: "DELETE", headers: H() }); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5"><i className="fas fa-plus" />Add Supplier</button></div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-blue-50"><tr>{["Name", "Contact", "Phone", "GST No.", "Drug License", "Payment Terms", "Credit Limit", "Actions"].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-blue-700 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={8} className="py-10 text-center text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                : suppliers.length === 0 ? <tr><td colSpan={8} className="py-10 text-center text-gray-400">No suppliers</td></tr>
                  : suppliers.map(s => <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-medium text-gray-900">{s.name}</td>
                    <td className="px-3 py-2.5 text-gray-600">{s.contact_person || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-600">{s.phone || "—"}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-gray-500">{s.gst_number || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{s.drug_license_number || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-500">{s.payment_terms || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-500">{s.credit_limit ? `₹${s.credit_limit}` : "—"}</td>
                    <td className="px-3 py-2.5"><div className="flex gap-1"><button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-blue-100 text-blue-600"><i className="fas fa-edit text-xs" /></button><button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-red-100 text-red-500"><i className="fas fa-trash text-xs" /></button></div></td>
                  </tr>)}
            </tbody>
          </table>
        </div>
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editId ? "Edit Supplier" : "Add Supplier"} icon="truck">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <InputField label="Supplier Name" name="name" value={form.name} onChange={handleChange} required col2 />
          <InputField label="Contact Person" name="contact_person" value={form.contact_person} onChange={handleChange} />
          <InputField label="Phone" name="phone" value={form.phone} onChange={handleChange} />
          <InputField label="Email" name="email" value={form.email} onChange={handleChange} type="email" col2 />
          <InputField label="Address" name="address" value={form.address} onChange={handleChange} col2 />
          <InputField label="GST Number" name="gst_number" value={form.gst_number} onChange={handleChange} />
          <InputField label="Drug License No." name="drug_license_number" value={form.drug_license_number} onChange={handleChange} />
          <InputField label="Payment Terms" name="payment_terms" value={form.payment_terms} onChange={handleChange} placeholder="Net 30, COD..." />
          <InputField label="Credit Limit (₹)" name="credit_limit" value={form.credit_limit} onChange={handleChange} type="number" step="0.01" />
          <InputField label="Notes" name="notes" value={form.notes} onChange={handleChange} col2 />
          <div className="col-span-2 flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? <><i className="fas fa-spinner fa-spin mr-1" />Saving...</> : editId ? "Update" : "Add Supplier"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PURCHASE ORDERS TAB
// ---------------------------------------------------------------------------
function PurchaseOrdersTab({ hospitalId }) {
  const [pos, setPOs] = useState([]); const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ supplier_id: "", supplier_name: "", po_date: "", expected_delivery: "", notes: "", items: [{ medicine_id: "", medicine_name: "", quantity: 1, purchase_price: "", gst_percent: 0, discount_percent: 0 }] });
  const [saving, setSaving] = useState(false); const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ limit: 50 });
    if (statusFilter) p.set("status", statusFilter);
    if (hospitalId) p.set("hospital_id", hospitalId);
    const r = await fetch(`${API}/purchase-orders?${p}`, { headers: H() });
    const d = await r.json();
    setPOs(d.purchase_orders || []); setLoading(false);
  }, [statusFilter, hospitalId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const p = hospitalId ? `?limit=100&hospital_id=${hospitalId}` : "?limit=100";
    fetch(`${API}/suppliers${p}`, { headers: H() }).then(r => r.json()).then(d => setSuppliers(d.suppliers || []));
  }, [hospitalId]);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { medicine_id: "", medicine_name: "", quantity: 1, purchase_price: "", gst_percent: 0, discount_percent: 0 }] }));
  const removeItem = i => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, k, v) => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));
  const handleSupplierChange = e => { const sup = suppliers.find(s => s.id === e.target.value); setForm(f => ({ ...f, supplier_id: e.target.value, supplier_name: sup ? sup.name : "" })); };
  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true);
    const body = { ...form, items: form.items.map(i => ({ ...i, quantity: parseInt(i.quantity) || 1, purchase_price: parseFloat(i.purchase_price) || 0, gst_percent: parseFloat(i.gst_percent) || 0, discount_percent: parseFloat(i.discount_percent) || 0 })) };
    if (hospitalId) body.hospital_id = hospitalId;
    await fetch(`${API}/purchase-orders`, { method: "POST", headers: H(), body: JSON.stringify(body) });
    setShowAdd(false); load(); setSaving(false);
  };
  const cancelPO = async id => { if (!window.confirm("Cancel this PO?")) return; await fetch(`${API}/purchase-orders/${id}/cancel`, { method: "PATCH", headers: H() }); load(); };
  const statusColor = s => ({ "Ordered": "bg-blue-100 text-blue-700", "Partially Received": "bg-yellow-100 text-yellow-700", "Received": "bg-green-100 text-green-700", "Cancelled": "bg-red-100 text-red-700", "Draft": "bg-gray-100 text-gray-700" }[s] || "bg-gray-100 text-gray-600");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">All Statuses</option>
          {["Draft", "Ordered", "Partially Received", "Received", "Cancelled"].map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowAdd(true)} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5"><i className="fas fa-plus" />New Purchase Order</button>
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-blue-50"><tr>{["PO Number", "Supplier", "PO Date", "Expected", "Items", "Total", "Status", "Actions"].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-blue-700 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={8} className="py-10 text-center text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                : pos.length === 0 ? <tr><td colSpan={8} className="py-10 text-center text-gray-400">No purchase orders</td></tr>
                  : pos.map(po => <tr key={po.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-mono text-xs text-blue-700 font-medium">{po.po_number}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{po.supplier_name}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{po.po_date}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{po.expected_delivery || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-600">{po.items?.length || 0}</td>
                    <td className="px-3 py-2.5 font-bold text-green-700">₹{po.total_amount}</td>
                    <td className="px-3 py-2.5"><span className={`px-2 py-0.5 text-xs rounded font-medium ${statusColor(po.status)}`}>{po.status}</span></td>
                    <td className="px-3 py-2.5">{(po.status === "Ordered" || po.status === "Draft") && <button onClick={() => cancelPO(po.id)} className="p-1.5 rounded hover:bg-red-100 text-red-500" title="Cancel"><i className="fas fa-ban text-xs" /></button>}</td>
                  </tr>)}
            </tbody>
          </table>
        </div>
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Purchase Order" icon="file-invoice" wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Supplier <span className="text-red-500">*</span></label><select value={form.supplier_id} onChange={handleSupplierChange} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"><option value="">Select Supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <InputField label="PO Date" name="po_date" value={form.po_date} onChange={e => setForm(f => ({ ...f, po_date: e.target.value }))} type="date" />
            <InputField label="Expected Delivery" name="expected_delivery" value={form.expected_delivery} onChange={e => setForm(f => ({ ...f, expected_delivery: e.target.value }))} type="date" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold text-gray-700">Order Items</h3><button type="button" onClick={addItem} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"><i className="fas fa-plus" />Add Item</button></div>
            {form.items.map((item, i) => <div key={i} className="grid grid-cols-6 gap-2 mb-2 p-2 bg-gray-50 rounded-lg"><input placeholder="Medicine Name" value={item.medicine_name} onChange={e => updateItem(i, "medicine_name", e.target.value)} className="col-span-2 border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" /><input placeholder="Qty" type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" /><input placeholder="Price ₹" type="number" value={item.purchase_price} onChange={e => updateItem(i, "purchase_price", e.target.value)} className="border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" /><input placeholder="GST %" type="number" value={item.gst_percent} onChange={e => updateItem(i, "gst_percent", e.target.value)} className="border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" /><button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-xs"><i className="fas fa-times" /></button></div>)}
          </div>
          <InputField label="Notes" name="notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="flex justify-end gap-3 pt-2 border-t"><button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button><button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? <><i className="fas fa-spinner fa-spin mr-1" />Creating...</> : "Create PO"}</button></div>
        </form>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GRN TAB
// ---------------------------------------------------------------------------
function GRNTab({ hospitalId }) {
  const [grns, setGRNs] = useState([]); const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const emptyGrnItem = () => ({ medicine_id: "", medicine_name: "", msearch: "", msugs: [], batch_number: "", expiry_date: "", quantity: 1, free_quantity: 0, purchase_price: "", mrp: "", gst_percent: 0, discount_percent: 0, location: "Main Pharmacy" });
  const [form, setForm] = useState({ supplier_id: "", supplier_name: "", po_id: "", invoice_number: "", invoice_date: "", notes: "", received_by: "", items: [emptyGrnItem()] });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const p = hospitalId ? `?limit=50&hospital_id=${hospitalId}` : "?limit=50";
    const r = await fetch(`${API}/grn${p}`, { headers: H() });
    const d = await r.json();
    setGRNs(d.grns || []); setLoading(false);
  };
  useEffect(() => { load(); }, [hospitalId]);
  useEffect(() => {
    const p = hospitalId ? `?limit=100&hospital_id=${hospitalId}` : "?limit=100";
    fetch(`${API}/suppliers${p}`, { headers: H() }).then(r => r.json()).then(d => setSuppliers(d.suppliers || []));
  }, [hospitalId]);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, emptyGrnItem()] }));
  const removeItem = i => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, k, v) => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));
  const handleSupplierChange = e => { const sup = suppliers.find(s => s.id === e.target.value); setForm(f => ({ ...f, supplier_id: e.target.value, supplier_name: sup ? sup.name : "" })); };

  // Medicine search per GRN item row
  const searchMedGrn = async (i, q) => {
    if (q.length < 2) { updateItem(i, "msugs", []); return; }
    const p = new URLSearchParams({ q, limit: 8 });
    if (hospitalId) p.set("hospital_id", hospitalId);
    const r = await fetch(`${API}/medicines/search?${p}`, { headers: H() });
    const d = await r.json();
    updateItem(i, "msugs", d.medicines || []);
  };
  const selectMedGrn = (i, m) => {
    setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, medicine_id: m.id, medicine_name: m.name, msearch: m.name, msugs: [], purchase_price: m.purchase_price || m.mrp || it.purchase_price, mrp: m.mrp || it.mrp, gst_percent: m.gst_percent || 0 } : it) }));
  };

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true);
    const body = { ...form, items: form.items.map(i => ({ medicine_id: i.medicine_id, medicine_name: i.medicine_name, batch_number: i.batch_number, expiry_date: i.expiry_date, quantity: parseInt(i.quantity) || 1, free_quantity: parseInt(i.free_quantity) || 0, purchase_price: parseFloat(i.purchase_price) || 0, mrp: parseFloat(i.mrp) || 0, gst_percent: parseFloat(i.gst_percent) || 0, discount_percent: parseFloat(i.discount_percent) || 0, location: i.location })) };
    if (hospitalId) body.hospital_id = hospitalId;
    await fetch(`${API}/grn`, { method: "POST", headers: H(), body: JSON.stringify(body) });
    setShowAdd(false); load(); setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => { setForm({ supplier_id: "", supplier_name: "", po_id: "", invoice_number: "", invoice_date: "", notes: "", received_by: "", items: [emptyGrnItem()] }); setShowAdd(true); }} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-1.5"><i className="fas fa-plus" />Receive Stock / GRN</button></div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-blue-50"><tr>{["GRN Number", "Supplier", "Invoice No.", "Invoice Date", "Items", "Total Amount", "Received By"].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-blue-700 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={7} className="py-10 text-center text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                : grns.length === 0 ? <tr><td colSpan={7} className="py-10 text-center text-gray-400">No stock receive records</td></tr>
                  : grns.map(g => <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-mono text-xs text-green-700 font-medium">{g.grn_number}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{g.supplier_name}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs">{g.invoice_number}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{g.invoice_date}</td>
                    <td className="px-3 py-2.5 text-gray-600">{g.items?.length || 0} items</td>
                    <td className="px-3 py-2.5 font-bold text-green-700">₹{g.total_amount}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{g.received_by || "—"}</td>
                  </tr>)}
            </tbody>
          </table>
        </div>
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Stock Receive (GRN)" icon="truck-loading" wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Supplier / Distributor <span className="text-red-500">*</span></label>
              <select value={form.supplier_id} onChange={handleSupplierChange} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ""}</option>)}
              </select>
            </div>
            <InputField label="Invoice Number" name="invoice_number" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} required placeholder="INV-2024-001" />
            <InputField label="Invoice Date" name="invoice_date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} type="date" required />
            <InputField label="Received By" name="received_by" value={form.received_by} onChange={e => setForm(f => ({ ...f, received_by: e.target.value }))} placeholder="Staff name" />
            <InputField label="Notes" name="notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><i className="fas fa-pills text-green-500" />Medicine Items</h3>
              <button type="button" onClick={addItem} className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1 px-2 py-1 bg-green-50 rounded border border-green-200"><i className="fas fa-plus" />Add Medicine</button>
            </div>
            {form.items.map((item, i) => (
              <div key={i} className="mb-3 p-3 bg-gray-50 rounded-xl border space-y-2">
                <div className="grid grid-cols-12 gap-2 items-start">
                  {/* Medicine search */}
                  <div className="col-span-4 relative">
                    <input placeholder="Search medicine from stock..." value={item.msearch || item.medicine_name}
                      onChange={e => { updateItem(i, "msearch", e.target.value); updateItem(i, "medicine_name", e.target.value); searchMedGrn(i, e.target.value); }}
                      onBlur={() => setTimeout(() => updateItem(i, "msugs", []), 200)}
                      className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400 bg-white" required />
                    {(item.msugs || []).length > 0 && (
                      <div className="absolute z-50 mt-0.5 bg-white border rounded-lg shadow-xl w-72 overflow-hidden text-xs">
                        {item.msugs.map((m, j) => (
                          <button key={j} type="button" onMouseDown={() => selectMedGrn(i, m)}
                            className="w-full px-3 py-2.5 text-left hover:bg-green-50 border-b last:border-0">
                            <div className="font-semibold text-gray-800">{m.name}</div>
                            <div className="text-gray-400">{m.generic_name} · MRP ₹{m.mrp} · Stock: {m.total_stock ?? 0} {m.unit}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input placeholder="Batch No *" value={item.batch_number} onChange={e => updateItem(i, "batch_number", e.target.value)} className="col-span-2 border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" required />
                  <input placeholder="Expiry" type="date" value={item.expiry_date} onChange={e => updateItem(i, "expiry_date", e.target.value)} className="col-span-2 border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                  <input placeholder="Qty *" type="number" value={item.quantity} min="1" onChange={e => updateItem(i, "quantity", e.target.value)} className="col-span-1 border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" required />
                  <input placeholder="Free" type="number" value={item.free_quantity} min="0" onChange={e => updateItem(i, "free_quantity", e.target.value)} className="col-span-1 border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                  <button type="button" onClick={() => removeItem(i)} className="col-span-1 text-red-400 hover:text-red-600 text-center py-1 text-sm"><i className="fas fa-times" /></button>
                  <input placeholder="Buy ₹" type="number" value={item.purchase_price} step="0.01" onChange={e => updateItem(i, "purchase_price", e.target.value)} className="col-span-1 border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                  <input placeholder="MRP ₹" type="number" value={item.mrp} step="0.01" onChange={e => updateItem(i, "mrp", e.target.value)} className="col-span-2 border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                  <input placeholder="GST %" type="number" value={item.gst_percent} step="0.01" onChange={e => updateItem(i, "gst_percent", e.target.value)} className="col-span-1 border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                  <input placeholder="Location" value={item.location} onChange={e => updateItem(i, "location", e.target.value)} className="col-span-3 border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                  {item.purchase_price && item.quantity && <div className="col-span-12 text-right text-xs text-green-700 font-semibold">Line Total: ₹{(parseFloat(item.purchase_price) * parseInt(item.quantity)).toFixed(2)}</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60">{saving ? <><i className="fas fa-spinner fa-spin mr-1" />Saving...</> : "Save Stock Receipt"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BILL PDF PRINT FUNCTION
// ---------------------------------------------------------------------------
function printBill(bill, hospitalName) {
  const items = bill.items || [];
  const hName = hospitalName || bill.hospital_name || "Hospital Pharmacy";
  const isWalkin = bill.visit_type === "OTC" || (bill.notes || "").startsWith("[Walk-in]");
  const paidAmt = bill.paid_amount ?? bill.net_payable;
  const dueAmt = bill.due_amount || 0;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${bill.bill_number} — Pharmacy Bill</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1f2937;background:#fff;}
    .page{max-width:800px;margin:auto;padding:20px;}
    /* Header */
    .header{display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;border-bottom:3px solid #1d4ed8;margin-bottom:16px;}
    .hospital-logo{width:54px;height:54px;background:linear-gradient(135deg,#1d4ed8,#7c3aed);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;flex-shrink:0;}
    .hospital-info{flex:1;padding-left:14px;}
    .hospital-name{font-size:20px;font-weight:800;color:#1e3a8a;letter-spacing:-0.3px;}
    .hospital-sub{font-size:10px;color:#6b7280;margin-top:2px;}
    .bill-badge{text-align:right;}
    .bill-badge .bill-no{font-size:16px;font-weight:800;color:#1d4ed8;letter-spacing:1px;}
    .bill-badge .bill-date{font-size:10px;color:#6b7280;margin-top:2px;}
    .bill-badge .status-chip{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;margin-top:4px;}
    /* Patient + Bill info boxes */
    .info-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;}
    .info-box{border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;background:#f9fafb;}
    .info-box h4{font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed #e5e7eb;}
    .info-line{display:flex;justify-content:space-between;margin-bottom:4px;}
    .info-line .lbl{color:#9ca3af;font-size:11px;}
    .info-line .val{font-weight:600;font-size:11px;text-align:right;max-width:55%;word-break:break-word;}
    /* Medicine table */
    .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#1e3a8a;margin-bottom:8px;display:flex;align-items:center;gap:6px;}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;}
    thead tr{background:linear-gradient(90deg,#1e40af,#3b82f6);color:#fff;}
    thead th{padding:8px 8px;text-align:left;font-weight:600;font-size:10.5px;letter-spacing:0.3px;}
    thead th:last-child,thead th:nth-child(4),thead th:nth-child(5),thead th:nth-child(6),thead th:nth-child(7){text-align:right;}
    tbody tr:nth-child(even){background:#f0f9ff;}
    tbody tr:nth-child(odd){background:#fff;}
    tbody td{padding:7px 8px;border-bottom:1px solid #e5e7eb;vertical-align:middle;}
    tbody td:nth-child(4),tbody td:nth-child(5),tbody td:nth-child(6),tbody td:nth-child(7){text-align:right;}
    .med-name{font-weight:700;color:#1f2937;}
    .med-generic{font-size:9.5px;color:#9ca3af;margin-top:1px;}
    .batch-info{font-size:9.5px;color:#6b7280;font-family:monospace;}
    /* Totals */
    .bottom-row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;}
    .notes-box{flex:1;font-size:11px;color:#6b7280;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;}
    .notes-box b{color:#92400e;display:block;margin-bottom:4px;}
    .totals-box{width:260px;flex-shrink:0;}
    .totals-table{width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;}
    .totals-table td{padding:6px 10px;font-size:12px;}
    .totals-table tr:not(:last-child) td{border-bottom:1px solid #f3f4f6;}
    .totals-table .t-row-gross td{background:#f9fafb;}
    .totals-table .t-row-gst td{background:#eff6ff;color:#1d4ed8;}
    .totals-table .t-row-disc td{background:#fff7ed;color:#c2410c;}
    .totals-table .t-row-net td{background:#1e40af;color:#fff;font-weight:800;font-size:14px;}
    .totals-table .t-row-paid td{background:#dcfce7;color:#166534;font-weight:700;}
    .totals-table .t-row-due td{background:#fee2e2;color:#991b1b;font-weight:700;}
    .totals-table .right{text-align:right;font-weight:600;}
    /* Signature */
    .sig-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;margin:20px 0 14px;}
    .sig-box{text-align:center;padding-top:8px;border-top:1px dashed #9ca3af;font-size:10px;color:#6b7280;}
    /* Footer */
    .footer{text-align:center;border-top:1px solid #e5e7eb;padding-top:10px;font-size:10px;color:#9ca3af;line-height:1.6;}
    .watermark{font-size:9.5px;color:#d1d5db;margin-top:6px;letter-spacing:0.5px;}
    @media print{
      body{print-color-adjust:exact;-webkit-print-color-adjust:exact;}
      @page{margin:10mm;size:A4;}
      .no-print{display:none!important;}
    }
  </style>
</head>
<body>
<div class="page">
  <!-- HEADER -->
  <div class="header">
    <div style="display:flex;align-items:center;">
      <div class="hospital-logo">🏥</div>
      <div class="hospital-info">
        <div class="hospital-name">${hName}</div>
        <div class="hospital-sub">Pharmacy &amp; Medicine Dispensing Center</div>
      </div>
    </div>
    <div class="bill-badge">
      <div class="bill-no">${bill.bill_number}</div>
      <div class="bill-date">${bill.bill_date || new Date().toLocaleDateString('en-IN')} &nbsp;|&nbsp; ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
      <span class="status-chip" style="background:${bill.status === 'Paid' ? '#dcfce7' : bill.status === 'Partial' ? '#fef9c3' : '#fee2e2'};color:${bill.status === 'Paid' ? '#166534' : bill.status === 'Partial' ? '#854d0e' : '#991b1b'};">
        ${bill.status === 'Paid' ? '&#10003; PAID' : bill.status === 'Partial' ? '~ PARTIAL PAID' : '&#8987; CREDIT'}
      </span>
    </div>
  </div>

  <!-- PATIENT + BILL INFO -->
  <div class="info-row">
    <div class="info-box">
      <h4>&#128100; Patient Information</h4>
      <div class="info-line"><span class="lbl">Name</span><span class="val" style="color:#1e3a8a;font-size:13px;font-weight:800;">${bill.patient_name || '—'}</span></div>
      <div class="info-line"><span class="lbl">MRN / ID</span><span class="val" style="font-family:monospace;color:#2563eb;">${bill.mrn || (isWalkin ? 'Walk-in' : '—')}</span></div>
      <div class="info-line"><span class="lbl">Mobile</span><span class="val">${bill.patient_phone || '—'}</span></div>
      <div class="info-line"><span class="lbl">Type</span><span class="val">${isWalkin ? '&#128694; Walk-in / Retail' : '&#127973; Hospital Patient'}</span></div>
      <div class="info-line"><span class="lbl">Category</span><span class="val" style="color:#7c3aed;">${bill.patient_category || 'CASH'}</span></div>
    </div>
    <div class="info-box">
      <h4>&#9879; Clinical &amp; Bill Information</h4>
      <div class="info-line"><span class="lbl">Doctor</span><span class="val" style="color:#065f46;">${bill.doctor_name || '—'}</span></div>
      <div class="info-line"><span class="lbl">Department</span><span class="val" style="color:#1e40af;">${bill.opd_department || '—'}</span></div>
      <div class="info-line"><span class="lbl">Visit Type</span><span class="val">${bill.visit_type || '—'}</span></div>
      <div class="info-line"><span class="lbl">Counter</span><span class="val">${bill.counter_location || 'Main Pharmacy'}</span></div>
      <div class="info-line"><span class="lbl">Dispensed By</span><span class="val">${bill.dispensed_by || '—'}</span></div>
      <div class="info-line"><span class="lbl">Payment Mode</span><span class="val" style="color:#1d4ed8;">${bill.payment_mode || 'Cash'}</span></div>
    </div>
  </div>

  <!-- MEDICINES TABLE -->
  <div class="section-title">&#128138; Medicines Dispensed</div>
  <table>
    <thead>
      <tr>
        <th style="width:28px;">#</th>
        <th>Medicine Name</th>
        <th>Batch / Expiry</th>
        <th>Qty</th>
        <th>Rate (&#8377;)</th>
        <th>GST</th>
        <th>Amount (&#8377;)</th>
        <th>Dosage / Duration</th>
      </tr>
    </thead>
    <tbody>
      ${items.length === 0 ? '<tr><td colspan="8" style="text-align:center;color:#9ca3af;padding:16px;">No medicines recorded</td></tr>' : ''}
      ${items.map((it, idx) => `
      <tr>
        <td style="color:#6b7280;">${idx + 1}</td>
        <td>
          <div class="med-name">${it.medicine_name || '—'}</div>
        </td>
        <td class="batch-info">
          ${it.batch_number || '—'}
          ${it.expiry_date ? `<br><span style="color:#ef4444;">Exp: ${it.expiry_date}</span>` : ''}
        </td>
        <td style="font-weight:700;color:#1e40af;">${it.quantity}</td>
        <td>&#8377;${(it.unit_price || 0).toFixed(2)}</td>
        <td style="color:#6b7280;">${it.gst_percent || 0}%</td>
        <td style="font-weight:700;color:#166534;">&#8377;${((it.unit_price || 0) * (it.quantity || 1)).toFixed(2)}</td>
        <td style="color:#6b7280;font-size:10px;">${it.dosage || '—'}${it.duration_days ? ` / ${it.duration_days}d` : ''}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <!-- TOTALS + NOTES -->
  <div class="bottom-row">
    <div>
      ${bill.notes && bill.notes.replace(/^\[Walk-in\]|^\[Hospital Patient\]/, '').trim() ? `
      <div class="notes-box">
        <b>&#128221; Notes / Instructions:</b>
        ${bill.notes.replace(/^\[Walk-in\]|^\[Hospital Patient\]/, '').trim()}
      </div>` : ''}
    </div>
    <div class="totals-box">
      <table class="totals-table">
        <tr class="t-row-gross"><td>Gross Amount</td><td class="right">&#8377;${(bill.gross_amount || 0).toFixed(2)}</td></tr>
        ${(bill.gst_amount || 0) > 0 ? `<tr class="t-row-gst"><td>+ GST</td><td class="right">&#8377;${(bill.gst_amount || 0).toFixed(2)}</td></tr>` : ''}
        ${(bill.discount_amount || 0) > 0 ? `<tr class="t-row-disc"><td>- Discount (${bill.discount_percent || 0}%)</td><td class="right">&#8377;${(bill.discount_amount || 0).toFixed(2)}</td></tr>` : ''}
        <tr class="t-row-net"><td>Net Payable</td><td class="right">&#8377;${(bill.net_payable || 0).toFixed(2)}</td></tr>
        <tr class="t-row-paid"><td>&#10003; Paid (${bill.payment_mode || 'Cash'})</td><td class="right">&#8377;${paidAmt.toFixed(2)}</td></tr>
        ${dueAmt > 0 ? `<tr class="t-row-due"><td>&#9888; Due / Pending</td><td class="right">&#8377;${dueAmt.toFixed(2)}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <!-- SIGNATURES -->
  <div class="sig-row">
    <div class="sig-box">Patient / Attendant Signature</div>
    <div class="sig-box">Pharmacist Signature</div>
    <div class="sig-box">Authorized Signatory &amp; Seal</div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <p>This is a computer-generated bill. Valid without manual signature.</p>
    <p>Printed: ${new Date().toLocaleString('en-IN')} &nbsp;|&nbsp; <strong>${hName}</strong></p>
    <p class="watermark">Powered by HIS &mdash; Hospital Information System</p>
  </div>

  <!-- Print button (visible on screen only) -->
  <div class="no-print" style="text-align:center;margin-top:20px;">
    <button onclick="window.print()" style="padding:10px 28px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-right:10px;">&#128438; Print / Save as PDF</button>
    <button onclick="window.close()" style="padding:10px 20px;background:#6b7280;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;">Close</button>
  </div>
</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=720,scrollbars=yes');
  if (w) { w.document.write(html); w.document.close(); }
}

// ---------------------------------------------------------------------------
// BILLING TAB
// ---------------------------------------------------------------------------
function BillingTab({ hospitalId, hospitalName }) {
  // Bills list
  const [bills, setBills] = useState([]); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1); const [filterPatient, setFilterPatient] = useState(""); const [filterStatus, setFilterStatus] = useState("");
  const [showAdd, setShowAdd] = useState(false); const [saving, setSaving] = useState(false);

  // Patient search in new-bill form
  const [ptSearch, setPtSearch] = useState(""); const [ptSugs, setPtSugs] = useState([]); const [ptDue, setPtDue] = useState(null);
  // Doctor search
  const [drSearch, setDrSearch] = useState(""); const [drSugs, setDrSugs] = useState([]);
  // Department list
  const [depts, setDepts] = useState([]);

  // Bill form
  const emptyItem = () => ({ medicine_id: "", medicine_name: "", msearch: "", msugs: [], batch_number: "", quantity: 1, dosage: "", duration_days: "", unit_price: "", gst_percent: 0 });
  const [custType, setCustType] = useState("patient"); // "patient" | "walkin"
  const [form, setForm] = useState({ patient_id: "", patient_name: "", patient_phone: "", mrn: "", doctor_id: "", doctor_name: "", opd_department: "", visit_type: "OPD", counter_location: "Main Pharmacy", discount_percent: 0, payment_mode: "Cash", paid_amount: "", notes: "", dispensed_by: "", items: [emptyItem()] });

  // Patient dues panel
  const [showDues, setShowDues] = useState(false); const [duesQ, setDuesQ] = useState(""); const [duesData, setDuesData] = useState(null); const [duesLoading, setDuesLoading] = useState(false);

  // Collect payment modal
  const [collectBill, setCollectBill] = useState(null); const [cAmt, setCAmt] = useState(""); const [cMode, setCMode] = useState("Cash"); const [cSaving, setCSaving] = useState(false);

  // Real-time totals
  const gross = form.items.reduce((s, i) => s + (parseFloat(i.unit_price) || 0) * (parseInt(i.quantity) || 1), 0);
  const discAmt = gross * (parseFloat(form.discount_percent) || 0) / 100;
  const gstAmt = form.items.reduce((s, i) => { const lt = (parseFloat(i.unit_price) || 0) * (parseInt(i.quantity) || 1); return s + lt * (parseFloat(i.gst_percent) || 0) / 100; }, 0);
  const netPayable = Math.max(0, gross + gstAmt - discAmt);
  const paidAmt = form.paid_amount === "" ? netPayable : (parseFloat(form.paid_amount) || 0);
  const dueAmt = Math.max(0, netPayable - paidAmt);
  const changeAmt = Math.max(0, paidAmt - netPayable);

  // Load departments for OPD dropdown
  useEffect(() => {
    fetch(`${DEPTS_API}?status=Active`, { headers: H() }).then(r => r.json()).then(d => setDepts(d.departments || [])).catch(() => { });
  }, []);

  // Load bills
  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page, limit: 20 });
    if (hospitalId) p.set("hospital_id", hospitalId);
    if (filterPatient) p.set("patient_name", filterPatient);
    if (filterStatus) p.set("status", filterStatus);
    const r = await fetch(`${API}/bills?${p}`, { headers: H() });
    const d = await r.json();
    setBills(d.bills || []); setTotal(d.total || 0); setLoading(false);
  }, [page, hospitalId, filterPatient, filterStatus]);
  useEffect(() => { load(); }, [load]);

  // Patient search autocomplete — uses real /api/patients/search
  useEffect(() => {
    if (ptSearch.length < 2) { setPtSugs([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${PATIENTS_API}/search?q=${encodeURIComponent(ptSearch)}`, { headers: H() });
        const d = await r.json();
        setPtSugs(Array.isArray(d) ? d.slice(0, 6) : []);
      } catch { setPtSugs([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [ptSearch]);

  // Doctor search autocomplete — uses real /api/doctors
  useEffect(() => {
    if (drSearch.length < 2) { setDrSugs([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${DOCTORS_API}?search=${encodeURIComponent(drSearch)}&status=Active`, { headers: H() });
        const d = await r.json();
        setDrSugs((d.doctors || []).slice(0, 6));
      } catch { setDrSugs([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [drSearch]);

  const fetchPatientDues = async (q) => {
    if (!q) { setPtDue(null); return; }
    const p = new URLSearchParams({ search: q });
    if (hospitalId) p.set("hospital_id", hospitalId);
    const r = await fetch(`${API}/patient-dues?${p}`, { headers: H() });
    const d = await r.json();
    setPtDue(d.patients?.[0] || null);
  };

  // Select a patient from suggestions (patient API fields: full_name, mobile, mrn, id, doctor_name, department)
  const selectPatient = (pt) => {
    setPtSearch(pt.full_name); setPtSugs([]);
    const deptVal = pt.department || "";
    const drVal = pt.doctor_name || "";
    setForm(f => ({
      ...f, patient_id: pt.id, patient_name: pt.full_name, patient_phone: pt.mobile || "", mrn: pt.mrn || "",
      doctor_name: drVal || f.doctor_name, opd_department: deptVal || f.opd_department,
      patient_category: pt.patient_category || f.patient_category || "CASH"
    }));
    setDrSearch(drVal);
    fetchPatientDues(pt.mrn || pt.mobile || pt.full_name);
  };

  // Medicine search per row
  const searchMed = async (i, q) => {
    if (q.length < 2) { updateItem(i, "msugs", []); return; }
    const p = new URLSearchParams({ q, limit: 8 });
    if (hospitalId) p.set("hospital_id", hospitalId);
    const r = await fetch(`${API}/medicines/search?${p}`, { headers: H() });
    const d = await r.json();
    updateItem(i, "msugs", d.medicines || []);
  };
  const selectMed = (i, m) => {
    setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, medicine_id: m.id, medicine_name: m.name, msearch: m.name, msugs: [], unit_price: m.selling_price || m.mrp || "", gst_percent: m.gst_percent || 0 } : it) }));
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = i => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, k, v) => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const openAdd = () => {
    setCustType("patient");
    setForm({ patient_id: "", patient_name: "", patient_phone: "", mrn: "", patient_category: "CASH", doctor_id: "", doctor_name: "", opd_department: "", visit_type: "OPD", counter_location: "Main Pharmacy", discount_percent: 0, payment_mode: "Cash", paid_amount: "", notes: "", dispensed_by: "", items: [emptyItem()] });
    setPtSearch(""); setPtSugs([]); setPtDue(null);
    setDrSearch(""); setDrSugs([]);
    setShowAdd(true);
  };

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true);
    const body = {
      ...form,
      visit_type: custType === "walkin" ? "OTC" : form.visit_type,
      notes: (custType === "walkin" ? "[Walk-in] " : "[Hospital Patient] ") + (form.notes || ""),
      discount_percent: parseFloat(form.discount_percent) || 0,
      paid_amount: form.paid_amount !== "" ? parseFloat(form.paid_amount) : undefined,
      items: form.items.map(i => ({ medicine_id: i.medicine_id || i.medicine_name, medicine_name: i.medicine_name, batch_number: i.batch_number || undefined, quantity: parseInt(i.quantity) || 1, dosage: i.dosage || undefined, duration_days: parseInt(i.duration_days) || undefined, unit_price: parseFloat(i.unit_price) || undefined }))
    };
    if (hospitalId) body.hospital_id = hospitalId;
    const res = await fetch(`${API}/bills`, { method: "POST", headers: H(), body: JSON.stringify(body) });
    const createdBill = await res.json();
    setShowAdd(false); load(); setSaving(false);
    // Auto-print the bill PDF after creation
    if (createdBill && createdBill.bill_number) {
      printBill(createdBill, hospitalName);
    }
  };

  const searchDues = async () => {
    if (!duesQ) return; setDuesLoading(true);
    const p = new URLSearchParams({ search: duesQ });
    if (hospitalId) p.set("hospital_id", hospitalId);
    const r = await fetch(`${API}/patient-dues?${p}`, { headers: H() });
    setDuesData(await r.json()); setDuesLoading(false);
  };

  const handleCollect = async () => {
    if (!collectBill || !cAmt) return; setCSaving(true);
    await fetch(`${API}/bills/${collectBill.id}/collect-payment`, { method: "POST", headers: H(), body: JSON.stringify({ amount_paid: parseFloat(cAmt), payment_mode: cMode }) });
    setCSaving(false); setCollectBill(null); setCAmt(""); load();
    if (duesQ) searchDues();
  };

  const statusBadge = s => ({ "Paid": "bg-green-100 text-green-700", "Partial": "bg-yellow-100 text-yellow-700", "Credit": "bg-red-100 text-red-700" }[s] || "bg-gray-100 text-gray-600");

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Search patient..." value={filterPatient} onChange={e => { setFilterPatient(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-48" />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">All Status</option><option value="Paid">Paid</option><option value="Partial">Partial</option><option value="Credit">Credit</option>
        </select>
        <button onClick={() => setShowDues(true)} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-1.5"><i className="fas fa-user-clock" />Patient Dues</button>
        <button onClick={openAdd} className="ml-auto px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-1.5"><i className="fas fa-receipt" />New Bill</button>
      </div>

      {/* Bills table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-blue-50"><tr>{["Bill No.", "Date", "Patient", "MRN", "Doctor / Dept", "Type", "Net ₹", "Paid ₹", "Due ₹", "Mode", "Status", "Actions"].map(h => <th key={h} className="px-2 py-3 text-left text-xs font-semibold text-blue-700 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={12} className="py-10 text-center text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                : bills.length === 0 ? <tr><td colSpan={12} className="py-10 text-center text-gray-400">No bills found</td></tr>
                  : bills.map(b => {
                    const isWalkin = b.visit_type === "OTC" || (b.notes || "").startsWith("[Walk-in]");
                    return (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="px-2 py-2 font-mono text-xs text-blue-700 font-medium">{b.bill_number}</td>
                        <td className="px-2 py-2 text-xs text-gray-500">{b.bill_date}</td>
                        <td className="px-2 py-2 text-xs">
                          <div className="font-medium text-gray-900">{b.patient_name}</div>
                          <span className={`text-xs px-1 py-0.5 rounded ${isWalkin ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}>{isWalkin ? "Walk-in" : "Patient"}</span>
                        </td>
                        <td className="px-2 py-2 text-xs font-mono text-blue-500">{b.mrn || "—"}</td>
                        <td className="px-2 py-2 text-xs text-gray-500">
                          <div>{b.doctor_name || "—"}</div>
                          {b.opd_department && <div className="text-xs text-indigo-500 font-medium">{b.opd_department}</div>}
                        </td>
                        <td className="px-2 py-2"><span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-700">{b.visit_type}</span></td>
                        <td className="px-2 py-2 font-bold text-green-700 text-xs">₹{b.net_payable}</td>
                        <td className="px-2 py-2 text-xs text-green-600">₹{b.paid_amount ?? b.net_payable}</td>
                        <td className="px-2 py-2 text-xs font-bold text-red-600">{(b.due_amount || 0) > 0 ? `₹${b.due_amount}` : "—"}</td>
                        <td className="px-2 py-2 text-xs text-gray-500">{b.payment_mode}</td>
                        <td className="px-2 py-2"><span className={`px-1.5 py-0.5 text-xs rounded font-medium ${statusBadge(b.status)}`}>{b.status}</span></td>
                        <td className="px-2 py-2">
                          <div className="flex gap-1 items-center">
                            <button onClick={() => printBill(b, hospitalName)} title="Print Bill PDF"
                              className="p-1.5 rounded hover:bg-blue-100 text-blue-600" >
                              <i className="fas fa-print text-xs" />
                            </button>
                            {(b.due_amount || 0) > 0 && <button onClick={() => { setCollectBill(b); setCAmt(String(b.due_amount)); setCMode("Cash"); }} className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 whitespace-nowrap">Collect ₹{b.due_amount}</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
          <span className="text-sm text-gray-500">Page {page} · {total} total</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
        </div>
      </div>

      {/* NEW BILL MODAL */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Bill — Dispensing" icon="receipt" wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Type Toggle */}
          <div className="flex gap-3 p-1 bg-gray-100 rounded-xl">
            <button type="button" onClick={() => { setCustType("patient"); setForm(f => ({ ...f, visit_type: "OPD" })); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${custType === "patient" ? "bg-blue-600 text-white shadow" : "text-gray-500 hover:bg-white"}`}>
              <i className="fas fa-hospital-user" />Hospital Patient
            </button>
            <button type="button" onClick={() => { setCustType("walkin"); setForm(f => ({ ...f, visit_type: "OTC", mrn: "", doctor_name: "" })); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${custType === "walkin" ? "bg-orange-500 text-white shadow" : "text-gray-500 hover:bg-white"}`}>
              <i className="fas fa-walking" />Walk-in / Bahari Customer
            </button>
          </div>

          {/* Patient section */}
          <div className={`rounded-xl p-4 space-y-3 ${custType === "patient" ? "bg-blue-50" : "bg-orange-50"}`}>
            <h3 className={`text-sm font-bold flex items-center gap-2 ${custType === "patient" ? "text-blue-700" : "text-orange-700"}`}>
              <i className={`fas fa-${custType === "patient" ? "user-injured" : "person-walking"}`} />
              {custType === "patient" ? "Hospital Patient Details" : "Walk-in Customer Details"}
            </h3>
            {custType === "patient" && (
              <div className="relative">
                <input type="text" placeholder="🔍 Patient ka naam / MRN / mobile search karein..." value={ptSearch}
                  onChange={e => { setPtSearch(e.target.value); setForm(f => ({ ...f, patient_name: e.target.value })); }}
                  onBlur={() => setTimeout(() => setPtSugs([]), 200)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                {ptSugs.length > 0 && (
                  <div className="absolute z-50 mt-1 bg-white border rounded-xl shadow-xl w-full overflow-hidden">
                    {ptSugs.map((pt, i) => (
                      <button key={i} type="button" onMouseDown={() => selectPatient(pt)}
                        className="w-full px-4 py-2.5 text-left hover:bg-blue-50 flex items-center gap-3 border-b last:border-0">
                        <i className="fas fa-user-circle text-blue-400 text-lg" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-800">{pt.full_name}</div>
                          <div className="text-xs text-gray-400">
                            {pt.mrn ? `MRN: ${pt.mrn}` : ""} {pt.mobile ? `· ${pt.mobile}` : ""}
                            {pt.age ? ` · ${pt.age}yr` : ""} {pt.gender ? `· ${pt.gender}` : ""}
                          </div>
                          {(pt.department || pt.doctor_name) && (
                            <div className="text-xs text-indigo-500 mt-0.5">
                              {pt.department ? `🏥 ${pt.department}` : ""} {pt.doctor_name ? `· Dr. ${pt.doctor_name}` : ""}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{pt.patient_category || "CASH"}</span>
                          {pt.blood_group && <span className="text-xs bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full">{pt.blood_group}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {ptDue && (ptDue.total_due || 0) > 0 && (
              <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs">
                <i className="fas fa-exclamation-circle text-red-500" />
                <span className="text-red-700 font-semibold">Pichle dues baaki hain: <b>₹{ptDue.total_due}</b></span>
                <span className="text-red-400 ml-1">(Billed ₹{ptDue.total_billed} · Paid ₹{ptDue.total_paid})</span>
              </div>
            )}
            {/* Auto-fill indicator when patient selected with dept/doctor */}
            {form.patient_id && (form.doctor_name || form.opd_department) && custType === "patient" && (
              <div className="flex flex-wrap items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg text-xs">
                <i className="fas fa-check-circle text-green-500" />
                <span className="text-green-700 font-semibold">Patient record se auto-fill kiya gaya:</span>
                {form.doctor_name && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Dr. {form.doctor_name}</span>}
                {form.opd_department && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{form.opd_department}</span>}
                {form.patient_category && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{form.patient_category}</span>}
              </div>
            )}
            <div className={`grid gap-3 ${custType === "patient" ? "grid-cols-3" : "grid-cols-2"}`}>
              <InputField label="Name *" name="patient_name" value={form.patient_name} onChange={handleChange} required
                placeholder={custType === "walkin" ? "Customer ka naam..." : "Patient ka naam..."} />
              <InputField label="Phone / Mobile" name="patient_phone" value={form.patient_phone} onChange={handleChange} placeholder="Mobile number" />
              {custType === "patient" && <InputField label="MRN / Patient ID" name="mrn" value={form.mrn} onChange={handleChange} />}
              {custType === "patient" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Doctor Name</label>
                  <DoctorSearchInput
                    value={form.doctor_name}
                    onChange={(name, doc) => setForm(f => ({
                      ...f,
                      doctor_name: name,
                      ...(doc?.id ? { doctor_id: doc.id } : {}),
                    }))}
                  />
                </div>
              )}
              {custType === "patient" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">OPD Department</label>
                  <select value={form.opd_department || ""} onChange={e => setForm(f => ({ ...f, opd_department: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">Select Department</option>
                    {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
              )}
              {custType === "patient" && <InputField label="Visit Type" name="visit_type" value={form.visit_type} onChange={handleChange} options={["OPD", "IPD", "Emergency"]} />}
              <InputField label="Counter / Location" name="counter_location" value={form.counter_location} onChange={handleChange} />
            </div>
          </div>

          {/* Medicines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><i className="fas fa-pills text-blue-500" />Medicines</h3>
              <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-lg border border-blue-200"><i className="fas fa-plus" />Add Medicine</button>
            </div>
            <div className="text-xs text-gray-400 grid grid-cols-12 gap-1 px-1 font-medium">
              <span className="col-span-4">Medicine</span><span className="col-span-1">Qty</span><span className="col-span-2">Rate ₹</span><span className="col-span-1">GST%</span><span className="col-span-2">Line Total</span><span className="col-span-1">Dosage</span><span className="col-span-1"></span>
            </div>
            {form.items.map((item, i) => (
              <div key={i} className="relative grid grid-cols-12 gap-1 p-2 bg-gray-50 rounded-lg border items-start">
                <div className="col-span-4 relative">
                  <input placeholder="Type to search medicine..." value={item.msearch || item.medicine_name}
                    onChange={e => { updateItem(i, "msearch", e.target.value); updateItem(i, "medicine_name", e.target.value); searchMed(i, e.target.value); }}
                    onBlur={() => setTimeout(() => updateItem(i, "msugs", []), 200)}
                    className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
                  {(item.msugs || []).length > 0 && (
                    <div className="absolute z-50 mt-0.5 bg-white border rounded-lg shadow-xl w-72 overflow-hidden text-xs">
                      {item.msugs.map((m, j) => (
                        <button key={j} type="button" onMouseDown={() => selectMed(i, m)}
                          className="w-full px-3 py-2.5 text-left hover:bg-blue-50 border-b last:border-0">
                          <div className="font-semibold text-gray-800">{m.name}</div>
                          <div className="text-gray-400">{m.generic_name} · ₹{m.selling_price || m.mrp} · Stock: <span className={`font-medium ${(m.total_stock || 0) > 0 ? "text-green-600" : "text-red-500"}`}>{m.total_stock ?? 0}</span></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input type="number" placeholder="Qty" value={item.quantity} min="1"
                  onChange={e => updateItem(i, "quantity", e.target.value)}
                  className="col-span-1 border rounded px-1.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <input type="number" placeholder="Rate ₹" value={item.unit_price} step="0.01"
                  onChange={e => updateItem(i, "unit_price", e.target.value)}
                  className="col-span-2 border rounded px-1.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <input type="number" placeholder="GST%" value={item.gst_percent} step="0.01"
                  onChange={e => updateItem(i, "gst_percent", e.target.value)}
                  className="col-span-1 border rounded px-1.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <div className="col-span-2 px-1.5 py-1.5 text-xs font-bold text-green-700">
                  ₹{((parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 1)).toFixed(2)}
                </div>
                <input placeholder="Dosage 1-0-1" value={item.dosage || ""}
                  onChange={e => updateItem(i, "dosage", e.target.value)}
                  className="col-span-1 border rounded px-1.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <button type="button" onClick={() => removeItem(i)} className="col-span-1 text-red-400 hover:text-red-600 text-center py-1"><i className="fas fa-times" /></button>
              </div>
            ))}
          </div>

          {/* Summary + Payment */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Discount %" name="discount_percent" value={form.discount_percent} onChange={handleChange} type="number" step="0.01" min="0" />
                <InputField label="Payment Mode" name="payment_mode" value={form.payment_mode} onChange={handleChange} options={PAYMENT_MODES} />
              </div>
              <InputField label="Dispensed By" name="dispensed_by" value={form.dispensed_by} onChange={handleChange} />
              <InputField label="Notes" name="notes" value={form.notes} onChange={handleChange} />
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-4 border space-y-1.5">
              <h4 className="text-xs font-bold text-gray-600 uppercase mb-3">Bill Summary</h4>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Gross</span><span>₹{gross.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">GST</span><span className="text-blue-600">+₹{gstAmt.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Discount ({form.discount_percent || 0}%)</span><span className="text-orange-600">-₹{discAmt.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-base pt-2 border-t mt-2"><span>Net Payable</span><span className="text-green-700">₹{netPayable.toFixed(2)}</span></div>
              <div className="mt-3">
                <label className="text-xs font-medium text-gray-600 block mb-1">Amount Received ₹ <span className="text-gray-400 font-normal">(blank = full payment)</span></label>
                <input type="number" placeholder={`₹${netPayable.toFixed(2)}`} value={form.paid_amount}
                  onChange={e => setForm(f => ({ ...f, paid_amount: e.target.value }))} step="0.01" min="0"
                  className="w-full border-2 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              {changeAmt > 0 && <div className="flex justify-between text-sm font-semibold text-green-600 bg-green-50 rounded-lg px-3 py-2"><span><i className="fas fa-undo mr-1" />Change to Return</span><span>₹{changeAmt.toFixed(2)}</span></div>}
              {dueAmt > 0 && <div className="flex justify-between text-sm font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2"><span><i className="fas fa-clock mr-1" />Due / Pending</span><span>₹{dueAmt.toFixed(2)}</span></div>}
              {dueAmt === 0 && form.paid_amount !== "" && <div className="text-xs text-green-600 text-center py-1"><i className="fas fa-check-circle mr-1" />Fully Paid</div>}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60">
              {saving ? <><i className="fas fa-spinner fa-spin mr-1" />Processing...</> : <><i className="fas fa-check-circle mr-1" />Dispense & Bill (₹{netPayable.toFixed(2)})</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* PATIENT DUES MODAL */}
      <Modal open={showDues} onClose={() => setShowDues(false)} title="Patient Payment Dues" icon="user-clock" wide>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" placeholder="Search by patient name, MRN, or phone..." value={duesQ} onChange={e => setDuesQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchDues()}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button onClick={searchDues} disabled={duesLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1.5"><i className="fas fa-search" />Search</button>
          </div>
          {duesLoading && <div className="text-center py-8 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Searching...</div>}
          {duesData && !duesLoading && (
            duesData.patients?.length === 0
              ? <div className="text-center py-8 text-gray-400"><i className="fas fa-check-circle text-green-400 text-3xl mb-2 block" />No outstanding dues found</div>
              : <div className="space-y-4">
                {duesData.patients?.map((pt, i) => (
                  <div key={i} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <div className="flex items-center gap-4 p-4 bg-gray-50 border-b">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"><i className="fas fa-user text-blue-600" /></div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-800">{pt.patient_name}</h4>
                        <p className="text-xs text-gray-500">{pt.mrn ? `MRN: ${pt.mrn}` : ""} {pt.patient_phone ? `· ${pt.patient_phone}` : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Billed: <b>₹{pt.total_billed}</b></p>
                        <p className="text-xs text-green-600">Paid: <b>₹{pt.total_paid}</b></p>
                        <p className="text-base font-bold text-red-600">Due: ₹{pt.total_due}</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead><tr className="text-gray-500 uppercase bg-gray-50">{["Bill No.", "Date", "Net Payable", "Paid", "Due", "Status", "Action"].map(h => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
                        <tbody>{pt.bills?.map(b => (
                          <tr key={b.id} className="border-t hover:bg-gray-50">
                            <td className="px-3 py-2 font-mono text-blue-700">{b.bill_number}</td>
                            <td className="px-3 py-2 text-gray-500">{b.bill_date}</td>
                            <td className="px-3 py-2 font-medium">₹{b.net_payable}</td>
                            <td className="px-3 py-2 text-green-600">₹{b.paid_amount ?? b.net_payable}</td>
                            <td className="px-3 py-2 font-bold text-red-600">{(b.due_amount || 0) > 0 ? `₹${b.due_amount}` : "—"}</td>
                            <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded font-medium ${statusBadge(b.status)}`}>{b.status}</span></td>
                            <td className="px-3 py-2">{(b.due_amount || 0) > 0 && <button onClick={() => { setCollectBill(b); setCAmt(String(b.due_amount)); setCMode("Cash"); }} className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600">Collect</button>}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
          )}
        </div>
      </Modal>

      {/* COLLECT PAYMENT MODAL */}
      <Modal open={!!collectBill} onClose={() => setCollectBill(null)} title="Collect Payment" icon="rupee-sign">
        {collectBill && <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-4 space-y-1">
            <p className="text-sm font-bold text-blue-800">{collectBill.patient_name}</p>
            <p className="text-xs text-gray-500">{collectBill.bill_number} · {collectBill.bill_date}</p>
            <div className="flex gap-4 mt-2 text-sm flex-wrap">
              <span className="text-gray-600">Net Payable: <b className="text-gray-800">₹{collectBill.net_payable}</b></span>
              <span className="text-green-600">Already Paid: <b>₹{collectBill.paid_amount ?? collectBill.net_payable}</b></span>
              <span className="text-red-600 font-bold">Outstanding: ₹{collectBill.due_amount}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Amount to Collect (₹) *</label>
              <input type="number" value={cAmt} onChange={e => setCAmt(e.target.value)} step="0.01" min="0" max={collectBill.due_amount}
                className="w-full border-2 border-green-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <InputField label="Payment Mode" value={cMode} onChange={e => setCMode(e.target.value)} options={PAYMENT_MODES} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button onClick={() => setCollectBill(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button onClick={handleCollect} disabled={cSaving || !cAmt} className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60">
              {cSaving ? <><i className="fas fa-spinner fa-spin mr-1" />Processing...</> : <><i className="fas fa-check mr-1" />Collect ₹{cAmt}</>}
            </button>
          </div>
        </div>}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ALERTS TAB
// ---------------------------------------------------------------------------
function AlertsTab({ hospitalId }) {
  const [lowStock, setLowStock] = useState([]); const [outStock, setOutStock] = useState([]); const [expiry, setExpiry] = useState({ expired: [], near_expiry: [] });
  const [loading, setLoading] = useState(false); const [expiryDays, setExpiryDays] = useState(90);

  const load = async () => {
    setLoading(true);
    const hp = hospitalId ? `&hospital_id=${hospitalId}` : "";
    const [ls, os, ex] = await Promise.all([
      fetch(`${API}/alerts/low-stock?1=1${hp}`, { headers: H() }).then(r => r.json()),
      fetch(`${API}/alerts/out-of-stock?1=1${hp}`, { headers: H() }).then(r => r.json()),
      fetch(`${API}/alerts/expiry?days=${expiryDays}${hp}`, { headers: H() }).then(r => r.json()),
    ]);
    setLowStock(ls.low_stock_alerts || []); setOutStock(os.out_of_stock || []); setExpiry(ex); setLoading(false);
  };
  useEffect(() => { load(); }, [expiryDays, hospitalId]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Low Stock" value={lowStock.length} icon="exclamation-triangle" color="yellow" />
        <StatCard label="Out of Stock" value={outStock.length} icon="times-circle" color="red" />
        <StatCard label={`Near Expiry (${expiryDays}d)`} value={expiry.near_expiry?.length || 0} icon="calendar-times" color="orange" sub={`${expiry.expired?.length || 0} already expired`} />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">Expiry window:</label>
        <select value={expiryDays} onChange={e => setExpiryDays(e.target.value)} className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">{[30, 60, 90, 180].map(d => <option key={d} value={d}>{d} days</option>)}</select>
        <button onClick={load} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"><i className="fas fa-sync text-xs" />Refresh</button>
      </div>
      {loading ? <div className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading alerts...</div> : (
        <div className="space-y-4">
          {expiry.expired?.length > 0 && <div className="bg-red-50 border border-red-200 rounded-xl p-4"><h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2"><i className="fas fa-exclamation-circle" />Expired Stock ({expiry.expired.length})</h3><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-xs text-red-600 uppercase">{["Medicine", "Batch", "Expiry", "Location", "Qty"].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead><tbody>{expiry.expired.map((e, i) => <tr key={i} className="border-t border-red-100"><td className="px-3 py-2 font-medium">{e.medicine_name}</td><td className="px-3 py-2 font-mono text-xs">{e.batch_number}</td><td className="px-3 py-2 text-xs text-red-600">{e.expiry_date}</td><td className="px-3 py-2 text-xs">{e.location}</td><td className="px-3 py-2 font-bold text-red-700">{e.quantity}</td></tr>)}</tbody></table></div></div>}
          {expiry.near_expiry?.length > 0 && <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"><h3 className="font-semibold text-yellow-700 mb-3 flex items-center gap-2"><i className="fas fa-clock" />Near Expiry ({expiry.near_expiry.length})</h3><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-xs text-yellow-600 uppercase">{["Medicine", "Batch", "Expiry", "Location", "Qty"].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead><tbody>{expiry.near_expiry.map((e, i) => <tr key={i} className="border-t border-yellow-100"><td className="px-3 py-2 font-medium">{e.medicine_name}</td><td className="px-3 py-2 font-mono text-xs">{e.batch_number}</td><td className="px-3 py-2 text-xs text-yellow-600">{e.expiry_date}</td><td className="px-3 py-2 text-xs">{e.location}</td><td className="px-3 py-2 font-bold text-yellow-700">{e.quantity}</td></tr>)}</tbody></table></div></div>}
          {lowStock.length > 0 && <div className="bg-orange-50 border border-orange-200 rounded-xl p-4"><h3 className="font-semibold text-orange-700 mb-3 flex items-center gap-2"><i className="fas fa-arrow-down" />Low Stock ({lowStock.length})</h3><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-xs text-orange-600 uppercase">{["Medicine", "Category", "Current", "Reorder"].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead><tbody>{lowStock.map((l, i) => <tr key={i} className="border-t border-orange-100"><td className="px-3 py-2 font-medium">{l.medicine_name}</td><td className="px-3 py-2 text-xs text-gray-500">{l.category || "—"}</td><td className="px-3 py-2 font-bold text-orange-700">{l.total_qty}</td><td className="px-3 py-2 text-gray-500">{l.reorder_level}</td></tr>)}</tbody></table></div></div>}
          {outStock.length > 0 && <div className="bg-red-50 border border-red-100 rounded-xl p-4"><h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2"><i className="fas fa-ban" />Out of Stock ({outStock.length})</h3><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-xs text-red-600 uppercase">{["Medicine", "Category", "Reorder Level"].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead><tbody>{outStock.map((s, i) => <tr key={i} className="border-t border-red-100"><td className="px-3 py-2 font-medium">{s.medicine_name}</td><td className="px-3 py-2 text-xs text-gray-500">{s.category || "—"}</td><td className="px-3 py-2 text-gray-500">{s.reorder_level}</td></tr>)}</tbody></table></div></div>}
          {!lowStock.length && !outStock.length && !expiry.expired?.length && !expiry.near_expiry?.length && <div className="text-center py-12 text-green-600"><i className="fas fa-check-circle text-4xl mb-3 block" /><p className="font-semibold">No critical alerts!</p><p className="text-sm text-gray-400 mt-1">All stock levels and expiry dates are within acceptable range.</p></div>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// REPORTS TAB
// ---------------------------------------------------------------------------
function ReportsTab({ hospitalId }) {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 7) + "-01";
  const [fromDate, setFromDate] = useState(firstOfMonth); const [toDate, setToDate] = useState(today);
  const [salesData, setSalesData] = useState(null); const [valuation, setValuation] = useState(null); const [loading, setLoading] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    const hp = hospitalId ? `&hospital_id=${hospitalId}` : "";
    const [s, v] = await Promise.all([
      fetch(`${API}/reports/sales?from_date=${fromDate}&to_date=${toDate}${hp}`, { headers: H() }).then(r => r.json()),
      fetch(`${API}/reports/stock-valuation?1=1${hp}`, { headers: H() }).then(r => r.json()),
    ]);
    setSalesData(s); setValuation(v); setLoading(false);
  };
  useEffect(() => { loadReports(); }, [hospitalId]);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2"><label className="text-sm text-gray-600">From:</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
        <div className="flex items-center gap-2"><label className="text-sm text-gray-600">To:</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
        <button onClick={loadReports} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1.5"><i className="fas fa-chart-bar text-xs" />Generate</button>
      </div>
      {loading ? <div className="text-center py-10 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading reports...</div> : (
        <>
          {salesData && <div className="bg-white rounded-xl shadow p-5"><h3 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2"><i className="fas fa-chart-bar text-blue-500" />Sales Report ({fromDate} — {toDate})</h3><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4"><StatCard label="Total Bills" value={salesData.total_bills} icon="receipt" color="blue" /><StatCard label="Gross Amount" value={`₹${salesData.total_gross}`} icon="rupee-sign" color="green" /><StatCard label="Total Discount" value={`₹${salesData.total_discount}`} icon="tag" color="yellow" /><StatCard label="Net Revenue" value={`₹${salesData.total_net}`} icon="chart-line" color="indigo" /></div>{salesData.payment_modes && Object.keys(salesData.payment_modes).length > 0 && <div><h4 className="text-sm font-semibold text-gray-600 mb-2">Payment Mode Breakdown</h4><div className="flex flex-wrap gap-3">{Object.entries(salesData.payment_modes).map(([mode, amt]) => <div key={mode} className="bg-blue-50 rounded-lg px-4 py-2 text-center"><div className="text-xs text-gray-500">{mode}</div><div className="font-bold text-blue-700">₹{amt}</div></div>)}</div></div>}</div>}
          {valuation && <div className="bg-white rounded-xl shadow p-5"><h3 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2"><i className="fas fa-warehouse text-green-500" />Stock Valuation</h3><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><StatCard label="Total Batches" value={valuation.total_batches} icon="boxes" color="blue" /><StatCard label="Purchase Value" value={`₹${valuation.purchase_value}`} icon="shopping-cart" color="yellow" /><StatCard label="MRP Value" value={`₹${valuation.mrp_value}`} icon="tags" color="green" /><StatCard label="Potential Profit" value={`₹${valuation.potential_profit}`} icon="chart-line" color="indigo" /></div></div>}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN PAGE
// ---------------------------------------------------------------------------
export default function PharmacyPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [currentUser] = useState(getCurrentUser);
  const [userIsAdmin] = useState(() => isAdmin(getCurrentUser()));
  const [userHospitalId] = useState(() => getUserHospitalId(getCurrentUser()));

  // Hospital selector state (for admins)
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);
  const [selectedHospitalName, setSelectedHospitalName] = useState("");
  const [showAllHospitals, setShowAllHospitals] = useState(false);

  // For non-admin, always use their assigned hospital
  const activeHospitalId = userIsAdmin ? selectedHospitalId : userHospitalId;

  useEffect(() => {
    if (userIsAdmin) {
      fetch(`${API}/hospitals-list`, { headers: H() })
        .then(r => r.json())
        .then(d => setHospitals(d.hospitals || []))
        .catch(() => { });
    }
  }, [userIsAdmin]);

  const handleSelectHospital = (id, name) => {
    setSelectedHospitalId(id);
    setSelectedHospitalName(name || hospitals.find(h => h.id === id)?.name || "");
    setShowAllHospitals(false);
    setActiveTab("dashboard");
  };

  const TABS = [
    { key: "dashboard", label: "Dashboard", icon: "tachometer-alt" },
    { key: "medicines", label: "Medicines", icon: "pills" },
    { key: "stock", label: "Stock", icon: "boxes" },
    { key: "grn", label: "Stock Receive", icon: "truck-loading" },
    { key: "billing", label: "Billing", icon: "receipt" },
    { key: "alerts", label: "Alerts", icon: "bell" },
    { key: "reports", label: "Reports", icon: "chart-bar" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center gap-2">
            <i className="fas fa-pills text-blue-600" />Pharmacy Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {userIsAdmin ? "Admin View — All hospitals or filter by hospital" : "Hospital Pharmacy"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {userIsAdmin && (
            <>
              <HospitalSelector
                hospitals={hospitals}
                selectedId={selectedHospitalId}
                onChange={id => {
                  setSelectedHospitalId(id);
                  setSelectedHospitalName(id ? hospitals.find(h => h.id === id)?.name || "" : "");
                  setShowAllHospitals(false);
                }}
              />
              {selectedHospitalId && (
                <button onClick={() => { setSelectedHospitalId(null); setSelectedHospitalName(""); }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1.5 border border-indigo-200 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition flex items-center gap-1">
                  <i className="fas fa-globe text-xs" />Show All
                </button>
              )}
              <button onClick={() => setShowAllHospitals(v => !v)}
                className="text-xs text-gray-600 hover:text-indigo-700 px-3 py-1.5 border rounded-lg bg-white hover:bg-indigo-50 transition flex items-center gap-1">
                <i className="fas fa-hospital-alt text-xs" />{showAllHospitals ? "Hide" : "Hospital Overview"}
              </button>
            </>
          )}
          {!userIsAdmin && userHospitalId && (
            <HospitalBadge name={currentUser?.hospital_name || "My Hospital"} />
          )}
        </div>
      </div>

      {/* Admin: selected hospital badge */}
      {userIsAdmin && selectedHospitalId && selectedHospitalName && (
        <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm">
          <i className="fas fa-hospital text-indigo-600" />
          <span className="font-semibold text-indigo-800">Viewing: {selectedHospitalName}</span>
          <span className="text-indigo-400 text-xs ml-1">({selectedHospitalId})</span>
        </div>
      )}
      {userIsAdmin && !selectedHospitalId && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
          <i className="fas fa-globe text-blue-600" />
          <span className="font-semibold text-blue-800">Viewing all hospitals combined data</span>
          <span className="text-blue-400 text-xs ml-1">— Select a hospital above to filter</span>
        </div>
      )}

      {/* Admin Multi-hospital overview panel */}
      <AnimatePresence>
        {userIsAdmin && showAllHospitals && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-2xl shadow-lg p-5 border border-indigo-100">
            <MultiHospitalOverview onSelectHospital={handleSelectHospital} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      {activeTab === "dashboard" && <DashboardTab hospitalId={activeHospitalId} onTabChange={setActiveTab} />}
      {activeTab === "medicines" && <MedicineMasterTab hospitalId={activeHospitalId} />}
      {activeTab === "stock" && <StockTab hospitalId={activeHospitalId} />}
      {activeTab === "grn" && <GRNTab hospitalId={activeHospitalId} />}
      {activeTab === "billing" && <BillingTab hospitalId={activeHospitalId} hospitalName={selectedHospitalName || currentUser?.hospital_name || ""} />}
      {activeTab === "alerts" && <AlertsTab hospitalId={activeHospitalId} />}
      {activeTab === "reports" && <ReportsTab hospitalId={activeHospitalId} />}
    </div>
  );
}