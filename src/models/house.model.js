import pool from "../config/db.js";

const TABLE = "houses";

const FIELD_MAP = Object.freeze({
  estateId: "estate_id",
  sellerId: "seller_id",
  lawyerId: "lawyer_id",
  caretakerId: "caretaker_id",
  coverImageUrl: "cover_image_url",
  isSingleHouse: "is_single_house",
});

const SORT_FIELDS = Object.freeze({
  id: "id",
  name: "name",
  created_at: "created_at",
  updated_at: "updated_at",
  state: "state",
  lga: "lga",
  type: "type",
});

const mapPayload = (payload = {}) => {
  const mapped = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    mapped[FIELD_MAP[key] || key] = value;
  }
  return mapped;
};

const buildFilters = (filters = {}, startIndex = 1) => {
  const conditions = ["deleted_at IS NULL"];
  const values = [];
  let idx = startIndex;

  if (filters.sellerId) {
    conditions.push(`seller_id = $${idx++}`);
    values.push(filters.sellerId);
  }
  if (filters.estateId) {
    conditions.push(`estate_id = $${idx++}`);
    values.push(filters.estateId);
  }
  if (filters.isSingleHouse !== undefined) {
    conditions.push(`is_single_house = $${idx++}`);
    values.push(filters.isSingleHouse);
  }
  if (filters.state) {
    conditions.push(`state = $${idx++}`);
    values.push(filters.state);
  }
  if (filters.lga) {
    conditions.push(`lga = $${idx++}`);
    values.push(filters.lga);
  }
  if (filters.type) {
    conditions.push(`type = $${idx++}`);
    values.push(filters.type);
  }
  if (filters.q) {
    conditions.push(`(name ILIKE $${idx} OR address ILIKE $${idx})`);
    values.push(`%${filters.q}%`);
    idx++;
  }

  return { conditions, values };
};

class HouseModel {
  static parseSort(sortBy = "created_at", sortOrder = "desc") {
    const column = SORT_FIELDS[String(sortBy).toLowerCase()] || SORT_FIELDS.created_at;
    const order = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";
    return { column, order };
  }

  static async create(data, client = null) {
    const db = client || pool;
    const payload = mapPayload(data);
    const columns = Object.keys(payload);
    const values = Object.values(payload);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");

    const { rows } = await db.query(
      `INSERT INTO ${TABLE} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    return rows[0];
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

  static async findAll(options = {}) {
    return this.list(options);
  }

  static async findByEstate(estateId, options = {}) {
    return this.list({
      ...options,
      filters: { ...(options.filters || {}), estateId },
    });
  }

  static async findBySeller(sellerId, options = {}) {
    return this.list({
      ...options,
      filters: { ...(options.filters || {}), sellerId },
    });
  }

  static async findStandaloneBySeller(sellerId, isSingleHouse = true, options = {}) {
    return this.list({
      ...options,
      filters: { ...(options.filters || {}), sellerId, isSingleHouse },
    });
  }

  static async getEstateHousesBySeller(sellerId, estateId, options = {}) {
    return this.list({
      ...options,
      filters: { ...(options.filters || {}), sellerId, estateId },
    });
  }

  static async updateCoverImage(id, coverImageUrl) {
    return this.updateFields(id, { coverImageUrl });
  }

static async updateHouseDescription(id, houseDescription) {
    return this.updateFields(id, { houseDescription });
  }
  static async softDeleteHouse(id) {
    const db =  pool;
    const { rows } = await db.query(
      `UPDATE ${TABLE}
       SET id = $1, deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id]
    );
    return rows[0] || null;
  }

  static async updateLawyer(id, lawyerId) {
    return this.updateFields(id, { lawyerId });
  }

  static async updateCaretaker(id, caretakerId) {
    return this.updateFields(id, { caretakerId });
  }

  static async updateFields(id, fields, client = null) {
    const db = client || pool;
    const payload = mapPayload(fields);
    const allowed = [
      "estate_id",
      "seller_id",
      "lawyer_id",
      "caretaker_id",
      "name",
      "type",
      "address",
      "cover_image_url",
      "is_single_house",
      "state",
      "lga",
      "house_description"
    ];

    const entries = Object.entries(payload).filter(([column]) => allowed.includes(column));

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

}

export default HouseModel;
