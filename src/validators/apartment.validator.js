import Joi from "joi";

const uuid = Joi.string().guid({ version: ["uuidv4", "uuidv5"] });

export const apartmentIdParamSchema = Joi.object({
  id: uuid.required(),
});

export const houseIdParamSchema = Joi.object({
  houseId: uuid.required(),
});

export const houseIDParamSchema = Joi.object({
  houseID: uuid.required(),
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
  houseID: uuid,
  houseId: uuid,
  sellerID: uuid,
  sellerId: uuid,
  apartmentAddress: Joi.string().trim().min(3).max(2000).required(),
  state: Joi.string().trim().min(3),
  lga : Joi.string().trim(),
  numberOfBedrooms: Joi.number().integer().min(0).default(0),
  numberOfKitchen: Joi.number().integer().min(0),
  numberOfKitchens: Joi.number().integer().min(0),
  numberOfLivingRooms: Joi.number().integer().min(0).default(0),
  numberOfToilets: Joi.number().integer().min(0).default(0),
  description: Joi.string().trim().max(10000).allow(null, ""),
  rentAmount: Joi.number().min(0).default(0),
  cautionFee: Joi.number().min(0).default(0),
  lawyerFee: Joi.number().min(0).default(0),
  paymentDuration: Joi.string().trim().max(50).allow(null, ""),
  houseName: Joi.string().trim().max(255).allow(null, ""),
  apartmentType: Joi.string().trim().max(100).allow(null, ""),
  coverImageUrl: Joi.string().uri().max(204800).allow(null, ""),
  apartmentCondition: Joi.string().trim().max(100).allow(null, ""),
  furnishedStatus: Joi.string().trim().max(100).allow(null, ""),
  tenantEligibility: Joi.string().trim().max(2000).allow(null, ""),
  legalFees: Joi.string().trim().max(2000).allow(null, ""),
  unitNumber: Joi.string().trim().max(50).allow(null, ""),
  hasRunningWater: Joi.alternatives().try(Joi.boolean(), Joi.number().valid(0, 1)).default(false),
  hasElectricity: Joi.alternatives().try(Joi.boolean(), Joi.number().valid(0, 1)).default(false),
  hasParkingSpace: Joi.alternatives().try(Joi.boolean(), Joi.number().valid(0, 1)).default(false),
  hasInternet: Joi.alternatives().try(Joi.boolean(), Joi.number().valid(0, 1)).default(false),
})
  .or("houseId", "houseID")
  .or("sellerId", "sellerID");

export const updateApartmentSchema = Joi.object({
  houseID: uuid,
  houseId: uuid,
  sellerID: uuid,
  sellerId: uuid,
  tenantID: uuid.allow(null),
  tenantId: uuid.allow(null),
  apartmentAddress: Joi.string().trim().min(3).max(2000),
  numberOfBedrooms: Joi.number().integer().min(0),
  numberOfKitchen: Joi.number().integer().min(0),
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
  hasRunningWater: Joi.alternatives().try(Joi.boolean(), Joi.number().valid(0, 1)),
  hasElectricity: Joi.alternatives().try(Joi.boolean(), Joi.number().valid(0, 1)),
  hasParkingSpace: Joi.alternatives().try(Joi.boolean(), Joi.number().valid(0, 1)),
  hasInternet: Joi.alternatives().try(Joi.boolean(), Joi.number().valid(0, 1)),
}).min(1);

export const updateTenantSchema = Joi.object({
  tenantID: uuid.allow(null),
  tenantId: uuid.allow(null),
}).or("tenantId", "tenantID");

export const tenantMetaIdParamSchema = Joi.object({
  tenantMetaId: uuid.required(),
});

export const createTenantMetaSchema = Joi.object({
  tenantMetaID: uuid,
  tenantID: uuid.required(),
  propertyID: uuid.required(),
  propertyType: Joi.string().trim().valid("apartment", "house", "land").required(),
  rentAmount: Joi.number().min(0).required(),
  rentCurrency: Joi.string().trim().max(10).default("NGN"),
  rentFrequency: Joi.string().trim().valid("monthly", "quarterly", "yearly").required(),
  tenancyStartDate: Joi.date().required(),
  tenancyEndDate: Joi.date().allow(null),
  isActiveTenant: Joi.boolean().default(true),
  hasPaidCurrentRent: Joi.boolean().default(false),
  noticeServed: Joi.boolean().default(false),
  lastPaymentDate: Joi.date().allow(null),
  nextDueDate: Joi.date().allow(null),
  outstandingBalance: Joi.number().min(0).default(0),
  tenancyStatus: Joi.string().trim().max(30).required(),
});

export const tenantMetaByTenantQuerySchema = Joi.object({
  tenantID: uuid.required(),
});

export const tenantMetaByPropertyQuerySchema = Joi.object({
  propertyID: uuid.required(),
});

export const markRentPaidSchema = Joi.object({
  paymentDate: Joi.date().required(),
  nextDueDate: Joi.date().required(),
});

export const updateOutstandingBalanceSchema = Joi.object({
  amount: Joi.number().required(),
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
