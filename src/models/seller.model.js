import pool from "../config/db.js";

export const SellerType = Object.freeze({
  INDIVIDUAL: "individual",
  COMPANY: "company",
});

export const SellerVerificationStatus = Object.freeze({
  UNVERIFIED: "unverified",
  VERIFIED: "verified",
  REJECTED: "rejected",
});

export const SellerStatus = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  DELETED: "deleted",
});

const TABLE = "sellers";

const FIELD_TO_COLUMN = Object.freeze({
  userId: "user_id",
  businessName: "business_name",
  businessAddress: "business_address",
  businessEmail: "business_email",
  businessPhone: "business_phone",
  cacNumber: "cac_number",
  tinNumber: "tin_number",
  cacDocumentUrl: "cac_document_url",
  businessSpecification: "business_specification",
  businessProfileImageUrl: "business_profile_image_url",
  isVerified: "is_verified",
  isActive: "is_active",
  deletedAt: "deleted_at",
});

const mapField = (field) => FIELD_TO_COLUMN[field] || field;

const db = (client) => client || pool;
const notDeletedClause = "deleted_at IS NULL";

class SellerModel {
  static async userExists(userId, client = null) {
    const { rowCount } = await db(client).query(
      `SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId]
    );
    return rowCount > 0;
  }

  static async markUserAsUpgraded(userId, client = null) {
    return db(client).query(
      `UPDATE users SET is_upgraded = true WHERE id = $1 RETURNING id, is_upgraded`,
      [userId]
    );
  }

  static async createIndividualSeller(data, client = null) {
    return this.#createSeller({ ...data, cacNumber: null }, client);
  }

  static async createCompanySeller(data, client = null) {
    return this.#createSeller(data, client);
  }

  static async #createSeller(data, client = null) {
    const query = `
      INSERT INTO ${TABLE} (
        user_id,
        business_name,
        business_address,
        business_email,
        business_phone,
        cac_number,
        tin_number,
        cac_document_url,
        business_specification,
        business_profile_image_url
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `;

    const values = [
      data.userId,
      data.businessName,
      data.businessAddress ?? null,
      data.businessEmail ?? null,
      data.businessPhone ?? null,
      data.cacNumber ?? null,
      data.tinNumber ?? null,
      data.cacDocumentUrl ?? null,
      data.businessSpecification ?? null,
      data.businessProfileImageUrl ?? null,
    ];

    return db(client).query(query, values);
  }

  static async findById(id, client = null) {
    return db(client).query(
      `SELECT * FROM ${TABLE} WHERE id = $1 AND ${notDeletedClause} LIMIT 1`,
      [id]
    );
  }

  static async findByUserId(userId, client = null) {
    return db(client).query(
      `SELECT * FROM ${TABLE} WHERE user_id = $1 AND ${notDeletedClause} LIMIT 1`,
      [userId]
    );
  }

  static async findAll(limit = 50, offset = 0, client = null) {
    return db(client).query(
      `SELECT * FROM ${TABLE}
       WHERE ${notDeletedClause}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
  }

  static async findWithFilters(
    { type, status, verificationStatus, limit = 50, offset = 0 },
    client = null
  ) {
    if (type) {
      return this.findByType(type, limit, offset, client);
    }
    if (status) {
      return this.findByStatus(status, limit, offset, client);
    }
    if (verificationStatus) {
      return this.findByVerificationStatus(verificationStatus, limit, offset, client);
    }
    return this.findAll(limit, offset, client);
  }

  static async findByType(type, limit = 50, offset = 0, client = null) {
    const condition =
      type === SellerType.COMPANY ? "cac_number IS NOT NULL" : "cac_number IS NULL";
    return db(client).query(
      `SELECT * FROM ${TABLE}
       WHERE ${notDeletedClause}
       AND ${condition}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
  }

  static async findByStatus(status, limit = 50, offset = 0, client = null) {
    let where = notDeletedClause;
    if (status === SellerStatus.ACTIVE) where += " AND is_active = true";
    if (status === SellerStatus.INACTIVE) where += " AND is_active = false";
    if (status === SellerStatus.DELETED) where = "deleted_at IS NOT NULL";

    return db(client).query(
      `SELECT * FROM ${TABLE}
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
  }

  static async findByVerificationStatus(status, limit = 50, offset = 0, client = null) {
    const isVerified = status === SellerVerificationStatus.VERIFIED;
    return db(client).query(
      `SELECT * FROM ${TABLE}
       WHERE ${notDeletedClause}
       AND is_verified = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [isVerified, limit, offset]
    );
  }

  static async findVerifiedSellers(limit = 50, offset = 0, client = null) {
    return db(client).query(
      `SELECT * FROM ${TABLE}
       WHERE ${notDeletedClause}
       AND is_verified = true
       AND is_active = true
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
  }

  static async searchSellers(searchTerm, limit = 50, offset = 0, client = null) {
    return db(client).query(
      `SELECT * FROM ${TABLE}
       WHERE ${notDeletedClause}
       AND (
         business_name ILIKE $1
         OR COALESCE(business_email, '') ILIKE $1
       )
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [`%${searchTerm}%`, limit, offset]
    );
  }

  static async update(id, fields, client = null) {
    const keys = Object.keys(fields).filter((key) => fields[key] !== undefined);
    if (!keys.length) return { rowCount: 0, rows: [] };

    const setClauses = [];
    const values = [];
    let index = 1;

    for (const key of keys) {
      setClauses.push(`${mapField(key)} = $${index}`);
      values.push(fields[key]);
      index++;
    }

    values.push(id);

    return db(client).query(
      `UPDATE ${TABLE}
       SET ${setClauses.join(", ")}
       WHERE id = $${index}
       AND ${notDeletedClause}
       RETURNING *`,
      values
    );
  }

  static async updateBusinessProfile(id, data, client = null) {
    const allowed = {
      businessName: data.businessName,
      businessAddress: data.businessAddress,
      businessEmail: data.businessEmail,
      businessPhone: data.businessPhone,
      businessSpecification: data.businessSpecification,
      businessProfileImageUrl: data.businessProfileImageUrl,
    };
    return this.update(id, allowed, client);
  }

  static async updateCompanyDocuments(id, data, client = null) {
    const allowed = {
      cacNumber: data.cacNumber,
      tinNumber: data.tinNumber,
      cacDocumentUrl: data.cacDocumentUrl,
    };
    return this.update(id, allowed, client);
  }

  static async setVerification(id, isVerified, client = null) {
    return this.update(id, { isVerified }, client);
  }

  static async setActive(id, isActive, client = null) {
    return this.update(id, { isActive }, client);
  }

  static async softDelete(id, client = null) {
    return db(client).query(
      `UPDATE ${TABLE}
       SET deleted_at = NOW(), is_active = false
       WHERE id = $1
       AND ${notDeletedClause}
       RETURNING *`,
      [id]
    );
  }

  static async restore(id, client = null) {
    return db(client).query(
      `UPDATE ${TABLE}
       SET deleted_at = NULL, is_active = true
       WHERE id = $1
       RETURNING *`,
      [id]
    );
  }

  static async updateIndividualKycBySellerId(id, { nin, bvn }, client = null) {
    return db(client).query(
      `
        UPDATE users u
        SET
          nin = COALESCE($2, u.nin),
          bvn = COALESCE($3, u.bvn)
        FROM sellers s
        WHERE s.id = $1
          AND s.user_id = u.id
          AND s.deleted_at IS NULL
        RETURNING u.id, u.nin, u.bvn
      `,
      [id, nin ?? null, bvn ?? null]
    );
  }

  static async registerIndividualSellerWithUserValidation(data) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const userExists = await this.userExists(data.userId, client);
      if (!userExists) {
        await client.query("ROLLBACK");
        const err = new Error("User not found");
        err.code = "USER_NOT_FOUND";
        throw err;
      }

      const existing = await this.findByUserId(data.userId, client);
      if (existing.rowCount) {
        await client.query("ROLLBACK");
        const err = new Error("Seller profile already exists for this user");
        err.code = "SELLER_EXISTS";
        throw err;
      }

      const created = await this.createIndividualSeller(data, client);
      await this.markUserAsUpgraded(data.userId, client);
      await client.query("COMMIT");
      return created;
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

  static async registerCompanySellerWithUserValidation(data) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const userExists = await this.userExists(data.userId, client);
      if (!userExists) {
        await client.query("ROLLBACK");
        const err = new Error("User not found");
        err.code = "USER_NOT_FOUND";
        throw err;
      }

      const existing = await this.findByUserId(data.userId, client);
      if (existing.rowCount) {
        await client.query("ROLLBACK");
        const err = new Error("Seller profile already exists for this user");
        err.code = "SELLER_EXISTS";
        throw err;
      }

      const created = await this.createCompanySeller(data, client);
      await this.markUserAsUpgraded(data.userId, client);
      await client.query("COMMIT");
      return created;
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

  static async findTopRatedSellers(_minRating = 4.0, _limit = 50, _offset = 0) {
    return { rowCount: 0, rows: [] };
  }

  static async getCountByStatus(client = null) {
    return db(client).query(`
      SELECT
        CASE
          WHEN deleted_at IS NOT NULL THEN 'deleted'
          WHEN is_active THEN 'active'
          ELSE 'inactive'
        END AS status,
        COUNT(*)::int AS count
      FROM ${TABLE}
      GROUP BY 1
      ORDER BY 1
    `);
  }

  static async getCountByVerificationStatus(client = null) {
    return db(client).query(`
      SELECT
        CASE WHEN is_verified THEN 'verified' ELSE 'unverified' END AS verification_status,
        COUNT(*)::int AS count
      FROM ${TABLE}
      WHERE ${notDeletedClause}
      GROUP BY 1
      ORDER BY 1
    `);
  }

  static async getCountByType(client = null) {
    return db(client).query(`
      SELECT
        CASE WHEN cac_number IS NOT NULL THEN 'company' ELSE 'individual' END AS seller_type,
        COUNT(*)::int AS count
      FROM ${TABLE}
      WHERE ${notDeletedClause}
      GROUP BY 1
      ORDER BY 1
    `);
  }

  static async getTotalStatistics(client = null) {
    return db(client).query(`
      SELECT
        COUNT(*)::int AS total_sellers,
        COUNT(*) FILTER (WHERE ${notDeletedClause} AND is_verified = true)::int AS verified_count,
        COUNT(*) FILTER (WHERE ${notDeletedClause} AND is_active = true)::int AS active_count,
        COUNT(*) FILTER (WHERE ${notDeletedClause} AND cac_number IS NOT NULL)::int AS company_count,
        COUNT(*) FILTER (WHERE ${notDeletedClause} AND cac_number IS NULL)::int AS individual_count
      FROM ${TABLE}
    `);
  }

  static async getProfileCompletionPercentage(id, client = null) {
    const { rows } = await db(client).query(
      `SELECT
         business_name,
         business_address,
         business_email,
         business_phone,
         business_specification,
         business_profile_image_url,
         cac_number,
         tin_number,
         cac_document_url
       FROM ${TABLE}
       WHERE id = $1
       AND ${notDeletedClause}
       LIMIT 1`,
      [id]
    );

    if (!rows.length) return 0;
    const seller = rows[0];

    const commonFields = [
      seller.business_name,
      seller.business_address,
      seller.business_email,
      seller.business_phone,
      seller.business_specification,
      seller.business_profile_image_url,
    ];

    const companyFields = [seller.cac_number, seller.tin_number, seller.cac_document_url];
    const requiredFields =
      seller.cac_number !== null ? [...commonFields, ...companyFields] : commonFields;

    const completed = requiredFields.filter(
      (value) => value !== null && String(value).trim() !== ""
    ).length;

    return Math.round((completed / requiredFields.length) * 100);
  }

  static async canListProperties(id, client = null) {
    const { rowCount } = await db(client).query(
      `SELECT id
       FROM ${TABLE}
       WHERE id = $1
       AND ${notDeletedClause}
       AND is_active = true
       AND is_verified = true
       LIMIT 1`,
      [id]
    );
    return rowCount > 0;
  }
}

export default SellerModel;
