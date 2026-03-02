import { Router } from "express";
import {
  createEstate,
  deleteEstate,
  getAllEstatesBySeller,
  getEstate,
  getLandEstates,
  getResidentialEstates,
  updateEstateCoverImage,
  updateEstateDetails,
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
  "/seller/getAllEstateBySeller/:sellerId",
  validate({ params: sellerIdParamSchema, query: paginationQuerySchema }),
  getAllEstatesBySeller
);
router.get(
  "/seller/:sellerId/residential",
  validate({ params: sellerIdParamSchema, query: paginationQuerySchema }),
  getResidentialEstates
);
router.get(
  "/seller/getLandedEstates:sellerId",
  validate({ params: sellerIdParamSchema, query: paginationQuerySchema }),
  getLandEstates
);
router.get("/getEstate/:id", validate({ params: estateIdParamSchema }), getEstate);

/* Protected write routes */
protectedRouter.use(protect);
protectedRouter.post("/createEstate", validate({ body: createEstateSchema }), createEstate);
protectedRouter.put(
  "/:id/updateEstateCoverImage",
  validate({ params: estateIdParamSchema, body: updateEstateCoverSchema }),
  updateEstateCoverImage
);

protectedRouter.put(
  "/updateEstate/:id",
  validate({ params: estateIdParamSchema, body: updateEstateDetailsSchema }),
  updateEstateDetails
);

/* Admin mutation route */
adminRouter.delete("/deleteEstate/:id", validate({ params: estateIdParamSchema }), deleteEstate);

router.use(protectedRouter);
router.use(adminOnly, adminRouter);

export default router;
