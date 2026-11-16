import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import LoadingButton from '../../components/LoadingButton';
import LaboratoryPaperForm, { type LabRequestLine } from '../../components/LaboratoryPaperForm';
import type { StandardLabTest } from '../../utils/labPresets';
import { cleanClinicalText } from '../../utils/clinicalText';
import { formatDoctorName, stripDoctorTitle } from '../../utils/doctorName';
import './OpdDashboard.css';
import { formatTime12 } from '../../utils/date';

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
    queue, records, medicines, patients, doctors, erCases, labOrders,
    updateQueueItem, sendOpdToLabRequest, sendOpdToPharmacyRequest,
    completeOpdConsultation, saveOpdAssessment, referOutside, transferToEmergency
  } = useClinic();
  const { currentUser } = useAuth();

  const [selectedQueueItem, setSelectedQueueItem] = useState<ClinicQueueItem | null>(null);
  const [opdTabFilter, setOpdTabFilter] = useState<'all' | 'card_requests' | 'lab_returned' | 'completed'>('all');
  const [doctorQueueScope, setDoctorQueueScope] = useState<'my' | 'all'>('my');

  useEffect(() => {
    if (!selectedQueueItem) return;
    const refreshedItem = queue.find(item => item.id === selectedQueueItem.id);
    if (refreshedItem && (
      refreshedItem.stage !== selectedQueueItem.stage
      || refreshedItem.labStatus !== selectedQueueItem.labStatus
      || refreshedItem.labResult !== selectedQueueItem.labResult
      || refreshedItem.labTestName !== selectedQueueItem.labTestName
      || refreshedItem.labReferenceRange !== selectedQueueItem.labReferenceRange
    )) {
      setSelectedQueueItem(refreshedItem);
    }
  }, [queue, selectedQueueItem]);

  // Consultation modal / action tab
  const [activeConsultationTab, setActiveConsultationTab] = useState<'overview' | 'lab' | 'pharmacy' | 'vitals'>('overview');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [showOutsideReferral, setShowOutsideReferral] = useState(false);
  const [referralDestination, setReferralDestination] = useState('');
  const [referralReason, setReferralReason] = useState('');
  const [referralOccupation, setReferralOccupation] = useState('');
  const [referralHistory, setReferralHistory] = useState('');
  const [referralPhysicalExam, setReferralPhysicalExam] = useState('');
  const [referralActionTaken, setReferralActionTaken] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [assessmentSaved, setAssessmentSaved] = useState(false);
  const [actionLoading, setActionLoading] = useState<'lab' | 'pharmacy' | 'complete' | 'assessment' | 'referral' | null>(null);
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
    occupation?: string;
    patientHistory?: string;
    physicalExamination?: string;
    actionTaken?: string;
    referralNumber?: string;
  } | null>(null);

  // Vitals form - start empty, do not fill with fake default numbers
  const [vitalsForm, setVitalsForm] = useState<Vitals>({
    bloodPressure: '',
    heartRate: undefined,
    temperature: undefined,
    spo2: undefined,
    respiratoryRate: undefined,
    weightKg: undefined,
  });

  // Doctor consultation core notes
  const [consultation, setConsultation] = useState({
    diagnosis: '',
    symptoms: '',
    clinicalNotes: '',
  });

  // OPD to Lab request state
  const [labTestName, setLabTestName] = useState('');
  const [labSpecimenType, setLabSpecimenType] = useState('');
  const [labCustomUnit, setLabCustomUnit] = useState('');
  const [labCustomReferenceRange, setLabCustomReferenceRange] = useState('');
  const [labPriority, setLabPriority] = useState<Priority>('Medium');
  const [labClinicalNotes, setLabClinicalNotes] = useState('');
  const [labTechInstructions, setLabTechInstructions] = useState('');
  const [labTests, setLabTests] = useState<LabRequestLine[]>([]);

  const selectedPatient = useMemo(
    () => selectedQueueItem ? patients.find(patient => patient.id === selectedQueueItem.patientId) : undefined,
    [patients, selectedQueueItem],
  );
  const selectedPatientName = selectedQueueItem
    ? patientNameFor(patients, selectedQueueItem.patientId, selectedQueueItem.patientName)
    : '';
  const selectedPatientAge = calculateAge(selectedPatient?.dateOfBirth);
  const selectedPatientCode = selectedQueueItem ? patientCodeFor(patients, selectedQueueItem.patientId) : '';

  const toggleLabPreset = (preset: StandardLabTest) => {
    setLabTests(previous => {
      const isAdded = previous.some(test => test.testName === preset.testName && test.category === preset.category && test.specimenType === preset.specimenType);
      if (isAdded) return previous.filter(test => !(test.testName === preset.testName && test.category === preset.category && test.specimenType === preset.specimenType));
      return [...previous, {
        testName: preset.testName,
        category: preset.category,
        specimenType: preset.specimenType,
        unit: preset.defaultUnit,
        referenceRange: preset.defaultRefRange,
        technologistInstructions: '',
      }];
    });
  };

  const hasRecordedVitals = Object.values(vitalsForm).some(value => value !== undefined && String(value).trim() !== '');

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
      const cleanDoc = stripDoctorTitle(q.assignedDoctorName).toLowerCase();
      const cleanUser = stripDoctorTitle(currentUser.name).toLowerCase();
      if (cleanDoc === cleanUser || cleanDoc.includes(cleanUser) || cleanUser.includes(cleanDoc)) {
        return true;
      }
    }

    return false;
  }, [currentUser, doctors]);

  // Lab alerts belong to the clinician who requested the tests. A returning
  // result should remain visible to that clinician even if reception assigned
  // the visit to a different doctor station.
  const isReturnedLabForCurrentDoctor = useCallback((q: ClinicQueueItem) => {
    if (!currentUser || (q.labStatus !== 'Partial' && q.labStatus !== 'Completed')) return false;
    const relatedOrders = labOrders.filter(order =>
      order.queueItemId === q.id
      || order.id === q.labOrderId,
    );
    const currentEmail = currentUser.email?.trim().toLowerCase();
    const cleanName = (name?: string) => stripDoctorTitle(name).trim().toLowerCase();
    const currentName = cleanName(currentUser.name);

    return relatedOrders.some(order => {
      if (order.doctorId && order.doctorId === currentUser.id) return true;
      if (order.doctorId && currentEmail) {
        const matchingDoctor = doctors.find(doctor => doctor.id === order.doctorId);
        if (matchingDoctor?.email?.trim().toLowerCase() === currentEmail) return true;
      }
      return Boolean(currentName && cleanName(order.doctorName) === currentName);
    });
  }, [currentUser, doctors, labOrders]);
  const canViewQueueItem = useCallback((q: ClinicQueueItem) =>
    isAssignedToCurrentDoctor(q) || isReturnedLabForCurrentDoctor(q),
  [isAssignedToCurrentDoctor, isReturnedLabForCurrentDoctor]);

  // A legacy or interrupted transfer can leave the queue row behind after
  // the ER case was created. Hide that patient from OPD while the ER case is
  // active so one patient cannot appear in two active departments.
  const activeEmergencyPatientIds = useMemo(
    () => new Set(erCases.filter(c => c.status !== 'Discharged' && c.status !== 'Transferred').map(c => c.patientId)),
    [erCases],
  );

  // Categorized lists filtered by assigned doctor when in "my" scope
  const waitingForDoctor = queue.filter(q =>
    q.stage === 'Doctor Consultation' && !activeEmergencyPatientIds.has(q.patientId) && (doctorQueueScope === 'all' || canViewQueueItem(q))
  );
  const atLaboratory = queue.filter(q =>
    (q.stage === 'Laboratory' || q.labStatus === 'Partial') && !activeEmergencyPatientIds.has(q.patientId) && (doctorQueueScope === 'all' || canViewQueueItem(q))
  );
  const atPharmacy = queue.filter(q =>
    q.stage === 'Pharmacy' && !activeEmergencyPatientIds.has(q.patientId) && (doctorQueueScope === 'all' || isAssignedToCurrentDoctor(q))
  );
  const completedToday = queue.filter(q =>
    q.stage === 'Completed' && (doctorQueueScope === 'all' || isAssignedToCurrentDoctor(q))
  );

  const completedConsultationsToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const completedQueueIds = new Set(queue.filter(item => item.stage === 'Completed').map(item => item.id));
    return records.filter(record =>
      record.visitDate === today &&
      record.doctorId === currentUser?.id &&
      Boolean(record.queueItemId && completedQueueIds.has(record.queueItemId)),
    ).length;
  }, [queue, records, currentUser?.id]);

  const totalAssignedToMe = useMemo(() => {
    return queue.filter(q => q.stage === 'Doctor Consultation' && !activeEmergencyPatientIds.has(q.patientId) && canViewQueueItem(q)).length;
  }, [queue, activeEmergencyPatientIds, canViewQueueItem]);

  const totalOpdDoctorQueue = useMemo(() => {
    return queue.filter(q => q.stage === 'Doctor Consultation' && !activeEmergencyPatientIds.has(q.patientId)).length;
  }, [queue, activeEmergencyPatientIds]);

  // Filtered list for the doctor station
  const doctorStationQueue = queue.filter(q => {
    if (doctorQueueScope === 'my' && !canViewQueueItem(q)) return false;
    if (activeEmergencyPatientIds.has(q.patientId)) return false;
    if (opdTabFilter === 'completed') {
      return q.stage === 'Completed';
    }
    if (q.stage !== 'Doctor Consultation') return false;
    if (opdTabFilter === 'card_requests') {
      return q.labStatus !== 'Completed' && q.labStatus !== 'Partial';
    }
    if (opdTabFilter === 'lab_returned') {
      return q.labStatus === 'Completed' || q.labStatus === 'Partial';
    }
    return true;
  });

  const pastMedicalRecords = selectedQueueItem
    ? records.filter(r => r.patientId === selectedQueueItem.patientId)
    : [];
  const selectedLabOrders = useMemo(() => {
    if (!selectedQueueItem) return [];
    const linked = labOrders.filter(order => order.queueItemId === selectedQueueItem.id);
    if (linked.length) return linked;
    const firstOrder = labOrders.find(order => order.id === selectedQueueItem.labOrderId);
    if (!firstOrder) return [];
    return firstOrder.requestGroupId
      ? labOrders.filter(order => order.requestGroupId === firstOrder.requestGroupId)
      : [firstOrder];
  }, [labOrders, selectedQueueItem]);
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
        bloodPressure: '',
        heartRate: undefined,
        temperature: undefined,
        spo2: undefined,
        respiratoryRate: undefined,
        weightKg: undefined,
      });
    }

    setConsultation({
      diagnosis: item.doctorDiagnosis || '',
      symptoms: (item as any).symptoms ? (Array.isArray((item as any).symptoms) ? (item as any).symptoms.join(', ') : (item as any).symptoms) : '',
      clinicalNotes: item.consultationNotes || '',
    });
    setPrescriptionItems([]);
    setLabTestName('');
    setLabSpecimenType('');
    setLabCustomUnit('');
    setLabCustomReferenceRange('');
    setLabPriority('Medium');
    setLabTechInstructions('');
    setLabTests([]);

    setLabClinicalNotes(item.labNotes || '');
  };

  // Action 1: Dispatch Diagnostic Request from OPD to Laboratory
  const handleDispatchToLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueueItem) return;
    if (actionLoading) return;

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
      setActionLoading('lab');
      await sendOpdToLabRequest(selectedQueueItem.id, {
        priority: labPriority,
        ...(labTests.length ? { tests: labTests } : {
          testName: labTestName.trim(), category: 'Others', specimenType: labSpecimenType.trim(),
          unit: labCustomUnit.trim(), referenceRange: labCustomReferenceRange.trim(), technologistInstructions: labTechInstructions.trim(),
        }),
        notes: labClinicalNotes || `OPD referral for ${selectedQueueItem.chiefComplaint}`,
        doctorId: currentUser?.id || selectedQueueItem.assignedDoctorId || '',
        doctorName: stripDoctorTitle(selectedQueueItem.assignedDoctorName || currentUser?.name) || 'OPD clinician',
        doctorDiagnosis: consultation.diagnosis.trim(),
        consultationNotes: consultation.clinicalNotes.trim(),
      });
      setFormError(null);
      setSelectedQueueItem(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not send the laboratory request.');
    } finally {
      setActionLoading(null);
    }
  };

  // Action 2: Dispatch Prescription from OPD to Pharmacy
  const handleDispatchToPharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueueItem) return;
    if (actionLoading) return;

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
      setActionLoading('pharmacy');
      await sendOpdToPharmacyRequest(selectedQueueItem.id, {
        medicines: formattedMedicines,
        doctorId: selectedQueueItem.assignedDoctorId,
        doctorName: stripDoctorTitle(selectedQueueItem.assignedDoctorName || currentUser?.name) || 'OPD clinician',
        doctorDiagnosis: primaryDiagnosis,
        notes: consultation.clinicalNotes,
      });
      setFormError(null);
      setSelectedQueueItem(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not send the prescription.');
    } finally {
      setActionLoading(null);
    }
  };

  // Action 3: Complete Consultation & Archive to Patient Card
  const handleCompleteConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueueItem) return;
    if (actionLoading) return;
    const error = firstError(...Object.values(validateRequired({ diagnosis: consultation.diagnosis }, { diagnosis: 'Diagnosis' })));
    if (error) { setFormError(error); return; }

    try {
      setActionLoading('complete');
      await completeOpdConsultation(selectedQueueItem.id, {
        patientId: selectedQueueItem.patientId,
        patientName: selectedQueueItem.patientName,
        doctorId: currentUser?.id || selectedQueueItem.assignedDoctorId || '',
        doctorName: stripDoctorTitle(selectedQueueItem.assignedDoctorName || currentUser?.name) || 'OPD clinician',
        visitDate: new Date().toISOString().split('T')[0],
        diagnosis: consultation.diagnosis,
        symptoms: consultation.symptoms ? consultation.symptoms.split(',').map(s => s.trim()) : [selectedQueueItem.chiefComplaint],
        ...(hasRecordedVitals ? { vitals: vitalsForm } : {}),
        notes: consultation.clinicalNotes || 'Outpatient clinical visit completed. Patient advised on care.',
      });
      setFormError(null);
      setSelectedQueueItem(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not complete the consultation.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveAssessment = async () => {
    if (!selectedQueueItem) return;
    if (actionLoading) return;
    try {
      setActionLoading('assessment');
      await saveOpdAssessment(selectedQueueItem.id, {
        doctorId: selectedQueueItem.assignedDoctorId || '',
        doctorName: stripDoctorTitle(selectedQueueItem.assignedDoctorName || currentUser?.name) || 'OPD clinician',
        visitDate: new Date().toISOString().slice(0, 10),
        diagnosis: consultation.diagnosis,
        symptoms: consultation.symptoms.split(',').map(value => value.trim()).filter(Boolean),
        ...(hasRecordedVitals ? { vitals: vitalsForm } : {}),
        notes: consultation.clinicalNotes,
      });
      setFormError(null);
      setAssessmentSaved(true);
      window.dispatchEvent(new CustomEvent('bruclinic:action-success', { detail: 'Assessment saved. The visit remains open for lab or pharmacy requests.' }));
    } catch (cause) {
      setAssessmentSaved(false);
      setFormError(cause instanceof Error ? cause.message : 'Could not save this assessment.');
    } finally {
      setActionLoading(null);
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
    if (actionLoading) return;
    const error = firstError(...Object.values(validateRequired(
      { referralDestination, referralReason },
      { referralDestination: 'Referral destination', referralReason: 'Referral reason' },
    )));
    if (error) { setFormError(error); return; }
    try {
      setActionLoading('referral');
      const patient = patients.find(p => p.id === selectedQueueItem.patientId);
      const referralSlipData = {
        patientName: patientNameFor(patients, selectedQueueItem.patientId, selectedQueueItem.patientName),
        patientCode: patientCodeFor(patients, selectedQueueItem.patientId),
        patientAge: calculateAge(patient?.dateOfBirth),
        patientGender: patient?.gender,
        patientType: patient?.patientType,
        patientDepartment: patient?.department,
        doctorName: stripDoctorTitle(currentUser?.name || selectedQueueItem.assignedDoctorName) || 'OPD clinician',
        destination: referralDestination.trim(),
        reason: referralReason.trim(),
        diagnosis: consultation.diagnosis,
        vitals: vitalsForm,
        symptoms: consultation.symptoms.split(',').map(value => value.trim()).filter(Boolean),
        notes: consultation.clinicalNotes,
        allergies: Array.isArray(selectedQueueItem.allergies) ? selectedQueueItem.allergies : selectedQueueItem.allergies ? [String(selectedQueueItem.allergies)] : [],
        occupation: referralOccupation.trim(),
        patientHistory: referralHistory.trim() || consultation.symptoms.trim(),
        physicalExamination: referralPhysicalExam.trim() || consultation.clinicalNotes.trim(),
        actionTaken: referralActionTaken.trim(),
        referralNumber: `REF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${selectedQueueItem.tokenNumber}`,
      };

      await referOutside(selectedQueueItem.id, {
        destination: referralDestination.trim(),
        reason: referralReason.trim(),
        doctorName: stripDoctorTitle(currentUser?.name || selectedQueueItem.assignedDoctorName) || 'OPD clinician',
        recordData: {
          doctorId: selectedQueueItem.assignedDoctorId || '',
          doctorName: stripDoctorTitle(currentUser?.name || selectedQueueItem.assignedDoctorName) || 'OPD clinician',
          diagnosis: consultation.diagnosis,
          symptoms: consultation.symptoms.split(',').map(value => value.trim()).filter(Boolean),
          vitals: vitalsForm,
          notes: consultation.clinicalNotes,
        },
        referralDetails: {
          occupation: referralOccupation.trim(),
          patientHistory: referralHistory.trim() || consultation.symptoms.trim(),
          physicalExamination: referralPhysicalExam.trim() || consultation.clinicalNotes.trim(),
          actionTaken: referralActionTaken.trim(),
          referralNumber: referralSlipData.referralNumber,
        },
      });
      setShowOutsideReferral(false);
      setSelectedQueueItem(null);
      setReferralDestination('');
      setReferralReason('');
      setReferralOccupation('');
      setReferralHistory('');
      setReferralPhysicalExam('');
      setReferralActionTaken('');
      setPrintedReferral(referralSlipData);
      window.dispatchEvent(new CustomEvent('bruclinic:action-success', { detail: 'Patient referred outside successfully. Referral slip ready for printing.' }));
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not record this referral.');
    } finally {
      setActionLoading(null);
    }
  };

  // Action 4: Fast-track transfer to Emergency (ER)
  const handleTransferToER = () => {
    if (!selectedQueueItem) return;
    setShowTransferConfirm(true);
  };

  const executeTransferToER = async () => {
    if (!selectedQueueItem) return;
    try {
      await transferToEmergency(selectedQueueItem.id, {
        arrivalMethod: 'OPD Referral',
        acuity: 'Red',
        chiefComplaint: `OPD Emergency Referral: ${selectedQueueItem.chiefComplaint}. ${consultation.clinicalNotes}`,
        bedNumber: 'Bay 02 (Acute)',
        vitals: vitalsForm,
        attendingDoctor: stripDoctorTitle(currentUser?.name || selectedQueueItem.assignedDoctorName) || 'OPD clinician',
        diagnosis: consultation.diagnosis.trim() || selectedQueueItem.doctorDiagnosis || '',
        criticalNotes: 'Referred urgently from OPD Consultation.',
        requestSource: 'OPD Consultation',
        requestNotes: 'URGENT: Patient transferred to Emergency Room by OPD Doctor',
      });
      setFormError(null);
      setSelectedQueueItem(null);
      window.dispatchEvent(new CustomEvent('bruclinic:action-success', { detail: 'Patient transferred to Emergency and Emergency staff notified.' }));
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not transfer the patient to Emergency.');
    }
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
      {/* OPD KPI Pipeline Flow Metrics */}
      <div className="opd-kpi-grid">
        <InfoBox
          tone="info"
          icon={<Stethoscope size={22} />}
          value={waitingForDoctor.length}
          label="OPD queue"
          detail="In doctor consultation"
          onClick={() => { setOpdTabFilter('all'); setDoctorQueueScope('all'); }}
          footerText="View queue"
        />
        <InfoBox
          tone="success"
          icon={<FlaskConical size={22} />}
          value={atLaboratory.length}
          label="At laboratory"
          detail="Diagnostic tests ordered"
          onClick={() => setOpdTabFilter('lab_returned')}
          footerText="Check lab results"
        />
        <InfoBox
          tone="warning"
          icon={<Pill size={22} />}
          value={atPharmacy.length}
          label="At pharmacy"
          detail="Prescriptions pending dispensary"
          to="/pharmacy"
          footerText="View pharmacy"
        />
        <InfoBox
          tone="secondary"
          icon={<CheckCircle2 size={22} />}
          value={completedConsultationsToday}
          label="Completed"
          detail="Consultations treated today"
          onClick={() => setOpdTabFilter('completed')}
          footerText="View completed"
        />
      </div>

      {/* Main OPD Station Work Area */}
      <div className={`opd-workspace-layout ${selectedQueueItem ? 'has-active-patient' : ''}`}>
        {/* Left: Patient Queue List */}
        <div className="card opd-queue-panel">
          <div className="opd-queue-header">
            <div className="opd-queue-heading">
              <div className="opd-queue-heading-top">
                <div className="opd-queue-title-wrap">
                  <span className="opd-queue-title-icon"><Stethoscope size={19} /></span>
                  <div>
                    <h3>OPD Doctor Consultation Queue</h3>
                    <span className="opd-queue-subtitle">
                      {doctorQueueScope === 'my'
                        ? `Patients assigned to ${currentUser?.name ? formatDoctorName(currentUser.name) : 'your station'}`
                        : 'Card Room arrivals and patients returning from the laboratory'}
                    </span>
                  </div>
                </div>

                <div className="pill-tabs opd-queue-scope">
                  <button
                    type="button"
                    className={`pill-tab ${doctorQueueScope === 'my' ? 'active' : ''}`}
                    onClick={() => setDoctorQueueScope('my')}
                    title="Only patients assigned to you by Receptionist"
                  >
                    Assigned to me <span>{totalAssignedToMe}</span>
                  </button>
                  <button
                    type="button"
                    className={`pill-tab ${doctorQueueScope === 'all' ? 'active' : ''}`}
                    onClick={() => setDoctorQueueScope('all')}
                    title="All patients in OPD consultation queue"
                  >
                    All doctors <span>{totalOpdDoctorQueue}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pill-tabs opd-queue-filters">
              <button
                type="button"
                className={`pill-tab ${opdTabFilter === 'all' ? 'active' : ''}`}
                onClick={() => setOpdTabFilter('all')}
              >
                All ({waitingForDoctor.length})
              </button>
              <button
                type="button"
                className={`pill-tab ${opdTabFilter === 'card_requests' ? 'active' : ''}`}
                onClick={() => setOpdTabFilter('card_requests')}
              >
                Card Room
              </button>
              <button
                type="button"
                className={`pill-tab ${opdTabFilter === 'lab_returned' ? 'active' : ''}`}
                onClick={() => setOpdTabFilter('lab_returned')}
              >
                Lab results ({waitingForDoctor.filter(q => q.labStatus === 'Completed' || q.labStatus === 'Partial').length})
              </button>
              <button
                type="button"
                className={`pill-tab ${opdTabFilter === 'completed' ? 'active' : ''}`}
                onClick={() => setOpdTabFilter('completed')}
              >
                Completed ({completedToday.length})
              </button>
            </div>
          </div>

          <div className="opd-queue-list">
            {doctorStationQueue.length === 0 ? (
              <div className="empty-state">
                <div className={`empty-state-icon ${opdTabFilter === 'completed' ? 'tone-green' : 'tone-blue'}`}>
                  <CheckCircle2 size={28} />
                </div>
                <h5 className="empty-state-title">
                  {opdTabFilter === 'completed' ? 'No completed consultations today' :
                   opdTabFilter === 'lab_returned' ? 'No lab results ready' :
                   opdTabFilter === 'card_requests' ? 'No card room requests' :
                   'All caught up! No patients waiting'}
                </h5>
                <p className="empty-state-body">
                  {opdTabFilter === 'completed'
                    ? 'Completed consultations will appear here once patients are discharged and records are archived.'
                    : opdTabFilter === 'lab_returned'
                    ? 'Lab result notifications will appear here automatically when diagnostic tests are completed and ready for review.'
                    : opdTabFilter === 'card_requests'
                    ? 'Patient requests from the Card Room will appear here when receptionist dispatches to this OPD station.'
                    : doctorQueueScope === 'my'
                    ? `There are currently no patients assigned to ${currentUser?.name ? formatDoctorName(currentUser.name) : 'your station'}. New patients will appear automatically when receptionist routes them here.`
                    : 'The OPD consultation queue is currently empty. New patient requests will appear here automatically when dispatched from the Card Room.'}
                </p>
              </div>
            ) : (
              doctorStationQueue.map((item) => {
                const isSelected = selectedQueueItem?.id === item.id;
                const linkedLabOrders = labOrders.filter(order => order.queueItemId === item.id);
                const linkedLabResults = linkedLabOrders.filter(order => order.status === 'Completed');
                const pendingLabCount = linkedLabOrders.filter(order => order.status !== 'Completed').length;
                const hasLabResults = item.labStatus === 'Completed' || item.labStatus === 'Partial' || linkedLabResults.length > 0;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectPatient(item)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleSelectPatient(item);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    className={`opd-queue-item${isSelected ? ' is-selected' : ''}${hasLabResults ? ' has-results' : ''}${item.priority === 'Emergency' ? ' is-emergency' : ''}`}
                  >
                    <div className="opd-queue-item-head">
                      <div className="opd-queue-patient">
                        <span className="opd-queue-token">{item.tokenNumber}</span>
                        <div className="opd-queue-patient-copy">
                          <strong>{patientNameFor(patients, item.patientId, item.patientName)}</strong>
                          <span>{item.cardStatus || 'Existing Card'} · {item.patientType}</span>
                        </div>
                      </div>
                      <span className={`opd-queue-priority${item.priority === 'Emergency' ? ' is-emergency' : item.priority === 'Urgent' ? ' is-urgent' : ''}`}>
                        {item.priority}
                      </span>
                    </div>

                    <div className="opd-queue-complaint">
                      <span>Chief concern</span>
                      <p>{item.chiefComplaint}</p>
                    </div>

                    {hasLabResults && (
                      <div className="opd-queue-lab-ready">
                        <FlaskConical size={15} />
                        <span>
                          <strong>{linkedLabResults.length || 'Lab'} result{linkedLabResults.length === 1 ? '' : 's'} returned</strong>
                          <small>{item.labTestName || 'Ready for clinician review'}{item.labStatus === 'Partial' && pendingLabCount ? ` · ${pendingLabCount} test${pendingLabCount === 1 ? '' : 's'} still pending` : ''}</small>
                        </span>
                      </div>
                    )}

                    {item.vitals && (
                      <div className="opd-queue-vitals">
                        <span>BP <strong>{item.vitals.bloodPressure || '—'}</strong></span>
                        <span>HR: <strong>{item.vitals.heartRate ? `${item.vitals.heartRate} bpm` : '—'}</strong></span>
                        <span>Temp: <strong style={{ color: (item.vitals.temperature || 0) > 37.5 ? '#f87171' : undefined }}>{item.vitals.temperature ? `${item.vitals.temperature}°C` : '—'}</strong></span>
                        <span>SpO2: <strong>{item.vitals.spo2 ? `${item.vitals.spo2}%` : '—'}</strong></span>
                      </div>
                    )}

                    {/* Allergy warning indicator */}
                    {item.allergies && (Array.isArray(item.allergies) ? item.allergies.length > 0 : Boolean(item.allergies)) && (
                      <div className="opd-queue-allergy">
                        <ShieldAlert size={14} /> Allergy alert: {Array.isArray(item.allergies) ? item.allergies.join(', ') : String(item.allergies)}
                      </div>
                    )}

                    <div className="opd-queue-item-footer">
                      <span>Registered {formatTime12(item.registeredTime)} · {item.assignedOpdRoom || 'OPD 1'}</span>
                      <span>{opdTabFilter === 'completed' ? 'Review visit' : hasLabResults ? 'Review results' : 'Open patient'} <ChevronRight size={15} /></span>
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
                        doctorName: stripDoctorTitle(selectedQueueItem.externalReferral?.referredBy || currentUser?.name) || 'OPD clinician',
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
                <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setSelectedQueueItem(null)} disabled={Boolean(actionLoading)}>
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

            {/* ── DOCTOR STATION WORKSPACE WITH WORKFLOW ROUTING ── */}
            {isCompletedReview && (
              <section className="alert alert-info mb-3" aria-label="Completed visit review">
                <strong>Completed visit, read-only.</strong> This encounter is closed. Review the saved diagnosis, notes, and patient history; create a new queue visit for another consultation.
                <div className="mt-2"><strong>Diagnosis:</strong> {selectedQueueItem.doctorDiagnosis || 'Not recorded'}</div>
                {cleanClinicalText(selectedQueueItem.consultationNotes) && <div className="mt-1"><strong>Clinical notes:</strong> {cleanClinicalText(selectedQueueItem.consultationNotes)}</div>}
                {selectedQueueItem.completedAt && <div className="mt-1"><strong>Completed:</strong> {formatTime12(selectedQueueItem.completedAt)}</div>}
              </section>
            )}

            {!isCompletedReview && (
              <div>
                {/* Returned Lab Results Display Banner */}
                {(selectedLabOrders.length > 0 || selectedQueueItem.labStatus === 'Completed') && (
                  <section className="opd-lab-return-card" aria-label="Laboratory results returned for this visit">
                    <header className="opd-lab-return-heading">
                      <div>
                        <h4><FlaskConical size={17} /> Laboratory results</h4>
                        <p>{selectedLabOrders.length} requested investigation{selectedLabOrders.length === 1 ? '' : 's'} · {selectedLabOrders.filter(order => order.status === 'Completed').length} result{selectedLabOrders.filter(order => order.status === 'Completed').length === 1 ? '' : 's'} returned</p>
                      </div>
                      <span className={`badge ${selectedLabOrders.some(order => order.status !== 'Completed') ? 'badge-amber' : 'badge-green'}`}>
                        {selectedLabOrders.some(order => order.status !== 'Completed') ? 'Results in progress' : 'Verified by laboratory'}
                      </span>
                    </header>
                    <div className="opd-lab-return-list">
                      {selectedLabOrders.map(order => (
                        <article key={order.id} className={`opd-lab-return-item${order.isAbnormal ? ' is-abnormal' : ''}`}>
                          <div className="opd-lab-return-test">
                            <strong>{order.testName}</strong>
                            <span>{order.category} · {order.specimenType}</span>
                            {order.notes && <small>OPD request: {order.notes}</small>}
                          </div>
                          <div className="opd-lab-return-result">
                            {order.status === 'Completed' ? <>
                              <strong>{order.result || 'Result recorded'}{order.unit ? ` ${order.unit}` : ''}</strong>
                              <span>{order.isAbnormal ? 'Abnormal result' : 'Within expected range'}{order.referenceRange ? ` · Reference: ${order.referenceRange}` : ''}</span>
                              {(order.technicianInitials || order.approvedBy || order.completedAt) && <small>{[order.technicianInitials && `Tech: ${order.technicianInitials}`, order.approvedBy && `Verified by ${order.approvedBy}`, order.completedAt && `Released ${order.completedAt}`].filter(Boolean).join(' · ')}</small>}
                              {order.technicianComment && <small className="opd-lab-return-comment">Lab comment: {order.technicianComment}</small>}
                            </> : <span className="opd-lab-result-pending">Awaiting laboratory result</span>}
                          </div>
                        </article>
                      ))}
                      {selectedLabOrders.length === 0 && selectedQueueItem.labResult && (
                        <article className="opd-lab-return-item">
                          <div className="opd-lab-return-test"><strong>{selectedQueueItem.labTestName || 'Laboratory investigation'}</strong></div>
                          <div className="opd-lab-return-result"><strong>{selectedQueueItem.labResult}</strong><span>{selectedQueueItem.labReferenceRange ? `Reference: ${selectedQueueItem.labReferenceRange}` : ''}</span></div>
                        </article>
                      )}
                    </div>
                  </section>
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
                    <Activity size={14} /> Additional Vitals
                  </button>
                </div>

                {/* ── TAB 1: ASSESSMENT & CONSULTATION ── */}
                {activeConsultationTab === 'overview' && (
                  <form onSubmit={handleCompleteConsultation} noValidate onKeyDown={preventEnterCompletion}>
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
                      <button type="button" className="btn btn-secondary" onClick={() => setSelectedQueueItem(null)} disabled={Boolean(actionLoading)}>
                        Cancel
                      </button>
                      <LoadingButton
                        type="button"
                        className="btn btn-info"
                        onClick={handleSaveAssessment}
                        loading={actionLoading === 'assessment'}
                        loadingLabel="Saving…"
                        disabled={Boolean(actionLoading && actionLoading !== 'assessment')}
                        title="Save assessment and keep visit active to prescribe or order labs"
                      >
                        <FileText size={15} /> Save Assessment (Draft)
                      </LoadingButton>
                      <button
                        type="button"
                        className="btn btn-warning"
                        onClick={() => setShowOutsideReferral(true)}
                        disabled={Boolean(actionLoading)}
                        title="Refer patient to an outside hospital or specialized clinic"
                      >
                        <Building2 size={15} /> Refer Outside
                      </button>
                      <LoadingButton type="submit" className="btn btn-primary" style={{ marginLeft: 'auto' }} loading={actionLoading === 'complete'} loadingLabel="Completing…" disabled={Boolean(actionLoading && actionLoading !== 'complete')}>
                        <CheckCircle2 size={16} /> Complete &amp; Close Visit
                      </LoadingButton>
                    </div>
                  </form>
                )}

                {/* ── TAB 2: REQUEST FROM OPD TO LABORATORY ── */}
                {activeConsultationTab === 'lab' && (
                  <LaboratoryPaperForm
                    selectedQueueItem={selectedQueueItem}
                    selectedPatient={selectedPatient}
                    patientName={selectedPatientName}
                    patientAge={selectedPatientAge}
                    patientCode={selectedPatientCode}
                    currentUser={currentUser}
                    consultation={consultation}
                    labTests={labTests}
                    onTogglePreset={toggleLabPreset}
                    onAddCustomTest={line => setLabTests(previous => [...previous, line])}
                    onUpdateInstruction={(index, value) => setLabTests(previous => previous.map((line, lineIndex) => lineIndex === index ? { ...line, technologistInstructions: value } : line))}
                    onRemoveTest={index => setLabTests(previous => previous.filter((_, lineIndex) => lineIndex !== index))}
                    labTestName={labTestName}
                    setLabTestName={setLabTestName}
                    labSpecimenType={labSpecimenType}
                    setLabSpecimenType={setLabSpecimenType}
                    labCustomUnit={labCustomUnit}
                    setLabCustomUnit={setLabCustomUnit}
                    labCustomReferenceRange={labCustomReferenceRange}
                    setLabCustomReferenceRange={setLabCustomReferenceRange}
                    labTechInstructions={labTechInstructions}
                    setLabTechInstructions={setLabTechInstructions}
                    labPriority={labPriority}
                    setLabPriority={setLabPriority}
                    labClinicalNotes={labClinicalNotes}
                    setLabClinicalNotes={setLabClinicalNotes}
                    onSubmit={handleDispatchToLab}
                    onBack={() => setActiveConsultationTab('overview')}
                    actionLoading={actionLoading}
                  />
                )}

                {/* ── TAB 3: REQUEST FROM OPD TO PHARMACY ── */}
                {activeConsultationTab === 'pharmacy' && (
                  <form onSubmit={handleDispatchToPharmacy} noValidate>
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
                      <LoadingButton type="submit" className="btn btn-primary" disabled={Boolean(actionLoading && actionLoading !== 'pharmacy')} loading={actionLoading === 'pharmacy'} loadingLabel="Sending…">
                        <Send size={15} /> Dispatch Prescription to Pharmacy
                      </LoadingButton>
                    </div>
                  </form>
                )}

                {/* ── TAB 4: OPTIONAL ADDITIONAL VITALS ── */}
                {activeConsultationTab === 'vitals' && (
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Activity size={16} className="text-primary" /> Additional Vitals <span className="text-muted" style={{ fontSize: '0.72rem', fontWeight: 500 }}>(optional)</span>
                    </h4>
                    <p className="text-muted" style={{ fontSize: '0.78rem', marginBottom: '0.85rem' }}>
                      Add measurements when available. Vitals are an additional clinical record and are not required to close the consultation.
                    </p>

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
                          value={vitalsForm.heartRate ?? ''}
                          onChange={(e) => setVitalsForm({ ...vitalsForm, heartRate: e.target.value === '' ? undefined : Number(e.target.value) })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Temperature (°C)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={vitalsForm.temperature ?? ''}
                          onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: e.target.value === '' ? undefined : Number(e.target.value) })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Oxygen SpO2 (%)</label>
                        <input
                          type="number"
                          value={vitalsForm.spo2 ?? ''}
                          onChange={(e) => setVitalsForm({ ...vitalsForm, spo2: e.target.value === '' ? undefined : Number(e.target.value) })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Respiratory Rate (/min)</label>
                        <input
                          type="number"
                          value={vitalsForm.respiratoryRate ?? ''}
                          onChange={(e) => setVitalsForm({ ...vitalsForm, respiratoryRate: e.target.value === '' ? undefined : Number(e.target.value) })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Weight (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={vitalsForm.weightKg ?? ''}
                          onChange={(e) => setVitalsForm({ ...vitalsForm, weightKg: e.target.value === '' ? undefined : Number(e.target.value) })}
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
                      Physician: {formatDoctorName(rec.doctorName)}
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
        onConfirm={async () => {
          await executeTransferToER();
          setShowTransferConfirm(false);
        }}
      />

      {/* Outside Hospital/Facility Referral Modal */}
      {showOutsideReferral && selectedQueueItem && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => !actionLoading && setShowOutsideReferral(false)}>
            <div className="modal" style={{ maxWidth: 540, width: '100%', padding: '1.5rem', borderRadius: 12 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', fontWeight: 800 }}>
                  <Building2 size={20} className="text-primary" /> Refer to Outside Facility
                </h3>
                <button type="button" className="modal-close-btn" onClick={() => setShowOutsideReferral(false)} disabled={Boolean(actionLoading)} aria-label="Close dialog">
                  <X size={16} />
                </button>
              </div>

              <div style={{ background: 'var(--clr-bg-hover)', padding: '0.65rem 0.85rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.82rem' }}>
                Patient: <strong>{patientNameFor(patients, selectedQueueItem.patientId, selectedQueueItem.patientName)}</strong> ({patientCodeFor(patients, selectedQueueItem.patientId)})
              </div>

              <form onSubmit={handleReferOutside} noValidate>
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

                <div className="form-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Occupation</label>
                    <input
                      value={referralOccupation}
                      onChange={e => setReferralOccupation(e.target.value)}
                      placeholder="Occupation / role"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Patient history</label>
                    <input
                      value={referralHistory}
                      onChange={e => setReferralHistory(e.target.value)}
                      placeholder="Pertinent history"
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Physical examination</label>
                    <textarea
                      rows={2}
                      value={referralPhysicalExam}
                      onChange={e => setReferralPhysicalExam(e.target.value)}
                      placeholder="Relevant examination findings"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Action taken</label>
                    <textarea
                      rows={2}
                      value={referralActionTaken}
                      onChange={e => setReferralActionTaken(e.target.value)}
                      placeholder="Treatment or action taken before referral"
                    />
                  </div>
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
                  <button type="button" className="btn btn-secondary" onClick={() => setShowOutsideReferral(false)} disabled={Boolean(actionLoading)}>
                    Cancel
                  </button>
                  <LoadingButton type="submit" className="btn btn-warning" loading={actionLoading === 'referral'} loadingLabel="Sending…" disabled={Boolean(actionLoading && actionLoading !== 'referral')}>
                    <Send size={15} /> Confirm &amp; Dispatch Referral
                  </LoadingButton>
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
          occupation={printedReferral.occupation}
          patientHistory={printedReferral.patientHistory}
          physicalExamination={printedReferral.physicalExamination}
          actionTaken={printedReferral.actionTaken}
          referralNumber={printedReferral.referralNumber}
        />
      )}
    </div>
  );
}
