import LocationService from "../../services/locationService.js";

const setupTrackingHandlers = (io, socket) => {
  socket.on("agent:location-update", async (data) => {
    try {
      const { latitude, longitude, agentId } = data;

      if (socket.userId !== agentId) {
        return socket.emit("error", {
          message: "Unauthorized location update",
        });
      }

      const updateResult = await LocationService.updateAgentLocation(
        agentId,
        latitude,
        longitude
      );

      const activeParcels = await Parcel.find({
        agentId,
        status: { $in: ["picked-up", "in-transit", "out-for-delivery"] },
      }).select("trackingNumber");

      activeParcels.forEach((parcel) => {
        io.to(`tracking:${parcel.trackingNumber}`).emit(
          "parcel:location-updated",
          {
            trackingNumber: parcel.trackingNumber,
            location: { lat: latitude, lng: longitude },
            agentId,
            timestamp: new Date(),
            source: "realtime",
          }
        );
      });

      socket.emit("agent:location-acknowledged", {
        success: true,
        timestamp: new Date(),
        parcelsUpdated: updateResult.updatedParcelsCount,
      });
    } catch (error) {
      console.error("Socket location update error:", error);
      socket.emit("error", { message: "Failed to update location" });
    }
  });

  // Customer joins tracking room
  socket.on("tracking:join", (trackingNumber) => {
    socket.join(`tracking:${trackingNumber}`);
    console.log(`Socket ${socket.id} joined tracking room: ${trackingNumber}`);
  });

  // Customer leaves tracking room
  socket.on("tracking:leave", (trackingNumber) => {
    socket.leave(`tracking:${trackingNumber}`);
  });

  // Admin/Agent tracking view
  socket.on("admin:track-parcel", async (trackingNumber) => {
    if (!["admin", "agent"].includes(socket.userRole)) {
      return socket.emit("error", { message: "Unauthorized" });
    }

    socket.join(`admin:tracking:${trackingNumber}`);
  });
};

export default setupTrackingHandlers;
