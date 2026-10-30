import React, { useState } from 'react';
import { useClinic } from '../context/ClinicContext';
import InfoBox from '../components/AdminLTE/InfoBox';
import type { MedicalRecord, Patient } from '../types';
import { findPatient, patientCode, patientFullName, patientInitials, patientOptionLabel, patientTypeClass } from '../utils/patient';
import { firstError, validateDate, validateRequired } from '../utils/validation';
import {
  Activity, Calendar, CheckCircle2, Clock, Eye, FilePlus, FileText,
  FlaskConical, Pill, Plus, Search, Stethoscope, X,
} from 'lucide-react';
import './Patients.css';
import './MedicalRecords.css';

function getInitials(name: string) {
  const parts = name.replace(/^Dr\.\s*/i, '').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0] ? parts[0].slice(0, 2) : 'PT').toUpperCase();
}

type RecordFilter = 'all' | 'rx' | 'lab' | 'followup';

export default function MedicalRecords() {
  const { records, patients, doctors, addRecord } = useClinic();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<RecordFilter>('all');
  const [modal, setModal] = useState<{ mode: 'view' | 'add' | null; record?: MedicalRecord }>({ mode: null });
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    patientId: '', doctorId: '', visitDate: new Date().toISOString().split('T')[0],
    diagnosis: '', symptoms: '', notes: '', followUpDate: '', medications: '',
  });

  const prescriptionRecords = records.filter(record => (record.prescription?.length || 0) > 0).length;
  const labRecords = records.filter(record => (record.labTests?.length || 0) > 0).length;
  const followUpRecords = records.filter(record => Boolean(record.followUpDate)).length;
  const totalPrescriptions = records.reduce((total, record) => total + (record.prescription?.length || 0), 0);
  const totalLabTests = records.reduce((total, record) => total + (record.labTests?.length || 0), 0);

  const filtered = records.filter(record => {
    const query = search.toLowerCase().trim();
    const patient = findPatient(patients, record.patientId);
    const searchable = `${record.patientName} ${patientFullName(patient, '')} ${patientCode(patient, '')} ${record.doctorName} ${record.diagnosis} ${record.id} ${record.symptoms.join(' ')}`.toLowerCase();
    if (query && !searchable.includes(query)) return false;
    if (activeFilter === 'rx') return (record.prescription?.length || 0) > 0;
    if (activeFilter === 'lab') return (record.labTests?.length || 0) > 0;
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
    setModal({ mode: 'add' });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const requiredErrors = validateRequired(form, {
      patientId: 'Patient', doctorId: 'Doctor', visitDate: 'Visit date', diagnosis: 'Diagnosis',
    });
    const error = firstError(...Object.values(requiredErrors), validateDate(form.visitDate, 'Visit date', { allowFuture: false }), form.followUpDate ? validateDate(form.followUpDate, 'Follow-up date') : undefined);
    if (error) {
      setFormError(error);
      return;
    }
    const patient = patients.find(item => item.id === form.patientId);
    const doctor = doctors.find(item => item.id === form.doctorId);
    if (!patient || !doctor) {
      setFormError('Select a valid patient and doctor.');
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
      setModal({ mode: null });
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not save the record.');
    }
  };

  const closeModal = () => { setFormError(null); setModal({ mode: null }); };

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
        <button type="button" className="btn btn-primary" id="add-record-btn" onClick={openAdd}>
          <Plus size={16} /> New Record
        </button>
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
      <div className="table-wrapper">
        <table>
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
                onView={() => setModal({ mode: 'view', record })}
              />
            ))}
          </tbody>
        </table>
      </div>

      {modal.mode && (
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
                    <select required value={form.patientId} onChange={event => setForm(current => ({ ...current, patientId: event.target.value }))}>
                      <option value="">Select patient</option>
                      {patients.map(patient => <option key={patient.id} value={patient.id}>{patientOptionLabel(patient)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Doctor *</label>
                    <select required value={form.doctorId} onChange={event => setForm(current => ({ ...current, doctorId: event.target.value }))}>
                      <option value="">Select doctor</option>
                      {doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.firstName} {doctor.lastName}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Visit date *</label>
                    <input required type="date" value={form.visitDate} onChange={event => setForm(current => ({ ...current, visitDate: event.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Follow-up date</label>
                    <input type="date" value={form.followUpDate} onChange={event => setForm(current => ({ ...current, followUpDate: event.target.value }))} />
                  </div>
                  <div className="form-group records-form-span-2">
                    <label className="form-label">Diagnosis *</label>
                    <input required value={form.diagnosis} onChange={event => setForm(current => ({ ...current, diagnosis: event.target.value }))} placeholder="Primary diagnosis" />
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

function RecordRow({ record, patient, onView }: {
  record: MedicalRecord;
  patient?: Patient;
  onView: () => void;
}) {
  const initials = patient ? patientInitials(patient) : getInitials(record.patientName);

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
          <Activity size={14} style={{ color: 'var(--clr-primary-400)' }} />
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
          <Stethoscope size={14} style={{ color: 'var(--clr-primary-400)' }} />
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
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {record.prescription?.length ? (
            <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
              <Pill size={11} /> {record.prescription.length} Rx
            </span>
          ) : null}
          {record.labTests?.length ? (
            <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
              <FlaskConical size={11} /> {record.labTests.length} Lab
            </span>
          ) : null}
          {!record.prescription?.length && !record.labTests?.length && (
            <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>—</span>
          )}
        </div>
      </td>
      <td style={{ textAlign: 'right' }}>
        <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon"
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

function RecordView({ record }: { record: MedicalRecord }) {
  const { patients } = useClinic();
  const patient = findPatient(patients, record.patientId);
  const labTests = record.labTests ?? [];
  const initials = patient ? patientInitials(patient) : getInitials(record.patientName);

  return (
    <div className="patient-view">
      <div className="pv-header">
        <div className="pv-avatar">{initials}</div>
        <div>
          <div className="pv-name">{patientFullName(patient, record.patientName)}</div>
          <div className="pv-id" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.2rem' }}>
            <code className="id-code">{patientCode(patient, record.patientId)}</code>
            {patient?.patientType && (
              <span className={`badge ${patient.patientType === 'Student' ? 'badge-blue' : 'badge-gray'}`}>
                {patient.patientType}
              </span>
            )}
            {patient?.bloodGroup && <span className="badge badge-red">Blood: {patient.bloodGroup}</span>}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>Visit Date</span>
          <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--clr-text-primary)' }}>{record.visitDate}</strong>
        </div>
      </div>

      <div className="pv-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="pv-item">
          <div className="pv-label">Doctor</div>
          <div className="pv-value" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Stethoscope size={14} style={{ color: 'var(--clr-primary-400)' }} /> {record.doctorName}
          </div>
        </div>
        <div className="pv-item">
          <div className="pv-label">Status</div>
          <div className="pv-value" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={14} style={{ color: 'var(--clr-primary-400)' }} /> Completed
          </div>
        </div>
        <div className="pv-item">
          <div className="pv-label">Follow-up Date</div>
          <div className="pv-value" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Clock size={14} style={{ color: 'var(--clr-primary-400)' }} /> {record.followUpDate || 'None scheduled'}
          </div>
        </div>
      </div>

      <section className="record-detail-section mb-3">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
          <Activity size={16} className="text-primary" /> Diagnosis &amp; Symptoms
        </h3>
        <p className="record-diagnosis-value" style={{ fontWeight: 600, fontSize: '0.92rem' }}>{record.diagnosis}</p>
        {record.symptoms.length > 0 && (
          <div className="record-tags" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {record.symptoms.map(symptom => <span className="badge badge-gray" key={symptom}>{symptom}</span>)}
          </div>
        )}
      </section>

      {record.prescription && record.prescription.length > 0 && (
        <section className="record-detail-section mb-3">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            <Pill size={16} className="text-primary" /> Prescriptions <span className="badge badge-green">{record.prescription.length}</span>
          </h3>
          <div className="record-list">
            {record.prescription.map((item, index) => (
              <div className="record-list-row" key={`${item.medication}-${index}`}>
                <strong>{item.medication}</strong>
                <span>{item.dosage} · {item.frequency} · {item.duration}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {labTests.length > 0 && (
        <section className="record-detail-section mb-3">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            <FlaskConical size={16} className="text-primary" /> Laboratory Tests <span className="badge badge-blue">{labTests.length}</span>
          </h3>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Test</th><th>Result</th><th>Status</th></tr></thead>
              <tbody>
                {labTests.map((test, index) => (
                  <tr key={`${test.testName}-${index}`}>
                    <td>{test.testName}</td>
                    <td>{test.result || '—'}{test.unit ? ` ${test.unit}` : ''}</td>
                    <td><span className={`badge ${test.status === 'Completed' ? 'badge-green' : 'badge-gray'}`}><CheckCircle2 size={11} /> {test.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {record.notes && <section className="record-detail-section"><h3><FileText size={16} /> Notes</h3><p className="record-notes">{record.notes}</p></section>}
    </div>
  );
}
