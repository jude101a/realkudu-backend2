export const requireRole = (...requiredRoles) => (req, res, next) => {
  if (!req.user || !requiredRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
    });
  }

  return next();
};
