import { Router } from "express";
import {
  createEstate,
  deleteEstate,
  getAllEstatesBySeller,
  getEstate,
  getLandEstates,
  getResidentialEstates,
  softDeleteEstate,
  updateEstateCoverImage,
  updateEstateDetails,
  getDeletedEstatesBySeller
} from "../controllers/estate.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createEstateSchema,
  estateIdParamSchema,
  paginationQuerySchema,
  sellerIdParamSchema,
  updateEstateCoverSchema,
  updateEstateDetailsSchema,
} from "../validators/estate.validator.js";

const router = Router();
const protectedRouter = Router();
const adminRouter = Router();
const adminOnly = [protect, requireRole("admin")];

/* Public read routes */
router.get(
  "/getAllEstateBySeller/:sellerId",
  validate({ params: sellerIdParamSchema, query: paginationQuerySchema }),
  getAllEstatesBySeller
);
router.get(
  "/residential/:sellerId",
  validate({ params: sellerIdParamSchema, query: paginationQuerySchema }),
  getResidentialEstates
);
router.get(
  "/getLandedEstates/:sellerId",
  validate({ params: sellerIdParamSchema, query: paginationQuerySchema }),
  getLandEstates
);
router.get("/getEstate/:estateId", validate({ params: estateIdParamSchema }), getEstate);

/* Protected write routes */
protectedRouter.use(protect);
protectedRouter.post("/createEstate", validate({ body: createEstateSchema }), createEstate);
protectedRouter.put(
  "/updateEstateCoverImage/:estateId",
  validate({ params: estateIdParamSchema, body: updateEstateCoverSchema }),
  updateEstateCoverImage
);

protectedRouter.put(
  "/updateEstate/:estateId",
  validate({ params: estateIdParamSchema, body: updateEstateDetailsSchema }),
  updateEstateDetails
);
protectedRouter.delete("/deleteEstate/:estateId", validate({ params: estateIdParamSchema }), softDeleteEstate);


/* Admin mutation route */
adminRouter.delete("/adminDeleteEstate/:estateId", validate({ params: estateIdParamSchema }), deleteEstate);

// routes/admin.estates.routes.js
adminRouter.delete(
  "/estates/:estateId",
  adminOnly,
  validate({ params: estateIdParamSchema }),
  deleteEstate
);

adminRouter.get(
  "/estates/getDeletedestatesBySellerID/:sellerId",
  adminOnly,
  validate({ params: sellerIdParamSchema }),
  getDeletedEstatesBySeller
);

protectedRouter.get(
  "/estates/deleted/:sellerId",
  adminOnly,
  validate({ params: sellerIdParamSchema }),
  getDeletedEstatesBySeller
);

router.use(protectedRouter);
router.use(adminOnly, adminRouter);

export default router;
