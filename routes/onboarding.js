/**
 * Onboarding routes — first-time setup (name, EIN, rate).
 * Mounted at /onboarding by server.js.
 */
const express = require('express');
const router = express.Router();
const pool = require('../db/index');

const SESSION_DAYS = 30;

function makeId() { return require('crypto').randomBytes(24).toString('base64url'); }

// GET /onboarding — first-time setup page
router.get('/', async (req, res) => {
  const sid = req.cookies?.session_id || req.headers['x-session-id'];
  if (!sid) return res.redirect('/auth/login');
  const { rows } = await pool.query(`
    SELECT u.id, u.email, u.name, u.ein, u.default_withholding_rate
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = $1 AND s.expires_at > NOW()
  `, [sid]);
  if (rows.length === 0) { res.clearCookie('session_id'); return res.redirect('/auth/login'); }
  const user = rows[0];
  if (user.name && user.ein) return res.redirect('/dashboard');
  const currentRate = user.default_withholding_rate
    ? Math.round(parseFloat(user.default_withholding_rate) * 100)
    : 30;
  res.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Set up your account — Withholdly</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f9f6ef; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; min-height: 100vh; }
    .topbar { background: #0d2b1a; padding: 16px 48px; display: flex; align-items: center; gap: 10px; }
    .topbar-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
    .topbar-name { font-family: Georgia, serif; font-size: 18px; font-weight: 600; color: #f9f6ef; }
    .topbar-email { font-size: 14px; color: rgba(249,246,239,0.6); margin-left: auto; }
    .container { max-width: 560px; margin: 0 auto; padding: 64px 24px; }
    .step-label { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #c9a84c; margin-bottom: 8px; }
    h1 { font-family: Georgia, serif; font-size: 36px; color: #0d2b1a; margin-bottom: 8px; letter-spacing: -0.02em; }
    .sub { font-size: 15px; color: #7a7a72; margin-bottom: 40px; line-height: 1.6; }
    .progress-track { height: 4px; background: rgba(13,43,26,0.12); border-radius: 4px; margin-bottom: 48px; }
    .progress-fill { height: 100%; background: #c9a84c; border-radius: 4px; width: 20%; }
    .diagram { background: #fff; border-radius: 16px; padding: 28px; margin-bottom: 36px; box-shadow: 0 2px 8px rgba(13,43,26,0.06); }
    .diagram-title { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #7a7a72; margin-bottom: 20px; }
    .flow-row { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
    .flow-row:last-child { margin-bottom: 0; }
    .flow-num { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #fff; }
    .flow-num.green { background: #2a6b4a; }
    .flow-num.gold { background: #c9a84c; }
    .flow-num.gray { background: rgba(13,43,26,0.25); }
    .flow-num.dark { background: #0d2b1a; }
    .flow-label { flex: 1; font-size: 14px; color: #1a1a18; }
    .flow-amount { font-size: 14px; font-weight: 700; color: #0d2b1a; }
    .flow-amount.neg { color: #2a6b4a; }
    .field { margin-bottom: 24px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #0d2b1a; margin-bottom: 8px; }
    .hint { font-size: 12px; color: #7a7a72; margin-top: 6px; line-height: 1.5; }
    .hint a { color: #0d2b1a; }
    input[type="text"], input[type="email"], input[type="number"], select {
      width: 100%; padding: 12px 16px; border: 1.5px solid rgba(13,43,26,0.2); border-radius: 8px;
      font-size: 16px; font-family: inherit; background: #fff; outline: none; transition: border-color 0.15s;
    }
    input:focus, select:focus { border-color: #1a4731; }
    .rate-presets { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
    .rate-btn { padding: 10px 20px; border-radius: 20px; border: 1.5px solid rgba(13,43,26,0.2); background: none;
      font-size: 15px; font-weight: 600; color: #0d2b1a; cursor: pointer; font-family: inherit; transition: all 0.15s; }
    .rate-btn:hover { border-color: #0d2b1a; }
    .rate-btn.active { background: #0d2b1a; color: #f9f6ef; border-color: #0d2b1a; }
    .rate-custom { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .rate-custom input { width: 80px; }
    .btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 32px; background: #0d2b1a; color: #f9f6ef;
      border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s; }
    .btn:hover { background: #1a4731; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-gold { background: #c9a84c; }
    .btn-gold:hover { background: #dfc06a; }
    .btn-row { display: flex; gap: 12px; margin-top: 32px; }
    .msg { padding: 12px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 20px; display: none; }
    .msg.err { background: rgba(180,40,40,0.08); color: #b42828; display: block; }
    .skip-row { text-align: center; margin-top: 20px; font-size: 13px; color: #7a7a72; }
    .skip-row a { color: #0d2b1a; font-weight: 600; }
  </style>
</head>
<body>
  <div class="topbar">
    <a href="/" class="topbar-logo">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="8" fill="#c9a84c"/><rect x="7" y="8" width="8" height="12" rx="1" fill="#0d2b1a"/><rect x="13" y="8" width="8" height="12" rx="1" fill="#f9f6ef" opacity="0.6"/></svg>
      <span class="topbar-name">Withholdly</span>
    </a>
    <span class="topbar-email">${user.email}</span>
  </div>
  <div class="container">
    <div class="step-label">Step 1 of 2</div>
    <div class="progress-track"><div class="progress-fill"></div></div>
    <h1>Set up your account</h1>
    <p class="sub">This takes about 2 minutes. Your info is private — only used to calculate the correct withholding amount.</p>
    <div class="diagram">
      <div class="diagram-title">How Withholdly works</div>
      <div class="flow-row">
        <div class="flow-num green">1</div>
        <div class="flow-label">Payment received from client</div>
        <div class="flow-amount">$1,000</div>
      </div>
      <div class="flow-row">
        <div class="flow-num gold">2</div>
        <div class="flow-label">Tax withheld (your rate)</div>
        <div class="flow-amount neg">−$300</div>
      </div>
      <div class="flow-row">
        <div class="flow-num gray">3</div>
        <div class="flow-label">IRS paid quarterly</div>
        <div class="flow-amount">—</div>
      </div>
      <div class="flow-row">
        <div class="flow-num dark">4</div>
        <div class="flow-label">You receive net</div>
        <div class="flow-amount">$700</div>
      </div>
    </div>
    <div id="msg" class="msg"></div>
    <form id="f" novalidate>
      <div class="field">
        <label for="name">Full legal name</label>
        <input type="text" id="name" name="name" placeholder="Alex Rivera" required autocomplete="name" value="${user.name || ''}">
      </div>
      <div class="field">
        <label for="ein">Employer Identification Number (EIN)</label>
        <input type="text" id="ein" name="ein" placeholder="XX-XXXXXXX" maxlength="10" value="${user.ein || ''}">
        <p class="hint">Required for self-employed tax withholding. Format: 9 digits with a hyphen (e.g., 12-3456789). <a href="https://www.irs.gov/forms-instructions" target="_blank">Apply for free at IRS.gov →</a></p>
      </div>
      <div class="field">
        <label for="rate">Estimated effective tax rate</label>
        <div class="rate-presets">
          <button type="button" class="rate-btn" data-rate="20">20%</button>
          <button type="button" class="rate-btn" data-rate="25">25%</button>
          <button type="button" class="rate-btn active" data-rate="30">30%</button>
          <button type="button" class="rate-btn" data-rate="35">35%</button>
          <button type="button" class="rate-btn" data-rate="40">40%</button>
        </div>
        <div class="rate-custom">
          <span style="font-size:14px;color:#7a7a72">Or enter a custom rate:</span>
          <input type="number" id="rate" name="rate" min="1" max="60" step="0.5" value="${currentRate}">
          <span style="font-size:14px;color:#7a7a72">%</span>
        </div>
        <p class="hint">This is your estimated effective rate (federal + self-employment tax). Most freelancers: 25–35%. <a href="https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-tax" target="_blank">Learn more →</a></p>
      </div>
      <div class="btn-row">
        <button type="submit" class="btn btn-gold" id="btn">Save and continue →</button>
      </div>
      <div class="skip-row">You can update all of this later from your dashboard.</div>
    </form>
  </div>
  <script>
    const presets = document.querySelectorAll('.rate-btn');
    let selectedRate = ${currentRate};
    presets.forEach(btn => {
      btn.addEventListener('click', () => {
        presets.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedRate = parseInt(btn.dataset.rate);
        document.getElementById('rate').value = selectedRate;
      });
    });
    document.getElementById('f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn');
      btn.disabled = true; btn.textContent = 'Saving…';
      const name = document.getElementById('name').value.trim();
      const ein = document.getElementById('ein').value.trim().replace(/[^\\d-]/g, '');
      const rate = parseFloat(document.getElementById('rate').value) / 100;
      if (!name || name.length < 2) {
        document.getElementById('msg').className = 'msg err';
        document.getElementById('msg').textContent = 'Please enter your full name.';
        btn.disabled = false; btn.textContent = 'Save and continue →';
        return;
      }
      try {
        const r = await fetch('/onboarding/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, ein, rate })
        });
        const d = await r.json();
        if (d.ok) { window.location.href = '/dashboard'; }
        else {
          document.getElementById('msg').className = 'msg err';
          document.getElementById('msg').textContent = d.error || 'Something went wrong.';
          btn.disabled = false; btn.textContent = 'Save and continue →';
        }
      } catch {
        document.getElementById('msg').className = 'msg err';
        document.getElementById('msg').textContent = 'Network error — please try again.';
        btn.disabled = false; btn.textContent = 'Save and continue →';
      }
    });
  </script>
</body>
</html>`);
});

// POST /onboarding/setup
router.post('/setup', express.json(), async (req, res) => {
  const sid = req.cookies?.session_id || req.headers['x-session-id'];
  if (!sid) return res.status(401).json({ error: 'Not authenticated' });
  const { rows } = await pool.query(`
    SELECT user_id FROM sessions WHERE id = $1 AND expires_at > NOW()
  `, [sid]);
  if (!rows.length) return res.status(401).json({ error: 'Session expired' });
  const userId = rows[0].user_id;
  const { name, ein, rate } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Valid name required' });
  }
  if (typeof rate !== 'number' || rate < 0.01 || rate > 0.60) {
    return res.status(400).json({ error: 'Rate must be between 1% and 60%' });
  }
  await pool.query(`
    UPDATE users SET name = $2, ein = $3, default_withholding_rate = $4, updated_at = NOW() WHERE id = $1
  `, [userId, name.trim(), ein || null, rate]);

  // Create Unit account for this user if token is configured
  if (process.env.UNIT_API_TOKEN) {
    try {
      const { createAccount } = require('../lib/unit');
      const userRows = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
      const userEmail = userRows[0]?.email;
      if (userEmail) {
        const unitAccount = await createAccount({ name: name.trim(), email: userEmail, tin: ein });
        if (unitAccount?.id) {
          await pool.query('UPDATE users SET unit_account_id = $2 WHERE id = $1', [userId, unitAccount.id]);
        }
      }
    } catch (err) {
      console.error('[onboarding] Unit account creation failed:', err.message);
    }
  }

  res.json({ ok: true });
});

module.exports = router;