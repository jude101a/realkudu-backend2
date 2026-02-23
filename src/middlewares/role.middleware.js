export const requireRole = (requiredRole) => (req, res, next) => {
  if (!req.user || req.user.role !== requiredRole) {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
    });
  }

  return next();
};
