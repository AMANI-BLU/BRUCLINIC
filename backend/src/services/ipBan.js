/**
 * BruClinic — IP Ban Service
 *
 * Provides persistent IP banning with fast in-memory cached lookup.
 * Banned IPs are blocked globally across all incoming endpoints.
 */

import { query } from '../db/pool.js';
import { logger } from '../utils/logger.js';

/** In-memory set of banned IP addresses for O(1) middleware checks */
const bannedSet = new Set();
let lastCacheSync = 0;
const CACHE_TTL_MS = 30_000;

function normalizeIp(ip) {
  if (!ip || typeof ip !== 'string') return '';
  const cleaned = ip.trim();
  if (cleaned.startsWith('::ffff:')) {
    return cleaned.slice(7);
  }
  return cleaned;
}

function isLoopback(ip) {
  const norm = normalizeIp(ip);
  return norm === '127.0.0.1' || norm === '::1' || norm === 'localhost' || norm === 'unknown';
}

/** Refresh in-memory banned IP cache from PostgreSQL */
export async function syncBannedIpCache() {
  try {
    const res = await query(
      'SELECT ip_address FROM banned_ips WHERE expires_at IS NULL OR expires_at > NOW()'
    );
    bannedSet.clear();
    for (const row of res.rows) {
      bannedSet.add(normalizeIp(row.ip_address));
    }
    lastCacheSync = Date.now();
  } catch (err) {
    logger.warn('Failed to sync banned IP cache from database', { error: err.message });
  }
}

/**
 * Check if an IP address is banned.
 * Fast O(1) in-memory check with periodic background refresh.
 *
 * @param {string} ip
 * @returns {Promise<boolean>}
 */
export async function isIpBanned(ip) {
  if (!ip) return false;
  const norm = normalizeIp(ip);
  if (isLoopback(norm)) return false;

  if (Date.now() - lastCacheSync > CACHE_TTL_MS) {
    await syncBannedIpCache();
  }

  return bannedSet.has(norm);
}

/**
 * Get list of currently banned IP entries.
 * Automatically cleans up expired bans.
 */
export async function getBannedIps() {
  await query('DELETE FROM banned_ips WHERE expires_at IS NOT NULL AND expires_at <= NOW()');
  const res = await query(
    'SELECT ip_address, reason, banned_by, created_at, expires_at FROM banned_ips ORDER BY created_at DESC'
  );
  return res.rows;
}

/**
 * Ban an IP address.
 *
 * @param {{ ipAddress: string; reason?: string; bannedBy?: string; expiresAt?: string | null }} param0
 */
export async function banIp({ ipAddress, reason = 'Banned by security administrator', bannedBy = 'admin', expiresAt = null }) {
  const norm = normalizeIp(ipAddress);
  if (!norm) {
    const err = new Error('A valid IP address is required.');
    err.statusCode = 422;
    throw err;
  }

  if (isLoopback(norm)) {
    const err = new Error('Localhost/loopback IP addresses (127.0.0.1, ::1) cannot be banned.');
    err.statusCode = 400;
    throw err;
  }

  const safeExpires = expiresAt ? new Date(expiresAt) : null;
  if (safeExpires && isNaN(safeExpires.getTime())) {
    const err = new Error('Invalid expiration date format.');
    err.statusCode = 422;
    throw err;
  }

  await query(
    `INSERT INTO banned_ips (ip_address, reason, banned_by, created_at, expires_at)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (ip_address) DO UPDATE
     SET reason = EXCLUDED.reason,
         banned_by = EXCLUDED.banned_by,
         created_at = NOW(),
         expires_at = EXCLUDED.expires_at`,
    [norm, String(reason).slice(0, 500), String(bannedBy).slice(0, 100), safeExpires]
  );

  bannedSet.add(norm);
  return { ipAddress: norm, reason, bannedBy, expiresAt: safeExpires };
}

/**
 * Unban an IP address.
 *
 * @param {string} ipAddress
 */
export async function unbanIp(ipAddress) {
  const norm = normalizeIp(ipAddress);
  if (!norm) return;

  await query('DELETE FROM banned_ips WHERE ip_address = $1', [norm]);
  bannedSet.delete(norm);
}
