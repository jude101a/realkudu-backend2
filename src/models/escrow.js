import { Schema, model } from "mongoose";

const escrowSchema = new Schema({

    property: {

        type: Schema.Types.ObjectId,

        ref: "Property",

        required: true,

        index: true

    },

    transaction: {

        type: Schema.Types.ObjectId,

        ref: "Transaction",

        required: true,

        unique: true

    },

    buyer: {

        type: Schema.Types.ObjectId,

        ref: "User",

        required: true

    },

    seller: {

        type: Schema.Types.ObjectId,

        ref: "User",

        required: true

    },

    agent: {

        type: Schema.Types.ObjectId,

        ref: "User"

    },

    amount: {

        type: Number,

        required: true

    },

    currency: {

        type: String,

        default: "NGN"

    },

    status: {

        type: String,

        enum: [

            "CREATED",

            "BOOKED",

            "INSPECTION_PENDING",

            "INSPECTION_COMPLETED",

            "DOCUMENTS_PENDING",

            "DOCUMENTS_APPROVED",

            "BUYER_APPROVED",

            "READY_FOR_RELEASE",

            "RELEASED",

            "REFUNDED",

            "CANCELLED",

            "DISPUTED"

        ],

        default: "CREATED"

    },

    inspectionDate: Date,

    releasedAt: Date,

    cancelledAt: Date,

    refundedAt: Date,

    disputeReason: String,

    metadata: {

        type: Object,

        default: {}

    }

}, {

    timestamps: true

});

export default
    model(
    "Escrow",
    escrowSchema
);