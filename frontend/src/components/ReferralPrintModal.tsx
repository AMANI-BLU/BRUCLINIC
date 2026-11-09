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
    window.print();
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

        {/* Global Print Styles */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .printable-referral-slip,
            .printable-referral-slip * {
              visibility: visible;
            }
            .printable-referral-slip {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              border: none !important;
              padding: 0 !important;
            }
            .no-print,
            .modal-overlay {
              background: none !important;
              padding: 0 !important;
            }
          }
        `}</style>
      </div>
    </ModalPortal>
  );
}

