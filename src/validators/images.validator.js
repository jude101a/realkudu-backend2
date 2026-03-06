import Joi from "joi";

const uuid = Joi.string().guid({ version: ["uuidv4", "uuidv5"] });

export const imageIdParamSchema = Joi.object({
  imageUrl: uuid.required(),
});

export const propertyIdParamSchema = Joi.object({
  propertyId: uuid.required(),
});

export const createImageSchema = Joi.object({
  propertyId: uuid.required(),
  imageUrl: Joi.string().uri().max(2048).required(),
  isCover: Joi.boolean().default(false),
});

export const bulkPropertyIdsBodySchema = Joi.object({
  propertyIds: Joi.array().items(uuid.required()).min(1).max(200).unique().required(),
});

export const createMultipleImagesSchema = Joi.object({
  propertyId: uuid.required(),
  images: Joi.array()
    .items(
      Joi.object({
        imageUrl: Joi.string().uri().max(2048).required(),
        isCover: Joi.boolean().default(false),
      })
    )
    .min(1)
    .max(200)
    .required(),
});
