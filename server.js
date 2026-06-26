/**
 * HoldQuarter — server entry point.
 * Owns: middleware, route mounts, app.listen. Does NOT own business logic — see routes/.
 */
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { buildLandingContext } = require('./lib/landing-context');
const pool = require('./db/index');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// EJS view engine. Templates live in ./views/ (entry: layout.ejs).
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Health check (Render health check — no DB query so Neon can auto-suspend)
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *
Allow: /

Sitemap: https://holdquarter.polsia.app/sitemap.xml`);
});

app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://holdquarter.polsia.app/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
</urlset>`);
});

app.get('/health', (_req, res) => res.json({ status: 'healthy' }));

// Serve static files from public/ (index: false keeps / from hitting public/index.html)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Stytch webhook must be registered before express.json() so raw body is preserved
app.use('/api/webhooks', require('./routes/webhooks/stytch'));

// ---- Route mounts ----
app.use('/api/webhook',  require('./routes/webhook'));
app.use('/api/reports',  require('./routes/reports'));
app.use('/api/stytch',   require('./routes/stytch-auth'));
app.use('/api/unit',     require('./routes/unit'));
app.use('/dashboard',    require('./routes/dashboard'));
app.use('/onboarding',   require('./routes/onboarding'));
app.use('/auth',         require('./routes/auth'));
app.use('/legal',        require('./routes/legal'));

// ---- Landing page ----
app.get('/', async (req, res) => {
  const ctx = await buildLandingContext(req);
  res.render('layout', ctx);
});

// Fallback 404
app.use((_req, res) => res.status(404).send('Not found'));

// ---- Start ----
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`HoldQuarter running on port ${port}`));