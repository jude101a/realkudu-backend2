import { Router } from "express";
import {
  bulkDeletePropertyImages,
  deleteImage,
  deletePropertyImages,
  getMultiplePropertyImages,
  getPropertyImage,
  insertMultipleImages,
  insertPropertyImage,
} from "../../controllers/utillity.controller/images.controller.js";
import { protect } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  bulkPropertyIdsBodySchema,
  createImageSchema,
  imageIdParamSchema,
  propertyIdParamSchema,
} from "../../validators/images.validator.js";

const router = Router();
const protectedRouter = Router();

router.get(
  "getPropertyImages/:propertyId",
  validate({ params: propertyIdParamSchema }),
  getPropertyImage
);

router.post(
  "bulk/getMulttipleImagesByid",
  validate({ body: bulkPropertyIdsBodySchema }),
  getMultiplePropertyImages
);


protectedRouter.use(protect);

protectedRouter.post("/createImages", validate({ body: createImageSchema }), insertPropertyImage);
router.post("/bulk/insertMultipleImages", insertMultipleImages)
protectedRouter.delete("/deleteSingleImage/:imageId", validate({ params: imageIdParamSchema }), deleteImage);
protectedRouter.delete(
  "/property/:propertyId",
  validate({ params: propertyIdParamSchema }),
  deletePropertyImages
);
protectedRouter.delete(
  "/bulk/deleteMultiplePropertyImages",
  validate({ body: bulkPropertyIdsBodySchema }),
  bulkDeletePropertyImages
);

router.use(protectedRouter);

export default router;
