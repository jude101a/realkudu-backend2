import { Router } from "express";
import TransferController from "../controllers/transfer.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import validate from "../middlewares/validate.js";
import {
  initiateTransactionSchema,
  transactionStatusSchema,
  userTransactionsQuerySchema,
} from "../validators/transactions.validator.js";

const router = Router();

router.post(
  "/",
  protect,
  requireRole("ADMIN", "SELLER", "USER", "AGENT"),
  validate(initiateTransactionSchema),
  TransferController.initiate
);

router.get(
  "/status/:transactionStatus",
  protect,
  requireRole("ADMIN", "SELLER"),
  validate(transactionStatusSchema),
  TransferController.getStatus
);

router.get(
  "/user/:userId",
  protect,
  requireRole("ADMIN", "SELLER"),
  validate(userTransactionsQuerySchema),
  (req, res, next) => {
    if (typeof TransferController.listUserTransactions === 'function') {
      return TransferController.listUserTransactions(req, res, next);
    }
    return res.status(501).json({
      success: false,
      error: 'User transaction listing is not available yet.',
    });
  }
);

export default router;
