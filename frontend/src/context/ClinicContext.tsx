import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ApiError, apiDelete, apiList, apiPatch, apiPost } from '../api/client';
import { useAuth } from './AuthContext';
import { useMaintenance } from './MaintenanceContext';
import type {
  Appointment, ClinicQueueItem, Doctor, ERCase, LabOrder, MedicalRecord, MedicineItem, Patient, PharmacyOrder,
  Priority, QueuePriority, QueueStage, Vitals,
} from '../types';

interface ClinicContextType {
  patients: Patient[]; doctors: Doctor[]; appointments: Appointment[]; records: MedicalRecord[]; medicines: MedicineItem[];
  queue: ClinicQueueItem[]; erCases: ERCase[]; labOrders: LabOrder[]; pharmacyOrders: PharmacyOrder[];
  loading: boolean; error: string | null; refresh: () => Promise<void>;
  addPatient: (patient: Omit<Patient, 'id' | 'registeredAt'>) => Promise<Patient>;
  updatePatient: (id: string, changes: Partial<Patient>) => Promise<void>;
  deletePatient: (id: string) => Promise<void>;
  addAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<Appointment>;
  updateAppointment: (id: string, changes: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  addRecord: (record: Omit<MedicalRecord, 'id'>) => Promise<MedicalRecord>;
  updateMedicineStock: (id: string, delta: number) => Promise<void>;
  addToQueue: (item: Omit<ClinicQueueItem, 'id' | 'tokenNumber' | 'registeredTime'>) => Promise<ClinicQueueItem>;
  updateQueueItem: (id: string, changes: Partial<ClinicQueueItem>) => Promise<void>;
  removeFromQueue: (id: string) => Promise<void>;
  sendCardToOpdRequest: (data: { patient: Patient; hasExistingCard: boolean; chiefComplaint: string; priority: QueuePriority; stage: QueueStage; assignedDoctorId?: string; assignedDoctorName?: string; assignedOpdRoom?: string; vitals?: Vitals }) => Promise<ClinicQueueItem>;
  sendOpdToLabRequest: (queueItemId: string, data: { testName: string; category: LabOrder['category']; priority: Priority; specimenType: string; notes?: string; doctorId?: string; doctorName?: string }) => Promise<void>;
  sendOpdToPharmacyRequest: (queueItemId: string, data: { medicines: PharmacyOrder['medicines']; doctorId?: string; doctorName?: string; notes?: string; doctorDiagnosis?: string }) => Promise<void>;
  completeOpdConsultation: (queueItemId: string, record: Omit<MedicalRecord, 'id'>) => Promise<void>;
  addERCase: (item: Omit<ERCase, 'id' | 'arrivalTime'>) => Promise<ERCase>;
  updateERCase: (id: string, changes: Partial<ERCase>) => Promise<void>;
  addLabOrder: (order: Omit<LabOrder, 'id' | 'orderedAt'>) => Promise<LabOrder>;
  updateLabOrder: (id: string, changes: Partial<LabOrder>) => Promise<void>;
  addPharmacyOrder: (order: Omit<PharmacyOrder, 'id' | 'prescribedAt'>) => Promise<PharmacyOrder>;
  dispensePharmacyOrder: (id: string, dispensedBy: string) => Promise<void>;
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

const ClinicContext = createContext<ClinicContextType | null>(null);

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const { enabled: maintenance, checking: maintenanceChecking } = useMaintenance();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [queue, setQueue] = useState<ClinicQueueItem[]>([]);
  const [erCases, setErCases] = useState<ERCase[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [pharmacyOrders, setPharmacyOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !token || maintenance || maintenanceChecking) {
      setPatients([]); setDoctors([]); setAppointments([]); setRecords([]); setMedicines([]); setQueue([]); setErCases([]); setLabOrders([]); setPharmacyOrders([]);
      setLoading(false); setError(null);
      return;
    }
    setLoading(true); setError(null);
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

      const [patientList, doctorList, appointmentList, recordList, medicineList, queueList, erList, labList, pharmacyList] = await Promise.all([
        safeList<Patient>('patients'),
        safeList<Doctor>('doctors'),
        safeList<Appointment>('appointments'),
        safeList<MedicalRecord>('records'),
        safeList<MedicineItem>('medicines'),
        safeList<ClinicQueueItem>('queue'),
        safeList<ERCase>('emergency'),
        safeList<LabOrder>('lab-orders'),
        safeList<PharmacyOrder>('pharmacy-orders'),
      ]);
      setPatients(patientList.map(normalizePatient)); setDoctors(doctorList); setAppointments(appointmentList); setRecords(recordList);
      setMedicines(medicineList); setQueue(queueList.map(normalizeQueueItem)); setErCases(erList); setLabOrders(labList); setPharmacyOrders(pharmacyList);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load clinic data from the database.');
    } finally { setLoading(false); }
  }, [isAuthenticated, token, maintenance, maintenanceChecking]);

  useEffect(() => { void refresh(); }, [refresh]);

  const mutate = useCallback(async (operation: () => Promise<void>) => {
    setError(null);
    try { await operation(); } catch (cause) { const message = cause instanceof Error ? cause.message : 'The database request failed.'; setError(message); throw cause; }
  }, []);

  const addPatient = useCallback(async (patient: Omit<Patient, 'id' | 'registeredAt'>) => {
    const response = await apiPost<{ data: Patient }>('/patients', patient, token);
    const normalized = normalizePatient(response.data);
    setPatients(previous => [normalized, ...previous]); return normalized;
  }, [token]);
  const updatePatient = useCallback((id: string, changes: Partial<Patient>) => mutate(async () => { const response = await apiPatch<{ data: Patient }>(`/patients/${encodeURIComponent(id)}`, changes, token); const normalized = normalizePatient(response.data); setPatients(previous => previous.map(item => item.id === id ? normalized : item)); }), [mutate, token]);
  const deletePatient = useCallback((id: string) => mutate(async () => { await apiDelete(`/patients/${encodeURIComponent(id)}`, token); setPatients(previous => previous.filter(item => item.id !== id)); }), [mutate, token]);

  const addAppointment = useCallback(async (appointment: Omit<Appointment, 'id'>) => { const response = await apiPost<{ data: Appointment }>('/appointments', appointment, token); setAppointments(previous => [response.data, ...previous]); return response.data; }, [token]);
  const updateAppointment = useCallback((id: string, changes: Partial<Appointment>) => mutate(async () => { const response = await apiPatch<{ data: Appointment }>(`/appointments/${encodeURIComponent(id)}`, changes, token); setAppointments(previous => previous.map(item => item.id === id ? response.data : item)); }), [mutate, token]);
  const deleteAppointment = useCallback((id: string) => mutate(async () => { await apiDelete(`/appointments/${encodeURIComponent(id)}`, token); setAppointments(previous => previous.filter(item => item.id !== id)); }), [mutate, token]);

  const addRecord = useCallback(async (record: Omit<MedicalRecord, 'id'>) => { const response = await apiPost<{ data: MedicalRecord }>('/records', record, token); setRecords(previous => [response.data, ...previous]); return response.data; }, [token]);
  const updateMedicineStock = useCallback((id: string, delta: number) => mutate(async () => { const medicine = medicines.find(item => item.id === id); if (!medicine) throw new Error('Medicine was not found.'); const response = await apiPatch<{ data: MedicineItem }>(`/medicines/${encodeURIComponent(id)}`, { stock: Math.max(0, medicine.stock + delta) }, token); setMedicines(previous => previous.map(item => item.id === id ? response.data : item)); }), [medicines, mutate, token]);

  const addToQueue = useCallback(async (item: Omit<ClinicQueueItem, 'id' | 'tokenNumber' | 'registeredTime'>) => { const response = await apiPost<{ data: ClinicQueueItem }>('/queue', item, token); const normalized = normalizeQueueItem(response.data); setQueue(previous => [...previous, normalized]); return normalized; }, [token]);
  const updateQueueItem = useCallback((id: string, changes: Partial<ClinicQueueItem>) => mutate(async () => { const response = await apiPatch<{ data: ClinicQueueItem }>(`/queue/${encodeURIComponent(id)}`, changes, token); const normalized = normalizeQueueItem(response.data); setQueue(previous => previous.map(item => item.id === id ? normalized : item)); }), [mutate, token]);
  const removeFromQueue = useCallback((id: string) => mutate(async () => { await apiDelete(`/queue/${encodeURIComponent(id)}`, token); setQueue(previous => previous.filter(item => item.id !== id)); }), [mutate, token]);

  const sendCardToOpdRequest = useCallback(async (data: Parameters<ClinicContextType['sendCardToOpdRequest']>[0]) => {
    const response = await apiPost<{ data: any }>('/workflows/card-to-opd', {
      patientId: data.patient.id, hasExistingCard: data.hasExistingCard, chiefComplaint: data.chiefComplaint, priority: data.priority, stage: data.stage,
      assignedDoctorId: data.assignedDoctorId, assignedDoctorName: data.assignedDoctorName, assignedOpdRoom: data.assignedOpdRoom, vitals: data.vitals,
    }, token);
    await refresh();
    const item = response.data?.queueItem || response.data;
    return item as ClinicQueueItem;
  }, [refresh, token]);
  const sendOpdToLabRequest = useCallback(async (queueItemId: string, data: Parameters<ClinicContextType['sendOpdToLabRequest']>[1]) => { await apiPost('/workflows/opd-to-lab', { queueItemId, ...data }, token); await refresh(); }, [refresh, token]);
  const sendOpdToPharmacyRequest = useCallback(async (queueItemId: string, data: Parameters<ClinicContextType['sendOpdToPharmacyRequest']>[1]) => { await apiPost('/workflows/opd-to-pharmacy', { queueItemId, ...data }, token); await refresh(); }, [refresh, token]);
  const completeOpdConsultation = useCallback(async (queueItemId: string, record: Omit<MedicalRecord, 'id'>) => { await apiPost('/workflows/complete-consultation', { queueItemId, recordData: record }, token); await refresh(); }, [refresh, token]);

  const addERCase = useCallback(async (item: Omit<ERCase, 'id' | 'arrivalTime'>) => { const response = await apiPost<{ data: ERCase }>('/emergency', item, token); setErCases(previous => [response.data, ...previous]); return response.data; }, [token]);
  const updateERCase = useCallback((id: string, changes: Partial<ERCase>) => mutate(async () => { const response = await apiPatch<{ data: ERCase }>(`/emergency/${encodeURIComponent(id)}`, changes, token); setErCases(previous => previous.map(item => item.id === id ? response.data : item)); }), [mutate, token]);
  const addLabOrder = useCallback(async (order: Omit<LabOrder, 'id' | 'orderedAt'>) => { const response = await apiPost<{ data: LabOrder }>('/lab-orders', order, token); setLabOrders(previous => [response.data, ...previous]); return response.data; }, [token]);
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
  }), [mutate, queue, token]);
  const addPharmacyOrder = useCallback(async (order: Omit<PharmacyOrder, 'id' | 'prescribedAt'>) => { const response = await apiPost<{ data: PharmacyOrder }>('/pharmacy-orders', order, token); setPharmacyOrders(previous => [response.data, ...previous]); return response.data; }, [token]);
  const dispensePharmacyOrder = useCallback(async (id: string, dispensedBy: string) => { await apiPost('/workflows/dispense-pharmacy', { orderId: id, dispensedBy }, token); await refresh(); }, [refresh, token]);

  return <ClinicContext.Provider value={{
    patients, doctors, appointments, records, medicines, queue, erCases, labOrders, pharmacyOrders, loading, error, refresh,
    addPatient, updatePatient, deletePatient, addAppointment, updateAppointment, deleteAppointment, addRecord, updateMedicineStock,
    addToQueue, updateQueueItem, removeFromQueue, sendCardToOpdRequest, sendOpdToLabRequest, sendOpdToPharmacyRequest, completeOpdConsultation,
    addERCase, updateERCase, addLabOrder, updateLabOrder, addPharmacyOrder, dispensePharmacyOrder,
  }}>{children}</ClinicContext.Provider>;
}

export function useClinic() {
  const context = useContext(ClinicContext);
  if (!context) throw new Error('useClinic must be used within ClinicProvider');
  return context;
}
