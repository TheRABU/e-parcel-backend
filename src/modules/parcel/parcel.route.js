import { Router } from "express";
import { ParcelController } from "./parcel.controller.js";
import { checkAuth } from "../../middlewares/checkAuth.js";

const parcelRoutes = Router();

// /api/v1/parcel route

// add parcel
parcelRoutes.post(
  "/book-parcel",
  checkAuth("customer"),
  ParcelController.bookParcel
);
// get user parcels
parcelRoutes.get(
  "/my-parcel",
  checkAuth("customer"),
  ParcelController.myParcelHistory
);

// update myParcel
parcelRoutes.put(
  "/update/:parcelId",
  checkAuth("customer"),
  ParcelController.updateMyParcel
);
// track parcel
parcelRoutes.get(
  "/track/:trackingNumber",
  checkAuth("customer", "admin", "agent"),
  ParcelController.trackParcel
);

//admin
parcelRoutes.get(
  "/all-parcel",
  checkAuth("admin"),
  ParcelController.pendingParcels
);

export default parcelRoutes;
