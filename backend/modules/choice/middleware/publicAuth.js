/**
 * Public-Auth-Middleware fuer Choice-Modul.
 *
 * Prüft das `choice_session`-Cookie (separates JWT vom Admin-Cookie `token`).
 * Extrahiert participantId und groupId in req.choiceSession.
 */

import jwt from 'jsonwebtoken';
import logger from '../../../config/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;
const log = logger.child({ component: 'choice-public-auth' });

/**
 * Erzeugt ein signiertes JWT für die Choice-Session.
 * Kurze Laufzeit (2h), enthält nur participantId + groupId.
 */
export function createChoiceSessionToken(participantId, groupId) {
  return jwt.sign(
    { participantId, groupId, type: 'choice_session' },
    JWT_SECRET,
    { expiresIn: '2h' },
  );
}

/**
 * Cookie-Optionen für choice_session (getrennt vom Admin-JWT).
 */
export function choiceCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieSecure = process.env.COOKIE_SECURE && process.env.COOKIE_SECURE !== ''
    ? process.env.COOKIE_SECURE === 'true'
    : isProduction;

  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'strict',
    maxAge: 2 * 60 * 60 * 1000,
    path: '/api/choice',
  };
}

/**
 * Middleware: Prüft choice_session Cookie.
 * Setzt req.choiceSession = { participantId, groupId } bei Erfolg.
 */
export function requireChoiceSession(req, res, next) {
  const token = req.cookies?.choice_session;
  if (!token) {
    return res.status(401).json({ error: 'Nicht autorisiert', message: 'Bitte zuerst verifizieren' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'choice_session') {
      return res.status(401).json({ error: 'Nicht autorisiert', message: 'Ungültiges Session-Token' });
    }
    req.choiceSession = {
      participantId: decoded.participantId,
      groupId: decoded.groupId,
    };
    next();
  } catch (err) {
    log.debug({ err: err.message }, 'Choice session token invalid');
    return res.status(401).json({ error: 'Nicht autorisiert', message: 'Session abgelaufen' });
  }
}
