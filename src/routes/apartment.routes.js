// import { Router } from "express";
// import {
//   createTenantMeta,
//   deleteAllApartments,
//   deleteApartment,
//   deleteTenantMeta,
//   filterApartments,
//   getAllApartments,
//   getApartmentsByHouse,
//   getApartmentsStats,
//   getTenantMetaByProperty,
//   getTenantMetaByTenant,
//   listApartments,
//   markRentPaid,
//   searchApartments,
//   serveTenantNotice,
//   terminateTenantTenancy,
//   updateApartment,
//   updateOutstandingBalance,
//   updateApartmentTenant,
// } from "../controllers/apartment.controller.js";

// import {createProperty, deleteProperty, updateProperty} from "../controllers/property.controller.js"
// import { protect } from "../middlewares/auth.middleware.js";
// import { requireRole } from "../middlewares/role.middleware.js";
// import { validate } from "../middlewares/validate.middleware.js";
// import {
//   apartmentIdParamSchema,
//   createTenantMetaSchema,
//   createApartmentSchema,
//   filterQuerySchema,
//   houseIdParamSchema,
//   markRentPaidSchema,
//   paginationQuerySchema,
//   searchQuerySchema,
//   tenantMetaByPropertyQuerySchema,
//   tenantMetaByTenantQuerySchema,
//   tenantMetaIdParamSchema,
//   updateOutstandingBalanceSchema,
//   updateApartmentSchema,
//   updateTenantSchema,
// } from "../validators/apartment.validator.js";

// const router = Router();
// const protectedRouter = Router();
// const adminRouter = Router();
// const adminOnly = [protect, requireRole("admin")];

// /* Public read routes */
// router.get("/", validate({ query: paginationQuerySchema }), getAllApartments);
// router.get("/house/:houseId", validate({ params: houseIdParamSchema }), getApartmentsByHouse);
// router.get("/v2/list", validate({ query: filterQuerySchema }), listApartments);
// router.get("/v2/search", validate({ query: searchQuerySchema }), searchApartments);
// router.get("/v2/filter", validate({ query: filterQuerySchema }), filterApartments);
// router.get("/v2/stats", validate({ query: filterQuerySchema }), getApartmentsStats);
// router.get("/tenant-meta/by-tenant", validate({ query: tenantMetaByTenantQuerySchema }), getTenantMetaByTenant);
// router.get("/tenant-meta/by-property", validate({ query: tenantMetaByPropertyQuerySchema }), getTenantMetaByProperty);

// /* Protected write routes */
// protectedRouter.use(protect);
// protectedRouter.post("/createProperty", createProperty);
// protectedRouter.put(
//   "/updateApartment/:id",
//   validate({ params: apartmentIdParamSchema, body: updateApartmentSchema }),
//   updateProperty
// );
// protectedRouter.put(
//   "/updateTenant/:id/tenant",
//   validate({ params: apartmentIdParamSchema, body: updateTenantSchema }),
//   updateApartmentTenant
// );
// protectedRouter.post(
//   "/createtenantMeta",
//   validate({ body: createTenantMetaSchema }),
//   createTenantMeta
// );
// protectedRouter.put(
//   "/tenant-meta/mark-rent-paid/:tenantMetaId",
//   validate({ params: tenantMetaIdParamSchema, body: markRentPaidSchema }),
//   markRentPaid
// );
// protectedRouter.put(
//   "/tenant-meta/outstandingBalanceUpdate/:tenantMetaId",
//   validate({ params: tenantMetaIdParamSchema, body: updateOutstandingBalanceSchema }),
//   updateOutstandingBalance
// );
// protectedRouter.put(
//   "/tenant-meta/:tenantMetaId/serve-notice",
//   validate({ params: tenantMetaIdParamSchema }),
//   serveTenantNotice
// );
// protectedRouter.put(
//   "/tenant-meta/:tenantMetaId/terminate-tenancy",
//   validate({ params: tenantMetaIdParamSchema }),
//   terminateTenantTenancy
// );
// protectedRouter.delete(
//   "/tenant-meta/:tenantMetaId",
//   validate({ params: tenantMetaIdParamSchema }),
//   deleteTenantMeta
// );

// /* Admin destructive routes */
// adminRouter.delete("/:id", validate({ params: apartmentIdParamSchema }), deleteProperty);
// adminRouter.delete("/", deleteAllApartments);

// router.use(protectedRouter);
// router.use(adminOnly, adminRouter);

// export default router;
