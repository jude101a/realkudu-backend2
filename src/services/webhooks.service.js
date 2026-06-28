import mongoose from "mongoose";
import TransactionRepository from "../repositories/transaction.repositories.js";
import PaymentService from "./payment.js";
import logger from "../config/logger.js";

class WebhookService {
    async process(event) {
        switch (event.event) {
            case "charge.success":
                return await this.chargeSuccess(event);
            case "transfer.success":
                return await this.transferSuccess(event);
            case "refund.processed":
                return await this.refundProcessed(event);
            default:
                logger.info({
                    event: event.event,
                    ignored: true
                });
        }
    }

    async chargeSuccess(event) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const gateway = event.data;
            const reference = gateway.reference;
            const transaction = await transactionRepository.findByReference(reference);

            if (!transaction) {
                throw new Error("Transaction not found.");
            }

            if (transaction.status === "SUCCESS") {
                await session.commitTransaction();
                session.endSession();
                return;
            }

            await paymentService.verify(reference);
            await transactionRepository.markSuccessful(reference, gateway);
            await this.afterPaymentSuccess(transaction);

            await session.commitTransaction();
            session.endSession();
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            throw err;
        }
    }

   async afterPaymentSuccess(
transaction
){

switch(

transaction.paymentType

){

case "BOOKING":

await this.handleBooking(
transaction
);

break;

case "BALANCE":

await this.handleBalance(
transaction
);

break;

case "PROPERTY_PURCHASE":

await this.handlePurchase(
transaction
);

break;

case "RENT":

await this.handleRent(
transaction
);

break;

}

}

    async handleBooking(transaction) {

    const session = await mongoose.startSession();

    session.startTransaction();

    try {

        /**
         * Reserve Property
         */

        await propertyService.reserveProperty(

            transaction.property,

            transaction.buyer,

            session

        );

        /**
         * Create Booking
         */

        const booking = await bookingService.createFromTransaction(

            transaction,

            session

        );

        /**
         * Create Escrow
         */

        const escrow = await escrowService.createFromTransaction(

            transaction,

            booking,

            session

        );

        /**
         * Ledger Entry
         */

        await ledgerService.recordBookingPayment(

            transaction,

            session

        );

        /**
         * Receipt
         */

        await receiptService.queueReceipt(

            transaction._id

        );

        /**
         * Notifications
         */

        await notificationService.bookingPaid({

            booking,

            buyer: transaction.buyer,

            seller: transaction.seller,

            agent: transaction.agent

        });

        /**
         * Socket Events
         */

        socketService.emitBookingPaid({

            bookingId: booking._id,

            propertyId: transaction.property

        });

        await session.commitTransaction();

    } catch (err) {

        await session.abortTransaction();

        throw err;

    } finally {

        session.endSession();

    }

}
    async handleBalance(transaction) {

    const session = await mongoose.startSession();

    session.startTransaction();

    try {

        const booking = await bookingService.findByProperty(

            transaction.property

        );

        if (!booking)

            throw new Error("Booking not found.");

        /**
         * Mark balance paid
         */

        await bookingService.markBalancePaid(

            booking._id,

            session

        );

        /**
         * Update Escrow
         */

        await escrowService.balanceReceived(

            booking._id,

            transaction,

            session

        );

        /**
         * Ledger
         */

        await ledgerService.recordBalancePayment(

            transaction,

            session

        );

        /**
         * Receipt
         */

        await receiptService.queueReceipt(

            transaction._id

        );

        /**
         * Notify Everyone
         */

        await notificationService.balancePaid(

            booking

        );

        socketService.emitBalancePaid(

            booking._id

        );

        await session.commitTransaction();

    }

    catch(err){

        await session.abortTransaction();

        throw err;

    }

    finally{

        session.endSession();

    }

}

    async handlePurchase(transaction) {

    const session = await mongoose.startSession();

    session.startTransaction();

    try {

        await propertyService.reserveProperty(

            transaction.property,

            transaction.buyer,

            session

        );

        const booking = await bookingService.createInstantPurchase(

            transaction,

            session

        );

        const escrow = await escrowService.createFromTransaction(

            transaction,

            booking,

            session

        );

        await ledgerService.recordPurchase(

            transaction,

            session

        );

        await receiptService.queueReceipt(

            transaction._id

        );

        await notificationService.propertyPurchased(

            booking

        );

        socketService.emitPurchase(

            booking._id

        );

        await session.commitTransaction();

    }

    catch(err){

        await session.abortTransaction();

        throw err;

    }

    finally{

        session.endSession();

    }

}

    async handleRent(transaction) {

    const session = await mongoose.startSession();

    session.startTransaction();

    try {

        const tenancy = await bookingService.createTenancy(

            transaction,

            session

        );

        await ledgerService.recordRent(

            transaction,

            session

        );

        await receiptService.queueReceipt(

            transaction._id

        );

        await notificationService.rentPaid(

            tenancy

        );

        socketService.emitRentPaid(

            tenancy._id

        );

        await session.commitTransaction();

    }

    catch(err){

        await session.abortTransaction();

        throw err;

    }

    finally{

        session.endSession();

    }

}

    async transferSuccess(event) {

    const transfer = event.data;

    await transferService.markSuccessful(

        transfer.reference,

        transfer

    );

    await escrowService.release(

        transfer.reference

    );

    await notificationService.transferCompleted(

        transfer.reference

    );

    socketService.emitTransferSuccess(

        transfer.reference

    );

}

    async refundProcessed(event) {

    const refund = event.data;

    await paymentService.markRefunded(

        refund.transaction_reference

    );

    await bookingService.cancelBooking(

        refund.transaction_reference

    );

    await propertyService.makeAvailable(

        refund.metadata.propertyId

    );

    await notificationService.refundProcessed(

        refund.transaction_reference

    );

    socketService.emitRefund(

        refund.transaction_reference

    );

}
}

export { WebhookService};