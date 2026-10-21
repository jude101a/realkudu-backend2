import { Router } from "express";
import { createOrder } from "../controllers/order.controller.js";
import {
  confirmAllocation,
  confirmContractSigning,
  confirmDocumentUpload,
  confirmInspection,
  confirmCurrentPurchaseStep,
  getCurrentPurchaseStep,
  getPurchaseProcessByOrderId,
  requestContractSigning,
  requestAllocation,
  requestInspection,
  scheduleInspectionForAllBuyers,
  requestPayment,
} from "../controllers/purchase.process.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  confirmContractSigningSchema,
  confirmDocumentUploadSchema,
  confirmInspectionSchema,
  propertyIdParamSchema,
  requestContractSigningSchema,
  requestInspectionSchema,
  scheduleInspectionSchema,
  requestPaymentSchema,
} from "../validators/purchase.process.validator.js";

const router = Router();

router.use(protect);

router.get("/orders/:orderId/current-step", getCurrentPurchaseStep);
router.patch("/orders/:orderId/current-step/confirm", confirmCurrentPurchaseStep);
router.post("/orders/:orderId/allocation/request", requestAllocation);
router.patch("/orders/:orderId/allocation/confirm", confirmAllocation);

router.get("/orders/:orderId", getPurchaseProcessByOrderId);
router.post(
  "/:propertyId/inspection/schedule-all",
  validate({ params: propertyIdParamSchema, body: scheduleInspectionSchema }),
  scheduleInspectionForAllBuyers
);
router.post(
  "/:propertyId/inspection/request",
  validate({ params: propertyIdParamSchema, body: requestInspectionSchema }),
  requestInspection
);
router.patch(
  "/:propertyId/inspection/confirm",
  validate({ params: propertyIdParamSchema, body: confirmInspectionSchema }),
  confirmInspection
);
router.post(
  "/create-order",
  protect,
  createOrder
);
router.post(
  "/:propertyId/payment/request",
  validate({ params: propertyIdParamSchema, body: requestPaymentSchema }),
  requestPayment
);
router.post(
  "/:propertyId/contract-signing/request",
  validate({ params: propertyIdParamSchema, body: requestContractSigningSchema }),
  requestContractSigning
);
router.patch(
  "/:propertyId/contract-signing/confirm",
  validate({ params: propertyIdParamSchema, body: confirmContractSigningSchema }),
  confirmContractSigning
);
router.patch(
  "/:propertyId/documents/confirm-upload",
  validate({ params: propertyIdParamSchema, body: confirmDocumentUploadSchema }),
  confirmDocumentUpload
);

export default router;
