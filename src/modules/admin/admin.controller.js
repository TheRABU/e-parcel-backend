import Parcel from "../parcel/parcel.model.js";
import User from "../user/user.model.js";

// Admin: Get dashboard metrics
const getDashboardMetrics = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Verify admin role
    const admin = await User.findById(userId);
    if (admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Last 7 days for trends
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    // 1. Daily Bookings (parcels created today)
    const dailyBookings = await Parcel.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    // 2. Failed deliveries (today)
    const failedDeliveries = await Parcel.countDocuments({
      status: "failed",
      updatedAt: { $gte: startOfDay, $lte: endOfDay },
    });

    // 3. COD amounts (today's COD parcels)
    const codParcels = await Parcel.find({
      "paymentDetails.paymentMethod": "cod",
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    let totalCOD = 0;
    let collectedCOD = 0;
    let pendingCOD = 0;

    codParcels.forEach((parcel) => {
      const codAmount = parcel.paymentDetails.codAmount || 0;
      totalCOD += codAmount;

      if (parcel.status === "delivered") {
        collectedCOD += codAmount;
      } else {
        pendingCOD += codAmount;
      }
    });

    // 4. Parcel status distribution
    const statusDistribution = await Parcel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          status: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    // 5. Revenue metrics
    const revenueMetrics = await Parcel.aggregate([
      {
        $match: {
          status: "delivered",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$paymentDetails.amount" },
          totalDelivered: { $sum: 1 },
        },
      },
    ]);

    // 6. Daily trends (last 7 days)
    const dailyTrends = await Parcel.aggregate([
      {
        $match: {
          createdAt: { $gte: last7Days },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          bookings: { $sum: 1 },
          revenue: { $sum: "$paymentDetails.amount" },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          date: "$_id",
          bookings: 1,
          revenue: 1,
          _id: 0,
        },
      },
    ]);

    // 7. User statistics
    const userStats = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    // 8. Recent activities (last 10 parcels)
    const recentActivities = await Parcel.find()
      .populate("customerId", "name")
      .populate("agentId", "name")
      .sort({ createdAt: -1 })
      .limit(10)
      .select("trackingNumber status paymentDetails.amount createdAt")
      .lean();

    // Format the response
    const formattedStatusDistribution = {};
    statusDistribution.forEach((item) => {
      formattedStatusDistribution[item.status] = item.count;
    });

    const formattedUserStats = {};
    userStats.forEach((item) => {
      formattedUserStats[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      message: "Dashboard metrics fetched successfully",
      data: {
        summary: {
          dailyBookings,
          failedDeliveries,
          totalCOD,
          collectedCOD,
          pendingCOD,
          totalRevenue: revenueMetrics[0]?.totalRevenue || 0,
          totalDelivered: revenueMetrics[0]?.totalDelivered || 0,
          totalParcels: await Parcel.countDocuments(),
          totalUsers: await User.countDocuments(),
          activeAgents: await User.countDocuments({
            role: "agent",
            "agentDetails.isAvailable": true,
          }),
        },
        statusDistribution: formattedStatusDistribution,
        userDistribution: formattedUserStats,
        dailyTrends,
        recentActivities,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard metrics:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard metrics",
    });
  }
};

// Admin: Get all parcels with filters
const getAllParcels = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Verify admin role
    const admin = await User.findById(userId);
    if (admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    const {
      status,
      startDate,
      endDate,
      paymentMethod,
      page = 1,
      limit = 20,
    } = req.query;

    // Build filter
    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (paymentMethod) {
      filter["paymentDetails.paymentMethod"] = paymentMethod;
    }

    // Date filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get parcels with pagination
    const parcels = await Parcel.find(filter)
      .populate("customerId", "name email phone")
      .populate("agentId", "name phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await Parcel.countDocuments(filter);

    // Format response
    const formattedParcels = parcels.map((parcel) => ({
      id: parcel._id,
      trackingNumber: parcel.trackingNumber,
      status: parcel.status,
      customer: {
        name: parcel.customerId?.name,
        email: parcel.customerId?.email,
        phone: parcel.customerId?.phone,
      },
      agent: parcel.agentId
        ? {
            name: parcel.agentId.name,
            phone: parcel.agentId.phone,
          }
        : null,
      pickupAddress: parcel.pickupLocation.address,
      deliveryAddress: parcel.deliveryLocation.address,
      parcelDetails: {
        type: parcel.parcelDetails.type,
        size: parcel.parcelDetails.size,
        weight: parcel.parcelDetails.weight,
      },
      paymentDetails: {
        method: parcel.paymentDetails.paymentMethod,
        amount: parcel.paymentDetails.amount,
        codAmount: parcel.paymentDetails.codAmount,
        isPaid: parcel.paymentDetails.isPaid,
      },
      estimatedDeliveryDate: parcel.estimatedDeliveryDate,
      actualDeliveryDate: parcel.actualDeliveryDate,
      createdAt: parcel.createdAt,
      updatedAt: parcel.updatedAt,
    }));

    res.status(200).json({
      success: true,
      message: "All parcels fetched successfully",
      data: {
        parcels: formattedParcels,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching all parcels:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch parcels",
    });
  }
};

// Admin: Assign agent to parcel
const assignAgentToParcel = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { parcelId, agentId } = req.body;

    // Verify admin role
    const admin = await User.findById(userId);
    if (admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    if (!parcelId || !agentId) {
      return res.status(400).json({
        success: false,
        message: "Parcel ID and Agent ID are required",
      });
    }

    // Find parcel
    const parcel = await Parcel.findById(parcelId);
    if (!parcel) {
      return res.status(404).json({
        success: false,
        message: "Parcel not found",
      });
    }

    // Find agent
    const agent = await User.findOne({
      _id: agentId,
      role: "agent",
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found or not an agent",
      });
    }

    // Check if agent is available
    if (!agent.agentDetails?.isAvailable) {
      return res.status(400).json({
        success: false,
        message: "Agent is not available for assignment",
      });
    }

    // Update parcel
    parcel.agentId = agentId;
    parcel.status = "assigned";
    parcel.agentInformation = {
      agentName: agent.name,
      currentLocation: parcel.agentInformation?.currentLocation || null,
    };

    // Add to status history
    parcel.statusHistory.push({
      status: "assigned",
      timestamp: new Date(),
      remarks: `Assigned to agent: ${agent.name} by admin`,
      updatedBy: userId,
    });

    await parcel.save();

    // Update agent's availability
    agent.agentDetails.isAvailable = false;
    await agent.save();

    // Send notification (optional - if you have notification system)
    // await sendAgentAssignmentNotification(agentId, parcel.trackingNumber);

    res.status(200).json({
      success: true,
      message: "Agent assigned successfully",
      data: {
        parcelId: parcel._id,
        trackingNumber: parcel.trackingNumber,
        agent: {
          id: agent._id,
          name: agent.name,
          phone: agent.phone,
          vehicleType: agent.agentDetails?.vehicleType,
        },
      },
    });
  } catch (error) {
    console.error("Error assigning agent:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to assign agent",
    });
  }
};

// Admin: Get statistics for charts
const getStatistics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { period = "monthly" } = req.query; // daily, weekly, monthly

    // Verify admin role
    const admin = await User.findById(userId);
    if (admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    let groupFormat;
    let days;

    switch (period) {
      case "daily":
        groupFormat = "%Y-%m-%d";
        days = 30;
        break;
      case "weekly":
        groupFormat = "%Y-%W";
        days = 90;
        break;
      case "monthly":
        groupFormat = "%Y-%m";
        days = 365;
        break;
      default:
        groupFormat = "%Y-%m";
        days = 365;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get booking trends
    const bookingTrends = await Parcel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: groupFormat, date: "$createdAt" },
          },
          bookings: { $sum: 1 },
          revenue: { $sum: "$paymentDetails.amount" },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          period: "$_id",
          bookings: 1,
          revenue: 1,
          _id: 0,
        },
      },
    ]);

    // Get payment method distribution
    const paymentDistribution = await Parcel.aggregate([
      {
        $group: {
          _id: "$paymentDetails.paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$paymentDetails.amount" },
        },
      },
      {
        $project: {
          method: "$_id",
          count: 1,
          totalAmount: 1,
          _id: 0,
        },
      },
    ]);

    // Get parcel type distribution
    const parcelTypeDistribution = await Parcel.aggregate([
      {
        $group: {
          _id: "$parcelDetails.type",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          type: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      message: "Statistics fetched successfully",
      data: {
        bookingTrends,
        paymentDistribution,
        parcelTypeDistribution,
      },
    });
  } catch (error) {
    console.error("Error fetching statistics:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
    });
  }
};

// Admin: Export report (CSV/PDF)
const exportReport = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { format = "csv", startDate, endDate } = req.query;

    // Verify admin role
    const admin = await User.findById(userId);
    if (admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    // Build filter
    const filter = {};
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Get parcels
    const parcels = await Parcel.find(filter)
      .populate("customerId", "name email")
      .populate("agentId", "name")
      .sort({ createdAt: -1 })
      .lean();

    if (format === "csv") {
      const headers = [
        "Tracking Number",
        "Customer Name",
        "Customer Email",
        "Agent Name",
        "Status",
        "Payment Method",
        "Amount",
        "COD Amount",
        "Created At",
        "Pickup Address",
        "Delivery Address",
      ];

      const rows = parcels.map((parcel) => [
        parcel.trackingNumber,
        parcel.customerId?.name || "N/A",
        parcel.customerId?.email || "N/A",
        parcel.agentId?.name || "Unassigned",
        parcel.status,
        parcel.paymentDetails.paymentMethod,
        parcel.paymentDetails.amount,
        parcel.paymentDetails.codAmount || 0,
        new Date(parcel.createdAt).toLocaleDateString(),
        parcel.pickupLocation.address,
        parcel.deliveryLocation.address,
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=parcel-report-${Date.now()}.csv`
      );
      return res.send(csvContent);
    } else if (format === "pdf") {
      res.status(501).json({
        success: false,
        message: "PDF export not implemented yet",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid format. Use 'csv' or 'pdf'",
      });
    }
  } catch (error) {
    console.error("Error exporting report:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to export report",
    });
  }
};

export const AdminController = {
  getDashboardMetrics,
  getAllParcels,
  assignAgentToParcel,
  getStatistics,
  exportReport,
};
