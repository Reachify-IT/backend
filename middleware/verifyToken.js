const jwt = require("jsonwebtoken");

// 🔹 Middleware to Verify JWT Token
const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization; // No 'Bearer ' prefix

    if (!token) {
      console.error("❌ No token found in Authorization header!");
      return res
        .status(401)
        .json({ message: "Unauthorized - No Token Provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; // Attach user details to req
    console.log("✅ Verified User:", req.user);
    next();
  } catch (err) {
    console.error("❌ Token Verification Error:", err.message);
    res.status(403).json({ message: "Invalid or Expired Token" });
  }
};

// 🔹 Middleware for Role-Based Authorization
const authorizeRoles =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      console.error(
        `❌ Unauthorized Access - User Role: ${req.user?.role || "None"}`
      );
      return res
        .status(403)
        .json({ message: "Forbidden - Insufficient Permissions" });
    }
    console.log(`✅ Access Granted - User Role: ${req.user.role}`);
    next();
  };

module.exports = { verifyToken, authorizeRoles };
