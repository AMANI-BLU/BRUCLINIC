const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_PATTERN = /^[+\d][\d\s().-]{6,29}$/;

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 422;
  return error;
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

export function requireFields(payload, fields) {
  const missing = fields.filter(field => isBlank(payload?.[field]));

  if (missing.length > 0) {
    throw validationError(`Please complete: ${missing.join(', ')}`);
  }
}

export function assertPlainObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw validationError('Request body must be a JSON object');
  }
}

export function validateText(value, field, { required = false, max = 255 } = {}) {
  if (isBlank(value)) {
    if (required) throw validationError(`${field} is required`);
    return;
  }
  if (typeof value !== 'string') throw validationError(`${field} must be text`);
  if (value.trim().length > max) throw validationError(`${field} must be ${max} characters or fewer`);
}

export function validateEmail(value, field = 'Email') {
  if (isBlank(value)) return;
  if (typeof value !== 'string' || value.length > 254 || !EMAIL_PATTERN.test(value.trim())) {
    throw validationError(`${field} must be a valid email address`);
  }
}

export function validatePhone(value, field = 'Phone') {
  if (isBlank(value)) return;
  if (typeof value !== 'string' || !PHONE_PATTERN.test(value.trim())) {
    throw validationError(`${field} must be a valid phone number`);
  }
}

export function validatePassword(value, field = 'Password') {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128 || !/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    throw validationError(`${field} must be 10-128 characters with uppercase, lowercase, and a number`);
  }
}

export function validateDate(value, field, { required = false, allowFuture = true } = {}) {
  if (isBlank(value)) {
    if (required) throw validationError(`${field} is required`);
    return;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw validationError(`${field} must use YYYY-MM-DD format`);
  }
  if (!allowFuture && value > new Date().toISOString().slice(0, 10)) {
    throw validationError(`${field} cannot be in the future`);
  }
}

export function validateEnum(value, field, allowed, { required = false } = {}) {
  if (isBlank(value)) {
    if (required) throw validationError(`${field} is required`);
    return;
  }
  if (!allowed.includes(value)) throw validationError(`${field} is invalid`);
}

export function validateNumber(value, field, { required = false, min = -Infinity, max = Infinity, integer = false } = {}) {
  if (isBlank(value)) {
    if (required) throw validationError(`${field} is required`);
    return;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || (integer && !Number.isInteger(number)) || number < min || number > max) {
    throw validationError(`${field} is invalid`);
  }
}

const genderValues = ['Male', 'Female'];
const patientTypeValues = ['Student', 'Staff', 'External'];
const queueStageValues = ['Reception', 'Nurse Triage', 'Doctor Consultation', 'Pharmacy', 'Laboratory', 'Emergency', 'Completed'];
const priorityValues = ['Low', 'Medium', 'High', 'Critical', 'Normal', 'Urgent', 'Emergency'];

export function validateResourcePayload(resource, payload, allowedFields, requiredFields, { partial = false } = {}) {
  assertPlainObject(payload);
  const body = cleanPayload(payload, allowedFields);
  if (!partial) requireFields(body, requiredFields);

  const stringRules = {
    firstName: 100, lastName: 100, name: 150, username: 60, roleTitle: 100, department: 150,
    patientName: 150, doctorName: 150, specialization: 120, reason: 500, notes: 2000, diagnosis: 1000,
    chiefComplaint: 1000, criticalNotes: 2000, testName: 150, category: 120,
    specimenType: 100, result: 2000, unit: 40, referenceRange: 120, supplier: 150, address: 255,
    email: 254, phone: 30, emergencyContactName: 150, emergencyContactPhone: 30,
  };
  for (const [field, max] of Object.entries(stringRules)) {
    if (field in body) validateText(body[field], field, { max });
  }

  if (resource === 'patients') {
    validateText(body.firstName, 'First name', { required: !partial, max: 100 });
    validateText(body.lastName, 'Last name', { required: !partial, max: 100 });
    validateText(body.phone, 'Phone', { required: !partial, max: 30 });
    validateDate(body.dateOfBirth, 'Date of birth', { required: !partial, allowFuture: false });
    validateEnum(body.gender, 'Gender', genderValues, { required: !partial });
    validateEnum(body.patientType, 'Patient type', patientTypeValues, { required: !partial });
    validateEmail(body.email);
    validatePhone(body.phone);
    validatePhone(body.emergencyContactPhone, 'Emergency contact phone');
  }
  if (resource === 'doctors') {
    validateText(body.firstName, 'First name', { required: !partial, max: 100 });
    validateText(body.lastName, 'Last name', { required: !partial, max: 100 });
    validateText(body.specialization, 'Specialization', { required: !partial, max: 120 });
    validateEnum(body.gender, 'Gender', genderValues, { required: !partial });
    validateEmail(body.email);
    validatePhone(body.phone);
  }
  if (resource === 'appointments') {
    validateDate(body.date, 'Appointment date', { required: !partial });
    validateText(body.time, 'Appointment time', { required: !partial, max: 10 });
    validateEnum(body.priority, 'Priority', priorityValues);
  }
  if (resource === 'records') {
    validateText(body.diagnosis, 'Diagnosis', { required: !partial, max: 1000 });
    validateDate(body.visitDate, 'Visit date', { allowFuture: false });
    validateDate(body.followUpDate, 'Follow-up date');
  }
  if (resource === 'medicines') {
    validateNumber(body.stock, 'Stock', { min: 0 });
    validateNumber(body.minStock, 'Minimum stock', { min: 0 });
    validateNumber(body.costPerUnit, 'Cost per unit', { min: 0 });
    validateDate(body.expiryDate, 'Expiry date', { required: !partial });
  }
  if (resource === 'queue') {
    validateEnum(body.patientType, 'Patient type', patientTypeValues, { required: !partial });
    validateEnum(body.stage, 'Stage', queueStageValues, { required: !partial });
    validateEnum(body.priority, 'Priority', priorityValues);
  }
  if (resource === 'emergency') {
    validateNumber(body.age, 'Age', { required: !partial, min: 0, max: 130, integer: true });
    validateEnum(body.gender, 'Gender', genderValues, { required: !partial });
  }
  if (resource === 'labOrders') {
    validateText(body.testName, 'Test name', { required: !partial, max: 150 });
    validateText(body.category, 'Category', { required: !partial, max: 120 });
    validateText(body.specimenType, 'Specimen type', { required: !partial, max: 100 });
  }

  return body;
}

export function cleanPatch(payload, allowedFields) {
  return Object.fromEntries(
    Object.entries(payload || {}).filter(([key]) => allowedFields.includes(key)),
  );
}

export function cleanPayload(payload, allowedFields) {
  return cleanPatch(payload, allowedFields);
}

export function parsePagination(searchParams) {
  const limit = Number.parseInt(searchParams.get('limit') || '100', 10);
  const offset = Number.parseInt(searchParams.get('offset') || '0', 10);
  return {
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100,
    offset: Number.isFinite(offset) ? Math.min(Math.max(offset, 0), 1000000) : 0,
    search: (searchParams.get('search') || '').slice(0, 100),
  };
}
