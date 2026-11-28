/**
 * BruClinic — Express API Application
 *
 * Configures the Express app with middleware pipeline and Express routers.
 */

import express from 'express';
import { env } from './config/env.js';
import { attachRequestId } from './middleware/requestId.js';
import { setSecurityHeaders, setCors, sendError } from './utils/http.js';
import { checkGlobalRateLimit, getClientIp } from './middleware/rateLimiter.js';
import { isIpBanned } from './services/ipBan.js';
import { writeSecurityEvent } from './middleware/auditLogger.js';
import { SECURITY_EVENT } from './constants/events.js';
import { verifyToken } from './utils/auth.js';
import { isMaintenanceMode, getSystemConfig } from './services/systemConfig.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { adminRouter } from './routes/admin.js';
import { workflowsRouter } from './routes/workflows.js';
import { messagesRouter } from './routes/messages.js';
import { resourcesRouter } from './routes/resources.js';
import { logger } from './utils/logger.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // Trust reverse-proxy headers only when explicitly enabled in deployment
  // configuration; otherwise client-supplied forwarding headers are ignored.
  app.set('trust proxy', env.trustProxy);

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
        ipAddress: getClientIp(req),
        requestId: req.requestId,
        description: `Global rate limit exceeded on ${req.method} ${req.originalUrl || req.url}`,
      });
      return;
    }
    next();
  });

  // 4b. Global IP ban check (blocks banned IPs across all incoming requests).
  // Log at most ONE security event per IP per 60 seconds to prevent notification
  // floods when a banned device keeps retrying (browser auto-refresh, polling, etc.)
  const ipBanLogThrottle = new Map(); // ip -> lastLoggedAt (ms timestamp)
  const IP_BAN_LOG_INTERVAL_MS = 60_000;

  app.use(async (req, res, next) => {
    try {
      const ip = getClientIp(req);
      if (await isIpBanned(ip)) {
        const now = Date.now();
        const lastLogged = ipBanLogThrottle.get(ip) || 0;
        if (now - lastLogged >= IP_BAN_LOG_INTERVAL_MS) {
          ipBanLogThrottle.set(ip, now);
          writeSecurityEvent({
            eventType: SECURITY_EVENT.IP_BANNED,
            ipAddress: ip,
            requestId: req.requestId,
            description: `Blocked request from banned IP: ${ip} on ${req.method} ${req.originalUrl || req.url}`,
          });
        }
        res.setHeader('X-IP-Banned', 'true');
        return sendJson(res, 403, {
          error: 'Your IP address has been banned by clinic security administration.',
          code: 'IP_BANNED',
          ip,
        });
      }
    } catch (_) {}
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
          ipAddress: getClientIp(req),
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
  app.use('/api/health', healthRouter);

  // Auth endpoints (login, me, users, etc.)
  app.use('/api/auth', authRouter);

  // ── Authentication barrier for all remaining /api/* endpoints ─────
  app.use('/api', (req, res, next) => {
    if (!req.user) {
      writeSecurityEvent({
        eventType: SECURITY_EVENT.ACCESS_DENIED,
        ipAddress: getClientIp(req),
        requestId: req.requestId,
        description: `Unauthenticated request to ${req.method} ${req.originalUrl || req.url}`,
        metadata: { unauthenticated: true },
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

  // Dashboard summary router
  app.use('/api/dashboard', dashboardRouter);

  // Admin router
  app.use('/api/admin', adminRouter);

  // Clinical workflows router
  app.use('/api/workflows', workflowsRouter);

  // Staff messages router
  app.use('/api/messages', messagesRouter);

  // Resource CRUD router (patients, doctors, appointments, etc.)
  app.use('/api', resourcesRouter);

  // 404 for unmatched routes
  app.use((req, res) => {
    sendError(res, 404, 'Route not found');
  });

  // ── Central Error Handling Middleware ─────────────────────────────
  app.use((error, req, res, _next) => {
    const DB_UNAVAILABLE_CODES = [
      'ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED',
      'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH',
      '57P01', '57P03', '08000', '08003', '08006', '28000', '28P01', '3D000',
      '42P01', '42703',
    ];
    const isDbConfigError = error.name === 'DatabaseNotConfiguredError';
    const dbUnavailable = DB_UNAVAILABLE_CODES.includes(error.code) || isDbConfigError;
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
      if (isDbConfigError) {
        return 'Database configuration is incomplete. Check DB settings in backend/.env';
      }
      if (error.code === 'ETIMEDOUT' || error.code === 'EHOSTUNREACH' || error.code === 'ENETUNREACH') {
        return `Cannot reach the database server (${env.dbHost}:${env.dbPort}). Check that PostgreSQL is running and verify DB_HOST/DB_PORT in .env`;
      }
      if (error.code === 'ECONNREFUSED') {
        return `PostgreSQL is not accepting connections on ${env.dbHost}:${env.dbPort}. Start the PostgreSQL service.`;
      }
      if (error.code === '28000' || error.code === '28P01') {
        return 'Database access denied. Check DB_USER and DB_PASSWORD in backend/.env';
      }
      if (error.code === '3D000') {
        return `Database "${env.dbName}" does not exist. Create it and run: npm run db:migrate`;
      }
      if (error.code === '42P01') {
        return 'Database tables are missing. Please run: npm run db:migrate';
      }
      if (error.code === '42703') {
        return 'Database schema is outdated (missing column). Please run: npm run db:migrate';
      }
      return 'The database is unavailable. Ensure PostgreSQL is running and DB settings in .env are correct.';
    })();

    sendError(res, status, publicMessage);
  });

  return app;
}
