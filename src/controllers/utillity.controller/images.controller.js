import ImagesModel from "../../models/utility.models/images.js";
import { v2 as cloudinary } from "cloudinary";

const mapCloudinaryError = (error) => ({
  message: error?.message,
  httpCode: error?.http_code,
  name: error?.name,
});

const ok = (res, data, message = "Success", meta = undefined, status = 200) =>
  res.status(status).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });

const fail = (res, status, message, code = "BAD_REQUEST", details = undefined) =>
  res.status(status).json({
    success: false,
    error: { code, message, details },
  });

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    if (error?.code === "NO_IMAGES" || error?.code === "VALIDATION_ERROR") {
      return fail(res, 400, error.message, error.code);
    }

    if (error?.code === "CLOUDINARY_DELETE_ERROR") {
      return fail(res, 502, "Cloudinary delete failed", error.code, error.details);
    }

    if (error?.code === "22P02") {
      return fail(res, 400, "Invalid identifier format", "VALIDATION_ERROR");
    }

    if (error?.code === "23503") {
      return fail(res, 400, "Invalid related resource reference", "FK_CONSTRAINT");
    }

    console.error("[images.controller] unhandled error", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
    });

    const details =
      process.env.NODE_ENV !== "production"
        ? { message: error?.message, code: error?.code, detail: error?.detail }
        : undefined;

    return fail(res, 500, "Internal server error", "INTERNAL_ERROR", details);
  }
};

const assertCloudinaryConfigured = () => {
  if (process.env.CLOUDINARY_URL) {
    return;
  }

  const missing = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]
    .filter((key) => !process.env[key]);

  if (missing.length) {
    const error = new Error(`Missing Cloudinary configuration: ${missing.join(", ")}`);
    error.code = "CLOUDINARY_UPLOAD_ERROR";
    error.details = { missing };
    throw error;
  }
};

// Deletion from Cloudinary is still a legitimate backend responsibility
// (the client shouldn't hold delete-capable credentials), so this stays.
const deleteFromCloudinary = async ({ publicId, resourceType = "image" }) => {
  if (!publicId) return null;
  assertCloudinaryConfigured();

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });

    if (result?.result && !["ok", "not found"].includes(result.result)) {
      const error = new Error(`Cloudinary delete returned ${result.result}`);
      error.code = "CLOUDINARY_DELETE_ERROR";
      error.details = result;
      throw error;
    }

    return result;
  } catch (error) {
    if (error?.code === "CLOUDINARY_DELETE_ERROR") throw error;
    const deleteError = new Error(error.message || "Cloudinary delete failed");
    deleteError.code = "CLOUDINARY_DELETE_ERROR";
    deleteError.details = mapCloudinaryError(error);
    throw deleteError;
  }
};

/**
 * Builds the DB payload for one image entry from client-supplied data.
 * The client uploads directly to Cloudinary and sends back whatever
 * metadata it has — only imageUrl is guaranteed; everything else is
 * optional and defaults to null if the client doesn't send it.
 */
const toMediaPayload = ({ propertyId, isCover, image }) => ({
  propertyId,
  imageUrl: image.imageUrl,
  publicId: image.publicId ?? null,
  filename: image.filename ?? null,
  mimeType: image.mimeType ?? null,
  resourceType: image.resourceType ?? "image",
  size: image.size ?? null,
  format: image.format ?? null,
  width: image.width ?? null,
  height: image.height ?? null,
  duration: image.duration ?? null,
  isCover,
});

export const insertPropertyImage = wrap(async (req, res) => {
  const { propertyId, imageUrl } = req.body || {};

  if (!imageUrl) {
    const error = new Error("imageUrl is required");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  if (!propertyId) {
    const error = new Error("propertyId is required");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  const created = await ImagesModel.insertImage(
    toMediaPayload({
      propertyId,
      isCover: req.body.isCover === true || req.body.isCover === "true",
      image: req.body,
    })
  );

  return ok(res, created, "Media registered successfully", undefined, 201);
});

export const insertMultipleImages = wrap(async (req, res) => {
  const { propertyId } = req.body || {};
  const bodyImages = Array.isArray(req.body?.images) ? req.body.images : [];

  if (!propertyId) {
    const error = new Error("propertyId is required");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  if (!bodyImages.length) {
    const error = new Error("At least one image is required");
    error.code = "NO_IMAGES";
    throw error;
  }

  const images = bodyImages.map((image, index) =>
    toMediaPayload({
      propertyId,
      isCover: Boolean(image.isCover),
      image,
    })
  );

  const created = await ImagesModel.insertMultipleImages(propertyId, images);
  return ok(res, created, "Media registered successfully", undefined, 201);
});

export const getPropertyImage = wrap(async (req, res) => {
  const images = await ImagesModel.getPropertyImage(req.params.propertyId);
  return ok(res, images, "Property images retrieved successfully", {
    total: images.length,
    propertyId: req.params.propertyId,
  });
});

export const getMultiplePropertyImages = wrap(async (req, res) => {
  const { propertyIds } = req.body;
  const images = await ImagesModel.getPropertyImagesByPropertyIds(propertyIds);

  return ok(res, images, "Property images retrieved successfully", {
    total: images.length,
    propertyIds,
  });
});

export const deleteImage = wrap(async (req, res) => {
  const image = req.params.imageId
    ? await ImagesModel.findImageById(req.params.imageId)
    : null;

  if (req.params.imageId && !image) {
    return fail(res, 404, "Media not found", "NOT_FOUND");
  }

  if (image?.publicId) {
    await deleteFromCloudinary({
      publicId: image.publicId,
      resourceType: image.resourceType,
    });
  }

  const deleted = req.params.imageId
    ? await ImagesModel.deleteImageById(req.params.imageId)
    : await ImagesModel.deleteImage(req.params.imageUrl);

  if (!deleted) return fail(res, 404, "Media not found", "NOT_FOUND");

  return ok(res, deleted, "Media deleted successfully");
});

export const deletePropertyImages = wrap(async (req, res) => {
  const deleted = await ImagesModel.deletePropertyImages(req.params.propertyId);
  return ok(res, deleted, "Property images deleted successfully", {
    deletedCount: deleted.length,
    propertyId: req.params.propertyId,
  });
});

export const bulkDeletePropertyImages = wrap(async (req, res) => {
  const { propertyIds } = req.body;
  const deleted = await ImagesModel.bulkDeletePropertyImages(propertyIds);

  return ok(res, deleted, "Property images deleted successfully", {
    deletedCount: deleted.length,
    propertyIds,
  });
});

// Export helpers for reuse in other controllers
export { toMediaPayload, deleteFromCloudinary };