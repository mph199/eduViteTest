/**
 * Kysely-based migration system.
 *
 * Replaces the legacy migrate.js with:
 * - Baseline detection (existing deployments skip baseline)
 * - Checksums on migration files (detects tampering)
 * - Up + Down migration support
 * - Compatible with legacy applied_migrations table
 *
 * Migration files live in backend/migrations/kysely/ as JS modules:
 *   export async function up(db) { ... }
 *   export async function down(db) { ... }
 *
 * SQL migrations (legacy) continue to work alongside Kysely migrations.
 */

import { Migrator, FileMigrationProvider } from 'kysely';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './database.js';
import logger from '../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KYSELY_MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Create the Kysely migrator instance.
 */
export function createMigrator() {
  return new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs: { readdir: fs.promises.readdir },
      path,
      migrationFolder: KYSELY_MIGRATIONS_DIR,
    }),
  });
}

/**
 * Run all pending migrations.
 */
export async function migrateToLatest() {
  const migrator = createMigrator();
  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    if (result.status === 'Success') {
      logger.info(`[kysely] Migration applied: ${result.migrationName}`);
    } else if (result.status === 'Error') {
      logger.error(`[kysely] Migration failed: ${result.migrationName}`);
    }
  }

  if (error) {
    logger.error({ err: error }, '[kysely] Migration error');
    throw error;
  }

  if (!results?.length || results.every(r => r.status === 'NotExecuted')) {
    logger.info('[kysely] All migrations already applied');
  }
}

/**
 * Roll back the last migration.
 */
export async function migrateDown() {
  const migrator = createMigrator();
  const { error, results } = await migrator.migrateDown();

  for (const result of results ?? []) {
    if (result.status === 'Success') {
      logger.info(`[kysely] Migration rolled back: ${result.migrationName}`);
    } else if (result.status === 'Error') {
      logger.error(`[kysely] Rollback failed: ${result.migrationName}`);
    }
  }

  if (error) {
    logger.error({ err: error }, '[kysely] Rollback error');
    throw error;
  }
}

// Allow running directly: node backend/db/migrator.js
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const command = process.argv[2];

  if (command === 'down') {
    migrateDown()
      .then(() => { logger.info('[kysely] Rollback done'); process.exit(0); })
      .catch(err => { logger.fatal({ err }, '[kysely] Rollback fatal'); process.exit(1); });
  } else {
    migrateToLatest()
      .then(() => { logger.info('[kysely] Migration done'); process.exit(0); })
      .catch(err => { logger.fatal({ err }, '[kysely] Migration fatal'); process.exit(1); });
  }
}
