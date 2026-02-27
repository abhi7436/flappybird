import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

pool.on('connect', () => {
  console.log('[DB] Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
  process.exit(-1);
});

export { pool };

// ── pg-promise-style helper (used by new services) ─────────────
// Provides any/one/oneOrNone/none/result/tx so new code is
// consistent without requiring a second ORM dependency.
export const db = {
  any: async <T = any>(query: string, params?: unknown[]): Promise<T[]> => {
    const { rows } = await pool.query(query, params);
    return rows as T[];
  },
  one: async <T = any>(query: string, params?: unknown[]): Promise<T> => {
    const { rows } = await pool.query(query, params);
    if (!rows[0]) throw new Error('No data returned from query');
    return rows[0] as T;
  },
  oneOrNone: async <T = any>(query: string, params?: unknown[]): Promise<T | null> => {
    const { rows } = await pool.query(query, params);
    return (rows[0] ?? null) as T | null;
  },
  none: async (query: string, params?: unknown[]): Promise<void> => {
    await pool.query(query, params);
  },
  result: async (query: string, params?: unknown[]): Promise<{ rowCount: number }> => {
    const res = await pool.query(query, params);
    return { rowCount: res.rowCount ?? 0 };
  },
  tx: async <T>(fn: (t: TxHelper) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const t: TxHelper = {
        any:       async <R>(q: string, p?: unknown[]) => ((await client.query(q, p)).rows as R[]),
        one:       async <R>(q: string, p?: unknown[]) => {
          const r = await client.query(q, p);
          if (!r.rows[0]) throw new Error('No data returned');
          return r.rows[0] as R;
        },
        oneOrNone: async <R>(q: string, p?: unknown[]) => ((await client.query(q, p)).rows[0] ?? null) as R | null,
        none:      async (q: string, p?: unknown[]) => { await client.query(q, p); },
      };
      const result = await fn(t);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

interface TxHelper {
  any<T = any>(q: string, p?: unknown[]): Promise<T[]>;
  one<T = any>(q: string, p?: unknown[]): Promise<T>;
  oneOrNone<T = any>(q: string, p?: unknown[]): Promise<T | null>;
  none(q: string, p?: unknown[]): Promise<void>;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
