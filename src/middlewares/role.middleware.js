export const requireRole = (...requiredRoles) => (req, res, next) => {
  console.log('Authorization check:', {
    hasUser: Boolean(req.user),
    role: req.user?.role,
    requiredRoles,
  });
  
  if (!req.user || !requiredRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
    });
  }

  return next();
};
