import pool from "../config/db.js";

const STEPS_TABLE = "purchase_process_steps";

const STEP_COMPLETION_COLUMNS = Object.freeze({
  booking: "booking_completed",
  booking_fee: "booking_completed",
  booking_fee_paid: "booking_completed",
  inspection: "inspection_completed",
  inspection_requested: "inspection_completed",
  payment: "payment_completed",
  payment_requested: "payment_completed",
  payment_received: "payment_completed",
  allocation: "allocation_completed",
  allocation_requested: "allocation_completed",
  allocation_confirmed: "allocation_completed",
  contract_signing: "contract_signing_completed",
  contract_signing_requested: "contract_signing_completed",
  contract_signed: "contract_signing_completed",
  completion: "completion_completed",
  completed: "completion_completed",
  order_completed: "completion_completed",
});

const completionColumnFor = (step) =>
  STEP_COMPLETION_COLUMNS[String(step || "").trim().toLowerCase().replace(/[ -]+/g, "_")] || null;

class PurchaseProcessStepModel {
  static async requestAllocation(orderId, userId, details = {}) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: orders } = await client.query(
        `SELECT * FROM property_orders WHERE order_id = $1 AND deleted_at IS NULL FOR UPDATE`, [orderId]
      );
      const order = orders[0];
      if (!order) {
        const error = new Error("Purchase order not found");
        error.status = 404;
        throw error;
      }
      if (String(order.buyer_id) !== String(userId)) {
        const error = new Error("Only the buyer can request property allocation");
        error.status = 403;
        throw error;
      }
      const { rows: existing } = await client.query(
        `SELECT id FROM ${STEPS_TABLE} WHERE order_id = $1 AND step = 'allocation_requested'
         AND status IS DISTINCT FROM 'rejected' ORDER BY created_at DESC LIMIT 1`, [orderId]
      );
      if (existing.length) {
        const error = new Error("An allocation request is already active for this order");
        error.status = 409;
        throw error;
      }
      const { rows: steps } = await client.query(
        `INSERT INTO ${STEPS_TABLE} (order_id, step, status, step_data)
         VALUES ($1, 'allocation_requested', 'pending', $2) RETURNING *`,
        [orderId, { request: details, requestedBy: userId, requestedAt: new Date().toISOString() }]
      );
      const { rows: updatedOrders } = await client.query(
        `UPDATE property_orders SET purchase_step = 'allocation_requested', funnel_step = 'allocation',
         updated_at = NOW(), version = COALESCE(version, 0) + 1 WHERE order_id = $1 RETURNING *`, [orderId]
      );
      await client.query("COMMIT");
      return { order: updatedOrders[0], currentStep: steps[0] };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async confirmAllocation(orderId, userId, confirmation = {}) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: orders } = await client.query(
        `SELECT * FROM property_orders WHERE order_id = $1 AND deleted_at IS NULL FOR UPDATE`, [orderId]
      );
      const order = orders[0];
      if (!order) {
        const error = new Error("Purchase order not found");
        error.status = 404;
        throw error;
      }
      if (String(order.buyer_id) !== String(userId)) {
        const error = new Error("Only the buyer can confirm property allocation");
        error.status = 403;
        throw error;
      }
      const { rows: steps } = await client.query(
        `SELECT * FROM ${STEPS_TABLE} WHERE order_id = $1 AND step = 'allocation_requested'
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [orderId]
      );
      const current = steps[0];
      if (!current) {
        const error = new Error("No allocation request exists for this order");
        error.status = 404;
        throw error;
      }
      if (current.status === "confirmed") {
        const error = new Error("Property allocation has already been confirmed");
        error.status = 409;
        throw error;
      }
      const data = current.step_data || current.stepdata || {};
      const confirmations = {
        ...(data.confirmations || {}),
        buyer: { confirmed: true, userId, confirmedAt: new Date().toISOString() },
      };
      const allocationCompleted = Boolean(confirmations.buyer?.confirmed);
      const { rows: updatedSteps } = await client.query(
        `UPDATE ${STEPS_TABLE} SET status = 'confirmed', step_data = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [{ ...data, confirmation, confirmations }, current.id]
      );
      const { rows: updatedOrders } = await client.query(
        `UPDATE property_orders SET purchase_step = 'allocation_confirmed', funnel_step = 'allocation',
         allocation_completed = CASE WHEN $2 THEN TRUE ELSE allocation_completed END,
         updated_at = NOW(), version = COALESCE(version, 0) + 1 WHERE order_id = $1 RETURNING *`,
        [orderId, allocationCompleted]
      );
      await client.query("COMMIT");
      return { order: updatedOrders[0], currentStep: updatedSteps[0] };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

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

  /** Current step and order participants for an order. */
  static async getCurrentPurchaseStep(orderId) {
    const { rows: orderRows } = await pool.query(
      `SELECT order_id, buyer_id, seller_id, purchase_step, funnel_step
       FROM property_orders WHERE order_id = $1 AND deleted_at IS NULL`,
      [orderId]
    );
    if (!orderRows[0]) return null;
    const { rows: steps } = await pool.query(
      `SELECT * FROM ${STEPS_TABLE} WHERE order_id = $1
       ORDER BY created_at DESC, id DESC`,
      [orderId]
    );
    return { order: orderRows[0], currentStep: steps[0] || null, steps: steps.reverse() };
  }

  /** Persist the authenticated party's confirmation of the current step. */
  static async confirmCurrentStep(orderId, userId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: orders } = await client.query(
        `SELECT order_id, buyer_id, seller_id FROM property_orders
         WHERE order_id = $1 AND deleted_at IS NULL FOR UPDATE`, [orderId]
      );
      const order = orders[0];
      if (!order) {
        await client.query("ROLLBACK");
        return null;
      }
      if (String(order.buyer_id) !== String(userId)) {
        const error = new Error("Only the order buyer can confirm this step");
        error.status = 403;
        throw error;
      }
      const { rows: steps } = await client.query(
        `SELECT * FROM ${STEPS_TABLE} WHERE order_id = $1
         ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`, [orderId]
      );
      const current = steps[0];
      if (!current) {
        const error = new Error("No purchase step exists for this order");
        error.status = 404;
        throw error;
      }
      const data = current.step_data || current.stepdata || {};
      const confirmations = {
        ...(data.confirmations || {}),
        buyer: { confirmed: true, userId, confirmedAt: new Date().toISOString() },
      };
      const completed = confirmations.buyer.confirmed;
      const completionColumn = completed ? completionColumnFor(current.step) : null;
      const purchaseStep = current.step === "allocation_requested"
        ? "allocation_confirmed"
        : current.step;
      const { rows: updatedSteps } = await client.query(
        `UPDATE ${STEPS_TABLE} SET step_data = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [{ ...data, confirmations }, current.id]
      );
      const completionUpdate = completionColumn ? `, ${completionColumn} = TRUE` : "";
      const { rows: updatedOrders } = await client.query(
        `UPDATE property_orders SET purchase_step = $1, funnel_step = $2${completionUpdate},
         updated_at = NOW(), version = COALESCE(version, 0) + 1
         WHERE order_id = $3 RETURNING *`, [purchaseStep, completionColumn === "allocation_completed" ? "allocation" : purchaseStep, orderId]
      );
      await client.query("COMMIT");
      return { order: updatedOrders[0], currentStep: updatedSteps[0] };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
