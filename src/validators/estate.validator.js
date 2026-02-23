import Joi from "joi";

const uuid = Joi.string().guid({ version: ["uuidv4", "uuidv5"] });

export const estateIdParamSchema = Joi.object({
  id: uuid.required(),
});

export const sellerIdParamSchema = Joi.object({
  sellerId: uuid.required(),
});

export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid("id", "name", "created_at", "updated_at", "state").default("created_at"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

export const createEstateSchema = Joi.object({
  sellerId: uuid.required(),
  name: Joi.string().trim().min(2).max(255).required(),
  address: Joi.string().trim().min(3).max(2000).required(),
  lga: Joi.string().trim().max(100).allow(null, ""),
  state: Joi.string().trim().max(100).allow(null, ""),
  coverImageUrl: Joi.string().uri().max(2048).allow(null, ""),
  isLandEstate: Joi.boolean().default(false),
});

export const updateEstateCoverSchema = Joi.object({
  coverImageUrl: Joi.string().uri().max(2048).required(),
});

export const updateEstateDetailsSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255),
  address: Joi.string().trim().min(3).max(2000),
  lga: Joi.string().trim().max(100).allow(null, ""),
  state: Joi.string().trim().max(100).allow(null, ""),
  coverImageUrl: Joi.string().uri().max(2048).allow(null, ""),
  isLandEstate: Joi.boolean(),
}).min(1);
