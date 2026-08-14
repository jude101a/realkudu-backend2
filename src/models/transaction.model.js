import pool from '../db/pool.js'; // your pg Pool instance

// ─── Create ────────────────────────────────────────────────────────────────

export async function createTransaction({
  reference,
  paymentType,
  propertyId = null,
  buyerId = null,
  sellerId = null,
  agentId = null,
  amount,
  currency = 'NGN',
  gateway = 'PAYSTACK',
  gatewayReference = null,
  authorizationUrl = null,
  accessCode = null,
  status = 'PENDING',
  gatewayResponse = {},
}) {
  const { rows } = await pool.query(
    `INSERT INTO transactions (
        reference, payment_type, property_id, buyer_id, seller_id, agent_id,
        amount, currency, gateway, gateway_reference, authorization_url,
        access_code, status, gateway_response
     ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14
     )
     RETURNING *`,
    [
      reference, paymentType, propertyId, buyerId, sellerId, agentId,
      amount, currency, gateway, gatewayReference, authorizationUrl,
      accessCode, status, JSON.stringify(gatewayResponse),
    ]
  );
  return rows[0];
}

// ─── Find by ID ─────────────────────────────────────────────────────────────

export async function findTransactionById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM transactions WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

// ─── Find by Reference ──────────────────────────────────────────────────────

export async function findTransactionByReference(reference) {
  const { rows } = await pool.query(
    `SELECT * FROM transactions WHERE reference = $1`,
    [reference]
  );
  return rows[0] ?? null;
}

// ─── Find by Buyer ──────────────────────────────────────────────────────────

export async function findTransactionsByBuyer(buyerId) {
  const { rows } = await pool.query(
    `SELECT * FROM transactions WHERE buyer_id = $1 ORDER BY created_at DESC`,
    [buyerId]
  );
  return rows;
}

// ─── Update Status ──────────────────────────────────────────────────────────

export async function updateTransactionStatus(reference, status) {
  const { rows } = await pool.query(
    `UPDATE transactions
     SET status = $1
     WHERE reference = $2
     RETURNING *`,
    [status, reference]
  );
  return rows[0] ?? null;
}

// ─── Update after Gateway Response ──────────────────────────────────────────

export async function updateTransactionAfterPayment(reference, {
  status,
  gatewayReference = null,
  gatewayResponse = {},
}) {
  const { rows } = await pool.query(
    `UPDATE transactions
     SET status             = $1,
         gateway_reference  = $2,
         gateway_response   = $3
     WHERE reference = $4
     RETURNING *`,
    [status, gatewayReference, JSON.stringify(gatewayResponse), reference]
  );
  return rows[0] ?? null;
}

// ─── Update after Initialization ────────────────────────────────────────────

export async function updateTransactionAfterInit(reference, {
  authorizationUrl,
  accessCode,
  gatewayReference,
}) {
  const { rows } = await pool.query(
    `UPDATE transactions
     SET authorization_url = $1,
         access_code       = $2,
         gateway_reference = $3,
         status            = 'INITIALIZED'
     WHERE reference = $4
     RETURNING *`,
    [authorizationUrl, accessCode, gatewayReference, reference]
  );
  return rows[0] ?? null;
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteTransaction(id) {
  const { rowCount } = await pool.query(
    `DELETE FROM transactions WHERE id = $1`,
    [id]
  );
  return rowCount > 0;
}