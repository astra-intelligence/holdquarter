/**
 * User withholding settings — rate configuration.
 * Owns: storing/updating per-user withholding rate.
 * Does NOT own: ledger entries (see db/ledger.js).
 */
const pool = require('./index');

async function getRate(userId) {
  // Custom rate from withholding_settings takes priority
  const rows = (await pool.query(`
    SELECT rate FROM withholding_settings WHERE user_id = $1
  `, [userId])).rows;
  if (rows.length > 0) return parseFloat(rows[0].rate);

  // Fall back to user's default rate
  const userRows = (await pool.query(`
    SELECT default_withholding_rate FROM users WHERE id = $1
  `, [userId])).rows;
  if (userRows.length > 0 && userRows[0].default_withholding_rate !== null) {
    return parseFloat(userRows[0].default_withholding_rate);
  }
  return 0.25; // sensible default
}

async function setRate(userId, rate) {
  rate = parseFloat(rate);
  if (isNaN(rate) || rate < 0 || rate > 1) {
    throw new Error('Rate must be a number between 0 and 1');
  }
  await pool.query(`
    INSERT INTO withholding_settings (user_id, rate, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id) DO UPDATE SET rate = $2, updated_at = NOW()
  `, [userId, rate]);
}

module.exports = { getRate, setRate };