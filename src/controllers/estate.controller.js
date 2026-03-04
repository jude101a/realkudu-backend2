import EstateModel from "../models/estate.model.js";

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
    if (error?.code === "23503") {
      return fail(res, 400, "Invalid related resource reference", "FK_CONSTRAINT");
    }
    if (error?.code === "22P02") {
      return fail(res, 400, "Invalid identifier format", "VALIDATION_ERROR");
    }

    console.error("[estate.controller] unhandled error", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
    });

    const details =
      process.env.NODE_ENV !== "production"
        ? { message: error?.message, code: error?.code, detail: error?.detail }
        : undefined;

    return fail(res, 500, "Internal server error", "INTERNAL_ERROR", details);
  }
};

const parsePagination = (query) => ({
  page: Math.max(Number.parseInt(query.page, 10) || 1, 1),
  limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100),
  sortBy: query.sortBy || "created_at",
  sortOrder: query.sortOrder || "desc",
});

const listMeta = (result) => ({
  total: result.total,
  page: result.page,
  limit: result.limit,
  totalPages: result.totalPages,
});

export const createEstate = wrap(async (req, res) => {
  const estate = await EstateModel.create(req.body || {});
  return ok(res, estate, "Estate created successfully", undefined, 201);
});

export const getEstate = wrap(async (req, res) => {
  const estate = await EstateModel.findById(req.params.id);
  if (!estate) return fail(res, 404, "Estate not found", "NOT_FOUND");
  return ok(res, estate, "Estate retrieved successfully");
});

export const getAllEstatesBySeller = wrap(async (req, res) => {
  
  const result = await EstateModel.findAllBySeller(req.params.sellerId, {
    ...parsePagination(req.query),
    filters: {
      state: req.query.state,
      lga: req.query.lga,
      q: req.query.q,
    },
  });

  return ok(res, result.rows, "Estates retrieved successfully", listMeta(result));
});

export const getResidentialEstates = wrap(async (req, res) => {
  const result = await EstateModel.findResidentialBySeller(req.params.sellerId, {
    ...parsePagination(req.query),
    filters: {
      state: req.query.state,
      lga: req.query.lga,
      q: req.query.q,
    },
  });

  return ok(res, result.rows, "Residential estates retrieved successfully", listMeta(result));
});

export const getLandEstates = wrap(async (req, res) => {
  const result = await EstateModel.findLandEstatesBySeller(req.params.sellerId, {
    ...parsePagination(req.query),
    filters: {
      state: req.query.state,
      lga: req.query.lga,
      q: req.query.q,
    },
  });

  return ok(res, result.rows, "Land estates retrieved successfully", listMeta(result));
});

export const updateEstateCoverImage = wrap(async (req, res) => {
  const estate = await EstateModel.updateCoverImage(req.params.estateId, req.body.coverImageUrl);
  if (!estate) return fail(res, 404, "Estate not found", "NOT_FOUND");
  return ok(res, estate, "Estate cover image updated successfully");
});

export const updateEstateDetails = wrap(async (req, res) => {
  const estate = await EstateModel.updateDetails(req.params.estateId, req.body || {});
  if (!estate) return fail(res, 404, "Estate not found", "NOT_FOUND");
  return ok(res, estate, "Estate details updated successfully");
});

export const deleteEstate = wrap(async (req, res) => {
  const deleted = await EstateModel.softDelete(req.params.estateId);
  if (!deleted) return fail(res, 404, "Estate not found", "NOT_FOUND");
  return ok(res, { id: deleted.id }, "Estate deleted successfully");
});

// controllers/estate.controller.js
export const softDeleteEstate = wrap(async (req, res) => {
  const { estateId } = req.params;

  const deleted = await EstateModel.softDeleteByEstateId(estateId);

  if (!deleted) {
    return fail(res, 404, "Estate not found or already deleted", "NOT_FOUND");
  }

  return ok(
    res,
    deleted,
    "Estate soft-deleted successfully",
    undefined,
    200
  );
});


export const getDeletedEstatesBySeller = wrap(async (req, res) => {
  const { sellerId } = req.params;

  const estates = await EstateModel.findDeletedBySellerId(sellerId);

  return ok(
    res,
    estates,
    "Deleted estates fetched successfully",
    { total: estates.length }
  );
});