import pool from "../config/db.js";

const TABLE = "transactions";
const crypto = await import("crypto");

class TransactionModel {


static async createTransaction(data, client = null) {
  const db = client || pool;

  const {
    reference = `TXN-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    transactionType,
    coverImageUrl = null,
    title,
    propertyId,
    userId,
    sellerId = null,
    amount,
    platformFee = 0,
    sellerPayoutAmount = null,
    currency = 'NGN',
    status = 'in progress',
    purchaseStep = 'initiated',
    escrowStatus = 'not_applicable',
    paymentChannel = null,
    gatewayReference = null,
    gatewayResponse = null,
    failureReason = null,
    retryCount = 0,
    metadata = {},
  } = data || {};

  // Required fields per schema (NOT NULL, no default)
  const missing = [];
  if (!transactionType) missing.push('transactionType');
  if (!title) missing.push('title');
  if (!propertyId) missing.push('propertyId');
  if (!userId) missing.push('userId');
  if (amount === undefined || amount === null) missing.push('amount');
  if (!purchaseStep) missing.push('purchaseStep');

  if (missing.length) {
    throw new Error(`Missing required transaction fields: ${missing.join(', ')}`);
  }

  const { rows } = await db.query(
    `INSERT INTO ${TABLE}
      (reference, transaction_type, cover_image_url, title, property_id, user_id,
       seller_id, amount, platform_fee, seller_payout_amount, currency, status,
       escrow_status, payment_channel, gateway_reference, gateway_response,
       failure_reason, retry_count, metadata, purchase_step)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
     RETURNING *`,
    [
      reference,
      transactionType,
      coverImageUrl,
      title,
      propertyId,
      userId,
      sellerId,
      amount,
      platformFee,
      sellerPayoutAmount,
      currency,
      status,
      escrowStatus,
      paymentChannel,
      gatewayReference,
      gatewayResponse,
      failureReason,
      retryCount,
      JSON.stringify(metadata),
      purchaseStep,
    ]
  );

  return rows[0] || null;
}
  static async getTransaction(id,userId, client = null) {
    if (!id) return null;
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [id, userId]
    );
    return rows[0] || null;
  }

 static async getTransactions(userId) {
  if (!userId) return [];
  const { rows } = await pool.query(
    `SELECT * FROM ${TABLE} WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}


  static async updateTransactionStatus(id, currentStatus, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TABLE} SET transaction_status = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, currentStatus]
    );
    return rows[0] || null;
  }

  
  static async deleteTransaction(id, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TABLE} SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    return rows[0] || null;
  }
}

export default TransactionModel;
