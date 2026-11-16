import { useEffect, useMemo, useState } from 'react';
import { Printer, X, FileText, ShoppingBag, CheckCircle2 } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { cleanClinicalText, clinicalTextHtml, escapeHtml } from '../utils/clinicalText';
import './PrescriptionPrintModal.css';

export interface PrescriptionItemPrint {
  name: string;
  strength?: string;
  doseForm?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  quantity?: number;
  price?: number;
  instructions?: string;
  isExternal?: boolean;
}

const CLINIC_NAME = 'Borana University Medium Clinic';

export interface PrescriptionPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  patientCode?: string;
  patientAge?: number;
  patientGender?: string;
  patientWeight?: number;
  patientStatus?: 'In patient' | 'Out patient';
  pregnancyStatus?: 'Pregnant' | 'Non-Pregnant';
  isRefill?: boolean;
  region?: string;
  town?: string;
  kebele?: string;
  doctorName: string;
  doctorDiagnosis?: string;
  date?: string;
  medicines: PrescriptionItemPrint[];
  notes?: string;
  initialMode?: 'clinic' | 'outside';
}

function printedDirections(medicine: PrescriptionItemPrint): string {
  const structured = [medicine.dosage, medicine.frequency].map(cleanClinicalText).filter(Boolean).join(' · ');
  return [structured, cleanClinicalText(medicine.instructions)].filter(Boolean).join(' — ') || 'As directed by prescriber';
}

function tick(value: boolean) {
  return value ? '☑' : '☐';
}

export default function PrescriptionPrintModal({
  isOpen,
  onClose,
  patientName,
  patientCode,
  patientAge,
  patientGender,
  patientWeight,
  patientStatus,
  pregnancyStatus,
  isRefill = false,
  region,
  town,
  kebele,
  doctorName,
  doctorDiagnosis,
  date = new Date().toLocaleDateString(),
  medicines,
  notes,
  initialMode,
}: PrescriptionPrintModalProps) {
  const externalMeds = medicines.filter(medicine => medicine.isExternal);
  const internalMeds = medicines.filter(medicine => !medicine.isExternal);
  const [printMode, setPrintMode] = useState<'clinic' | 'outside'>(initialMode || (internalMeds.length > 0 ? 'clinic' : 'outside'));
  const isOutsidePrint = printMode === 'outside';
  const selectedMedicines = isOutsidePrint ? externalMeds : internalMeds;
  const cleanNotes = cleanClinicalText(notes);
  const totalPrice = useMemo(() => {
    if (selectedMedicines.length === 0 || selectedMedicines.some(medicine => medicine.price === undefined)) return undefined;
    return selectedMedicines.reduce((sum, medicine) => sum + Number(medicine.price || 0) * Number(medicine.quantity || 0), 0);
  }, [selectedMedicines]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const rows = selectedMedicines.map((medicine, index) => `
      <tr>
        <td class="serial">${index + 1}</td>
        <td><strong>${escapeHtml(cleanClinicalText(medicine.name))}</strong>${medicine.strength ? `<small>${escapeHtml(cleanClinicalText(medicine.strength))}</small>` : ''}${medicine.doseForm ? `<small>${escapeHtml(cleanClinicalText(medicine.doseForm))}</small>` : ''}</td>
        <td>${clinicalTextHtml([medicine.dosage, medicine.frequency].filter(Boolean).join(' · ') || '—')}</td>
        <td>${escapeHtml(cleanClinicalText(medicine.duration) || '—')}</td>
        <td class="center">${escapeHtml(medicine.quantity ?? '—')}</td>
        <td>${clinicalTextHtml(cleanClinicalText(medicine.instructions) || '—')}</td>
        <td class="price">${medicine.price === undefined ? '' : escapeHtml((Number(medicine.price) * Number(medicine.quantity || 0)).toFixed(2))}</td>
      </tr>`).join('');
    const blankRows = Array.from({ length: Math.max(0, 4 - selectedMedicines.length) }, () => '<tr class="blank-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
    const visitStatus = patientStatus ? `${tick(patientStatus === 'In patient')} In patient&nbsp;&nbsp;&nbsp; ${tick(patientStatus === 'Out patient')} Out patient` : `${tick(false)} In patient&nbsp;&nbsp;&nbsp; ${tick(false)} Out patient`;
    const pregnancy = pregnancyStatus ? `${tick(pregnancyStatus === 'Pregnant')} Pregnant&nbsp;&nbsp;&nbsp; ${tick(pregnancyStatus === 'Non-Pregnant')} Non-Pregnant` : `${tick(false)} Pregnant&nbsp;&nbsp;&nbsp; ${tick(false)} Non-Pregnant`;
    const totalText = totalPrice === undefined ? '' : totalPrice.toFixed(2);
    const printWindow = window.open('', '_blank', 'width=900,height=760');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Prescription - ${escapeHtml(patientName)}</title>
<style>
  *{box-sizing:border-box}body{margin:0;color:#111;font:12px/1.35 "Times New Roman",serif;background:#fff}
  @page{size:A4;margin:12mm 11mm}.sheet{width:100%;max-width:188mm;margin:0 auto;padding:4mm 3mm}
  .title{text-align:center;font-size:16px;line-height:1.2;font-weight:700;letter-spacing:.025em;margin:1mm 0 4mm}
  .date{text-align:right;margin-bottom:3mm}.line{display:inline-block;min-width:42mm;border-bottom:1px solid #333;height:1.2em;vertical-align:bottom}
  .patient-fields{display:grid;grid-template-columns:1.1fr .65fr 1.2fr;gap:0;border-top:1px solid #333;border-left:1px solid #333}
  .field{min-height:8mm;display:flex;align-items:center;gap:4px;padding:2px 5px;border-right:1px solid #333;border-bottom:1px solid #333}
  .field b{white-space:nowrap}.field .write{flex:1;min-height:1.2em;border-bottom:1px solid #888;overflow-wrap:anywhere}
  .field.wide{grid-column:span 2}.field.full{grid-column:1/-1}.checks{font-size:10px;white-space:nowrap}
  .rx-label{padding:2mm 3mm;border:1px solid #333;border-bottom:0;font-size:18px;font-weight:700}
  table{width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #333;font-size:10px}
  th,td{border:1px solid #333;padding:4px 5px;vertical-align:top;text-align:left;overflow-wrap:anywhere}
  th{height:15mm;text-align:center;vertical-align:middle;font-weight:700}
  th:nth-child(1){width:6%}th:nth-child(2){width:24%}th:nth-child(3){width:13%}th:nth-child(4){width:10%}th:nth-child(5){width:7%}th:nth-child(6){width:27%}th:nth-child(7){width:13%}
  td.serial,.center{text-align:center}.price{text-align:right}.blank-row td{height:11mm}.blank-row td:first-child{height:11mm}
  .selection{padding:2mm 0;font-size:10px}.selection b{margin-right:4px}
  .rx-meta{margin:2mm 0 0;font-size:10px}.notes{margin-top:2mm;font-size:10px;white-space:pre-wrap}
  .total{display:flex;justify-content:flex-end;align-items:center;gap:5mm;margin:2mm 0 5mm;font-weight:700}.total-box{display:inline-block;width:25mm;min-height:8mm;border:1px solid #333;padding:1mm;text-align:right}
  .signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm;margin-top:5mm;text-align:center}.sig b{display:block;margin-bottom:5mm}.sig-line{height:9mm;border-bottom:1px solid #333;margin-bottom:2mm}.sig small{display:block;min-height:8mm;text-align:left;border-bottom:1px solid #888;margin:2mm 4mm;font-size:9px}
  .paper-foot{margin-top:5mm;padding-top:2mm;border-top:1px solid #777;text-align:center;font-size:8px;color:#444}
  @media print{.sheet{padding:0}tr{break-inside:avoid}}
</style></head><body><main class="sheet">
  <h1 class="title">BORANA UNIVERSITY MEDIUM CLINIC<br/>PRESCRIPTION PAPER</h1>
  <div class="date"><b>Date</b> <span class="line">${escapeHtml(date)}</span></div>
  <section class="patient-fields">
    <div class="field wide"><b>Patient’s Full Name</b><span class="write">${escapeHtml(patientName)}</span></div>
    <div class="field"><b>Age</b><span class="write">${patientAge === undefined ? '' : escapeHtml(patientAge)}</span></div>
    <div class="field wide"><b>Sex</b><span class="write">${escapeHtml(patientGender || '')}</span></div>
    <div class="field"><b>Weight</b><span class="write">${patientWeight === undefined ? '' : `${escapeHtml(patientWeight)} kg`}</span></div>
    <div class="field wide"><b>Card No. (MRN)</b><span class="write">${escapeHtml(patientCode || '')}</span></div>
    <div class="field full"><b>Patient status</b><span class="checks">${visitStatus}</span><b style="margin-left:auto">Start</b><span class="checks">${tick(true)}</span><b>Refill</b><span class="checks">${tick(isRefill)}</span><b>Pregnancy</b><span class="checks">${pregnancy}</span></div>
    <div class="field full"><b>Diagnosis (ICD Code) No.</b><span class="write">${escapeHtml(cleanClinicalText(doctorDiagnosis) || '')}</span></div>
    <div class="field"><b>Region</b><span class="write">${escapeHtml(region || '')}</span></div><div class="field"><b>Town</b><span class="write">${escapeHtml(town || '')}</span></div><div class="field"><b>Kebele</b><span class="write">${escapeHtml(kebele || '')}</span></div>
  </section>
  <div class="selection"><b>Prescription source:</b> ${tick(!isOutsidePrint)} Clinic pharmacy&nbsp;&nbsp;&nbsp; ${tick(isOutsidePrint)} Outside purchase</div>
  <div class="rx-label">Rx</div>
  <table><thead><tr><th>S.N.</th><th>Drug Name, Strength,<br/>Dosage Form</th><th>Dose<br/>Frequency</th><th>Duration</th><th>Quantity</th><th>How to use &amp; Other Information</th><th>Price<br/>(For Dispensers Use Only)</th></tr></thead><tbody>${rows}${blankRows}</tbody></table>
  ${cleanNotes ? `<p class="notes"><b>Clinician notes:</b> ${clinicalTextHtml(cleanNotes)}</p>` : ''}
  <div class="total"><span>Total Price</span><span class="total-box">${totalText}</span></div>
  <section class="signatures"><div class="sig"><b>Prescriber’s</b><div class="sig-line"></div><div>${escapeHtml(doctorName)}</div><small>Full Name</small><small>Qualification</small><small>Signature</small></div><div class="sig"><b>Evaluator</b><div class="sig-line"></div><small>Full Name</small><small>Qualification</small><small>Signature</small></div><div class="sig"><b>Counselor</b><div class="sig-line"></div><small>Full Name</small><small>Qualification</small><small>Signature</small></div></section>
  <div class="paper-foot">${escapeHtml(CLINIC_NAME)} · Prescription document generated from BruClinic</div>
</main><script>window.onload=function(){window.print()};<\/script></body></html>`);
    printWindow.document.close();
  };

  return (
    <ModalPortal>
      <div className="modal-overlay prescription-paper-overlay" onClick={onClose}>
        <section className="modal prescription-paper-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="rx-slip-title">
          <header className="prescription-modal-toolbar no-print">
            <div className="prescription-toolbar-title"><FileText size={19} /><h2 id="rx-slip-title">Prescription paper</h2></div>
            <div className="prescription-toolbar-actions">
              <div className="pill-tabs">
                <button type="button" className={`pill-tab ${!isOutsidePrint ? 'active' : ''}`} onClick={() => setPrintMode('clinic')} disabled={!internalMeds.length}><CheckCircle2 size={13} /> Clinic pharmacy</button>
                <button type="button" className={`pill-tab ${isOutsidePrint ? 'active' : ''}`} onClick={() => setPrintMode('outside')} disabled={!externalMeds.length}><ShoppingBag size={13} /> Outside purchase</button>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={handlePrint}><Printer size={15} /> Print paper</button>
              <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
            </div>
          </header>

          <div className="prescription-paper-preview">
            <h1>BORANA UNIVERSITY MEDIUM CLINIC<br />PRESCRIPTION PAPER</h1>
            <div className="prescription-paper-date"><b>Date</b><span>{date}</span></div>
            <section className="prescription-paper-patient">
              <div className="span-2"><b>Patient’s Full Name</b><span>{patientName}</span></div><div><b>Age</b><span>{patientAge === undefined ? ' ' : `${patientAge} years`}</span></div>
              <div className="span-2"><b>Sex</b><span>{patientGender || ' '}</span></div><div><b>Weight</b><span>{patientWeight === undefined ? ' ' : `${patientWeight} kg`}</span></div>
              <div className="span-3"><b>Card No. (MRN)</b><span>{patientCode || ' '}</span></div>
              <div className="span-3"><b>Patient status</b><span>{tick(patientStatus === 'In patient')} In patient　 {tick(patientStatus === 'Out patient')} Out patient　 <b>Start</b> {tick(true)}　<b>Refill</b> {tick(isRefill)}　<b>Pregnancy</b> {tick(pregnancyStatus === 'Pregnant')} Pregnant　 {tick(pregnancyStatus === 'Non-Pregnant')} Non-Pregnant</span></div>
              <div className="span-3"><b>Diagnosis (ICD Code) No.</b><span>{doctorDiagnosis || ' '}</span></div>
              <div><b>Region</b><span>{region || ' '}</span></div><div><b>Town</b><span>{town || ' '}</span></div><div><b>Kebele</b><span>{kebele || ' '}</span></div>
            </section>
            <div className="prescription-paper-source"><b>Prescription source:</b> {tick(!isOutsidePrint)} Clinic pharmacy　　{tick(isOutsidePrint)} Outside purchase</div>
            <div className="prescription-paper-rx">Rx</div>
            <div className="prescription-paper-table-wrap">
              <table className="prescription-paper-table"><thead><tr><th>S.N.</th><th>Drug Name, Strength,<br />Dosage Form</th><th>Dose<br />Frequency</th><th>Duration</th><th>Quantity</th><th>How to use &amp; Other Information</th><th>Price<br />(For Dispensers Use Only)</th></tr></thead>
                <tbody>{selectedMedicines.map((medicine, index) => <tr key={`${medicine.name}-${index}`}><td>{index + 1}</td><td><strong>{medicine.name}</strong>{medicine.strength && <small>{medicine.strength}</small>}{medicine.doseForm && <small>{medicine.doseForm}</small>}</td><td>{medicine.dosage || '—'}<br />{medicine.frequency || '—'}</td><td>{medicine.duration || '—'}</td><td>{medicine.quantity ?? '—'}</td><td>{printedDirections(medicine)}</td><td>{medicine.price === undefined ? '' : (Number(medicine.price) * Number(medicine.quantity || 0)).toFixed(2)}</td></tr>)}
                  {Array.from({ length: Math.max(0, 4 - selectedMedicines.length) }, (_, index) => <tr className="prescription-empty-row" key={`blank-${index}`}><td>{selectedMedicines.length + index + 1}</td><td /><td /><td /><td /><td /><td /></tr>)}</tbody>
              </table>
            </div>
            {cleanNotes && <p className="prescription-paper-notes"><b>Clinician notes:</b> {cleanNotes}</p>}
            <div className="prescription-paper-total"><b>Total Price</b><span>{totalPrice === undefined ? '' : totalPrice.toFixed(2)}</span></div>
            <section className="prescription-paper-signatures">
              <div><b>Prescriber’s</b><i /> <strong>{doctorName}</strong><span>Full Name</span><span>Qualification</span><span>Signature</span></div>
              <div><b>Evaluator</b><i /><strong>&nbsp;</strong><span>Full Name</span><span>Qualification</span><span>Signature</span></div>
              <div><b>Counselor</b><i /><strong>&nbsp;</strong><span>Full Name</span><span>Qualification</span><span>Signature</span></div>
            </section>
          </div>
          <footer className="prescription-modal-footer no-print"><button type="button" className="btn btn-secondary" onClick={onClose}>Close</button><button type="button" className="btn btn-primary" onClick={handlePrint}><Printer size={15} /> Print / Save {isOutsidePrint ? 'Outside Purchase' : 'Clinic Pharmacy'} PDF</button></footer>
        </section>
      </div>
    </ModalPortal>
  );
}
