/**
 * Session middleware — reads the Polsia session cookie and attaches user to req.
 * If unauthenticated, redirects to /login. Meant for app routes only.
 */
const pool = require('../db/index');

async function requireAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'] || req.cookies?.session_id;

  if (!sessionId) {
    if (req.headers['accept'] === 'application/json') {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.redirect('/login');
  }

  const rows = (await pool.query(`
    SELECT u.id, u.email, u.name, u.default_withholding_rate
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = $1 AND s.expires_at > NOW()
  `, [sessionId])).rows;

  if (rows.length === 0) {
    if (req.headers['accept'] === 'application/json') {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }
    res.clearCookie('session_id');
    return res.redirect('/login');
  }

  req.user = rows[0];
  next();
}

async function optionalAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'] || req.cookies?.session_id;
  if (!sessionId) return next();

  const rows = (await pool.query(`
    SELECT u.id, u.email, u.name, u.default_withholding_rate
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = $1 AND s.expires_at > NOW()
  `, [sessionId])).rows;

  if (rows.length > 0) req.user = rows[0];
  next();
}

module.exports = { requireAuth, optionalAuth };