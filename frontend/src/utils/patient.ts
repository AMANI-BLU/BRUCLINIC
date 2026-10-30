/**
 * Patient identity helpers
 *
 * The patient master record is the single source of truth. Every page uses
 * these helpers so a patient is presented with the same name, card number,
 * type and initials no matter which screen or department you are in.
 */

import type { Patient, PatientType } from '../types';

type NameFields = Pick<Patient, 'firstName' | 'lastName'>;
type CodeFields = Pick<Patient, 'id' | 'studentId' | 'staffId'>;

export function patientFullName(patient?: Partial<NameFields> | null, fallback = 'Unknown patient'): string {
  if (!patient) return fallback;
  const name = `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim();
  return name || fallback;
}

/** Student ID, then staff ID, then the internal patient record ID. */
export function patientCode(patient?: Partial<CodeFields> | null, fallback = '—'): string {
  if (!patient) return fallback;
  return patient.studentId?.trim() || patient.staffId?.trim() || patient.id || fallback;
}

export function patientInitials(patient?: Partial<NameFields> | null): string {
  if (!patient) return 'PT';
  const first = (patient.firstName ?? '').trim();
  const last = (patient.lastName ?? '').trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  const single = (first || last).slice(0, 2);
  return single ? single.toUpperCase() : 'PT';
}

export function findPatient(patients: Patient[], patientId?: string | null): Patient | undefined {
  if (!patientId) return undefined;
  return patients.find(patient => patient.id === patientId);
}

/** Resolve a denormalised name against the live master record. */
export function patientNameFor(patients: Patient[], patientId: string, fallback = 'Unknown patient'): string {
  const patient = findPatient(patients, patientId);
  return patientFullName(patient, fallback);
}

/** Resolve a denormalised identifier against the live master record. */
export function patientCodeFor(patients: Patient[], patientId: string, fallback?: string): string {
  const patient = findPatient(patients, patientId);
  return patientCode(patient, fallback ?? patientId);
}

export function patientOptionLabel(patient: Patient): string {
  return `${patientFullName(patient)} — ${patientCode(patient)} (${patient.patientType})`;
}

export function patientMeta(patient?: Patient | null): string {
  if (!patient) return 'Unregistered patient';
  return [patient.patientType, patient.department].filter(Boolean).join(' · ');
}

export function patientTypeClass(type?: PatientType | string): string {
  if (type === 'Student') return 'badge-blue';
  if (type === 'Staff') return 'badge-green';
  if (type === 'External') return 'badge-violet';
  return 'badge-gray';
}

/** Shared search matcher so every patient search behaves the same way. */
export function patientMatchesSearch(patient: Patient, term: string): boolean {
  const query = term.trim().toLowerCase();
  if (!query) return true;
  return [
    patientFullName(patient),
    patient.id,
    patient.studentId,
    patient.staffId,
    patient.phone,
    patient.email,
    patient.department,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query);
}
