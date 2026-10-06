// Types for BruClinic - Borana University Clinic Management System

export type Gender = 'Male' | 'Female';
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type PatientType = 'Student' | 'Staff' | 'External';
export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'No-Show';
export type AppointmentType = 'General' | 'Dental' | 'Eye Care' | 'Mental Health' | 'Specialist' | 'Emergency';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Patient {
  id: string;
  studentId?: string;
  staffId?: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  phone: string;
  email: string;
  address: string;
  patientType: PatientType;
  department?: string;
  bloodGroup?: BloodGroup;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  registeredAt: string;
}

export interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  specialization: string;
  email: string;
  phone: string;
  gender: Gender;
  available: boolean;
  schedule: string[];
  avatar?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  type: AppointmentType;
  status: AppointmentStatus;
  reason: string;
  notes?: string;
  priority: Priority;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  visitDate: string;
  diagnosis: string;
  symptoms: string[];
  prescription: Prescription[];
  labTests?: LabTest[];
  notes: string;
  followUpDate?: string;
}

export interface Prescription {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface LabTest {
  testName: string;
  result?: string;
  unit?: string;
  referenceRange?: string;
  status: 'Pending' | 'Completed';
}

export interface MedicineItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  expiryDate: string;
  supplier: string;
  minStock: number;
  costPerUnit: number;
}

export interface DashboardStats {
  totalPatients: number;
  todayAppointments: number;
  activeDoctors: number;
  lowStockItems: number;
  pendingReports: number;
  monthlyVisits: number;
}

// ── 6 Actor Roles & Auth Types ──
export type UserRole = 'admin' | 'receptionist' | 'opd' | 'emergency' | 'pharmacy' | 'laboratory';

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  roleTitle: string;
  department: string;
  avatarInitials: string;
  badgeColor: string;
  email: string;
}

// ── Vitals & Triage ──
export interface Vitals {
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  spo2?: number;
  weightKg?: number;
}

// ── Card Receptionist / OPD Waiting Queue ──
export type QueueStage = 'Reception' | 'Nurse Triage' | 'Doctor Consultation' | 'Pharmacy' | 'Laboratory' | 'Emergency' | 'Completed';
export type QueuePriority = 'Normal' | 'Urgent' | 'Emergency';

export interface ClinicQueueItem {
  id: string;
  tokenNumber: string;
  patientId: string;
  patientName: string;
  patientType: PatientType;
  department?: string;
  registeredTime: string;
  stage: QueueStage;
  priority: QueuePriority;
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  vitals?: Vitals;
  chiefComplaint: string;
}

// ── Emergency (ER) Case ──
export type TriageAcuity = 'Red' | 'Yellow' | 'Green'; // Red: Resuscitation/Immediate, Yellow: Emergent/Urgent, Green: Non-urgent
export type ERBedStatus = 'Occupied' | 'Available' | 'Cleaning';

export interface ERCase {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: Gender;
  arrivalMethod: 'Ambulance' | 'Walk-in' | 'OPD Referral';
  arrivalTime: string;
  acuity: TriageAcuity;
  chiefComplaint: string;
  bedNumber: string;
  vitals: Vitals;
  attendingDoctor: string;
  status: 'In Treatment' | 'Stabilized' | 'Admitted to Ward' | 'Discharged' | 'Transferred';
  criticalNotes?: string;
}

// ── Laboratory Order ──
export interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  orderedAt: string;
  priority: Priority;
  testName: string;
  category: 'Hematology' | 'Biochemistry' | 'Parasitology' | 'Microbiology' | 'Serology' | 'Urinalysis';
  specimenType: string;
  status: 'Requested' | 'Sample Collected' | 'Analyzing' | 'Completed';
  result?: string;
  unit?: string;
  referenceRange?: string;
  isAbnormal?: boolean;
  notes?: string;
  completedAt?: string;
}

// ── Pharmacy Dispense Queue ──
export interface PharmacyOrder {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  prescribedAt: string;
  medicines: {
    medicineId?: string;
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
    instructions?: string;
  }[];
  status: 'Pending' | 'Dispensed' | 'Partial' | 'Cancelled';
  dispensedAt?: string;
  dispensedBy?: string;
  notes?: string;
}

