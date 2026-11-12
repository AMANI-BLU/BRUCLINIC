import { randomUUID } from 'node:crypto';
import { withTransaction } from '../db/pool.js';

function workflowId(prefix) { return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`; }
function nowTime() { return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); }
function requireValue(value, name) { if (value === undefined || value === null || value === '') { const error = new Error(`${name} is required`); error.statusCode = 422; throw error; } }
function workflowError(message, statusCode = 422) { const error = new Error(message); error.statusCode = statusCode; return error; }
function requireDoctorQueueStage(queueItem) {
  if (queueItem.stage !== 'Doctor Consultation') {
    throw workflowError('This visit is no longer waiting for doctor consultation.', 409);
  }
}
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
  requireValue(data?.patientId, 'patientId'); requireValue(data?.stage, 'stage');
  const chiefComplaint = (data?.chiefComplaint && String(data.chiefComplaint).trim())
    ? String(data.chiefComplaint).trim()
    : 'Routine Outpatient Consultation';
  return withTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [String(data.patientId)]);
    const activeVisit = await client.query(
      `SELECT id, stage FROM queue_items WHERE patient_id = $1 AND stage <> 'Completed' LIMIT 1`,
      [data.patientId],
    );
    if (activeVisit.rows[0]) {
      throw workflowError(`This patient already has an active visit (${activeVisit.rows[0].id}, ${activeVisit.rows[0].stage}). Complete that visit before sending another request.`, 409);
    }
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
    `, [id, `BU-${String(token).padStart(2, '0')}`, patient.id, `${patient.first_name} ${patient.last_name}`, patient.patient_type, patient.department, nowTime(), data.stage, data.priority || 'Normal', data.assignedDoctorId || null, data.assignedDoctorName || null, data.assignedOpdRoom || 'OPD Room 1', data.vitals ? JSON.stringify(data.vitals) : null, chiefComplaint, data.hasExistingCard ? 'Existing Card' : 'New Card', Boolean(data.hasExistingCard), data.stage, requestNotes, JSON.stringify(patientAllergies), JSON.stringify(patientChronic), patient.blood_group || null]);
    const created = await client.query('SELECT * FROM queue_items WHERE id = $1', [id]);
    return normalizeQueueRow(created.rows[0]);
  });
}

export async function transferToEmergency(queueItemId, data, user) {
  requireValue(queueItemId, 'queueItemId');
  return withTransaction(async client => {
    const queueResult = await client.query('SELECT * FROM queue_items WHERE id = $1 FOR UPDATE', [queueItemId]);
    const queueItem = queueResult.rows[0];
    if (!queueItem) throw workflowError('Queue item not found', 404);
    if (queueItem.stage === 'Completed') throw workflowError('This visit is already completed.', 409);

    const patientResult = await client.query('SELECT * FROM patients WHERE id = $1 LIMIT 1', [queueItem.patient_id]);
    const patient = patientResult.rows[0];
    if (!patient) throw workflowError('Patient not found', 404);

    const existingCase = await client.query(
      `SELECT * FROM emergency_cases
       WHERE patient_id = $1 AND status NOT IN ('Discharged', 'Transferred')
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [queueItem.patient_id],
    );
    let emergencyCase = existingCase.rows[0];

    if (!emergencyCase) {
      const birthDate = new Date(patient.date_of_birth);
      const now = new Date();
      let age = now.getFullYear() - birthDate.getFullYear();
      if (now.getMonth() < birthDate.getMonth() || (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate())) age--;
      const emergencyId = workflowId('ER');
      await client.query(
        `INSERT INTO emergency_cases
          (id, patient_id, patient_name, age, gender, arrival_method, arrival_time, acuity, chief_complaint, bed_number, vitals, attending_doctor, status, critical_notes, diagnosis)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'In Treatment', $13, $14)`,
        [
          emergencyId,
          patient.id,
          queueItem.patient_name,
          Math.max(age, 0),
          patient.gender,
          data?.arrivalMethod || 'OPD Referral',
          new Date().toISOString(),
          data?.acuity || 'Red',
          data?.chiefComplaint || queueItem.chief_complaint || 'Emergency assessment requested',
          data?.bedNumber || 'Bay 02 (Resus/Trauma 2)',
          JSON.stringify(data?.vitals || parseJsonField(queueItem.vitals, {})),
          data?.attendingDoctor || queueItem.assigned_doctor_name || 'Emergency clinician',
          data?.criticalNotes || 'Transferred to Emergency for urgent assessment.',
          String(data?.diagnosis || '').trim() || null,
        ],
      );
      const created = await client.query('SELECT * FROM emergency_cases WHERE id = $1', [emergencyId]);
      emergencyCase = created.rows[0];
    } else if (String(data?.diagnosis || '').trim()) {
      const updatedExisting = await client.query(
        'UPDATE emergency_cases SET diagnosis = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [String(data.diagnosis).trim(), emergencyCase.id],
      );
      emergencyCase = updatedExisting.rows[0];
    }

    const requestNotes = data?.requestNotes || `Patient transferred to Emergency by ${user?.name || 'clinic staff'}.`;
    const queueUpdate = await client.query(
      `UPDATE queue_items
       SET stage = 'Emergency', priority = 'Emergency', request_source = $1,
           request_destination = 'Emergency', request_notes = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [data?.requestSource || 'Clinical Transfer', requestNotes, queueItemId],
    );

    // Send one direct message to the on-duty Emergency account, not a role-wide broadcast.
    try {
      const recipient = await client.query(
        "SELECT id FROM users WHERE role = 'emergency' AND is_active = TRUE ORDER BY updated_at DESC, created_at ASC LIMIT 1",
      );
      const recipientId = recipient.rows[0]?.id;
      if (recipientId && user?.id && recipientId !== user.id) {
        const body = `Emergency transfer: ${queueItem.patient_name} was sent from ${data?.requestSource || 'the clinic'} by ${user.name || 'clinic staff'}.`;
        await client.query(
          `INSERT INTO user_messages (id, sender_id, recipient_id, body)
           VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
          [`MSG-ER-${randomUUID().slice(0, 10).toUpperCase()}`, user.id, recipientId, body],
        );
      }
    } catch (_) {
      // A notification failure must not undo the patient transfer.
    }

    return { emergencyCase, queueItem: normalizeQueueRow(queueUpdate.rows[0]) };
  });
}

export async function sendOpdToLabRequest(queueItemId, data) {
  requireValue(queueItemId, 'queueItemId');
  const requests = Array.isArray(data?.tests) ? data.tests : [data];
  if (!requests.length || requests.length > 30) throw workflowError('Select between 1 and 30 laboratory investigations');
  return withTransaction(async client => {
    const queueResult = await client.query('SELECT * FROM queue_items WHERE id = $1 FOR UPDATE', [queueItemId]);
    const queueItem = queueResult.rows[0]; if (!queueItem) throw workflowError('Queue item not found', 404);
    requireDoctorQueueStage(queueItem);
    for (const test of requests) {
      requireValue(test?.testName, 'testName'); requireValue(test?.category, 'category'); requireValue(test?.specimenType, 'specimenType');
    }
    // A doctor may reopen the Lab Request tab or retry after a network hiccup.
    // Keep one active order per queue visit and investigation, while still
    // allowing a new request after a previous result has been completed.
    const requestSeen = new Set();
    const inputDuplicateNames = [];
    const uniqueRequests = requests.filter(test => {
      const key = String(test.testName).trim().toLowerCase();
      if (requestSeen.has(key)) {
        inputDuplicateNames.push(String(test.testName).trim());
        return false;
      }
      requestSeen.add(key);
      return true;
    });
    const requestedNames = uniqueRequests.map(test => String(test.testName).trim().toLowerCase());
    const existingPending = await client.query(
      `SELECT test_name FROM lab_orders
       WHERE queue_item_id = $1
         AND status <> 'Completed'
         AND LOWER(BTRIM(test_name)) = ANY($2::text[])`,
      [queueItemId, requestedNames],
    );
    const duplicateNames = new Set(existingPending.rows.map(row => String(row.test_name).trim().toLowerCase()));
    const newRequests = uniqueRequests.filter(test => !duplicateNames.has(String(test.testName).trim().toLowerCase()));
    if (newRequests.length === 0) {
      const duplicateLabels = [...new Set([...requests.map(test => String(test.testName).trim()), ...inputDuplicateNames])].join(', ');
      throw workflowError(`These laboratory investigations are already pending for this visit: ${duplicateLabels}`, 409);
    }
    const groupId = workflowId('LABREQ');
    const doctorId = data.doctorId || queueItem.assigned_doctor_id || null;
    const doctorName = data.doctorName || queueItem.assigned_doctor_name || 'OPD clinician';
    const createdOrders = [];
    for (const test of newRequests) {
      const labId = workflowId('LAB');
      const techNotes = [test.technologistInstructions || test.notes, data.notes].filter(Boolean).join('\n');
      await client.query(
        `INSERT INTO lab_orders (id, patient_id, patient_name, doctor_id, doctor_name, ordered_at, priority, test_name, category, specimen_type, status, notes, request_group_id, queue_item_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Requested', $11, $12, $13)`,
        [labId, queueItem.patient_id, queueItem.patient_name, doctorId, doctorName, nowTime(), test.priority || data.priority || 'Medium', test.testName, test.category, test.specimenType, techNotes || `OPD clinical referral for ${queueItem.patient_name}`, groupId, queueItemId],
      );
      createdOrders.push({ id: labId, testName: test.testName, category: test.category });
    }
    await saveEncounterRecord(client, queueItem, {
      doctorId, doctorName,
      diagnosis: data.doctorDiagnosis || queueItem.doctor_diagnosis || '',
      notes: data.consultationNotes || queueItem.consultation_notes || '',
    });
    const firstOrder = createdOrders[0];
    const activeOrders = await client.query(
      `SELECT id, test_name, category FROM lab_orders
       WHERE queue_item_id = $1 AND status <> 'Completed'
       ORDER BY created_at ASC`,
      [queueItemId],
    );
    const testNames = activeOrders.rows.map(order => order.test_name).join(', ');
    const activeFirstOrder = activeOrders.rows[0] || firstOrder;
    await client.query(`UPDATE queue_items SET stage = 'Laboratory', lab_order_id = $1, lab_test_name = $2, lab_category = $3, lab_status = 'Requested', lab_notes = $4, doctor_diagnosis = COALESCE(NULLIF($5, ''), doctor_diagnosis), consultation_notes = COALESCE(NULLIF($6, ''), consultation_notes), request_source = 'OPD Consultation', request_destination = 'Laboratory', request_notes = $7, updated_at = NOW() WHERE id = $8`, [activeFirstOrder.id, testNames, activeFirstOrder.category, data.notes || null, data.doctorDiagnosis || '', data.consultationNotes || '', `Diagnostic lab request by ${doctorName}: ${testNames}`, queueItemId]);
    const updated = await client.query('SELECT * FROM queue_items WHERE id = $1', [queueItemId]);
    return {
      queueItem: normalizeQueueRow(updated.rows[0]),
      labOrderId: activeFirstOrder.id,
      labOrderIds: createdOrders.map(order => order.id),
      requestGroupId: groupId,
      duplicateTestNames: [...new Set([
        ...uniqueRequests.filter(test => duplicateNames.has(String(test.testName).trim().toLowerCase())).map(test => String(test.testName).trim()),
        ...inputDuplicateNames,
      ])],
    };
  });
}

async function saveEncounterRecord(client, queueItem, recordData = {}) {
  let validDoctorId = recordData.doctorId || queueItem.assigned_doctor_id || null;
  if (validDoctorId) {
    const docCheck = await client.query('SELECT id FROM doctors WHERE id = $1', [validDoctorId]);
    if (!docCheck.rows[0]) validDoctorId = null;
  }
  const diagnosis = recordData.diagnosis || queueItem.doctor_diagnosis || '';
  const hasPrescription = Array.isArray(recordData.prescription);
  const hasLabTests = Array.isArray(recordData.labTests);
  const hasSymptoms = Array.isArray(recordData.symptoms);
  const hasVitals = recordData.vitals !== undefined && recordData.vitals !== null;
  const hasNotes = typeof recordData.notes === 'string' && recordData.notes.trim() !== '';
  const hasFollowUp = recordData.followUpDate !== undefined && recordData.followUpDate !== null;
  const result = await client.query(
    `INSERT INTO medical_records (id, queue_item_id, patient_id, patient_name, doctor_id, doctor_name, visit_date, diagnosis, symptoms, vitals, prescription, lab_tests, notes, follow_up_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (queue_item_id) WHERE queue_item_id IS NOT NULL DO UPDATE SET
       patient_name = EXCLUDED.patient_name, doctor_id = EXCLUDED.doctor_id, doctor_name = EXCLUDED.doctor_name,
       diagnosis = CASE
         WHEN NULLIF(EXCLUDED.diagnosis, '') IS NOT NULL THEN EXCLUDED.diagnosis
         WHEN medical_records.diagnosis = 'Assessment in progress' THEN ''
         ELSE medical_records.diagnosis
       END,
       symptoms = CASE WHEN $17 THEN EXCLUDED.symptoms ELSE medical_records.symptoms END,
       vitals = CASE WHEN $18 THEN EXCLUDED.vitals ELSE medical_records.vitals END,
       prescription = CASE WHEN $15 THEN EXCLUDED.prescription ELSE medical_records.prescription END,
       lab_tests = CASE WHEN $16 THEN EXCLUDED.lab_tests ELSE medical_records.lab_tests END,
       notes = CASE WHEN $19 THEN EXCLUDED.notes ELSE medical_records.notes END,
       follow_up_date = CASE WHEN $20 THEN EXCLUDED.follow_up_date ELSE medical_records.follow_up_date END,
       updated_at = NOW()
     RETURNING id`,
    [
      workflowId('R'), queueItem.id, queueItem.patient_id, queueItem.patient_name, validDoctorId,
      recordData.doctorName || queueItem.assigned_doctor_name || 'OPD clinician',
      recordData.visitDate || new Date().toISOString().slice(0, 10), diagnosis,
      JSON.stringify(recordData.symptoms || (queueItem.chief_complaint ? [queueItem.chief_complaint] : [])),
      JSON.stringify(recordData.vitals || parseJsonField(queueItem.vitals, null)),
      JSON.stringify(recordData.prescription || parseJsonField(queueItem.prescribed_medicines, [])),
      JSON.stringify(recordData.labTests || []), recordData.notes ?? queueItem.consultation_notes ?? '', recordData.followUpDate || null,
      hasPrescription, hasLabTests, hasSymptoms, hasVitals, hasNotes, hasFollowUp,
    ],
  );
  return result.rows[0].id;
}

export async function saveOpdAssessment(queueItemId, recordData) {
  requireValue(queueItemId, 'queueItemId');
  return withTransaction(async client => {
    const result = await client.query('SELECT * FROM queue_items WHERE id = $1 FOR UPDATE', [queueItemId]);
    const queueItem = result.rows[0];
    if (!queueItem) throw workflowError('Queue item not found', 404);
    requireDoctorQueueStage(queueItem);
    const diagnosis = String(recordData?.diagnosis || '').trim();
    const notes = String(recordData?.notes || '').trim();
    await client.query(
      `UPDATE queue_items SET doctor_diagnosis = COALESCE(NULLIF($1, ''), doctor_diagnosis),
       consultation_notes = COALESCE(NULLIF($2, ''), consultation_notes), updated_at = NOW() WHERE id = $3`,
      [diagnosis, notes, queueItemId],
    );
    const savedRecordId = await saveEncounterRecord(client, queueItem, {
      ...recordData, diagnosis: diagnosis || queueItem.doctor_diagnosis, notes,
    });
    return { recordId: savedRecordId };
  });
}

export async function referOutside(queueItemId, data) {
  requireValue(queueItemId, 'queueItemId');
  requireValue(data?.destination, 'Referral destination');
  requireValue(data?.reason, 'Referral reason');
  return withTransaction(async client => {
    const result = await client.query('SELECT * FROM queue_items WHERE id = $1 FOR UPDATE', [queueItemId]);
    const queueItem = result.rows[0];
    if (!queueItem) throw workflowError('Queue item not found', 404);
    requireDoctorQueueStage(queueItem);
    const referral = {
      destination: String(data.destination).trim(),
      reason: String(data.reason).trim(),
      referredAt: new Date().toISOString(),
      referredBy: String(data.doctorName || queueItem.assigned_doctor_name || 'OPD clinician'),
      ...(data.referralDetails && typeof data.referralDetails === 'object' ? data.referralDetails : {}),
    };
    const recordId = await saveEncounterRecord(client, queueItem, data.recordData || {});
    await client.query(
      `UPDATE queue_items SET stage = 'Completed', completed_at = $1, external_referral = $2,
       request_source = 'OPD Consultation', request_destination = 'External Referral',
       request_notes = $3, updated_at = NOW() WHERE id = $4`,
      [nowTime(), JSON.stringify(referral), `Referred externally to ${referral.destination}: ${referral.reason}`, queueItemId],
    );
    return { recordId, referral };
  });
}

export async function sendOpdToPharmacyRequest(queueItemId, data) {
  requireValue(queueItemId, 'queueItemId'); requireValue(data?.medicines, 'medicines');
  if (!Array.isArray(data.medicines) || data.medicines.length === 0) throw workflowError('medicines must be a non-empty array');
  return withTransaction(async client => {
    const queueResult = await client.query('SELECT * FROM queue_items WHERE id = $1 FOR UPDATE', [queueItemId]);
    const queueItem = queueResult.rows[0]; if (!queueItem) throw workflowError('Queue item not found', 404);
    requireDoctorQueueStage(queueItem);
    const orderId = workflowId('RX'); const doctorId = data.doctorId || queueItem.assigned_doctor_id || null; const doctorName = data.doctorName || queueItem.assigned_doctor_name || 'OPD clinician';

    // Canonicalize prescribed medicines with pharmacy catalogue inventory to prevent misspellings & stock mismatches
    const canonicalMedicines = [];
    for (const rawItem of data.medicines) {
      const explicitlyExternal = rawItem.isExternal === true;
      let medId = explicitlyExternal ? undefined : rawItem.medicineId;
      let medName = (rawItem.name || '').trim();
      let matchedInCatalog = false;

      if (!explicitlyExternal && medId) {
        const verifyRes = await client.query('SELECT id, name, unit, stock FROM medicines WHERE id = $1', [medId]);
        if (verifyRes.rows[0]) {
          medName = verifyRes.rows[0].name;
          matchedInCatalog = true;
        }
      }

      if (!explicitlyExternal && !matchedInCatalog && medName) {
        // Try exact case-insensitive match first
        const exactRes = await client.query('SELECT id, name, unit, stock FROM medicines WHERE LOWER(TRIM(name)) = LOWER($1) LIMIT 1', [medName]);
        if (exactRes.rows[0]) {
          medId = exactRes.rows[0].id;
          medName = exactRes.rows[0].name;
          matchedInCatalog = true;
        } else {
          // Fallback to fuzzy substring match
          const fuzzyRes = await client.query('SELECT id, name, unit, stock FROM medicines WHERE LOWER(name) LIKE LOWER($1) ORDER BY stock DESC LIMIT 1', [`%${medName}%`]);
          if (fuzzyRes.rows[0]) {
            medId = fuzzyRes.rows[0].id;
            medName = fuzzyRes.rows[0].name;
            matchedInCatalog = true;
          }
        }
      }

      canonicalMedicines.push({
        ...rawItem,
        medicineId: medId || undefined,
        name: medName || rawItem.name,
        isExternal: explicitlyExternal || !matchedInCatalog,
      });
    }

    const medicineNames = canonicalMedicines.map(item => item.name).filter(Boolean).join(', ');
    await client.query(`INSERT INTO pharmacy_orders (id, patient_id, patient_name, doctor_id, doctor_name, prescribed_at, medicines, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending', $8)`, [orderId, queueItem.patient_id, queueItem.patient_name, doctorId, doctorName, new Date().toISOString(), JSON.stringify(canonicalMedicines), data.notes || null]);
    await client.query(`UPDATE queue_items SET pharmacy_order_id = $1, prescribed_medicines = $2, pharmacy_status = 'Pending', doctor_diagnosis = COALESCE(NULLIF($3, ''), doctor_diagnosis), consultation_notes = COALESCE(NULLIF($4, ''), consultation_notes), request_source = 'OPD Consultation', request_destination = 'Pharmacy', request_notes = $5, updated_at = NOW() WHERE id = $6`, [orderId, JSON.stringify(canonicalMedicines), data.doctorDiagnosis || '', data.notes || '', `E-prescription sent to Pharmacy (${medicineNames || 'medicines'})`, queueItemId]);

    const prescriptionList = canonicalMedicines.map(m => ({
      medication: m.name,
      dosage: m.dosage || m.frequency || '',
      frequency: m.frequency || '',
      duration: m.duration || '',
      instructions: m.instructions || '',
      isExternal: Boolean(m.isExternal),
    }));

    const diagnosisText = data.doctorDiagnosis || queueItem.doctor_diagnosis || queueItem.chief_complaint || 'OPD Clinical Consultation';
    await client.query(
      'UPDATE pharmacy_orders SET queue_item_id = $1 WHERE id = $2',
      [queueItemId, orderId],
    );
    await saveEncounterRecord(client, queueItem, {
      doctorId, doctorName, diagnosis: diagnosisText,
      prescription: prescriptionList, notes: data.notes || queueItem.consultation_notes || 'Prescription dispatched to Pharmacy.',
    });

    const updated = await client.query('SELECT * FROM queue_items WHERE id = $1', [queueItemId]);
    return { queueItem: normalizeQueueRow(updated.rows[0]), pharmacyOrderId: orderId };
  });
}

export async function completeOpdConsultation(queueItemId, recordData) {
  requireValue(queueItemId, 'queueItemId'); requireValue(recordData?.patientId, 'patientId'); requireValue(recordData?.patientName, 'patientName'); requireValue(recordData?.doctorName, 'doctorName'); requireValue(recordData?.diagnosis, 'diagnosis');
  return withTransaction(async client => {
    const queueResult = await client.query('SELECT * FROM queue_items WHERE id = $1 FOR UPDATE', [queueItemId]);
    const queueItem = queueResult.rows[0];
    if (!queueItem) throw workflowError('Queue item not found', 404);
    requireDoctorQueueStage(queueItem);
    if (recordData.patientId !== queueItem.patient_id) throw workflowError('The patient does not match this visit.', 409);
    const recordId = await saveEncounterRecord(client, queueItem, recordData);
    const completedAt = nowTime();
    await client.query(`UPDATE queue_items SET stage = 'Completed', completed_at = $1, doctor_diagnosis = $2, consultation_notes = $3, request_notes = $4, updated_at = NOW() WHERE id = $5`, [completedAt, recordData.diagnosis, recordData.notes || null, `Consultation completed by ${recordData.doctorName}. Diagnosis: ${recordData.diagnosis}`, queueItemId]);
    const updated = await client.query('SELECT * FROM queue_items WHERE id = $1', [queueItemId]);
    return { recordId, queueItem: normalizeQueueRow(updated.rows[0]) };
  });
}

async function ensureEmergencyAssessmentColumns(client) {
  await client.query(`
    ALTER TABLE emergency_cases
      ADD COLUMN IF NOT EXISTS diagnosis TEXT,
      ADD COLUMN IF NOT EXISTS external_referral JSONB
  `);
  await client.query(`
    ALTER TABLE medical_records
      ADD COLUMN IF NOT EXISTS emergency_case_id VARCHAR(64)
        REFERENCES emergency_cases(id) ON UPDATE CASCADE ON DELETE SET NULL
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_records_emergency_case
      ON medical_records (emergency_case_id)
      WHERE emergency_case_id IS NOT NULL
  `);
}

async function saveEmergencyRecord(client, emergencyCase, recordData = {}, mode = 'completed') {
  const existingRecord = await client.query(
    'SELECT id FROM medical_records WHERE emergency_case_id = $1 LIMIT 1',
    [emergencyCase.id],
  );
  const explicitDiagnosis = String(recordData.diagnosis || '').trim();
  const diagnosis = explicitDiagnosis || (mode === 'referred' ? 'Referred' : String(emergencyCase.diagnosis || '').trim() || 'N/A');
  const notes = [
    mode === 'referred' ? 'Emergency case referred to an outside facility.' : 'Emergency case completed.',
    emergencyCase.chief_complaint ? `Chief complaint: ${emergencyCase.chief_complaint}.` : '',
    emergencyCase.critical_notes ? `Critical notes: ${emergencyCase.critical_notes}.` : '',
    emergencyCase.arrival_method ? `Arrival method: ${emergencyCase.arrival_method}.` : '',
    recordData.notes ? `Clinical notes: ${String(recordData.notes).trim()}.` : '',
  ].filter(Boolean).join(' ');

  if (existingRecord.rows[0]?.id) {
    const recordId = existingRecord.rows[0].id;
    await client.query(
      `UPDATE medical_records
       SET diagnosis = CASE WHEN $2 THEN $3 ELSE diagnosis END,
           notes = CASE WHEN $4 THEN $5 ELSE notes END,
           updated_at = NOW()
       WHERE id = $1`,
      [recordId, Boolean(explicitDiagnosis || mode === 'referred'), diagnosis, Boolean(recordData.notes || mode === 'referred'), notes],
    );
    return recordId;
  }

  const recordId = workflowId('R');
  await client.query(
    `INSERT INTO medical_records
      (id, emergency_case_id, patient_id, patient_name, doctor_id, doctor_name, visit_date, diagnosis, symptoms, vitals, prescription, lab_tests, notes)
     VALUES ($1, $2, $3, $4, NULL, $5, CURRENT_DATE, $6, $7, $8, '[]'::jsonb, '[]'::jsonb, $9)`,
    [
      recordId,
      emergencyCase.id,
      emergencyCase.patient_id,
      emergencyCase.patient_name,
      emergencyCase.attending_doctor || 'Emergency clinician',
      diagnosis,
      JSON.stringify(emergencyCase.chief_complaint ? [emergencyCase.chief_complaint] : []),
      JSON.stringify(emergencyCase.vitals || {}),
      notes,
    ],
  );
  return recordId;
}

export async function completeEmergencyCase(emergencyCaseId, recordData = {}) {
  requireValue(emergencyCaseId, 'emergencyCaseId');
  return withTransaction(async client => {
    await ensureEmergencyAssessmentColumns(client);
    const caseResult = await client.query('SELECT * FROM emergency_cases WHERE id = $1 FOR UPDATE', [emergencyCaseId]);
    const emergencyCase = caseResult.rows[0];
    if (!emergencyCase) throw workflowError('Emergency case not found', 404);

    const recordId = await saveEmergencyRecord(client, emergencyCase, recordData, 'completed');

    await client.query(
      `UPDATE emergency_cases
       SET status = 'Discharged', diagnosis = CASE WHEN NULLIF($2, '') IS NOT NULL THEN $2 ELSE diagnosis END, updated_at = NOW()
       WHERE id = $1`,
      [emergencyCaseId, String(recordData.diagnosis || '').trim()],
    );
    await client.query(
      `UPDATE queue_items
       SET stage = 'Completed', completed_at = $1,
           request_notes = 'Emergency case completed and encounter filed in Medical Records.',
           updated_at = NOW()
       WHERE patient_id = $2
         AND stage IN ('Reception', 'Nurse Triage', 'Doctor Consultation', 'Emergency')`,
      [nowTime(), emergencyCase.patient_id],
    );
    const updated = await client.query('SELECT * FROM emergency_cases WHERE id = $1', [emergencyCaseId]);
    return { recordId, emergencyCase: updated.rows[0] };
  });
}

export async function referEmergencyCase(emergencyCaseId, referralData = {}, user) {
  requireValue(emergencyCaseId, 'emergencyCaseId');
  requireValue(referralData.destination, 'Referral destination');
  requireValue(referralData.reason, 'Referral reason');
  return withTransaction(async client => {
    await ensureEmergencyAssessmentColumns(client);
    const caseResult = await client.query('SELECT * FROM emergency_cases WHERE id = $1 FOR UPDATE', [emergencyCaseId]);
    const emergencyCase = caseResult.rows[0];
    if (!emergencyCase) throw workflowError('Emergency case not found', 404);

    const referral = {
      destination: String(referralData.destination).trim(),
      reason: String(referralData.reason).trim(),
      referredAt: new Date().toISOString(),
      referredBy: String(user?.name || emergencyCase.attending_doctor || 'Emergency clinician'),
    };
    const recordId = await saveEmergencyRecord(client, emergencyCase, {
      diagnosis: String(referralData.diagnosis || '').trim() || 'Referred',
      notes: `Referral destination: ${referral.destination}. Reason: ${referral.reason}`,
    }, 'referred');

    await client.query(
      `UPDATE emergency_cases
       SET status = 'Transferred', diagnosis = 'Referred', external_referral = $2, updated_at = NOW()
       WHERE id = $1`,
      [emergencyCaseId, JSON.stringify(referral)],
    );
    await client.query(
      `UPDATE queue_items
       SET stage = 'Completed', completed_at = $1,
           request_notes = $2, updated_at = NOW()
       WHERE patient_id = $3
         AND stage IN ('Reception', 'Nurse Triage', 'Doctor Consultation', 'Emergency')`,
      [nowTime(), `Emergency referral recorded to ${referral.destination}.`, emergencyCase.patient_id],
    );
    const updated = await client.query('SELECT * FROM emergency_cases WHERE id = $1', [emergencyCaseId]);
    return { recordId, referral, emergencyCase: updated.rows[0] };
  });
}

export async function dispensePharmacyOrder(orderId, dispensedBy, overrides = {}, externalItems = [], quantities = {}) {
  requireValue(orderId, 'orderId'); requireValue(dispensedBy, 'dispensedBy');
  return withTransaction(async client => {
    const orderResult = await client.query('SELECT * FROM pharmacy_orders WHERE id = $1 FOR UPDATE', [orderId]);
    const order = orderResult.rows[0]; if (!order) throw workflowError('Pharmacy order not found', 404); if (order.status === 'Dispensed') throw workflowError('Pharmacy order is already dispensed', 409);
    const medicinesList = parseJsonField(order.medicines, []);
    let inventoryDeductions = 0;
    let externalDispenses = 0;

    const isOutsideItem = (med) => {
      if (Array.isArray(externalItems) && externalItems.includes(med.name)) return true;
      if (overrides && overrides[med.name] === '__BUY_OUTSIDE__') return true;
      return false;
    };

    for (const medicine of medicinesList) {
      if (isOutsideItem(medicine)) {
        externalDispenses++;
        continue;
      }

      let targetMedId = medicine.medicineId;

      // Allow pharmacist override mapping if provided
      if (overrides && (overrides[medicine.name] || (medicine.medicineId && overrides[medicine.medicineId]))) {
        targetMedId = overrides[medicine.name] || overrides[medicine.medicineId];
      }

      // If still missing, attempt intelligent lookup in catalogue
      if (!targetMedId && medicine.name) {
        const lookup = await client.query(
          'SELECT id, name, stock, unit FROM medicines WHERE LOWER(TRIM(name)) = LOWER($1) OR LOWER(name) LIKE LOWER($2) ORDER BY stock DESC LIMIT 1',
          [medicine.name.trim(), `%${medicine.name.trim()}%`]
        );
        if (lookup.rows[0]) {
          targetMedId = lookup.rows[0].id;
        }
      }

      // The pharmacist defines the dispensed quantity in the pharmacy board;
      // fall back to the prescribed quantity when no override is supplied.
      const requestedQuantity = quantities && typeof quantities === 'object' ? Number(quantities[medicine.name]) : NaN;
      const quantity = Number.isFinite(requestedQuantity) && requestedQuantity > 0
        ? Math.floor(requestedQuantity)
        : Number(medicine.quantity) || 0;
      if (quantity <= 0) continue;

      if (targetMedId) {
        const stockCheck = await client.query('SELECT id, name, stock, unit FROM medicines WHERE id = $1 FOR UPDATE', [targetMedId]);
        const currentItem = stockCheck.rows[0];
        if (!currentItem) {
          throw workflowError(`Prescribed medicine "${medicine.name}" (ID ${targetMedId}) not found in inventory`, 404);
        }
        if (currentItem.stock < quantity) {
          throw workflowError(`Insufficient stock for "${currentItem.name}". Required: ${quantity} ${currentItem.unit}, Available in inventory: ${currentItem.stock} ${currentItem.unit}`, 409);
        }

        const stockResult = await client.query('UPDATE medicines SET stock = stock - $1, updated_at = NOW() WHERE id = $2 AND stock >= $1', [quantity, targetMedId]);
        if (!stockResult.affectedRows) {
          throw workflowError(`Stock for "${currentItem.name}" was modified by another operation. Please retry.`, 409);
        }
        inventoryDeductions++;
      } else {
        // Non-inventory / external prescription item fulfilled
        externalDispenses++;
      }
    }

    if (inventoryDeductions === 0 && externalDispenses === 0 && medicinesList.length > 0) {
      throw workflowError('No valid prescription lines to dispense', 422);
    }

    const dispensedAt = nowTime();
    await client.query(`UPDATE pharmacy_orders SET status = 'Dispensed', dispensed_at = $1, dispensed_by = $2, updated_at = NOW() WHERE id = $3`, [dispensedAt, dispensedBy, orderId]);
    const completionNote = externalDispenses > 0
      ? `Prescription fulfilled at Pharmacy (${inventoryDeductions} item(s) from inventory, ${externalDispenses} outside item(s) advised).`
      : 'Prescription fulfilled and stock deducted at Pharmacy. Visit successfully completed.';
    await client.query(
      `UPDATE queue_items SET pharmacy_status = 'Dispensed', request_notes = $1, updated_at = NOW()
       WHERE pharmacy_order_id = $2 OR id = (SELECT queue_item_id FROM pharmacy_orders WHERE id = $2)`,
      [completionNote, orderId],
    );

    // Update prescription status in medical_records
    const updatedPrescription = medicinesList.map(med => ({
      medication: med.name,
      dosage: med.dosage || med.frequency || '',
      frequency: med.frequency || '',
      duration: med.duration || '',
      instructions: med.instructions || '',
      isExternal: isOutsideItem(med) || !med.medicineId,
      dispensedStatus: isOutsideItem(med) ? 'Advised Buy Outside' : 'Dispensed in Clinic Pharmacy',
    }));

    await client.query(
      `UPDATE medical_records 
       SET prescription = $1, notes = notes || $2, updated_at = NOW()
       WHERE patient_id = $3 AND visit_date >= CURRENT_DATE - INTERVAL '1 day'`,
      [
        JSON.stringify(updatedPrescription),
        ` [Pharmacy Dispensed by ${dispensedBy}]`,
        order.patient_id,
      ]
    );

    const updatedOrder = await client.query('SELECT * FROM pharmacy_orders WHERE id = $1', [orderId]);
    return normalizeOrderRow(updatedOrder.rows[0]);
  });
}
