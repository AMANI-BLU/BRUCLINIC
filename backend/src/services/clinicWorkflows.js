import { randomUUID } from 'node:crypto';
import { withTransaction } from '../db/pool.js';

function workflowId(prefix) { return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`; }
function nowTime() { return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
function requireValue(value, name) { if (value === undefined || value === null || value === '') { const error = new Error(`${name} is required`); error.statusCode = 422; throw error; } }
function workflowError(message, statusCode = 422) { const error = new Error(message); error.statusCode = statusCode; return error; }
function parseJsonField(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try {
    let parsed = JSON.parse(value);
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch (_) {}
    }
    return parsed;
  } catch {
    return fallback;
  }
}
function toArrayField(value) {
  const parsed = parseJsonField(value, []);
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === 'string' && parsed.trim()) return [parsed.trim()];
  return [];
}
function normalizeQueueRow(row) {
  return row ? {
    ...row,
    vitals: parseJsonField(row.vitals, null),
    allergies: toArrayField(row.allergies),
    chronic_conditions: toArrayField(row.chronic_conditions),
    prescribed_medicines: parseJsonField(row.prescribed_medicines, []),
    has_existing_card: Boolean(row.has_existing_card),
    lab_is_abnormal: Boolean(row.lab_is_abnormal),
  } : row;
}
function normalizeOrderRow(row) { return row ? { ...row, medicines: parseJsonField(row.medicines, []) } : row; }

export async function createCardToOpdRequest(data) {
  requireValue(data?.patientId, 'patientId'); requireValue(data?.chiefComplaint, 'chiefComplaint'); requireValue(data?.stage, 'stage');
  return withTransaction(async client => {
    const patientResult = await client.query('SELECT * FROM patients WHERE id = $1', [data.patientId]);
    const patient = patientResult.rows[0]; if (!patient) throw workflowError('Patient not found', 404);
    const tokenResult = await client.query(`SELECT COALESCE(MAX(NULLIF(regexp_replace(token_number, '[^0-9]', '', 'g'), '')::int), 0) + 1 AS next_token FROM queue_items WHERE created_at::date = CURRENT_DATE`);
    const token = Number(tokenResult.rows[0]?.next_token || 1); const id = workflowId('Q');
    const requestNotes = `Card Room request dispatched to ${data.assignedDoctorName || 'OPD Doctor'} (${data.assignedOpdRoom || 'OPD 1'})`;
    const patientAllergies = toArrayField(patient.allergies);
    const patientChronic = toArrayField(patient.chronic_conditions);
    await client.query(`
      INSERT INTO queue_items (id, token_number, patient_id, patient_name, patient_type, department, registered_time, stage, priority, assigned_doctor_id, assigned_doctor_name, assigned_opd_room, vitals, chief_complaint, card_status, has_existing_card, request_source, request_destination, request_notes, allergies, chronic_conditions, blood_group)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'Card Room', $17, $18, $19, $20, $21)
    `, [id, `BU-${String(token).padStart(2, '0')}`, patient.id, `${patient.first_name} ${patient.last_name}`, patient.patient_type, patient.department, nowTime(), data.stage, data.priority || 'Normal', data.assignedDoctorId || null, data.assignedDoctorName || null, data.assignedOpdRoom || 'OPD Room 1', data.vitals ? JSON.stringify(data.vitals) : null, data.chiefComplaint, data.hasExistingCard ? 'Existing Card' : 'New Card', Boolean(data.hasExistingCard), data.stage, requestNotes, JSON.stringify(patientAllergies), JSON.stringify(patientChronic), patient.blood_group || null]);
    const created = await client.query('SELECT * FROM queue_items WHERE id = $1', [id]);
    return normalizeQueueRow(created.rows[0]);
  });
}

export async function sendOpdToLabRequest(queueItemId, data) {
  requireValue(queueItemId, 'queueItemId'); requireValue(data?.testName, 'testName'); requireValue(data?.category, 'category'); requireValue(data?.specimenType, 'specimenType');
  return withTransaction(async client => {
    const queueResult = await client.query('SELECT * FROM queue_items WHERE id = $1 FOR UPDATE', [queueItemId]);
    const queueItem = queueResult.rows[0]; if (!queueItem) throw workflowError('Queue item not found', 404);
    const labId = workflowId('LAB'); const doctorId = data.doctorId || queueItem.assigned_doctor_id || null; const doctorName = data.doctorName || queueItem.assigned_doctor_name || 'OPD clinician';
    await client.query(`INSERT INTO lab_orders (id, patient_id, patient_name, doctor_id, doctor_name, ordered_at, priority, test_name, category, specimen_type, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Requested', $11)`, [labId, queueItem.patient_id, queueItem.patient_name, doctorId, doctorName, nowTime(), data.priority || 'Medium', data.testName, data.category, data.specimenType, data.notes || `OPD clinical referral for ${queueItem.patient_name}`]);
    await client.query(`UPDATE queue_items SET stage = 'Laboratory', lab_order_id = $1, lab_test_name = $2, lab_category = $3, lab_status = 'Requested', lab_notes = $4, request_source = 'OPD Consultation', request_destination = 'Laboratory', request_notes = $5, updated_at = NOW() WHERE id = $6`, [labId, data.testName, data.category, data.notes || null, `Diagnostic lab test requested by ${doctorName}: ${data.testName}`, queueItemId]);
    const updated = await client.query('SELECT * FROM queue_items WHERE id = $1', [queueItemId]);
    return { queueItem: normalizeQueueRow(updated.rows[0]), labOrderId: labId };
  });
}

export async function sendOpdToPharmacyRequest(queueItemId, data) {
  requireValue(queueItemId, 'queueItemId'); requireValue(data?.medicines, 'medicines');
  if (!Array.isArray(data.medicines) || data.medicines.length === 0) throw workflowError('medicines must be a non-empty array');
  return withTransaction(async client => {
    const queueResult = await client.query('SELECT * FROM queue_items WHERE id = $1 FOR UPDATE', [queueItemId]);
    const queueItem = queueResult.rows[0]; if (!queueItem) throw workflowError('Queue item not found', 404);
    const orderId = workflowId('RX'); const doctorId = data.doctorId || queueItem.assigned_doctor_id || null; const doctorName = data.doctorName || queueItem.assigned_doctor_name || 'OPD clinician';
    const medicineNames = data.medicines.map(item => item.name).filter(Boolean).join(', ');
    await client.query(`INSERT INTO pharmacy_orders (id, patient_id, patient_name, doctor_id, doctor_name, prescribed_at, medicines, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending', $8)`, [orderId, queueItem.patient_id, queueItem.patient_name, doctorId, doctorName, nowTime(), JSON.stringify(data.medicines), data.notes || null]);
    await client.query(`UPDATE queue_items SET stage = 'Pharmacy', pharmacy_order_id = $1, prescribed_medicines = $2, pharmacy_status = 'Pending', doctor_diagnosis = $3, request_source = 'OPD Consultation', request_destination = 'Pharmacy', request_notes = $4, updated_at = NOW() WHERE id = $5`, [orderId, JSON.stringify(data.medicines), data.doctorDiagnosis || null, `E-prescription sent to Pharmacy (${medicineNames || 'medicines'})`, queueItemId]);
    const updated = await client.query('SELECT * FROM queue_items WHERE id = $1', [queueItemId]);
    return { queueItem: normalizeQueueRow(updated.rows[0]), pharmacyOrderId: orderId };
  });
}

export async function completeOpdConsultation(queueItemId, recordData) {
  requireValue(queueItemId, 'queueItemId'); requireValue(recordData?.patientId, 'patientId'); requireValue(recordData?.patientName, 'patientName'); requireValue(recordData?.doctorName, 'doctorName'); requireValue(recordData?.diagnosis, 'diagnosis');
  return withTransaction(async client => {
    const queueResult = await client.query('SELECT * FROM queue_items WHERE id = $1 FOR UPDATE', [queueItemId]);
    if (!queueResult.rows[0]) throw workflowError('Queue item not found', 404);
    const recordId = workflowId('R');
    await client.query(`INSERT INTO medical_records (id, patient_id, patient_name, doctor_id, doctor_name, visit_date, diagnosis, symptoms, vitals, prescription, lab_tests, notes, follow_up_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [recordId, recordData.patientId, recordData.patientName, recordData.doctorId || null, recordData.doctorName, recordData.visitDate || new Date().toISOString().slice(0, 10), recordData.diagnosis, JSON.stringify(recordData.symptoms || []), JSON.stringify(recordData.vitals || null), JSON.stringify(recordData.prescription || []), JSON.stringify(recordData.labTests || []), recordData.notes || '', recordData.followUpDate || null]);
    const completedAt = nowTime();
    await client.query(`UPDATE queue_items SET stage = 'Completed', completed_at = $1, doctor_diagnosis = $2, consultation_notes = $3, request_notes = $4, updated_at = NOW() WHERE id = $5`, [completedAt, recordData.diagnosis, recordData.notes || null, `Consultation completed by ${recordData.doctorName}. Diagnosis: ${recordData.diagnosis}`, queueItemId]);
    const updated = await client.query('SELECT * FROM queue_items WHERE id = $1', [queueItemId]);
    return { recordId, queueItem: normalizeQueueRow(updated.rows[0]) };
  });
}

export async function dispensePharmacyOrder(orderId, dispensedBy) {
  requireValue(orderId, 'orderId'); requireValue(dispensedBy, 'dispensedBy');
  return withTransaction(async client => {
    const orderResult = await client.query('SELECT * FROM pharmacy_orders WHERE id = $1 FOR UPDATE', [orderId]);
    const order = orderResult.rows[0]; if (!order) throw workflowError('Pharmacy order not found', 404); if (order.status === 'Dispensed') throw workflowError('Pharmacy order is already dispensed', 409);
    const medicinesList = parseJsonField(order.medicines, []);
    for (const medicine of medicinesList) {
      if (!medicine.medicineId) continue;
      const quantity = Number(medicine.quantity) || 0; if (quantity <= 0) continue;
      const stockResult = await client.query('UPDATE medicines SET stock = stock - $1, updated_at = NOW() WHERE id = $2 AND stock >= $1', [quantity, medicine.medicineId]);
      if (!stockResult.affectedRows) throw workflowError(`Insufficient stock for ${medicine.name || medicine.medicineId}`, 409);
    }
    const dispensedAt = nowTime();
    await client.query(`UPDATE pharmacy_orders SET status = 'Dispensed', dispensed_at = $1, dispensed_by = $2, updated_at = NOW() WHERE id = $3`, [dispensedAt, dispensedBy, orderId]);
    await client.query(`UPDATE queue_items SET stage = 'Completed', pharmacy_status = 'Dispensed', completed_at = $1, request_notes = 'Prescription fulfilled and dispensed at Pharmacy. Visit successfully completed.', updated_at = NOW() WHERE pharmacy_order_id = $2`, [dispensedAt, orderId]);
    const updatedOrder = await client.query('SELECT * FROM pharmacy_orders WHERE id = $1', [orderId]);
    return normalizeOrderRow(updatedOrder.rows[0]);
  });
}
