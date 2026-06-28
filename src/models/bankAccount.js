import { Schema, model } from "mongoose";

const bankAccountSchema = new Schema({

    user: {

        type: Schema.Types.ObjectId,

        ref: "User",

        required: true

    },

    accountName: String,

    accountNumber: String,

    bankCode: String,

    bankName: String,

    recipientCode: String,

    verified: {

        type: Boolean,

        default: false

    }

}, {

    timestamps: true

});

export default
    model(
    "BankAccount",
    bankAccountSchema
);