import pool from "../config/db.js";

const PROPERTY_TYPES = Object.freeze({
  ALL: "all",
  ESTATE: "estate",
  HOUSE: "house",
  HOUSE_FOR_SALE: "house_for_sale",
  LAND: "land",
});

const SORT_FIELDS = Object.freeze({
  created_at: "created_at",
  price: "price",
  name: "name",
  property_type: "property_type",
});

const buildPropertyUnion = ({ sellerId, propertyType }) => {
  const includeEstate = propertyType === PROPERTY_TYPES.ALL || propertyType === PROPERTY_TYPES.ESTATE;
  const includeHouse = propertyType === PROPERTY_TYPES.ALL || propertyType === PROPERTY_TYPES.HOUSE;
  const includeHouseForSale = propertyType === PROPERTY_TYPES.ALL || propertyType === PROPERTY_TYPES.HOUSE_FOR_SALE;
  const includeLand = propertyType === PROPERTY_TYPES.ALL || propertyType === PROPERTY_TYPES.LAND;

  const values = [sellerId];
  const subqueries = [];

  if (includeEstate) {
    subqueries.push(`
      SELECT
        'estate'::text AS property_type,
        e.id AS id,
        COALESCE(e.name, '') AS name,
        COALESCE(e.address, '') AS location,
        NULL::numeric AS price,
        e.seller_id AS seller_id,
        e.created_at,
        e.updated_at,
        jsonb_build_object(
          'estateType', e.estate_type,
          'isLandEstate', e.is_land_estate,
          'lga', e.lga,
          'state', e.state,
          'coverImageUrl', e.cover_image_url
        ) AS details
      FROM estates e
      WHERE e.seller_id = $1 AND e.deleted_at IS NULL
    `);
  }

  if (includeHouse) {
    subqueries.push(`
      SELECT
        'house'::text AS property_type,
        h.id AS id,
        COALESCE(h.name, CONCAT('House - ', COALESCE(h.address, 'Unknown'))) AS name,
        COALESCE(h.address, '') AS location,
        NULL::numeric AS price,
        h.seller_id AS seller_id,
        h.created_at,
        h.updated_at,
        jsonb_build_object(
          'estateId', h.estate_id,
          'isSingleHouse', h.is_single_house,
          'type', h.type,
          'state', h.state,
          'lga', h.lga,
          'description', h.house_description,
          'images', h.images
        ) AS details
      FROM houses h
      WHERE h.seller_id = $1 AND h.deleted_at IS NULL
    `);
  }

  if (includeHouseForSale) {
    subqueries.push(`
      SELECT
        'house_for_sale'::text AS property_type,
        h.house_id AS id,
        COALESCE(h.address, '') AS name,
        COALESCE(h.address, '') AS location,
        h.asking_price::numeric AS price,
        h.owner_id AS seller_id,
        h.created_at,
        h.updated_at,
        jsonb_build_object(
          'houseType', h.house_type,
          'status', h.status,
          'bedrooms', h.bedrooms,
          'state', h.state,
          'lga', h.lga,
          'description', h.description,
          'images', h.images,
          'verificationStatus', h.verification_status
        ) AS details
      FROM houses_for_sale h
      WHERE h.owner_id = $1
    `);
  }

  if (includeLand) {
    subqueries.push(`
      SELECT
        'land'::text AS property_type,
        l.property_id AS id,
        COALESCE(l.property_name, CONCAT('Land - ', COALESCE(l.property_address, l.state_location, 'Unknown'))) AS name,
        COALESCE(l.property_address, l.state_location, '') AS location,
        l.price::numeric AS price,
        l.seller_id AS seller_id,
        l.created_at,
        l.updated_at,
        jsonb_build_object(
          'estateId', l.estate_id,
          'isEstateLand', l.is_estate_land,
          'landType', l.land_type,
          'state', l.state_location,
          'description', COALESCE(l.long_description, l.short_description),
          'images', l.gallery_images
        ) AS details
      FROM land_properties l
      WHERE l.seller_id = $1
    `);
  }

  return {
    unionSql: subqueries.join("\nUNION ALL\n"),
    values,
  };
};

const normalizeTypeCounts = (rows) => ({
  estate: 0,
  house: 0,
  house_for_sale: 0,
  land: 0,
  ...rows.reduce((acc, row) => {
    acc[row.property_type] = Number(row.count || 0);
    return acc;
  }, {}),
});

const normalizeRow = (row) => ({
  id: row.id,
  propertyType: row.property_type,
  name: row.name,
  location: row.location,
  price: row.price !== null ? Number(row.price) : null,
  sellerId: row.seller_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  details: row.details,
});

class SellerPropertyListingModel {
  static parseSort(sortBy = "created_at", sortOrder = "desc") {
    const column = SORT_FIELDS[String(sortBy).toLowerCase()] || SORT_FIELDS.created_at;
    const order = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";
    return { column, order };
  }

  static async findAllBySeller(sellerId, options = {}) {
    if (!sellerId || typeof sellerId !== "string") {
      throw new Error("Seller ID must be a valid non-empty string");
    }

    const propertyType = String(options.propertyType || PROPERTY_TYPES.ALL).toLowerCase().trim();
    const page = Math.max(Number(options.page) || 1, 1);
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const sortBy = String(options.sortBy || "created_at").toLowerCase();
    const sortOrder = String(options.sortOrder || "desc").toLowerCase();
    const offset = (page - 1) * limit;

    const built = buildPropertyUnion({ sellerId, propertyType });
    if (!built.unionSql) {
      return {
        rows: [],
        total: 0,
        typeCounts: normalizeTypeCounts([]),
        page,
        limit,
        totalPages: 0,
      };
    }

    const listSql = `
      WITH seller_properties AS (
        ${built.unionSql}
      )
      SELECT
        property_type,
        id,
        name,
        location,
        price,
        seller_id,
        created_at,
        updated_at,
        details,
        COUNT(*) OVER()::int AS total_count
      FROM seller_properties
      ORDER BY ${this.parseSort(sortBy, sortOrder).column} ${this.parseSort(sortBy, sortOrder).order}
      LIMIT $${built.values.length + 1}
      OFFSET $${built.values.length + 2}
    `;

    const countSql = `
      WITH seller_properties AS (
        ${built.unionSql}
      )
      SELECT property_type, COUNT(*)::int AS count
      FROM seller_properties
      GROUP BY property_type
    `;

    const valuesForList = [...built.values, limit, offset];

    const [listResult, countResult] = await Promise.all([
      pool.query(listSql, valuesForList),
      pool.query(countSql, built.values),
    ]);

    const total = Number(listResult.rows[0]?.total_count || 0);

    return {
      rows: listResult.rows.map(normalizeRow),
      total,
      page,
      limit,
      totalPages: total ? Math.ceil(total / limit) : 0,
      typeCounts: normalizeTypeCounts(countResult.rows),
    };
  }
}

export default SellerPropertyListingModel;
