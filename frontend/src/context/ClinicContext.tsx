import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ApiError, apiDelete, apiList, apiPatch, apiPost } from '../api/client';
import { useAuth } from './AuthContext';
import { useMaintenance } from './MaintenanceContext';
import { useNetwork } from './NetworkContext';
import type {
  Appointment, ClinicQueueItem, Doctor, ERCase, EmergencyBay, LabOrder, MedicalRecord, MedicineItem, Patient, PharmacyOrder,
  Priority, QueuePriority, QueueStage, Vitals,
} from '../types';

interface ClinicContextType {
  patients: Patient[]; doctors: Doctor[]; appointments: Appointment[]; records: MedicalRecord[]; medicines: MedicineItem[];
  queue: ClinicQueueItem[]; erCases: ERCase[]; emergencyBays: EmergencyBay[]; labOrders: LabOrder[]; pharmacyOrders: PharmacyOrder[];
  loading: boolean; error: string | null; refresh: (options?: { silent?: boolean }) => Promise<void>;
  addPatient: (patient: Omit<Patient, 'id' | 'registeredAt'>) => Promise<Patient>;
  updatePatient: (id: string, changes: Partial<Patient>) => Promise<void>;
  deletePatient: (id: string) => Promise<void>;
  addAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<Appointment>;
  updateAppointment: (id: string, changes: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  addRecord: (record: Omit<MedicalRecord, 'id'>) => Promise<MedicalRecord>;
  addMedicine: (medicine: Omit<MedicineItem, 'id'>) => Promise<MedicineItem>;
  updateMedicineStock: (id: string, delta: number) => Promise<void>;
  updateMedicine: (id: string, changes: Partial<MedicineItem>) => Promise<void>;
  addToQueue: (item: Omit<ClinicQueueItem, 'id' | 'tokenNumber' | 'registeredTime'>) => Promise<ClinicQueueItem>;
  updateQueueItem: (id: string, changes: Partial<ClinicQueueItem>) => Promise<void>;
  removeFromQueue: (id: string) => Promise<void>;
  sendCardToOpdRequest: (data: { patient: Patient; hasExistingCard: boolean; chiefComplaint: string; priority: QueuePriority; stage: QueueStage; assignedDoctorId?: string; assignedDoctorName?: string; assignedOpdRoom?: string; vitals?: Vitals }) => Promise<ClinicQueueItem>;
  sendOpdToLabRequest: (queueItemId: string, data: { testName?: string; category?: LabOrder['category']; priority: Priority; specimenType?: string; notes?: string; doctorId?: string; doctorName?: string; doctorDiagnosis?: string; consultationNotes?: string; tests?: Array<{ testName: string; category: string; specimenType: string; technologistInstructions?: string }> }) => Promise<void>;
  sendOpdToPharmacyRequest: (queueItemId: string, data: { medicines: Array<{ medicineId?: string; name: string; quantity?: number; instructions?: string; isExternal?: boolean; dosage?: string; frequency?: string; duration?: string }>; doctorId?: string; doctorName?: string; notes?: string; doctorDiagnosis?: string }) => Promise<void>;
  completeOpdConsultation: (queueItemId: string, record: Omit<MedicalRecord, 'id' | 'prescription'> & { prescription?: MedicalRecord['prescription'] }) => Promise<void>;
  saveOpdAssessment: (queueItemId: string, record: Partial<Omit<MedicalRecord, 'id' | 'patientId' | 'patientName'>>) => Promise<void>;
  referOutside: (queueItemId: string, data: { destination: string; reason: string; doctorName: string; recordData: Partial<Omit<MedicalRecord, 'id' | 'patientId' | 'patientName'>> }) => Promise<void>;
  transferToEmergency: (queueItemId: string, data: { arrivalMethod: ERCase['arrivalMethod']; acuity: ERCase['acuity']; chiefComplaint: string; bedNumber?: string; vitals?: Vitals; attendingDoctor?: string; diagnosis?: string; criticalNotes?: string; requestSource?: string; requestNotes?: string }) => Promise<void>;
  addERCase: (item: Omit<ERCase, 'id' | 'arrivalTime'>) => Promise<ERCase>;
  updateERCase: (id: string, changes: Partial<ERCase>) => Promise<void>;
  completeEmergencyCase: (id: string, recordData?: { diagnosis?: string; notes?: string }) => Promise<void>;
  referEmergencyCase: (id: string, data: { destination: string; reason: string }) => Promise<void>;
  addEmergencyBay: (bay: Omit<EmergencyBay, 'id' | 'createdAt' | 'updatedAt'>) => Promise<EmergencyBay>;
  deleteEmergencyBay: (id: string) => Promise<void>;
  addLabOrder: (order: Omit<LabOrder, 'id' | 'orderedAt'>) => Promise<LabOrder>;
  updateLabOrder: (id: string, changes: Partial<LabOrder>) => Promise<void>;
  addPharmacyOrder: (order: Omit<PharmacyOrder, 'id' | 'prescribedAt'>) => Promise<PharmacyOrder>;
  dispensePharmacyOrder: (id: string, dispensedBy: string, overrides?: Record<string, string>, quantities?: Record<string, number>) => Promise<void>;
}

function ensureStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(v => String(v));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        return ensureStringArray(parsed);
      } catch {
        return [trimmed];
      }
    }
    return [trimmed];
  }
  return [];
}

function normalizePatient(patient: Patient): Patient {
  return {
    ...patient,
    allergies: ensureStringArray(patient.allergies),
    chronicConditions: ensureStringArray(patient.chronicConditions),
  };
}

function normalizeQueueItem(item: ClinicQueueItem): ClinicQueueItem {
  return {
    ...item,
    allergies: ensureStringArray(item.allergies),
    chronicConditions: ensureStringArray(item.chronicConditions),
  };
}

function notifyActionSuccess(message: string) {
  window.dispatchEvent(new CustomEvent('bruclinic:action-success', { detail: message }));
}

const ClinicContext = createContext<ClinicContextType | null>(null);

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated, role } = useAuth();
  const { enabled: maintenance, checking: maintenanceChecking } = useMaintenance();
  const { online } = useNetwork();
  const wasOnline = useRef(online);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [queue, setQueue] = useState<ClinicQueueItem[]>([]);
  const [erCases, setErCases] = useState<ERCase[]>([]);
  const [emergencyBays, setEmergencyBays] = useState<EmergencyBay[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [pharmacyOrders, setPharmacyOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!isAuthenticated || !token || maintenance || maintenanceChecking) {
      setPatients([]); setDoctors([]); setAppointments([]); setRecords([]); setMedicines([]); setQueue([]); setErCases([]); setEmergencyBays([]); setLabOrders([]); setPharmacyOrders([]);
      setLoading(false); setError(null);
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    try {
      const safeList = async <T,>(resource: string): Promise<T[]> => {
        try {
          const res = await apiList<T>(resource, token);
          return res.data || [];
        } catch (cause) {
          if (cause instanceof ApiError && cause.status === 403) {
            // Disallowed for this staff role, gracefully return empty list
            return [];
          }
          throw cause;
        }
      };

      // ER bays were added after the original clinic schema. If an older
      // deployment has not applied that optional migration (or route) yet,
      // keep the rest of the clinic workspace usable; the ER page already
      // has a built-in default bay map until the migration is applied.
      const safeBayList = safeList<EmergencyBay>('emergency-bays').catch(cause => {
        if (cause instanceof ApiError && (cause.status === 404 || cause.status >= 500)) return [];
        throw cause;
      });

      const [patientList, doctorList, appointmentList, recordList, medicineList, queueList, erList, bayList, labList, pharmacyList] = await Promise.all([
        safeList<Patient>('patients'),
        safeList<Doctor>('doctors'),
        safeList<Appointment>('appointments'),
        safeList<MedicalRecord>('records'),
        safeList<MedicineItem>('medicines'),
        safeList<ClinicQueueItem>('queue'),
        safeList<ERCase>('emergency'),
        safeBayList,
        safeList<LabOrder>('lab-orders'),
        safeList<PharmacyOrder>('pharmacy-orders'),
      ]);
      setPatients(patientList.map(normalizePatient)); setDoctors(doctorList); setAppointments(appointmentList); setRecords(recordList);
      setMedicines(medicineList); setQueue(queueList.map(normalizeQueueItem)); setErCases(erList); setEmergencyBays(bayList); setLabOrders(labList); setPharmacyOrders(pharmacyList);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load clinic data from the database.');
    } finally { if (!silent) setLoading(false); }
  }, [isAuthenticated, token, maintenance, maintenanceChecking]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Pull fresh clinic data when the device comes back online, so a temporary
  // outage does not leave staff looking at an empty or stale workspace.
  useEffect(() => {
    const reconnected = online && !wasOnline.current;
    wasOnline.current = online;
    if (reconnected && isAuthenticated && token && !maintenance && !maintenanceChecking) {
      void refresh({ silent: true });
    }
  }, [online, isAuthenticated, token, maintenance, maintenanceChecking, refresh]);

  // Department workspaces need to see transfers and orders made by another
  // staff session without requiring a manual page reload.
  useEffect(() => {
    if (!online || !isAuthenticated || !token || maintenance || maintenanceChecking) return;
    if (!['opd', 'emergency', 'pharmacy', 'laboratory'].includes(role)) return;
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh({ silent: true });
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [online, isAuthenticated, token, role, maintenance, maintenanceChecking, refresh]);

  const mutate = useCallback(async (operation: () => Promise<void>, successMessage?: string) => {
    setError(null);
    try {
      await operation();
      if (successMessage) notifyActionSuccess(successMessage);
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'The database request failed.'; setError(message); throw cause; }
  }, []);

  const addPatient = useCallback(async (patient: Omit<Patient, 'id' | 'registeredAt'>) => {
    const response = await apiPost<{ data: Patient }>('/patients', patient, token);
    const normalized = normalizePatient(response.data);
    setPatients(previous => [normalized, ...previous]);
    notifyActionSuccess('Patient registered');
    return normalized;
  }, [token]);
  const updatePatient = useCallback((id: string, changes: Partial<Patient>) => mutate(async () => { const response = await apiPatch<{ data: Patient }>(`/patients/${encodeURIComponent(id)}`, changes, token); const normalized = normalizePatient(response.data); setPatients(previous => previous.map(item => item.id === id ? normalized : item)); }, 'Patient record updated'), [mutate, token]);
  const deletePatient = useCallback((id: string) => mutate(async () => {
    await apiDelete(`/patients/${encodeURIComponent(id)}`, token);
    setPatients(previous => previous.filter(item => item.id !== id));
    setQueue(previous => previous.filter(item => item.patientId !== id));
    setAppointments(previous => previous.filter(item => item.patientId !== id));
    setRecords(previous => previous.filter(item => item.patientId !== id));
    setErCases(previous => previous.filter(item => item.patientId !== id));
    setLabOrders(previous => previous.filter(item => item.patientId !== id));
    setPharmacyOrders(previous => previous.filter(item => item.patientId !== id));
  }, 'Patient record deleted'), [mutate, token]);

  const addAppointment = useCallback(async (appointment: Omit<Appointment, 'id'>) => { const response = await apiPost<{ data: Appointment }>('/appointments', appointment, token); setAppointments(previous => [response.data, ...previous]); notifyActionSuccess('Appointment booked'); return response.data; }, [token]);
  const updateAppointment = useCallback((id: string, changes: Partial<Appointment>) => mutate(async () => { const response = await apiPatch<{ data: Appointment }>(`/appointments/${encodeURIComponent(id)}`, changes, token); setAppointments(previous => previous.map(item => item.id === id ? response.data : item)); }, 'Appointment updated'), [mutate, token]);
  const deleteAppointment = useCallback((id: string) => mutate(async () => { await apiDelete(`/appointments/${encodeURIComponent(id)}`, token); setAppointments(previous => previous.filter(item => item.id !== id)); }, 'Appointment deleted'), [mutate, token]);

  const addRecord = useCallback(async (record: Omit<MedicalRecord, 'id'>) => { const response = await apiPost<{ data: MedicalRecord }>('/records', record, token); setRecords(previous => [response.data, ...previous]); notifyActionSuccess('Medical record saved'); return response.data; }, [token]);
  const addMedicine = useCallback(async (medicine: Omit<MedicineItem, 'id'>) => { const response = await apiPost<{ data: MedicineItem }>('/medicines', medicine, token); setMedicines(previous => [...previous, response.data]); notifyActionSuccess('Medicine added to inventory'); return response.data; }, [token]);
  const updateMedicineStock = useCallback((id: string, delta: number) => mutate(async () => { const medicine = medicines.find(item => item.id === id); if (!medicine) throw new Error('Medicine was not found.'); const response = await apiPatch<{ data: MedicineItem }>(`/medicines/${encodeURIComponent(id)}`, { stock: Math.max(0, medicine.stock + delta) }, token); setMedicines(previous => previous.map(item => item.id === id ? response.data : item)); }, 'Inventory stock updated'), [medicines, mutate, token]);
  const updateMedicine = useCallback((id: string, changes: Partial<MedicineItem>) => mutate(async () => { const response = await apiPatch<{ data: MedicineItem }>(`/medicines/${encodeURIComponent(id)}`, changes, token); setMedicines(previous => previous.map(item => item.id === id ? response.data : item)); }, 'Medicine details updated'), [mutate, token]);

  const addToQueue = useCallback(async (item: Omit<ClinicQueueItem, 'id' | 'tokenNumber' | 'registeredTime'>) => { const response = await apiPost<{ data: ClinicQueueItem }>('/queue', item, token); const normalized = normalizeQueueItem(response.data); setQueue(previous => [...previous, normalized]); notifyActionSuccess('Patient added to the clinic queue'); return normalized; }, [token]);
  const updateQueueItem = useCallback((id: string, changes: Partial<ClinicQueueItem>) => mutate(async () => { const response = await apiPatch<{ data: ClinicQueueItem }>(`/queue/${encodeURIComponent(id)}`, changes, token); const normalized = normalizeQueueItem(response.data); setQueue(previous => previous.map(item => item.id === id ? normalized : item)); }, 'Queue request updated'), [mutate, token]);
  const removeFromQueue = useCallback((id: string) => mutate(async () => { await apiDelete(`/queue/${encodeURIComponent(id)}`, token); setQueue(previous => previous.filter(item => item.id !== id)); }, 'Queue request removed'), [mutate, token]);

  const sendCardToOpdRequest = useCallback(async (data: Parameters<ClinicContextType['sendCardToOpdRequest']>[0]) => {
    const response = await apiPost<{ data: any }>('/workflows/card-to-opd', {
      patientId: data.patient.id, hasExistingCard: data.hasExistingCard, chiefComplaint: data.chiefComplaint, priority: data.priority, stage: data.stage,
      assignedDoctorId: data.assignedDoctorId, assignedDoctorName: data.assignedDoctorName, assignedOpdRoom: data.assignedOpdRoom, vitals: data.vitals,
    }, token);
    await refresh();
    const item = response.data?.queueItem || response.data;
    notifyActionSuccess('Patient request sent to the clinic queue');
    return item as ClinicQueueItem;
  }, [refresh, token]);
  const sendOpdToLabRequest = useCallback(async (queueItemId: string, data: Parameters<ClinicContextType['sendOpdToLabRequest']>[1]) => { await apiPost('/workflows/opd-to-lab', { queueItemId, ...data }, token); await refresh(); notifyActionSuccess('Laboratory request sent'); }, [refresh, token]);
  const sendOpdToPharmacyRequest = useCallback(async (queueItemId: string, data: Parameters<ClinicContextType['sendOpdToPharmacyRequest']>[1]) => { await apiPost('/workflows/opd-to-pharmacy', { queueItemId, ...data }, token); await refresh(); notifyActionSuccess('Prescription sent to Pharmacy'); }, [refresh, token]);
  const completeOpdConsultation = useCallback(async (queueItemId: string, record: Omit<MedicalRecord, 'id' | 'prescription'> & { prescription?: MedicalRecord['prescription'] }) => { await apiPost('/workflows/complete-consultation', { queueItemId, recordData: record }, token); await refresh(); notifyActionSuccess('Consultation completed'); }, [refresh, token]);
  const saveOpdAssessment = useCallback(async (queueItemId: string, record: Partial<Omit<MedicalRecord, 'id' | 'patientId' | 'patientName'>>) => { await apiPost('/workflows/save-assessment', { queueItemId, recordData: record }, token); await refresh(); notifyActionSuccess('Assessment saved without completing the visit'); }, [refresh, token]);
  const referOutside = useCallback(async (queueItemId: string, data: Parameters<ClinicContextType['referOutside']>[1]) => { await apiPost('/workflows/refer-outside', { queueItemId, ...data }, token); await refresh(); notifyActionSuccess('External referral recorded'); }, [refresh, token]);
  const transferToEmergency = useCallback(async (queueItemId: string, data: Parameters<ClinicContextType['transferToEmergency']>[1]) => {
    await apiPost('/workflows/transfer-to-emergency', { queueItemId, ...data }, token);
    await refresh({ silent: true });
    notifyActionSuccess('Patient transferred to Emergency');
  }, [refresh, token]);

  const addERCase = useCallback(async (item: Omit<ERCase, 'id' | 'arrivalTime'>) => {
    const response = await apiPost<{ data: ERCase }>('/emergency', {
      ...item,
      arrivalTime: new Date().toISOString(),
    }, token);
    setErCases(previous => [response.data, ...previous]);
    notifyActionSuccess('Emergency case created');
    return response.data;
  }, [token]);
  const updateERCase = useCallback((id: string, changes: Partial<ERCase>) => mutate(async () => { const response = await apiPatch<{ data: ERCase }>(`/emergency/${encodeURIComponent(id)}`, changes, token); setErCases(previous => previous.map(item => item.id === id ? response.data : item)); }, 'Emergency case updated'), [mutate, token]);
  const completeEmergencyCase = useCallback(async (id: string, recordData: { diagnosis?: string; notes?: string } = {}) => {
    await apiPost('/workflows/complete-emergency', { emergencyCaseId: id, ...recordData }, token);
    await refresh({ silent: true });
    notifyActionSuccess('Emergency case completed and added to Medical Records');
  }, [refresh, token]);
  const referEmergencyCase = useCallback(async (id: string, data: { destination: string; reason: string }) => {
    await apiPost('/workflows/refer-emergency', { emergencyCaseId: id, ...data }, token);
    await refresh({ silent: true });
    notifyActionSuccess('Emergency referral recorded and added to Medical Records');
  }, [refresh, token]);
  const addEmergencyBay = useCallback(async (bay: Omit<EmergencyBay, 'id' | 'createdAt' | 'updatedAt'>) => {
    const response = await apiPost<{ data: EmergencyBay }>('/emergency-bays', bay, token);
    setEmergencyBays(previous => [...previous, response.data].sort((a, b) => a.name.localeCompare(b.name)));
    notifyActionSuccess('Emergency bay added');
    return response.data;
  }, [token]);
  const deleteEmergencyBay = useCallback((id: string) => mutate(async () => {
    await apiDelete(`/emergency-bays/${encodeURIComponent(id)}`, token);
    setEmergencyBays(previous => previous.filter(item => item.id !== id));
  }, 'Emergency bay deleted'), [mutate, token]);
  const addLabOrder = useCallback(async (order: Omit<LabOrder, 'id' | 'orderedAt'>) => {
    const response = await apiPost<{ data: LabOrder }>('/lab-orders', { ...order, orderedAt: new Date().toISOString() }, token);
    setLabOrders(previous => [response.data, ...previous]);
    notifyActionSuccess('Laboratory order created');
    return response.data;
  }, [token]);
  const updateLabOrder = useCallback((id: string, changes: Partial<LabOrder>) => mutate(async () => {
    const response = await apiPatch<{ data: LabOrder }>(`/lab-orders/${encodeURIComponent(id)}`, changes, token);
    setLabOrders(previous => previous.map(item => item.id === id ? response.data : item));
    if (changes.status === 'Completed') {
      const target = queue.find(item => item.labOrderId === id);
      if (target) {
        await apiPatch(`/queue/${encodeURIComponent(target.id)}`, {
          stage: 'Doctor Consultation', labStatus: 'Completed', labResult: changes.result, labUnit: changes.unit,
          labReferenceRange: changes.referenceRange, labIsAbnormal: changes.isAbnormal, labCompletedAt: changes.completedAt,
          requestSource: 'Laboratory', requestDestination: 'Doctor Consultation', requestNotes: `Lab results ready: ${changes.result || 'Analysis complete'}.`,
        }, token);
      }
    }
    notifyActionSuccess(changes.status === 'Completed' ? 'Laboratory result verified' : 'Laboratory order updated');
  }), [mutate, queue, token]);
  const addPharmacyOrder = useCallback(async (order: Omit<PharmacyOrder, 'id' | 'prescribedAt'>) => {
    const response = await apiPost<{ data: PharmacyOrder }>('/pharmacy-orders', { ...order, prescribedAt: new Date().toISOString() }, token);
    setPharmacyOrders(previous => [response.data, ...previous]);
    notifyActionSuccess('Pharmacy order created');
    return response.data;
  }, [token]);
  const dispensePharmacyOrder = useCallback(async (id: string, dispensedBy: string, overrides?: Record<string, string>, quantities?: Record<string, number>) => { await apiPost('/workflows/dispense-pharmacy', { orderId: id, dispensedBy, overrides, quantities }, token); await refresh(); notifyActionSuccess('Prescription dispensed'); }, [refresh, token]);

  return <ClinicContext.Provider value={{
    patients, doctors, appointments, records, medicines, queue, erCases, emergencyBays, labOrders, pharmacyOrders, loading, error, refresh,
    addPatient, updatePatient, deletePatient, addAppointment, updateAppointment, deleteAppointment, addRecord, addMedicine, updateMedicineStock, updateMedicine,
    addToQueue, updateQueueItem, removeFromQueue, sendCardToOpdRequest, sendOpdToLabRequest, sendOpdToPharmacyRequest, completeOpdConsultation, saveOpdAssessment, referOutside, transferToEmergency,
    addERCase, updateERCase, completeEmergencyCase, referEmergencyCase, addEmergencyBay, deleteEmergencyBay, addLabOrder, updateLabOrder, addPharmacyOrder, dispensePharmacyOrder,
  }}>{children}</ClinicContext.Provider>;
}

export function useClinic() {
  const context = useContext(ClinicContext);
  if (!context) throw new Error('useClinic must be used within ClinicProvider');
  return context;
}
