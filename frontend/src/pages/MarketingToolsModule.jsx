import React from "react";

const features = [
  {
    title: "Bulk WhatsApp/Email Campaigns",
    description:
      "Easily send targeted WhatsApp and email campaigns in bulk to your leads and customers with advanced filtering options.",
    icon: (
      <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 12h2a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v3a2 2 0 002 2h2m4 0v4m0 0l-2-2m2 2l2-2"></path>
      </svg>
    ),
  },
  {
    title: "Lead Nurturing Drip Messages",
    description:
      "Automate follow-ups with personalized drip messages to nurture your leads and increase engagement.",
    icon: (
      <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12"></path>
      </svg>
    ),
  },
  {
    title: "Festival & Occasion Campaigns",
    description:
      "Run timely campaigns for festivals and special occasions with ready-made templates and scheduling.",
    icon: (
      <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
      </svg>
    ),
  },
  {
    title: "Social Media Integration",
    description:
      "Integrate your campaigns with social media platforms to maximize reach and track performance.",
    icon: (
      <svg className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 3v4M8 3v4m-4 4h16" />
      </svg>
    ),
  },
];

export default function MarketingToolsModule() {
  return (
    <section className="w-full px-4 py-12 bg-gradient-to-tr from-gray-50 via-white to-slate-100 min-h-screen flex flex-col items-center">
      {/* Card-style header with image/icon */}
      <div className="flex justify-center items-center w-full mb-12">
        <div className="bg-white rounded-3xl shadow-xl max-w-3xl w-full px-8 py-10 text-center border border-gray-100">
          {/* Replace below SVG with your SVG, PNG, or <img src="..."/> if needed */}
          <div className="flex justify-center mb-6">
            <svg className="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 48 48">
              <rect x="4" y="8" width="40" height="28" rx="6" fill="#e0e7ff" />
              <path d="M8 12h32M8 36h32" stroke="#3b82f6" strokeWidth="2"/>
              <circle cx="24" cy="22" r="6" fill="#3b82f6" />
              <path d="M24 28v6" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {/* Or use: <img src="/your-image.png" alt="Marketing" className="w-16 h-16 object-contain" /> */}
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            Marketing Tools 
          </h2>
          <p className="text-lg text-gray-600 mb-0">
            Unlock the full potential of your business with an integrated suite of advanced marketing tools.
            Streamline campaign management, foster meaningful customer relationships, and drive measurable results—all within a single, unified platform.
          </p>
        </div>
      </div>
      {/* Feature cards */}
      <div className="max-w-4xl w-full flex flex-col items-center text-center">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="rounded-2xl shadow-lg bg-white p-8 flex flex-col items-center hover:scale-[1.03] transition-transform border border-gray-100"
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">{feature.title}</h3>
              <p className="text-gray-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}