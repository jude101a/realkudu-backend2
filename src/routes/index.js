import { Router } from "express";
import { healthCheck } from "../controllers/health.controller.js";
import userRoutes from "./user.routes.js";
import sellerRoutes from "./seller.routes.js";
import landPropertyRoutes from "./land.property.routes.js";
import estateRoutes from "./estate.routes.js";
import apartmentRoutes from "./apartment.routes.js";
import devSeedRoutes from "./dev.seed.routes.js";
import houseForSaleRoutes from "./house.for.sale.routes.js";
import houseRoutes from "./house.routes.js";

const router = Router();

router.get("/health", healthCheck);
router.use("/users", userRoutes);
router.use("/sellers", sellerRoutes);
router.use("/land-properties", landPropertyRoutes);
router.use("/estates", estateRoutes);
router.use("/apartments", apartmentRoutes);
router.use("/houses-for-sale", houseForSaleRoutes);
router.use("/dev", devSeedRoutes);
router.use("/houses", houseRoutes);


export default router;
