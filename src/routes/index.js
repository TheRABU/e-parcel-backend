import { Router } from "express";
import userRoutes from "../modules/user/user.route.js";
import authRoutes from "../modules/auth/auth.route.js";
import parcelRoutes from "../modules/parcel/parcel.route.js";

const router = Router();

const moduleRoutes = [
  {
    path: "/user",
    route: userRoutes,
  },
  {
    path: "/auth",
    route: authRoutes,
  },
  {
    path: "/parcel",
    route: parcelRoutes,
  },
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
