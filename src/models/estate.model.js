import pool from "../config/db.js";

const TABLE = "estates";

const FIELD_MAP = Object.freeze({
  sellerId: "seller_id",
  coverImageUrl: "cover_image_url",
  isLandEstate: "is_land_estate",
});

const SORT_FIELDS = Object.freeze({
  id: "id",
  name: "name",
  created_at: "created_at",
  updated_at: "updated_at",
  state: "state",
});

const CREATE_ALLOWED = new Set([
  "seller_id",
  "name",
  "address",
  "lga",
  "state",
  "cover_image_url",
  "is_land_estate",
  "estate_type"
]);

const UPDATE_ALLOWED = new Set([
  "name",
  "address",
  "lga",
  "state",
  "cover_image_url",
  "is_land_estate",
]);

const mapPayload = (payload = {}) => {
  const mapped = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    mapped[FIELD_MAP[key] || key] = value;
  }
  return mapped;
};

const pickAllowed = (payload, allowed) =>
  Object.entries(payload).filter(([column]) => allowed.has(column));

const buildFilters = (filters = {}, startIndex = 1) => {
  const conditions = ["deleted_at IS NULL"];
  const values = [];
  let idx = startIndex;

  if (filters.sellerId) {
    conditions.push(`seller_id = $${idx++}`);
    values.push(filters.sellerId);
  }
  if (filters.isLandEstate !== undefined) {
    conditions.push(`is_land_estate = $${idx++}`);
    values.push(filters.isLandEstate);
  }
  if (filters.state) {
    conditions.push(`state = $${idx++}`);
    values.push(filters.state);
  }
  if (filters.lga) {
    conditions.push(`lga = $${idx++}`);
    values.push(filters.lga);
  }
  if (filters.q) {
    conditions.push(`(name ILIKE $${idx} OR address ILIKE $${idx})`);
    values.push(`%${filters.q}%`);
    idx++;
  }

  return { conditions, values };
};

class EstateModel {
  static parseSort(sortBy = "created_at", sortOrder = "desc") {
    const column = SORT_FIELDS[String(sortBy).toLowerCase()] || SORT_FIELDS.created_at;
    const order = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";
    return { column, order };
  }

  static async create(data, client = null) {
    const db = client || pool;
    const payload = mapPayload(data);
    const entries = pickAllowed(payload, CREATE_ALLOWED);

    if (!entries.length) return null;

    const columns = entries.map(([column]) => column);
    const values = entries.map(([, value]) => value);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");

    const { rows } = await db.query(
      `INSERT INTO ${TABLE} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    return rows[0] || null;
  }

  static async findById(id) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  static async count(filters = {}) {
    const built = buildFilters(filters);
    const where = built.conditions.length ? `WHERE ${built.conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM ${TABLE} ${where}`,
      built.values
    );

    return rows[0]?.count || 0;
  }

  static async list({
    page = 1,
    limit = 20,
    sortBy = "created_at",
    sortOrder = "desc",
    filters = {},
  } = {}) {
    const offset = (page - 1) * limit;
    const { column, order } = this.parseSort(sortBy, sortOrder);
    const built = buildFilters(filters);
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

  static async findAllBySeller(sellerId, options = {}) {
    return this.list({
      ...options,
      filters: { ...(options.filters || {}), sellerId },
    });
  }

  static async findResidentialBySeller(sellerId, options = {}) {
    return this.list({
      ...options,
      filters: { ...(options.filters || {}), sellerId, isLandEstate: false },
    });
  }

  static async findLandEstatesBySeller(sellerId, options = {}) {
    return this.list({
      ...options,
      filters: { ...(options.filters || {}), sellerId, isLandEstate: true },
    });
  }

  static async updateCoverImage(id, coverImageUrl) {
    return this.updateDetails(id, { coverImageUrl });
  }

  static async updateDetails(id, data, client = null) {
    const db = client || pool;
    const payload = mapPayload(data);
    const entries = pickAllowed(payload, UPDATE_ALLOWED);
    if (!entries.length) return null;

    const sets = [];
    const values = [];
    let idx = 1;

    for (const [column, value] of entries) {
      sets.push(`${column} = $${idx++}`);
      values.push(value);
    }

    values.push(id);

    const { rows } = await db.query(
      `UPDATE ${TABLE}
       SET ${sets.join(", ")}
       WHERE id = $${idx} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    return rows[0] || null;
  }

  static async softDelete(estateId, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TABLE}
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [estateId]
    );
    return rows[0] || null;
  }
}

export default EstateModel;
