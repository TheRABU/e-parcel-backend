import Notification from "../notification/notification.model.js";
import Parcel from "../parcel/parcel.model.js";
import User from "../user/user.model.js";

const applyForAgent = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { vehicleType, vehicleNumber } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Didn't find any userId maybe expired please login again!",
      });
    }
    if (!vehicleType || !vehicleNumber) {
      return res.status(400).json({
        success: false,
        message: "Vehicle type and vehicle number are required",
      });
    }

    const validVehicleTypes = ["bike", "car", "van"];
    if (!validVehicleTypes.includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        message: `Vehicle type must be one of: ${validVehicleTypes.join(", ")}`,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "agent") {
      return res.status(400).json({
        success: false,
        message: "You are already registered as a delivery agent",
      });
    }

    user.agentDetails = {
      vehicleType,
      vehicleNumber,
      isAvailable: true,
      currentLocation: {
        type: "Point",
        coordinates: [0, 0],
      },
      totalDeliveries: 0,
      rating: 0,
    };
    // send admin notification
    const adminNotification = new Notification({
      userId: userId,
      type: "in-app",
      title: "New Agent Application",
      message: `${user.name} (${user.email}) has applied to become a delivery agent. Vehicle: ${vehicleType} - ${vehicleNumber}`,
      status: "pending",
      metadata: {
        applicationType: "agent",
        applicantId: userId,
        applicantName: user.name,
        vehicleType,
        vehicleNumber,
      },
    });

    await user.save();
    await adminNotification.save();
    res.status(200).json({
      success: true,
      message:
        "Agent application submitted successfully. Admin approval required.",
      data: {
        name: user.name,
        email: user.email,
        vehicleType,
        vehicleNumber,
        applicationDate: new Date(),
      },
    });
  } catch (error) {
    console.log("Could not apply error hoise", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to submit application",
    });
  }
};

const getAssignedParcels = async (req, res) => {
  try {
    const agentId = req.user.userId;
    const { status } = req.query;

    const agent = await User.findById(agentId);
    if (agent.role !== "agent") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only agents can view assigned parcels.",
      });
    }

    const filter = { agentId };

    if (status && status !== "all") {
      filter.status = status;
    }

    const parcels = await Parcel.find(filter)
      .populate("customerId", "name phone")
      .sort({ createdAt: -1 })
      .lean();

    const formattedParcels = parcels.map((parcel) => ({
      id: parcel._id,
      trackingNumber: parcel.trackingNumber,
      status: parcel.status,
      customer: {
        name: parcel.customerId.name,
        phone: parcel.customerId.phone,
      },
      pickup: {
        address: parcel.pickupLocation.address,
        coordinates: parcel.pickupLocation.coordinates,
      },
      delivery: {
        address: parcel.deliveryLocation.address,
        coordinates: parcel.deliveryLocation.coordinates,
      },
      parcelDetails: {
        type: parcel.parcelDetails.type,
        size: parcel.parcelDetails.size,
        weight: parcel.parcelDetails.weight,
      },
      payment: {
        method: parcel.paymentDetails.paymentMethod,
        amount: parcel.paymentDetails.amount,
        codAmount: parcel.paymentDetails.codAmount,
        isPaid: parcel.paymentDetails.isPaid,
      },
      estimatedDeliveryDate: parcel.estimatedDeliveryDate,
      createdAt: parcel.createdAt,
    }));

    // Get agent statistics
    const stats = {
      totalAssigned: parcels.length,
      pending: parcels.filter((p) => p.status === "assigned").length,
      pickedUp: parcels.filter((p) => p.status === "picked-up").length,
      inTransit: parcels.filter((p) => p.status === "in-transit").length,
      outForDelivery: parcels.filter((p) => p.status === "out-for-delivery")
        .length,
      delivered: parcels.filter((p) => p.status === "delivered").length,
      failed: parcels.filter((p) => p.status === "failed").length,
    };

    res.status(200).json({
      success: true,
      data: {
        parcels: formattedParcels,
        statistics: stats,
        agent: {
          name: agent.name,
          vehicleType: agent.agentDetails.vehicleType,
          vehicleNumber: agent.agentDetails.vehicleNumber,
          totalDeliveries: agent.agentDetails.totalDeliveries || 0,
          rating: agent.agentDetails.rating || 0,
          isAvailable: agent.agentDetails.isAvailable,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching assigned parcels:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch assigned parcels",
    });
  }
};

const updateParcelStatus = async (req, res) => {
  try {
    const agentId = req.user.userId;
    const { parcelId } = req.params;
    const { status, remarks } = req.body;

    const agent = await User.findById(agentId);
    if (agent.role !== "agent") {
      return res.status(403).json({
        success: false,
        message: "Only agents can update parcel status",
      });
    }

    const allowedStatuses = [
      "picked-up",
      "in-transit",
      "out-for-delivery",
      "delivered",
      "failed",
    ];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}`,
      });
    }

    const parcel = await Parcel.findById(parcelId);

    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Parcel not found",
      });
    }

    if (parcel.agentId.toString() !== agentId) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this parcel",
      });
    }

    const oldStatus = parcel.status;
    parcel.status = status;

    parcel.statusHistory.push({
      status,
      timestamp: new Date(),
      remarks: remarks || `Status updated by agent: ${agent.name}`,
      updatedBy: agentId,
    });

    if (status === "delivered") {
      parcel.actualDeliveryDate = new Date();

      agent.agentDetails.totalDeliveries =
        (agent.agentDetails.totalDeliveries || 0) + 1;
      await agent.save();
    }

    if (status === "failed") {
      parcel.attemptCount = (parcel.attemptCount || 0) + 1;
    }

    await parcel.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`user:${parcel.customerId}`).emit("parcel:status-updated", {
        parcelId: parcel._id,
        trackingNumber: parcel.trackingNumber,
        oldStatus,
        newStatus: status,
        agentName: agent.name,
        timestamp: new Date(),
      });

      io.to(`tracking:${parcel.trackingNumber}`).emit("status-updated", {
        trackingNumber: parcel.trackingNumber,
        status,
        timestamp: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: `Parcel status updated to ${status}`,
      data: {
        parcelId: parcel._id,
        trackingNumber: parcel.trackingNumber,
        oldStatus,
        newStatus: status,
        updatedAt: parcel.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating parcel status:", error.message);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid parcel ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update parcel status",
    });
  }
};

const updateAgentLocation = async (req, res) => {
  try {
    const agentId = req.user.userId;
    const { latitude, longitude } = req.body;

    const agent = await User.findById(agentId);
    if (agent.role !== "agent") {
      return res.status(403).json({
        success: false,
        message: "Only agents can update location",
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    agent.agentDetails.currentLocation = {
      type: "Point",
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
    };

    await agent.save();

    const activeParcels = await Parcel.find({
      agentId,
      status: { $in: ["picked-up", "in-transit", "out-for-delivery"] },
    }).select("trackingNumber customerId");

    const io = req.app.get("io");
    if (io) {
      activeParcels.forEach((parcel) => {
        io.to(`tracking:${parcel.trackingNumber}`).emit("location-updated", {
          trackingNumber: parcel.trackingNumber,
          location: { lat: latitude, lng: longitude },
          agentId,
          agentName: agent.name,
          timestamp: new Date(),
        });

        Parcel.findByIdAndUpdate(parcel._id, {
          "agentInformation.currentLocation.coordinates": {
            lat: parseFloat(latitude),
            lng: parseFloat(longitude),
          },
          "agentInformation.currentLocation.updatedAt": new Date(),
        }).exec(); // don't await run in background
      });
    }

    res.status(200).json({
      success: true,
      message: "Location updated successfully",
      data: {
        agentId,
        location: { lat: latitude, lng: longitude },
        updatedAt: new Date(),
        activeParcels: activeParcels.length,
      },
    });
  } catch (error) {
    console.error("Error updating agent location:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update location",
    });
  }
};

const toggleAvailability = async (req, res) => {
  try {
    const agentId = req.user.userId;
    const { isAvailable } = req.body;

    const agent = await User.findById(agentId);
    if (agent.role !== "agent") {
      return res.status(403).json({
        success: false,
        message: "Only agents can update availability",
      });
    }

    // update availability
    agent.agentDetails.isAvailable =
      isAvailable !== undefined ? isAvailable : !agent.agentDetails.isAvailable;

    await agent.save();

    res.status(200).json({
      success: true,
      message: `Availability updated to: ${
        agent.agentDetails.isAvailable ? "Available" : "Unavailable"
      }`,
      data: {
        agentId,
        name: agent.name,
        isAvailable: agent.agentDetails.isAvailable,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error toggling availability:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update availability",
    });
  }
};

// admin
const approveAgentApplication = async (req, res) => {
  try {
    const adminId = req.user.userId;
    const { userId } = req.params;

    const admin = await User.findById(adminId);
    if (admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can approve agent applications",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "agent") {
      return res.status(400).json({
        success: false,
        message: "User is already an agent",
      });
    }
    user.role = "agent";
    await user.save();

    //  notification for the new agent
    const agentNotification = new Notification({
      userId: userId,
      type: "in-app",
      title: "Agent Application Approved!",
      message: `Congratulations! Your agent application has been approved by admin. You can now login to the agent portal.`,
      status: "sent",
    });

    await agentNotification.save();
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${userId}`).emit("notification:new", {
        notificationId: agentNotification._id,
        title: "Agent Application Approved!",
        message:
          "Your agent application has been approved. You can now access the agent portal.",
        type: "in-app",
        createdAt: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: "Agent application approved successfully",
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        vehicleType: user.agentDetails.vehicleType,
        vehicleNumber: user.agentDetails.vehicleNumber,
        approvedBy: admin.name,
        approvedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error approving agent application:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to approve application",
    });
  }
};

const getPendingApplications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const admin = await User.findById(userId);
    if (admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can view pending applications",
      });
    }

    const pendingApplications = await User.find({
      role: "customer",
      "agentDetails.vehicleType": { $ne: null },
      "agentDetails.vehicleNumber": { $ne: null },
    }).select("name email phone createdAt agentDetails");

    const formattedApplications = pendingApplications.map((user) => ({
      userId: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      appliedOn: user.createdAt,
      vehicleType: user.agentDetails.vehicleType,
      vehicleNumber: user.agentDetails.vehicleNumber,
      isAvailable: user.agentDetails.isAvailable,
    }));

    res.status(200).json({
      success: true,
      data: {
        applications: formattedApplications,
        count: pendingApplications.length,
      },
    });
  } catch (error) {
    console.error("Error fetching pending applications:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending applications",
    });
  }
};

export const AgentControllers = {
  applyForAgent,
  getAssignedParcels,
  updateParcelStatus,
  updateAgentLocation,
  toggleAvailability,
  // admin
  approveAgentApplication,
  getPendingApplications,
};
