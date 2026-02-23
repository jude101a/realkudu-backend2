import Joi from "joi";

const uuid = Joi.string().guid({ version: ["uuidv4", "uuidv5"] });

export const propertyIdParamSchema = Joi.object({
  propertyId: uuid.required(),
});

export const sellerIdParamSchema = Joi.object({
  sellerId: uuid.required(),
});

export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid("id", "property_id", "price", "created_at", "updated_at", "property_name", "status", "listing_date")
    .default("created_at"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

export const filterQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid("id", "property_id", "price", "created_at", "updated_at", "property_name", "status", "listing_date")
    .default("created_at"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  status: Joi.string().max(50),
  sellerId: uuid,
  estateId: uuid,
  landType: Joi.string().max(100),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
});

export const searchQuerySchema = Joi.object({
  q: Joi.string().trim().min(2).required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid("id", "property_id", "price", "created_at", "updated_at", "property_name", "status", "listing_date")
    .default("created_at"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

export const createLandSchema = Joi.object({
  estateId: uuid.allow(null),
  sellerId: uuid.required(),
  propertyName: Joi.string().trim().min(2).max(500).required(),
  propertyAddress: Joi.string().trim().min(3).max(2000).required(),
  stateLocation: Joi.string().trim().min(2).max(255).required(),
  country: Joi.string().trim().min(2).max(255).required(),
  coverImageUrl: Joi.string().uri().max(2048).allow(null, ""),
  galleryImages: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.object()).allow(null),
  price: Joi.number().min(0).required(),
  availableQuantity: Joi.number().min(0).required(),
  shortDescription: Joi.string().trim().min(2).max(5000).required(),
  longDescription: Joi.string().trim().min(2).max(20000).required(),
  landSize: Joi.number().min(0).allow(null),
  customLandSize: Joi.number().min(0).allow(null),
  pricePer450sqm: Joi.number().min(0).allow(null),
  pricePer900sqm: Joi.number().min(0).allow(null),
  pricePerCustomSqm: Joi.number().min(0).allow(null),
  pricePerPlot: Joi.number().min(0).allow(null),
  bookingFee: Joi.number().min(0).allow(null),
  statutoryFee: Joi.number().min(0).allow(null),
  developmentFee: Joi.number().min(0).allow(null),
  surveyFee: Joi.number().min(0).allow(null),
  legalFee: Joi.number().min(0).allow(null),
  documentationFee: Joi.number().min(0).allow(null),
  subscriptionFee: Joi.number().min(0).allow(null),
  agencyFee: Joi.number().min(0).allow(null),
  otherFees: Joi.number().min(0).allow(null),
  documentsAvailable: Joi.alternatives().try(Joi.array(), Joi.object(), Joi.string()).allow(null),
  landType: Joi.string().trim().max(100).allow(null, ""),
  topography: Joi.string().trim().max(100).allow(null, ""),
  soilType: Joi.string().trim().max(100).allow(null, ""),
  fencingStatus: Joi.string().trim().max(100).allow(null, ""),
  electricityAvailability: Joi.string().trim().max(100).allow(null, ""),
  accessRoadType: Joi.string().trim().max(100).allow(null, ""),
  surveyStatus: Joi.string().trim().max(100).allow(null, ""),
  governmentAcquisitionStatus: Joi.string().trim().max(100).allow(null, ""),
  usageStatus: Joi.string().trim().max(100).allow(null, ""),
  status: Joi.string().trim().max(50).allow(null, ""),
  isEstateLand: Joi.boolean().allow(null),
  soldOut: Joi.boolean().allow(null),
  purchaseDate: Joi.date().iso().allow(null),
});

export const updateLandSchema = createLandSchema.fork(
  ["sellerId", "propertyName", "propertyAddress", "stateLocation", "country", "price", "availableQuantity", "shortDescription", "longDescription"],
  (schema) => schema.optional()
).min(1);

export const bulkInsertSchema = Joi.object({
  lands: Joi.array().items(createLandSchema).min(1).required(),
});

export const updateCoverSchema = Joi.object({
  image_url: Joi.string().uri().max(2048),
  coverImageUrl: Joi.string().uri().max(2048),
})
  .or("image_url", "coverImageUrl")
  .required();
