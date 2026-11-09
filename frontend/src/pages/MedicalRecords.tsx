import React, { useState } from 'react';
import { useClinic } from '../context/ClinicContext';
import { useAuth } from '../context/AuthContext';
import InfoBox from '../components/AdminLTE/InfoBox';
import type { MedicalRecord, Patient, LabOrder, PharmacyOrder } from '../types';
import { findPatient, patientCode, patientFullName, patientInitials, patientOptionLabel, patientTypeClass } from '../utils/patient';
import { firstError, validateDate, validateRequired } from '../utils/validation';
import {
  Activity, Calendar, CheckCircle2, Clock, Eye, FilePlus, FileText,
  FlaskConical, Pill, Plus, Search, Stethoscope, X, Building2, HeartPulse,
  PackageCheck, ClipboardCheck, CircleDashed, Ban, Printer
} from 'lucide-react';
import './Patients.css';
import './MedicalRecords.css';
import DiagnosisField from '../components/DiagnosisField';
import ModalPortal from '../components/ModalPortal';
import ReferralPrintModal from '../components/ReferralPrintModal';

function getInitials(name: string) {
  const parts = name.replace(/^Dr\.\s*/i, '').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0] ? parts[0].slice(0, 2) : 'PT').toUpperCase();
}

function calculateAge(dateOfBirth?: string): number | undefined {
  if (!dateOfBirth) return undefined;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : undefined;
}

type RecordFilter = 'all' | 'rx' | 'lab' | 'followup';

interface RecordLinks {
  labOrders: LabOrder[];
  pharmacyOrders: PharmacyOrder[];
}

function orderMatchesRecord(
  record: MedicalRecord,
  order: { patientId: string; queueItemId?: string; orderedAt?: string; prescribedAt?: string; createdAt?: string },
) {
  const recordQueueId = record.queueItemId;
  if (order.queueItemId && recordQueueId) return order.queueItemId === recordQueueId;
  if (order.queueItemId && !recordQueueId) return false;
  return order.patientId === record.patientId
    && (order.orderedAt || order.prescribedAt || order.createdAt || '').slice(0, 10) === record.visitDate;
}

function buildRecordLinks(records: MedicalRecord[], labOrders: LabOrder[], pharmacyOrders: PharmacyOrder[]) {
  const map = new Map<string, RecordLinks>();
  for (const record of records) {
    map.set(record.id, {
      labOrders: labOrders.filter(order => orderMatchesRecord(record, order)),
      pharmacyOrders: pharmacyOrders.filter(order => orderMatchesRecord(record, order)),
    });
  }
  return map;
}

function labTestCount(record: MedicalRecord, links?: RecordLinks) {
  const recorded = record.labTests?.length || 0;
  const extraOrders = (links?.labOrders || []).filter(
    order => !(record.labTests || []).some(test => test.testName.toLowerCase() === order.testName.toLowerCase()),
  ).length;
  return recorded + extraOrders;
}

function pharmacyStatusTone(status?: PharmacyOrder['status']) {
  if (status === 'Dispensed') return 'green';
  if (status === 'Pending') return 'amber';
  if (status === 'Cancelled') return 'red';
  return 'blue';
}

export default function MedicalRecords() {
  const { records, patients, doctors, labOrders, pharmacyOrders, addRecord } = useClinic();
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<RecordFilter>('all');
  const [modal, setModal] = useState<{ mode: 'view' | 'add' | null; record?: MedicalRecord }>({ mode: null });
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    patientId: '', doctorId: '', visitDate: new Date().toISOString().split('T')[0],
    diagnosis: '', symptoms: '', notes: '', followUpDate: '', medications: '',
  });

  const canAddRecord = role === 'admin' || role === 'opd' || role === 'emergency';
  const recordLinks = buildRecordLinks(records, labOrders, pharmacyOrders);
  const prescriptionRecords = records.filter(record => (record.prescription?.length || 0) > 0 || (recordLinks.get(record.id)?.pharmacyOrders.length || 0) > 0).length;
  const labRecords = records.filter(record => labTestCount(record, recordLinks.get(record.id)) > 0).length;
  const followUpRecords = records.filter(record => Boolean(record.followUpDate)).length;
  const totalPrescriptions = records.reduce((total, record) => total + (record.prescription?.length || 0), 0);
  const totalLabTests = records.reduce((total, record) => total + labTestCount(record, recordLinks.get(record.id)), 0);

  const filtered = records.filter(record => {
    const query = search.toLowerCase().trim();
    const patient = findPatient(patients, record.patientId);
    const searchable = `${record.patientName} ${patientFullName(patient, '')} ${patientCode(patient, '')} ${record.doctorName} ${record.diagnosis} ${record.id} ${record.symptoms.join(' ')}`.toLowerCase();
    if (query && !searchable.includes(query)) return false;
    if (activeFilter === 'rx') return (record.prescription?.length || 0) > 0 || (recordLinks.get(record.id)?.pharmacyOrders.length || 0) > 0;
    if (activeFilter === 'lab') return labTestCount(record, recordLinks.get(record.id)) > 0;
    if (activeFilter === 'followup') return Boolean(record.followUpDate);
    return true;
  });

  const openAdd = () => {
    setForm({
      patientId: patients[0]?.id || '',
      doctorId: doctors[0]?.id || '',
      visitDate: new Date().toISOString().split('T')[0],
      diagnosis: '', symptoms: '', notes: '', followUpDate: '', medications: '',
    });
    setFormError(null);
    setFieldErrors({});
    setModal({ mode: 'add' });
  };

  const updateFormField = (field: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
    setFieldErrors(current => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = validateRequired(form, {
      patientId: 'Patient', doctorId: 'Doctor', visitDate: 'Visit date', diagnosis: 'Diagnosis',
    });
    const visitDateError = validateDate(form.visitDate, 'Visit date', { allowFuture: false });
    const followUpDateError = form.followUpDate ? validateDate(form.followUpDate, 'Follow-up date', { allowFuture: false }) : undefined;
    if (visitDateError) errors.visitDate = visitDateError;
    if (followUpDateError) errors.followUpDate = followUpDateError;
    if (form.followUpDate && form.visitDate && form.followUpDate < form.visitDate) {
      errors.followUpDate = 'Follow-up date must be on or after the visit date.';
    }
    setFieldErrors(errors);
    const error = firstError(...Object.values(errors));
    if (error) {
      setFormError(error);
      return;
    }
    const patient = patients.find(item => item.id === form.patientId);
    const doctor = doctors.find(item => item.id === form.doctorId);
    if (!patient || !doctor) {
      setFieldErrors(current => ({
        ...current,
        ...(!patient ? { patientId: 'Select a valid patient.' } : {}),
        ...(!doctor ? { doctorId: 'Select a valid doctor.' } : {}),
      }));
      return;
    }

    try {
      await addRecord({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        doctorId: doctor.id,
        doctorName: `${doctor.firstName} ${doctor.lastName}`,
        visitDate: form.visitDate,
        diagnosis: form.diagnosis,
        symptoms: form.symptoms.split(',').map(item => item.trim()).filter(Boolean),
        prescription: form.medications.split('\n').filter(Boolean).map(medication => ({
          medication, dosage: 'As directed', frequency: 'Standard regimen', duration: '7 days',
        })),
        notes: form.notes,
        followUpDate: form.followUpDate || undefined,
      });
      setFormError(null);
      setFieldErrors({});
      setModal({ mode: null });
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not save the record.');
    }
  };

  const closeModal = () => { setFormError(null); setFieldErrors({}); setModal({ mode: null }); };

  return (
    <div className="medical-records-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FileText size={26} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
            Medical Records
          </h1>
          <p className="page-subtitle">{records.length} clinical encounter records</p>
        </div>
        {canAddRecord && (
          <button type="button" className="btn btn-primary" id="add-record-btn" onClick={openAdd}>
            <Plus size={16} /> New Record
          </button>
        )}
      </div>

      <div className="records-stats">
        <RecordStat tone="info" icon={<FileText size={21} />} value={records.length} label="Records" />
        <RecordStat tone="primary" icon={<Pill size={21} />} value={totalPrescriptions} label="Prescriptions" />
        <RecordStat tone="success" icon={<FlaskConical size={21} />} value={totalLabTests} label="Lab tests" />
        <RecordStat tone="warning" icon={<Clock size={21} />} value={followUpRecords} label="Follow-ups" />
      </div>

      {/* Filters Bar matching Patients.tsx */}
      <div className="filters-bar">
        <div className="search-bar" style={{ flex: '1 1 260px', maxWidth: 420 }}>
          <Search size={16} className="icon" />
          <input
            id="record-search"
            placeholder="Search patient, doctor, diagnosis or ID…"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          {search && (
            <button className="records-clear-search" type="button" onClick={() => setSearch('')} aria-label="Clear search">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="pill-tabs">
          {[
            { id: 'all', label: `All (${records.length})` },
            { id: 'rx', label: `Prescriptions (${prescriptionRecords})` },
            { id: 'lab', label: `Lab Tests (${labRecords})` },
            { id: 'followup', label: `Follow-ups (${followUpRecords})` },
          ].map(tab => (
            <button
              type="button"
              key={tab.id}
              className={`pill-tab ${activeFilter === tab.id ? 'active' : ''}`}
              onClick={() => setActiveFilter(tab.id as RecordFilter)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table matching Patients.tsx */}
      <div className="table-wrapper records-table-wrapper">
        <table className="records-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Diagnosis</th>
              <th>Doctor</th>
              <th>Visit Date</th>
              <th>Clinical Items</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--clr-text-muted)' }}>
                  <Search size={22} style={{ display: 'block', margin: '0 auto 0.5rem', opacity: 0.5 }} />
                  <strong>No medical records found</strong>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Try adjusting your search query or filter.</div>
                </td>
              </tr>
            ) : filtered.map(record => (
              <RecordRow
                key={record.id}
                record={record}
                patient={findPatient(patients, record.patientId)}
                links={recordLinks.get(record.id)}
                onView={() => setModal({ mode: 'view', record })}
              />
            ))}
          </tbody>
        </table>
      </div>

      {modal.mode && (
        <ModalPortal>
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-lg records-modal" onClick={event => event.stopPropagation()}>
            <div className="modal-header records-modal-header">
              <h2 className="modal-title" style={{ fontSize: '0.96rem' }}>
                {modal.mode === 'add' ? <FilePlus size={16} /> : <FileText size={16} />}
                {modal.mode === 'add' ? 'New Record' : 'Record Details'}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeModal}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            {modal.mode === 'view' && modal.record ? (
              <RecordView record={modal.record} />
            ) : (
              <form onSubmit={handleSubmit}>
                {formError && <div className="alert alert-danger py-2 px-3" role="alert">{formError}</div>}
                <div className="records-form-grid">
                  <div className="form-group">
                    <label className="form-label">Patient *</label>
                    <select required aria-invalid={Boolean(fieldErrors.patientId)} aria-describedby={fieldErrors.patientId ? 'record-patient-error' : undefined} value={form.patientId} onChange={event => updateFormField('patientId', event.target.value)}>
                      <option value="">Select patient</option>
                      {patients.map(patient => <option key={patient.id} value={patient.id}>{patientOptionLabel(patient)}</option>)}
                    </select>
                    {fieldErrors.patientId && <small className="records-field-error" id="record-patient-error">{fieldErrors.patientId}</small>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Doctor *</label>
                    <select required aria-invalid={Boolean(fieldErrors.doctorId)} aria-describedby={fieldErrors.doctorId ? 'record-doctor-error' : undefined} value={form.doctorId} onChange={event => updateFormField('doctorId', event.target.value)}>
                      <option value="">Select doctor</option>
                      {doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.firstName} {doctor.lastName}</option>)}
                    </select>
                    {fieldErrors.doctorId && <small className="records-field-error" id="record-doctor-error">{fieldErrors.doctorId}</small>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Visit date *</label>
                    <input required type="date" aria-invalid={Boolean(fieldErrors.visitDate)} aria-describedby={fieldErrors.visitDate ? 'record-visit-date-error' : undefined} value={form.visitDate} onChange={event => updateFormField('visitDate', event.target.value)} />
                    {fieldErrors.visitDate && <small className="records-field-error" id="record-visit-date-error">{fieldErrors.visitDate}</small>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Follow-up date</label>
                    <input type="date" aria-invalid={Boolean(fieldErrors.followUpDate)} aria-describedby={fieldErrors.followUpDate ? 'record-followup-date-error' : undefined} value={form.followUpDate} onChange={event => updateFormField('followUpDate', event.target.value)} />
                    {fieldErrors.followUpDate && <small className="records-field-error" id="record-followup-date-error">{fieldErrors.followUpDate}</small>}
                  </div>
                  <div className="records-form-span-2">
                    <DiagnosisField
                      label="Diagnosis"
                      required
                      value={form.diagnosis}
                      onChange={diagnosis => updateFormField('diagnosis', diagnosis)}
                      diagnoses={records.map(record => record.diagnosis)}
                      placeholder="Primary diagnosis"
                    />
                    {fieldErrors.diagnosis && <small className="records-field-error" role="alert">{fieldErrors.diagnosis}</small>}
                  </div>
                  <div className="form-group records-form-span-2">
                    <label className="form-label">Symptoms <span>(comma separated)</span></label>
                    <input value={form.symptoms} onChange={event => setForm(current => ({ ...current, symptoms: event.target.value }))} placeholder="Fever, cough, fatigue" />
                  </div>
                  <div className="form-group records-form-span-2">
                    <label className="form-label">Medications <span>(one per line)</span></label>
                    <textarea rows={2} value={form.medications} onChange={event => setForm(current => ({ ...current, medications: event.target.value }))} placeholder="Medication and dosage" />
                  </div>
                  <div className="form-group records-form-span-2">
                    <label className="form-label">Notes</label>
                    <textarea rows={2} value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Clinical notes" />
                  </div>
                </div>
                <div className="modal-footer records-modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn btn-primary"><Plus size={16} /> Save record</button>
                </div>
              </form>
            )}
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}

function RecordStat({ tone, icon, value, label }: {
  tone: 'info' | 'primary' | 'success' | 'warning';
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <InfoBox tone={tone} icon={icon} value={value} label={label} />
  );
}

function RecordRow({ record, patient, links, onView }: {
  record: MedicalRecord;
  patient?: Patient;
  links?: RecordLinks;
  onView: () => void;
}) {
  const initials = patient ? patientInitials(patient) : getInitials(record.patientName);
  const labCount = labTestCount(record, links);
  const pharmacyOrder = links?.pharmacyOrders.at(-1);
  const medicationCount = (record.prescription?.length || 0) || pharmacyOrder?.medicines.length || 0;
  const hasItems = medicationCount > 0 || labCount > 0 || Boolean(pharmacyOrder);

  return (
    <tr>
      <td>
        <div className="patient-cell">
          <div className="avatar" style={{ background: 'var(--clr-primary-500)' }}>
            {initials}
          </div>
          <div>
            <div className="patient-name">{patientFullName(patient, record.patientName)}</div>
            <div className="patient-sub" style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <code className="id-code">{patientCode(patient, record.patientId)}</code>
              {patient && <span className={`badge ${patientTypeClass(patient.patientType)}`}>{patient.patientType}</span>}
            </div>
          </div>
        </div>
      </td>
      <td>
        <div style={{ fontWeight: 600, color: 'var(--clr-text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="record-diagnosis-icon"><Activity size={13} /></span>
          <span>{record.diagnosis}</span>
        </div>
        {record.symptoms.length > 0 && (
          <div style={{ fontSize: '0.74rem', color: 'var(--clr-text-muted)', marginTop: '0.15rem' }}>
            {record.symptoms.slice(0, 2).join(', ')}{record.symptoms.length > 2 ? '…' : ''}
          </div>
        )}
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.84rem' }}>
          <span className="record-doctor-icon"><Stethoscope size={13} /></span>
          <span>{record.doctorName}</span>
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.84rem' }}>
          <Calendar size={13} style={{ color: 'var(--clr-text-muted)' }} />
          <span>{record.visitDate}</span>
        </div>
        {record.followUpDate && (
          <span className="badge badge-amber" style={{ fontSize: '0.68rem', marginTop: '0.2rem' }}>
            <Clock size={10} /> {record.followUpDate}
          </span>
        )}
      </td>
      <td>
        <div className="records-items">
          {medicationCount > 0 && (
            <span className="record-item-chip record-item-chip-green" title={`${medicationCount} prescribed medication(s)`}>
              <span className="record-item-chip-icon"><Pill size={12} /></span>
              {medicationCount} Rx
            </span>
          )}
          {labCount > 0 && (
            <span className="record-item-chip record-item-chip-blue" title={`${labCount} laboratory investigation(s)`}>
              <span className="record-item-chip-icon"><FlaskConical size={12} /></span>
              {labCount} Lab
            </span>
          )}
          {pharmacyOrder && (
            <span className={`record-item-chip record-item-chip-${pharmacyStatusTone(pharmacyOrder.status)}`} title={`Pharmacy order ${pharmacyOrder.id} · ${pharmacyOrder.status}`}>
              <span className="record-item-chip-icon"><PackageCheck size={12} /></span>
              Pharmacy: {pharmacyOrder.status}
            </span>
          )}
          {!hasItems && <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>—</span>}
        </div>
      </td>
      <td style={{ textAlign: 'right' }}>
        <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon records-view-btn"
            onClick={onView}
            title="View record"
          >
            <Eye size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function StepStatus({ label, tone }: { label: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'gray' }) {
  return <span className={`record-step-status record-step-status-${tone}`}>{label}</span>;
}

function RecordView({ record }: { record: MedicalRecord }) {
  const { patients, queue, labOrders, pharmacyOrders } = useClinic();
  const [printReferral, setPrintReferral] = useState<{
    patientName: string;
    patientCode?: string;
    patientAge?: number;
    patientGender?: string;
    patientType?: string;
    patientDepartment?: string;
    doctorName: string;
    destination: string;
    reason: string;
    diagnosis?: string;
    vitals?: any;
    symptoms?: string[];
    notes?: string;
    date?: string;
  } | null>(null);
  const patient = findPatient(patients, record.patientId);
  const initials = patient ? patientInitials(patient) : getInitials(record.patientName);
  const linkedQueueItem = (record.queueItemId ? queue.find(q => q.id === record.queueItemId) : null) || queue.find(q => q.patientId === record.patientId);
  const vitals = record.vitals || linkedQueueItem?.vitals;
  const externalRef = record.externalReferral || (linkedQueueItem?.externalReferral as { destination: string; reason: string; referredBy?: string; referredAt?: string } | undefined);
  const linkedLabOrders = labOrders.filter(order => orderMatchesRecord(record, order));
  const linkedPharmacyOrders = pharmacyOrders.filter(order => orderMatchesRecord(record, order));

  const labRows = (() => {
    const map = new Map<string, { key: string; testName: string; result?: string; unit?: string; referenceRange?: string; status: string; priority?: string; notes?: string }>();
    for (const test of record.labTests || []) {
      map.set(test.testName.toLowerCase(), { key: `record-${test.testName}`, ...test });
    }
    for (const order of linkedLabOrders) {
      map.set(order.testName.toLowerCase(), {
        key: order.id,
        testName: order.testName,
        result: order.result,
        unit: order.unit,
        referenceRange: order.referenceRange,
        status: order.status,
        priority: order.priority,
        notes: order.notes,
      });
    }
    return Array.from(map.values());
  })();

  const pharmacyRows = record.prescription?.length
    ? record.prescription.map(item => ({
        name: item.medication,
        instructions: item.instructions,
        isExternal: item.isExternal,
        quantity: undefined as number | undefined,
      }))
    : linkedPharmacyOrders.flatMap(order => order.medicines.map(medicine => ({
        name: medicine.name,
        instructions: medicine.instructions,
        isExternal: medicine.isExternal,
        quantity: medicine.quantity,
      })));

  const allLabsCompleted = labRows.length === 0 || labRows.every(row => row.status === 'Completed');
  const allPharmacyDispensed = linkedPharmacyOrders.length === 0 || linkedPharmacyOrders.every(order => order.status === 'Dispensed');
  const closed = linkedQueueItem?.stage === 'Completed';
  const completedSteps = 2
    + (vitals ? 1 : 0)
    + (record.diagnosis ? 1 : 0)
    + (allLabsCompleted ? 1 : 0)
    + (allPharmacyDispensed ? 1 : 0);
  const journeyPercent = Math.round((completedSteps / 6) * 100);

  return (
    <div className="record-detail">
      <header className="record-detail-summary">
        <div className="record-detail-avatar">{initials}</div>
        <div className="record-detail-patient">
          <h3>{patientFullName(patient, record.patientName)}</h3>
          <div className="record-detail-identifiers">
            <code className="id-code">{patientCode(patient, record.patientId)}</code>
            {patient?.patientType && (
              <span className={`badge ${patient.patientType === 'Student' ? 'badge-blue' : 'badge-gray'}`}>
                {patient.patientType}
              </span>
            )}
            {patient?.bloodGroup && <span className="badge badge-red">Blood: {patient.bloodGroup}</span>}
            {patient?.department && <span className="badge badge-secondary">{patient.department}</span>}
            {closed && <span className="badge badge-green"><CheckCircle2 size={11} /> Visit closed</span>}
          </div>
        </div>
        <div className="record-detail-date">
          <span><Calendar size={12} /> Encounter Date</span>
          <strong>{record.visitDate}</strong>
        </div>
      </header>

      {/* Process Journey Through Clinic Departments */}
      <section className="record-journey">
        <div className="record-journey-head">
          <div>
            <h4><Activity size={16} /> Encounter Workflow &amp; Department Progress</h4>
            <p>Where this visit has moved and what each department completed.</p>
          </div>
          <div className="record-journey-progress-copy">
            <strong>{journeyPercent}%</strong>
            <span>{completedSteps} of 6 steps complete</span>
          </div>
        </div>
        <div className="record-journey-progress" aria-hidden="true">
          <span style={{ width: `${journeyPercent}%` }} />
        </div>

        <div className="record-journey-grid">
          {/* 1. Reception Card Class */}
          <div className="record-step-card">
            <div className="record-step-head">
              <span className="record-step-icon" style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7' }}><ClipboardCheck size={15} /></span>
              <strong>Reception &amp; Card Room</strong>
              <StepStatus label={linkedQueueItem ? 'Completed' : 'Filed'} tone={linkedQueueItem ? 'green' : 'gray'} />
            </div>
            <div className="record-step-body">
              Token: <strong>{linkedQueueItem?.tokenNumber || 'Standard visit'}</strong> · {linkedQueueItem?.cardStatus || 'Active card'}
            </div>
            <div className="record-step-note">
              Chief complaint: {linkedQueueItem?.chiefComplaint || (record.symptoms.length ? record.symptoms[0] : 'Consultation')}
            </div>
          </div>

          {/* 2. Nurse Triage Vitals */}
          <div className="record-step-card">
            <div className="record-step-head">
              <span className="record-step-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}><HeartPulse size={15} /></span>
              <strong>Nurse Triage &amp; Vitals</strong>
              <StepStatus label={vitals ? 'Completed' : 'Pending'} tone={vitals ? 'green' : 'amber'} />
            </div>
            {vitals ? (
              <div className="record-step-body record-vitals-grid">
                <span>BP: <strong>{vitals.bloodPressure || '—'}</strong></span>
                <span>Pulse: <strong>{vitals.heartRate ? `${vitals.heartRate} bpm` : '—'}</strong></span>
                <span>Temp: <strong>{vitals.temperature ? `${vitals.temperature}°C` : '—'}</strong></span>
                <span>SpO2: <strong>{vitals.spo2 ? `${vitals.spo2}%` : '—'}</strong></span>
              </div>
            ) : (
              <div className="record-step-note">No triage vitals were recorded for this encounter.</div>
            )}
          </div>

          {/* 3. OPD Consultation Class */}
          <div className="record-step-card">
            <div className="record-step-head">
              <span className="record-step-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}><Stethoscope size={15} /></span>
              <strong>OPD Consultation</strong>
              <StepStatus label={record.diagnosis ? 'Completed' : 'In progress'} tone={record.diagnosis ? 'green' : 'amber'} />
            </div>
            <div className="record-step-body">
              Doctor: <strong>Dr. {record.doctorName}</strong>
            </div>
            <div className="record-step-note">Dx: <strong>{record.diagnosis}</strong></div>
          </div>

          {/* 3b. EMR / Record Archive */}
          <div className="record-step-card">
            <div className="record-step-head">
              <span className="record-step-icon" style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9' }}><FileText size={15} /></span>
              <strong>EMR &amp; Record Archive</strong>
              <StepStatus label="Filed" tone="green" />
            </div>
            <div className="record-step-body">
              Record: <strong>{record.id}</strong>
            </div>
            <div className="record-step-note">
              Saved on {record.visitDate}{record.queueItemId ? ` · linked to visit ${record.queueItemId}` : ' · manual medical record'}
            </div>
          </div>

          {/* 4. Laboratory Class */}
          <div className="record-step-card">
            <div className="record-step-head">
              <span className="record-step-icon" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}><FlaskConical size={15} /></span>
              <strong>Diagnostic Laboratory</strong>
              <StepStatus
                label={labRows.length === 0 ? 'Not requested' : allLabsCompleted ? 'Completed' : 'In progress'}
                tone={labRows.length === 0 ? 'gray' : allLabsCompleted ? 'green' : 'blue'}
              />
            </div>
            <div className="record-step-body">
              {labRows.length > 0
                ? <span><strong>{labRows.length} investigation(s)</strong> requested</span>
                : <span>No laboratory investigations for this visit</span>}
            </div>
            {labRows.length > 0 && (
              <div className="record-step-note">
                {labRows.map(row => row.testName).slice(0, 3).join(', ')}{labRows.length > 3 ? ` +${labRows.length - 3} more` : ''}
              </div>
            )}
          </div>

          {/* 5. Pharmacy Dispensary Class */}
          <div className="record-step-card">
            <div className="record-step-head">
              <span className="record-step-icon" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4' }}><Pill size={15} /></span>
              <strong>Pharmacy Dispensary</strong>
              <StepStatus
                label={linkedPharmacyOrders.length === 0 ? (pharmacyRows.length > 0 ? 'Prescribed' : 'Not requested') : allPharmacyDispensed ? 'Dispensed' : 'Pending'}
                tone={linkedPharmacyOrders.length === 0 ? (pharmacyRows.length > 0 ? 'blue' : 'gray') : allPharmacyDispensed ? 'green' : 'amber'}
              />
            </div>
            <div className="record-step-body">
              {pharmacyRows.length > 0
                ? <span><strong>{pharmacyRows.length} medication(s)</strong> prescribed</span>
                : <span>No prescription medications</span>}
            </div>
            {linkedPharmacyOrders.length > 0 && (
              <div className="record-step-note">
                {linkedPharmacyOrders.map(order => `${order.status}${order.dispensedBy ? ` · ${order.dispensedBy}` : ''}`).join(' | ')}
              </div>
            )}
          </div>

          {/* 6. External Referral (if applicable) */}
          {externalRef && (
            <div className="record-step-card record-step-referral">
              <div className="record-step-head">
                <span className="record-step-icon" style={{ background: 'rgba(245, 158, 11, 0.14)', color: '#f59e0b' }}><Building2 size={15} /></span>
                <strong>External Referral</strong>
                <StepStatus label="Referred" tone="amber" />
              </div>
              <div className="record-step-body">To: <strong>{externalRef.destination}</strong></div>
              <div className="record-step-note">Reason: {externalRef.reason}</div>
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-warning btn-sm"
                  style={{ fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: 5 }}
                  onClick={() => setPrintReferral({
                    patientName: patientFullName(patient, record.patientName),
                    patientCode: patientCode(patient, record.patientId),
                    patientAge: calculateAge(patient?.dateOfBirth),
                    patientGender: patient?.gender,
                    patientType: patient?.patientType,
                    patientDepartment: patient?.department,
                    doctorName: record.doctorName,
                    destination: externalRef.destination,
                    reason: externalRef.reason,
                    diagnosis: record.diagnosis,
                    vitals: vitals,
                    symptoms: record.symptoms,
                    notes: record.notes,
                    date: record.visitDate,
                  })}
                >
                  <Printer size={13} /> Print Official Referral Document
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Clinical Diagnosis & Observed Symptoms */}
      <section className="record-detail-section">
        <h4 className="record-section-title"><Activity size={15} /> Primary Diagnosis &amp; Observed Symptoms</h4>
        <p className="record-diagnosis-value">{record.diagnosis}</p>
        {record.symptoms.length > 0 && (
          <div className="record-tags">
            {record.symptoms.map(symptom => <span className="badge badge-gray" key={symptom}>{symptom}</span>)}
          </div>
        )}
      </section>

      {/* Prescription Medications */}
      {pharmacyRows.length > 0 && (
        <section className="record-detail-section">
          <h4 className="record-section-title">
            <Pill size={15} /> Prescriptions <span className="badge badge-green">{pharmacyRows.length}</span>
          </h4>
          <div className="record-list">
            {pharmacyRows.map((item, index) => (
              <div className="record-list-row" key={`${item.name}-${index}`}>
                <div>
                  <strong>{item.name}</strong>
                  {item.isExternal && <span className="badge badge-yellow" style={{ marginLeft: 6, fontSize: '0.68rem' }}>Buy Outside</span>}
                  <div className="record-list-note">
                    {[item.instructions, item.quantity ? `Qty: ${item.quantity}` : ''].filter(Boolean).join(' · ') || 'Dose and quantity as directed by the pharmacist'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lab Investigations */}
      {labRows.length > 0 && (
        <section className="record-detail-section">
          <h4 className="record-section-title">
            <FlaskConical size={15} /> Laboratory Investigations <span className="badge badge-blue">{labRows.length}</span>
          </h4>
          <div className="record-lab-table-wrap">
            <table className="record-lab-table">
              <thead><tr><th>Investigation</th><th>Result Findings</th><th>Reference Range</th><th>Status</th></tr></thead>
              <tbody>
                {labRows.map(row => (
                  <tr key={row.key}>
                    <td>
                      <strong>{row.testName}</strong>
                      {row.priority && <div className="record-list-note">{row.priority} priority</div>}
                    </td>
                    <td className="record-lab-result">{row.result || 'Pending'}{row.unit ? ` ${row.unit}` : ''}</td>
                    <td className="record-lab-muted">{row.referenceRange || 'Standard'}</td>
                    <td>
                      <span className={`badge ${row.status === 'Completed' ? 'badge-green' : row.status === 'Requested' ? 'badge-amber' : 'badge-blue'}`}>
                        {row.status === 'Completed' ? <CheckCircle2 size={11} /> : <CircleDashed size={11} />} {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Clinical Consultation Notes */}
      {record.notes && (
        <section className="record-detail-section">
          <h4 className="record-section-title"><FileText size={15} /> Examination Findings &amp; Clinical Notes</h4>
          <p className="record-notes">{record.notes}</p>
        </section>
      )}

      {!record.notes && !record.diagnosis && !pharmacyRows.length && !labRows.length && (
        <div className="record-empty-note"><Ban size={16} /> No clinical detail was recorded for this encounter.</div>
      )}

      {printReferral && (
        <ReferralPrintModal
          isOpen={Boolean(printReferral)}
          onClose={() => setPrintReferral(null)}
          patientName={printReferral.patientName}
          patientCode={printReferral.patientCode}
          patientAge={printReferral.patientAge}
          patientGender={printReferral.patientGender}
          patientType={printReferral.patientType}
          patientDepartment={printReferral.patientDepartment}
          doctorName={printReferral.doctorName}
          destination={printReferral.destination}
          reason={printReferral.reason}
          diagnosis={printReferral.diagnosis}
          vitals={printReferral.vitals}
          symptoms={printReferral.symptoms}
          notes={printReferral.notes}
          date={printReferral.date}
        />
      )}
    </div>
  );
}
