import pool from "../config/db.js";
import { notificationQueue } from "../queues/notification.queue.js";
import {FIELD_MAP} from "./gen.property.model/gen.property.model.js";



const TABLE = "property";


const SORT_FIELDS = Object.freeze({
  house_id: "house_id",
  asking_price: "asking_price",
  created_at: "created_at",
  address: "address",
  status: "status",
  property_type: "property_type",
  updated_at: "updated_at",
});

const mapPayloadToDb = (payload = {}) => {
  const mapped = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined) continue;
    const column = FIELD_MAP[k] || k;
    if (( column === "cover_image_url") && v !== null) {
      mapped[column] =
        typeof v === "string" ? v : JSON.stringify(v);
      continue;
    }
    mapped[column] = v;
  }
  return mapped;
};

const buildFilters = (filters = {}, startIndex = 1) => {
  const conditions = [];
  const values = [];
  let idx = startIndex;

  if (filters.status) {
    conditions.push(`status = $${idx++}`);
    values.push(filters.status);
  }
  if (filters.propertyId) {
    conditions.push(`property_id = $${idx++}`);
    values.push(filters.propertyId);
  }
  if (filters.state) {
    conditions.push(`state = $${idx++}`);
    values.push(filters.state);
  }
  if (filters.minPrice !== undefined) {
    conditions.push(`asking_price >= $${idx++}`);
    values.push(filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    conditions.push(`asking_price <= $${idx++}`);
    values.push(filters.maxPrice);
  }
  if (filters.bedrooms !== undefined) {
    conditions.push(`bedrooms = $${idx++}`);
    values.push(filters.bedrooms);
  }
  if (filters.propertyType !== undefined){
    conditions.push(`propertyType = $${idx++}`);
    values.push(filters.propertyType);
  }
  if (filters.lga !== undefined){
    conditions.push(`lga = $${idx++}`);
    values.push(filters.lga);
  }
  if (filters.verificationStatus) {
    conditions.push(`verification_status = $${idx++}`);
    values.push(filters.verificationStatus);
  }
  if (filters.q) {
    conditions.push(
      `(address ILIKE $${idx} OR property_type::text ILIKE $1 OR description ILIKE $${idx} OR lga ILIKE $${idx} OR state ILIKE $${idx})`
    );
    values.push(`%${filters.q}%`);
    idx++;
  }

  return { conditions, values, nextIndex: idx };
};

class PropertyModel {
  static parseSort(sortBy = "created_at", sortOrder = "desc") {
    const column = SORT_FIELDS[String(sortBy).toLowerCase()] || SORT_FIELDS.created_at;
    const order = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";
    return { column, order };
  }

  static async create(data, client = null) {
    const db = client || pool;
    const payload = mapPayloadToDb(data);
    const columns = Object.keys(payload);
    const values = Object.values(payload);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

    const { rows } = await db.query(
      `INSERT INTO ${TABLE} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    
    return rows[0];
  }

 

  static async findById(sellerId, propertyId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE property_id = $1 LIMIT 1`,
      [sellerId, propertyId]
    );
    return rows[0] || null;
  }

  static async findByStatus(status, sellerId, propertyType) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE status = $1 AND seller_id = $2 AND property_type = $3 ORDER BY created_at DESC`,
      [status, sellerId, propertyType]
    );
    return rows;
  }

  static async deleteProperty(sellerId,propertyId, client = null) {
    const db = client || pool;
    const { rowCount } = await db.query(
      `DELETE FROM ${TABLE} WHERE seller_id = $1 AND property_id = $2`,
      [sellerId,propertyId]
    );
    return rowCount > 0;
  }


  static async list({
    page = 1,
    limit = 10,
    sortBy = "created_at",
    sortOrder = "desc",
    filters = {},
  } = {}) {
    const offset = (page - 1) * limit;
    const { column, order } = this.parseSort(sortBy, sortOrder);
    const built = buildFilters(filters, 1);
    const where = built.conditions.length ? `WHERE ${built.conditions.join(" AND ")}` : "";

    const total = await this.count(filters);
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE}
       ${where}
       ORDER BY ${column} ${order}
       LIMIT $${built.values.length + 1}
       OFFSET $${built.values.length + 2}`,
      [...built.values, limit, offset]
    );

    return {
      rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  static async findEstateProperties(sellerId, propertyType, estateId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE seller_id = $1 AND is_estate = true AND property_type = $2 AND estateId = $3 ORDER BY created_at DESC`,
      [sellerId, propertyType, estateId]
    );
    return rows;
  }

  static async findNonEstatePropertiesBySeller(sellerId, propertyType) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE seller_id = $1 AND is_estate = false AND property_type = $2  ORDER BY created_at DESC`,
      [sellerId, propertyType]
    );
    return rows;
  }

  static async findBySeller(sellerId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE seller_id = $1 ORDER BY created_at DESC`,
      [sellerId]
    );
    return rows;
  }

  static async findSellerProperties(sellerId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE seller_id = $1 AND deleted_at = null AND sold_out = false ORDER BY created_at DESC`,
      [sellerId]
    );
    return rows;
  }

  static async findAvailable({ limit = 50, offset = 0 } = {}) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE sold_out = false AND deleted_t = null ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  }

  static async search(q, { limit = 50, offset = 0 } = {}) {
    const where = buildWhereFilters({ q }, 1);
    const { rows } = await pool.query(
      `
        SELECT * FROM ${TABLE}
        WHERE deleted_at = null AND ${where.conditions.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${where.values.length + 1} OFFSET $${where.values.length + 2}
      `,
      [...where.values, limit, offset]
    );
    return rows;
  }

  static async updateCover(propertyId, imageUrl, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TABLE} SET cover_image_url = $1 WHERE property_id = $2 RETURNING *`,
      [imageUrl, propertyId]
    );
    return rows[0] || null;
  }



  static async update(propertyId, data, client = null) {
    const db = client || pool;
    const payload = mapPayloadToDb(data);
    const entries = Object.entries(payload);
    if (!entries.length) return null;

    const sets = [];
    const values = [];
    let idx = 1;
    for (const [column, value] of entries) {
      sets.push(`${column} = $${idx++}`);
      values.push(value);
    }
    values.push(propertyId);

    const { rows } = await db.query(
      `
        UPDATE ${TABLE}
        SET ${sets.join(", ")}
        WHERE property_id = $${idx}
        RETURNING *
      `,
      values
    );
    return rows[0] || null;
  }

  static async count(filters = {}) {
  const built = buildFilters(filters, 1);

  const whereParts = [`deleted_at IS NULL`, ...built.conditions];

  const whereClause = whereParts.length
    ? `WHERE ${whereParts.join(" AND ")}`
    : "";

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM ${TABLE} ${whereClause}`,
    built.values
  );

  return rows[0]?.count || 0;
}


  static calculateStats(rows = []) {
    const total = rows.length;
    const prices = rows.map((r) => Number(r.asking_price) || 0);
    const sum = prices.reduce((a, b) => a + b, 0);
    const sold = rows.filter((r) => r.status === "sold").length;
    const active = rows.filter((r) => r.status === "active").length;

    return {
      totalHouses: total,
      soldHouses: sold,
      activeHouses: active,
      totalMarketValue: sum,
      averageAskingPrice: total ? sum / total : 0,
      minAskingPrice: total ? Math.min(...prices) : 0,
      maxAskingPrice: total ? Math.max(...prices) : 0,
    };
  }

static async softDelete(id, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TABLE}
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    return rows[0] || null;
  }

  static async deleteAll() {
    const { rowCount } = await pool.query(`DELETE FROM ${TABLE}`);
    return rowCount;
  }

  

  static async bulkInsert(lands = []) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let inserted = 0;
      for (const property of properties) {
        await this.create(property, client);
        inserted++;
      }
      await client.query("COMMIT");
      return inserted;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        // no-op
      }
      throw error;
    } finally {
      client.release();
    }
  }

  static async search(q, { limit = 50, offset = 0 } = {}) {
    const where = buildWhereFilters({ q }, 1);
    const { rows } = await pool.query(
      `
        SELECT * FROM ${TABLE}
        WHERE ${where.conditions.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${where.values.length + 1} OFFSET $${where.values.length + 2}
      `,
      [...where.values, limit, offset]
    );
    return rows;
  }

   static async findBySellerAndType(sellerId,propertyType) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE seller_id = $1 AND property_type = $2 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [sellerId, propertyType]
    );
    return rows;
  }

   static async findSellerEstateLand(sellerId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE seller_id = $1 AND property_type = land AND is_estate = true AND deleted_at IS NULL ORDER BY created_at DESC`,
      [sellerId, propertyType]
    );
    return rows;
  }

   static async findBySellerHouseProperties(sellerId,houseId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE seller_id = $1 AND house_id = $2 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [sellerId, propertyType]
    );
    return rows;
  }

   static async findPropertiesBySeller(sellerId,propertyType) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE seller_id = $1 AND property_type = $2 ORDER BY created_at DESC`,
      [sellerId, propertyType]
    );
    return rows;
  }

  static async findAvailable({ limit = 50, offset = 0 } = {}) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE sold_out = false AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  }

  static async findEstateLands(sellerId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE seller_id = $1 AND is_estate = true AND property_type = land AND deleted_at IS NULL ORDER BY created_at DESC`,
      [sellerId]
    );
    return rows;
  }
}


export default PropertyModel;
