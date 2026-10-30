/**
 * BruClinic — Database Status Check (PostgreSQL)
 *
 * Run with: npm run db:check
 *
 * Reports:
 *   - Database connectivity
 *   - PostgreSQL server version
 *   - Applied migrations
 *   - Pending migrations (SQL files not yet applied)
 *   - Row counts for key tables
 *   - System configuration summary
 */

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR = path.join(__dirname, 'sql');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', cyan: '\x1b[36m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', dim: '\x1b[2m',
};

function print(msg, color = '') { process.stdout.write(color + msg + C.reset + '\n'); }
function ok(msg) { print(`  ✓ ${msg}`, C.green); }
function warn(msg) { print(`  ⚠ ${msg}`, C.yellow); }
function fail(msg) { print(`  ✗ ${msg}`, C.red); }
function row(label, value) { print(`  ${label.padEnd(35)} ${C.bold}${value}${C.reset}`); }

try {
  const { getPool, isDatabaseConfigured } = await import('./pool.js');

  print('\n  BruClinic — Database Status\n', C.cyan + C.bold);

  // ── Connection ────────────────────────────────────────────────
  if (!isDatabaseConfigured()) {
    fail('Database not configured. Set DB_HOST, DB_USER, DB_NAME in .env');
    process.exit(1);
  }

  const pool = getPool();
  if (!pool) { fail('Could not initialize connection pool.'); process.exit(1); }

  try {
    const version = await pool.query("SELECT version() AS v, current_database() AS db, NOW() AS ts");
    ok('Database connection: OK');
    row('Server version', version.rows[0].v);
    row('Database name', version.rows[0].db);
    row('Server time', version.rows[0].ts);
  } catch (err) {
    fail(`Connection failed: ${err.message} (${err.code})`);
    process.exit(1);
  }

  print('');

  // ── Migrations ────────────────────────────────────────────────
  print('  Migrations:', C.bold);
  let appliedMigrations = [];
  try {
    const result = await pool.query('SELECT version, applied_at FROM schema_migrations ORDER BY applied_at ASC');
    appliedMigrations = result.rows;
    for (const m of appliedMigrations) {
      ok(`${m.version}  (applied ${new Date(m.applied_at).toISOString().slice(0, 10)})`);
    }
  } catch {
    warn('schema_migrations table not found — run: npm run db:migrate');
  }

  // Check for pending migrations
  const sqlFiles = (await readdir(SQL_DIR)).filter(f => f.endsWith('.sql')).sort();
  const appliedSet = new Set(appliedMigrations.map(m => m.version));
  const pending = sqlFiles.filter(f => !appliedSet.has(f));
  if (pending.length > 0) {
    print('');
    for (const f of pending) warn(`Pending: ${f}`);
    print(`\n  Run "npm run db:migrate" to apply ${pending.length} pending migration(s).`, C.yellow);
  } else {
    ok('All migrations applied (schema is up to date)');
  }

  print('');

  // ── Table Row Counts ─────────────────────────────────────────
  print('  Table row counts:', C.bold);
  const tables = ['users', 'patients', 'doctors', 'appointments', 'medical_records', 'medicines', 'queue_items', 'emergency_cases', 'lab_orders', 'pharmacy_orders', 'audit_logs', 'security_events'];
  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT COUNT(*) AS cnt FROM "${table}"`);
      row(table, String(result.rows[0].cnt));
    } catch {
      row(table, '— (table not found)');
    }
  }

  print('');

  // ── System Config Summary ─────────────────────────────────────
  print('  System configuration:', C.bold);
  try {
    const configRows = await pool.query('SELECT key, value FROM system_config ORDER BY key ASC');
    for (const c of configRows.rows) {
      row(c.key, c.key.includes('password') || c.key.includes('secret') ? '***' : c.value);
    }
  } catch {
    warn('system_config table not found — run: npm run db:migrate');
  }

  print('');
  ok('Check complete.');
  print('');

} catch (err) {
  fail(`Unexpected error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closePool();
}
