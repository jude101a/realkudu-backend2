import Joi from "joi";

const uuid = Joi.string().uuid({ version: ["uuidv4", "uuidv5"] });

export const createTenantSchema = Joi.object({
  tenant_id: uuid.required(),
  property_id: uuid.required(),
  rent_amount: Joi.number().positive().required(),
  rent_currency: Joi.string().max(10).required(),
  rent_frequency: Joi.string().valid("monthly", "weekly", "yearly").default("monthly"),
  tenancy_start_date: Joi.date().iso().required(),
  tenancy_end_date: Joi.date().iso().optional().allow(null),
  notes: Joi.string().max(2000).optional().allow(null, ""),
});

export const tenantMetaIdParam = Joi.object({
  tenantMetaId: uuid.required(),
});

export const byTenantQuery = Joi.object({
  tenantID: uuid.required(),
});

export const byPropertyQuery = Joi.object({
  propertyID: uuid.required(),
});

export const markRentPaidSchema = Joi.object({
  paymentDate: Joi.date().iso().required(),
  nextDueDate: Joi.date().iso().optional().allow(null),
  amount: Joi.number().positive().optional(),
  notes: Joi.string().max(500).optional().allow(null, ""),
});

export const updateOutstandingSchema = Joi.object({
  outstandingAmount: Joi.number().required(),
  reason: Joi.string().max(500).optional().allow(null, ""),
});

export const serveNoticeSchema = Joi.object({
  noticeDate: Joi.date().iso().required(),
  reason: Joi.string().max(1000).optional().allow(null, ""),
  noticePeriodDays: Joi.number().integer().min(0).optional(),
});

export const terminateSchema = Joi.object({
  terminationDate: Joi.date().iso().required(),
  reason: Joi.string().max(1000).optional().allow(null, ""),
});

export default {
  createTenantSchema,
  tenantMetaIdParam,
  byTenantQuery,
  byPropertyQuery,
  markRentPaidSchema,
  updateOutstandingSchema,
  serveNoticeSchema,
  terminateSchema,
};
