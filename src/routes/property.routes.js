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
  getBySellerHouseProperties,
  getSellerProperties,
  getSellerEstateLands,

  
 
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
router.get("/list", listProperties);
router.get("/stats", getPropertiesStats);

router.get("/sellerProperties/:sellerId", getSellerProperties);
router.get("/sellerHouseApartments/:sellerId/:houseId", getBySellerHouseProperties);

router.post("/stats/count", countProperties);
router.post("/sellerProperties/:sellerId", getBySellerAndPropertyType);
router.post("/sellerEstateProperties/:sellerId/:estateId/:propertyType", getEstateProperties);
router.post("/sellerNonEstateProperties/:sellerId/:propertyType", getNonEstateProperties);

router.get("getById/:propertyId/:sellerId", getPropertyById); // always last
/* ================= PROTECTED WRITE ROUTES ================= */
protectedRouter.use(protect);
router.delete("/deleteProperty/:sellerId/:propertyId",validate({params: propertyIdParamSchema}) , deleteProperty)
router.post("/create",
  
  // validate({ body: createSchema }),
  
  createProperty);
router.put(
  "/update/:propertyId",

  // validate({ params: propertyIdParamSchema }),

  updateProperty
);
router.get("/sellerEstateLand/:sellerId",getSellerEstateLands)

router.get("/sellerProperties/:sellerId", getSellerProperties)

router.patch(
  "/coverImageUrl/:propertyId",
  validate(
    // { params: propertyIdParamSchema, }
  ),
    
  updateCoverImageUrl
);
router.post("/bulkInsert", insertMultipleProperties);

/* ================= ADMIN-ONLY MUTATION ROUTES ================= */
router.post("/bulk",
  //  validate({ body: bulkInsertSchema }), 
   insertMultipleProperties);
router.delete("/delete/:propertyId", validate({ params: propertyIdParamSchema }), deleteProperty);
router.delete("/clear/all", clearAllProperties);

router.use(protectedRouter);
router.use(adminOnly, adminRouter);

export default router;
