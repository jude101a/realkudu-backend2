import PropertyModel from "../models/property.model.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUIRED_CREATE_FIELDS = [
  "sellerId",
  "name",
  "address",
  "lga",
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

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return undefined;
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parsePagination = (source = {}) => {
  const page = Math.max(Number.parseInt(source.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(source.limit, 10) || 10, 1), 100);
  return { page, limit };
};

const getRequestInput = (req) => ({
  ...(req.body || {}),
  ...(req.query || {}),
});

const sanitizeFilters = (source = {}) => ({
  propertyId: source.propertyId || source.propertyID,
  sellerId: source.sellerId || source.sellerID,
  estateId: source.estateId || source.estateID,
  houseId: source.houseId || source.houseID,
  status: source.status,
  state: source.state,
  lga: source.lga,
  bedrooms: toNumber(source.bedrooms),
  minPrice: toNumber(source.minPrice),
  maxPrice: toNumber(source.maxPrice),
  propertyType: source.propertyType,
  q: source.q,
  soldOut: parseBooleanQuery(source.soldOut),
  isEstate: parseBooleanQuery(source.isEstate),
  verificationStatus: parseBooleanQuery(source.verificationStatus),
});

const stripImmutableFields = (payload = {}) => {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const sanitized = { ...payload };
  delete sanitized.propertyId;
  delete sanitized.propertyID;
  delete sanitized.createdAt;
  delete sanitized.updatedAt;
  delete sanitized.deletedAt;
  delete sanitized.created_at;
  delete sanitized.updated_at;
  delete sanitized.deleted_at;
  return sanitized;
};

const validateUuidField = (res, value, fieldName, required = true) => {
  if (!value) {
    if (required) {
      fail(res, 400, `${fieldName} must be a valid UUID`, "VALIDATION_ERROR");
      return false;
    }
    return true;
  }

  if (!isUuid(value)) {
    fail(res, 400, `${fieldName} must be a valid UUID`, "VALIDATION_ERROR");
    return false;
  }

  return true;
};

const respondWithList = (res, result, message) =>
  ok(res, result.rows, message, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });

export const createProperty = wrap(async (req, res) => {
  const payload = stripImmutableFields(req.body || {});
  const missing = REQUIRED_CREATE_FIELDS.filter((field) => payload[field] === undefined);

  if (missing.length) {
    return fail(res, 400, "Missing required fields", "VALIDATION_ERROR", { missing });
  }

  if (!validateUuidField(res, payload.sellerId, "sellerId")) return;
  if (!validateUuidField(res, payload.estateId, "estateId", false)) return;
  if (!validateUuidField(res, payload.houseId, "houseId", false)) return;
  if (!validateUuidField(res, payload.lawyerId, "lawyerId", false)) return;
  if (!validateUuidField(res, payload.buyerId, "buyerId", false)) return;

  const created = await PropertyModel.create(payload);
  return ok(res, created, "Property created successfully", undefined, 201);
});

export const updateProperty = wrap(async (req, res) => {
  const { propertyId } = req.params;
  if (!validateUuidField(res, propertyId, "propertyId")) return;

  const payload = stripImmutableFields(req.body || {});
  if (!Object.keys(payload).length) {
    return fail(res, 400, "At least one updatable field is required", "VALIDATION_ERROR");
  }

  const updated = await PropertyModel.update(propertyId, payload);
  if (!updated) {
    return fail(res, 404, "Property not found", "NOT_FOUND");
  }

  return ok(res, updated, "Property updated successfully");
});

export const updatePropertyFields = updateProperty;

export const deleteProperty = wrap(async (req, res) => {
  const { propertyId, sellerId } = req.params;
  if (!validateUuidField(res, propertyId, "propertyId")) return;
  if (!validateUuidField(res, sellerId, "sellerId", false)) return;

  const deleted = await PropertyModel.delete(propertyId, sellerId || null);
  if (!deleted) {
    return fail(res, 404, "Property not found", "NOT_FOUND");
  }

  return ok(res, { id: propertyId }, "Property deleted successfully");
});

export const getPropertyById = wrap(async (req, res) => {
  const { propertyId, sellerId } = req.params;
  if (!validateUuidField(res, propertyId, "propertyId")) return;
  if (!validateUuidField(res, sellerId, "sellerId", false)) return;

  const property = await PropertyModel.findById(propertyId, sellerId || null);
  if (!property) {
    return fail(res, 404, "Property not found", "NOT_FOUND");
  }

  return ok(res, property, "Property retrieved successfully");
});

export const getEstateProperties = wrap(async (req, res) => {
  const { sellerId, estateId } = req.params;
  const propertyType =
    req.params.propertyType || req.body?.propertyType || req.query?.propertyType;

  if (!validateUuidField(res, sellerId, "sellerId")) return;
  if (!validateUuidField(res, estateId, "estateId")) return;

  const properties = await PropertyModel.findEstateProperties(
    sellerId,
    propertyType,
    estateId
  );

  return ok(res, properties, "Estate properties retrieved successfully");
});

export const getAllProperties = wrap(async (req, res) => {
  const source = getRequestInput(req);
  const { page, limit } = parsePagination(source);
  const filters = sanitizeFilters(source);
  const result = await PropertyModel.list({
    page,
    limit,
    sortBy: source.sortBy,
    sortOrder: source.sortOrder,
    filters,
  });

  return respondWithList(res, result, "Properties retrieved successfully");
});

export const getAvailableProperties = wrap(async (req, res) => {
  const source = getRequestInput(req);
  const { page, limit } = parsePagination(source);
  const filters = sanitizeFilters(source);
  const result = await PropertyModel.findAvailable({
    page,
    limit,
    sortBy: source.sortBy,
    sortOrder: source.sortOrder,
    filters,
  });

  return respondWithList(res, result, "Available properties retrieved successfully");
});

export const search = wrap(async (req, res) => {
  const source = getRequestInput(req);
  const q = String(source.q || "").trim();

  if (q.length < 2) {
    return fail(res, 400, "Search query must be at least 2 characters", "VALIDATION_ERROR");
  }

  const { page, limit } = parsePagination(source);
  const result = await PropertyModel.list({
    page,
    limit,
    sortBy: source.sortBy,
    sortOrder: source.sortOrder,
    filters: {
      ...sanitizeFilters(source),
      q,
    },
  });

  return respondWithList(res, result, `Found ${result.total} properties matching "${q}"`);
});

export const getBySellerAndPropertyType = wrap(async (req, res) => {
  const { sellerId } = req.params;
  const propertyType =
    req.params.propertyType || req.body?.propertyType || req.query?.propertyType;

  if (!validateUuidField(res, sellerId, "sellerId")) return;

  const properties = await PropertyModel.findPropertiesBySeller(sellerId, propertyType);
  return ok(res, properties, "Seller properties retrieved successfully");
});

export const getSellerEstateLands = wrap(async (req, res) => {
  const { sellerId } = req.params;
  if (!validateUuidField(res, sellerId, "sellerId")) return;

  const properties = await PropertyModel.findSellerEstateLand(sellerId);
  return ok(res, properties, "Seller estate lands retrieved successfully");
});

export const getBySellerHouseProperties = wrap(async (req, res) => {
  const { sellerId, houseId } = req.params;
  if (!validateUuidField(res, sellerId, "sellerId")) return;
  if (!validateUuidField(res, houseId, "houseId")) return;

  const properties = await PropertyModel.findBySellerHouseProperties(sellerId, houseId);
  return ok(res, properties, "House properties retrieved successfully");
});

export const getNonEstateProperties = wrap(async (req, res) => {
  const { sellerId } = req.params;
  const propertyType =
    req.params.propertyType || req.body?.propertyType || req.query?.propertyType;

  if (!validateUuidField(res, sellerId, "sellerId")) return;

  const properties = await PropertyModel.findNonEstatePropertiesBySeller(
    sellerId,
    propertyType
  );

  return ok(res, properties, "Non-estate properties retrieved successfully");
});

export const getSellerProperties = wrap(async (req, res) => {
  const { sellerId } = req.params;
  if (!validateUuidField(res, sellerId, "sellerId")) return;

  const properties = await PropertyModel.findSellerProperties(sellerId);
  return ok(res, properties, "Seller properties retrieved successfully");
});

export const updateCoverImageUrl = wrap(async (req, res) => {
  const { propertyId } = req.params;
  const imageUrl = req.body?.image_url || req.body?.coverImageUrl || req.body?.imageUrl;

  if (!validateUuidField(res, propertyId, "propertyId")) return;
  if (!imageUrl) {
    return fail(res, 400, "image_url is required", "VALIDATION_ERROR");
  }

  const updated = await PropertyModel.updateCover(propertyId, imageUrl);
  if (!updated) {
    return fail(res, 404, "Property not found", "NOT_FOUND");
  }

  return ok(res, updated, "Property cover image updated successfully");
});

export const countProperties = wrap(async (req, res) => {
  const filters = sanitizeFilters(getRequestInput(req));
  const count = await PropertyModel.count(filters);
  return ok(res, { count }, "Property count retrieved successfully");
});

export const insertMultipleProperties = wrap(async (req, res) => {
  const properties = Array.isArray(req.body?.properties)
    ? req.body.properties
    : Array.isArray(req.body?.lands)
      ? req.body.lands
      : [];

  if (!properties.length) {
    return fail(
      res,
      400,
      "properties must be a non-empty array",
      "VALIDATION_ERROR"
    );
  }

  const inserted = await PropertyModel.bulkInsert(properties);
  return ok(res, { inserted }, "Bulk property insert completed successfully", undefined, 201);
});

export const clearAllProperties = wrap(async (_req, res) => {
  const cleared = await PropertyModel.deleteAll();
  return ok(res, { cleared }, "All properties cleared successfully");
});

export const listProperties = wrap(async (req, res) => {
  const source = getRequestInput(req);
  const { page, limit } = parsePagination(source);
  const filters = sanitizeFilters(source);
  const result = await PropertyModel.list({
    page,
    limit,
    sortBy: source.sortBy,
    sortOrder: source.sortOrder,
    filters,
  });

  return respondWithList(res, result, "Properties retrieved successfully");
});

export const searchProperties = search;

export const getPropertiesStats = wrap(async (req, res) => {
  const filters = sanitizeFilters(getRequestInput(req));
  const result = await PropertyModel.list({
    page: 1,
    limit: 100000,
    sortBy: "created_at",
    sortOrder: "desc",
    filters,
  });

  const stats = PropertyModel.calculateStats(result.rows);
  return ok(res, { ...stats, properties: result.rows }, "Statistics calculated successfully");
});
