const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-secret";

function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Bearer token is required"
    });
  }

  try {
    req.user = jwt.verify(header.substring(7), SECRET);
    next();
  } catch {
    return res.status(401).json({
      code: "INVALID_TOKEN",
      message: "Invalid or expired token"
    });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        code: "FORBIDDEN",
        message: "You do not have permission"
      });
    }
    next();
  };
}

module.exports = { auth, allowRoles, SECRET };
