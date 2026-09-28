import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCurrentUser } from '../hooks/useCurrentUser';

// ErrorBoundary component for better error handling
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log error if needed
    // console.error("ErrorBoundary caught error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: '#fee',
          color: '#a00',
          padding: 24,
          borderRadius: 8,
          margin: 24,
          border: '1px solid #a00'
        }}>
          <h2>Something went wrong in the Dashboard.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <p>
            Please reload the page or contact support.<br />
            <a href="https://react.dev/link/error-boundaries" target="_blank" rel="noopener noreferrer">Learn more about error boundaries</a>
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { isAdmin, hospital_id, hospital_name, headers } = useCurrentUser();
  const [kpis, setKpis] = useState({});
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(''); // admin filter

  // Load hospitals list for admin filter
  useEffect(() => {
    if (!isAdmin) return;
    fetch('https://cubehis.avopay.pro:5000/api/hospitals/', { headers })
      .then(r => r.json())
      .then(d => setHospitals(Array.isArray(d) ? d : (d.hospitals || [])))
      .catch(() => {});
  }, [isAdmin]);

  const statsParams = () => {
    const p = new URLSearchParams();
    const hid = isAdmin ? selectedHospital : hospital_id;
    if (hid) p.set('hospital_id', hid);
    return p.toString() ? `?${p.toString()}` : '';
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const qs = statsParams();
      try {
        const [apptStats, opdStats, ipdStats, billingStats, labStats, pharmaStats, otStats] = await Promise.allSettled([
          fetch(`https://cubehis.avopay.pro:5000/api/appointments/stats${qs}`, { headers }).then(r => r.json()),
          fetch(`https://cubehis.avopay.pro:5000/api/opd/stats${qs}`, { headers }).then(r => r.json()),
          fetch(`https://cubehis.avopay.pro:5000/api/ipd/stats${qs}`, { headers }).then(r => r.json()),
          fetch(`https://cubehis.avopay.pro:5000/api/billing/stats${qs}`, { headers }).then(r => r.json()),
          fetch(`https://cubehis.avopay.pro:5000/api/laboratory/stats${qs}`, { headers }).then(r => r.json()),
          fetch(`https://cubehis.avopay.pro:5000/api/pharmacy/stats${qs}`, { headers }).then(r => r.json()),
          fetch(`https://cubehis.avopay.pro:5000/api/ot/stats${qs}`, { headers }).then(r => r.json()),
        ]);
        const g = (res) => res.status === 'fulfilled' ? res.value : {};
        setKpis({
          todayAppointments: g(apptStats).today_total ?? g(apptStats).total ?? '-',
          opdQueue: g(opdStats).waiting ?? '-',
          currentlyAdmitted: g(ipdStats).currently_admitted ?? '-',
          bedOccupancy: g(ipdStats).bed_occupancy_pct != null ? `${g(ipdStats).bed_occupancy_pct}%` : '-',
          todayRevenue: g(billingStats).today_revenue != null ? `\u20B9${Number(g(billingStats).today_revenue).toLocaleString('en-IN')}` : '-',
          labPending: g(labStats).pending ?? '-',
          pharmaLowStock: g(pharmaStats).low_stock ?? '-',
          todaySurgeries: g(otStats).today_total ?? g(otStats).today ?? '-',
        });
        // Recent appointments
        const apptRes = await fetch(`https://cubehis.avopay.pro:5000/api/appointments?limit=5${qs ? '&' + qs.slice(1) : ''}`, { headers });
        const apptData = await apptRes.json();
        setRecentAppointments(Array.isArray(apptData) ? apptData.slice(0, 5) : (apptData.appointments || []).slice(0, 5));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [selectedHospital]);

  const KPI_CARDS = [
    { label: "Today's Appointments", value: kpis.todayAppointments, icon: 'calendar-check', color: 'blue', path: '/appointments' },
    { label: 'OPD Waiting', value: kpis.opdQueue, icon: 'hourglass-half', color: 'yellow', path: '/opd' },
    { label: 'Admitted Patients', value: kpis.currentlyAdmitted, icon: 'bed', color: 'indigo', path: '/ipd' },
    { label: 'Bed Occupancy', value: kpis.bedOccupancy, icon: 'percent', color: 'purple', path: '/ipd' },
    { label: "Today's Revenue", value: kpis.todayRevenue, icon: 'rupee-sign', color: 'green', path: '/billing' },
    { label: 'Lab Orders Pending', value: kpis.labPending, icon: 'flask', color: 'orange', path: '/laboratory' },
    { label: 'Pharmacy Low Stock', value: kpis.pharmaLowStock, icon: 'exclamation-triangle', color: 'red', path: '/pharmacy' },
    { label: "Today's Surgeries", value: kpis.todaySurgeries, icon: 'procedures', color: 'teal', path: '/ot' },
  ];

  const QUICK_LINKS = [
    { label: 'New Appointment', icon: 'calendar-plus', path: '/appointments', color: 'blue' },
    { label: 'Register Patient', icon: 'user-plus', path: '/patients/registration', color: 'indigo' },
    { label: 'OPD Queue', icon: 'list-ol', path: '/opd', color: 'yellow' },
    { label: 'IPD Admissions', icon: 'hospital', path: '/ipd', color: 'purple' },
    { label: 'Lab Orders', icon: 'flask', path: '/laboratory', color: 'orange' },
    { label: 'Billing', icon: 'file-invoice-dollar', path: '/billing', color: 'green' },
    { label: 'Pharmacy', icon: 'pills', path: '/pharmacy', color: 'pink' },
    { label: 'Blood Bank', icon: 'tint', path: '/blood-bank', color: 'red' },
  ];

  const COLOR_MAP = {
    blue: { card: 'border-blue-500', icon: 'bg-blue-100 text-blue-600', val: 'text-blue-700' },
    yellow: { card: 'border-yellow-500', icon: 'bg-yellow-100 text-yellow-600', val: 'text-yellow-700' },
    indigo: { card: 'border-indigo-500', icon: 'bg-indigo-100 text-indigo-600', val: 'text-indigo-700' },
    purple: { card: 'border-purple-500', icon: 'bg-purple-100 text-purple-600', val: 'text-purple-700' },
    green: { card: 'border-green-500', icon: 'bg-green-100 text-green-600', val: 'text-green-700' },
    orange: { card: 'border-orange-500', icon: 'bg-orange-100 text-orange-600', val: 'text-orange-700' },
    red: { card: 'border-red-500', icon: 'bg-red-100 text-red-600', val: 'text-red-700' },
    teal: { card: 'border-teal-500', icon: 'bg-teal-100 text-teal-600', val: 'text-teal-700' },
    pink: { card: 'border-pink-500', icon: 'bg-pink-100 text-pink-600', val: 'text-pink-700' },
  };

  return (
    <ErrorBoundary>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-blue-800">CubeMed HIS Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">
              {isAdmin
                ? 'Admin View — All Hospitals'
                : hospital_name
                  ? <span><i className="fas fa-hospital text-blue-400 mr-1" />{hospital_name}</span>
                  : 'Hospital Information System — Real-time overview'
              }
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Admin: hospital filter dropdown */}
            {isAdmin && (
              <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-xl px-3 py-2 shadow-sm">
                <i className="fas fa-hospital text-blue-500 text-sm" />
                <select
                  value={selectedHospital}
                  onChange={e => setSelectedHospital(e.target.value)}
                  className="text-sm text-gray-700 focus:outline-none bg-transparent font-medium min-w-[160px]"
                >
                  <option value="">All Hospitals</option>
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
                  ))}
                </select>
              </div>
            )}
            <div className="text-sm text-gray-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>

        {/* Hospital info banner for non-admin */}
        {!isAdmin && hospital_name && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm">
            <i className="fas fa-hospital-alt text-blue-600 text-lg" />
            <div>
              <span className="font-bold text-blue-800">{hospital_name}</span>
              <span className="text-blue-400 ml-2 text-xs">Showing data for your hospital only</span>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {KPI_CARDS.map((card, i) => {
            const c = COLOR_MAP[card.color] || COLOR_MAP.blue;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                onClick={() => navigate(card.path)} className={`bg-white rounded-xl p-4 shadow border-l-4 ${c.card} cursor-pointer hover:shadow-md transition`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase leading-tight">{card.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${c.val}`}>{loading ? '...' : card.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${c.icon}`}>
                    <i className={`fas fa-${card.icon}`} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-base font-bold text-gray-700 mb-4"><i className="fas fa-bolt mr-2 text-yellow-500" />Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
            {QUICK_LINKS.map((ql, i) => {
              const c = COLOR_MAP[ql.color] || COLOR_MAP.blue;
              return (
                <motion.button key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(ql.path)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl ${c.icon.replace('text-', 'hover:bg-').replace('-600', '-200')} bg-gray-50 hover:shadow transition group`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${c.icon}`}>
                    <i className={`fas fa-${ql.icon} text-lg`} />
                  </div>
                  <span className="text-xs font-medium text-gray-600 text-center leading-tight">{ql.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Recent Appointments */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-blue-50">
            <h2 className="text-base font-bold text-blue-800"><i className="fas fa-calendar-alt mr-2" />Recent Appointments</h2>
            <button onClick={() => navigate('/appointments')} className="text-sm text-blue-600 hover:underline">View All &rarr;</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-blue-50">
                <tr>
                  {['Token', 'MRN', 'Patient', 'Doctor', 'Department', 'Date', 'Time', 'Type', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-400"><i className="fas fa-spinner fa-spin mr-2" />Loading...</td></tr>
                ) : recentAppointments.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-400">No recent appointments</td></tr>
                ) : recentAppointments.map((a, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-bold text-blue-700">#{a.token_number}</td>
                    <td className="px-4 py-3">
                      {a.mrn ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 border border-teal-200 text-teal-700 rounded-md text-xs font-mono font-semibold">
                          <i className="fas fa-id-card text-teal-400" style={{fontSize:'10px'}} />
                          {a.mrn}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{a.patient_name}</div>
                      <div className="text-xs text-gray-400">{a.patient_mobile}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{a.doctor_name}</td>
                    <td className="px-4 py-3 text-gray-600">{a.department}</td>
                    <td className="px-4 py-3 text-gray-600">{a.appointment_date}</td>
                    <td className="px-4 py-3 text-gray-600">{a.appointment_time}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{a.appointment_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${{
                        Scheduled: 'bg-blue-100 text-blue-700',
                        Completed: 'bg-green-100 text-green-700',
                        Cancelled: 'bg-red-100 text-red-700',
                        'In Consultation': 'bg-yellow-100 text-yellow-700',
                      }[a.status] || 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Module Navigation Grid */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-base font-bold text-gray-700 mb-4"><i className="fas fa-th-large mr-2 text-blue-500" />Hospital Modules</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
            {[
              { label: 'Appointments', icon: 'calendar-check', path: '/appointments', color: 'blue' },
              { label: 'Patient Reg.', icon: 'user-injured', path: '/patients/registration', color: 'indigo' },
              { label: 'OPD', icon: 'hospital-user', path: '/opd', color: 'yellow' },
              { label: 'IPD/Ward', icon: 'bed', path: '/ipd', color: 'purple' },
              { label: 'EMR', icon: 'notes-medical', path: '/emr', color: 'teal' },
              { label: 'Nursing', icon: 'user-nurse', path: '/nursing', color: 'pink' },
              { label: 'OT', icon: 'procedures', path: '/ot', color: 'orange' },
              { label: 'Pharmacy', icon: 'pills', path: '/pharmacy', color: 'green' },
              { label: 'Laboratory', icon: 'flask', path: '/laboratory', color: 'orange' },
              { label: 'Radiology', icon: 'x-ray', path: '/radiology', color: 'indigo' },
              { label: 'Blood Bank', icon: 'tint', path: '/blood-bank', color: 'red' },
              { label: 'Teleconsult', icon: 'video', path: '/teleconsult', color: 'blue' },
              { label: 'Billing', icon: 'file-invoice-dollar', path: '/billing', color: 'green' },
              { label: 'MIS Reports', icon: 'chart-bar', path: '/reports', color: 'purple' },
            ].map((m, i) => {
              const c = COLOR_MAP[m.color] || COLOR_MAP.blue;
              return (
                <motion.button key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  onClick={() => navigate(m.path)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-blue-50 hover:shadow transition group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.icon}`}>
                    <i className={`fas fa-${m.icon} text-lg`} />
                  </div>
                  <span className="text-xs font-medium text-gray-600 text-center leading-tight">{m.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Dashboard;
