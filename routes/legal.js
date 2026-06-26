/**
 * Legal pages — Terms of Service, Privacy Policy, 1099 info.
 * Owns: static legal content, document download links.
 * Does NOT own: user auth (see middleware/auth.js).
 */
const express = require('express');
const router = express.Router();

// Render Terms of Service
router.get('/tos', (_req, res) => {
  res.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service — HoldQuarter</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; background: #f9f6ef; font-family: 'Plus Jakarta Sans', sans-serif; }
    .topbar { background: #0d2b1a; padding: 16px 48px; display: flex; align-items: center; }
    .topbar-logo { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 600; color: #f9f6ef; text-decoration: none; }
    .topbar-right { margin-left: auto; }
    .topbar-back { font-size: 14px; color: rgba(249,246,239,0.7); text-decoration: none; }
    .topbar-back:hover { color: #f9f6ef; }
    .container { max-width: 760px; margin: 0 auto; padding: 64px 48px; }
    h1 { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 700; color: #0d2b1a; margin-bottom: 8px; }
    .meta { font-size: 13px; color: #7a7a72; margin-bottom: 48px; }
    h2 { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; color: #0d2b1a; margin-top: 40px; margin-bottom: 12px; }
    p { font-size: 15px; line-height: 1.75; color: #3a3a32; margin-bottom: 16px; }
    ul { font-size: 15px; line-height: 1.75; color: #3a3a32; margin-bottom: 16px; padding-left: 24px; }
    li { margin-bottom: 6px; }
    .highlight-box { background: rgba(201,168,76,0.12); border: 1px solid rgba(201,168,76,0.3); border-radius: 8px; padding: 20px 24px; margin: 32px 0; }
    .highlight-box p { margin: 0; font-size: 14px; }
    strong { color: #0d2b1a; }
  </style>
</head>
<body>
  <div class="topbar">
    <a href="/" class="topbar-logo">Withholdly</a>
    <div class="topbar-right"><a href="/" class="topbar-back">← Back to app</a></div>
  </div>
  <div class="container">
    <h1>Terms of Service</h1>
    <p class="meta">Effective: June 11, 2026 &nbsp;·&nbsp; Withholdly Inc.</p>

    <h2>1. Acceptance of Terms</h2>
    <p>By accessing or using HoldQuarter ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service.</p>

    <h2>2. Description of Service</h2>
    <p>HoldQuarter automatically withholds income tax from payments you receive and tracks the escrowed amount per quarter. The Service is designed for freelancers, independent contractors, and self-employed individuals in the United States.</p>

    <h2>3. Tax Withholding &amp; Escrow</h2>
    <ul>
      <li><strong>Withholding.</strong> HoldQuarter withholds a user-configured percentage of each payment received through integrated payment processors (currently Stripe). The withheld amount is tracked in an escrow ledger per quarter.</li>
      <li><strong>No Guarantee.</strong> HoldQuarter does not guarantee that withheld amounts will cover your full tax liability. Consult a qualified tax professional for personalized advice.</li>
      <li><strong>Escrow Account.</strong> Withheld funds are held in a segregated escrow account maintained by Withholdly Inc. and are not commingled with operating capital.</li>
      <li><strong>Interest.</strong> Funds held in escrow may earn interest through our banking partner (FDIC-insured institution). Interest earned is accrued quarterly and paid to you as disclosed on the dashboard.</li>
    </ul>

    <div class="highlight-box">
      <p><strong>IRS Quarterly Estimated Tax.</strong> Withholdly will remind you of each quarterly IRS estimated tax deadline. You may enable auto-pay to have withheld funds remitted automatically. You remain solely responsible for the accuracy and completeness of your tax filings.</p>
    </div>

    <h2>4. Money Transmission &amp; Licensing</h2>
    <p>Withholdly Inc. operates in compliance with applicable U.S. money transmission regulations. We maintain the licenses and registrations required in each state where we operate. Money transmission services are provided in accordance with applicable federal and state requirements.</p>

    <h2>5. 1099 Reporting</h2>
    <p>Interest income earned on escrowed funds may be reportable on IRS Form 1099-INT if total interest exceeds $10 in a calendar year. Withholdly will issue 1099-INT forms as required by U.S. tax law by January 31 of the following year. You are responsible for reporting all interest income on your tax return.</p>

    <h2>6. Anti-Money Laundering (AML)</h2>
    <p>Withholdly maintains an AML policy consistent with federal requirements. We may request identity verification (KYC) information, including your Employer Identification Number (EIN), name, and email. False or misleading information may result in account suspension.</p>

    <h2>7. Fees</h2>
    <p>HoldQuarter's pricing and billing terms are available at holdquarter.polsia.app and are incorporated by reference. Fees are charged monthly and are non-refundable except as required by applicable law.</p>

    <h2>8. Data &amp; Privacy</h2>
    <p>Your use of HoldQuarter is also governed by our <a href="/legal/privacy" style="color:#0d2b1a;font-weight:600;">Privacy Policy</a>. We collect your email, name, EIN, payment records, and withholding settings to operate the Service. We do not sell your personal data to third parties.</p>

    <h2>9. Termination</h2>
    <p>You may cancel your account at any time by contacting support@holdquarter.polsia.app. Upon termination, withheld funds will be released to your connected bank account minus any applicable fees, and your final 1099 will be issued for the calendar year of termination.</p>

    <h2>10. Limitation of Liability</h2>
    <p>HOLQUARTER IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE ARE NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE FEES YOU PAID IN THE TWELVE MONTHS PRECEDING THE CLAIM.</p>

    <h2>11. Changes to Terms</h2>
    <p>We may update these Terms from time to time. Changes will be posted at this URL with an updated effective date. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>

    <h2>12. Contact</h2>
    <p>Questions about these Terms? Contact us at <strong>legal@holdquarter.polsia.app</strong> or write to Withholdly Inc., 548 Market St, San Francisco, CA 94104.</p>
  </div>
</body>
</html>`);
});

// Render Privacy Policy
router.get('/privacy', (_req, res) => {
  res.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy — HoldQuarter</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; background: #f9f6ef; font-family: 'Plus Jakarta Sans', sans-serif; }
    .topbar { background: #0d2b1a; padding: 16px 48px; display: flex; align-items: center; }
    .topbar-logo { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 600; color: #f9f6ef; text-decoration: none; }
    .topbar-right { margin-left: auto; }
    .topbar-back { font-size: 14px; color: rgba(249,246,239,0.7); text-decoration: none; }
    .topbar-back:hover { color: #f9f6ef; }
    .container { max-width: 760px; margin: 0 auto; padding: 64px 48px; }
    h1 { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 700; color: #0d2b1a; margin-bottom: 8px; }
    .meta { font-size: 13px; color: #7a7a72; margin-bottom: 48px; }
    h2 { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; color: #0d2b1a; margin-top: 40px; margin-bottom: 12px; }
    p { font-size: 15px; line-height: 1.75; color: #3a3a32; margin-bottom: 16px; }
    ul { font-size: 15px; line-height: 1.75; color: #3a3a32; margin-bottom: 16px; padding-left: 24px; }
    li { margin-bottom: 6px; }
    a { color: #0d2b1a; font-weight: 600; }
    strong { color: #0d2b1a; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    th, td { text-align: left; font-size: 14px; padding: 10px 16px; border-bottom: 1px solid rgba(13,43,26,0.1); }
    th { font-weight: 600; color: #0d2b1a; background: rgba(13,43,26,0.04); }
  </style>
</head>
<body>
  <div class="topbar">
    <a href="/" class="topbar-logo">Withholdly</a>
    <div class="topbar-right"><a href="/" class="topbar-back">← Back to app</a></div>
  </div>
  <div class="container">
    <h1>Privacy Policy</h1>
    <p class="meta">Effective: June 11, 2026 &nbsp;·&nbsp; Withholdly Inc.</p>

    <h2>1. Information We Collect</h2>
    <p>We collect information you provide directly to us:</p>
    <ul>
      <li><strong>Account info:</strong> email address, name, employer identification number (EIN).</li>
      <li><strong>Payment info:</strong> payment amounts, withholding records, and Stripe customer references. We do not store raw credit card or bank account numbers — these are held by Stripe.</li>
      <li><strong>Withholding settings:</strong> your chosen tax withholding rate and auto-pay preferences.</li>
      <li><strong>Interest records:</strong> quarterly interest accrued and paid on escrowed funds (required for 1099-INT reporting).</li>
    </ul>

    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>Operate the withholding and escrow service (record payments, compute withholdings).</li>
      <li>Generate quarterly IRS payment reminders and optionally auto-remit withheld funds.</li>
      <li>Track and pay interest earnings from escrow accounts.</li>
      <li>Issue IRS Form 1099-INT for interest income ≥ $10/year.</li>
      <li>Communicate account status, payment receipts, and quarterly summaries.</li>
    </ul>

    <h2>3. Data Sharing</h2>
    <p>We do <strong>not</strong> sell your personal information. We share data only in these limited circumstances:</p>
    <ul>
      <li><strong>Stripe:</strong> for payment processing and bank account connections. Stripe's own privacy policy applies to their handling of your financial data.</li>
      <li><strong>Banking partner:</strong> to facilitate interest-bearing escrow accounts and fund remittance. Your EIN and account information may be shared with our FDIC-insured banking partner as required by banking regulations.</li>
      <li><strong>Legal compliance:</strong> if required by law, court order, or regulatory requirement (e.g., IRS reporting, AML/BSA obligations).</li>
    </ul>

    <h2>4. Data Retention</h2>
    <p>We retain your personal data for as long as your account is active and for a reasonable period thereafter to comply with tax reporting obligations (minimum 7 years per IRS guidelines). You may request deletion of your data by contacting privacy@holdquarter.polsia.app — we will honor such requests except where retention is required by law.</p>

    <h2>5. Security</h2>
    <p>We use industry-standard encryption (TLS) for data in transit, and AES-256 encryption for data at rest. Access to user data is restricted to authorized personnel only. No method of transmission over the internet is 100% secure; we cannot guarantee absolute security but we employ commercially reasonable measures.</p>

    <h2>6. Cookies &amp; Tracking</h2>
    <p>We use session cookies to maintain your login session. We do not use third-party tracking pixels or advertising cookies. Analytics data (if any) is anonymized and aggregated.</p>

    <h2>7. Your Rights (CCPA / State Privacy Laws)</h2>
    <p>If you are a California resident, you have the right to know what data we collect, request deletion, and opt out of sale (though we do not sell data). For other states with enacted privacy laws (Virginia, Colorado, etc.), similar rights apply. Contact us at privacy@holdquarter.polsia.app.</p>

    <h2>8. 1099-INT Interest Reporting</h2>
    <p>As required by the IRS, when your total interest income from HoldQuarter exceeds $10 in a calendar year, we will file Form 1099-INT with the IRS and provide you a copy by January 31 of the following year. This is a reporting obligation — it does not change your tax liability, only how interest income is documented.</p>

    <h2>9. Children's Privacy</h2>
    <p>The Service is not intended for individuals under 18. We do not knowingly collect data from minors.</p>

    <h2>10. Changes to This Policy</h2>
    <p>We may update this Privacy Policy periodically. Changes will be posted at this URL. We will notify you of material changes via the email address on your account.</p>

    <h2>11. Contact</h2>
    <p>Privacy inquiries: <strong>privacy@holdquarter.polsia.app</strong> &nbsp;·&nbsp; Withholdly Inc., 548 Market St, San Francisco, CA 94104.</p>
  </div>
</body>
</html>`);
});

module.exports = router;