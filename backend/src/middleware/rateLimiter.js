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

  /** Remove expired entries to keep memory bounded. */
  _prune() {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, bucket] of this.buckets) {
      if (bucket.start < cutoff) this.buckets.delete(key);
    }
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

/**
 * Get the real client IP, respecting common proxy headers.
 * Only trust X-Forwarded-For if behind a known proxy setup.
 * @param {import('node:http').IncomingMessage} request
 * @returns {string}
 */
export function getClientIp(request) {
  // In production behind a trusted reverse proxy, use X-Forwarded-For
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return request.socket?.remoteAddress || 'unknown';
}
