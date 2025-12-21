import Notification from "./notification.model.js";

const getIO = (req) => {
  return req.app.get("io");
};

const createNotification = async (req, res) => {
  try {
    const { parcelId, type, title, message, sendSocket = true } = req.body;

    const userId = req.user.userId;

    if (!userId || !title || !message || !type) {
      return res.status(400).json({
        success: false,
        message: "userId, title, message, and type are required",
      });
    }

    const validTypes = ["email", "sms", "push", "in-app"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Type must be one of: ${validTypes.join(", ")}`,
      });
    }

    const notification = new Notification({
      userId,
      parcelId,
      type,
      title,
      message,
      status: "pending",
      isRead: false,
    });

    await notification.save();

    if (sendSocket) {
      try {
        const io = getIO(req);
        if (io) {
          io.to(`user:${userId}`).emit("notification:new", {
            notificationId: notification._id,
            userId,
            title,
            message,
            type,
            createdAt: notification.createdAt,
            isRead: false,
            parcelId: parcelId || null,
          });

          notification.status = "sent";
          notification.sentAt = new Date();
          await notification.save();

          console.log(`Real-time notification sent to user: ${userId}`);
        }
      } catch (socketError) {
        console.error("Socket.IO error:", socketError.message);
      }
    }

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: {
        notification: {
          id: notification._id,
          userId,
          title,
          message,
          type,
          status: notification.status,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
        },
        socketDelivered: sendSocket,
      },
    });
  } catch (error) {
    console.error("Error creating notification:", error.message);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create notification",
    });
  }
};

// Get user notifications
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { unreadOnly = false, limit = 20, page = 1 } = req.query;

    const query = { userId };
    if (unreadOnly === "true") {
      query.isRead = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("parcelId", "trackingNumber status")
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    const formattedNotifications = notifications.map((notif) => ({
      id: notif._id,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      status: notif.status,
      isRead: notif.isRead,
      parcel: notif.parcelId
        ? {
            trackingNumber: notif.parcelId.trackingNumber,
            status: notif.parcelId.status,
          }
        : null,
      createdAt: notif.createdAt,
      readAt: notif.readAt,
      sentAt: notif.sentAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        notifications: formattedNotifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
        unreadCount,
        userId,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOne({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found or unauthorized",
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    try {
      const io = getIO(req);
      if (io) {
        io.to(`user:${userId}`).emit("notification:read", {
          notificationId: notification._id,
          readAt: notification.readAt,
        });
      }
    } catch (socketError) {
      console.error("Socket.IO error:", socketError.message);
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: {
        notificationId: notification._id,
        isRead: notification.isRead,
        readAt: notification.readAt,
      },
    });
  } catch (error) {
    console.error("Error marking notification as read:", error.message);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await Notification.updateMany(
      { userId, isRead: false },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    try {
      const io = getIO(req);
      if (io) {
        io.to(`user:${userId}`).emit("notification:all-read", {
          userId,
          updatedCount: result.modifiedCount,
          timestamp: new Date(),
        });
      }
    } catch (socketError) {
      console.error("Socket.IO error:", socketError.message);
    }

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: {
        userId,
        updatedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found or unauthorized",
      });
    }

    try {
      const io = getIO(req);
      if (io) {
        io.to(`user:${userId}`).emit("notification:deleted", {
          notificationId: notification._id,
        });
      }
    } catch (socketError) {
      console.error("Socket.IO error:", socketError.message);
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
      data: {
        notificationId: notification._id,
      },
    });
  } catch (error) {
    console.error("Error deleting notification:", error.message);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
};

export const NotificationService = {
  sendParcelStatusNotification: async (parcel, newStatus, io = null) => {
    try {
      const statusMessages = {
        assigned: `Your parcel ${parcel.trackingNumber} has been assigned to a delivery agent`,
        "picked-up": `Your parcel ${parcel.trackingNumber} has been picked up`,
        "in-transit": `Your parcel ${parcel.trackingNumber} is in transit`,
        "out-for-delivery": `Your parcel ${parcel.trackingNumber} is out for delivery`,
        delivered: `Your parcel ${parcel.trackingNumber} has been delivered successfully`,
        failed: `Delivery failed for parcel ${parcel.trackingNumber}. Reason: ${
          parcel.failureReason || "Unknown"
        }`,
      };

      const message =
        statusMessages[newStatus] ||
        `Your parcel ${parcel.trackingNumber} status changed to ${newStatus}`;

      const notification = new Notification({
        userId: parcel.customerId,
        parcelId: parcel._id,
        type: "in-app",
        title: "Parcel Status Update",
        message: message,
        status: "pending",
      });

      await notification.save();

      if (io) {
        notification.status = "sent";
        notification.sentAt = new Date();
        await notification.save();

        io.to(`user:${parcel.customerId}`).emit("notification:new", {
          notificationId: notification._id,
          userId: parcel.customerId,
          title: "Parcel Status Update",
          message: message,
          type: "in-app",
          createdAt: notification.createdAt,
          isRead: false,
          parcelId: parcel._id,
          trackingNumber: parcel.trackingNumber,
          status: newStatus,
        });
      }

      return notification;
    } catch (error) {
      console.error("Error sending parcel notification:", error);
      return null;
    }
  },

  sendPaymentNotification: async (
    userId,
    parcelId,
    paymentMethod,
    amount,
    isSuccessful,
    io = null
  ) => {
    try {
      const title = isSuccessful ? "Payment Successful" : "Payment Failed";
      const message = isSuccessful
        ? `Payment of ${amount} via ${paymentMethod} was successful`
        : `Payment of ${amount} via ${paymentMethod} failed. Please try again.`;

      const notification = new Notification({
        userId,
        parcelId,
        type: "in-app",
        title,
        message,
        status: "pending",
      });

      await notification.save();

      if (io) {
        notification.status = "sent";
        notification.sentAt = new Date();
        await notification.save();

        io.to(`user:${userId}`).emit("notification:new", {
          notificationId: notification._id,
          userId,
          title,
          message,
          type: "in-app",
          createdAt: notification.createdAt,
          isRead: false,
          parcelId,
        });
      }

      return notification;
    } catch (error) {
      console.error("Error sending payment notification:", error);
      return null;
    }
  },
};

export const NotificationController = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
