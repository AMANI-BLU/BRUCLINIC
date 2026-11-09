import React, { useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import type { ClinicQueueItem, QueueStage, QueuePriority, Patient } from '../../types';
import { firstError, validateDate, validatePhone, validateRequired, validateEmail, validateTextLength, sanitizeInput } from '../../utils/validation';
import { patientCode, patientCodeFor, patientFullName, patientMatchesSearch, patientOptionLabel } from '../../utils/patient';
import {
  CreditCard, UserPlus, Search, Plus,
  CheckCircle2, Clock, Activity, X,
  ArrowRight, ShieldAlert, Send, AlertTriangle, Building2, Phone
} from 'lucide-react';
import './ReceptionDashboard.css';
import ModalPortal from '../../components/ModalPortal';
import InfoBox from '../../components/AdminLTE/InfoBox';

export default function ReceptionDashboard() {
  const {
    patients, doctors, queue,
    sendCardToOpdRequest, updateQueueItem, removeFromQueue, addPatient
  } = useClinic();

  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [formType, setFormType] = useState<'existing' | 'new'>('existing');

  // Search query within the existing card lookup
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [patientCardSearch, setPatientCardSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');

  // Routing form states
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [priority, setPriority] = useState<QueuePriority>('Normal');
  const [destinationStage, setDestinationStage] = useState<QueueStage>('Doctor Consultation');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedOpdRoom, setSelectedOpdRoom] = useState('OPD Room 1');
  const [formError, setFormError] = useState<string | null>(null);

  // New patient registration form state
  const [newPatient, setNewPatient] = useState({
    firstName: '',
    lastName: '',
    gender: 'Male' as const,
    dateOfBirth: '',
    phone: '',
    email: '',
    address: '',
    patientType: 'Student' as const,
    department: 'Computer Science',
    bloodGroup: null,
    allergies: '',
    chronicConditions: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });

  // Selected patient card details
  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Filtered patients for Card Search in Modal
  const matchedPatients = patients.filter(p => patientMatchesSearch(p, cardSearchQuery));

  // Filtered Queue for the Table
  const filteredQueue = queue.filter(q => {
    const matchSearch =
      q.patientName.toLowerCase().includes(search.toLowerCase()) ||
      q.tokenNumber.toLowerCase().includes(search.toLowerCase()) ||
      (q.department && q.department.toLowerCase().includes(search.toLowerCase())) ||
      (q.chiefComplaint && q.chiefComplaint.toLowerCase().includes(search.toLowerCase())) ||
      (q.assignedDoctorName && q.assignedDoctorName.toLowerCase().includes(search.toLowerCase()));

    const matchFilter =
      filterStage === 'All' ||
      (filterStage === 'CardToOpd' && (q.stage === 'Doctor Consultation' || q.stage === 'Nurse Triage')) ||
      (filterStage === 'Laboratory' && q.stage === 'Laboratory') ||
      (filterStage === 'Pharmacy' && q.stage === 'Pharmacy') ||
      (filterStage === 'Emergency' && q.stage === 'Emergency') ||
      (filterStage === 'Completed' && q.stage === 'Completed');

    return matchSearch && matchFilter;
  });

  const handleOpenModal = (type: 'existing' | 'new' = 'existing', presetPatientId?: string) => {
    setFormType(type);
    setCardSearchQuery('');
    setChiefComplaint('');
    setFormError(null);
    if (presetPatientId) {
      setSelectedPatientId(presetPatientId);
    } else if (type === 'existing' && patients.length > 0) {
      setSelectedPatientId(patients[0].id);
    } else if (type === 'new') {
      setSelectedPatientId('');
    }
    setModalOpen(true);
  };

  const handleDispatchCardToOpd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const validationError = formType === 'existing'
      ? firstError(
        ...Object.values(validateRequired({ selectedPatientId }, { selectedPatientId: 'Patient' })),
        validateTextLength(chiefComplaint, 'Reason / Chief Complaint', { max: 500 }),
      )
      : firstError(
        ...Object.values(validateRequired(newPatient, {
          firstName: 'First name', lastName: 'Last name', phone: 'Phone', dateOfBirth: 'Date of birth',
        })),
        validateTextLength(newPatient.firstName, 'First name', { min: 2, max: 100, required: true }),
        validateTextLength(newPatient.lastName, 'Last name', { min: 2, max: 100, required: true }),
        validatePhone(newPatient.phone),
        validateDate(newPatient.dateOfBirth, 'Date of birth', { allowFuture: false }),
        newPatient.email ? validateEmail(newPatient.email) : undefined,
        newPatient.emergencyContactPhone ? validatePhone(newPatient.emergencyContactPhone, 'Emergency contact phone') : undefined,
      );
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const effectiveDoctorId = selectedDoctorId || doctors[0]?.id || '';
    const chosenDoctor = doctors.find(d => d.id === effectiveDoctorId);
    const doctorName = chosenDoctor ? `${chosenDoctor.firstName} ${chosenDoctor.lastName}` : (selectedDoctorId ? 'Consulting Doctor' : 'On-Duty Clinician');

    try {
      if (formType === 'existing') {
        if (!selectedPatient) {
          setFormError('Please select a registered patient.');
          return;
        }

        const activeVisit = queue.find(q => q.patientId === selectedPatient.id && q.stage !== 'Completed');
        if (activeVisit) {
          setFormError(`This patient already has an active visit in progress (${activeVisit.stage}, ${activeVisit.tokenNumber}). Complete that visit before sending another request.`);
          return;
        }

        await sendCardToOpdRequest({
          patient: selectedPatient,
          hasExistingCard: true,
          chiefComplaint: sanitizeInput(chiefComplaint) || 'Routine medical examination and OPD consultation',
          priority,
          stage: destinationStage,
          assignedDoctorId: effectiveDoctorId || undefined,
          assignedDoctorName: doctorName,
          assignedOpdRoom: selectedOpdRoom,
        });
      } else {
        // Register New Patient Card first
        const allergyArr = newPatient.allergies
          ? newPatient.allergies.split(',').map(s => sanitizeInput(s)).filter(Boolean)
          : [];
        const chronicArr = newPatient.chronicConditions
          ? newPatient.chronicConditions.split(',').map(s => sanitizeInput(s)).filter(Boolean)
          : [];

        const patientInput: Omit<Patient, 'id' | 'registeredAt'> = {
          firstName: sanitizeInput(newPatient.firstName),
          lastName: sanitizeInput(newPatient.lastName),
          gender: newPatient.gender,
          dateOfBirth: newPatient.dateOfBirth,
          phone: sanitizeInput(newPatient.phone),
          email: sanitizeInput(newPatient.email),
          address: sanitizeInput(newPatient.address),
          patientType: newPatient.patientType,
          department: sanitizeInput(newPatient.department),
          bloodGroup: newPatient.bloodGroup || null,
          allergies: allergyArr,
          chronicConditions: chronicArr,
          emergencyContactName: sanitizeInput(newPatient.emergencyContactName),
          emergencyContactPhone: sanitizeInput(newPatient.emergencyContactPhone),
        };

        const savedPatient = await addPatient(patientInput);

        // Now dispatch the visit request to OPD
        await sendCardToOpdRequest({
          patient: savedPatient,
          hasExistingCard: false,
          chiefComplaint: sanitizeInput(chiefComplaint) || 'New patient file card created & initial consultation requested',
          priority,
          stage: destinationStage,
          assignedDoctorId: effectiveDoctorId || undefined,
          assignedDoctorName: doctorName,
          assignedOpdRoom: selectedOpdRoom,
        });
      }

      setModalOpen(false);
      setChiefComplaint('');
      setFormError(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not route this card to OPD.');
    }
  };

  const handleForwardStage = (item: ClinicQueueItem, nextStage: QueueStage) => {
    updateQueueItem(item.id, {
      stage: nextStage,
      requestSource: 'Card Room',
      requestDestination: nextStage,
      requestNotes: `Card Room re-routed ticket to ${nextStage}`,
    });
  };

  return (
    <div className="reception-dashboard">
      <div className="reception-actions d-flex justify-content-end flex-wrap mb-2">
        <button type="button" className="btn btn-secondary" onClick={() => handleOpenModal('new')}>
          <UserPlus size={16} /> New patient
        </button>
        <button type="button" className="btn btn-primary" onClick={() => handleOpenModal('existing')}>
          <Send size={16} /> Send to OPD
        </button>
      </div>

      {/* KPI Cards */}
      <div className="row reception-kpi-grid g-3 mb-3">
        <div className="col-md-6 col-xl-3">
          <InfoBox
            tone="info"
            icon={<CreditCard size={24} />}
            value={patients.length}
            label="Patient cards"
            detail="Registered in database"
            to="/patients"
            footerText="Manage cards"
          />
        </div>

        <div className="col-md-6 col-xl-3">
          <InfoBox
            tone="success"
            icon={<Activity size={24} />}
            value={queue.filter(q => q.stage === 'Doctor Consultation').length}
            label="OPD queue"
            detail="In doctor consultation"
            onClick={() => setFilterStage('Doctor Consultation')}
            footerText="Filter OPD queue"
          />
        </div>

        <div className="col-md-6 col-xl-3">
          <InfoBox
            tone="warning"
            icon={<Clock size={24} />}
            value={queue.filter(q => q.stage === 'Laboratory').length}
            label="At laboratory"
            detail="Under diagnostic testing"
            onClick={() => setFilterStage('Laboratory')}
            footerText="Filter lab queue"
          />
        </div>

        <div className="col-md-6 col-xl-3">
          <InfoBox
            tone="primary"
            icon={<CheckCircle2 size={24} />}
            value={queue.filter(q => q.stage === 'Pharmacy' || q.stage === 'Completed').length}
            label="Completed"
            detail="Prescriptions & discharged"
            onClick={() => setFilterStage('Completed')}
            footerText="Filter completed"
          />
        </div>
      </div>

      {/* Quick Card Lookup & Dispatch Widget - AdminLTE v3 Card Outline Style */}
      <div className="card card-outline card-primary shadow-sm mb-4">
        <div className="card-header py-2 px-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <span className="reception-heading-icon"><CreditCard size={17} /></span>
            <div>
              <h3 className="card-title m-0 fw-bold" style={{ fontSize: '1rem' }}>
                Patient Cards Directory
              </h3>
              <p className="text-muted small m-0">
                Quick patient card lookup &amp; OPD dispatch
              </p>
            </div>
          </div>

          <div className="card-tools d-flex align-items-center gap-2 flex-wrap">
            <div className="input-group input-group-sm" style={{ width: 220 }}>
              <span className="input-group-text bg-transparent text-muted"><Search size={13} /></span>
              <input
                type="text"
                className="form-control"
                placeholder="Search cards..."
                value={patientCardSearch}
                onChange={(e) => setPatientCardSearch(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm shadow-sm d-inline-flex align-items-center gap-1"
              onClick={() => handleOpenModal('existing')}
            >
              <Plus size={14} /> <span>New OPD Request</span>
            </button>
          </div>
        </div>

        <div className="card-body p-3">
          <div className="reception-cards-grid">
            {patients
              .filter(p => patientMatchesSearch(p, patientCardSearch))
              .slice(0, 6)
              .map(p => {
                const inQueue = queue.find(q => q.patientId === p.id && q.stage !== 'Completed');
                const initials = `${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase();
                const avatarClass = p.patientType === 'Student' ? 'patient-avatar-student' : p.patientType === 'Staff' ? 'patient-avatar-staff' : 'patient-avatar-external';
                const hasAllergies = p.allergies && (Array.isArray(p.allergies) ? p.allergies.length > 0 : Boolean(p.allergies));

                return (
                  <div key={p.id} className="patient-contact-card">
                    {/* Top strip with Category & Patient Code */}
                    <div className="patient-card-top-bar">
                      <span className={`badge ${p.patientType === 'Student' ? 'bg-info-subtle text-info border border-info-subtle' : p.patientType === 'Staff' ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-secondary-subtle text-secondary border'}`} style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                        {p.patientType}
                      </span>
                      <code className="text-muted small px-2 py-0 rounded bg-light border font-monospace" style={{ fontSize: '0.72rem' }}>
                        {patientCode(p)}
                      </code>
                    </div>

                    <div className="p-3 d-flex flex-column justify-content-between flex-grow-1">
                      {/* Avatar & Patient Name */}
                      <div className="d-flex align-items-center gap-3">
                        <div className={`patient-avatar-circle ${avatarClass}`}>
                          {initials || <CreditCard size={18} />}
                        </div>
                        <div className="min-w-0 flex-grow-1">
                          <h5 className="m-0 fw-bold text-truncate" style={{ fontSize: '0.98rem' }} title={patientFullName(p)}>
                            {patientFullName(p)}
                          </h5>
                          <div className="text-muted small text-truncate d-flex align-items-center gap-1 mt-1">
                            <Building2 size={12} className="flex-shrink-0" />
                            <span>{p.department || 'General Patient'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status indicator pill matching AdminLTE 3 callouts */}
                      {hasAllergies ? (
                        <div className="patient-status-alert status-danger">
                          <AlertTriangle size={13} className="flex-shrink-0 text-danger" />
                          <span className="text-truncate">
                            <strong>Allergic:</strong> {Array.isArray(p.allergies) ? p.allergies.join(', ') : String(p.allergies)}
                          </span>
                        </div>
                      ) : inQueue ? (
                        <div className="patient-status-alert status-queue">
                          <Clock size={13} className="flex-shrink-0 text-warning-emphasis" />
                          <span className="text-truncate">
                            In <strong>{inQueue.stage}</strong> <span className="badge bg-warning text-dark ms-1">#{inQueue.tokenNumber}</span>
                          </span>
                        </div>
                      ) : (
                        <div className="patient-status-alert status-ready">
                          <CheckCircle2 size={13} className="flex-shrink-0 text-success" />
                          <span>Ready for Consultation</span>
                        </div>
                      )}

                      {/* Contact metadata */}
                      <div className="patient-contact-meta">
                        <span className="d-flex align-items-center gap-1">
                          <Phone size={12} className="text-muted" />
                          <span>{p.phone || 'No phone'}</span>
                        </span>
                        <span>{p.gender || '—'}{p.bloodGroup ? ` · ${p.bloodGroup}` : ''}</span>
                      </div>

                      {/* Action Button */}
                      <div className="mt-3">
                        {inQueue ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning w-100 disabled text-truncate"
                            style={{ fontSize: '0.75rem', opacity: 0.85, cursor: 'not-allowed' }}
                          >
                            <Clock size={13} className="me-1" />
                            Active in {inQueue.stage} (#{inQueue.tokenNumber})
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm w-100 shadow-sm d-flex align-items-center justify-content-center gap-1"
                            style={{ fontWeight: 600, fontSize: '0.78rem' }}
                            onClick={() => handleOpenModal('existing', p.id)}
                          >
                            <span>Send to OPD</span>
                            <ArrowRight size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Live Dispatched Requests Queue Table */}
      <div className="card reception-panel reception-queue-panel">
        <div className="card-header reception-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} className="text-primary" /> Request pipeline
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>
              Current patient requests
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Filter Tabs */}
            <div className="pill-tabs" style={{ fontSize: '0.78rem' }}>
              {[
                { id: 'All', label: 'All' },
                { id: 'CardToOpd', label: 'OPD / Triage' },
                { id: 'Laboratory', label: 'Laboratory' },
                { id: 'Pharmacy', label: 'Pharmacy' },
                { id: 'Completed', label: 'Completed' },
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`pill-tab ${filterStage === tab.id ? 'active' : ''}`}
                  onClick={() => setFilterStage(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="search-bar" style={{ maxWidth: 240 }}>
              <Search size={15} className="icon" />
              <input
                type="text"
                placeholder="Search queue"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card-body reception-card-body">
        <div className="table-wrapper">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Token</th>
                <th>Patient</th>
                <th>Route</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.length === 0 ? (
                <tr className="empty-state-row">
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon tone-green">
                        <CheckCircle2 size={28} />
                      </div>
                      <h5 className="empty-state-title">
                        {filterStage === 'Completed' ? 'No completed visits yet' :
                         filterStage === 'Laboratory' ? 'No laboratory orders active' :
                         filterStage === 'Pharmacy' ? 'No pharmacy orders active' :
                         filterStage === 'CardToOpd' ? 'No OPD requests in pipeline' :
                         'All caught up! Request pipeline is empty'}
                      </h5>
                      <p className="empty-state-body">
                        {filterStage === 'Completed'
                          ? 'Completed patient visits will appear here once consultations are finished and closed.'
                          : filterStage !== 'All'
                          ? 'No requests match the selected filter. Try a different category or check another tab.'
                          : 'No active OPD or department requests. Use the Send to OPD button to dispatch a patient card to a clinician.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredQueue.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="badge badge-blue" style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.85rem' }}>
                        {item.tokenNumber}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>{item.patientName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>
                        ID: {patientCodeFor(patients, item.patientId)} · {item.department || 'General'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                        {item.assignedDoctorName || 'Unassigned'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>
                        {item.assignedOpdRoom || 'OPD Room 1'}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        item.priority === 'Emergency' ? 'badge-red' : 'badge-gray'
                      }`}>
                        {item.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        item.stage === 'Emergency' ? 'badge-red' :
                        item.stage === 'Completed' ? 'badge-gray' : 'badge-blue'
                      }`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Activity size={12} /> {item.stage}
                      </span>
                    </td>
                    <td>
                      {item.stage === 'Completed' ? (
                        <span className="badge text-bg-secondary">Closed</span>
                      ) : (
                        <div className="reception-queue-actions">
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Forward to Doctor Consultation"
                            onClick={() => handleForwardStage(item, 'Doctor Consultation')}
                            style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                          >
                            Doctor
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            title="Fast-Track to Emergency"
                            onClick={() => handleForwardStage(item, 'Emergency')}
                            style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                          >
                            ER
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--clr-rose-400)', fontSize: '0.72rem', padding: '0.25rem 0.45rem' }}
                            title="Discharge / Remove"
                            onClick={() => removeFromQueue(item.id)}
                          >
                            End
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>

      {/* Compact card lookup and dispatch dialog */}
      {modalOpen && (
        <ModalPortal>
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal reception-request-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header reception-request-header">
              <h2 className="modal-title">
                {formType === 'existing' ? <><CreditCard size={16} className="text-primary" /> Send to OPD</> : <><UserPlus size={16} className="text-primary" /> New patient</>}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form className="reception-request-form" onSubmit={handleDispatchCardToOpd}>
              {formError && <div className="alert alert-danger py-2 px-3" role="alert">{formError}</div>}
              <div className="reception-mode-tabs">
                <button
                  type="button"
                  className={`btn ${formType === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setFormType('existing');
                    setCardSearchQuery('');
                    if (patients[0]) setSelectedPatientId(patients[0].id);
                  }}
                >
                  <Search size={16} /> Existing card
                </button>
                <button
                  type="button"
                  className={`btn ${formType === 'new' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setFormType('new');
                    setSelectedPatientId('');
                  }}
                >
                  <UserPlus size={16} /> New card
                </button>
              </div>

              {/* ── MODE 1: EXISTING CARD SELECTION & DOSSIER ── */}
              {formType === 'existing' ? (
                <div className="reception-modal-section">
                  <div className="form-group">
                    <label className="form-label">Find a patient *</label>
                    <div className="search-bar" style={{ width: '100%' }}>
                      <Search size={16} className="icon" />
                      <input
                        type="text"
                        placeholder="Name, card ID or phone"
                        value={cardSearchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCardSearchQuery(val);
                          const matches = patients.filter(p => patientMatchesSearch(p, val));
                          if (matches.length > 0 && !matches.some(p => p.id === selectedPatientId)) {
                            setSelectedPatientId(matches[0].id);
                          } else if (matches.length === 0) {
                            setSelectedPatientId('');
                          }
                        }}
                        autoFocus
                      />
                    </div>
                  </div>

                  {matchedPatients.length === 0 && (
                    <div className="empty-state" style={{ padding: '1.25rem', background: 'var(--clr-bg-hover)', borderRadius: 8, margin: '0.5rem 0' }}>
                      <div className="empty-state-icon tone-blue" style={{ width: 38, height: 38, margin: '0 auto 0.5rem' }}><Search size={18} /></div>
                      <h5 className="empty-state-title" style={{ fontSize: '0.88rem' }}>No matching patient card</h5>
                      <p className="empty-state-body" style={{ fontSize: '0.78rem', marginBottom: '0.75rem' }}>No registered patient matches "{cardSearchQuery}". You can register them directly.</p>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormType('new')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '0 auto' }}>
                        <UserPlus size={13} /> Register New Patient
                      </button>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Patient card</label>
                    <select
                      required
                      value={selectedPatientId}
                      onChange={(e) => setSelectedPatientId(e.target.value)}
                    >
                      <option value="">Select a patient</option>
                      {matchedPatients.map(p => (
                        <option key={p.id} value={p.id}>
                          {patientOptionLabel(p)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPatient && (
                    <div className="reception-selected-patient">
                      <div>
                        <strong>{patientFullName(selectedPatient)}</strong>
                        <span>{patientCode(selectedPatient)} · {selectedPatient.department || 'General'}</span>
                      </div>
                      {selectedPatient.allergies && (Array.isArray(selectedPatient.allergies) ? selectedPatient.allergies.length > 0 : Boolean(selectedPatient.allergies)) && (
                        <div className="reception-allergy-alert">
                          <ShieldAlert size={14} /> {Array.isArray(selectedPatient.allergies) ? selectedPatient.allergies.join(', ') : String(selectedPatient.allergies)}
                        </div>
                      )}
                      {queue.find(q => q.patientId === selectedPatient.id && q.stage !== 'Completed') && (
                        <div className="alert alert-warning py-2 px-3 mt-2" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <AlertTriangle size={15} />
                          <span>
                            <strong>Active visit in progress:</strong> Currently in <strong>{queue.find(q => q.patientId === selectedPatient.id && q.stage !== 'Completed')?.stage}</strong> (#{queue.find(q => q.patientId === selectedPatient.id && q.stage !== 'Completed')?.tokenNumber}). You cannot send duplicate requests until completed.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="reception-modal-section">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">First name *</label>
                      <input
                        required
                        value={newPatient.firstName}
                        onChange={(e) => setNewPatient({ ...newPatient, firstName: e.target.value })}
                        placeholder="First name"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Last name *</label>
                      <input
                        required
                        value={newPatient.lastName}
                        onChange={(e) => setNewPatient({ ...newPatient, lastName: e.target.value })}
                        placeholder="Last name"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Patient type</label>
                      <select
                        value={newPatient.patientType}
                        onChange={(e) => setNewPatient({ ...newPatient, patientType: e.target.value as typeof newPatient.patientType })}
                      >
                        <option value="Student">Student</option>
                        <option value="Staff">Staff</option>
                        <option value="External">External</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone *</label>
                      <input
                        required
                        value={newPatient.phone}
                        onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                        placeholder="Phone number"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date of birth *</label>
                      <input
                        required
                        type="date"
                        value={newPatient.dateOfBirth}
                        onChange={(e) => setNewPatient({ ...newPatient, dateOfBirth: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Gender</label>
                      <select
                        value={newPatient.gender}
                        onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value as typeof newPatient.gender })}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="reception-modal-section">
                <div className="reception-section-title"><Send size={15} className="text-primary" /> Request details</div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Doctor</label>
                    <select
                      value={selectedDoctorId || doctors[0]?.id || ''}
                      onChange={(e) => {
                        setSelectedDoctorId(e.target.value);
                        const doc = doctors.find(d => d.id === e.target.value);
                        if (doc) {
                          setSelectedOpdRoom(
                            doc.specialization === 'Dental' ? 'Dental OPD' :
                            doc.specialization === 'Gynecology' ? 'OPD Room 2' :
                            'OPD Room 1'
                          );
                        }
                      }}
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
                      value={destinationStage}
                      onChange={(e) => setDestinationStage(e.target.value as QueueStage)}
                    >
                      <option value="Doctor Consultation">OPD doctor</option>
                      <option value="Emergency">Emergency</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as QueuePriority)}
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
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    placeholder="Reason for visit or chief complaint (optional)"
                  />
                </div>

              </div>

              <div className="reception-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={Boolean(formType === 'existing' && selectedPatient && queue.some(q => q.patientId === selectedPatient.id && q.stage !== 'Completed'))}
                >
                  <Send size={16} /> Send
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
