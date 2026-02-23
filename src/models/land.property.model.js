import pool from "../config/db.js";

const TABLE = "land_properties";

const FIELD_MAP = Object.freeze({
  propertyId: "property_id",
  estateId: "estate_id",
  sellerId: "seller_id",
  propertyName: "property_name",
  propertyAddress: "property_address",
  stateLocation: "state_location",
  coverImageUrl: "cover_image_url",
  galleryImages: "gallery_images",
  availableQuantity: "available_quantity",
  shortDescription: "short_description",
  longDescription: "long_description",
  landSize: "land_size",
  customLandSize: "custom_land_size",
  pricePer450sqm: "price_per_450sqm",
  pricePer900sqm: "price_per_900sqm",
  pricePerCustomSqm: "price_per_custom_sqm",
  pricePerPlot: "price_per_plot",
  bookingFee: "booking_fee",
  statutoryFee: "statutory_fee",
  developmentFee: "development_fee",
  surveyFee: "survey_fee",
  legalFee: "legal_fee",
  documentationFee: "documentation_fee",
  subscriptionFee: "subscription_fee",
  agencyFee: "agency_fee",
  otherFees: "other_fees",
  documentsAvailable: "documents_available",
  landType: "land_type",
  soilType: "soil_type",
  fencingStatus: "fencing_status",
  electricityAvailability: "electricity_availability",
  accessRoadType: "access_road_type",
  surveyStatus: "survey_status",
  governmentAcquisitionStatus: "government_acquisition_status",
  usageStatus: "usage_status",
  isEstateLand: "is_estate_land",
  soldOut: "sold_out",
  purchaseDate: "purchase_date",
});

const SORT_FIELDS = Object.freeze({
  id: "property_id",
  property_id: "property_id",
  price: "price",
  created_at: "created_at",
  updated_at: "updated_at",
  property_name: "property_name",
  status: "status",
  listing_date: "listing_date",
});

const mapPayloadToDb = (payload = {}) => {
  const mapped = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    mapped[FIELD_MAP[key] || key] = value;
  }
  return mapped;
};

const buildWhereFilters = (filters = {}, startIndex = 1) => {
  const conditions = [];
  const values = [];
  let idx = startIndex;

  if (filters.status) {
    conditions.push(`status = $${idx++}`);
    values.push(filters.status);
  }
  if (filters.sellerId) {
    conditions.push(`seller_id = $${idx++}`);
    values.push(filters.sellerId);
  }
  if (filters.estateId) {
    conditions.push(`estate_id = $${idx++}`);
    values.push(filters.estateId);
  }
  if (filters.landType) {
    conditions.push(`land_type = $${idx++}`);
    values.push(filters.landType);
  }
  if (filters.minPrice !== undefined) {
    conditions.push(`price >= $${idx++}`);
    values.push(filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    conditions.push(`price <= $${idx++}`);
    values.push(filters.maxPrice);
  }
  if (filters.q) {
    conditions.push(
      `(property_name ILIKE $${idx} OR property_address ILIKE $${idx} OR short_description ILIKE $${idx} OR long_description ILIKE $${idx})`
    );
    values.push(`%${filters.q}%`);
    idx++;
  }

  return { conditions, values, nextIndex: idx };
};

class LandPropertyModel {
  static mapPayloadToDb(payload) {
    return mapPayloadToDb(payload);
  }

  static parseSort(sortBy = "created_at", sortOrder = "desc") {
    const sortColumn = SORT_FIELDS[String(sortBy).toLowerCase()] || SORT_FIELDS.created_at;
    const order = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";
    return { sortColumn, order };
  }

  static async create(data, client = null) {
    const db = client || pool;
    const payload = mapPayloadToDb(data);
    const columns = Object.keys(payload);
    const values = Object.values(payload);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

    const { rows } = await db.query(
      `
        INSERT INTO ${TABLE} (${columns.join(", ")})
        VALUES (${placeholders})
        RETURNING *
      `,
      values
    );
    return rows[0];
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

  static async delete(propertyId, client = null) {
    const db = client || pool;
    const { rowCount } = await db.query(
      `DELETE FROM ${TABLE} WHERE property_id = $1`,
      [propertyId]
    );
    return rowCount > 0;
  }

  static async findById(propertyId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE property_id = $1 LIMIT 1`,
      [propertyId]
    );
    return rows[0] || null;
  }

  static async findEstateLands(sellerId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE seller_id = $1 AND is_estate_land = true ORDER BY created_at DESC`,
      [sellerId]
    );
    return rows;
  }

  static async findNonEstateBySeller(sellerId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE seller_id = $1 AND is_estate_land = false ORDER BY created_at DESC`,
      [sellerId]
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

  static async findAvailable({ limit = 50, offset = 0 } = {}) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE sold_out = false ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
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

  static async updateCover(propertyId, imageUrl, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TABLE} SET cover_image_url = $1 WHERE property_id = $2 RETURNING *`,
      [imageUrl, propertyId]
    );
    return rows[0] || null;
  }

  static async count(filters = {}) {
    const built = buildWhereFilters(filters, 1);
    const whereClause = built.conditions.length ? `WHERE ${built.conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM ${TABLE} ${whereClause}`,
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
    const { sortColumn, order } = this.parseSort(sortBy, sortOrder);
    const built = buildWhereFilters(filters, 1);
    const whereClause = built.conditions.length ? `WHERE ${built.conditions.join(" AND ")}` : "";

    const total = await this.count(filters);
    const { rows } = await pool.query(
      `
        SELECT * FROM ${TABLE}
        ${whereClause}
        ORDER BY ${sortColumn} ${order}
        LIMIT $${built.values.length + 1}
        OFFSET $${built.values.length + 2}
      `,
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

  static async bulkInsert(lands = []) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let inserted = 0;
      for (const land of lands) {
        await this.create(land, client);
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

  static async clearAll() {
    await pool.query(`TRUNCATE TABLE ${TABLE} RESTART IDENTITY CASCADE`);
    return true;
  }

  static calculateStats(rows = []) {
    const total = rows.length;
    const prices = rows.map((r) => Number(r.price) || 0);
    const sum = prices.reduce((acc, v) => acc + v, 0);
    const available = rows.filter((r) => String(r.status || "").toLowerCase() === "available").length;
    const soldOut = rows.filter((r) => Boolean(r.sold_out)).length;

    return {
      totalProperties: total,
      availableProperties: available,
      soldOutProperties: soldOut,
      totalMarketValue: sum,
      averagePrice: total ? sum / total : 0,
      minPrice: total ? Math.min(...prices) : 0,
      maxPrice: total ? Math.max(...prices) : 0,
    };
  }
}

export default LandPropertyModel;
