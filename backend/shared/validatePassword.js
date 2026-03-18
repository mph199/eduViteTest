/**
 * Zentrale Passwort-Validierung.
 * Einzige Quelle fuer Passwort-Regeln im gesamten Backend.
 *
 * Regeln:
 *   - Mindestens 8 Zeichen
 *   - Mindestens 1 Grossbuchstabe
 *   - Mindestens 1 Kleinbuchstabe
 *   - Mindestens 1 Ziffer
 *
 * @param {string} password
 * @returns {{ valid: boolean, message?: string }}
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Passwort ist erforderlich' };
  }

  const trimmed = password.trim();

  if (trimmed.length < 8) {
    return { valid: false, message: 'Passwort muss mindestens 8 Zeichen haben' };
  }

  if (!/[A-Z]/.test(trimmed)) {
    return { valid: false, message: 'Passwort muss mindestens einen Grossbuchstaben enthalten' };
  }

  if (!/[a-z]/.test(trimmed)) {
    return { valid: false, message: 'Passwort muss mindestens einen Kleinbuchstaben enthalten' };
  }

  if (!/[0-9]/.test(trimmed)) {
    return { valid: false, message: 'Passwort muss mindestens eine Ziffer enthalten' };
  }

  return { valid: true };
}
