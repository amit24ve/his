import React from 'react';
import CustomerProfile from '../components/CRM/CustomerProfile';
import { Link } from 'react-router-dom';
import { Crown, Zap, Gift, TrendingUp, ArrowRight } from 'lucide-react';

const LoyaltyCallout = () => (
  <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-6 text-white flex items-center justify-between flex-wrap gap-4 shadow-lg">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
        <Crown size={28} className="text-yellow-300" />
      </div>
      <div>
        <h2 className="text-xl font-bold">Loyalty Platform</h2>
        <p className="text-indigo-100 text-sm">Cashback · Points · Tiers · Campaigns · Referrals — all in one place</p>
      </div>
    </div>
    <div className="flex gap-3 flex-wrap">
      {[
        { icon: Gift, label: "Cashback" },
        { icon: Zap, label: "Campaigns" },
        { icon: TrendingUp, label: "Tiers" },
      ].map(({ icon: Icon, label }) => (
        <div key={label} className="bg-white/15 rounded-xl px-3 py-2 text-center text-xs font-semibold border border-white/20 flex items-center gap-1.5">
          <Icon size={14} /> {label}
        </div>
      ))}
      <Link to="/loyalty" className="bg-white text-indigo-700 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-50 flex items-center gap-2 shadow-sm">
        Open Loyalty Platform <ArrowRight size={15} />
      </Link>
    </div>
  </div>
);

const CRMPage = () => {
  return (
    <div className="p-6 space-y-6">
      <LoyaltyCallout />
      <CustomerProfile />
    </div>
  );
};

export default CRMPage;
