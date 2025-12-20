import { Router } from "express";
import { ParcelController } from "./parcel.controller.js";
import { checkAuth } from "../../middlewares/checkAuth.js";

const parcelRoutes = Router();

// /api/v1/parcel route

parcelRoutes.post(
  "/book-parcel",
  checkAuth("customer"),
  ParcelController.bookParcel
);

parcelRoutes.get(
  "/my-parcel",
  checkAuth("customer"),
  ParcelController.myParcelHistory
);

export default parcelRoutes;
