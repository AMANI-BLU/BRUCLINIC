import React, { useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import InfoBox from '../../components/AdminLTE/InfoBox';
import { useAuth } from '../../context/AuthContext';
import type { ClinicQueueItem, Vitals, Priority, LabOrder } from '../../types';
import { firstError, validateRequired } from '../../utils/validation';
import { patientCodeFor, patientNameFor } from '../../utils/patient';
import {
  Stethoscope, Activity, Pill, FlaskConical, CheckCircle2,
  FileText, ChevronRight, X, ShieldAlert, Send, Plus, Trash2,
  HeartPulse, History
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';

interface PrescriptionLine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
}

export default function OpdDashboard() {
  const {
    queue, records, medicines, patients,
    updateQueueItem, sendOpdToLabRequest, sendOpdToPharmacyRequest,
    completeOpdConsultation, addERCase
  } = useClinic();
  const { currentUser } = useAuth();

  const [activeStation, setActiveStation] = useState<'doctor' | 'nurse'>('doctor');
  const [selectedQueueItem, setSelectedQueueItem] = useState<ClinicQueueItem | null>(null);
  const [opdTabFilter, setOpdTabFilter] = useState<'all' | 'card_requests' | 'lab_returned' | 'completed'>('all');

  // Consultation modal / action tab
  const [activeConsultationTab, setActiveConsultationTab] = useState<'overview' | 'lab' | 'pharmacy' | 'vitals'>('overview');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Nurse vitals form
  const [vitalsForm, setVitalsForm] = useState<Vitals>({
    bloodPressure: '120/80',
    heartRate: 75,
    temperature: 36.8,
    spo2: 98,
    respiratoryRate: 18,
    weightKg: 65,
  });

  // Doctor consultation core notes
  const [consultation, setConsultation] = useState({
    diagnosis: '',
    symptoms: '',
    clinicalNotes: '',
  });

  // OPD to Lab request state
  const [labTestName, setLabTestName] = useState('');
  const [labCategory, setLabCategory] = useState<LabOrder['category']>('Hematology');
  const [labSpecimenType, setLabSpecimenType] = useState('');
  const [labPriority, setLabPriority] = useState<Priority>('High');
  const [labClinicalNotes, setLabClinicalNotes] = useState('');

  // OPD to Pharmacy multi-item prescription state
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionLine[]>([]);

  // Queue item categorized lists
  const waitingForNurse = queue.filter(q => q.stage === 'Nurse Triage');
  const waitingForDoctor = queue.filter(q => q.stage === 'Doctor Consultation');
  const atLaboratory = queue.filter(q => q.stage === 'Laboratory');
  const atPharmacy = queue.filter(q => q.stage === 'Pharmacy');
  const completedToday = queue.filter(q => q.stage === 'Completed');

  // Filtered list for the doctor station
  const doctorStationQueue = queue.filter(q => {
    if (opdTabFilter === 'completed') {
      return q.stage === 'Completed';
    }
    if (q.stage !== 'Doctor Consultation') return false;
    if (opdTabFilter === 'card_requests') {
      return !q.labStatus || q.labStatus !== 'Completed';
    }
    if (opdTabFilter === 'lab_returned') {
      return q.labStatus === 'Completed';
    }
    return true;
  });

  const pastMedicalRecords = selectedQueueItem
    ? records.filter(r => r.patientId === selectedQueueItem.patientId)
    : [];

  const handleSelectPatient = (item: ClinicQueueItem) => {
    setSelectedQueueItem(item);
    setFormError(null);
    setActiveConsultationTab('overview');

    if (item.vitals) {
      setVitalsForm({ ...item.vitals });
    } else {
      setVitalsForm({
        bloodPressure: '120/80',
        heartRate: 75,
        temperature: 37.0,
        spo2: 98,
        respiratoryRate: 18,
        weightKg: 65,
      });
    }

    setConsultation({
      diagnosis: item.doctorDiagnosis || '',
      symptoms: item.chiefComplaint || '',
      clinicalNotes: item.consultationNotes || '',
    });

    setLabClinicalNotes(`Suspected condition for ${patientNameFor(patients, item.patientId, item.patientName)}: ${item.chiefComplaint}`);
  };

  const handleSaveNurseVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueueItem) return;
    const error = firstError(...Object.values(validateRequired({ bloodPressure: vitalsForm.bloodPressure }, { bloodPressure: 'Blood pressure' })));
    if (error) {
      setFormError(error);
      return;
    }

    try {
      await updateQueueItem(selectedQueueItem.id, {
        vitals: vitalsForm,
        stage: 'Doctor Consultation',
        requestSource: 'Nurse Triage',
        requestDestination: 'Doctor Consultation',
        requestNotes: `Vitals recorded (BP ${vitalsForm.bloodPressure}, Temp ${vitalsForm.temperature}°C). Sent to OPD Doctor.`,
      });
      setFormError(null);
      setSelectedQueueItem(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not save vitals.');
    }
  };

  // Action 1: Dispatch Diagnostic Request from OPD to Laboratory
  const handleDispatchToLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueueItem) return;

    const error = firstError(...Object.values(validateRequired(
      { labTestName, labSpecimenType },
      { labTestName: 'Diagnostic test', labSpecimenType: 'Specimen type' },
    )));
    if (error) {
      setFormError(error);
      return;
    }

    try {
      await sendOpdToLabRequest(selectedQueueItem.id, {
        testName: labTestName.trim(),
        category: labCategory,
        priority: labPriority,
        specimenType: labSpecimenType.trim(),
        notes: labClinicalNotes || `OPD referral for ${selectedQueueItem.chiefComplaint}`,
        doctorId: selectedQueueItem.assignedDoctorId || '',
        doctorName: selectedQueueItem.assignedDoctorName || currentUser?.name || 'OPD clinician',
      });
      setFormError(null);
      setSelectedQueueItem(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not send the laboratory request.');
    }
  };

  // Action 2: Dispatch Prescription from OPD to Pharmacy
  const handleDispatchToPharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueueItem) return;

    if (prescriptionItems.length === 0) {
      setFormError('Add at least one medication.');
      return;
    }
    const incompleteItem = prescriptionItems.findIndex(item => !item.name.trim() || !item.dosage.trim() || !item.frequency.trim() || !item.duration.trim() || item.quantity < 1);
    if (incompleteItem >= 0) {
      setFormError(`Complete medication ${incompleteItem + 1}.`);
      return;
    }

    // Map to Pharmacy Order medicines
    const formattedMedicines = prescriptionItems.map(item => {
      const matchedMed = medicines.find(m => m.name.toLowerCase().includes(item.name.toLowerCase()));
      return {
        medicineId: matchedMed?.id,
        name: item.name,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        quantity: item.quantity,
        instructions: item.instructions,
      };
    });

    try {
      await sendOpdToPharmacyRequest(selectedQueueItem.id, {
        medicines: formattedMedicines,
        doctorId: selectedQueueItem.assignedDoctorId,
        doctorName: selectedQueueItem.assignedDoctorName || currentUser?.name || 'OPD clinician',
        doctorDiagnosis: consultation.diagnosis || selectedQueueItem.chiefComplaint,
        notes: consultation.clinicalNotes,
      });
      setFormError(null);
      setSelectedQueueItem(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not send the prescription.');
    }
  };

  // Action 3: Complete Consultation & Archive to Patient Card
  const handleCompleteConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueueItem) return;
    const error = firstError(...Object.values(validateRequired({ diagnosis: consultation.diagnosis }, { diagnosis: 'Diagnosis' })));
    if (error) {
      setFormError(error);
      return;
    }

    try {
      await completeOpdConsultation(selectedQueueItem.id, {
        patientId: selectedQueueItem.patientId,
        patientName: selectedQueueItem.patientName,
        doctorId: selectedQueueItem.assignedDoctorId || '',
        doctorName: selectedQueueItem.assignedDoctorName || currentUser?.name || 'OPD clinician',
        visitDate: new Date().toISOString().split('T')[0],
        diagnosis: consultation.diagnosis,
        symptoms: consultation.symptoms ? consultation.symptoms.split(',').map(s => s.trim()) : [selectedQueueItem.chiefComplaint],
        prescription: prescriptionItems.map(p => ({
          medication: p.name,
          dosage: p.dosage,
          frequency: p.frequency,
          duration: p.duration,
          instructions: p.instructions,
        })),
        notes: consultation.clinicalNotes || 'Outpatient clinical visit completed. Patient advised on care.',
      });
      setFormError(null);
      setSelectedQueueItem(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not complete the consultation.');
    }
  };

  // Action 4: Fast-track transfer to Emergency (ER)
  const handleTransferToER = () => {
    if (!selectedQueueItem) return;
    setShowTransferConfirm(true);
  };

  const executeTransferToER = () => {
    if (!selectedQueueItem) return;
    addERCase({
      patientId: selectedQueueItem.patientId,
      patientName: selectedQueueItem.patientName,
      age: (() => {
        const patient = patients.find(item => item.id === selectedQueueItem.patientId);
        return patient ? Math.max(0, new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()) : 0;
      })(),
      gender: patients.find(item => item.id === selectedQueueItem.patientId)?.gender || 'Male',
      arrivalMethod: 'OPD Referral',
      acuity: 'Red',
      chiefComplaint: `OPD Emergency Referral: ${selectedQueueItem.chiefComplaint}. ${consultation.clinicalNotes}`,
      bedNumber: 'Bay 02 (Acute)',
      vitals: vitalsForm,
      attendingDoctor: currentUser?.name || selectedQueueItem.assignedDoctorName || 'OPD clinician',
      status: 'In Treatment',
      criticalNotes: 'Referred urgently from OPD Consultation.',
    });

    updateQueueItem(selectedQueueItem.id, {
      stage: 'Emergency',
      priority: 'Emergency',
      requestSource: 'OPD Consultation',
      requestDestination: 'Emergency',
      requestNotes: 'URGENT: Patient transferred to Emergency Room by OPD Doctor',
    });

    setSelectedQueueItem(null);
  };

  const addPrescriptionRow = () => {
    setPrescriptionItems(prev => [
      ...prev,
      {
        name: '', dosage: '', frequency: '', duration: '', quantity: 1, instructions: '',
      },
    ]);
  };

  const removePrescriptionRow = (index: number) => {
    setPrescriptionItems(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Station switcher */}
      <div className="department-action-row">
        <div className="department-action-control" style={{ display: 'flex', flexWrap: 'wrap', width: '100%', background: 'var(--clr-bg-hover)', padding: 4, borderRadius: 10, border: '1px solid var(--clr-border)', gap: 4 }}>
          <button
            className={`btn btn-sm ${activeStation === 'doctor' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveStation('doctor'); setSelectedQueueItem(null); }}
            style={{ flex: '1 1 200px', borderRadius: 7, padding: '0.45rem 0.95rem', fontWeight: 700, justifyContent: 'center' }}
          >
            <Stethoscope size={14} /> Doctor Consultation ({waitingForDoctor.length})
          </button>
          <button
            className={`btn btn-sm ${activeStation === 'nurse' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveStation('nurse'); setSelectedQueueItem(null); }}
            style={{ flex: '1 1 200px', borderRadius: 7, padding: '0.45rem 0.95rem', fontWeight: 700, justifyContent: 'center' }}
          >
            <Activity size={14} /> Nurse Triage Vitals ({waitingForNurse.length})
          </button>
        </div>
      </div>

      {/* OPD KPI Pipeline Flow Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        <InfoBox tone="info" icon={<Stethoscope size={22} />} value={waitingForDoctor.length} label="In OPD Consultation Queue" detail="From Card Room and Triage" />
        <InfoBox tone="success" icon={<FlaskConical size={22} />} value={atLaboratory.length} label="Diagnostic Tests Ordered" detail="En route to Laboratory" />
        <InfoBox tone="warning" icon={<Pill size={22} />} value={atPharmacy.length} label="Prescriptions Sent" detail="Pending dispensary" />
        <InfoBox tone="secondary" icon={<CheckCircle2 size={22} />} value={completedToday.length} label="Completed Consultations" detail="Archived to patient files" />
      </div>

      {/* Main OPD Station Work Area */}
      <div className={`opd-workspace-layout ${selectedQueueItem ? 'has-active-patient' : ''}`}>
        {/* Left: Patient Queue List */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                {activeStation === 'doctor' ? (
                  <><Stethoscope size={18} className="text-primary" /> OPD Doctor Consultation Queue</>
                ) : (
                  <><Activity size={18} className="text-primary" /> Nurse Triage Vitals Queue</>
                )}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>
                {activeStation === 'doctor' ? 'Card Room requests' : 'Vitals queue'}
              </span>
            </div>

            {activeStation === 'doctor' && (
              <div className="pill-tabs" style={{ fontSize: '0.74rem', flexWrap: 'wrap' }}>
                <button
                  className={`pill-tab ${opdTabFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setOpdTabFilter('all')}
                >
                  All ({waitingForDoctor.length})
                </button>
                <button
                  className={`pill-tab ${opdTabFilter === 'card_requests' ? 'active' : ''}`}
                  onClick={() => setOpdTabFilter('card_requests')}
                >
                  From Card Room
                </button>
                <button
                  className={`pill-tab ${opdTabFilter === 'lab_returned' ? 'active' : ''}`}
                  onClick={() => setOpdTabFilter('lab_returned')}
                  style={{
                    color: waitingForDoctor.filter(q => q.labStatus === 'Completed').length > 0 ? 'var(--clr-primary-400)' : undefined,
                    fontWeight: 700
                  }}
                >
                  Lab Ready ({waitingForDoctor.filter(q => q.labStatus === 'Completed').length})
                </button>
                <button
                  className={`pill-tab ${opdTabFilter === 'completed' ? 'active' : ''}`}
                  onClick={() => setOpdTabFilter('completed')}
                >
                  Completed ({completedToday.length})
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(activeStation === 'doctor' ? doctorStationQueue : waitingForNurse).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--clr-text-muted)', fontSize: '0.875rem' }}>
                <CheckCircle2 size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                No patients waiting in this station queue right now.
              </div>
            ) : (
              (activeStation === 'doctor' ? doctorStationQueue : waitingForNurse).map((item) => {
                const isSelected = selectedQueueItem?.id === item.id;
                const hasLabResults = item.labStatus === 'Completed';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectPatient(item)}
                    style={{
                      padding: '1rem',
                      borderRadius: 10,
                      border: isSelected ? '2px solid var(--clr-primary-500)' : hasLabResults ? '1px solid var(--clr-primary-400)' : '1px solid var(--clr-border)',
                      background: isSelected ? 'rgba(37, 99, 235, 0.08)' : hasLabResults ? 'rgba(37, 99, 235, 0.04)' : 'var(--clr-bg-card)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-blue" style={{ fontFamily: 'monospace', fontWeight: 800 }}>
                          {item.tokenNumber}
                        </span>
                        <span style={{ fontWeight: 800, color: 'var(--clr-text-primary)', fontSize: '0.92rem' }}>
                          {patientNameFor(patients, item.patientId, item.patientName)}
                        </span>
                        <span className="badge badge-gray" style={{ fontSize: '0.68rem' }}>
                          {item.cardStatus || 'Existing Card'}
                        </span>
                      </div>

                      <span className={`badge ${
                        item.priority === 'Emergency' ? 'badge-red' : 'badge-gray'
                      }`} style={{ fontSize: '0.7rem' }}>
                        {item.priority}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-secondary)', marginBottom: '0.5rem' }}>
                      <strong>Complaint:</strong> {item.chiefComplaint}
                    </div>

                    {/* Prominent Lab Results Ready Badge */}
                    {hasLabResults && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'rgba(37, 99, 235, 0.08)', border: '1px solid var(--clr-primary-400)',
                        color: 'var(--clr-primary-400)', padding: '0.35rem 0.65rem', borderRadius: 6,
                        fontSize: '0.74rem', fontWeight: 700, marginBottom: '0.5rem'
                      }}>
                        <FlaskConical size={14} /> LAB RESULTS READY: {item.labTestName} ({item.labResult})
                      </div>
                    )}

                    {/* Vitals Summary Pill */}
                    {item.vitals && (
                      <div style={{
                        display: 'flex', gap: '0.75rem', fontSize: '0.72rem',
                        color: 'var(--clr-text-muted)', background: 'var(--clr-bg-hover)',
                        padding: '0.3rem 0.6rem', borderRadius: 6, flexWrap: 'wrap'
                      }}>
                        <span>BP: <strong style={{ color: 'var(--clr-text-primary)' }}>{item.vitals.bloodPressure || '—'}</strong></span>
                        <span>HR: <strong>{item.vitals.heartRate ? `${item.vitals.heartRate} bpm` : '—'}</strong></span>
                        <span>Temp: <strong style={{ color: (item.vitals.temperature || 0) > 37.5 ? '#f87171' : undefined }}>{item.vitals.temperature ? `${item.vitals.temperature}°C` : '—'}</strong></span>
                        <span>SpO2: <strong>{item.vitals.spo2 ? `${item.vitals.spo2}%` : '—'}</strong></span>
                      </div>
                    )}

                    {/* Allergy warning indicator */}
                    {item.allergies && (Array.isArray(item.allergies) ? item.allergies.length > 0 : Boolean(item.allergies)) && (
                      <div style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 700, marginTop: 4 }}>
                        Allergy Alert: {Array.isArray(item.allergies) ? item.allergies.join(', ') : String(item.allergies)}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>
                        Registered: {item.registeredTime} · {item.assignedOpdRoom || 'OPD 1'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--clr-primary-400)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                        {activeStation === 'doctor' ? 'Open Consultation' : 'Record Vitals'} <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Patient Clinical Workspace */}
        {selectedQueueItem && (
          <div className="card" style={{ borderColor: 'rgba(59,130,246,0.35)', position: 'relative' }}>
            {formError && <div className="alert alert-danger py-2 px-3 mb-3" role="alert">{formError}</div>}
            {/* Patient Header Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--clr-border)', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="badge badge-blue" style={{ fontFamily: 'monospace', fontWeight: 800 }}>
                    {selectedQueueItem.tokenNumber}
                  </span>
                  <span className="badge badge-gray">
                    {selectedQueueItem.cardStatus || 'Existing Card'}
                  </span>
                  <span className="badge badge-blue">
                    {selectedQueueItem.patientType}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--clr-text-primary)' }}>
                  {patientNameFor(patients, selectedQueueItem.patientId, selectedQueueItem.patientName)}
                </h3>
                <span style={{ fontSize: '0.76rem', color: 'var(--clr-text-muted)' }}>
                  Card #{patientCodeFor(patients, selectedQueueItem.patientId)} · Department: {selectedQueueItem.department || 'General'} · Room: {selectedQueueItem.assignedOpdRoom || 'OPD 1'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  title="View Past Medical Card History"
                  onClick={() => setShowHistoryModal(true)}
                  style={{ fontSize: '0.74rem' }}
                >
                  <History size={14} /> Card History ({pastMedicalRecords.length})
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  title="Fast-Track to ER"
                  onClick={handleTransferToER}
                  style={{ fontSize: '0.74rem' }}
                >
                  <HeartPulse size={14} /> ER Transfer
                </button>
                <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setSelectedQueueItem(null)}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Medical Alerts Banner */}
            {selectedQueueItem.allergies && (Array.isArray(selectedQueueItem.allergies) ? selectedQueueItem.allergies.length > 0 : Boolean(selectedQueueItem.allergies)) && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--clr-rose-500)',
                color: 'var(--clr-rose-500)', padding: '0.45rem 0.85rem', borderRadius: 8, fontSize: '0.78rem',
                fontWeight: 700, marginBottom: '0.85rem'
              }}>
                <ShieldAlert size={16} /> ALLERGY WARNING: Allergic to {Array.isArray(selectedQueueItem.allergies) ? selectedQueueItem.allergies.join(', ') : String(selectedQueueItem.allergies)}. Do NOT prescribe contra-indicated drugs.
              </div>
            )}

            {/* ── NURSE FORM ── */}
            {activeStation === 'nurse' && (
              <form onSubmit={handleSaveNurseVitals}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={16} className="text-primary" /> Vitals
                </h4>

                <div className="form-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Blood Pressure (mmHg) *</label>
                    <input
                      required
                      value={vitalsForm.bloodPressure}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, bloodPressure: e.target.value })}
                      placeholder="120/80"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heart Rate (bpm)</label>
                    <input
                      type="number"
                      value={vitalsForm.heartRate}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, heartRate: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Body Temperature (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitalsForm.temperature}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Oxygen SpO2 (%)</label>
                    <input
                      type="number"
                      value={vitalsForm.spo2}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, spo2: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Weight (kg)</label>
                    <input
                      type="number"
                      value={vitalsForm.weightKg}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, weightKg: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Respiratory Rate (/min)</label>
                    <input
                      type="number"
                      value={vitalsForm.respiratoryRate}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, respiratoryRate: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedQueueItem(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <CheckCircle2 size={16} /> Save Vitals &amp; Forward to Doctor Consultation
                  </button>
                </div>
              </form>
            )}

            {/* ── DOCTOR STATION WORKSPACE WITH WORKFLOW ROUTING ── */}
            {activeStation === 'doctor' && (
              <div>
                {/* Returned Lab Results Display Banner */}
                {selectedQueueItem.labStatus === 'Completed' && (
                  <div style={{
                    background: 'var(--clr-bg-surface)',
                    border: '1px solid var(--clr-border)',
                    borderRadius: 10,
                    padding: '0.9rem 1.1rem',
                    marginBottom: '1rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--clr-text-primary)', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                        <FlaskConical size={16} className="text-primary" /> Lab result
                      </h4>
                      <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
                        Completed at {selectedQueueItem.labCompletedAt || 'Today'}
                      </span>
                    </div>

                    <div className="opd-lab-results-grid" style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>
                      <div>
                        <div>Test: <strong>{selectedQueueItem.labTestName}</strong></div>
                        <div>Category: {selectedQueueItem.labCategory || 'Clinical Pathology'}</div>
                      </div>
                      <div style={{
                        background: 'var(--clr-bg-card)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 6,
                        border: selectedQueueItem.labIsAbnormal ? '1px solid var(--clr-rose-500)' : '1px solid var(--clr-border)',
                      }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>Result Findings:</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: selectedQueueItem.labIsAbnormal ? 'var(--clr-rose-500)' : 'var(--clr-primary-400)' }}>
                          {selectedQueueItem.labResult || 'Pending value'} {selectedQueueItem.labUnit}
                        </div>
                        {selectedQueueItem.labReferenceRange && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)' }}>
                            Ref: {selectedQueueItem.labReferenceRange}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Workflow Navigation Sub-tabs */}
                <div style={{
                  display: 'flex', gap: '0.35rem', marginBottom: '1.25rem',
                  background: 'var(--clr-bg-surface)', padding: 4, borderRadius: 8,
                  border: '1px solid var(--clr-border)', flexWrap: 'wrap'
                }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${activeConsultationTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveConsultationTab('overview')}
                    style={{ flex: 1, minWidth: 120, justifyContent: 'center', fontSize: '0.78rem' }}
                  >
                    <FileText size={14} /> 1. Clinical Diagnosis
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${activeConsultationTab === 'lab' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveConsultationTab('lab')}
                    style={{ flex: 1, minWidth: 120, justifyContent: 'center', fontSize: '0.78rem' }}
                  >
                    <FlaskConical size={14} /> 2. Request to Lab
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${activeConsultationTab === 'pharmacy' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveConsultationTab('pharmacy')}
                    style={{ flex: 1, minWidth: 120, justifyContent: 'center', fontSize: '0.78rem' }}
                  >
                    <Pill size={14} /> 3. Request to Pharmacy
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${activeConsultationTab === 'vitals' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveConsultationTab('vitals')}
                    style={{ flex: 0.6, minWidth: 80, justifyContent: 'center', fontSize: '0.78rem' }}
                  >
                    <Activity size={14} /> Vitals
                  </button>
                </div>

                {/* ── TAB 1: CLINICAL DIAGNOSIS & CONSULTATION ── */}
                {activeConsultationTab === 'overview' && (
                  <form onSubmit={handleCompleteConsultation}>
                    <div className="form-grid" style={{ marginBottom: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Primary Diagnosis *</label>
                        <input
                          required
                          value={consultation.diagnosis}
                          onChange={(e) => setConsultation({ ...consultation, diagnosis: e.target.value })}
                          placeholder="e.g. Acute Bronchitis, P. falciparum Malaria, Typhoid Fever..."
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Symptoms Observed</label>
                        <input
                          value={consultation.symptoms}
                          onChange={(e) => setConsultation({ ...consultation, symptoms: e.target.value })}
                          placeholder="e.g. High fever, headache, chills, cough"
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                      <label className="form-label">Clinical Examination Findings &amp; Advice</label>
                      <textarea
                        rows={3}
                        value={consultation.clinicalNotes}
                        onChange={(e) => setConsultation({ ...consultation, clinicalNotes: e.target.value })}
                        placeholder="Physical exam notes, heart/lung sounds, doctor recommendations..."
                      />
                    </div>

                    {/* Quick routing dispatch helper buttons */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'var(--clr-bg-surface)', padding: '0.75rem 1rem',
                      borderRadius: 8, border: '1px solid var(--clr-border)', marginBottom: '1.25rem',
                      flexWrap: 'wrap', gap: '0.5rem'
                    }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>
                        Need tests or medications first?
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setActiveConsultationTab('lab')}
                        >
                          <FlaskConical size={14} /> Order Lab Test First
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setActiveConsultationTab('pharmacy')}
                        >
                          <Pill size={14} /> Prescribe Pharmacy
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setSelectedQueueItem(null)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary">
                        <CheckCircle2 size={16} /> Complete Consultation &amp; Discharge
                      </button>
                    </div>
                  </form>
                )}

                {/* ── TAB 2: REQUEST FROM OPD TO LABORATORY ── */}
                {activeConsultationTab === 'lab' && (
                  <form onSubmit={handleDispatchToLab}>
                    <div style={{
                      background: 'var(--clr-bg-surface)',
                      border: '1px solid var(--clr-border)',
                      borderRadius: 10,
                      padding: '1rem',
                      marginBottom: '1.25rem',
                    }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--clr-text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FlaskConical size={16} className="text-primary" /> Lab order
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--clr-text-secondary)', marginBottom: '1rem' }}>
                        Sends the patient to the laboratory queue.
                      </p>

                      <div className="form-grid" style={{ marginBottom: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">Diagnostic Test *</label>
                          <input value={labTestName} onChange={e => setLabTestName(e.target.value)} placeholder="Enter test name" required />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Category *</label>
                          <select value={labCategory} onChange={e => setLabCategory(e.target.value as LabOrder['category'])}>
                            {['Hematology', 'Biochemistry', 'Parasitology', 'Microbiology', 'Serology', 'Urinalysis'].map(category => <option key={category} value={category}>{category}</option>)}
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Specimen Type *</label>
                          <input value={labSpecimenType} onChange={e => setLabSpecimenType(e.target.value)} placeholder="e.g. Venous blood" required />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Order Priority</label>
                          <select
                            value={labPriority}
                            onChange={(e) => setLabPriority(e.target.value as Priority)}
                          >
                            <option value="High">High Priority (Urgent OPD)</option>
                            <option value="Critical">STAT / Emergency Alert</option>
                            <option value="Medium">Medium (Routine Screen)</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Clinical Indication &amp; Lab Notes</label>
                        <textarea
                          rows={2}
                          value={labClinicalNotes}
                          onChange={(e) => setLabClinicalNotes(e.target.value)}
                          placeholder="e.g. Febrile patient for 2 days, rule out malaria or acute bacteremia..."
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setActiveConsultationTab('overview')}>
                        Back to Clinical Notes
                      </button>
                      <button type="submit" className="btn btn-primary">
                        <Send size={15} /> Dispatch Request to Laboratory
                      </button>
                    </div>
                  </form>
                )}

                {/* ── TAB 3: REQUEST FROM OPD TO PHARMACY ── */}
                {activeConsultationTab === 'pharmacy' && (
                  <form onSubmit={handleDispatchToPharmacy}>
                    <div style={{
                      background: 'var(--clr-bg-surface)',
                      border: '1px solid var(--clr-border)',
                      borderRadius: 10,
                      padding: '1rem',
                      marginBottom: '1.25rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--clr-text-primary)', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                          <Pill size={16} className="text-primary" /> Prescription
                        </h4>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={addPrescriptionRow}
                          style={{ fontSize: '0.74rem' }}
                        >
                          <Plus size={14} /> Add Medicine
                        </button>
                      </div>

                      <p style={{ fontSize: '0.78rem', color: 'var(--clr-text-secondary)', marginBottom: '1rem' }}>
                        Prescribe items for direct fulfillment at the dispensary with automatic inventory tracking.
                      </p>

                      {/* Prescription Rows */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                        {prescriptionItems.map((item, index) => (
                          <div
                            key={index}
                            style={{
                              background: 'var(--clr-bg-surface)',
                              border: '1px solid var(--clr-border)',
                              borderRadius: 8,
                              padding: '0.85rem',
                            }}
                          >
                            <div className="opd-prescription-grid" style={{ marginBottom: '0.5rem' }}>
                              <div>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Medicine Name *</label>
                                <input
                                  required
                                  value={item.name}
                                  onChange={(e) => {
                                    const next = [...prescriptionItems];
                                    next[index].name = e.target.value;
                                    setPrescriptionItems(next);
                                  }}
                                  placeholder="e.g. Amoxicillin 500mg"
                                />
                              </div>

                              <div>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Dosage &amp; Frequency</label>
                                <input
                                  value={item.frequency}
                                  onChange={(e) => {
                                    const next = [...prescriptionItems];
                                    next[index].frequency = e.target.value;
                                    setPrescriptionItems(next);
                                  }}
                                  placeholder="3x daily"
                                />
                              </div>

                              <div>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Duration</label>
                                <input
                                  value={item.duration}
                                  onChange={(e) => {
                                    const next = [...prescriptionItems];
                                    next[index].duration = e.target.value;
                                    setPrescriptionItems(next);
                                  }}
                                  placeholder="5 days"
                                />
                              </div>

                              <div>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Qty</label>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const next = [...prescriptionItems];
                                    next[index].quantity = Number(e.target.value);
                                    setPrescriptionItems(next);
                                  }}
                                />
                              </div>

                              <div className="prescription-action-col" style={{ paddingTop: 18 }}>
                                {prescriptionItems.length > 1 && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm btn-icon"
                                    onClick={() => removePrescriptionRow(index)}
                                    style={{ color: '#f87171' }}
                                    title="Remove medicine"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div>
                              <input
                                value={item.instructions}
                                onChange={(e) => {
                                  const next = [...prescriptionItems];
                                  next[index].instructions = e.target.value;
                                  setPrescriptionItems(next);
                                }}
                                placeholder="Patient instructions (e.g. Take with water after food)"
                                style={{ fontSize: '0.76rem' }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setActiveConsultationTab('overview')}>
                        Back to Clinical Notes
                      </button>
                      <button type="submit" className="btn btn-primary">
                        <Send size={15} /> Dispatch Prescription to Pharmacy
                      </button>
                    </div>
                  </form>
                )}

                {/* ── TAB 4: QUICK VITALS EDIT ── */}
                {activeConsultationTab === 'vitals' && (
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Activity size={16} className="text-primary" /> Vitals
                    </h4>

                    <div className="form-grid" style={{ marginBottom: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Blood Pressure</label>
                        <input
                          value={vitalsForm.bloodPressure}
                          onChange={(e) => setVitalsForm({ ...vitalsForm, bloodPressure: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Heart Rate (bpm)</label>
                        <input
                          type="number"
                          value={vitalsForm.heartRate}
                          onChange={(e) => setVitalsForm({ ...vitalsForm, heartRate: Number(e.target.value) })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Temperature (°C)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={vitalsForm.temperature}
                          onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: Number(e.target.value) })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Oxygen SpO2 (%)</label>
                        <input
                          type="number"
                          value={vitalsForm.spo2}
                          onChange={(e) => setVitalsForm({ ...vitalsForm, spo2: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        if (selectedQueueItem) {
                          updateQueueItem(selectedQueueItem.id, { vitals: vitalsForm });
                          alert('Vitals updated for current visit.');
                        }
                      }}
                    >
                      <CheckCircle2 size={14} /> Update Vitals in Session
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: Historical Records from Patient Card File */}
      {showHistoryModal && selectedQueueItem && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}>
                  <History size={18} className="text-primary" /> Patient history
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>
                  {patientNameFor(patients, selectedQueueItem.patientId, selectedQueueItem.patientName)}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowHistoryModal(false)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pastMedicalRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--clr-text-muted)' }}>
                  No previous clinic visits recorded in archive for this patient card.
                </div>
              ) : (
                pastMedicalRecords.map((rec) => (
                  <div
                    key={rec.id}
                    style={{
                      background: 'var(--clr-bg-surface)',
                      border: '1px solid var(--clr-border)',
                      borderRadius: 10,
                      padding: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 800, color: 'var(--clr-text-primary)' }}>{rec.diagnosis}</span>
                      <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>{rec.visitDate}</span>
                    </div>

                    <div style={{ fontSize: '0.76rem', color: 'var(--clr-text-muted)', marginBottom: '0.5rem' }}>
                      Physician: {rec.doctorName}
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--clr-text-secondary)', marginBottom: '0.5rem' }}>
                      {rec.notes}
                    </div>

                    {rec.prescription && rec.prescription.length > 0 && (
                      <div style={{
                        background: 'var(--clr-bg-hover)',
                        border: '1px solid var(--clr-border)',
                        padding: '0.4rem 0.65rem',
                        borderRadius: 6,
                        fontSize: '0.74rem',
                        color: 'var(--clr-text-secondary)',
                      }}>
                        <strong>Prescribed:</strong> {rec.prescription.map(p => `${p.medication} (${p.dosage})`).join(', ')}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Transfer Confirmation Modal */}
      <ConfirmModal
        isOpen={showTransferConfirm}
        title="Immediate Emergency Transfer"
        message={`Are you sure you want to immediately transfer ${selectedQueueItem ? patientNameFor(patients, selectedQueueItem.patientId, selectedQueueItem.patientName) : 'this patient'} to the Emergency Room (ER)? An acute ER bed will be reserved and priority alert dispatched.`}
        confirmText="Transfer to ER"
        variant="warning"
        icon="alert"
        onClose={() => setShowTransferConfirm(false)}
        onConfirm={() => {
          executeTransferToER();
          setShowTransferConfirm(false);
        }}
      />
    </div>
  );
}
