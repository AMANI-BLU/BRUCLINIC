import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClinic } from '../context/ClinicContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import type { Patient, Gender, BloodGroup, PatientType, QueuePriority, QueueStage, MedicalRecord, ClinicQueueItem, LabOrder } from '../types';
import {
  Search, Trash2, Edit2, Eye, X, UserPlus, Users, Send,
  Activity, HeartPulse, FileText, Utensils
} from 'lucide-react';
import { firstError, validateEmail, validateName, validateNumber, validatePhone, validateRequired, validateTextLength, sanitizeInput } from '../utils/validation';
import PhoneInput from '../components/AdminLTE/PhoneInput';
import { calculatePatientAge, dateOfBirthForAge, patientCode, patientFullName, patientInitials, patientMatchesSearch, patientTypeClass } from '../utils/patient';
import { diagnosisLabel } from '../utils/diagnosis';
import ConfirmModal from '../components/ConfirmModal';
import ModalPortal from '../components/ModalPortal';
import LoadingButton from '../components/LoadingButton';
import OpdClinicDocumentModal, { type OpdClinicDocumentType } from '../components/OpdClinicDocumentModal';
import './Patients.css';
import { formatDateTime12, formatTime12 } from '../utils/date';
import { normalizeDoctorName } from '../utils/doctorName';

interface PatientFormData {
  firstName: string;
  lastName: string;
  gender: Gender;
  age: string;
  phone: string;
  email: string;
  address: string;
  patientType: PatientType;
  department: string;
  bloodGroup: BloodGroup | '';
  allergies: string;
  chronicConditions: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

const EMPTY_PATIENT_FORM: PatientFormData = {
  firstName: '',
  lastName: '',
  gender: 'Male',
  age: '',
  phone: '',
  email: '',
  address: '',
  patientType: 'Student',
  department: 'Computer Science',
  bloodGroup: '',
  allergies: '',
  chronicConditions: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

interface RequestDetails {
  forwardToOpd: boolean;
  doctorId: string;
  destination: QueueStage;
  priority: QueuePriority;
  reason: string;
}

const EMPTY_REQUEST: RequestDetails = {
  forwardToOpd: true,
  doctorId: '',
  destination: 'Doctor Consultation',
  priority: 'Normal',
  reason: '',
};

type ModalMode = 'view' | 'add' | 'edit' | null;

export default function Patients() {
  const { t } = useLanguage();
  const {
    patients, doctors, records, queue, labOrders,
    addPatient, updatePatient, deletePatient, sendCardToOpdRequest
  } = useClinic();
  const { role, currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<PatientType | 'All'>('All');
  const [modal, setModal] = useState<{ mode: ModalMode; patient?: Patient }>({ mode: null });
  const [form, setForm] = useState<PatientFormData>(EMPTY_PATIENT_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [requestDetails, setRequestDetails] = useState<RequestDetails>(EMPTY_REQUEST);
  const [formError, setFormError] = useState<string | null>(null);

  const validateField = (name: string, value: string) => {
    let err: string | undefined;
    if (name === 'firstName') err = validateName(value, t('First name'));
    else if (name === 'lastName') err = validateName(value, t('Last name'));
    else if (name === 'age') err = typeof value === 'string' && value === '' ? t('Age is required.') : validateNumber(value, t('Age'), { min: 0, max: 130, integer: true, required: true });
    else if (name === 'phone') err = !value.trim() ? t('Phone is required.') : validatePhone(value, t('Phone'));
    else if (name === 'email') err = value ? validateEmail(value, t('Email')) : undefined;
    else if (name === 'emergencyContactPhone') err = value ? validatePhone(value, t('Emergency contact phone')) : undefined;
    setFieldErrors(prev => ({ ...prev, [name]: err ?? '' }));
  };

  const handleFieldBlur = (name: string, value: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  const patchForm = (patch: Partial<PatientFormData>) => {
    setForm(f => {
      const next = { ...f, ...patch };
      Object.keys(patch).forEach(k => {
        if (touched[k]) validateField(k, String(patch[k as keyof PatientFormData] ?? ''));
      });
      return next;
    });
  };

  const fieldClass = (name: string) => {
    if (!touched[name]) return '';
    return fieldErrors[name] ? 'is-invalid' : 'is-valid';
  };
  const [saving, setSaving] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [clinicDocumentModal, setClinicDocumentModal] = useState<{
    type: OpdClinicDocumentType;
    patient: Patient;
  } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Only receptionist can add/edit/delete patients
  const canManagePatients = role === 'receptionist';
  // Desk roles that can create a card-to-OPD dispatch (receptionist only now)
  const canDispatch = role === 'receptionist';
  // OPD and Admin clinicians can issue sick leave and special meal orders
  const canIssueClinicDocuments = role === 'opd' || role === 'admin';

  const filtered = patients.filter(p => {
    const matchType = filterType === 'All' || p.patientType === filterType;
    return patientMatchesSearch(p, search) && matchType;
  });

  const openAdd = useCallback(() => {
    setForm(EMPTY_PATIENT_FORM);
    setFieldErrors({});
    setTouched({});
    setRequestDetails({ ...EMPTY_REQUEST, doctorId: doctors[0]?.id || '' });
    setFormError(null);
    setModal({ mode: 'add' });
  }, [doctors]);

  // Reception routes new-card registration here so the whole clinic uses the
  // same complete "Register New Patient" form instead of a second mini-form.
  useEffect(() => {
    if (searchParams.get('register') !== 'new' || role !== 'receptionist') return;
    openAdd();
    setSearchParams({}, { replace: true });
  }, [openAdd, role, searchParams, setSearchParams]);

  const openEdit = (p: Patient) => {
    setForm({
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      gender: p.gender || 'Male',
      age: calculatePatientAge(p.dateOfBirth)?.toString() || '',
      phone: p.phone || '',
      email: p.email || '',
      address: p.address || '',
      patientType: p.patientType || 'Student',
      department: p.department || '',
      bloodGroup: p.bloodGroup || '',
      allergies: Array.isArray(p.allergies) ? p.allergies.join(', ') : (p.allergies || ''),
      chronicConditions: Array.isArray(p.chronicConditions) ? p.chronicConditions.join(', ') : (p.chronicConditions || ''),
      emergencyContactName: p.emergencyContactName || '',
      emergencyContactPhone: p.emergencyContactPhone || '',
    });
    setFieldErrors({});
    setTouched({});
    setFormError(null);
    setModal({ mode: 'edit', patient: p });
  };

  const openView = (p: Patient) => {
    setModal({ mode: 'view', patient: p });
  };

  const close = () => {
    setFormError(null);
    setModal({ mode: null });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    // Mark all relevant fields touched on submit
    const fields = ['firstName', 'lastName', 'age', 'phone', 'email', 'emergencyContactPhone'];
    setTouched(Object.fromEntries(fields.map(f => [f, true])));
    const requiredErrors = validateRequired(form as unknown as Record<string, unknown>, {
      firstName: 'First name',
      lastName: 'Last name',
      age: 'Age',
      phone: 'Phone',
    });
    const error = firstError(
      ...Object.values(requiredErrors),
      validateTextLength(form.firstName, 'First name', { min: 2, max: 100, required: true }),
      validateTextLength(form.lastName, 'Last name', { min: 2, max: 100, required: true }),
      validateNumber(form.age, 'Age', { min: 0, max: 130, integer: true, required: true }),
      validatePhone(form.phone),
      form.email ? validateEmail(form.email) : undefined,
      form.emergencyContactPhone ? validatePhone(form.emergencyContactPhone, 'Emergency contact phone') : undefined,
      requestDetails.reason ? validateTextLength(requestDetails.reason, 'Reason', { max: 500 }) : undefined,
    );
    if (error) {
      setFormError(t(error));
      return;
    }

    const allergyArr = form.allergies
      ? form.allergies.split(',').map(s => sanitizeInput(s)).filter(Boolean)
      : [];
    const chronicArr = form.chronicConditions
      ? form.chronicConditions.split(',').map(s => sanitizeInput(s)).filter(Boolean)
      : [];

    const patientPayload: Omit<Patient, 'id' | 'registeredAt'> = {
      firstName: sanitizeInput(form.firstName),
      lastName: sanitizeInput(form.lastName),
      gender: form.gender,
      dateOfBirth: dateOfBirthForAge(Number(form.age)),
      phone: sanitizeInput(form.phone),
      email: sanitizeInput(form.email),
      address: sanitizeInput(form.address),
      patientType: form.patientType,
      department: sanitizeInput(form.department),
      bloodGroup: form.bloodGroup || null,
      allergies: allergyArr,
      chronicConditions: chronicArr,
      emergencyContactName: sanitizeInput(form.emergencyContactName),
      emergencyContactPhone: sanitizeInput(form.emergencyContactPhone),
    };

    try {
      setSaving(true);
      if (modal.mode === 'add') {
        const saved = await addPatient(patientPayload);

        if (canDispatch && requestDetails.forwardToOpd) {
          const doctor = doctors.find(d => d.id === requestDetails.doctorId) || doctors[0];
          const doctorName = doctor ? `${doctor.firstName} ${doctor.lastName}` : 'General OPD Clinician';
          const opdRoom = doctor?.specialization === 'Dental' ? 'Dental OPD' :
                          doctor?.specialization === 'Gynecology' ? 'OPD Room 2' :
                          'OPD Room 1';

          await sendCardToOpdRequest({
            patient: saved,
            hasExistingCard: false,
            chiefComplaint: sanitizeInput(requestDetails.reason) || 'New patient file card created & initial consultation requested',
            priority: requestDetails.priority,
            stage: requestDetails.destination,
            assignedDoctorId: doctor?.id,
            assignedDoctorName: doctorName,
            assignedOpdRoom: opdRoom,
          });
        }
      } else if (modal.mode === 'edit' && modal.patient) {
        await updatePatient(modal.patient.id, patientPayload);
      }
      close();
    } catch (cause) {
      setFormError(cause instanceof Error ? t(cause.message) : t('Could not save this patient record.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  return (
    <div className="patients-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('Patients')}</h1>
          <p className="page-subtitle">{patients.length} {t('registered patients')}</p>
        </div>
        {canManagePatients && (
          <button type="button" className="btn btn-primary" id="add-patient-btn" onClick={openAdd}>
            <UserPlus size={16} /> {t('New patient')}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-bar">
          <Search size={16} className="icon" />
          <input
            id="patient-search"
            placeholder={t('Search by name, ID or department…')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="pill-tabs">
          {(['All', 'Student', 'Staff', 'External'] as const).map(type => (
            <button
              key={type}
              type="button"
              className={`pill-tab ${filterType === type ? 'active' : ''}`}
              onClick={() => setFilterType(type)}
            >
              {t(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>{t('Patient')}</th>
              <th>{t('Card ID')}</th>
              <th>{t('Type')}</th>
              <th>{t('Department')}</th>
              <th>{t('Contact')}</th>
              <th>{t('Blood')}</th>
              <th>{t('Registered')}</th>
              <th>{t('Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr className="empty-state-row">
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon tone-blue"><Users size={28} /></div>
                    <h5 className="empty-state-title">{t('No patients found')}</h5>
                    <p className="empty-state-body">{t('No patient matches this search or filter.')}</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td>
                  <div className="patient-cell">
                    <div className="avatar" style={{ background: 'var(--clr-primary-500)' }}>{patientInitials(p)}</div>
                    <div>
                      <div className="patient-name">{p.firstName} {p.lastName}</div>
                      <div className="patient-sub">{p.email || p.phone}</div>
                    </div>
                  </div>
                </td>
                <td><code className="id-code" title={t('Patient card number')}>{patientCode(p)}</code></td>
                <td><span className={`badge ${patientTypeClass(p.patientType)}`}>{t(p.patientType)}</span></td>
                <td>{p.department ?? '—'}</td>
                <td>{p.phone}</td>
                <td><span className="badge badge-blue">{p.bloodGroup ?? '?'}</span></td>
                <td>{p.registeredAt}</td>
                <td>
                  <div className="action-btns">
                    <button type="button" className="btn btn-secondary btn-sm btn-icon" title={t('View Patient Card & History')} onClick={() => openView(p)}><Eye size={15} /></button>
                    {canIssueClinicDocuments && (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon"
                          title={t('Sick Leave')}
                          onClick={() => setClinicDocumentModal({ patient: p, type: 'sick-leave' })}
                        >
                          <FileText size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm btn-icon"
                          title={t('Special Meal')}
                          onClick={() => setClinicDocumentModal({ patient: p, type: 'special-meal' })}
                        >
                          <Utensils size={15} />
                        </button>
                      </>
                    )}
                    {canManagePatients && (
                      <>
                        <button type="button" className="btn btn-secondary btn-sm btn-icon" title={t('Edit Patient Details')} onClick={() => openEdit(p)}><Edit2 size={15} /></button>
                        <button type="button" className="btn btn-danger btn-sm btn-icon" title={t('Delete Patient')} onClick={() => handleDelete(p.id)}><Trash2 size={15} /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal.mode && (
        <ModalPortal>
        <div className="modal-overlay" onClick={() => !saving && close()}>
          <div
            className={`modal ${modal.mode === 'view' ? 'view-modal' : 'patient-unified-modal patient-register-modal'}`}
            style={{ width: modal.mode === 'view' ? 'min(96%, 900px)' : 'min(96%, 760px)', maxHeight: '92vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {modal.mode === 'add' ? <><UserPlus size={18} className="text-primary" /> {t('Register New Patient')}</> :
                 modal.mode === 'edit' ? <><Edit2 size={18} className="text-primary" /> {t('Edit Patient')}</> :
                 <>{t('Patient Card')}</>}
              </h2>
              <button type="button" className="modal-close-btn" onClick={close} disabled={saving} aria-label={t('Close dialog')}><X size={16} /></button>
            </div>

            {modal.mode === 'view' && modal.patient ? (
              <>
                <div className="modal-body view-modal-body">
                  <PatientView
                    patient={modal.patient}
                    records={records.filter(r => r.patientId === modal.patient?.id)}
                    queue={queue.filter(q => q.patientId === modal.patient?.id)}
                    labOrders={labOrders.filter(l => l.patientId === modal.patient?.id)}
                    canIssueClinicDocuments={canIssueClinicDocuments}
                    onIssueClinicDocument={type => modal.patient && setClinicDocumentModal({ patient: modal.patient, type })}
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={close}>{t('Close')}</button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="patient-register-form">
                {formError && <div className="alert alert-danger py-2 px-3 mb-2" role="alert">{t(formError)}</div>}

                <div className="alert alert-info py-2 px-3 mb-3" role="status">
                  <strong>{t('Patient card ID:')}</strong>{' '}
                  {modal.patient ? <code>{patientCode(modal.patient)}</code> : t('Assigned automatically when this registration is saved.')}
                </div>

                {/* Section 1: Demographics & Personal Info */}
                <div className="patient-register-section">
                  <div className="patient-register-section-title">
                    <Users size={15} className="text-primary" /> {t('Personal Demographics')}
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">{t('First name')} *</label>
                      <input
                        required
                        value={form.firstName}
                        className={fieldClass('firstName')}
                        onChange={e => patchForm({ firstName: e.target.value })}
                        onBlur={e => handleFieldBlur('firstName', e.target.value)}
                        placeholder={t('First name')}
                      />
                      {touched['firstName'] && fieldErrors['firstName'] && (
                        <div className="invalid-feedback">{fieldErrors['firstName']}</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Last name')} *</label>
                      <input
                        required
                        value={form.lastName}
                        className={fieldClass('lastName')}
                        onChange={e => patchForm({ lastName: e.target.value })}
                        onBlur={e => handleFieldBlur('lastName', e.target.value)}
                        placeholder={t('Last name')}
                      />
                      {touched['lastName'] && fieldErrors['lastName'] && (
                        <div className="invalid-feedback">{fieldErrors['lastName']}</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Gender')} *</label>
                      <select
                        value={form.gender}
                        onChange={e => patchForm({ gender: e.target.value as Gender })}
                      >
                        <option value="Male">{t('Male')}</option>
                        <option value="Female">{t('Female')}</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Age')} *</label>
                      <input
                        required
                        type="number"
                        min="0"
                        max="130"
                        step="1"
                        value={form.age}
                        className={fieldClass('age')}
                        onChange={e => patchForm({ age: e.target.value })}
                        onBlur={e => handleFieldBlur('age', e.target.value)}
                        placeholder={t('Age in years')}
                      />
                      {touched['age'] && fieldErrors['age'] && (
                        <div className="invalid-feedback">{fieldErrors['age']}</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Phone')} *</label>
                      <PhoneInput
                        id="patient-phone"
                        required
                        value={form.phone}
                        onChange={val => patchForm({ phone: val })}
                        onBlur={() => handleFieldBlur('phone', form.phone)}
                        error={touched['phone'] ? fieldErrors['phone'] : undefined}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Email')}</label>
                      <input
                        type="email"
                        value={form.email}
                        className={fieldClass('email')}
                        onChange={e => patchForm({ email: e.target.value })}
                        onBlur={e => handleFieldBlur('email', e.target.value)}
                        placeholder="patient@bru.edu.et"
                      />
                      {touched['email'] && fieldErrors['email'] && (
                        <div className="invalid-feedback">{fieldErrors['email']}</div>
                      )}
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">{t('Residential Address')}</label>
                      <input
                        value={form.address}
                        onChange={e => patchForm({ address: e.target.value })}
                        placeholder={t('Campus Dormitory / Residence Zone, Town')}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Clinical & Institutional Profile */}
                <div className="patient-register-section">
                  <div className="patient-register-section-title">
                    <Activity size={15} className="text-primary" /> {t('Institutional Affiliation & Medical Background')}
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">{t('Patient Type')}</label>
                      <select
                        value={form.patientType}
                        onChange={e => setForm(f => ({ ...f, patientType: e.target.value as PatientType }))}
                      >
                        <option value="Student">{t('Student')}</option>
                        <option value="Staff">{t('Staff')}</option>
                        <option value="External">{t('External')}</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Department / Faculty')}</label>
                      <input
                        value={form.department}
                        onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                        placeholder={t('e.g. Computer Science, Medicine, Law')}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Blood Group')}</label>
                      <select
                        value={form.bloodGroup}
                        onChange={e => setForm(f => ({ ...f, bloodGroup: e.target.value as BloodGroup | '' }))}
                      >
                        <option value="">{t('Not recorded')}</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Known Drug Allergies')}</label>
                      <input
                        value={form.allergies}
                        onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
                        placeholder={t('e.g. Penicillin, Sulfa (comma separated)')}
                      />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">{t('Chronic Conditions / Health History')}</label>
                      <input
                        value={form.chronicConditions}
                        onChange={e => setForm(f => ({ ...f, chronicConditions: e.target.value }))}
                        placeholder={t('e.g. Hypertension, Asthma, Diabetes (comma separated)')}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Emergency Contact */}
                <div className="patient-register-section">
                  <div className="patient-register-section-title">
                    <HeartPulse size={15} className="text-danger" /> {t('Emergency Contact')}
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">{t('Emergency Contact Name')}</label>
                      <input
                        value={form.emergencyContactName}
                        onChange={e => patchForm({ emergencyContactName: e.target.value })}
                        placeholder={t('Guardian / Family contact full name')}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Emergency Contact Phone')}</label>
                      <PhoneInput
                        id="emergency-phone"
                        value={form.emergencyContactPhone}
                        onChange={val => patchForm({ emergencyContactPhone: val })}
                        onBlur={() => handleFieldBlur('emergencyContactPhone', form.emergencyContactPhone)}
                        error={touched['emergencyContactPhone'] ? fieldErrors['emergencyContactPhone'] : undefined}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Card Dispatch to OPD (When adding only) */}
                {modal.mode === 'add' && canDispatch && (
                  <div className="patient-register-section">
                    <div className="patient-register-section-title">
                    <Send size={15} className="text-primary" /> {t('First Visit Request')}
                    </div>
                    <label className={`patient-register-dispatch-toggle ${requestDetails.forwardToOpd ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={requestDetails.forwardToOpd}
                          onChange={e => setRequestDetails(d => ({ ...d, forwardToOpd: e.target.checked }))}
                        />
                        <span>
                          <strong>{t('Create a visit request after registration')}</strong>
                          <small>{t('Route the patient to the selected clinic destination.')}</small>
                        </span>
                    </label>

                    {requestDetails.forwardToOpd && (
                      <>
                        <div className="form-grid">
                          <div className="form-group">
                            <label className="form-label">{t('Assigned Doctor')}</label>
                            <select
                              value={requestDetails.doctorId || doctors[0]?.id || ''}
                              onChange={e => setRequestDetails(d => ({ ...d, doctorId: e.target.value }))}
                            >
                              {doctors.length === 0 ? (
                                <option value="">{t('General OPD Duty Clinician')}</option>
                              ) : (
                                doctors.map(d => (
                                  <option key={d.id} value={d.id}>
                                    {d.firstName} {d.lastName} · {d.specialization}
                                  </option>
                                ))
                              )}
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label">{t('Destination')}</label>
                            <select
                              value={requestDetails.destination}
                              onChange={e => setRequestDetails(d => ({ ...d, destination: e.target.value as QueueStage }))}
                            >
                              <option value="Doctor Consultation">{t('OPD Doctor Consultation')}</option>
                              <option value="Emergency">{t('Emergency (ER)')}</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label">{t('Priority')}</label>
                            <select
                              value={requestDetails.priority}
                              onChange={e => setRequestDetails(d => ({ ...d, priority: e.target.value as QueuePriority }))}
                            >
                              <option value="Normal">{t('Normal')}</option>
                              <option value="Urgent">{t('Urgent')}</option>
                              <option value="Emergency">{t('Emergency')}</option>
                            </select>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">{t('Reason (Optional)')}</label>
                          <textarea
                            rows={2}
                            value={requestDetails.reason}
                            onChange={e => setRequestDetails(d => ({ ...d, reason: e.target.value }))}
                            placeholder={t('Reason for visit or chief complaint (optional)')}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="modal-footer" style={{ marginTop: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={close} disabled={saving}>{t('Cancel')}</button>
                  <LoadingButton type="submit" className="btn btn-primary" loading={saving} loadingLabel={t(modal.mode === 'edit' ? 'Saving…' : 'Registering…')}>
                    {modal.mode === 'add'
                      ? (canDispatch && requestDetails.forwardToOpd ? <><Send size={16} /> {t('Register & Send to OPD')}</> : t('Register Patient'))
                      : t('Save Changes')}
                  </LoadingButton>
                </div>
              </form>
            )}
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Delete Patient Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title={t('Delete Patient Record')}
        message={t('Are you sure you want to delete this patient record? This action will permanently remove the patient profile and cannot be undone.')}
        confirmText={t('Delete Record')}
        cancelText={t('Cancel')}
        variant="danger"
        icon="trash"
        onClose={() => setDeleteTargetId(null)}
        onConfirm={async () => {
          if (deleteTargetId) {
            await deletePatient(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
      />

      {clinicDocumentModal && (
        <OpdClinicDocumentModal
          key={`${clinicDocumentModal.type}-${clinicDocumentModal.patient.id}`}
          type={clinicDocumentModal.type}
          patientId={clinicDocumentModal.patient.id}
          queueItemId={queue.find(q => q.patientId === clinicDocumentModal.patient.id)?.id}
          patientName={patientFullName(clinicDocumentModal.patient)}
          patientCode={patientCode(clinicDocumentModal.patient)}
          patientAge={calculatePatientAge(clinicDocumentModal.patient.dateOfBirth)}
          patientGender={clinicDocumentModal.patient.gender}
          doctorName={currentUser?.name || 'Physician'}
          profession={currentUser?.roleTitle || (role === 'admin' ? 'Medical Director' : 'OPD Clinician')}
          treatmentDate={records.filter(r => r.patientId === clinicDocumentModal.patient.id)[0]?.visitDate}
          diagnosis={records.filter(r => r.patientId === clinicDocumentModal.patient.id)[0]?.diagnosis}
          onClose={() => setClinicDocumentModal(null)}
        />
      )}
    </div>
  );
}

interface PatientViewProps {
  patient: Patient;
  records: MedicalRecord[];
  queue: ClinicQueueItem[];
  labOrders: LabOrder[];
  canIssueClinicDocuments?: boolean;
  onIssueClinicDocument?: (type: OpdClinicDocumentType) => void;
}

function PatientView({
  patient: p,
  records,
  queue,
  labOrders,
  canIssueClinicDocuments,
  onIssueClinicDocument,
}: PatientViewProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'profile' | 'records' | 'labs' | 'visits'>('records');

  return (
    <div className="patient-view">
      <div className="view-summary">
        <div className="view-summary-avatar">{patientInitials(p)}</div>
        <div className="view-summary-copy">
          <h3>{patientFullName(p)}</h3>
          <p>{t('Card')} {patientCode(p)}</p>
          <div className="view-summary-badges">
            <span className="badge badge-blue">{t(p.patientType)}</span>
            <span className="badge badge-violet">{t(p.gender)}</span>
            {p.bloodGroup && <span className="badge badge-red">{p.bloodGroup}</span>}
            {p.department && <span className="badge badge-gray">{p.department}</span>}
          </div>
        </div>
        <div className="view-summary-stats">
          <div><strong>{records.length}</strong><span>{t('Encounters')}</span></div>
          <div><strong>{labOrders.length}</strong><span>{t('Lab tests')}</span></div>
        </div>
      </div>

      {canIssueClinicDocuments && onIssueClinicDocument && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.85rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onIssueClinicDocument('sick-leave')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}
            title={t('Sick Leave')}
          >
            <FileText size={14} /> {t('Sick Leave')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onIssueClinicDocument('special-meal')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}
            title={t('Special Meal')}
          >
            <Utensils size={14} /> {t('Special Meal')}
          </button>
        </div>
      )}

      <div className="pill-tabs view-tabs">
        <button type="button" className={`pill-tab ${activeTab === 'records' ? 'active' : ''}`} onClick={() => setActiveTab('records')}>
          {t('Records')} ({records.length})
        </button>
        <button type="button" className={`pill-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          {t('Profile')}
        </button>
        <button type="button" className={`pill-tab ${activeTab === 'labs' ? 'active' : ''}`} onClick={() => setActiveTab('labs')}>
          {t('Lab')} ({labOrders.length})
        </button>
        <button type="button" className={`pill-tab ${activeTab === 'visits' ? 'active' : ''}`} onClick={() => setActiveTab('visits')}>
          {t('Visits')} ({queue.length})
        </button>
      </div>

      {activeTab === 'records' && (
        <div className="view-list">
          {records.length === 0 ? (
            <div className="view-empty">{t('No medical records for this patient yet.')}</div>
          ) : (
            records.map(rec => (
              <article className="view-card" key={rec.id}>
                <div className="view-card-head">
                  <div>
                    <span className="view-card-eyebrow">{rec.visitDate}</span>
                    <h4>{diagnosisLabel(rec.diagnosis, Boolean(rec.externalReferral))}</h4>
                  </div>
                  <span className="badge badge-gray">{normalizeDoctorName(rec.doctorName)}</span>
                </div>

                {rec.symptoms && rec.symptoms.length > 0 && (
                  <div className="view-card-row">
                    <span>{t('Symptoms')}</span>
                    <p>{Array.isArray(rec.symptoms) ? rec.symptoms.join(', ') : rec.symptoms}</p>
                  </div>
                )}

                {rec.prescription && rec.prescription.length > 0 && (
                  <div className="view-card-subsection">
                    <div className="view-subsection-title">{t('Prescription')}</div>
                    <ul>
                      {rec.prescription.map((rx, idx) => (
                        <li key={idx}>
                          <strong>{rx.medication}</strong> — {rx.dosage || rx.frequency} ({rx.duration || t('7 days')})
                          {rx.instructions && <span> · {rx.instructions}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {rec.notes && <p className="view-card-note">{t('Notes:')} {rec.notes}</p>}
              </article>
            ))
          )}
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="view-info-grid">
          <PVItem label={t('Card ID')} value={patientCode(p)} />
          <PVItem label={t('Age')} value={calculatePatientAge(p.dateOfBirth) !== undefined ? `${calculatePatientAge(p.dateOfBirth)} ${t('years')}` : '—'} />
          <PVItem label={t('Phone')} value={p.phone} />
          <PVItem label={t('Email')} value={p.email || '—'} />
          <PVItem label={t('Department / Program')} value={p.department ?? '—'} />
          <PVItem label={t('Address')} value={p.address || '—'} />
          <PVItem label={t('Registered Date')} value={p.registeredAt} />
          <PVItem label={t('Known Drug Allergies')} value={Array.isArray(p.allergies) ? (p.allergies.join(', ') || t('None reported')) : (p.allergies ? String(p.allergies) : t('None reported'))} />
          <PVItem label={t('Chronic Conditions')} value={Array.isArray(p.chronicConditions) ? (p.chronicConditions.join(', ') || t('None reported')) : (p.chronicConditions ? String(p.chronicConditions) : t('None reported'))} />
          <PVItem label={t('Emergency Contact')} value={p.emergencyContactName ? `${p.emergencyContactName} (${p.emergencyContactPhone || t('No phone')})` : t('None provided')} />
        </div>
      )}

      {activeTab === 'labs' && (
        <div className="view-list">
          {labOrders.length === 0 ? (
            <div className="view-empty">{t('No laboratory investigations for this patient.')}</div>
          ) : (
            labOrders.map(lo => (
              <article className="view-card" key={lo.id}>
                <div className="view-card-head">
                  <h4>{lo.testName} <span className="view-card-meta">({lo.category})</span></h4>
                  <span className={`badge ${lo.status === 'Completed' ? 'badge-green' : 'badge-blue'}`}>{t(lo.status)}</span>
                </div>
                <div className="view-card-row">
                  <span>{t('Ordered by')}</span>
                  <p>{normalizeDoctorName(lo.doctorName)} · {formatDateTime12(lo.orderedAt)}</p>
                </div>
                {lo.status === 'Completed' && (
                  <div className="view-result">
                    <strong>{t('Result:')}</strong> {lo.result} {lo.unit} <span>({t('Ref:')} {lo.referenceRange || t('Standard')})</span>
                    {lo.isAbnormal && <span className="badge badge-red">{t('Abnormal')}</span>}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      )}

      {activeTab === 'visits' && (
        <div className="view-list">
          {queue.length === 0 ? (
            <div className="view-empty">{t('No queue visits recorded.')}</div>
          ) : (
            queue.map(q => (
              <div className="view-row" key={q.id}>
                <div className="view-row-main">
                  <strong className="view-mono">{q.tokenNumber}</strong>
                  <span className="badge badge-blue">{t(q.stage)}</span>
                  <div className="view-row-sub">{q.chiefComplaint}</div>
                </div>
                <div className="view-row-meta">
                  {formatTime12(q.registeredTime)}<br />{normalizeDoctorName(q.assignedDoctorName) || t('General OPD')}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PVItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="view-info-item">
      <div className="view-info-label">{label}</div>
      <div className="view-info-value">{value}</div>
    </div>
  );
}
