import pool from "../config/db.js";

const TABLE = "transactions";

const FIELD_MAP = Object.freeze({
  id: "id",
  reference: "reference",
  paymentType: "payment_type",
  propertyId: "property_id",
  buyerId: "buyer_id",
  sellerId: "seller_id",
  agentId: "agent_id",
  amount: "amount",
  currency: "currency",
  gateway: "gateway",
  gatewayReference: "gateway_reference",
  authorizationUrl: "authorization_url",
  accessCode: "access_code",
  status: "status",
  gatewayResponse: "gateway_response",
  createdAt: "created_at",
  updatedAt: "updated_at",
});

const STATUS = Object.freeze({
  PENDING: "PENDING",
  INITIALIZED: "INITIALIZED",
  PROCESSING: "PROCESSING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
  EXPIRED: "EXPIRED",
});

const WRITABLE_COLUMNS = new Set([
  "reference",
  "payment_type",
  "property_id",
  "buyer_id",
  "seller_id",
  "agent_id",
  "amount",
  "currency",
  "gateway",
  "gateway_reference",
  "authorization_url",
  "access_code",
  "status",
  "gateway_response",
]);

const normalizeStatus = (status) => {
  if (!status) return status;
  const normalized = String(status).toUpperCase();
  return STATUS[normalized] || normalized;
};

const toColumnPayload = (payload = {}) => {
  const mapped = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    const column = FIELD_MAP[key] || key;
    if (!WRITABLE_COLUMNS.has(column)) continue;
    mapped[column] = column === "status" ? normalizeStatus(value) : value;
  }

  return mapped;
};

const toRow = (row) => {
  if (!row) return null;

  return {
    ...row,
    paymentType: row.payment_type,
    propertyId: row.property_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    agentId: row.agent_id,
    gatewayReference: row.gateway_reference,
    authorizationUrl: row.authorization_url,
    accessCode: row.access_code,
    gatewayResponse: row.gateway_response,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSuccessful: row.status === STATUS.SUCCESS,
  };
};

const insert = async (payload) => {
  const mapped = toColumnPayload(payload);
  const columns = Object.keys(mapped);

  if (!columns.length) {
    throw new Error("Transaction payload cannot be empty");
  }

  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const values = Object.values(mapped);

  const { rows } = await pool.query(
    `
      INSERT INTO ${TABLE} (${columns.join(", ")})
      VALUES (${placeholders})
      RETURNING *
    `,
    values
  );

  return toRow(rows[0]);
};

const updateWhere = async (whereColumn, whereValue, payload) => {
  const mapped = toColumnPayload(payload);
  const entries = Object.entries(mapped);

  if (!entries.length) {
    return Transaction.findOne({ [whereColumn]: whereValue });
  }

  const sets = entries.map(([column], index) => `${column} = $${index + 1}`);
  const values = entries.map(([, value]) => value);
  values.push(whereValue);

  const { rows } = await pool.query(
    `
      UPDATE ${TABLE}
      SET ${sets.join(", ")}, updated_at = NOW()
      WHERE ${whereColumn} = $${values.length}
      RETURNING *
    `,
    values
  );

  return toRow(rows[0]);
};

class TransactionRecord {
  constructor(row) {
    Object.assign(this, toRow(row));
  }

  async save() {
    const updated = await updateWhere("id", this.id, this);
    Object.assign(this, updated);
    return this;
  }

  async markSuccess(gatewayResponse = this.gatewayResponse || {}) {
    const updated = await Transaction.markSuccess(this.reference, gatewayResponse);
    Object.assign(this, updated);
    return this;
  }

  async markFailed(reason) {
    const updated = await Transaction.markFailed(this.reference, reason);
    Object.assign(this, updated);
    return this;
  }

  async markRefunded(reason) {
    const updated = await Transaction.markRefunded(this.reference, reason);
    Object.assign(this, updated);
    return this;
  }

  toJSON() {
    return { ...this };
  }
}

class Transaction {
  static STATUS = STATUS;

  static async create(payload) {
    return new TransactionRecord(await insert(payload));
  }

  static async findById(id) {
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] ? new TransactionRecord(rows[0]) : null;
  }

  static async findOne(filters = {}) {
    const mapped = toColumnPayload(filters);
    const entries = Object.entries(mapped);

    if (!entries.length) {
      throw new Error("findOne requires at least one filter");
    }

    const where = entries
      .map(([column], index) => `${column} = $${index + 1}`)
      .join(" AND ");
    const values = entries.map(([, value]) => value);

    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE ${where} LIMIT 1`,
      values
    );

    return rows[0] ? new TransactionRecord(rows[0]) : null;
  }

  static async find(filters = {}) {
    const mapped = toColumnPayload(filters);
    const entries = Object.entries(mapped);
    const values = entries.map(([, value]) => value);
    const where = entries.length
      ? `WHERE ${entries.map(([column], index) => `${column} = $${index + 1}`).join(" AND ")}`
      : "";

    const { rows } = await pool.query(
      `
        SELECT *
        FROM ${TABLE}
        ${where}
        ORDER BY created_at DESC
      `,
      values
    );

    return rows.map((row) => new TransactionRecord(row));
  }

  static async findByReference(reference) {
    return this.findOne({ reference });
  }

  static async findSuccessful() {
    return this.find({ status: STATUS.SUCCESS });
  }

  static async findPending() {
    return this.find({ status: STATUS.PENDING });
  }

  static async markSuccess(reference, gatewayResponse = {}) {
    return updateWhere("reference", reference, {
      status: STATUS.SUCCESS,
      gatewayResponse,
    });
  }

  static async markFailed(reference, reason) {
    return updateWhere("reference", reference, {
      status: STATUS.FAILED,
      gatewayResponse: { failureReason: reason },
    });
  }

  static async markRefunded(reference, reason) {
    return updateWhere("reference", reference, {
      status: STATUS.REFUNDED,
      gatewayResponse: { refundReason: reason },
    });
  }

  static async updateByReference(reference, payload) {
    return updateWhere("reference", reference, payload);
  }
}

export default Transaction;
