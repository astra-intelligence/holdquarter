/**
 * Ledger operations for escrow_ledger.
 * Owns: recording withholdings, querying balance history.
 * Does NOT own: user settings (see db/settings.js).
 */
const pool = require('./index');

function getQuarter(date = new Date()) {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${q}`;
}

function formatQuarter(quarter) {
  return quarter; // "2025-Q2" stored as-is
}

async function addWithholding({ userId, paymentId, paymentAmount, withholdingAmount, withholdingRate, note }) {
  const quarter = getQuarter();
  const [result] = (await pool.query(`
    INSERT INTO escrow_ledger (user_id, quarter, payment_id, payment_amount, withholding_amount, withholding_rate, note)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (user_id, quarter, payment_id) DO UPDATE SET
      withholding_amount = EXCLUDED.withholding_amount,
      withholding_rate = EXCLUDED.withholding_rate,
      note = EXCLUDED.note
    RETURNING id
  `, [userId, quarter, paymentId, paymentAmount, withholdingAmount, withholdingRate, note || null])).rows;
  return result;
}

async function getQuarterlyTotals(userId) {
  const rows = (await pool.query(`
    SELECT
      quarter,
      SUM(payment_amount)   AS total_gross,
      SUM(withholding_amount) AS total_withheld,
      COUNT(*)               AS transaction_count
    FROM escrow_ledger
    WHERE user_id = $1
    GROUP BY quarter
    ORDER BY quarter DESC
    LIMIT 8
  `, [userId])).rows;
  return rows;
}

async function getCurrentQuarterBalance(userId) {
  const quarter = getQuarter();
  const [row] = (await pool.query(`
    SELECT
      COALESCE(SUM(withholding_amount), 0) AS withheld,
      COALESCE(SUM(payment_amount), 0)     AS gross,
      COUNT(*)                             AS transactions
    FROM escrow_ledger
    WHERE user_id = $1 AND quarter = $2
  `, [userId, quarter])).rows;
  return row;
}

async function getRecentTransactions(userId, limit = 20) {
  const rows = (await pool.query(`
    SELECT quarter, payment_id, payment_amount, withholding_amount, withholding_rate, note, created_at
    FROM escrow_ledger
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [userId, limit])).rows;
  return rows;
}

async function getAllQuarters(userId) {
  const rows = (await pool.query(`
    SELECT quarter, SUM(withholding_amount) AS total
    FROM escrow_ledger
    WHERE user_id = $1
    GROUP BY quarter
    ORDER BY quarter DESC
  `, [userId])).rows;
  return rows.map(r => r.quarter);
}

module.exports = { addWithholding, getQuarterlyTotals, getCurrentQuarterBalance, getRecentTransactions, getAllQuarters, getQuarter };