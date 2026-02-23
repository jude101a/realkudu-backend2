export const validate = ({ body, params, query } = {}) => (req, res, next) => {
  const applyValidated = (target, value) => {
    if (!target || typeof target !== "object") return;
    for (const key of Object.keys(target)) {
      delete target[key];
    }
    Object.assign(target, value);
  };

  const options = {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  };

  if (body) {
    const { error, value } = body.validate(req.body, options);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: error.details.map((d) => ({
            message: d.message,
            path: d.path.join("."),
          })),
        },
      });
    }
    if (req.body && typeof req.body === "object") {
      applyValidated(req.body, value);
    } else {
      req.body = value;
    }
  }

  if (params) {
    const { error, value } = params.validate(req.params, options);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid route parameters",
          details: error.details.map((d) => ({
            message: d.message,
            path: d.path.join("."),
          })),
        },
      });
    }
    applyValidated(req.params, value);
  }

  if (query) {
    const { error, value } = query.validate(req.query, options);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          details: error.details.map((d) => ({
            message: d.message,
            path: d.path.join("."),
          })),
        },
      });
    }
    applyValidated(req.query, value);
  }

  return next();
};
