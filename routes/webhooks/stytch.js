/**
 * Stytch webhook handler — receives events via Svix.
 * Events: user.created, user.updated, session.created, session.revoked.
 * Owns: webhook verification, event routing.
 * Does NOT own: local session creation (upserts happen via stytch-auth.js on auth).
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../../db/index');

/**
 * Svix webhook signature verification.
 * Stytch delivers webhooks via Svix; we verify using HMAC-SHA256 against the signing secret.
 */
function verifySvixWebhook(payload, headers, secret) {
  const timestamp = headers['svix-timestamp'];
  const signature = headers['svix-signature'];
  if (!timestamp || !signature) return false;

  const timestampNum = parseInt(timestamp, 10);
  if (Math.abs(Date.now() / 1000 - timestampNum) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  const receivedSigs = signature.split(',');
  return receivedSigs.some(sig => {
    const [k, v] = sig.trim().split('=');
    return k === 'v1' && crypto.timingSafeEqual(Buffer.from(v, 'hex'), Buffer.from(expected, 'hex'));
  });
}

router.post('/stytch', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = process.env.STYTCH_WEBHOOK_SECRET;
  const rawBody = req.body.toString();

  if (secret && !verifySvixWebhook(rawBody, req.headers, secret)) {
    console.error('[stytch-webhook] signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  console.log(`[stytch-webhook] ${event.event_type} | id: ${event.id}`);
  try {
    await handleEvent(event);
  } catch (err) {
    console.error('[stytch-webhook] error:', err.message);
  }

  res.json({ received: true });
});

async function handleEvent(event) {
  const { event_type, data } = event;
  const obj = data?.object || {};

  if (event_type === 'user.created' || event_type === 'user.updated') {
    if (obj.email) {
      await pool.query(`
        INSERT INTO users (email)
        VALUES ($1)
        ON CONFLICT (LOWER(email)) DO UPDATE SET email = EXCLUDED.email
      `, [obj.email.toLowerCase()]);
    }
  }

  if (event_type === 'session.revoked') {
    console.log(`[stytch-webhook] session revoked: ${obj.session_id} user: ${obj.user_id}`);
  }
}

module.exports = router;