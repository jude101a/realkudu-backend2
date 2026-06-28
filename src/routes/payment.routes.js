import { Router } from "express";
const router = Router();

import PaymentController from "../controllers/payment.controller.js";

import validate from "../middlewares/validate.js";

import {protect} from "../middlewares/auth.middleware.js";

import { initializePaymentSchema, refundSchema, transferRecipientSchema } from "../validators/payment.validator.js";

/**
 * Buyer
 */

router.post(

    "/initialize",

    protect,

    validate(initializePaymentSchema),

    PaymentController.initialize

);

router.get(

    "/verify/:reference",

    protect,

    PaymentController.verify

);

router.get(

    "/history",

    protect,

    PaymentController.history

);

router.get(

    "/:reference",

    protect,

    PaymentController.transaction

);

/**
 * Admin
 */

router.post(

    "/refund",

    protect,

    validate(refundSchema),

    PaymentController.refund

);

router.post(

    "/recipient",

    protect,

    validate(transferRecipientSchema),

    PaymentController.createTransferRecipient

);

export default router;