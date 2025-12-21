import { Router } from "express";
import { NotificationController } from "./notification.controller.js";
import { checkAuth } from "../../middlewares/checkAuth.js";

const notificationRouter = Router();

notificationRouter.post(
  "/",
  checkAuth("admin", "customer"),
  NotificationController.createNotification
);

notificationRouter.get(
  "/",
  checkAuth("customer"),
  NotificationController.getUserNotifications
);

notificationRouter.put(
  "/:notificationId/read",
  checkAuth("customer"),
  NotificationController.markAsRead
);

notificationRouter.put(
  "/mark-all-read",
  checkAuth("customer"),
  NotificationController.markAllAsRead
);

notificationRouter.delete(
  "/:notificationId",
  checkAuth("customer"),
  NotificationController.deleteNotification
);

export default notificationRouter;
