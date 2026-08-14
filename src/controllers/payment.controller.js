import crypto from "node:crypto";
import PaymentService from "../services/payment.js";

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
             console.log("✅ Payment verify controller reached");
            const transaction =

                await PaymentService.verify(

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

        // req.body is a raw Buffer here because of express.raw()
        const hash = crypto
            .createHmac("sha512", secretKey)
            .update(req.body)
            .digest("hex");

        const signature = req.headers["x-paystack-signature"];

        if (hash !== signature) {
            console.warn("⚠️ Invalid Paystack webhook signature");
            return res.status(401).send("Invalid signature");
        }

        // Now safe to parse
        const event = JSON.parse(req.body.toString());

        // Respond 200 immediately — Paystack requires fast ack
        res.status(200).send("OK");

        // Process asynchronously after responding
        await PaymentService.handleWebhookEvent(event);

    } catch (err) {
        console.error("Webhook processing error:", err);
        // Still return 200 if signature was valid but processing failed,
        // so Paystack doesn't endlessly retry — log and fix manually instead
        if (!res.headersSent) {
            res.status(200).send("OK");
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