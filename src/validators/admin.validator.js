import Joi from "joi";

const uuid = Joi.string().guid({ version: ["uuidv4", "uuidv5"] });

export const propertyIdParamSchema = Joi.object({
  propertyId: uuid.required(),
});

export const sellerIdParamSchema = Joi.object({
  sellerId: uuid.required(),
});

export const rejectListingBody = Joi.object({
  reason: Joi.string().max(2000).optional().allow(null, ""),
});

export const rejectKycBody = Joi.object({
  reason: Joi.string().max(2000).optional().allow(null, "")
});

export default {
  propertyIdParamSchema,
  sellerIdParamSchema,
  rejectListingBody,
  rejectKycBody,
};
