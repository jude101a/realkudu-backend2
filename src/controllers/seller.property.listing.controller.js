import SellerPropertyListingModel from "../models/seller.property.listing.model.js";

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
    console.error("[seller.property.listing.controller] unhandled error", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    return fail(res, 500, "Internal server error", "INTERNAL_ERROR");
  }
};

const parsePagination = (query) => ({
  page: Math.max(Number.parseInt(query.page, 10) || 1, 1),
  limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100),
});

const parseSort = (query) => ({
  sortBy: String(query.sortBy || "created_at").toLowerCase(),
  sortOrder: String(query.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc",
});

const parseQuery = (query) => ({
  propertyType: String(query.propertyType || "all").toLowerCase(),
});

export const getSellerPropertyListings = wrap(async (req, res) => {
  const sellerId = String(req.params.id).trim();
  const pagination = parsePagination(req.query);
  const sort = parseSort(req.query);
  const queryFilters = parseQuery(req.query);

  if (!sellerId) {
    return fail(res, 400, "Seller ID is required", "VALIDATION_ERROR");
  }

  const result = await SellerPropertyListingModel.findAllBySeller(sellerId, {
    ...pagination,
    ...sort,
    propertyType: queryFilters.propertyType,
  });

  return ok(
    res,
    result.rows,
    `Found ${result.total} properties for seller ${sellerId}`,
    {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      propertyTypeCounts: result.typeCounts,
    }
  );
});
