/**
 * BruClinic — Admin Routes
 *
 * All routes here require admin or ict role. They provide:
 *   GET   /api/admin/audit-logs        — paginated audit trail
 *   GET   /api/admin/security-events   — paginated security incident log
 *   GET   /api/admin/config            — read all system config
 *   PATCH /api/admin/config            — update one or more config keys
 *   GET   /api/admin/stats             — security/activity statistics
 *   GET   /api/admin/backup            — download a full JSON snapshot
 *   GET   /api/admin/backup/tables     — row counts per table
 *   GET   /api/admin/backup/history    — export/import history
 *   POST  /api/admin/backup/restore    — validate (dry run) or restore a snapshot
 *   GET   /api/admin/login-background  — get login background image
 *   PATCH /api/admin/login-background  — set/clear login background image
 *   GET   /api/admin/default-password  — check default password status
 *   POST  /api/admin/default-password  — set default user password
 *   GET   /api/admin/clinic-profile    — get clinic profile
 *   PATCH /api/admin/clinic-profile    — update clinic profile
 */

import { Router } from 'express';
import { query } from '../db/pool.js';
import { sendDownload, sendError, sendJson } from '../utils/http.js';
import { assertPlainObject, validatePassword, validateText } from '../utils/validation.js';
import { hashPassword } from '../utils/auth.js';
import { openSecret, sealSecret } from '../utils/secrets.js';
import { writeAuditLog, writeSecurityEvent } from '../middleware/auditLogger.js';
import { AUDIT_ACTION, SECURITY_EVENT } from '../constants/events.js';
import { checkAdminRateLimit, getClientIp } from '../middleware/rateLimiter.js';
import { invalidateSystemConfig } from '../services/systemConfig.js';
import {
  createBackup, getTableStats, listBackupRuns, recordBackupRun, restoreBackup, validateBackup,
} from '../services/backup.js';
import { getBannedIps, banIp, unbanIp } from '../services/ipBan.js';

/** Allowed keys for system_config PATCH — prevents arbitrary key injection. */
const EDITABLE_CONFIG_KEYS = new Set([
  'clinic_name', 'clinic_location', 'clinic_email', 'clinic_phone',
  'session_timeout_hours', 'max_login_attempts', 'login_lockout_minutes',
  'maintenance_mode', 'maintenance_message', 'audit_log_retention_days', 'security_event_retention_days',
  'timezone', 'academic_year',
]);

function requireAdmin(request, response) {
  if (!request.user || (request.user.role !== 'admin' && request.user.role !== 'ict')) {
    sendError(response, 403, 'Administrator access required');
    return false;
  }
  return true;
}

function parsePage(source) {
  const getParam = (name) => {
    if (!source) return '';
    if (typeof source.get === 'function') return source.get(name) || '';
    if (source.searchParams && typeof source.searchParams.get === 'function') return source.searchParams.get(name) || '';
    return source[name] || '';
  };
  const limit = Math.min(Math.max(Number.parseInt(getParam('limit') || '50', 10), 1), 200);
  const offset = Math.max(Number.parseInt(getParam('offset') || '0', 10), 0);
  const search = String(getParam('search') || '').slice(0, 100).trim();
  const severity = String(getParam('severity') || '');
  const action = String(getParam('action') || '');
  const eventType = String(getParam('event_type') || '');
  const userId = String(getParam('user_id') || '');
  const from = String(getParam('from') || '');
  const to = String(getParam('to') || '');
  return { limit, offset, search, severity, action, eventType, userId, from, to };
}

function validateLoginBackgroundImage(value) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || value.length > 600000) {
    const error = new Error('Choose a JPEG, PNG, or WebP image smaller than 450 KB.');
    error.statusCode = 422;
    throw error;
  }

  const bytes = Buffer.from(match[2], 'base64');
  const validBase64 = bytes.toString('base64') === match[2];
  const hasValidSignature = match[1] === 'jpeg'
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : match[1] === 'png'
      ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!validBase64 || !bytes.length || bytes.length > 450000 || !hasValidSignature) {
    const error = new Error('The login background must be a valid image smaller than 450 KB.');
    error.statusCode = 422;
    throw error;
  }
}

function tryParse(value) {
  if (!value || typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

const router = Router();

// Route-level middleware enforcing admin/ict access and rate limit
router.use((req, res, next) => {
  if (!requireAdmin(req, res)) return;
  if (!checkAdminRateLimit(req, res)) return;
  next();
});

// ── Login Background ──────────────────────────────────────────────
router.get('/login-background', async (req, res, next) => {
  try {
    const result = await query("SELECT value FROM system_config WHERE key = 'login_background_image' LIMIT 1");
    return sendJson(res, 200, { data: { image: result.rows[0]?.value || null } });
  } catch (err) {
    next(err);
  }
});

router.patch('/login-background', async (req, res, next) => {
  try {
    assertPlainObject(req.body);
    const image = req.body.image === null ? '' : req.body.image;
    if (typeof image !== 'string') {
      const error = new Error('Login background image must be an uploaded image or null.');
      error.statusCode = 422;
      throw error;
    }
    if (image) validateLoginBackgroundImage(image);
    await query(
      `INSERT INTO system_config (key, value, description, updated_by)
       VALUES ('login_background_image', $1, 'Administrator-selected image shown behind the login screen', $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [image, req.user.username],
    );
    writeAuditLog({
      requestId: req.requestId, userId: req.user.id, username: req.user.username,
      userRole: req.user.role, action: AUDIT_ACTION.CONFIG, resource: 'system_config',
      resourceId: 'login_background_image',
      summary: image ? 'Administrator changed the login page background image' : 'Administrator restored the default login page background',
      ipAddress: getClientIp(req),
    });
    invalidateSystemConfig();
    return sendJson(res, 200, { message: image ? 'Login background updated' : 'Default login background restored', data: { image: image || null } });
  } catch (err) {
    next(err);
  }
});

// ── Default Password ──────────────────────────────────────────────
router.get('/default-password', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT key, value FROM system_config
       WHERE key IN ('default_user_password_hash', 'default_user_password_enc')`,
    );
    const hashRow = result.rows.find(row => row.key === 'default_user_password_hash');
    const sealedRow = result.rows.find(row => row.key === 'default_user_password_enc');
    return sendJson(res, 200, {
      configured: Boolean(hashRow?.value),
      password: openSecret(sealedRow?.value),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/default-password', async (req, res, next) => {
  try {
    assertPlainObject(req.body);
    validatePassword(req.body.password, 'Default password');
    const plainPassword = String(req.body.password);
    await query(
      `INSERT INTO system_config (key, value, description, updated_by)
       VALUES ('default_user_password_hash', $1, 'Hashed temporary password assigned to newly created staff accounts', $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [hashPassword(plainPassword), req.user.username],
    );
    await query(
      `INSERT INTO system_config (key, value, description, updated_by)
       VALUES ('default_user_password_enc', $1, 'Sealed (AES-256-GCM) copy of the default staff password shown to administrators', $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [sealSecret(plainPassword), req.user.username],
    );
    writeAuditLog({
      requestId: req.requestId, userId: req.user.id, username: req.user.username,
      userRole: req.user.role, action: AUDIT_ACTION.CONFIG, resource: 'system_config',
      resourceId: 'default_user_password_hash', summary: 'Administrator updated the default staff password',
      ipAddress: getClientIp(req),
    });
    invalidateSystemConfig();
    return sendJson(res, 200, { message: 'Default staff password updated', configured: true });
  } catch (err) {
    next(err);
  }
});

// ── Backup & Restore ──────────────────────────────────────────────
router.get('/backup/tables', async (req, res, next) => {
  try {
    return sendJson(res, 200, {
      data: await getTableStats(),
      history: await listBackupRuns(5),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/backup/history', async (req, res, next) => {
  try {
    const limit = Number.parseInt(req.query.limit || '25', 10);
    return sendJson(res, 200, { data: await listBackupRuns(limit) });
  } catch (err) {
    next(err);
  }
});

router.post('/backup/restore', async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    assertPlainObject(req.body);
    const { backup, mode = 'merge', dryRun = false, confirm } = req.body;
    const restoreMode = mode === 'replace' ? 'replace' : 'merge';

    if (restoreMode === 'replace' && String(confirm || '').trim().toUpperCase() !== 'REPLACE') {
      return sendError(res, 422, 'Type REPLACE to confirm a full restore of this database');
    }

    const validated = validateBackup(backup);
    const result = await restoreBackup(backup, { mode: restoreMode, dryRun: Boolean(dryRun), actor: req.user });

    await recordBackupRun({
      kind: 'import', mode: restoreMode, status: dryRun ? 'validated' : 'completed',
      actorId: req.user.id, actor: req.user.username,
      checksum: validated.checksum, dryRun: Boolean(dryRun), counts: validated.counts,
      notes: `Rows applied: ${Object.values(result.tables).reduce((total, entry) => total + (entry.applied || 0), 0)}`,
    });

    if (!dryRun) {
      writeAuditLog({
        requestId: req.requestId,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        action: AUDIT_ACTION.RESTORE,
        resource: 'backup',
        summary: `Restored database from backup (${restoreMode} mode)`,
        changes: { counts: { from: null, to: validated.counts } },
        ipAddress: ip,
      });
      writeSecurityEvent({
        eventType: SECURITY_EVENT.BACKUP_IMPORTED,
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        ipAddress: ip,
        requestId: req.requestId,
        description: `Database restored from backup by ${req.user.username} (${req.user.role}) (${restoreMode} mode)`,
        metadata: { counts: validated.counts, checksum: validated.checksum, actorRole: req.user.role },
      });
    }

    return sendJson(res, 200, {
      message: dryRun ? 'Restore validated successfully — no changes were written' : 'Backup restored successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/backup', async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const includeUsers = req.query.includeUsers !== 'false';
    const includeAudit = req.query.includeAudit === 'true';
    const backup = await createBackup({ includeUsers, includeAudit });
    const filename = `bruclinic-backup-${backup.createdAt.replace(/[:.]/g, '-').slice(0, 19)}.json`;

    writeAuditLog({
      requestId: req.requestId,
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      action: AUDIT_ACTION.BACKUP,
      resource: 'backup',
      summary: `Downloaded backup (${Object.values(backup.counts).reduce((a, b) => a + b, 0)} rows, users: ${includeUsers ? 'included' : 'excluded'})`,
      ipAddress: ip,
    });
    writeSecurityEvent({
      eventType: SECURITY_EVENT.BACKUP_CREATED,
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      ipAddress: ip,
      requestId: req.requestId,
      description: `Data backup downloaded by ${req.user.username} (${req.user.role})`,
      metadata: { counts: backup.counts, includeUsers, includeAudit, checksum: backup.checksum, actorRole: req.user.role },
    });
    await recordBackupRun({
      kind: 'export', actorId: req.user.id, actor: req.user.username,
      filename, checksum: backup.checksum, counts: backup.counts,
    });

    return sendDownload(res, backup, filename);
  } catch (err) {
    next(err);
  }
});

// ── Audit Logs ────────────────────────────────────────────────────
router.get('/audit-logs', async (req, res, next) => {
  try {
    const { limit, offset, search, action, userId, from, to } = parsePage(req.query);
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
    return sendJson(res, 200, {
      data: rows.rows.map(row => ({
        ...row,
        changes: typeof row.changes === 'string' ? tryParse(row.changes) : row.changes,
      })),
      total: Number(countResult.rows[0]?.total || 0),
      limit, offset,
    });
  } catch (err) {
    next(err);
  }
});

// ── Security Events ───────────────────────────────────────────────
router.get('/security-events', async (req, res, next) => {
  try {
    const { limit, offset, search, severity, eventType, userId, from, to } = parsePage(req.query);
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
      `SELECT se.*, COALESCE(u.role, se.metadata->>'userRole') AS user_role FROM security_events se
       LEFT JOIN users u ON se.user_id = u.id
       ${where} ORDER BY se.created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
      values,
    );
    const countResult = await query(`SELECT COUNT(*) AS total FROM security_events se ${where}`, whereValues);
    return sendJson(res, 200, {
      data: rows.rows.map(row => ({
        ...row,
        metadata: typeof row.metadata === 'string' ? tryParse(row.metadata) : row.metadata,
      })),
      total: Number(countResult.rows[0]?.total || 0),
      limit, offset,
    });
  } catch (err) {
    next(err);
  }
});

// ── Config ────────────────────────────────────────────────────────
router.get('/config', async (req, res, next) => {
  try {
    const rows = await query("SELECT key, value, description, updated_by, updated_at FROM system_config WHERE key NOT IN ('default_user_password_hash', 'login_background_image') ORDER BY key ASC");
    return sendJson(res, 200, { data: rows.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/config', async (req, res, next) => {
  try {
    assertPlainObject(req.body);
    const updates = [];
    const changesLog = {};

    for (const [key, value] of Object.entries(req.body)) {
      if (!EDITABLE_CONFIG_KEYS.has(key)) continue;
      if (value === undefined || value === null) continue;
      validateText(String(value), key, { max: 500 });
      updates.push({ key, value: String(value).trim() });
    }

    if (!updates.length) return sendError(res, 422, 'No valid config keys provided');

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
        [value, req.user.username, key],
      );
    }

    writeAuditLog({
      requestId: req.requestId,
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      action: AUDIT_ACTION.CONFIG,
      resource: 'system_config',
      summary: `Admin updated ${updates.length} config key(s)`,
      changes: changesLog,
      ipAddress: getClientIp(req),
    });

    writeSecurityEvent({
      eventType: SECURITY_EVENT.CONFIG_CHANGED,
      userId: req.user.id,
      username: req.user.username,
      ipAddress: getClientIp(req),
      requestId: req.requestId,
      description: `System config updated: ${Object.keys(changesLog).join(', ')}`,
      metadata: changesLog,
    });

    invalidateSystemConfig();

    const updatedRows = await query("SELECT key, value, description, updated_by, updated_at FROM system_config WHERE key NOT IN ('default_user_password_hash', 'login_background_image') ORDER BY key ASC");
    return sendJson(res, 200, { message: 'Configuration updated', data: updatedRows.rows });
  } catch (err) {
    next(err);
  }
});

// ── Stats ─────────────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const [
      totalLogins, failedLogins24h, criticalEvents24h, auditActions24h,
      topFailedIps, recentLockouts, activeUsers, bannedCount,
    ] = await Promise.all([
      query(`SELECT COUNT(*) AS total FROM security_events WHERE event_type = 'AUTH_LOGIN_SUCCESS' AND created_at >= NOW() - INTERVAL '24 hours'`),
      query(`SELECT COUNT(*) AS total FROM security_events WHERE event_type = 'AUTH_LOGIN_FAILURE' AND created_at >= NOW() - INTERVAL '24 hours'`),
      query(`SELECT COUNT(*) AS total FROM security_events WHERE severity = 'critical' AND created_at >= NOW() - INTERVAL '24 hours'`),
      query(`SELECT COUNT(*) AS total FROM audit_logs WHERE created_at >= NOW() - INTERVAL '24 hours'`),
      query(`SELECT se.ip_address, COUNT(*) AS count,
                    EXISTS(SELECT 1 FROM banned_ips bi WHERE bi.ip_address = se.ip_address AND (bi.expires_at IS NULL OR bi.expires_at > NOW())) AS is_banned
             FROM security_events se
             WHERE se.event_type = 'AUTH_LOGIN_FAILURE' AND se.created_at >= NOW() - INTERVAL '24 hours'
             GROUP BY se.ip_address ORDER BY count DESC LIMIT 5`),
      query(`SELECT se.*,
                    EXISTS(SELECT 1 FROM banned_ips bi WHERE bi.ip_address = se.ip_address AND (bi.expires_at IS NULL OR bi.expires_at > NOW())) AS is_banned
             FROM security_events se
             WHERE se.event_type = 'AUTH_LOGIN_LOCKED' ORDER BY se.created_at DESC LIMIT 10`),
      query(`SELECT COUNT(*) AS total FROM users WHERE is_active = TRUE`),
      query(`SELECT COUNT(*) AS total FROM banned_ips WHERE expires_at IS NULL OR expires_at > NOW()`),
    ]);

    return sendJson(res, 200, {
      data: {
        last24h: {
          successfulLogins: Number(totalLogins.rows[0]?.total || 0),
          failedLogins: Number(failedLogins24h.rows[0]?.total || 0),
          criticalSecurityEvents: Number(criticalEvents24h.rows[0]?.total || 0),
          auditActions: Number(auditActions24h.rows[0]?.total || 0),
        },
        activeStaffCount: Number(activeUsers.rows[0]?.total || 0),
        bannedIpCount: Number(bannedCount.rows[0]?.total || 0),
        topFailedLoginIps: topFailedIps.rows,
        recentLockouts: recentLockouts.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── IP Banning & Access Control ──────────────────────────────────
router.get('/ip-bans', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const bans = await getBannedIps();
    return sendJson(res, 200, { data: bans });
  } catch (err) {
    next(err);
  }
});

router.post('/ip-bans', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const ip = getClientIp(req);
    assertPlainObject(req.body);
    const { ipAddress, reason, expiresAt } = req.body;
    if (!ipAddress || typeof ipAddress !== 'string' || !ipAddress.trim()) {
      return sendError(res, 422, 'IP address is required');
    }

    const saved = await banIp({
      ipAddress: ipAddress.trim(),
      reason: reason ? String(reason).trim() : 'Banned by administrator',
      bannedBy: req.user.username,
      expiresAt: expiresAt || null,
    });

    writeSecurityEvent({
      eventType: SECURITY_EVENT.IP_BANNED,
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      ipAddress: ip,
      requestId: req.requestId,
      description: `IP address ${saved.ipAddress} banned by ${req.user.username} (${req.user.role}). Reason: ${saved.reason}`,
      metadata: { bannedIp: saved.ipAddress, reason: saved.reason, expiresAt: saved.expiresAt },
    });

    writeAuditLog({
      requestId: req.requestId,
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      action: AUDIT_ACTION.CREATE,
      resource: 'banned_ips',
      resourceId: saved.ipAddress,
      summary: `Banned IP ${saved.ipAddress}: ${saved.reason}`,
      ipAddress: ip,
    });

    return sendJson(res, 201, {
      success: true,
      message: `IP ${saved.ipAddress} has been banned`,
      data: saved,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/ip-bans/:ip', async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const ip = getClientIp(req);
    const targetIp = decodeURIComponent(req.params.ip || '').trim();
    if (!targetIp) return sendError(res, 422, 'IP address is required');

    await unbanIp(targetIp);

    writeSecurityEvent({
      eventType: SECURITY_EVENT.IP_UNBANNED,
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      ipAddress: ip,
      requestId: req.requestId,
      description: `IP address ${targetIp} unbanned by ${req.user.username} (${req.user.role})`,
      metadata: { unbannedIp: targetIp },
    });

    writeAuditLog({
      requestId: req.requestId,
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      action: AUDIT_ACTION.DELETE,
      resource: 'banned_ips',
      resourceId: targetIp,
      summary: `Unbanned IP ${targetIp}`,
      ipAddress: ip,
    });

    return sendJson(res, 200, {
      success: true,
      message: `IP ${targetIp} has been unbanned`,
    });
  } catch (err) {
    next(err);
  }
});

// ── Clinic Profile ────────────────────────────────────────────────
router.get('/clinic-profile', async (req, res, next) => {
  try {
    const result = await query("SELECT * FROM clinic_profile WHERE id = 'main' LIMIT 1");
    return sendJson(res, 200, { data: result.rows[0] || null });
  } catch (err) {
    next(err);
  }
});

router.patch('/clinic-profile', async (req, res, next) => {
  try {
    assertPlainObject(req.body);
    const PROFILE_FIELDS = new Set([
      'name', 'tagline', 'address', 'phone', 'email', 'website',
      'logo_url', 'working_hours', 'emergency_line', 'accreditation',
      'bed_capacity', 'founded_year',
    ]);
    const sets = [];
    const values = [];
    const param = v => { values.push(v); return `$${values.length}`; };

    for (const [key, value] of Object.entries(req.body)) {
      if (!PROFILE_FIELDS.has(key) || value === undefined || value === null) continue;
      sets.push(`${key} = ${param(key === 'bed_capacity' || key === 'founded_year' ? Number(value) : String(value).trim())}`);
    }
    if (!sets.length) return sendError(res, 422, 'No valid clinic profile fields provided');

    sets.push(`updated_by = ${param(req.user.username)}`);
    values.push('main');

    await query(
      `UPDATE clinic_profile SET ${sets.join(', ')} WHERE id = $${values.length}`,
      values,
    );

    writeAuditLog({
      requestId: req.requestId,
      userId: req.user.id,
      username: req.user.username,
      userRole: req.user.role,
      action: AUDIT_ACTION.UPDATE,
      resource: 'clinic_profile',
      resourceId: 'main',
      summary: `Admin updated clinic profile (${sets.length - 1} field(s))`,
      ipAddress: getClientIp(req),
    });

    const updated = await query("SELECT * FROM clinic_profile WHERE id = 'main' LIMIT 1");
    return sendJson(res, 200, { message: 'Clinic profile updated', data: updated.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Legacy handler export for backward compatibility
export async function adminHandler(request, response, segments, url) {
  if (!requireAdmin(request, response)) return;
  if (!checkAdminRateLimit(request, response)) return;

  const section = segments[2];

  if (section === 'login-background') {
    if (request.method === 'GET') {
      const result = await query("SELECT value FROM system_config WHERE key = 'login_background_image' LIMIT 1");
      return sendJson(response, 200, { data: { image: result.rows[0]?.value || null } });
    }
    if (request.method === 'PATCH') {
      assertPlainObject(request.body);
      const image = request.body.image === null ? '' : request.body.image;
      if (typeof image !== 'string') {
        const error = new Error('Login background image must be an uploaded image or null.');
        error.statusCode = 422;
        throw error;
      }
      if (image) validateLoginBackgroundImage(image);
      await query(
        `INSERT INTO system_config (key, value, description, updated_by)
         VALUES ('login_background_image', $1, 'Administrator-selected image shown behind the login screen', $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [image, request.user.username],
      );
      writeAuditLog({
        requestId: request.requestId, userId: request.user.id, username: request.user.username,
        userRole: request.user.role, action: AUDIT_ACTION.CONFIG, resource: 'system_config',
        resourceId: 'login_background_image',
        summary: image ? 'Administrator changed the login page background image' : 'Administrator restored the default login page background',
        ipAddress: getClientIp(request),
      });
      invalidateSystemConfig();
      return sendJson(response, 200, { message: image ? 'Login background updated' : 'Default login background restored', data: { image: image || null } });
    }
    return sendError(response, 405, 'Method not allowed');
  }

  if (section === 'default-password') {
    if (request.method === 'GET') {
      const result = await query(
        `SELECT key, value FROM system_config
         WHERE key IN ('default_user_password_hash', 'default_user_password_enc')`,
      );
      const hashRow = result.rows.find(row => row.key === 'default_user_password_hash');
      const sealedRow = result.rows.find(row => row.key === 'default_user_password_enc');
      return sendJson(response, 200, {
        configured: Boolean(hashRow?.value),
        password: openSecret(sealedRow?.value),
      });
    }
    if (request.method === 'POST') {
      assertPlainObject(request.body);
      validatePassword(request.body.password, 'Default password');
      const plainPassword = String(request.body.password);
      await query(
        `INSERT INTO system_config (key, value, description, updated_by)
         VALUES ('default_user_password_hash', $1, 'Hashed temporary password assigned to newly created staff accounts', $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [hashPassword(plainPassword), request.user.username],
      );
      await query(
        `INSERT INTO system_config (key, value, description, updated_by)
         VALUES ('default_user_password_enc', $1, 'Sealed (AES-256-GCM) copy of the default staff password shown to administrators', $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [sealSecret(plainPassword), request.user.username],
      );
      writeAuditLog({
        requestId: request.requestId, userId: request.user.id, username: request.user.username,
        userRole: request.user.role, action: AUDIT_ACTION.CONFIG, resource: 'system_config',
        resourceId: 'default_user_password_hash', summary: 'Administrator updated the default staff password',
        ipAddress: getClientIp(request),
      });
      invalidateSystemConfig();
      return sendJson(response, 200, { message: 'Default staff password updated', configured: true });
    }
    return sendError(response, 405, 'Method not allowed');
  }

  if (section === 'backup') {
    const action = segments[3];
    const ip = getClientIp(request);

    if (request.method === 'GET' && !action) {
      const queryParams = url?.searchParams || {};
      const includeUsers = queryParams.get ? queryParams.get('includeUsers') !== 'false' : true;
      const includeAudit = queryParams.get ? queryParams.get('includeAudit') === 'true' : false;
      const backup = await createBackup({ includeUsers, includeAudit });
      const filename = `bruclinic-backup-${backup.createdAt.replace(/[:.]/g, '-').slice(0, 19)}.json`;

      writeAuditLog({
        requestId: request.requestId, userId: request.user.id, username: request.user.username,
        userRole: request.user.role, action: AUDIT_ACTION.BACKUP, resource: 'backup',
        summary: `Downloaded backup (${Object.values(backup.counts).reduce((a, b) => a + b, 0)} rows, users: ${includeUsers ? 'included' : 'excluded'})`,
        ipAddress: ip,
      });
      writeSecurityEvent({
        eventType: SECURITY_EVENT.BACKUP_CREATED, userId: request.user.id, username: request.user.username,
        userRole: request.user.role, ipAddress: ip, requestId: request.requestId,
        description: `Data backup downloaded by ${request.user.username} (${request.user.role})`,
        metadata: { counts: backup.counts, includeUsers, includeAudit, checksum: backup.checksum, actorRole: request.user.role },
      });
      await recordBackupRun({
        kind: 'export', actorId: request.user.id, actor: request.user.username,
        filename, checksum: backup.checksum, counts: backup.counts,
      });

      return sendDownload(response, backup, filename);
    }

    if (request.method === 'GET' && action === 'tables') {
      return sendJson(response, 200, {
        data: await getTableStats(),
        history: await listBackupRuns(5),
      });
    }

    if (request.method === 'GET' && action === 'history') {
      const queryParams = url?.searchParams || {};
      const limit = Number.parseInt((queryParams.get ? queryParams.get('limit') : null) || '25', 10);
      return sendJson(response, 200, { data: await listBackupRuns(limit) });
    }

    if (request.method === 'POST' && action === 'restore') {
      assertPlainObject(request.body);
      const { backup, mode = 'merge', dryRun = false, confirm } = request.body;
      const restoreMode = mode === 'replace' ? 'replace' : 'merge';

      if (restoreMode === 'replace' && String(confirm || '').trim().toUpperCase() !== 'REPLACE') {
        return sendError(response, 422, 'Type REPLACE to confirm a full restore of this database');
      }

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
          requestId: request.requestId, userId: request.user.id, username: request.user.username,
          userRole: request.user.role, action: AUDIT_ACTION.RESTORE, resource: 'backup',
          summary: `Restored database from backup (${restoreMode} mode)`,
          changes: { counts: { from: null, to: validated.counts } }, ipAddress: ip,
        });
        writeSecurityEvent({
          eventType: SECURITY_EVENT.BACKUP_IMPORTED, userId: request.user.id, username: request.user.username,
          userRole: request.user.role, ipAddress: ip, requestId: request.requestId,
          description: `Database restored from backup by ${request.user.username} (${request.user.role}) (${restoreMode} mode)`,
          metadata: { counts: validated.counts, checksum: validated.checksum, actorRole: request.user.role },
        });
      }

      return sendJson(response, 200, {
        message: dryRun ? 'Restore validated successfully — no changes were written' : 'Backup restored successfully',
        data: result,
      });
    }

    return sendError(response, 404, 'Backup route not found');
  }

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
      `SELECT se.*, COALESCE(u.role, se.metadata->>'userRole') AS user_role FROM security_events se
       LEFT JOIN users u ON se.user_id = u.id
       ${where} ORDER BY se.created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
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

  if (request.method === 'GET' && section === 'config') {
    const rows = await query("SELECT key, value, description, updated_by, updated_at FROM system_config WHERE key NOT IN ('default_user_password_hash', 'login_background_image') ORDER BY key ASC");
    return sendJson(response, 200, { data: rows.rows });
  }

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

    writeAuditLog({
      requestId: request.requestId, userId: request.user.id, username: request.user.username,
      userRole: request.user.role, action: AUDIT_ACTION.CONFIG, resource: 'system_config',
      summary: `Admin updated ${updates.length} config key(s)`,
      changes: changesLog, ipAddress: getClientIp(request),
    });

    writeSecurityEvent({
      eventType: SECURITY_EVENT.CONFIG_CHANGED, userId: request.user.id, username: request.user.username,
      ipAddress: getClientIp(request), requestId: request.requestId,
      description: `System config updated: ${Object.keys(changesLog).join(', ')}`,
      metadata: changesLog,
    });

    invalidateSystemConfig();

    const updatedRows = await query("SELECT key, value, description, updated_by, updated_at FROM system_config WHERE key NOT IN ('default_user_password_hash', 'login_background_image') ORDER BY key ASC");
    return sendJson(response, 200, { message: 'Configuration updated', data: updatedRows.rows });
  }

  if (request.method === 'GET' && section === 'stats') {
    const [
      totalLogins, failedLogins24h, criticalEvents24h, auditActions24h,
      topFailedIps, recentLockouts, activeUsers, bannedCount,
    ] = await Promise.all([
      query(`SELECT COUNT(*) AS total FROM security_events WHERE event_type = 'AUTH_LOGIN_SUCCESS' AND created_at >= NOW() - INTERVAL '24 hours'`),
      query(`SELECT COUNT(*) AS total FROM security_events WHERE event_type = 'AUTH_LOGIN_FAILURE' AND created_at >= NOW() - INTERVAL '24 hours'`),
      query(`SELECT COUNT(*) AS total FROM security_events WHERE severity = 'critical' AND created_at >= NOW() - INTERVAL '24 hours'`),
      query(`SELECT COUNT(*) AS total FROM audit_logs WHERE created_at >= NOW() - INTERVAL '24 hours'`),
      query(`SELECT se.ip_address, COUNT(*) AS count,
                    EXISTS(SELECT 1 FROM banned_ips bi WHERE bi.ip_address = se.ip_address AND (bi.expires_at IS NULL OR bi.expires_at > NOW())) AS is_banned
             FROM security_events se
             WHERE se.event_type = 'AUTH_LOGIN_FAILURE' AND se.created_at >= NOW() - INTERVAL '24 hours'
             GROUP BY se.ip_address ORDER BY count DESC LIMIT 5`),
      query(`SELECT se.*,
                    EXISTS(SELECT 1 FROM banned_ips bi WHERE bi.ip_address = se.ip_address AND (bi.expires_at IS NULL OR bi.expires_at > NOW())) AS is_banned
             FROM security_events se
             WHERE se.event_type = 'AUTH_LOGIN_LOCKED' ORDER BY se.created_at DESC LIMIT 10`),
      query(`SELECT COUNT(*) AS total FROM users WHERE is_active = TRUE`),
      query(`SELECT COUNT(*) AS total FROM banned_ips WHERE expires_at IS NULL OR expires_at > NOW()`),
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
        bannedIpCount: Number(bannedCount.rows[0]?.total || 0),
        topFailedLoginIps: topFailedIps.rows,
        recentLockouts: recentLockouts.rows,
      },
    });
  }

  if (section === 'ip-bans') {
    const ip = getClientIp(request);
    if (request.method === 'GET') {
      const bans = await getBannedIps();
      return sendJson(response, 200, { data: bans });
    }

    if (request.method === 'POST') {
      assertPlainObject(request.body);
      const { ipAddress, reason, expiresAt } = request.body;
      if (!ipAddress || typeof ipAddress !== 'string' || !ipAddress.trim()) {
        return sendError(response, 422, 'IP address is required');
      }

      const saved = await banIp({
        ipAddress: ipAddress.trim(),
        reason: reason ? String(reason).trim() : 'Banned by administrator',
        bannedBy: request.user.username,
        expiresAt: expiresAt || null,
      });

      writeSecurityEvent({
        eventType: SECURITY_EVENT.IP_BANNED,
        userId: request.user.id,
        username: request.user.username,
        userRole: request.user.role,
        ipAddress: ip,
        requestId: request.requestId,
        description: `IP address ${saved.ipAddress} banned by ${request.user.username} (${request.user.role}). Reason: ${saved.reason}`,
        metadata: { bannedIp: saved.ipAddress, reason: saved.reason, expiresAt: saved.expiresAt },
      });

      writeAuditLog({
        requestId: request.requestId,
        userId: request.user.id,
        username: request.user.username,
        userRole: request.user.role,
        action: AUDIT_ACTION.CREATE,
        resource: 'banned_ips',
        resourceId: saved.ipAddress,
        summary: `Banned IP ${saved.ipAddress}: ${saved.reason}`,
        ipAddress: ip,
      });

      return sendJson(response, 201, {
        success: true,
        message: `IP ${saved.ipAddress} has been banned`,
        data: saved,
      });
    }

    if (request.method === 'DELETE') {
      const targetIp = decodeURIComponent(segments[3] || '').trim();
      if (!targetIp) return sendError(response, 422, 'IP address is required');

      await unbanIp(targetIp);

      writeSecurityEvent({
        eventType: SECURITY_EVENT.IP_UNBANNED,
        userId: request.user.id,
        username: request.user.username,
        userRole: request.user.role,
        ipAddress: ip,
        requestId: request.requestId,
        description: `IP address ${targetIp} unbanned by ${request.user.username} (${request.user.role})`,
        metadata: { unbannedIp: targetIp },
      });

      writeAuditLog({
        requestId: request.requestId,
        userId: request.user.id,
        username: request.user.username,
        userRole: request.user.role,
        action: AUDIT_ACTION.DELETE,
        resource: 'banned_ips',
        resourceId: targetIp,
        summary: `Unbanned IP ${targetIp}`,
        ipAddress: ip,
      });

      return sendJson(response, 200, {
        success: true,
        message: `IP ${targetIp} has been unbanned`,
      });
    }

    return sendError(response, 405, 'Method not allowed');
  }

  if (section === 'clinic-profile') {
    if (request.method === 'GET') {
      const result = await query("SELECT * FROM clinic_profile WHERE id = 'main' LIMIT 1");
      return sendJson(response, 200, { data: result.rows[0] || null });
    }

    if (request.method === 'PATCH') {
      assertPlainObject(request.body);
      const PROFILE_FIELDS = new Set([
        'name', 'tagline', 'address', 'phone', 'email', 'website',
        'logo_url', 'working_hours', 'emergency_line', 'accreditation',
        'bed_capacity', 'founded_year',
      ]);
      const sets = [];
      const values = [];
      const param = v => { values.push(v); return `$${values.length}`; };

      for (const [key, value] of Object.entries(request.body)) {
        if (!PROFILE_FIELDS.has(key) || value === undefined || value === null) continue;
        sets.push(`${key} = ${param(key === 'bed_capacity' || key === 'founded_year' ? Number(value) : String(value).trim())}`);
      }
      if (!sets.length) return sendError(response, 422, 'No valid clinic profile fields provided');

      sets.push(`updated_by = ${param(request.user.username)}`);
      values.push('main');

      await query(
        `UPDATE clinic_profile SET ${sets.join(', ')} WHERE id = $${values.length}`,
        values,
      );

      writeAuditLog({
        requestId: request.requestId, userId: request.user.id, username: request.user.username,
        userRole: request.user.role, action: AUDIT_ACTION.UPDATE, resource: 'clinic_profile',
        resourceId: 'main', summary: `Admin updated clinic profile (${sets.length - 1} field(s))`,
        ipAddress: getClientIp(request),
      });

      const updated = await query("SELECT * FROM clinic_profile WHERE id = 'main' LIMIT 1");
      return sendJson(response, 200, { message: 'Clinic profile updated', data: updated.rows[0] });
    }

    return sendError(response, 405, 'Method not allowed');
  }

  return sendError(response, 404, 'Admin route not found');
}

export default router;
export { router as adminRouter };
