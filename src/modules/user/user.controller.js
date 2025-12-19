import User from "./user.model";
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

    const hashedPassword = bcrypt.hash(password, process.env.SALT_ROUNDS);

    const payload = {
      name,
      email,
      password: hashedPassword,
      phone,
    };

    await User.create(payload);

    res.status(201).json({
      success: true,
      message: "User account created successfully!",
      user,
    });
  } catch (error) {
    console.log("error at creating user", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error could not sign up",
    });
  }
};

export const UserController = {
  createUserWithEmailAndPass,
};
