import { Router } from "express";
import {
 
  createProperty,
  updateProperty,
  updatePropertyFields,
  deleteProperty,
  getPropertyById,
  getEstateProperties,
  getAllProperties,
  getAvailableProperties,
  search,
  getBySellerAndPropertyType,
  getNonEstateProperties,
  updateCoverImageUrl,
  countProperties,
  insertMultipleProperties,
  clearAllProperties,
  searchProperties,
  getPropertiesStats,
  listProperties,

  
 
} from "../controllers/property.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  bulkInsertSchema,
  createSchema,
  propertyIdParamSchema,
  sellerIdParamSchema,
  updateCoverSchema,
} from "../validators/property.validator.js";

const router = Router();
const protectedRouter = Router();
const adminRouter = Router();

const adminOnly = [protect, requireRole("admin")];

/* ================= PUBLIC READ ROUTES ================= */
router.get("/get", getAllProperties);
router.get("/available", getAvailableProperties);
router.get("/search", search);
router.post("/sellerProperties/:sellerId", validate({ params: sellerIdParamSchema }), getBySellerAndPropertyType);
router.post("/sellerEstateProperties/:sellerId", validate({ params: sellerIdParamSchema }), getEstateProperties);
router.post("/sellerNonEstateProperties/:sellerId", validate({ params: sellerIdParamSchema }), getNonEstateProperties);
router.post("/stats/count", countProperties);
router.get("/list", listProperties);
router.get("/stats", getPropertiesStats);
router.get("/:propertyId", validate({ params: propertyIdParamSchema }), getPropertyById);

/* ================= PROTECTED WRITE ROUTES ================= */
protectedRouter.use(protect);
protectedRouter.delete("/deleteProperty",validate({params: propertyIdParamSchema}) , deleteProperty)
protectedRouter.post("/", validate({ body: createSchema }), createProperty);
protectedRouter.put(
  "/:propertyId",
  validate({ params: propertyIdParamSchema }),
  updateProperty
);

protectedRouter.patch(
  "/coverImageUrl/:propertyId",
  validate({ params: propertyIdParamSchema, }),
  updateCoverImageUrl
);
protectedRouter.post("/bulkInsert", insertMultipleProperties);

/* ================= ADMIN-ONLY MUTATION ROUTES ================= */
adminRouter.post("/bulk", validate({ body: bulkInsertSchema }), insertMultipleProperties);
adminRouter.delete("/:propertyId", validate({ params: propertyIdParamSchema }), deleteProperty);
adminRouter.delete("/clear/all", clearAllProperties);

router.use(protectedRouter);
router.use(adminOnly, adminRouter);

export default router;
