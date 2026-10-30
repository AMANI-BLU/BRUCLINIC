import { randomUUID } from 'node:crypto';
import { query } from '../db/pool.js';

const common = {
  patients: {
    table: 'patients', prefix: 'P', required: ['firstName', 'lastName', 'gender', 'dateOfBirth', 'phone', 'patientType'],
    fields: {
      id: 'id', studentId: 'student_id', staffId: 'staff_id', firstName: 'first_name', lastName: 'last_name',
      gender: 'gender', dateOfBirth: 'date_of_birth', phone: 'phone', email: 'email', address: 'address',
      patientType: 'patient_type', department: 'department', bloodGroup: 'blood_group', allergies: 'allergies',
      chronicConditions: 'chronic_conditions', emergencyContactName: 'emergency_contact_name',
      emergencyContactPhone: 'emergency_contact_phone', registeredAt: 'registered_at',
    },
    arrays: ['allergies', 'chronicConditions'], dates: ['dateOfBirth', 'registeredAt'],
    search: ['first_name', 'last_name', 'phone', 'student_id', 'staff_id'], order: 'registered_at DESC, created_at DESC',
  },
  doctors: {
    table: 'doctors', prefix: 'D', required: ['firstName', 'lastName', 'specialization', 'gender'],
    fields: {
      id: 'id', firstName: 'first_name', lastName: 'last_name', specialization: 'specialization', email: 'email',
      phone: 'phone', gender: 'gender', available: 'available', schedule: 'schedule', avatar: 'avatar',
    },
    arrays: ['schedule'], search: ['first_name', 'last_name', 'specialization', 'email'], order: 'last_name ASC, first_name ASC',
  },
  appointments: {
    table: 'appointments', prefix: 'A', required: ['patientId', 'patientName', 'doctorId', 'doctorName', 'date', 'time'],
    fields: {
      id: 'id', patientId: 'patient_id', patientName: 'patient_name', doctorId: 'doctor_id', doctorName: 'doctor_name',
      date: 'appointment_date', time: 'appointment_time', type: 'type', status: 'status', reason: 'reason', notes: 'notes', priority: 'priority',
    },
    dates: ['date'], search: ['patient_name', 'doctor_name', 'reason'], order: 'appointment_date DESC, appointment_time DESC',
  },
  records: {
    table: 'medical_records', prefix: 'R', required: ['patientId', 'patientName', 'doctorName', 'diagnosis'],
    fields: {
      id: 'id', patientId: 'patient_id', patientName: 'patient_name', doctorId: 'doctor_id', doctorName: 'doctor_name',
      visitDate: 'visit_date', diagnosis: 'diagnosis', symptoms: 'symptoms', vitals: 'vitals', prescription: 'prescription',
      labTests: 'lab_tests', notes: 'notes', followUpDate: 'follow_up_date',
    },
    arrays: ['symptoms'], json: ['vitals', 'prescription', 'labTests'], dates: ['visitDate', 'followUpDate'],
    search: ['patient_name', 'doctor_name', 'diagnosis', 'id'], order: 'visit_date DESC, created_at DESC',
  },
  medicines: {
    table: 'medicines', prefix: 'MED', required: ['name', 'expiryDate'],
    fields: {
      id: 'id', name: 'name', category: 'category', stock: 'stock', unit: 'unit', expiryDate: 'expiry_date',
      supplier: 'supplier', minStock: 'min_stock', costPerUnit: 'cost_per_unit',
    },
    dates: ['expiryDate'], numbers: ['stock', 'minStock', 'costPerUnit'], search: ['name', 'category', 'supplier'], order: 'name ASC',
  },
  queue: {
    table: 'queue_items', prefix: 'Q', required: ['tokenNumber', 'patientId', 'patientName', 'patientType', 'registeredTime', 'stage', 'chiefComplaint'],
    fields: {
      id: 'id', tokenNumber: 'token_number', patientId: 'patient_id', patientName: 'patient_name', patientType: 'patient_type',
      department: 'department', registeredTime: 'registered_time', stage: 'stage', priority: 'priority', assignedDoctorId: 'assigned_doctor_id',
      assignedDoctorName: 'assigned_doctor_name', assignedOpdRoom: 'assigned_opd_room', vitals: 'vitals', chiefComplaint: 'chief_complaint',
      cardStatus: 'card_status', hasExistingCard: 'has_existing_card', requestSource: 'request_source', requestDestination: 'request_destination',
      requestNotes: 'request_notes', allergies: 'allergies', chronicConditions: 'chronic_conditions', bloodGroup: 'blood_group',
      labOrderId: 'lab_order_id', labTestName: 'lab_test_name', labCategory: 'lab_category', labStatus: 'lab_status', labResult: 'lab_result',
      labUnit: 'lab_unit', labReferenceRange: 'lab_reference_range', labIsAbnormal: 'lab_is_abnormal', labCompletedAt: 'lab_completed_at', labNotes: 'lab_notes',
      pharmacyOrderId: 'pharmacy_order_id', prescribedMedicines: 'prescribed_medicines', pharmacyStatus: 'pharmacy_status', doctorDiagnosis: 'doctor_diagnosis',
      consultationNotes: 'consultation_notes', completedAt: 'completed_at',
    },
    arrays: ['allergies', 'chronicConditions'], json: ['vitals', 'prescribedMedicines'],
    search: ['token_number', 'patient_name', 'patient_id', 'chief_complaint'], order: 'created_at DESC',
  },
  emergency: {
    table: 'emergency_cases', prefix: 'ER', required: ['patientId', 'patientName', 'age', 'gender', 'arrivalMethod', 'arrivalTime', 'acuity', 'chiefComplaint', 'bedNumber', 'attendingDoctor'],
    fields: {
      id: 'id', patientId: 'patient_id', patientName: 'patient_name', age: 'age', gender: 'gender', arrivalMethod: 'arrival_method', arrivalTime: 'arrival_time',
      acuity: 'acuity', chiefComplaint: 'chief_complaint', bedNumber: 'bed_number', vitals: 'vitals', attendingDoctor: 'attending_doctor', status: 'status', criticalNotes: 'critical_notes',
    },
    json: ['vitals'], numbers: ['age'], search: ['patient_name', 'patient_id', 'chief_complaint', 'bed_number'], order: 'created_at DESC',
  },
  labOrders: {
    table: 'lab_orders', prefix: 'LAB', required: ['patientId', 'patientName', 'doctorId', 'doctorName', 'orderedAt', 'testName', 'category', 'specimenType'],
    fields: {
      id: 'id', patientId: 'patient_id', patientName: 'patient_name', doctorId: 'doctor_id', doctorName: 'doctor_name', orderedAt: 'ordered_at', priority: 'priority',
      testName: 'test_name', category: 'category', specimenType: 'specimen_type', status: 'status', result: 'result', unit: 'unit', referenceRange: 'reference_range',
      isAbnormal: 'is_abnormal', notes: 'notes', completedAt: 'completed_at',
    },
    search: ['patient_name', 'patient_id', 'doctor_name', 'test_name'], order: 'created_at DESC',
  },
  pharmacyOrders: {
    table: 'pharmacy_orders', prefix: 'RX', required: ['patientId', 'patientName', 'doctorId', 'doctorName', 'prescribedAt', 'medicines'],
    fields: {
      id: 'id', patientId: 'patient_id', patientName: 'patient_name', doctorId: 'doctor_id', doctorName: 'doctor_name', prescribedAt: 'prescribed_at',
      medicines: 'medicines', status: 'status', dispensedAt: 'dispensed_at', dispensedBy: 'dispensed_by', notes: 'notes',
    },
    json: ['medicines'], search: ['patient_name', 'patient_id', 'doctor_name', 'status'], order: 'created_at DESC',
  },
};

export const resourceDefinitions = common;

function createId(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function selectColumns(definition) {
  return Object.values(definition.fields).join(', ');
}

function dateValue(value) {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function serializeValue(definition, apiField, value) {
  if (definition.json?.includes(apiField) || definition.arrays?.includes(apiField)) {
    return value === null || value === undefined ? null : JSON.stringify(value);
  }
  return value;
}

function deserializeRow(definition, row) {
  const output = {};
  for (const [apiField, dbField] of Object.entries(definition.fields)) {
    let value = row[dbField];
    if (value === null || value === undefined) {
      if (definition.arrays?.includes(apiField)) output[apiField] = [];
      else continue;
      continue;
    }
    if (definition.dates?.includes(apiField)) value = dateValue(value);
    if (definition.numbers?.includes(apiField)) value = Number(value);
    if ((definition.json?.includes(apiField) || definition.arrays?.includes(apiField)) && typeof value === 'string') {
      try {
        value = JSON.parse(value);
        if (typeof value === 'string') {
          try { value = JSON.parse(value); } catch (_) {}
        }
      } catch {
        value = definition.arrays?.includes(apiField) ? [] : {};
      }
    }
    if (definition.arrays?.includes(apiField) && !Array.isArray(value)) {
      value = typeof value === 'string' && value ? [value] : [];
    }
    if (dbField === 'available' || dbField === 'is_active' || dbField === 'has_existing_card' || dbField === 'is_abnormal') {
      if (typeof value === 'number') value = Boolean(value);
    }
    output[apiField] = value;
  }
  return output;
}

function buildWhere(definition, search, startIndex = 1) {
  if (!search || !definition.search?.length) return { sql: '', values: [] };
  const term = `%${search.trim().toLowerCase()}%`;
  const clauses = definition.search.map((column, index) =>
    `LOWER(COALESCE(CAST(${column} AS TEXT), '')) LIKE $${startIndex + index}`,
  );
  return { sql: `WHERE (${clauses.join(' OR ')})`, values: definition.search.map(() => term) };
}

function ensureResource(resource) {
  const definition = resourceDefinitions[resource];
  if (!definition) {
    const error = new Error('Unknown resource');
    error.statusCode = 404;
    throw error;
  }
  return definition;
}

export async function listResource(resource, { search = '', limit = 100, offset = 0 } = {}) {
  const definition = ensureResource(resource);
  const boundedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const boundedOffset = Math.max(Number(offset) || 0, 0);
  const where = buildWhere(definition, search, 1);
  const limitParam = where.values.length + 1;
  const offsetParam = where.values.length + 2;
  const values = [...where.values, boundedLimit, boundedOffset];
  const result = await query(
    `SELECT ${selectColumns(definition)} FROM ${definition.table} ${where.sql} ORDER BY ${definition.order} LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values,
  );
  const count = await query(`SELECT COUNT(*) AS total FROM ${definition.table} ${where.sql}`, where.values);
  const total = Number(count.rows[0]?.total || 0);
  return { data: result.rows.map(row => deserializeRow(definition, row)), total, limit: boundedLimit, offset: boundedOffset };
}

export async function findResource(resource, id) {
  const definition = ensureResource(resource);
  const result = await query(`SELECT ${selectColumns(definition)} FROM ${definition.table} WHERE id = $1`, [id]);
  return result.rows[0] ? deserializeRow(definition, result.rows[0]) : null;
}

export async function insertResource(resource, body) {
  const definition = ensureResource(resource);
  const values = [];
  const columns = [];
  const placeholders = [];
  const item = { ...body, id: body.id || createId(definition.prefix) };

  for (const [apiField, dbField] of Object.entries(definition.fields)) {
    if (item[apiField] === undefined) continue;
    columns.push(dbField);
    values.push(serializeValue(definition, apiField, item[apiField]));
    placeholders.push(`$${values.length}`);
  }

  await query(`INSERT INTO ${definition.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`, values);
  return findResource(resource, item.id);
}

export async function updateResource(resource, id, changes) {
  const definition = ensureResource(resource);
  const values = [];
  const updates = [];

  for (const [apiField, dbField] of Object.entries(definition.fields)) {
    if (apiField === 'id' || changes[apiField] === undefined) continue;
    values.push(serializeValue(definition, apiField, changes[apiField]));
    updates.push(`${dbField} = $${values.length}`);
  }
  if (!updates.length) return findResource(resource, id);

  values.push(id);
  const result = await query(`UPDATE ${definition.table} SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`, values);
  return result.affectedRows ? findResource(resource, id) : null;
}

export async function deleteResource(resource, id) {
  const definition = ensureResource(resource);
  const result = await query(`DELETE FROM ${definition.table} WHERE id = $1`, [id]);
  return result.affectedRows ? { id } : null;
}
