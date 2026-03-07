import { Router } from "express";
import {
  createHouse,
  deleteHouse,
  getAllHouses,
  getHouse,
  getHousesBySeller,
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
  estateHousesQuerySchema,
  houseIdParamSchema,
  houseListQuerySchema,
  sellerEstateParamSchema,
  sellerIdParamSchema,
  standaloneQuerySchema,
  updateHouseCaretakerSchema,
  updateHouseCoverSchema,
  updateHouseLawyerSchema,
  updateHouseSchema,
} from "../validators/house.validator.js";

const router = Router();
const protectedRouter = Router();
const adminOnly = [protect, requireRole("admin")];

/* Public read routes */
router.get("/", validate({ query: houseListQuerySchema }), getAllHouses);
router.get("/getAllHouses", validate({ query: houseListQuerySchema }), getAllHouses);
router.get("/standalone/:sellerId", validate({ params: sellerIdParamSchema, query: standaloneQuerySchema }), getStandaloneHouses);
router.get("/standalone", validate({ query: standaloneQuerySchema }), getStandaloneHouses);
router.get("/estateHouses/:sellerId/:estateId", validate({ params: sellerEstateParamSchema, query: estateHousesQuerySchema }), getEstateHousesBySeller);
router.get("/estateHouses", validate({ query: estateHousesQuerySchema }), getEstateHousesBySeller);
router.get("/seller/:sellerId", validate({ params: sellerIdParamSchema, query: houseListQuerySchema }), getHousesBySeller);
router.get("/estate/:estateId", validate({ params: estateIdParamSchema, query: houseListQuerySchema }), getHousesByEstate);
router.get("/:id", validate({ params: houseIdParamSchema }), getHouse);

/* Protected write routes */
protectedRouter.post("/", protect, validate({ body: createHouseSchema }), createHouse);
/* Legacy compatibility */
protectedRouter.post("/createHouse", protect, validate({ body: createHouseSchema }), createHouse);
protectedRouter.put(
  "/:id/cover",
  protect,
  validate({ params: houseIdParamSchema, body: updateHouseCoverSchema }),
  updateHouseCover
);
protectedRouter.put(
  "/:id/coverImage",
  protect,
  validate({ params: houseIdParamSchema, body: updateHouseCoverSchema }),
  updateHouseCover
);
protectedRouter.put(
  "/:id/lawyer",
  protect,
  validate({ params: houseIdParamSchema, body: updateHouseLawyerSchema }),
  updateHouseLawyer
);
protectedRouter.put(
  "/:id/updateHouseLawyer",
  protect,
  validate({ params: houseIdParamSchema, body: updateHouseLawyerSchema }),
  updateHouseLawyer
);
protectedRouter.put(
  "/:id/caretaker",
  protect,
  validate({ params: houseIdParamSchema, body: updateHouseCaretakerSchema }),
  updateHouseCaretaker
);
protectedRouter.put(
  "/:id/updateHouseCaretaker",
  protect,
  validate({ params: houseIdParamSchema, body: updateHouseCaretakerSchema }),
  updateHouseCaretaker
);
protectedRouter.put("/:id", protect, validate({ params: houseIdParamSchema, body: updateHouseSchema }), updateHouse);
protectedRouter.put("/updateHouse/:id", protect, validate({ params: houseIdParamSchema, body: updateHouseSchema }), updateHouse);

/* Admin destructive route */
router.delete("/:id", ...adminOnly, validate({ params: houseIdParamSchema }), deleteHouse);
router.delete("/deleteHouse/:id", ...adminOnly, validate({ params: houseIdParamSchema }), deleteHouse);

router.use(protectedRouter);

export default router;
