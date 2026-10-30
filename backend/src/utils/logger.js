/**
 * BruClinic — Structured Logger
 *
 * Provides consistent, leveled, JSON-structured logging for the backend.
 * In development: pretty-prints to console.
 * In production: writes JSON lines to console (suitable for log aggregators).
 *
 * Usage:
 *   import { logger } from './utils/logger.js';
 *   logger.info('Server started', { port: 4000 });
 *   logger.warn('Rate limit hit', { ip: '1.2.3.4' });
 *   logger.error('Unexpected crash', { error: err.message });
 */

import { env } from '../config/env.js';

const LOG_LEVELS = Object.freeze({ debug: 0, info: 1, warn: 2, error: 3 });
const MIN_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? (env.nodeEnv === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug);

const COLORS = Object.freeze({
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
  reset: '\x1b[0m',
});

function timestamp() {
  return new Date().toISOString();
}

function serialize(level, message, meta = {}) {
  const entry = {
    timestamp: timestamp(),
    level,
    service: 'bruclinic-api',
    message,
    ...meta,
  };
  if (env.nodeEnv === 'production') {
    // JSON lines format — compatible with log aggregators (Loki, Datadog, etc.)
    return JSON.stringify(entry);
  }
  // Development: colorized readable format
  const color = COLORS[level] || COLORS.reset;
  const ts = entry.timestamp.replace('T', ' ').slice(0, 23);
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `${color}[${level.toUpperCase().padEnd(5)}]${COLORS.reset} ${ts} ${message}${metaStr}`;
}

function log(level, message, meta) {
  if (LOG_LEVELS[level] < MIN_LEVEL) return;
  const output = serialize(level, message, meta);
  if (level === 'error') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

export const logger = Object.freeze({
  debug: (message, meta) => log('debug', message, meta),
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),

  /**
   * Create a child logger that always includes the given context.
   * @param {object} context - Fields always merged into log entries.
   */
  child(context) {
    return Object.freeze({
      debug: (message, meta) => log('debug', message, { ...context, ...meta }),
      info: (message, meta) => log('info', message, { ...context, ...meta }),
      warn: (message, meta) => log('warn', message, { ...context, ...meta }),
      error: (message, meta) => log('error', message, { ...context, ...meta }),
    });
  },

  /**
   * Log an HTTP request completion (called by middleware).
   */
  request(requestId, method, path, statusCode, durationMs, userId) {
    log(statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info', 'HTTP request', {
      requestId, method, path, statusCode, durationMs, userId: userId || null,
    });
  },
});
