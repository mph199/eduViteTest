/**
 * Middleware: Require teacher role (teacher, admin, or superadmin).
 */
export function requireTeacher(req, res, next) {
  if (req.user && (req.user.role === 'teacher' || req.user.role === 'admin' || req.user.role === 'superadmin')) {
    return next();
  }
  return res.status(403).json({
    error: 'Forbidden',
    message: 'Teacher access required'
  });
}
