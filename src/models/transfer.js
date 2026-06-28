const mongoose = require("mongoose");

const transferSchema = new mongoose.Schema({

    escrow: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Escrow",
        required: true
    },

    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    recipientCode: {
        type: String,
        required: true
    },

    amount: {
        type: Number,
        required: true
    },

    platformFee: {
        type: Number,
        default: 0
    },

    agentCommission: {
        type: Number,
        default: 0
    },

    payoutAmount: {
        type: Number,
        required: true
    },

    transferCode: String,

    reference: {
        type: String,
        unique: true,
        required: true
    },

    status: {

        type: String,

        enum: [

            "PENDING",

            "PROCESSING",

            "SUCCESS",

            "FAILED",

            "REVERSED"

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

module.exports =
mongoose.model(
    "Transfer",
    transferSchema
);