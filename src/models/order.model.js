
import pool from "../config/db.js";
import { withTransaction } from "../config/withTransaction.js";
import PurchaseProcessStepModel from "./purchase.process.model.js";
import AppError from "../utils/appError.js";

const ORDERS_TABLE = "property_orders";

const ORDER_FIELD_MAP = Object.freeze({
  buyerId: "buyer_id",
  sellerId: "seller_id",
  agentId: "agent_id",
  lawyerId: "lawyer_id",
  propertyId: "property_id",
  quantity: "quantity",
  propertyType: "property_type",
  status: "status",
  paymentType: "payment_type",
  bookingFee: "booking_fee",
  agreedAmount: "agreed_amount",
  amountPaid: "amount_paid",
  currency: "currency",
  inspectionRequired: "inspection_required",
  inspectionCompleted: "inspection_completed",
  dueDiligenceCompleted: "due_diligence_completed",
  agreementSigned: "agreement_signed",
  governmentConsentRequired: "government_consent_required",
  notes: "notes",
  purchaseStep: "purchase_step",
  funnelStep: "funnel_step",
  version: "version",
  docsVerified: "docs_verified",
  completedAt: "completed_at",
  cancelledAt: "cancelled_at",
  deletedAt: "deleted_at",
});

const REQUIRED_ORDER_FIELDS = [
  "buyerId",
  "sellerId",
  "propertyId",
  "propertyType",
  "status",
  "paymentType",
  "agreedAmount",
];

function mapPayload(payload) {
  const mapped = {};

  for (const [camelCase, snakeCase] of Object.entries(ORDER_FIELD_MAP)) {
    if (payload[camelCase] !== undefined) {
      mapped[snakeCase] = payload[camelCase];
    }
  }

  return mapped;
}

function buildInsert(table, data) {
  const entries = Object.entries(data);

  if (!entries.length) {
    throw new AppError("No order fields supplied", 400);
  }

  const columns = entries.map(([column]) => column);
  const values = entries.map(([, value]) => value);

  const placeholders = values.map((_, index) => `$${index + 1}`);

  return {
    text: `
      INSERT INTO ${table} (
        ${columns.join(", ")}
      )
      VALUES (
        ${placeholders.join(", ")}
      )
      RETURNING *
    `,
    values,
  };
}

class OrderModel {
  static async create(payload, initialStepData = {}) {
    const missing = REQUIRED_ORDER_FIELDS.filter(
      (field) =>
        payload[field] === undefined ||
        payload[field] === null
    );

    if (missing.length) {
      throw new AppError(
        `Missing required order fields: ${missing.join(", ")}`,
        400
      );
    }

    return withTransaction(async (client) => {
      const mapped = mapPayload(payload);

      const { text, values } = buildInsert(
        ORDERS_TABLE,
        mapped
      );

      const {
        rows: [order],
      } = await client.query(text, values);

      const step = order.purchase_step
        ? await PurchaseProcessStepModel.create(
            client,
            order.order_id,
            order.purchase_step,
            initialStepData
          )
        : null;

      return {
        order,
        step,
      };
    });
  }

  static async advanceStep(
    orderId,
    step,
    stepData = {}
  ) {
    return withTransaction(async (client) => {
      const { rows } = await client.query(
        `
          SELECT
            order_id,
            status,
            purchase_step,
            funnel_step,
            version
          FROM ${ORDERS_TABLE}
          WHERE order_id = $1
            AND deleted_at IS NULL
          FOR UPDATE
        `,
        [orderId]
      );

      if (!rows.length) {
        throw new AppError(
          `Order ${orderId} not found`,
          404
        );
      }

      const stepRow =
        await PurchaseProcessStepModel.create(
          client,
          orderId,
          step,
          stepData
        );

      const {
        rows: [order],
      } = await client.query(
        `
          UPDATE ${ORDERS_TABLE}
          SET
            purchase_step = $1,
            updated_at = NOW(),
            version = version + 1
          WHERE order_id = $2
            AND deleted_at IS NULL
          RETURNING *
        `,
        [step, orderId]
      );

      return {
        order,
        step: stepRow,
      };
    });
  }

  static async markCompleted(orderId) {
    const {
      rows: [order],
    } = await pool.query(
      `
        UPDATE ${ORDERS_TABLE}
        SET
          status = 'completed',
          completed_at = COALESCE(completed_at, NOW()),
          updated_at = NOW(),
          version = version + 1
        WHERE order_id = $1
          AND deleted_at IS NULL
        RETURNING *
      `,
      [orderId]
    );

    if (!order) {
      throw new AppError(
        `Order ${orderId} not found`,
        404
      );
    }

    return order;
  }

  static async markFailed(orderId) {
    const {
      rows: [order],
    } = await pool.query(
      `
        UPDATE ${ORDERS_TABLE}
        SET
          status = 'failed',
          updated_at = NOW(),
          version = version + 1
        WHERE order_id = $1
          AND deleted_at IS NULL
        RETURNING *
      `,
      [orderId]
    );

    if (!order) {
      throw new AppError(
        `Order ${orderId} not found`,
        404
      );
    }

    return order;
  }

  static async findById(orderId) {
    const {
      rows: [order],
    } = await pool.query(
      `
        SELECT *
        FROM ${ORDERS_TABLE}
        WHERE order_id = $1
          AND deleted_at IS NULL
      `,
      [orderId]
    );

    return order || null;
  }

  static async findByReference(reference) {
    return null;
  }

  static async findByUserId(
    userId,
    { limit = 20, offset = 0 } = {}
  ) {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM ${ORDERS_TABLE}
        WHERE buyer_id = $1
          AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT $2
        OFFSET $3
      `,
      [userId, limit, offset]
    );

    return rows;
  }

  static async findByBuyerId(
    buyerId,
    { limit = 20, offset = 0 } = {}
  ) {
    return this.findByUserId(
      buyerId,
      { limit, offset }
    );
  }

  static async findByPropertyId(propertyId) {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM ${ORDERS_TABLE}
        WHERE property_id = $1
          AND deleted_at IS NULL
        ORDER BY created_at DESC
      `,
      [propertyId]
    );

    return rows;
  }

  static async findBySellerId(
    sellerId,
    { limit = 20, offset = 0 } = {}
  ) {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM ${ORDERS_TABLE}
        WHERE seller_id = $1
          AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT $2
        OFFSET $3
      `,
      [sellerId, limit, offset]
    );

    return rows;
  }

  static async getFullHistory(orderId) {
    const order = await this.findById(orderId);

    if (!order) {
      return null;
    }

    const [steps, { rows: transactions }] =
      await Promise.all([
        PurchaseProcessStepModel.findByOrderId(
          orderId
        ),

        pool.query(
          `
            SELECT *
            FROM transactions
            WHERE order_id = $1
            ORDER BY created_at ASC
          `,
          [orderId]
        ),
      ]);

    return {
      order,
      steps,
      transactions,
    };
  }
}

export default OrderModel;

