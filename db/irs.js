/**
 * IRS payment tracking — quarterly estimated tax remittance.
 * Owns: IRS payment records, scheduling, status tracking.
 * Does NOT own: EFTPS API integration (scaffolded for Phase 2+).
 */
const pool = require('./index');

// Quarterly IRS payment deadlines (monthly, day 15 of following month)
const DEADLINE_MAP = {
  'Q1': '04-15', // Apr 15
  'Q2': '06-15', // Jun 15
  'Q3': '09-15', // Sep 15
  'Q4': '01-15', // Jan 15 (of following year)
};

// Return the next IRS quarterly deadline
function getNextIRSDeadline(fromDate = new Date()) {
  const year = fromDate.getFullYear();
  const month = fromDate.getMonth(); // 0-indexed

  // Determine current quarter
  const currentQ = Math.floor(month / 3) + 1;

  let deadline, label;
  if (currentQ === 1) {
    // Q1: Jan-Mar → deadline Apr 15
    deadline = new Date(year, 3, 15); // month is 0-indexed, 3 = April
    label = `${year}-Q1`;
  } else if (currentQ === 2) {
    deadline = new Date(year, 5, 15); // June 15
    label = `${year}-Q2`;
  } else if (currentQ === 3) {
    deadline = new Date(year, 8, 15); // Sep 15
    label = `${year}-Q3`;
  } else {
    // Q4: Oct-Dec → deadline Jan 15 of next year
    deadline = new Date(year + 1, 0, 15); // Jan 15
    label = `${year}-Q4`;
  }

  // If past this year's Q1 deadline, move to next cycle
  const today = new Date();
  if (deadline < today) {
    return getNextIRSDeadline(new Date(today.getFullYear() + 1, 0, 1));
  }

  return { deadline, label, year };
}

// Get or create IRS payment record for a user/quarter
async function getOrCreateIRSPayment(userId, quarter) {
  const [row] = (await pool.query(`
    INSERT INTO irs_payments (user_id, quarter, status)
    VALUES ($1, $2, 'pending')
    ON CONFLICT (user_id, quarter) DO UPDATE SET quarter = EXCLUDED.quarter
    RETURNING id, user_id, quarter, amount, status, scheduled_at, paid_at, confirmation
  `, [userId, quarter])).rows;
  return row;
}

// Get all IRS payments for a user
async function getUserIRSPayments(userId) {
  const rows = (await pool.query(`
    SELECT id, quarter, amount, status, scheduled_at, paid_at, confirmation, method, created_at
    FROM irs_payments
    WHERE user_id = $1
    ORDER BY quarter DESC
    LIMIT 12
  `, [userId])).rows;
  return rows;
}

// Update IRS payment status
async function updateStatus(userId, quarter, { status, amount, paidAt, confirmation, method }) {
  const fields = ['status = $2'];
  const vals = [userId, status];
  let idx = 3;

  if (amount !== undefined)    { fields.push(`amount = $${idx++}`); vals.push(amount); }
  if (paidAt !== undefined)    { fields.push(`paid_at = $${idx++}`); vals.push(paidAt); }
  if (confirmation)           { fields.push(`confirmation = $${idx++}`); vals.push(confirmation); }
  if (method)                  { fields.push(`method = $${idx++}`); vals.push(method); }

  vals.push(quarter);
  const [row] = (await pool.query(`
    UPDATE irs_payments SET ${fields.join(', ')}
    WHERE user_id = $1 AND quarter = $${idx}
    RETURNING id, quarter, amount, status, paid_at, confirmation, method
  `, vals)).rows;
  return row;
}

// Get next pending IRS payment
async function getUpcomingIRSPayment(userId) {
  const next = getNextIRSDeadline();
  const [row] = (await pool.query(`
    SELECT id, quarter, amount, status, scheduled_at, paid_at
    FROM irs_payments
    WHERE user_id = $1 AND quarter = $2 AND status IN ('pending','scheduled')
    ORDER BY quarter ASC
    LIMIT 1
  `, [userId, next.label])).rows;
  return row || null;
}

module.exports = {
  getNextIRSDeadline,
  getOrCreateIRSPayment,
  getUserIRSPayments,
  updateStatus,
  getUpcomingIRSPayment,
  DEADLINE_MAP,
};