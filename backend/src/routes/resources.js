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

export function createResourceHandler(resource) {
  const definition = resourceDefinitions[resource];
  const allowedFields = Object.keys(definition.fields);

  return async function resourceHandler(request, response, segments, url) {
    const id = segments[2];
    if (!requireResourceAccess(resource, request.method, request, response)) return;

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
      const body = validateResourcePayload(resource, request.body, allowedFields, definition.required);
      try {
        if (resource === 'patients') await assertNoDuplicatePatient(body);
        if (resource === 'records' && body.doctorId) {
          const docCheck = await query('SELECT id FROM doctors WHERE id = $1', [body.doctorId]);
          if (!docCheck.rows.length) body.doctorId = null;
        }
        // Attribute the medicine to the signed-in pharmacist rather than trusting
        // whatever the client sent, so "Added by" is always trustworthy.
        if (resource === 'medicines') body.addedBy = String(request.user?.name || '').slice(0, 180);
        const created = await insertResource(resource, body);
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
        if (resource === 'queue' && body.stage) {
          const currentItem = await findResource(resource, id);
          if (!currentItem) return sendError(response, 404, 'Resource not found');
          if (currentItem.stage === 'Completed' && body.stage !== 'Completed') {
            return sendError(response, 409, 'Completed visits are closed. Create a new reception request for another consultation.');
          }
        }
        if (resource === 'patients') await assertNoDuplicatePatient(body, id);
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
