import pool from "../config/db.js";

const TABLE = "houses_for_sale";

const FIELD_MAP = Object.freeze({
  houseId: "house_id",
  ownerId: "owner_id",
  agentId: "agent_id",
  lawyerId: "lawyer_id",
  buyerId: "buyer_id",
  verificationStatus: "verification_status",
  finalSalePrice: "final_sale_price",
  houseType: "house_type",
  landSize: "land_size",
  askingPrice: "asking_price",
  titleDocument: "title_document",
  hasSurveyPlan: "has_survey_plan",
  hasBuildingApproval: "has_building_approval",
  governorConsentObtained: "governor_consent_obtained",
  soldAt: "sold_at",
});

const SORT_FIELDS = Object.freeze({
  house_id: "house_id",
  asking_price: "asking_price",
  created_at: "created_at",
  address: "address",
  status: "status",
  updated_at: "updated_at",
});

const mapPayloadToDb = (payload = {}) => {
  const mapped = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined) continue;
    const column = FIELD_MAP[k] || k;
    if ((column === "features" || column === "images") && v !== null) {
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
  if (filters.ownerId) {
    conditions.push(`owner_id = $${idx++}`);
    values.push(filters.ownerId);
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
  if (filters.verificationStatus) {
    conditions.push(`verification_status = $${idx++}`);
    values.push(filters.verificationStatus);
  }
  if (filters.q) {
    conditions.push(
      `(address ILIKE $${idx} OR landmark ILIKE $${idx} OR description ILIKE $${idx} OR lga ILIKE $${idx} OR state ILIKE $${idx})`
    );
    values.push(`%${filters.q}%`);
    idx++;
  }

  return { conditions, values, nextIndex: idx };
};

class HouseForSaleModel {
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

  static async update(houseId, fields, client = null) {
    const db = client || pool;
    const payload = mapPayloadToDb(fields);
    const entries = Object.entries(payload);
    if (!entries.length) return null;

    const setClause = [];
    const values = [];
    let idx = 1;
    for (const [column, value] of entries) {
      setClause.push(`${column} = $${idx++}`);
      values.push(value);
    }
    values.push(houseId);

    const { rows } = await db.query(
      `UPDATE ${TABLE}
       SET ${setClause.join(", ")}
       WHERE house_id = $${idx}
       RETURNING *`,
      values
    );
    return rows[0] || null;
  }

  static async findById(houseId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE house_id = $1 LIMIT 1`,
      [houseId]
    );
    return rows[0] || null;
  }

  static async findByStatus(status) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE status = $1 ORDER BY created_at DESC`,
      [status]
    );
    return rows;
  }

  static async delete(houseId, client = null) {
    const db = client || pool;
    const { rowCount } = await db.query(
      `DELETE FROM ${TABLE} WHERE house_id = $1`,
      [houseId]
    );
    return rowCount > 0;
  }

  static async count(filters = {}) {
    const built = buildFilters(filters, 1);
    const where = built.conditions.length ? `WHERE ${built.conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM ${TABLE} ${where}`,
      built.values
    );
    return rows[0]?.count || 0;
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

  static async search(q, options = {}) {
    return this.list({ ...options, filters: { ...(options.filters || {}), q } });
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
}

export default HouseForSaleModel;
