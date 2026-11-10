// PostgreSQL connection pool implementation
import { Pool } from 'pg';
import { env } from '../config/env.js';

let pool;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('PostgreSQL database configuration is incomplete');
    this.name = 'DatabaseNotConfiguredError';
    this.statusCode = 503;
  }
}

export function isDatabaseConfigured() {
  return Boolean(env.databaseUrl || (env.dbHost && env.dbName && env.dbUser));
}

export function getPool() {
  if (!isDatabaseConfigured()) return null;
  if (!pool) {
    // A full URL (Render Blueprint, Heroku, Neon, Supabase, ...) wins over
    // the individual DB_* settings. pg reads sslmode=... from the URL, so
    // managed databases that require TLS work without extra config.
    // For Supabase: the URL already contains ?sslmode=require; we also set
    // rejectUnauthorized:false so self-signed certs (common on managed DBs)
    // don't block connections when DB_SSL=true or the URL has sslmode.
    const hasSSLInUrl = env.databaseUrl?.includes('sslmode=');
    const sslNeeded = env.dbSsl || hasSSLInUrl;

    const connection = env.databaseUrl
      ? { connectionString: env.databaseUrl }
      : {
          host: env.dbHost,
          port: env.dbPort,
          user: env.dbUser,
          password: env.dbPassword,
          database: env.dbName,
        };

    pool = new Pool({
      ...connection,
      ...(sslNeeded ? { ssl: { rejectUnauthorized: false } } : {}),
      max: env.databasePoolMax,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

export async function query(sql, values = []) {
  const databasePool = getPool();
  if (!databasePool) throw new DatabaseNotConfiguredError();
  const result = await databasePool.query(sql, values);
  return {
    rows: result.rows,
    fields: result.fields,
    rowCount: result.rowCount,
    // pg does not expose affectedRows directly; for INSERT/UPDATE you can use result.rowCount
    affectedRows: result.rowCount,
    // pg returns the generated id via RETURNING clause; callers should query it explicitly
    insertId: undefined,
  };
}

export async function withTransaction(callback) {
  const databasePool = getPool();
  if (!databasePool) throw new DatabaseNotConfiguredError();
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback({
      query: async (sql, values = []) => {
        const res = await client.query(sql, values);
        return {
          rows: res.rows,
          fields: res.fields,
          rowCount: res.rowCount,
          affectedRows: res.rowCount,
          insertId: undefined,
        };
      },
    });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
