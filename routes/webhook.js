/**
 * Webhook endpoints — payment processing and withholding rate management.
 * Owns: receiving payments, calculating withholdings, rate configuration.
 * Does NOT own: dashboard views (see routes/dashboard.js).
 */
const express = require('express');
const router = express.Router();
const dbLedger = require('../db/ledger');
const dbSettings = require('../db/settings');
const pool = require('../db/index');
const crypto = require('crypto');

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// POST /api/webhook/payment — receive a Stripe payment and record withholding
router.post('/payment', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    if (WEBHOOK_SECRET) {
      event = verifyStripeWebhook(req.body, sig, WEBHOOK_SECRET);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('[webhook] signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  if (event.type !== 'checkout.session.completed' && event.type !== 'payment_intent.succeeded') {
    return res.status(200).json({ received: true, skipped: event.type });
  }

  const session = event.data.object;
  const paymentAmount = (session.amount_total || session.amount) / 100;
  const payerEmail = session.customer_email || session.metadata?.customer_email || '';
  const paymentId = session.id;

  if (!payerEmail || paymentAmount <= 0) {
    return res.status(400).json({ error: 'Missing email or invalid amount' });
  }

  // Find or create user by email
  let userRows = (await pool.query(`
    SELECT id FROM users WHERE LOWER(email) = LOWER($1)
  `, [payerEmail])).rows;

  if (userRows.length === 0) {
    const [user] = (await pool.query(`
      INSERT INTO users (email) VALUES ($1) ON CONFLICT (LOWER(email)) DO UPDATE SET email = EXCLUDED.email RETURNING id
    `, [payerEmail])).rows;
    userRows = [{ id: user.id }];
  }

  const userId = userRows[0].id;

  try {
    const rate = await dbSettings.getRate(userId);
    const withholdingAmount = Math.round(paymentAmount * rate * 100) / 100;

    await dbLedger.addWithholding({
      userId,
      paymentId,
      paymentAmount,
      withholdingAmount,
      withholdingRate: rate,
      note: `Stripe ${event.type} — ${paymentId}`,
    });

    console.log(`[webhook] withholding recorded: $${withholdingAmount} (${(rate * 100).toFixed(1)}%) on $${paymentAmount} for user ${userId}`);
    res.status(200).json({ received: true, withheld: withholdingAmount, rate });
  } catch (err) {
    console.error('[webhook] ledger error:', err.message);
    res.status(500).json({ error: 'Failed to record withholding' });
  }
});

// POST /api/webhook/manual — receive a manually-entered payment amount (for testing/dev)
router.post('/manual', express.json(), async (req, res) => {
  const { email, amount } = req.body;
  if (!email || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'email and positive amount required' });
  }

  let userRows = (await pool.query(`
    SELECT id FROM users WHERE LOWER(email) = LOWER($1)
  `, [email])).rows;

  let userId;
  if (userRows.length === 0) {
    const [user] = (await pool.query(`
      INSERT INTO users (email) VALUES ($1) ON CONFLICT (LOWER(email)) DO UPDATE SET email = EXCLUDED.email RETURNING id
    `, [email])).rows;
    userId = user.id;
  } else {
    userId = userRows[0].id;
  }

  const rate = await dbSettings.getRate(userId);
  const withholdingAmount = Math.round(amount * rate * 100) / 100;
  const paymentId = `manual-${Date.now()}`;

  await dbLedger.addWithholding({
    userId,
    paymentId,
    paymentAmount: amount,
    withholdingAmount,
    withholdingRate: rate,
    note: 'Manual entry',
  });

  res.status(200).json({ withheld: withholdingAmount, rate, gross: amount });
});

// GET /api/withholding/rate — get current withholding rate
router.get('/rate', async (req, res) => {
  const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null;
  if (!userId) return res.status(400).json({ error: 'x-user-id header required' });

  const rate = await dbSettings.getRate(userId);
  res.json({ rate: parseFloat(rate.toFixed(4)) });
});

// PUT /api/withholding/rate — update withholding rate
router.put('/rate', express.json(), async (req, res) => {
  const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null;
  if (!userId) return res.status(400).json({ error: 'x-user-id header required' });

  const { rate } = req.body;
  if (typeof rate !== 'number') {
    return res.status(400).json({ error: 'rate must be a number between 0 and 1' });
  }

  try {
    await dbSettings.setRate(userId, rate);
    res.json({ rate: parseFloat(rate.toFixed(4)), updated: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Health check for webhook endpoint
router.get('/health', (_req, res) => res.json({ status: 'ok' }));

function verifyStripeWebhook(body, sig, secret) {
  const parts = sig.split(',');
  const ts = parts.find(p => p.startsWith('t='))?.slice(2);
  const v1  = parts.find(p => p.startsWith('v1='))?.slice(3);
  if (!ts || !v1) throw new Error('Missing signature fields');

  const expected = crypto.createHmac('sha256', secret)
    .update(`${ts}.${body}`)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected))) {
    throw new Error('Signature mismatch');
  }

  return JSON.parse(body.toString());
}

module.exports = router;