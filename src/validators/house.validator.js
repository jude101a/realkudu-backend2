import Joi from "joi";

const uuid = Joi.string().guid({ version: ["uuidv4", "uuidv5"] });

const basePagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string()
    .valid("id", "name", "created_at", "updated_at", "state", "lga", "type")
    .default("created_at"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
};

export const houseIdParamSchema = Joi.object({
  id: uuid.required(),
});

export const estateIdParamSchema = Joi.object({
  estateId: uuid.required(),
});

export const sellerIdParamSchema = Joi.object({
  sellerId: uuid.required(),
});

export const houseListQuerySchema = Joi.object({
  ...basePagination,
  sellerId: uuid,
  estateId: uuid,
  state: Joi.string().trim().max(100),
  lga: Joi.string().trim().max(100),
  type: Joi.string().trim().max(100),
  q: Joi.string().trim().min(2).max(200),
  isSingleHouse: Joi.boolean(),
});

export const standaloneQuerySchema = Joi.object({
  ...basePagination,
  sellerId: uuid.required(),
  isSingleHouse: Joi.boolean().default(true),
});

export const estateHousesQuerySchema = Joi.object({
  ...basePagination,
  sellerId: uuid.required(),
  estateId: uuid.required(),
});

export const createHouseSchema = Joi.object({
  estateId: uuid.allow(null),
  sellerId: uuid.required(),
  lawyerId: uuid.allow(null),
  caretakerId: uuid.allow(null),
  name: Joi.string().trim().min(2).max(255).required(),
  type: Joi.string().trim().max(100).allow(null, ""),
  address: Joi.string().trim().min(3).max(2000).allow(null, ""),
  coverImageUrl: Joi.string().uri().max(2048).allow(null, ""),
  isSingleHouse: Joi.boolean().default(false),
  state: Joi.string().trim().max(100).allow(null, ""),
  lga: Joi.string().trim().max(100).allow(null, ""),
});

export const updateHouseCoverSchema = Joi.object({
  coverImageUrl: Joi.string().uri().max(2048).required(),
});

export const updateHouseLawyerSchema = Joi.object({
  lawyerId: uuid.allow(null).required(),
});

export const updateHouseCaretakerSchema = Joi.object({
  caretakerId: uuid.allow(null).required(),
});

export const updateHouseSchema = Joi.object({
  estateId: uuid.allow(null),
  sellerId: uuid,
  lawyerId: uuid.allow(null),
  caretakerId: uuid.allow(null),
  name: Joi.string().trim().min(2).max(255),
  type: Joi.string().trim().max(100).allow(null, ""),
  address: Joi.string().trim().min(3).max(2000).allow(null, ""),
  coverImageUrl: Joi.string().uri().max(2048).allow(null, ""),
  isSingleHouse: Joi.boolean(),
  state: Joi.string().trim().max(100).allow(null, ""),
  lga: Joi.string().trim().max(100).allow(null, ""),
}).min(1);
