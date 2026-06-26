/**
 * Interest ledger — tracks quarterly interest accrual and payout.
 * Owns: interest records per user/quarter.
 * Does NOT own: escrow balance calculation (see db/ledger.js).
 */
const pool = require('./index');

function getQuarter(date = new Date()) {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${q}`;
}

// Get interest earned this quarter and YTD
async function getInterestSummary(userId) {
  const [currentRow, ytdRows] = await Promise.all([
    pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS this_quarter
      FROM interest_ledger
      WHERE user_id = $1 AND quarter = $2
    `, [userId, getQuarter()]),
    pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS ytd
      FROM interest_ledger
      WHERE user_id = $1 AND quarter LIKE $2 || '-Q%'
    `, [userId, new Date().getFullYear()]),
  ]);
  return {
    thisQuarter: parseFloat(currentRow.rows[0].this_quarter),
    ytd: parseFloat(ytdRows.rows[0].ytd),
  };
}

// Record quarterly interest accrual (called by BaaS partner webhook or cron job)
async function recordInterest({ userId, quarter, amount, annualRate }) {
  const [row] = (await pool.query(`
    INSERT INTO interest_ledger (user_id, quarter, amount, annual_rate)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, quarter) DO UPDATE SET
      amount = EXCLUDED.amount,
      annual_rate = EXCLUDED.annual_rate,
      accrued_at = NOW()
    RETURNING id, amount, quarter, paid_out_at
  `, [userId, quarter, amount, annualRate])).rows;
  return row;
}

// Mark interest as paid out to user
async function markInterestPaid(userId, quarter) {
  const [row] = (await pool.query(`
    UPDATE interest_ledger
    SET paid_out_at = NOW()
    WHERE user_id = $1 AND quarter = $2 AND paid_out_at IS NULL
    RETURNING id, amount, quarter, paid_out_at
  `, [userId, quarter])).rows;
  return row;
}

// Get interest history for 1099 reporting
async function getYTDInterest(userId, year) {
  const rows = (await pool.query(`
    SELECT quarter, amount, annual_rate, paid_out_at, accrued_at
    FROM interest_ledger
    WHERE user_id = $1 AND quarter LIKE $2 || '-Q%'
    ORDER BY quarter ASC
  `, [userId, year])).rows;
  return rows;
}

module.exports = {
  getInterestSummary,
  recordInterest,
  markInterestPaid,
  getYTDInterest,
  getQuarter,
};