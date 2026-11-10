import { useEffect } from 'react';
import { Printer, X, Building2, HeartPulse, AlertCircle } from 'lucide-react';
import ModalPortal from './ModalPortal';
import type { Vitals } from '../types';

export interface ReferralPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  patientCode?: string;
  patientAge?: number;
  patientGender?: string;
  patientType?: string;
  patientDepartment?: string;
  doctorName: string;
  diagnosis?: string;
  destination: string;
  reason: string;
  urgency?: 'Routine' | 'Urgent' | 'Emergency / STAT';
  vitals?: Vitals;
  symptoms?: string[];
  notes?: string;
  allergies?: string[];
  date?: string;
}

const CLINIC_NAME = 'Borana University Clinic';

export default function ReferralPrintModal({
  isOpen,
  onClose,
  patientName,
  patientCode,
  patientAge,
  patientGender,
  patientType,
  patientDepartment,
  doctorName,
  diagnosis,
  destination,
  reason,
  urgency = 'Urgent',
  vitals,
  symptoms = [],
  notes,
  allergies = [],
  date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
}: ReferralPrintModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const vitalsHtml = vitals ? `
      <div class="section-title"><span class="icon">♥</span> Patient Vital Signs at Time of Referral</div>
      <div class="vitals-grid">
        <div><span class="label">Blood Pressure</span><strong>${vitals.bloodPressure || '—'}</strong></div>
        <div><span class="label">Pulse / HR</span><strong>${vitals.heartRate ? `${vitals.heartRate} bpm` : '—'}</strong></div>
        <div><span class="label">Temperature</span><strong style="color:${(vitals.temperature || 0) > 37.5 ? '#dc2626' : 'inherit'}">${vitals.temperature ? `${vitals.temperature}°C` : '—'}</strong></div>
        <div><span class="label">SpO₂</span><strong>${vitals.spo2 ? `${vitals.spo2}%` : '—'}</strong></div>
        <div><span class="label">Resp Rate</span><strong>${vitals.respiratoryRate ? `${vitals.respiratoryRate} /min` : '—'}</strong></div>
      </div>` : '';

    const allergiesHtml = allergies.length > 0 ? `
      <div class="allergy-box">⚠ Known Allergies: ${allergies.join(', ')}</div>` : '';

    const symptomsHtml = (symptoms.length > 0 || notes) ? `
      <div class="notes-section">
        ${symptoms.length > 0 ? `<div><strong>Presenting Symptoms:</strong> ${symptoms.join(', ')}</div>` : ''}
        ${notes ? `<div style="margin-top:4px"><strong>Clinical Consultation Notes:</strong> ${notes}</div>` : ''}
      </div>` : '';

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Referral Letter – ${patientName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, system-ui, sans-serif; color: #0f172a; background: #fff; font-size: 13px; line-height: 1.5; }
    @page { size: A4; margin: 18mm 15mm; }
    .wrap { max-width: 760px; margin: 0 auto; }
    /* Header */
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #0369a1; padding-bottom: 10px; margin-bottom: 14px; }
    .clinic-name { font-size: 1.3rem; font-weight: 800; color: #0369a1; letter-spacing: -0.02em; }
    .clinic-sub { font-size: 0.72rem; color: #475569; margin-top: 2px; }
    .badge { font-weight: 800; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; padding: 3px 10px; border-radius: 4px; font-size: 0.72rem; letter-spacing: 0.04em; display: inline-block; margin-bottom: 4px; }
    .meta-right { text-align: right; font-size: 0.72rem; color: #334155; }
    /* Destination */
    .destination-box { display: flex; align-items: center; gap: 10px; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; }
    .dest-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: #166534; font-weight: 700; }
    .dest-name { font-size: 1rem; font-weight: 800; color: #14532d; }
    /* Demo grid */
    .demo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; font-size: 0.78rem; }
    .demo-grid .label { color: #64748b; font-size: 0.65rem; display: block; }
    /* Vitals */
    .section-title { font-size: 0.7rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; display: flex; align-items: center; gap: 4px; }
    .vitals-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 6px; padding: 8px 10px; text-align: center; font-size: 0.75rem; margin-bottom: 14px; }
    .vitals-grid .label { color: #78716c; font-size: 0.65rem; display: block; }
    /* Sections */
    .field-label { font-size: 0.7rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
    .field-box { border-radius: 6px; padding: 10px 12px; margin-bottom: 14px; }
    .diagnosis-box { background: #f8fafc; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a; }
    .reason-box { background: #fffbeb; border: 1px solid #fde68a; color: #78350f; font-size: 0.82rem; line-height: 1.55; }
    .allergy-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 7px 10px; margin-bottom: 14px; color: #991b1b; font-weight: 600; font-size: 0.75rem; }
    .notes-section { font-size: 0.78rem; color: #334155; margin-bottom: 14px; }
    /* Footer */
    .transfer-note { font-size: 0.68rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-bottom: 20px; line-height: 1.6; }
    .signature-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; }
    .sig-block { text-align: center; width: 220px; }
    .sig-line { border-bottom: 1px dashed #64748b; height: 36px; margin-bottom: 4px; }
    .sig-name { font-size: 0.78rem; font-weight: 800; }
    .sig-sub { font-size: 0.68rem; color: #64748b; }
    .sig-clinic { font-size: 0.65rem; font-weight: 700; color: #0369a1; margin-top: 2px; }
    .doc-meta { font-size: 0.68rem; color: #94a3b8; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="doc-header">
    <div>
      <div class="clinic-name">${CLINIC_NAME}</div>
      <div class="clinic-sub">Outpatient Department &amp; Clinical Health Services</div>
      <div class="clinic-sub">Yabelo Campus, Oromia, Ethiopia · Tel: +251 46 441 0000</div>
    </div>
    <div class="meta-right">
      <div class="badge">OFFICIAL REFERRAL LETTER</div>
      <div>Date: <strong>${date}</strong></div>
      ${patientCode ? `<div>Card No: <strong>${patientCode}</strong></div>` : ''}
      <div>Priority: <strong style="color:${urgency.includes('STAT') ? '#dc2626' : '#b45309'}">${urgency}</strong></div>
    </div>
  </div>

  <div class="destination-box">
    <div>
      <div class="dest-label">Referred To (Receiving Healthcare Facility)</div>
      <div class="dest-name">${destination}</div>
    </div>
  </div>

  <div class="demo-grid">
    <div><span class="label">Patient Full Name</span><strong>${patientName}</strong></div>
    <div><span class="label">Patient ID / Card Code</span><strong>${patientCode || '—'}</strong></div>
    <div><span class="label">Category &amp; Department</span>${patientType || 'Patient'}${patientDepartment ? ` · ${patientDepartment}` : ''}</div>
    ${(patientAge !== undefined || patientGender) ? `<div><span class="label">Age / Gender</span>${patientAge ? `${patientAge} yrs` : '—'} · ${patientGender || '—'}</div>` : ''}
    <div><span class="label">Referring Clinician</span><strong>Dr. ${doctorName}</strong></div>
    <div><span class="label">Referring Department</span>Outpatient Consultation (OPD)</div>
  </div>

  ${vitalsHtml}

  <div class="field-label">Clinical Impression &amp; Presumptive Diagnosis</div>
  <div class="field-box diagnosis-box">${diagnosis || 'Clinical evaluation required at receiving center'}</div>

  <div class="field-label">Detailed Reason for Referral &amp; Recommended Interventions</div>
  <div class="field-box reason-box">${reason}</div>

  ${symptomsHtml}
  ${allergiesHtml}

  <div class="transfer-note">
    Please evaluate and manage this patient according to your institutional protocols. After completion of care, please return a counter-referral note to ${CLINIC_NAME} for continuation of outpatient medical follow-up.
  </div>

  <div class="signature-row">
    <div class="doc-meta">Document Issued: ${date}<br/>${CLINIC_NAME} Health Records</div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">Dr. ${doctorName}</div>
      <div class="sig-sub">Referring Clinician Signature &amp; Stamp</div>
      <div class="sig-clinic">${CLINIC_NAME}</div>
    </div>
  </div>
</div>
<script>window.onload = function(){ window.print(); };<\/script>
</body></html>`);
    printWindow.document.close();
  };

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
        <div
          className="modal"
          style={{
            maxWidth: 720,
            width: '100%',
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg, 12px)',
            animation: 'fadeIn 0.15s ease-out',
            maxHeight: '94vh',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="referral-slip-title"
        >
          {/* Header - Screen only */}
          <div
            className="no-print"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              paddingBottom: '0.6rem',
              borderBottom: '1px solid var(--clr-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={20} className="text-warning" />
              <h2 id="referral-slip-title" style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Official Medical Referral Document
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handlePrint}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Printer size={15} /> Print / Save Referral PDF
              </button>
              <button
                type="button"
                className="modal-close-btn"
                onClick={onClose}
                aria-label="Close"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Printable Referral Body */}
          <div
            className="printable-referral-slip"
            style={{
              background: '#ffffff',
              color: '#0f172a',
              padding: '2rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              overflowY: 'auto',
              flex: 1,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              lineHeight: 1.45,
            }}
          >
            {/* Clinic Header */}
            <div
              style={{
                borderBottom: '2.5px solid #0369a1',
                paddingBottom: '0.85rem',
                marginBottom: '1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0369a1', letterSpacing: '-0.02em' }}>
                  {CLINIC_NAME}
                </h1>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 3 }}>
                  Outpatient Department &amp; Clinical Health Services
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Yabelo Campus, Oromia, Ethiopia · Tel: +251 46 441 0000
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#334155' }}>
                <div style={{
                  fontWeight: 800,
                  color: '#b45309',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  padding: '3px 8px',
                  borderRadius: 4,
                  display: 'inline-block',
                  marginBottom: 4,
                  fontSize: '0.76rem',
                  letterSpacing: '0.04em',
                }}>
                  OFFICIAL REFERRAL LETTER
                </div>
                <div>Date: <strong>{date}</strong></div>
                {patientCode && <div>Card No: <strong>{patientCode}</strong></div>}
                <div>Priority: <strong style={{ color: urgency.includes('STAT') ? '#dc2626' : '#b45309' }}>{urgency}</strong></div>
              </div>
            </div>

            {/* Destination Facility Banner */}
            <div
              style={{
                background: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <Building2 size={24} color="#15803d" />
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#166534', fontWeight: 700 }}>
                  Referred To (Receiving Healthcare Facility)
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#14532d' }}>
                  {destination}
                </div>
              </div>
            </div>

            {/* Patient Demographics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.6rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                fontSize: '0.8rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Patient Full Name</span>
                <strong style={{ color: '#0f172a', fontSize: '0.88rem' }}>{patientName}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Patient ID / Card Code</span>
                <strong style={{ color: '#0f172a' }}>{patientCode || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Category &amp; Department</span>
                <span style={{ color: '#0f172a' }}>{patientType || 'Patient'}{patientDepartment ? ` · ${patientDepartment}` : ''}</span>
              </div>
              {(patientAge !== undefined || patientGender) && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Age / Gender</span>
                  <span style={{ color: '#0f172a' }}>{patientAge ? `${patientAge} yrs` : '—'} · {patientGender || '—'}</span>
                </div>
              )}
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Referring Clinician</span>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>Dr. {doctorName}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Referring Department</span>
                <span style={{ color: '#0f172a' }}>Outpatient Consultation (OPD)</span>
              </div>
            </div>

            {/* Vitals Summary at Time of Transfer */}
            {vitals && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <HeartPulse size={14} color="#dc2626" /> Patient Vital Signs at Time of Referral
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: 8,
                    background: '#fafaf9',
                    border: '1px solid #e7e5e4',
                    borderRadius: 6,
                    padding: '0.5rem 0.75rem',
                    textAlign: 'center',
                    fontSize: '0.78rem',
                  }}
                >
                  <div>
                    <span style={{ color: '#78716c', fontSize: '0.7rem', display: 'block' }}>Blood Pressure</span>
                    <strong>{vitals.bloodPressure || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#78716c', fontSize: '0.7rem', display: 'block' }}>Pulse / HR</span>
                    <strong>{vitals.heartRate ? `${vitals.heartRate} bpm` : '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#78716c', fontSize: '0.7rem', display: 'block' }}>Temperature</span>
                    <strong style={{ color: (vitals.temperature || 0) > 37.5 ? '#dc2626' : undefined }}>
                      {vitals.temperature ? `${vitals.temperature}°C` : '—'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#78716c', fontSize: '0.7rem', display: 'block' }}>Oxygen Sat (SpO2)</span>
                    <strong>{vitals.spo2 ? `${vitals.spo2}%` : '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#78716c', fontSize: '0.7rem', display: 'block' }}>Resp Rate</span>
                    <strong>{vitals.respiratoryRate ? `${vitals.respiratoryRate} /min` : '—'}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Clinical Impression & Diagnosis */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                Clinical Impression &amp; Presumptive Diagnosis
              </div>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              >
                {diagnosis || 'Clinical evaluation required at receiving center'}
              </div>
            </div>

            {/* Reason for Referral */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                Detailed Reason for Referral &amp; Recommended Interventions
              </div>
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 6,
                  padding: '0.75rem 0.95rem',
                  fontSize: '0.84rem',
                  color: '#78350f',
                  lineHeight: 1.5,
                }}
              >
                {reason}
              </div>
            </div>

            {/* Symptoms & Clinical Notes */}
            {(symptoms.length > 0 || notes) && (
              <div style={{ marginBottom: '1.25rem', fontSize: '0.8rem', color: '#334155' }}>
                {symptoms.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <strong>Presenting Symptoms:</strong> {symptoms.join(', ')}
                  </div>
                )}
                {notes && (
                  <div>
                    <strong>Clinical Consultation Notes:</strong> {notes}
                  </div>
                )}
              </div>
            )}

            {/* Known Allergies Alert */}
            {allergies.length > 0 && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  padding: '0.5rem 0.75rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.78rem',
                  color: '#991b1b',
                  fontWeight: 600,
                }}
              >
                <AlertCircle size={16} /> Known Allergies: {allergies.join(', ')}
              </div>
            )}

            {/* Transfer Instructions */}
            <div style={{ fontSize: '0.72rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginBottom: '1.5rem' }}>
              Please evaluate and manage this patient according to your institutional protocols. After completion of care, please return a counter-referral note to {CLINIC_NAME} for continuation of outpatient medical follow-up.
            </div>

            {/* Signature & Official Seal Section */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                marginTop: '2rem',
                paddingTop: '0.75rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  Document Issued: {date}<br />
                  {CLINIC_NAME} Health Records
                </div>
              </div>

              <div style={{ textAlign: 'center', width: 240 }}>
                <div style={{ borderBottom: '1px dashed #64748b', marginBottom: 4, height: 35 }}></div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                  Dr. {doctorName}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  Referring Clinician Signature &amp; Stamp
                </div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0369a1', marginTop: 2 }}>
                  {CLINIC_NAME}
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer - Screen only */}
          <div
            className="no-print"
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '1rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--clr-border)',
            }}
          >
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button type="button" className="btn btn-primary" onClick={handlePrint}>
              <Printer size={15} /> Print / Save Referral Document
            </button>
          </div>
        </div>


      </div>
    </ModalPortal>
  );
}

