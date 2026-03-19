/**
 * Zod validation middleware factory.
 *
 * Usage:
 *   import { validate } from '../middleware/validate.js';
 *   import { loginSchema } from '../schemas/auth.js';
 *   router.post('/login', validate(loginSchema), handler);
 */

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return res.status(400).json({
        error: 'Validierungsfehler',
        message: firstIssue?.message || 'Ungueltige Eingabe',
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return res.status(400).json({
        error: 'Validierungsfehler',
        message: firstIssue?.message || 'Ungueltige Abfrageparameter',
      });
    }
    req.query = result.data;
    next();
  };
}
