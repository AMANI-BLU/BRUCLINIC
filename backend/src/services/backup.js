/**
 * BruClinic — Data Backup & Restore Service
 *
 * Produces a portable JSON snapshot of every clinical table and restores it
 * atomically. Designed for a production clinic database:
 *
 *   - Explicit table allow-list (no SQL identifier ever comes from a request)
 *   - SHA-256 checksum so silently edited/corrupted files are rejected
 *   - Row-level column filtering against live schema metadata
 *   - Foreign-key-safe insert/delete ordering
 *   - Dry-run validation that always rolls back
 *   - Restore is refused if it would retire the acting administrator or
 *     leave the clinic without an active administrator
 *   - Every export and import is recorded in `backup_runs`, `audit_logs`
 *     and `security_events`
 */

import { createHash, randomUUID } from 'node:crypto';
import { getPool, isDatabaseConfigured } from '../db/pool.js';
import { invalidateSystemConfig } from './systemConfig.js';

export const BACKUP_FORMAT = 'bruclinic-backup';
export const BACKUP_FORMAT_VERSION = 1;
const MAX_ROWS_PER_TABLE = 250_000;

/**
 * Insertion order respects foreign keys: referenced tables come first.
 * `optional` tables are excluded unless the administrator opts in.
 */
const TABLE_CATALOG = Object.freeze([
  { table: 'users', label: 'Staff accounts', primaryKey: 'id', optional: false },
  { table: 'patients', label: 'Patients', primaryKey: 'id', optional: false },
  { table: 'doctors', label: 'Doctors', primaryKey: 'id', optional: false },
  { table: 'medicines', label: 'Medicines', primaryKey: 'id', optional: false },
  { table: 'appointments', label: 'Appointments', primaryKey: 'id', optional: false },
  { table: 'medical_records', label: 'Medical records', primaryKey: 'id', optional: false },
  { table: 'queue_items', label: 'Queue items', primaryKey: 'id', optional: false },
  { table: 'emergency_cases', label: 'Emergency cases', primaryKey: 'id', optional: false },
  { table: 'lab_orders', label: 'Laboratory orders', primaryKey: 'id', optional: false },
  { table: 'pharmacy_orders', label: 'Pharmacy orders', primaryKey: 'id', optional: false },
  { table: 'system_config', label: 'System configuration', primaryKey: 'key', optional: false },
  { table: 'audit_logs', label: 'Audit trail', primaryKey: 'id', optional: true },
  { table: 'security_events', label: 'Security events', primaryKey: 'id', optional: true },
]);

const CATALOG_BY_TABLE = new Map(TABLE_CATALOG.map(definition => [definition.table, definition]));

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function normalizeRestoreValue(value) {
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  return value;
}

/** Public metadata for the admin UI (never exposes row contents). */
export function backupTableCatalog() {
  return TABLE_CATALOG.map(({ table, label, optional }) => ({ table, label, optional }));
}

// ── Export ────────────────────────────────────────────────────────

export async function createBackup({ includeUsers = true, includeAudit = false } = {}) {
  if (!isDatabaseConfigured()) throw httpError(503, 'Database is not configured');

  const pool = getPool();
  const tables = {};
  const counts = {};

  for (const definition of TABLE_CATALOG) {
    if (definition.table === 'users' && !includeUsers) continue;
    if (definition.optional && !includeAudit) continue;
    const result = await pool.query(`SELECT * FROM ${quoteIdent(definition.table)}`);
    if (result.rows.length > MAX_ROWS_PER_TABLE) {
      throw httpError(413, `Table "${definition.table}" exceeds the ${MAX_ROWS_PER_TABLE.toLocaleString()} row backup limit. Archive old rows first.`);
    }
    tables[definition.table] = result.rows;
    counts[definition.table] = result.rows.length;
  }

  let schemaVersion = null;
  try {
    const migrations = await pool.query('SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT 1');
    schemaVersion = migrations.rows[0]?.version || null;
  } catch { /* migrations table may not exist yet */ }

  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    application: { name: 'BruClinic', version: process.env.npm_package_version || '2.0.0' },
    schemaVersion,
    options: { includeUsers: Boolean(includeUsers), includeAudit: Boolean(includeAudit) },
    counts,
    checksum: `sha256:${createHash('sha256').update(JSON.stringify(tables)).digest('hex')}`,
    tables,
  };
}

// ── Validation ────────────────────────────────────────────────────

export function validateBackup(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw httpError(422, 'The imported file must be a JSON object');
  }
  if (payload.format !== BACKUP_FORMAT) {
    throw httpError(422, 'This file is not a BruClinic backup');
  }

  const version = Number(payload.formatVersion);
  if (!Number.isInteger(version) || version < 1) {
    throw httpError(422, 'Backup format version is missing or invalid');
  }
  if (version > BACKUP_FORMAT_VERSION) {
    throw httpError(422, `Backup format version ${version} is newer than this server supports (${BACKUP_FORMAT_VERSION}). Upgrade the server first.`);
  }

  const tables = payload.tables;
  if (!tables || typeof tables !== 'object' || Array.isArray(tables)) {
    throw httpError(422, 'Backup has no data tables');
  }

  const unknown = Object.keys(tables).filter(table => !CATALOG_BY_TABLE.has(table));
  if (unknown.length) {
    throw httpError(422, `Backup contains unsupported table(s): ${unknown.join(', ')}`);
  }
  if (!Object.keys(tables).length) throw httpError(422, 'Backup contains no data tables');

  const counts = {};
  for (const [table, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) throw httpError(422, `Table "${table}" must be an array of rows`);
    if (rows.length > MAX_ROWS_PER_TABLE) {
      throw httpError(413, `Table "${table}" exceeds the ${MAX_ROWS_PER_TABLE.toLocaleString()} row import limit`);
    }
    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw httpError(422, `Row ${index + 1} in "${table}" is not an object`);
      }
    });
    counts[table] = rows.length;
  }

  const warnings = [];
  if (!tables.users) warnings.push('This backup has no staff accounts; existing accounts will be kept.');
  if (!tables.patients) warnings.push('This backup has no patients.');

  if (typeof payload.checksum === 'string' && payload.checksum) {
    const actual = `sha256:${createHash('sha256').update(JSON.stringify(tables)).digest('hex')}`;
    if (actual !== payload.checksum) {
      throw httpError(422, 'Backup checksum does not match its contents. The file may be corrupted or edited.');
    }
  } else {
    warnings.push('This backup has no checksum, so its integrity could not be verified.');
  }

  return {
    formatVersion: version,
    createdAt: payload.createdAt || null,
    application: payload.application || null,
    schemaVersion: payload.schemaVersion || null,
    checksum: payload.checksum || null,
    counts,
    warnings,
    tables,
  };
}

// ── Restore ───────────────────────────────────────────────────────

async function tableColumns(client, table) {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = $1`,
    [table],
  );
  return new Set(result.rows.map(row => row.column_name));
}

export async function restoreBackup(payload, { mode = 'merge', dryRun = false, actor = null } = {}) {
  if (!isDatabaseConfigured()) throw httpError(503, 'Database is not configured');
  if (!['merge', 'replace'].includes(mode)) throw httpError(422, 'Restore mode must be "merge" or "replace"');

  const backup = validateBackup(payload);
  if (mode === 'replace' && !backup.tables.users) {
    throw httpError(422, 'A full (replace) restore must include staff accounts, otherwise every account would be deleted.');
  }

  const pool = getPool();
  const client = await pool.connect();
  const summary = {
    mode,
    dryRun: Boolean(dryRun),
    startedAt: new Date().toISOString(),
    tables: {},
    warnings: [...backup.warnings],
  };

  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '180s'");
    await client.query("SET LOCAL lock_timeout = '15s'");

    // Delete children before parents when replacing the database.
    if (mode === 'replace') {
      for (const definition of [...TABLE_CATALOG].reverse()) {
        if (!backup.tables[definition.table]) continue;
        const removed = await client.query(`DELETE FROM ${quoteIdent(definition.table)}`);
        summary.tables[definition.table] = { received: backup.counts[definition.table] || 0, applied: 0, removed: removed.rowCount };
      }
    }

    for (const definition of TABLE_CATALOG) {
      const rows = backup.tables[definition.table];
      if (!rows || rows.length === 0) {
        summary.tables[definition.table] = { ...(summary.tables[definition.table] || {}), received: rows ? rows.length : 0, applied: 0 };
        continue;
      }

      const columns = await tableColumns(client, definition.table);
      if (!columns.has(definition.primaryKey)) {
        throw httpError(409, `Table "${definition.table}" is missing its primary key "${definition.primaryKey}". Run migrations and retry.`);
      }

      let applied = 0;
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const keys = Object.keys(row).filter(key => columns.has(key));
        if (!keys.length) throw httpError(422, `Row ${index + 1} in "${definition.table}" has no columns this database recognises`);
        const missingKey = keys.includes(definition.primaryKey) ? null : definition.primaryKey;
        if (missingKey) throw httpError(422, `Row ${index + 1} in "${definition.table}" is missing "${missingKey}"`);

        const quotedKeys = keys.map(quoteIdent);
        const placeholders = keys.map((_, position) => `$${position + 1}`);
        const updates = keys
          .filter(key => key !== definition.primaryKey)
          .map(key => `${quoteIdent(key)} = EXCLUDED.${quoteIdent(key)}`);
        const conflict = updates.length
          ? `ON CONFLICT (${quoteIdent(definition.primaryKey)}) DO UPDATE SET ${updates.join(', ')}`
          : `ON CONFLICT (${quoteIdent(definition.primaryKey)}) DO NOTHING`;

        try {
          await client.query(
            `INSERT INTO ${quoteIdent(definition.table)} (${quotedKeys.join(', ')})
             VALUES (${placeholders.join(', ')}) ${conflict}`,
            keys.map(key => normalizeRestoreValue(row[key])),
          );
        } catch (error) {
          throw httpError(409, `Could not import row ${index + 1} into "${definition.table}": ${error.detail || error.message}`);
        }
        applied += 1;
      }

      summary.tables[definition.table] = {
        ...(summary.tables[definition.table] || {}),
        received: rows.length,
        applied,
      };
    }

    // Safety: never leave the clinic without an administrator.
    const admins = await client.query(
      "SELECT COUNT(*)::int AS total FROM users WHERE role = 'admin' AND is_active = TRUE",
    );
    if (!admins.rows[0]?.total) {
      throw httpError(422, 'Restore rejected: it would leave the clinic with no active administrator.');
    }

    // Safety: do not silently delete the administrator performing the restore.
    if (actor?.id) {
      const actingAdmin = await client.query(
        "SELECT 1 FROM users WHERE id = $1 AND role = 'admin' AND is_active = TRUE LIMIT 1",
        [actor.id],
      );
      if (!actingAdmin.rows.length) {
        throw httpError(422, 'Restore rejected: it would remove or deactivate your own administrator account. Add your account to the backup first.');
      }
    }

    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
      invalidateSystemConfig();
    }

    summary.finishedAt = new Date().toISOString();
    return summary;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* already rolled back */ }
    throw error;
  } finally {
    client.release();
  }
}

// ── Operational metadata ──────────────────────────────────────────

export async function getTableStats() {
  if (!isDatabaseConfigured()) return [];
  const pool = getPool();
  const stats = [];
  for (const definition of TABLE_CATALOG) {
    try {
      const result = await pool.query(`SELECT COUNT(*)::int AS total FROM ${quoteIdent(definition.table)}`);
      stats.push({
        table: definition.table,
        label: definition.label,
        optional: definition.optional,
        rows: result.rows[0]?.total || 0,
      });
    } catch {
      stats.push({ table: definition.table, label: definition.label, optional: definition.optional, rows: 0, missing: true });
    }
  }
  return stats;
}

export async function recordBackupRun({
  kind, mode = null, status = 'completed', actorId = null, actor = null,
  filename = null, checksum = null, dryRun = false, counts = {}, notes = null,
}) {
  const id = `BK-${randomUUID().slice(0, 8).toUpperCase()}`;
  try {
    await getPool().query(
      `INSERT INTO backup_runs (id, kind, mode, status, actor_id, actor, filename, checksum, dry_run, counts, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, kind, mode, status, actorId, actor, filename, checksum, Boolean(dryRun), JSON.stringify(counts || {}), notes],
    );
  } catch { /* History is best-effort; never fail a backup because of it. */ }
  return id;
}

export async function listBackupRuns(limit = 25) {
  try {
    const result = await getPool().query(
      'SELECT * FROM backup_runs ORDER BY created_at DESC LIMIT $1',
      [Math.min(Math.max(Number(limit) || 25, 1), 100)],
    );
    return result.rows;
  } catch {
    return [];
  }
}
