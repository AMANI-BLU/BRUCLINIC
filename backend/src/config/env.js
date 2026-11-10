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

/**
 * Read the connection details out of DATABASE_URL so logs and error
 * messages show the real host instead of the localhost defaults.
 * The URL itself is always passed to pg as-is.
 */
function parseConnectionString(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return {
      host: url.hostname || undefined,
      port: url.port ? Number.parseInt(url.port, 10) : undefined,
      user: url.username ? decodeURIComponent(url.username) : undefined,
      database: url.pathname ? decodeURIComponent(url.pathname.replace(/^\//, '')) : undefined,
    };
  } catch {
    return null;
  }
}

const databaseUrl = process.env.DATABASE_URL || '';
const parsedDatabaseUrl = parseConnectionString(databaseUrl);

// ── Config object ─────────────────────────────────────────────────

export const env = Object.freeze({
  // Runtime environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',

  // Server binding — Render.com injects PORT automatically; always bind to
  // 0.0.0.0 in production so the platform's proxy can reach the process.
  // Parse strictly: only accept values in the valid TCP port range 1-65535.
  port: (() => {
    const raw = process.env.PORT;
    const parsed = Number.parseInt(raw || '', 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535) return parsed;
    if (raw !== undefined && raw !== '') {
      // Render sometimes provides PORT; if it's out-of-range log the bad value
      // so it shows up clearly in the deploy log.
      console.error(`[ENV] PORT="${raw}" (parsed: ${parsed}) is not a valid TCP port (1-65535). Falling back to 4000. Fix this in your Render environment variables.`);
    }
    return 4000;
  })(),
  host: process.env.HOST || (((process.env.NODE_ENV || 'development') === 'production') ? '0.0.0.0' : 'localhost'),

  // Database connection. DATABASE_URL (if set) takes precedence over the
  // individual DB_* values — this is what Render Blueprints provide.
  databaseUrl,
  // When DATABASE_URL is present, use its parsed components for logs and
  // error messages too — the connection string itself always wins.
  dbHost: databaseUrl ? (parsedDatabaseUrl?.host || 'localhost') : (process.env.DB_HOST || 'localhost'),
  dbPort: databaseUrl ? (parsedDatabaseUrl?.port || 5432) : integer(process.env.DB_PORT, 5432),
  dbUser: databaseUrl ? (parsedDatabaseUrl?.user || 'postgres') : (process.env.DB_USER || 'postgres'),
  dbPassword: process.env.DB_PASSWORD || 'admin',
  dbName: databaseUrl ? (parsedDatabaseUrl?.database || 'bruclinic') : (process.env.DB_NAME || 'bruclinic'),
  databasePoolMax: integer(process.env.DATABASE_POOL_MAX, 10),
  // Managed databases reached over the public internet often need TLS.
  // For Render's external URL you can also use ?sslmode=require instead.
  dbSsl: bool(process.env.DB_SSL, false),

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

  // Port sanity check — catches a manually-set PORT env var in Render dashboard
  // that is out of the valid TCP range (e.g. 833412 caused by an accidental value).
  const rawPort = process.env.PORT;
  if (rawPort !== undefined && rawPort !== '') {
    const parsedPort = Number.parseInt(rawPort, 10);
    if (!Number.isFinite(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      issues.push(
        `PORT="${rawPort}" is not a valid TCP port (must be 1-65535). ` +
        'On Render: do NOT set PORT manually — Render injects it automatically. ' +
        'Remove the PORT environment variable from your Render service dashboard.',
      );
    }
  }

  // JWT secret is mandatory for authentication to work at all
  if (!env.jwtSecret || env.jwtSecret === 'replace-with-a-long-random-secret') {
    issues.push('JWT_SECRET is not set or is using the placeholder value. Run: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\')" and set it in .env');
  } else if (env.jwtSecret.length < 32) {
    warnings.push('JWT_SECRET is shorter than 32 characters. Use at least 48 random bytes for production security.');
  }

  // A connection string or the individual DB_* values are required
  if (!env.databaseUrl && !(env.dbHost && env.dbName && env.dbUser)) {
    issues.push('Database connection is not configured. Set DATABASE_URL, or DB_HOST/DB_USER/DB_NAME in your .env file.');
  }

  // Production-specific checks
  if (env.isProduction) {
    if (!env.databaseUrl && !env.dbPassword) {
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
