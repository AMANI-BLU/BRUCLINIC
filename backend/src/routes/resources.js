/**
 * BruClinic — Resource CRUD Handler
 *
 * Generic handler for all data resource endpoints (/api/:resource/*).
 * Features:
 *   - RBAC enforcement via centralized RESOURCE_ACCESS constants
 *   - Audit log writes on every mutation (POST, PATCH, DELETE)
 *   - Structured error codes for database constraint violations
 *   - Doctor record auto-sync when listing doctors
 */

import { randomUUID } from 'node:crypto';
import {
  deleteResource, findResource, insertResource, listResource, resourceDefinitions, updateResource,
} from '../data/resourceRepository.js';
import { sendError, sendJson, sendNoContent } from '../utils/http.js';
import { parsePagination, validateResourcePayload } from '../utils/validation.js';
import { query } from '../db/pool.js';
import { RESOURCE_ACCESS } from '../constants/roles.js';
import { auditResourceMutation } from '../middleware/auditLogger.js';

function requireResourceAccess(resource, method, request, response) {
  const allowedRoles = RESOURCE_ACCESS[resource]?.[method] || [];
  if (!allowedRoles.includes(request.user?.role)) {
    sendError(response, 403, 'This staff role cannot access the requested resource');
    return false;
  }
  return true;
}

let emergencyBaysReady;
let emergencyAssessmentReady;

/**
 * Keep older deployments usable when the ER-bays migration was not applied.
 * The normal deployment path still runs the migration; this lightweight
 * bootstrap only creates the optional table when the first bay request arrives.
 */
async function ensureEmergencyBaysTable() {
  if (!emergencyBaysReady) {
    emergencyBaysReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS emergency_bays (
          id           VARCHAR(64) PRIMARY KEY,
          name         VARCHAR(120) NOT NULL UNIQUE,
          type         VARCHAR(80) NOT NULL DEFAULT 'Observation',
          oxygen_port  BOOLEAN NOT NULL DEFAULT FALSE,
          active       BOOLEAN NOT NULL DEFAULT TRUE,
          created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await query(`
        INSERT INTO emergency_bays (id, name, type, oxygen_port) VALUES
          ('BAY-01', 'Bay 01 (Resus/Trauma 1)', 'Critical', TRUE),
          ('BAY-02', 'Bay 02 (Resus/Trauma 2)', 'Critical', TRUE),
          ('BAY-03', 'Bay 03 (Acute Surgery)', 'Acute', TRUE),
          ('BAY-04', 'Bay 04 (Acute Medical)', 'Acute', TRUE),
          ('BAY-05', 'Bay 05 (Observation)', 'Observation', FALSE),
          ('BAY-06', 'Bay 06 (Observation)', 'Observation', FALSE),
          ('BAY-07', 'Bay 07 (Isolation / Fever)', 'Isolation', TRUE),
          ('BAY-08', 'Bay 08 (Step-down)', 'Step-down', FALSE)
        ON CONFLICT (id) DO NOTHING
      `);
    })().catch(error => {
      emergencyBaysReady = undefined;
      throw error;
    });
  }
  return emergencyBaysReady;
}

async function ensureEmergencyAssessmentColumns() {
  if (!emergencyAssessmentReady) {
    emergencyAssessmentReady = query(`
      ALTER TABLE emergency_cases
        ADD COLUMN IF NOT EXISTS diagnosis TEXT,
        ADD COLUMN IF NOT EXISTS external_referral JSONB
    `).catch(error => {
      emergencyAssessmentReady = undefined;
      throw error;
    });
  }
  return emergencyAssessmentReady;
}

/**
 * A student or staff member should only ever have one patient card.
 * Checked before insert/update so the API returns a helpful message
 * instead of a raw unique-constraint failure.
 */
async function assertNoDuplicatePatient(body, excludeId = null) {
  const identifiers = [
    ['studentId', 'student_id', 'Student ID'],
    ['staffId', 'staff_id', 'Staff ID'],
  ];
  for (const [field, column, label] of identifiers) {
    const value = body[field];
    if (value === undefined || value === null || String(value).trim() === '') continue;
    const result = await query(
      `SELECT id FROM patients WHERE LOWER(BTRIM(${column})) = LOWER(BTRIM($1))
       AND ($2::text IS NULL OR id <> $2) LIMIT 1`,
      [String(value).trim(), excludeId],
    );
    if (result.rows.length) {
      const error = new Error(`${label} ${String(value).trim()} is already registered to patient ${result.rows[0].id}`);
      error.statusCode = 409;
      throw error;
    }
  }

  const hasIdentity = [body.firstName, body.lastName, body.dateOfBirth, body.phone]
    .every(value => value !== undefined && value !== null && String(value).trim() !== '');
  if (hasIdentity) {
    const result = await query(
      `SELECT id FROM patients
       WHERE LOWER(BTRIM(first_name)) = LOWER(BTRIM($1))
         AND LOWER(BTRIM(last_name)) = LOWER(BTRIM($2))
         AND date_of_birth = $3::date
         AND LOWER(BTRIM(phone)) = LOWER(BTRIM($4))
         AND ($5::text IS NULL OR id <> $5)
       LIMIT 1`,
      [body.firstName, body.lastName, body.dateOfBirth, body.phone, excludeId],
    );
    if (result.rows.length) {
      const error = new Error('This patient is already registered with the same name, date of birth, and phone number.');
      error.statusCode = 409;
      throw error;
    }
  }
}

async function assertNoDuplicateResource(resource, body, excludeId = null) {
  if (resource === 'patients') return assertNoDuplicatePatient(body, excludeId);

  let sql = null;
  let values = [];
  let message = '';

  if (resource === 'doctors') {
    if (body.email && String(body.email).trim()) {
      sql = `SELECT id FROM doctors WHERE LOWER(BTRIM(email)) = LOWER(BTRIM($1)) AND ($2::text IS NULL OR id <> $2) LIMIT 1`;
      values = [body.email, excludeId];
      message = 'A doctor with this email already exists.';
    } else if (body.firstName && body.lastName && body.specialization) {
      sql = `SELECT id FROM doctors WHERE LOWER(BTRIM(first_name)) = LOWER(BTRIM($1)) AND LOWER(BTRIM(last_name)) = LOWER(BTRIM($2)) AND LOWER(BTRIM(specialization)) = LOWER(BTRIM($3)) AND ($4::text IS NULL OR id <> $4) LIMIT 1`;
      values = [body.firstName, body.lastName, body.specialization, excludeId];
      message = 'This doctor is already registered.';
    }
  } else if (resource === 'appointments' && body.patientId && body.doctorId && body.date && body.time && body.status !== 'Cancelled') {
    sql = `SELECT id FROM appointments WHERE patient_id = $1 AND doctor_id = $2 AND appointment_date = $3::date AND appointment_time = $4 AND status <> 'Cancelled' AND ($5::text IS NULL OR id <> $5) LIMIT 1`;
    values = [body.patientId, body.doctorId, body.date, body.time, excludeId];
    message = 'This patient already has an appointment with this doctor at that time.';
  } else if (resource === 'medicines' && body.name && String(body.name).trim()) {
    sql = `SELECT id FROM medicines WHERE LOWER(BTRIM(name)) = LOWER(BTRIM($1)) AND ($2::text IS NULL OR id <> $2) LIMIT 1`;
    values = [body.name, excludeId];
    message = 'A medicine with this name already exists.';
  } else if (resource === 'queue' && body.patientId && body.stage && body.stage !== 'Completed') {
    sql = `SELECT id FROM queue_items WHERE patient_id = $1 AND stage <> 'Completed' AND ($2::text IS NULL OR id <> $2) LIMIT 1`;
    values = [body.patientId, excludeId];
    message = 'This patient already has an active visit in the clinic queue.';
  } else if (resource === 'emergency' && body.patientId && !['Discharged', 'Transferred'].includes(body.status || 'In Treatment')) {
    sql = `SELECT id FROM emergency_cases WHERE patient_id = $1 AND status NOT IN ('Discharged', 'Transferred') AND ($2::text IS NULL OR id <> $2) LIMIT 1`;
    values = [body.patientId, excludeId];
    message = 'This patient already has an active emergency case.';
  } else if (resource === 'labOrders' && body.patientId && body.testName && body.status !== 'Completed') {
    sql = `SELECT id FROM lab_orders WHERE patient_id = $1 AND LOWER(BTRIM(test_name)) = LOWER(BTRIM($2)) AND status <> 'Completed' AND ($3::text IS NULL OR id <> $3) LIMIT 1`;
    values = [body.patientId, body.testName, excludeId];
    message = 'This laboratory investigation is already pending for the patient.';
  } else if (resource === 'pharmacyOrders' && body.patientId && Array.isArray(body.medicines) && body.medicines.length && body.status !== 'Cancelled') {
    sql = `SELECT id FROM pharmacy_orders WHERE patient_id = $1 AND status = 'Pending' AND medicines @> $2::jsonb AND $2::jsonb @> medicines AND ($3::text IS NULL OR id <> $3) LIMIT 1`;
    values = [body.patientId, JSON.stringify(body.medicines), excludeId];
    message = 'This pharmacy order is already pending for the patient.';
  } else if (resource === 'records' && body.queueItemId) {
    sql = `SELECT id FROM medical_records WHERE queue_item_id = $1 AND ($2::text IS NULL OR id <> $2) LIMIT 1`;
    values = [body.queueItemId, excludeId];
    message = 'A medical record already exists for this visit.';
  } else if (resource === 'emergencyBays' && body.name && String(body.name).trim()) {
    sql = `SELECT id FROM emergency_bays WHERE LOWER(BTRIM(name)) = LOWER(BTRIM($1)) AND ($2::text IS NULL OR id <> $2) LIMIT 1`;
    values = [body.name, excludeId];
    message = 'An emergency bay with this name already exists.';
  }

  if (!sql) return;
  const result = await query(sql, values);
  if (result.rows.length) {
    const error = new Error(message);
    error.statusCode = 409;
    throw error;
  }
}

function databaseError(error) {
  if (error.code === '23505') {
    error.statusCode = 409;
    error.publicMessage = 'A resource with the same unique value already exists';
  } else if (['23503', '23502'].includes(error.code)) {
    error.statusCode = 409;
    error.publicMessage = 'The request references a resource that does not exist or cannot be deleted';
  } else if (['23514', '22P02', '22001', '22003'].includes(error.code)) {
    error.statusCode = 422;
    error.publicMessage = 'The submitted data is not valid';
  }
  return error;
}

async function notifyAdminsOnDeletion({ resource, id, item, user }) {
  try {
    const adminUsers = await query("SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE");
    if (!adminUsers.rows.length) return;

    let itemDesc = id;
    if (item) {
      if (resource === 'patients') itemDesc = `${item.firstName || ''} ${item.lastName || ''} (ID: ${item.studentId || item.staffId || id})`.trim();
      else if (resource === 'appointments') itemDesc = `Appointment for ${item.patientName || 'Patient'} with ${item.doctorName || 'Doctor'} on ${item.date || ''}`;
      else if (resource === 'medicines') itemDesc = `${item.name || 'Medicine'} (${item.category || ''})`;
      else if (resource === 'records') itemDesc = `Medical Record (${item.diagnosis || id})`;
      else if (resource === 'queue') itemDesc = `Queue item #${item.tokenNumber || id} (${item.patientName || ''})`;
    }

    const senderId = user?.id;
    const senderName = user?.name || 'Clinic Staff';
    const senderRole = user?.role || 'Staff';
    const body = `🚨 [Deletion Alert] ${resource.slice(0, 1).toUpperCase() + resource.slice(1, -1)} "${itemDesc}" was deleted by ${senderName} (${senderRole}).`;

    // Audit log entry
    try {
      await query(
        `INSERT INTO audit_logs (id, user_id, username, user_role, action, resource, resource_id, summary, changes, ip_address)
         VALUES ($1, $2, $3, $4, 'DELETE', $5, $6, $7, $8, 'internal')`,
        [
          `AUD-${randomUUID().slice(0, 12)}`,
          senderId || null,
          senderName,
          senderRole,
          resource,
          id,
          body,
          JSON.stringify({ itemDesc }),
        ]
      );
    } catch (_) {}

    // Send notification message to active admins
    for (const admin of adminUsers.rows) {
      if (senderId && senderId === admin.id) continue;
      const effectiveSenderId = (senderId && senderId !== admin.id)
        ? senderId
        : (adminUsers.rows.find(a => a.id !== admin.id)?.id || null);

      if (!effectiveSenderId) continue;

      const msgId = `MSG-DEL-${randomUUID().slice(0, 10).toUpperCase()}`;
      await query(
        `INSERT INTO user_messages (id, sender_id, recipient_id, body)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [msgId, effectiveSenderId, admin.id, body]
      );
    }
  } catch (err) {
    // Non-fatal, deletion still completes
    console.error('Failed to notify admins on deletion:', err);
  }
}

async function notifyEmergencyStaff({ item, user }) {
  try {
    // A transfer is a direct operational message. Use the most recently
    // updated active ER account as the on-duty recipient instead of creating
    // a message for every emergency user.
    const emergencyUsers = await query("SELECT id FROM users WHERE role = 'emergency' AND is_active = TRUE ORDER BY updated_at DESC, created_at ASC LIMIT 1");
    const senderId = user?.id;
    const senderName = user?.name || 'Clinic Staff';
    if (!emergencyUsers.rows.length || !senderId) return;

    const patientName = item?.patientName || 'Patient';
    const acuity = item?.acuity || 'Red';
    const complaint = item?.chiefComplaint || 'Immediate assessment required';
    const bed = item?.bedNumber || 'ER bay to be assigned';
    const body = `Emergency transfer: ${patientName} was sent from OPD by ${senderName}. ${acuity} acuity · ${complaint} · ${bed}.`;

    for (const recipient of emergencyUsers.rows) {
      if (recipient.id === senderId) continue;
      await query(
        `INSERT INTO user_messages (id, sender_id, recipient_id, body)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [`MSG-ER-${randomUUID().slice(0, 10).toUpperCase()}`, senderId, recipient.id, body],
      );
    }
  } catch (error) {
    // A notification failure must never prevent the emergency admission.
    console.error('Failed to notify emergency staff:', error);
  }
}

export function createResourceHandler(resource) {
  const definition = resourceDefinitions[resource];
  const allowedFields = Object.keys(definition.fields);

  return async function resourceHandler(request, response, segments, url) {
    const id = segments[2];
    if (!requireResourceAccess(resource, request.method, request, response)) return;
    if (resource === 'emergencyBays') await ensureEmergencyBaysTable();
    if (resource === 'emergency') await ensureEmergencyAssessmentColumns();

    // ── GET (list) ───────────────────────────────────────────
    if (request.method === 'GET' && !id) {
      if (resource === 'doctors') {
        // Auto-sync OPD staff into the doctors table
        try {
          const opdUsers = await query("SELECT * FROM users WHERE role = 'opd' AND is_active = TRUE");
          for (const u of opdUsers.rows) {
            const rawName = String(u.name || '').trim();
            const cleanName = rawName.replace(/^(Dr\.?|Doctor)\s+/i, '').trim();
            const parts = cleanName.split(/\s+/).filter(Boolean);
            const firstName = parts[0] ? `Dr. ${parts[0]}` : 'Dr.';
            const lastName = parts.slice(1).join(' ') || 'Clinician';
            const spec = u.role_title || u.department || 'General Practice';
            const sched = JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
            await query(
              `INSERT INTO doctors (id, first_name, last_name, specialization, email, phone, gender, available, schedule)
               VALUES ($1, $2, $3, $4, $5, '', 'Male', TRUE, $6)
               ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, specialization = EXCLUDED.specialization, email = EXCLUDED.email, available = TRUE, updated_at = NOW()`,
              [u.id, firstName, lastName, spec, u.email || '', sched],
            );
          }
        } catch (_) { /* Non-fatal — list proceeds even if sync fails */ }
      }
      const result = await listResource(resource, parsePagination(url.searchParams));
      return sendJson(response, 200, result);
    }

    // ── GET (single) ─────────────────────────────────────────
    if (request.method === 'GET' && id) {
      const item = await findResource(resource, id);
      return item ? sendJson(response, 200, { data: item }) : sendError(response, 404, 'Resource not found');
    }

    // ── POST (create) ─────────────────────────────────────────
    if (request.method === 'POST' && !id) {
      // ER arrival time is generated at admission because the form records the
      // moment the case is created rather than asking staff to type a timestamp.
      const payload = resource === 'emergency' && !request.body?.arrivalTime
        ? { ...request.body, arrivalTime: new Date().toISOString() }
        : request.body;
      const body = validateResourcePayload(resource, payload, allowedFields, definition.required);
      try {
        await assertNoDuplicateResource(resource, body);
        if (resource === 'records' && body.doctorId) {
          const docCheck = await query('SELECT id FROM doctors WHERE id = $1', [body.doctorId]);
          if (!docCheck.rows.length) body.doctorId = null;
        }
        // Attribute the medicine to the signed-in pharmacist rather than trusting
        // whatever the client sent, so "Added by" is always trustworthy.
        if (resource === 'medicines') body.addedBy = String(request.user?.name || '').slice(0, 180);
        const created = await insertResource(resource, body);
        if (resource === 'emergency') await notifyEmergencyStaff({ item: created, user: request.user });
        // Fire-and-forget audit log
        auditResourceMutation(request, resource, 'POST', created?.id, null);
        return sendJson(response, 201, { data: created });
      } catch (error) {
        throw databaseError(error);
      }
    }

    // ── PATCH (update) ────────────────────────────────────────
    if (request.method === 'PATCH' && id) {
      const body = validateResourcePayload(resource, request.body, allowedFields.filter(f => f !== 'id'), definition.required, { partial: true });
      try {
        const currentItem = await findResource(resource, id);
        if (!currentItem) return sendError(response, 404, 'Resource not found');
        if (resource === 'queue' && body.stage) {
          if (currentItem.stage === 'Completed' && body.stage !== 'Completed') {
            return sendError(response, 409, 'Completed visits are closed. Create a new reception request for another consultation.');
          }
        }
        await assertNoDuplicateResource(resource, { ...currentItem, ...body }, id);
        if (resource === 'records' && body.doctorId) {
          const docCheck = await query('SELECT id FROM doctors WHERE id = $1', [body.doctorId]);
          if (!docCheck.rows.length) body.doctorId = null;
        }
        const item = await updateResource(resource, id, body);
        if (item) {
          auditResourceMutation(request, resource, 'PATCH', id, body);
          return sendJson(response, 200, { data: item });
        }
        return sendError(response, 404, 'Resource not found');
      } catch (error) {
        throw databaseError(error);
      }
    }

    // ── DELETE ────────────────────────────────────────────────
    if (request.method === 'DELETE' && id) {
      try {
        const existingItem = await findResource(resource, id);
        if (resource === 'emergencyBays' && existingItem) {
          const assignedCase = await query(
            `SELECT id FROM emergency_cases
             WHERE (bed_number = $1 OR bed_number LIKE $1 || '%')
               AND status NOT IN ('Discharged', 'Transferred')
             LIMIT 1`,
            [existingItem.name],
          );
          if (assignedCase.rows.length) {
            return sendError(response, 409, 'This bay is assigned to an active emergency case and cannot be deleted.');
          }
        }
        const item = await deleteResource(resource, id);
        if (item) {
          auditResourceMutation(request, resource, 'DELETE', id, null);
          await notifyAdminsOnDeletion({ resource, id, item: existingItem, user: request.user });
          return sendNoContent(response);
        }
        return sendError(response, 404, 'Resource not found');
      } catch (error) {
        throw databaseError(error);
      }
    }

    return sendError(response, 405, 'Method not allowed');
  };
}
