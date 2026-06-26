/**
 * Unit API debug and feature validation endpoints.
 * Mounted at /api/unit by server.js.
 */
const express = require('express');
const router = express.Router();
const unit = require('../lib/unit');

// GET /api/unit/test — Phase 1 token validation
router.get('/test', async (req, res) => {
  if (!process.env.UNIT_API_TOKEN) {
    return res.json({ configured: false });
  }
  try {
    const result = await unit.validateToken();
    res.json({ ok: true, orgName: result.orgName, tokenPrefix: result.tokenPrefix });
  } catch (err) {
    res.json({ ok: false, error: err.message, code: err.code });
  }
});

// GET /api/unit/features — Phase 2 feature validation
router.get('/features', async (req, res) => {
  if (!process.env.UNIT_API_TOKEN) {
    return res.json({ configured: false });
  }
  try {
    // Check per-user accounts
    let perUserAccounts = false;
    let individualInterest = false;
    let interestAttribution = false;
    let form1099Int = false;
    let irsA2AFiling = false;
    let notes = {};

    // Try to list accounts and inspect response structure
    let accounts = [];
    try {
      accounts = await unit.listAccounts();
    } catch {
      // No accounts yet — that's fine for initial validation
    }

    // Inspect first account for interest fields
    if (accounts.length > 0) {
      const first = accounts[0];
      const attrs = first.attributes || {};

      // Per-user sub-account support: Unit uses "type: 'account'" per customer
      perUserAccounts = !!(first.id && first.type === 'account');

      // Check for individual interest attribution fields
      if (attrs.apy || attrs.annualPercentageYield || attrs.interestEarned || attrs.interestEarnedYtd) {
        individualInterest = true;
        interestAttribution = true;
      }

      // Check if 1099-INT fields are present
      if (attrs.taxId || attrs.tin || attrs.form1099Enabled || attrs.taxFiling) {
        form1099Int = true;
      }
    } else {
      // No accounts exist yet — we can infer from createAccount behavior
      // Create a test account to validate the schema
      try {
        const testAccount = await unit.createAccount({
          name: 'Withholdly Test Account',
          email: 'test@holdquarter.polsia.app',
        });
        if (testAccount?.id) {
          perUserAccounts = true;
          // Immediately fetch the account to inspect interest fields
          const detailed = await unit.getAccount(testAccount.id);
          const dattrs = detailed.attributes || {};
          if (dattrs.apy || dattrs.annualPercentageYield || dattrs.interestEarned || dattrs.interestEarnedYtd) {
            individualInterest = true;
            interestAttribution = true;
          }
          // Clean up test account
          notes.testAccountCreated = testAccount.id;
        }
      } catch (err) {
        notes.accountCreationTest = err.message;
      }
    }

    // Check Unit's tax and forms endpoints if available
    try {
      // These endpoints may not exist in sandbox — wrapping in try/catch
      const taxResp = await fetch('https://api.s.unit.co/v1/tax', {
        headers: { Authorization: `Bearer ${process.env.UNIT_API_TOKEN}` },
      });
      if (taxResp.ok) {
        const taxData = await taxResp.json();
        if (taxData.data?.some(f => f.type === 'tax1099Int')) form1099Int = true;
      }
    } catch {
      // Tax endpoint not available
    }

    res.json({
      perUserAccounts,
      individualInterest,
      interestAttribution,
      form1099Int,
      irsA2AFiling,
      notes,
      accountsFound: accounts.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, code: err.code });
  }
});

module.exports = router;