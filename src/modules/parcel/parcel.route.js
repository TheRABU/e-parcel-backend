import { Router } from "express";
import { ParcelController } from "./parcel.controller.js";
import { checkAuth } from "../../middlewares/checkAuth.js";

const parcelRoutes = Router();

parcelRoutes.post(
  "/book-parcel",
  checkAuth("customer"),
  ParcelController.bookParcel
);

export default parcelRoutes;
