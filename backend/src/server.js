/**
 * BruClinic — API Server
 *
 * Enterprise-grade HTTP server for the Borana University Clinic system.
 *
 * Middleware pipeline (per request):
 *   1. Request ID assignment        — X-Request-ID correlation header
 *   2. Security headers             — CSP, HSTS, X-Frame-Options, etc.
 *   3. CORS                         — origin whitelist from CORS_ORIGIN env
 *   4. OPTIONS preflight            — 204 No Content
 *   5. Global rate limit            — 300 req/min per IP
 *   6. Request body parsing         — JSON only, size-limited
 *   7. JWT authentication           — sets request.user if valid token present
 *   8. Route dispatch               — health | auth | admin | workflows | resources
 *   9. Request logging              — structured JSON log on completion
 *
 * Startup sequence:
 *   1. Validate environment variables (fail fast if misconfigured)
 *   2. Start HTTP server
 *   3. Log startup info and DB configuration status
 *   4. Attach graceful shutdown handlers (SIGINT, SIGTERM)
 *   5. Attach global uncaughtException / unhandledRejection handlers
 */

import http from 'node:http';
import { env, validateEnv } from './config/env.js';
import { closePool, isDatabaseConfigured } from './db/pool.js';
import { healthHandler } from './routes/health.js';
import { authHandler } from './routes/auth.js';
import { createResourceHandler } from './routes/resources.js';
import { workflowHandler } from './routes/workflows.js';
import { dashboardSummaryHandler } from './routes/dashboard.js';
import { adminHandler } from './routes/admin.js';
import { readJson, sendError, setCors, setSecurityHeaders } from './utils/http.js';
import { getSystemConfig, isMaintenanceMode } from './services/systemConfig.js';
import { resourceDefinitions } from './data/resourceRepository.js';
import { verifyToken } from './utils/auth.js';
import { logger } from './utils/logger.js';
import { attachRequestId } from './middleware/requestId.js';
import { checkGlobalRateLimit } from './middleware/rateLimiter.js';
import { writeSecurityEvent } from './middleware/auditLogger.js';
import { SECURITY_EVENT } from './constants/events.js';

// ── Route Registry ────────────────────────────────────────────────

/** Map of URL segment → resource handler, built from resourceDefinitions. */
const resourceRoutes = new Map(
  Object.keys(resourceDefinitions).map(resource => [
    resource.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`),
    createResourceHandler(resource),
  ]),
);

// ── Main Request Handler ──────────────────────────────────────────

const server = http.createServer(async (request, response) => {
  const startMs = Date.now();

  // 1. Correlation ID
  attachRequestId(request, response);

  // 2. Security headers
  setSecurityHeaders(response);

  // 3. CORS
  setCors(response, request);

  // 4. OPTIONS preflight
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  // 5. Global rate limit
  if (!checkGlobalRateLimit(request, response)) {
    writeSecurityEvent({
      eventType: SECURITY_EVENT.RATE_LIMIT_EXCEEDED,
      ipAddress: request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.socket?.remoteAddress,
      requestId: request.requestId,
      description: `Global rate limit exceeded on ${request.method} ${request.url}`,
    });
    return;
  }

  const url = new URL(request.url || '/', 'http://localhost');
  const segments = url.pathname.split('/').filter(Boolean);

  // 7. JWT Authentication (sets request.user if valid token)
  const authHeader = request.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    request.user = verifyToken(token);
    if (!request.user && token) {
      // Token was present but invalid — log as security event (fire-and-forget)
      writeSecurityEvent({
        eventType: SECURITY_EVENT.INVALID_TOKEN,
        ipAddress: request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.socket?.remoteAddress,
        requestId: request.requestId,
        description: `Invalid or expired JWT on ${request.method} ${url.pathname}`,
      });
    }
  }

  try {
    // 8a. Health — unauthenticated
    if (url.pathname === '/api/health') {
      return await healthHandler(request, response);
    }

    if (segments[0] !== 'api') return sendError(response, 404, 'Route not found');

    // 8b. Parse request body for mutations. Restores carry a full snapshot
    // and therefore get a dedicated (larger) size budget.
    const isRestoreUpload = request.method === 'POST' && url.pathname === '/api/admin/backup/restore';
    request.body = ['POST', 'PATCH'].includes(request.method)
      ? await readJson(request, isRestoreUpload ? { maxBytes: env.backupMaxBytes } : undefined)
      : {};

    // 8c. Auth endpoints — partially authenticated
    if (segments[1] === 'auth') {
      return await authHandler(request, response, segments);
    }

    // All remaining routes require authentication
    if (!request.user) {
      writeSecurityEvent({
        eventType: SECURITY_EVENT.ACCESS_DENIED,
        ipAddress: request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.socket?.remoteAddress,
        requestId: request.requestId,
        description: `Unauthenticated request to ${request.method} ${url.pathname}`,
      });
      return sendError(response, 401, 'Authentication required');
    }

    // 8c-bis. Maintenance mode: administrators keep access so they can
    // finish the work and turn it off; clinical staff receive a clear 503.
    if (request.user.role !== 'admin' && (await isMaintenanceMode())) {
      response.setHeader('Retry-After', '300');
      const message = await getSystemConfig(
        'maintenance_message',
        'The clinic system is being updated to serve you better. Clinical services will resume shortly.',
      );
      return sendError(response, 503, message);
    }

    // 8d. Dashboard summary
    if (url.pathname === '/api/dashboard/summary') {
      return await dashboardSummaryHandler(request, response);
    }

    // 8e. Admin routes — admin role enforced inside adminHandler
    if (segments[1] === 'admin') {
      return await adminHandler(request, response, segments, url);
    }

    // 8f. Clinical workflows
    if (segments[1] === 'workflows') {
      return await workflowHandler(request, response, segments);
    }

    // 8g. Resource CRUD
    if (!resourceRoutes.has(segments[1])) {
      return sendError(response, 404, 'Route not found');
    }
    return await resourceRoutes.get(segments[1])(request, response, segments, url);

  } catch (error) {
    const DB_UNAVAILABLE_CODES = [
      // Connection refused / reset
      'ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED',
      // Network / DNS errors
      'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH',
    // PostgreSQL codes: connection failure, cannot connect now, shutdown, invalid auth, unknown database
    '57P01', '57P03', '08000', '08003', '08006', '28000', '3D000',
    ];
    const dbUnavailable = DB_UNAVAILABLE_CODES.includes(error.code);
    const status = error.statusCode || (dbUnavailable ? 503 : 500);
    if (status >= 500) {
      logger.error('Unhandled request error', {
        requestId: request.requestId,
        method: request.method,
        path: url.pathname,
        error: error.message,
        code: error.code,
        stack: env.isProduction ? undefined : error.stack,
      });
    }
    const publicMessage = (() => {
      if (!dbUnavailable) {
        return error.publicMessage || (status >= 500 ? 'Internal server error' : error.message);
      }
      if (error.code === 'ETIMEDOUT' || error.code === 'EHOSTUNREACH' || error.code === 'ENETUNREACH') {
        return `Cannot reach the database server (${env.dbHost}:${env.dbPort}). Check that PostgreSQL is running and verify DB_HOST/DB_PORT in .env`;
      }
      if (error.code === 'ECONNREFUSED') {
        return `PostgreSQL is not accepting connections on ${env.dbHost}:${env.dbPort}. Start the PostgreSQL service.`;
      }
      if (error.code === '28000') {
        return 'Database access denied. Check DB_USER and DB_PASSWORD in .env';
      }
      if (error.code === '3D000') {
        return `Database "${env.dbName}" does not exist. Create it and run: npm run db:migrate`;
      }
      return 'The database is unavailable. Ensure PostgreSQL is running and DB settings in .env are correct.';
    })();
    return sendError(response, status, publicMessage);
  } finally {
    // 9. Structured request log
    logger.request(
      request.requestId,
      request.method,
      url.pathname,
      response.statusCode,
      Date.now() - startMs,
      request.user?.id,
    );
  }
});

// ── Connection Limits ─────────────────────────────────────────────

// Fail slow clients instead of holding a socket forever. Restore uploads can
// legitimately take longer than a normal request, so allow two minutes.
server.requestTimeout = 120_000;
server.headersTimeout = 60_000;
server.keepAliveTimeout = 65_000;

// ── Startup ───────────────────────────────────────────────────────

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

server.listen(env.port, env.host, async () => {
  logger.info('BruClinic API server started', {
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
  // Do not exit — allow the server to continue serving requests
  // but log so it can be investigated
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection — this is a bug', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});
