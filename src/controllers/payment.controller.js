import PaymentService from "../services/payment.js";

class PaymentController {

    async initialize(req, res, next) {

        try {

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

                await _createTransferRecipient({

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