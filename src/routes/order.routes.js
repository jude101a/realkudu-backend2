import { Router } from "express";
import { getMyOrders } from "../controllers/order.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protect);
router.get("/mine", getMyOrders);

export default router;
