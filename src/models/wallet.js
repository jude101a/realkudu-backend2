import { Schema, model } from "mongoose";

const walletSchema = new Schema({

    owner: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },

    ownerType: {

        type: String,

        enum: [

            "BUYER",

            "SELLER",

            "AGENT",

            "PLATFORM",

            "ESCROW"

        ]

    },

    balance: {

        type: Number,

        default: 0

    },

    currency: {

        type: String,

        default: "NGN"

    },

    frozenBalance: {

        type: Number,

        default: 0

    }

}, {

    timestamps: true

});

export default
    model(
    "Wallet",
    walletSchema
);