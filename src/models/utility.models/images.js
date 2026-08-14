import pool from "../../config/db.js";

const TABLE = "images";

const SELECT_COLUMNS = `
  imageid AS "imageId",
  property_id AS "propertyId",
  image_url AS "imageUrl",
  public_id AS "publicId",
  filename,
  original_filename AS "originalFilename",
  mime_type AS "mimeType",
  resource_type AS "resourceType",
  bytes AS "size",
  format,
  width,
  height,
  duration,
  is_cover AS "isCover",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  deleted_at AS "deletedAt"
`;

class ImagesModel {
  static async insertImage(
    {
      propertyId,
      imageUrl,
      secureUrl,
      publicId = null,
      filename = null,
      originalFilename = null,
      mimeType = null,
      resourceType = "image",
      size = null,
      bytes = size,
      format = null,
      width = null,
      height = null,
      duration = null,
      isCover = false,
    },
    client = null
  ) {
    const db = client || pool;

    const { rows } = await db.query(
      `
      INSERT INTO ${TABLE} (
        property_id,
        image_url,
        public_id,
        filename,
        original_filename,
        mime_type,
        resource_type,
        bytes,
        format,
        width,
        height,
        duration,
        is_cover
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING ${SELECT_COLUMNS}
      `,
      [
        propertyId,
        secureUrl || imageUrl,
        publicId,
        filename,
        originalFilename,
        mimeType,
        resourceType,
        bytes,
        format,
        width,
        height,
        duration,
        isCover,
      ]
    );

    return rows[0] || null;
  }

  static async getPropertyImage(propertyId) {
    const db = pool;

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


  static async insertMultipleImages(propertyId, images = [], client = null) {
  const db = client || pool;

  if (!Array.isArray(images) || images.length === 0) {
    return [];
  }

  const values = [];
  const placeholders = [];

  images.forEach((img, index) => {
    const baseIndex = index * 13;

    placeholders.push(
      `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13})`
    );

    values.push(
      propertyId,
      img.secureUrl || img.imageUrl,
      img.publicId ?? null,
      img.filename ?? null,
      img.originalFilename ?? null,
      img.mimeType ?? null,
      img.resourceType ?? "image",
      img.bytes ?? img.size ?? null,
      img.format ?? null,
      img.width ?? null,
      img.height ?? null,
      img.duration ?? null,
      img.isCover ?? false
    );
  });

  const query = `
    INSERT INTO ${TABLE} (
      property_id,
      image_url,
      public_id,
      filename,
      original_filename,
      mime_type,
      resource_type,
      bytes,
      format,
      width,
      height,
      duration,
      is_cover
    )
    VALUES ${placeholders.join(", ")}
    RETURNING ${SELECT_COLUMNS}
  `;

  const { rows } = await db.query(query, values);

  return rows;
}

  static async deleteImage(imageUrl) {
    const db = pool;

    const { rows } = await db.query(
      `
      UPDATE ${TABLE}
      SET deleted_at = NOW()
      WHERE image_url = $1
        AND deleted_at IS NULL
      RETURNING ${SELECT_COLUMNS}
      `,
      [imageUrl]
    );

    return rows[0] || null;
  }

  static async deleteImageById(imageId, client = null) {
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

  static async findImageById(imageId, client = null) {
    const db = client || pool;

    const { rows } = await db.query(
      `
      SELECT ${SELECT_COLUMNS}
      FROM ${TABLE}
      WHERE imageid = $1
        AND deleted_at IS NULL
      LIMIT 1
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
