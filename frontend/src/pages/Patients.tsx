import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClinic } from '../context/ClinicContext';
import { useAuth } from '../context/AuthContext';
import type { Patient, Gender, BloodGroup, PatientType, QueuePriority, QueueStage, MedicalRecord, ClinicQueueItem, LabOrder } from '../types';
import {
  Search, Trash2, Edit2, Eye, X, UserPlus, Users, Send,
  Activity, HeartPulse
} from 'lucide-react';
import { firstError, validateEmail, validateNumber, validatePhone, validateRequired, validateTextLength, sanitizeInput } from '../utils/validation';
import { calculatePatientAge, dateOfBirthForAge, patientCode, patientFullName, patientInitials, patientMatchesSearch, patientTypeClass } from '../utils/patient';
import { diagnosisLabel } from '../utils/diagnosis';
import ConfirmModal from '../components/ConfirmModal';
import ModalPortal from '../components/ModalPortal';
import LoadingButton from '../components/LoadingButton';
import './Patients.css';
import { formatDateTime12, formatTime12 } from '../utils/date';

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
  const {
    patients, doctors, records, queue, labOrders,
    addPatient, updatePatient, deletePatient, sendCardToOpdRequest
  } = useClinic();
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<PatientType | 'All'>('All');
  const [modal, setModal] = useState<{ mode: ModalMode; patient?: Patient }>({ mode: null });
  const [form, setForm] = useState<PatientFormData>(EMPTY_PATIENT_FORM);
  const [requestDetails, setRequestDetails] = useState<RequestDetails>(EMPTY_REQUEST);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Only receptionist can add/edit/delete patients
  const canManagePatients = role === 'receptionist';
  // Desk roles that can create a card-to-OPD dispatch (receptionist only now)
  const canDispatch = role === 'receptionist';

  const filtered = patients.filter(p => {
    const matchType = filterType === 'All' || p.patientType === filterType;
    return patientMatchesSearch(p, search) && matchType;
  });

  const openAdd = useCallback(() => {
    setForm(EMPTY_PATIENT_FORM);
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
      setFormError(error);
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
      setFormError(cause instanceof Error ? cause.message : 'Could not save this patient record.');
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
          <h1 className="page-title">Patients</h1>
          <p className="page-subtitle">{patients.length} registered patients</p>
        </div>
        {canManagePatients && (
          <button type="button" className="btn btn-primary" id="add-patient-btn" onClick={openAdd}>
            <UserPlus size={16} /> New patient
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-bar">
          <Search size={16} className="icon" />
          <input
            id="patient-search"
            placeholder="Search by name, ID or department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="pill-tabs">
          {(['All', 'Student', 'Staff', 'External'] as const).map(t => (
            <button
              key={t}
              type="button"
              className={`pill-tab ${filterType === t ? 'active' : ''}`}
              onClick={() => setFilterType(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Card ID</th>
              <th>Type</th>
              <th>Department</th>
              <th>Contact</th>
              <th>Blood</th>
              <th>Registered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr className="empty-state-row">
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon tone-blue"><Users size={28} /></div>
                    <h5 className="empty-state-title">No patients found</h5>
                    <p className="empty-state-body">No patient matches this search or filter.</p>
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
                <td><code className="id-code" title="Patient card number">{patientCode(p)}</code></td>
                <td><span className={`badge ${patientTypeClass(p.patientType)}`}>{p.patientType}</span></td>
                <td>{p.department ?? '—'}</td>
                <td>{p.phone}</td>
                <td><span className="badge badge-blue">{p.bloodGroup ?? '?'}</span></td>
                <td>{p.registeredAt}</td>
                <td>
                  <div className="action-btns">
                    <button type="button" className="btn btn-secondary btn-sm btn-icon" title="View Patient Card & History" onClick={() => openView(p)}><Eye size={15} /></button>
                    {canManagePatients && (
                      <>
                        <button type="button" className="btn btn-secondary btn-sm btn-icon" title="Edit Patient Details" onClick={() => openEdit(p)}><Edit2 size={15} /></button>
                        <button type="button" className="btn btn-danger btn-sm btn-icon" title="Delete Patient" onClick={() => handleDelete(p.id)}><Trash2 size={15} /></button>
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
                {modal.mode === 'add' ? <><UserPlus size={18} className="text-primary" /> Register New Patient</> :
                 modal.mode === 'edit' ? <><Edit2 size={18} className="text-primary" /> Edit Patient</> :
                 <>Patient Card</>}
              </h2>
              <button type="button" className="modal-close-btn" onClick={close} disabled={saving} aria-label="Close dialog"><X size={16} /></button>
            </div>

            {modal.mode === 'view' && modal.patient ? (
              <>
                <div className="modal-body view-modal-body">
                  <PatientView
                    patient={modal.patient}
                    records={records.filter(r => r.patientId === modal.patient?.id)}
                    queue={queue.filter(q => q.patientId === modal.patient?.id)}
                    labOrders={labOrders.filter(l => l.patientId === modal.patient?.id)}
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={close}>Close</button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="patient-register-form">
                {formError && <div className="alert alert-danger py-2 px-3 mb-2" role="alert">{formError}</div>}

                <div className="alert alert-info py-2 px-3 mb-3" role="status">
                  <strong>Patient card ID:</strong>{' '}
                  {modal.patient ? <code>{patientCode(modal.patient)}</code> : 'Assigned automatically when this registration is saved.'}
                </div>

                {/* Section 1: Demographics & Personal Info */}
                <div className="patient-register-section">
                  <div className="patient-register-section-title">
                    <Users size={15} className="text-primary" /> Personal Demographics
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">First name *</label>
                      <input
                        required
                        value={form.firstName}
                        onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                        placeholder="First name"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Last name *</label>
                      <input
                        required
                        value={form.lastName}
                        onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                        placeholder="Last name"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Gender *</label>
                      <select
                        value={form.gender}
                        onChange={e => setForm(f => ({ ...f, gender: e.target.value as Gender }))}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Age *</label>
                      <input
                        required
                        type="number"
                        min="0"
                        max="130"
                        step="1"
                        value={form.age}
                        onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                        placeholder="Age in years"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone *</label>
                      <input
                        required
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+251-9..."
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="patient@bru.edu.et"
                      />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Residential Address</label>
                      <input
                        value={form.address}
                        onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                        placeholder="Campus Dormitory / Residence Zone, Town"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Clinical & Institutional Profile */}
                <div className="patient-register-section">
                  <div className="patient-register-section-title">
                    <Activity size={15} className="text-primary" /> Institutional Affiliation &amp; Medical Background
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Patient Type</label>
                      <select
                        value={form.patientType}
                        onChange={e => setForm(f => ({ ...f, patientType: e.target.value as PatientType }))}
                      >
                        <option value="Student">Student</option>
                        <option value="Staff">Staff</option>
                        <option value="External">External</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Department / Faculty</label>
                      <input
                        value={form.department}
                        onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                        placeholder="e.g. Computer Science, Medicine, Law"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Blood Group</label>
                      <select
                        value={form.bloodGroup}
                        onChange={e => setForm(f => ({ ...f, bloodGroup: e.target.value as BloodGroup | '' }))}
                      >
                        <option value="">Not recorded</option>
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
                      <label className="form-label">Known Drug Allergies</label>
                      <input
                        value={form.allergies}
                        onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
                        placeholder="e.g. Penicillin, Sulfa (comma separated)"
                      />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Chronic Conditions / Health History</label>
                      <input
                        value={form.chronicConditions}
                        onChange={e => setForm(f => ({ ...f, chronicConditions: e.target.value }))}
                        placeholder="e.g. Hypertension, Asthma, Diabetes (comma separated)"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Emergency Contact */}
                <div className="patient-register-section">
                  <div className="patient-register-section-title">
                    <HeartPulse size={15} className="text-danger" /> Emergency Contact
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Emergency Contact Name</label>
                      <input
                        value={form.emergencyContactName}
                        onChange={e => setForm(f => ({ ...f, emergencyContactName: e.target.value }))}
                        placeholder="Guardian / Family contact full name"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Emergency Contact Phone</label>
                      <input
                        value={form.emergencyContactPhone}
                        onChange={e => setForm(f => ({ ...f, emergencyContactPhone: e.target.value }))}
                        placeholder="+251-9..."
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Card Dispatch to OPD (When adding only) */}
                {modal.mode === 'add' && canDispatch && (
                  <div className="patient-register-section">
                    <div className="patient-register-section-title">
                      <Send size={15} className="text-primary" /> First Visit Request
                    </div>
                    <label className={`patient-register-dispatch-toggle ${requestDetails.forwardToOpd ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={requestDetails.forwardToOpd}
                          onChange={e => setRequestDetails(d => ({ ...d, forwardToOpd: e.target.checked }))}
                        />
                        <span>
                          <strong>Create a visit request after registration</strong>
                          <small>Route the patient to the selected clinic destination.</small>
                        </span>
                    </label>

                    {requestDetails.forwardToOpd && (
                      <>
                        <div className="form-grid">
                          <div className="form-group">
                            <label className="form-label">Assigned Doctor</label>
                            <select
                              value={requestDetails.doctorId || doctors[0]?.id || ''}
                              onChange={e => setRequestDetails(d => ({ ...d, doctorId: e.target.value }))}
                            >
                              {doctors.length === 0 ? (
                                <option value="">General OPD Duty Clinician</option>
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
                            <label className="form-label">Destination</label>
                            <select
                              value={requestDetails.destination}
                              onChange={e => setRequestDetails(d => ({ ...d, destination: e.target.value as QueueStage }))}
                            >
                              <option value="Doctor Consultation">OPD Doctor Consultation</option>
                              <option value="Emergency">Emergency (ER)</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Priority</label>
                            <select
                              value={requestDetails.priority}
                              onChange={e => setRequestDetails(d => ({ ...d, priority: e.target.value as QueuePriority }))}
                            >
                              <option value="Normal">Normal</option>
                              <option value="Urgent">Urgent</option>
                              <option value="Emergency">Emergency</option>
                            </select>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Reason (Optional)</label>
                          <textarea
                            rows={2}
                            value={requestDetails.reason}
                            onChange={e => setRequestDetails(d => ({ ...d, reason: e.target.value }))}
                            placeholder="Reason for visit or chief complaint (optional)"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="modal-footer" style={{ marginTop: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={close} disabled={saving}>Cancel</button>
                  <LoadingButton type="submit" className="btn btn-primary" loading={saving} loadingLabel={modal.mode === 'edit' ? 'Saving…' : 'Registering…'}>
                    {modal.mode === 'add'
                      ? (canDispatch && requestDetails.forwardToOpd ? <><Send size={16} /> Register &amp; Send to OPD</> : 'Register Patient')
                      : 'Save Changes'}
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
        title="Delete Patient Record"
        message="Are you sure you want to delete this patient record? This action will permanently remove the patient profile and cannot be undone."
        confirmText="Delete Record"
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
    </div>
  );
}

interface PatientViewProps {
  patient: Patient;
  records: MedicalRecord[];
  queue: ClinicQueueItem[];
  labOrders: LabOrder[];
}

function PatientView({ patient: p, records, queue, labOrders }: PatientViewProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'records' | 'labs' | 'visits'>('records');

  return (
    <div className="patient-view">
      <div className="view-summary">
        <div className="view-summary-avatar">{patientInitials(p)}</div>
        <div className="view-summary-copy">
          <h3>{patientFullName(p)}</h3>
          <p>Card {patientCode(p)}</p>
          <div className="view-summary-badges">
            <span className="badge badge-blue">{p.patientType}</span>
            <span className="badge badge-violet">{p.gender}</span>
            {p.bloodGroup && <span className="badge badge-red">{p.bloodGroup}</span>}
            {p.department && <span className="badge badge-gray">{p.department}</span>}
          </div>
        </div>
        <div className="view-summary-stats">
          <div><strong>{records.length}</strong><span>Encounters</span></div>
          <div><strong>{labOrders.length}</strong><span>Lab tests</span></div>
        </div>
      </div>

      <div className="pill-tabs view-tabs">
        <button type="button" className={`pill-tab ${activeTab === 'records' ? 'active' : ''}`} onClick={() => setActiveTab('records')}>
          Records ({records.length})
        </button>
        <button type="button" className={`pill-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          Profile
        </button>
        <button type="button" className={`pill-tab ${activeTab === 'labs' ? 'active' : ''}`} onClick={() => setActiveTab('labs')}>
          Lab ({labOrders.length})
        </button>
        <button type="button" className={`pill-tab ${activeTab === 'visits' ? 'active' : ''}`} onClick={() => setActiveTab('visits')}>
          Visits ({queue.length})
        </button>
      </div>

      {activeTab === 'records' && (
        <div className="view-list">
          {records.length === 0 ? (
            <div className="view-empty">No medical records for this patient yet.</div>
          ) : (
            records.map(rec => (
              <article className="view-card" key={rec.id}>
                <div className="view-card-head">
                  <div>
                    <span className="view-card-eyebrow">{rec.visitDate}</span>
                    <h4>{diagnosisLabel(rec.diagnosis, Boolean(rec.externalReferral))}</h4>
                  </div>
                  <span className="badge badge-gray">{rec.doctorName}</span>
                </div>

                {rec.symptoms && rec.symptoms.length > 0 && (
                  <div className="view-card-row">
                    <span>Symptoms</span>
                    <p>{Array.isArray(rec.symptoms) ? rec.symptoms.join(', ') : rec.symptoms}</p>
                  </div>
                )}

                {rec.prescription && rec.prescription.length > 0 && (
                  <div className="view-card-subsection">
                    <div className="view-subsection-title">Prescription</div>
                    <ul>
                      {rec.prescription.map((rx, idx) => (
                        <li key={idx}>
                          <strong>{rx.medication}</strong> — {rx.dosage || rx.frequency} ({rx.duration || '7 days'})
                          {rx.instructions && <span> · {rx.instructions}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {rec.notes && <p className="view-card-note">Notes: {rec.notes}</p>}
              </article>
            ))
          )}
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="view-info-grid">
          <PVItem label="Card ID" value={patientCode(p)} />
          <PVItem label="Age" value={calculatePatientAge(p.dateOfBirth) !== undefined ? `${calculatePatientAge(p.dateOfBirth)} years` : '—'} />
          <PVItem label="Phone" value={p.phone} />
          <PVItem label="Email" value={p.email || '—'} />
          <PVItem label="Department / Program" value={p.department ?? '—'} />
          <PVItem label="Address" value={p.address || '—'} />
          <PVItem label="Registered Date" value={p.registeredAt} />
          <PVItem label="Known Drug Allergies" value={Array.isArray(p.allergies) ? (p.allergies.join(', ') || 'None reported') : (p.allergies ? String(p.allergies) : 'None reported')} />
          <PVItem label="Chronic Conditions" value={Array.isArray(p.chronicConditions) ? (p.chronicConditions.join(', ') || 'None reported') : (p.chronicConditions ? String(p.chronicConditions) : 'None reported')} />
          <PVItem label="Emergency Contact" value={p.emergencyContactName ? `${p.emergencyContactName} (${p.emergencyContactPhone || 'No phone'})` : 'None provided'} />
        </div>
      )}

      {activeTab === 'labs' && (
        <div className="view-list">
          {labOrders.length === 0 ? (
            <div className="view-empty">No laboratory investigations for this patient.</div>
          ) : (
            labOrders.map(lo => (
              <article className="view-card" key={lo.id}>
                <div className="view-card-head">
                  <h4>{lo.testName} <span className="view-card-meta">({lo.category})</span></h4>
                  <span className={`badge ${lo.status === 'Completed' ? 'badge-green' : 'badge-blue'}`}>{lo.status}</span>
                </div>
                <div className="view-card-row">
                  <span>Ordered by</span>
                  <p>{lo.doctorName} · {formatDateTime12(lo.orderedAt)}</p>
                </div>
                {lo.status === 'Completed' && (
                  <div className="view-result">
                    <strong>Result:</strong> {lo.result} {lo.unit} <span>(Ref: {lo.referenceRange || 'Standard'})</span>
                    {lo.isAbnormal && <span className="badge badge-red">Abnormal</span>}
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
            <div className="view-empty">No queue visits recorded.</div>
          ) : (
            queue.map(q => (
              <div className="view-row" key={q.id}>
                <div className="view-row-main">
                  <strong className="view-mono">{q.tokenNumber}</strong>
                  <span className="badge badge-blue">{q.stage}</span>
                  <div className="view-row-sub">{q.chiefComplaint}</div>
                </div>
                <div className="view-row-meta">
                  {formatTime12(q.registeredTime)}<br />{q.assignedDoctorName || 'General OPD'}
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
