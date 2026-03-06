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
  createMultipleImagesSchema,
  imageUrlParamSchema,
  propertyIdParamSchema,
} from "../../validators/images.validator.js";

const router = Router();
const protectedRouter = Router();

/* Read routes */
router.get(
  "/getPropertyImages/:propertyId",
  validate({ params: propertyIdParamSchema }),
  getPropertyImage
);
router.get(
  "/property/:propertyId",
  validate({ params: propertyIdParamSchema }),
  getPropertyImage
);
router.post(
  "/bulk/getMulttipleImagesByid",
  validate({ body: bulkPropertyIdsBodySchema }),
  getMultiplePropertyImages
);
router.post(
  "/bulk/get-by-property-ids",
  validate({ body: bulkPropertyIdsBodySchema }),
  getMultiplePropertyImages
);

/* Protected write routes */
protectedRouter.use(protect);

protectedRouter.post(
  "/createImages",
  validate({ body: createImageSchema }),
  insertPropertyImage
);

protectedRouter.post(
  "/bulk/insertMultipleImages",
  validate({ body: createMultipleImagesSchema }),
  insertMultipleImages
);

router.delete(
  "/deleteSingleImage/:imageUrl",
  validate({ params: imageUrlParamSchema }),
  deleteImage
);


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
protectedRouter.delete(
  "/bulk/delete-by-property-ids",
  validate({ body: bulkPropertyIdsBodySchema }),
  bulkDeletePropertyImages
);

router.use(protectedRouter);

export default router;
