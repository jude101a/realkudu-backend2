import Joi from "joi";

const uuid = Joi.string().guid({ version: ["uuidv4", "uuidv5"] });

export const houseIdParamSchema = Joi.object({
  houseId: uuid.required(),
});

export const statusParamSchema = Joi.object({
  status: Joi.string().valid("active", "under_offer", "sold", "withdrawn").required(),
});

export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid("house_id", "asking_price", "created_at", "address", "status", "updated_at").default("created_at"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

export const listFilterQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid("house_id", "asking_price", "created_at", "address", "status", "updated_at").default("created_at"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  status: Joi.string().valid("active", "under_offer", "sold", "withdrawn"),
  ownerId: uuid,
  state: Joi.string().trim().max(100),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  bedrooms: Joi.number().integer().min(0),
  verificationStatus: Joi.string().valid("pending", "verified", "rejected"),
});

export const searchQuerySchema = Joi.object({
  q: Joi.string().trim().min(2).required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid("house_id", "asking_price", "created_at", "address", "updated_at").default("created_at"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

export const createHouseSchema = Joi.object({
  ownerId: uuid.required(),
  agentId: uuid.allow(null),
  lawyerId: uuid.allow(null),
  status: Joi.string().valid("active", "under_offer", "sold", "withdrawn").default("active"),
  verificationStatus: Joi.string().valid("pending", "verified", "rejected").default("pending"),
  state: Joi.string().trim().min(2).max(100).required(),
  lga: Joi.string().trim().min(2).max(100).required(),
  address: Joi.string().trim().min(5).max(2000).required(),
  landmark: Joi.string().trim().max(255).allow(null, ""),
  latitude: Joi.number().allow(null),
  longitude: Joi.number().allow(null),
  bedrooms: Joi.number().integer().min(0).required(),
  bathrooms: Joi.number().integer().min(0).allow(null),
  toilets: Joi.number().integer().min(0).allow(null),
  floors: Joi.number().integer().min(0).allow(null),
  landSize: Joi.number().min(0).allow(null),
  houseType: Joi.string().trim().max(100).allow(null, ""),
  askingPrice: Joi.number().min(0).required(),
  finalSalePrice: Joi.number().min(0).allow(null),
  currency: Joi.string().trim().max(10).default("NGN"),
  titleDocument: Joi.string().trim().max(2048).required(),
  hasSurveyPlan: Joi.boolean().default(false),
  hasBuildingApproval: Joi.boolean().default(false),
  governorConsentObtained: Joi.boolean().default(false),
  description: Joi.string().trim().max(10000).allow(null, ""),
  features: Joi.alternatives().try(Joi.array(), Joi.object(), Joi.string()).allow(null),
  images: Joi.alternatives().try(Joi.array(), Joi.object()).allow(null),
});

export const updatePriceSchema = Joi.object({
  newPrice: Joi.number().min(0).required(),
});

export const updateFinalPriceSchema = Joi.object({
  price: Joi.number().min(0).required(),
});

export const updateDescriptionSchema = Joi.object({
  description: Joi.string().trim().max(10000).required(),
});

export const updateImagesSchema = Joi.object({
  images: Joi.array().items(Joi.string().uri()).required(),
});

export const singleImageSchema = Joi.object({
  imageUrl: Joi.string().uri().required(),
});

export const assignLawyerSchema = Joi.object({
  lawyerId: uuid.allow(null).required(),
});

export const verificationStatusSchema = Joi.object({
  status: Joi.string().valid("pending", "verified", "rejected").required(),
});

export const legalFlagsSchema = Joi.object({
  hasSurveyPlan: Joi.boolean().required(),
  hasBuildingApproval: Joi.boolean().required(),
  governorConsentObtained: Joi.boolean().required(),
});

export const markSoldSchema = Joi.object({
  buyerId: uuid.required(),
  finalPrice: Joi.number().min(0).required(),
});
