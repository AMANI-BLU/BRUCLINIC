import { useEffect, useState } from 'react';
import { FileText, History, Printer, Utensils, X } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { cleanClinicalText, escapeHtml } from '../utils/clinicalText';
import { formatDoctorName } from '../utils/doctorName';
import { useClinic } from '../context/ClinicContext';
import { useLanguage } from '../context/LanguageContext';
import type { ClinicDocument, NewClinicDocument } from '../types';
import './OpdClinicDocumentModal.css';

export type OpdClinicDocumentType = 'sick-leave' | 'special-meal';

interface OpdClinicDocumentModalProps {
  type: OpdClinicDocumentType;
  patientId: string;
  queueItemId?: string;
  patientName: string;
  patientCode?: string;
  patientAge?: number;
  patientGender?: string;
  doctorName: string;
  profession?: string;
  treatmentDate?: string;
  diagnosis?: string;
  treatment?: string;
  onClose: () => void;
}

interface DocumentFields {
  documentDate: string;
  treatmentDate: string;
  diagnosis: string;
  treatment: string;
  dateFrom: string;
  dateTo: string;
  mealType: string;
  physician: string;
  profession: string;
}

function localDateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(value?: string): string {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function safe(value?: string | number): string {
  return escapeHtml(cleanClinicalText(value));
}

export default function OpdClinicDocumentModal({
  type,
  patientId,
  queueItemId,
  patientName,
  patientCode,
  patientAge,
  patientGender,
  doctorName,
  profession,
  treatmentDate,
  diagnosis,
  treatment,
  onClose,
}: OpdClinicDocumentModalProps) {
  const { t } = useLanguage();
  const { issueClinicDocument, listClinicDocuments } = useClinic();
  const [fields, setFields] = useState<DocumentFields>(() => {
    const today = localDateInputValue();
    return {
      documentDate: today,
      treatmentDate: treatmentDate?.slice(0, 10) || today,
      diagnosis: cleanClinicalText(diagnosis),
      treatment: cleanClinicalText(treatment),
      dateFrom: '',
      dateTo: '',
      mealType: '',
      physician: formatDoctorName(doctorName),
      profession: cleanClinicalText(profession) || 'Physician',
    };
  });
  const [savedDocuments, setSavedDocuments] = useState<ClinicDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [popupBlocked, setPopupBlocked] = useState(false);

  const isSickLeave = type === 'sick-leave';
  const setField = (key: keyof DocumentFields, value: string) => setFields(previous => ({ ...previous, [key]: value }));

  useEffect(() => {
    let active = true;
    listClinicDocuments(patientId)
      .then(documents => { if (active) setSavedDocuments(documents); })
      .catch(() => { if (active) setActionError(t('Could not load issued forms.')); })
      .finally(() => { if (active) setDocumentsLoading(false); });
    return () => { active = false; };
  }, [listClinicDocuments, patientId, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  const writePrintDocument = (record: ClinicDocument, printWindow: Window) => {
    const recordIsSickLeave = record.documentType === 'sick-leave';
    const logoUrl = `${window.location.origin}/bu-logo.png`;
    const title = recordIsSickLeave ? 'Sick Leave' : 'Special Meal Order';
    const periodLabel = recordIsSickLeave ? 'Date given for rest' : 'No. of days allowed for Special Meal';
    const period = `<div class="field full"><b>${periodLabel}</b><span class="write">${safe(displayDate(record.dateFrom))}</span><b>to</b><span class="write">${safe(displayDate(record.dateTo))}</span></div>`;
    const body = recordIsSickLeave
      ? `<main class="paper sick"><header class="header"><img src="${escapeHtml(logoUrl)}" alt="Borana University logo"><div><h1>Borana University Student Services Clinic</h1><h2>Sick Leave</h2></div></header><div class="date"><b>Date</b><span>${safe(displayDate(record.documentDate))}</span></div><section class="fields"><div class="field"><b>Name of Student / Patient</b><span class="write">${safe(record.patientName)}</span></div><div class="field short"><b>Age</b><span class="write">${record.patientAge === undefined ? '' : safe(record.patientAge)}</span></div><div class="field short"><b>Sex</b><span class="write">${safe(record.patientGender)}</span></div><div class="field third"><b>MRN</b><span class="write">${safe(record.patientCode)}</span></div><div class="field third"><b>Date of Treatment</b><span class="write">${safe(displayDate(record.treatmentDate))}</span></div><div class="field full"><b>Diagnosis</b><span class="write">${safe(record.diagnosis)}</span></div><div class="field full"><b>Treatment Given</b><span class="write">${safe(record.treatment)}</span></div>${period}<div class="signatures"><div><b>Name of Physician</b><span class="signature-line">${safe(record.physicianName)}</span></div><div><b>Profession</b><span class="signature-line">${safe(record.profession)}</span></div><div><b>Date</b><span class="signature-line">${safe(displayDate(record.documentDate))}</span></div><div><b>Signature</b><span class="signature-line"></span></div></div></section></main>`
      : `<main class="paper meal"><header class="header"><img src="${escapeHtml(logoUrl)}" alt="Borana University logo"><div><h1>Borana University Student Services Clinic</h1><h2>Special Meal Order</h2></div></header><div class="date"><b>Date</b><span>${safe(displayDate(record.documentDate))}</span></div><section class="fields"><div class="field"><b>Name of patient</b><span class="write">${safe(record.patientName)}</span></div><div class="field short"><b>Age</b><span class="write">${record.patientAge === undefined ? '' : safe(record.patientAge)}</span></div><div class="field short"><b>Sex</b><span class="write">${safe(record.patientGender)}</span></div><div class="field full"><b>Diagnosis</b><span class="write">${safe(record.diagnosis)}</span></div><div class="field full"><b>Treatment Given</b><span class="write">${safe(record.treatment)}</span></div><div class="field full"><b>Type of Meal Ordered</b><span class="write">${safe(record.mealType)}</span></div><div class="field full"><b>Date of treatment</b><span class="write">${safe(displayDate(record.treatmentDate))}</span></div>${period}<div class="signatures meal-signature"><div><b>Name of physician</b><span class="signature-line">${safe(record.physicianName)}</span></div><div><b>Signature</b><span class="signature-line"></span></div></div></section></main>`;

    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} - ${safe(record.patientName)}</title><style>
      *{box-sizing:border-box}body{margin:0;background:#fff;color:#111;font:14px/1.55 Arial,sans-serif}@page{size:A4 portrait;margin:18mm 20mm}.paper{max-width:760px;margin:0 auto;padding:12px 8px}.header{display:flex;align-items:center;justify-content:center;gap:18px;padding:4px 0 18px;border-bottom:1px solid #555;text-align:center}.header img{width:66px;height:66px;object-fit:cover;border-radius:50%;border:none;display:block}.header h1{margin:0;font:600 19px/1.3 'Times New Roman',serif}.header h2{margin:17px 0 0;font:700 22px/1.2 'Times New Roman',serif}.date{display:flex;justify-content:flex-end;align-items:baseline;gap:10px;margin:18px 0 9px}.date span{display:inline-block;min-width:170px;min-height:24px;border-bottom:1px solid #333}.fields{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));column-gap:14px;row-gap:17px}.field{grid-column:span 4;display:flex;align-items:baseline;gap:8px;min-height:27px}.field.short{grid-column:span 1}.field.third{grid-column:span 3}.field b{white-space:nowrap;font:600 14px 'Times New Roman',serif}.field .write{flex:1;min-width:30px;min-height:23px;border-bottom:1px solid #444;overflow-wrap:anywhere;white-space:pre-wrap}.field.full{grid-column:1/-1}.signatures{grid-column:1/-1;display:grid;grid-template-columns:1fr 1.5fr 1fr;gap:22px 28px;margin-top:25px}.signatures>div{display:flex;flex-direction:column;gap:20px}.signatures b{font:600 14px 'Times New Roman',serif}.signature-line{min-height:24px;border-bottom:1px solid #444;font:14px 'Times New Roman',serif}.meal .fields{row-gap:22px}.meal-signature{grid-template-columns:1fr 1fr;margin-top:45px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.paper{max-width:none;padding:0}.sick .fields{row-gap:23px}.meal .fields{row-gap:28px}}@media(max-width:620px){body{font-size:12px}.header{gap:9px}.header img{width:48px;height:48px}.header h1{font-size:15px}.field{grid-column:span 4}.field.short{grid-column:span 1}.field.third{grid-column:span 3}.field b{font-size:12px}.fields{column-gap:7px}.signatures{gap:16px 12px}}
      </style></head><body>${body}<script>window.onload=function(){window.focus();window.print()};<\/script></body></html>`);
    printWindow.document.close();
  };

  const handleIssueAndPrint = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setActionError('');
    setPopupBlocked(false);
    const printWindow = window.open('', '_blank', 'width=900,height=760');
    if (printWindow) {
      printWindow.document.write('<!doctype html><html><body style="font:16px Arial;padding:32px">Saving the issued clinic form…</body></html>');
      printWindow.document.close();
    }

    const input: NewClinicDocument = {
      documentType: type,
      patientId,
      queueItemId: queueItemId || undefined,
      documentDate: fields.documentDate,
      treatmentDate: fields.treatmentDate,
      diagnosis: fields.diagnosis.trim(),
      treatment: fields.treatment.trim(),
      dateFrom: fields.dateFrom,
      dateTo: fields.dateTo,
      mealType: isSickLeave ? undefined : fields.mealType.trim(),
      physicianName: fields.physician.trim(),
      profession: isSickLeave ? fields.profession.trim() : undefined,
    };

    setSaving(true);
    try {
      const issued = await issueClinicDocument(input);
      setSavedDocuments(previous => [issued, ...previous.filter(document => document.id !== issued.id)]);
      window.dispatchEvent(new CustomEvent('bruclinic:action-success', { detail: t('Clinic form issued and saved.') }));
      if (printWindow) writePrintDocument(issued, printWindow);
      else setPopupBlocked(true);
    } catch (cause) {
      printWindow?.close();
      setActionError(cause instanceof Error ? cause.message : t('Could not save the clinic form.'));
    } finally {
      setSaving(false);
    }
  };

  const reprintDocument = (document: ClinicDocument) => {
    const printWindow = window.open('', '_blank', 'width=900,height=760');
    if (!printWindow) {
      setPopupBlocked(true);
      return;
    }
    setPopupBlocked(false);
    writePrintDocument(document, printWindow);
  };

  const periodLabel = isSickLeave ? 'Date given for rest' : 'No. of days allowed for Special Meal';
  const title = isSickLeave ? 'Sick Leave' : 'Special Meal Order';
  const localizedTitle = t(isSickLeave ? 'Sick Leave' : 'Special Meal');
  const matchingDocuments = savedDocuments.filter(document => document.documentType === type);

  return (
    <ModalPortal>
      <div className="opd-doc-overlay" onClick={() => !saving && onClose()}>
        <section className="opd-doc-modal" role="dialog" aria-modal="true" aria-labelledby="opd-doc-title" onClick={event => event.stopPropagation()}>
          <header className="opd-doc-toolbar">
            <div className="opd-doc-title"><span className="opd-doc-icon">{isSickLeave ? <FileText size={18} /> : <Utensils size={18} />}</span><div><h2 id="opd-doc-title">{localizedTitle}</h2><p>{t('Prepare a printable clinic form for')} {patientName}.</p></div></div>
            <button type="button" className="modal-close-btn" onClick={onClose} disabled={saving} aria-label="Close"><X size={18} /></button>
          </header>
          <div className="opd-doc-content">
            <form className="opd-doc-fields" onSubmit={handleIssueAndPrint}>
              <div className="opd-doc-patient"><b>{patientName}</b><span>{[patientAge !== undefined ? `${patientAge} ${t('years')}` : '', patientGender ? t(patientGender) : '', patientCode ? `MRN ${patientCode}` : ''].filter(Boolean).join(' · ')}</span></div>
              {actionError && <div className="alert alert-danger py-2 px-3" role="alert">{actionError}</div>}
              {popupBlocked && <div className="alert alert-info py-2 px-3" role="status">{t('The form was saved. Allow pop-ups and choose Reprint to print it.')}</div>}
              <label>{t('Document date')}<input type="date" required max={localDateInputValue()} value={fields.documentDate} onChange={event => setField('documentDate', event.target.value)} /></label>
              <label>{t('Date of treatment')}<input type="date" required value={fields.treatmentDate} onChange={event => setField('treatmentDate', event.target.value)} /></label>
              <label>{t('Diagnosis')}<textarea rows={2} required maxLength={1000} value={fields.diagnosis} onChange={event => setField('diagnosis', event.target.value)} /></label>
              <label>{t('Treatment given')}<textarea rows={3} required maxLength={5000} value={fields.treatment} onChange={event => setField('treatment', event.target.value)} /></label>
              {!isSickLeave && <label>{t('Type of meal ordered')}<input required maxLength={300} value={fields.mealType} onChange={event => setField('mealType', event.target.value)} placeholder={t('e.g. low-salt diet')} /></label>}
              <div className="opd-doc-date-range"><label>{t(isSickLeave ? 'Rest from' : 'Special meal from')}<input type="date" required max={fields.dateTo || undefined} value={fields.dateFrom} onChange={event => setField('dateFrom', event.target.value)} /></label><label>{t('To')}<input type="date" required min={fields.dateFrom || undefined} value={fields.dateTo} onChange={event => setField('dateTo', event.target.value)} /></label></div>
              <label>{t('Name of physician')}<input required maxLength={180} value={fields.physician} onChange={event => setField('physician', event.target.value)} /></label>
              {isSickLeave && <label>{t('Profession')}<input maxLength={120} value={fields.profession} onChange={event => setField('profession', event.target.value)} /></label>}
              <button type="submit" className="btn btn-primary" disabled={saving}><Printer size={16} /> {saving ? t('Issuing…') : t('Save & Print PDF')}</button>

              <section className="opd-doc-history" aria-labelledby="opd-doc-history-title">
                <h3 id="opd-doc-history-title"><History size={15} /> {t('Previously issued forms')}</h3>
                {documentsLoading ? <p>{t('Loading…')}</p> : matchingDocuments.length === 0 ? <p>{t('No earlier forms of this type.')}</p> : matchingDocuments.map(document => (
                  <article key={document.id} className="opd-doc-history-item">
                    <div><b>{displayDate(document.documentDate)}</b><span>{document.createdByName} · {document.id}</span></div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => reprintDocument(document)}><Printer size={13} /> {t('Reprint')}</button>
                  </article>
                ))}
              </section>
            </form>

            <article className={`opd-doc-preview ${isSickLeave ? 'is-sick-leave' : 'is-meal-order'}`}>
              <header><img src="/bu-logo.png" alt="Borana University logo" /><div><h3>Borana University Student Services Clinic</h3><h2>{title}</h2></div></header>
              <div className="opd-doc-preview-date"><b>Date</b><span>{displayDate(fields.documentDate)}</span></div>
              <div className="opd-doc-paper-fields">
                <PaperField label={isSickLeave ? 'Name of Student / Patient' : 'Name of patient'} value={patientName} />
                <PaperField label="Age" value={patientAge === undefined ? '' : `${patientAge} years`} />
                <PaperField label="Sex" value={patientGender || ''} />
                {isSickLeave && <PaperField label="MRN" value={patientCode || ''} />}
                <PaperField label={isSickLeave ? 'Date of Treatment' : 'Date of treatment'} value={displayDate(fields.treatmentDate)} />
                <PaperField label="Diagnosis" value={fields.diagnosis} wide />
                <PaperField label="Treatment Given" value={fields.treatment} wide />
                {!isSickLeave && <PaperField label="Type of Meal Ordered" value={fields.mealType} wide />}
                <PaperField label={periodLabel} value={`${displayDate(fields.dateFrom)}${fields.dateTo ? `  to  ${displayDate(fields.dateTo)}` : ''}`} wide />
              </div>
              <footer className="opd-doc-signatures">
                <div><b>{isSickLeave ? 'Name of Physician' : 'Name of physician'}</b><span>{fields.physician}</span></div>
                {isSickLeave && <div><b>Profession</b><span>{fields.profession}</span></div>}
                {isSickLeave && <div><b>Date</b><span>{displayDate(fields.documentDate)}</span></div>}
                <div><b>Signature</b><span /></div>
              </footer>
            </article>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}

function PaperField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`opd-doc-paper-field${wide ? ' wide' : ''}`}><b>{label}</b><span>{value}</span></div>;
}
