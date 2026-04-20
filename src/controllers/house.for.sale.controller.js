// import HouseForSaleModel from "../models/house.for.sale.model.js";

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
//     if (error?.code === "23503") {
//       return fail(res, 400, "Invalid related resource reference", "FK_CONSTRAINT");
//     }
//     console.error("[house.for.sale.controller] unhandled error:", error);
//     const details =
//       process.env.NODE_ENV !== "production"
//         ? { message: error?.message, code: error?.code, detail: error?.detail }
//         : undefined;
//     return fail(res, 500, "Internal server error", "INTERNAL_ERROR", details);
//   }
// };

// const isUuid = (value) => UUID_RE.test(String(value || ""));

// const parsePagination = (query) => ({
//   page: Math.max(Number.parseInt(query.page, 10) || 1, 1),
//   limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 100),
//   sortBy: query.sortBy || "created_at",
//   sortOrder: query.sortOrder || "desc",
// });



// export const updatePrice = wrap(async (req, res) => {
//   const updated = await updateHouseById(req.params.houseId, {
//     askingPrice: req.body.newPrice,
//   });
//   if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
//   return ok(res, updated, "Price updated successfully");
// });

// export const updateFinalSalePrice = wrap(async (req, res) => {
//   const updated = await updateHouseById(req.params.houseId, {
//     finalSalePrice: req.body.price,
//   });
//   if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
//   return ok(res, updated, "Final sale price updated successfully");
// });

// export const updateDescription = wrap(async (req, res) => {
//   const updated = await updateHouseById(req.params.houseId, {
//     description: req.body.description,
//   });
//   if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
//   return ok(res, updated, "Description updated successfully");
// });

// export const updateImages = wrap(async (req, res) => {
//   const updated = await updateHouseById(req.params.houseId, {
//     images: req.body.images,
//   });
//   if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
//   return ok(res, updated, "Images updated successfully");
// });


// export const assignLawyer = wrap(async (req, res) => {
//   const updated = await updateHouseById(req.params.houseId, {
//     lawyerId: req.body.lawyerId,
//   });
//   if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
//   return ok(res, updated, "Lawyer assigned successfully");
// });

// export const updateVerificationStatus = wrap(async (req, res) => {
//   const updated = await updateHouseById(req.params.houseId, {
//     verificationStatus: req.body.status,
//   });
//   if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
//   return ok(res, updated, "Verification status updated successfully");
// });

// export const updateLegalFlags = wrap(async (req, res) => {
//   const updated = await updateHouseById(req.params.houseId, {
//     hasSurveyPlan: req.body.hasSurveyPlan,
//     hasBuildingApproval: req.body.hasBuildingApproval,
//     governorConsentObtained: req.body.governorConsentObtained,
//   });
//   if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
//   return ok(res, updated, "Legal flags updated successfully");
// });

// export const markUnderOffer = wrap(async (req, res) => {
//   const updated = await updateHouseById(req.params.houseId, { status: "under_offer" });
//   if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
//   return ok(res, updated, "House marked as under offer");
// });

// export const markAsSold = wrap(async (req, res) => {
//   const updated = await updateHouseById(req.params.houseId, {
//     buyerId: req.body.buyerId,
//     finalSalePrice: req.body.finalPrice,
//     status: "sold",
//     soldAt: new Date().toISOString(),
//   });
//   if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
//   return ok(res, updated, "House marked as sold");
// });

// export const withdrawHouse = wrap(async (req, res) => {
//   const updated = await updateHouseById(req.params.houseId, { status: "withdrawn" });
//   if (!updated) return fail(res, 404, "House not found", "NOT_FOUND");
//   return ok(res, updated, "House withdrawn successfully");
// });

// export const getHousesByStatus = wrap(async (req, res) => {
//   const houses = await HouseForSaleModel.findByStatus(req.params.status);
//   return ok(res, houses, "Houses retrieved successfully");
// });






