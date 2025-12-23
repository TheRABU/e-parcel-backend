import app from "./app.js";
import { connectDatabase } from "./config/db.js";
import { createServer } from "http";
import { Server } from "socket.io";

let server;
let io;

const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);

io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
});

// io.use(async (socket, next) => {
//   try {
//     const token = socket.handshake.auth.token;

//     if (!token) {

//       socket.isAuthenticated = false;
//       return next();
//     }

//     next();
//   } catch (error) {
//     console.error('Socket auth error:', error.message);
//     next(new Error('Authentication error'));
//   }
// });

io.on("connection", (socket) => {
  console.log(
    `Socket connected: ${socket.id} | Authenticated: ${
      socket.isAuthenticated || false
    }`
  );

  socket.on("join-tracking-room", (trackingNumber) => {
    socket.join(`tracking:${trackingNumber}`);
    console.log(`Socket ${socket.id} joined tracking room: ${trackingNumber}`);

    socket.emit("room-joined", {
      trackingNumber,
      message: "You are now tracking this parcel",
    });
  });

  // Agent sends location update
  socket.on("agent-location-update", async (data) => {
    try {
      const { trackingNumber, latitude, longitude, agentId } = data;

      if (!trackingNumber || !latitude || !longitude) {
        return socket.emit("error", { message: "Missing required fields" });
      }

      console.log(
        `Agent ${agentId} location update: ${trackingNumber} - ${latitude}, ${longitude}`
      );

      io.to(`tracking:${trackingNumber}`).emit("location-updated", {
        trackingNumber,
        location: { lat: latitude, lng: longitude },
        agentId,
        timestamp: new Date().toISOString(),
        socketId: socket.id,
      });

      socket.emit("location-update-ack", {
        success: true,
        trackingNumber,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Socket location update error:", error.message);
      socket.emit("error", {
        message: "Failed to update location",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  // notifications
  socket.on("join-notifications", (userId) => {
    if (socket.userId === userId) {
      socket.join(`user:${userId}`);
      console.log(
        `User ${userId} joined notification room via socket ${socket.id}`
      );
    }
  });

  socket.on("leave-notifications", (userId) => {
    socket.leave(`user:${userId}`);
  });

  // Request unread count
  socket.on("notifications:unread-count", async (userId) => {
    try {
      const unreadCount = await Notification.countDocuments({
        userId,
        isRead: false,
      });

      socket.emit("notifications:unread-count", { userId, unreadCount });
    } catch (error) {
      console.error("Error getting unread count:", error);
    }
  });
  // Admin/Agent joins admin room
  socket.on("join-admin-room", (roomId) => {
    socket.join(`admin:${roomId}`);
    console.log(`Socket ${socket.id} joined admin room: ${roomId}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id} | Reason: ${reason}`);
  });

  socket.on("error", (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

app.set("io", io);

async function startServer() {
  try {
    await connectDatabase();

    server = httpServer.listen(PORT, () => {
      console.log(`🚀 Server started successfully on PORT: ${PORT}`);
      console.log(`📡 Socket.IO server is ready for real-time tracking`);
    });
  } catch (error) {
    console.log("❌ Could not start the server:", error);
    process.exit(1);
  }
}

function setupGracefulShutdown() {
  process.on("SIGTERM", () => {
    console.log("🛑 SIGTERM signal received... Server shutting down..");
    gracefulShutdown();
  });

  process.on("SIGINT", () => {
    console.log("🛑 SIGINT signal received... Server shutting down..");
    gracefulShutdown();
  });

  process.on("unhandledRejection", (err) => {
    console.log("⚠️ Unhandled Rejection detected:", err);
    gracefulShutdown(err);
  });

  process.on("uncaughtException", (err) => {
    console.log("⚠️ Uncaught Exception detected:", err);
    gracefulShutdown(err);
  });
}

function gracefulShutdown(err = null) {
  console.log("🔄 Starting graceful shutdown...");

  if (io) {
    io.close(() => {
      console.log("📡 Socket.IO server closed");
    });
  }

  if (server) {
    server.close(() => {
      console.log("🚪 HTTP server closed");

      if (err) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    });
  } else {
    process.exit(err ? 1 : 0);
  }

  setTimeout(() => {
    console.log("⏰ Forcing shutdown due to timeout");
    process.exit(1);
  }, 10000);
}

(async () => {
  await startServer();
  setupGracefulShutdown();
})();

export { io, httpServer };
