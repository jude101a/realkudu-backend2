import { Router } from "express";
import {
  createHouse,
  deleteHouse,
  getAllHouses,
  getHouse,
  getHousesByEstate,
  getEstateHousesBySeller,
  getStandaloneHouses,
  updateHouse,
  updateHouseCaretaker,
  updateHouseCover,
  updateHouseLawyer,
} from "../controllers/house.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createHouseSchema,
  estateIdParamSchema,
  houseIdParamSchema,
  houseListQuerySchema,
  sellerIdParamSchema,
  standaloneQuerySchema,
  updateHouseCaretakerSchema,
  updateHouseCoverSchema,
  updateHouseLawyerSchema,
  updateHouseSchema,
  estateHousesQuerySchema,
} from "../validators/house.validator.js";

const router = Router();
const protectedRouter = Router();
const adminRouter = Router();
const adminOnly = [protect, requireRole("admin")];

/* Public read routes */
router.get("/getAllHouses", validate({ query: houseListQuerySchema }), getAllHouses);
router.get("/standalone/:sellerId", validate({ params: sellerIdParamSchema, query: standaloneQuerySchema }), getStandaloneHouses);
router.get("/estateHouses/:sellerId/:estateId", validate({ params: sellerIdParamSchema, query: estateHousesQuerySchema }), getEstateHousesBySeller);
router.get("/estate/:estateId", validate({ params: estateIdParamSchema, query: houseListQuerySchema }), getHousesByEstate);
router.get("/:id", validate({ params: houseIdParamSchema }), getHouse);

/* Protected write routes */
protectedRouter.use(protect);
protectedRouter.post("/", validate({ body: createHouseSchema }), createHouse);
/* Legacy compatibility */
protectedRouter.post("/createHouse", validate({ body: createHouseSchema }), createHouse);
protectedRouter.put(
  "/:id/coverImage",
  validate({ params: houseIdParamSchema, body: updateHouseCoverSchema }),
  updateHouseCover
);
protectedRouter.put(
  "/:id/updateHouseLawyer",
  validate({ params: houseIdParamSchema, body: updateHouseLawyerSchema }),
  updateHouseLawyer
);
protectedRouter.put(
  "/:id/updateHouseCaretaker",
  validate({ params: houseIdParamSchema, body: updateHouseCaretakerSchema }),
  updateHouseCaretaker
);
protectedRouter.put("/updateHouse/:id", validate({ params: houseIdParamSchema, body: updateHouseSchema }), updateHouse);

/* Admin destructive route */
adminRouter.delete("/deleteHouse/:id", validate({ params: houseIdParamSchema }), deleteHouse);

router.use(protectedRouter);
router.use(adminOnly, adminRouter);

export default router;
