import React, { useState, useEffect, useCallback } from "react";
import {
  Star, Crown, Trophy, Gift, TrendingUp, Users, IndianRupee,
  Plus, Search, Filter, ChevronUp, ChevronDown, Zap,
  QrCode, Share2, BarChart3, Award, Target, Wallet,
  RefreshCw, CheckCircle, XCircle, Clock, Edit3,
  MoreVertical, Eye, Download, Upload, Phone, Mail,
  MapPin, Calendar, ArrowUpRight, ArrowDownRight, Flame,
  BadgeCheck, ShieldCheck, Percent, Tag, X, Save, Loader2,
} from "lucide-react";
import { toast } from "react-toastify";

const API = "https://cubehis.avopay.pro:5000/api/loyalty";
const CUSTOMER_API = "https://cubehis.avopay.pro:5000/api/customers";

// ----- Tier Config -----
const TIER_CONFIG = {
  Silver: { color: "#6B7280", bg: "bg-gray-100", badge: "bg-gray-200 text-gray-700", ring: "ring-gray-400", icon: "⭐", next: 10000 },
  Gold: { color: "#D97706", bg: "bg-yellow-50", badge: "bg-yellow-200 text-yellow-800", ring: "ring-yellow-400", icon: "🥇", next: 50000 },
  Platinum: { color: "#6366F1", bg: "bg-indigo-50", badge: "bg-indigo-200 text-indigo-800", ring: "ring-indigo-400", icon: "💎", next: 100000 },
  Diamond: { color: "#EC4899", bg: "bg-pink-50", badge: "bg-pink-200 text-pink-800", ring: "ring-pink-400", icon: "👑", next: null },
};

// ----- Utility -----
const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const pct = (val, max) => max ? Math.min(100, ((val || 0) / max) * 100).toFixed(1) : 0;

// ----- Stat Card -----
const StatCard = ({ icon: Icon, label, value, sub, color, trend }) => (
  <div className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-2`}>
    <div className="flex items-start justify-between">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center`} style={{ background: color + "22" }}>
        <Icon size={22} style={{ color }} />
      </div>
      {trend !== undefined && (
        <span className={`text-xs font-semibold flex items-center gap-0.5 ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
          {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
    <p className="text-sm font-medium text-gray-500">{label}</p>
    {sub && <p className="text-xs text-gray-400">{sub}</p>}
  </div>
);

// ----- Tier Badge -----
const TierBadge = ({ tier }) => {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.Silver;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.badge}`}>
      {cfg.icon} {tier}
    </span>
  );
};

// ----- Member Row -----
const MemberRow = ({ member, onView, onAddCashback }) => {
  const progress = pct(member.milestone_progress, member.milestone_target);
  const cfg = TIER_CONFIG[member.loyalty_tier] || TIER_CONFIG.Silver;
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-full ring-2 ${cfg.ring} flex items-center justify-center text-sm font-bold text-white`}
            style={{ background: cfg.color }}
          >
            {(member.name || "?")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">{member.name}</p>
            <p className="text-xs text-gray-400">{member.phone}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><TierBadge tier={member.loyalty_tier} /></td>
      <td className="px-4 py-3 text-sm font-semibold text-green-600">{fmt(member.total_cashback_earned)}</td>
      <td className="px-4 py-3 text-sm font-semibold text-indigo-600">{fmt(member.cashback_balance)}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{member.loyalty_points?.toLocaleString() || 0}</td>
      <td className="px-4 py-3">
        <div className="w-24">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: cfg.color }} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{progress}%</p>
        </div>
      </td>
      <td className="px-4 py-3 text-xs font-mono text-purple-600 bg-purple-50 rounded px-1">{member.referral_code || "—"}</td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button onClick={() => onView(member)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View / Cashback"><Eye size={15} /></button>
          <button onClick={() => onAddCashback(member)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Add Purchase"><Plus size={15} /></button>
        </div>
      </td>
    </tr>
  );
};

// ----- Add Purchase Modal -----
const AddPurchaseModal = ({ member, campaigns, onClose, onSuccess }) => {
  const [form, setForm] = useState({ invoice_amount: "", reference_invoice: "", channel: "direct", campaign_id: "", remarks: "" });
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (form.invoice_amount) {
      const amt = parseFloat(form.invoice_amount) || 0;
      const tierRates = { Silver: 2, Gold: 4, Platinum: 6, Diamond: 8 };
      let rate = tierRates[member.loyalty_tier] || 2;
      if (form.campaign_id) {
        const c = campaigns.find(x => x.id === form.campaign_id);
        if (c && c.reward_type === "percent") rate = c.reward_value;
      }
      setPreview({ cashback: +(amt * rate / 100).toFixed(2), points: Math.floor(amt / 10), rate });
    } else {
      setPreview(null);
    }
  }, [form.invoice_amount, form.campaign_id, member.loyalty_tier, campaigns]);

  const submit = async () => {
    if (!form.invoice_amount || parseFloat(form.invoice_amount) <= 0) {
      toast.error("Enter valid invoice amount"); return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v !== "" && fd.append(k, v));
      const res = await fetch(`${API}/members/${member.id}/cashback/earn`, { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).detail || "Error");
      const data = await res.json();
      toast.success(`✅ ₹${data.cashback_earned} cashback earned! ${data.points_earned} pts | Tier: ${data.new_tier}`);
      onSuccess();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">Add Purchase</h2>
            <p className="text-sm text-gray-500">{member.name} · <TierBadge tier={member.loyalty_tier} /></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Amount (₹) *</label>
            <input type="number" min="1" value={form.invoice_amount} onChange={e => setForm(p => ({ ...p, invoice_amount: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" placeholder="e.g. 5000" />
          </div>
          {preview && (
            <div className="bg-gradient-to-r from-green-50 to-indigo-50 rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
              <div><p className="text-xs text-gray-500">Cashback</p><p className="font-bold text-green-600">₹{preview.cashback}</p></div>
              <div><p className="text-xs text-gray-500">Rate</p><p className="font-bold text-indigo-600">{preview.rate}%</p></div>
              <div><p className="text-xs text-gray-500">Points</p><p className="font-bold text-yellow-600">+{preview.points}</p></div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice / Reference</label>
            <input value={form.reference_invoice} onChange={e => setForm(p => ({ ...p, reference_invoice: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" placeholder="INV-001" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <select value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="direct">Direct</option>
                <option value="qr">QR Scan</option>
                <option value="referral">Referral</option>
                <option value="campaign">Campaign</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign (optional)</label>
              <select value={form.campaign_id} onChange={e => setForm(p => ({ ...p, campaign_id: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="">None</option>
                {campaigns.filter(c => c.status === "active").map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <input value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" placeholder="Optional note" />
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={loading} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" />} Add Purchase
          </button>
        </div>
      </div>
    </div>
  );
};

// ----- Redeem Modal -----
const RedeemModal = ({ member, onClose, onSuccess }) => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const balance = member.cashback_balance || 0;

  const submit = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0 || val > balance) { toast.error("Invalid amount"); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("redeem_amount", val);
      const res = await fetch(`${API}/members/${member.id}/cashback/redeem`, { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).detail || "Error");
      const data = await res.json();
      toast.success(`✅ ₹${data.redeemed} redeemed! Remaining: ₹${data.remaining_balance}`);
      onSuccess();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-800 text-lg">Redeem Cashback</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-indigo-50 rounded-xl p-4 text-center">
            <p className="text-sm text-gray-500">Available Balance</p>
            <p className="text-3xl font-bold text-indigo-600">{fmt(balance)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Redeem Amount (₹)</label>
            <input type="number" min="1" max={balance} value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border text-sm font-medium text-gray-600">Cancel</button>
          <button onClick={submit} disabled={loading} className="px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 flex items-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" />} Redeem
          </button>
        </div>
      </div>
    </div>
  );
};

// ----- Enroll Member Modal -----
const EnrollMemberModal = ({ onClose, onSuccess }) => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", city: "", state: "", country: "India", company: "", customer_type: "regular", referred_by: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.name || !form.email || !form.phone) { setError("Name, email and phone are required."); return; }
    setLoading(true); setError("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      const res = await fetch(`${API}/members`, { method: "POST", body: fd });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Enrollment failed"); }
      const data = await res.json();
      toast.success(`🎉 ${data.name} enrolled! Referral code: ${data.referral_code}`);
      onSuccess();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const field = (label, key, type = "text", required = false, placeholder = "") => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && " *"}</label>
      <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" placeholder={placeholder} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">Enroll New Member</h2>
            <p className="text-sm text-gray-500">Add to the Loyalty Program</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {field("Full Name", "name", "text", true, "e.g. Rahul Sharma")}
          {field("Email", "email", "email", true, "rahul@example.com")}
          {field("Phone", "phone", "tel", true, "+91 9000000000")}
          {field("Company", "company", "text", false, "Optional")}
          {field("City", "city")}
          {field("State", "state")}
          {field("Country", "country")}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Member Type</label>
            <select value={form.customer_type} onChange={e => setForm(p => ({ ...p, customer_type: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="regular">Regular</option>
              <option value="vip">VIP</option>
              <option value="premium">Premium</option>
              <option value="dealer">Dealer</option>
              <option value="distributor">Distributor</option>
              <option value="retailer">Retailer</option>
            </select>
          </div>
          {field("Referred By (code)", "referred_by", "text", false, "e.g. RAHU1234")}
        </div>
        {error && <p className="px-6 text-sm text-red-600">{error}</p>}
        <div className="p-6 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border text-sm font-medium text-gray-600">Cancel</button>
          <button onClick={submit} disabled={loading} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" />} Enroll Member
          </button>
        </div>
      </div>
    </div>
  );
};

// ----- Create Campaign Modal -----
const CampaignModal = ({ onClose, onSuccess }) => {
  const [form, setForm] = useState({ name: "", description: "", campaign_type: "cashback", reward_type: "percent", reward_value: "", min_purchase: "", status: "active" });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.name || !form.reward_value) { toast.error("Name & reward value required"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, reward_value: parseFloat(form.reward_value), min_purchase: parseFloat(form.min_purchase) || 0 }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Error");
      toast.success("Campaign created!");
      onSuccess();
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-800 text-lg">Create Campaign</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.campaign_type} onChange={e => setForm(p => ({ ...p, campaign_type: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="cashback">Cashback</option>
                <option value="points">Points</option>
                <option value="qr">QR Campaign</option>
                <option value="referral">Referral</option>
                <option value="milestone">Milestone</option>
              </select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Reward Type</label>
              <select value={form.reward_type} onChange={e => setForm(p => ({ ...p, reward_type: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat (₹)</option>
                <option value="points">Points</option>
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Reward Value *</label>
              <input type="number" value={form.reward_value} onChange={e => setForm(p => ({ ...p, reward_value: e.target.value }))}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" placeholder={form.reward_type === "percent" ? "e.g. 5" : "e.g. 200"} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Min Purchase (₹)</label>
              <input type="number" value={form.min_purchase} onChange={e => setForm(p => ({ ...p, min_purchase: e.target.value }))}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" placeholder="0" /></div>
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border text-sm font-medium text-gray-600">Cancel</button>
          <button onClick={submit} disabled={loading} className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-60 flex items-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" />} Create
          </button>
        </div>
      </div>
    </div>
  );
};

// ----- Member Detail Panel -----
const MemberDetail = ({ member, onClose, onAddCashback, onRedeem, onRefresh }) => {
  const [history, setHistory] = useState([]);
  const cfg = TIER_CONFIG[member.loyalty_tier] || TIER_CONFIG.Silver;
  const progress = pct(member.milestone_progress, member.milestone_target);

  useEffect(() => {
    fetch(`${API}/members/${member.id}/cashback`)
      .then(r => r.ok ? r.json() : [])
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [member.id]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-6 rounded-t-2xl" style={{ background: `linear-gradient(135deg, ${cfg.color}22, ${cfg.color}11)` }}>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl ring-4 flex items-center justify-center text-2xl font-bold text-white shadow-md"
              style={{ background: cfg.color, boxShadow: `0 4px 20px ${cfg.color}66` }}>
              {(member.name || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800">{member.name}</h2>
              <p className="text-sm text-gray-500">{member.email} · {member.phone}</p>
              <div className="flex items-center gap-2 mt-1">
                <TierBadge tier={member.loyalty_tier} />
                <span className="text-xs text-gray-500">ID: {member.id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Cashback", value: fmt(member.total_cashback_earned), color: "#10B981" },
            { label: "Available Balance", value: fmt(member.cashback_balance), color: "#6366F1" },
            { label: "Loyalty Points", value: (member.loyalty_points || 0).toLocaleString(), color: "#F59E0B" },
            { label: "Transactions", value: member.total_transactions_count || 0, color: "#3B82F6" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: s.color + "11" }}>
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Milestone progress */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Milestone Progress</span>
            <span className="text-xs text-gray-500">
              {member.milestone_target ? `₹${((member.milestone_target || 0) - (member.milestone_progress || 0)).toLocaleString()} more to ${_nextTierName(member.loyalty_tier)}` : "Max Tier Reached 👑"}
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: cfg.color }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{fmt(member.milestone_progress)} / {fmt(member.milestone_target)} · {progress}%</p>
        </div>

        {/* Referral card */}
        <div className="px-6 pb-4">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Referral Code</p>
              <p className="text-lg font-bold text-purple-700 font-mono">{member.referral_code || "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">QR Identifier</p>
              <p className="text-sm font-mono text-indigo-600">{member.qr_identifier || "—"}</p>
            </div>
            <QrCode size={40} className="text-purple-400" />
          </div>
        </div>

        {/* Cashback history */}
        <div className="px-6 pb-2">
          <h3 className="font-semibold text-gray-700 text-sm mb-3">Cashback History</h3>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No transactions yet</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.map((t, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${t.transaction_type === "earn" || t.transaction_type === "bonus" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                      {t.transaction_type === "earn" ? "+" : t.transaction_type === "bonus" ? "🎁" : "-"}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-700 capitalize">{t.transaction_type} · {t.channel || "direct"}</p>
                      <p className="text-xs text-gray-400">{t.reference_invoice || t.remarks || "—"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${t.amount >= 0 ? "text-green-600" : "text-red-600"}`}>{t.amount >= 0 ? "+" : ""}₹{Math.abs(t.amount)}</p>
                    <p className="text-xs text-gray-400">{t.created_at ? new Date(t.created_at).toLocaleDateString("en-IN") : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t flex gap-3 flex-wrap">
          <button onClick={() => onAddCashback(member)} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2">
            <Plus size={15} /> Add Purchase
          </button>
          <button onClick={() => onRedeem(member)} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 flex items-center justify-center gap-2">
            <Wallet size={15} /> Redeem Cashback
          </button>
        </div>
      </div>
    </div>
  );
};

function _nextTierName(tier) {
  const order = ["Silver", "Gold", "Platinum", "Diamond"];
  const idx = order.indexOf(tier);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : "Diamond";
}

// ===================================================================
// Main LoyaltyPlatform Page
// ===================================================================
const LoyaltyPlatform = () => {
  const [tab, setTab] = useState("members");
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [modals, setModals] = useState({ enroll: false, campaign: false, addPurchase: null, redeem: null, viewMember: null });

  const openModal = (key, val = true) => setModals(p => ({ ...p, [key]: val }));
  const closeModal = (key) => setModals(p => ({ ...p, [key]: false, ...(key === "addPurchase" || key === "redeem" || key === "viewMember" ? { [key]: null } : {}) }));

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, membersRes, campaignsRes, referralsRes, tiersRes] = await Promise.all([
        fetch(`${API}/dashboard`),
        fetch(`${API}/members?limit=100`),
        fetch(`${API}/campaigns`),
        fetch(`${API}/referrals`),
        fetch(`${API}/tiers`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (membersRes.ok) setMembers(await membersRes.json());
      if (campaignsRes.ok) setCampaigns(await campaignsRes.json());
      if (referralsRes.ok) setReferrals(await referralsRes.json());
      if (tiersRes.ok) setTiers(await tiersRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filteredMembers = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.name?.toLowerCase().includes(q) || m.phone?.includes(q) || m.email?.toLowerCase().includes(q) || m.referral_code?.toLowerCase().includes(q);
    const matchTier = !tierFilter || m.loyalty_tier === tierFilter;
    return matchSearch && matchTier;
  });

  const onActionSuccess = () => { closeModal("addPurchase"); closeModal("redeem"); closeModal("enroll"); closeModal("campaign"); loadAll(); };

  // ---- TABS ----
  const tabs = [
    { key: "members", label: "Members", icon: Users },
    { key: "campaigns", label: "Campaigns", icon: Zap },
    { key: "referrals", label: "Referrals", icon: Share2 },
    { key: "tiers", label: "Tier Setup", icon: Crown },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown size={24} className="text-yellow-300" />
              <h1 className="text-2xl font-bold">Loyalty Platform</h1>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">CRM Integrated</span>
            </div>
            <p className="text-indigo-100 text-sm">Manage relationships. Reward loyalty. Drive repeat business.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => openModal("enroll")} className="bg-white text-indigo-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-50 flex items-center gap-2 shadow-sm">
              <Plus size={16} /> Enroll Member
            </button>
            <button onClick={() => openModal("campaign")} className="bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/30 flex items-center gap-2 border border-white/30">
              <Zap size={16} /> New Campaign
            </button>
            <button onClick={loadAll} className="bg-white/20 text-white p-2.5 rounded-xl hover:bg-white/30 border border-white/30">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <StatCard icon={Users} label="Total Members" value={stats.total_members} color="#6366F1" trend={8} />
            <StatCard icon={IndianRupee} label="Total Cashback Earned" value={fmt(stats.total_cashback_earned)} color="#10B981" trend={12} />
            <StatCard icon={Wallet} label="Pending Cashback" value={fmt(stats.pending_cashback)} color="#F59E0B" />
            <StatCard icon={BarChart3} label="Total Transactions" value={stats.total_transactions?.toLocaleString()} color="#3B82F6" trend={5} />
            <StatCard icon={Zap} label="Active Campaigns" value={stats.active_campaigns} color="#EC4899" />
          </div>
        )}

        {/* Tier Breakdown */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.tier_breakdown || {}).map(([tier, count]) => {
              const cfg = TIER_CONFIG[tier] || TIER_CONFIG.Silver;
              return (
                <div key={tier} className={`${cfg.bg} rounded-2xl p-4 flex items-center gap-4 border cursor-pointer hover:shadow-md transition-all`}
                  onClick={() => { setTierFilter(tier === tierFilter ? "" : tier); setTab("members"); }}>
                  <div className="text-3xl">{cfg.icon}</div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: cfg.color }}>{count}</p>
                    <p className="text-sm font-semibold text-gray-600">{tier} Members</p>
                  </div>
                  {tierFilter === tier && <CheckCircle size={16} style={{ color: cfg.color }} className="ml-auto" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex border-b px-2">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-all ${tab === t.key ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                <t.icon size={15} />{t.label}
              </button>
            ))}
          </div>

          {/* --- Members Tab --- */}
          {tab === "members" && (
            <div>
              <div className="flex items-center gap-3 p-4 border-b flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search name, phone, email, referral code…"
                    className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                </div>
                <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}
                  className="border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">All Tiers</option>
                  {["Silver", "Gold", "Platinum", "Diamond"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="text-xs text-gray-400">{filteredMembers.length} members</span>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                  <Loader2 size={20} className="animate-spin" /> Loading members…
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <Users size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-semibold">No members found</p>
                  <p className="text-sm mt-1">Enroll a member to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {["Member", "Tier", "Total Earned", "Balance", "Points", "Milestone", "Ref. Code", ""].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredMembers.map(m => (
                        <MemberRow key={m.id} member={m}
                          onView={(mem) => openModal("viewMember", mem)}
                          onAddCashback={(mem) => openModal("addPurchase", mem)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* --- Campaigns Tab --- */}
          {tab === "campaigns" && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-700">{campaigns.length} Campaigns</h3>
                <button onClick={() => openModal("campaign")} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-purple-700 flex items-center gap-2">
                  <Plus size={15} /> New Campaign
                </button>
              </div>
              {campaigns.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><Zap size={36} className="mx-auto mb-2 opacity-30" /><p>No campaigns yet</p></div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {campaigns.map(c => (
                    <div key={c.id} className="border rounded-2xl p-5 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-bold text-gray-800">{c.name}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{c.description || "No description"}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${c.status === "active" ? "bg-green-100 text-green-700" : c.status === "paused" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>
                          {c.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-purple-50 rounded-lg p-2"><p className="font-bold text-purple-700">{c.reward_value}{c.reward_type === "percent" ? "%" : "₹"}</p><p className="text-gray-500">Reward</p></div>
                        <div className="bg-blue-50 rounded-lg p-2"><p className="font-bold text-blue-700">{c.redemption_count || 0}</p><p className="text-gray-500">Used</p></div>
                        <div className="bg-green-50 rounded-lg p-2"><p className="font-bold text-green-700">₹{(c.total_reward_given || 0).toLocaleString()}</p><p className="text-gray-500">Given</p></div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        {c.status === "active" ? (
                          <button onClick={async () => { await fetch(`${API}/campaigns/${c.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "paused" }) }); loadAll(); }}
                            className="flex-1 py-2 rounded-lg bg-yellow-50 text-yellow-700 text-xs font-semibold hover:bg-yellow-100">Pause</button>
                        ) : (
                          <button onClick={async () => { await fetch(`${API}/campaigns/${c.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "active" }) }); loadAll(); }}
                            className="flex-1 py-2 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100">Activate</button>
                        )}
                        <button onClick={async () => { await fetch(`${API}/campaigns/${c.id}`, { method: "DELETE" }); loadAll(); }}
                          className="py-2 px-3 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100"><XCircle size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* --- Referrals Tab --- */}
          {tab === "referrals" && (
            <div className="p-6">
              <div className="flex gap-4 mb-4 text-sm">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-2">
                  <Clock size={16} className="text-yellow-600" />
                  <span className="font-semibold text-yellow-700">{referrals.filter(r => r.status === "pending").length} Pending</span>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="font-semibold text-green-700">{referrals.filter(r => r.status === "rewarded").length} Rewarded</span>
                </div>
              </div>
              {referrals.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><Share2 size={36} className="mx-auto mb-2 opacity-30" /><p>No referrals yet</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {["Referrer ID", "Referred Phone", "Referral Code", "Status", "Referrer Reward", "Referred Reward", "Date", "Action"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {referrals.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs font-mono text-gray-600">{r.referrer_id}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{r.referred_phone || r.referred_member_id || "—"}</td>
                          <td className="px-4 py-3"><span className="font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded">{r.referral_code}</span></td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${r.status === "rewarded" ? "bg-green-100 text-green-700" : r.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>{r.status}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-green-600 font-semibold">₹{r.referrer_reward}</td>
                          <td className="px-4 py-3 text-sm text-indigo-600 font-semibold">₹{r.referred_reward}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">{r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN") : "—"}</td>
                          <td className="px-4 py-3">
                            {r.status === "pending" && (
                              <button onClick={async () => { await fetch(`${API}/referrals/${r._id || r.id}/reward`, { method: "POST" }); loadAll(); }}
                                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">Reward</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* --- Tiers Tab --- */}
          {tab === "tiers" && (
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-6">Tier thresholds and cashback rates configure automatically based on member lifetime spend.</p>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {tiers.map(t => {
                  const cfg = TIER_CONFIG[t.tier_name] || TIER_CONFIG.Silver;
                  return (
                    <div key={t.tier_name} className={`${cfg.bg} rounded-2xl p-5 border`}>
                      <div className="text-3xl mb-3">{cfg.icon}</div>
                      <h3 className="text-lg font-bold" style={{ color: cfg.color }}>{t.tier_name}</h3>
                      <p className="text-sm text-gray-500 mt-1">Min Spend: <strong>₹{(t.min_spend || 0).toLocaleString()}</strong></p>
                      <p className="text-sm text-gray-500">Cashback: <strong className="text-green-600">{t.cashback_rate}%</strong></p>
                      <p className="text-sm text-gray-500">Points Multiplier: <strong className="text-indigo-600">{t.points_multiplier}×</strong></p>
                      <div className="mt-3 space-y-1">
                        {(t.benefits || []).map((b, j) => (
                          <div key={j} className="flex items-center gap-1.5 text-xs text-gray-600">
                            <CheckCircle size={12} style={{ color: cfg.color }} />{b}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {modals.enroll && <EnrollMemberModal onClose={() => closeModal("enroll")} onSuccess={onActionSuccess} />}
      {modals.campaign && <CampaignModal onClose={() => closeModal("campaign")} onSuccess={onActionSuccess} />}
      {modals.addPurchase && <AddPurchaseModal member={modals.addPurchase} campaigns={campaigns} onClose={() => closeModal("addPurchase")} onSuccess={onActionSuccess} />}
      {modals.redeem && <RedeemModal member={modals.redeem} onClose={() => closeModal("redeem")} onSuccess={onActionSuccess} />}
      {modals.viewMember && (
        <MemberDetail member={modals.viewMember} onClose={() => closeModal("viewMember")}
          onAddCashback={(m) => { closeModal("viewMember"); openModal("addPurchase", m); }}
          onRedeem={(m) => { closeModal("viewMember"); openModal("redeem", m); }}
          onRefresh={loadAll} />
      )}
    </div>
  );
};

export default LoyaltyPlatform;
