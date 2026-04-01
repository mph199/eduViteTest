/**
 * Smoke test: verify Kysely connects and queries work.
 * Run: node backend/db/smoke-test.js
 *
 * Expected output: "Kysely smoke test passed — N tables found"
 * This file is NOT part of the production build.
 */

import { db } from './database.js';

try {
  // Simple introspection query — works on any PostgreSQL
  const result = await db
    .selectFrom('applied_migrations')
    .select('filename')
    .orderBy('applied_at', 'desc')
    .limit(3)
    .execute();

  console.log(`Kysely smoke test passed — ${result.length} recent migrations:`);
  for (const row of result) {
    console.log(`  ${row.filename}`);
  }
} catch (err) {
  console.error('Kysely smoke test FAILED:', err.message);
  process.exit(1);
} finally {
  await db.destroy();
}
