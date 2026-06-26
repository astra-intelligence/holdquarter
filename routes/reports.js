/**
 * Enhanced dashboard API — interest summary, IRS payment management, CSV export.
 * Owns: JSON endpoints for interest, IRS deadlines, 1099 data, and transaction export.
 * Does NOT own: raw webhook processing (see routes/webhook.js).
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const dbInterest = require('../db/interest');
const dbIrs = require('../db/irs');
const dbAutoPay = require('../db/auto_pay');
const dbLedger = require('../db/ledger');
const dbSettings = require('../db/settings');
const pool = require('../db/index');

// GET /api/reports/interest — interest earned this quarter and YTD
router.get('/interest', requireAuth, async (req, res) => {
  try {
    const summary = await dbInterest.getInterestSummary(req.user.id);
    const nextDeadline = dbIrs.getNextIRSDeadline();
    res.json({
      thisQuarter: summary.thisQuarter,
      ytd: summary.ytd,
      nextIRSDeadline: nextDeadline.deadline.toISOString(),
      nextIRSQuarter: nextDeadline.label,
    });
  } catch (err) {
    console.error('[reports] interest error:', err.message);
    res.status(500).json({ error: 'Failed to load interest data' });
  }
});

// GET /api/reports/irs — upcoming IRS payment and auto-pay status
router.get('/irs', requireAuth, async (req, res) => {
  try {
    const nextDeadline = dbIrs.getNextIRSDeadline();
    const upcoming = await dbIrs.getUpcomingIRSPayment(req.user.id, nextDeadline.label);
    const settings = await dbAutoPay.getSettings(req.user.id);
    const balance = await dbLedger.getCurrentQuarterBalance(req.user.id);
    const rate = await dbSettings.getRate(req.user.id);
    const quarterlyTotal = await pool.query(`
      SELECT COALESCE(SUM(withholding_amount), 0) AS total
      FROM escrow_ledger WHERE user_id = $1 AND quarter = $2
    `, [req.user.id, nextDeadline.label]);
    const withheldAmt = parseFloat(quarterlyTotal.rows[0]?.total || 0);

    res.json({
      nextDeadline: nextDeadline.deadline.toISOString(),
      nextIRSQuarter: nextDeadline.label,
      estimatedAmount: parseFloat((withheldAmt).toFixed(2)),
      upcomingPayment: upcoming || null,
      autoPayEnabled: settings.irs_auto_pay,
      status: upcoming?.status || 'pending',
    });
  } catch (err) {
    console.error('[reports] irs error:', err.message);
    res.status(500).json({ error: 'Failed to load IRS data' });
  }
});

// POST /api/reports/irs/auto-pay — toggle IRS auto-pay on/off
router.post('/irs/auto-pay', requireAuth, async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    await dbAutoPay.setIRSautoPay(req.user.id, enabled);
    res.json({ irs_auto_pay: enabled });
  } catch (err) {
    console.error('[reports] auto-pay error:', err.message);
    res.status(500).json({ error: 'Failed to update auto-pay setting' });
  }
});

// GET /api/reports/1099 — 1099-INT data for a given year
router.get('/1099', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear() - 1;
    const records = await dbInterest.getYTDInterest(req.user.id, year);
    const total = records.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    res.json({
      year,
      records,
      totalInterest: parseFloat(total.toFixed(2)),
      reportable: total >= 10,
    });
  } catch (err) {
    console.error('[reports] 1099 error:', err.message);
    res.status(500).json({ error: 'Failed to load 1099 data' });
  }
});

// GET /api/reports/export — CSV export of all withholding transactions
router.get('/export', requireAuth, async (req, res) => {
  try {
    const rows = await dbLedger.getRecentTransactions(req.user.id, 10000);
    const headers = ['Date', 'Quarter', 'Payment ID', 'Gross Amount', 'Withheld Amount', 'Rate (%)', 'Note'];
    const csvRows = [headers.join(',')];
    for (const row of rows) {
      csvRows.push([
        row.created_at.toISOString(),
        row.quarter,
        `"${row.payment_id}"`,
        parseFloat(row.payment_amount).toFixed(2),
        parseFloat(row.withholding_amount).toFixed(2),
        (parseFloat(row.withholding_rate) * 100).toFixed(1),
        `"${(row.note || '').replace(/"/g, '""')}"`,
      ].join(','));
    }
    const csv = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="holdquarter-withholdings-${new Date().getFullYear()}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[reports] export error:', err.message);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;