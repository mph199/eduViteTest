/**
 * Kysely database instance — type-safe query builder.
 *
 * Shares the same pg.Pool as the legacy `query()` helper in config/db.js.
 * During migration, both can coexist. Once all `query()` calls are replaced,
 * config/db.js can be simplified to only export the pool for Kysely.
 *
 * Usage:
 *   import { db } from '../db/database.js';
 *   const users = await db.selectFrom('users').select(['id', 'username']).execute();
 */

import { Kysely, PostgresDialect } from 'kysely';
import pool from '../config/db.js';

/** @type {Kysely<import('./types.js').DB>} */
export const db = new Kysely({
  dialect: new PostgresDialect({ pool }),
});

export default db;
