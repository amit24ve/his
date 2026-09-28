import React from "react";

// Status and Source Options
const statusOptions = [
{ value: "all", label: "All Statuses" },
{ value: "new", label: "New" },
{ value: "contacted", label: "Contacted" },
{ value: "qualified", label: "Qualified" },
{ value: "proposal", label: "Proposal" },
{ value: "converted", label: "Converted" },
{ value: "lost", label: "Lost" }
];
const sourceOptions = [
{ value: "all", label: "All Sources" },
{ value: "Website", label: "Website" },
{ value: "Referral", label: "Referral" },
{ value: "Phone Call", label: "Phone Call" },
{ value: "Email", label: "Email" },
{ value: "Online Store", label: "Online Store" },
{ value: "Social Media", label: "Social Media" },
{ value: "Paid", label: "Paid" }
];

export default function LeadFilter({
searchQuery,
onSearchChange,
filterStatus,
onStatusChange,
filterSource,
onSourceChange,
filterStartDate,
filterEndDate,
onStartDateChange,
onEndDateChange,
onShowTable,
showTable,
onReset,
}) {
return (
    <div className="rounded-2xl bg-white shadow-sm p-6 mb-6 animate-fade-in max-w-full">
    <h2 className="text-lg font-semibold text-gray-800 mb-6">Lead Filters</h2>
      {/* Responsive Grid with tight gap and wrap */}
    <div className="flex flex-wrap gap-x-3 gap-y-2 mb-5">
        {/* Search */}
        <div className="flex-1 min-w-[150px] max-w-xs mb-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
        <div className="relative group animate-slide-up">
            <input
            type="text"
            className="w-full border border-gray-300 rounded-full pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition placeholder-gray-400"
            placeholder="Search leads..."
            value={searchQuery}
            onChange={onSearchChange}
            autoComplete="off"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="h-5 w-5 text-gray-400 group-focus-within:text-green-500 transition" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            </div>
        </div>
        </div>
        {/* Status */}
        <div className="flex-1 min-w-[120px] max-w-xs mb-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
            className="w-full border border-gray-300 rounded-full px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
            value={filterStatus}
            onChange={onStatusChange}
        >
            {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
        </div>
        {/* Source */}
        <div className="flex-1 min-w-[120px] max-w-xs mb-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
        <select
            className="w-full border border-gray-300 rounded-full px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
            value={filterSource}
            onChange={onSourceChange}
        >
            {sourceOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
        </div>
        {/* Start Date */}
        <div className="flex-1 min-w-[120px] max-w-xs mb-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
        <input
            type="date"
            className="w-full border border-gray-300 rounded-full px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
            value={filterStartDate}
            onChange={onStartDateChange}
            placeholder="dd-mm-yyyy"
        />
        </div>
        {/* End Date */}
        <div className="flex-1 min-w-[120px] max-w-xs mb-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
        <input
            type="date"
            className="w-full border border-gray-300 rounded-full px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
            value={filterEndDate}
            onChange={onEndDateChange}
            placeholder="dd-mm-yyyy"
        />
        </div>
    </div>
      {/* Actions */}
    <div className="flex flex-wrap gap-2 mt-1">
        <button
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-full font-semibold shadow-md text-white bg-green-600 hover:bg-green-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-400 text-base animate-pop-in"
        onClick={onShowTable}
        type="button"
        >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 3a1 1 0 01.894.553l7 14A1 1 0 0117 19H3a1 1 0 01-.894-1.447l7-14A1 1 0 0110 3zm0 3.618L5.132 17h9.736L10 6.618z" />
        </svg>
        {showTable ? "Hide All Leads" : "View All Leads"}
        </button>
        <button
        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-full text-base hover:bg-gray-200 transition-all duration-150 font-semibold"
        onClick={onReset}
        type="button"
        >
        Reset Filters
        </button>
    </div>
      {/* Animations */}
    <style>{`
        .animate-fade-in {animation: fade-in 0.4s cubic-bezier(.4,0,.2,1);}
        .animate-slide-up {animation: slide-up 0.5s cubic-bezier(.4,0,.2,1);}
        .animate-pop-in {animation: pop-in 0.22s cubic-bezier(.4,0,.2,1);}
        @keyframes fade-in {from{opacity:0} to{opacity:1}}
        @keyframes slide-up {from{opacity:0;transform:translateY(24px);} to{opacity:1;transform:translateY(0);}}
        @keyframes pop-in {0%{transform:scale(0.97);opacity:0} 100%{transform:scale(1);opacity:1}}
    `}</style>
    </div>
);
}