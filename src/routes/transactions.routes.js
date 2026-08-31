import { Router } from "express";
import TransactionController from "../controllers/transactions.controller.js";
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
  TransactionController.initiate
);

router.get(
  "/status/:transactionStatus",
  protect,
  requireRole("ADMIN", "SELLER"),
  validate(transactionStatusSchema),
  TransactionController.getStatus
);

router.get(
  "/user/:userId",

  // Authentication
  protect,

  // Validation
  validate(userTransactionsQuerySchema),

  async (req, res, next) => {
    console.log("\n========== USER TRANSACTIONS REQUEST ==========");

    try {
      console.log("[ROUTE] Method:", req.method);
      console.log("[ROUTE] URL:", req.originalUrl);
      console.log("[ROUTE] Params:", req.params);
      console.log("[ROUTE] Query:", req.query);

      // Do not log the actual JWT/token.
      console.log("[ROUTE] Authenticated user:", req.user
        ? {
            id: req.user.id,
            userId: req.user.userId,
            role: req.user.role,
            email: req.user.email,
          }
        : "NO req.user"
      );

      console.log(
        "[ROUTE] Controller exists:",
        typeof TransactionController.listSellerTransactions === "function"
      );

      if (
        typeof TransactionController.listSellerTransactions !== "function"
      ) {
        console.error(
          "[ROUTE ERROR] TransactionController.listSellerTransactions is not available"
        );

        return res.status(501).json({
          success: false,
          error: "User transaction listing is not available yet.",
        });
      }

      console.log("[ROUTE] Calling listSellerTransactions...");

      return await TransactionController.listSellerTransactions(
        req,
        res,
        next
      );
    } catch (error) {
      console.error("\n========== USER TRANSACTIONS ROUTE ERROR ==========");
      console.error("[ROUTE ERROR] Message:", error.message);
      console.error("[ROUTE ERROR] Stack:", error.stack);
      console.error("[ROUTE ERROR] Full error:", error);

      return next(error);
    }
  }
);
export default router;
