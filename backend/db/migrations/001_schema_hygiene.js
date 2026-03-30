/**
 * Migration 001: Schema hygiene fixes
 *
 * - ssw_counselors.created_at: add NOT NULL constraint (backlog N3)
 * - teachers.email: add index for lookup performance (backlog H10)
 */

import { sql } from 'kysely';

export async function up(db) {
  // Fill any NULL created_at values before adding constraint
  await sql`
    UPDATE ssw_counselors SET created_at = NOW() WHERE created_at IS NULL
  `.execute(db);

  await sql`
    ALTER TABLE ssw_counselors ALTER COLUMN created_at SET NOT NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email)
  `.execute(db);
}

export async function down(db) {
  await sql`
    ALTER TABLE ssw_counselors ALTER COLUMN created_at DROP NOT NULL
  `.execute(db);

  await sql`
    DROP INDEX IF EXISTS idx_teachers_email
  `.execute(db);
}
