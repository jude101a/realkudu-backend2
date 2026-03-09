import pool from "../config/db.js";

const TABLE = "apartments";

const FIELD_MAP = Object.freeze({
  houseID: "house_id",
  houseId: "house_id",
  sellerID: "seller_id",
  sellerId: "seller_id",
  tenantID: "tenant_id",
  tenantId: "tenant_id",
  apartmentAddress: "apartment_address",
  houseName: "house_name",
  unitNumber: "unit_number",
  numberOfKitchen: "number_of_kitchens",
  numberOfBedrooms: "number_of_bedrooms",
  numberOfKitchens: "number_of_kitchens",
  numberOfLivingRooms: "number_of_living_rooms",
  numberOfToilets: "number_of_toilets",
  roomSize: "room_size",
  hasRunningWater: "has_running_water",
  hasElectricity: "has_electricity",
  hasParkingSpace: "has_parking_space",
  hasInternet: "has_internet",
  coverImageUrl: "cover_image_url",
  apartmentCondition: "apartment_condition",
  furnishedStatus: "furnished_status",
  apartmentType: "apartment_type",
  rentAmount: "rent_amount",
  cautionFee: "caution_fee",
  lawyerFee: "lawyer_fee",
  legalFees: "legal_fees",
  paymentDuration: "payment_duration",
  apartmentStatus: "apartment_status",
  tenantEligibility: "tenant_eligibility",
  tenantUpdatedAt: "tenant_updated_at",
});

const TENANT_META_TABLE = "tenant_meta";

const TENANT_META_FIELD_MAP = Object.freeze({
  tenantMetaID: "id",
  tenantID: "tenant_id",
  propertyID: "property_id",
  propertyType: "property_type",
  rentAmount: "rent_amount",
  rentCurrency: "rent_currency",
  rentFrequency: "rent_frequency",
  tenancyStartDate: "tenancy_start_date",
  tenancyEndDate: "tenancy_end_date",
  isActiveTenant: "is_active_tenant",
  hasPaidCurrentRent: "has_paid_current_rent",
  noticeServed: "notice_served",
  lastPaymentDate: "last_payment_date",
  nextDueDate: "next_due_date",
  outstandingBalance: "outstanding_balance",
  tenancyStatus: "tenancy_status",
});

const SORT_FIELDS = Object.freeze({
  id: "id",
  rent_amount: "rent_amount",
  created_at: "created_at",
  apartment_address: "apartment_address",
  updated_at: "updated_at",
  number_of_bedrooms: "number_of_bedrooms",
});

const mapPayloadToDb = (payload = {}) => {
  const mapped = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined) continue;
    mapped[FIELD_MAP[k] || k] = v;
  }
  return mapped;
};

const mapTenantMetaPayloadToDb = (payload = {}) => {
  const mapped = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined) continue;
    mapped[TENANT_META_FIELD_MAP[k] || k] = v;
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
  if (filters.houseId) {
    conditions.push(`house_id = $${idx++}`);
    values.push(filters.houseId);
  }
  if (filters.minRent !== undefined) {
    conditions.push(`rent_amount >= $${idx++}`);
    values.push(filters.minRent);
  }
  if (filters.maxRent !== undefined) {
    conditions.push(`rent_amount <= $${idx++}`);
    values.push(filters.maxRent);
  }
  if (filters.numberOfBedrooms !== undefined) {
    conditions.push(`number_of_bedrooms = $${idx++}`);
    values.push(filters.numberOfBedrooms);
  }
  if (filters.furnishedStatus) {
    conditions.push(`furnished_status = $${idx++}`);
    values.push(filters.furnishedStatus);
  }
  if (filters.q) {
    conditions.push(
      `(apartment_address ILIKE $${idx} OR description ILIKE $${idx} OR house_name ILIKE $${idx})`
    );
    values.push(`%${filters.q}%`);
    idx++;
  }

  return { conditions, values, nextIndex: idx };
};

class ApartmentModel {
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

  static async update(id, data, client = null) {
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

  static async updateTenant(id, tenantId, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TABLE}
       SET tenant_id = $1, tenant_updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [tenantId, id]
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

  static async deleteAll() {
    const { rowCount } = await pool.query(`DELETE FROM ${TABLE}`);
    return rowCount;
  }

  static async findById(id) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByHouseId(houseId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE house_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [houseId]
    );
    return rows;
  }

  static async findAll({ page = 1, limit = 20, sortBy = "created_at", sortOrder = "desc" } = {}) {
    return this.list({ page, limit, sortBy, sortOrder, filters: {} });
  }

  static async count(filters = {}) {
    const built = buildFilters(filters, 1);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM ${TABLE} WHERE ${built.conditions.join(" AND ")}`,
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

    const total = await this.count(filters);
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE}
       WHERE ${built.conditions.join(" AND ")}
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
    const rents = rows.map((r) => Number(r.rent_amount) || 0);
    const totalRentValue = rents.reduce((a, b) => a + b, 0);

    return {
      totalApartments: total,
      totalRentValue,
      averageRent: total ? totalRentValue / total : 0,
      minRent: total ? Math.min(...rents) : 0,
      maxRent: total ? Math.max(...rents) : 0,
    };
  }

  static async createTenantMeta(data, client = null) {
    const db = client || pool;
    const payload = mapTenantMetaPayloadToDb(data);
    const columns = Object.keys(payload);
    const values = Object.values(payload);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

    const { rows } = await db.query(
      `INSERT INTO ${TENANT_META_TABLE} (${columns.join(", ")})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );
    return rows[0] || null;
  }

  static async getTenantMetaByTenant(tenantId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TENANT_META_TABLE}
       WHERE tenant_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId]
    );
    return rows[0] || null;
  }

  static async getTenantMetaByProperty(propertyId) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TENANT_META_TABLE}
       WHERE property_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [propertyId]
    );
    return rows[0] || null;
  }

  static async markRentPaid(tenantMetaId, paymentDate, nextDueDate, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TENANT_META_TABLE}
       SET has_paid_current_rent = TRUE,
           last_payment_date = $1,
           next_due_date = $2,
           outstanding_balance = 0,
           updated_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [paymentDate, nextDueDate, tenantMetaId]
    );
    return rows[0] || null;
  }

  static async updateOutstandingBalance(tenantMetaId, amount, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TENANT_META_TABLE}
       SET outstanding_balance = $1,
           has_paid_current_rent = CASE WHEN $1 <= 0 THEN TRUE ELSE FALSE END,
           updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [amount, tenantMetaId]
    );
    return rows[0] || null;
  }

  static async serveNotice(tenantMetaId, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TENANT_META_TABLE}
       SET notice_served = TRUE,
           tenancy_status = 'terminated',
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [tenantMetaId]
    );
    return rows[0] || null;
  }

  static async terminateTenancy(tenantMetaId, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TENANT_META_TABLE}
       SET is_active_tenant = FALSE,
           tenancy_status = 'expired',
           tenancy_end_date = NOW()::date,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [tenantMetaId]
    );
    return rows[0] || null;
  }

  static async deleteTenantMeta(tenantMetaId, client = null) {
    const db = client || pool;
    const { rows } = await db.query(
      `UPDATE ${TENANT_META_TABLE}
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [tenantMetaId]
    );
    return rows[0] || null;
  }
}

export default ApartmentModel;
