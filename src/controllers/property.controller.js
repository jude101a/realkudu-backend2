import PropertyModel from "../models/property.model.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUIRED_CREATE_FIELDS = [
  "name",
  "address",
  "state",
  "lga",
  'coverImageUrl',
  "country",
  "price",
  "description",
];

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
    console.error("[property.controller] unhandled error", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    return fail(res, 500, "Internal server error", "INTERNAL_ERROR");
  }
};

const isUuid = (value) => UUID_RE.test(String(value || ""));

const parseBooleanQuery = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return undefined;
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parsePagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 100);
  return { page, limit };
};

const sanitizeFilters = (query) => ({
  status: query.status,
  sellerId: query.sellerId,
  estateId: query.estateId,
  location: query.lga,
  minPrice: toNumber(query.minPrice),
  maxPrice: toNumber(query.maxPrice),
  propertyType: query.propertyType,
  q: query.q,
  soldOut: parseBooleanQuery(query.soldOut),
  isEstate: parseBooleanQuery(query.isEstate),
});

const stripImmutableFields = (payload = {}) => {
  if (!payload || typeof payload !== "object") return payload;
  const sanitized = { ...payload };
  delete sanitized.propertyId;
  delete sanitized.propertyID;
  return sanitized;
};

export const createProperty = wrap(async (req, res) => {
  const missing = REQUIRED_CREATE_FIELDS.filter((f) => req.body?.[f] === undefined);
  if (missing.length) {
    return fail(res, 400, "Missing required fields", "VALIDATION_ERROR", { missing });
  }
  if (!isUuid(req.body.sellerId)) {
    return fail(res, 400, "sellerId must be a valid UUID", "VALIDATION_ERROR");
  }
  if (req.body.estateId && !isUuid(req.body.estateId)) {
    return fail(res, 400, "estateId must be a valid UUID", "VALIDATION_ERROR");
  }

  const created = await PropertyModel.create(req.body);
  return ok(res, created, "Property created successfully", undefined, 201);
});

export const updateProperty = wrap(async (req, res) => {
  const { propertyId } = req.params;
  if (!isUuid(propertyId)) {
    return fail(res, 400, "propertyId must be a valid UUID", "VALIDATION_ERROR");
  }

  const updated = await PropertyModel.update(propertyId, stripImmutableFields(req.body || {}));
  if (!updated) {
    return fail(res, 404, "Property not found", "NOT_FOUND");
  }
  return ok(res, updated, "Property updated successfully");
});

export const updatePropertyFields = wrap(async (req, res) => {
  const { propertyId } = req.params;
  if (!isUuid(propertyId)) {
    return fail(res, 400, "propertyId must be a valid UUID", "VALIDATION_ERROR");
  }

  const fields = stripImmutableFields(req.body || {});
  if (!fields || Object.keys(fields).length === 0) {
    return fail(res, 400, "At least one field is required", "VALIDATION_ERROR");
  }

  const updated = await PropertyModel.update(propertyId, fields);
  if (!updated) {
    return fail(res, 404, "Property not found", "NOT_FOUND");
  }
  return ok(res, updated, "Property fields updated successfully");
});

export const deleteProperty = wrap(async (req, res) => {
  const { propertyId, sellerId } = req.params;
  if (!isUuid(propertyId)) {
    return fail(res, 400, "propertyId must be a valid UUID", "VALIDATION_ERROR");
  }
  const deleted = await PropertyModel.delete(propertyId);
  if (!deleted) {
    return fail(res, 404, "Property not found", "NOT_FOUND");
  }
  return ok(res, { id: propertyId }, "Property deleted successfully");
});

export const getPropertyById = wrap(async (req, res) => {
  const { propertyId, sellerId } = req.params;
  if (!isUuid(propertyId)) {
    return fail(res, 400, "propertyId must be a valid UUID", "VALIDATION_ERROR");
  }
  const land = await PropertyModel.findById(propertyId);
  if (!land) {
    return fail(res, 404, "None estate Land property not found", "NOT_FOUND");
  }
  return ok(res, land, "Property retrieved successfully");
});

export const getEstateProperties = wrap(async (req, res) => {
  const { sellerId, propertyType, estateId } = req.params;
  if (!isUuid(sellerId)) {
    return fail(res, 400, "sellerId must be a valid UUID", "VALIDATION_ERROR");
  }
  const lands = await PropertyModel.findEstateProperties(sellerId);
  return ok(res, lands, "Estate land properties retrieved successfully");
});

export const getAllProperties = wrap(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await PropertyModel.list({
    page,
    limit,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder,
  });
  return ok(res, result.rows, "properties retrieved successfully", {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const getAvailableProperties = wrap(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await PropertyModel.findAvailable({
    page,
    limit,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder,
    filters: { soldOut: false },
  });
  return ok(res, result.rows, "Available properties retrieved successfully", {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const search = wrap(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return fail(res, 400, "Search query must be at least 2 characters", "VALIDATION_ERROR");
  }
  const { page, limit } = parsePagination(req.query);
  const result = await PropertyModel.list({
    page,
    limit,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder,
    filters: { q },
  });
  return ok(res, result.rows, `Found ${result.total} properties matching "${q}"`, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const getBySellerAndPropertyType = wrap(async (req, res) => {
  const { sellerId, propertyType } = req.params;
  if (!isUuid(sellerId)) {
    return fail(res, 400, "sellerId must be a valid UUID", "VALIDATION_ERROR");
  }
  const lands = await PropertyModel.findBySellerAndType(sellerId, propertyType);
  return ok(res, lands, "Seller  properties retrieved successfully");
});

export const getNonEstateProperties = wrap(async (req, res) => {
  const { sellerId , propertyType} = req.params;
  if (!isUuid(sellerId)) {
    return fail(res, 400, "sellerId must be a valid UUID", "VALIDATION_ERROR");
  }
  const properties = await PropertyModel.findNonEstatePropertiesBySeller(sellerId);
  return ok(res, properties, " properties retrieved successfully");
});

export const updateCoverImageUrl = wrap(async (req, res) => {
  const { propertyId } = req.params;
  const imageUrl = req.body?.image_url || req.body?.coverImageUrl || req.body?.imageUrl;
  if (!isUuid(propertyId)) {
    return fail(res, 400, "propertyId must be a valid UUID", "VALIDATION_ERROR");
  }
  if (!imageUrl) {
    return fail(res, 400, "image_url is required", "VALIDATION_ERROR");
  }
  const updated = await PropertyModel.updateCover(propertyId, imageUrl);
  if (!updated) {
    return fail(res, 404, "Land property not found", "NOT_FOUND");
  }
  return ok(res, updated, "Land cover image updated successfully");
});

export const countProperties = wrap(async (req, res) => {
  const filters = sanitizeFilters(req.query);
  const count = await PropertyModel.count(filters);
  return ok(res, { count }, "Property count retrieved successfully");
});

export const insertMultipleProperties = wrap(async (req, res) => {
  const properties = Array.isArray(req.body?.properties) ? req.body.lands : [];
  if (!properties.length) {
    return fail(res, 400, "lands must be a non-empty array", "VALIDATION_ERROR");
  }
  const inserted = await PropertyModel.bulkInsert(lands);
  return ok(res, { inserted }, "Bulk Property insert completed successfully", undefined, 201);
});

export const clearAllProperties = wrap(async (_req, res) => {
  await PropertyModel.deleteAll();
  return ok(res, { cleared: true }, "All land properties cleared successfully");
});

export const listProperties = wrap(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const filters = sanitizeFilters(req.query);
  const result = await PropertyModel.list({
    page,
    limit,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder,
    filters,
  });
  return ok(res, result.rows, " properties retrieved successfully", {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const searchProperties = wrap(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return fail(res, 400, "Search query must be at least 2 characters", "VALIDATION_ERROR");
  }
  const { page, limit } = parsePagination(req.query);
  const result = await PropertyModel.list({
    page,
    limit,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder,
    filters: { q },
  });
  return ok(res, result.rows, `Found ${result.total} land properties matching "${q}"`, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});


export const getPropertiesStats = wrap(async (req, res) => {
  const result = await PropertyModel.list({
    page: 1,
    limit: 100000,
    sortBy: "created_at",
    sortOrder: "desc",
    filters: sanitizeFilters(req.query),
  });
  const stats = PropertyModel.calculateStats(result.rows);
  return ok(
    res,
    { ...stats, properties: result.rows },
    "Statistics calculated successfully"
  );
});
