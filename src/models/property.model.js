import pool from "../config/db.js";
import { FIELD_MAP } from "./gen.property.model/gen.property.model.js";

const TABLE = "property";

const SORT_FIELDS = Object.freeze({
  id: "property_id",
  property_id: "property_id",
  price: "price",
  asking_price: "asking_price",
  created_at: "created_at",
  updated_at: "updated_at",
  address: "address",
  status: "status",
  property_type: "property_type",
  name: "name",
});

const PAYLOAD_ALIASES = Object.freeze({
  propertyID: "propertyId",
  houseID: "houseId",
  sellerID: "sellerId",
  estateID: "estateId",
  lawyerID: "lawyerId",
  buyerID: "buyerId",
  finalPrice: "finalSalePrice",
});

const BOOLEAN_COLUMNS = new Set([
  "has_running_water",
  "has_electricity",
  "has_parking_space",
  "has_internet",
  "sold_out",
  "verification_status",
  "is_estate",
]);

const INTEGER_COLUMNS = new Set([
  "bedrooms",
  "kitchens",
  "living_rooms",
  "toilets",
  "floors",
]);

const NUMERIC_COLUMNS = new Set([
  "quantity",
  "size",
  "price",
  "asking_price",
  "final_sale_price",
  "booking_fee",
  "statutory_fee",
  "development_fee",
  "survey_fee",
  "legal_fee",
  "documentation_fee",
  "agency_fee",
  "other_fees",
  "caution_fee",
  "subscription_fee",
]);

const IMMUTABLE_UPDATE_COLUMNS = new Set([
  "property_id",
  "created_at",
  "updated_at",
  "deleted_at",
]);

const normalizePropertyType = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();

  switch (normalized) {
    case "houseforsale":
    case "house_for_sale":
    case "house-for-sale":
    case "house":
      return "house";
    case "land":
    case "apartment":
    case "estate":
    case "commercial":
    case "shop":
    case "office":
    case "warehouse":
    case "hotel":
    case "shortlet":
    case "unknown":
      return normalized;
    default:
      return normalized;
  }
};

const normalizeColumnValue = (column, value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (BOOLEAN_COLUMNS.has(column)) {
    if (typeof value === "boolean") {
      return value;
    }

    const normalized = String(value).trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  if (INTEGER_COLUMNS.has(column) || NUMERIC_COLUMNS.has(column)) {
    if (value === "") {
      return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : value;
  }

  if (column === "property_type") {
    return normalizePropertyType(value);
  }

  if (column === "documents_available" && typeof value === "object") {
    return JSON.stringify(value);
  }

  return value;
};

const resolvePayloadKey = (key) => PAYLOAD_ALIASES[key] || key;

export const mapPayloadToDb = (payload = {}) => {
  const mapped = {};

  for (const [rawKey, rawValue] of Object.entries(payload || {})) {
    const key = resolvePayloadKey(rawKey);
    const column = FIELD_MAP[key];

    if (!column) {
      continue;
    }

    const value = normalizeColumnValue(column, rawValue);
    if (value === undefined) {
      continue;
    }

    mapped[column] = value;
  }

  return mapped;
};

const buildFilters = (filters = {}, startIndex = 1) => {
  const conditions = ["deleted_at IS NULL"];
  const values = [];
  let idx = startIndex;

  const push = (sql, value) => {
    conditions.push(sql.replaceAll("?", `$${idx}`));
    values.push(value);
    idx += 1;
  };

  if (filters.propertyId) {
    push("property_id = ?", filters.propertyId);
  }

  if (filters.sellerId) {
    push("seller_id = ?", filters.sellerId);
  }

  if (filters.estateId) {
    push("estate_id = ?", filters.estateId);
  }

  if (filters.houseId) {
    push("house_id = ?", filters.houseId);
  }

  if (filters.status) {
    push("status = ?", filters.status);
  }

  if (filters.state) {
    push("state = ?", filters.state);
  }

  if (filters.lga) {
    push("lga = ?", filters.lga);
  }

  if (filters.bedrooms !== undefined) {
    push("bedrooms = ?", filters.bedrooms);
  }

  if (filters.propertyType !== undefined) {
    const propertyType = normalizePropertyType(filters.propertyType);
    if (propertyType && propertyType !== "all") {
      push("property_type = ?", propertyType);
    }
  }

  if (filters.verificationStatus !== undefined) {
    push("verification_status = ?", filters.verificationStatus);
  }

  if (filters.soldOut !== undefined) {
    push("COALESCE(sold_out, FALSE) = ?", filters.soldOut);
  }

  if (filters.isEstate !== undefined) {
    push("COALESCE(is_estate, FALSE) = ?", filters.isEstate);
  }

  if (filters.minPrice !== undefined) {
    push("COALESCE(asking_price, price, 0) >= ?", filters.minPrice);
  }

  if (filters.maxPrice !== undefined) {
    push("COALESCE(asking_price, price, 0) <= ?", filters.maxPrice);
  }

  if (filters.q) {
    const term = `%${String(filters.q).trim()}%`;
    push(
      [
        "(",
        "name ILIKE ?",
        "OR address ILIKE ?",
        "OR property_type ILIKE ?",
        "OR description ILIKE ?",
        "OR lga ILIKE ?",
        "OR state ILIKE ?",
        ")",
      ].join(" "),
      term
    );
  }

  return { conditions, values };
};

class PropertyModel {
  static parseSort(sortBy = "created_at", sortOrder = "desc") {
    const column =
      SORT_FIELDS[String(sortBy || "created_at").toLowerCase()] ||
      SORT_FIELDS.created_at;
    const order = String(sortOrder || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    return { column, order };
  }

  static async create(data, client = null) {
    const db = client || pool;
    const payload = mapPayloadToDb(data);

    if (payload.asking_price === undefined && payload.price !== undefined) {
      payload.asking_price = payload.price;
    }

    const columns = Object.keys(payload);
    if (!columns.length) {
      throw new Error("No valid property fields were provided");
    }

    const values = Object.values(payload);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");

    const { rows } = await db.query(
      `INSERT INTO ${TABLE} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    return rows[0] || null;
  }

  static async findById(propertyId, sellerId = null) {
    const values = [propertyId];
    let sql = `SELECT * FROM ${TABLE} WHERE property_id = $1 AND deleted_at IS NULL`;

    if (sellerId) {
      sql += ` AND seller_id = $2`;
      values.push(sellerId);
    }

    sql += ` LIMIT 1`;

    const { rows } = await pool.query(sql, values);
    return rows[0] || null;
  }

  static async findByStatus(status, sellerId, propertyType) {
    const filters = {
      status,
      sellerId,
      propertyType,
    };

    const built = buildFilters(filters);
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE ${built.conditions.join(" AND ")} ORDER BY created_at DESC`,
      built.values
    );

    return rows;
  }

  static async delete(propertyId, sellerId = null, client = null) {
    const db = client || pool;
    const values = [propertyId];
    let where = `property_id = $1 AND deleted_at IS NULL`;

    if (sellerId) {
      values.push(sellerId);
      where += ` AND seller_id = $2`;
    }

    const { rows } = await db.query(
      `
        UPDATE ${TABLE}
        SET deleted_at = NOW()
        WHERE ${where}
        RETURNING property_id
      `,
      values
    );

    return rows[0] || null;
  }

  static async deleteProperty(sellerId, propertyId, client = null) {
    return this.delete(propertyId, sellerId, client);
  }

  static async list({
  page = 1,
  limit = 10,
  sortBy = "created_at",
  sortOrder = "desc",
  filters = {},
} = {}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.max(Number(limit) || 10, 1);
  const offset = (safePage - 1) * safeLimit;

  const { column, order } = this.parseSort(sortBy, sortOrder);
  const built = buildFilters(filters);

  const whereClause =
    built.conditions.length > 0
      ? `WHERE ${built.conditions.join(" AND ")}`
      : "";

  const total = await this.count(filters);

  const query = `
    SELECT *
    FROM ${TABLE}
    ${whereClause}
    ORDER BY ${column} ${order}
    LIMIT $${built.values.length + 1}
    OFFSET $${built.values.length + 2}
  `;

  const { rows } = await pool.query(query, [
    ...built.values,
    safeLimit,
    offset,
  ]);

  return {
    rows,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit) || 1,
  };
}
  static async findEstateProperties(sellerId, propertyType, estateId) {
    const built = buildFilters({
      sellerId,
      propertyType,
      estateId,
      isEstate: true,
    });

    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE ${built.conditions.join(" AND ")} ORDER BY created_at DESC`,
      built.values
    );

    return rows;
  }

  static async findNonEstatePropertiesBySeller(sellerId, propertyType) {
    const built = buildFilters({
      sellerId,
      propertyType,
      isEstate: false,
    });

    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE ${built.conditions.join(" AND ")} ORDER BY created_at DESC`,
      built.values
    );

    return rows;
  }

  static async findBySeller(sellerId) {
    const built = buildFilters({ sellerId, soldOut: false });
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE ${built.conditions.join(" AND ")} ORDER BY created_at DESC`,
      built.values
    );

    return rows;
  }

  static async findSellerProperties(sellerId) {
    return this.findBySeller(sellerId);
  }

  static async findAvailable({
    page = 1,
    limit = 10,
    sortBy = "created_at",
    sortOrder = "desc",
    filters = {},
  } = {}) {
    return this.list({
      page,
      limit,
      sortBy,
      sortOrder,
      filters: {
        ...filters,
        soldOut: false,
      },
    });
  }

  static async search(q, { page = 1, limit = 10, sortBy = "created_at", sortOrder = "desc" } = {}) {
    return this.list({
      page,
      limit,
      sortBy,
      sortOrder,
      filters: { q },
    });
  }

  static async updateCover(propertyId, imageUrl, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `
        UPDATE ${TABLE}
        SET cover_image_url = $1
        WHERE property_id = $2
          AND deleted_at IS NULL
        RETURNING *
      `,
      [imageUrl, propertyId]
    );

    return rows[0] || null;
  }

  static async update(propertyId, data, client = null) {
    const db = client || pool;
    const payload = mapPayloadToDb(data);

    for (const column of IMMUTABLE_UPDATE_COLUMNS) {
      delete payload[column];
    }

    const entries = Object.entries(payload);
    if (!entries.length) {
      return null;
    }

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
          AND deleted_at IS NULL
        RETURNING *
      `,
      values
    );

    return rows[0] || null;
  }

  static async count(filters = {}) {
    const built = buildFilters(filters);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM ${TABLE} WHERE ${built.conditions.join(" AND ")}`,
      built.values
    );

    return Number(rows[0]?.count || 0);
  }

  static calculateStats(rows = []) {
    const total = rows.length;
    const prices = rows.map((row) => Number(row.asking_price ?? row.price) || 0);
    const totalMarketValue = prices.reduce((sum, value) => sum + value, 0);
    const sold = rows.filter((row) => String(row.status || "").toLowerCase() === "sold").length;
    const active = rows.filter((row) => String(row.status || "").toLowerCase() === "active").length;

    return {
      totalProperties: total,
      soldProperties: sold,
      activeProperties: active,
      totalHouses: total,
      soldHouses: sold,
      activeHouses: active,
      totalMarketValue,
      averageAskingPrice: total ? totalMarketValue / total : 0,
      minAskingPrice: total ? Math.min(...prices) : 0,
      maxAskingPrice: total ? Math.max(...prices) : 0,
    };
  }

  static async softDelete(propertyId, client = null) {
    return this.delete(propertyId, null, client);
  }

  static async deleteAll() {
    const { rowCount } = await pool.query(`DELETE FROM ${TABLE}`);
    return rowCount;
  }

  static async bulkInsert(properties = []) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      let inserted = 0;
      for (const property of properties) {
        await this.create(property, client);
        inserted += 1;
      }

      await client.query("COMMIT");
      return inserted;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // no-op
      }
      throw error;
    } finally {
      client.release();
    }
  }

  static async findBySellerAndType(sellerId, propertyType) {
    const built = buildFilters({ sellerId, propertyType });
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE ${built.conditions.join(" AND ")} ORDER BY created_at DESC`,
      built.values
    );

    return rows;
  }

  static async findSellerEstateLand(sellerId) {
    const built = buildFilters({
      sellerId,
      propertyType: "land",
      isEstate: true,
    });

    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE ${built.conditions.join(" AND ")} ORDER BY created_at DESC`,
      built.values
    );

    return rows;
  }

  static async findBySellerHouseProperties(sellerId, houseId) {
    const built = buildFilters({ sellerId, houseId });
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE ${built.conditions.join(" AND ")} ORDER BY created_at DESC`,
      built.values
    );

    return rows;
  }

  static async findPropertiesBySeller(sellerId, propertyType = undefined) {
    return this.findBySellerAndType(sellerId, propertyType);
  }

  static async findEstateLands(sellerId) {
    return this.findSellerEstateLand(sellerId);
  }
}

export default PropertyModel;
