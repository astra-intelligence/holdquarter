/**
 * Database access — Pool singleton.
 * All SQL must go through named functions in db/*. No raw pool.query outside db/.
 */

// Use same neon-compatible pool config as migrate.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[pg pool] idle client error (non-fatal):', err && err.message);
});

module.exports = pool;