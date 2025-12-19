import { generateAccessToken, generateRefreshToken } from "../../utils/jwt.js";
import User from "../user/user.model.js";
import bcrypt from "bcryptjs";

const login = async (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }
    if (!password) {
      return res.status(400).json({
        message: "Password is required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const accessToken = generateAccessToken({
      userId: user._id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id,
    });

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};

const logout = async (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  try {
    res.clearCookie("accessToken", {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      path: "/",
    });

    res.status(201).json({
      success: true,
      message: "Logged out successfully!",
      body: null,
    });
  } catch (error) {
    console.log("error at auth.controller.ts LOGOUT::", error.message);
    res.status(500).json({
      success: false,
      message: "Could not logout try again!",
    });
  }
};

export const AuthControllers = {
  login,
  logout,
};
