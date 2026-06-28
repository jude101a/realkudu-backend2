import { Schema, model } from "mongoose";

const ledgerSchema = new Schema({

    reference: {

        type: String,

        required: true,

        index: true

    },

    debitWallet: {

        type: Schema.Types.ObjectId,

        ref: "Wallet"

    },

    creditWallet: {

        type: Schema.Types.ObjectId,

        ref: "Wallet"

    },

    amount: {

        type: Number,

        required: true

    },

    description: String,

    transaction: {

        type: Schema.Types.ObjectId,

        ref: "Transaction"

    }

}, {

    timestamps: true

});

export default
    model(
    "Ledger",
    ledgerSchema
);