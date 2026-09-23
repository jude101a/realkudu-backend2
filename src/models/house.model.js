import pool from "../config/db.js";

const TABLE = "houses";

/**
 * Maps API/frontend camelCase fields to database snake_case fields.
 */
const FIELD_MAP = Object.freeze({
  estateId: "estate_id",
  sellerId: "seller_id",
  lawyerId: "lawyer_id",
  caretakerId: "caretaker_id",
  coverImageUrl: "cover_image_url",
  isSingleHouse: "is_single_house",
  houseDescription: "house_description",
});

/**
 * Fields that are allowed to be inserted/updated.
 */
const ALLOWED_FIELDS = new Set([
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
  "house_description",
]);

const SORT_FIELDS = Object.freeze({
  id: "id",
  name: "name",
  created_at: "created_at",
  updated_at: "updated_at",
  state: "state",
  lga: "lga",
  type: "type",
});

/**
 * Convert frontend/API payload into database column names.
 */
const mapPayload = (payload = {}) => {
  const mapped = {};

  for (const [key, value] of Object.entries(payload)) {
    // Ignore undefined values.
    if (value === undefined) continue;

    const column = FIELD_MAP[key] || key;

    // Prevent arbitrary column injection.
    if (!ALLOWED_FIELDS.has(column)) continue;

    mapped[column] = value;
  }

  return mapped;
};

/**
 * Build WHERE filters safely.
 */
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
    conditions.push(
      `(name ILIKE $${idx} OR address ILIKE $${idx})`
    );

    values.push(`%${filters.q}%`);
    idx++;
  }

  return {
    conditions,
    values,
  };
};

class HouseModel {
  /**
   * Parse and validate sorting.
   */
  static parseSort(
    sortBy = "created_at",
    sortOrder = "desc"
  ) {
    const column =
      SORT_FIELDS[String(sortBy).toLowerCase()] ||
      SORT_FIELDS.created_at;

    const order =
      String(sortOrder).toLowerCase() === "asc"
        ? "ASC"
        : "DESC";

    return {
      column,
      order,
    };
  }

  /**
   * Create a house.
   */
  static async create(data, client = null) {
    const db = client || pool;

    if (!data || typeof data !== "object") {
      throw new Error("House data is required");
    }

    /*
     * sellerId is mandatory because houses.seller_id
     * has a NOT NULL constraint.
     */
    if (!data.sellerId) {
      console.error(
        "❌ HouseModel.create(): sellerId is missing",
        data
      );

      throw new Error(
        "sellerId is required when creating a house"
      );
    }

    const payload = mapPayload(data);

    /*
     * Explicitly verify that the mapping happened.
     */
    if (!payload.seller_id) {
      console.error(
        "❌ sellerId mapping failed:",
        {
          inputSellerId: data.sellerId,
          mappedSellerId: payload.seller_id,
          payload,
        }
      );

      throw new Error(
        "seller_id could not be mapped from sellerId"
      );
    }

    const columns = Object.keys(payload);

    if (!columns.length) {
      throw new Error(
        "No valid house fields were provided"
      );
    }

    const values = Object.values(payload);

    const placeholders = columns
      .map((_, index) => `$${index + 1}`)
      .join(", ");

    console.log("🏠 Creating house");
    console.log("🏠 sellerId:", data.sellerId);
    console.log("🏠 seller_id:", payload.seller_id);
    console.log("🏠 DB columns:", columns);

    const query = `
      INSERT INTO ${TABLE}
        (${columns.join(", ")})
      VALUES
        (${placeholders})
      RETURNING *
    `;

    const { rows } = await db.query(
      query,
      values
    );

    return rows[0];
  }

  /**
   * Find house by ID.
   */
  static async findById(id) {
    const { rows } = await pool.query(
      `
      SELECT *
      FROM ${TABLE}
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [id]
    );

    return rows[0] || null;
  }

  /**
   * Count houses.
   */
  static async count(filters = {}) {
    const built = buildFilters(filters);

    const where = built.conditions.length
      ? `WHERE ${built.conditions.join(" AND ")}`
      : "";

    const { rows } = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM ${TABLE}
      ${where}
      `,
      built.values
    );

    return rows[0]?.count || 0;
  }

  /**
   * List houses with pagination.
   */
  static async list({
    page = 1,
    limit = 20,
    sortBy = "created_at",
    sortOrder = "desc",
    filters = {},
  } = {}) {
    page = Math.max(Number(page) || 1, 1);
    limit = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const offset = (page - 1) * limit;

    const {
      column,
      order,
    } = this.parseSort(
      sortBy,
      sortOrder
    );

    const built = buildFilters(filters);

    const where = built.conditions.length
      ? `WHERE ${built.conditions.join(" AND ")}`
      : "";

    const total = await this.count(filters);

    const limitIndex = built.values.length + 1;
    const offsetIndex = built.values.length + 2;

    const { rows } = await pool.query(
      `
      SELECT *
      FROM ${TABLE}
      ${where}
      ORDER BY ${column} ${order}
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
      `,
      [
        ...built.values,
        limit,
        offset,
      ]
    );

    return {
      rows,
      total,
      page,
      limit,
      totalPages:
        Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find all houses.
   */
  static async findAll(options = {}) {
    return this.list(options);
  }

  /**
   * Find houses belonging to an estate.
   */
  static async findByEstate(
    estateId,
    options = {}
  ) {
    return this.list({
      ...options,
      filters: {
        ...(options.filters || {}),
        estateId,
      },
    });
  }

  /**
   * Find houses belonging to a seller.
   */
  static async findBySeller(
    sellerId,
    options = {}
  ) {
    return this.list({
      ...options,
      filters: {
        ...(options.filters || {}),
        sellerId,
      },
    });
  }

  /**
   * Find standalone houses belonging to a seller.
   */
  static async findStandaloneBySeller(
    sellerId,
    isSingleHouse = true,
    options = {}
  ) {
    return this.list({
      ...options,
      filters: {
        ...(options.filters || {}),
        sellerId,
        isSingleHouse,
      },
    });
  }

  /**
   * Find houses in an estate belonging to a seller.
   */
  static async getEstateHousesBySeller(
    sellerId,
    estateId,
    options = {}
  ) {
    return this.list({
      ...options,
      filters: {
        ...(options.filters || {}),
        sellerId,
        estateId,
      },
    });
  }

  /**
   * Update cover image.
   */
  static async updateCoverImage(
    id,
    coverImageUrl
  ) {
    return this.updateFields(
      id,
      { coverImageUrl }
    );
  }

  /**
   * Update house description.
   */
  static async updateHouseDescription(
    id,
    houseDescription
  ) {
    return this.updateFields(
      id,
      { houseDescription }
    );
  }

  /**
   * Update lawyer.
   */
  static async updateLawyer(
    id,
    lawyerId
  ) {
    return this.updateFields(
      id,
      { lawyerId }
    );
  }

  /**
   * Update caretaker.
   */
  static async updateCaretaker(
    id,
    caretakerId
  ) {
    return this.updateFields(
      id,
      { caretakerId }
    );
  }

  /**
   * Update allowed fields.
   */
  static async updateFields(
    id,
    fields,
    client = null
  ) {
    const db = client || pool;

    const payload = mapPayload(fields);

    const entries = Object.entries(
      payload
    );

    if (!entries.length) {
      return null;
    }

    const sets = [];
    const values = [];

    let idx = 1;

    for (const [column, value] of entries) {
      sets.push(
        `${column} = $${idx++}`
      );

      values.push(value);
    }

    values.push(id);

    const { rows } = await db.query(
      `
      UPDATE ${TABLE}
      SET ${sets.join(", ")}
      WHERE id = $${idx}
        AND deleted_at IS NULL
      RETURNING *
      `,
      values
    );

    return rows[0] || null;
  }

  /**
   * Soft delete a house.
   */
  static async softDelete(
    id,
    client = null
  ) {
    const db = client || pool;

    const { rows } = await db.query(
      `
      UPDATE ${TABLE}
      SET deleted_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id
      `,
      [id]
    );

    return rows[0] || null;
  }

  /**
   * Backwards-compatible alias.
   */
  static async softDeleteHouse(
    id,
    client = null
  ) {
    return this.softDelete(
      id,
      client
    );
  }
}

export default HouseModel;