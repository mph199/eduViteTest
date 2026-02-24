/**
 * PostgreSQL connection pool – replaces the Supabase JS client.
 *
 * Environment variables (set in backend/.env):
 *   DATABASE_URL          – full connection string, e.g.
 *                           postgresql://user:pass@localhost:5432/sprechtag
 *   — OR individual vars —
 *   DB_HOST               – default: localhost
 *   DB_PORT               – default: 5432
 *   DB_NAME               – default: sprechtag
 *   DB_USER               – default: postgres
 *   DB_PASSWORD            – (required when not using DATABASE_URL)
 *   DB_SSL                – "true" to enable SSL (rejectUnauthorized=false)
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 1) Load from cwd (npm run dev in backend/)
dotenv.config();

// 2) Fallback: load backend/.env relative to this file (scripts run from repo root)
if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
}

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'sprechtag',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    };

if (process.env.DB_SSL === 'true') {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new pg.Pool(poolConfig);

// Log connection info once (no secrets)
pool.on('connect', () => {
  if (!pool._loggedOnce) {
    const target = process.env.DATABASE_URL
      ? process.env.DATABASE_URL.replace(/\/\/.*@/, '//***@')
      : `${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`;
    console.log(`[db] Connected to PostgreSQL: ${target}`);
    pool._loggedOnce = true;
  }
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error', err);
});

// ──────────────────────────────────────────────────────────────────────────────
// Helper: thin query wrapper identical to pool.query but with consistent API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Execute a SQL query.
 * @param {string} text  – SQL with $1, $2, … placeholders
 * @param {any[]}  [params] – parameter values
 * @returns {Promise<pg.QueryResult>}  – { rows, rowCount, fields, … }
 */
export function query(text, params) {
  return pool.query(text, params);
}

/**
 * Acquire a client from the pool for transactions.
 * Caller MUST call client.release() when done.
 */
export function getClient() {
  return pool.connect();
}

export default pool;
