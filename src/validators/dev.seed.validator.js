import Joi from "joi";

const uuid = Joi.string().guid({ version: ["uuidv4", "uuidv5"] });

export const seedAssetsSchema = Joi.object({
  sellerId: uuid.optional(),
});
