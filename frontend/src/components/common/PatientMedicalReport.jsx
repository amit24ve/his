import React, { useRef } from 'react';

/**
 * PatientMedicalReport
 * Renders a printable medical report and provides a Download PDF (print) button.
 * Props:
 *   prescription: full prescription/EMR object
 *   labOrders: array of lab order objects (optional)
 *   onClose: close handler
 */
const PatientMedicalReport = ({ prescription: p, labOrders = [], onClose }) => {
  const printRef = useRef();

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Medical Report - ${p.patient_name || 'Patient'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a2e; background: #fff; }
    .report-wrapper { max-width: 800px; margin: 0 auto; padding: 24px 32px; }

    /* Header */
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1d4ed8; padding-bottom: 14px; margin-bottom: 18px; }
    .hospital-name { font-size: 22px; font-weight: 800; color: #1d4ed8; letter-spacing: 0.5px; }
    .hospital-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    .rx-badge { background: #1d4ed8; color: #fff; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 700; letter-spacing: 1px; }
    .report-date { font-size: 11px; color: #64748b; margin-top: 4px; text-align: right; }

    /* Section */
    .section { margin-bottom: 16px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #1d4ed8; border-bottom: 1.5px solid #bfdbfe; padding-bottom: 4px; margin-bottom: 10px; }

    /* Info grid */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .info-card { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 10px 14px; }
    .info-card.doctor-card { background: #f0fdf4; border-color: #bbf7d0; }
    .info-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #0369a1; margin-bottom: 3px; }
    .info-label.green { color: #15803d; }
    .info-value { font-size: 13px; font-weight: 700; color: #0f172a; }
    .info-sub { font-size: 11px; color: #64748b; margin-top: 2px; }

    /* Clinical fields */
    .field-row { background: #f8fafc; border-left: 3px solid #1d4ed8; padding: 8px 12px; border-radius: 0 6px 6px 0; margin-bottom: 8px; }
    .field-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin-bottom: 3px; }
    .field-value { font-size: 12px; color: #1e293b; line-height: 1.5; }

    /* Medication table */
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    thead th { background: #1d4ed8; color: #fff; padding: 7px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    tbody tr:nth-child(even) { background: #eff6ff; }
    tbody tr:nth-child(odd) { background: #fff; }
    tbody td { padding: 7px 10px; font-size: 11px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
    tbody td:first-child { font-weight: 700; }

    /* Lab table */
    .lab-table thead th { background: #059669; }
    .lab-table tbody tr:nth-child(even) { background: #ecfdf5; }

    /* Follow-up box */
    .followup-box { background: linear-gradient(135deg, #fef3c7, #fde68a); border: 1.5px solid #f59e0b; border-radius: 8px; padding: 10px 16px; display: flex; align-items: center; gap: 10px; }
    .followup-text { font-size: 12px; font-weight: 700; color: #92400e; }
    .followup-icon { font-size: 18px; }

    /* Footer */
    .footer { border-top: 2px solid #1d4ed8; margin-top: 20px; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
    .signature-block { text-align: center; }
    .signature-line { width: 160px; border-top: 1.5px solid #334155; margin: 30px auto 4px; }
    .signature-text { font-size: 10px; color: #475569; font-weight: 600; }
    .footer-note { font-size: 9px; color: #94a3b8; text-align: right; line-height: 1.6; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 80px; font-weight: 900; color: rgba(29,78,216,0.04); pointer-events: none; white-space: nowrap; z-index: 0; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .report-wrapper { padding: 16px 24px; }
    }
  </style>
</head>
<body>
  <div class="report-wrapper">
    ${content}
  </div>
  <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; }</script>
</body>
</html>`);
    win.document.close();
  };

  const formatDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
  };

  const now = new Date();
  const printDate = now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Action Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-700 to-blue-500 text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <i className="fas fa-file-medical text-xl" />
            <div>
              <h2 className="font-bold text-lg">Patient Medical Report</h2>
              <p className="text-blue-200 text-xs">{p.rx_number} &bull; {formatDate(p.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-50 transition shadow"
            >
              <i className="fas fa-download" /> Download PDF
            </button>
            <button onClick={onClose} className="p-2 hover:bg-blue-600 rounded-lg transition">
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {/* Report Preview */}
        <div className="overflow-y-auto flex-1 p-6 bg-gray-50">
          <div ref={printRef} className="bg-white rounded-xl shadow border border-gray-200 p-8 max-w-2xl mx-auto">
            {/* Report Header */}
            <div className="flex items-start justify-between border-b-2 border-blue-700 pb-4 mb-5">
              <div>
                <div className="text-2xl font-extrabold text-blue-700 tracking-wide">CubeMed Hospital</div>
                <div className="text-xs text-gray-500 mt-1">Multi-Speciality Hospital &amp; Healthcare Centre</div>
                <div className="text-xs text-gray-400 mt-0.5">Tel: +91-XXXX-XXXXXX | www.CubeMed.health</div>
              </div>
              <div className="text-right">
                <div className="inline-block bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold tracking-widest">
                  Rx {p.rx_number || 'N/A'}
                </div>
                <div className="text-xs text-gray-400 mt-2">{printDate}</div>
              </div>
            </div>

            {/* Patient & Doctor Info */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">Patient Information</div>
                <div className="text-base font-extrabold text-gray-900">{p.patient_name || 'N/A'}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {p.mrn && <span className="mr-3"><span className="font-medium">MRN:</span> {p.mrn}</span>}
                  {p.patient_age && <span className="mr-2">{p.patient_age}y</span>}
                  {p.patient_gender && <span>{p.patient_gender}</span>}
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-green-600 mb-2">Attending Doctor</div>
                <div className="text-base font-extrabold text-gray-900">Dr. {p.doctor_name || 'N/A'}</div>
                <div className="text-sm text-gray-600 mt-1">{p.department || 'General Medicine'}</div>
                <div className="text-xs text-gray-400 mt-1">{formatDate(p.created_at)}</div>
              </div>
            </div>

            {/* Clinical Notes */}
            <div className="mb-5">
              <div className="text-xs font-bold uppercase tracking-widest text-blue-600 border-b border-blue-200 pb-1 mb-3">Clinical Details</div>
              <div className="space-y-2">
                {p.chief_complaint && (
                  <div className="bg-gray-50 border-l-4 border-blue-500 pl-3 py-2 pr-3 rounded-r-lg">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Chief Complaint</div>
                    <div className="text-sm text-gray-800">{p.chief_complaint}</div>
                  </div>
                )}
                {p.diagnosis && (
                  <div className="bg-red-50 border-l-4 border-red-500 pl-3 py-2 pr-3 rounded-r-lg">
                    <div className="text-xs font-bold text-red-600 uppercase mb-1">Diagnosis</div>
                    <div className="text-sm font-semibold text-gray-900">{p.diagnosis}</div>
                  </div>
                )}
                {p.findings && (
                  <div className="bg-gray-50 border-l-4 border-purple-500 pl-3 py-2 pr-3 rounded-r-lg">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Clinical Findings / Observations</div>
                    <div className="text-sm text-gray-800">{p.findings}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Medications */}
            {p.medications?.length > 0 && (
              <div className="mb-5">
                <div className="text-xs font-bold uppercase tracking-widest text-blue-600 border-b border-blue-200 pb-1 mb-3 flex items-center gap-2">
                  <i className="fas fa-pills text-blue-500" /> Prescribed Medications
                </div>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-blue-700 text-white">
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase">#</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase">Drug Name</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase">Dosage</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase">Frequency</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase">Duration</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase">Instructions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.medications.map((m, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                          <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold text-gray-900">{m.drug_name}</td>
                          <td className="px-3 py-2 text-gray-700">{m.dosage || '-'}</td>
                          <td className="px-3 py-2 text-gray-700">{m.frequency || '-'}</td>
                          <td className="px-3 py-2 text-gray-700">{m.duration || '-'}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{m.instructions || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Lab Tests Ordered */}
            {(p.investigations?.length > 0 || labOrders.length > 0) && (
              <div className="mb-5">
                <div className="text-xs font-bold uppercase tracking-widest text-green-600 border-b border-green-200 pb-1 mb-3 flex items-center gap-2">
                  <i className="fas fa-flask text-green-500" /> Lab Investigations Ordered
                </div>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-green-600 text-white">
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase">#</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase">Test / Investigation</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(p.investigations?.length > 0 ? p.investigations.map(inv => ({ test_name: inv, status: 'Ordered' })) : labOrders).map((lab, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-green-50'}>
                          <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold text-gray-900">{lab.test_name || lab.order_number || '-'}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lab.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                lab.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-600'
                              }`}>{lab.status || 'Ordered'}</span>
                          </td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{formatDate(lab.created_at) || formatDate(p.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Advice */}
            {p.advice && (
              <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-2 flex items-center gap-2">
                  <i className="fas fa-lightbulb" /> Doctor's Advice
                </div>
                <p className="text-sm text-gray-800 leading-relaxed">{p.advice}</p>
              </div>
            )}

            {/* Follow-up */}
            {p.follow_up_days && (
              <div className="mb-5 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-400 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-calendar-check text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-amber-900">Follow-up Appointment</div>
                  <div className="text-xs text-amber-700 mt-0.5">Please revisit in <strong>{p.follow_up_days} days</strong> for review and assessment.</div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t-2 border-blue-700 pt-4 mt-6 flex items-end justify-between">
              <div>
                <div className="text-xs text-gray-400">Generated on {printDate}</div>
                <div className="text-xs text-gray-400 mt-1">CubeMed HIS &bull; Electronic Medical Record</div>
              </div>
              <div className="text-center">
                <div className="w-40 border-t border-gray-400 mb-1" />
                <div className="text-xs font-bold text-gray-700">Dr. {p.doctor_name || 'Attending Physician'}</div>
                <div className="text-xs text-gray-400">{p.department || ''}</div>
                <div className="text-xs text-gray-400">Signature &amp; Stamp</div>
              </div>
            </div>

            {/* Watermark text */}
            <div className="text-center mt-4">
              <p className="text-xs text-gray-300 italic">
                This is a computer-generated medical report from CubeMed Hospital Information System.
                Valid only with authorized doctor's signature and hospital stamp.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientMedicalReport;
