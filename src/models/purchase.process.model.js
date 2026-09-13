import pool from "../config/db.js";

const STEPS_TABLE = "purchase_process_steps";

class PurchaseProcessStepModel {
  /**
   * Inserts a new step row. Intended to be called with a transaction
   * client so it's atomic with whatever order/transaction update
   * triggered it — pass `client` when inside a withTransaction block,
   * omit it for standalone reads/writes outside a transaction.
   *
   * @param {import('pg').PoolClient | import('pg').Pool} executor
   * @param {string} orderId
   * @param {string} step
   * @param {Object} [stepData]
   */
  static async create(executor, orderId, step, stepData = {}) {
    const { rows } = await executor.query(
      `INSERT INTO ${STEPS_TABLE} (order_id, step, step_data)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [orderId, step, stepData]
    );
    return rows[0];
  }

  /** Full step history for an order, oldest first. */
  static async findByOrderId(orderId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${STEPS_TABLE} WHERE order_id = $1 ORDER BY created_at ASC`,
      [orderId]
    );
    return rows;
  }

  /** Whether a given step has ever occurred for this order. */
  static async hasStep(orderId, step) {
    const { rows } = await pool.query(
      `SELECT 1 FROM ${STEPS_TABLE} WHERE order_id = $1 AND step = $2 LIMIT 1`,
      [orderId, step]
    );
    return rows.length > 0;
  }
}

export default PurchaseProcessStepModel;