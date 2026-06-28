import joi from "joi";

export const initializePaymentSchema = joi.object({

    propertyId: joi.string()
        .required(),

    paymentType: joi.string()
        .valid(

            "BOOKING",

            "BALANCE",

            "PROPERTY_PURCHASE",

            "RENT",

            "SUBSCRIPTION",

            "INSPECTION"

        )
        .required(),

    callbackUrl: joi.string()
        .uri()
        .required()

});

export const referenceSchema = joi.object({

    reference: joi.string()
        .required()

});

export const refundSchema = joi.object({

    reference: joi.string()
        .required(),

    amount: joi.number()
        .min(1)
        .optional()

});

export const transferRecipientSchema = joi.object({

    name: joi.string().required(),

    accountNumber: joi.string().required(),

    bankCode: joi.string().required()

});