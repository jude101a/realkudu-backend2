// import ApartmentModel from "../models/apartment.model.js";

// const UUID_RE =
//   /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// const ok = (res, data, message = "Success", meta = undefined, status = 200) =>
//   res.status(status).json({
//     success: true,
//     message,
//     data,
//     ...(meta ? { meta } : {}),
//   });

// const fail = (res, status, message, code = "BAD_REQUEST", details = undefined) =>
//   res.status(status).json({
//     success: false,
//     error: { code, message, details },
//   });

// const wrap = (handler) => async (req, res) => {
//   try {
//     await handler(req, res);
//   } catch (error) {
//     console.error("[apartment.controller] unhandled error", {
//       message: error?.message,
//       code: error?.code,
//       stack: error?.stack,
//     });
//     if (error?.code === "23503") {
//       return fail(res, 400, "Invalid related resource reference", "FK_CONSTRAINT");
//     }
//     return fail(res, 500, "Internal server error", "INTERNAL_ERROR");
//   }
// };

// const isUuid = (value) => UUID_RE.test(String(value || ""));

// const parsePagination = (query) => ({
//   page: Math.max(Number.parseInt(query.page, 10) || 1, 1),
//   limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 100),
//   sortBy: query.sortBy || "created_at",
//   sortOrder: query.sortOrder || "desc",
// });

// const normalizeApartmentPayload = (payload = {}) => {
//   const normalized = { ...payload };
//   if (normalized.houseId === undefined && normalized.houseID !== undefined) {
//     normalized.houseId = normalized.houseID;
//   }
//   if (normalized.sellerId === undefined && normalized.sellerID !== undefined) {
//     normalized.sellerId = normalized.sellerID;
//   }
//   if (normalized.tenantId === undefined && normalized.tenantID !== undefined) {
//     normalized.tenantId = normalized.tenantID;
//   }
//   if (
//     normalized.kitchens === undefined &&
//     normalized.kitchens !== undefined
//   ) {
//     normalized.kitchens = normalized.kitchens;
//   }

//   const boolFields = [
//     "hasRunningWater",
//     "hasElectricity",
//     "hasParkingSpace",
//     "hasInternet",
//   ];
//   for (const field of boolFields) {
//     if (normalized[field] === 1) normalized[field] = true;
//     if (normalized[field] === 0) normalized[field] = false;
//   }

//   return normalized;
// };



// export const updateApartmentTenant = wrap(async (req, res) => {
//   if (!isUuid(req.params.id)) return fail(res, 400, "id must be a valid UUID", "VALIDATION_ERROR");
//   const tenantId = req.body?.tenantId ?? req.body?.tenantID ?? null;
//   if (tenantId !== null && !isUuid(tenantId)) {
//     return fail(res, 400, "tenantId must be a valid UUID or null", "VALIDATION_ERROR");
//   }

//   const apartment = await ApartmentModel.updateTenant(req.params.id, tenantId);
//   if (!apartment) return fail(res, 404, "Apartment not found", "NOT_FOUND");
//   return ok(res, apartment, "Tenant assigned successfully");
// });

// export const createTenantMeta = wrap(async (req, res) => {
//   const record = await ApartmentModel.createTenantMeta(req.body || {});
//   return ok(res, record, "Tenant meta created successfully", undefined, 201);
// });

// export const getTenantMetaByTenant = wrap(async (req, res) => {
//   const tenantId = req.query.tenantID;
//   const record = await ApartmentModel.getTenantMetaByTenant(tenantId);
//   if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
//   return ok(res, record, "Tenant meta retrieved successfully");
// });

// export const getTenantMetaByProperty = wrap(async (req, res) => {
//   const propertyId = req.query.propertyID;
//   const record = await ApartmentModel.getTenantMetaByProperty(propertyId);
//   if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
//   return ok(res, record, "Tenant meta retrieved successfully");
// });

// export const markRentPaid = wrap(async (req, res) => {
//   const record = await ApartmentModel.markRentPaid(
//     req.params.tenantMetaId,
//     req.body.paymentDate,
//     req.body.nextDueDate
//   );
//   if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
//   return ok(res, record, "Rent marked as paid");
// });

// export const updateOutstandingBalance = wrap(async (req, res) => {
//   const record = await ApartmentModel.updateOutstandingBalance(
//     req.params.tenantMetaId,
//     req.body.amount
//   );
//   if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
//   return ok(res, record, "Outstanding balance updated");
// });

// export const serveTenantNotice = wrap(async (req, res) => {
//   const record = await ApartmentModel.serveNotice(req.params.tenantMetaId);
//   if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
//   return ok(res, record, "Notice served");
// });

// export const terminateTenantTenancy = wrap(async (req, res) => {
//   const record = await ApartmentModel.terminateTenancy(req.params.tenantMetaId);
//   if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
//   return ok(res, record, "Tenancy terminated");
// });

// export const deleteTenantMeta = wrap(async (req, res) => {
//   const record = await ApartmentModel.deleteTenantMeta(req.params.tenantMetaId);
//   if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
//   return ok(res, { id: req.params.tenantMetaId }, "Tenant meta deleted successfully");
// });
