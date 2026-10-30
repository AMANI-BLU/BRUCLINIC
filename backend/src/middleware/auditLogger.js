/**
 * BruClinic — Audit Logger Middleware
 *
 * Records every state-changing action (POST, PATCH, DELETE) to the
 * `audit_logs` table, and records security-significant events to the
 * `security_events` table.
 *
 * Design principles:
 * - Audit log writes are fire-and-forget (best effort): a log write failure
 *   must never cause the main request to fail.
 * - Security events include severity level for triage in the admin dashboard.
 * - Both tables include the correlation requestId for end-to-end tracing.
 */

import { randomUUID } from 'node:crypto';
import { isDatabaseConfigured } from '../db/pool.js';
import { logger } from '../utils/logger.js';
import { AUDIT_ACTION, EVENT_SEVERITY, SECURITY_EVENT } from '../constants/events.js';

/** Lazy-load the query function to avoid circular dependencies at startup. */
async function dbQuery(sql, values) {
  if (!isDatabaseConfigured()) return;
  try {
    const { query } = await import('../db/pool.js');
    await query(sql, values);
  } catch (err) {
    // Log the failure but never propagate — audit logs must be non-blocking
    logger.error('Audit log write failed', { error: err.message, sql: sql.slice(0, 80) });
  }
}

/**
 * Write an entry to the `audit_logs` table.
 *
 * @param {object} opts
 * @param {string} opts.requestId  - Correlation ID from request middleware
 * @param {string} [opts.userId]   - Acting user's ID (null for unauthenticated)
 * @param {string} [opts.username] - Acting user's username for readability
 * @param {string} [opts.userRole] - Acting user's role
 * @param {string} opts.action     - AUDIT_ACTION constant
 * @param {string} opts.resource   - Resource name (e.g. 'patients', 'users')
 * @param {string} [opts.resourceId] - Affected record ID
 * @param {string} [opts.summary]  - Human-readable description
 * @param {object} [opts.changes]  - Diff of what changed {field: {from, to}}
 * @param {string} [opts.ipAddress]
 */
export async function writeAuditLog(opts) {
  const {
    requestId, userId = null, username = null, userRole = null,
    action, resource, resourceId = null, summary = null,
    changes = null, ipAddress = null,
  } = opts;

  const id = `AL-${randomUUID().slice(0, 8).toUpperCase()}`;
  await dbQuery(
    `INSERT INTO audit_logs
      (id, request_id, user_id, username, user_role, action, resource, resource_id, summary, changes, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id, requestId || null, userId, username, userRole,
      action, resource, resourceId, summary,
      changes ? JSON.stringify(changes) : null,
      ipAddress,
    ],
  );
}

/**
 * Write an entry to the `security_events` table.
 *
 * @param {object} opts
 * @param {string} opts.eventType  - SECURITY_EVENT constant
 * @param {string} [opts.severity] - EVENT_SEVERITY constant (auto-derived if omitted)
 * @param {string} [opts.userId]
 * @param {string} [opts.username]
 * @param {string} [opts.ipAddress]
 * @param {string} [opts.requestId]
 * @param {string} [opts.description] - Human-readable context
 * @param {object} [opts.metadata]    - Extra structured data
 */
export async function writeSecurityEvent(opts) {
  const {
    eventType, userId = null, username = null,
    ipAddress = null, requestId = null,
    description = null, metadata = null,
  } = opts;
  const severity = opts.severity || EVENT_SEVERITY[eventType] || 'info';
  const id = `SE-${randomUUID().slice(0, 8).toUpperCase()}`;
  await dbQuery(
    `INSERT INTO security_events
      (id, event_type, severity, user_id, username, ip_address, request_id, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id, eventType, severity, userId, username,
      ipAddress, requestId, description,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );
}

/**
 * Auto-audit a resource mutation from within a resource route handler.
 * Call this after a successful INSERT/UPDATE/DELETE.
 *
 * @param {import('node:http').IncomingMessage} request
 * @param {string} resource - Resource name
 * @param {string} httpMethod - 'POST' | 'PATCH' | 'DELETE'
 * @param {string} [resourceId]
 * @param {object} [changes]
 */
export function auditResourceMutation(request, resource, httpMethod, resourceId, changes) {
  const actionMap = { POST: AUDIT_ACTION.CREATE, PATCH: AUDIT_ACTION.UPDATE, DELETE: AUDIT_ACTION.DELETE };
  const action = actionMap[httpMethod] || AUDIT_ACTION.UPDATE;
  const { getClientIp } = import.meta.resolve ? { getClientIp: _getIp } : { getClientIp: _getIp };

  writeAuditLog({
    requestId: request.requestId,
    userId: request.user?.id,
    username: request.user?.username,
    userRole: request.user?.role,
    action,
    resource,
    resourceId,
    summary: `${action} on ${resource}${resourceId ? ` (${resourceId})` : ''}`,
    changes,
    ipAddress: _getIp(request),
  });
}

function _getIp(request) {
  const forwarded = request.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return request.socket?.remoteAddress || null;
}

export { AUDIT_ACTION, SECURITY_EVENT };
