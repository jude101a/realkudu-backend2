import pool from "../config/db.js";

const ok = (res, data, message = "Success", meta = undefined, status = 200) =>
  res.status(status).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });

const fail = (res, status, message, code = "BAD_REQUEST", details = undefined) =>
  res.status(status).json({
    success: false,
    error: { code, message, details },
  });

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error("[property.listing.controller] unhandled error", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    return fail(res, 500, "Internal server error", "INTERNAL_ERROR");
  }
};

const parsePagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
};

const parseFilters = (req) => ({
  location: req.query.location ? String(req.query.location).trim() : undefined,
  propertyType: req.query.propertyType || "all",
  sellerId: req.params.sellerId || req.query.sellerId,
  minPrice: req.query.minPrice !== undefined ? Number(req.query.minPrice) : undefined,
  maxPrice: req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : undefined,
});

const getSortConfig = (query) => {
  const sortBy = String(query.sortBy || "created_at").toLowerCase();
  const sortOrder = String(query.sortOrder || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  const columnByField = {
    created_at: "created_at",
    price: "price",
    name: "LOWER(name)",
  };

  return {
    sortBy,
    sortColumn: columnByField[sortBy] || "created_at",
    sortOrder,
  };
};

const isAllTypes = (propertyType) => propertyType === "all";

const buildUnifiedQueryParts = ({
  location,
  propertyType,
  sellerId,
  minPrice,
  maxPrice,
}) => {
  const values = [];
  const bind = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  const subqueries = [];
  const includeApartments = isAllTypes(propertyType) || propertyType === "apartment";
  const includeLand = isAllTypes(propertyType) || propertyType === "land";
  const includeHouses = isAllTypes(propertyType) || propertyType === "house";

  if (includeApartments) {
    const where = ["a.deleted_at IS NULL"];
    if (location) {
      const p = bind(`%${location}%`);
      where.push(`a.apartment_address ILIKE ${p}`);
    }
    if (sellerId) {
      const p = bind(sellerId);
      where.push(`a.seller_id = ${p}::uuid`);
    }
    if (minPrice !== undefined) {
      const p = bind(minPrice);
      where.push(`a.rent_amount >= ${p}`);
    }
    if (maxPrice !== undefined) {
      const p = bind(maxPrice);
      where.push(`a.rent_amount <= ${p}`);
    }

    subqueries.push(`
      SELECT
        'apartment'::text AS property_type,
        a.id AS id,
        COALESCE(NULLIF(a.house_name, ''), CONCAT('Apartment - ', COALESCE(a.apartment_address, 'Unknown'))) AS name,
        COALESCE(a.apartment_address, '') AS location,
        a.rent_amount::numeric AS price,
        a.seller_id AS seller_id,
        a.created_at,
        a.updated_at,
        jsonb_build_object(
          'houseId', a.house_id,
          'bedrooms', a.number_of_bedrooms,
          'description', a.description,
          'images', a.images,
          'furnishedStatus', a.furnished_status,
          'apartmentType', a.apartment_type
        ) AS details
      FROM apartments a
      WHERE ${where.join(" AND ")}
    `);
  }

  if (includeLand) {
    const where = [];
    if (location) {
      const p = bind(`%${location}%`);
      where.push(`(l.property_address ILIKE ${p} OR l.state_location ILIKE ${p})`);
    }
    if (sellerId) {
      const p = bind(sellerId);
      where.push(`l.seller_id = ${p}::uuid`);
    }
    if (minPrice !== undefined) {
      const p = bind(minPrice);
      where.push(`l.price >= ${p}`);
    }
    if (maxPrice !== undefined) {
      const p = bind(maxPrice);
      where.push(`l.price <= ${p}`);
    }

    subqueries.push(`
      SELECT
        'land'::text AS property_type,
        l.property_id AS id,
        l.property_name AS name,
        COALESCE(l.property_address, l.state_location, '') AS location,
        l.price::numeric AS price,
        l.seller_id AS seller_id,
        l.created_at,
        l.updated_at,
        jsonb_build_object(
          'state', l.state_location,
          'description', COALESCE(l.long_description, l.short_description),
          'images', l.gallery_images,
          'landSize', l.land_size,
          'landType', l.land_type
        ) AS details
      FROM land_properties l
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    `);
  }

  if (includeHouses) {
    const where = [];
    if (location) {
      const p = bind(`%${location}%`);
      where.push(`(h.address ILIKE ${p} OR h.state ILIKE ${p})`);
    }
    if (sellerId) {
      const p = bind(sellerId);
      where.push(`h.owner_id = ${p}::uuid`);
    }
    if (minPrice !== undefined) {
      const p = bind(minPrice);
      where.push(`h.asking_price >= ${p}`);
    }
    if (maxPrice !== undefined) {
      const p = bind(maxPrice);
      where.push(`h.asking_price <= ${p}`);
    }

    subqueries.push(`
      SELECT
        'house'::text AS property_type,
        h.house_id AS id,
        CONCAT('House - ', h.address) AS name,
        h.address AS location,
        h.asking_price::numeric AS price,
        h.owner_id AS seller_id,
        h.created_at,
        h.updated_at,
        jsonb_build_object(
          'state', h.state,
          'lga', h.lga,
          'bedrooms', h.bedrooms,
          'description', h.description,
          'images', h.images,
          'status', h.status,
          'verificationStatus', h.verification_status
        ) AS details
      FROM houses_for_sale h
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    `);
  }

  return {
    values,
    unionSql: subqueries.join("\nUNION ALL\n"),
  };
};

const normalizeTypeCounts = (rows) => {
  const summary = {
    apartments: 0,
    land: 0,
    houses: 0,
  };

  for (const row of rows) {
    if (row.property_type === "apartment") summary.apartments = Number(row.count) || 0;
    if (row.property_type === "land") summary.land = Number(row.count) || 0;
    if (row.property_type === "house") summary.houses = Number(row.count) || 0;
  }

  return summary;
};

const executeUnifiedList = async ({ filters, pagination, sort }) => {
  const built = buildUnifiedQueryParts(filters);
  if (!built.unionSql) {
    return { rows: [], total: 0, typeCounts: { apartments: 0, land: 0, houses: 0 } };
  }

  const valuesForList = [...built.values];
  valuesForList.push(pagination.limit);
  const limitRef = `$${valuesForList.length}`;
  valuesForList.push(pagination.offset);
  const offsetRef = `$${valuesForList.length}`;

  const listSql = `
    WITH unified AS (
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
    FROM unified
    ORDER BY ${sort.sortColumn} ${sort.sortOrder}, created_at DESC
    LIMIT ${limitRef}
    OFFSET ${offsetRef}
  `;

  const countByTypeSql = `
    WITH unified AS (
      ${built.unionSql}
    )
    SELECT property_type, COUNT(*)::int AS count
    FROM unified
    GROUP BY property_type
  `;

  const [listResult, typeResult] = await Promise.all([
    pool.query(listSql, valuesForList),
    pool.query(countByTypeSql, built.values),
  ]);

  return {
    rows: listResult.rows.map((row) => ({
      property_type: row.property_type,
      id: row.id,
      name: row.name,
      location: row.location,
      price: row.price !== null ? Number(row.price) : null,
      seller_id: row.seller_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      details: row.details,
    })),
    total: listResult.rows[0]?.total_count || 0,
    typeCounts: normalizeTypeCounts(typeResult.rows),
  };
};

const aggregateForApartments = async ({ location, sellerId }) => {
  const values = [];
  const where = ["a.deleted_at IS NULL"];
  const bind = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (location) {
    const p = bind(`%${location}%`);
    where.push(`a.apartment_address ILIKE ${p}`);
  }
  if (sellerId) {
    const p = bind(sellerId);
    where.push(`a.seller_id = ${p}::uuid`);
  }

  const { rows } = await pool.query(
    `
      SELECT
        COUNT(*)::int AS count,
        COALESCE(AVG(a.rent_amount), 0)::numeric AS avg_price,
        COALESCE(MIN(a.rent_amount), 0)::numeric AS min_price,
        COALESCE(MAX(a.rent_amount), 0)::numeric AS max_price,
        COALESCE(SUM(a.rent_amount), 0)::numeric AS total_price
      FROM apartments a
      WHERE ${where.join(" AND ")}
    `,
    values
  );

  return rows[0];
};

const aggregateForLand = async ({ location, sellerId }) => {
  const values = [];
  const where = [];
  const bind = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (location) {
    const p = bind(`%${location}%`);
    where.push(`(l.property_address ILIKE ${p} OR l.state_location ILIKE ${p})`);
  }
  if (sellerId) {
    const p = bind(sellerId);
    where.push(`l.seller_id = ${p}::uuid`);
  }

  const { rows } = await pool.query(
    `
      SELECT
        COUNT(*)::int AS count,
        COALESCE(AVG(l.price), 0)::numeric AS avg_price,
        COALESCE(MIN(l.price), 0)::numeric AS min_price,
        COALESCE(MAX(l.price), 0)::numeric AS max_price,
        COALESCE(SUM(l.price), 0)::numeric AS total_price
      FROM land_properties l
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    `,
    values
  );

  return rows[0];
};

const aggregateForHouses = async ({ location, sellerId }) => {
  const values = [];
  const where = [];
  const bind = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (location) {
    const p = bind(`%${location}%`);
    where.push(`(h.address ILIKE ${p} OR h.state ILIKE ${p})`);
  }
  if (sellerId) {
    const p = bind(sellerId);
    where.push(`h.owner_id = ${p}::uuid`);
  }

  const { rows } = await pool.query(
    `
      SELECT
        COUNT(*)::int AS count,
        COALESCE(AVG(h.asking_price), 0)::numeric AS avg_price,
        COALESCE(MIN(h.asking_price), 0)::numeric AS min_price,
        COALESCE(MAX(h.asking_price), 0)::numeric AS max_price,
        COALESCE(SUM(h.asking_price), 0)::numeric AS total_price
      FROM houses_for_sale h
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    `,
    values
  );

  return rows[0];
};

const toNumber = (value) => Number(value) || 0;

export const getAllPropertiesByLocation = wrap(async (req, res) => {
  const filters = parseFilters(req);
  const pagination = parsePagination(req.query);
  const sort = getSortConfig(req.query);

  const result = await executeUnifiedList({
    filters,
    pagination,
    sort,
  });

  return ok(
    res,
    result.rows,
    `Found ${result.total} properties in ${filters.location}`,
    {
      page: pagination.page,
      limit: pagination.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / pagination.limit) || 1,
      propertyTypes: result.typeCounts,
    }
  );
});

export const getSellerAllProperties = wrap(async (req, res) => {
  const filters = parseFilters(req);
  const pagination = parsePagination(req.query);
  const sort = getSortConfig(req.query);

  const result = await executeUnifiedList({
    filters,
    pagination,
    sort,
  });

  if (result.total === 0) {
    return fail(res, 404, "No properties found for this seller", "NOT_FOUND");
  }

  return ok(
    res,
    result.rows,
    `Found ${result.total} properties for seller ${filters.sellerId}`,
    {
      page: pagination.page,
      limit: pagination.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / pagination.limit) || 1,
      propertyTypes: result.typeCounts,
    }
  );
});

export const getAllPropertiesStats = wrap(async (req, res) => {
  const filters = parseFilters(req);
  const includeApartments = isAllTypes(filters.propertyType) || filters.propertyType === "apartment";
  const includeLand = isAllTypes(filters.propertyType) || filters.propertyType === "land";
  const includeHouses = isAllTypes(filters.propertyType) || filters.propertyType === "house";

  const [apartments, land, houses] = await Promise.all([
    includeApartments
      ? aggregateForApartments({ location: filters.location, sellerId: filters.sellerId })
      : Promise.resolve({ count: 0, avg_price: 0, min_price: 0, max_price: 0, total_price: 0 }),
    includeLand
      ? aggregateForLand({ location: filters.location, sellerId: filters.sellerId })
      : Promise.resolve({ count: 0, avg_price: 0, min_price: 0, max_price: 0, total_price: 0 }),
    includeHouses
      ? aggregateForHouses({ location: filters.location, sellerId: filters.sellerId })
      : Promise.resolve({ count: 0, avg_price: 0, min_price: 0, max_price: 0, total_price: 0 }),
  ]);

  const apartmentsCount = toNumber(apartments.count);
  const landCount = toNumber(land.count);
  const housesCount = toNumber(houses.count);
  const totalProperties = apartmentsCount + landCount + housesCount;

  const overallSumPrice =
    toNumber(apartments.total_price) + toNumber(land.total_price) + toNumber(houses.total_price);

  const stats = {
    apartments: {
      count: apartmentsCount,
      avgPrice: toNumber(apartments.avg_price),
      minPrice: toNumber(apartments.min_price),
      maxPrice: toNumber(apartments.max_price),
    },
    land: {
      count: landCount,
      avgPrice: toNumber(land.avg_price),
      minPrice: toNumber(land.min_price),
      maxPrice: toNumber(land.max_price),
    },
    houses: {
      count: housesCount,
      avgPrice: toNumber(houses.avg_price),
      minPrice: toNumber(houses.min_price),
      maxPrice: toNumber(houses.max_price),
    },
    combined: {
      totalProperties,
      overallAvgPrice: totalProperties > 0 ? overallSumPrice / totalProperties : 0,
      totalMarketValue: overallSumPrice,
    },
  };

  return ok(res, stats, "Statistics calculated successfully");
});
