// routes/adminRoutes.js
import { Router } from "express";
import { AdminController } from "./admin.controller.js";
import { checkAuth } from "../../middlewares/checkAuth.js";

const adminRouter = Router();

adminRouter.use(checkAuth("admin"));

// Dashboard metrics
adminRouter.get("/dashboard-metrics", AdminController.getDashboardMetrics);

// Get all parcels with filters
adminRouter.get("/parcels", AdminController.getAllParcels);

// Assign agent to parcel
adminRouter.post("/assign-agent", AdminController.assignAgentToParcel);

// Get statistics for charts
adminRouter.get("/statistics", AdminController.getStatistics);

// Export reports
adminRouter.get("/export-report", AdminController.exportReport);

export default adminRouter;
