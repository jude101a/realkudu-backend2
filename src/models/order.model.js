import pool from "../config/db.js";
import { withTransaction } from "../config/withTransaction.js";
import { mapPayload, buildInsert } from "../utils/mapPayload.js";
import PurchaseProcessStepModel from "./purchase.process.model.js";
import AppError from "../utils/AppError.js";

const ORDERS_TABLE = "orders";

const ORDER_FIELD_MAP = Object.freeze({
  reference: "reference",
  transactionType: "transaction_type",
  coverImageUrl: "cover_image_url",
  title: "title",
  propertyType: "property_type",
  propertyId: "property_id",
  userId: "user_id",
  sellerId: "seller_id",
  amount: "amount",
  quantity: "quantity",
  platformFee: "platform_fee",
  currency: "currency",
  status: "status",
  purchaseStep: "purchase_step",
  escrowStatus: "escrow_status",
  paymentChannel: "payment_channel",
});

const REQUIRED_ORDER_FIELDS = [
  "reference",
  "transactionType",
  "title",
  "propertyType",
  "propertyId",
  "userId",
  "amount",
  "purchaseStep",
];

class OrderModel {
  /**
   * Creates the order (the anchor record for a purchase process) and
   * its first step row atomically. Called when the inspection fee
   * payment succeeds.
   *
   * @param {Object} payload - camelCase order fields (see ORDER_FIELD_MAP)
   * @param {Object} [initialStepData]
   * @returns {Promise<{ order: Object, step: Object }>}
   */
  static async create(payload, initialStepData = {}) {
    const missing = REQUIRED_ORDER_FIELDS.filter((field) => payload[field] === undefined || payload[field] === null);
    if (missing.length) {
      throw new AppError(`Missing required order fields: ${missing.join(", ")}`, 400);
    }

    return withTransaction(async (client) => {
      const mapped = mapPayload(payload, ORDER_FIELD_MAP);
      const { text, values } = buildInsert(ORDERS_TABLE, mapped);
      const { rows: [order] } = await client.query(text, values);

      const step = await PurchaseProcessStepModel.create(
        client,
        order.id,
        order.purchase_step,
        initialStepData
      );

      return { order, step };
    });
  }

  /**
   * Advances the order's purchase_step pointer and logs the step event
   * atomically. This is the single write path for every step transition
   * (confirmations, reschedules, uploads, etc.) — callers pass whichever
   * step name applies.
   *
   * @param {string} orderId
   * @param {string} step
   * @param {Object} [stepData]
   */
  static async advanceStep(orderId, step, stepData = {}) {
    return withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id FROM ${ORDERS_TABLE} WHERE id = $1 FOR UPDATE`,
        [orderId]
      );
      if (!rows.length) {
        throw new AppError(`Order ${orderId} not found`, 404);
      }

      const stepRow = await PurchaseProcessStepModel.create(client, orderId, step, stepData);

      const { rows: [order] } = await client.query(
        `UPDATE ${ORDERS_TABLE} SET purchase_step = $1 WHERE id = $2 RETURNING *`,
        [step, orderId]
      );

      return { order, step: stepRow };
    });
  }

  static async markCompleted(orderId) {
    const { rows } = await pool.query(
      `UPDATE ${ORDERS_TABLE}
       SET status = 'success', completed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId]
    );
    if (!rows.length) {
      throw new AppError(`Order ${orderId} not found`, 404);
    }
    return rows[0];
  }

  static async markFailed(orderId) {
    const { rows } = await pool.query(
      `UPDATE ${ORDERS_TABLE}
       SET status = 'failed'
       WHERE id = $1
       RETURNING *`,
      [orderId]
    );
    if (!rows.length) {
      throw new AppError(`Order ${orderId} not found`, 404);
    }
    return rows[0];
  }

  static async findById(orderId) {
    const { rows } = await pool.query(`SELECT * FROM ${ORDERS_TABLE} WHERE id = $1`, [orderId]);
    return rows[0] || null;
  }

  static async findByReference(reference) {
    const { rows } = await pool.query(`SELECT * FROM ${ORDERS_TABLE} WHERE reference = $1`, [reference]);
    return rows[0] || null;
  }

  /** All orders for a given buyer, most recent first. */
  static async findByUserId(userId, { limit = 20, offset = 0 } = {}) {
    const { rows } = await pool.query(
      `SELECT * FROM ${ORDERS_TABLE}
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  }

  /** All orders for a given property (e.g. seller-facing view). */
  static async findByPropertyId(propertyId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${ORDERS_TABLE} WHERE property_id = $1 ORDER BY created_at DESC`,
      [propertyId]
    );
    return rows;
  }

  /** Order plus its full step history and linked transactions. */
  static async getFullHistory(orderId) {
    const order = await this.findById(orderId);
    if (!order) return null;

    const [steps, { rows: transactions }] = await Promise.all([
      PurchaseProcessStepModel.findByOrderId(orderId),
      pool.query(`SELECT * FROM transactions WHERE order_id = $1 ORDER BY created_at ASC`, [orderId]),
    ]);

    return { order, steps, transactions };
  }
}

export default OrderModel;