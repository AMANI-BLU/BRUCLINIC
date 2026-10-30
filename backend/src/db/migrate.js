/**
 * BruClinic — Database Migration Runner (PostgreSQL)
 *
 * Run with: npm run db:migrate
 *
 * Applies all pending SQL migration files from src/db/sql/ in alphabetical
 * order. Each file is tracked in the `schema_migrations` table so it is
 * only applied once. Already-applied migrations are skipped.
 *
 * SQL files may contain multiple statements separated by semicolons.
 * Each statement is executed individually so that partial failures are
 * easier to diagnose. Statement splitting understands single-quoted strings
 * and dollar-quoted bodies (`$$ ... $$`), so trigger functions work.
 *
 * Usage:
 *   npm run db:migrate            — apply all pending migrations
 *   npm run db:check              — view which migrations are applied
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool, getPool, isDatabaseConfigured } from './pool.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.join(currentDir, 'sql');

/**
 * Split a SQL file into individual statements.
 * Strips line and block comments, splits on semicolons that are not
 * inside string literals or dollar-quoted blocks.
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  let dollarTag = null;

  while (i < sql.length) {
    const char = sql[i];
    const next = sql[i + 1];

    // Line comment
    if (!dollarTag && char === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }

    // Block comment
    if (!dollarTag && char === '/' && next === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i += 2;
      current += ' ';
      continue;
    }

    // Single-quoted string literal (handles '' escapes)
    if (!dollarTag && char === "'") {
      current += char;
      i++;
      while (i < sql.length) {
        const c = sql[i];
        if (c === "'" && sql[i + 1] === "'") { current += "''"; i += 2; continue; }
        current += c;
        i++;
        if (c === "'") break;
      }
      continue;
    }

    // Dollar-quoted block ($$ ... $$ or $tag$ ... $tag$)
    if (!dollarTag && char === '$') {
      const match = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      current += char;
      i++;
      continue;
    }

    if (char === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

if (!isDatabaseConfigured()) {
  console.error('Database not configured. Set DB_HOST, DB_USER, DB_NAME in your .env file.');
  console.error('Run "npm run setup" to configure the system.');
  process.exit(1);
}

const pool = getPool();
let client;

try {
  client = await pool.connect();
  await client.query('BEGIN');

  // Ensure the tracking table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const files = (await readdir(sqlDir)).filter(f => f.endsWith('.sql')).sort();
  let applied = 0;
  let skipped = 0;

  for (const file of files) {
    const existing = await client.query(
      'SELECT 1 FROM schema_migrations WHERE version = $1',
      [file],
    );
    if (existing.rowCount > 0) {
      console.log(`  [skip] ${file} (already applied)`);
      skipped++;
      continue;
    }

    const content = await readFile(path.join(sqlDir, file), 'utf8');
    const statements = splitStatements(content);

    console.log(`  [run ] ${file} — ${statements.length} statement(s)`);
    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err) {
        throw Object.assign(err, { _migrationFile: file, _statement: stmt.slice(0, 160) });
      }
    }

    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      [file],
    );
    console.log(`  [done] ${file}`);
    applied++;
  }

  await client.query('COMMIT');
  console.log(`\nMigrations complete. Applied: ${applied}, Skipped (already applied): ${skipped}`);

} catch (error) {
  if (client) {
    try { await client.query('ROLLBACK'); } catch (_) {}
  }
  const extra = error._migrationFile ? ` (in ${error._migrationFile})` : '';
  console.error(`\nMigration failed${extra}: ${error.message}`);
  if (error._statement) console.error(`  Statement: ${error._statement}`);
  process.exitCode = 1;
} finally {
  if (client) client.release();
  await closePool();
}
