/**
 * Auto-pay settings — per-user toggles for IRS auto-remittance and interest payout.
 * Owns: user preference for automated financial actions.
 * Does NOT own: payment execution (see db/irs.js, db/interest.js).
 */
const pool = require('./index');

async function getSettings(userId) {
  const [row] = (await pool.query(`
    SELECT irs_auto_pay, interest_payout, updated_at
    FROM auto_pay_settings
    WHERE user_id = $1
  `, [userId])).rows;
  return row || { irs_auto_pay: false, interest_payout: true };
}

async function setIRSautoPay(userId, enabled) {
  await pool.query(`
    INSERT INTO auto_pay_settings (user_id, irs_auto_pay, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id) DO UPDATE SET irs_auto_pay = $2, updated_at = NOW()
  `, [userId, enabled]);
}

async function setInterestPayout(userId, enabled) {
  await pool.query(`
    INSERT INTO auto_pay_settings (user_id, interest_payout, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id) DO UPDATE SET interest_payout = $2, updated_at = NOW()
  `, [userId, enabled]);
}

module.exports = { getSettings, setIRSautoPay, setInterestPayout };