import LandPropertyModel from "../models/land.property.model.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUIRED_CREATE_FIELDS = [
  "sellerId",
  "propertyName",
  "propertyAddress",
  "stateLocation",
  "country",
  "price",
  "availableQuantity",
  "shortDescription",
  "longDescription",
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
    console.error("[land.property.controller] unhandled error", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    return fail(res, 500, "Internal server error", "INTERNAL_ERROR");
  }
};

const isUuid = (value) => UUID_RE.test(String(value || ""));

const parsePagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 100);
  return { page, limit };
};

const sanitizeFilters = (query) => ({
  status: query.status,
  sellerId: query.sellerId,
  estateId: query.estateId,
  minPrice: query.minPrice !== undefined ? Number(query.minPrice) : undefined,
  maxPrice: query.maxPrice !== undefined ? Number(query.maxPrice) : undefined,
  landType: query.landType,
  q: query.q,
});

export const createLandProperty = wrap(async (req, res) => {
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

  const created = await LandPropertyModel.create(req.body);
  return ok(res, created, "Land property created successfully", undefined, 201);
});

export const updateLandProperty = wrap(async (req, res) => {
  const { propertyId } = req.params;
  if (!isUuid(propertyId)) {
    return fail(res, 400, "propertyId must be a valid UUID", "VALIDATION_ERROR");
  }

  const updated = await LandPropertyModel.update(propertyId, req.body || {});
  if (!updated) {
    return fail(res, 404, "Land property not found", "NOT_FOUND");
  }
  return ok(res, updated, "Land property updated successfully");
});

export const deleteLandProperty = wrap(async (req, res) => {
  const { propertyId } = req.params;
  if (!isUuid(propertyId)) {
    return fail(res, 400, "propertyId must be a valid UUID", "VALIDATION_ERROR");
  }
  const deleted = await LandPropertyModel.delete(propertyId);
  if (!deleted) {
    return fail(res, 404, "Land property not found", "NOT_FOUND");
  }
  return ok(res, { id: propertyId }, "Land property deleted successfully");
});

export const getLandPropertyByID = wrap(async (req, res) => {
  const { propertyId } = req.params;
  if (!isUuid(propertyId)) {
    return fail(res, 400, "propertyId must be a valid UUID", "VALIDATION_ERROR");
  }
  const land = await LandPropertyModel.findById(propertyId);
  if (!land) {
    return fail(res, 404, "Land property not found", "NOT_FOUND");
  }
  return ok(res, land, "Land property retrieved successfully");
});

export const getLandEstateProperty = wrap(async (req, res) => {
  const { sellerId } = req.params;
  if (!isUuid(sellerId)) {
    return fail(res, 400, "sellerId must be a valid UUID", "VALIDATION_ERROR");
  }
  const lands = await LandPropertyModel.findEstateLands(sellerId);
  return ok(res, lands, "Estate land properties retrieved successfully");
});

export const getAllLandProperties = wrap(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await LandPropertyModel.list({
    page,
    limit,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder,
  });
  return ok(res, result.rows, "Land properties retrieved successfully", {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const getAvailableLands = wrap(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await LandPropertyModel.list({
    page,
    limit,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder,
    filters: { status: "available" },
  });
  return ok(res, result.rows, "Available land properties retrieved successfully", {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const searchLand = wrap(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return fail(res, 400, "Search query must be at least 2 characters", "VALIDATION_ERROR");
  }
  const { page, limit } = parsePagination(req.query);
  const result = await LandPropertyModel.list({
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

export const getLandsBySeller = wrap(async (req, res) => {
  const { sellerId } = req.params;
  if (!isUuid(sellerId)) {
    return fail(res, 400, "sellerId must be a valid UUID", "VALIDATION_ERROR");
  }
  const lands = await LandPropertyModel.findBySeller(sellerId);
  return ok(res, lands, "Seller land properties retrieved successfully");
});

export const getNonEstateLand = wrap(async (req, res) => {
  const { sellerId } = req.params;
  if (!isUuid(sellerId)) {
    return fail(res, 400, "sellerId must be a valid UUID", "VALIDATION_ERROR");
  }
  const lands = await LandPropertyModel.findNonEstateBySeller(sellerId);
  return ok(res, lands, "Non-estate land properties retrieved successfully");
});

export const updateLandCover = wrap(async (req, res) => {
  const { propertyId } = req.params;
  const imageUrl = req.body?.image_url || req.body?.coverImageUrl;
  if (!isUuid(propertyId)) {
    return fail(res, 400, "propertyId must be a valid UUID", "VALIDATION_ERROR");
  }
  if (!imageUrl) {
    return fail(res, 400, "image_url is required", "VALIDATION_ERROR");
  }
  const updated = await LandPropertyModel.updateCover(propertyId, imageUrl);
  if (!updated) {
    return fail(res, 404, "Land property not found", "NOT_FOUND");
  }
  return ok(res, updated, "Land cover image updated successfully");
});

export const countProperties = wrap(async (req, res) => {
  const filters = sanitizeFilters(req.query);
  const count = await LandPropertyModel.count(filters);
  return ok(res, { count }, "Property count retrieved successfully");
});

export const insertMultipleLands = wrap(async (req, res) => {
  const lands = Array.isArray(req.body?.lands) ? req.body.lands : [];
  if (!lands.length) {
    return fail(res, 400, "lands must be a non-empty array", "VALIDATION_ERROR");
  }
  const inserted = await LandPropertyModel.bulkInsert(lands);
  return ok(res, { inserted }, "Bulk land insert completed successfully", undefined, 201);
});

export const clearAllLands = wrap(async (_req, res) => {
  await LandPropertyModel.clearAll();
  return ok(res, { cleared: true }, "All land properties cleared successfully");
});

export const listLandProperties = wrap(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const filters = sanitizeFilters(req.query);
  const result = await LandPropertyModel.list({
    page,
    limit,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder,
    filters,
  });
  return ok(res, result.rows, "Land properties retrieved successfully", {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const searchLandProperties = wrap(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return fail(res, 400, "Search query must be at least 2 characters", "VALIDATION_ERROR");
  }
  const { page, limit } = parsePagination(req.query);
  const result = await LandPropertyModel.list({
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

export const filterLandProperties = wrap(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const result = await LandPropertyModel.list({
    page,
    limit,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder,
    filters: sanitizeFilters(req.query),
  });
  return ok(res, result.rows, "Filtered results retrieved successfully", {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const getLandPropertiesStats = wrap(async (req, res) => {
  const result = await LandPropertyModel.list({
    page: 1,
    limit: 100000,
    sortBy: "created_at",
    sortOrder: "desc",
    filters: sanitizeFilters(req.query),
  });
  const stats = LandPropertyModel.calculateStats(result.rows);
  return ok(
    res,
    { ...stats, properties: result.rows },
    "Statistics calculated successfully"
  );
});
