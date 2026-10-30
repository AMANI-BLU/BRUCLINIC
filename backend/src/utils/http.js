import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

export function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

export function sendDownload(response, payload, filename, contentType = 'application/json; charset=utf-8') {
  const safeName = String(filename || 'bruclinic-export.json').replace(/[^\w.\-]+/g, '_');
  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${safeName}"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
}

export function sendNoContent(response) {
  response.writeHead(204);
  response.end();
}

export function sendError(response, status, message, details) {
  sendJson(response, status, { error: message, ...(details ? { details } : {}) });
}

export function setCors(response, request) {
  const requestOrigin = request?.headers?.origin;
  const allowedOrigins = env.corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean);
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    response.setHeader('Access-Control-Allow-Origin', requestOrigin);
    response.setHeader('Vary', 'Origin');
  } else if (!requestOrigin && allowedOrigins.length === 1) {
    response.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  response.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Retry-After, X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining, X-Admin-RateLimit-Remaining');
  response.setHeader('Access-Control-Max-Age', '600');
}

export function setSecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  response.setHeader('Cache-Control', 'no-store');
  if (env.nodeEnv === 'production') response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

export async function readJson(request, { maxBytes = env.bodyLimitBytes } = {}) {
  const contentType = String(request.headers['content-type'] || '').toLowerCase();
  if (request.method !== 'GET' && request.method !== 'HEAD' && contentType && !contentType.includes('application/json')) {
    const error = new Error('Content-Type must be application/json');
    error.statusCode = 415;
    throw error;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) chunks.push(chunk);
  for (const chunk of chunks) size += chunk.length;
  if (size > maxBytes) {
    const error = new Error('Request body is too large');
    error.statusCode = 413;
    throw error;
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('Request body must be valid JSON');
    error.statusCode = 400;
    throw error;
  }
}

export function createId(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
}
