import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DoctorSearchInput from '../components/DoctorSearchInput';

const CERTIFICATE_TYPES = [
  { key: 'fitness', label: 'Fitness Certificate', icon: 'heartbeat', color: 'green' },
  { key: 'birth', label: 'Birth Certificate', icon: 'baby', color: 'blue' },
  { key: 'death', label: 'Death Certificate', icon: 'cross', color: 'gray' },
  { key: 'medical_leave', label: 'Medical Leave Certificate', icon: 'bed', color: 'yellow' },
  { key: 'discharge', label: 'Discharge Summary', icon: 'sign-out-alt', color: 'purple' },
  { key: 'referral', label: 'Referral Letter', icon: 'paper-plane', color: 'teal' },
];

function printCertificate(type, data) {
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  let content = '';

  if (type === 'fitness') {
    content = `
      <h2 style="text-align:center;color:#1e40af;">CERTIFICATE OF FITNESS</h2>
      <p>This is to certify that <b>${data.patient_name}</b>, ${data.age ? `aged ${data.age} years,` : ''} ${data.gender || ''}, 
      residing at ${data.address || '—'}, was examined by me / this hospital on <b>${data.exam_date || date}</b>.</p>
      <p>On examination, the patient is found to be <b>physically fit</b> for ${data.purpose || 'general duty / employment'}.</p>
      <p style="margin-top:30px;">Diagnosis / Remarks: ${data.remarks || 'No significant abnormality detected.'}</p>
    `;
  } else if (type === 'birth') {
    content = `
      <h2 style="text-align:center;color:#1e40af;">BIRTH CERTIFICATE</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:10px;">
        <tr><td class="label">Child's Name</td><td>${data.child_name || '—'}</td></tr>
        <tr><td class="label">Date of Birth</td><td>${data.dob || '—'}</td></tr>
        <tr><td class="label">Time of Birth</td><td>${data.time_of_birth || '—'}</td></tr>
        <tr><td class="label">Gender</td><td>${data.gender || '—'}</td></tr>
        <tr><td class="label">Birth Weight</td><td>${data.birth_weight ? data.birth_weight + ' kg' : '—'}</td></tr>
        <tr><td class="label">Father's Name</td><td>${data.father_name || '—'}</td></tr>
        <tr><td class="label">Mother's Name</td><td>${data.mother_name || '—'}</td></tr>
        <tr><td class="label">Address</td><td>${data.address || '—'}</td></tr>
        <tr><td class="label">Attending Doctor</td><td>${data.doctor_name || '—'}</td></tr>
      </table>
    `;
  } else if (type === 'death') {
    content = `
      <h2 style="text-align:center;color:#374151;">DEATH CERTIFICATE</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:10px;">
        <tr><td class="label">Deceased Name</td><td>${data.patient_name || '—'}</td></tr>
        <tr><td class="label">Age</td><td>${data.age ? data.age + ' years' : '—'}</td></tr>
        <tr><td class="label">Gender</td><td>${data.gender || '—'}</td></tr>
        <tr><td class="label">Date of Death</td><td>${data.date_of_death || '—'}</td></tr>
        <tr><td class="label">Time of Death</td><td>${data.time_of_death || '—'}</td></tr>
        <tr><td class="label">Cause of Death</td><td>${data.cause_of_death || '—'}</td></tr>
        <tr><td class="label">Address</td><td>${data.address || '—'}</td></tr>
        <tr><td class="label">Attending Doctor</td><td>${data.doctor_name || '—'}</td></tr>
        <tr><td class="label">IPD / MRN</td><td>${data.mrn || '—'}</td></tr>
      </table>
    `;
  } else if (type === 'medical_leave') {
    content = `
      <h2 style="text-align:center;color:#1e40af;">MEDICAL LEAVE CERTIFICATE</h2>
      <p>This is to certify that <b>${data.patient_name}</b>, ${data.age ? `aged ${data.age} years,` : ''} was examined at this hospital
      and is suffering from <b>${data.diagnosis || '—'}</b>.</p>
      <p>The patient is advised <b>rest / medical leave</b> from <b>${data.leave_from || '—'}</b> to <b>${data.leave_to || '—'}</b> 
      (${data.leave_days || '—'} days).</p>
      <p>During this period, the patient is unfit for ${data.unfit_for || 'duties / work'}.</p>
      <p style="margin-top:20px;">Remarks: ${data.remarks || '—'}</p>
    `;
  } else if (type === 'discharge') {
    content = `
      <h2 style="text-align:center;color:#1e40af;">DISCHARGE SUMMARY</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:10px;">
        <tr><td class="label">Patient Name</td><td>${data.patient_name || '—'}</td></tr>
        <tr><td class="label">UHID / MRN</td><td>${data.mrn || '—'}</td></tr>
        <tr><td class="label">Age / Gender</td><td>${data.age ? data.age + ' yrs' : '—'} / ${data.gender || '—'}</td></tr>
        <tr><td class="label">Admission Date</td><td>${data.admission_date || '—'}</td></tr>
        <tr><td class="label">Discharge Date</td><td>${data.discharge_date || '—'}</td></tr>
        <tr><td class="label">Department</td><td>${data.department || '—'}</td></tr>
        <tr><td class="label">Ward / Bed</td><td>${data.ward || '—'} / ${data.bed || '—'}</td></tr>
        <tr><td class="label">Attending Doctor</td><td>${data.doctor_name || '—'}</td></tr>
        <tr><td class="label">Admission Reason</td><td>${data.admission_reason || '—'}</td></tr>
        <tr><td class="label">Diagnosis</td><td>${data.diagnosis || '—'}</td></tr>
        <tr><td class="label">Treatment Given</td><td>${data.treatment || '—'}</td></tr>
        <tr><td class="label">Investigations</td><td>${data.investigations || '—'}</td></tr>
        <tr><td class="label">Condition at Discharge</td><td>${data.condition_at_discharge || '—'}</td></tr>
        <tr><td class="label">Discharge Instructions</td><td>${data.discharge_instructions || '—'}</td></tr>
        <tr><td class="label">Follow-up</td><td>${data.follow_up || '—'}</td></tr>
      </table>
    `;
  } else if (type === 'referral') {
    content = `
      <h2 style="text-align:center;color:#1e40af;">REFERRAL LETTER</h2>
      <p>Dear Dr. ${data.referred_to || '—'},</p>
      <p>I am referring <b>${data.patient_name || '—'}</b>, ${data.age ? `aged ${data.age} years,` : ''} ${data.gender || ''}, 
      for further evaluation and management of <b>${data.referral_reason || '—'}</b>.</p>
      <p><b>Clinical Summary:</b> ${data.clinical_summary || '—'}</p>
      <p><b>Investigations Done:</b> ${data.investigations || '—'}</p>
      <p><b>Current Medications:</b> ${data.medications || '—'}</p>
      <p>Your expert opinion and necessary management would be highly appreciated.</p>
    `;
  }

  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>${type} Certificate</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 30px; line-height: 1.6; }
      h2 { margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      td { padding: 8px 12px; border: 1px solid #ddd; }
      .label { font-weight: bold; background: #f3f4f6; width: 35%; }
      .hospital-header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 20px; }
      .footer { margin-top: 40px; display: flex; justify-content: space-between; }
      .signature { text-align: right; margin-top: 50px; }
    </style>
    </head><body>
    <div class="hospital-header">
      <h1 style="color:#1e40af;margin:0;">CubeMed HIS — Hospital</h1>
      <p style="margin:4px 0;font-size:13px;">Contact: +91-XXXXXXXXXX | Email: hospital@CubeMed.in</p>
    </div>
    ${content}
    <div class="signature">
      <p>___________________________</p>
      <p><b>${data.doctor_name || 'Attending Doctor'}</b></p>
      <p>Reg. No.: ${data.doctor_reg || '—'}</p>
      <p>Date: ${date}</p>
    </div>
    <p style="margin-top:30px;font-size:11px;color:#666;text-align:center;">Generated by CubeMed HIS on ${new Date().toLocaleString()}</p>
    </body></html>
  `);
  win.document.close();
  win.print();
}

const FORM_FIELDS = {
  fitness: [
    { key: 'patient_name', label: 'Patient Name', required: true },
    { key: 'age', label: 'Age', type: 'number' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] },
    { key: 'address', label: 'Address' },
    { key: 'exam_date', label: 'Examination Date', type: 'date' },
    { key: 'purpose', label: 'Purpose (e.g. employment, school)' },
    { key: 'doctor_name', label: 'Doctor Name', required: true, type: 'doctor' },
    { key: 'doctor_reg', label: 'Doctor Reg. No.' },
    { key: 'remarks', label: 'Remarks / Findings', type: 'textarea' },
  ],
  birth: [
    { key: 'child_name', label: "Child's Name" },
    { key: 'dob', label: 'Date of Birth', type: 'date', required: true },
    { key: 'time_of_birth', label: 'Time of Birth', type: 'time' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] },
    { key: 'birth_weight', label: 'Birth Weight (kg)', type: 'number' },
    { key: 'father_name', label: "Father's Name" },
    { key: 'mother_name', label: "Mother's Name" },
    { key: 'address', label: 'Address' },
    { key: 'doctor_name', label: 'Attending Doctor', required: true, type: 'doctor' },
    { key: 'doctor_reg', label: 'Doctor Reg. No.' },
  ],
  death: [
    { key: 'patient_name', label: "Deceased Name", required: true },
    { key: 'age', label: 'Age', type: 'number' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] },
    { key: 'mrn', label: 'IPD No. / MRN' },
    { key: 'date_of_death', label: 'Date of Death', type: 'date', required: true },
    { key: 'time_of_death', label: 'Time of Death', type: 'time' },
    { key: 'cause_of_death', label: 'Cause of Death', required: true },
    { key: 'address', label: 'Address' },
    { key: 'doctor_name', label: 'Attending Doctor', required: true, type: 'doctor' },
    { key: 'doctor_reg', label: 'Doctor Reg. No.' },
  ],
  medical_leave: [
    { key: 'patient_name', label: 'Patient Name', required: true },
    { key: 'age', label: 'Age', type: 'number' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] },
    { key: 'diagnosis', label: 'Diagnosis', required: true },
    { key: 'leave_from', label: 'Leave From', type: 'date', required: true },
    { key: 'leave_to', label: 'Leave To', type: 'date', required: true },
    { key: 'leave_days', label: 'Total Days', type: 'number' },
    { key: 'unfit_for', label: 'Unfit For' },
    { key: 'doctor_name', label: 'Doctor Name', required: true, type: 'doctor' },
    { key: 'doctor_reg', label: 'Doctor Reg. No.' },
    { key: 'remarks', label: 'Remarks', type: 'textarea' },
  ],
  discharge: [
    { key: 'patient_name', label: 'Patient Name', required: true },
    { key: 'mrn', label: 'UHID / MRN' },
    { key: 'age', label: 'Age', type: 'number' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] },
    { key: 'admission_date', label: 'Admission Date', type: 'date' },
    { key: 'discharge_date', label: 'Discharge Date', type: 'date' },
    { key: 'department', label: 'Department' },
    { key: 'ward', label: 'Ward' },
    { key: 'bed', label: 'Bed No.' },
    { key: 'doctor_name', label: 'Attending Doctor', required: true, type: 'doctor' },
    { key: 'doctor_reg', label: 'Doctor Reg. No.' },
    { key: 'admission_reason', label: 'Reason for Admission' },
    { key: 'diagnosis', label: 'Final Diagnosis', required: true },
    { key: 'treatment', label: 'Treatment Given', type: 'textarea' },
    { key: 'investigations', label: 'Investigations Done', type: 'textarea' },
    { key: 'condition_at_discharge', label: 'Condition at Discharge', type: 'select', options: ['Stable', 'Improved', 'Cured', 'DAMA', 'Expired', 'Transferred'] },
    { key: 'discharge_instructions', label: 'Discharge Instructions', type: 'textarea' },
    { key: 'follow_up', label: 'Follow-up Instructions' },
  ],
  referral: [
    { key: 'patient_name', label: 'Patient Name', required: true },
    { key: 'age', label: 'Age', type: 'number' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] },
    { key: 'referred_to', label: 'Referred To (Doctor/Hospital)', required: true },
    { key: 'referral_reason', label: 'Reason for Referral', required: true },
    { key: 'clinical_summary', label: 'Clinical Summary', type: 'textarea' },
    { key: 'investigations', label: 'Investigations Done', type: 'textarea' },
    { key: 'medications', label: 'Current Medications', type: 'textarea' },
    { key: 'doctor_name', label: 'Referring Doctor', required: true, type: 'doctor' },
    { key: 'doctor_reg', label: 'Doctor Reg. No.' },
  ],
};

export default function CertificatesPage() {
  const [selectedType, setSelectedType] = useState(null);
  const [formData, setFormData] = useState({});

  const handleSelect = (type) => {
    setSelectedType(type);
    setFormData({});
  };

  const handleField = (key, value) => {
    setFormData(f => ({ ...f, [key]: value }));
  };

  const handlePrint = (e) => {
    e.preventDefault();
    printCertificate(selectedType, formData);
  };

  const fields = selectedType ? FORM_FIELDS[selectedType] || [] : [];
  const certInfo = CERTIFICATE_TYPES.find(c => c.key === selectedType);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">Certificate Generation</h1>
          <p className="text-gray-500 text-sm mt-1">Generate printable hospital certificates & documents</p>
        </div>
        {selectedType && (
          <button onClick={() => setSelectedType(null)} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm">
            <i className="fas fa-arrow-left" /> Back to Certificates
          </button>
        )}
      </div>

      {!selectedType ? (
        /* Certificate Type Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CERTIFICATE_TYPES.map((cert, i) => (
            <motion.button key={cert.key} onClick={() => handleSelect(cert.key)}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className={`bg-white rounded-xl p-6 shadow text-left hover:shadow-md transition border-l-4 border-${cert.color}-500 hover:border-${cert.color}-600`}>
              <div className={`h-12 w-12 rounded-full bg-${cert.color}-100 flex items-center justify-center mb-3`}>
                <i className={`fas fa-${cert.icon} text-${cert.color}-600 text-xl`}></i>
              </div>
              <h3 className="font-semibold text-gray-900 text-base">{cert.label}</h3>
              <p className="text-sm text-gray-500 mt-1">Click to generate &amp; print</p>
            </motion.button>
          ))}
        </div>
      ) : (
        /* Certificate Form */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <div className={`h-10 w-10 rounded-full bg-${certInfo?.color}-100 flex items-center justify-center`}>
              <i className={`fas fa-${certInfo?.icon} text-${certInfo?.color}-600`}></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{certInfo?.label}</h2>
              <p className="text-sm text-gray-500">Fill in the details below, then click Print</p>
            </div>
          </div>
          <form onSubmit={handlePrint} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map(field => (
                <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                  <label className="text-xs text-gray-500 font-medium">{field.label}{field.required ? ' *' : ''}</label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={formData[field.key] || ''}
                      onChange={e => handleField(field.key, e.target.value)}
                      required={field.required}
                      className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                      rows={3}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={formData[field.key] || ''}
                      onChange={e => handleField(field.key, e.target.value)}
                      required={field.required}
                      className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    >
                      <option value="">Select...</option>
                      {field.options.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : field.type === 'doctor' ? (
                    <DoctorSearchInput
                      value={formData[field.key] || ''}
                      onChange={(name) => handleField(field.key, name)}
                      required={field.required}
                      inputClass="mt-1"
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={formData[field.key] || ''}
                      onChange={e => handleField(field.key, e.target.value)}
                      required={field.required}
                      className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => setFormData({})} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                <i className="fas fa-undo mr-1" /> Clear
              </button>
              <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2">
                <i className="fas fa-print" /> Print Certificate
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
}
