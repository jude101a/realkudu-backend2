import { Router } from "express";
import { healthCheck } from "../controllers/health.controller.js";
import { openApiSpec, swaggerHtml } from "../docs/openapi.js";
import userRoutes from "./user.routes.js";
import sellerRoutes from "./seller.routes.js";
import estateRoutes from "./estate.routes.js";
import houseRoutes from "./house.routes.js";
import propertyRoutes from "./property.routes.js";
import purchaseProcessRoutes from "./purchase.process.routes.js";
import imagesRoutes from "./utility.routes/images.routes.js";
import notificationRoutes from "./utility.routes/notification.route.js";
import adminRoutes from "./admin.routes.js";
import webhookRoutes from "./webhook.routes.js";
import paymentRoutes from "./payment.routes.js";
import transferRoutes from "./transfer.routes.js";
import walletRoutes from "./wallet.routes.js";
import tenantRoutes from "./tenant.routes.js";
import transactionRoutes from "./transactions.routes.js";

// MVP scope intentionally excludes land-property, apartment, and house-for-sale modules.

const router = Router();

router.get("/health", healthCheck);
router.get("/docs.json", (_req, res) => res.json(openApiSpec));
router.get("/docs", (_req, res) => res.type("html").send(swaggerHtml()));
router.use("/users", userRoutes);
router.use("/sellers", sellerRoutes);
router.use("/estates", estateRoutes);
router.use("/houses", houseRoutes);
router.use("/properties", propertyRoutes);
router.use("/purchase-process", purchaseProcessRoutes);
router.use("/images", imagesRoutes);
router.use("/notifications", notificationRoutes);
router.use("/admin", adminRoutes);

router.use("/payments", paymentRoutes);
router.use("/transfers", transferRoutes);
router.use("/wallet", walletRoutes);
router.use("/tenants", tenantRoutes);
router.use("/transactions", transactionRoutes); // Assuming transferRoutes handles transactions as well

router.use(

    "/api/webhooks",

    webhookRoutes

);

export default router;
