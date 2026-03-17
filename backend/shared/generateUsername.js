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
