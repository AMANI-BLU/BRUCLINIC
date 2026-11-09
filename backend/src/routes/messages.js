import { randomUUID } from 'node:crypto';
import { query } from '../db/pool.js';
import { sendError, sendJson } from '../utils/http.js';
import { assertPlainObject, validateText } from '../utils/validation.js';

export async function messagesHandler(request, response, segments) {
  const userId = request.user?.id;
  if (!userId) return sendError(response, 401, 'Authentication required');

  if (request.method === 'GET' && segments.length === 2) {
    const result = await query(
      `SELECT m.id, m.sender_id, m.recipient_id, m.body, m.read_at, m.created_at,
              s.name AS sender_name, s.role AS sender_role, s.role_title AS sender_role_title,
              r.name AS recipient_name, r.role AS recipient_role, r.role_title AS recipient_role_title
       FROM user_messages m
       JOIN users s ON s.id = m.sender_id
       JOIN users r ON r.id = m.recipient_id
       WHERE m.sender_id = $1 OR m.recipient_id = $1
       ORDER BY m.created_at ASC LIMIT 500`,
      [userId],
    );
    return sendJson(response, 200, { data: result.rows });
  }

  if (request.method === 'GET' && segments[2] === 'unread-count') {
    const result = await query(
      `SELECT COUNT(*)::int AS count FROM user_messages WHERE recipient_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return sendJson(response, 200, { count: result.rows[0]?.count || 0 });
  }

  if (request.method === 'POST' && segments.length === 2) {
    assertPlainObject(request.body);
    validateText(request.body.recipientId, 'Recipient', { required: true, max: 64 });
    validateText(request.body.body, 'Message', { required: true, max: 2000 });
    if (request.body.recipientId === userId) return sendError(response, 422, 'Choose another staff member');
    const recipient = await query(
      'SELECT id, name, role, role_title FROM users WHERE id = $1 AND is_active = TRUE LIMIT 1',
      [request.body.recipientId],
    );
    if (!recipient.rows[0]) return sendError(response, 404, 'Recipient is not an active staff account');
    const id = `MSG-${randomUUID().slice(0, 12).toUpperCase()}`;
    const inserted = await query(
      `INSERT INTO user_messages (id, sender_id, recipient_id, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_id, recipient_id, body, read_at, created_at`,
      [id, userId, request.body.recipientId, String(request.body.body).trim()],
    );
    const row = inserted.rows[0];
    row.sender_name = request.user?.name || 'Staff';
    row.sender_role = request.user?.role || 'staff';
    row.recipient_name = recipient.rows[0].name;
    row.recipient_role = recipient.rows[0].role;
    return sendJson(response, 201, { data: row });
  }

  if (request.method === 'PATCH' && segments[2] === 'read-all' && segments[3]) {
    const partnerId = segments[3];
    await query(
      `UPDATE user_messages SET read_at = COALESCE(read_at, NOW())
       WHERE recipient_id = $1 AND sender_id = $2 AND read_at IS NULL`,
      [userId, partnerId],
    );
    return sendJson(response, 200, { message: 'All messages marked as read' });
  }

  if (request.method === 'PATCH' && segments[2] && segments[3] === 'read') {
    const result = await query(
      `UPDATE user_messages SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND recipient_id = $2 RETURNING id`,
      [segments[2], userId],
    );
    if (!result.rows.length) return sendError(response, 404, 'Message not found');
    return sendJson(response, 200, { message: 'Message marked as read' });
  }

  if (request.method === 'DELETE' && segments[2]) {
    const result = await query(
      `DELETE FROM user_messages WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2) RETURNING id`,
      [segments[2], userId],
    );
    if (!result.rows.length) return sendError(response, 404, 'Message not found or not permitted');
    return sendJson(response, 200, { message: 'Message deleted' });
  }

  return sendError(response, 404, 'Messages route not found');
}
