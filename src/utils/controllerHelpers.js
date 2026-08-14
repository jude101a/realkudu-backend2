export const wrapHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    console.error("[controller] unhandled error", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    // Common DB errors
    if (error?.code === "23503") {
      return res.status(400).json({ success: false, error: { code: "FK_CONSTRAINT", message: "Invalid related resource reference" } });
    }
    if (error?.code === "22P02") {
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid identifier format" } });
    }

    return res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  }
};
