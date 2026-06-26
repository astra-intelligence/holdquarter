# HoldQuarter — CLAUDE.md

## What this app does
HoldQuarter automatically withholds income tax from every payment and tracks the escrowed amount per quarter, so freelancers and contractors never face a surprise tax bill.

## Stack
Express.js + EJS + PostgreSQL (Neon) + Render.

## Directory map
- `server.js` — entry point (middleware, route mounts, app.listen)
- `db/` — all database access (index.js exports Pool; named functions in entity files)
- `routes/` — endpoint groups (auth.js, dashboard.js, stytch-auth.js, webhooks/stytch.js)
- `services/` — Stytch REST API client (stytch.js)
- `middleware/` — auth.js (requireAuth, optionalAuth middleware)
- `lib/` — landing-context.js (EJS render context helpers)
- `migrations/` — JS migration modules (timestamped, tracked in _migrations table)
- `views/` — EJS templates (layout.ejs, partials/, dashboard.ejs)
- `public/css/` — theme.css (design tokens: --forest, --ivory, --gold)

## Database
- `users` — email, name, ein, stripe_customer_id, default_withholding_rate
- `sessions` — id, user_id, expires_at (cookie-based auth)
- `login_tokens` — token, user_id, expires_at (magic link, created on-demand)
- `escrow_ledger` — per-user/quarter withholding records (payment_id, amounts, rates)
- `withholding_settings` — per-user rate override
- `interest_ledger` — quarterly interest accrual per user/quarter (for 1099-INT)
- `irs_payments` — IRS quarterly remittance tracking (status, amount, confirmation)
- `auto_pay_settings` — per-user toggles for IRS auto-pay and interest payout
- `_migrations` — tracks applied migrations

## External integrations
- Stripe — webhook endpoint receives payment events, calculates and records withholding
- Stytch — passwordless magic link auth (active when STYTCH_PROJECT_ID/SECRET set; falls back to legacy token-in-db flow)
- SMTP (env vars) — optional; fallback logs magic links to console in dev
- FDIC-insured banking partner (BaaS) — future: interest-bearing escrow accounts, EFTPS IRS remittance

## Recent changes
- 2026-06-18 — Stytch auth migration: add services/stytch.js (REST API), routes/stytch-auth.js (/api/stytch/send + /authenticate + /session + /logout), routes/webhooks/stytch.js (Svix HMAC verification); /auth/send-link + /auth/signup now delegate to Stytch when env vars present
- 2026-06-11 Phase 2 — Interest ledger, IRS payment tracking, auto-pay settings, legal pages (ToS/Privacy), enhanced dashboard
- 2026-06-11 — Add withholding engine MVP (escrow ledger, payment webhook, dashboard, configurable rate, auth)