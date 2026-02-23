import { Router } from "express";
import {
  addImage,
  assignLawyer,
  createHouse,
  deleteHouse,
  filterHousesForSale,
  getHouseById,
  getHousesByStatus,
  getHousesStats,
  listHousesForSale,
  markAsSold,
  markUnderOffer,
  removeImage,
  searchHousesForSale,
  updateDescription,
  updateFinalSalePrice,
  updateImages,
  updateLegalFlags,
  updatePrice,
  updateVerificationStatus,
  withdrawHouse,
} from "../controllers/house.for.sale.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  assignLawyerSchema,
  createHouseSchema,
  houseIdParamSchema,
  legalFlagsSchema,
  listFilterQuerySchema,
  markSoldSchema,
  paginationQuerySchema,
  searchQuerySchema,
  singleImageSchema,
  statusParamSchema,
  updateDescriptionSchema,
  updateFinalPriceSchema,
  updateImagesSchema,
  updatePriceSchema,
  verificationStatusSchema,
} from "../validators/house.for.sale.validator.js";

const router = Router();
const protectedRouter = Router();
const adminRouter = Router();
const adminOnly = [protect, requireRole("admin")];

/* Public read routes */
router.get("/v2/list", validate({ query: listFilterQuerySchema }), listHousesForSale);
router.get("/v2/search", validate({ query: searchQuerySchema }), searchHousesForSale);
router.get("/v2/filter", validate({ query: listFilterQuerySchema }), filterHousesForSale);
router.get("/v2/stats", validate({ query: listFilterQuerySchema }), getHousesStats);
router.get("/status/:status", validate({ params: statusParamSchema }), getHousesByStatus);
router.get("/:houseId", validate({ params: houseIdParamSchema }), getHouseById);

/* Protected write routes */
protectedRouter.use(protect);
protectedRouter.post("/", validate({ body: createHouseSchema }), createHouse);
protectedRouter.put(
  "/:houseId/price",
  validate({ params: houseIdParamSchema, body: updatePriceSchema }),
  updatePrice
);
protectedRouter.put(
  "/:houseId/final-price",
  validate({ params: houseIdParamSchema, body: updateFinalPriceSchema }),
  updateFinalSalePrice
);
protectedRouter.put(
  "/:houseId/description",
  validate({ params: houseIdParamSchema, body: updateDescriptionSchema }),
  updateDescription
);
protectedRouter.put(
  "/:houseId/images",
  validate({ params: houseIdParamSchema, body: updateImagesSchema }),
  updateImages
);
protectedRouter.post(
  "/:houseId/image",
  validate({ params: houseIdParamSchema, body: singleImageSchema }),
  addImage
);
protectedRouter.delete(
  "/:houseId/image",
  validate({ params: houseIdParamSchema, body: singleImageSchema }),
  removeImage
);
protectedRouter.put(
  "/:houseId/lawyer",
  validate({ params: houseIdParamSchema, body: assignLawyerSchema }),
  assignLawyer
);
protectedRouter.put(
  "/:houseId/verification",
  validate({ params: houseIdParamSchema, body: verificationStatusSchema }),
  updateVerificationStatus
);
protectedRouter.put(
  "/:houseId/legal-flags",
  validate({ params: houseIdParamSchema, body: legalFlagsSchema }),
  updateLegalFlags
);
protectedRouter.put("/:houseId/under-offer", validate({ params: houseIdParamSchema }), markUnderOffer);
protectedRouter.put(
  "/:houseId/mark-sold",
  validate({ params: houseIdParamSchema, body: markSoldSchema }),
  markAsSold
);
protectedRouter.put("/:houseId/withdraw", validate({ params: houseIdParamSchema }), withdrawHouse);

/* Admin destructive route */
adminRouter.delete("/:houseId", validate({ params: houseIdParamSchema }), deleteHouse);

router.use(protectedRouter);
router.use(adminOnly, adminRouter);

export default router;
