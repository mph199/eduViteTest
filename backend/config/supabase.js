import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 1) Load from current working directory (works for `npm run dev` in backend)
dotenv.config();

// 2) Fallback: load backend/.env relative to this file (works when running scripts from repo root)
// Prefer to have SUPABASE_SERVICE_ROLE_KEY available; if it's missing, try backend/.env.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_URL) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
}

const supabaseUrl = process.env.SUPABASE_URL || 'https://hkavljocvckejejcwatw.supabase.co';
// Backend should use a server-side key (service role) so RLS-enabled tables work correctly.
// Keep this key on the server only; never expose it to the frontend.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_KEY environment variable is required');
}

// Warn if a publishable/anon key is used (common cause of RLS insert/update failures).
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const keyStr = String(supabaseKey);
  if (keyStr.includes('publishable') || keyStr.includes('anon')) {
    console.warn(
      '[supabase] Using publishable/anon key. If RLS is enabled on tables (e.g., events/feedback), writes may fail. ' +
      'Set SUPABASE_SERVICE_ROLE_KEY in backend/.env.'
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey);
