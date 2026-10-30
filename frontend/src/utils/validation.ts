export type FormErrors = Record<string, string>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^[+\d][\d\s().-]{6,29}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const BP_PATTERN = /^\d{2,3}\/\d{2,3}$/;

export function sanitizeInput(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

export function validateRequired(values: Record<string, unknown>, labels: Record<string, string>): FormErrors {
  return Object.fromEntries(
    Object.entries(labels)
      .filter(([field]) => {
        const value = values[field];
        return value === undefined || value === null || String(value).trim() === '';
      })
      .map(([field, label]) => [field, `${label} is required.`]),
  );
}

export function validateTextLength(
  value: string,
  label: string,
  { min = 0, max = 255, required = false }: { min?: number; max?: number; required?: boolean } = {},
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return required ? `${label} is required.` : undefined;
  }
  if (trimmed.length < min) {
    return `${label} must be at least ${min} characters.`;
  }
  if (trimmed.length > max) {
    return `${label} must not exceed ${max} characters.`;
  }
  return undefined;
}

export function validateEmail(value: string, label = 'Email'): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 254 || !EMAIL_PATTERN.test(trimmed)) {
    return `${label} must be a valid email address (e.g. staff@boru.edu.et).`;
  }
  return undefined;
}

export function validatePhone(value: string, label = 'Phone'): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!PHONE_PATTERN.test(trimmed) || trimmed.replace(/\D/g, '').length < 8) {
    return `${label} must be a valid phone number with at least 8 digits (e.g. +251911223344).`;
  }
  return undefined;
}

export function validateDate(
  value: string,
  label: string,
  { allowFuture = true, allowPast = true, required = true }: { allowFuture?: boolean; allowPast?: boolean; required?: boolean } = {},
): string | undefined {
  if (!value) {
    return required ? `${label} is required.` : undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${label} must be a valid date in YYYY-MM-DD format.`;
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return `${label} is not a valid date.`;
  }
  const today = new Date().toISOString().slice(0, 10);
  if (!allowFuture && value > today) {
    return `${label} cannot be in the future.`;
  }
  if (!allowPast && value < today) {
    return `${label} cannot be in the past.`;
  }
  return undefined;
}

export function validateTime(value: string, label = 'Time'): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  if (!TIME_PATTERN.test(trimmed)) {
    return `${label} must be a valid time format (HH:MM).`;
  }
  return undefined;
}

export function validatePassword(value: string, label = 'Password'): string | undefined {
  if (!value) return `${label} is required.`;
  if (value.length < 8 || value.length > 128) {
    return `${label} must be between 8 and 128 characters.`;
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return `${label} must contain uppercase, lowercase letters, and at least one number.`;
  }
  return undefined;
}

export function validateNumber(
  value: unknown,
  label: string,
  { min = -Infinity, max = Infinity, integer = false, required = false }: { min?: number; max?: number; integer?: boolean; required?: boolean } = {},
): string | undefined {
  if (value === undefined || value === null || String(value).trim() === '') {
    return required ? `${label} is required.` : undefined;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return `${label} must be a valid number.`;
  }
  if (integer && !Number.isInteger(num)) {
    return `${label} must be a whole number.`;
  }
  if (num < min) {
    return `${label} must be at least ${min}.`;
  }
  if (num > max) {
    return `${label} must not exceed ${max}.`;
  }
  return undefined;
}

export function validateBloodPressure(value: string, label = 'Blood pressure'): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!BP_PATTERN.test(trimmed)) {
    return `${label} must be in systolic/diastolic format (e.g. 120/80).`;
  }
  const [systolic, diastolic] = trimmed.split('/').map(Number);
  if (systolic < 50 || systolic > 260 || diastolic < 30 || diastolic > 180) {
    return `${label} values are outside normal clinical ranges.`;
  }
  return undefined;
}

export function validateVitals(vitals: {
  bloodPressure?: string;
  heartRate?: number | string;
  temperature?: number | string;
  spo2?: number | string;
  respiratoryRate?: number | string;
}): string | undefined {
  if (vitals.bloodPressure) {
    const bpErr = validateBloodPressure(vitals.bloodPressure);
    if (bpErr) return bpErr;
  }
  if (vitals.heartRate !== undefined && String(vitals.heartRate).trim() !== '') {
    const hrErr = validateNumber(vitals.heartRate, 'Heart rate', { min: 30, max: 250, integer: true });
    if (hrErr) return hrErr;
  }
  if (vitals.temperature !== undefined && String(vitals.temperature).trim() !== '') {
    const tempErr = validateNumber(vitals.temperature, 'Temperature', { min: 32, max: 45 });
    if (tempErr) return tempErr;
  }
  if (vitals.spo2 !== undefined && String(vitals.spo2).trim() !== '') {
    const spo2Err = validateNumber(vitals.spo2, 'Oxygen saturation (SpO2)', { min: 50, max: 100, integer: true });
    if (spo2Err) return spo2Err;
  }
  if (vitals.respiratoryRate !== undefined && String(vitals.respiratoryRate).trim() !== '') {
    const rrErr = validateNumber(vitals.respiratoryRate, 'Respiratory rate', { min: 6, max: 70, integer: true });
    if (rrErr) return rrErr;
  }
  return undefined;
}

export function validateBloodGroup(value: string, label = 'Blood group'): string | undefined {
  if (!value) return undefined;
  const allowed = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  if (!allowed.includes(value.trim())) {
    return `${label} must be one of: ${allowed.join(', ')}.`;
  }
  return undefined;
}

export function firstError(...errors: Array<string | undefined | null>): string | undefined {
  for (const err of errors) {
    if (err && typeof err === 'string' && err.trim()) {
      return err.trim();
    }
  }
  return undefined;
}
