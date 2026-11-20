/**
 * BruClinic — API Server
 *
 * Express-powered HTTP server for the Borana University Clinic system.
 *
 * Middleware pipeline (per request):
 *   1. Request ID assignment        — X-Request-ID correlation header
 *   2. Security headers             — CSP, HSTS, X-Frame-Options, etc.
 *   3. CORS                         — origin whitelist from CORS_ORIGIN env
 *   4. OPTIONS preflight            — 204 No Content
 *   5. Global rate limit            — 300 req/min per IP
 *   6. JWT authentication           — sets req.user if valid token present
 *   7. Request body parsing         — JSON parsing via Express (size-budgeted)
 *   8. Request logging              — structured log on response finish
 *   9. Route dispatch               — health | auth | dashboard | admin | workflows | messages | resources
 *  10. Error handling               — centralized database-aware error mapper
 *
 * Startup sequence:
 *   1. Validate environment variables (fail fast if misconfigured)
 *   2. Start Express HTTP server
 *   3. Log startup info and DB configuration status
 *   4. Attach graceful shutdown handlers (SIGINT, SIGTERM)
 *   5. Attach global uncaughtException / unhandledRejection handlers
 */

import { createApp } from './app.js';
import { env, validateEnv } from './config/env.js';
import { closePool, isDatabaseConfigured } from './db/pool.js';
import { logger } from './utils/logger.js';

// ── Startup Cleanup ───────────────────────────────────────────────

async function ensureCleanDatabase() {
  try {
    const { query } = await import('./db/pool.js');
    // Remove any lingering legacy mock doctor IDs from older versions
    await query("UPDATE queue_items SET assigned_doctor_id = NULL WHERE assigned_doctor_id IN ('D001', 'D002', 'D003', 'D004', 'D005')");
    await query("DELETE FROM doctors WHERE id IN ('D001', 'D002', 'D003', 'D004', 'D005')");
  } catch (_) { /* Non-fatal — DB may not have these records */ }
}

// Validate environment before starting
const { issues, warnings, valid } = validateEnv();
warnings.forEach(w => logger.warn(`[ENV] ${w}`));
if (!valid) {
  issues.forEach(issue => logger.error(`[ENV FATAL] ${issue}`));
  logger.error('Server startup aborted due to environment configuration issues. Fix the above and restart.');
  process.exit(1);
}

// ── Create and Start Server ───────────────────────────────────────

const app = createApp();

const server = app.listen(env.port, env.host, async () => {
  logger.info('BruClinic Express API server started', {
    url: `http://${env.host}:${env.port}`,
    environment: env.nodeEnv,
    pid: process.pid,
  });

  if (isDatabaseConfigured()) {
    logger.info('Database configured', {
      host: env.dbHost,
      port: env.dbPort,
      name: env.dbName,
    });
    logger.info('Run "npm run db:migrate" if this is a first install or after pulling updates.');
    await ensureCleanDatabase();
  } else {
    logger.warn('Database connection not configured — data routes are disabled. Set DB_HOST, DB_USER, DB_NAME in .env');
  }
});

// ── Connection Limits ─────────────────────────────────────────────

// Fail slow clients instead of holding a socket forever. Restore uploads can
// legitimately take longer than a normal request, so allow two minutes.
server.requestTimeout = 120_000;
server.headersTimeout = 60_000;
server.keepAliveTimeout = 65_000;

// ── Graceful Shutdown ─────────────────────────────────────────────

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await closePool();
      logger.info('Database pool closed');
    } catch (err) {
      logger.error('Error closing database pool', { error: err.message });
    }
    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Global Error Handlers ─────────────────────────────────────────

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception — this is a bug', {
    error: error.message,
    stack: error.stack,
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection — this is a bug', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

export { app, server };
