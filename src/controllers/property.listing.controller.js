import pool from "../config/db.js";

const PROPERTY_TYPE_ALIASES = Object.freeze({
  all: "all",
  apartment: "apartment",
  apartments: "apartment",
  land: "land",
  lands: "land",
  house: "house",
  houses: "house",
  "house-for-sale": "house",
  house_for_sale: "house",
  "houses-for-sale": "house",
});

const SORT_COLUMNS = Object.freeze({
  created_at: "created_at",
  updated_at: "updated_at",
  price: "price",
  name: "LOWER(name)",
});

class HttpError extends Error {
  constructor(status, message, code = "BAD_REQUEST", details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

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

const serializeError = (error) => ({
  message: error?.message,
  code: error?.code,
  detail: error?.detail,
  hint: error?.hint,
  constraint: error?.constraint,
  stack: error?.stack,
});

const formatErrorResponse = (error) => {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      message: error.message,
      code: error.code,
      details: error.details,
    };
  }

  if (typeof error?.code === "string" && error.code.length === 5) {
    const status = error.code === "22P02" ? 400 : 500;
    return {
      status,
      message: status === 400 ? "Invalid filter value" : "Property query failed",
      code: status === 400 ? "VALIDATION_ERROR" : "QUERY_ERROR",
      details: {
        databaseCode: error.code,
        databaseMessage: error.message,
        ...(error.detail ? { databaseDetail: error.detail } : {}),
        ...(error.hint ? { databaseHint: error.hint } : {}),
      },
    };
  }

  return {
    status: 500,
    message: "Internal server error",
    code: "INTERNAL_ERROR",
    details: error?.message ? { reason: error.message } : undefined,
  };
};

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    const formatted = formatErrorResponse(error);
    console.error("[property.listing.controller] request failed", serializeError(error));
    return fail(res, formatted.status, formatted.message, formatted.code, formatted.details);
  }
};

const getRequestInput = (req) => ({
  ...(req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {}),
  ...(req.query || {}),
});

const normalizeText = (value) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized === "" ? undefined : normalized;
};

const parseOptionalNumber = (value, fieldName) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, `${fieldName} must be a valid number`, "VALIDATION_ERROR", {
      field: fieldName,
      value,
    });
  }
  return parsed;
};

const parsePagination = (input) => {
  const page = Math.max(Number.parseInt(input.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(input.limit, 10) || 20, 1), 100);

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
};

const normalizePropertyType = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return "all";
  return PROPERTY_TYPE_ALIASES[normalized.toLowerCase()];
};

const parseFilters = (req, input = getRequestInput(req)) => {
  const propertyType = normalizePropertyType(input.propertyType);
  if (!propertyType) {
    throw new HttpError(
      400,
      "propertyType must be one of all, apartment, land, house",
      "VALIDATION_ERROR",
      { field: "propertyType", value: input.propertyType }
    );
  }

  const minPrice = parseOptionalNumber(input.minPrice, "minPrice");
  const maxPrice = parseOptionalNumber(input.maxPrice, "maxPrice");
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new HttpError(400, "minPrice cannot be greater than maxPrice", "VALIDATION_ERROR", {
      minPrice,
      maxPrice,
    });
  }

  return {
    q: normalizeText(input.q ?? input.search ?? input.keyword),
    name: normalizeText(input.name),
    location: normalizeText(input.location),
    state: normalizeText(input.state),
    lga: normalizeText(input.lga),
    country: normalizeText(input.country),
    propertyType,
    sellerId: normalizeText(req.params.sellerId || input.sellerId),
    minPrice,
    maxPrice,
    status: normalizeText(input.status),
    apartmentType: normalizeText(input.apartmentType),
    landType: normalizeText(input.landType),
    houseType: normalizeText(input.houseType),
    furnishedStatus: normalizeText(input.furnishedStatus),
  };
};

const getSortConfig = (input) => {
  const sortBy = String(input.sortBy || "created_at").toLowerCase();
  const sortOrder = String(input.sortOrder || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  return {
    sortBy,
    sortOrder,
    sortColumn: SORT_COLUMNS[sortBy] || SORT_COLUMNS.created_at,
  };
};

const isAllTypes = (propertyType) => propertyType === "all";

const addPredicate = (where, predicate) => {
  if (predicate) where.push(predicate);
};

const buildTextPredicate = (bind, value, columns) => {
  if (!value || !columns.length) return null;
  const ref = bind(`%${value}%`);
  return `(${columns.map((column) => `${column} ILIKE ${ref}`).join(" OR ")})`;
};

const buildSellerCountryJoin = (sellerColumn, sellerAlias, userAlias) => `
      LEFT JOIN sellers ${sellerAlias}
        ON ${sellerAlias}.id = ${sellerColumn}
       AND ${sellerAlias}.deleted_at IS NULL
      LEFT JOIN users ${userAlias}
        ON ${userAlias}.id = ${sellerAlias}.user_id
       AND ${userAlias}.deleted_at IS NULL
`;

const buildApartmentsSubquery = (bind, filters) => {
  const where = ["a.deleted_at IS NULL"];

  addPredicate(
    where,
    buildTextPredicate(bind, filters.location, [
      "a.apartment_address",
      "a.state",
      "a.lga",
      "apartment_user.country",
    ])
  );
  addPredicate(
    where,
    buildTextPredicate(bind, filters.q, [
      "a.house_name",
      "a.apartment_address",
      "a.description",
      "a.apartment_type",
      "a.state",
      "a.lga",
      "apartment_user.country",
    ])
  );
  addPredicate(where, buildTextPredicate(bind, filters.name, ["a.house_name", "a.apartment_address"]));
  addPredicate(where, buildTextPredicate(bind, filters.state, ["a.state"]));
  addPredicate(where, buildTextPredicate(bind, filters.lga, ["a.lga"]));
  addPredicate(where, buildTextPredicate(bind, filters.country, ["apartment_user.country"]));

  if (filters.sellerId) {
    const ref = bind(filters.sellerId);
    where.push(`a.seller_id = ${ref}::uuid`);
  }
  if (filters.minPrice !== undefined) {
    const ref = bind(filters.minPrice);
    where.push(`a.rent_amount >= ${ref}`);
  }
  if (filters.maxPrice !== undefined) {
    const ref = bind(filters.maxPrice);
    where.push(`a.rent_amount <= ${ref}`);
  }
  if (filters.status) {
    addPredicate(where, buildTextPredicate(bind, filters.status, ["a.apartment_status"]));
  }
  if (filters.apartmentType) {
    addPredicate(where, buildTextPredicate(bind, filters.apartmentType, ["a.apartment_type"]));
  }
  if (filters.furnishedStatus) {
    addPredicate(where, buildTextPredicate(bind, filters.furnishedStatus, ["a.furnished_status"]));
  }

  return `
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
          'apartmentType', a.apartment_type,
          'status', a.apartment_status,
          'state', a.state,
          'lga', a.lga,
          'country', apartment_user.country
        ) AS details
      FROM apartments a
      ${buildSellerCountryJoin("a.seller_id", "apartment_seller", "apartment_user")}
      WHERE ${where.join(" AND ")}
    `;
};

const buildLandSubquery = (bind, filters) => {
  const where = [];

  addPredicate(
    where,
    buildTextPredicate(bind, filters.location, [
      "l.property_address",
      "l.state_location",
      "l.country",
      "land_user.country",
    ])
  );
  addPredicate(
    where,
    buildTextPredicate(bind, filters.q, [
      "l.property_name",
      "l.property_address",
      "l.state_location",
      "l.country",
      "l.short_description",
      "l.long_description",
      "l.land_type",
      "land_user.country",
    ])
  );
  addPredicate(where, buildTextPredicate(bind, filters.name, ["l.property_name", "l.property_address"]));
  addPredicate(where, buildTextPredicate(bind, filters.state, ["l.state_location"]));
  addPredicate(where, buildTextPredicate(bind, filters.country, ["l.country", "land_user.country"]));

  if (filters.sellerId) {
    const ref = bind(filters.sellerId);
    where.push(`l.seller_id = ${ref}::uuid`);
  }
  if (filters.minPrice !== undefined) {
    const ref = bind(filters.minPrice);
    where.push(`l.price >= ${ref}`);
  }
  if (filters.maxPrice !== undefined) {
    const ref = bind(filters.maxPrice);
    where.push(`l.price <= ${ref}`);
  }
  if (filters.status) {
    addPredicate(where, buildTextPredicate(bind, filters.status, ["l.status"]));
  }
  if (filters.landType) {
    addPredicate(where, buildTextPredicate(bind, filters.landType, ["l.land_type"]));
  }

  return `
      SELECT
        'land'::text AS property_type,
        l.property_id AS id,
        COALESCE(NULLIF(l.property_name, ''), CONCAT('Land - ', COALESCE(l.property_address, l.state_location, 'Unknown'))) AS name,
        COALESCE(l.property_address, l.state_location, '') AS location,
        l.price::numeric AS price,
        l.seller_id AS seller_id,
        l.created_at,
        l.updated_at,
        jsonb_build_object(
          'state', l.state_location,
          'country', COALESCE(l.country, land_user.country),
          'description', COALESCE(l.long_description, l.short_description),
          'images', l.gallery_images,
          'landSize', l.land_size,
          'landType', l.land_type,
          'status', l.status
        ) AS details
      FROM land_properties l
      ${buildSellerCountryJoin("l.seller_id", "land_seller", "land_user")}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    `;
};

const buildHouseSubquery = (bind, filters) => {
  const where = [];

  addPredicate(
    where,
    buildTextPredicate(bind, filters.location, [
      "h.address",
      "h.landmark",
      "h.state",
      "h.lga",
      "house_user.country",
    ])
  );
  addPredicate(
    where,
    buildTextPredicate(bind, filters.q, [
      "h.address",
      "h.landmark",
      "h.description",
      "h.house_type",
      "h.state",
      "h.lga",
      "house_user.country",
    ])
  );
  addPredicate(where, buildTextPredicate(bind, filters.name, ["h.address", "h.landmark"]));
  addPredicate(where, buildTextPredicate(bind, filters.state, ["h.state"]));
  addPredicate(where, buildTextPredicate(bind, filters.lga, ["h.lga"]));
  addPredicate(where, buildTextPredicate(bind, filters.country, ["house_user.country"]));

  if (filters.sellerId) {
    const ref = bind(filters.sellerId);
    where.push(`h.owner_id = ${ref}::uuid`);
  }
  if (filters.minPrice !== undefined) {
    const ref = bind(filters.minPrice);
    where.push(`h.asking_price >= ${ref}`);
  }
  if (filters.maxPrice !== undefined) {
    const ref = bind(filters.maxPrice);
    where.push(`h.asking_price <= ${ref}`);
  }
  if (filters.status) {
    addPredicate(where, buildTextPredicate(bind, filters.status, ["h.status"]));
  }
  if (filters.houseType) {
    addPredicate(where, buildTextPredicate(bind, filters.houseType, ["h.house_type"]));
  }

  return `
      SELECT
        'house'::text AS property_type,
        h.house_id AS id,
        COALESCE(NULLIF(h.address, ''), CONCAT('House - ', COALESCE(h.state, 'Unknown'))) AS name,
        COALESCE(h.address, '') AS location,
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
          'houseType', h.house_type,
          'verificationStatus', h.verification_status,
          'country', house_user.country
        ) AS details
      FROM houses_for_sale h
      ${buildSellerCountryJoin("h.owner_id", "house_seller", "house_user")}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    `;
};

const buildUnifiedQueryParts = (filters) => {
  const values = [];
  const bind = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  const subqueries = [];
  if (isAllTypes(filters.propertyType) || filters.propertyType === "apartment") {
    subqueries.push(buildApartmentsSubquery(bind, filters));
  }
  if (isAllTypes(filters.propertyType) || filters.propertyType === "land") {
    subqueries.push(buildLandSubquery(bind, filters));
  }
  if (isAllTypes(filters.propertyType) || filters.propertyType === "house") {
    subqueries.push(buildHouseSubquery(bind, filters));
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

const normalizeStatsBuckets = (rows) => {
  const stats = {
    apartments: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, totalPrice: 0 },
    land: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, totalPrice: 0 },
    houses: { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, totalPrice: 0 },
  };

  for (const row of rows) {
    const bucket =
      row.property_type === "apartment"
        ? stats.apartments
        : row.property_type === "land"
          ? stats.land
          : row.property_type === "house"
            ? stats.houses
            : null;

    if (!bucket) continue;

    bucket.count = Number(row.count) || 0;
    bucket.avgPrice = Number(row.avg_price) || 0;
    bucket.minPrice = Number(row.min_price) || 0;
    bucket.maxPrice = Number(row.max_price) || 0;
    bucket.totalPrice = Number(row.total_price) || 0;
  }

  return stats;
};

const mapListRow = (row) => ({
  property_type: row.property_type,
  id: row.id,
  name: row.name,
  location: row.location,
  price: row.price !== null ? Number(row.price) : null,
  seller_id: row.seller_id,
  created_at: row.created_at,
  updated_at: row.updated_at,
  details: row.details,
});

const toAppliedFilters = (filters) =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined));

const buildSearchMessage = (total, filters) => {
  const descriptors = [];
  if (filters.q) descriptors.push(`search "${filters.q}"`);
  if (filters.name) descriptors.push(`name "${filters.name}"`);
  if (filters.location) descriptors.push(`location "${filters.location}"`);
  if (filters.state) descriptors.push(`state "${filters.state}"`);
  if (filters.lga) descriptors.push(`lga "${filters.lga}"`);
  if (filters.country) descriptors.push(`country "${filters.country}"`);
  if (filters.propertyType !== "all") descriptors.push(`type "${filters.propertyType}"`);

  return descriptors.length
    ? `Found ${total} properties matching ${descriptors.join(", ")}`
    : `Found ${total} properties`;
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

  const countSql = `
    WITH unified AS (
      ${built.unionSql}
    )
    SELECT property_type, COUNT(*)::int AS count
    FROM unified
    GROUP BY property_type
  `;

  const [listResult, countResult] = await Promise.all([
    pool.query(listSql, valuesForList),
    pool.query(countSql, built.values),
  ]);

  return {
    rows: listResult.rows.map(mapListRow),
    total: listResult.rows[0]?.total_count || 0,
    typeCounts: normalizeTypeCounts(countResult.rows),
  };
};

const executeUnifiedStats = async (filters) => {
  const built = buildUnifiedQueryParts(filters);
  if (!built.unionSql) {
    return normalizeStatsBuckets([]);
  }

  const statsSql = `
    WITH unified AS (
      ${built.unionSql}
    )
    SELECT
      property_type,
      COUNT(*)::int AS count,
      COALESCE(AVG(price), 0)::numeric AS avg_price,
      COALESCE(MIN(price), 0)::numeric AS min_price,
      COALESCE(MAX(price), 0)::numeric AS max_price,
      COALESCE(SUM(price), 0)::numeric AS total_price
    FROM unified
    GROUP BY property_type
  `;

  const { rows } = await pool.query(statsSql, built.values);
  return normalizeStatsBuckets(rows);
};

export const getAllPropertiesByLocation = wrap(async (req, res) => {
  const input = getRequestInput(req);
  const filters = parseFilters(req, input);
  const pagination = parsePagination(input);
  const sort = getSortConfig(input);

  const result = await executeUnifiedList({ filters, pagination, sort });

  return ok(
    res,
    result.rows,
    buildSearchMessage(result.total, filters),
    {
      page: pagination.page,
      limit: pagination.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / pagination.limit) || 1,
      propertyTypes: result.typeCounts,
      appliedFilters: toAppliedFilters(filters),
    }
  );
});

export const getSellerAllProperties = wrap(async (req, res) => {
  const input = getRequestInput(req);
  const filters = parseFilters(req, input);
  const pagination = parsePagination(input);
  const sort = getSortConfig(input);

  if (!filters.sellerId) {
    throw new HttpError(400, "sellerId is required", "VALIDATION_ERROR", { field: "sellerId" });
  }

  const result = await executeUnifiedList({ filters, pagination, sort });

  if (result.total === 0) {
    return fail(res, 404, "No properties found for this seller", "NOT_FOUND", {
      sellerId: filters.sellerId,
    });
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
      appliedFilters: toAppliedFilters(filters),
    }
  );
});

export const getAllPropertiesStats = wrap(async (req, res) => {
  const filters = parseFilters(req, getRequestInput(req));
  const stats = await executeUnifiedStats(filters);

  const totalProperties = stats.apartments.count + stats.land.count + stats.houses.count;
  const overallMarketValue = stats.apartments.totalPrice + stats.land.totalPrice + stats.houses.totalPrice;

  return ok(res, {
    apartments: {
      count: stats.apartments.count,
      avgPrice: stats.apartments.avgPrice,
      minPrice: stats.apartments.minPrice,
      maxPrice: stats.apartments.maxPrice,
    },
    land: {
      count: stats.land.count,
      avgPrice: stats.land.avgPrice,
      minPrice: stats.land.minPrice,
      maxPrice: stats.land.maxPrice,
    },
    houses: {
      count: stats.houses.count,
      avgPrice: stats.houses.avgPrice,
      minPrice: stats.houses.minPrice,
      maxPrice: stats.houses.maxPrice,
    },
    combined: {
      totalProperties,
      overallAvgPrice: totalProperties > 0 ? overallMarketValue / totalProperties : 0,
      totalMarketValue: overallMarketValue,
    },
    appliedFilters: toAppliedFilters(filters),
  }, "Statistics calculated successfully");
});
