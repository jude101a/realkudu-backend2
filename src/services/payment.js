import paystack from "../utils/paystack.js";
import TransactionRepository from "../repositories/transaction.repositories.js";

import PropertyModel from "../models/property.model.js";
import { findUserById } from "../models/user.models.js";
import SellerModel from "../models/seller.model.js";
import OrderModel from "../models/order.model.js";

import { generateReference } from "../utils/reference.js";

import logger from "../config/logger.js";
import { sendNotification } from "../services/notification.service.js";
import EscrowService from "./escrow.service.js";
import TenantModel from "../models/tenant.model.js";
import pool from "../config/db.js";
import PurchaseProcessStepModel from "../models/purchase.process.model.js";

const info = logger.info.bind(logger);
const _findById = findUserById;
const create = TransactionRepository.create.bind(TransactionRepository);
const initializeTransaction = paystack.initializeTransaction.bind(paystack);

class PaymentService {

    /**
     * ====================================
     * SERVER SIDE PRICE CALCULATION
     * =====================================
     */

    async calculateAmount(propertyId, paymentType, isProtected = false, purchaseQuantity) {

        const property = await PropertyModel.findById(propertyId);
const toNum = (v) => Number(v?? 0) || 0;
const tenantMeta = await TenantModel.getTenantMetaByProperty(propertyId);
const isTenant = property?.tenant_id == tenantMeta?.tenant_id ?? false;

const price =
  (toNum(property.price?? property.asking_price?? property.askingPrice) * purchaseQuantity) +
  (toNum(property.booking_fee)) +
  (toNum(property.statutory_fee) * purchaseQuantity) +
  (toNum(property.development_fee) * purchaseQuantity) +
  (toNum(property.survey_fee) * purchaseQuantity) +
  (toNum(property.legal_fee) * purchaseQuantity) +
  (toNum(property.documentation_fee) * purchaseQuantity) +
  (toNum(property.agency_fee) * purchaseQuantity) +
  toNum(property.other_fees) +
  toNum(property.caution_fee);

  const bookingFee =
  toNum(property.booking_fee) +
1000;

        if (!property)
            throw new Error("Property not found.");

        const rentPrice = Number(property.price);
        console.log("✅ Payment calculateAmount service reached", { propertyId, paymentType, bookingFee, price, rentPrice, property });

        switch (paymentType) {

            case "BOOKING":

                if (!bookingFee)
                    throw new Error("Booking fee not configured.");

                return {

                    amount: bookingFee,

                    property

                };
            case "booking":

                if (!bookingFee)
                    throw new Error("Booking fee not configured.");
                return {

                    amount: bookingFee,
                    property
                }

            case "BALANCE":

                return {

                    amount: price - bookingFee,

                    property

                };
            case "balance":

                return {

                    amount: price - bookingFee,

                    property

                };
            case "PROPERTY_PURCHASE":

                return {

                    amount:  price,

                    property

                };
            case "PROPERTY_PURCHASE":
                return {

                    amount:  price,

                    property

                };
            case "property_purchase":
                return {

                    amount:  price,

                    property

                };
            case "RENT":

                return {

                    amount: isTenant ? rentPrice : price,

                    property

                };
            case "rent":
                return {

                    amount: isTenant ? rentPrice :  price,

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
        purchaseQuantity,
        isProtected,

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

            paymentType,
            isProtected,
            purchaseQuantity

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
            purchaseQuantity,

            buyerId: buyer.id ?? buyer._id,

            sellerId: property.seller_id ?? property.sellerId ,

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

                paymentType: paymentType,
                sellerId: property.seller_id ?? property.sellerId,
                agentId: property.agent_id ?? property.agentId ?? property.agent,
                purchaseQuantity: purchaseQuantity,
                lawyerId: property.lawyer_id, 


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



if (!verification) {
    throw new Error(
        "No verification response was returned from Paystack."
    );
}

if (!verification.status) {
    throw new Error(
        verification.message ||
        "Payment verification failed."
    );
}

        const gateway = verification;


        /**
         * Verify amount
         */
        if (

            Number(gateway.data.amount) !==

            ((Number(transaction.amount)* 100 +  Number(gateway.data.fees)))

        ) {

            throw new Error(

                "Amount mismatch."

            );

        }

        /**
         * Verify Currency
         */

        if (

            gateway.data.currency !==

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

            gateway.data.reference !==

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

            gateway.data.status === "success"

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

            payload.requested_amount = amount * 100;

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

    normalizeSeller(sellerResult) {
        if (!sellerResult) return null;
        if (sellerResult.rows && Array.isArray(sellerResult.rows)) {
            return sellerResult.rows[0] ?? null;
        }
        return sellerResult;
    }

    normalizePropertyType(value) {
        return String(value ?? "").trim().toLowerCase();
    }

    async createPropertyPurchaseOrder({ property, buyer, seller, paidTransaction, data }) {
        const propertyId = property?.property_id ?? property?.id ?? property?.propertyId;
        const buyerId = buyer?.id ?? buyer?._id;
        const sellerId = seller?.id ?? seller?.user_id ?? seller?.userId ?? property?.seller_id ?? property?.sellerId;
        const propertyType = this.normalizePropertyType(
            data?.propertyType ?? property?.property_type ?? property?.propertyType ?? "unknown"
        );
        const amount = Number(paidTransaction?.amount ?? data?.amount ?? 0);
        const reference = paidTransaction?.reference ?? data?.reference;

        if (!propertyId || !buyerId || !sellerId) {
            return null;
        }

        const existingOrders = await OrderModel.findByPropertyId(propertyId);
        const existingOrder = existingOrders.find((order) =>
            String(order.buyer_id ?? order.buyerId) === String(buyerId)
        );

        if (existingOrder) {
            const result = await OrderModel.advanceStep(existingOrder.order_id, "payment_received", {
                reference,
                amount,
                paymentType: data?.paymentType ?? paidTransaction?.payment_type ?? "PROPERTY_PURCHASE",
            });
            return result?.order ?? result ?? null;
        }

        const result = await OrderModel.create(
            {
                buyerId,
                sellerId,
                propertyId,
                propertyType,
                status: "paid",
                paymentType: String(data?.paymentType ?? paidTransaction?.payment_type ?? "PROPERTY_PURCHASE").toUpperCase(),
                bookingFee: 0,
                agreedAmount: amount,
                amountPaid: amount,
                currency: paidTransaction?.currency ?? "NGN",
                inspectionRequired: true,
                inspectionCompleted: false,
                dueDiligenceCompleted: false,
                agreementSigned: false,
                governmentConsentRequired: true,
                notes: `Payment received for ${property?.name ?? "property"} via Paystack.`,
                purchaseStep: "payment_received",
                funnelStep: "payment_received",
                version: 0,
            },
            {
                step: "payment_received",
                reference,
                amount,
            }
        );

        return result?.order ?? result ?? null;
    }

    async notifyStakeholders({ property, buyer, seller, paidTransaction, data }) {
        const propertyName = property?.name ?? property?.title ?? "this property";
        const buyerId = buyer?.id ?? buyer?._id;
        const sellerUserId = seller?.user_id ?? seller?.userId ?? seller?.id;
        const buyerEmail = buyer?.email ?? null;
        const sellerEmail = seller?.business_email ?? seller?.email ?? null;
        const reference = paidTransaction?.reference ?? data?.reference;

        if (buyerId) {
            await sendNotification({
                title: "Payment Successful",
                body: `Your payment for ${propertyName} has been received successfully. Reference: ${reference}. Find the details in your transaction history.`,
                channels: ["EMAIL", "PUSH"],
                data: {
                    reference,
                    property,
                    transaction: paidTransaction,
                    buyer,
                    seller,
                },
                email: buyerEmail,
                jobName: "sendPaymentEmail",
                userName: buyer?.first_name ?? buyer?.name ?? "Buyer",
                userId: buyerId,
            });
        }

        if (sellerUserId) {
            await sendNotification({
                title: "Payment Received",
                body: `A payment for ${propertyName} has been received. Reference: ${reference}. Find the details in your transaction history.`,
                channels: ["EMAIL", "PUSH"],
                data: {
                    reference,
                    property,
                    transaction: paidTransaction,
                    buyer,
                    seller,
                },
                email: sellerEmail,
                jobName: "sendPaymentEmail",
                userName: seller?.business_name ?? seller?.name ?? "Seller",
                userId: sellerUserId,
            });
        }
    }

    async settleSellerPayout({ escrow, paidTransaction = {}, sellerId = null } = {}) {
        if (!escrow?.id) {
            return null;
        }

        const normalizedSellerId = sellerId ?? paidTransaction?.seller_id ?? escrow?.seller_id ?? escrow?.seller?.id ?? escrow?.seller?.user_id ?? null;
        const transactionAmount = Number(
            paidTransaction?.amount ?? paidTransaction?.total_amount ?? escrow?.transaction?.amount ?? escrow?.amount ?? 0
        );

        if (!normalizedSellerId || transactionAmount <= 0) {
            info({
                event: "SELLER_PAYOUT_SKIPPED",
                escrowId: escrow.id,
                reason: !normalizedSellerId ? "missing_seller" : "zero_amount",
            });
            return escrow;
        }

        const status = String(escrow.status ?? "").toUpperCase();

        if (status === "PENDING") {
            await EscrowService.markHeld(escrow.id);
         const sellerAccount =   await pool.query(
                `UPDATE finance_accounts SET pending_balance = pending_balance + $1 AND wallet_balance = wallet_balance + $1 WHERE user_id = $2
                RETURNING *`,
                [transactionAmount, normalizedSellerId]
                
            );
            const balanceBefore = Number(sellerAccount?.rows?.[0]?.available_balance ?? 0);
            const balanceAfter = balanceBefore + Number(transactionAmount);

            await pool.query(
                `INSERT INTO wallet_ledger (seller_id, entry_type, direction, amount, balance_after, currency, reference, description,balance_before) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [normalizedSellerId, "CREDIT", "PENDING", transactionAmount, balanceAfter, paidTransaction?.currency ?? "NGN", paidTransaction?.reference ?? null, `Funds held in escrow for transaction ${paidTransaction?.reference ?? null}`, balanceBefore]
            );


        }
        


        info({
            event: "SELLER_PAYOUT_INITIATED",
            reference: paidTransaction?.reference ?? null,
            escrowId: escrow.id,
            amount: transactionAmount,
        });

        return releasedEscrow ?? escrow;
    }



    async handleWebhookEvent(event) {

        const { event: eventType, data = {} } = event ?? {};
        const sellerId = data?.metadata?.sellerId ?? data?.sellerId ?? null;
        const buyerId = data?.metadata?.buyerId ?? data?.buyerId ?? null;
        const propertyId = data?.metadata?.propertyId ?? data?.propertyId ?? null;
        const currentTransaction = transaction ?? (data?.reference ? await TransactionRepository.findByReference(data.reference) : null);

        const seller = sellerId ? this.normalizeSeller(await SellerModel.findById(sellerId)) : null;
        const buyer = buyerId ? await findUserById(buyerId) : null;
        const agentId = data?.metadata.agentId;
        const lawyerId = data?.metadata.lawyerId;
        const transactionCurrency = currentTransaction.currency;
        const paymentType = String(
                    data?.paymentType ?? data?.metadata?.paymentType ?? paidTransaction?.payment_type ?? "PROPERTY_PURCHASE"
                ).toUpperCase();
                const propertyType = this.normalizePropertyType(
                    data?.propertyType ?? property?.property_type ?? property?.propertyType ?? "unknown"
                );

        const purchaseQuantity = data?.metadata.purchaseQuantity?? 1;
        const property = propertyId ? await PropertyModel.findById(propertyId) : null;
        const transaction = data?.reference ? await TransactionRepository.findByReference(data.reference) : null;

        info({ event: "WEBHOOK_RECEIVED", type: eventType, reference: data?.reference });

        switch (eventType) {

            case "charge.success": {


                if (!currentTransaction) {
                    info({ event: "WEBHOOK_UNKNOWN_REFERENCE", reference: data.reference });
                    return;
                }

                if (currentTransaction.status === "SUCCESS") {
                    info({ event: "WEBHOOK_ALREADY_PROCESSED", reference: data.reference });
                    return;
                }

                const expectedKobo = Number(data?.requested_amount ?? data?.amount ?? 0);
                const amountMatches = expectedKobo === Number(currentTransaction.amount ?? 0) * 100;
// logs amount mismatch
                if (!amountMatches) {
                    info({ event: "WEBHOOK_AMOUNT_MISMATCH", reference: data.reference });
                    await TransactionRepository.markFailed(data.reference, data);
                    await TransactionRepository.recordFailureReason(data.reference, "Amount mismatch");
                    await PaymentService.refund(data.reference, currentTransaction.amount);
                    if (property && buyer) {
                        await sendNotification({
                            title: "Payment Failed",
                            body: `Your payment for ${property.name ?? "this property"} failed due to an amount mismatch. Reference: ${data.reference}. Please contact support.`,
                            channels: ["EMAIL", "PUSH"],
                            data: { reference: data.reference, property, transaction: currentTransaction },
                            email: buyer.email,
                            jobName: "sendPaymentEmail",
                            userName: buyer.first_name ?? buyer.name ?? "Buyer",
                            userId: buyer.id ?? buyer._id,
                        });
                    }
                    return;
                }

                const successfulTransaction = await TransactionRepository.markSuccessful(data.reference, data);

                info({ event: "PAYMENT_SUCCESS_WEBHOOK", reference: data.reference });

                const paidTransaction = successfulTransaction ?? currentTransaction;
                const transactionId = paidTransaction.id ?? paidTransaction.transaction_id;
                let escrow = transactionId
                    ? await EscrowService.findByTransaction(transactionId)
                    : null;

                if (!escrow) {
                    escrow = await EscrowService.createFromTransaction(paidTransaction);
                }
                const { order, step } =
      

                info({
                    event: "ESCROW_CREATED_AFTER_PAYMENT",
                    reference: data.reference,
                    escrowId: escrow?.id,
                });

                await this.settleSellerPayout({
                    escrow,
                    paidTransaction,
                    sellerId: seller?.id ?? seller?.user_id ?? seller?.userId ?? null,
                });

                
                if (paymentType === "PROPERTY_PURCHASE") {

                    await OrderModel.create(
        {
          buyerId,

          sellerId,

          agentId,
          lawyerId,

          propertyId,

          quantity: purchaseQuantity ,

          propertyType:
            propertyType,

          status: "pending",

          paymentType,

          bookingFee: property.booking_fee,

          agreedAmount:
            Number(property?.price),

          amountPaid:
            Number(currentTransaction.amount),

          transactionCurrency,

          inspectionRequired : false,

          inspectionCompleted: false,

          dueDiligenceCompleted: false,

          agreementSigned: false,

          governmentConsentRequired : false,

          notes,

          purchaseStep: "Property payment",

          funnelStep: "payment",

          docsVerified: false,
        },

        {
          propertyId,

          quantity: Number(data?.metadata.purchaseQuantity),

          bookingFee: Number(property.booking_fee),

          agreedAmount:
            Number(currentTransaction.amount),

          buyerId,

          sellerId,
        }
      );

                    if (propertyType === "house") {
                        if (property) {
                            
                            await PropertyModel.update(property.id ?? property.property_id, {
                                status: property.is_estate ? "available" : "unavailable",
                                soldOut: property.is_estate ? false : true,
                                soldAt: property.is_estate ? null : new Date(),
                                buyerId: property.is_estate ? null : buyer?.id ?? buyer?._id ?? null,
                            });

                            await PurchaseProcessStepModel.create(

                            )
                        }
                    } else if (propertyType === "land") {
                        if (property) {
                            const availableQuantity = Number(property.available_quantity ?? property.availableQuantity ?? 0);
                            const purchaseQuantity = Number(data?.purchase_quantity ?? data?.purchaseQuantity ?? 1);
                            const updatedQuantity = Math.max(availableQuantity - purchaseQuantity, 0);
                            await PropertyModel.update(property.id ?? property.property_id, {
                                availableQuantity: updatedQuantity,
                                soldOut: updatedQuantity <= 0.5,
                                soldAt: updatedQuantity <= 0.5 ? new Date() : null,
                            });
                        }
                    } else if (propertyType === "apartment") {
                        if (property) {
                            await PropertyModel.update(property.id ?? property.property_id, {
                                status: "unavailable",
                                soldOut: true,
                                soldAt: new Date(),
                                buyerId: buyer?.id ?? buyer?._id ?? null,
                            });
                            const tenantMeta = TenantModel.getTenantMetaByProperty(property.id ?? property.property_id);
                            if (!tenantMeta) {
                            
                            await TenantModel.createTenantMeta({
                                property_id: property.id ?? property.property_id,
                                tenant_id: buyer?.id ?? buyer?._id ?? null,
                                property_type: "apartment",
                                rent_amount: Number(property.price  ?? 0),
                                rent_currency: String( property.currency ??  "NGN").toUpperCase(),
                                rent_frequency: String( property.payment_duration ??  "yearly").toLowerCase(),
                                tenancy_start_date: data?.tenancyStartDate ?? data?.tenancy_start_date ?? new Date(),
                                tenancy_end_date: data?.tenancyEndDate ?? data?.tenancy_end_date ?? null,
                                next_due_date: new Date(new Date().setMonth(new Date().getMonth() + 12)), // next month
                                tenancy_status: "active",
                                is_active_tenant: true,
                                has_paid_current_rent: true,
                                notice_served: false,
                            });
                            }
                        }
                    }

                    await this.createPropertyPurchaseOrder({
                        property,
                        buyer,
                        seller,
                        paidTransaction,
                        data,
                    });
                }
                if (paymentType === "BOOKING"){
                const order =    await OrderModel.create(
        {
          buyerId,

          sellerId,

          agentId,
          lawyerId,

          propertyId,

          quantity: purchaseQuantity ,

          propertyType:
            propertyType,

          status: "pending",

          paymentType,

          bookingFee: property.booking_fee,

          agreedAmount:
            Number(property?.price),

          amountPaid:
            null,

          transactionCurrency,

          inspectionRequired : true,

          inspectionCompleted: false,

          dueDiligenceCompleted: false,

          agreementSigned: false,

          governmentConsentRequired : false,

          notes,

          purchaseStep: "Property booking",

          funnelStep: "booked",

          docsVerified: false,
        },

        {
          propertyId,

          quantity: Number(data?.metadata.purchaseQuantity),

          bookingFee: Number(property.booking_fee),

          agreedAmount:
            Number(property.price),

          buyerId,

          sellerId,
        }
      );
                }

                await this.notifyStakeholders({
                    property,
                    buyer,
                    seller,
                    paidTransaction,
                    data,
                });

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

                info({ event: "TRANSFER_WEBHOOK", type: eventType, reference: data.reference });
                break;

            }

            default:
                info({ event: "WEBHOOK_UNHANDLED_EVENT", type: eventType });
        }

    }
}

export default new PaymentService();
