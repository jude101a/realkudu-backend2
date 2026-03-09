import ApartmentModel from "../models/apartment.model.js";

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
    console.error("[apartment.controller] unhandled error", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    if (error?.code === "23503") {
      return fail(res, 400, "Invalid related resource reference", "FK_CONSTRAINT");
    }
    return fail(res, 500, "Internal server error", "INTERNAL_ERROR");
  }
};

const isUuid = (value) => UUID_RE.test(String(value || ""));

const parsePagination = (query) => ({
  page: Math.max(Number.parseInt(query.page, 10) || 1, 1),
  limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 100),
  sortBy: query.sortBy || "created_at",
  sortOrder: query.sortOrder || "desc",
});

const normalizeApartmentPayload = (payload = {}) => {
  const normalized = { ...payload };
  if (normalized.houseId === undefined && normalized.houseID !== undefined) {
    normalized.houseId = normalized.houseID;
  }
  if (normalized.sellerId === undefined && normalized.sellerID !== undefined) {
    normalized.sellerId = normalized.sellerID;
  }
  if (normalized.tenantId === undefined && normalized.tenantID !== undefined) {
    normalized.tenantId = normalized.tenantID;
  }
  if (
    normalized.numberOfKitchens === undefined &&
    normalized.numberOfKitchen !== undefined
  ) {
    normalized.numberOfKitchens = normalized.numberOfKitchen;
  }

  const boolFields = [
    "hasRunningWater",
    "hasElectricity",
    "hasParkingSpace",
    "hasInternet",
  ];
  for (const field of boolFields) {
    if (normalized[field] === 1) normalized[field] = true;
    if (normalized[field] === 0) normalized[field] = false;
  }

  return normalized;
};

export const createApartment = wrap(async (req, res) => {
  const payload = normalizeApartmentPayload(req.body || {});
  const { houseId, sellerId, apartmentAddress } = payload;
  if (!houseId || !sellerId || !apartmentAddress) {
    return fail(res, 400, "houseId, sellerId and apartmentAddress are required", "VALIDATION_ERROR");
  }
  if (!isUuid(houseId) || !isUuid(sellerId)) {
    return fail(res, 400, "houseId and sellerId must be valid UUIDs", "VALIDATION_ERROR");
  }

  const apartment = await ApartmentModel.create(payload);
  return ok(res, apartment, "Apartment created successfully", undefined, 201);
});

export const updateApartment = wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return fail(res, 400, "id must be a valid UUID", "VALIDATION_ERROR");
  const payload = normalizeApartmentPayload(req.body || {});
  const apartment = await ApartmentModel.update(req.params.id, payload);
  if (!apartment) return fail(res, 404, "Apartment not found", "NOT_FOUND");
  return ok(res, apartment, "Apartment updated successfully");
});

export const updateApartmentTenant = wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return fail(res, 400, "id must be a valid UUID", "VALIDATION_ERROR");
  const tenantId = req.body?.tenantId ?? req.body?.tenantID ?? null;
  if (tenantId !== null && !isUuid(tenantId)) {
    return fail(res, 400, "tenantId must be a valid UUID or null", "VALIDATION_ERROR");
  }

  const apartment = await ApartmentModel.updateTenant(req.params.id, tenantId);
  if (!apartment) return fail(res, 404, "Apartment not found", "NOT_FOUND");
  return ok(res, apartment, "Tenant assigned successfully");
});

export const deleteApartment = wrap(async (req, res) => {
  if (!isUuid(req.params.id)) return fail(res, 400, "id must be a valid UUID", "VALIDATION_ERROR");
  const deleted = await ApartmentModel.softDelete(req.params.id);
  if (!deleted) return fail(res, 404, "Apartment not found", "NOT_FOUND");
  return ok(res, { id: req.params.id }, "Apartment deleted successfully");
});

export const deleteAllApartments = wrap(async (_req, res) => {
  const deleted = await ApartmentModel.deleteAll();
  return ok(res, { deleted }, "All apartments deleted successfully");
});

export const getApartmentsByHouse = wrap(async (req, res) => {
  const houseId = req.params.houseId || req.params.houseID;
  if (!isUuid(houseId)) {
    return fail(res, 400, "houseId must be a valid UUID", "VALIDATION_ERROR");
  }
  const rows = await ApartmentModel.findByHouseId(houseId);
  return ok(res, rows, "Apartments retrieved successfully");
});

export const getAllApartments = wrap(async (req, res) => {
  const result = await ApartmentModel.findAll(parsePagination(req.query));
  return ok(res, result.rows, "All apartments retrieved successfully", {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const listApartments = wrap(async (req, res) => {
  const pagination = parsePagination(req.query);
  const filters = {
    sellerId: req.query.sellerId,
    houseId: req.query.houseId,
    minRent: req.query.minRent !== undefined ? Number(req.query.minRent) : undefined,
    maxRent: req.query.maxRent !== undefined ? Number(req.query.maxRent) : undefined,
    numberOfBedrooms:
      req.query.numberOfBedrooms !== undefined ? Number(req.query.numberOfBedrooms) : undefined,
  };

  const result = await ApartmentModel.list({ ...pagination, filters });
  return ok(res, result.rows, "Apartments retrieved successfully", {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const searchApartments = wrap(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return fail(res, 400, "Search query must be at least 2 characters", "VALIDATION_ERROR");
  }

  const result = await ApartmentModel.search(q, parsePagination(req.query));
  return ok(res, result.rows, `Found ${result.total} apartments matching "${q}"`, {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const filterApartments = wrap(async (req, res) => {
  const result = await ApartmentModel.list({
    ...parsePagination(req.query),
    filters: {
      sellerId: req.query.sellerId,
      houseId: req.query.houseId,
      minRent: req.query.minRent !== undefined ? Number(req.query.minRent) : undefined,
      maxRent: req.query.maxRent !== undefined ? Number(req.query.maxRent) : undefined,
      numberOfBedrooms:
        req.query.numberOfBedrooms !== undefined ? Number(req.query.numberOfBedrooms) : undefined,
      furnishedStatus: req.query.furnishedStatus,
    },
  });

  return ok(res, result.rows, "Filtered results retrieved successfully", {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});

export const getApartmentsStats = wrap(async (req, res) => {
  const result = await ApartmentModel.list({
    page: 1,
    limit: 100000,
    filters: {
      sellerId: req.query.sellerId,
      houseId: req.query.houseId,
    },
  });

  const stats = ApartmentModel.calculateStats(result.rows);
  return ok(res, { ...stats, apartments: result.rows }, "Statistics calculated successfully");
});

export const createTenantMeta = wrap(async (req, res) => {
  const record = await ApartmentModel.createTenantMeta(req.body || {});
  return ok(res, record, "Tenant meta created successfully", undefined, 201);
});

export const getTenantMetaByTenant = wrap(async (req, res) => {
  const tenantId = req.query.tenantID;
  const record = await ApartmentModel.getTenantMetaByTenant(tenantId);
  if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
  return ok(res, record, "Tenant meta retrieved successfully");
});

export const getTenantMetaByProperty = wrap(async (req, res) => {
  const propertyId = req.query.propertyID;
  const record = await ApartmentModel.getTenantMetaByProperty(propertyId);
  if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
  return ok(res, record, "Tenant meta retrieved successfully");
});

export const markRentPaid = wrap(async (req, res) => {
  const record = await ApartmentModel.markRentPaid(
    req.params.tenantMetaId,
    req.body.paymentDate,
    req.body.nextDueDate
  );
  if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
  return ok(res, record, "Rent marked as paid");
});

export const updateOutstandingBalance = wrap(async (req, res) => {
  const record = await ApartmentModel.updateOutstandingBalance(
    req.params.tenantMetaId,
    req.body.amount
  );
  if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
  return ok(res, record, "Outstanding balance updated");
});

export const serveTenantNotice = wrap(async (req, res) => {
  const record = await ApartmentModel.serveNotice(req.params.tenantMetaId);
  if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
  return ok(res, record, "Notice served");
});

export const terminateTenantTenancy = wrap(async (req, res) => {
  const record = await ApartmentModel.terminateTenancy(req.params.tenantMetaId);
  if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
  return ok(res, record, "Tenancy terminated");
});

export const deleteTenantMeta = wrap(async (req, res) => {
  const record = await ApartmentModel.deleteTenantMeta(req.params.tenantMetaId);
  if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
  return ok(res, { id: req.params.tenantMetaId }, "Tenant meta deleted successfully");
});
