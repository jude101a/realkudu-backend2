import pool from "../../config/db.js";

const TABLE = "images";

const SELECT_COLUMNS = `
  imageid AS "imageId",
  property_id AS "propertyId",
  image_url AS "imageUrl",
  is_cover AS "isCover",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  deleted_at AS "deletedAt"
`;

class ImagesModel {
  static async insertImage({ propertyId, imageUrl, isCover = false }, client = null) {
    const db = client || pool;

    const { rows } = await db.query(
      `
      INSERT INTO ${TABLE} (property_id, image_url, is_cover)
      VALUES ($1, $2, $3)
      RETURNING ${SELECT_COLUMNS}
      `,
      [propertyId, imageUrl, isCover]
    );

    return rows[0] || null;
  }

  static async getPropertyImage(propertyId, client = null) {
    const db = client || pool;

    const { rows } = await db.query(
      `
      SELECT ${SELECT_COLUMNS}
      FROM ${TABLE}
      WHERE property_id = $1
        AND deleted_at IS NULL
      ORDER BY is_cover DESC, created_at DESC
      `,
      [propertyId]
    );

    return rows;
  }

  static async getPropertyImagesByPropertyIds(propertyIds, client = null) {
    const db = client || pool;

    const { rows } = await db.query(
      `
      SELECT ${SELECT_COLUMNS}
      FROM ${TABLE}
      WHERE property_id = ANY($1::uuid[])
        AND deleted_at IS NULL
      ORDER BY property_id ASC, is_cover DESC, created_at DESC
      `,
      [propertyIds]
    );

    return rows;
  }

  static async deleteImage(imageId, client = null) {
    const db = client || pool;

    const { rows } = await db.query(
      `
      UPDATE ${TABLE}
      SET deleted_at = NOW()
      WHERE imageid = $1
        AND deleted_at IS NULL
      RETURNING ${SELECT_COLUMNS}
      `,
      [imageId]
    );

    return rows[0] || null;
  }

  static async deletePropertyImages(propertyId, client = null) {
    const db = client || pool;

    const { rows } = await db.query(
      `
      UPDATE ${TABLE}
      SET deleted_at = NOW()
      WHERE property_id = $1
        AND deleted_at IS NULL
      RETURNING ${SELECT_COLUMNS}
      `,
      [propertyId]
    );

    return rows;
  }

  static async bulkDeletePropertyImages(propertyIds, client = null) {
    const db = client || pool;

    const { rows } = await db.query(
      `
      UPDATE ${TABLE}
      SET deleted_at = NOW()
      WHERE property_id = ANY($1::uuid[])
        AND deleted_at IS NULL
      RETURNING ${SELECT_COLUMNS}
      `,
      [propertyIds]
    );

    return rows;
  }
}

export default ImagesModel;
