import ImagesModel from "../../models/utility.models/images.js";

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

export const insertPropertyImage = wrap(async (req, res) => {
  const created = await ImagesModel.insertImage(req.body);
  return ok(res, created, "Image created successfully", undefined, 201);
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
  const deleted = await ImagesModel.deleteImage(req.params.imageId);
  if (!deleted) return fail(res, 404, "Image not found", "NOT_FOUND");
  return ok(res, deleted, "Image deleted successfully");
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
