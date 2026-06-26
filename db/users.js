/**
 * User operations for users table.
 * Owns: user CRUD, profile updates, onboarding state.
 * Does NOT own: auth sessions (see routes/auth.js), ledger (see db/ledger.js).
 */
const pool = require('./index');

async function findByEmail(email) {
  const { rows } = await pool.query(
    'SELECT id, email, name, ein, stripe_customer_id, unit_account_id, default_withholding_rate, created_at FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, email, name, ein, stripe_customer_id, unit_account_id, default_withholding_rate, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function create({ email, name, ein, stripeCustomerId, unitAccountId }) {
  const { rows } = await pool.query(`
    INSERT INTO users (email, name, ein, stripe_customer_id, unit_account_id, default_withholding_rate)
    VALUES ($1, $2, $3, $4, $5, 0.2500)
    ON CONFLICT (LOWER(email)) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, users.name),
      ein = COALESCE(EXCLUDED.ein, users.ein),
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, users.stripe_customer_id),
      unit_account_id = COALESCE(EXCLUDED.unit_account_id, users.unit_account_id)
    RETURNING id, email, name, ein, stripe_customer_id, unit_account_id, default_withholding_rate, created_at
  `, [email.toLowerCase().trim(), name || null, ein || null, stripeCustomerId || null, unitAccountId || null]);
  return rows[0];
}

async function updateProfile(id, { name, ein, stripeCustomerId, unitAccountId }) {
  const { rows } = await pool.query(`
    UPDATE users SET
      name = COALESCE($2, name),
      ein = COALESCE($3, ein),
      stripe_customer_id = COALESCE($4, stripe_customer_id),
      unit_account_id = COALESCE($5, unit_account_id),
      updated_at = NOW()
    WHERE id = $1
    RETURNING id, email, name, ein, stripe_customer_id, unit_account_id, default_withholding_rate, created_at
  `, [id, name || null, ein || null, stripeCustomerId || null, unitAccountId || null]);
  return rows[0] || null;
}

async function isOnboarded(id) {
  const user = await findById(id);
  if (!user) return false;
  return !!(user.name && user.ein);
}

module.exports = { findByEmail, findById, create, updateProfile, isOnboarded };