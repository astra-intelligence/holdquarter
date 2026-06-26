/**
 * Stytch integration via REST API (Node 20+ native fetch, no SDK needed).
 * Owns: sending magic links, authenticating tokens, session management.
 * Does NOT own: local session creation (see routes/stytch-auth.js), webhook delivery (Svix).
 */

const BASE_URL = 'https://api.stytch.com/v1';

function authHeader() {
  const creds = Buffer.from(`${process.env.STYTCH_PROJECT_ID}:${process.env.STYTCH_SECRET}`).toString('base64');
  return `Basic ${creds}`;
}

function apiPath(path) {
  return `${BASE_URL}${path}`;
}

async function stytchFetch(path, method, body) {
  const opts = {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(apiPath(path), opts);
  const data = await resp.json();
  if (!resp.ok) {
    const err = new Error(data.error?.error_message || `Stytch ${resp.status}`);
    err.status = resp.status;
    err.type = data.error?.error_type;
    throw err;
  }
  return data;
}

/** Send a magic link login email. Stytch delivers the email directly. */
async function sendMagicLink(email) {
  const base = process.env.APP_URL || 'https://holdquarter.polsia.app';
  return stytchFetch('/magic_links/email/login_or_create', 'POST', {
    email: email.toLowerCase().trim(),
    login_magic_link_url: `${base}/api/stytch/authenticate`,
    signup_magic_link_url: `${base}/api/stytch/authenticate`,
  });
}

/** Authenticate a magic link token. Returns { userId, sessionToken, sessionJwt, email } or throws. */
async function authenticateToken(token) {
  const data = await stytchFetch('/magic_links/authenticate', 'POST', {
    token,
    session_duration_minutes: 60 * 24 * 7, // 7 days
  });
  return {
    userId: data.user_id,
    sessionToken: data.session_token,
    sessionJwt: data.session_jwt,
    email: data.email_address,
  };
}

/** Get user info from Stytch by user ID. */
async function getUser(userId) {
  return stytchFetch(`/users/${userId}`, 'GET');
}

/** Revoke a Stytch session (logout). */
async function revokeSession(sessionId) {
  return stytchFetch(`/sessions/${sessionId}`, 'DELETE');
}

module.exports = { sendMagicLink, authenticateToken, getUser, revokeSession };