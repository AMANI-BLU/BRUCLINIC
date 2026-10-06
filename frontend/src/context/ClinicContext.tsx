import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  Patient, Doctor, Appointment, MedicalRecord, MedicineItem,
  ClinicQueueItem, ERCase, LabOrder, PharmacyOrder,
} from '../types';
import {
  MOCK_PATIENTS, MOCK_DOCTORS, MOCK_APPOINTMENTS, MOCK_RECORDS, MOCK_MEDICINES,
  MOCK_QUEUE, MOCK_ER_CASES, MOCK_LAB_ORDERS, MOCK_PHARMACY_ORDERS,
} from '../data/mockData';

interface ClinicContextType {
  patients: Patient[];
  doctors: Doctor[];
  appointments: Appointment[];
  records: MedicalRecord[];
  medicines: MedicineItem[];
  queue: ClinicQueueItem[];
  erCases: ERCase[];
  labOrders: LabOrder[];
  pharmacyOrders: PharmacyOrder[];

  addPatient: (p: Omit<Patient, 'id' | 'registeredAt'>) => void;
  updatePatient: (id: string, p: Partial<Patient>) => void;
  deletePatient: (id: string) => void;

  addAppointment: (a: Omit<Appointment, 'id'>) => void;
  updateAppointment: (id: string, a: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;

  addRecord: (r: Omit<MedicalRecord, 'id'>) => void;
  updateMedicineStock: (id: string, delta: number) => void;

  // Queue actions (Reception & OPD)
  addToQueue: (item: Omit<ClinicQueueItem, 'id' | 'tokenNumber' | 'registeredTime'>) => void;
  updateQueueItem: (id: string, updates: Partial<ClinicQueueItem>) => void;
  removeFromQueue: (id: string) => void;

  // ER actions
  addERCase: (item: Omit<ERCase, 'id' | 'arrivalTime'>) => void;
  updateERCase: (id: string, updates: Partial<ERCase>) => void;

  // Lab actions
  addLabOrder: (order: Omit<LabOrder, 'id' | 'orderedAt'>) => void;
  updateLabOrder: (id: string, updates: Partial<LabOrder>) => void;

  // Pharmacy actions
  addPharmacyOrder: (order: Omit<PharmacyOrder, 'id' | 'prescribedAt'>) => void;
  dispensePharmacyOrder: (id: string, dispensedBy: string) => void;
}

const ClinicContext = createContext<ClinicContextType | null>(null);

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>(MOCK_PATIENTS);
  const [doctors] = useState<Doctor[]>(MOCK_DOCTORS);
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [records, setRecords] = useState<MedicalRecord[]>(MOCK_RECORDS);
  const [medicines, setMedicines] = useState<MedicineItem[]>(MOCK_MEDICINES);
  const [queue, setQueue] = useState<ClinicQueueItem[]>(MOCK_QUEUE);
  const [erCases, setErCases] = useState<ERCase[]>(MOCK_ER_CASES);
  const [labOrders, setLabOrders] = useState<LabOrder[]>(MOCK_LAB_ORDERS);
  const [pharmacyOrders, setPharmacyOrders] = useState<PharmacyOrder[]>(MOCK_PHARMACY_ORDERS);

  const addPatient = useCallback((p: Omit<Patient, 'id' | 'registeredAt'>) => {
    const newP: Patient = {
      ...p, id: `P${String(Date.now()).slice(-4)}`,
      registeredAt: new Date().toISOString().split('T')[0],
    };
    setPatients(prev => [newP, ...prev]);
  }, []);

  const updatePatient = useCallback((id: string, p: Partial<Patient>) => {
    setPatients(prev => prev.map(x => x.id === id ? { ...x, ...p } : x));
  }, []);

  const deletePatient = useCallback((id: string) => {
    setPatients(prev => prev.filter(x => x.id !== id));
  }, []);

  const addAppointment = useCallback((a: Omit<Appointment, 'id'>) => {
    const newA: Appointment = { ...a, id: `A${String(Date.now()).slice(-4)}` };
    setAppointments(prev => [newA, ...prev]);
  }, []);

  const updateAppointment = useCallback((id: string, a: Partial<Appointment>) => {
    setAppointments(prev => prev.map(x => x.id === id ? { ...x, ...a } : x));
  }, []);

  const deleteAppointment = useCallback((id: string) => {
    setAppointments(prev => prev.filter(x => x.id !== id));
  }, []);

  const addRecord = useCallback((r: Omit<MedicalRecord, 'id'>) => {
    const newR: MedicalRecord = { ...r, id: `R${String(Date.now()).slice(-4)}` };
    setRecords(prev => [newR, ...prev]);
  }, []);

  const updateMedicineStock = useCallback((id: string, delta: number) => {
    setMedicines(prev => prev.map(m => m.id === id ? { ...m, stock: Math.max(0, m.stock + delta) } : m));
  }, []);

  // Queue actions
  const addToQueue = useCallback((item: Omit<ClinicQueueItem, 'id' | 'tokenNumber' | 'registeredTime'>) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const count = queue.length + 1;
    const newItem: ClinicQueueItem = {
      ...item,
      id: `Q${String(Date.now()).slice(-4)}`,
      tokenNumber: `BU-${count < 10 ? '0' + count : count}`,
      registeredTime: time,
    };
    setQueue(prev => [...prev, newItem]);
  }, [queue.length]);

  const updateQueueItem = useCallback((id: string, updates: Partial<ClinicQueueItem>) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  }, []);

  // ER actions
  const addERCase = useCallback((item: Omit<ERCase, 'id' | 'arrivalTime'>) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newCase: ERCase = {
      ...item,
      id: `ER-${String(Date.now()).slice(-3)}`,
      arrivalTime: time,
    };
    setErCases(prev => [newCase, ...prev]);
  }, []);

  const updateERCase = useCallback((id: string, updates: Partial<ERCase>) => {
    setErCases(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  // Lab actions
  const addLabOrder = useCallback((order: Omit<LabOrder, 'id' | 'orderedAt'>) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newOrder: LabOrder = {
      ...order,
      id: `LAB-${String(Date.now()).slice(-3)}`,
      orderedAt: time,
    };
    setLabOrders(prev => [newOrder, ...prev]);
  }, []);

  const updateLabOrder = useCallback((id: string, updates: Partial<LabOrder>) => {
    setLabOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  }, []);

  // Pharmacy actions
  const addPharmacyOrder = useCallback((order: Omit<PharmacyOrder, 'id' | 'prescribedAt'>) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newOrder: PharmacyOrder = {
      ...order,
      id: `RX-${String(Date.now()).slice(-3)}`,
      prescribedAt: time,
    };
    setPharmacyOrders(prev => [newOrder, ...prev]);
  }, []);

  const dispensePharmacyOrder = useCallback((id: string, dispensedBy: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setPharmacyOrders(prev => {
      const target = prev.find(p => p.id === id);
      if (target) {
        // Automatically deduct medicine stock
        target.medicines.forEach(med => {
          if (med.medicineId) {
            updateMedicineStock(med.medicineId, -med.quantity);
          }
        });
      }
      return prev.map(p => p.id === id ? {
        ...p,
        status: 'Dispensed',
        dispensedAt: time,
        dispensedBy,
      } : p);
    });
  }, [updateMedicineStock]);

  return (
    <ClinicContext.Provider value={{
      patients, doctors, appointments, records, medicines,
      queue, erCases, labOrders, pharmacyOrders,
      addPatient, updatePatient, deletePatient,
      addAppointment, updateAppointment, deleteAppointment,
      addRecord, updateMedicineStock,
      addToQueue, updateQueueItem, removeFromQueue,
      addERCase, updateERCase,
      addLabOrder, updateLabOrder,
      addPharmacyOrder, dispensePharmacyOrder,
    }}>
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error('useClinic must be used within ClinicProvider');
  return ctx;
}
