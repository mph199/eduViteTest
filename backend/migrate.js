import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './config/db.js';
import logger from './config/logger.js';
import { migrateToLatest } from './db/migrator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Run legacy SQL migrations (001-062).
 * These are kept for backward compatibility with existing deployments.
 * New migrations use the Kysely migrator (backend/db/migrations/).
 */
async function runLegacyMigrations() {
  const client = await pool.connect();
  try {
    // Create tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS applied_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Get already-applied migrations
    const { rows: applied } = await client.query(
      'SELECT filename FROM applied_migrations ORDER BY filename'
    );
    const appliedSet = new Set(applied.map(r => r.filename));

    // Read and sort migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      logger.info(`Applying legacy migration: ${file}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO applied_migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error({ err, file }, 'Legacy migration failed');
        throw err;
      }
    }

    if (count === 0) {
      logger.info('All legacy migrations already applied');
    } else {
      logger.info(`${count} legacy migration(s) applied`);
    }
  } finally {
    client.release();
  }
}

/**
 * Ensures 'Start' is the only superadmin in the DB.
 * All other DB users with superadmin role are demoted to admin.
 * Runs on every startup (container deploy).
 */
async function enforceSuperadminPolicy() {
  const client = await pool.connect();
  try {
    await client.query(
      "UPDATE users SET role = 'superadmin' WHERE username = 'Start' AND role != 'superadmin'"
    );
    const { rowCount } = await client.query(
      "UPDATE users SET role = 'admin' WHERE role = 'superadmin' AND username != 'Start'"
    );
    if (rowCount > 0) {
      logger.info(`Superadmin policy enforced: ${rowCount} user(s) demoted to admin`);
    }
  } finally {
    client.release();
  }
}

/**
 * Full database initialization:
 * 1. Run base schema (idempotent)
 * 2. Run legacy SQL migrations (001-062)
 * 3. Run Kysely migrations (001+)
 * 4. Enforce superadmin policy
 */
async function initDatabase() {
  // 1. Base schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const client = await pool.connect();
    try {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schema);
      logger.info('Base schema applied');
    } finally {
      client.release();
    }
  }

  // 2. Legacy SQL migrations
  await runLegacyMigrations();

  // 3. Kysely migrations (new system)
  await migrateToLatest();

  // 4. Superadmin policy
  await enforceSuperadminPolicy();
}

export { initDatabase, runLegacyMigrations as runMigrations };

// Allow running directly: node migrate.js
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  initDatabase()
    .then(() => { logger.info('Migration done'); process.exit(0); })
    .catch(err => { logger.fatal({ err }, 'Migration fatal'); process.exit(1); });
}
