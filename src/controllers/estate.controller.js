import EstateModel from "../models/estate.model.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    console.error("[estate.controller] unhandled error", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    return fail(res, 500, "Internal server error", "INTERNAL_ERROR");
  }
};

const isUuid = (value) => UUID_RE.test(String(value || ""));

const parsePagination = (query) => ({
  page: Math.max(Number.parseInt(query.page, 10) || 1, 1),
  limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100),
  sortBy: query.sortBy || "created_at",
  sortOrder: query.sortOrder || "desc",
});

export const createEstate = wrap(async (req, res) => {
  const { sellerId, name, address } = req.body || {};
  if (!sellerId || !name || !address) {
    return fail(res, 400, "sellerId, name and address are required", "VALIDATION_ERROR");
  }
  if (!isUuid(sellerId)) {
    return fail(res, 400, "sellerId must be a valid UUID", "VALIDATION_ERROR");
  }

  const estate = await EstateModel.create(req.body);
  return ok(res, estate, "Estate created successfully", undefined, 201);
});

export const getEstate = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return fail(res, 400, "id must be a valid UUID", "VALIDATION_ERROR");

  const estate = await EstateModel.findById(id);
  if (!estate) return fail(res, 404, "Estate not found", "NOT_FOUND");
  return ok(res, estate, "Estate retrieved successfully");
});

export const getAllEstatesBySeller = wrap(async (req, res) => {
  const { sellerId } = req.params;
  if (!isUuid(sellerId)) return fail(res, 400, "sellerId must be a valid UUID", "VALIDATION_ERROR");

  const result = await EstateModel.findAllBySeller(sellerId, parsePagination(req.query));
  return ok(res, result.rows, "Estates retrieved successfully", {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const getResidentialEstates = wrap(async (req, res) => {
  const { sellerId } = req.params;
  if (!isUuid(sellerId)) return fail(res, 400, "sellerId must be a valid UUID", "VALIDATION_ERROR");

  const result = await EstateModel.findResidentialBySeller(sellerId, parsePagination(req.query));
  return ok(res, result.rows, "Residential estates retrieved successfully", {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const getLandEstates = wrap(async (req, res) => {
  const { sellerId } = req.params;
  if (!isUuid(sellerId)) return fail(res, 400, "sellerId must be a valid UUID", "VALIDATION_ERROR");

  const result = await EstateModel.findLandEstatesBySeller(sellerId, parsePagination(req.query));
  return ok(res, result.rows, "Land estates retrieved successfully", {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const updateEstateCoverImage = wrap(async (req, res) => {
  const { id } = req.params;
  const { coverImageUrl } = req.body || {};
  if (!isUuid(id)) return fail(res, 400, "id must be a valid UUID", "VALIDATION_ERROR");
  if (!coverImageUrl) return fail(res, 400, "coverImageUrl is required", "VALIDATION_ERROR");

  const estate = await EstateModel.updateCoverImage(id, coverImageUrl);
  if (!estate) return fail(res, 404, "Estate not found", "NOT_FOUND");
  return ok(res, estate, "Estate cover image updated successfully");
});

export const updateEstateDetails = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return fail(res, 400, "id must be a valid UUID", "VALIDATION_ERROR");

  const estate = await EstateModel.updateDetails(id, req.body || {});
  if (!estate) return fail(res, 404, "Estate not found", "NOT_FOUND");
  return ok(res, estate, "Estate details updated successfully");
});

export const deleteEstate = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return fail(res, 400, "id must be a valid UUID", "VALIDATION_ERROR");

  const deleted = await EstateModel.softDelete(id);
  if (!deleted) return fail(res, 404, "Estate not found", "NOT_FOUND");
  return ok(res, { id }, "Estate deleted successfully");
});
