/**
 * BruClinic — Rate Limiter Middleware
 *
 * Provides tiered, in-process rate limiting with three enforcement levels:
 *   1. Global   — max 300 requests per minute per IP
 *   2. Auth     — max 8 login attempts per 15 minutes per IP:username
 *   3. Admin    — max 60 admin-action requests per minute per user ID
 *
 * Security events are persisted to the database when limits are exceeded.
 * For large-scale deployments, replace the in-process Maps with Redis.
 *
 * NOTE: In-process maps reset on server restart. For a stateless, clustered
 * deployment you must use a shared store (Redis, Memcached).
 */

import { sendError } from '../utils/http.js';
import { logger } from '../utils/logger.js';

/** @typedef {{ start: number; count: number }} Bucket */

class RateLimiter {
  /** @param {number} windowMs @param {number} max */
  constructor(windowMs, max) {
    this.windowMs = windowMs;
    this.max = max;
    /** @type {Map<string, Bucket>} */
    this.buckets = new Map();
    // Periodic cleanup to prevent memory growth from idle IP entries
    setInterval(() => this._prune(), windowMs * 2).unref();
  }

  /**
   * Check and increment the counter for a given key.
   * @param {string} key
   * @param {{ max?: number; windowMs?: number }} [overrides] - Runtime policy
   * @returns {{ allowed: boolean; remaining: number; retryAfterSeconds: number }}
   */
  check(key, overrides = {}) {
    const now = Date.now();
    const windowMs = overrides.windowMs ?? this.windowMs;
    const max = overrides.max ?? this.max;
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.windowMs !== windowMs || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0, windowMs };
    }
    bucket.count += 1;
    this.buckets.set(key, bucket);
    const remaining = Math.max(0, max - bucket.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - bucket.start)) / 1000));
    return { allowed: bucket.count <= max, remaining, retryAfterSeconds };
  }

  /** Remove a key (e.g. after a successful login). */
  reset(key) {
    this.buckets.delete(key);
  }

  /** Remove all keys matching a predicate and return how many were cleared. */
  resetMatching(predicate) {
    let cleared = 0;
    for (const key of this.buckets.keys()) {
      if (predicate(key)) {
        this.buckets.delete(key);
        cleared += 1;
      }
    }
    return cleared;
  }

  /** Remove expired entries to keep memory bounded. */
  _prune() {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, bucket] of this.buckets) {
      if (bucket.start < cutoff) this.buckets.delete(key);
    }
  }

  /**
   * Count how many keys are currently locked (exceeded the limit and still
   * within their active window). Used for the ICT dashboard "Locked Accounts"
   * KPI so it reflects the real-time lock state rather than historical events.
   *
   * @param {number} max       - Current max attempts policy (from system_config)
   * @param {number} windowMs  - Current window duration policy (from system_config)
   * @returns {number}
   */
  getLockedCount(max, windowMs) {
    const now = Date.now();
    let count = 0;
    for (const bucket of this.buckets.values()) {
      const effectiveWindow = bucket.windowMs ?? windowMs;
      if (bucket.count > max && now - bucket.start <= effectiveWindow) {
        count += 1;
      }
    }
    return count;
  }
}

// Tier 1: Global per-IP limiter — 300 req / 60s
export const globalLimiter = new RateLimiter(60 * 1000, 300);

// Tier 2: Auth per-IP:username limiter — 8 attempts / 15min
export const authLimiter = new RateLimiter(15 * 60 * 1000, 8);

// Tier 3: Admin action per-user limiter — 60 req / 60s
export const adminLimiter = new RateLimiter(60 * 1000, 60);

/**
 * Express-style middleware that enforces the global IP rate limit.
 * Returns false if the request should be rejected (response already sent).
 *
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @returns {boolean} true if allowed, false if blocked
 */
export function checkGlobalRateLimit(request, response) {
  const ip = getClientIp(request);
  const { allowed, remaining, retryAfterSeconds } = globalLimiter.check(ip);

  response.setHeader('X-RateLimit-Limit', '300');
  response.setHeader('X-RateLimit-Remaining', String(remaining));

  if (!allowed) {
    response.setHeader('Retry-After', String(retryAfterSeconds));
    logger.warn('Global rate limit exceeded', { ip, requestId: request.requestId });
    sendError(response, 429, 'Too many requests. Please slow down.');
    return false;
  }
  return true;
}

/**
 * Check auth-specific rate limit for login attempts.
 * The threshold and window can be supplied from system_config so an
 * administrator can tighten lockout policy without a restart.
 *
 * @param {string} ip
 * @param {string} username
 * @param {{ max?: number; windowMs?: number }} [policy]
 * @returns {{ allowed: boolean; retryAfterSeconds: number }}
 */
export function checkAuthRateLimit(ip, username, policy = {}) {
  const key = `${ip}:${String(username).trim().toLowerCase().slice(0, 80)}`;
  return authLimiter.check(key, policy);
}

/**
 * Enforce the admin-action tier (60 requests/minute per administrator).
 * Returns false when the response has already been sent.
 */
export function checkAdminRateLimit(request, response) {
  const actor = request.user?.id || getClientIp(request);
  const { allowed, remaining, retryAfterSeconds } = adminLimiter.check(`admin:${actor}`);
  response.setHeader('X-Admin-RateLimit-Remaining', String(remaining));
  if (!allowed) {
    response.setHeader('Retry-After', String(retryAfterSeconds));
    logger.warn('Admin rate limit exceeded', { actor, requestId: request.requestId });
    sendError(response, 429, 'Too many administrative actions. Please wait a moment and retry.');
    return false;
  }
  return true;
}

/** Clear the auth rate limit after a successful login. */
export function clearAuthRateLimit(ip, username) {
  const key = `${ip}:${String(username).trim().toLowerCase().slice(0, 80)}`;
  authLimiter.reset(key);
}

/** Clear an account's auth lock across all client IPs known to this server. */
export function clearAuthRateLimitForUsername(username) {
  const normalized = String(username).trim().toLowerCase().slice(0, 80);
  return authLimiter.resetMatching(key => key.endsWith(`:${normalized}`));
}

export function normalizeIp(ip) {
  if (!ip || typeof ip !== 'string') return '';
  let clean = ip.trim();
  // Strip IPv4-mapped IPv6 prefix (e.g. ::ffff:192.168.1.1 -> 192.168.1.1)
  if (clean.startsWith('::ffff:')) {
    clean = clean.slice(7);
  }
  // Convert standard IPv6 loopback to readable form or leave as 127.0.0.1
  if (clean === '::1') {
    clean = '127.0.0.1';
  }
  // Strip port if present (e.g. 192.168.1.1:54321)
  if (/^(\d{1,3}\.){3}\d{1,3}:\d+$/.test(clean)) {
    clean = clean.split(':')[0];
  }
  return clean;
}

/**
 * Get the real client IP, respecting common reverse-proxy and CDN headers.
 * Supports Cloudflare (CF-Connecting-IP), AWS / Nginx (X-Real-IP),
 * Akamai (True-Client-IP), standard load balancers (X-Forwarded-For),
 * Express req.ip (when trust proxy is enabled), and fallback socket address.
 *
 * @param {import('node:http').IncomingMessage} request
 * @returns {string}
 */
export function getClientIp(request) {
  if (!request) return 'unknown';

  // 1. Cloudflare provides the actual validated connecting client IP
  const cfIp = request.headers?.['cf-connecting-ip'];
  if (cfIp) {
    const clean = normalizeIp(String(cfIp));
    if (clean) return clean;
  }

  // 2. Standard X-Real-IP set by Nginx, Caddy, HAProxy, etc.
  const realIp = request.headers?.['x-real-ip'];
  if (realIp) {
    const clean = normalizeIp(String(realIp));
    if (clean) return clean;
  }

  // 3. True-Client-IP header (Akamai, Cloudflare Enterprise)
  const trueClientIp = request.headers?.['true-client-ip'];
  if (trueClientIp) {
    const clean = normalizeIp(String(trueClientIp));
    if (clean) return clean;
  }

  // 4. Standard X-Forwarded-For header (leftmost IP is the original client)
  const forwarded = request.headers?.['x-forwarded-for'];
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim();
    const clean = normalizeIp(first);
    if (clean) return clean;
  }

  // 5. Express trusted proxy IP or req.ip
  if (request.ip) {
    const clean = normalizeIp(request.ip);
    if (clean) return clean;
  }

  // 6. Direct socket remote address
  const socketIp = request.socket?.remoteAddress || request.connection?.remoteAddress;
  if (socketIp) {
    const clean = normalizeIp(socketIp);
    if (clean) return clean;
  }

  return 'unknown';
}
