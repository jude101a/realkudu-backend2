import { Router } from "express";
import TransferController from "../controllers/transfer.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import validate from "../middlewares/validate.js";
import {
  initiateTransferSchema,
  transferStatusSchema,
  sellerTransfersQuerySchema,
} from "../validators/transfer.validator.js";

const router = Router();

router.post(
  "/",
  protect,
  requireRole("ADMIN", "SELLER"),
  validate(initiateTransferSchema),
  TransferController.initiate
);

router.get(
  "/status/:reference",
  protect,
  requireRole("ADMIN", "SELLER"),
  validate(transferStatusSchema),
  TransferController.getStatus
);

router.get(
  "/seller/:sellerId",
  protect,
  requireRole("ADMIN", "SELLER"),
  validate(sellerTransfersQuerySchema),
  TransferController.listSellerTransfers
);

export default router;
