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

const mapPayload = (payload = {}) => {
  const mapped = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined) continue;
    mapped[FIELD_MAP[k] || k] = v;
  }
  return mapped;
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
    const columns = Object.keys(payload);
    const values = Object.values(payload);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

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

  static async findAllBySeller(sellerId, { page = 1, limit = 20, sortBy = "created_at", sortOrder = "desc" } = {}) {
    const offset = (page - 1) * limit;
    const { column, order } = this.parseSort(sortBy, sortOrder);

    const [{ rows: dataRows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `SELECT * FROM ${TABLE}
         WHERE seller_id = $1 AND deleted_at IS NULL
         ORDER BY ${column} ${order}
         LIMIT $2 OFFSET $3`,
        [sellerId, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM ${TABLE}
         WHERE seller_id = $1 AND deleted_at IS NULL`,
        [sellerId]
      ),
    ]);

    const total = countRows[0]?.count || 0;
    return { rows: dataRows, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  static async findResidentialBySeller(sellerId, options = {}) {
    return this.#findBySellerAndType(sellerId, false, options);
  }

  static async findLandEstatesBySeller(sellerId, options = {}) {
    return this.#findBySellerAndType(sellerId, true, options);
  }

  static async #findBySellerAndType(sellerId, isLandEstate, { page = 1, limit = 20, sortBy = "created_at", sortOrder = "desc" } = {}) {
    const offset = (page - 1) * limit;
    const { column, order } = this.parseSort(sortBy, sortOrder);

    const [{ rows: dataRows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `SELECT * FROM ${TABLE}
         WHERE seller_id = $1 AND is_land_estate = $2 AND deleted_at IS NULL
         ORDER BY ${column} ${order}
         LIMIT $3 OFFSET $4`,
        [sellerId, isLandEstate, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM ${TABLE}
         WHERE seller_id = $1 AND is_land_estate = $2 AND deleted_at IS NULL`,
        [sellerId, isLandEstate]
      ),
    ]);

    const total = countRows[0]?.count || 0;
    return { rows: dataRows, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  static async updateCoverImage(id, coverImageUrl) {
    const { rows } = await pool.query(
      `UPDATE ${TABLE}
       SET cover_image_url = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [coverImageUrl, id]
    );
    return rows[0] || null;
  }

  static async updateDetails(id, data) {
    const payload = mapPayload(data);
    const allowed = ["name", "address", "lga", "state", "cover_image_url", "is_land_estate"];
    const entries = Object.entries(payload).filter(([k]) => allowed.includes(k));
    if (!entries.length) return null;

    const sets = [];
    const values = [];
    let idx = 1;
    for (const [column, value] of entries) {
      sets.push(`${column} = $${idx++}`);
      values.push(value);
    }
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE ${TABLE}
       SET ${sets.join(", ")}
       WHERE id = $${idx} AND deleted_at IS NULL
       RETURNING *`,
      values
    );
    return rows[0] || null;
  }

  static async softDelete(id) {
    const { rows } = await pool.query(
      `UPDATE ${TABLE}
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    return rows[0] || null;
  }
}

export default EstateModel;
