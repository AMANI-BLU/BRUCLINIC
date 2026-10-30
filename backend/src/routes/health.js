/**
 * BruClinic — Health Check Route
 *
 * GET /api/health
 *
 * Returns a structured health status object including:
 *   - API service status
 *   - Database connectivity and schema version
 *   - Process uptime and memory usage
 *   - Setup status (used by the frontend first-run wizard)
 *
 * This route is intentionally unauthenticated so it can be used
 * by load balancers, monitoring tools, and the setup wizard.
 */

import { sendJson } from '../utils/http.js';
import { isDatabaseConfigured, getPool } from '../db/pool.js';
import { getSystemConfig, isMaintenanceMode } from '../services/systemConfig.js';

const DEFAULT_MAINTENANCE_MESSAGE =
  'The clinic system is being updated to serve you better. Clinical services will resume shortly.';

const START_TIME = Date.now();

/**
 * Check database connectivity and read the current schema version.
 * Returns null if database is not configured, or an object with status info.
 */
async function checkDatabase() {
  if (!isDatabaseConfigured()) {
    return { connected: false, reason: 'Not configured' };
  }
  try {
    const pool = getPool();
    if (!pool) return { connected: false, reason: 'Pool not initialized' };

    // Quick connectivity ping
    const ping = await pool.query('SELECT 1 AS ping');
    if (ping.rows[0]?.ping !== 1) throw new Error('Ping returned unexpected result');

    // Read schema migration version
    let schemaVersion = null;
    let migrationCount = 0;
    let hasUsers = false;
    try {
      const migrations = await pool.query(
        'SELECT version, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 1',
      );
      if (migrations.rows[0]) {
        schemaVersion = migrations.rows[0].version;
      }
      const countRows = await pool.query('SELECT COUNT(*) AS cnt FROM schema_migrations');
      migrationCount = Number(countRows.rows[0]?.cnt || 0);

      const userRows = await pool.query('SELECT COUNT(*) AS cnt FROM users WHERE is_active = TRUE');
      hasUsers = Number(userRows.rows[0]?.cnt || 0) > 0;
    } catch {
      // Migrations table may not exist yet (before first migration)
    }

    return {
      connected: true,
      schemaVersion,
      migrationCount,
      setupRequired: !hasUsers,
    };
  } catch (err) {
    return {
      connected: false,
      reason: err.code || err.message,
    };
  }
}

export async function healthHandler(request, response) {
  const db = await checkDatabase();
  const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);
  const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  // Public operational state — lets the web app show the maintenance screen
  // before rendering any clinical page.
  const [maintenanceEnabled, maintenanceMessage] = await Promise.all([
    isMaintenanceMode(),
    getSystemConfig('maintenance_message', DEFAULT_MAINTENANCE_MESSAGE),
  ]);

  // Overall status: healthy | degraded | unhealthy
  let status = 'healthy';
  if (!isDatabaseConfigured()) status = 'degraded';
  else if (!db.connected) status = 'unhealthy';

  const payload = {
    status,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: {
      seconds: uptimeSeconds,
      human: formatUptime(uptimeSeconds),
    },
    memory: {
      heapUsedMb: memMb,
    },
    database: db,
    maintenance: {
      enabled: maintenanceEnabled,
      message: String(maintenanceMessage || DEFAULT_MAINTENANCE_MESSAGE),
    },
    // Expose setup_required so the frontend can show first-run wizard
    setupRequired: db?.setupRequired === true,
    timestamp: new Date().toISOString(),
  };

  // HTTP status reflects health: 200 = healthy/degraded, 503 = unhealthy
  const httpStatus = status === 'unhealthy' ? 503 : 200;
  return sendJson(response, httpStatus, payload);
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}
