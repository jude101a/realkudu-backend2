import pool from "../config/db.js";

const TABLE = "tenant_meta";

class TenantModel {
  static async createTenantMeta(data, client = null) {
    const db = client || pool;
    const columns = [];
    const values = [];
    const placeholders = [];
    let idx = 1;

    for (const [k, v] of Object.entries(data || {})) {
      if (v === undefined) continue;
      columns.push(k);
      values.push(v);
      placeholders.push(`$${idx++}`);
    }

    if (!columns.length) return null;

    const { rows } = await db.query(
      `INSERT INTO ${TABLE} (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values
    );

    return rows[0] || null;
  }

  static async getTenantMetaByTenant(tenantId) {
    if (!tenantId) return null;
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [tenantId]
    );
    return rows[0] || null;
  }

  static async getTenantMetaByProperty(propertyId) {
    if (!propertyId) return null;
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE property_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [propertyId]
    );
    return rows[0] || null;
  }

  static async markRentPaid(tenantMetaId, paymentDate, nextDueDate, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TABLE} SET has_paid_current_rent = TRUE, last_payment_date = $1, next_due_date = $2, outstanding_balance = 0, updated_at = NOW() WHERE id = $3 AND deleted_at IS NULL RETURNING *`,
      [paymentDate, nextDueDate, tenantMetaId]
    );
    return rows[0] || null;
  }

  static async updateOutstandingBalance(tenantMetaId, amount, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TABLE} SET outstanding_balance = $1, has_paid_current_rent = CASE WHEN $1 <= 0 THEN TRUE ELSE FALSE END, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
      [amount, tenantMetaId]
    );
    return rows[0] || null;
  }

  static async serveNotice(tenantMetaId, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TABLE} SET notice_served = TRUE, tenancy_status = 'terminated', updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [tenantMetaId]
    );
    return rows[0] || null;
  }

  static async terminateTenancy(tenantMetaId, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TABLE} SET is_active_tenant = FALSE, tenancy_status = 'expired', tenancy_end_date = NOW()::date, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [tenantMetaId]
    );
    return rows[0] || null;
  }

  static async deleteTenantMeta(tenantMetaId, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TABLE} SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [tenantMetaId]
    );
    return rows[0] || null;
  }
}

export default TenantModel;
