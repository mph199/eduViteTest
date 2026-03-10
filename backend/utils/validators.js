/**
 * Shared validation helpers for teacher fields.
 */

export function normalizeAndValidateTeacherEmail(rawEmail) {
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const isValid = /^[a-z0-9._%+-]+@bksb\.nrw$/i.test(email);
  if (!email || !isValid) {
    return { ok: false, email: null };
  }
  return { ok: true, email };
}

export function normalizeAndValidateTeacherSalutation(raw) {
  const salutation = typeof raw === 'string' ? raw.trim() : '';
  const allowed = new Set(['Herr', 'Frau', 'Divers']);
  if (!salutation || !allowed.has(salutation)) {
    return { ok: false, salutation: null };
  }
  return { ok: true, salutation };
}
