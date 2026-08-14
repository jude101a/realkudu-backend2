import { Router } from "express";
import WalletController from "../controllers/wallet.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.get(
  "/",
  protect,
  requireRole("SELLER", "seller"),
  WalletController.getWallet
);

export default router;
