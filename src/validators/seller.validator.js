import Joi from "joi";

const uuid = Joi.string().guid({
  version: ["uuidv4", "uuidv5"],
});

export const sellerIdParamSchema = Joi.object({
  id: uuid.required(),
});

export const userIdParamSchema = Joi.object({
  userId: uuid.required(),
});

export const registerIndividualSellerSchema = Joi.object({
  userId: uuid.required(),
  businessName: Joi.string().trim().min(2).max(255).required(),
  businessAddress: Joi.string().trim().max(1000).allow(null, ""),
  businessEmail: Joi.string().email().max(255).allow(null, ""),
  businessPhone: Joi.string().trim().max(20).allow(null, ""),
  tinNumber: Joi.string().trim().max(50).allow(null, ""),
  businessSpecification: Joi.string().trim().max(5000).allow(null, ""),
  businessProfileImageUrl: Joi.string().uri().max(2048).allow(null, ""),
});

export const registerCompanySellerSchema = Joi.object({
  userId: uuid.required(),
  businessName: Joi.string().trim().min(2).max(255).required(),
  businessAddress: Joi.string().trim().max(1000).allow(null, ""),
  businessEmail: Joi.string().email().max(255).allow(null, ""),
  businessPhone: Joi.string().trim().max(20).allow(null, ""),
  cacNumber: Joi.string().trim().max(50).required(),
  tinNumber: Joi.string().trim().max(50).allow(null, ""),
  cacDocumentUrl: Joi.string().uri().max(2048).allow(null, ""),
  businessSpecification: Joi.string().trim().max(5000).allow(null, ""),
  businessProfileImageUrl: Joi.string().uri().max(2048).allow(null, ""),
});

export const sellerListQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
  type: Joi.string().valid("individual", "company"),
  status: Joi.string().valid("active", "inactive", "deleted"),
  verificationStatus: Joi.string().valid("verified", "unverified", "rejected"),
});

export const sellerSearchQuerySchema = Joi.object({
  q: Joi.string().trim().min(2).required(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

export const sellerUserLoginSchema = Joi.object({
  userId: uuid.required(),
});

export const updateBusinessProfileSchema = Joi.object({
  businessName: Joi.string().trim().min(2).max(255),
  businessAddress: Joi.string().trim().max(1000).allow(null, ""),
  businessEmail: Joi.string().email().max(255).allow(null, ""),
  businessPhone: Joi.string().trim().max(20).allow(null, ""),
  businessSpecification: Joi.string().trim().max(5000).allow(null, ""),
  businessProfileImageUrl: Joi.string().uri().max(2048).allow(null, ""),
}).min(1);

export const updateCompanyDocumentsSchema = Joi.object({
  cacNumber: Joi.string().trim().max(50),
  tinNumber: Joi.string().trim().max(50),
  cacDocumentUrl: Joi.string().uri().max(2048).allow(null, ""),
}).min(1);

export const updateIndividualKycSchema = Joi.object({
  nin: Joi.string().trim().length(11),
  bvn: Joi.string().trim().length(11),
}).min(1);

export const adminVerifySellerSchema = Joi.object({
  notes: Joi.string().trim().max(1000).allow("", null),
});

export const adminRejectSellerSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
  notes: Joi.string().trim().max(1000).allow("", null),
});

export const adminSuspendSellerSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

export const adminDeactivateSellerSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

export const adminRestoreSellerSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow("", null),
});

export const adminDeleteSellerSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

export const adminUpdateRatingsSchema = Joi.object({
  averageRating: Joi.number().min(0).max(5).required(),
  totalReviews: Joi.number().integer().min(0).required(),
  totalTransactions: Joi.number().integer().min(0).required(),
  totalSalesValue: Joi.number().min(0).required(),
});
