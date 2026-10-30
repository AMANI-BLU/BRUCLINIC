/**
 * BruClinic — Runtime System Configuration
 *
 * Reads the `system_config` table so that operational settings (session
 * lifetime, login lockout, maintenance mode) take effect without a restart.
 *
 * Values are cached briefly to keep request paths cheap; the cache is
 * invalidated immediately when an administrator saves new values.
 */

import { isDatabaseConfigured, query } from '../db/pool.js';

const CACHE_TTL_MS = 5_000;

let cache = { loadedAt: 0, values: new Map() };

/** Drop the cache so the next read reflects freshly saved configuration. */
export function invalidateSystemConfig() {
  cache = { loadedAt: 0, values: new Map() };
}

async function loadedValues() {
  if (!isDatabaseConfigured()) return cache.values;
  const stale = Date.now() - cache.loadedAt > CACHE_TTL_MS;
  if (cache.loadedAt && !stale) return cache.values;
  try {
    const result = await query('SELECT key, value FROM system_config');
    cache = {
      loadedAt: Date.now(),
      values: new Map(result.rows.map(row => [row.key, row.value])),
    };
  } catch {
    // The table may not exist before migrations; keep serving the last values.
    cache = { loadedAt: Date.now(), values: cache.values };
  }
  return cache.values;
}

export async function getSystemConfig(key, fallback = null) {
  const values = await loadedValues();
  return values.has(key) ? values.get(key) : fallback;
}

export async function getConfigNumber(key, fallback, { min = -Infinity, max = Infinity } = {}) {
  const raw = await getSystemConfig(key);
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export async function isMaintenanceMode() {
  const value = String(await getSystemConfig('maintenance_mode', 'false')).trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}
