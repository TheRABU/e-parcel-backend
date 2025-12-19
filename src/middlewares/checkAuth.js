import jwt from "jsonwebtoken";
import User from "../modules/user/user.model.js";

export const checkAuth = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const token =
        req.cookies.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Please login again! No token found",
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: "Invalid token! Please login again",
        });
      }

      const user = await User.findById(decoded.userId).select("-password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User does not exist",
        });
      }

      // Check if user account is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "Your account has been deactivated",
        });
      }

      // Check role-based access
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to access this route",
        });
      }

      req.user = {
        userId: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      };

      next();
    } catch (error) {
      console.error("Authentication error:", error.message);
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token! Please login again",
        });
      }

      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired! Please login again",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Authentication failed",
        error: error.message,
      });
    }
  };
};
