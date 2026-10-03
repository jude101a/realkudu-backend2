import crypto from "node:crypto";
import PaymentService from "../services/payment.js";
import {sendNotification} from "../services/notification.service.js";
import pool from "../config/db.js";

class PaymentController {

    async initialize(req, res, next) {

        try {
             console.log("✅ Payment initialize controller reached");

            if (!req.user?.id) {
                return res.status(401).json({
                    success: false,
                    error: "Unauthorized"
                });
            }

            const result = await PaymentService.initialize({

                buyerId: req.user.id,

                propertyId: req.body.propertyId,

                paymentType: req.body.paymentType,

                callbackUrl: req.body.callbackUrl

            });

            return res.status(201).json({

                success: true,

                message: "Payment initialized.",

                data: result

            });

        } catch (err) {

            next(err);

        }

    }

    async verify(req, res, next) {
    try {
        console.log(
            "✅ Payment verify controller reached:",
            req.params.reference
        );

        const transaction =
            await PaymentService.verify(
                req.params.reference
            );

        return res.json({
            success: true,
            data: transaction
        });

    } catch (err) {
        console.error(
            "❌ Payment verification failed:",
            err.message
        );

        next(err);
    }
}
    async history(req, res, next) {

        try {
            if (!req.user?.id) {
                return res.status(401).json({
                    success: false,
                    error: "Unauthorized"
                });
            }

            const history =

                await PaymentService.buyerHistory(

                    req.user.id

                );

            return res.json({

                success: true,

                data: history

            });

        } catch (err) {

            next(err);

        }

    }

    async transaction(req, res, next) {

        try {

            const transaction =

                await PaymentService.getTransaction(

                    req.params.reference

                );

            return res.json({

                success: true,

                data: transaction

            });

        } catch (err) {

            next(err);

        }

    }


    async webhook(req, res) {
    try {
        const secretKey = process.env.PAYSTACK_SECRET_KEY;

        const signature =
            req.headers["x-paystack-signature"];

        console.log("====================================");
        console.log("🔥 PAYSTACK WEBHOOK RECEIVED");
        console.log("Signature:", signature);
        console.log(
            "Raw body exists:",
            !!req.rawBody
        );
        console.log(
            "Raw body is Buffer:",
            Buffer.isBuffer(req.rawBody)
        );
        console.log("====================================");

        if (!secretKey) {
            console.error(
                "❌ PAYSTACK_SECRET_KEY is not configured"
            );

            return res
                .status(500)
                .send("Server configuration error");
        }

        if (!req.rawBody) {
            console.error(
                "❌ Raw request body is missing"
            );

            return res
                .status(400)
                .send("Raw body missing");
        }

        /**
         * Verify Paystack signature
         */
        const hash = crypto
            .createHmac("sha512", secretKey)
            .update(req.rawBody)
            .digest("hex");

        if (hash !== signature) {
            console.warn(
                "⚠️ Invalid Paystack webhook signature"
            );

            return res
                .status(401)
                .send("Invalid signature");
        }

        console.log(
            "✅ Paystack webhook signature verified"
        );

        /**
         * express.json() has already parsed this
         * into an object.
         */
        const event = req.body;

        console.log(
            "🔥 PAYSTACK EVENT:",
            event.event
        );

        console.log(
            "🔥 PAYSTACK REFERENCE:",
            event.data?.reference
        );

        console.log(
            "🔥 PAYSTACK STATUS:",
            event.data?.status
        );

        /**
         * Acknowledge Paystack immediately.
         */
        res.status(200).send("OK");

        /**
         * Process event asynchronously.
         */
        try {

            await PaymentService.handleWebhookEvent(
                event
            );

            console.log(
                "✅ Webhook business logic completed"
            );

        } catch (error) {

            console.error(
                "❌ Webhook business logic failed:",
                error
            );
        }

    } catch (err) {

        console.error(
            "❌ Webhook processing error:",
            err
        );

        if (!res.headersSent) {
            return res
                .status(500)
                .send("Webhook processing error");
        }
    }
}
    async refund(req, res, next) {

        try {

            const result =

                await PaymentService.refund(

                    req.body.reference,

                    req.body.amount

                );

            return res.json({

                success: true,

                data: result

            });

        } catch (err) {

            next(err);

        }

    }

    async createTransferRecipient(req, res, next) {

        try {

            const result =

                await PaymentService.createTransferRecipient({

                    name: req.body.name,

                    accountNumber: req.body.accountNumber,

                    bankCode: req.body.bankCode

                });

            return res.json({

                success: true,

                data: result

            });

        } catch (err) {

            next(err);

        }

    }

}

export default new PaymentController();