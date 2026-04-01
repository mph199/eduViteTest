/**
 * Migration 002: Zombie table cleanup
 *
 * - Deactivate all bl_topics and ssw_categories (active=false)
 *   These tables are functionally unused since the topic/category
 *   removal (migration 035/059) but retain FK references.
 * - Add missing RLS policy for events table (ENABLE without policy
 *   blocks all direct DB access)
 */

import { sql } from 'kysely';

export async function up(db) {
  // Mark all remaining topics/categories as inactive
  await sql`UPDATE bl_topics SET active = false WHERE active = true`.execute(db);
  await sql`UPDATE ssw_categories SET active = false WHERE active = true`.execute(db);

  // Fix: events has ENABLE RLS but no policy — add permissive policy
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'app_full_access_events') THEN
        CREATE POLICY app_full_access_events ON events FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END $$
  `.execute(db);

  // Fix: slots has FORCE RLS but ENABLE was missing
  await sql`ALTER TABLE slots ENABLE ROW LEVEL SECURITY`.execute(db);
}

export async function down(db) {
  // Re-enable topics/categories (reversible)
  await sql`UPDATE bl_topics SET active = true`.execute(db);
  await sql`UPDATE ssw_categories SET active = true`.execute(db);
}
