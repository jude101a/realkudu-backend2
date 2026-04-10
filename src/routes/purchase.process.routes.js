import { Router } from "express";
import {
  confirmContractSigning,
  confirmDocumentUpload,
  confirmInspection,
  getPurchaseProcessByPropertyId,
  requestContractSigning,
  requestInspection,
  requestPayment,
} from "../controllers/purchase.process.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  confirmContractSigningSchema,
  confirmDocumentUploadSchema,
  confirmInspectionSchema,
  propertyIdParamSchema,
  purchaseProcessQuerySchema,
  requestContractSigningSchema,
  requestInspectionSchema,
  requestPaymentSchema,
} from "../validators/purchase.process.validator.js";

const router = Router();

router.use(protect);

router.get(
  "/:propertyId",
  validate({ params: propertyIdParamSchema, query: purchaseProcessQuerySchema }),
  getPurchaseProcessByPropertyId
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
