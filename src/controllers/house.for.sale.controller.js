import HouseForSaleModel from "../models/house.for.sale.model.js";

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
    if (error?.code === "23503") {
      return fail(res, 400, "Invalid related resource reference", "FK_CONSTRAINT");
    }
    console.error("[house.for.sale.controller] unhandled error:", error);
    const details =
      process.env.NODE_ENV !== "production"
        ? { message: error?.message, code: error?.code, detail: error?.detail }
        : undefined;
    return fail(res, 500, "Internal server error", "INTERNAL_ERROR", details);
  }
};

const isUuid = (value) => UUID_RE.test(String(value || ""));

const parsePagination = (query) => ({
  page: Math.max(Number.parseInt(query.page, 10) || 1, 1),
  limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 100),
  sortBy: query.sortBy || "created_at",
  sortOrder: query.sortOrder || "desc",
});

const updateHouseById = async (houseId, fields) => {
  const updated = await HouseForSaleModel.update(houseId, fields);
  return updated;
};

export const createHouse = wrap(async (req, res) => {
  const created = await HouseForSaleModel.create({
    ...req.body,
    status: req.body.status || "active",
    verificationStatus: req.body.verificationStatus || "pending",
    currency: req.body.currency || "NGN",
  });
  return ok(res, created, "House created successfully", undefined, 201);
});

export const updatePrice = wrap(async (req, res) => {
  const updated = await updateHouseById(req.params.houseId, {
    askingPrice: req.body.newPrice,
  });
  if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
  return ok(res, updated, "Price updated successfully");
});

export const updateFinalSalePrice = wrap(async (req, res) => {
  const updated = await updateHouseById(req.params.houseId, {
    finalSalePrice: req.body.price,
  });
  if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
  return ok(res, updated, "Final sale price updated successfully");
});

export const updateDescription = wrap(async (req, res) => {
  const updated = await updateHouseById(req.params.houseId, {
    description: req.body.description,
  });
  if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
  return ok(res, updated, "Description updated successfully");
});

export const updateImages = wrap(async (req, res) => {
  const updated = await updateHouseById(req.params.houseId, {
    images: req.body.images,
  });
  if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
  return ok(res, updated, "Images updated successfully");
});

export const addImage = wrap(async (req, res) => {
  const house = await HouseForSaleModel.findById(req.params.houseId);
  if (!house) return fail(res, 404, "House not found", "NOT_FOUND");
  const current = Array.isArray(house.images) ? house.images : [];
  const images = [...current, req.body.imageUrl];
  const updated = await updateHouseById(req.params.houseId, { images });
  return ok(res, updated, "Image added successfully");
});

export const removeImage = wrap(async (req, res) => {
  const house = await HouseForSaleModel.findById(req.params.houseId);
  if (!house) return fail(res, 404, "House not found", "NOT_FOUND");
  const current = Array.isArray(house.images) ? house.images : [];
  const images = current.filter((img) => img !== req.body.imageUrl);
  const updated = await updateHouseById(req.params.houseId, { images });
  return ok(res, updated, "Image removed successfully");
});

export const assignLawyer = wrap(async (req, res) => {
  const updated = await updateHouseById(req.params.houseId, {
    lawyerId: req.body.lawyerId,
  });
  if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
  return ok(res, updated, "Lawyer assigned successfully");
});

export const updateVerificationStatus = wrap(async (req, res) => {
  const updated = await updateHouseById(req.params.houseId, {
    verificationStatus: req.body.status,
  });
  if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
  return ok(res, updated, "Verification status updated successfully");
});

export const updateLegalFlags = wrap(async (req, res) => {
  const updated = await updateHouseById(req.params.houseId, {
    hasSurveyPlan: req.body.hasSurveyPlan,
    hasBuildingApproval: req.body.hasBuildingApproval,
    governorConsentObtained: req.body.governorConsentObtained,
  });
  if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
  return ok(res, updated, "Legal flags updated successfully");
});

export const markUnderOffer = wrap(async (req, res) => {
  const updated = await updateHouseById(req.params.houseId, { status: "under_offer" });
  if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
  return ok(res, updated, "House marked as under offer");
});

export const markAsSold = wrap(async (req, res) => {
  const updated = await updateHouseById(req.params.houseId, {
    buyerId: req.body.buyerId,
    finalSalePrice: req.body.finalPrice,
    status: "sold",
    soldAt: new Date().toISOString(),
  });
  if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
  return ok(res, updated, "House marked as sold");
});

export const withdrawHouse = wrap(async (req, res) => {
  const updated = await updateHouseById(req.params.houseId, { status: "withdrawn" });
  if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
  return ok(res, updated, "House withdrawn successfully");
});

export const getHouseById = wrap(async (req, res) => {
  if (!isUuid(req.params.houseId)) {
    return fail(res, 400, "houseId must be a valid UUID", "VALIDATION_ERROR");
  }
  const house = await HouseForSaleModel.findById(req.params.houseId);
  if (!house) return fail(res, 404, "House not found", "NOT_FOUND");
  return ok(res, house, "House retrieved successfully");
});

export const getHousesByStatus = wrap(async (req, res) => {
  const houses = await HouseForSaleModel.findByStatus(req.params.status);
  return ok(res, houses, "Houses retrieved successfully");
});

export const deleteHouse = wrap(async (req, res) => {
  const deleted = await HouseForSaleModel.delete(req.params.houseId);
  if (!deleted) return fail(res, 404, "House not found", "NOT_FOUND");
  return ok(res, { deleted: true }, "House deleted successfully");
});

export const listHousesForSale = wrap(async (req, res) => {
  const pagination = parsePagination(req.query);
  const filters = {
    status: req.query.status,
    ownerId: req.query.ownerId,
    state: req.query.state,
    minPrice: req.query.minPrice !== undefined ? Number(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : undefined,
    bedrooms: req.query.bedrooms !== undefined ? Number(req.query.bedrooms) : undefined,
  };
  const result = await HouseForSaleModel.list({ ...pagination, filters });
  return ok(res, result.rows, "Houses retrieved successfully", {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const searchHousesForSale = wrap(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return fail(res, 400, "Search query must be at least 2 characters", "VALIDATION_ERROR");
  }
  const result = await HouseForSaleModel.search(q, parsePagination(req.query));
  return ok(res, result.rows, `Found ${result.total} houses matching "${q}"`, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const filterHousesForSale = wrap(async (req, res) => {
  const result = await HouseForSaleModel.list({
    ...parsePagination(req.query),
    filters: {
      status: req.query.status,
      ownerId: req.query.ownerId,
      state: req.query.state,
      minPrice: req.query.minPrice !== undefined ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : undefined,
      bedrooms: req.query.bedrooms !== undefined ? Number(req.query.bedrooms) : undefined,
      verificationStatus: req.query.verificationStatus,
    },
  });

  return ok(res, result.rows, "Filtered results retrieved successfully", {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const getHousesStats = wrap(async (req, res) => {
  const result = await HouseForSaleModel.list({
    page: 1,
    limit: 100000,
    filters: {
      ownerId: req.query.ownerId,
      status: req.query.status,
      state: req.query.state,
    },
  });
  const stats = HouseForSaleModel.calculateStats(result.rows);
  return ok(res, { ...stats, houses: result.rows }, "Statistics calculated successfully");
});
