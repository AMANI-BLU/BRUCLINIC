import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { query } from '../db/pool.js';
import { sendError, sendJson } from '../utils/http.js';
import { assertPlainObject, validateText } from '../utils/validation.js';

const router = Router();

async function updatePresence(userId) {
  if (userId) {
    await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1 AND is_active = TRUE', [userId]);
  }
}

// GET /api/messages — list messages involving the current user
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Authentication required');
    await updatePresence(userId);

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
    return sendJson(res, 200, { data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/messages/unread-count
router.get('/unread-count', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Authentication required');
    await updatePresence(userId);

    const result = await query(
      `SELECT COUNT(*)::int AS count FROM user_messages WHERE recipient_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return sendJson(res, 200, { count: result.rows[0]?.count || 0 });
  } catch (err) {
    next(err);
  }
});

// POST /api/messages — send new message
router.post('/', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Authentication required');
    await updatePresence(userId);

    assertPlainObject(req.body);
    validateText(req.body.recipientId, 'Recipient', { required: true, max: 64 });
    validateText(req.body.body, 'Message', { required: true, max: 2000 });
    if (req.body.recipientId === userId) return sendError(res, 422, 'Choose another staff member');
    const recipient = await query(
      'SELECT id, name, role, role_title FROM users WHERE id = $1 AND is_active = TRUE LIMIT 1',
      [req.body.recipientId],
    );
    if (!recipient.rows[0]) return sendError(res, 404, 'Recipient is not an active staff account');
    const id = `MSG-${randomUUID().slice(0, 12).toUpperCase()}`;
    const inserted = await query(
      `INSERT INTO user_messages (id, sender_id, recipient_id, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_id, recipient_id, body, read_at, created_at`,
      [id, userId, req.body.recipientId, String(req.body.body).trim()],
    );
    const row = inserted.rows[0];
    row.sender_name = req.user?.name || 'Staff';
    row.sender_role = req.user?.role || 'staff';
    row.recipient_name = recipient.rows[0].name;
    row.recipient_role = recipient.rows[0].role;
    return sendJson(res, 201, { data: row });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/messages/read-all/:partnerId
router.patch('/read-all/:partnerId', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Authentication required');
    await updatePresence(userId);

    const partnerId = req.params.partnerId;
    await query(
      `UPDATE user_messages SET read_at = COALESCE(read_at, NOW())
       WHERE recipient_id = $1 AND sender_id = $2 AND read_at IS NULL`,
      [userId, partnerId],
    );
    return sendJson(res, 200, { message: 'All messages marked as read' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/messages/:id/read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Authentication required');
    await updatePresence(userId);

    const result = await query(
      `UPDATE user_messages SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND recipient_id = $2 RETURNING id`,
      [req.params.id, userId],
    );
    if (!result.rows.length) return sendError(res, 404, 'Message not found');
    return sendJson(res, 200, { message: 'Message marked as read' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/messages/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Authentication required');
    await updatePresence(userId);

    const result = await query(
      `DELETE FROM user_messages WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2) RETURNING id`,
      [req.params.id, userId],
    );
    if (!result.rows.length) return sendError(res, 404, 'Message not found or not permitted');
    return sendJson(res, 200, { message: 'Message deleted' });
  } catch (err) {
    next(err);
  }
});

// Legacy handler export for backward compatibility
export async function messagesHandler(request, response, segments) {
  const userId = request.user?.id;
  if (!userId) return sendError(response, 401, 'Authentication required');
  await updatePresence(userId);

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

export default router;
export { router as messagesRouter };
