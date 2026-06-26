/**
 * Auth routes — magic link login, session management.
 * Owns: email-to-login-token flow, session creation, logout.
 * Does NOT own: dashboard rendering (see routes/dashboard.js).
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db/index');

const SESSION_DAYS = 30;

function makeToken()  { return crypto.randomBytes(32).toString('hex'); }
function makeId()    { return crypto.randomBytes(24).toString('base64url'); }

// Inline auth middleware (avoids circular require at module level)
function getSession(req) {
  const sid = req.headers['x-session-id'] || req.cookies?.session_id;
  if (!sid) return Promise.resolve({ rows: [] });
  return pool.query(`
    SELECT u.id, u.email, u.name FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = $1 AND s.expires_at > NOW()
  `, [sid]);
}

// GET /auth/login
router.get('/login', (req, res, next) => {
  getSession(req).then(({ rows }) => {
    if (rows.length > 0) return res.redirect('/dashboard');
    next();
  }).catch(next);
}, (_req, res) => {
  res.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in — HoldQuarter</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; background: #f9f6ef; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 16px; padding: 48px; width: 100%; max-width: 400px; box-shadow: 0 4px 20px rgba(13,43,26,0.1); }
    h1 { font-family: Georgia, serif; font-size: 28px; color: #0d2b1a; margin-bottom: 8px; }
    .sub { font-size: 15px; color: #7a7a72; margin-bottom: 32px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #0d2b1a; margin-bottom: 6px; }
    input { width: 100%; padding: 12px 16px; border: 1.5px solid rgba(13,43,26,0.2); border-radius: 8px; font-size: 16px; font-family: inherit; box-sizing: border-box; outline: none; }
    input:focus { border-color: #1a4731; }
    .btn { width: 100%; padding: 14px; background: #0d2b1a; color: #f9f6ef; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; margin-top: 20px; }
    .btn:hover { background: #1a4731; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .msg { padding: 12px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 20px; display: none; }
    .msg.ok { background: rgba(42,107,74,0.1); color: #1a4731; display: block; }
    .msg.err { background: rgba(180,40,40,0.08); color: #b42828; display: block; }
    .back { font-size: 13px; color: #7a7a72; text-align: center; margin-top: 16px; }
    .back a { color: #0d2b1a; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign in</h1>
    <p class="sub">Enter your email to receive a secure login link.</p>
    <div id="msg" class="msg"></div>
    <form id="f" novalidate>
      <label for="email">Email address</label>
      <input type="email" id="email" name="email" placeholder="you@example.com" required>
      <button type="submit" class="btn" id="btn">Send login link</button>
    </form>
    <p class="back"><a href="/">← Back to HoldQuarter</a></p>
  </div>
  <script>
    const f = document.getElementById('f');
    const msg = document.getElementById('msg');
    const btn = document.getElementById('btn');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      if (!email || !email.includes('@')) {
        msg.className = 'msg err';
        msg.textContent = 'Please enter a valid email address.';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        const r = await fetch('/auth/send-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const d = await r.json();
        if (d.ok) {
          msg.className = 'msg ok';
          msg.textContent = 'Check your email for a login link.';
          f.style.display = 'none';
        } else {
          msg.className = 'msg err';
          msg.textContent = d.error || 'Something went wrong. Please try again.';
          btn.disabled = false;
          btn.textContent = 'Send login link';
        }
      } catch {
        msg.className = 'msg err';
        msg.textContent = 'Network error — please try again.';
        btn.disabled = false;
        btn.textContent = 'Send login link';
      }
    });
  </script>
</body>
</html>`);
});

// POST /auth/send-link — uses Stytch if configured, falls back to legacy flow
router.post('/send-link', express.json(), async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  if (process.env.STYTCH_PROJECT_ID && process.env.STYTCH_SECRET) {
    try {
      const { sendMagicLink } = require('../services/stytch');
      await sendMagicLink(email);
    } catch (err) {
      console.error('[auth] Stytch send failed:', err.message, err.type);
    }
    return res.json({ ok: true }); // always ok to prevent email enumeration
  }

  // Legacy fallback
  const token = makeToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const upsertResult = await pool.query(`
    INSERT INTO users (email) VALUES ($1)
    ON CONFLICT (LOWER(email)) DO UPDATE SET email = EXCLUDED.email RETURNING id
  `, [email.toLowerCase().trim()]);
  const userId = upsertResult.rows[0].id;
  await pool.query(`DELETE FROM login_tokens WHERE expires_at < NOW()`);
  await pool.query(`
    INSERT INTO login_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)
    ON CONFLICT (token) DO UPDATE SET expires_at = $3, user_id = $2
  `, [token, userId, expiresAt]);

  const base = process.env.APP_URL || 'https://holdquarter.polsia.app';
  const loginUrl = `${base}/auth/verify?token=${token}`;
  const emailText = `Click this link to sign in:\n\n${loginUrl}\n\nIt expires in 15 minutes.`;

  let sent = false;
  if (process.env.POLSIA_EMAIL_PROXY_URL) {
    try {
      const resp = await fetch(process.env.POLSIA_EMAIL_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email, from: 'HoldQuarter <noreply@holdquarter.app>', subject: 'Your HoldQuarter login link', text: emailText }),
      });
      if (resp.ok) sent = true;
      else console.error('[auth] Email proxy failed:', resp.status, await resp.text());
    } catch (e) { console.error('[auth] Email proxy error:', e.message); }
  }
  if (!sent && process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      const nodemailer = require('nodemailer');
      const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT || '587'), auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      await transport.sendMail({ from: '"HoldQuarter" <noreply@holdquarter.app>', to: email, subject: 'Your HoldQuarter login link', text: emailText });
      sent = true;
    } catch (e) { console.error('[auth] SMTP send failed:', e.message); }
  }
  if (!sent) console.log(`[auth] DEV login link for ${email}: ${loginUrl}`);
  res.json({ ok: true });
});

// GET /auth/verify
router.get('/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect('/auth/login');

  const rows = (await pool.query(`
    SELECT user_id FROM login_tokens WHERE token = $1 AND expires_at > NOW()
  `, [token])).rows;

  if (rows.length === 0) {
    return res.type('text/html').send(`<!DOCTYPE html>
<html><body style="font-family:sans-serif;text-align:center;padding:80px">
  <h2 style="color:#b42828">Link expired or invalid</h2>
  <p><a href="/auth/login" style="color:#0d2b1a">Request a new link →</a></p>
</body></html>`);
  }

  const userId = rows[0].user_id;
  await pool.query('DELETE FROM login_tokens WHERE token = $1', [token]);

  // Check if onboarded
  const userRows = (await pool.query(`
    SELECT name, ein FROM users WHERE id = $1
  `, [userId])).rows;
  const onboarded = !!(userRows[0]?.name && userRows[0]?.ein);

  const sessionId = makeId();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
  await pool.query(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (id) DO UPDATE SET expires_at = $3
  `, [sessionId, userId, expiresAt]);

  const secure = !process.env.DATABASE_URL?.includes('localhost');
  res.cookie('session_id', sessionId, {
    httpOnly: true, secure, sameSite: 'lax',
    maxAge: SESSION_DAYS * 86400 * 1000, path: '/',
  });

  res.redirect(onboarded ? '/dashboard' : '/onboarding');
});

// GET /auth/logout
router.get('/logout', async (req, res) => {
  const sid = req.cookies?.session_id || req.headers['x-session-id'];
  if (sid) await pool.query('DELETE FROM sessions WHERE id = $1', [sid]).catch(() => {});
  res.clearCookie('session_id', { path: '/' });
  res.redirect('/');
});

// GET /auth/signup
router.get('/signup', (req, res, next) => {
  if (req.cookies?.session_id) {
    return res.redirect('/dashboard');
  }
  res.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Get started — HoldQuarter</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; background: #f9f6ef; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 16px; padding: 48px; width: 100%; max-width: 440px; box-shadow: 0 4px 20px rgba(13,43,26,0.1); }
    h1 { font-family: Georgia, serif; font-size: 28px; color: #0d2b1a; margin-bottom: 8px; }
    .sub { font-size: 15px; color: #7a7a72; margin-bottom: 32px; line-height: 1.5; }
    label { display: block; font-size: 13px; font-weight: 600; color: #0d2b1a; margin-bottom: 6px; }
    input { width: 100%; padding: 12px 16px; border: 1.5px solid rgba(13,43,26,0.2); border-radius: 8px; font-size: 16px; font-family: inherit; box-sizing: border-box; outline: none; }
    input:focus { border-color: #1a4731; }
    .btn { width: 100%; padding: 14px; background: #c9a84c; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; margin-top: 24px; transition: background 0.15s; }
    .btn:hover { background: #dfc06a; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .msg { padding: 12px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 20px; display: none; }
    .msg.ok { background: rgba(42,107,74,0.1); color: #1a4731; display: block; }
    .msg.err { background: rgba(180,40,40,0.08); color: #b42828; display: block; }
    .back { font-size: 13px; color: #7a7a72; text-align: center; margin-top: 16px; }
    .back a { color: #0d2b1a; text-decoration: none; }
    .divider { border: none; border-top: 1px solid rgba(13,43,26,0.1); margin: 28px 0; }
    .login-link { text-align: center; font-size: 14px; color: #7a7a72; }
    .login-link a { color: #0d2b1a; font-weight: 600; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Create your account</h1>
    <p class="sub">Enter your email to get started. We'll send a secure login link — no password needed.</p>
    <div id="msg" class="msg"></div>
    <form id="f" novalidate>
      <label for="email">Work email</label>
      <input type="email" id="email" name="email" placeholder="you@company.com" required autocomplete="email">
      <button type="submit" class="btn" id="btn">Continue with email</button>
    </form>
    <hr class="divider">
    <p class="login-link">Already have an account? <a href="/auth/login">Sign in</a></p>
    <p class="back" style="margin-top:12px"><a href="/">← Back to HoldQuarter</a></p>
  </div>
  <script>
    const f = document.getElementById('f');
    const msg = document.getElementById('msg');
    const btn = document.getElementById('btn');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      if (!email || !email.includes('@')) {
        msg.className = 'msg err';
        msg.textContent = 'Please enter a valid email address.';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        const r = await fetch('/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const d = await r.json();
        if (d.ok) {
          msg.className = 'msg ok';
          msg.textContent = 'Check your email for a login link.';
          f.style.display = 'none';
        } else {
          msg.className = 'msg err';
          msg.textContent = d.error || 'Something went wrong. Please try again.';
          btn.disabled = false;
          btn.textContent = 'Continue with email';
        }
      } catch {
        msg.className = 'msg err';
        msg.textContent = 'Network error — please try again.';
        btn.disabled = false;
        btn.textContent = 'Continue with email';
      }
    });
  </script>
</body>
</html>`);
});

// POST /auth/signup — uses Stytch if configured, falls back to legacy flow
router.post('/signup', express.json(), async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  if (process.env.STYTCH_PROJECT_ID && process.env.STYTCH_SECRET) {
    try {
      const { sendMagicLink } = require('../services/stytch');
      await sendMagicLink(email);
    } catch (err) {
      console.error('[auth] Stytch signup send failed:', err.message, err.type);
    }
    return res.json({ ok: true }); // always ok to prevent email enumeration
  }

  // Legacy fallback
  const token = makeToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const upsertResult = await pool.query(`
    INSERT INTO users (email) VALUES ($1)
    ON CONFLICT (LOWER(email)) DO UPDATE SET email = EXCLUDED.email RETURNING id
  `, [email.toLowerCase().trim()]);
  const userId = upsertResult.rows[0].id;
  await pool.query(`DELETE FROM login_tokens WHERE expires_at < NOW()`);
  await pool.query(`
    INSERT INTO login_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)
    ON CONFLICT (token) DO UPDATE SET expires_at = $3, user_id = $2
  `, [token, userId, expiresAt]);

  const base = process.env.APP_URL || 'https://holdquarter.polsia.app';
  const loginUrl = `${base}/auth/verify?token=${token}`;
  const emailText = `Welcome! Click this link to activate your account:\n\n${loginUrl}\n\nIt expires in 15 minutes.`;

  let sent = false;
  if (process.env.POLSIA_EMAIL_PROXY_URL) {
    try {
      const resp = await fetch(process.env.POLSIA_EMAIL_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email, from: 'HoldQuarter <noreply@holdquarter.app>', subject: 'Your HoldQuarter account', text: emailText }),
      });
      if (resp.ok) sent = true;
      else console.error('[auth] Email proxy failed:', resp.status, await resp.text());
    } catch (e) { console.error('[auth] Email proxy error:', e.message); }
  }
  if (!sent && process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      const nodemailer = require('nodemailer');
      const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT || '587'), auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      await transport.sendMail({ from: '"HoldQuarter" <noreply@holdquarter.app>', to: email, subject: 'Your HoldQuarter account', text: emailText });
      sent = true;
    } catch (e) { console.error('[auth] SMTP send failed:', e.message); }
  }
  if (!sent) console.log(`[auth] DEV signup link for ${email}: ${loginUrl}`);
  res.json({ ok: true });
});

module.exports = router;