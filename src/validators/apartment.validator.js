import Joi from "joi";

const uuid = Joi.string().guid({ version: ["uuidv4", "uuidv5"] });

export const apartmentIdParamSchema = Joi.object({
  id: uuid.required(),
});

export const houseIdParamSchema = Joi.object({
  houseId: uuid.required(),
});

export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid("id", "rent_amount", "created_at", "apartment_address", "updated_at", "number_of_bedrooms")
    .default("created_at"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

export const createApartmentSchema = Joi.object({
  houseId: uuid.required(),
  sellerId: uuid.required(),
  apartmentAddress: Joi.string().trim().min(3).max(2000).required(),
  numberOfBedrooms: Joi.number().integer().min(0).default(0),
  numberOfKitchens: Joi.number().integer().min(0).default(0),
  numberOfLivingRooms: Joi.number().integer().min(0).default(0),
  numberOfToilets: Joi.number().integer().min(0).default(0),
  images: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.object()).allow(null),
  description: Joi.string().trim().max(10000).allow(null, ""),
  rentAmount: Joi.number().min(0).default(0),
  cautionFee: Joi.number().min(0).default(0),
  lawyerFee: Joi.number().min(0).default(0),
  paymentDuration: Joi.string().trim().max(50).allow(null, ""),
  houseName: Joi.string().trim().max(255).allow(null, ""),
  apartmentType: Joi.string().trim().max(100).allow(null, ""),
  coverImageUrl: Joi.string().uri().max(2048).allow(null, ""),
  apartmentCondition: Joi.string().trim().max(100).allow(null, ""),
  furnishedStatus: Joi.string().trim().max(100).allow(null, ""),
  tenantEligibility: Joi.string().trim().max(2000).allow(null, ""),
  legalFees: Joi.string().trim().max(2000).allow(null, ""),
  unitNumber: Joi.string().trim().max(50).allow(null, ""),
  hasRunningWater: Joi.boolean().default(false),
  hasElectricity: Joi.boolean().default(false),
  hasParkingSpace: Joi.boolean().default(false),
  hasInternet: Joi.boolean().default(false),
});

export const updateApartmentSchema = Joi.object({
  apartmentAddress: Joi.string().trim().min(3).max(2000),
  numberOfBedrooms: Joi.number().integer().min(0),
  numberOfKitchens: Joi.number().integer().min(0),
  numberOfLivingRooms: Joi.number().integer().min(0),
  numberOfToilets: Joi.number().integer().min(0),
  description: Joi.string().trim().max(10000).allow(null, ""),
  rentAmount: Joi.number().min(0),
  cautionFee: Joi.number().min(0),
  lawyerFee: Joi.number().min(0),
  paymentDuration: Joi.string().trim().max(50).allow(null, ""),
  houseName: Joi.string().trim().max(255).allow(null, ""),
  apartmentType: Joi.string().trim().max(100).allow(null, ""),
  coverImageUrl: Joi.string().uri().max(2048).allow(null, ""),
  apartmentCondition: Joi.string().trim().max(100).allow(null, ""),
  furnishedStatus: Joi.string().trim().max(100).allow(null, ""),
  tenantEligibility: Joi.string().trim().max(2000).allow(null, ""),
  legalFees: Joi.string().trim().max(2000).allow(null, ""),
  unitNumber: Joi.string().trim().max(50).allow(null, ""),
  hasRunningWater: Joi.boolean(),
  hasElectricity: Joi.boolean(),
  hasParkingSpace: Joi.boolean(),
  hasInternet: Joi.boolean(),
}).min(1);

export const updateTenantSchema = Joi.object({
  tenantId: uuid.required(),
});

export const searchQuerySchema = Joi.object({
  q: Joi.string().trim().min(2).required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid("id", "rent_amount", "created_at", "apartment_address", "updated_at", "number_of_bedrooms")
    .default("created_at"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

export const filterQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid("id", "rent_amount", "created_at", "apartment_address", "updated_at", "number_of_bedrooms")
    .default("created_at"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  sellerId: uuid,
  houseId: uuid,
  minRent: Joi.number().min(0),
  maxRent: Joi.number().min(0),
  numberOfBedrooms: Joi.number().integer().min(0),
  furnishedStatus: Joi.string().trim().max(100),
});
