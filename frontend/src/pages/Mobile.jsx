import React from "react";

const features = [
  {
    title: "Lead Entry",
    description: "Quickly capture and manage leads in the field for seamless follow-up and conversion.",
    icon: (
      <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 10h10M7 14h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Visit Logs with GPS",
    description: "Effortlessly record visit locations and times using integrated GPS for accountability.",
    icon: (
      <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="10" r="4" />
        <path d="M12 14v6" strokeLinecap="round" />
        <path d="M12 2v2m0 16v2m10-10h-2M4 12H2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Daily Reporting",
    description: "Submit daily activity reports directly from your mobile device, ensuring real-time updates.",
    icon: (
      <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
        <path d="M9 16h6M9 12h6M9 8h6" />
      </svg>
    ),
  },
  {
    title: "Instant Document Upload",
    description: "Capture and upload documents instantly, streamlining paperwork and record-keeping.",
    icon: (
      <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="7" y="3" width="10" height="14" rx="2" />
        <path d="M12 17v4M9 21h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Push Notifications for Tasks/Reminders",
    description: "Stay updated with instant push notifications for critical tasks and reminders.",
    icon: (
      <svg className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M18 16v-5a6 6 0 00-12 0v5m2 2h8" />
        <circle cx="12" cy="20" r="1" />
      </svg>
    ),
  },
];

export default function Mobile() {
  return (
    <section className="w-full min-h-screen px-4 py-12 bg-gradient-to-tr from-slate-50 via-white to-blue-50 flex flex-col items-center">
      {/* Card-style header with icon */}
      <div className="flex justify-center items-center w-full mb-8">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full px-8 py-8 text-center border border-gray-100">
          <div className="flex justify-center mb-6">
            <svg className="w-14 h-14 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 48 48">
              <rect x="8" y="12" width="32" height="24" rx="6" fill="#dbeafe" />
              <path d="M16 20h16M16 28h10" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="24" cy="28" r="2" fill="#2563eb" />
            </svg>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">
            Mobile App Field Use
          </h2>
          <p className="text-lg text-gray-600">
            Empower your field teams with a robust mobile application. Capture leads, log visits, report activities, upload documents, and receive timely notifications—all in real time, from anywhere.
          </p>
        </div>
      </div>
      {/* Feature cards */}
      <div className="max-w-4xl w-full flex flex-col items-center text-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
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