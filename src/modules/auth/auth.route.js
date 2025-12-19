import { Router } from "express";
import { AuthControllers } from "./auth.controller";

const authRoutes = Router();

authRoutes.post("/login", AuthControllers.login);
authRoutes.post("/logout", AuthControllers.logout);

export default authRoutes;
