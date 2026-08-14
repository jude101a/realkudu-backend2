import paystack from "../utils/paystack.js";
import TransactionRepository from "../repositories/transaction.repositories.js";

import PropertyModel from "../models/property.model.js";
import { findUserById } from "../models/user.models.js";

import { generateReference } from "../utils/reference.js";

import logger from "../config/logger.js";

const info = logger.info.bind(logger);
const _findById = findUserById;
const create = TransactionRepository.create.bind(TransactionRepository);
const initializeTransaction = paystack.initializeTransaction.bind(paystack);

class PaymentService {

    /**
     * =====================================
     * SERVER SIDE PRICE CALCULATION
     * =====================================
     */

    async calculateAmount(propertyId, paymentType) {

        const property = await PropertyModel.findById(propertyId);

        if (!property)
            throw new Error("Property not found.");

        const bookingFee = Number(property.booking_fee ?? property.bookingFee ?? 0);
        const price = Number(property.price ?? property.asking_price ?? property.askingPrice ?? 0);
        const rentPrice = Number(property.rent_price ?? property.rentPrice ?? 0);

        switch (paymentType) {

            case "BOOKING":

                if (!bookingFee)
                    throw new Error("Booking fee not configured.");

                return {

                    amount: bookingFee,

                    property

                };

            case "BALANCE":

                return {

                    amount: price - bookingFee,

                    property

                };

            case "PROPERTY_PURCHASE":

                return {

                    amount: price,

                    property

                };

            case "RENT":

                return {

                    amount: rentPrice,

                    property

                };

            default:

                throw new Error("Invalid payment type.");

        }

    }

    /**
     * =====================================
     * INITIALIZE PAYMENT
     * =====================================
     */

    async initialize({

        buyerId,

        propertyId,

        paymentType,

        callbackUrl

    }) {

        /**
         * Never trust Flutter.
         * Calculate everything here.
         */

        const {

            amount,

            property

        } = await this.calculateAmount(

            propertyId,

            paymentType

        );

        const buyer = await _findById(buyerId);

        if (!buyer)
            throw new Error("Buyer not found.");

        const reference = generateReference();

        /**
         * Save transaction BEFORE contacting Paystack
         */

        await create({

            reference,

            paymentType,

            buyerId: buyer.id ?? buyer._id,

            sellerId: property.seller_id ?? property.sellerId ?? property.seller,

            agentId: property.agent_id ?? property.agentId ?? property.agent,

            propertyId: property.property_id ?? property.propertyId ?? property.id,

            amount,

            currency: "NGN",

            status: "PENDING"

        });

        /**
         * Convert to Kobo
         */

        const amountInKobo = amount * 100;

        /**
         * Call Paystack
         */

        const response = await initializeTransaction({

            email: buyer.email,

            amount: amountInKobo,

            reference,

            callback_url: callbackUrl,

            metadata: {

                buyerId: buyer.id ?? buyer._id,

                propertyId: property.property_id ?? property.propertyId ?? property.id,

                paymentType

            }

        });

        if (!response.status) {

            throw new Error(

                response.message ||

                "Unable to initialize payment."

            );

        }

        /**
         * Save gateway response
         */

        const transaction =

            await TransactionRepository.saveInitialization(

                reference,

                response.data

            );

        info({

            event: "PAYMENT_INITIALIZED",

            reference,

            amount

        });

        return {

            authorizationUrl:

                response.data.authorization_url,

            accessCode:

                response.data.access_code,

            reference,

            transaction

        };

    }

    /**
     * =====================================
     * VERIFY PAYMENT
     * =====================================
     */

    async verify(reference) {

        const transaction =

            await TransactionRepository.findByReference(reference);

        if (!transaction)
            throw new Error("Transaction not found.");

        /**
         * Already verified?
         */

        if (transaction.status === "SUCCESS") {

            return transaction;

        }

        const verification =

            await TransactionRepository.verifyTransaction(reference);

        if (!verification.status) {

            throw new Error(

                verification.message ||

                "Verification failed."

            );

        }

        const gateway = verification.data;

        /**
         * Verify amount
         */

        if (

            Number(gateway.amount) !==

            transaction.amount * 100

        ) {

            throw new Error(

                "Amount mismatch."

            );

        }

        /**
         * Verify Currency
         */

        if (

            gateway.currency !==

            transaction.currency

        ) {

            throw new Error(

                "Currency mismatch."

            );

        }

        /**
         * Verify reference
         */

        if (

            gateway.reference !==

            transaction.reference

        ) {

            throw new Error(

                "Reference mismatch."

            );

        }

        /**
         * Successful?
         */

        if (

            gateway.status === "success"

        ) {

            await TransactionRepository.markSuccessful(

                reference,

                gateway

            );

            info({

                event: "PAYMENT_SUCCESS",

                reference

            });

            return await TransactionRepository.findByReference(

                reference

            );

        }

        /**
         * Failed
         */

        await TransactionRepository.markFailed(

            reference,

            gateway

        );

        throw new Error(

            "Payment unsuccessful."

        );

    }

        /**
     * =====================================
     * GET TRANSACTION
     * =====================================
     */
    async getTransaction(reference) {

        const transaction =
            await TransactionRepository.findByReference(reference);

        if (!transaction)
            throw new Error("Transaction not found.");

        return transaction;
    }

    /**
     * =====================================
     * BUYER PAYMENT HISTORY
     * =====================================
     */
    async buyerHistory(buyerId) {

        return await TransactionRepository.findBuyerTransactions(
            buyerId
        );

    }

    /**
     * =====================================
     * SELLER PAYMENT HISTORY
     * =====================================
     */
    async sellerHistory(sellerId) {

        return await TransactionRepository.findSellerTransactions(
            sellerId
        );

    }

    /**
     * =====================================
     * AGENT PAYMENT HISTORY
     * =====================================
     */
    async agentHistory(agentId) {

        return await TransactionRepository.findAgentTransactions(
            agentId
        );

    }

    /**
     * =====================================
     * ADMIN PAGINATION
     * =====================================
     */
    async listTransactions(options) {

        return await TransactionRepository.paginate(options);

    }

    /**
     * =====================================
     * CANCEL PAYMENT
     * =====================================
     */
    async cancel(reference) {

        const transaction =
            await TransactionRepository.findByReference(reference);

        if (!transaction)
            throw new Error("Transaction not found.");

        if (transaction.status === "SUCCESS") {

            throw new Error(
                "Successful transactions cannot be cancelled."
            );

        }

        return await TransactionRepository.markCancelled(
            reference
        );

    }

    /**
     * =====================================
     * CREATE TRANSFER RECIPIENT
     * =====================================
     */
    async createTransferRecipient({

        name,

        accountNumber,

        bankCode

    }) {

        const response =
            await paystack.createTransferRecipient({

                type: "nuban",

                name,

                account_number: accountNumber,

                bank_code: bankCode,

                currency: "NGN"

            });

        if (!response.status)

            throw new Error(response.message);

        return response.data;

    }

    /**
     * =====================================
     * PREPARE SELLER PAYOUT
     * =====================================
     */
    async prepareSellerTransfer({

        recipientCode,

        amount,

        reason

    }) {

        return {

            recipient: recipientCode,

            amount: amount * 100,

            reason

        };

    }

    /**
     * =====================================
     * SEND TRANSFER
     * =====================================
     */
    async transferFunds(payload) {

        const response =
            await paystack.initiateTransfer(payload);

        if (!response.status)

            throw new Error(response.message);

        return response.data;

    }

    /**
     * =====================================
     * INITIATE REFUND
     * =====================================
     */
    async refund(reference, amount = null) {

        const transaction =
            await TransactionRepository.findByReference(reference);

        if (!transaction)
            throw new Error("Transaction not found.");

        if (transaction.status !== "SUCCESS")

            throw new Error(
                "Only successful transactions can be refunded."
            );

        const payload = {

            transaction: transaction.gateway_reference ?? transaction.gatewayReference

        };

        if (amount) {

            payload.amount = amount * 100;

        }

        const response =
            await paystack.refund(payload);

        if (!response.status)

            throw new Error(response.message);

        return response.data;

    }

    /**
     * =====================================
     * TODAY'S REVENUE
     * =====================================
     */
    async todayRevenue() {

        return await TransactionRepository.todayRevenue();

    }

    /**
     * =====================================
     * TOTAL REVENUE
     * =====================================
     */
    async totalRevenue() {

        return await TransactionRepository.totalRevenue();

    }

    /**
     * =====================================
     * START DATABASE SESSION
     * =====================================
     */
    async startSession() {

        return null;

    }



    async handleWebhookEvent(event) {

    const { event: eventType, data } = event;

    info({ event: "WEBHOOK_RECEIVED", type: eventType, reference: data?.reference });

    switch (eventType) {

        case "charge.success": {

            const transaction = await TransactionRepository.findByReference(data.reference);

            if (!transaction) {
                info({ event: "WEBHOOK_UNKNOWN_REFERENCE", reference: data.reference });
                return;
            }

            // Idempotency check — don't reprocess if already marked SUCCESS
            if (transaction.status === "SUCCESS") {
                info({ event: "WEBHOOK_ALREADY_PROCESSED", reference: data.reference });
                return;
            }

            // Verify amount matches (defense against tampering)
            if (Number(data.amount) !== Number(transaction.amount) * 100) {
                info({ event: "WEBHOOK_AMOUNT_MISMATCH", reference: data.reference });
                await TransactionRepository.markFailed(data.reference, data);
                return;
            }

            await TransactionRepository.markSuccessful(data.reference, data);

            info({ event: "PAYMENT_SUCCESS_WEBHOOK", reference: data.reference });

            // TODO: trigger post-payment logic here — e.g. create escrow,
            // notify seller, update property status to sold, etc.

            break;
        }

        case "charge.failed": {

            await TransactionRepository.markFailed(data.reference, data);
            info({ event: "PAYMENT_FAILED_WEBHOOK", reference: data.reference });
            break;

        }

        case "transfer.success":
        case "transfer.failed":
        case "transfer.reversed": {

            // Handle transfer webhooks separately if you're paying out sellers
            info({ event: "TRANSFER_WEBHOOK", type: eventType, reference: data.reference });
            break;

        }

        default:
            info({ event: "WEBHOOK_UNHANDLED_EVENT", type: eventType });
    }

}

}

// webhook handler




export default new PaymentService();