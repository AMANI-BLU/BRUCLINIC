/**
 * BruClinic — Authentication Routes
 *
 * Handles all /api/auth/* endpoints:
 *   POST   /api/auth/login                       — credential login
 *   GET    /api/auth/me                          — validate session
 *   GET    /api/auth/users                       — list staff (admin)
 *   POST   /api/auth/create-user                 — create staff account (admin)
 *   PATCH  /api/auth/users/:id                   — update staff profile (admin)
 *   PATCH  /api/auth/users/:id/status            — activate/deactivate (admin)
 *   POST   /api/auth/users/:id/reset-password    — reset password (admin)
 *   DELETE /api/auth/users/:id                   — delete account (admin)
 *
 * Security features:
 *   - Per-IP + per-username auth rate limiting (via rateLimiter middleware)
 *   - All significant actions are recorded to security_events and audit_logs
 *   - Timing-safe password comparison
 *   - JWT tokens with issuer/audience claims
 */

import { randomUUID } from 'node:crypto';
import { query } from '../db/pool.js';
import { generateToken, hashPassword, verifyPassword } from '../utils/auth.js';
import { sendError, sendJson } from '../utils/http.js';
import { assertPlainObject, validateEmail, validatePassword, validateText } from '../utils/validation.js';
import { writeAuditLog, writeSecurityEvent } from '../middleware/auditLogger.js';
import { checkAuthRateLimit, clearAuthRateLimit, getClientIp } from '../middleware/rateLimiter.js';
import { AUDIT_ACTION, SECURITY_EVENT } from '../constants/events.js';
import { getConfigNumber } from '../services/systemConfig.js';
import {
  ALL_ROLES, ROLE_BADGE_COLORS, ROLE_DEPARTMENTS, ROLE_LABELS,
} from '../constants/roles.js';

// ── Helpers ──────────────────────────────────────────────────────

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1
    ? `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase()
    : (parts[0]?.slice(0, 2) || 'U').toUpperCase();
}

function toProfile(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    roleTitle: user.role_title,
    department: user.department,
    email: user.email,
    avatarInitials: user.avatar_initials,
    badgeColor: user.badge_color,
    isActive: user.is_active === undefined ? Boolean(user.isActive) : Boolean(user.is_active),
    createdAt: user.created_at || user.createdAt,
  };
}

function requireAdmin(request, response) {
  if (!request.user || request.user.role !== 'admin') {
    // Record the attempt
    writeSecurityEvent({
      eventType: SECURITY_EVENT.ACCESS_DENIED,
      userId: request.user?.id,
      username: request.user?.username,
      ipAddress: getClientIp(request),
      requestId: request.requestId,
      description: `Non-admin tried to access admin auth route: ${request.url}`,
      metadata: { role: request.user?.role },
    });
    sendError(response, 403, 'Permission denied: administrator access is required');
    return false;
  }
  return true;
}

// ── Route Handler ─────────────────────────────────────────────────

export async function authHandler(request, response, segments) {
  const action = segments[2];
  const targetId = segments[3];
  const subAction = segments[4];
  const ip = getClientIp(request);

  // ── POST /api/auth/login ──────────────────────────────────────
  if (request.method === 'POST' && action === 'login') {
    assertPlainObject(request.body);
    const { username, password } = request.body || {};
    validateText(username, 'Username', { required: true, max: 60 });
    validateText(password, 'Password', { required: true, max: 128 });

    // Lockout policy is administrator-editable at runtime (system_config).
    const maxAttempts = await getConfigNumber('max_login_attempts', 8, { min: 3, max: 20 });
    const lockoutMinutes = await getConfigNumber('login_lockout_minutes', 15, { min: 5, max: 60 });
    const rateCheck = checkAuthRateLimit(ip, username, { max: maxAttempts, windowMs: lockoutMinutes * 60 * 1000 });
    if (!rateCheck.allowed) {
      writeSecurityEvent({
        eventType: SECURITY_EVENT.LOGIN_LOCKED,
        username: String(username).trim().toLowerCase(),
        ipAddress: ip,
        requestId: request.requestId,
        description: `Login locked out for ${lockoutMinutes} minutes after ${maxAttempts} attempts: ${String(username).trim()}`,
        metadata: { maxAttempts, lockoutMinutes, retryAfterSeconds: rateCheck.retryAfterSeconds },
      });
      response.setHeader('Retry-After', String(rateCheck.retryAfterSeconds));
      return sendError(response, 429, 'Too many sign-in attempts. Try again later.');
    }

    const result = await query('SELECT * FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1', [String(username).trim()]);
    const user = result.rows[0];

    if (!user || !user.is_active || !verifyPassword(String(password), user.password_hash)) {
      const isDeactivated = user && !user.is_active;
      writeSecurityEvent({
        eventType: SECURITY_EVENT.LOGIN_FAILURE,
        username: String(username).trim().toLowerCase(),
        userId: user?.id || null,
        ipAddress: ip,
        requestId: request.requestId,
        description: isDeactivated
          ? `Login attempt on deactivated account: ${String(username).trim()}`
          : `Invalid credentials for: ${String(username).trim()}`,
        metadata: { deactivated: isDeactivated },
      });

      return sendError(
        response,
        isDeactivated ? 403 : 401,
        isDeactivated ? 'This staff account has been deactivated.' : 'Invalid username or password',
      );
    }

    // Login successful
    clearAuthRateLimit(ip, username);
    const profile = toProfile(user);

    writeSecurityEvent({
      eventType: SECURITY_EVENT.LOGIN_SUCCESS,
      userId: user.id,
      username: user.username,
      ipAddress: ip,
      requestId: request.requestId,
      description: `Successful login: ${user.username} (${user.role})`,
    });
    writeAuditLog({
      requestId: request.requestId,
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: AUDIT_ACTION.LOGIN,
      resource: 'users',
      resourceId: user.id,
      summary: `Staff login: ${user.name} (${user.role})`,
      ipAddress: ip,
    });

    const sessionHours = await getConfigNumber('session_timeout_hours', 8, { min: 1, max: 72 });
    return sendJson(response, 200, {
      message: 'Login successful',
      token: generateToken(profile, { ttlSeconds: sessionHours * 60 * 60 }),
      user: profile,
      expiresInSeconds: sessionHours * 60 * 60,
    });
  }

  // ── GET /api/auth/me ─────────────────────────────────────────
  if (request.method === 'GET' && action === 'me') {
    if (!request.user) {
      writeSecurityEvent({
        eventType: SECURITY_EVENT.INVALID_TOKEN,
        ipAddress: ip,
        requestId: request.requestId,
        description: 'Unauthenticated /me request',
      });
      return sendError(response, 401, 'Authentication required');
    }
    const result = await query('SELECT * FROM users WHERE id = $1 LIMIT 1', [request.user.id]);
    if (!result.rows[0] || !result.rows[0].is_active) {
      writeSecurityEvent({
        eventType: SECURITY_EVENT.SESSION_EXPIRED,
        userId: request.user.id,
        username: request.user.username,
        ipAddress: ip,
        requestId: request.requestId,
        description: `Session invalidated — account deactivated or deleted: ${request.user.username}`,
      });
      return sendError(response, 401, 'Session is no longer valid');
    }
    return sendJson(response, 200, { user: toProfile(result.rows[0]) });
  }

  // ── GET /api/auth/users ──────────────────────────────────────
  if (request.method === 'GET' && action === 'users' && !targetId) {
    if (!requireAdmin(request, response)) return;
    const result = await query('SELECT * FROM users ORDER BY created_at ASC');
    return sendJson(response, 200, { data: result.rows.map(toProfile), total: result.rows.length });
  }

  // ── POST /api/auth/create-user ───────────────────────────────
  if (request.method === 'POST' && action === 'create-user') {
    if (!requireAdmin(request, response)) return;
    assertPlainObject(request.body);
    const { name, username, password, role, roleTitle, department, email } = request.body || {};
    validateText(name, 'Name', { required: true, max: 150 });
    validateText(username, 'Username', { required: true, max: 60 });
    validatePassword(password);
    validateText(role, 'Role', { required: true, max: 20 });
    validateText(roleTitle, 'Role title', { max: 100 });
    validateText(department, 'Department', { max: 150 });
    validateEmail(email);
    if (!ALL_ROLES.includes(role)) {
      return sendError(response, 422, `Invalid role. Allowed: ${ALL_ROLES.join(', ')}`);
    }
    const normalizedUsername = String(username).trim().toLowerCase();
    const existing = await query('SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1', [normalizedUsername]);
    if (existing.rows.length) return sendError(response, 409, `An account with username '${username}' already exists`);

    const id = `USR-${randomUUID().slice(0, 8).toUpperCase()}`;
    const cleanName = String(name).trim();
    const safeEmail = String(email || `${normalizedUsername}@boru.edu.et`).trim().toLowerCase();
    const profile = {
      id, username: normalizedUsername, name: cleanName, role,
      roleTitle: String(roleTitle || ROLE_LABELS[role] || role).trim(),
      department: String(department || ROLE_DEPARTMENTS[role] || 'Clinical Services').trim(),
      email: safeEmail,
      avatarInitials: getInitials(cleanName),
      badgeColor: ROLE_BADGE_COLORS[role] || '#2563eb',
      isActive: true,
    };
    await query(
      `INSERT INTO users (id, username, password_hash, name, role, role_title, department, email, avatar_initials, badge_color, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)`,
      [id, profile.username, hashPassword(String(password)), profile.name, profile.role, profile.roleTitle, profile.department, profile.email, profile.avatarInitials, profile.badgeColor],
    );

    // Auto-create doctor record for OPD physicians
    if (role === 'opd') {
      const nameParts = cleanName.replace(/^(Dr\.?|Doctor)\s+/i, '').trim().split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] ? `Dr. ${nameParts[0]}` : 'Dr.';
      const lastName = nameParts.slice(1).join(' ') || 'Clinician';
      const specialization = profile.roleTitle || profile.department || 'General Practice';
      const schedule = JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
      await query(
        `INSERT INTO doctors (id, first_name, last_name, specialization, email, phone, gender, available, schedule)
         VALUES ($1, $2, $3, $4, $5, '', 'Male', TRUE, $6)
         ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, specialization = EXCLUDED.specialization, email = EXCLUDED.email, available = TRUE, updated_at = NOW()`,
        [id, firstName, lastName, specialization, safeEmail, schedule],
      );
    }

    writeSecurityEvent({
      eventType: SECURITY_EVENT.ACCOUNT_CREATED,
      userId: request.user.id,
      username: request.user.username,
      ipAddress: ip,
      requestId: request.requestId,
      description: `New staff account created: ${cleanName} (${role}) by ${request.user.username}`,
      metadata: { newUserId: id, newRole: role },
    });
    writeAuditLog({
      requestId: request.requestId,
      userId: request.user.id,
      username: request.user.username,
      userRole: request.user.role,
      action: AUDIT_ACTION.CREATE,
      resource: 'users',
      resourceId: id,
      summary: `Created staff account: ${cleanName} (${role})`,
      ipAddress: ip,
    });

    return sendJson(response, 201, { message: `Staff account created successfully for ${cleanName}`, user: profile });
  }

  // ── PATCH /api/auth/users/:id/status ────────────────────────
  if (request.method === 'PATCH' && action === 'users' && targetId && subAction === 'status') {
    if (!requireAdmin(request, response)) return;
    const { isActive } = request.body || {};
    if (targetId === request.user.id && !isActive) {
      return sendError(response, 400, 'You cannot deactivate your own administrative account');
    }
    const result = await query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2', [Boolean(isActive), targetId]);
    if (!result.affectedRows) return sendError(response, 404, 'Staff account not found');
    await query('UPDATE doctors SET available = $1, updated_at = NOW() WHERE id = $2', [Boolean(isActive), targetId]);

    const eventType = isActive ? SECURITY_EVENT.ACCOUNT_REACTIVATED : SECURITY_EVENT.ACCOUNT_DEACTIVATED;
    writeSecurityEvent({
      eventType,
      userId: request.user.id,
      username: request.user.username,
      ipAddress: ip,
      requestId: request.requestId,
      description: `Account ${isActive ? 'activated' : 'deactivated'}: ID=${targetId} by ${request.user.username}`,
      metadata: { targetId, isActive: Boolean(isActive) },
    });
    writeAuditLog({
      requestId: request.requestId,
      userId: request.user.id,
      username: request.user.username,
      userRole: request.user.role,
      action: AUDIT_ACTION.UPDATE,
      resource: 'users',
      resourceId: targetId,
      summary: `Account status changed: ${isActive ? 'ACTIVATED' : 'DEACTIVATED'} (ID: ${targetId})`,
      changes: { is_active: { from: !isActive, to: Boolean(isActive) } },
      ipAddress: ip,
    });

    return sendJson(response, 200, { message: 'Staff status updated successfully', isActive: Boolean(isActive) });
  }

  // ── POST /api/auth/users/:id/reset-password ──────────────────
  if (request.method === 'POST' && action === 'users' && targetId && subAction === 'reset-password') {
    if (!requireAdmin(request, response)) return;
    assertPlainObject(request.body);
    const { newPassword } = request.body || {};
    validatePassword(newPassword, 'New password');
    const result = await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hashPassword(String(newPassword)), targetId]);
    if (!result.affectedRows) return sendError(response, 404, 'Staff account not found');

    writeSecurityEvent({
      eventType: SECURITY_EVENT.PASSWORD_RESET,
      userId: request.user.id,
      username: request.user.username,
      ipAddress: ip,
      requestId: request.requestId,
      description: `Password reset for account ID=${targetId} by ${request.user.username}`,
      metadata: { targetId },
    });
    writeAuditLog({
      requestId: request.requestId,
      userId: request.user.id,
      username: request.user.username,
      userRole: request.user.role,
      action: AUDIT_ACTION.UPDATE,
      resource: 'users',
      resourceId: targetId,
      summary: `Password reset for account ID: ${targetId}`,
      ipAddress: ip,
    });

    return sendJson(response, 200, { message: 'Password reset successfully' });
  }

  // ── PATCH /api/auth/users/:id ────────────────────────────────
  if (request.method === 'PATCH' && action === 'users' && targetId && !subAction) {
    if (!requireAdmin(request, response)) return;
    const { name, role, roleTitle, department, email } = request.body || {};
    if (role && !ALL_ROLES.includes(role)) return sendError(response, 422, 'Invalid staff role');
    const fields = { name, role, role_title: roleTitle, department, email };
    const updates = []; const values = [];
    for (const [column, value] of Object.entries(fields)) {
      if (value !== undefined && value !== '') {
        values.push(String(value).trim());
        updates.push(`${column} = $${values.length}`);
      }
    }
    if (!updates.length) return sendError(response, 422, 'No profile changes were provided');
    values.push(targetId);
    const result = await query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`, values);
    if (!result.affectedRows) return sendError(response, 404, 'Staff account not found');
    const updated = await query('SELECT * FROM users WHERE id = $1', [targetId]);
    const updatedRow = updated.rows[0];

    // Sync doctor record for OPD staff
    if (updatedRow?.role === 'opd') {
      const nameParts = String(updatedRow.name || '').replace(/^(Dr\.?|Doctor)\s+/i, '').trim().split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] ? `Dr. ${nameParts[0]}` : 'Dr.';
      const lastName = nameParts.slice(1).join(' ') || 'Clinician';
      const spec = updatedRow.role_title || updatedRow.department || 'General Practice';
      await query(
        `INSERT INTO doctors (id, first_name, last_name, specialization, email, phone, gender, available, schedule)
         VALUES ($1, $2, $3, $4, $5, '', 'Male', $6, $7)
         ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, specialization = EXCLUDED.specialization, email = EXCLUDED.email, available = EXCLUDED.available, updated_at = NOW()`,
        [targetId, firstName, lastName, spec, updatedRow.email || '', Boolean(updatedRow.is_active), JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])],
      );
    }

    writeSecurityEvent({
      eventType: SECURITY_EVENT.PROFILE_UPDATED,
      userId: request.user.id,
      username: request.user.username,
      ipAddress: ip,
      requestId: request.requestId,
      description: `Profile updated for account ID=${targetId} by ${request.user.username}`,
    });
    writeAuditLog({
      requestId: request.requestId,
      userId: request.user.id,
      username: request.user.username,
      userRole: request.user.role,
      action: AUDIT_ACTION.UPDATE,
      resource: 'users',
      resourceId: targetId,
      summary: `Staff profile updated: ID=${targetId}`,
      changes: Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== '')),
      ipAddress: ip,
    });

    return sendJson(response, 200, { message: 'Staff profile updated', user: toProfile(updatedRow) });
  }

  // ── DELETE /api/auth/users/:id ───────────────────────────────
  if (request.method === 'DELETE' && action === 'users' && targetId) {
    if (!requireAdmin(request, response)) return;
    if (targetId === request.user.id) return sendError(response, 400, 'You cannot delete your own administrative account');
    const target = await query('SELECT username, name, role FROM users WHERE id = $1 LIMIT 1', [targetId]);
    await query('UPDATE queue_items SET assigned_doctor_id = NULL WHERE assigned_doctor_id = $1', [targetId]);
    await query('DELETE FROM doctors WHERE id = $1', [targetId]);
    const result = await query('DELETE FROM users WHERE id = $1', [targetId]);
    if (!result.affectedRows) return sendError(response, 404, 'Staff account not found');

    writeSecurityEvent({
      eventType: SECURITY_EVENT.ACCOUNT_DELETED,
      userId: request.user.id,
      username: request.user.username,
      ipAddress: ip,
      requestId: request.requestId,
      description: `Staff account deleted: ${target.rows[0]?.name} (${target.rows[0]?.role}) by ${request.user.username}`,
      metadata: { deletedId: targetId, deletedUsername: target.rows[0]?.username },
    });
    writeAuditLog({
      requestId: request.requestId,
      userId: request.user.id,
      username: request.user.username,
      userRole: request.user.role,
      action: AUDIT_ACTION.DELETE,
      resource: 'users',
      resourceId: targetId,
      summary: `Staff account deleted: ${target.rows[0]?.name} (ID: ${targetId})`,
      ipAddress: ip,
    });

    return sendJson(response, 200, { message: 'Staff account deleted successfully' });
  }

  return sendError(response, 404, 'Auth route not found');
}
