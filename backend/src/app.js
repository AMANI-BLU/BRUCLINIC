/**
 * BruClinic — Express API Application
 *
 * Configures the Express app with middleware pipeline and route dispatching.
 */

import express from 'express';
import { env } from './config/env.js';
import { attachRequestId } from './middleware/requestId.js';
import { setSecurityHeaders, setCors, sendError } from './utils/http.js';
import { checkGlobalRateLimit } from './middleware/rateLimiter.js';
import { writeSecurityEvent } from './middleware/auditLogger.js';
import { SECURITY_EVENT } from './constants/events.js';
import { verifyToken } from './utils/auth.js';
import { isMaintenanceMode, getSystemConfig } from './services/systemConfig.js';
import { healthHandler } from './routes/health.js';
import { authHandler } from './routes/auth.js';
import { dashboardSummaryHandler } from './routes/dashboard.js';
import { adminHandler } from './routes/admin.js';
import { workflowHandler } from './routes/workflows.js';
import { messagesHandler } from './routes/messages.js';
import { resourceDefinitions } from './data/resourceRepository.js';
import { createResourceHandler } from './routes/resources.js';
import { logger } from './utils/logger.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // Map of URL segment → resource handler, built from resourceDefinitions
  const resourceRoutes = new Map(
    Object.keys(resourceDefinitions).map(resource => [
      resource.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`),
      createResourceHandler(resource),
    ]),
  );

  // 1. Correlation ID
  app.use((req, res, next) => {
    attachRequestId(req, res);
    next();
  });

  // 2. Security headers
  app.use((req, res, next) => {
    setSecurityHeaders(res);
    next();
  });

  // 3. CORS & OPTIONS preflight
  app.use((req, res, next) => {
    setCors(res, req);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    next();
  });

  // 4. Global rate limit (300 req/min per IP)
  app.use((req, res, next) => {
    if (!checkGlobalRateLimit(req, res)) {
      writeSecurityEvent({
        eventType: SECURITY_EVENT.RATE_LIMIT_EXCEEDED,
        ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
        requestId: req.requestId,
        description: `Global rate limit exceeded on ${req.method} ${req.originalUrl || req.url}`,
      });
      return;
    }
    next();
  });

  // 5. JWT Authentication (sets req.user if valid token present)
  app.use((req, res, next) => {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      req.user = verifyToken(token);
      if (!req.user && token) {
        writeSecurityEvent({
          eventType: SECURITY_EVENT.INVALID_TOKEN,
          ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
          requestId: req.requestId,
          description: `Invalid or expired JWT on ${req.method} ${req.originalUrl || req.url}`,
        });
      }
    }
    next();
  });

  // 6. JSON body parsing
  // Restores carry a full snapshot and therefore get a dedicated (larger) size budget.
  app.use('/api/admin/backup/restore', express.json({ limit: env.backupMaxBytes }));
  app.use(express.json({ limit: env.bodyLimitBytes }));

  // Ensure req.body is always an object even if empty
  app.use((req, res, next) => {
    if (req.body === undefined) {
      req.body = {};
    }
    next();
  });

  // 7. Request logging on finish
  app.use((req, res, next) => {
    const startMs = Date.now();
    res.on('finish', () => {
      logger.request(
        req.requestId,
        req.method,
        req.originalUrl || req.url,
        res.statusCode,
        Date.now() - startMs,
        req.user?.id,
      );
    });
    next();
  });

  // ── Routes ────────────────────────────────────────────────────────

  // Friendly root response — browsers or health monitors hitting backend directly
  app.get('/', (req, res) => {
    res.status(200).json({
      service: 'BruClinic API',
      version: '2.0.0',
      status: 'running',
      note: 'This is the BruClinic backend API. The frontend is at a separate URL.',
      docs: '/api/health',
    });
  });

  // Unauthenticated health check
  app.get('/api/health', async (req, res, next) => {
    try {
      await healthHandler(req, res);
    } catch (err) {
      next(err);
    }
  });

  // Auth endpoints (login, me, users, etc.)
  app.use('/api/auth', async (req, res, next) => {
    try {
      const url = new URL(req.originalUrl || req.url, 'http://localhost');
      const segments = url.pathname.split('/').filter(Boolean);
      await authHandler(req, res, segments);
    } catch (err) {
      next(err);
    }
  });

  // ── Authentication barrier for all remaining /api/* endpoints ─────
  app.use('/api', (req, res, next) => {
    if (!req.user) {
      writeSecurityEvent({
        eventType: SECURITY_EVENT.ACCESS_DENIED,
        ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
        requestId: req.requestId,
        description: `Unauthenticated request to ${req.method} ${req.originalUrl || req.url}`,
      });
      return sendError(res, 401, 'Authentication required');
    }
    next();
  });

  // ── Maintenance mode barrier ──────────────────────────────────────
  app.use('/api', async (req, res, next) => {
    try {
      if (req.user.role !== 'admin' && req.user.role !== 'ict' && (await isMaintenanceMode())) {
        res.setHeader('Retry-After', '300');
        const message = await getSystemConfig(
          'maintenance_message',
          'The clinic system is being updated to serve you better. Clinical services will resume shortly.',
        );
        return sendError(res, 503, message);
      }
      next();
    } catch (err) {
      next(err);
    }
  });

  // Dashboard summary
  app.get('/api/dashboard/summary', async (req, res, next) => {
    try {
      await dashboardSummaryHandler(req, res);
    } catch (err) {
      next(err);
    }
  });

  // Admin routes
  app.use('/api/admin', async (req, res, next) => {
    try {
      const url = new URL(req.originalUrl || req.url, 'http://localhost');
      const segments = url.pathname.split('/').filter(Boolean);
      await adminHandler(req, res, segments, url);
    } catch (err) {
      next(err);
    }
  });

  // Clinical workflows
  app.use('/api/workflows', async (req, res, next) => {
    try {
      const url = new URL(req.originalUrl || req.url, 'http://localhost');
      const segments = url.pathname.split('/').filter(Boolean);
      await workflowHandler(req, res, segments);
    } catch (err) {
      next(err);
    }
  });

  // Staff messages
  app.use('/api/messages', async (req, res, next) => {
    try {
      const url = new URL(req.originalUrl || req.url, 'http://localhost');
      const segments = url.pathname.split('/').filter(Boolean);
      await messagesHandler(req, res, segments);
    } catch (err) {
      next(err);
    }
  });

  // Resource CRUD (patients, doctors, appointments, etc.)
  app.use('/api/:resource', async (req, res, next) => {
    try {
      const url = new URL(req.originalUrl || req.url, 'http://localhost');
      const segments = url.pathname.split('/').filter(Boolean);
      const resourceName = req.params.resource;
      const handler = resourceRoutes.get(resourceName);
      if (!handler) {
        return sendError(res, 404, 'Route not found');
      }
      await handler(req, res, segments, url);
    } catch (err) {
      next(err);
    }
  });

  // 404 for unmatched routes
  app.use((req, res) => {
    sendError(res, 404, 'Route not found');
  });

  // ── Central Error Handling Middleware ─────────────────────────────
  app.use((error, req, res, _next) => {
    const DB_UNAVAILABLE_CODES = [
      'ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED',
      'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH',
      '57P01', '57P03', '08000', '08003', '08006', '28000', '3D000',
    ];
    const dbUnavailable = DB_UNAVAILABLE_CODES.includes(error.code);
    const status = error.statusCode || error.status || (dbUnavailable ? 503 : 500);

    if (status >= 500) {
      logger.error('Unhandled request error', {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl || req.url,
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

    sendError(res, status, publicMessage);
  });

  return app;
}
