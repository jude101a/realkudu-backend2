import { Router } from "express";
import multer from "multer";
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
  imageIdParamSchema,
  imageUrlParamSchema,
  propertyIdParamSchema,
} from "../../validators/images.validator.js";

const router = Router();
const protectedRouter = Router();

const MAX_IMAGE_BYTES = Number(process.env.MAX_IMAGE_UPLOAD_BYTES || 10 * 1024 * 1024);
const MAX_VIDEO_BYTES = Number(process.env.MAX_VIDEO_UPLOAD_BYTES || 100 * 1024 * 1024);
const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
const allowedVideoTypes = new Set([
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(MAX_IMAGE_BYTES, MAX_VIDEO_BYTES), files: 20 },
  fileFilter: (_req, file, cb) => {
    const isAllowed =
      allowedImageTypes.has(file.mimetype) || allowedVideoTypes.has(file.mimetype);

    if (!isAllowed) {
      const error = new Error("Only supported image and video files can be uploaded");
      error.code = "INVALID_FILE_TYPE";
      cb(error);
      return;
    }

    cb(null, true);
  },
});

const sendUploadError = (res, error) => {
  const isSizeError = error?.code === "LIMIT_FILE_SIZE";
  const isTypeError = error?.code === "INVALID_FILE_TYPE";

  return res.status(isSizeError ? 413 : 400).json({
    success: false,
    error: {
      code: isSizeError ? "FILE_TOO_LARGE" : error?.code || "UPLOAD_ERROR",
      message:
        error?.message ||
        (isTypeError
          ? "Only supported image and video files can be uploaded"
          : "Media upload failed"),
    },
  });
};

const uploadSingleMedia = (fieldName) => (req, res, next) => {
  upload.single(fieldName)(req, res, (error) => {
    if (error) return sendUploadError(res, error);
    return next();
  });
};

const uploadMultipleMedia = (fieldName, maxCount) => (req, res, next) => {
  upload.array(fieldName, maxCount)(req, res, (error) => {
    if (error) return sendUploadError(res, error);
    return next();
  });
};

const enforceMediaSize = (req, _res, next) => {
  const files = req.files || (req.file ? [req.file] : []);
  const tooLarge = files.find((file) => {
    const limit = file.mimetype?.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    return file.size > limit;
  });

  if (tooLarge) {
    const error = new Error(
      `${tooLarge.originalname} exceeds the ${tooLarge.mimetype?.startsWith("video/") ? "video" : "image"} upload size limit`
    );
    error.code = "LIMIT_FILE_SIZE";
    return next(error);
  }

  return next();
};

// Export helpers for reuse in other routes/controllers
export { uploadSingleMedia, uploadMultipleMedia, enforceMediaSize };

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
  uploadSingleMedia("file"),
  enforceMediaSize,
  validate({ body: createImageSchema }),
  insertPropertyImage
);

protectedRouter.post(
  "/bulk/insertMultipleImages",
  uploadMultipleMedia("files", 20),
  enforceMediaSize,
  validate({ body: createMultipleImagesSchema }),
  insertMultipleImages
);

protectedRouter.delete(
  "/:imageId",
  validate({ params: imageIdParamSchema }),
  deleteImage
);

router.delete("/deleteSingleImage/:imageUrl", deleteImage);


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
