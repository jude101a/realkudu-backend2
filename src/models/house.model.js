import pool from "../config/db.js";

class HouseModel {
  static async create(data) {
    return pool.query(
      `INSERT INTO houses (
        estate_id,
        seller_id,
        lawyer_id,
        caretaker_id,
        name,
        type,
        address,
        cover_image_url,
        is_single_house,
        state,
        lga,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
      RETURNING *`,
      [
        data.estateId,
        data.sellerId,
        data.lawyerId,
        data.caretakerId,
        data.name,
        data.type,
        data.address,
        data.coverImageUrl,
        data.isSingleHouse,
        data.state,
        data.lga
      ]
    );
  }

  static async findById(id) {
    return pool.query(
      "SELECT * FROM houses WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
  }

  static async findAll() {
    return pool.query(
      "SELECT * FROM houses WHERE deleted_at IS NULL"
    );
  }

  static async findByEstate(estateId) {
    return pool.query(
      `SELECT * FROM houses
       WHERE estate_id = $1 AND deleted_at IS NULL`,
      [estateId]
    );
  }

  static async findStandaloneBySeller(sellerId) {
    return pool.query(
      `SELECT * FROM houses
       WHERE seller_id = $1
       AND is_single_house = TRUE
       AND deleted_at IS NULL`,
      [sellerId]
    );
  }

  static async updateCoverImage(id, coverImageUrl) {
    return pool.query(
      `UPDATE houses
       SET cover_image_url = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [coverImageUrl, id]
    );
  }

  static async updateLawyer(id, lawyerId) {
    return pool.query(
      `UPDATE houses
       SET lawyer_id = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [lawyerId, id]
    );
  }

  static async updateCaretaker(id, caretakerId) {
    return pool.query(
      `UPDATE houses
       SET caretaker_id = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [caretakerId, id]
    );
  }

  static async updateFields(id, fields) {
    const keys = Object.keys(fields);
    const values = Object.values(fields);

    const setClause = keys
      .map((k, i) => `${k} = $${i + 1}`)
      .join(", ");

    return pool.query(
      `UPDATE houses
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${keys.length + 1}
       RETURNING *`,
      [...values, id]
    );
  }

  static async softDelete(id) {
    return pool.query(
      "UPDATE houses SET deleted_at = NOW() WHERE id = $1",
      [id]
    );
  }
}

export default HouseModel;
