import { Router } from "express";
import {
  clearAllLands,
  countProperties,
  createLandProperty,
  deleteLandProperty,
  filterLandProperties,
  getAllLandProperties,
  getAvailableLands,
  getLandEstateProperty,
  getLandPropertiesStats,
  getLandPropertyByID,
  getLandsBySeller,
  getNonEstateLand,
  insertMultipleLands,
  listLandProperties,
  searchLand,
  searchLandProperties,
  updateLandCover,
  updateLandProperty,
} from "../controllers/land.property.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  bulkInsertSchema,
  createLandSchema,
  filterQuerySchema,
  paginationQuerySchema,
  propertyIdParamSchema,
  searchQuerySchema,
  sellerIdParamSchema,
  updateCoverSchema,
  updateLandSchema,
} from "../validators/land.property.validator.js";

const router = Router();
const protectedRouter = Router();
const adminRouter = Router();

const adminOnly = [protect, requireRole("admin")];

/* ================= PUBLIC READ ROUTES ================= */
router.get("/", validate({ query: paginationQuerySchema }), getAllLandProperties);
router.get("/available", validate({ query: paginationQuerySchema }), getAvailableLands);
router.get("/search", validate({ query: searchQuerySchema }), searchLand);
router.get("/seller/:sellerId", validate({ params: sellerIdParamSchema }), getLandsBySeller);
router.get("/seller/:sellerId/estate", validate({ params: sellerIdParamSchema }), getLandEstateProperty);
router.get("/seller/:sellerId/non-estate", validate({ params: sellerIdParamSchema }), getNonEstateLand);
router.get("/stats/count", validate({ query: filterQuerySchema }), countProperties);
router.get("/v2/list", validate({ query: filterQuerySchema }), listLandProperties);
router.get("/v2/search", validate({ query: searchQuerySchema }), searchLandProperties);
router.get("/v2/filter", validate({ query: filterQuerySchema }), filterLandProperties);
router.get("/v2/stats", validate({ query: filterQuerySchema }), getLandPropertiesStats);
router.get("/:propertyId", validate({ params: propertyIdParamSchema }), getLandPropertyByID);

/* ================= PROTECTED WRITE ROUTES ================= */
protectedRouter.use(protect);
protectedRouter.post("/", validate({ body: createLandSchema }), createLandProperty);
protectedRouter.put(
  "/:propertyId",
  validate({ params: propertyIdParamSchema, body: updateLandSchema }),
  updateLandProperty
);
protectedRouter.patch(
  "/:propertyId/cover",
  validate({ params: propertyIdParamSchema, body: updateCoverSchema }),
  updateLandCover
);

/* ================= ADMIN-ONLY MUTATION ROUTES ================= */
adminRouter.post("/bulk", validate({ body: bulkInsertSchema }), insertMultipleLands);
adminRouter.delete("/:propertyId", validate({ params: propertyIdParamSchema }), deleteLandProperty);
adminRouter.delete("/clear/all", clearAllLands);

router.use(protectedRouter);
router.use(adminOnly, adminRouter);

export default router;
