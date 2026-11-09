import React, { useState, useCallback, useMemo } from 'react';
import { useClinic } from '../../context/ClinicContext';
import InfoBox from '../../components/AdminLTE/InfoBox';
import { useAuth } from '../../context/AuthContext';
import type { ClinicQueueItem, Vitals, Priority } from '../../types';
import { firstError, validateRequired } from '../../utils/validation';
import { patientCodeFor, patientNameFor } from '../../utils/patient';
import {
  Stethoscope, Activity, Pill, FlaskConical, CheckCircle2,
  FileText, ChevronRight, X, ShieldAlert, Send, Plus, Trash2,
  HeartPulse, History, Building2, ShoppingBag, Printer
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import MedicineSearchSelect from '../../components/MedicineSearchSelect';
import DiagnosisField from '../../components/DiagnosisField';
import ModalPortal from '../../components/ModalPortal';
import ReferralPrintModal from '../../components/ReferralPrintModal';
import { LAB_PANELS } from '../../utils/labPresets';
import './OpdDashboard.css';

interface PrescriptionLine {
  medicineId?: string;
  name: string;
  instructions?: string;
  stockAvailable?: number;
  unit?: string;
  isExternal?: boolean;
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

export default function OpdDashboard() {
  const {
    queue, records, medicines, patients, doctors,
    updateQueueItem, sendOpdToLabRequest, sendOpdToPharmacyRequest,
    completeOpdConsultation, saveOpdAssessment, referOutside, addERCase
  } = useClinic();
  const { currentUser } = useAuth();

  const [activeStation, setActiveStation] = useState<'doctor' | 'nurse'>('doctor');
  const [selectedQueueItem, setSelectedQueueItem] = useState<ClinicQueueItem | null>(null);
  const [opdTabFilter, setOpdTabFilter] = useState<'all' | 'card_requests' | 'lab_returned' | 'completed'>('all');
  const [doctorQueueScope, setDoctorQueueScope] = useState<'my' | 'all'>('my');

  // Consultation modal / action tab
  const [activeConsultationTab, setActiveConsultationTab] = useState<'overview' | 'lab' | 'pharmacy' | 'vitals'>('overview');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [showOutsideReferral, setShowOutsideReferral] = useState(false);
  const [referralDestination, setReferralDestination] = useState('');
  const [referralReason, setReferralReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [assessmentSaved, setAssessmentSaved] = useState(false);
  const [printedReferral, setPrintedReferral] = useState<{
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
    vitals?: Vitals;
    symptoms?: string[];
    notes?: string;
    allergies?: string[];
  } | null>(null);

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
  const [labCategory, setLabCategory] = useState('Hematology');
  const [labSpecimenType, setLabSpecimenType] = useState('');
  const [labPriority, setLabPriority] = useState<Priority>('High');
  const [labClinicalNotes, setLabClinicalNotes] = useState('');
  const [labTechInstructions, setLabTechInstructions] = useState('');
  const [labTests, setLabTests] = useState<Array<{ testName: string; category: string; specimenType: string; technologistInstructions: string }>>([]);

  // OPD to Pharmacy multi-item prescription state
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionLine[]>([]);

  // Check if a queue item was assigned by the receptionist to this OPD clinician
  const isAssignedToCurrentDoctor = useCallback((q: ClinicQueueItem) => {
    // Admin can view all patients across all doctor stations
    if (currentUser?.role === 'admin') return true;

    // If no specific doctor was selected (unassigned pool), it's visible to all OPD doctors
    if (!q.assignedDoctorId && !q.assignedDoctorName) return true;

    // Check doctor match by user ID
    if (q.assignedDoctorId && currentUser?.id && q.assignedDoctorId === currentUser.id) {
      return true;
    }

    // Check doctor match by doctor record in doctors list
    if (q.assignedDoctorId && doctors?.length) {
      const docMatch = doctors.find(d => d.id === q.assignedDoctorId);
      if (docMatch && (
        docMatch.id === currentUser?.id ||
        (currentUser?.email && docMatch.email?.toLowerCase() === currentUser.email.toLowerCase())
      )) {
        return true;
      }
    }

    // Check doctor match by name (case-insensitive substring/equality without Dr. prefix)
    if (q.assignedDoctorName && currentUser?.name) {
      const cleanDoc = q.assignedDoctorName.replace(/^(dr\.?|doctor)\s+/i, '').trim().toLowerCase();
      const cleanUser = currentUser.name.replace(/^(dr\.?|doctor)\s+/i, '').trim().toLowerCase();
      if (cleanDoc === cleanUser || cleanDoc.includes(cleanUser) || cleanUser.includes(cleanDoc)) {
        return true;
      }
    }

    return false;
  }, [currentUser, doctors]);

  // Queue item categorized lists
  const waitingForNurse = queue.filter(q => q.stage === 'Nurse Triage');

  // Categorized lists filtered by assigned doctor when in "my" scope
  const waitingForDoctor = queue.filter(q =>
    q.stage === 'Doctor Consultation' && (doctorQueueScope === 'all' || isAssignedToCurrentDoctor(q))
  );
  const atLaboratory = queue.filter(q =>
    q.stage === 'Laboratory' && (doctorQueueScope === 'all' || isAssignedToCurrentDoctor(q))
  );
  const atPharmacy = queue.filter(q =>
    q.stage === 'Pharmacy' && (doctorQueueScope === 'all' || isAssignedToCurrentDoctor(q))
  );
  const completedToday = queue.filter(q =>
    q.stage === 'Completed' && (doctorQueueScope === 'all' || isAssignedToCurrentDoctor(q))
  );

  const totalAssignedToMe = useMemo(() => {
    return queue.filter(q => q.stage === 'Doctor Consultation' && isAssignedToCurrentDoctor(q)).length;
  }, [queue, isAssignedToCurrentDoctor]);

  const totalOpdDoctorQueue = useMemo(() => {
    return queue.filter(q => q.stage === 'Doctor Consultation').length;
  }, [queue]);

  // Filtered list for the doctor station
  const doctorStationQueue = queue.filter(q => {
    if (doctorQueueScope === 'my' && !isAssignedToCurrentDoctor(q)) return false;
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
  const isCompletedReview = selectedQueueItem?.stage === 'Completed';

  const handleSelectPatient = (item: ClinicQueueItem) => {
    setSelectedQueueItem(item);
    setFormError(null);
    setAssessmentSaved(false);
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
    setPrescriptionItems([]);
    setLabTestName('');
    setLabSpecimenType('');
    setLabTests([]);

    setLabClinicalNotes(item.labNotes || `Clinical indication: ${item.chiefComplaint}`);
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

    const error = labTests.length === 0
      ? firstError(...Object.values(validateRequired(
        { labTestName, labSpecimenType },
        { labTestName: 'Diagnostic test', labSpecimenType: 'Specimen type' },
      )))
      : undefined;
    if (error) {
      setFormError(error);
      return;
    }

    try {
      await sendOpdToLabRequest(selectedQueueItem.id, {
        priority: labPriority,
        ...(labTests.length ? { tests: labTests } : {
          testName: labTestName.trim(), category: labCategory, specimenType: labSpecimenType.trim(),
        }),
        notes: labClinicalNotes || `OPD referral for ${selectedQueueItem.chiefComplaint}`,
        doctorId: selectedQueueItem.assignedDoctorId || '',
        doctorName: selectedQueueItem.assignedDoctorName || currentUser?.name || 'OPD clinician',
        doctorDiagnosis: consultation.diagnosis.trim(),
        consultationNotes: consultation.clinicalNotes.trim(),
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

    const primaryDiagnosis = (consultation.diagnosis || selectedQueueItem.doctorDiagnosis || '').trim();
    if (prescriptionItems.length === 0) {
      setFormError('Add at least one medication.');
      return;
    }
    const incompleteItem = prescriptionItems.findIndex(item => !item.name.trim());
    if (incompleteItem >= 0) {
      const item = prescriptionItems[incompleteItem];
      const missingFields: string[] = [];
      if (!item.name.trim()) missingFields.push('medicine name');
      setFormError(`Medication ${incompleteItem + 1}: enter ${missingFields.join(', ')}.`);
      return;
    }

    const insufficientClinicItem = prescriptionItems.findIndex(item => {
      if (item.isExternal) return false;
      const catalogMedicine = item.medicineId
        ? medicines.find(medicine => medicine.id === item.medicineId)
        : medicines.find(medicine => medicine.name.toLowerCase() === item.name.trim().toLowerCase());
      return catalogMedicine && catalogMedicine.stock <= 0;
    });
    if (insufficientClinicItem >= 0) {
      setFormError(`Medication ${insufficientClinicItem + 1} is out of stock in the clinic. Choose Outside purchase instead.`);
      return;
    }

    // Map to Pharmacy Order medicines with guaranteed catalogue resolution
    const formattedMedicines = prescriptionItems.map(item => {
      const matchedMed = item.medicineId
        ? medicines.find(m => m.id === item.medicineId)
        : medicines.find(m => m.name.toLowerCase() === item.name.trim().toLowerCase())
        || medicines.find(m => m.name.toLowerCase().includes(item.name.trim().toLowerCase()));

      const isExternal = Boolean(item.isExternal || !matchedMed);

      return {
        medicineId: !isExternal ? (matchedMed?.id || item.medicineId) : undefined,
        name: matchedMed?.name || item.name.trim(),
        quantity: 0,
        instructions: isExternal ? 'Purchase from outside retail pharmacy' : '',
        isExternal,
      };
    });

    try {
      await sendOpdToPharmacyRequest(selectedQueueItem.id, {
        medicines: formattedMedicines,
        doctorId: selectedQueueItem.assignedDoctorId,
        doctorName: selectedQueueItem.assignedDoctorName || currentUser?.name || 'OPD clinician',
        doctorDiagnosis: primaryDiagnosis,
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
    if (error) { setFormError(error); return; }

    try {
      await completeOpdConsultation(selectedQueueItem.id, {
        patientId: selectedQueueItem.patientId,
        patientName: selectedQueueItem.patientName,
        doctorId: selectedQueueItem.assignedDoctorId || '',
        doctorName: selectedQueueItem.assignedDoctorName || currentUser?.name || 'OPD clinician',
        visitDate: new Date().toISOString().split('T')[0],
        diagnosis: consultation.diagnosis,
        symptoms: consultation.symptoms ? consultation.symptoms.split(',').map(s => s.trim()) : [selectedQueueItem.chiefComplaint],
        vitals: vitalsForm,
        notes: consultation.clinicalNotes || 'Outpatient clinical visit completed. Patient advised on care.',
      });
      setFormError(null);
      setSelectedQueueItem(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not complete the consultation.');
    }
  };

  const handleSaveAssessment = async () => {
    if (!selectedQueueItem) return;
    try {
      await saveOpdAssessment(selectedQueueItem.id, {
        doctorId: selectedQueueItem.assignedDoctorId || '',
        doctorName: selectedQueueItem.assignedDoctorName || currentUser?.name || 'OPD clinician',
        visitDate: new Date().toISOString().slice(0, 10),
        diagnosis: consultation.diagnosis,
        symptoms: consultation.symptoms.split(',').map(value => value.trim()).filter(Boolean),
        vitals: vitalsForm,
        notes: consultation.clinicalNotes,
      });
      setFormError(null);
      setAssessmentSaved(true);
      window.dispatchEvent(new CustomEvent('bruclinic:action-success', { detail: 'Assessment saved. The visit remains open for lab or pharmacy requests.' }));
    } catch (cause) {
      setAssessmentSaved(false);
      setFormError(cause instanceof Error ? cause.message : 'Could not save this assessment.');
    }
  };

  // Pressing Enter inside a form field must never complete and close a visit by accident.
  const preventEnterCompletion = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter') return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
      event.preventDefault();
    }
  };

  const handleReferOutside = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedQueueItem) return;
    const error = firstError(...Object.values(validateRequired(
      { referralDestination, referralReason },
      { referralDestination: 'Referral destination', referralReason: 'Referral reason' },
    )));
    if (error) { setFormError(error); return; }
    try {
      const patient = patients.find(p => p.id === selectedQueueItem.patientId);
      const referralSlipData = {
        patientName: patientNameFor(patients, selectedQueueItem.patientId, selectedQueueItem.patientName),
        patientCode: patientCodeFor(patients, selectedQueueItem.patientId),
        patientAge: calculateAge(patient?.dateOfBirth),
        patientGender: patient?.gender,
        patientType: patient?.patientType,
        patientDepartment: patient?.department,
        doctorName: currentUser?.name || selectedQueueItem.assignedDoctorName || 'OPD clinician',
        destination: referralDestination.trim(),
        reason: referralReason.trim(),
        diagnosis: consultation.diagnosis,
        vitals: vitalsForm,
        symptoms: consultation.symptoms.split(',').map(value => value.trim()).filter(Boolean),
        notes: consultation.clinicalNotes,
        allergies: Array.isArray(selectedQueueItem.allergies) ? selectedQueueItem.allergies : selectedQueueItem.allergies ? [String(selectedQueueItem.allergies)] : [],
      };

      await referOutside(selectedQueueItem.id, {
        destination: referralDestination.trim(),
        reason: referralReason.trim(),
        doctorName: currentUser?.name || selectedQueueItem.assignedDoctorName || 'OPD clinician',
        recordData: {
          doctorId: selectedQueueItem.assignedDoctorId || '',
          doctorName: currentUser?.name || selectedQueueItem.assignedDoctorName || 'OPD clinician',
          diagnosis: consultation.diagnosis,
          symptoms: consultation.symptoms.split(',').map(value => value.trim()).filter(Boolean),
          vitals: vitalsForm,
          notes: consultation.clinicalNotes,
        },
      });
      setShowOutsideReferral(false);
      setSelectedQueueItem(null);
      setReferralDestination('');
      setReferralReason('');
      setPrintedReferral(referralSlipData);
      window.dispatchEvent(new CustomEvent('bruclinic:action-success', { detail: 'Patient referred outside successfully. Referral slip ready for printing.' }));
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not record this referral.');
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
        name: '',
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
      <div className="opd-kpi-grid">
        <InfoBox tone="info" icon={<Stethoscope size={22} />} value={waitingForDoctor.length} label="In OPD Consultation Queue" detail="From Card Room and Triage" />
        <InfoBox tone="success" icon={<FlaskConical size={22} />} value={atLaboratory.length} label="Diagnostic Tests Ordered" detail="En route to Laboratory" />
        <InfoBox tone="warning" icon={<Pill size={22} />} value={atPharmacy.length} label="Prescriptions Sent" detail="Pending dispensary" />
        <InfoBox tone="secondary" icon={<CheckCircle2 size={22} />} value={completedToday.length} label="Completed Consultations" detail="Archived to patient files" />
      </div>

      {/* Main OPD Station Work Area */}
      <div className={`opd-workspace-layout ${selectedQueueItem ? 'has-active-patient' : ''}`}>
        {/* Left: Patient Queue List */}
        <div className="card opd-queue-panel">
          <div className="opd-queue-header">
            <div className="opd-queue-heading">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, width: '100%' }}>
                <h3 style={{ margin: 0 }}>
                  {activeStation === 'doctor' ? (
                    <><Stethoscope size={18} className="text-primary" /> OPD Doctor Consultation Queue</>
                  ) : (
                    <><Activity size={18} className="text-primary" /> Nurse Triage Vitals Queue</>
                  )}
                </h3>

                {activeStation === 'doctor' && (
                  <div className="pill-tabs" style={{ background: 'var(--clr-bg-hover)', padding: '2px 4px', borderRadius: 8, border: '1px solid var(--clr-border)' }}>
                    <button
                      type="button"
                      className={`pill-tab ${doctorQueueScope === 'my' ? 'active' : ''}`}
                      onClick={() => setDoctorQueueScope('my')}
                      title="Only patients assigned to you by Receptionist"
                    >
                      Assigned to Me ({totalAssignedToMe})
                    </button>
                    <button
                      type="button"
                      className={`pill-tab ${doctorQueueScope === 'all' ? 'active' : ''}`}
                      onClick={() => setDoctorQueueScope('all')}
                      title="All patients in OPD consultation queue"
                    >
                      All Doctors ({totalOpdDoctorQueue})
                    </button>
                  </div>
                )}
              </div>
              <span className="opd-queue-subtitle">
                {activeStation === 'doctor'
                  ? (doctorQueueScope === 'my'
                      ? `Patients specifically assigned to ${currentUser?.name ? 'Dr. ' + currentUser.name.replace(/^(dr\.?|doctor)\s+/i, '') : 'your station'} by receptionist`
                      : 'All Card Room requests and patients returning from Laboratory across all OPD clinicians')
                  : 'Patients awaiting triage and vital signs'}
              </span>
            </div>

            {activeStation === 'doctor' && (
              <div className="pill-tabs opd-queue-filters">
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
                        {opdTabFilter === 'completed' ? 'Review Visit' : activeStation === 'doctor' ? 'Start Consultation' : 'Record Vitals'} <ChevronRight size={14} />
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
          <div className="card opd-consultation-panel" style={{ borderColor: 'rgba(59,130,246,0.35)', position: 'relative' }}>
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
                {selectedQueueItem.externalReferral && (
                  <button
                    type="button"
                    className="btn btn-warning btn-sm"
                    title="Print Official Referral Document"
                    onClick={() => {
                      const patient = patients.find(p => p.id === selectedQueueItem.patientId);
                      setPrintedReferral({
                        patientName: patientNameFor(patients, selectedQueueItem.patientId, selectedQueueItem.patientName),
                        patientCode: patientCodeFor(patients, selectedQueueItem.patientId),
                        patientAge: calculateAge(patient?.dateOfBirth),
                        patientGender: patient?.gender,
                        patientType: patient?.patientType,
                        patientDepartment: patient?.department,
                        doctorName: selectedQueueItem.externalReferral?.referredBy || currentUser?.name || 'OPD clinician',
                        destination: selectedQueueItem.externalReferral?.destination || 'Hospital',
                        reason: selectedQueueItem.externalReferral?.reason || '',
                        diagnosis: consultation.diagnosis,
                        vitals: selectedQueueItem.vitals,
                        symptoms: consultation.symptoms.split(',').map(v => v.trim()).filter(Boolean),
                        notes: consultation.clinicalNotes,
                        allergies: Array.isArray(selectedQueueItem.allergies) ? selectedQueueItem.allergies : selectedQueueItem.allergies ? [String(selectedQueueItem.allergies)] : [],
                      });
                    }}
                    style={{ fontSize: '0.74rem' }}
                  >
                    <Printer size={14} /> Print Referral Slip
                  </button>
                )}
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

                <div className="opd-form-actions">
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
            {activeStation === 'doctor' && isCompletedReview && (
              <section className="alert alert-info mb-3" aria-label="Completed visit review">
                <strong>Completed visit, read-only.</strong> This encounter is closed. Review the saved diagnosis, notes, and patient history; create a new queue visit for another consultation.
                <div className="mt-2"><strong>Diagnosis:</strong> {selectedQueueItem.doctorDiagnosis || 'Not recorded'}</div>
                {selectedQueueItem.consultationNotes && <div className="mt-1"><strong>Clinical notes:</strong> {selectedQueueItem.consultationNotes}</div>}
                {selectedQueueItem.completedAt && <div className="mt-1"><strong>Completed:</strong> {selectedQueueItem.completedAt}</div>}
              </section>
            )}

            {activeStation === 'doctor' && !isCompletedReview && (
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
                <div className="opd-consultation-tabs">
                  <button
                    type="button"
                    className={`btn btn-sm opd-consultation-tab ${activeConsultationTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveConsultationTab('overview')}
                  >
                    <FileText size={14} /> 1. Assessment
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm opd-consultation-tab ${activeConsultationTab === 'lab' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveConsultationTab('lab')}
                  >
                    <FlaskConical size={14} /> 2. Lab Request
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm opd-consultation-tab ${activeConsultationTab === 'pharmacy' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveConsultationTab('pharmacy')}
                  >
                    <Pill size={14} /> 3. Prescription
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm opd-consultation-tab ${activeConsultationTab === 'vitals' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveConsultationTab('vitals')}
                  >
                    <Activity size={14} /> Vitals
                  </button>
                </div>

                {/* ── TAB 1: ASSESSMENT & CONSULTATION ── */}
                {activeConsultationTab === 'overview' && (
                  <form onSubmit={handleCompleteConsultation} onKeyDown={preventEnterCompletion}>
                    {assessmentSaved && (
                      <div className="alert alert-success py-2 px-3" role="status">
                        <CheckCircle2 size={15} /> Assessment saved. This visit is still open — you can now request labs or send a prescription.
                      </div>
                    )}
                    <div className="form-grid" style={{ marginBottom: '1rem' }}>
                      <DiagnosisField
                        label="Primary Diagnosis"
                        required
                        value={consultation.diagnosis}
                        onChange={diagnosis => setConsultation({ ...consultation, diagnosis })}
                        diagnoses={records.map(record => record.diagnosis)}
                        placeholder="Enter the diagnosis supported by the assessment and results"
                      />
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
                    <div className="opd-quick-actions">
                      <div className="opd-quick-actions-label">Need another action before completing this visit?</div>
                      <div className="opd-quick-action-buttons">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setActiveConsultationTab('lab')}
                        >
                          <FlaskConical size={14} /> Request Another Lab Test
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

                    <p className="text-muted" role="note">
                      Save assessment as draft to order lab tests or prescribe medicines without closing the visit.
                    </p>
                    <div className="opd-form-actions" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setSelectedQueueItem(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-info"
                        onClick={handleSaveAssessment}
                        title="Save assessment and keep visit active to prescribe or order labs"
                      >
                        <FileText size={15} /> Save Assessment (Draft)
                      </button>
                      <button
                        type="button"
                        className="btn btn-warning"
                        onClick={() => setShowOutsideReferral(true)}
                        title="Refer patient to an outside hospital or specialized clinic"
                      >
                        <Building2 size={15} /> Refer Outside
                      </button>
                      <button type="submit" className="btn btn-primary" style={{ marginLeft: 'auto' }}>
                        <CheckCircle2 size={16} /> Complete &amp; Close Visit
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
                      padding: '1.15rem',
                      marginBottom: '1.25rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}>
                      <div className="opd-panel-header" style={{ marginBottom: '0.75rem' }}>
                        <div>
                          <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--clr-text-primary)', display: 'flex', alignItems: 'center', gap: 7, margin: 0 }}>
                            <FlaskConical size={17} className="text-primary" /> Laboratory Investigation Requisitions
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: 'var(--clr-text-secondary)', margin: '3px 0 0' }}>
                            Select diagnostic investigations below or add to the grid. Specify what findings the technologist should inspect.
                          </p>
                        </div>
                      </div>

                      {/* Quick Standard Test Selection Pills by Panel */}
                      <div style={{ margin: '0.5rem 0 1rem', padding: '0.75rem', background: 'var(--clr-bg-hover)', borderRadius: 8, border: '1px solid var(--clr-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Quick-Select Common Tests by Formulary Panel
                          </span>
                          <select
                            value={labCategory}
                            onChange={e => setLabCategory(e.target.value)}
                            style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--clr-border)', background: 'var(--clr-bg-card)', color: 'var(--clr-text-primary)' }}
                          >
                            {Object.keys(LAB_PANELS).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(LAB_PANELS[labCategory] || []).map(preset => {
                            const isAdded = labTests.some(t => t.testName === preset.testName);
                            return (
                              <button
                                key={preset.testName}
                                type="button"
                                className={`btn btn-sm ${isAdded ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => {
                                  if (isAdded) {
                                    setLabTests(labTests.filter(t => t.testName !== preset.testName));
                                  } else {
                                    setLabTests([
                                      ...labTests,
                                      {
                                        testName: preset.testName,
                                        category: preset.category,
                                        specimenType: preset.specimenType,
                                        technologistInstructions: '',
                                      },
                                    ]);
                                  }
                                }}
                                style={{
                                  fontSize: '0.74rem',
                                  padding: '0.25rem 0.6rem',
                                }}
                              >
                                {isAdded ? `✓ ${preset.testName}` : `+ ${preset.testName}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Tabular Requisition Grid */}
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--clr-text-primary)' }}>
                            Requisition Order Grid ({labTests.length} item{labTests.length !== 1 ? 's' : ''})
                          </strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>
                            Edit instructions directly on each row for the lab technologist
                          </span>
                        </div>

                        <div className="table-wrapper" style={{ border: '1px solid var(--clr-border)', borderRadius: 8, overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: 'var(--clr-bg-hover)', borderBottom: '1px solid var(--clr-border)', textAlign: 'left' }}>
                                <th style={{ padding: '8px 10px', width: 36 }}>#</th>
                                <th style={{ padding: '8px 10px', minWidth: 180 }}>Investigation</th>
                                <th style={{ padding: '8px 10px', minWidth: 100 }}>Category</th>
                                <th style={{ padding: '8px 10px', minWidth: 120 }}>Specimen</th>
                                <th style={{ padding: '8px 10px', minWidth: 220 }}>What Technologist Has To Look For / Notes</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', width: 50 }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {labTests.length === 0 ? (
                                <tr>
                                  <td colSpan={6} style={{ textAlign: 'center', padding: '1.75rem', color: 'var(--clr-text-muted)' }}>
                                    No investigations added to the grid yet. Click any quick panel test above or add a custom test below.
                                  </td>
                                </tr>
                              ) : (
                                labTests.map((t, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--clr-border)' }}>
                                    <td style={{ padding: '8px 10px', color: 'var(--clr-text-muted)' }}>{idx + 1}</td>
                                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t.testName}</td>
                                    <td style={{ padding: '8px 10px' }}><span className="badge badge-blue">{t.category}</span></td>
                                    <td style={{ padding: '8px 10px', color: 'var(--clr-text-secondary)' }}>{t.specimenType}</td>
                                    <td style={{ padding: '6px 10px' }}>
                                      <input
                                        type="text"
                                        placeholder="Specific instructions for lab technician..."
                                        value={t.technologistInstructions}
                                        onChange={(e) => {
                                          const next = [...labTests];
                                          next[idx].technologistInstructions = e.target.value;
                                          setLabTests(next);
                                        }}
                                        style={{ width: '100%', fontSize: '0.78rem', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--clr-border)', background: 'var(--clr-bg-card)', color: 'var(--clr-text-primary)' }}
                                      />
                                    </td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm btn-icon"
                                        onClick={() => setLabTests(labTests.filter((_, i) => i !== idx))}
                                        style={{ color: 'var(--clr-rose-400)', padding: '3px 6px' }}
                                        title="Remove test"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Custom Test Adder */}
                      <div style={{ background: 'var(--clr-bg-hover)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', border: '1px solid var(--clr-border)' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--clr-text-secondary)', marginBottom: 6 }}>
                          + Add Any Custom Investigation to Requisition Grid
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr)) auto', gap: 8, alignItems: 'flex-end' }}>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Test Name</label>
                            <input
                              value={labTestName}
                              onChange={e => setLabTestName(e.target.value)}
                              placeholder="e.g. Widal Test or Stool O&P"
                              style={{ fontSize: '0.78rem' }}
                            />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Category</label>
                            <input
                              value={labCategory}
                              onChange={e => setLabCategory(e.target.value)}
                              placeholder="Category"
                              style={{ fontSize: '0.78rem' }}
                            />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Specimen Type</label>
                            <input
                              value={labSpecimenType}
                              onChange={e => setLabSpecimenType(e.target.value)}
                              placeholder="e.g. Serum, Stool"
                              style={{ fontSize: '0.78rem' }}
                            />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>Technologist Notes</label>
                            <input
                              value={labTechInstructions}
                              onChange={e => setLabTechInstructions(e.target.value)}
                              placeholder="Instructions for technician"
                              style={{ fontSize: '0.78rem' }}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              if (!labTestName.trim()) return;
                              setLabTests([
                                ...labTests,
                                {
                                  testName: labTestName.trim(),
                                  category: labCategory.trim() || 'General Pathology',
                                  specimenType: labSpecimenType.trim() || 'Clinical Sample',
                                  technologistInstructions: labTechInstructions.trim(),
                                },
                              ]);
                              setLabTestName('');
                              setLabTechInstructions('');
                            }}
                            style={{ height: 34, whiteSpace: 'nowrap', fontWeight: 600 }}
                          >
                            <Plus size={14} /> Add to Grid
                          </button>
                        </div>
                      </div>

                      <div className="form-grid" style={{ marginBottom: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 600 }}>Clinical Acuity / Urgency</label>
                          <select
                            value={labPriority}
                            onChange={(e) => setLabPriority(e.target.value as Priority)}
                          >
                            <option value="Medium">Routine Outpatient (Normal)</option>
                            <option value="High">Urgent OPD Workup (High)</option>
                            <option value="Critical">STAT / Emergency Case (Immediate)</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 600 }}>Clinical Indication &amp; Presumptive Diagnosis</label>
                          <input
                            value={labClinicalNotes}
                            onChange={(e) => setLabClinicalNotes(e.target.value)}
                            placeholder="Why are these tests needed? (e.g. Suspected acute typhoid or malaria)"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="opd-form-actions">
                      <button type="button" className="btn btn-secondary" onClick={() => setActiveConsultationTab('overview')}>
                        Back to Assessment
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={labTests.length === 0 && !labTestName.trim()}>
                        <Send size={15} /> Dispatch {labTests.length > 0 ? `${labTests.length} Investigation(s)` : 'Requisition'} to Laboratory
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
                      <div className="opd-panel-header" style={{ marginBottom: '0.5rem' }}>
                        <div>
                          <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--clr-text-primary)', display: 'flex', alignItems: 'center', gap: 7, margin: 0 }}>
                            <Pill size={17} className="text-primary" /> Electronic Prescription (Rx)
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: 'var(--clr-text-secondary)', margin: '3px 0 0' }}>
                            Prescribe items for direct fulfillment at the dispensary with automatic inventory tracking.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={addPrescriptionRow}
                          style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                          <Plus size={14} /> Add Medicine Line
                        </button>
                      </div>

                      {/* Prescription Rows */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', margin: '0.75rem 0 1rem' }}>
                        {prescriptionItems.map((item, index) => (
                          <div
                            key={index}
                            style={{
                              background: 'var(--clr-bg-surface)',
                              border: '1px solid var(--clr-border)',
                              borderRadius: 8,
                              padding: '0.85rem 1rem',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            }}
                          >
                            {/* Line Item Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', borderBottom: '1px solid var(--clr-border)', paddingBottom: '0.4rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className="badge badge-blue" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                                  Item #{index + 1}
                                </span>
                                {item.unit && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>
                                    Form: <strong>{item.unit}</strong>
                                  </span>
                                )}
                                {item.stockAvailable !== undefined && (
                                  <span className={`badge ${item.stockAvailable > 0 ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: '0.68rem' }}>
                                    {item.stockAvailable > 0 ? `${item.stockAvailable} in clinic` : item.isExternal ? 'Outside purchase' : 'Out of stock'}
                                  </span>
                                )}
                              </div>
                              {prescriptionItems.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm btn-icon"
                                  onClick={() => removePrescriptionRow(index)}
                                  style={{ color: 'var(--clr-rose-400)', padding: '0.2rem 0.4rem' }}
                                  title="Remove medicine line"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>

                            <div className="opd-prescription-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                              <div>
                                <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 4, display: 'block', fontWeight: 600 }}>
                                  Medicine Name (Formulary Search) *
                                </label>
                                <MedicineSearchSelect
                                  value={item.name}
                                  medicineId={item.medicineId}
                                  medicines={medicines}
                                  onChange={(selected) => {
                                    const next = [...prescriptionItems];
                                    next[index].name = selected.name;
                                    next[index].medicineId = selected.medicineId;
                                    next[index].unit = selected.unit;
                                    next[index].stockAvailable = selected.stock;
                                    next[index].isExternal = selected.isCustom || selected.stock === 0;
                                    setPrescriptionItems(next);
                                  }}
                                  placeholder="Type to search medicine formulary..."
                                  required
                                />
                              </div>

                              {item.stockAvailable !== undefined && (
                                <fieldset className="opd-stock-source" style={{ gridColumn: '1 / -1' }}>
                                  <legend>Supply source</legend>
                                  <label className={`opd-stock-source-option ${!item.isExternal ? 'is-selected' : ''}`}>
                                    <input
                                      type="radio"
                                      name={`supply-source-${index}`}
                                      checked={!item.isExternal}
                                      disabled={item.stockAvailable === 0}
                                      onChange={() => {
                                        const next = [...prescriptionItems];
                                        next[index].isExternal = false;
                                        setPrescriptionItems(next);
                                      }}
                                    />
                                    <Building2 size={16} aria-hidden="true" />
                                    <span className="opd-stock-source-copy">
                                      <strong>Clinic pharmacy</strong>
                                      <small>{item.stockAvailable} available in stock</small>
                                    </span>
                                  </label>
                                  <label className={`opd-stock-source-option ${item.isExternal ? 'is-selected' : ''}`}>
                                    <input
                                      type="radio"
                                      name={`supply-source-${index}`}
                                      checked={Boolean(item.isExternal)}
                                      onChange={() => {
                                        const next = [...prescriptionItems];
                                        next[index].isExternal = true;
                                        setPrescriptionItems(next);
                                      }}
                                    />
                                    <ShoppingBag size={16} aria-hidden="true" />
                                    <span className="opd-stock-source-copy">
                                      <strong>Outside purchase</strong>
                                      <small>Prescription for retail dispensary</small>
                                    </span>
                                  </label>
                                </fieldset>
                              )}

                              <div>
                                <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: 3, display: 'block', fontWeight: 600 }}>
                                  Instructions for Patient (optional)
                                </label>
                                <input
                                  value={item.instructions || ''}
                                  onChange={(e) => {
                                    const next = [...prescriptionItems];
                                    next[index].instructions = e.target.value;
                                    setPrescriptionItems(next);
                                  }}
                                  placeholder="e.g. Take orally after meals, or apply twice daily. (Pharmacist will define quantity)"
                                  style={{ fontSize: '0.82rem' }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Item Bottom Trigger */}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm mb-3"
                        onClick={addPrescriptionRow}
                        style={{ borderStyle: 'dashed', width: '100%', justifyContent: 'center', padding: '0.5rem' }}
                      >
                        <Plus size={14} /> Add Another Prescription Item
                      </button>

                    </div>

                    <div className="opd-form-actions">
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
                      onClick={async () => {
                        if (!selectedQueueItem) return;
                        try {
                          await updateQueueItem(selectedQueueItem.id, { vitals: vitalsForm });
                        } catch (cause) {
                          setFormError(cause instanceof Error ? cause.message : 'Could not update visit vitals.');
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
        <ModalPortal>
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
                        <strong>Prescribed:</strong> {rec.prescription.map(p => p.medication).join(', ')}
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
        </ModalPortal>
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

      {/* Outside Hospital/Facility Referral Modal */}
      {showOutsideReferral && selectedQueueItem && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setShowOutsideReferral(false)}>
            <div className="modal" style={{ maxWidth: 540, width: '100%', padding: '1.5rem', borderRadius: 12 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', fontWeight: 800 }}>
                  <Building2 size={20} className="text-primary" /> Refer to Outside Facility
                </h3>
                <button type="button" className="modal-close-btn" onClick={() => setShowOutsideReferral(false)} aria-label="Close dialog">
                  <X size={16} />
                </button>
              </div>

              <div style={{ background: 'var(--clr-bg-hover)', padding: '0.65rem 0.85rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.82rem' }}>
                Patient: <strong>{patientNameFor(patients, selectedQueueItem.patientId, selectedQueueItem.patientName)}</strong> ({patientCodeFor(patients, selectedQueueItem.patientId)})
              </div>

              <form onSubmit={handleReferOutside}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Destination Hospital or Clinic *</label>
                  <input
                    list="referral-destination-options"
                    required
                    value={referralDestination}
                    onChange={e => setReferralDestination(e.target.value)}
                    placeholder="e.g. Borana General Hospital, Yabelo Referral Hospital"
                  />
                  <datalist id="referral-destination-options">
                    <option value="Borana General Hospital" />
                    <option value="Yabelo Referral Hospital" />
                    <option value="Hawassa Comprehensive Specialized Hospital" />
                    <option value="Specialized Eye Care Clinic" />
                    <option value="Regional Tuberculosis / Chest Clinic" />
                  </datalist>
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Clinical Referral Reason &amp; Summary *</label>
                  <textarea
                    required
                    rows={3}
                    value={referralReason}
                    onChange={e => setReferralReason(e.target.value)}
                    placeholder="State the medical indication, diagnostic imaging, surgical care, or tertiary specialty required..."
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowOutsideReferral(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-warning">
                    <Send size={15} /> Confirm &amp; Dispatch Referral
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Official Referral Print Slip Modal */}
      {printedReferral && (
        <ReferralPrintModal
          isOpen={Boolean(printedReferral)}
          onClose={() => setPrintedReferral(null)}
          patientName={printedReferral.patientName}
          patientCode={printedReferral.patientCode}
          patientAge={printedReferral.patientAge}
          patientGender={printedReferral.patientGender}
          patientType={printedReferral.patientType}
          patientDepartment={printedReferral.patientDepartment}
          doctorName={printedReferral.doctorName}
          destination={printedReferral.destination}
          reason={printedReferral.reason}
          diagnosis={printedReferral.diagnosis}
          vitals={printedReferral.vitals}
          symptoms={printedReferral.symptoms}
          notes={printedReferral.notes}
          allergies={printedReferral.allergies}
        />
      )}
    </div>
  );
}
