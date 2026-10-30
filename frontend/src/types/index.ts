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
  isActive?: boolean;
  createdAt?: string;
}

export interface CreateStaffInput {
  name: string;
  username: string;
  password: string;
  role: UserRole;
  roleTitle?: string;
  department?: string;
  email?: string;
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
  assignedOpdRoom?: string;
  vitals?: Vitals;
  chiefComplaint: string;

  // ── Card Class & Request Tracking ──
  cardStatus?: 'Existing Card' | 'New Card';
  hasExistingCard?: boolean;
  requestSource?: 'Card Room' | 'Nurse Triage' | 'OPD Consultation' | 'Laboratory' | 'Emergency';
  requestDestination?: QueueStage;
  requestNotes?: string;
  allergies?: string[];
  chronicConditions?: string[];
  bloodGroup?: BloodGroup;

  // ── OPD to Lab & Pharmacy Pipeline ──
  labOrderId?: string;
  labTestName?: string;
  labCategory?: string;
  labStatus?: 'Requested' | 'Sample Collected' | 'Analyzing' | 'Completed';
  labResult?: string;
  labUnit?: string;
  labReferenceRange?: string;
  labIsAbnormal?: boolean;
  labCompletedAt?: string;
  labNotes?: string;

  pharmacyOrderId?: string;
  prescribedMedicines?: {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
    instructions?: string;
  }[];
  pharmacyStatus?: 'Pending' | 'Dispensed';

  doctorDiagnosis?: string;
  consultationNotes?: string;
  completedAt?: string;
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

// ── Security Center Types ──────────────────────────────────────────

/** Severity levels for security events. */
export type SecuritySeverity = 'info' | 'warning' | 'critical';

/** Audit action codes. */
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'LOGIN' | 'LOGOUT' | 'WORKFLOW' | 'CONFIG' | 'BACKUP' | 'RESTORE';

/** An entry in the immutable audit_logs table. */
export interface AuditLog {
  id: string;
  request_id: string | null;
  user_id: string | null;
  username: string | null;
  user_role: string | null;
  action: AuditAction;
  resource: string;
  resource_id: string | null;
  summary: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  ip_address: string | null;
  created_at: string;
  user_display_name?: string | null;
}

/** An entry in the security_events table. */
export interface SecurityEvent {
  id: string;
  event_type: string;
  severity: SecuritySeverity;
  user_id: string | null;
  username: string | null;
  ip_address: string | null;
  request_id: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** A key-value row from system_config. */
export interface SystemConfig {
  key: string;
  value: string;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

/** Response from GET /api/health. */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  environment: string;
  uptime: { seconds: number; human: string };
  memory: { heapUsedMb: number };
  database: {
    connected: boolean;
    schemaVersion: string | null;
    migrationCount: number;
    setupRequired?: boolean;
    reason?: string;
  } | null;
  maintenance?: { enabled: boolean; message: string };
  setupRequired: boolean;
  timestamp: string;
}

// ── Backup & Restore ───────────────────────────────────────────────

/** One table row count shown on the backup page. */
export interface BackupTableStat {
  table: string;
  label: string;
  optional: boolean;
  rows: number;
  missing?: boolean;
}

/** A recorded export or restore attempt. */
export interface BackupRun {
  id: string;
  kind: 'export' | 'import';
  mode: 'merge' | 'replace' | null;
  status: 'completed' | 'validated' | 'failed';
  actor_id: string | null;
  actor: string | null;
  filename: string | null;
  checksum: string | null;
  dry_run: boolean;
  counts: Record<string, number>;
  notes: string | null;
  created_at: string;
}

/** Per-table outcome from a restore / validation run. */
export interface BackupTableResult {
  received?: number;
  applied?: number;
  removed?: number;
}

/** Response from POST /api/admin/backup/restore. */
export interface BackupRestoreSummary {
  mode: 'merge' | 'replace';
  dryRun: boolean;
  startedAt: string;
  finishedAt?: string;
  tables: Record<string, BackupTableResult>;
  warnings: string[];
}

/** Response from GET /api/admin/stats. */
export interface SecurityStats {
  last24h: {
    successfulLogins: number;
    failedLogins: number;
    criticalSecurityEvents: number;
    auditActions: number;
  };
  activeStaffCount: number;
  topFailedLoginIps: Array<{ ip_address: string; count: number }>;
  recentLockouts: SecurityEvent[];
}
