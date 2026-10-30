/**
 * BruClinic — Admin Routes
 *
 * All routes here require admin role. They provide:
 *   GET  /api/admin/audit-logs        — paginated audit trail
 *   GET  /api/admin/security-events   — paginated security incident log
 *   GET  /api/admin/config            — read all system config
 *   PATCH /api/admin/config           — update one or more config keys
 *   GET  /api/admin/stats             — security/activity statistics
 *   GET  /api/admin/backup            — download a full JSON snapshot
 *   GET  /api/admin/backup/tables     — row counts per table
 *   GET  /api/admin/backup/history    — export/import history
 *   POST /api/admin/backup/restore    — validate (dry run) or restore a snapshot
 */

import { query } from '../db/pool.js';
import { sendDownload, sendError, sendJson } from '../utils/http.js';
import { assertPlainObject, validateText } from '../utils/validation.js';
import { writeAuditLog, writeSecurityEvent } from '../middleware/auditLogger.js';
import { AUDIT_ACTION, SECURITY_EVENT } from '../constants/events.js';
import { checkAdminRateLimit, getClientIp } from '../middleware/rateLimiter.js';
import { invalidateSystemConfig } from '../services/systemConfig.js';
import {
  createBackup, getTableStats, listBackupRuns, recordBackupRun, restoreBackup, validateBackup,
} from '../services/backup.js';

/** Allowed keys for system_config PATCH — prevents arbitrary key injection. */
const EDITABLE_CONFIG_KEYS = new Set([
  'clinic_name', 'clinic_location', 'clinic_email', 'clinic_phone',
  'session_timeout_hours', 'max_login_attempts', 'login_lockout_minutes',
  'maintenance_mode', 'maintenance_message', 'audit_log_retention_days', 'security_event_retention_days',
  'timezone', 'academic_year',
]);

function requireAdmin(request, response) {
  if (!request.user || request.user.role !== 'admin') {
    sendError(response, 403, 'Administrator access required');
    return false;
  }
  return true;
}

function parsePage(url) {
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') || '50', 10), 1), 200);
  const offset = Math.max(Number.parseInt(url.searchParams.get('offset') || '0', 10), 0);
  const search = (url.searchParams.get('search') || '').slice(0, 100).trim();
  const severity = url.searchParams.get('severity') || '';
  const action = url.searchParams.get('action') || '';
  const eventType = url.searchParams.get('event_type') || '';
  const userId = url.searchParams.get('user_id') || '';
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';
  return { limit, offset, search, severity, action, eventType, userId, from, to };
}

export async function adminHandler(request, response, segments, url) {
  if (!requireAdmin(request, response)) return;
  if (!checkAdminRateLimit(request, response)) return;

  const section = segments[2]; // audit-logs | security-events | config | stats | backup

  // ---------------------------------------------------------------
  // Backup & restore
  // ---------------------------------------------------------------
  if (section === 'backup') {
    const action = segments[3];
    const ip = getClientIp(request);

    // GET /api/admin/backup — full snapshot download
    if (request.method === 'GET' && !action) {
      const includeUsers = url.searchParams.get('includeUsers') !== 'false';
      const includeAudit = url.searchParams.get('includeAudit') === 'true';
      const backup = await createBackup({ includeUsers, includeAudit });
      const filename = `bruclinic-backup-${backup.createdAt.replace(/[:.]/g, '-').slice(0, 19)}.json`;

      writeAuditLog({
        requestId: request.requestId,
        userId: request.user.id,
        username: request.user.username,
        userRole: request.user.role,
        action: AUDIT_ACTION.BACKUP,
        resource: 'backup',
        summary: `Downloaded backup (${Object.values(backup.counts).reduce((a, b) => a + b, 0)} rows, users: ${includeUsers ? 'included' : 'excluded'})`,
        ipAddress: ip,
      });
      writeSecurityEvent({
        eventType: SECURITY_EVENT.BACKUP_CREATED,
        userId: request.user.id,
        username: request.user.username,
        ipAddress: ip,
        requestId: request.requestId,
        description: `Data backup downloaded by ${request.user.username}`,
        metadata: { counts: backup.counts, includeUsers, includeAudit, checksum: backup.checksum },
      });
      await recordBackupRun({
        kind: 'export', actorId: request.user.id, actor: request.user.username,
        filename, checksum: backup.checksum, counts: backup.counts,
      });

      return sendDownload(response, backup, filename);
    }

    // GET /api/admin/backup/tables — table sizes for the admin UI
    if (request.method === 'GET' && action === 'tables') {
      return sendJson(response, 200, {
        data: await getTableStats(),
        history: await listBackupRuns(5),
      });
    }

    // GET /api/admin/backup/history
    if (request.method === 'GET' && action === 'history') {
      const limit = Number.parseInt(url.searchParams.get('limit') || '25', 10);
      return sendJson(response, 200, { data: await listBackupRuns(limit) });
    }

    // POST /api/admin/backup/restore
    if (request.method === 'POST' && action === 'restore') {
      assertPlainObject(request.body);
      const { backup, mode = 'merge', dryRun = false, confirm } = request.body;
      const restoreMode = mode === 'replace' ? 'replace' : 'merge';

      if (restoreMode === 'replace' && String(confirm || '').trim().toUpperCase() !== 'REPLACE') {
        return sendError(response, 422, 'Type REPLACE to confirm a full restore of this database');
      }

      // Validate before touching the database so failures are cheap and clear.
      const validated = validateBackup(backup);
      const result = await restoreBackup(backup, { mode: restoreMode, dryRun: Boolean(dryRun), actor: request.user });

      await recordBackupRun({
        kind: 'import', mode: restoreMode, status: dryRun ? 'validated' : 'completed',
        actorId: request.user.id, actor: request.user.username,
        checksum: validated.checksum, dryRun: Boolean(dryRun), counts: validated.counts,
        notes: `Rows applied: ${Object.values(result.tables).reduce((total, entry) => total + (entry.applied || 0), 0)}`,
      });

      if (!dryRun) {
        writeAuditLog({
          requestId: request.requestId,
          userId: request.user.id,
          username: request.user.username,
          userRole: request.user.role,
          action: AUDIT_ACTION.RESTORE,
          resource: 'backup',
          summary: `Restored database from backup (${restoreMode} mode)`,
          changes: { counts: { from: null, to: validated.counts } },
          ipAddress: ip,
        });
        writeSecurityEvent({
          eventType: SECURITY_EVENT.BACKUP_IMPORTED,
          userId: request.user.id,
          username: request.user.username,
          ipAddress: ip,
          requestId: request.requestId,
          description: `Database restored from backup by ${request.user.username} (${restoreMode} mode)`,
          metadata: { counts: validated.counts, checksum: validated.checksum },
        });
      }

      return sendJson(response, 200, {
        message: dryRun ? 'Restore validated successfully — no changes were written' : 'Backup restored successfully',
        data: result,
      });
    }

    return sendError(response, 404, 'Backup route not found');
  }

  // ---------------------------------------------------------------
  // GET /api/admin/audit-logs
  // ---------------------------------------------------------------
  if (request.method === 'GET' && section === 'audit-logs') {
    const { limit, offset, search, action, userId, from, to } = parsePage(url);
    const conditions = [];
    const values = [];
    const param = value => { values.push(value); return `$${values.length}`; };

    if (search) {
      const term = `%${search.toLowerCase()}%`;
      conditions.push(`(LOWER(al.resource) LIKE ${param(term)} OR LOWER(al.username) LIKE ${param(term)} OR LOWER(al.summary) LIKE ${param(term)} OR LOWER(al.resource_id) LIKE ${param(term)})`);
    }
    if (action) conditions.push(`al.action = ${param(action)}`);
    if (userId) conditions.push(`al.user_id = ${param(userId)}`);
    if (from) conditions.push(`al.created_at >= ${param(from)}`);
    if (to) conditions.push(`al.created_at <= ${param(to + ' 23:59:59')}`);

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const whereValues = [...values];
    const limitParam = param(limit);
    const offsetParam = param(offset);
    const rows = await query(
      `SELECT al.*, u.name AS user_display_name FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${where} ORDER BY al.created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
      values,
    );
    const countResult = await query(`SELECT COUNT(*) AS total FROM audit_logs al ${where}`, whereValues);
    return sendJson(response, 200, {
      data: rows.rows.map(row => ({
        ...row,
        changes: typeof row.changes === 'string' ? tryParse(row.changes) : row.changes,
      })),
      total: Number(countResult.rows[0]?.total || 0),
      limit, offset,
    });
  }

  // ---------------------------------------------------------------
  // GET /api/admin/security-events
  // ---------------------------------------------------------------
  if (request.method === 'GET' && section === 'security-events') {
    const { limit, offset, search, severity, eventType, userId, from, to } = parsePage(url);
    const conditions = [];
    const values = [];
    const param = value => { values.push(value); return `$${values.length}`; };

    if (search) {
      const term = `%${search.toLowerCase()}%`;
      conditions.push(`(LOWER(se.username) LIKE ${param(term)} OR LOWER(se.description) LIKE ${param(term)} OR LOWER(se.ip_address) LIKE ${param(term)} OR LOWER(se.event_type) LIKE ${param(term)})`);
    }
    if (severity) conditions.push(`se.severity = ${param(severity)}`);
    if (eventType) conditions.push(`se.event_type = ${param(eventType)}`);
    if (userId) conditions.push(`se.user_id = ${param(userId)}`);
    if (from) conditions.push(`se.created_at >= ${param(from)}`);
    if (to) conditions.push(`se.created_at <= ${param(to + ' 23:59:59')}`);

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const whereValues = [...values];
    const limitParam = param(limit);
    const offsetParam = param(offset);
    const rows = await query(
      `SELECT se.* FROM security_events se ${where} ORDER BY se.created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
      values,
    );
    const countResult = await query(`SELECT COUNT(*) AS total FROM security_events se ${where}`, whereValues);
    return sendJson(response, 200, {
      data: rows.rows.map(row => ({
        ...row,
        metadata: typeof row.metadata === 'string' ? tryParse(row.metadata) : row.metadata,
      })),
      total: Number(countResult.rows[0]?.total || 0),
      limit, offset,
    });
  }

  // ---------------------------------------------------------------
  // GET /api/admin/config
  // ---------------------------------------------------------------
  if (request.method === 'GET' && section === 'config') {
    const rows = await query('SELECT key, value, description, updated_by, updated_at FROM system_config ORDER BY key ASC');
    return sendJson(response, 200, { data: rows.rows });
  }

  // ---------------------------------------------------------------
  // PATCH /api/admin/config
  // ---------------------------------------------------------------
  if (request.method === 'PATCH' && section === 'config') {
    assertPlainObject(request.body);
    const updates = [];
    const changesLog = {};

    for (const [key, value] of Object.entries(request.body)) {
      if (!EDITABLE_CONFIG_KEYS.has(key)) continue;
      if (value === undefined || value === null) continue;
      validateText(String(value), key, { max: 500 });
      updates.push({ key, value: String(value).trim() });
    }

    if (!updates.length) return sendError(response, 422, 'No valid config keys provided');

    // Read current values for audit diff
    const keys = updates.map(u => u.key);
    const current = await query(
      `SELECT key, value FROM system_config WHERE key IN (${keys.map((_, index) => `$${index + 1}`).join(',')})`,
      keys,
    );
    const currentMap = Object.fromEntries(current.rows.map(r => [r.key, r.value]));

    for (const { key, value } of updates) {
      changesLog[key] = { from: currentMap[key] ?? null, to: value };
      await query(
        'UPDATE system_config SET value = $1, updated_by = $2, updated_at = NOW() WHERE key = $3',
        [value, request.user.username, key],
      );
    }

    // Audit the config change
    writeAuditLog({
      requestId: request.requestId,
      userId: request.user.id,
      username: request.user.username,
      userRole: request.user.role,
      action: AUDIT_ACTION.CONFIG,
      resource: 'system_config',
      summary: `Admin updated ${updates.length} config key(s)`,
      changes: changesLog,
      ipAddress: getClientIp(request),
    });

    writeSecurityEvent({
      eventType: SECURITY_EVENT.CONFIG_CHANGED,
      userId: request.user.id,
      username: request.user.username,
      ipAddress: getClientIp(request),
      requestId: request.requestId,
      description: `System config updated: ${Object.keys(changesLog).join(', ')}`,
      metadata: changesLog,
    });

    // Runtime consumers (session, lockout, maintenance) reload immediately.
    invalidateSystemConfig();

    const updatedRows = await query('SELECT key, value, description, updated_by, updated_at FROM system_config ORDER BY key ASC');
    return sendJson(response, 200, { message: 'Configuration updated', data: updatedRows.rows });
  }

  // ---------------------------------------------------------------
  // GET /api/admin/stats  — aggregated dashboard metrics
  // ---------------------------------------------------------------
  if (request.method === 'GET' && section === 'stats') {
    const [
      totalLogins, failedLogins24h, criticalEvents24h, auditActions24h,
      topFailedIps, recentLockouts, activeUsers,
    ] = await Promise.all([
      query(`SELECT COUNT(*) AS total FROM security_events WHERE event_type = 'AUTH_LOGIN_SUCCESS' AND created_at >= NOW() - INTERVAL '24 hours'`),
      query(`SELECT COUNT(*) AS total FROM security_events WHERE event_type = 'AUTH_LOGIN_FAILURE' AND created_at >= NOW() - INTERVAL '24 hours'`),
      query(`SELECT COUNT(*) AS total FROM security_events WHERE severity = 'critical' AND created_at >= NOW() - INTERVAL '24 hours'`),
      query(`SELECT COUNT(*) AS total FROM audit_logs WHERE created_at >= NOW() - INTERVAL '24 hours'`),
      query(`SELECT ip_address, COUNT(*) AS count FROM security_events WHERE event_type = 'AUTH_LOGIN_FAILURE' AND created_at >= NOW() - INTERVAL '24 hours' GROUP BY ip_address ORDER BY count DESC LIMIT 5`),
      query(`SELECT * FROM security_events WHERE event_type = 'AUTH_LOGIN_LOCKED' ORDER BY created_at DESC LIMIT 10`),
      query(`SELECT COUNT(*) AS total FROM users WHERE is_active = TRUE`),
    ]);

    return sendJson(response, 200, {
      data: {
        last24h: {
          successfulLogins: Number(totalLogins.rows[0]?.total || 0),
          failedLogins: Number(failedLogins24h.rows[0]?.total || 0),
          criticalSecurityEvents: Number(criticalEvents24h.rows[0]?.total || 0),
          auditActions: Number(auditActions24h.rows[0]?.total || 0),
        },
        activeStaffCount: Number(activeUsers.rows[0]?.total || 0),
        topFailedLoginIps: topFailedIps.rows,
        recentLockouts: recentLockouts.rows,
      },
    });
  }

  return sendError(response, 404, 'Admin route not found');
}

function tryParse(value) {
  if (!value || typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}
