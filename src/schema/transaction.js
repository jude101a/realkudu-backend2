const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({

    reference: {

        type: String,

        required: true,

        unique: true,

        index: true

    },

    paymentType: {

        type: String,

        enum: [

            "BOOKING",

            "BALANCE",

            "PROPERTY_PURCHASE",

            "RENT",

            "SUBSCRIPTION",

            "INSPECTION"

        ],

        required: true

    },

    property: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "Property"

    },

    buyer: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "User"

    },

    seller: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "User"

    },

    agent: {

        type: mongoose.Schema.Types.ObjectId,

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

    gateway: {

        type: String,

        default: "PAYSTACK"

    },

    gatewayReference: String,

    authorizationUrl: String,

    accessCode: String,

    status: {

        type: String,

        enum: [

            "PENDING",

            "INITIALIZED",

            "PROCESSING",

            "SUCCESS",

            "FAILED",

            "CANCELLED",

            "REFUNDED",

            "EXPIRED"

        ],

        default: "PENDING"

    },

    gatewayResponse: {

        type: Object,

        default: {}

    }

}, {

    timestamps: true

});

module.exports = mongoose.model("Transaction", transactionSchema);