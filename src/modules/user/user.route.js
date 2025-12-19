import { Router } from "express";
import { UserController } from "./user.controller.js";
import { checkAuth } from "../../middlewares/checkAuth.js";
import { Roles } from "../../constants/index.js";

const userRoutes = Router();

userRoutes.post("/register", UserController.createUserWithEmailAndPass);
userRoutes.get(
  "/me",
  checkAuth(...Object.values(...Roles)),
  UserController.getMe
);

export default userRoutes;
