/**
 * Unit API client (REST).
 * Owns: token validation, account creation, account queries, interest attribution.
 * Does NOT own: onboarding wiring (see routes/onboarding.js), user record storage (see db/users.js).
 */

const BASE_URL = process.env.UNIT_API_URL || 'https://api.s.unit.co/v1';

function apiPath(path) {
  return `${BASE_URL}${path}`;
}

function authHeader() {
  return `Bearer ${process.env.UNIT_API_TOKEN}`;
}

async function unitFetch(path, method, body) {
  if (!process.env.UNIT_API_TOKEN) {
    const err = new Error('UNIT_API_TOKEN is not configured');
    err.status = 400;
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const opts = {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(apiPath(path), opts);
  const data = await resp.json();

  if (!resp.ok) {
    const err = new Error(data.error?.message || `Unit API ${resp.status}`);
    err.status = resp.status;
    err.code = data.error?.code;
    throw err;
  }

  return data;
}

/**
 * Validate the Unit API token — calls GET /v1/application.
 * Returns { ok, orgName, tokenPrefix } on success.
 * Throws if token is missing or invalid.
 */
async function validateToken() {
  const data = await unitFetch('/application', 'GET');
  return {
    ok: true,
    orgName: data.organization?.name || data.name || 'Unknown',
    tokenPrefix: (process.env.UNIT_API_TOKEN || '').slice(0, 20),
  };
}

/**
 * Create a Unit account for a user.
 * @param {Object} opts
 * @param {string} opts.name - Full legal name (used as account holder name)
 * @param {string} opts.email - Email address (for Unit customer record)
 * @param {string} [opts.tin] - Tax ID (EIN) if available
 * @returns {Object} The created account { id, name, status, ... }
 */
async function createAccount({ name, email, tin }) {
  const payload = {
    data: {
      type: 'account',
      attributes: {
        name: name,
        contact: {
          email: email,
        },
        status: 'active',
      },
    },
  };

  // Include TIN/EIN for tax reporting if provided
  if (tin) {
    payload.data.attributes.taxId = tin.replace(/[^0-9]/g, '');
  }

  const data = await unitFetch('/accounts', 'POST', payload);
  return data.data;
}

/**
 * Get a single account by ID.
 * @param {string} accountId
 * @returns {Object} Account object with attributes
 */
async function getAccount(accountId) {
  const data = await unitFetch(`/accounts/${accountId}`, 'GET');
  return data.data;
}

/**
 * List all accounts for the organization.
 * @returns {Object[]} Array of account objects
 */
async function listAccounts() {
  const data = await unitFetch('/accounts', 'GET');
  return data.data || [];
}

/**
 * Get interest information for an account.
 * Calls GET /v1/accounts/{id} and extracts interest-related fields.
 * @param {string} accountId
 * @returns {Object} Interest data { apy, interestEarned, lastAccrualDate, ... } or null
 */
async function getAccountInterest(accountId) {
  const account = await getAccount(accountId);
  const attrs = account.attributes || {};

  // Unit may surface interest in attributes or relationships
  const interest = {
    accountId: account.id,
    status: attrs.status,
    // Interest attribution fields — present if Unit supports per-account interest
    apy: attrs.apy || attrs.annualPercentageYield || null,
    interestEarned: attrs.interestEarned || attrs.interestEarnedYtd || null,
    interestRate: attrs.interestRate || attrs.interestRateBasis || null,
    lastAccrualDate: attrs.lastAccrualDate || attrs.lastInterestAccrualDate || null,
  };

  return interest;
}

module.exports = {
  validateToken,
  createAccount,
  getAccount,
  listAccounts,
  getAccountInterest,
};