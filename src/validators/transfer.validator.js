import joi from "joi";

export const initiateTransferSchema = joi.object({
  escrow: joi.object().required(),
  recipientCode: joi.string().required(),
  reason: joi.string().optional(),
});

export const transferStatusSchema = joi.object({
  reference: joi.string().required(),
});

export const sellerTransfersQuerySchema = joi.object({
  sellerId: joi.string().required(),
  page: joi.number().integer().min(1).optional(),
  limit: joi.number().integer().min(1).max(100).optional(),
});
