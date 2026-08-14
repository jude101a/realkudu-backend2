import pool from "../config/db.js";

const TABLE = "transfers";

const TRANSFER_STATUS = Object.freeze({
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  REVERSED: "REVERSED",
});

const normalizeStatus = (status) => String(status || "").toUpperCase();

const toJson = (value = {}) => JSON.stringify(value ?? {});

class TransferRepository {
  async create({
    reference,
    escrowId = null,
    sellerId = null,
    recipientCode = null,
    amount = null,
    platformFee = 0,
    agentCommission = 0,
    payoutAmount = null,
    status = TRANSFER_STATUS.PENDING,
    gatewayResponse = {},
  }) {
    const { rows } = await pool.query(
      `
        INSERT INTO ${TABLE} (
          reference,
          escrow_id,
          seller_id,
          recipient_code,
          amount,
          platform_fee,
          agent_commission,
          payout_amount,
          status,
          gateway_response
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10
        )
        RETURNING *
      `,
      [
        reference,
        escrowId,
        sellerId,
        recipientCode,
        amount,
        platformFee,
        agentCommission,
        payoutAmount,
        normalizeStatus(status),
        toJson(gatewayResponse),
      ]
    );

    return rows[0];
  }

  async findByReference(reference) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE reference = $1 LIMIT 1`,
      [reference]
    );
    return rows[0] ?? null;
  }

  async findBySeller(sellerId, { page = 1, limit = 20 } = {}) {
    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const offset = (safePage - 1) * safeLimit;

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `
          SELECT *
          FROM ${TABLE}
          WHERE seller_id = $1
          ORDER BY created_at DESC
          LIMIT $2
          OFFSET $3
        `,
        [sellerId, safeLimit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM ${TABLE} WHERE seller_id = $1`, [
        sellerId,
      ]),
    ]);

    const total = countRows[0]?.total ?? 0;

    return {
      rows,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: total ? Math.ceil(total / safeLimit) : 0,
    };
  }

  async updateStatus(reference, status, gatewayResponse = {}) {
    const { rows } = await pool.query(
      `
        UPDATE ${TABLE}
        SET status = $1,
            gateway_response = $2,
            updated_at = NOW()
        WHERE reference = $3
        RETURNING *
      `,
      [normalizeStatus(status), toJson(gatewayResponse), reference]
    );
    return rows[0] ?? null;
  }

  async markProcessing(reference, response = {}) {
    return this.updateStatus(reference, TRANSFER_STATUS.PROCESSING, response);
  }

  async markSuccess(reference, response = {}) {
    return this.updateStatus(reference, TRANSFER_STATUS.SUCCESS, response);
  }

  async markFailed(reference, response = {}) {
    return this.updateStatus(reference, TRANSFER_STATUS.FAILED, response);
  }

  async markReversed(reference, response = {}) {
    return this.updateStatus(reference, TRANSFER_STATUS.REVERSED, response);
  }
}

export { TRANSFER_STATUS };
export default new TransferRepository();
