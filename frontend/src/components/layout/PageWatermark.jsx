import React from 'react';
import { useLocation } from 'react-router-dom';

/* ── Per-route watermark SVGs ── */
const WATERMARKS = {
  '/blood-bank': {
    color: '#dc2626',
    label: 'Blood Bank',
    svg: (c) => (
      <>
        {/* Large blood drop */}
        <path d="M100 15 C100 15 40 80 40 115 C40 148 67 170 100 170 C133 170 160 148 160 115 C160 80 100 15 100 15Z" fill={c} />
        {/* Shine */}
        <ellipse cx="82" cy="100" rx="10" ry="18" fill="white" opacity="0.18" transform="rotate(-20 82 100)" />
        {/* Small drops */}
        <path d="M155 50 C155 50 140 68 140 78 C140 88 147 94 155 94 C163 94 170 88 170 78 C170 68 155 50 155 50Z" fill={c} opacity="0.5" />
        <path d="M40 40 C40 40 28 54 28 62 C28 70 33 74 40 74 C47 74 52 70 52 62 C52 54 40 40 40 40Z" fill={c} opacity="0.4" />
        {/* RBC circles */}
        <circle cx="100" cy="120" r="16" fill="white" opacity="0.12" />
        <circle cx="70" cy="140" r="10" fill="white" opacity="0.1" />
        <circle cx="130" cy="138" r="10" fill="white" opacity="0.1" />
      </>
    ),
  },

  '/laboratory': {
    color: '#7c3aed',
    label: 'Laboratory',
    svg: (c) => (
      <>
        {/* Flask body */}
        <path d="M80 20 L80 90 L30 170 Q25 180 35 185 L165 185 Q175 180 170 170 L120 90 L120 20 Z" fill={c} opacity="0.9" />
        {/* Flask neck */}
        <rect x="75" y="15" width="50" height="15" rx="5" fill={c} />
        {/* Liquid inside */}
        <path d="M45 155 L155 155 L165 175 Q170 182 162 184 L38 184 Q30 182 35 175 Z" fill="white" opacity="0.2" />
        {/* Bubbles */}
        <circle cx="85" cy="158" r="6" fill="white" opacity="0.3" />
        <circle cx="105" cy="165" r="4" fill="white" opacity="0.25" />
        <circle cx="120" cy="155" r="5" fill="white" opacity="0.3" />
        {/* Shimmer */}
        <ellipse cx="90" cy="70" rx="6" ry="20" fill="white" opacity="0.15" transform="rotate(-15 90 70)" />
        {/* Stars/sparkles */}
        <circle cx="160" cy="50" r="4" fill={c} opacity="0.5" />
        <circle cx="40" cy="60" r="3" fill={c} opacity="0.4" />
      </>
    ),
  },

  '/pharmacy': {
    color: '#059669',
    label: 'Pharmacy',
    svg: (c) => (
      <>
        {/* Rx symbol */}
        <text x="30" y="140" fontSize="160" fontWeight="900" fill={c} opacity="0.85" fontFamily="Georgia,serif">Rx</text>
        {/* Pill capsule */}
        <rect x="60" y="155" width="80" height="32" rx="16" fill={c} opacity="0.5" />
        <rect x="60" y="155" width="40" height="32" rx="16" fill="white" opacity="0.2" />
        {/* Small pills */}
        <ellipse cx="155" cy="60" rx="18" ry="10" fill={c} opacity="0.4" transform="rotate(-30 155 60)" />
        <ellipse cx="50" cy="50" rx="14" ry="8" fill={c} opacity="0.35" transform="rotate(20 50 50)" />
        {/* Cross */}
        <rect x="160" y="120" width="30" height="8" rx="3" fill={c} opacity="0.4" />
        <rect x="171" y="109" width="8" height="30" rx="3" fill={c} opacity="0.4" />
      </>
    ),
  },

  '/radiology': {
    color: '#0369a1',
    label: 'Radiology',
    svg: (c) => (
      <>
        {/* X-ray film frame */}
        <rect x="30" y="20" width="140" height="170" rx="6" fill={c} opacity="0.15" />
        <rect x="30" y="20" width="140" height="170" rx="6" stroke={c} strokeWidth="4" fill="none" />
        {/* Chest X-ray silhouette */}
        <path d="M70 55 C55 65 48 90 50 120 C52 140 60 155 75 160 L125 160 C140 155 148 140 150 120 C152 90 145 65 130 55 C120 48 110 45 100 45 C90 45 80 48 70 55Z" fill={c} opacity="0.3" />
        {/* Spine */}
        <rect x="96" y="50" width="8" height="115" rx="3" fill={c} opacity="0.4" />
        {/* Ribs */}
        {[65, 80, 95, 110, 125].map((y, i) => (
          <React.Fragment key={i}>
            <path d={`M96 ${y} Q70 ${y + 5} 62 ${y + 15}`} stroke={c} strokeWidth="3" fill="none" opacity="0.35" />
            <path d={`M104 ${y} Q130 ${y + 5} 138 ${y + 15}`} stroke={c} strokeWidth="3" fill="none" opacity="0.35" />
          </React.Fragment>
        ))}
        {/* Radiation symbol rings */}
        <circle cx="100" cy="100" r="75" stroke={c} strokeWidth="1.5" fill="none" strokeDasharray="6 4" opacity="0.25" />
      </>
    ),
  },

  '/emr': {
    color: '#0f766e',
    label: 'EMR',
    svg: (c) => (
      <>
        {/* Clipboard */}
        <rect x="35" y="30" width="130" height="160" rx="8" fill={c} opacity="0.15" stroke={c} strokeWidth="3" />
        <rect x="70" y="20" width="60" height="24" rx="6" fill={c} />
        {/* Lines */}
        {[65, 85, 105, 125, 145].map((y, i) => (
          <rect key={i} x="52" y={y} width={i === 0 ? 96 : i === 2 ? 70 : 96} height="6" rx="3" fill={c} opacity="0.35" />
        ))}
        {/* Stethoscope */}
        <path d="M130 130 C145 130 155 140 155 155 C155 168 145 175 133 175 C121 175 112 166 112 154" stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.5" />
        <circle cx="112" cy="143" r="9" fill={c} opacity="0.5" />
        <path d="M112 154 L112 120 C112 108 120 100 130 100" stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.5" />
        <path d="M130 100 L130 88" stroke={c} strokeWidth="5" fill="none" opacity="0.5" />
        <circle cx="130" cy="84" r="5" fill={c} opacity="0.5" />
      </>
    ),
  },

  '/nursing': {
    color: '#be185d',
    label: 'Nursing',
    svg: (c) => (
      <>
        {/* Nurse cross cap */}
        <rect x="70" y="25" width="60" height="40" rx="6" fill={c} opacity="0.3" stroke={c} strokeWidth="3" />
        <rect x="93" y="28" width="14" height="34" rx="3" fill={c} opacity="0.7" />
        <rect x="75" y="36" width="50" height="14" rx="3" fill={c} opacity="0.7" />
        {/* Body / uniform */}
        <path d="M60 75 Q50 100 52 150 L148 150 Q150 100 140 75 Q120 65 100 65 Q80 65 60 75Z" fill={c} opacity="0.2" stroke={c} strokeWidth="2.5" />
        {/* Heart */}
        <path d="M100 115 C100 115 88 105 88 97 C88 91 100 91 100 99 C100 91 112 91 112 97 C112 105 100 115 100 115Z" fill={c} opacity="0.6" />
        {/* Stethoscope */}
        <path d="M75 90 Q65 105 68 118 C71 128 80 132 88 128" stroke={c} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.45" />
      </>
    ),
  },

  '/ot': {
    color: '#b45309',
    label: 'OT',
    svg: (c) => (
      <>
        {/* Scalpel */}
        <path d="M40 170 L155 40 L165 50 L60 180 Z" fill={c} opacity="0.5" />
        <path d="M155 40 L170 30 L175 45 L165 50 Z" fill={c} opacity="0.8" />
        {/* Forceps */}
        <path d="M50 40 L100 130" stroke={c} strokeWidth="5" strokeLinecap="round" opacity="0.4" />
        <path d="M70 40 L100 130" stroke={c} strokeWidth="5" strokeLinecap="round" opacity="0.4" />
        <ellipse cx="100" cy="132" rx="12" ry="6" fill={c} opacity="0.5" />
        {/* Circle spotlight */}
        <circle cx="105" cy="95" r="78" stroke={c} strokeWidth="3" fill="none" strokeDasharray="10 6" opacity="0.25" />
        <circle cx="105" cy="95" r="55" stroke={c} strokeWidth="2" fill="none" opacity="0.15" />
        {/* OT cross */}
        <rect x="155" y="140" width="35" height="10" rx="4" fill={c} opacity="0.4" />
        <rect x="165" y="130" width="10" height="30" rx="4" fill={c} opacity="0.4" />
      </>
    ),
  },

  '/appointments': {
    color: '#1d4ed8',
    label: 'Appointments',
    svg: (c) => (
      <>
        {/* Calendar */}
        <rect x="25" y="35" width="150" height="145" rx="10" fill={c} opacity="0.15" stroke={c} strokeWidth="3.5" />
        <rect x="25" y="35" width="150" height="40" rx="10" fill={c} opacity="0.5" />
        <rect x="25" y="60" width="150" height="15" fill={c} opacity="0.5" />
        {/* Calendar pins */}
        <rect x="60" y="20" width="12" height="28" rx="5" fill={c} />
        <rect x="128" y="20" width="12" height="28" rx="5" fill={c} />
        {/* Day grid */}
        {[0, 1, 2, 3, 4, 5, 6].map(col =>
          [0, 1, 2, 3].map(row => (
            <rect key={`${col}-${row}`} x={35 + col * 19} y={90 + row * 22} width="13" height="13" rx="3"
              fill={col === 3 && row === 1 ? c : c} opacity={col === 3 && row === 1 ? 0.8 : 0.2} />
          ))
        )}
        {/* Clock */}
        <circle cx="155" cy="155" r="22" fill="white" stroke={c} strokeWidth="3" opacity="0.6" />
        <line x1="155" y1="155" x2="155" y2="140" stroke={c} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <line x1="155" y1="155" x2="164" y2="162" stroke={c} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      </>
    ),
  },

  '/patients': {
    color: '#0369a1',
    label: 'Patients',
    svg: (c) => (
      <>
        {/* Person silhouette */}
        <circle cx="100" cy="55" r="35" fill={c} opacity="0.4" />
        <path d="M35 175 C35 135 65 115 100 115 C135 115 165 135 165 175 Z" fill={c} opacity="0.35" />
        {/* Medical cross on chest */}
        <rect x="91" y="133" width="18" height="6" rx="2" fill={c} opacity="0.7" />
        <rect x="97" y="127" width="6" height="18" rx="2" fill={c} opacity="0.7" />
        {/* Heartbeat line */}
        <polyline points="20,185 45,185 55,165 65,200 75,165 85,185 180,185" stroke={c} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.4" />
      </>
    ),
  },

  '/opd': {
    color: '#0e7490',
    label: 'OPD',
    svg: (c) => (
      <>
        {/* Queue / people */}
        {[0, 1, 2].map(i => (
          <React.Fragment key={i}>
            <circle cx={55 + i * 45} cy="70" r="22" fill={c} opacity={0.5 - i * 0.1} />
            <path d={`M${33 + i * 45} 140 C${33 + i * 45} 110 ${77 + i * 45} 110 ${77 + i * 45} 140`} fill={c} opacity={0.4 - i * 0.08} />
          </React.Fragment>
        ))}
        {/* Door */}
        <rect x="80" y="120" width="40" height="65" rx="4" fill={c} opacity="0.25" stroke={c} strokeWidth="2.5" />
        <circle cx="116" cy="153" r="4" fill={c} opacity="0.6" />
        {/* Arrow */}
        <path d="M100 95 L100 115 M92 108 L100 118 L108 108" stroke={c} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5" />
      </>
    ),
  },

  '/ipd': {
    color: '#4338ca',
    label: 'IPD',
    svg: (c) => (
      <>
        {/* Hospital bed */}
        <rect x="20" y="100" width="160" height="20" rx="5" fill={c} opacity="0.5" />
        <rect x="20" y="120" width="160" height="10" rx="3" fill={c} opacity="0.3" />
        {/* Bed legs */}
        <rect x="30" y="130" width="12" height="40" rx="4" fill={c} opacity="0.4" />
        <rect x="158" y="130" width="12" height="40" rx="4" fill={c} opacity="0.4" />
        {/* Headboard */}
        <rect x="15" y="70" width="20" height="60" rx="5" fill={c} opacity="0.45" />
        {/* Pillow */}
        <ellipse cx="65" cy="100" rx="30" ry="12" fill="white" opacity="0.3" />
        {/* Patient / person lying */}
        <ellipse cx="110" cy="98" rx="40" ry="12" fill={c} opacity="0.25" />
        <circle cx="65" cy="88" r="14" fill={c} opacity="0.4" />
        {/* IV drip */}
        <rect x="168" y="30" width="8" height="55" rx="3" fill={c} opacity="0.4" />
        <ellipse cx="172" cy="28" rx="14" ry="10" fill={c} opacity="0.35" />
        <line x1="172" y1="85" x2="165" y2="110" stroke={c} strokeWidth="2" opacity="0.4" />
        {/* Monitor */}
        <rect x="155" y="58" width="32" height="22" rx="4" fill={c} opacity="0.3" stroke={c} strokeWidth="1.5" />
        <polyline points="158,70 163,64 168,72 173,62 178,70 183,66" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
      </>
    ),
  },

  '/billing': {
    color: '#15803d',
    label: 'Billing',
    svg: (c) => (
      <>
        {/* Invoice paper */}
        <rect x="35" y="20" width="130" height="165" rx="7" fill={c} opacity="0.12" stroke={c} strokeWidth="3" />
        <rect x="35" y="20" width="130" height="38" rx="7" fill={c} opacity="0.4" />
        {/* Rupee symbol */}
        <text x="58" y="55" fontSize="26" fontWeight="900" fill="white" fontFamily="Arial,sans-serif" opacity="0.9">₹</text>
        {/* Lines */}
        {[72, 90, 108, 126, 144].map((y, i) => (
          <rect key={i} x="50" y={y} width={i % 2 === 0 ? 100 : 70} height="6" rx="3" fill={c} opacity="0.3" />
        ))}
        {/* Amount box */}
        <rect x="50" y="155" width="100" height="18" rx="4" fill={c} opacity="0.35" />
        {/* Coins */}
        <circle cx="163" cy="155" r="20" fill={c} opacity="0.4" />
        <circle cx="163" cy="155" r="13" fill="white" opacity="0.18" />
        <text x="157" y="160" fontSize="14" fontWeight="900" fill={c} fontFamily="Arial,sans-serif">₹</text>
      </>
    ),
  },

  '/insurance': {
    color: '#1e40af',
    label: 'Insurance',
    svg: (c) => (
      <>
        {/* Shield */}
        <path d="M100 15 L165 45 L165 100 C165 140 135 168 100 182 C65 168 35 140 35 100 L35 45 Z" fill={c} opacity="0.2" stroke={c} strokeWidth="4" />
        <path d="M100 30 L152 55 L152 100 C152 133 128 156 100 168 C72 156 48 133 48 100 L48 55 Z" fill={c} opacity="0.15" />
        {/* Tick */}
        <polyline points="68,100 88,120 132,76" stroke={c} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.65" />
      </>
    ),
  },

  '/hr': {
    color: '#7c2d12',
    label: 'HR',
    svg: (c) => (
      <>
        {/* People group */}
        <circle cx="70" cy="60" r="28" fill={c} opacity="0.4" />
        <path d="M22 148 C22 112 48 95 70 95 C92 95 118 112 118 148 Z" fill={c} opacity="0.35" />
        <circle cx="140" cy="70" r="22" fill={c} opacity="0.3" />
        <path d="M100 148 C100 118 120 104 140 104 C160 104 178 118 178 148 Z" fill={c} opacity="0.25" />
        {/* Badge / ID */}
        <rect x="78" y="130" width="44" height="55" rx="5" fill={c} opacity="0.3" stroke={c} strokeWidth="2" />
        <rect x="88" y="124" width="24" height="14" rx="4" fill={c} opacity="0.5" />
        {/* Lines on badge */}
        <rect x="85" y="148" width="30" height="5" rx="2" fill={c} opacity="0.4" />
        <rect x="90" y="158" width="20" height="4" rx="2" fill={c} opacity="0.3" />
      </>
    ),
  },

  '/inventory': {
    color: '#92400e',
    label: 'Inventory',
    svg: (c) => (
      <>
        {/* Boxes stack */}
        <rect x="30" y="120" width="65" height="60" rx="5" fill={c} opacity="0.45" stroke={c} strokeWidth="2.5" />
        <rect x="105" y="120" width="65" height="60" rx="5" fill={c} opacity="0.35" stroke={c} strokeWidth="2.5" />
        <rect x="60" y="60" width="80" height="60" rx="5" fill={c} opacity="0.55" stroke={c} strokeWidth="2.5" />
        <rect x="75" y="15" width="50" height="48" rx="5" fill={c} opacity="0.45" stroke={c} strokeWidth="2" />
        {/* Box cross marks */}
        <line x1="62" y1="90" x2="100" y2="90" stroke={c} strokeWidth="2" opacity="0.5" />
        <line x1="81" y1="63" x2="81" y2="118" stroke={c} strokeWidth="2" opacity="0.5" />
        {/* Barcode lines */}
        {[115, 121, 127, 133, 139, 145, 151].map((x, i) => (
          <rect key={i} x={x} y="135" width={i % 3 === 0 ? 3 : 2} height="30" rx="1" fill="white" opacity="0.25" />
        ))}
      </>
    ),
  },

  '/accounts': {
    color: '#166534',
    label: 'Accounts',
    svg: (c) => (
      <>
        {/* Bar chart */}
        <rect x="30" y="120" width="30" height="65" rx="4" fill={c} opacity="0.5" />
        <rect x="72" y="85" width="30" height="100" rx="4" fill={c} opacity="0.55" />
        <rect x="114" y="55" width="30" height="130" rx="4" fill={c} opacity="0.6" />
        <rect x="156" y="70" width="30" height="115" rx="4" fill={c} opacity="0.5" />
        {/* Trend line */}
        <polyline points="45,120 87,85 129,55 171,68" stroke={c} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7" />
        {/* Dots */}
        {[[45, 120], [87, 85], [129, 55], [171, 68]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="6" fill={c} opacity="0.8" />
        ))}
        {/* Axis */}
        <line x1="20" y1="190" x2="195" y2="190" stroke={c} strokeWidth="3" opacity="0.4" />
        <line x1="20" y1="20" x2="20" y2="190" stroke={c} strokeWidth="3" opacity="0.4" />
      </>
    ),
  },

  '/reports': {
    color: '#1e3a8a',
    label: 'Reports',
    svg: (c) => (
      <>
        {/* Pie chart */}
        <circle cx="100" cy="90" r="72" fill={c} opacity="0.12" stroke={c} strokeWidth="3" />
        <path d="M100 90 L100 18 A72 72 0 0 1 162 127 Z" fill={c} opacity="0.5" />
        <path d="M100 90 L162 127 A72 72 0 0 1 38 127 Z" fill={c} opacity="0.35" />
        <path d="M100 90 L38 127 A72 72 0 0 1 100 18 Z" fill={c} opacity="0.25" />
        {/* Legend dots */}
        {[[0.5], [0.35], [0.25]].map(([op], i) => (
          <React.Fragment key={i}>
            <rect x="48" y={170 + i * 18} width="12" height="12" rx="3" fill={c} opacity={op + 0.2} />
            <rect x="66" y={172 + i * 18} width="50" height="7" rx="3" fill={c} opacity="0.2" />
          </React.Fragment>
        ))}
      </>
    ),
  },

  '/users': {
    color: '#3730a3',
    label: 'Users',
    svg: (c) => (
      <>
        {/* Shield with lock */}
        <path d="M100 12 L168 42 L168 100 C168 145 137 172 100 187 C63 172 32 145 32 100 L32 42 Z" fill={c} opacity="0.18" stroke={c} strokeWidth="4" />
        {/* Lock body */}
        <rect x="72" y="95" width="56" height="45" rx="8" fill={c} opacity="0.5" />
        {/* Lock shackle */}
        <path d="M82 95 L82 75 C82 58 118 58 118 75 L118 95" stroke={c} strokeWidth="7" fill="none" strokeLinecap="round" opacity="0.55" />
        {/* Key hole */}
        <circle cx="100" cy="112" r="8" fill="white" opacity="0.35" />
        <rect x="96" y="116" width="8" height="14" rx="3" fill="white" opacity="0.35" />
      </>
    ),
  },

  '/doctors': {
    color: '#1d4ed8',
    label: 'Doctors',
    svg: (c) => (
      <>
        {/* Doctor silhouette */}
        <circle cx="100" cy="52" r="32" fill={c} opacity="0.38" />
        <path d="M42 170 C42 130 68 112 100 112 C132 112 158 130 158 170 Z" fill={c} opacity="0.3" />
        {/* Stethoscope */}
        <path d="M72 118 C58 125 50 145 55 162 C60 176 72 182 84 178" stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.5" />
        <circle cx="84" cy="175" r="10" fill={c} opacity="0.45" />
        <path d="M84 175 L84 140 C84 128 92 120 100 118" stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.45" />
        <line x1="100" y1="118" x2="100" y2="106" stroke={c} strokeWidth="5" strokeLinecap="round" opacity="0.45" />
        <circle cx="100" cy="102" r="6" fill={c} opacity="0.5" />
        {/* Coat cross */}
        <rect x="148" y="128" width="28" height="8" rx="3" fill={c} opacity="0.4" />
        <rect x="158" y="118" width="8" height="28" rx="3" fill={c} opacity="0.4" />
      </>
    ),
  },

  '/departments': {
    color: '#0f766e',
    label: 'Departments',
    svg: (c) => (
      <>
        {/* Org chart */}
        <rect x="78" y="15" width="44" height="30" rx="6" fill={c} opacity="0.5" />
        <line x1="100" y1="45" x2="100" y2="70" stroke={c} strokeWidth="3" opacity="0.4" />
        <line x1="45" y1="70" x2="155" y2="70" stroke={c} strokeWidth="3" opacity="0.4" />
        <line x1="45" y1="70" x2="45" y2="90" stroke={c} strokeWidth="3" opacity="0.4" />
        <line x1="100" y1="70" x2="100" y2="90" stroke={c} strokeWidth="3" opacity="0.4" />
        <line x1="155" y1="70" x2="155" y2="90" stroke={c} strokeWidth="3" opacity="0.4" />
        {[20, 75, 130].map((x, i) => (
          <React.Fragment key={i}>
            <rect x={x} y="90" width="50" height="28" rx="5" fill={c} opacity={0.45 - i * 0.05} />
            <line x1={x + 25} y1="118" x2={x + 25} y2="138" stroke={c} strokeWidth="2.5" opacity="0.35" />
            <rect x={x + 5} y="138" width="40" height="22" rx="4" fill={c} opacity="0.3" />
          </React.Fragment>
        ))}
      </>
    ),
  },

  '/teleconsult': {
    color: '#0369a1',
    label: 'Teleconsultation',
    svg: (c) => (
      <>
        {/* Monitor */}
        <rect x="25" y="35" width="150" height="105" rx="10" fill={c} opacity="0.18" stroke={c} strokeWidth="3.5" />
        <rect x="35" y="45" width="130" height="85" rx="6" fill={c} opacity="0.12" />
        {/* Camera icon inside */}
        <rect x="55" y="62" width="65" height="45" rx="6" fill={c} opacity="0.35" />
        <path d="M120 75 L145 62 L145 97 L120 85 Z" fill={c} opacity="0.4" />
        <circle cx="82" cy="85" r="12" fill="white" opacity="0.25" />
        {/* Stand */}
        <rect x="88" y="140" width="24" height="20" rx="3" fill={c} opacity="0.35" />
        <rect x="68" y="158" width="64" height="10" rx="5" fill={c} opacity="0.35" />
        {/* Signal waves */}
        {[1, 2, 3].map(i => (
          <path key={i} d={`M${158 + i * 8} ${80 - i * 10} Q${163 + i * 8} 85 ${158 + i * 8} ${90 + i * 10}`} stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity={0.5 - i * 0.1} />
        ))}
      </>
    ),
  },

  '/certificates': {
    color: '#b45309',
    label: 'Certificates',
    svg: (c) => (
      <>
        {/* Certificate scroll */}
        <rect x="25" y="40" width="150" height="115" rx="8" fill={c} opacity="0.15" stroke={c} strokeWidth="3" />
        <rect x="25" y="40" width="150" height="28" rx="8" fill={c} opacity="0.4" />
        <rect x="25" y="155" width="150" height="0" />
        {/* Ribbons */}
        <rect x="22" y="35" width="16" height="125" rx="6" fill={c} opacity="0.35" />
        <rect x="162" y="35" width="16" height="125" rx="6" fill={c} opacity="0.35" />
        {/* Star seal */}
        <circle cx="100" cy="148" r="22" fill={c} opacity="0.4" />
        <polygon points="100,128 104,142 118,142 107,151 111,165 100,156 89,165 93,151 82,142 96,142" fill="white" opacity="0.45" />
        {/* Lines */}
        {[82, 98, 114, 130].map((y, i) => (
          <rect key={i} x="48" y={y} width={i === 1 ? 104 : 80} height="6" rx="3" fill={c} opacity="0.28" />
        ))}
      </>
    ),
  },

  '/dashboard': {
    color: '#1e40af',
    label: 'Dashboard',
    svg: (c) => (
      <>
        {/* Grid of stat cards */}
        <rect x="20" y="20" width="70" height="50" rx="7" fill={c} opacity="0.35" />
        <rect x="110" y="20" width="70" height="50" rx="7" fill={c} opacity="0.3" />
        <rect x="20" y="85" width="70" height="50" rx="7" fill={c} opacity="0.28" />
        <rect x="110" y="85" width="70" height="50" rx="7" fill={c} opacity="0.32" />
        {/* Mini bar chart */}
        <rect x="30" y="148" width="140" height="38" rx="6" fill={c} opacity="0.15" stroke={c} strokeWidth="2" />
        {[0, 1, 2, 3, 4, 5].map(i => (
          <rect key={i} x={38 + i * 20} y={170 - [14, 20, 10, 24, 16, 12][i]} width="12" height={[14, 20, 10, 24, 16, 12][i]} rx="2" fill={c} opacity="0.45" />
        ))}
        {/* Hospital cross top center */}
        <rect x="91" y="22" width="18" height="46" rx="5" fill="white" opacity="0.18" />
        <rect x="75" y="35" width="50" height="18" rx="5" fill="white" opacity="0.18" />
      </>
    ),
  },
};

/* Default fallback — generic hospital cross + ECG */
const DEFAULT_WATERMARK = {
  color: '#1e40af',
  label: 'CubeMed HIS',
  svg: (c) => (
    <>
      <rect x="80" y="20" width="40" height="120" rx="8" fill={c} />
      <rect x="20" y="80" width="160" height="40" rx="8" fill={c} />
      <polyline points="10,170 30,170 42,148 54,195 66,148 78,170 190,170"
        stroke={c} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="100" cy="95" r="88" stroke={c} strokeWidth="3" fill="none" strokeDasharray="8 5" />
      <text x="100" y="198" textAnchor="middle" fontSize="11" fontWeight="800"
        fill={c} letterSpacing="4" fontFamily="Arial,sans-serif">CubeMed HIS</text>
    </>
  ),
};

function getWatermark(pathname) {
  // Exact match first
  if (WATERMARKS[pathname]) return WATERMARKS[pathname];
  // Prefix match
  for (const key of Object.keys(WATERMARKS)) {
    if (pathname.startsWith(key + '/') || pathname.startsWith(key)) return WATERMARKS[key];
  }
  return DEFAULT_WATERMARK;
}

export default function PageWatermark() {
  const location = useLocation();
  const wm = getWatermark(location.pathname);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 0,
    }}>
      <svg width="460" height="460" viewBox="0 0 200 200" fill="none" style={{ opacity: 0.13 }}>
        {wm.svg(wm.color)}
      </svg>
    </div>
  );
}
