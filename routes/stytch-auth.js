/**
 * Stytch auth routes — replaces broken custom magic link email flow.
 * Owns: send magic link via Stytch, authenticate token, create local session.
 * Does NOT own: Stytch client (see services/stytch.js), webhook handling.
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const stytch = require('../services/stytch');
const pool = require('../db/index');

const SESSION_DAYS = 7;

function makeId() { return crypto.randomBytes(24).toString('base64url'); }

/** Create a local HoldQuarter session for the Stytch user. */
async function upsertLocalSession(stytchUserId, email) {
  const userRow = await pool.query(`
    INSERT INTO users (email)
    VALUES ($1)
    ON CONFLICT (LOWER(email)) DO UPDATE SET email = EXCLUDED.email
    RETURNING id, name, ein
  `, [email.toLowerCase().trim()]);
  const userId = userRow.rows[0].id;

  const sessionId = makeId();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);

  await pool.query(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (id) DO UPDATE SET expires_at = $3
  `, [sessionId, userId, expiresAt]);

  return { sessionId, userId };
}

// POST /api/stytch/send — send magic link
router.post('/send', express.json(), async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (!process.env.STYTCH_PROJECT_ID || !process.env.STYTCH_SECRET) {
    return res.status(503).json({ error: 'Stytch not configured' });
  }

  try {
    await stytch.sendMagicLink(email);
  } catch (err) {
    console.error('[stytch] send failed:', err.message, err.type);
  }
  // Always return ok to prevent email enumeration
  res.json({ ok: true });
});

// GET /api/stytch/authenticate — called when user clicks magic link
router.get('/authenticate', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect('/auth/login');

  if (!process.env.STYTCH_PROJECT_ID || !process.env.STYTCH_SECRET) {
    return res.type('text/html').send(`<!DOCTYPE html>
<html><body style="font-family:sans-serif;text-align:center;padding:80px">
  <h2>Authentication unavailable</h2>
  <p>Stytch is not configured. Please contact support.</p>
  <p><a href="/auth/login">Back to login</a></p>
</body></html>`);
  }

  let stytchUser;
  try {
    stytchUser = await stytch.authenticateToken(token);
  } catch (err) {
    return res.type('text/html').send(`<!DOCTYPE html>
<html><body style="font-family:sans-serif;text-align:center;padding:80px">
  <h2 style="color:#b42828">${err.type === 'invalid_token' ? 'Link expired or already used' : 'Authentication failed'}</h2>
  <p><a href="/auth/login" style="color:#0d2b1a">Request a new link →</a></p>
</body></html>`);
  }

  const { sessionId, userId } = await upsertLocalSession(stytchUser.userId, stytchUser.email);

  const secure = !process.env.DATABASE_URL?.includes('localhost');
  res.cookie('session_id', sessionId, {
    httpOnly: true, secure, sameSite: 'lax',
    maxAge: SESSION_DAYS * 86400 * 1000, path: '/',
  });

  const userRow = (await pool.query('SELECT name, ein FROM users WHERE id = $1', [userId])).rows[0];
  const onboarded = !!(userRow?.name && userRow?.ein);

  res.redirect(onboarded ? '/dashboard' : '/onboarding');
});

// GET /api/stytch/session — return current session info
router.get('/session', async (req, res) => {
  const sid = req.headers['x-session-id'] || req.cookies?.session_id;
  if (!sid) return res.json({ authenticated: false });

  const rows = (await pool.query(`
    SELECT u.id, u.email, u.name, u.ein, u.default_withholding_rate
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = $1 AND s.expires_at > NOW()
  `, [sid])).rows;

  if (!rows.length) return res.json({ authenticated: false });
  const user = rows[0];
  res.json({ authenticated: true, user: { id: user.id, email: user.email, name: user.name, ein: user.ein, onboarded: !!(user.name && user.ein) } });
});

// DELETE /api/stytch/logout
router.delete('/logout', async (req, res) => {
  const sid = req.headers['x-session-id'] || req.cookies?.session_id;
  if (sid) await pool.query('DELETE FROM sessions WHERE id = $1', [sid]).catch(() => {});
  res.clearCookie('session_id', { path: '/' });
  res.json({ ok: true });
});

module.exports = router;