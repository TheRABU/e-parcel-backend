import User from "./user.model.js";
import bcrypt from "bcryptjs";

const createUserWithEmailAndPass = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (typeof email !== "string" && !email) {
      return res.status(400).json({
        message: "Email is needed and must be a string",
      });
    }
    if (typeof password !== "string" && !password) {
      return res.status(400).json({
        message: "Password is needed and must be a string",
      });
    }
    if (typeof phone !== "string" && !phone) {
      return res.status(400).json({
        message: "Phone is needed and must be a string",
      });
    }

    const user = await User.findOne({ email: email });
    if (user) {
      return res.status(400).json({
        success: false,
        message: "User already exist please login",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const payload = {
      name,
      email,
      password: hashedPassword,
      phone,
    };

    const newUser = await User.create(payload);

    res.status(201).json({
      success: true,
      message: "User account created successfully!",
      user: newUser,
    });
  } catch (error) {
    console.log("error at creating user", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error could not sign up",
    });
  }
};

const getMe = async (req, res) => {
  try {
    const decodedToken = req.user;
    console.log("decoded token backend of getMe", decodedToken);

    const userId = decodedToken?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "No user ID",
      });
    }
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.log("error fetching user data", error);
    return res.status(500).json({
      success: false,
      message: "Could not get user's data please try later",
    });
  }
};

export const UserController = {
  createUserWithEmailAndPass,
  getMe,
};
