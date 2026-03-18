/**
 * Generate a username from first and last name with German umlaut transliteration.
 * Shared utility – used by teacherRoutes and counselorAdminRoutes.
 *
 * @param {string} firstName
 * @param {string} lastName
 * @param {string|number} fallbackId – used if both names are empty
 * @param {string} [fallbackPrefix='user'] – prefix for fallback username
 * @returns {string} normalized username (max 30 chars)
 */
export function generateUsername(firstName, lastName, fallbackId, fallbackPrefix = 'user') {
  const normalize = (str) =>
    String(str || '')
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '');

  const first = normalize(firstName);
  const last = normalize(lastName);

  return (
    first && last
      ? `${first}.${last}`
      : first || last || `${fallbackPrefix}${fallbackId}`
  ).slice(0, 30);
}

/**
 * Generate a unique username by appending a numeric suffix if the base name is taken.
 * Requires a DB query function to check for existing usernames.
 *
 * @param {string} firstName
 * @param {string} lastName
 * @param {string|number} fallbackId
 * @param {string} fallbackPrefix
 * @param {(text: string, params: unknown[]) => Promise<{rows: unknown[]}>} queryFn
 * @returns {Promise<string>}
 */
export async function generateUniqueUsername(firstName, lastName, fallbackId, fallbackPrefix, queryFn) {
  const base = generateUsername(firstName, lastName, fallbackId, fallbackPrefix);

  const { rows } = await queryFn('SELECT 1 FROM users WHERE username = $1', [base]);
  if (rows.length === 0) return base;

  for (let i = 2; i <= 100; i++) {
    const suffix = String(i);
    const candidate = `${base.slice(0, 30 - suffix.length)}${suffix}`;
    const { rows: existing } = await queryFn('SELECT 1 FROM users WHERE username = $1', [candidate]);
    if (existing.length === 0) return candidate;
  }

  // Fallback: timestamp-based to guarantee uniqueness
  return `${fallbackPrefix}${Date.now()}`.slice(0, 30);
}
