import ImagesModel from "../../models/utility.models/images.js";
import { v2 as cloudinary } from "cloudinary";

const CLOUDINARY_UPLOAD_FOLDER =
  process.env.CLOUDINARY_UPLOAD_FOLDER || "real-kudu/properties";

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
    if (error?.code === "LIMIT_FILE_SIZE") {
      return fail(res, 413, error.message || "Uploaded file is too large", "FILE_TOO_LARGE");
    }

    if (error?.code === "INVALID_FILE_TYPE" || error?.code === "NO_FILE") {
      return fail(res, 400, error.message, error.code);
    }

    if (error?.code === "CLOUDINARY_UPLOAD_ERROR") {
      return fail(res, 502, "Cloudinary upload failed", error.code, error.details);
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

const uploadToCloudinary = async (file) => {
  assertCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_UPLOAD_FOLDER,
        resource_type: "auto",
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          const uploadError = new Error(error.message || "Cloudinary upload failed");
          uploadError.code = "CLOUDINARY_UPLOAD_ERROR";
          uploadError.details = mapCloudinaryError(error);
          reject(uploadError);
          return;
        }

        resolve(result);
      }
    );

    stream.end(file.buffer);
  });
};

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

const toMediaPayload = ({ propertyId, isCover, file, upload }) => ({
  propertyId,
  imageUrl: upload.secure_url,
  publicId: upload.public_id,
  filename: upload.original_filename || file.originalname,
  originalFilename: file.originalname,
  mimeType: file.mimetype,
  resourceType: upload.resource_type,
  size: file.size,
  format: upload.format,
  width: upload.width ?? null,
  height: upload.height ?? null,
  duration: upload.duration ?? null,
  isCover,
});

export const insertPropertyImage = wrap(async (req, res) => {
  if (!req.file) {
    const error = new Error("A media file is required");
    error.code = "NO_FILE";
    throw error;
  }

  const upload = await uploadToCloudinary(req.file);
  const created = await ImagesModel.insertImage(
    toMediaPayload({
      propertyId: req.body.propertyId,
      isCover: req.body.isCover === true || req.body.isCover === "true",
      file: req.file,
      upload,
    })
  );

  return ok(res, created, "Media uploaded successfully", undefined, 201);
});

export const insertMultipleImages = wrap(async (req, res) => {
  const files = req.files || [];

  if (!files.length) {
    const error = new Error("At least one media file is required");
    error.code = "NO_FILE";
    throw error;
  }

  const uploads = [];

  try {
    for (const file of files) {
      uploads.push(await uploadToCloudinary(file));
    }
  } catch (error) {
    await Promise.allSettled(
      uploads.map((upload) =>
        deleteFromCloudinary({
          publicId: upload.public_id,
          resourceType: upload.resource_type,
        })
      )
    );
    throw error;
  }

  const isCoverIndex = Number(req.body.coverIndex);
  const images = uploads.map((upload, index) =>
    toMediaPayload({
      propertyId: req.body.propertyId,
      isCover: Number.isInteger(isCoverIndex) && isCoverIndex === index,
      file: files[index],
      upload,
    })
  );

  const created = await ImagesModel.insertMultipleImages(req.body.propertyId, images);
  return ok(res, created, "Media uploaded successfully", undefined, 201);
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
export { uploadToCloudinary, toMediaPayload, deleteFromCloudinary };
