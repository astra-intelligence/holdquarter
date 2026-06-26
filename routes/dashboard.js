/**
 * Dashboard routes — user-facing withholding balance and management.
 * Owns: dashboard view, ledger summary queries, Stripe bank connect.
 * Does NOT own: raw webhook processing (see routes/webhook.js).
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const dbLedger = require('../db/ledger');
const dbSettings = require('../db/settings');
const pool = require('../db/index');

// GET /dashboard — main withholding dashboard
router.get('/', requireAuth, async (req, res) => {
  try {
    const [currentQ, quarterlyTotals, recent] = await Promise.all([
      dbLedger.getCurrentQuarterBalance(req.user.id),
      dbLedger.getQuarterlyTotals(req.user.id),
      dbLedger.getRecentTransactions(req.user.id, 15),
    ]);

    const rate = await dbSettings.getRate(req.user.id);
    const currentQuarter = dbLedger.getQuarter();

    const targetAmount = parseFloat(currentQ.gross) * rate;
    const fundedPct = targetAmount > 0
      ? Math.min(100, Math.round((parseFloat(currentQ.withheld) / targetAmount) * 100))
      : 0;

    // Check Stripe bank account status
    let stripeConnected = false;
    let stripeCustomerId = null;
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const Stripe = require('stripe');
        const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
        const userRows = await pool.query(
          'SELECT stripe_customer_id FROM users WHERE id = $1', [req.user.id]
        );
        stripeCustomerId = userRows.rows[0]?.stripe_customer_id || null;
        if (stripeCustomerId) {
          const customer = await stripe.customers.retrieve(stripeCustomerId);
          stripeConnected = !!(customer.external_accounts?.data?.length > 0 || customer.default_source);
        }
      } catch (e) {
        console.warn('[dashboard] Stripe check failed:', e.message);
      }
    }

    res.render('dashboard', {
      user: req.user,
      currentQuarter,
      balance: currentQ,
      quarterlyTotals,
      recentTransactions: recent,
      rate: parseFloat((rate * 100).toFixed(1)),
      fundedPct,
      stripeConnected,
      stripeCustomerId,
      stripeKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      navColor: 'forest',
    });
  } catch (err) {
    console.error('[dashboard] render error:', err.message);
    res.status(500).send('Failed to load dashboard');
  }
});

// GET /dashboard/api/summary — JSON summary for AJAX refresh
router.get('/api/summary', requireAuth, async (req, res) => {
  try {
    const [currentQ, quarterlyTotals] = await Promise.all([
      dbLedger.getCurrentQuarterBalance(req.user.id),
      dbLedger.getQuarterlyTotals(req.user.id),
    ]);
    const rate = await dbSettings.getRate(req.user.id);

    const targetAmount = parseFloat(currentQ.gross) * rate;
    const fundedPct = targetAmount > 0
      ? Math.min(100, Math.round((parseFloat(currentQ.withheld) / targetAmount) * 100))
      : 0;

    res.json({
      currentQuarter: dbLedger.getQuarter(),
      withheld: parseFloat(currentQ.withheld),
      gross: parseFloat(currentQ.gross),
      transactions: parseInt(currentQ.transactions),
      fundedPct,
      rate: parseFloat((rate * 100).toFixed(1)),
      quarterlyTotals: quarterlyTotals.map(q => ({
        quarter: q.quarter,
        gross: parseFloat(q.total_gross),
        withheld: parseFloat(q.total_withheld),
        count: parseInt(q.transaction_count),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

// POST /dashboard/api/stripe-connect — create Stripe customer + connect link
router.post('/api/stripe-connect', requireAuth, async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }
  try {
    const Stripe = require('stripe');
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const user = req.user;

    // Get or create Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { holdquarter_user_id: String(user.id) },
      });
      customerId = customer.id;
      await pool.query(
        'UPDATE users SET stripe_customer_id = $2 WHERE id = $1',
        [user.id, customerId]
      );
    }

    // Create account link for onboarding external bank account
    const accountLink = await stripe.accountLinks.create({
      account: customerId,
      refresh_url: `${process.env.APP_URL || 'https://holdquarter.polsia.app'}/dashboard`,
      return_url: `${process.env.APP_URL || 'https://holdquarter.polsia.app'}/dashboard?stripe=connected`,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    console.error('[dashboard] stripe-connect error:', err.message);
    res.status(500).json({ error: 'Failed to create Stripe connect link' });
  }
});

module.exports = router;