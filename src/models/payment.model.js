import pool from "../config/db.js";

const INSPECTION_PAYMENT_TABLE = "purchase_process_inspection_payments";
const CONTRACT_UPLOAD_TABLE = "purchase_process_contract_uploads";

const INSPECTION_PAYMENT_FIELD_MAP = Object.freeze({
  buyerId: "buyer_id",
  propertyId: "property_id",
  inspectionDate: "inspection_date",
  inspectionTime: "inspection_time",
  inspectionAdditionalNotes: "inspection_additional_notes",
  inspectionMeetingPoint: "inspection_meeting_point",
  inspectionStatus: "inspection_status",
  requestPaymentDate: "request_payment_date",
  requestPaymentAdditionalNotes: "request_payment_additional_notes",
  paymentStatus: "payment_status",
});

const CONTRACT_UPLOAD_FIELD_MAP = Object.freeze({
  buyerId: "buyer_id",
  propertyId: "property_id",
  contractSigningDate: "contract_signing_date",
  contractSigningTime: "contract_signing_time",
  contractSigningMeetingPoint: "contract_signing_meeting_point",
  contractSigningAdditionalNotes: "contract_signing_additional_notes",
  contractSigningStatus: "contract_signing_status",
  documentUploadDate: "document_upload_date",
  processCompletion: "process_completion",
});

const mapPayload = (payload = {}, fieldMap = {}) => {
  const mapped = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    mapped[fieldMap[key] || key] = value;
  }

  return mapped;
};

const upsertByPropertyAndBuyer = async (tableName, payload, fieldMap) => {
  const mapped = mapPayload(payload, fieldMap);
  const columns = Object.keys(mapped);
  const values = Object.values(mapped);

  if (!mapped.property_id || !mapped.buyer_id) {
    throw new Error("propertyId and buyerId are required for purchase process upsert");
  }

  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const updates = columns
    .filter((column) => column !== "property_id" && column !== "buyer_id")
    .map((column) => `${column} = EXCLUDED.${column}`);

  updates.push("updated_at = NOW()");

  const { rows } = await pool.query(
    `
      INSERT INTO ${tableName} (${columns.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (property_id, buyer_id)
      DO UPDATE SET ${updates.join(", ")}
      RETURNING *
    `,
    values
  );

  return rows[0];
};

const updateByPropertyAndBuyer = async (
  tableName,
  propertyId,
  buyerId,
  payload,
  fieldMap
) => {
  const mapped = mapPayload(payload, fieldMap);
  const entries = Object.entries(mapped);

  if (!entries.length) {
    const { rows } = await pool.query(
      `SELECT * FROM ${tableName} WHERE property_id = $1 AND buyer_id = $2 LIMIT 1`,
      [propertyId, buyerId]
    );
    return rows[0] || null;
  }

  const sets = [];
  const values = [];
  let index = 1;

  for (const [column, value] of entries) {
    sets.push(`${column} = $${index++}`);
    values.push(value);
  }

  values.push(propertyId, buyerId);

  const { rows } = await pool.query(
    `
      UPDATE ${tableName}
      SET ${sets.join(", ")}, updated_at = NOW()
      WHERE property_id = $${index} AND buyer_id = $${index + 1}
      RETURNING *
    `,
    values
  );

  return rows[0] || null;
};

class PurchaseProcessModel {
  static async findInspectionPaymentByPropertyId(propertyId, buyerId) {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM ${INSPECTION_PAYMENT_TABLE}
        WHERE property_id = $1 AND buyer_id = $2
        LIMIT 1
      `,
      [propertyId, buyerId]
    );
    return rows[0] || null;
  }

  static async findContractUploadByPropertyId(propertyId, buyerId) {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM ${CONTRACT_UPLOAD_TABLE}
        WHERE property_id = $1 AND buyer_id = $2
        LIMIT 1
      `,
      [propertyId, buyerId]
    );
    return rows[0] || null;
  }

  static async findByPropertyId(propertyId, buyerId) {
    const [inspectionPaymentProcess, contractUploadProcess] = await Promise.all([
      this.findInspectionPaymentByPropertyId(propertyId, buyerId),
      this.findContractUploadByPropertyId(propertyId, buyerId),
    ]);

    if (!inspectionPaymentProcess && !contractUploadProcess) {
      return null;
    }

    return {
      propertyId,
      buyerId,
      inspectionPaymentProcess,
      contractUploadProcess,
    };
  }

  static async requestInspection(propertyId, buyerId, payload) {
    return upsertByPropertyAndBuyer(
      INSPECTION_PAYMENT_TABLE,
      {
        buyerId,
        propertyId,
        ...payload,
        inspectionStatus: "requested",
      },
      INSPECTION_PAYMENT_FIELD_MAP
    );
  }

  static async confirmInspection(propertyId, buyerId, payload = {}) {
    return updateByPropertyAndBuyer(
      INSPECTION_PAYMENT_TABLE,
      propertyId,
      buyerId,
      {
        ...payload,
        inspectionStatus: "confirmed",
      },
      INSPECTION_PAYMENT_FIELD_MAP
    );
  }

  static async requestPayment(propertyId, buyerId, payload) {
    return upsertByPropertyAndBuyer(
      INSPECTION_PAYMENT_TABLE,
      {
        buyerId,
        propertyId,
        ...payload,
        paymentStatus: "requested",
      },
      INSPECTION_PAYMENT_FIELD_MAP
    );
  }

  static async requestContractSigning(propertyId, buyerId, payload) {
    return upsertByPropertyAndBuyer(
      CONTRACT_UPLOAD_TABLE,
      {
        buyerId,
        propertyId,
        ...payload,
        contractSigningStatus: "requested",
      },
      CONTRACT_UPLOAD_FIELD_MAP
    );
  }

  static async confirmContractSigning(propertyId, buyerId, payload = {}) {
    return updateByPropertyAndBuyer(
      CONTRACT_UPLOAD_TABLE,
      propertyId,
      buyerId,
      {
        ...payload,
        contractSigningStatus: "confirmed",
      },
      CONTRACT_UPLOAD_FIELD_MAP
    );
  }

  static async confirmDocumentUpload(propertyId, buyerId, payload) {
    return updateByPropertyAndBuyer(
      CONTRACT_UPLOAD_TABLE,
      propertyId,
      buyerId,
      payload,
      CONTRACT_UPLOAD_FIELD_MAP
    );
  }
}

export default PurchaseProcessModel;
