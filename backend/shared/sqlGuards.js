/**
 * Shared SQL identifier validation.
 *
 * Prevents SQL injection when table/column names are interpolated
 * into query strings (identifiers cannot be parameterized with $1).
 */

/** Only lowercase letters, digits, and underscores – must start with a letter. */
const SAFE_IDENTIFIER = /^[a-z][a-z0-9_]*$/;

/**
 * Throws if `value` is not a safe SQL identifier.
 * @param {string} value – the identifier to validate
 * @param {string} label – description for the error message
 */
export function assertSafeIdentifier(value, label) {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new Error(`Invalid SQL identifier for ${label}: "${value}"`);
  }
}
