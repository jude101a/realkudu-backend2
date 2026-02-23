import { Router } from "express";
import {
  createApartment,
  deleteAllApartments,
  deleteApartment,
  filterApartments,
  getAllApartments,
  getApartmentsByHouse,
  getApartmentsStats,
  listApartments,
  searchApartments,
  updateApartment,
  updateApartmentTenant,
} from "../controllers/apartment.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  apartmentIdParamSchema,
  createApartmentSchema,
  filterQuerySchema,
  houseIdParamSchema,
  paginationQuerySchema,
  searchQuerySchema,
  updateApartmentSchema,
  updateTenantSchema,
} from "../validators/apartment.validator.js";

const router = Router();
const protectedRouter = Router();
const adminRouter = Router();
const adminOnly = [protect, requireRole("admin")];

/* Public read routes */
router.get("/", validate({ query: paginationQuerySchema }), getAllApartments);
router.get("/house/:houseId", validate({ params: houseIdParamSchema }), getApartmentsByHouse);
router.get("/v2/list", validate({ query: filterQuerySchema }), listApartments);
router.get("/v2/search", validate({ query: searchQuerySchema }), searchApartments);
router.get("/v2/filter", validate({ query: filterQuerySchema }), filterApartments);
router.get("/v2/stats", validate({ query: filterQuerySchema }), getApartmentsStats);

/* Protected write routes */
protectedRouter.use(protect);
protectedRouter.post("/", validate({ body: createApartmentSchema }), createApartment);
protectedRouter.put(
  "/:id",
  validate({ params: apartmentIdParamSchema, body: updateApartmentSchema }),
  updateApartment
);
protectedRouter.put(
  "/:id/tenant",
  validate({ params: apartmentIdParamSchema, body: updateTenantSchema }),
  updateApartmentTenant
);

/* Admin destructive routes */
adminRouter.delete("/:id", validate({ params: apartmentIdParamSchema }), deleteApartment);
adminRouter.delete("/", deleteAllApartments);

router.use(protectedRouter);
router.use(adminOnly, adminRouter);

export default router;
