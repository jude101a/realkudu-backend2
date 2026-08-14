import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }

  try {
    console.log("JWT_SECRET:", process.env.JWT_SECRET);
    console.log("TOKEN:", token);

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = payload;

    next();

} catch (err) {

    console.error(err);

    return res.status(401).json({
        success: false,
        error: err.message,
    });

}
};
