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
  return Boolean(env.dbHost && env.dbName && env.dbUser);
}

export function getPool() {
  if (!isDatabaseConfigured()) return null;
  if (!pool) {
    pool = new Pool({
      host: env.dbHost,
      port: env.dbPort,
      user: env.dbUser,
      password: env.dbPassword,
      database: env.dbName,
      max: env.databasePoolMax,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
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
