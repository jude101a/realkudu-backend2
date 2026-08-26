import joi from "joi";

export const initiateTransactionSchema = joi.object({
  transactionType: joi.string().required(),
  coverImageUrl: joi.string().uri().optional(),
  title: joi.string().required(),
  propertyId: joi.string().uuid().required(),
  userId: joi.string().uuid().required(),
  amount: joi.number().positive().required(),
  status: joi.string().valid("pending", "completed", "failed").optional(),});

export const transactionStatusSchema = joi.object({
  transactionStatus: joi.string().required(),
});

export const userTransactionsQuerySchema = joi.object({
  userId: joi.string().required(),
  page: joi.number().integer().min(1).optional(),
  limit: joi.number().integer().min(1).max(100).optional(),
});
