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
    .valid("id", "property_id", "price", "created_at", "updated_at", "name", "status", "created_at")
    .default("created_at"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

export const createSchema = Joi.object({
  propertyId: uuid.allow(null),
  estateId: uuid.allow(null),
  sellerId: uuid.required(),
  houseName: Joi.string().trim(),
  unitNumber: Joi.string().trim(),
  propertType: Joi.object(),
  name: Joi.string().trim().min(2).max(500).required(),
  address: Joi.string().trim().min(3).max(2000).required(),
  lga: Joi.string().trim().min(2).max(255).required(),
  country: Joi.string().trim().min(2).max(255).required(),
  state: Joi.string().trim(),
  bedrooms: Joi.number().min(0),
  kitchens: Joi.number().min(0),
  livingRooms: Joi.number().min(0),
  toilets: Joi.number().min(0),
  roomSize: Joi.number().min(0),

  hasRunningWater: Joi.boolean().allow(null),
  hasElectricity: Joi.boolean().allow(null),
  hasParkingSpace: Joi.boolean().allow(null),
  hasInternet: Joi.boolean().allow(null),


  coverImageUrl: Joi.string().uri().max(2048).allow(null, ""),


  price: Joi.number().min(0).required(),
  askingPrice: Joi.number().min(0).required(),
  finalPrice: Joi.number().min(0).required(),
  currency: Joi.string().trim().min(3).max(4),
  quantity: Joi.number().min(0).required(),


  description: Joi.string().trim().min(2).max(5000).required(),
  size: Joi.number().min(0).allow(null),


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
  accessRoadType: Joi.string().trim().max(100).allow(null, ""),
  surveyStatus: Joi.string().trim().max(100).allow(null, ""),
  governmentAcquisitionStatus: Joi.string().trim().max(100).allow(null, ""),
  usageStatus: Joi.string().trim().max(100).allow(null, ""),
  status: Joi.string().trim().max(50).allow(null, ""),
  isEstate: Joi.boolean().allow(null),
  soldOut: Joi.boolean().allow(null),
  soldAt: Joi.date().iso().allow(null),
})
  .rename("propertyID", "propertyId", { ignoreUndefined: true, override: true })
  .rename("estateID", "estateId", { ignoreUndefined: true, override: true })
  .rename("sellerID", "sellerId", { ignoreUndefined: true, override: true });

export const updateSchema = createSchema.fork(
  ["sellerId", "name", "address", "state", "country", "price", "quantity", "description"],
  (schema) => schema.optional()
).min(1);

export const bulkInsertSchema = Joi.object({
  lands: Joi.array().items(createSchema).min(1).required(),
});

export const updateCoverSchema = Joi.object({
  image_url: Joi.string().uri().max(2048),
  coverImageUrl: Joi.string().uri().max(2048),
  imageUrl: Joi.string().uri().max(2048),
})
  .or("image_url", "coverImageUrl", "imageUrl")
  .required();
