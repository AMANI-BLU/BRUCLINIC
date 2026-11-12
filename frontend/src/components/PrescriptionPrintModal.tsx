import { useEffect, useState } from 'react';
import { Printer, X, FileText, CheckCircle2, ShoppingBag } from 'lucide-react';
import ModalPortal from './ModalPortal';

export interface PrescriptionItemPrint {
  name: string;
  quantity?: number;
  instructions?: string;
  isExternal?: boolean;
}

const CLINIC_NAME = 'Borana University Clinic';

export interface PrescriptionPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  patientCode?: string;
  patientAge?: number;
  patientGender?: string;
  patientWeight?: number;
  doctorName: string;
  doctorDiagnosis?: string;
  date?: string;
  medicines: PrescriptionItemPrint[];
  notes?: string;
  initialMode?: 'clinic' | 'outside';
}

export default function PrescriptionPrintModal({
  isOpen,
  onClose,
  patientName,
  patientCode,
  patientAge,
  patientGender,
  patientWeight,
  doctorName,
  doctorDiagnosis,
  date = new Date().toLocaleDateString(),
  medicines,
  notes,
  initialMode,
}: PrescriptionPrintModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const externalMeds = medicines.filter(m => m.isExternal);
  const internalMeds = medicines.filter(m => !m.isExternal);
  const [printMode, setPrintMode] = useState<'clinic' | 'outside'>(initialMode || (internalMeds.length > 0 ? 'clinic' : 'outside'));
  const isOutsidePrint = printMode === 'outside';

  if (!isOpen) return null;

  const handlePrint = () => {
    const externalRows = externalMeds.map((med, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${med.name}</strong></td>
        <td>${med.instructions || 'As directed by the prescriber'}</td>
        <td style="text-align:right"><strong>${med.quantity || '—'}</strong></td>
      </tr>`).join('');

    const internalRows = internalMeds.map((med, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${med.name}</strong></td>
        <td>${med.instructions || 'As directed by the prescriber'}</td>
        <td style="text-align:right"><strong>${med.quantity || '—'}</strong></td>
      </tr>`).join('');

    const externalSection = isOutsidePrint && externalMeds.length > 0 ? `
      <div class="section-header ext">🛒 MEDICINES TO PURCHASE FROM OUTSIDE RETAIL PHARMACY</div>
      <p class="section-note">The following medicine(s) are not currently stocked in the clinic dispensary. Please take this slip to any community pharmacy to purchase.</p>
      <table>
        <thead><tr><th>#</th><th>Medication Name</th><th>Instructions</th><th style="text-align:right">Qty</th></tr></thead>
        <tbody>${externalRows}</tbody>
      </table>` : '';

    const internalSection = !isOutsidePrint && internalMeds.length > 0 ? `
      <div class="section-header int">✓ MEDICINES DISPENSED AT CLINIC PHARMACY</div>
      <table>
        <thead><tr><th>#</th><th>Medication Name</th><th>Instructions</th><th style="text-align:right">Qty</th></tr></thead>
        <tbody>${internalRows}</tbody>
      </table>` : '';

    const notesHtml = notes ? `<div class="notes"><strong>Clinician Notes:</strong> ${notes}</div>` : '';

    const printWindow = window.open('', '_blank', 'width=860,height=680');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Prescription – ${patientName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, system-ui, sans-serif; color: #0f172a; background: #fff; font-size: 13px; line-height: 1.5; }
    @page { size: A4; margin: 18mm 15mm; }
    .wrap { max-width: 720px; margin: 0 auto; }
    /* Header */
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 14px; }
    .clinic-name { font-size: 1.25rem; font-weight: 800; color: #0369a1; letter-spacing: -0.02em; }
    .clinic-sub { font-size: 0.72rem; color: #64748b; margin-top: 2px; }
    .meta-right { text-align: right; font-size: 0.72rem; color: #475569; }
    .rx-badge { font-weight: 700; color: #0284c7; font-size: 0.82rem; display: block; }
    /* Patient meta */
    .patient-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 0.78rem; }
    .patient-meta .span2 { grid-column: span 2; }
    /* Sections */
    .section-header { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 6px; margin-bottom: 10px; font-size: 0.82rem; font-weight: 700; margin-top: 14px; }
    .section-header.ext { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; }
    .section-header.int { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
    .section-note { font-size: 0.7rem; color: #78350f; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.78rem; margin-bottom: 14px; }
    thead tr { border-bottom: 1px solid #e2e8f0; }
    thead th { padding: 6px 8px; text-align: left; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody td { padding: 8px; }
    .notes { margin-top: 10px; font-size: 0.72rem; color: #475569; font-style: italic; }
    /* Signature */
    .signature-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 32px; padding-top: 14px; border-top: 1px solid #e2e8f0; }
    .sig-block { text-align: center; width: 210px; }
    .sig-line { border-bottom: 1px dashed #64748b; height: 36px; margin-bottom: 4px; }
    .sig-name { font-size: 0.75rem; font-weight: 700; color: #0f172a; }
    .sig-sub { font-size: 0.65rem; color: #64748b; }
    .validity { font-size: 0.68rem; color: #94a3b8; line-height: 1.6; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="doc-header">
    <div>
      <div class="clinic-name">${CLINIC_NAME}</div>
      <div class="clinic-sub">Outpatient Department &amp; Clinical Medical Services</div>
    </div>
    <div class="meta-right">
      <span class="rx-badge">${isOutsidePrint ? 'OUTSIDE PURCHASE SLIP' : 'CLINIC PHARMACY DISPENSE SLIP'}</span>
      <div>Date: ${date}</div>
      ${patientCode ? `<div>Patient Code: <strong>${patientCode}</strong></div>` : ''}
    </div>
  </div>

  <div class="patient-meta">
    <div><span style="color:#64748b">Patient Name: </span><strong>${patientName}</strong></div>
    <div><span style="color:#64748b">Age / Sex: </span><strong>${patientAge !== undefined ? `${patientAge} years` : '—'} / ${patientGender || '—'}</strong></div>
    <div><span style="color:#64748b">Weight: </span><strong>${patientWeight !== undefined ? `${patientWeight} kg` : '—'}</strong></div>
    <div><span style="color:#64748b">Prescribing Clinician: </span><strong>${doctorName}</strong></div>
    ${doctorDiagnosis ? `<div class="span2"><span style="color:#64748b">Clinical Diagnosis: </span><strong>${doctorDiagnosis}</strong></div>` : ''}
  </div>

  ${externalSection}
  ${internalSection}
  ${notesHtml}

  <div class="signature-row">
    <div class="validity">Valid for fulfillment within 14 days from issue date.<br/>${CLINIC_NAME} Electronic Health Records System</div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">${CLINIC_NAME}</div>
      <div class="sig-sub">Clinic name and authorized clinic stamp</div>
    </div>
  </div>
</div>
<script>window.onload = function(){ window.print(); };<\/script>
</body></html>`);
    printWindow.document.close();
  };

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{
          maxWidth: 680,
          width: '100%',
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg, 12px)',
          animation: 'fadeIn 0.15s ease-out',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rx-slip-title"
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
            <FileText size={20} className="text-primary" />
            <h2 id="rx-slip-title" style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              {isOutsidePrint ? 'Outside Purchase Slip' : 'Clinic Pharmacy Dispense Slip'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div className="pill-tabs" style={{ fontSize: '0.72rem' }}>
              <button
                type="button"
                className={`pill-tab ${!isOutsidePrint ? 'active' : ''}`}
                onClick={() => setPrintMode('clinic')}
                disabled={internalMeds.length === 0}
              >
                Clinic dispense
              </button>
              <button
                type="button"
                className={`pill-tab ${isOutsidePrint ? 'active' : ''}`}
                onClick={() => setPrintMode('outside')}
                disabled={externalMeds.length === 0}
              >
                Outside purchase
              </button>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Printer size={15} /> Print this slip
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

        {/* Printable Prescription Body */}
        <div
          className="printable-prescription-slip"
          style={{
            background: '#ffffff',
            color: '#0f172a',
            padding: '1.75rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            overflowY: 'auto',
            flex: 1,
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Clinic Header */}
          <div
            style={{
              borderBottom: '2px solid #0284c7',
              paddingBottom: '0.75rem',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0369a1', letterSpacing: '-0.02em' }}>
                {CLINIC_NAME}
              </h1>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                Outpatient Department &amp; Clinical Medical Services
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#475569' }}>
              <div style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.85rem' }}>{isOutsidePrint ? 'OUTSIDE PURCHASE SLIP' : 'CLINIC PHARMACY DISPENSE SLIP'}</div>
              <div>Date: {date}</div>
              {patientCode && <div>Patient Code: <strong>{patientCode}</strong></div>}
            </div>
          </div>

          {/* Patient & Doctor Meta */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.5rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              fontSize: '0.8rem',
            }}
          >
            <div>
              <span style={{ color: '#64748b' }}>Patient Name: </span>
              <strong style={{ color: '#0f172a' }}>{patientName}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Age / Sex: </span>
              <strong style={{ color: '#0f172a' }}>{patientAge !== undefined ? `${patientAge} years` : '—'} / {patientGender || '—'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Weight: </span>
              <strong style={{ color: '#0f172a' }}>{patientWeight !== undefined ? `${patientWeight} kg` : '—'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Prescribing Clinician: </span>
              <strong style={{ color: '#0f172a' }}>{doctorName}</strong>
            </div>
            {doctorDiagnosis && (
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748b' }}>Clinical Diagnosis: </span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{doctorDiagnosis}</span>
              </div>
            )}
          </div>

          {/* Separate patient slip: outside purchase or clinic dispensing */}
          {isOutsidePrint && externalMeds.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.6rem',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  marginBottom: '0.75rem',
                }}
              >
                <ShoppingBag size={16} color="#d97706" />
                <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#92400e' }}>
                  MEDICINES TO PURCHASE FROM OUTSIDE RETAIL PHARMACY
                </h3>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#78350f', margin: '0 0 0.5rem 0' }}>
                The following medicine(s) are not currently stocked in the clinic dispensary. Please take this slip to any community pharmacy to purchase.
              </p>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#fffbeb', borderBottom: '1px solid #fef3c7', color: '#92400e', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>#</th>
                    <th style={{ padding: '6px 8px' }}>Medication Name</th>
                    <th style={{ padding: '6px 8px' }}>Instructions</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {externalMeds.map((med, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{med.name}</div>
                      </td>
                      <td style={{ padding: '8px', color: '#334155' }}>{med.instructions || 'As directed by the prescriber'}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {med.quantity || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isOutsidePrint && externalMeds.length === 0 && (
            <div style={{ padding: '1rem', border: '1px dashed #f59e0b', borderRadius: 6, color: '#92400e', fontSize: '0.8rem' }}>
              No medicines were marked for outside purchase.
            </div>
          )}

          {/* In-house clinic dispensing slip */}
          {!isOutsidePrint && internalMeds.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.6rem',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '6px',
                  marginBottom: '0.75rem',
                }}
              >
                <CheckCircle2 size={16} color="#059669" />
                <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#065f46' }}>
                  MEDICINES DISPENSED AT CLINIC PHARMACY
                </h3>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f0fdf4', borderBottom: '1px solid #dcfce7', color: '#065f46', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>#</th>
                    <th style={{ padding: '6px 8px' }}>Medication Name</th>
                    <th style={{ padding: '6px 8px' }}>Instructions</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {internalMeds.map((med, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{med.name}</div>
                      </td>
                      <td style={{ padding: '8px', color: '#334155' }}>{med.instructions || 'As directed by the prescriber'}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {med.quantity || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isOutsidePrint && internalMeds.length === 0 && (
            <div style={{ padding: '1rem', border: '1px dashed #10b981', borderRadius: 6, color: '#065f46', fontSize: '0.8rem' }}>
              No medicines are currently assigned to clinic dispensing.
            </div>
          )}

          {notes && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#475569', fontStyle: 'italic' }}>
              <strong>Clinician Notes:</strong> {notes}
            </div>
          )}

          {/* Signature & Stamp Footer */}
          <div
            style={{
              marginTop: '2.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              Valid for fulfillment within 14 days from issue date.<br />
              {CLINIC_NAME} Electronic Health Records System
            </div>
            <div style={{ textAlign: 'center', width: 220 }}>
              <div style={{ borderBottom: '1px dashed #64748b', marginBottom: 4, height: 35 }}></div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>{CLINIC_NAME}</div>
              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Clinic name and authorized clinic stamp</div>
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
            <Printer size={15} /> Print / Save {isOutsidePrint ? 'Outside Purchase' : 'Clinic Dispense'} PDF
          </button>
        </div>
      </div>


    </div>
    </ModalPortal>
  );
}
