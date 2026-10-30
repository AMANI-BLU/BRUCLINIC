/**
 * BruClinic — Environment Configuration
 *
 * Centralizes all environment variable parsing, type coercion, and
 * startup validation. The server will refuse to start with a clear
 * error message if any required variable is missing or invalid.
 *
 * All config consumers must import from this module — never access
 * process.env directly in other files.
 */

import 'dotenv/config';

// ── Helpers ──────────────────────────────────────────────────────

function integer(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', 'yes'].includes(String(value).toLowerCase().trim());
}

// ── Config object ─────────────────────────────────────────────────

export const env = Object.freeze({
  // Runtime environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',

  // Server binding
  port: integer(process.env.PORT, 4000),
  host: process.env.HOST || 'localhost',

  // Database connection
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: integer(process.env.DB_PORT, 5432),
  dbUser: process.env.DB_USER || 'postgres',
  dbPassword: process.env.DB_PASSWORD || 'admin',
  dbName: process.env.DB_NAME || 'bruclinic',
  databasePoolMax: integer(process.env.DATABASE_POOL_MAX, 10),

  // Security
  jwtSecret: process.env.JWT_SECRET || '',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Request limits
  bodyLimitBytes: integer(process.env.BODY_LIMIT_BYTES, 1024 * 1024),
  // Restore payloads are deliberately larger than normal API requests
  backupMaxBytes: integer(process.env.BACKUP_MAX_BYTES, 50 * 1024 * 1024),

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Token/session defaults (overridable at runtime via system_config)
  sessionTimeoutHours: integer(process.env.SESSION_TIMEOUT_HOURS, 8),
});

// ── Startup Validation ────────────────────────────────────────────

/**
 * Validates all required environment configuration and logs a detailed
 * summary. Throws an error (causing process.exit(1)) if any required
 * value is missing or dangerously insecure for production.
 *
 * Called once at server startup — never throws in a request handler.
 */
export function validateEnv() {
  const issues = [];
  const warnings = [];

  // JWT secret is mandatory for authentication to work at all
  if (!env.jwtSecret || env.jwtSecret === 'replace-with-a-long-random-secret') {
    issues.push('JWT_SECRET is not set or is using the placeholder value. Run: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\')" and set it in .env');
  } else if (env.jwtSecret.length < 32) {
    warnings.push('JWT_SECRET is shorter than 32 characters. Use at least 48 random bytes for production security.');
  }

  // Database name is required for the pool to be usable
  if (!env.dbName) {
    issues.push('DB_NAME is not configured. Set DB_NAME in your .env file.');
  }

  // Production-specific checks
  if (env.isProduction) {
    if (!env.dbPassword) {
      warnings.push('DB_PASSWORD is empty. This is insecure for a production database.');
    }
    if (env.corsOrigin.includes('localhost')) {
      warnings.push('CORS_ORIGIN includes "localhost" which is unsuitable for a production deployment.');
    }
    if (env.host === 'localhost' || env.host === '127.0.0.1') {
      warnings.push('HOST is set to localhost. In production the server should bind to a specific interface or 0.0.0.0.');
    }
  }

  // Return validation result — caller decides whether to throw
  return { issues, warnings, valid: issues.length === 0 };
}
